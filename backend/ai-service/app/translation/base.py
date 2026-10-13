from abc import ABC, abstractmethod
from typing import Optional
from pydantic import BaseModel

class TranslationResult(BaseModel):
    success: bool
    original_text: str
    translated_text: str
    source_language: Optional[str] = None
    target_language: str = "en"
    provider_used: str
    is_translated: bool
    error_message: Optional[str] = None

class BaseTranslationProvider(ABC):
    name: str

    @abstractmethod
    def is_available(self) -> bool:
        pass

    @abstractmethod
    def translate(
        self,
        text: str,
        target_language: str = "en",
        source_language_hint: Optional[str] = None
    ) -> TranslationResult:
        pass
