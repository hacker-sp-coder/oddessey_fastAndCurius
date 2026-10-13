import json
import os
import tempfile
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from app.config import settings
from app.main import app
from app.models.rubric import RUBRIC_CRITERIA, RUBRIC_VERSION, validate_rubric_weights
from app.models.schemas import EvaluationResult, MarketEvidenceItem
from app.ingestion.document import extract_pdf_text, extract_plain_text, normalize_text
from app.ingestion.media import cleanup_file, extract_audio, is_ffmpeg_available
from app.transcription.fallback_transcriber import FallbackTranscriptionProvider
from app.transcription.groq_transcriber import GroqTranscriptionProvider
from app.transcription.whisper_transcriber import FasterWhisperProvider
from app.translation.fallback_translator import FallbackTranslationProvider
from app.translation.groq_translator import GroqTranslationProvider
from app.evaluation.deterministic_evaluator import DeterministicEvaluator
from app.evaluation.groq_evaluator import GroqEvaluator
from app.market.curated_market import CuratedMarketEvidenceProvider

client = TestClient(app)

SAMPLE_TRANSCRIPT = (
    "[00:00] AgriScan AI provides an offline-capable mobile crop diagnosis tool for 120 million smallholder farmers. "
    "[00:15] Farmers currently lose 25% to 40% of their yields to pests and crop diseases. "
    "[00:30] We use an edge computer vision neural network running in under 400ms without cellular connectivity. "
    "[00:45] We operate a B2B2C business model licensing to micro-finance cooperatives for $1.20 per farmer per year. "
    "[01:00] In our 4-month pilot with 3,400 active farmers we demonstrated a 22% reduction in preventable crop loss. "
    "[01:15] The founders are Priya Sharma, ex-senior ML engineer, and Dr. Patel, senior plant pathologist with 14 years experience. "
    "[01:30] We are raising $500,000 to scale across South Asia to 50,000 farmers over the next 12 months."
)


# 1. Health and Capabilities Tests
def test_health_endpoint():
    res = client.get("/health")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "ok"
    assert data["service"] == "ai-service"
    assert "ffmpeg_available" in data


def test_capabilities_endpoint():
    res = client.get("/capabilities")
    assert res.status_code == 200
    data = res.json()
    assert "transcription_providers" in data
    assert "evaluation_providers" in data
    assert data["active_evaluation_provider"] in ["deterministic", "groq"]

    provider_names = [p["name"] for p in data["transcription_providers"]]
    assert "fallback" in provider_names
    assert "groq" in provider_names
    assert "faster-whisper" in provider_names


# 2. Rubric Validation
def test_rubric_weights_sum_to_100():
    assert validate_rubric_weights()
    total_w = sum(c.weight for c in RUBRIC_CRITERIA.values())
    assert abs(total_w - 100.0) < 1e-4
    assert len(RUBRIC_CRITERIA) == 7


# 3. Document Extraction Tests
def test_text_normalization():
    raw = "   Line 1\r\n\r\n\r\n\r\nLine 2   \r\n"
    norm = normalize_text(raw)
    assert norm == "Line 1\n\nLine 2"


def test_plain_text_extraction(tmp_path):
    txt_file = tmp_path / "sample.txt"
    txt_file.write_text("Hello startup world!", encoding="utf-8")
    ok, text, err = extract_plain_text(str(txt_file))
    assert ok
    assert text == "Hello startup world!"
    assert err == ""


def test_plain_text_extraction_missing_file():
    ok, text, err = extract_plain_text("non_existent_file.txt")
    assert not ok
    assert "does not exist" in err


def test_pdf_extraction_with_fixture():
    pdf_path = settings.fixtures_dir / "sample_pitch.pdf"
    if pdf_path.exists():
        ok, text, err = extract_pdf_text(str(pdf_path))
        assert ok
        assert "AgriScan AI" in text or "Problem" in text
        assert err == ""


# 4. Media Ingestion & FFmpeg
def test_ffmpeg_availability_and_cleanup(tmp_path):
    assert is_ffmpeg_available()
    dummy_wav = tmp_path / "temp_test.wav"
    dummy_wav.write_bytes(b"RIFFdummydata")
    assert dummy_wav.exists()
    assert cleanup_file(str(dummy_wav))
    assert not dummy_wav.exists()


def test_media_extraction_with_sample_audio():
    wav_path = settings.fixtures_dir / "sample_audio.wav"
    if wav_path.exists():
        ok, out_path, duration, err = extract_audio(str(wav_path))
        assert ok
        assert out_path is not None
        assert Path(out_path).exists()
        assert duration is not None
        assert duration > 0
        cleanup_file(out_path)


# 5. Transcription Providers & Fallbacks
def test_fallback_transcription_provider():
    provider = FallbackTranscriptionProvider()
    assert provider.is_available()
    res = provider.transcribe("dummy.wav")
    assert not res.success
    assert "disabled or unconfigured" in res.error_message
    assert res.provider_used == "fallback"


