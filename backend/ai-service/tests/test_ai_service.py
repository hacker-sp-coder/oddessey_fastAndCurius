import json
import os
import tempfile
from pathlib import Path
from unittest.mock import MagicMock, patch
import httpx

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
def test_market_evidence_query_returns_curated_benchmarks():
    """Curated local provider returns matched third-party analyst benchmarks from fixtures."""
    provider = CuratedMarketEvidenceProvider()
    res = provider.search_evidence(category="Agriculture", geography="South Asia", is_demo=False)
    assert len(res.items) >= 1
    assert res.provider_status == "curated_local"
    first_item = res.items[0]
    assert first_item.category == "Agriculture"
    assert first_item.verification_status == "VERIFIED"
    assert first_item.source_title != ""


def test_market_evidence_query_demo_returns_fixtures():
    """Demo pitches return bundled fixture items."""
    provider = CuratedMarketEvidenceProvider()
    res = provider.search_evidence(category="Agriculture", geography="South Asia", is_demo=True)
    assert len(res.items) >= 1
    assert res.provider_status == "curated_local"
    assert any(item.category == "Agriculture" for item in res.items)


def test_market_evidence_gaps_identified_for_unknown_category():
    provider = CuratedMarketEvidenceProvider()
    res = provider.search_evidence(category="QuantumComputingDeepSpace", geography="Mars", is_demo=False)
    assert len(res.items) == 0
    assert len(res.gaps_identified) >= 1
    assert "No curated market evidence benchmarks found" in res.gaps_identified[0]


def test_doordash_demo_market_evidence_fixture_and_isolation():
    """DoorDash demo receives exactly the 7 deterministic items and unrelated pitch does not."""
    provider = CuratedMarketEvidenceProvider()
    
    # 1. DoorDash demo query
    dd_res = provider.search_evidence(category="Food & Beverage Logistics", query="DoorDash", is_demo=True)
    assert len(dd_res.items) == 7
    assert dd_res.provider_status == "synthetic_demo_fixture"
    
    # Check 7 items
    synthetic_items = [i for i in dd_res.items if i.verification_status == "SYNTHETIC_DEMO"]
    missing_items = [i for i in dd_res.items if i.category == "Missing evidence" or i.verification_status == "UNAVAILABLE"]
    assert len(synthetic_items) == 6
    assert len(missing_items) == 1
    
    # Specific claims check
    claims = [i.claim for i in dd_res.items]
    assert "DoorDash operates a local commerce marketplace connecting consumers, merchants, and delivery workers." in claims
    assert any("Demand for convenient food ordering" in c for c in claims)
    assert any("Potential revenue sources include merchant commissions" in c for c in claims)
    assert any("Food delivery marketplaces face competition" in c for c in claims)
    assert any("Marketplace viability depends on order frequency" in c for c in claims)
    assert any("Relevant risks include thin order-level margins" in c for c in claims)
    assert any("The demo does not supply independently verified market size" in c for c in claims)

    # 2. Scope restriction: Unrelated pitch does NOT receive DoorDash fixture
    unrelated_res = provider.search_evidence(category="Agriculture", query="AgriScan AI", is_demo=False)
    assert not any("doordash" in i.claim.lower() for i in unrelated_res.items)


