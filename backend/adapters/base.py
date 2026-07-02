from abc import ABC, abstractmethod


class WearableAdapter(ABC):
    """Normalized interface all wearable adapters must implement."""

    @abstractmethod
    def get_live_metrics(self) -> dict:
        """Return current biometric snapshot.

        Returns:
            {
                "hr": int,      # BPM
                "hrv": float,   # RMSSD in ms
                "strain": float,  # 0-21 accumulator
                "recovery": float,  # 0-100 pre-session score
                "source": str,
            }
        """

    @abstractmethod
    def get_recovery_score(self) -> float:
        """Pre-session recovery score 0-100."""

    @abstractmethod
    def get_session_strain(self) -> float:
        """Accumulated strain for current session 0-21."""

    @abstractmethod
    def reset_session(self) -> None:
        """Reset session-scoped accumulators (strain, elapsed time)."""
