import logging
import sys
import time
from pathlib import Path
from typing import Any, Dict, Optional

from app.config import settings
from app.transcription.base import BaseTranscriptionProvider, SegmentInfo, TranscriptionResult
from app.transcription.cuda_helper import get_cuda_runtime_diagnostics, setup_cuda_runtime_environment

logger = logging.getLogger(__name__)


def apply_pyav_compatibility_patch() -> bool:
    """
    Patches PyAV's av.open() to safely ignore the 'metadata_errors' keyword argument
    if the installed PyAV version does not support it.
    This directly prevents the runtime failure:
      'Faster-Whisper transcription failed: open() got an unexpected keyword argument metadata_errors'
    """
    try:
        import av
        if getattr(av, "_screenai_metadata_errors_patched", False):
            return True

        original_av_open = av.open

        def safe_av_open(*args, **kwargs):
            try:
                return original_av_open(*args, **kwargs)
            except TypeError as exc:
                if "metadata_errors" in str(exc) and "metadata_errors" in kwargs:
                    safe_kwargs = dict(kwargs)
                    safe_kwargs.pop("metadata_errors", None)
                    logger.debug("av.open() does not support metadata_errors; safely retried without it.")
                    return original_av_open(*args, **safe_kwargs)
                raise

        av.open = safe_av_open
        av._screenai_metadata_errors_patched = True

        # If faster_whisper.audio is already loaded, ensure its reference uses patched open
        if "faster_whisper.audio" in sys.modules:
            try:
                import faster_whisper.audio as fw_audio
                if hasattr(fw_audio, "av"):
                    fw_audio.av.open = safe_av_open
            except Exception:
                pass

        logger.debug("PyAV metadata_errors compatibility wrapper successfully installed.")
        return True
    except Exception as exc:
        logger.debug(f"PyAV compatibility patch check: {exc}")
        return False


# Auto-apply compatibility patch on module import
apply_pyav_compatibility_patch()


