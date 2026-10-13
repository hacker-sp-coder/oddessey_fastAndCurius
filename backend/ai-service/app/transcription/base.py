from abc import ABC, abstractmethod
from typing import List, Optional
from pydantic import BaseModel

class SegmentInfo(BaseModel):
    start: float
    end: float
    text: str

class TranscriptionResult(BaseModel):
    success: bool
    transcript: str
    detected_language: Optional[str] = None
    duration_seconds: Optional[float] = None
    segments: List[SegmentInfo] = []
    provider_used: str
    error_message: Optional[str] = None

class BaseTranscriptionProvider(ABC):
    name: str

    @abstractmethod
    def is_available(self) -> bool:
        """Check if the provider is currently available/configured."""
        pass

    @abstractmethod
    def transcribe(
        self,
        audio_file_path: str,
        language_hint: Optional[str] = None
    ) -> TranscriptionResult:
        """Transcribe an audio file and return a structured result."""
        pass
