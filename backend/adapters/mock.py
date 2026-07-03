"""Mock wearable adapter — physiologically realistic HR/HRV/strain stream.

Simulates a fit adult (age 28, resting HR 62, max HR 192).
HR follows a sine-wave pattern per set: rises during effort, drops during rest.
HRV inversely tracks HR. Strain accumulates per Whoop's non-linear model.

ponytail: no external deps, pure math. swap this file for whoop.py when device available.
"""
import math
import random
import time
from .base import WearableAdapter

# Athlete profile (realistic fit adult defaults)
_ATHLETE = {
    "age": 28,
    "resting_hr": 62,
    "max_hr": 192,          # 220 - age
    "resting_hrv": 58.0,    # RMSSD ms — good fitness
    "recovery": 74.0,       # pre-session score
}

# Exercise-specific physiology. This is the core of what a wrist wearable
# CAN'T know: a compound leg lift taxes the cardiovascular system far more
# than an isolation curl, and each movement fatigues at a different rate.
#   hr_peak_pct — fraction of max HR reached at peak effort
#   base_power  — typical mechanical output (watts) at the start of a set
#   decay       — power lost per tick as the set fatigues the muscle
_EXERCISES = {
    "SQUAT":   {"hr_peak_pct": 0.92, "base_power": 210.0, "decay": 0.006},
    "BENCH":   {"hr_peak_pct": 0.82, "base_power": 150.0, "decay": 0.005},
    "CURL":    {"hr_peak_pct": 0.66, "base_power": 65.0,  "decay": 0.011},
    "TREAD":   {"hr_peak_pct": 0.85, "base_power": 95.0,  "decay": 0.001},
    "UNKNOWN": {"hr_peak_pct": 0.88, "base_power": 160.0, "decay": 0.004},
}


def _add_noise(value: float, pct: float = 0.03) -> float:
    """Add ±pct% gaussian noise — real sensors aren't clean."""
    return value + random.gauss(0, value * pct)


class MockWearableAdapter(WearableAdapter):
    """
    Produces a realistic biometric stream without a physical device.

    HR model: resting baseline → rises on effort (sine hump) → recovers.
    HRV model: inversely correlated with HR via empirical ratio.
    Strain model: non-linear accumulator, saturates near 21.
    """

    def __init__(self, athlete: dict | None = None):
        self._a = athlete or _ATHLETE
        self._session_strain: float = 0.0
        self._session_start: float = time.time()
        self._t: float = 0.0          # phase accumulator for sine wave
        self._effort: float = 0.0     # 0.0 (rest) → 1.0 (max effort)
        self._recovery = self._a["recovery"]
        self._exercise: str = "UNKNOWN"
        self._ex_ticks: int = 0       # ticks since current exercise began (drives fatigue)

    def set_exercise(self, name: str) -> None:
        """Switch the active movement — resets the per-set fatigue counter."""
        self._exercise = name.upper() if name else "UNKNOWN"
        if self._exercise not in _EXERCISES:
            self._exercise = "UNKNOWN"
        self._ex_ticks = 0

    # ------------------------------------------------------------------
    # Public API (WearableAdapter interface)
    # ------------------------------------------------------------------

    def get_live_metrics(self) -> dict:
        self._t += 0.15          # advance wave — 0.15 rad per tick ≈ realistic ramp
        # Effort floored at 0.45: mid-set you're working, not resting. Keeps a
        # short exercise window from sampling a near-zero trough of the sine.
        self._effort = 0.45 + 0.55 * (math.sin(self._t) + 1) / 2   # 0.45–1.0
        self._ex_ticks += 1

        hr = self._compute_hr()
        hrv = self._compute_hrv(hr)
        power = self._compute_power()
        self._session_strain = self._accumulate_strain(hr)

        return {
            "hr": round(_add_noise(hr)),
            "hrv": round(_add_noise(hrv, pct=0.05), 1),
            "power": round(_add_noise(power, pct=0.04), 1),
            "strain": round(self._session_strain, 2),
            "recovery": round(self._recovery, 1),
            "source": "mock",
        }

    def get_recovery_score(self) -> float:
        return self._recovery

    def get_session_strain(self) -> float:
        return self._session_strain

    def reset_session(self) -> None:
        self._session_strain = 0.0
        self._session_start = time.time()
        self._t = 0.0
        self._effort = 0.0
        self._ex_ticks = 0

    # ------------------------------------------------------------------
    # Private helpers
    # ------------------------------------------------------------------

    def _compute_hr(self) -> float:
        """HR = resting + effort_fraction * (exercise_ceiling - resting).

        The ceiling depends on the movement: a squat drives HR to ~92% max,
        a curl only to ~66%. This is what makes "curls spiking you into Z4"
        a detectable anomaly.
        """
        resting = self._a["resting_hr"]
        max_hr = self._a["max_hr"]
        peak_pct = _EXERCISES[self._exercise]["hr_peak_pct"]
        target = resting + self._effort * (max_hr * peak_pct - resting)
        return target

    def _compute_power(self) -> float:
        """Mechanical output for the current set, decaying as the muscle fatigues.

        power = base * effort * (1 - decay * ticks_into_set)
        Isolation moves (curls) decay fastest; steady cardio barely decays.
        """
        prof = _EXERCISES[self._exercise]
        fatigue_mult = max(0.4, 1.0 - prof["decay"] * self._ex_ticks)
        # Keep the sine's influence on power small so the fatigue trend (decay)
        # dominates the first-vs-last comparison instead of sine phase.
        effort_mult = 0.85 + 0.15 * self._effort
        return prof["base_power"] * effort_mult * fatigue_mult

    def _compute_hrv(self, hr: float) -> float:
        """RMSSD drops as HR rises — empirical inverse relationship.

        At resting HR (62): HRV ≈ 58ms
        At hard effort (168): HRV ≈ 22ms
        Linear interpolation between those anchors.
        """
        resting_hr = self._a["resting_hr"]
        max_effort_hr = self._a["max_hr"] * 0.88
        resting_hrv = self._a["resting_hrv"]
        effort_hrv = 22.0

        frac = (hr - resting_hr) / (max_effort_hr - resting_hr)
        frac = max(0.0, min(1.0, frac))
        return resting_hrv + frac * (effort_hrv - resting_hrv)

    def _accumulate_strain(self, hr: float) -> float:
        """Non-linear strain accumulation based on % max HR.

        Whoop's model is proprietary but the core idea:
        time spent in higher zones contributes exponentially more strain.
        We approximate with a cubic on effort fraction.
        Strain saturates at 21.
        """
        max_hr = self._a["max_hr"]
        hr_pct = hr / max_hr                        # 0.0–1.0
        # Cubic weighting: low zones barely count, high zones spike
        delta = (hr_pct ** 3) * 0.08               # tuned so 60min hard session ≈ 14-16 strain
        return min(21.0, self._session_strain + delta)