class FasterWhisperProvider(BaseTranscriptionProvider):
    name = "faster-whisper"

    def __init__(self):
        self._model = None
        self._import_checked = False
        self._is_import_available = False
        self._actual_device: Optional[str] = None
        self._actual_compute_type: Optional[str] = None
        self._fallback_reason: Optional[str] = None
        self._last_load_time_seconds: Optional[float] = None
        apply_pyav_compatibility_patch()

    def _check_import(self) -> bool:
        if not self._import_checked:
            try:
                import faster_whisper
                apply_pyav_compatibility_patch()
                self._is_import_available = True
            except ImportError:
                self._is_import_available = False
            self._import_checked = True
        return self._is_import_available

    def is_available(self) -> bool:
        """Check if faster-whisper package is installed and usable."""
        return self._check_import()

    def unload_model(self) -> None:
        """Unload model from memory to free VRAM or reset state."""
        self._model = None
        self._actual_device = None
        self._actual_compute_type = None
        self._fallback_reason = None
        self._last_load_time_seconds = None

    def get_hardware_diagnostics(self) -> Dict[str, Any]:
        """Return diagnostic info regarding GPU, CUDA runtime, compute settings, and model state."""
        cuda_diag = get_cuda_runtime_diagnostics()
        
        status = "not_installed"
        if self._check_import():
            if self._model is not None:
                status = f"model_loaded_{self._actual_device or 'unknown'}"
            elif settings.whisper_device.lower() == "cuda":
                if cuda_diag["cuda_inference_available"]:
                    status = "ready_cuda"
                elif settings.whisper_cpu_fallback:
                    status = "cuda_unavailable_cpu_fallback_configured"
                else:
                    status = "cuda_unavailable"
            else:
                status = "ready_cpu"

        return {
            "faster_whisper_installed": self._check_import(),
            "ctranslate2_installed": cuda_diag.get("ctranslate2_installed", False),
            "ctranslate2_version": cuda_diag.get("ctranslate2_version"),
            "gpu_detected": cuda_diag.get("gpu_detected", False),
            "gpu_name": cuda_diag.get("gpu_name"),
            "vram_total_mb": cuda_diag.get("vram_total_mb"),
            "cuda_device_count": cuda_diag.get("cuda_device_count", 0),
            "cuda_available": cuda_diag.get("cuda_inference_available", False),
            "supported_compute_types_cuda": cuda_diag.get("supported_compute_types_cuda", []),
            "configured_device": settings.whisper_device,
            "configured_compute_type": settings.whisper_compute_type,
            "configured_model_size": settings.whisper_model_size,
            "download_root": str(settings.whisper_download_root),
            "model_loaded_in_memory": self._model is not None,
            "active_device": self._actual_device,
            "active_compute_type": self._actual_compute_type,
            "cpu_fallback_configured": settings.whisper_cpu_fallback,
            "fallback_occurred": self._fallback_reason is not None,
            "fallback_reason": self._fallback_reason,
            "last_load_time_seconds": self._last_load_time_seconds,
            "status": status,
            "dll_runtime": cuda_diag.get("dll_runtime", {})
        }

    def _get_or_load_model(
        self,
        device_override: Optional[str] = None,
        compute_type_override: Optional[str] = None
    ):
        """Lazy load model weights on demand with persistent local cache and resilient fallback."""
        if self._model is not None:
            return self._model

        if not self._check_import():
            raise RuntimeError(
                "faster-whisper package is not installed. To enable local GPU transcription, install "
                "`faster-whisper`, `nvidia-cublas-cu12`, and `nvidia-cudnn-cu12` in the virtual environment."
            )

        setup_cuda_runtime_environment()
        from faster_whisper import WhisperModel

        target_device = (device_override or settings.whisper_device).lower().strip()
        target_compute = (compute_type_override or settings.whisper_compute_type).strip()
        model_size = settings.whisper_model_size.strip()
        download_root = str(settings.whisper_download_root)

        # Handle CUDA configuration
        if target_device == "cuda":
            cuda_diag = get_cuda_runtime_diagnostics(refresh=True)
            if not cuda_diag["cuda_inference_available"]:
                reason = (
                    f"CUDA inference unavailable: GPU detected={cuda_diag['gpu_detected']}, "
                    f"CUDA device count={cuda_diag['cuda_device_count']}. "
                    f"Error: {cuda_diag.get('cuda_error') or 'Missing CUDA/cuDNN DLL runtimes.'}"
                )
                if settings.whisper_cpu_fallback:
                    logger.warning(f"{reason} Falling back to CPU.")
                    self._fallback_reason = reason
                    target_device = "cpu"
                    target_compute = "int8" if target_compute == "float16" else target_compute
                else:
                    raise RuntimeError(
                        f"{reason} CPU fallback is disabled (WHISPER_CPU_FALLBACK=false). "
                        "Ensure NVIDIA GPU drivers, cuBLAS, and cuDNN are correctly installed."
                    )
            else:
                supported = cuda_diag.get("supported_compute_types_cuda", [])
                if supported and target_compute not in supported:
                    logger.warning(
                        f"Compute type '{target_compute}' not in supported CUDA types {supported}. "
                        "Defaulting to 'float16'."
                    )
                    target_compute = "float16"

        t0 = time.time()
        try:
            logger.info(
                f"Loading Faster-Whisper model '{model_size}' on device='{target_device}', "
                f"compute_type='{target_compute}', cache='{download_root}'..."
            )
            self._model = WhisperModel(
                model_size_or_path=model_size,
                device=target_device,
                device_index=settings.whisper_device_index,
                compute_type=target_compute,
                download_root=download_root
            )
            self._actual_device = target_device
            self._actual_compute_type = target_compute
            self._last_load_time_seconds = round(time.time() - t0, 3)
            logger.info(f"Model '{model_size}' successfully loaded in {self._last_load_time_seconds}s on {target_device}.")
            return self._model

        except Exception as e:
            # If CUDA initialization failed at runtime (e.g., driver error or out of VRAM), try CPU fallback
            if target_device == "cuda" and settings.whisper_cpu_fallback:
                fallback_reason = f"CUDA model initialization failed ({str(e)}). Safely fell back to CPU."
                logger.warning(fallback_reason)
                self._fallback_reason = fallback_reason
                try:
                    t_cpu = time.time()
                    self._model = WhisperModel(
                        model_size_or_path=model_size,
                        device="cpu",
                        compute_type="int8",
                        download_root=download_root
                    )
                    self._actual_device = "cpu"
                    self._actual_compute_type = "int8"
                    self._last_load_time_seconds = round(time.time() - t_cpu, 3)
                    logger.info(f"Model loaded on CPU fallback in {self._last_load_time_seconds}s.")
                    return self._model
                except Exception as cpu_err:
                    raise RuntimeError(f"Both CUDA and CPU fallback model loading failed: {cpu_err}") from cpu_err
            else:
                raise RuntimeError(
                    f"Failed to load Faster-Whisper model '{model_size}' on device '{target_device}': {str(e)}"
                ) from e

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
                    "faster-whisper is not installed. To run on-device speech transcription, "
                    "install the GPU packages using `pip install -r requirements-gpu.txt`."
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
            apply_pyav_compatibility_patch()
            model = self._get_or_load_model()
            t0 = time.time()
            segments_gen, info = model.transcribe(
                str(path),
                language=language_hint,
                beam_size=5
            )

            segments = []
            full_text_parts = []
            for s in segments_gen:
                seg_text = s.text.strip()
                if seg_text:
                    segments.append(
                        SegmentInfo(
                            start=round(s.start, 2),
                            end=round(s.end, 2),
                            text=seg_text
                        )
                    )
                    full_text_parts.append(seg_text)

            inference_time = round(time.time() - t0, 3)
            full_transcript = " ".join(full_text_parts).strip()

            # Record accurate provider label reflecting the real execution device
            if self._actual_device == "cuda":
                provider_label = f"{self.name} (cuda/{self._actual_compute_type})"
            elif self._fallback_reason:
                provider_label = f"{self.name} (cpu-fallback)"
            else:
                provider_label = f"{self.name} (cpu)"

            return TranscriptionResult(
                success=True,
                transcript=full_transcript,
                detected_language=info.language if hasattr(info, "language") else None,
                duration_seconds=round(info.duration, 2) if hasattr(info, "duration") else None,
                segments=segments,
                provider_used=provider_label
            )

        except Exception as e:
            logger.error(f"Faster-Whisper transcription execution failed: {e}", exc_info=True)
            return TranscriptionResult(
                success=False,
                transcript="",
                provider_used=self.name,
                error_message=f"Faster-Whisper transcription failed: {str(e)}"
            )
