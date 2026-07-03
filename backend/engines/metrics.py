"""Core metric computations — stateless pure functions."""


def hr_zone(hr: int, max_hr: int) -> int:
    """Return HR zone 1-5 based on % of max HR."""
    pct = hr / max_hr
    if pct < 0.60: return 1
    if pct < 0.70: return 2
    if pct < 0.80: return 3
    if pct < 0.90: return 4
    return 5


def cardiac_efficiency(avg_power_watts: float, avg_hr: float) -> float:
    """Watts per BPM — higher means more work per heartbeat (fitter)."""
    if avg_hr <= 0:
        return 0.0
    return round(avg_power_watts / avg_hr, 3)


def fatigue_index(power_series: list[float]) -> float:
    """% power decay from first 3 reps to last 3 reps.

    Negative = fatigued. -20% or worse = form likely breaking down.
    Returns 0.0 if not enough data.
    """
    if len(power_series) < 6:
        return 0.0
    early = sum(power_series[:3]) / 3
    late  = sum(power_series[-3:]) / 3
    if early == 0:
        return 0.0
    return round((late - early) / early * 100, 1)


def hr_recovery_rate(hr_at_stop: int, hr_60s_later: int) -> int:
    """BPM drop in 60 seconds post-exercise. Elite: >30, Flag: <12."""
    return hr_at_stop - hr_60s_later


def epoc_estimate_minutes(peak_hr: int, resting_hr: int, max_hr: int) -> float:
    """Rough EPOC estimate in minutes.

    Higher intensity → longer elevated post-exercise metabolism.
    Empirical approximation: not clinical, directionally correct.
    """
    intensity = (peak_hr - resting_hr) / (max_hr - resting_hr)
    # Low intensity: ~5-10min EPOC. High intensity: ~30-60min.
    return round(5 + intensity * 55, 1)


def acwr(acute_load_7d: float, chronic_load_28d: float) -> float:
    """Acute:Chronic Workload Ratio. Sweet spot 0.8-1.3. >1.5 = injury risk."""
    if chronic_load_28d <= 0:
        return 0.0
    return round(acute_load_7d / chronic_load_28d, 2)


def acwr_risk(ratio: float) -> str:
    """green | yellow | red"""
    if ratio < 0.8:  return "low"
    if ratio <= 1.3: return "green"
    if ratio <= 1.5: return "yellow"
    return "red"


def rest_readiness(current_hr: int, hr_at_set_end: int, resting_hr: int) -> dict:
    """How recovered you are during rest, and whether to start the next set.

    Ready = HR has shed ~60% of the climb it made during the set (back near a
    working baseline, not all the way to true resting — that would waste time).
        target = resting + 0.40 * (hr_at_set_end - resting)
    Returns pct recovered (0-100, clamped) and a ready flag.
    """
    climb = max(1, hr_at_set_end - resting_hr)
    target = resting_hr + 0.40 * climb
    dropped = hr_at_set_end - current_hr
    needed  = hr_at_set_end - target
    pct = 0.0 if needed <= 0 else max(0.0, min(100.0, dropped / needed * 100))
    return {
        "recovery_pct": round(pct, 1),
        "target_hr": round(target),
        "ready": current_hr <= target,
    }


def zone_time_distribution(hr_series: list[int], max_hr: int) -> dict:
    """Count ticks spent in each HR zone."""
    dist = {1: 0, 2: 0, 3: 0, 4: 0, 5: 0}
    for hr in hr_series:
        dist[hr_zone(hr, max_hr)] += 1
    return dist


def warmup_score(hr_series: list[int], max_hr: int, warmup_ticks: int = 16) -> float:
    """0-100. Good warmup = HR ramps from Z1 to Z3 in first ~8 minutes (16 ticks @ 2Hz)."""
    if len(hr_series) < warmup_ticks:
        return 50.0
    segment = hr_series[:warmup_ticks]
    first_zone = hr_zone(segment[0], max_hr)
    last_zone  = hr_zone(segment[-1], max_hr)
    # Ideal: starts Z1-Z2, ends Z3
    if first_zone <= 2 and last_zone == 3:
        return 100.0
    if first_zone <= 2 and last_zone >= 3:
        return 80.0
    if first_zone >= 4:
        return 20.0   # jumped straight to hard effort
    return 50.0
