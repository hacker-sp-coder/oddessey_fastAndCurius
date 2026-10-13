import os
from pathlib import Path
from typing import Optional
import httpx
from app.config import settings
from app.transcription.base import BaseTranscriptionProvider, TranscriptionResult, SegmentInfo

class GroqTranscriptionProvider(BaseTranscriptionProvider):
    name = "groq"

    def is_available(self) -> bool:
        """Available only if GROQ_API_KEY is configured."""
        return bool(settings.groq_api_key and settings.groq_api_key.strip())

    def transcribe(
        self,
        audio_file_path: str,
        language_hint: Optional[str] = None
    ) -> TranscriptionResult:
        if not self.is_available():
            return TranscriptionResult(
                success=False,
                transcript="",
                provider_used=self.name,
                error_message="Groq transcription provider is not configured. Missing GROQ_API_KEY in environment."
            )
        
        path = Path(audio_file_path)
        if not path.is_file():
            return TranscriptionResult(
                success=False,
                transcript="",
                provider_used=self.name,
                error_message=f"Audio file does not exist: {audio_file_path}"
            )

        url = "https://api.groq.com/openai/v1/audio/transcriptions"
        headers = {
            "Authorization": f"Bearer {settings.groq_api_key.strip()}"
        }

        try:
            with open(path, "rb") as f:
                files = {
                    "file": (path.name, f, "audio/wav")
                }
                data = {
                    "model": settings.groq_transcription_model,
                    "response_format": "verbose_json"
                }
                if language_hint:
                    data["language"] = language_hint

                with httpx.Client(timeout=60.0) as client:
                    response = client.post(url, headers=headers, files=files, data=data)

                if response.status_code == 401:
                    return TranscriptionResult(
                        success=False,
                        transcript="",
                        provider_used=self.name,
                        error_message="Groq API authentication failed. Please verify GROQ_API_KEY."
                    )
                elif response.status_code == 429:
                    return TranscriptionResult(
                        success=False,
                        transcript="",
                        provider_used=self.name,
                        error_message="Groq API rate limit exceeded. Please retry shortly."
                    )
                elif response.status_code != 200:
                    return TranscriptionResult(
                        success=False,
                        transcript="",
                        provider_used=self.name,
                        error_message=f"Groq transcription failed with HTTP {response.status_code}: {response.text[:200]}"
                    )

                res_json = response.json()
                text = res_json.get("text", "").strip()
                detected_language = res_json.get("language")
                duration = res_json.get("duration")

                segments = []
                for s in res_json.get("segments", []):
                    segments.append(
                        SegmentInfo(
                            start=float(s.get("start", 0.0)),
                            end=float(s.get("end", 0.0)),
                            text=str(s.get("text", "")).strip()
                        )
                    )

                return TranscriptionResult(
                    success=True,
                    transcript=text,
                    detected_language=detected_language,
                    duration_seconds=duration,
                    segments=segments,
                    provider_used=self.name
                )

        except httpx.TimeoutException:
            return TranscriptionResult(
                success=False,
                transcript="",
                provider_used=self.name,
                error_message="Groq transcription request timed out after 60 seconds."
            )
        except Exception as e:
            return TranscriptionResult(
                success=False,
                transcript="",
                provider_used=self.name,
                error_message=f"Error calling Groq transcription API: {str(e)}"
            )
