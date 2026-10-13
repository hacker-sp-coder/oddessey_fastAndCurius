from typing import Optional
from app.translation.base import BaseTranslationProvider, TranslationResult

class FallbackTranslationProvider(BaseTranslationProvider):
    name = "fallback"

    def is_available(self) -> bool:
        return True

    def translate(
        self,
        text: str,
        target_language: str = "en",
        source_language_hint: Optional[str] = None
    ) -> TranslationResult:
        # Preserves original text without claiming it is translated
        return TranslationResult(
            success=True,
            original_text=text,
            translated_text=text,
            source_language=source_language_hint or "en",
            target_language=target_language,
            provider_used=self.name,
            is_translated=False,
            error_message="Automatic translation unconfigured. Original text preserved; edit manually in review if needed."
        )
