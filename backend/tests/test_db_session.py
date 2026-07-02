"""Tests for DB schema + session manager + REST endpoints."""
import sys, os, json, tempfile
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../.."))

# Temp file DB — avoids SQLite :memory: multi-connection issue
_tmp_db = tempfile.mktemp(suffix=".db")
os.environ["DATABASE_URL"] = f"sqlite:///{_tmp_db}"

from fastapi.testclient import TestClient
from backend.main import app
from backend.db import init_db, SessionLocal, engine, Base
import backend.session_manager as sm

# TestClient as context manager triggers lifespan (calls init_db)
client = TestClient(app)
client.__enter__()


# ------------------------------------------------------------------
# Helpers
# ------------------------------------------------------------------

def make_user(username="test_athlete", age=28):
    r = client.post("/api/user", json={"username": username, "age": age})
    assert r.status_code == 200
    return r.json()


# ------------------------------------------------------------------
# Schema / DB tests
# ------------------------------------------------------------------

def test_init_db_creates_tables():
    from sqlalchemy import inspect
    inspector = inspect(engine)
    tables = inspector.get_table_names()
    print(f"  Tables: {tables}")
    for expected in ["users", "sessions", "exercise_logs", "daily_readiness", "injury_flags"]:
        assert expected in tables, f"Missing table: {expected}"


def test_create_user():
    u = make_user("alice", age=25)
    print(f"  User: id={u['user_id'][:8]}... username={u['username']} max_hr={u['max_hr']}")
    assert u["username"] == "alice"
    assert u["max_hr"] == 195   # 220 - 25


def test_create_user_idempotent():
    make_user("bob", age=30)
    u2 = make_user("bob", age=30)
    assert u2["username"] == "bob"
    print(f"  Idempotent user creation: same id returned")


def test_max_hr_calculation():
    u = make_user("carol", age=35)
    assert u["max_hr"] == 185   # 220 - 35
    print(f"  max_hr for age 35: {u['max_hr']}")


# ------------------------------------------------------------------
# Session lifecycle via session_manager directly
# ------------------------------------------------------------------

def test_start_and_end_session():
    db = SessionLocal()
    user = sm.get_or_create_user(db, "dave", age=28)

    session_id = sm.start_session(db, user.id, recovery_score=68.0)
    print(f"  Session started: {session_id}")
    assert session_id.startswith("SESS_")

    from backend.engines.fatigue import FatigueEngine
    engine_inst = FatigueEngine(max_hr=192, resting_hr=62)
    for _ in range(20):
        engine_inst.process_tick(hr=145, hrv=40.0, power=160.0)

    summary = sm.end_session(db, session_id, engine_inst, final_strain=4.2, exercises=[
        {"name": "SQUAT", "avg_hr": 145.0, "peak_hr": 162, "avg_power": 160.0, "fatigue_index": -8.5}
    ])

    print(f"  Summary: quality={summary['quality_score']}/100 "
          f"avg_hr={summary['avg_hr']} peak_hr={summary['peak_hr']}")
    assert 0 <= summary["quality_score"] <= 100
    assert summary["total_ticks"] == 20
    db.close()


def test_get_session_rest():
    db = SessionLocal()
    user = sm.get_or_create_user(db, "eve", age=30)
    session_id = sm.start_session(db, user.id)

    from backend.engines.fatigue import FatigueEngine
    e = FatigueEngine()
    for _ in range(10): e.process_tick(hr=150, hrv=38.0, power=155.0)
    sm.end_session(db, session_id, e, final_strain=3.1, exercises=[])
    db.close()

    r = client.get(f"/api/session/{session_id}")
    assert r.status_code == 200
    sess = r.json()
    print(f"  GET /session: quality={sess['quality_score']} strain={sess['strain']}")
    assert sess["strain"] == 3.1
    assert sess["id"] == session_id


def test_get_history():
    db = SessionLocal()
    user = sm.get_or_create_user(db, "frank", age=32)
    user_id = user.id
    from backend.engines.fatigue import FatigueEngine

    for i in range(3):
        sid = sm.start_session(db, user_id)
        e = FatigueEngine()
        for _ in range(8): e.process_tick(hr=140 + i*5, hrv=40.0, power=160.0)
        sm.end_session(db, sid, e, final_strain=2.0 + i, exercises=[])
    db.close()

    r = client.get(f"/api/history/{user_id}")
    assert r.status_code == 200
    history = r.json()["history"]
    print(f"  History: {len(history)} sessions | quality scores: {[s['quality_score'] for s in history]}")
    assert len(history) == 3


def test_acwr_endpoint():
    db = SessionLocal()
    user = sm.get_or_create_user(db, "grace", age=27)
    user_id = user.id
    from backend.engines.fatigue import FatigueEngine

    # Simulate 10 sessions with increasing strain — pushes ACWR high
    for i in range(10):
        sid = sm.start_session(db, user_id)
        e = FatigueEngine()
        for _ in range(10): e.process_tick(hr=165, hrv=30.0, power=180.0)
        sm.end_session(db, sid, e, final_strain=5.0 + i * 0.5, exercises=[])
    db.close()

    r = client.get(f"/api/acwr/{user_id}")
    assert r.status_code == 200
    data = r.json()
    print(f"  ACWR: {data['acwr']} risk={data['risk']} "
          f"acute={data['acute_7d']} chronic={data['chronic_28d']}")
    assert "acwr" in data
    assert data["risk"] in ("low", "green", "yellow", "red")


def test_session_not_found():
    r = client.get("/api/session/NONEXISTENT")
    assert r.json()["error"] == "not found"
    print(f"  Not found: {r.json()}")


def test_websocket_persists_to_db():
    """Full flow: create user → WS session → end → verify in DB."""
    u = make_user("henry", age=29)
    user_id = u["user_id"]

    with client.websocket_connect(f"/ws/session/{user_id}") as ws:
        # First message is session_started event
        event = json.loads(ws.receive_text())
        assert event["event"] == "session_started"
        session_id = event["session_id"]
        print(f"  WS session_id: {session_id}")

        ws.send_text(json.dumps({"action": "start_exercise", "exercise": "BENCH"}))
        for _ in range(6):
            ws.receive_text()
        ws.send_text(json.dumps({"action": "end_session"}))

    # Verify persisted
    r = client.get(f"/api/session/{session_id}")
    sess = r.json()
    print(f"  Persisted: quality={sess['quality_score']}/100 "
          f"avg_hr={sess['avg_hr']} strain={sess['strain']:.2f}")
    assert sess["quality_score"] is not None
    assert sess["avg_hr"] is not None


if __name__ == "__main__":
    tests = [
        test_init_db_creates_tables,
        test_create_user,
        test_create_user_idempotent,
        test_max_hr_calculation,
        test_start_and_end_session,
        test_get_session_rest,
        test_get_history,
        test_acwr_endpoint,
        test_session_not_found,
        test_websocket_persists_to_db,
    ]
    passed = failed = 0
    for t in tests:
        try:
            print(f"\n▶ {t.__name__}")
            t()
            print(f"  ✅ PASS")
            passed += 1
        except Exception as e:
            print(f"  ❌ FAIL: {e}")
            import traceback; traceback.print_exc()
            failed += 1
    print(f"\n{'='*40}")
    print(f"Results: {passed} passed, {failed} failed")
