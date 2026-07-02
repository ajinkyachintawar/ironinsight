"""FastAPI app — WebSocket hub + REST endpoints backed by SQLite."""
import asyncio
import json
from contextlib import asynccontextmanager
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session as DBSession

from .db import init_db, get_db
from .adapters.mock import MockWearableAdapter
from .engines.fatigue import FatigueEngine
from . import session_manager as sm


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


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
    return {"status": "ok"}


@app.post("/api/user")
async def create_user(body: dict, db: DBSession = Depends(get_db)):
    user = sm.get_or_create_user(db, username=body["username"], age=body.get("age", 28))
    return {"user_id": user.id, "username": user.username, "max_hr": user.max_hr}


@app.get("/api/session/{session_id}")
async def get_session(session_id: str, db: DBSession = Depends(get_db)):
    sess = sm.get_session(db, session_id)
    if not sess:
        return {"error": "not found"}
    return sess


@app.get("/api/history/{user_id}")
async def get_history(user_id: str, db: DBSession = Depends(get_db)):
    return {"history": sm.get_history(db, user_id)}


@app.get("/api/acwr/{user_id}")
async def get_acwr(user_id: str, db: DBSession = Depends(get_db)):
    return sm.compute_acwr(db, user_id)


# ------------------------------------------------------------------
# WebSocket
# ------------------------------------------------------------------

@app.websocket("/ws/session/{user_id}")
async def session_ws(websocket: WebSocket, user_id: str):
    await websocket.accept()

    # Depends(get_db) doesn't work on WebSocket routes — open manually
    db = next(get_db())

    adapter  = MockWearableAdapter()
    from .db import User
    user     = db.query(User).filter_by(id=user_id).first()
    max_hr   = user.max_hr     if user else 192
    rest_hr  = user.resting_hr if user else 62

    engine     = FatigueEngine(max_hr=max_hr, resting_hr=rest_hr)
    session_id = sm.start_session(db, user_id, recovery_score=adapter.get_recovery_score())

    current_exercise  = "UNKNOWN"
    exercise_ticks: dict[str, list] = {}   # exercise → list of {hr, power}

    # Notify client of session_id immediately
    await websocket.send_text(json.dumps({"event": "session_started", "session_id": session_id}))

    try:
        while True:
            try:
                raw = await asyncio.wait_for(websocket.receive_text(), timeout=0.01)
                cmd = json.loads(raw)
                if cmd.get("action") == "start_exercise":
                    current_exercise = cmd.get("exercise", "UNKNOWN").upper()
                elif cmd.get("action") == "end_session":
                    break
            except asyncio.TimeoutError:
                pass

            metrics = adapter.get_live_metrics()
            fatigue = engine.process_tick(hr=metrics["hr"], hrv=metrics["hrv"], power=160.0)

            # Accumulate per-exercise stats
            ex = current_exercise
            if ex not in exercise_ticks:
                exercise_ticks[ex] = []
            exercise_ticks[ex].append({"hr": metrics["hr"], "power": 160.0})

            await websocket.send_text(json.dumps({
                "session_id":  session_id,
                "exercise":    current_exercise,
                **metrics,
                **fatigue,
            }))
            await asyncio.sleep(0.5)

    except WebSocketDisconnect:
        pass
    finally:
        # Build per-exercise summary
        exercises = []
        for name, ticks in exercise_ticks.items():
            hrs   = [t["hr"] for t in ticks]
            pwrs  = [t["power"] for t in ticks]
            exercises.append({
                "name":          name,
                "avg_hr":        round(sum(hrs) / len(hrs), 1),
                "peak_hr":       max(hrs),
                "avg_power":     round(sum(pwrs) / len(pwrs), 1),
                "fatigue_index": None,  # needs rep-level data; wired in Step 6
            })

        summary = sm.end_session(
            db, session_id, engine,
            final_strain=adapter.get_session_strain(),
            exercises=exercises,
        )
        print(f"[{session_id}] quality={summary.get('quality_score')}/100 "
              f"avg_hr={summary.get('avg_hr')} strain={adapter.get_session_strain():.2f}")
        db.close()
