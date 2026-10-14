from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from app.config import settings
from app.main import app, whisper_transcriber
from app.transcription.base import SegmentInfo, TranscriptionResult
from app.transcription.whisper_transcriber import FasterWhisperProvider

client = TestClient(app)


@pytest.fixture(autouse=True)
def reset_provider():
    """Ensure provider model is unloaded between tests."""
    whisper_transcriber.unload_model()
    yield
    whisper_transcriber.unload_model()


# 1. GPU Provider Selection
def test_gpu_provider_selection_route():
    dummy_wav = settings.fixtures_dir / "sample_audio.wav"
    mock_result = TranscriptionResult(
        success=True,
        transcript="Test transcript",
        detected_language="en",
        duration_seconds=2.0,
        provider_used="faster-whisper (cuda/float16)",
        segments=[SegmentInfo(start=0.0, end=2.0, text="Test transcript")]
    )

    with patch.object(whisper_transcriber, "transcribe", return_value=mock_result) as mock_transcribe:
        res = client.post("/transcribe", json={
            "audio_path": str(dummy_wav),
            "provider_override": "faster-whisper"
        })
        assert res.status_code == 200
        data = res.json()
        assert data["success"] is True
        assert data["transcript"] == "Test transcript"
        assert "cuda" in data["provider_used"]
        mock_transcribe.assert_called_once()


# 2. CUDA Initialization Failure with CPU Fallback Enabled
def test_cuda_initialization_failure_triggers_cpu_fallback(tmp_path):
    dummy_wav = tmp_path / "test.wav"
    dummy_wav.write_bytes(b"RIFFdummydata")

    provider = FasterWhisperProvider()

    # Simulate faster_whisper installed and CUDA runtime detected
    mock_cuda_ready = {
        "cuda_inference_available": True,
        "supported_compute_types_cuda": ["float16", "int8"],
        "gpu_detected": True,
        "gpu_name": "NVIDIA GPU",
        "cuda_device_count": 1
    }
    with patch.object(provider, "_check_import", return_value=True):
        with patch("app.transcription.whisper_transcriber.get_cuda_runtime_diagnostics", return_value=mock_cuda_ready):
            with patch.object(settings, "whisper_device", "cuda"):
                with patch.object(settings, "whisper_cpu_fallback", True):
                    # When cuda model instantiation fails
                    mock_whisper_cls = MagicMock()
                    # 1st call (cuda) raises error; 2nd call (cpu fallback) succeeds
                    mock_cpu_model = MagicMock()
                    mock_segment = MagicMock()
                    mock_segment.start = 0.0
                    mock_segment.end = 1.0
                    mock_segment.text = "Recovered on CPU"
                    mock_info = MagicMock()
                    mock_info.language = "en"
                    mock_info.duration = 1.0
                    mock_cpu_model.transcribe.return_value = ([mock_segment], mock_info)

                    mock_whisper_cls.side_effect = [
                        RuntimeError("Library cublas64_12.dll is not found"),
                        mock_cpu_model
                    ]

                    with patch("faster_whisper.WhisperModel", mock_whisper_cls):
                        res = provider.transcribe(str(dummy_wav))
                        assert res.success is True
                        assert res.transcript == "Recovered on CPU"
                        assert "cpu-fallback" in res.provider_used
                        assert provider._actual_device == "cpu"
                        assert "cublas64_12.dll" in provider._fallback_reason


# 3. CUDA Initialization Failure with CPU Fallback Disabled
def test_cuda_initialization_failure_without_fallback_returns_actionable_error(tmp_path):
    dummy_wav = tmp_path / "test.wav"
    dummy_wav.write_bytes(b"RIFFdummydata")

    provider = FasterWhisperProvider()
    mock_cuda_ready = {
        "cuda_inference_available": True,
        "supported_compute_types_cuda": ["float16", "int8"],
        "gpu_detected": True,
        "gpu_name": "NVIDIA GPU",
        "cuda_device_count": 1
    }

    with patch.object(provider, "_check_import", return_value=True):
        with patch("app.transcription.whisper_transcriber.get_cuda_runtime_diagnostics", return_value=mock_cuda_ready):
            with patch.object(settings, "whisper_device", "cuda"):
                with patch.object(settings, "whisper_cpu_fallback", False):
                    mock_whisper_cls = MagicMock(side_effect=RuntimeError("CUDA driver version is insufficient"))

                    with patch("faster_whisper.WhisperModel", mock_whisper_cls):
                        res = provider.transcribe(str(dummy_wav))
                        assert res.success is False
                        assert "CUDA driver version is insufficient" in res.error_message


# 4. Missing Model Weights / Corrupted Cache Error Handling
def test_missing_model_weights_failure_handling(tmp_path):
    dummy_wav = tmp_path / "test.wav"
    dummy_wav.write_bytes(b"RIFFdummydata")

    provider = FasterWhisperProvider()

    with patch.object(provider, "_check_import", return_value=True):
        with patch("faster_whisper.WhisperModel", side_effect=Exception("Connection timed out to HuggingFace")):
            with patch.object(settings, "whisper_cpu_fallback", False):
                res = provider.transcribe(str(dummy_wav))
                assert res.success is False
                assert "Connection timed out to HuggingFace" in res.error_message