def test_groq_transcriber_unconfigured():
    with patch.object(settings, "groq_api_key", ""):
        provider = GroqTranscriptionProvider()
        assert not provider.is_available()
        res = provider.transcribe("dummy.wav")
        assert not res.success
        assert "Missing GROQ_API_KEY" in res.error_message


def test_faster_whisper_diagnostics():
    provider = FasterWhisperProvider()
    diag = provider.get_hardware_diagnostics()
    assert "configured_device" in diag
    assert "cuda_available" in diag
    assert "faster_whisper_installed" in diag


# 6. Translation Providers
def test_fallback_translation_preserves_text():
    provider = FallbackTranslationProvider()
    res = provider.translate("Hola mundo", target_language="en")
    assert res.success
    assert res.original_text == "Hola mundo"
    assert res.translated_text == "Hola mundo"
    assert not res.is_translated
    assert "Automatic translation unconfigured" in res.error_message


# 7. Market Evidence Filtering & Gaps
def test_market_evidence_query():
    provider = CuratedMarketEvidenceProvider()
    res = provider.search_evidence(category="Agriculture", geography="South Asia")
    assert len(res.items) >= 1
    first_item = res.items[0]
    assert first_item.category == "Agriculture"
    assert first_item.verification_status in ["VERIFIED", "SYNTHETIC_DEMO"]


def test_market_evidence_gaps_identified():
    provider = CuratedMarketEvidenceProvider()
    res = provider.search_evidence(category="QuantumComputingDeepSpace", geography="Mars")
    assert len(res.items) == 0
    assert len(res.gaps_identified) >= 1
    assert "No curated market evidence benchmarks found" in res.gaps_identified[0]


# 8. Deterministic Evaluator & Rubric
def test_deterministic_evaluator_scoring():
    evaluator = DeterministicEvaluator()
    result = evaluator.evaluate(
        transcript=SAMPLE_TRANSCRIPT,
        startup_name="AgriScan AI",
        target_geography="South Asia",
        industry="Agriculture"
    )
    assert isinstance(result, EvaluationResult)
    assert result.rubric_version == RUBRIC_VERSION
    assert result.evaluation_provider == "deterministic"
    assert "Deterministic Heuristic" in result.evaluation_method
    assert 60.0 <= result.overall_score <= 100.0

    # Ensure all 7 criteria exist with scores
    for k in RUBRIC_CRITERIA.keys():
        assert k in result.criteria_scores
        crit = result.criteria_scores[k]
        assert 0.0 <= crit.score <= 100.0
        assert crit.weight == RUBRIC_CRITERIA[k].weight
        assert crit.rationale != ""
        assert len(crit.evidence) >= 1

    assert len(result.strengths) >= 3
    assert len(result.risks) >= 2
    assert len(result.founder_questions) >= 3
    assert "preliminary screening" in result.confidence_limitations.lower()


# 9. Groq Evaluator Fallback & Schema Validation
def test_groq_evaluator_falls_back_when_unconfigured():
    with patch.object(settings, "groq_api_key", ""):
        evaluator = GroqEvaluator()
        assert not evaluator.is_available()
        res = evaluator.evaluate(SAMPLE_TRANSCRIPT, startup_name="AgriScan AI")
        assert res.evaluation_provider == "deterministic"
        assert "Groq LLM evaluator was not configured" in res.confidence_limitations


def test_groq_evaluator_recovers_from_network_error():
    with patch.object(settings, "groq_api_key", "mock_key_12345"):
        with patch("httpx.Client.post", side_effect=Exception("Connection timeout")):
            evaluator = GroqEvaluator()
            res = evaluator.evaluate(SAMPLE_TRANSCRIPT, startup_name="AgriScan AI")
            assert res.evaluation_provider == "deterministic"
            assert "safely fell back" in res.confidence_limitations


# 10. End-to-End API Integration
def test_api_e2e_ingest_and_evaluate():
    # Ingest manual text
    ingest_res = client.post("/ingest", json={"manual_transcript": SAMPLE_TRANSCRIPT})
    assert ingest_res.status_code == 200
    ingest_data = ingest_res.json()
    assert ingest_data["success"]
    assert ingest_data["extracted_text"] is not None

    # Evaluate
    eval_res = client.post("/evaluate", json={
        "transcript": ingest_data["extracted_text"],
        "startup_name": "AgriScan AI",
        "target_geography": "South Asia",
        "industry": "Agriculture"
    })
    assert eval_res.status_code == 200
    eval_data = eval_res.json()
    assert eval_data["overall_score"] > 50
    assert len(eval_data["criteria_scores"]) == 7
    assert len(eval_data["market_evidence"]) >= 1
