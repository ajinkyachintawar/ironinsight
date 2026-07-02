"""FastAPI app — WebSocket hub + REST skeleton.

WebSocket /ws/session/{session_id}:
  - Streams mock wearable metrics + fatigue state at ~2Hz
  - Client sends JSON commands: {"action": "start_exercise", "exercise": "SQUAT"}
  - On disconnect, session summary is printed (Supabase write wired in Step 5)

REST (Step 5 will flesh these out with Supabase):
  GET  /health
  GET  /api/session/{session_id}/summary  — returns last session summary
"""
import asyncio
import json
from contextlib import asynccontextmanager
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from .adapters.mock import MockWearableAdapter
from .engines.fatigue import FatigueEngine

# In-memory store for active sessions — replaced by Supabase in Step 5
_active_sessions: dict[str, dict] = {}


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield  # nothing to init yet; Supabase client goes here in Step 5


app = FastAPI(title="IronInsight API", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ------------------------------------------------------------------
# REST
# ------------------------------------------------------------------

@app.get("/health")
async def health():
    return {"status": "ok", "active_sessions": len(_active_sessions)}


@app.get("/api/session/{session_id}/summary")
async def get_summary(session_id: str):
    sess = _active_sessions.get(session_id)
    if not sess:
        return {"error": "session not found"}
    return sess.get("summary", {"error": "session still active"})


# ------------------------------------------------------------------
# WebSocket
# ------------------------------------------------------------------

@app.websocket("/ws/session/{session_id}")
async def session_ws(websocket: WebSocket, session_id: str):
    await websocket.accept()

    adapter = MockWearableAdapter()
    engine  = FatigueEngine(max_hr=192, resting_hr=62)
    current_exercise = "UNKNOWN"

    _active_sessions[session_id] = {"exercise": current_exercise, "summary": None}

    try:
        while True:
            # Check for incoming command without blocking the stream
            try:
                raw = await asyncio.wait_for(websocket.receive_text(), timeout=0.01)
                cmd = json.loads(raw)
                if cmd.get("action") == "start_exercise":
                    current_exercise = cmd.get("exercise", "UNKNOWN").upper()
                    _active_sessions[session_id]["exercise"] = current_exercise
                elif cmd.get("action") == "end_session":
                    break
            except asyncio.TimeoutError:
                pass  # no command this tick — normal

            # Pull biometrics + compute fatigue
            metrics = adapter.get_live_metrics()
            fatigue = engine.process_tick(
                hr=metrics["hr"],
                hrv=metrics["hrv"],
                power=160.0,  # ponytail: fixed power until exercise tracking in Step 5
            )

            payload = {
                "session_id": session_id,
                "exercise": current_exercise,
                **metrics,
                **fatigue,
            }
            await websocket.send_text(json.dumps(payload))
            await asyncio.sleep(0.5)  # 2Hz stream

    except WebSocketDisconnect:
        pass
    finally:
        summary = engine.session_summary()
        _active_sessions[session_id]["summary"] = summary
        print(f"[{session_id}] ended — quality: {summary.get('quality_score')}/100 "
              f"| avg HR: {summary.get('avg_hr')} | redlines: {len(summary.get('redline_events', []))}")
