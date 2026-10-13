from typing import Optional
from app.transcription.base import BaseTranscriptionProvider, TranscriptionResult

class FallbackTranscriptionProvider(BaseTranscriptionProvider):
    name = "fallback"

    def is_available(self) -> bool:
        return True

    def transcribe(
        self,
        audio_file_path: str,
        language_hint: Optional[str] = None
    ) -> TranscriptionResult:
        return TranscriptionResult(
            success=False,
            transcript="",
            provider_used=self.name,
            error_message=(
                "Automatic speech-to-text is disabled or unconfigured in this mode. "
                "Audio file was extracted and stored successfully. "
                "Please review and paste or type the transcript below to proceed with analysis."
            )
        )
