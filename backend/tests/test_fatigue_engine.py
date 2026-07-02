"""Tests for fatigue engine and metrics — verify all thresholds with real numbers."""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../.."))

from backend.engines.metrics import (
    hr_zone, cardiac_efficiency, fatigue_index,
    hr_recovery_rate, epoc_estimate_minutes, acwr, acwr_risk,
    zone_time_distribution, warmup_score,
)
from backend.engines.fatigue import FatigueEngine
from backend.adapters.mock import MockWearableAdapter


# --- metrics.py ---

def test_hr_zones():
    max_hr = 192
    cases = [
        (90,  1),   # 47% — Z1
        (115, 1),   # 59.9% — Z1
        (116, 2),   # 60.4% — Z2
        (135, 3),   # 70.3% — just into Z3
        (154, 4),   # 80.2% — just into Z4
        (173, 5),   # 90.1% — just into Z5
        (185, 5),   # 96.4% — Z5
    ]
    for hr, expected_zone in cases:
        z = hr_zone(hr, max_hr)
        print(f"  HR {hr} ({hr/max_hr*100:.1f}% max) → Z{z} (expected Z{expected_zone})")
        assert z == expected_zone, f"HR {hr}: expected Z{expected_zone}, got Z{z}"


def test_cardiac_efficiency():
    eff = cardiac_efficiency(avg_power_watts=175.0, avg_hr=145.0)
    print(f"  Cardiac efficiency: {eff} W/BPM  (175W / 145BPM)")
    assert 1.1 < eff < 1.3, f"Unexpected: {eff}"

    assert cardiac_efficiency(0, 0) == 0.0  # no divide by zero


def test_fatigue_index():
    # Fresh athlete: power stays high
    strong = [200.0, 198.0, 202.0, 199.0, 201.0, 200.0]
    fi_strong = fatigue_index(strong)
    print(f"  Fatigue index (no decay): {fi_strong}%")
    assert -5 <= fi_strong <= 5

    # Fatigued: power collapses at end
    fatigued = [210.0, 205.0, 200.0, 165.0, 158.0, 155.0]
    fi_bad = fatigue_index(fatigued)
    print(f"  Fatigue index (bad decay): {fi_bad}%")
    assert fi_bad < -20, f"Expected big negative, got {fi_bad}"

    # Not enough data
    assert fatigue_index([100.0, 110.0]) == 0.0


def test_hr_recovery_rate():
    r = hr_recovery_rate(hr_at_stop=168, hr_60s_later=132)
    print(f"  HR recovery in 60s: {r} BPM drop (168 → 132)")
    assert r == 36  # elite (>30)

    r2 = hr_recovery_rate(170, 162)
    print(f"  HR recovery (poor): {r2} BPM drop")
    assert r2 == 8  # flag (<12)


def test_epoc_estimate():
    # High intensity session
    epoc_hard = epoc_estimate_minutes(peak_hr=183, resting_hr=62, max_hr=192)
    print(f"  EPOC hard session: {epoc_hard} min")
    assert 45 <= epoc_hard <= 65

    # Light session
    epoc_easy = epoc_estimate_minutes(peak_hr=115, resting_hr=62, max_hr=192)
    print(f"  EPOC easy session: {epoc_easy} min")
    assert 5 <= epoc_easy <= 35


def test_acwr():
    ratio = acwr(acute_load_7d=120.0, chronic_load_28d=100.0)
    print(f"  ACWR: {ratio}  → {acwr_risk(ratio)}")
    assert ratio == 1.20
    assert acwr_risk(ratio) == "green"

    danger = acwr(160.0, 100.0)
    print(f"  ACWR danger: {danger}  → {acwr_risk(danger)}")
    assert acwr_risk(danger) == "red"

    assert acwr(0, 0) == 0.0  # no divide by zero


def test_warmup_score_good():
    max_hr = 192
    # Simulate proper warmup: starts Z1, ramps to Z3 over 16 ticks
    warm_series = [75]*4 + [100]*4 + [130]*4 + [158]*4  # Z1→Z2→Z3→Z3
    score = warmup_score(warm_series, max_hr)
    print(f"  Warmup score (good ramp): {score}")
    assert score >= 80

