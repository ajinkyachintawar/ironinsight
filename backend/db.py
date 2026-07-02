"""Database setup — SQLite via SQLAlchemy.

Swap DATABASE_URL to postgresql://... for prod, nothing else changes.
"""
import os
from sqlalchemy import (
    create_engine, Column, String, Integer, Float, Boolean,
    DateTime, JSON, ForeignKey, func
)
from sqlalchemy.orm import DeclarativeBase, sessionmaker, relationship

DATABASE_URL = os.environ.get("DATABASE_URL", "sqlite:///./ironinsight.db")

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False} if "sqlite" in DATABASE_URL else {},
)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


class Base(DeclarativeBase):
    pass


# ------------------------------------------------------------------
# Tables
# ------------------------------------------------------------------

class User(Base):
    __tablename__ = "users"
    id          = Column(String, primary_key=True)   # uuid
    username    = Column(String, unique=True, nullable=False)
    age         = Column(Integer, default=28)
    max_hr      = Column(Integer, default=192)        # 220 - age
    resting_hr  = Column(Integer, default=62)
    persona     = Column(String, default="athlete")   # athlete | trainer | doctor
    created_at  = Column(DateTime, server_default=func.now())
    sessions    = relationship("Session", back_populates="user")


class Session(Base):
    __tablename__ = "sessions"
    id              = Column(String, primary_key=True)
    user_id         = Column(String, ForeignKey("users.id"), nullable=False)
    started_at      = Column(DateTime, server_default=func.now())
    ended_at        = Column(DateTime, nullable=True)
    quality_score   = Column(Integer, nullable=True)
    avg_hr          = Column(Float, nullable=True)
    peak_hr         = Column(Integer, nullable=True)
    avg_hrv         = Column(Float, nullable=True)
    total_ticks     = Column(Integer, nullable=True)
    strain          = Column(Float, nullable=True)
    recovery_score  = Column(Float, nullable=True)
    redline_events  = Column(JSON, default=list)
    zone_dist       = Column(JSON, default=dict)
    fatigue_index   = Column(Float, nullable=True)
    user            = relationship("User", back_populates="sessions")
    exercises       = relationship("ExerciseLog", back_populates="session")


class ExerciseLog(Base):
    __tablename__ = "exercise_logs"
    id              = Column(Integer, primary_key=True, autoincrement=True)
    session_id      = Column(String, ForeignKey("sessions.id"), nullable=False)
    name            = Column(String, nullable=False)   # SQUAT, BENCH, etc.
    avg_hr          = Column(Float, nullable=True)
    peak_hr         = Column(Integer, nullable=True)
    avg_power       = Column(Float, nullable=True)
    fatigue_index   = Column(Float, nullable=True)
    started_at      = Column(DateTime, server_default=func.now())
    session         = relationship("Session", back_populates="exercises")


class DailyReadiness(Base):
    __tablename__ = "daily_readiness"
    id              = Column(Integer, primary_key=True, autoincrement=True)
    user_id         = Column(String, ForeignKey("users.id"), nullable=False)
    date            = Column(String, nullable=False)   # YYYY-MM-DD
    resting_hr      = Column(Integer, nullable=True)
    hrv             = Column(Float, nullable=True)
    recovery_score  = Column(Float, nullable=True)
    strain          = Column(Float, nullable=True)


class InjuryFlag(Base):
    __tablename__ = "injury_flags"
    id          = Column(Integer, primary_key=True, autoincrement=True)
    user_id     = Column(String, ForeignKey("users.id"), nullable=False)
    session_id  = Column(String, ForeignKey("sessions.id"), nullable=False)
    flag_type   = Column(String, nullable=False)   # acwr_danger | hrv_suppressed | resting_hr_elevated
    value       = Column(Float, nullable=True)
    created_at  = Column(DateTime, server_default=func.now())


def init_db():
    Base.metadata.create_all(bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
