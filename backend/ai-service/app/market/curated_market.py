import json
from pathlib import Path
from typing import List, Optional
from app.config import settings
from app.models.schemas import MarketEvidenceItem, MarketEvidenceResponse
from app.market.base import BaseMarketEvidenceProvider

class CuratedMarketEvidenceProvider(BaseMarketEvidenceProvider):
    name = "curated_local"

    def __init__(self, data_file_path: Optional[Path] = None):
        self.data_file = data_file_path or (settings.fixtures_dir / "market_data.json")
        self._items: List[MarketEvidenceItem] = []
        self._load_data()

    def _load_data(self):
        if self.data_file.exists():
            try:
                with open(self.data_file, "r", encoding="utf-8") as f:
                    raw_data = json.load(f)
                    self._items = [MarketEvidenceItem(**item) for item in raw_data]
            except Exception as e:
                print(f"Warning: could not load market data file {self.data_file}: {e}")
                self._items = []
        else:
            self._items = []

    def search_evidence(
        self,
        category: Optional[str] = None,
        geography: Optional[str] = None,
        query: Optional[str] = None
    ) -> MarketEvidenceResponse:
        matched = []
        cat_lower = (category or "").lower().strip()
        geo_lower = (geography or "").lower().strip()
        query_lower = (query or "").lower().strip()

        for item in self._items:
            item_cat = item.category.lower()
            item_geo = item.geography.lower()
            item_claim = item.claim.lower()

            match_cat = not cat_lower or (cat_lower in item_cat or item_cat in cat_lower)
            match_geo = not geo_lower or (geo_lower in item_geo or item_geo in geo_lower or item_geo == "global")
            match_query = not query_lower or (query_lower in item_claim or query_lower in item_cat)

            if match_cat and (match_geo or match_query):
                matched.append(item)

        gaps = []
        if not matched:
            gaps.append(f"No curated market evidence benchmarks found for industry '{category}' in geography '{geography}'.")
        else:
            verified_count = sum(1 for m in matched if m.verification_status == "VERIFIED")
            if verified_count == 0:
                gaps.append("Only synthetic demonstration evidence matched this query. Verified third-party benchmarks are missing.")

        return MarketEvidenceResponse(
            items=matched,
            gaps_identified=gaps
        )
