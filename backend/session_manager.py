"""Session lifecycle — start, end, store, retrieve."""
import uuid
from datetime import datetime, timezone
from sqlalchemy.orm import Session as DBSession
from .db import Session, ExerciseLog, InjuryFlag, DailyReadiness, User
from .engines.fatigue import FatigueEngine
from .engines.metrics import acwr, acwr_risk


def get_or_create_user(db: DBSession, username: str, age: int = 28) -> User:
    user = db.query(User).filter_by(username=username).first()
    if not user:
        user = User(
            id=str(uuid.uuid4()),
            username=username,
            age=age,
            max_hr=220 - age,
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    return user


def start_session(db: DBSession, user_id: str, recovery_score: float = 74.0) -> str:
    session_id = f"SESS_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}_{uuid.uuid4().hex[:6]}"
    sess = Session(
        id=session_id,
        user_id=user_id,
        recovery_score=recovery_score,
    )
    db.add(sess)
    db.commit()
    return session_id


def end_session(db: DBSession, session_id: str, engine: FatigueEngine,
                final_strain: float, exercises: list[dict]) -> dict:
    summary = engine.session_summary()

    db.query(Session).filter_by(id=session_id).update({
        "ended_at":      datetime.now(timezone.utc),
        "quality_score": summary.get("quality_score"),
        "avg_hr":        summary.get("avg_hr"),
        "peak_hr":       summary.get("peak_hr"),
        "avg_hrv":       summary.get("avg_hrv"),
        "total_ticks":   summary.get("total_ticks"),
        "strain":        final_strain,
        "redline_events": summary.get("redline_events", []),
        "zone_dist":     summary.get("hr_zone_distribution", {}),
        "fatigue_index": summary.get("fatigue_index"),
    })

    for ex in exercises:
        db.add(ExerciseLog(
            session_id=session_id,
            name=ex.get("name", "UNKNOWN"),
            avg_hr=ex.get("avg_hr"),
            peak_hr=ex.get("peak_hr"),
            avg_power=ex.get("avg_power"),
            fatigue_index=ex.get("fatigue_index"),
        ))

    db.commit()
    return summary


def get_session(db: DBSession, session_id: str) -> dict | None:
    sess = db.query(Session).filter_by(id=session_id).first()
    if not sess:
        return None
    return _serialize_session(sess)


def get_history(db: DBSession, user_id: str, limit: int = 20) -> list[dict]:
    sessions = (
        db.query(Session)
        .filter_by(user_id=user_id)
        .filter(Session.ended_at.isnot(None))
        .order_by(Session.started_at.desc())
        .limit(limit)
        .all()
    )
    return [_serialize_session(s) for s in sessions]


def compute_acwr(db: DBSession, user_id: str) -> dict:
    """Compute ACWR from stored session strain values."""
    sessions = (
        db.query(Session)
        .filter_by(user_id=user_id)
        .filter(Session.ended_at.isnot(None), Session.strain.isnot(None))
        .order_by(Session.started_at.desc())
        .limit(28)
        .all()
    )
    if not sessions:
        return {"acwr": 0.0, "risk": "low", "acute_7d": 0.0, "chronic_28d": 0.0}

    strains = [s.strain for s in sessions]
    acute   = sum(strains[:7])
    chronic = sum(strains) / 4  # 28-day total / 4 = avg weekly
    ratio   = acwr(acute, chronic)
    return {
        "acwr": ratio,
        "risk": acwr_risk(ratio),
        "acute_7d": round(acute, 2),
        "chronic_28d": round(chronic, 2),
    }


def save_injury_flags(db: DBSession, user_id: str, session_id: str,
                      overtraining: dict) -> None:
    flag_map = {
        "hrv_suppressed":      "hrv_suppressed",
        "resting_hr_elevated": "resting_hr_elevated",
        "acwr_danger":         "acwr_danger",
    }
    for key, flag_type in flag_map.items():
        if overtraining.get(key):
            db.add(InjuryFlag(
                user_id=user_id,
                session_id=session_id,
                flag_type=flag_type,
            ))
    db.commit()


def _serialize_session(s: Session) -> dict:
    return {
        "id":            s.id,
        "started_at":    s.started_at.isoformat() if s.started_at else None,
        "ended_at":      s.ended_at.isoformat() if s.ended_at else None,
        "quality_score": s.quality_score,
        "avg_hr":        s.avg_hr,
        "peak_hr":       s.peak_hr,
        "avg_hrv":       s.avg_hrv,
        "total_ticks":   s.total_ticks,
        "strain":        s.strain,
        "fatigue_index": s.fatigue_index,
        "redline_events": s.redline_events or [],
        "zone_dist":     s.zone_dist or {},
        "exercises": [
            {
                "name":          e.name,
                "avg_hr":        e.avg_hr,
                "peak_hr":       e.peak_hr,
                "avg_power":     e.avg_power,
                "fatigue_index": e.fatigue_index,
            }
            for e in s.exercises
            if e.name != "UNKNOWN"
        ],
    }
