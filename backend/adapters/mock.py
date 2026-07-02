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

    # ------------------------------------------------------------------
    # Public API (WearableAdapter interface)
    # ------------------------------------------------------------------

    def get_live_metrics(self) -> dict:
        self._t += 0.15          # advance wave — 0.15 rad per tick ≈ realistic ramp
        self._effort = (math.sin(self._t) + 1) / 2   # 0.0–1.0

        hr = self._compute_hr()
        hrv = self._compute_hrv(hr)
        self._session_strain = self._accumulate_strain(hr)

        return {
            "hr": round(_add_noise(hr)),
            "hrv": round(_add_noise(hrv, pct=0.05), 1),
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

    # ------------------------------------------------------------------
    # Private helpers
    # ------------------------------------------------------------------

    def _compute_hr(self) -> float:
        """HR = resting + effort_fraction * (max - resting).

        Effort fraction shaped by sine so it humps naturally per set.
        """
        resting = self._a["resting_hr"]
        max_hr = self._a["max_hr"]
        # Effort drives HR to ~88% max at peak, not 100% (realistic hard set)
        target = resting + self._effort * (max_hr * 0.88 - resting)
        return target

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
