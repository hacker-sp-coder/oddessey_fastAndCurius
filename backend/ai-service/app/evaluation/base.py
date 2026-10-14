from abc import ABC, abstractmethod
from typing import Optional
from app.models.schemas import EvaluationResult

class BaseEvaluator(ABC):
    name: str

    @abstractmethod
    def evaluate(
        self,
        transcript: str,
        startup_name: Optional[str] = None,
        target_geography: Optional[str] = None,
        industry: Optional[str] = None,
        is_demo: bool = False,
        allow_fallback: bool = False
    ) -> EvaluationResult:
        """Evaluate pitch transcript viability against versioned rubric."""
        pass
