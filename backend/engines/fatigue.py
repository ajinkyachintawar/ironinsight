"""Fatigue engine — stateful per-session detector.

Tracks rolling metrics and fires alerts based on validated thresholds.
All thresholds documented in CLAUDE.md.
"""
from dataclasses import dataclass, field
from .metrics import hr_zone, fatigue_index, zone_time_distribution, warmup_score


@dataclass
class SessionState:
    """Mutable state accumulated during a live session."""
    max_hr: int = 192
    resting_hr: int = 62

    hr_series: list[int] = field(default_factory=list)
    hrv_series: list[float] = field(default_factory=list)
    power_series: list[float] = field(default_factory=list)

    # Redline tracking
    redline_ticks: int = 0          # consecutive ticks above 95% max HR
    redline_events: list[dict] = field(default_factory=list)

    # Session baseline (set on first N ticks)
    baseline_hrv: float | None = None
    baseline_power: float | None = None

    tick: int = 0


class FatigueEngine:
    """Processes each biometric tick and returns current fatigue state."""

    STRUGGLING_HR_PCT    = 0.88
    STRUGGLING_POWER_DRP = 0.15   # 15% drop from baseline
    STRUGGLING_HRV_DRP   = 0.20   # 20% drop from session-start HRV
    REDLINE_HR_PCT       = 0.95
    REDLINE_TICKS        = 6      # ~30s at 0.2Hz server tick; adjust per actual rate
    BASELINE_TICKS       = 10     # ticks before baseline is locked

    def __init__(self, max_hr: int = 192, resting_hr: int = 62):
        self.state = SessionState(max_hr=max_hr, resting_hr=resting_hr)

    def process_tick(self, hr: int, hrv: float, power: float = 0.0) -> dict:
        """Feed one biometric reading. Returns current fatigue snapshot."""
        s = self.state
        s.tick += 1
        s.hr_series.append(hr)
        s.hrv_series.append(hrv)
        if power > 0:
            s.power_series.append(power)

        # Lock baseline after first N ticks
        if s.tick == self.BASELINE_TICKS:
            s.baseline_hrv   = sum(s.hrv_series) / len(s.hrv_series)
            s.baseline_power = sum(s.power_series) / len(s.power_series) if s.power_series else None

        struggling = self._is_struggling(hr, hrv, power)
        redline    = self._check_redline(hr, s.tick)
        zone       = hr_zone(hr, s.max_hr)

        return {
            "tick": s.tick,
            "hr_zone": zone,
            "struggling": struggling,
            "redline": redline,
            "redline_event_count": len(s.redline_events),
            "fatigue_index": fatigue_index(s.power_series) if len(s.power_series) >= 6 else None,
            "hrv_drop_pct": self._hrv_drop_pct(hrv),
        }

    def session_summary(self) -> dict:
        """Call on session end — returns full quality breakdown."""
        s = self.state
        if not s.hr_series:
            return {}

        zone_dist  = zone_time_distribution(s.hr_series, s.max_hr)
        w_score    = warmup_score(s.hr_series, s.max_hr)
        fi         = fatigue_index(s.power_series) if len(s.power_series) >= 6 else 0.0
        quality    = self._quality_score(zone_dist, w_score, fi, len(s.redline_events))

        return {
            "total_ticks": s.tick,
            "avg_hr": round(sum(s.hr_series) / len(s.hr_series), 1),
            "peak_hr": max(s.hr_series),
            "avg_hrv": round(sum(s.hrv_series) / len(s.hrv_series), 1),
            "min_hrv": round(min(s.hrv_series), 1),
            "hr_zone_distribution": zone_dist,
            "warmup_score": w_score,
            "fatigue_index": fi,
            "redline_events": s.redline_events,
            "quality_score": quality,
        }

    def overtraining_flag(self, hrv_7d_avg: float, hrv_30d_avg: float,
                          resting_hr_now: int, baseline_resting_hr: int,
                          acwr: float) -> dict:
        """Stateless check — can be called without a live session."""
        hrv_flag  = hrv_30d_avg > 0 and hrv_7d_avg < hrv_30d_avg * 0.90
        hr_flag   = resting_hr_now > baseline_resting_hr + 5
        acwr_flag = acwr > 1.5
        triggered = hrv_flag or hr_flag or acwr_flag
        return {
            "overtraining_risk": triggered,
            "hrv_suppressed": hrv_flag,
            "resting_hr_elevated": hr_flag,
            "acwr_danger": acwr_flag,
        }

    # ------------------------------------------------------------------
    # Private helpers
    # ------------------------------------------------------------------

    def _is_struggling(self, hr: int, hrv: float, power: float) -> bool:
        s = self.state
        hr_flag  = hr > s.max_hr * self.STRUGGLING_HR_PCT

        hrv_flag = False
        if s.baseline_hrv:
            hrv_flag = hrv < s.baseline_hrv * (1 - self.STRUGGLING_HRV_DRP)

        power_flag = False
        if s.baseline_power and power > 0:
            power_flag = power < s.baseline_power * (1 - self.STRUGGLING_POWER_DRP)

        return hr_flag and (hrv_flag or power_flag)

    def _check_redline(self, hr: int, tick: int) -> bool:
        s = self.state
        if hr > s.max_hr * self.REDLINE_HR_PCT:
            s.redline_ticks += 1
            if s.redline_ticks == self.REDLINE_TICKS:
                s.redline_events.append({"tick": tick, "hr": hr})
            return s.redline_ticks >= self.REDLINE_TICKS
        else:
            s.redline_ticks = 0
            return False

    def _hrv_drop_pct(self, hrv: float) -> float | None:
        if not self.state.baseline_hrv:
            return None
        return round((self.state.baseline_hrv - hrv) / self.state.baseline_hrv * 100, 1)

    def _quality_score(self, zone_dist: dict, warmup: float,
                       fi: float, redline_count: int) -> int:
        """Session quality 0-100.

        Components:
          - Zone efficiency (40pts): time in Z3-Z4 vs total. Z5 doesn't count — it's redlining.
          - Warmup (20pts): proper ramp
          - Power consistency (25pts): low fatigue index
          - Redline penalty (-10 per event, max -30)
        """
        total_ticks = sum(zone_dist.values()) or 1
        productive  = zone_dist[3] + zone_dist[4]
        zone_score  = min(40, int(productive / total_ticks * 40 * 1.5))

        warmup_pts  = int(warmup * 0.20)

        # fatigue_index is negative when fatigued, 0 = no decay
        fi_score = max(0, 25 + int(fi * 0.5))  # fi=-20 → 15pts, fi=0 → 25pts
        fi_score = min(25, fi_score)

        redline_penalty = min(30, redline_count * 10)

        raw = zone_score + warmup_pts + fi_score - redline_penalty
        return max(0, min(100, raw))
