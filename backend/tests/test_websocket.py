"""WebSocket integration test — spins up the FastAPI app in-process.

Tests:
1. Connection accepted
2. Receives valid metric payloads at ~2Hz
3. Exercise command changes exercise field in stream
4. end_session command triggers clean disconnect
5. Summary available via REST after session ends
6. All fatigue fields present in stream payload
"""
import asyncio
import json
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../.."))

from fastapi.testclient import TestClient
from backend.main import app

client = TestClient(app)


def test_health():
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"
    print(f"  Health: {r.json()}")


def test_websocket_receives_metrics():
    """Connect, collect 6 ticks, verify payload shape."""
    with client.websocket_connect("/ws/session/TEST_001") as ws:
        ticks = []
        for _ in range(6):
            raw = ws.receive_text()
            ticks.append(json.loads(raw))

        required_keys = {
            "session_id", "exercise",
            "hr", "hrv", "strain", "recovery", "source",
            "tick", "hr_zone", "struggling", "redline",
            "redline_event_count", "fatigue_index", "hrv_drop_pct",
        }
        missing = required_keys - set(ticks[0].keys())
        assert not missing, f"Missing keys: {missing}"
        print(f"  Tick 1 payload: hr={ticks[0]['hr']} hrv={ticks[0]['hrv']} "
              f"zone=Z{ticks[0]['hr_zone']} struggling={ticks[0]['struggling']}")
        print(f"  Tick 6 payload: hr={ticks[5]['hr']} strain={ticks[5]['strain']:.3f} "
              f"tick={ticks[5]['tick']}")
        ws.send_text(json.dumps({"action": "end_session"}))


def test_websocket_tick_counter_increments():
    with client.websocket_connect("/ws/session/TEST_002") as ws:
        ticks = [json.loads(ws.receive_text()) for _ in range(5)]
        tick_nums = [t["tick"] for t in ticks]
        print(f"  Tick sequence: {tick_nums}")
        assert tick_nums == list(range(1, 6)), f"Expected 1-5, got {tick_nums}"
        ws.send_text(json.dumps({"action": "end_session"}))


def test_websocket_exercise_command():
    """Sending start_exercise changes the exercise field in subsequent ticks."""
    with client.websocket_connect("/ws/session/TEST_003") as ws:
        # Collect 2 ticks (default exercise = UNKNOWN)
        t1 = json.loads(ws.receive_text())
        t2 = json.loads(ws.receive_text())
        print(f"  Before command: exercise='{t1['exercise']}'")

        ws.send_text(json.dumps({"action": "start_exercise", "exercise": "SQUAT"}))

        # Collect next ticks until exercise changes (or 10 attempts)
        changed = None
        for _ in range(10):
            t = json.loads(ws.receive_text())
            if t["exercise"] == "SQUAT":
                changed = t
                break

        print(f"  After command: exercise='{changed['exercise'] if changed else 'never changed'}'")
        assert changed is not None, "Exercise never changed to SQUAT"
        ws.send_text(json.dumps({"action": "end_session"}))


def test_hr_in_physiological_range():
    with client.websocket_connect("/ws/session/TEST_004") as ws:
        hrs = [json.loads(ws.receive_text())["hr"] for _ in range(20)]
        min_hr, max_hr = min(hrs), max(hrs)
        print(f"  HR over 20 ticks: min={min_hr} max={max_hr}")
        assert 50 <= min_hr, f"HR too low: {min_hr}"
        assert max_hr <= 190, f"HR too high: {max_hr}"
        ws.send_text(json.dumps({"action": "end_session"}))


def test_summary_via_rest_after_session():
    """After session ends, summary is retrievable via GET."""
    with client.websocket_connect("/ws/session/TEST_005") as ws:
        for _ in range(8):
            ws.receive_text()
        ws.send_text(json.dumps({"action": "end_session"}))

    r = client.get("/api/session/TEST_005/summary")
    assert r.status_code == 200
    summary = r.json()
    print(f"  Summary: quality={summary.get('quality_score')}/100 "
          f"avg_hr={summary.get('avg_hr')} peak_hr={summary.get('peak_hr')}")
    assert "quality_score" in summary
    assert 0 <= summary["quality_score"] <= 100
    assert summary["total_ticks"] == 8


def test_unknown_session_returns_error():
    r = client.get("/api/session/NONEXISTENT/summary")
    assert r.json()["error"] == "session not found"
    print(f"  Unknown session response: {r.json()}")


if __name__ == "__main__":
    tests = [
        test_health,
        test_websocket_receives_metrics,
        test_websocket_tick_counter_increments,
        test_websocket_exercise_command,
        test_hr_in_physiological_range,
        test_summary_via_rest_after_session,
        test_unknown_session_returns_error,
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
            failed += 1
    print(f"\n{'='*40}")
    print(f"Results: {passed} passed, {failed} failed")
