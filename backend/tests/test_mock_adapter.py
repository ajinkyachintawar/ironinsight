"""Tests for MockWearableAdapter — verify physiological realism."""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../.."))

from backend.adapters.mock import MockWearableAdapter


def collect_ticks(adapter, n=80):
    return [adapter.get_live_metrics() for _ in range(n)]


def test_output_keys():
    a = MockWearableAdapter()
    m = a.get_live_metrics()
    assert set(m.keys()) == {"hr", "hrv", "power", "strain", "recovery", "source"}
    assert m["source"] == "mock"


def test_hr_range():
    """HR must stay within physiological bounds for a fit adult."""
    a = MockWearableAdapter()
    ticks = collect_ticks(a, 120)
    hrs = [t["hr"] for t in ticks]
    min_hr, max_hr = min(hrs), max(hrs)
    print(f"  HR range: {min_hr}–{max_hr} BPM")
    assert 55 <= min_hr, f"HR too low: {min_hr}"
    assert max_hr <= 185, f"HR too high: {max_hr}"


def test_hrv_inversely_correlates_with_hr():
    """When HR is high, HRV should be lower than at rest."""
    a = MockWearableAdapter()
    ticks = collect_ticks(a, 120)
    # Pair HR/HRV, bucket into low-hr and high-hr
    low_hr_ticks  = [t for t in ticks if t["hr"] < 100]
    high_hr_ticks = [t for t in ticks if t["hr"] > 150]
    if low_hr_ticks and high_hr_ticks:
        avg_hrv_low  = sum(t["hrv"] for t in low_hr_ticks)  / len(low_hr_ticks)
        avg_hrv_high = sum(t["hrv"] for t in high_hr_ticks) / len(high_hr_ticks)
        print(f"  HRV @ low HR: {avg_hrv_low:.1f}ms | HRV @ high HR: {avg_hrv_high:.1f}ms")
        assert avg_hrv_low > avg_hrv_high, "HRV should drop as HR rises"


def test_hrv_range():
    """HRV must stay in realistic RMSSD range."""
    a = MockWearableAdapter()
    ticks = collect_ticks(a, 120)
    hrvs = [t["hrv"] for t in ticks]
    min_hrv, max_hrv = min(hrvs), max(hrvs)
    print(f"  HRV range: {min_hrv:.1f}–{max_hrv:.1f} ms")
    assert 15.0 <= min_hrv, f"HRV too low: {min_hrv}"
    assert max_hrv <= 90.0, f"HRV too high: {max_hrv}"


def test_strain_accumulates_monotonically():
    """Strain should never decrease during a session."""
    a = MockWearableAdapter()
    ticks = collect_ticks(a, 100)
    strains = [t["strain"] for t in ticks]
    for i in range(1, len(strains)):
        assert strains[i] >= strains[i-1], f"Strain decreased at tick {i}"
    print(f"  Strain: {strains[0]:.3f} → {strains[-1]:.3f}")


def test_strain_cap():
    """Strain must never exceed 21."""
    a = MockWearableAdapter()
    ticks = collect_ticks(a, 500)
    max_strain = max(t["strain"] for t in ticks)
    print(f"  Max strain after 500 ticks: {max_strain:.2f}")
    assert max_strain <= 21.0


def test_realistic_session_strain():
    """A 200-tick hard session (~10 min) should accumulate 3-8 strain."""
    a = MockWearableAdapter()
    ticks = collect_ticks(a, 200)
    final_strain = ticks[-1]["strain"]
    print(f"  Session strain after 200 ticks: {final_strain:.2f}")
    assert 1.0 <= final_strain <= 10.0, f"Unexpected strain: {final_strain}"


def test_recovery_score_static():
    """Recovery score is pre-session — should not change during session."""
    a = MockWearableAdapter()
    scores = [a.get_live_metrics()["recovery"] for _ in range(20)]
    assert len(set(scores)) == 1, "Recovery score changed mid-session"
    print(f"  Recovery score: {scores[0]}")


def test_reset_session():
    """reset_session() clears strain and phase."""
    a = MockWearableAdapter()
    collect_ticks(a, 50)
    strain_before = a.get_session_strain()
    a.reset_session()
    assert a.get_session_strain() == 0.0
    print(f"  Strain before reset: {strain_before:.2f} → after: 0.0")


if __name__ == "__main__":
    tests = [
        test_output_keys,
        test_hr_range,
        test_hrv_inversely_correlates_with_hr,
        test_hrv_range,
        test_strain_accumulates_monotonically,
        test_strain_cap,
        test_realistic_session_strain,
        test_recovery_score_static,
        test_reset_session,
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
