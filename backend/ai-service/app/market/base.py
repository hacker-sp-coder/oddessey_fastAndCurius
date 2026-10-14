from abc import ABC, abstractmethod
from typing import List, Optional
from app.models.schemas import MarketEvidenceItem, MarketEvidenceResponse

class BaseMarketEvidenceProvider(ABC):
    name: str

    @abstractmethod
    def search_evidence(
        self,
        category: Optional[str] = None,
        geography: Optional[str] = None,
        query: Optional[str] = None,
        is_demo: bool = False
    ) -> MarketEvidenceResponse:
        """Search market evidence by industry category, geography, or query keywords."""
        pass

    def is_available(self) -> bool:
        """Returns True if the provider is configured and ready for queries."""
        return True
