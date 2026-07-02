# IronInsight — CLAUDE.md

## What this project is
A wearable-agnostic gym analytics platform. Treats Whoop/Fitbit/Garmin as plugins via a normalized adapter interface. Built as a POC with a mock wearable — swap one file to go real.

## Reference project
`/Users/ajinkyagajananraochintawar/Fog_Edge-main` — original IronInsight by Neel Sawant. Architecture reference only. Do NOT copy credentials or Windows-specific code (taskkill).

## Stack
- **Frontend**: Next.js + TypeScript (`/frontend`)
- **Backend**: FastAPI + Python 3.11+ (`/backend`)
- **Real-time**: WebSocket (FastAPI native)
- **Database**: Supabase (Postgres + Auth)
- **Mock wearable**: `backend/adapters/mock.py` — swap for `whoop.py` / `fitbit.py` later

## Personas & what they see
- **Athlete**: quality score, rest timer, fatigue alerts, progression
- **Trainer**: volume load, push/pull balance, per-client fatigue index
- **Doctor/Physio**: ACWR, HRV trend, overtraining flags, redline history

## Core metric logic (DO NOT simplify away)

### Fatigue detection
```python
struggling = hr > 0.88 * max_hr AND power_delta < -0.15 AND hrv_drop > 0.20
redline    = hr > 0.95 * max_hr sustained > 30s
```

### ACWR (injury risk)
```python
acwr = acute_load_7d / chronic_load_28d
# green: 0.8-1.3 | yellow: 1.3-1.5 | red: >1.5
```

### Overtraining
```python
hrv_7d_avg < hrv_30d_avg * 0.90
OR resting_hr > baseline_resting_hr + 5
OR acwr > 1.5
```

### Session quality score (0-100)
Combines: zone efficiency + warmup score + inter-set recovery + power consistency - redline penalty - overtraining penalty

### Cardiac efficiency
```python
efficiency = avg_power_watts / avg_hr_bpm  # higher = more fit
```

### HR zones (% of max_hr = 220 - age)
Z1: 50-60% | Z2: 60-70% | Z3: 70-80% | Z4: 80-90% | Z5: 90-100%

### HR Recovery (post-set)
Elite: >30 BPM drop in 60s | Average: 12-20 | Flag: <12

## Mock wearable output contract
```python
{
  "hr": int,          # beats per minute
  "hrv": float,       # RMSSD in ms
  "strain": float,    # 0-21 Whoop-style accumulator
  "recovery": float,  # 0-100 pre-session score
  "source": str       # "mock" | "whoop" | "fitbit"
}
```

## Normalized adapter interface
All adapters must implement:
```python
class WearableAdapter:
    def get_live_metrics(self) -> dict: ...
    def get_recovery_score(self) -> float: ...
    def get_session_strain(self) -> float: ...
```

## Current status (as of 2026-07-02)
ALL 9 steps complete. Backend fully working. Frontend builds clean.

### Running the project
```bash
# Backend (from ~/ironinsight)
.venv/bin/uvicorn backend.main:app --reload

# Frontend (from ~/ironinsight/frontend)
npm run dev
```

### What's working
- WebSocket stream: ws://localhost:8000/ws/session/{user_id}
- REST: POST /api/user, GET /api/session/{id}, GET /api/history/{user_id}, GET /api/acwr/{user_id}
- SQLite DB at ~/ironinsight/ironinsight.db
- Demo user: id=479b0879-3128-41b7-a74e-83c5375dd6c1, username=ajinkya, age=25, max_hr=195
- Frontend: http://localhost:3000 — Live, Summary, History, Persona toggle

### Known issues fixed
- WebSocket 404: was missing `uvicorn[standard]` — fixed, websockets library now installed
- WebSocket Depends(get_db) doesn't work — fixed, DB opened manually in handler
- Run uvicorn from ~/ironinsight NOT ~/ironinsight/backend

### Next frontend work (pending)
- UI redesign: looks AI-generated, needs professional human touch
- Integrate test/demo controls INTO the UI (no terminal testing)
- Use frontend-design skill for redesign

## Build order (do NOT skip steps)
1. Mock wearable + unit tests → verify realistic physiology numbers
2. Fatigue engine + unit tests → verify all thresholds
3. FastAPI skeleton + WebSocket → verify data flows end-to-end
4. Supabase schema + migrations
5. Session manager (start/end/store)
6. REST endpoints for history + analytics
7. Next.js live session page
8. Next.js session summary page
9. Next.js history + trends page
10. Persona view toggle

## Verified test results (DO NOT change thresholds without re-running tests)

### Step 1 — Mock wearable (9/9 pass)
| Metric | Observed |
|---|---|
| HR range | 60–180 BPM |
| HRV at low HR (<100) | 53.5 ms avg |
| HRV at high HR (>150) | 23.9 ms avg |
| HRV range | 20.6–61.6 ms |
| Strain @ 200 ticks | 4.74 |
| Strain @ 500 ticks max | 11.53 |
| Recovery score | 74.0 (static) |

### Step 2 — Fatigue engine (13/13 pass)
| Test | Key number |
|---|---|
| Cardiac efficiency | 1.207 W/BPM (175W / 145BPM) |
| Fatigue index no decay | 0.0% |
| Fatigue index fatigued | -22.3% |
| HR recovery elite | 36 BPM drop in 60s |
| HR recovery poor | 8 BPM drop (flag <12) |
| EPOC hard session | 56.2 min |
| EPOC easy session | 27.4 min |
| ACWR sweet spot | 1.2 → green |
| ACWR danger | 1.6 → red |
| Warmup good | 80/100 |
| Warmup bad (no warmup) | 20/100 |
| Struggling fires | HRV drop 48.3% + HR Z4 |
| Redline trigger | tick 6 (sustained >95% max HR) |
| Quality score range | 66-70/100 in 100-tick mock session |

### Zone boundaries confirmed (max_hr=192)
| HR | % max | Zone |
|---|---|---|
| 115 | 59.9% | Z1 |
| 116 | 60.4% | Z2 |
| 135 | 70.3% | Z3 |
| 154 | 80.2% | Z4 |
| 173 | 90.1% | Z5 |

## Testing rules
- Every engine/adapter gets a standalone test in `backend/tests/`
- Run tests before moving to next step — log actual output numbers here
- No mocking internal code (only mock wearable at the adapter boundary)

## Key numbers to verify in tests
| Metric | Expected range | Flag if |
|---|---|---|
| Resting HR | 55-75 BPM | >100 or <40 |
| Peak HR (hard set) | 155-185 BPM | >220-age |
| HRV resting | 40-80 ms | <20 concerning |
| HRV during hard set | 20-40 ms | — |
| Power (strength exercise) | 100-250W | — |
| Strain end of session | 10-18 | >21 impossible |
| ACWR sweet spot | 0.8-1.3 | >1.5 = injury risk |
| Session quality score | 0-100 | — |

## DO NOTs
- No hardcoded AWS credentials anywhere
- No Windows-specific subprocess calls (taskkill)
- No polling — use WebSocket push
- Do not scan full DynamoDB tables (not using DynamoDB — Supabase only)
- Do not fake data when wearable not connected — show empty state
