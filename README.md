# IronInsight

A wearable-agnostic gym analytics platform. IronInsight sits on top of devices
like Whoop or Fitbit and adds the one thing they can't see: exercise context.
A wrist wearable knows your heart rate is high — it has no idea whether
that's because you're squatting, curling, or on a treadmill. IronInsight
fuses biometric data with the exercise you're actually doing to surface
fatigue, recovery, and injury signals a wearable alone can't produce.

This is a proof of concept built without a physical wearable. A mock adapter
simulates physiologically realistic biometric data per exercise, so the same
analysis pipeline works today and drops in a real device adapter later with
no other changes.

## Why this exists

Wearables are good at "how hard is your heart working." They are blind to
"at what." An isolation curl that spikes you into the same heart-rate zone
as a heavy squat is a real anomaly — too much load, poor breathing, or
under-recovery — but a wrist device has no way to flag it, because it never
knows which movement you're doing. IronInsight closes that gap by treating
the exercise itself as a first-class signal alongside heart rate, HRV, and
power.

## What it does

- Streams live heart rate, HRV, power, and strain during a session via
  WebSocket at 2Hz
- Detects fatigue in real time: struggling (high HR with power and HRV both
  dropping) and redline (sustained HR above 95% of max)
- Computes Acute:Chronic Workload Ratio (ACWR) across sessions to flag
  injury risk before it becomes an injury
- Breaks down a session by exercise: peak HR, average power, and power
  decay per movement, with automatic flags when an isolation exercise
  produces cardiovascular load it shouldn't
- Tracks sets and rest between them, with a smart rest timer that reads
  your actual heart-rate recovery curve instead of running a fixed timer
- Scores each session 0-100 on effort/recovery balance, warmup quality,
  and time spent in each heart-rate zone
- Stores full session history with trend charts, so quality and workload
  can be tracked over weeks, not just within one workout

## How it's different from what your wearable already shows

| Wearable alone | IronInsight |
|---|---|
| High HR | High HR *during a bicep curl* — flags an anomaly |
| A single strain number | Strain broken down per exercise |
| A fixed rest timer | A rest timer driven by your measured recovery curve |
| Injury risk buried across screens | One ACWR + fatigue view per session |

## Architecture

```
backend/
  adapters/        Wearable adapter interface + mock implementation
  engines/         Pure metric functions (HR zones, ACWR, fatigue detection)
  main.py          FastAPI app: WebSocket stream + REST endpoints
  session_manager  Session lifecycle: start, end, persist, retrieve
  db.py            SQLAlchemy models (SQLite by default)

frontend/
  app/             Next.js App Router pages: live session, summary, history
  components/      Chart, gauge, and status UI components
  lib/             WebSocket hook, shared types
```

### Wearable adapter interface

Every data source, real or simulated, implements the same interface:

```python
class WearableAdapter(ABC):
    def get_live_metrics(self) -> dict: ...
    def get_recovery_score(self) -> float: ...
    def get_session_strain(self) -> float: ...
    def reset_session(self) -> None: ...
```

The mock adapter (`backend/adapters/mock.py`) generates HR, HRV, power, and
strain with exercise-specific physiology: a squat drives heart rate toward
~92% of max, a curl only to ~66%, and power decays at different rates per
movement. Swapping in a real device means writing one new adapter file —
nothing else in the pipeline changes.

## Stack

- **Backend:** FastAPI (Python), WebSocket for real-time streaming
- **Database:** SQLite via SQLAlchemy (swap to Postgres by setting
  `DATABASE_URL` — no code changes required)
- **Frontend:** Next.js, TypeScript, Recharts
- **No external services required to run it** — everything is local

## Running it

Requires Python 3.11+ and Node 18+.

```bash
# Backend — from the project root
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn backend.main:app --reload

# Frontend — in a second terminal
cd frontend
npm install
npm run dev
```

Open `http://localhost:3000`. The backend runs on `http://localhost:8000`.

## Testing

```bash
python -m pytest backend/tests/
```

Tests cover the mock adapter's physiological realism (HR ranges, HRV
inverse correlation, strain accumulation, rest recovery curves), the
fatigue engine's threshold logic (struggling, redline, ACWR, quality
scoring), and the WebSocket session lifecycle end to end.

## API overview

| Endpoint | Description |
|---|---|
| `GET /health` | Health check |
| `POST /api/user` | Create or fetch a user |
| `GET /api/session/{id}` | Full summary for one session |
| `GET /api/history/{user_id}` | Past sessions for a user |
| `GET /api/acwr/{user_id}` | Current injury-risk ratio |
| `WS /ws/session/{user_id}` | Live biometric stream + session control |

WebSocket clients send `{"action": "start_exercise", "exercise": "SQUAT"}`,
`{"action": "start_set"}`, `{"action": "end_set"}`, or
`{"action": "end_session"}` to control the session in real time.

## Status

This is an active proof of concept. The core pipeline — live streaming,
fatigue detection, ACWR, and per-exercise analytics — is complete and
tested. Set-level persistence and a fused injury-risk score are in
progress. See `CLAUDE.md` for the full build log, metric formulas, and
current state.
