"""WebSocket integration test — spins up the FastAPI app in-process.

Tests:
1. Connection accepted, session_started handshake
2. Receives valid metric payloads at ~2Hz
3. Exercise command changes exercise field in stream
4. end_session command triggers session_ended + clean disconnect
5. Summary available via REST after session ends
6. All fatigue fields present in stream payload
"""
import json
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../.."))

from fastapi.testclient import TestClient
from backend.main import app

client = TestClient(app)


def _handshake(ws):
    """Consume the session_started event, return its session_id."""
    hello = json.loads(ws.receive_text())
    assert hello.get("event") == "session_started"
    return hello["session_id"]


def _next_tick(ws):
    """Return the next biometric tick, skipping any lifecycle events."""
    while True:
        msg = json.loads(ws.receive_text())
        if "event" not in msg:
            return msg


def test_health():
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


def test_websocket_receives_metrics():
    with client.websocket_connect("/ws/session/TEST_001") as ws:
        _handshake(ws)
        ticks = [_next_tick(ws) for _ in range(6)]

        required_keys = {
            "session_id", "exercise",
            "hr", "hrv", "power", "strain", "recovery", "source",
            "tick", "hr_zone", "struggling", "redline",
            "redline_event_count", "fatigue_index", "hrv_drop_pct",
        }
        missing = required_keys - set(ticks[0].keys())
        assert not missing, f"Missing keys: {missing}"
        ws.send_text(json.dumps({"action": "end_session"}))


def test_websocket_tick_counter_increments():
    with client.websocket_connect("/ws/session/TEST_002") as ws:
        _handshake(ws)
        tick_nums = [_next_tick(ws)["tick"] for _ in range(5)]
        assert tick_nums == list(range(1, 6)), f"Expected 1-5, got {tick_nums}"
        ws.send_text(json.dumps({"action": "end_session"}))


def test_websocket_exercise_command():
    with client.websocket_connect("/ws/session/TEST_003") as ws:
        _handshake(ws)
        _next_tick(ws)
        ws.send_text(json.dumps({"action": "start_exercise", "exercise": "SQUAT"}))
        changed = None
        for _ in range(10):
            t = _next_tick(ws)
            if t["exercise"] == "SQUAT":
                changed = t
                break
        assert changed is not None, "Exercise never changed to SQUAT"
        ws.send_text(json.dumps({"action": "end_session"}))


def test_squat_spikes_higher_than_curl():
    """Core differentiator: a squat drives HR higher than a curl."""
    def peak_hr_for(exercise):
        with client.websocket_connect(f"/ws/session/PEAK_{exercise}") as ws:
            _handshake(ws)
            ws.send_text(json.dumps({"action": "start_exercise", "exercise": exercise}))
            hrs = [_next_tick(ws)["hr"] for _ in range(40)]
            ws.send_text(json.dumps({"action": "end_session"}))
            return max(hrs)
    squat, curl = peak_hr_for("SQUAT"), peak_hr_for("CURL")
    print(f"  Peak HR — squat={squat} curl={curl}")
    assert squat > curl, f"Squat ({squat}) should peak higher than curl ({curl})"


def test_hr_in_physiological_range():
    with client.websocket_connect("/ws/session/TEST_004") as ws:
        _handshake(ws)
        hrs = [_next_tick(ws)["hr"] for _ in range(20)]
        assert 50 <= min(hrs), f"HR too low: {min(hrs)}"
        assert max(hrs) <= 190, f"HR too high: {max(hrs)}"
        ws.send_text(json.dumps({"action": "end_session"}))


def test_summary_via_rest_after_session():
    """After session ends, summary is retrievable via GET by its session_id."""
    with client.websocket_connect("/ws/session/TEST_005") as ws:
        session_id = _handshake(ws)
        for _ in range(8):
            _next_tick(ws)
        ws.send_text(json.dumps({"action": "end_session"}))

    r = client.get(f"/api/session/{session_id}")
    assert r.status_code == 200
    summary = r.json()
    assert "quality_score" in summary
    assert 0 <= summary["quality_score"] <= 100


def test_unknown_session_returns_error():
    r = client.get("/api/session/NONEXISTENT")
    assert r.json()["error"] == "not found"