# 8. Deterministic Evaluator & Rubric
def test_deterministic_evaluator_scoring():
    evaluator = DeterministicEvaluator()
    result = evaluator.evaluate(
        transcript=SAMPLE_TRANSCRIPT,
        startup_name="AgriScan AI",
        target_geography="South Asia",
        industry="Agriculture",
        is_demo=False
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
    assert result.inferred_metadata is not None
    assert result.inferred_metadata.startup_name == "AgriScan AI"


# 9. Groq Evaluator: Strict Error Handling & No Silent Hardcoded Fallback
def test_groq_evaluator_raises_error_when_unconfigured_without_fallback():
    """Ensures no silent canned report is returned when Groq is not configured."""
    with patch.object(settings, "groq_api_key", ""):
        evaluator = GroqEvaluator()
        assert not evaluator.is_available()
        with pytest.raises(RuntimeError) as exc_info:
            evaluator.evaluate(SAMPLE_TRANSCRIPT, startup_name="AgriScan AI", allow_fallback=False)
        assert "GROQ_API_KEY is not configured" in str(exc_info.value)


def test_groq_evaluator_permits_explicit_heuristic_fallback():
    """Allows fallback only when explicitly permitted, labeling it prominently."""
    with patch.object(settings, "groq_api_key", ""):
        evaluator = GroqEvaluator()
        res = evaluator.evaluate(SAMPLE_TRANSCRIPT, startup_name="AgriScan AI", allow_fallback=True)
        assert res.evaluation_provider == "deterministic"
        assert "Deterministic Heuristic" in res.evaluation_method
        assert "GROQ_API_KEY was not configured" in res.confidence_limitations


def test_groq_evaluator_does_not_silently_fallback_on_network_error():
    """Ensures network timeout raises RuntimeError instead of returning a fake deterministic report."""
    with patch.object(settings, "groq_api_key", "mock_key_12345"):
        with patch("httpx.Client.post", side_effect=httpx.ConnectTimeout("Connection timeout")):
            evaluator = GroqEvaluator()
            with pytest.raises(RuntimeError) as exc_info:
                evaluator.evaluate(SAMPLE_TRANSCRIPT, startup_name="AgriScan AI", allow_fallback=False)
            assert "Groq evaluation failed" in str(exc_info.value)


def test_groq_evaluator_handles_rate_limiting_with_actionable_error():
    """Verifies HTTP 429 returns a clear rate limit message."""
    mock_resp = MagicMock()
    mock_resp.status_code = 429
    with patch.object(settings, "groq_api_key", "mock_key_12345"):
        with patch("httpx.Client.post", return_value=mock_resp):
            evaluator = GroqEvaluator()
            with pytest.raises(RuntimeError) as exc_info:
                evaluator.evaluate(SAMPLE_TRANSCRIPT, startup_name="AgriScan AI", allow_fallback=False)
            assert "rate limit exceeded" in str(exc_info.value).lower()


def test_groq_evaluator_handles_auth_failure_with_actionable_error():
    """Verifies HTTP 401 returns an invalid key message."""
    mock_resp = MagicMock()
    mock_resp.status_code = 401
    with patch.object(settings, "groq_api_key", "bad_key"):
        with patch("httpx.Client.post", return_value=mock_resp):
            evaluator = GroqEvaluator()
            with pytest.raises(RuntimeError) as exc_info:
                evaluator.evaluate(SAMPLE_TRANSCRIPT, startup_name="AgriScan AI", allow_fallback=False)
            assert "authentication failed" in str(exc_info.value).lower()


def test_groq_evaluator_parses_valid_llm_json_and_infers_metadata():
    """Verifies parsing of genuine LLM response, metadata inference, and unverified claims."""
    mock_llm_payload = {
        "inferred_metadata": {
            "startup_name": "AgriScan AI",
            "industry": "Agriculture",
            "target_geography": "South Asia",
            "confidence": 0.95
        },
        "criteria_scores": {
            "problem_clarity": {"score": 85.0, "rationale": "Clear problem", "evidence": ["farmers lose 30%"], "missing_evidence": "Historical trend"},
            "target_customer": {"score": 80.0, "rationale": "Smallholder farmers", "evidence": ["smallholder farmers"], "missing_evidence": "Willingness to pay"},
            "market_evidence": {"score": 75.0, "rationale": "Pilot with 500 farmers", "evidence": ["pilot tested with 500 farmers"], "missing_evidence": "Third-party audit"},
            "differentiation": {"score": 85.0, "rationale": "Edge neural model", "evidence": ["offline inference under 200ms"], "missing_evidence": "Hardware breakdown"},
            "feasibility": {"score": 82.0, "rationale": "Agronomists and engineers", "evidence": ["team of 3 PhDs"], "missing_evidence": "Hiring plan"},
            "business_model": {"score": 78.0, "rationale": "B2B2C through coops", "evidence": ["$12 per year per farmer"], "missing_evidence": "CAC calculation"},
            "scalability": {"score": 75.0, "rationale": "Scalable via coops", "evidence": ["expand to 50,000 farmers"], "missing_evidence": "Regulatory path"}
        },
        "strengths": ["Rapid offline inference", "High crop loss reduction"],
        "risks": ["Cooperative sales cycle friction", "Sensor hardware variability"],
        "assumptions": ["Farmers own compatible budget smartphones"],
        "missing_information": ["CAC payback duration"],
        "founder_questions": ["What is your distribution agreement with farmer coops?"],
        "unverified_founder_claims": [
            {"claim": "Reduces diagnostic turnaround from 5 days to 2 seconds", "validation_needed": "Independent pilot audit"}
        ],
        "confidence_score": 0.88,
        "confidence_limitations": "LLM triage screening based on founder pitch."
    }

    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = {
        "choices": [{"message": {"content": json.dumps(mock_llm_payload)}}]
    }

    with patch.object(settings, "groq_api_key", "mock_key_valid"):
        with patch("httpx.Client.post", return_value=mock_resp):
            evaluator = GroqEvaluator()
            res = evaluator.evaluate(SAMPLE_TRANSCRIPT, startup_name=None, is_demo=False)
            assert res.evaluation_provider == "groq"
            assert "Groq LLM" in res.evaluation_method
            assert res.overall_score > 70.0
            assert len(res.criteria_scores) == 7
            assert res.inferred_metadata.startup_name == "AgriScan AI"
            assert len(res.market_evidence) >= 1
            assert any(item.verification_status == "UNVERIFIED_CLAIM" for item in res.market_evidence)
            assert any(item.verification_status == "VERIFIED" for item in res.market_evidence)


# 10. End-to-End API Integration
def test_api_e2e_ingest_and_evaluate():
    # Ingest manual text
    ingest_res = client.post("/ingest", json={"manual_transcript": SAMPLE_TRANSCRIPT})
    assert ingest_res.status_code == 200
    ingest_data = ingest_res.json()
    assert ingest_data["success"]
    assert ingest_data["extracted_text"] is not None

    # Evaluate (deterministic explicitly specified for offline unit test)
    eval_res = client.post("/evaluate", json={
        "transcript": ingest_data["extracted_text"],
        "startup_name": "AgriScan AI",
        "target_geography": "South Asia",
        "industry": "Agriculture",
        "provider_override": "deterministic"
    })
    assert eval_res.status_code == 200
    eval_data = eval_res.json()
    assert eval_data["overall_score"] > 50
    assert len(eval_data["criteria_scores"]) == 7
    assert eval_data["evaluation_provider"] == "deterministic"


# 11. Groq OTPM and Token Budget Regression Tests
def test_groq_evaluator_sets_completion_token_budget_in_request():
    """Verifies that max_tokens is explicitly sent in the Groq completion payload and fits OTPM limit."""
    posted_payload = {}

    def mock_post(url, headers=None, json=None, timeout=None):
        nonlocal posted_payload
        posted_payload = json
        mock_r = MagicMock()
        mock_r.status_code = 200
        mock_r.json.return_value = {
            "choices": [{
                "message": {
                    "content": json_mod.dumps({
                        "inferred_metadata": {"startup_name": "AgriScan", "industry": "Ag", "target_geography": "Asia", "confidence": 0.9},
                        "criteria_scores": {k: {"score": 75.0, "rationale": "Solid", "evidence": ["ev"], "missing_evidence": "none"} for k in RUBRIC_CRITERIA},
                        "strengths": ["s1", "s2"],
                        "risks": ["r1", "r2"],
                        "assumptions": ["a1", "a2"],
                        "missing_information": ["m1", "m2"],
                        "founder_questions": ["q1", "q2"],
                        "unverified_founder_claims": [{"claim": "c1", "validation_needed": "v1"}],
                        "confidence_score": 0.85,
                        "confidence_limitations": "Screening"
                    })
                }
            }]
        }
        return mock_r

    import json as json_mod
    with patch.object(settings, "groq_api_key", "mock_valid_key"):
        with patch("httpx.Client.post", side_effect=mock_post):
            evaluator = GroqEvaluator()
            res = evaluator.evaluate(SAMPLE_TRANSCRIPT, startup_name="AgriScan")
            assert res.evaluation_provider == "groq"
            assert "max_tokens" in posted_payload
            assert posted_payload["max_tokens"] <= 800
            assert posted_payload["max_tokens"] == settings.groq_max_tokens


def test_groq_evaluator_otpm_rate_limit_regression():
    """Regression test: verifies exact OTPM error scenario from Groq (Limit 1000, Requested 1433) is handled with actionable guidance."""
    mock_resp = MagicMock()
    mock_resp.status_code = 429
    mock_resp.headers = {}
    mock_resp.json.return_value = {
        "error": {
            "message": "Request too large for model 'qwen/qwen3.8-27b' in organization org_123 service tier 'on_demand' on output tokens per minute (OTPM): Limit 1000, Requested 1433. Please try again in 5.2s.",
            "type": "tokens",
            "code": "rate_limit_exceeded"
        }
    }

    with patch.object(settings, "groq_api_key", "mock_valid_key"):
        with patch("httpx.Client.post", return_value=mock_resp):
            evaluator = GroqEvaluator()
            with pytest.raises(RuntimeError) as exc_info:
                evaluator.evaluate(SAMPLE_TRANSCRIPT, allow_fallback=False)
            err_text = str(exc_info.value)
            assert "rate limit exceeded (HTTP 429)" in err_text
            assert "OTPM" in err_text or "output tokens per minute" in err_text.lower()


def test_clean_and_parse_json_handles_fences_and_trailing_commas():
    """Verifies that clean_and_parse_json extracts valid JSON wrapped in markdown or trailing commas."""
    from app.evaluation.groq_evaluator import clean_and_parse_json

    raw_fenced = '```json\n{"startup_name": "TestCorp", "score": 85.0}\n```'
    parsed = clean_and_parse_json(raw_fenced)
    assert parsed["startup_name"] == "TestCorp"
    assert parsed["score"] == 85.0

    raw_trailing = '{"items": ["a", "b",], "score": 90,}'
    parsed_trailing = clean_and_parse_json(raw_trailing)
    assert parsed_trailing["score"] == 90
    assert len(parsed_trailing["items"]) == 2