def test_warmup_score_bad():
    max_hr = 192
    # Jumped straight to Z4
    bad_series = [175] * 16
    score = warmup_score(bad_series, max_hr)
    print(f"  Warmup score (no warmup): {score}")
    assert score <= 20


# --- FatigueEngine ---

def test_struggling_fires():
    """Struggling flag should fire when HR is high AND HRV drops."""
    engine = FatigueEngine(max_hr=192, resting_hr=62)
    # Feed baseline ticks (low HR, high HRV)
    for _ in range(12):
        engine.process_tick(hr=68, hrv=58.0, power=160.0)
    # Now spike HR and drop HRV hard
    result = engine.process_tick(hr=172, hrv=30.0, power=120.0)
    print(f"  Struggling: {result['struggling']} | HR zone: {result['hr_zone']} | HRV drop: {result['hrv_drop_pct']}%")
    assert result["struggling"] is True


def test_struggling_does_not_fire_at_rest():
    engine = FatigueEngine(max_hr=192, resting_hr=62)
    result = engine.process_tick(hr=70, hrv=58.0, power=160.0)
    assert result["struggling"] is False


def test_redline_requires_sustained_effort():
    """Redline needs REDLINE_TICKS consecutive ticks above 95% max HR."""
    engine = FatigueEngine(max_hr=192, resting_hr=62)
    redline_hr = int(192 * 0.96)   # 184 BPM
    results = [engine.process_tick(hr=redline_hr, hrv=20.0) for _ in range(10)]
    # First 5 ticks: no redline yet
    assert results[4]["redline"] is False
    # After REDLINE_TICKS (6): yes
    assert results[6]["redline"] is True
    print(f"  Redline triggered at tick {next(i+1 for i,r in enumerate(results) if r['redline'])}")


def test_session_quality_score_range():
    """Quality score must be 0-100."""
    engine = FatigueEngine(max_hr=192, resting_hr=62)
    adapter = MockWearableAdapter()
    for _ in range(100):
        m = adapter.get_live_metrics()
        engine.process_tick(hr=m["hr"], hrv=m["hrv"], power=160.0)
    summary = engine.session_summary()
    qs = summary["quality_score"]
    print(f"  Quality score: {qs}/100")
    print(f"  Avg HR: {summary['avg_hr']} | Peak HR: {summary['peak_hr']}")
    print(f"  Zone dist: {summary['hr_zone_distribution']}")
    print(f"  Fatigue index: {summary['fatigue_index']}%")
    assert 0 <= qs <= 100


def test_overtraining_flag():
    engine = FatigueEngine()
    # Healthy
    healthy = engine.overtraining_flag(
        hrv_7d_avg=55.0, hrv_30d_avg=58.0,
        resting_hr_now=62, baseline_resting_hr=62,
        acwr=1.1
    )
    print(f"  Healthy: {healthy}")
    assert healthy["overtraining_risk"] is False

    # Overtrained
    bad = engine.overtraining_flag(
        hrv_7d_avg=44.0, hrv_30d_avg=58.0,   # HRV suppressed >10%
        resting_hr_now=69, baseline_resting_hr=62,  # +7 BPM
        acwr=1.6
    )
    print(f"  Overtrained: {bad}")
    assert bad["overtraining_risk"] is True
    assert bad["hrv_suppressed"] is True
    assert bad["resting_hr_elevated"] is True
    assert bad["acwr_danger"] is True


if __name__ == "__main__":
    tests = [
        test_hr_zones,
        test_cardiac_efficiency,
        test_fatigue_index,
        test_hr_recovery_rate,
        test_epoc_estimate,
        test_acwr,
        test_warmup_score_good,
        test_warmup_score_bad,
        test_struggling_fires,
        test_struggling_does_not_fire_at_rest,
        test_redline_requires_sustained_effort,
        test_session_quality_score_range,
        test_overtraining_flag,
    ]
    passed = failed = 0
    for t in tests:
        try:
            print(f"\n▶ {t.__name__}")
            t()
            print(f"  ✅ PASS")
            passed += 1
        except AssertionError as e:
            print(f"  ❌ FAIL: {e}")
            failed += 1
    print(f"\n{'='*40}")
    print(f"Results: {passed} passed, {failed} failed")
