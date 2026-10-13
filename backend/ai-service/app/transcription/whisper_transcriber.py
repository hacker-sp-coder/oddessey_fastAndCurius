import sys
from pathlib import Path
from typing import Optional
from app.config import settings
from app.transcription.base import BaseTranscriptionProvider, TranscriptionResult, SegmentInfo

class FasterWhisperProvider(BaseTranscriptionProvider):
    name = "faster-whisper"

    def __init__(self):
        self._model = None
        self._import_checked = False
        self._is_import_available = False

    def _check_import(self) -> bool:
        if not self._import_checked:
            try:
                import faster_whisper
                self._is_import_available = True
            except ImportError:
                self._is_import_available = False
            self._import_checked = True
        return self._is_import_available

    def is_available(self) -> bool:
        """Check if faster-whisper package is installed."""
        return self._check_import()

    def get_hardware_diagnostics(self) -> dict:
        """Return diagnostic info regarding CUDA/GPU availability and compute settings."""
        cuda_available = False
        cuda_device_name = None
        try:
            import torch
            cuda_available = torch.cuda.is_available()
            if cuda_available:
                cuda_device_name = torch.cuda.get_device_name(0)
        except ImportError:
            pass

        return {
            "faster_whisper_installed": self._check_import(),
            "configured_device": settings.whisper_device,
            "configured_compute_type": settings.whisper_compute_type,
            "configured_model_size": settings.whisper_model_size,
            "cuda_available": cuda_available,
            "cuda_device_name": cuda_device_name,
            "model_loaded_in_memory": self._model is not None
        }

    def _get_or_load_model(self):
        """Lazy load model weights only on demand."""
        if self._model is not None:
            return self._model
        
        if not self._check_import():
            raise RuntimeError(
                "faster-whisper package is not installed. To enable local transcription, install "
                "`faster-whisper` and run the model smoke test script."
            )

        from faster_whisper import WhisperModel
        # Lazy load weights
        self._model = WhisperModel(
            model_size_or_path=settings.whisper_model_size,
            device=settings.whisper_device,
            compute_type=settings.whisper_compute_type
        )
        return self._model

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
                error_message=(
                    "faster-whisper is not installed. For offline/lightweight execution, "
                    "you can supply or edit a transcript directly in the UI, or configure GROQ_API_KEY."
                )
            )

        path = Path(audio_file_path)
        if not path.is_file():
            return TranscriptionResult(
                success=False,
                transcript="",
                provider_used=self.name,
                error_message=f"Audio file does not exist: {audio_file_path}"
            )

        try:
            model = self._get_or_load_model()
            segments_gen, info = model.transcribe(
                str(path),
                language=language_hint,
                beam_size=5
            )

            segments = []
            full_text_parts = []
            for s in segments_gen:
                seg_text = s.text.strip()
                segments.append(
                    SegmentInfo(
                        start=round(s.start, 2),
                        end=round(s.end, 2),
                        text=seg_text
                    )
                )
                full_text_parts.append(seg_text)

            full_transcript = " ".join(full_text_parts).strip()
            return TranscriptionResult(
                success=True,
                transcript=full_transcript,
                detected_language=info.language if hasattr(info, "language") else None,
                duration_seconds=round(info.duration, 2) if hasattr(info, "duration") else None,
                segments=segments,
                provider_used=self.name
            )

        except Exception as e:
            return TranscriptionResult(
                success=False,
                transcript="",
                provider_used=self.name,
                error_message=f"Faster-Whisper transcription failed: {str(e)}"
            )