# 5. Explicit CPU Configuration
def test_explicit_cpu_execution(tmp_path):
    dummy_wav = tmp_path / "test.wav"
    dummy_wav.write_bytes(b"RIFFdummydata")

    provider = FasterWhisperProvider()

    mock_model = MagicMock()
    mock_segment = MagicMock(start=0.0, end=1.5, text="Running on CPU")
    mock_info = MagicMock(language="en", duration=1.5)
    mock_model.transcribe.return_value = ([mock_segment], mock_info)

    with patch.object(provider, "_check_import", return_value=True):
        with patch.object(settings, "whisper_device", "cpu"):
            with patch.object(settings, "whisper_compute_type", "int8"):
                with patch("faster_whisper.WhisperModel", return_value=mock_model) as mock_cls:
                    res = provider.transcribe(str(dummy_wav))
                    assert res.success is True
                    assert res.transcript == "Running on CPU"
                    assert "cpu" in res.provider_used
                    # Verify WhisperModel was called with device="cpu"
                    mock_cls.assert_called_once()
                    _, kwargs = mock_cls.call_args
                    assert kwargs["device"] == "cpu"
                    assert kwargs["compute_type"] == "int8"


# 6. Mocked GPU Transcription Execution
def test_successful_transcription_mocked_gpu():
    dummy_wav = settings.fixtures_dir / "sample_audio.wav"
    provider = FasterWhisperProvider()

    mock_model = MagicMock()
    mock_segment = MagicMock(start=0.0, end=2.5, text="NVIDIA GPU transcription verified")
    mock_info = MagicMock(language="en", duration=2.5)
    mock_model.transcribe.return_value = ([mock_segment], mock_info)

    with patch.object(provider, "_check_import", return_value=True):
        with patch.object(settings, "whisper_device", "cuda"):
            with patch.object(settings, "whisper_compute_type", "float16"):
                with patch("app.transcription.whisper_transcriber.get_cuda_runtime_diagnostics", return_value={
                    "cuda_inference_available": True,
                    "supported_compute_types_cuda": ["float16", "int8"],
                    "gpu_detected": True,
                    "gpu_name": "NVIDIA GeForce RTX 3050 Laptop GPU"
                }):
                    with patch("faster_whisper.WhisperModel", return_value=mock_model) as mock_cls:
                        res = provider.transcribe(str(dummy_wav))
                        assert res.success is True
                        assert res.transcript == "NVIDIA GPU transcription verified"
                        assert "cuda/float16" in res.provider_used
                        assert res.detected_language == "en"
                        assert res.duration_seconds == 2.5
                        assert len(res.segments) == 1


# 7. Capability and Health Reporting Distinctions
def test_capabilities_distinguishes_gpu_and_cuda_states():
    # Scenario A: GPU detected and CUDA available
    mock_diag_cuda = {
        "faster_whisper_installed": True,
        "gpu_detected": True,
        "gpu_name": "NVIDIA GeForce RTX 3050 Laptop GPU",
        "cuda_available": True,
        "model_loaded_in_memory": False,
        "active_device": None,
        "active_compute_type": None,
        "supported_compute_types_cuda": ["float16", "int8"]
    }

    with patch.object(whisper_transcriber, "get_hardware_diagnostics", return_value=mock_diag_cuda):
        with patch.object(settings, "whisper_device", "cuda"):
            res = client.get("/capabilities")
            assert res.status_code == 200
            data = res.json()
            assert data["cuda_available"] is True
            fw_cap = next(p for p in data["transcription_providers"] if p["name"] == "faster-whisper")
            assert fw_cap["available"] is True
            assert fw_cap["requires_gpu"] is True
            assert "NVIDIA GeForce RTX 3050" in fw_cap["details"]
            assert "CUDA inference ready" in fw_cap["details"]
            assert "Model not loaded (lazy init)" in fw_cap["details"]

    # Scenario B: CPU mode configured
    mock_diag_cpu = {
        "faster_whisper_installed": True,
        "gpu_detected": False,
        "gpu_name": None,
        "cuda_available": False,
        "model_loaded_in_memory": True,
        "active_device": "cpu",
        "active_compute_type": "int8",
        "supported_compute_types_cuda": []
    }

    with patch.object(whisper_transcriber, "get_hardware_diagnostics", return_value=mock_diag_cpu):
        with patch.object(settings, "whisper_device", "cpu"):
            res = client.get("/capabilities")
            assert res.status_code == 200
            data = res.json()
            assert data["cuda_available"] is False
            fw_cap = next(p for p in data["transcription_providers"] if p["name"] == "faster-whisper")
            assert fw_cap["requires_gpu"] is False
            assert "Model loaded (cpu)" in fw_cap["details"]


# 8. Lazy Loading Guarantee
def test_lazy_loading_does_not_initialize_model_on_creation():
    provider = FasterWhisperProvider()
    assert provider._model is None
    diag = provider.get_hardware_diagnostics()
    assert diag["model_loaded_in_memory"] is False
    assert diag["active_device"] is None


# 9. Regression Test: PyAV 'metadata_errors' keyword argument incompatibility
def test_pyav_metadata_errors_regression_handling():
    """
    Verifies that if av.open raises TypeError: open() got an unexpected keyword argument 'metadata_errors',
    our compatibility wrapper safely strips 'metadata_errors' and retries successfully.
    """
    import av
    from app.transcription.whisper_transcriber import apply_pyav_compatibility_patch

    call_history = []

    def mock_legacy_av_open(*args, **kwargs):
        call_history.append(kwargs)
        if "metadata_errors" in kwargs:
            raise TypeError("open() got an unexpected keyword argument 'metadata_errors'")
        return "mock_container_opened"

    # Reset patched flag to test wrapper directly
    av._screenai_metadata_errors_patched = False
    with patch.object(av, "open", side_effect=mock_legacy_av_open):
        apply_pyav_compatibility_patch()
        # Call av.open with metadata_errors as faster_whisper does
        result = av.open("test_audio.wav", mode="r", metadata_errors="ignore")

        assert result == "mock_container_opened"
        assert len(call_history) == 2
        assert "metadata_errors" in call_history[0]
        assert "metadata_errors" not in call_history[1]
