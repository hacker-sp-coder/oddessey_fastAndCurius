from typing import Optional
import httpx
from app.config import settings
from app.translation.base import BaseTranslationProvider, TranslationResult

class GroqTranslationProvider(BaseTranslationProvider):
    name = "groq"

    def is_available(self) -> bool:
        return bool(settings.groq_api_key and settings.groq_api_key.strip())

    def translate(
        self,
        text: str,
        target_language: str = "en",
        source_language_hint: Optional[str] = None
    ) -> TranslationResult:
        if not self.is_available():
            return TranslationResult(
                success=False,
                original_text=text,
                translated_text=text,
                source_language=source_language_hint,
                target_language=target_language,
                provider_used=self.name,
                is_translated=False,
                error_message="Groq translation provider unconfigured (missing GROQ_API_KEY)."
            )

        if not text or not text.strip():
            return TranslationResult(
                success=True,
                original_text="",
                translated_text="",
                target_language=target_language,
                provider_used=self.name,
                is_translated=False
            )

        prompt = (
            f"You are a professional business translator. Translate the following startup pitch transcript "
            f"into fluent English ({target_language}). Preserve technical terminology and timestamps verbatim. "
            f"Return ONLY the translated text without commentary:\n\n{text}"
        )

        try:
            url = "https://api.groq.com/openai/v1/chat/completions"
            headers = {
                "Authorization": f"Bearer {settings.groq_api_key.strip()}",
                "Content-Type": "application/json"
            }
            body = {
                "model": settings.groq_model,
                "messages": [
                    {"role": "system", "content": "You translate business pitch transcripts accurately into English."},
                    {"role": "user", "content": prompt}
                ],
                "temperature": 0.2
            }

            with httpx.Client(timeout=30.0) as client:
                res = client.post(url, headers=headers, json=body)

            if res.status_code != 200:
                return TranslationResult(
                    success=False,
                    original_text=text,
                    translated_text=text,
                    source_language=source_language_hint,
                    target_language=target_language,
                    provider_used=self.name,
                    is_translated=False,
                    error_message=f"Groq translation API error: HTTP {res.status_code}"
                )

            data = res.json()
            translated = data["choices"][0]["message"]["content"].strip()

            return TranslationResult(
                success=True,
                original_text=text,
                translated_text=translated,
                source_language=source_language_hint,
                target_language=target_language,
                provider_used=self.name,
                is_translated=True
            )
        except Exception as e:
            return TranslationResult(
                success=False,
                original_text=text,
                translated_text=text,
                source_language=source_language_hint,
                target_language=target_language,
                provider_used=self.name,
                is_translated=False,
                error_message=f"Translation failed: {str(e)}"
            )
