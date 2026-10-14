from pathlib import Path
from typing import Dict, List, Optional
from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.models.schemas import (
    CapabilitiesResponse,
    EvaluationRequest,
    EvaluationResult,
    HealthResponse,
    IngestRequest,
    IngestResponse,
    MarketEvidenceRequest,
    MarketEvidenceResponse,
    ProviderCapability,
    TranscribeRequest,
    TranscribeResponse,
    TranscriptSegment,
    TranslateRequest,
    TranslateResponse,
)
from app.ingestion.document import extract_pdf_text, extract_plain_text, normalize_text
from app.ingestion.media import extract_audio, get_ffmpeg_version, is_ffmpeg_available
from app.transcription.fallback_transcriber import FallbackTranscriptionProvider
from app.transcription.groq_transcriber import GroqTranscriptionProvider
from app.transcription.whisper_transcriber import FasterWhisperProvider
from app.translation.fallback_translator import FallbackTranslationProvider
from app.translation.groq_translator import GroqTranslationProvider
from app.evaluation.deterministic_evaluator import DeterministicEvaluator
from app.evaluation.groq_evaluator import GroqEvaluator
from app.market.curated_market import CuratedMarketEvidenceProvider

app = FastAPI(
    title="PitchLens — AI Screening Service",
    description="PitchLens document/media ingestion, transcription, 7-dimension viability evaluation, and market evidence service.",
    version="1.0.0"
)

# Narrow CORS for development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Instantiate service providers
market_provider = CuratedMarketEvidenceProvider()
deterministic_evaluator = DeterministicEvaluator(market_provider)
groq_evaluator = GroqEvaluator(deterministic_evaluator, market_provider)

groq_transcriber = GroqTranscriptionProvider()
whisper_transcriber = FasterWhisperProvider()
fallback_transcriber = FallbackTranscriptionProvider()

groq_translator = GroqTranslationProvider()
fallback_translator = FallbackTranslationProvider()


@app.get("/health", response_model=HealthResponse)
def get_health():
    whisper_diag = whisper_transcriber.get_hardware_diagnostics()
    return HealthResponse(
        status="ok",
        service="ai-service",
        version="1.0.0",
        ffmpeg_available=is_ffmpeg_available(),
        cuda_available=whisper_diag.get("cuda_available", False),
        gpu_device_name=whisper_diag.get("gpu_name")
    )


@app.get("/capabilities", response_model=CapabilitiesResponse)
def get_capabilities():
    ffmpeg_ok = is_ffmpeg_available()
    ffmpeg_ver = get_ffmpeg_version()
    whisper_diag = whisper_transcriber.get_hardware_diagnostics()

    gpu_label = whisper_diag.get("gpu_name") or ("NVIDIA GPU" if whisper_diag.get("gpu_detected") else "No GPU detected")
    cuda_ready = whisper_diag.get("cuda_available", False)
    fw_installed = whisper_diag.get("faster_whisper_installed", False)
    model_loaded = whisper_diag.get("model_loaded_in_memory", False)
    active_device = whisper_diag.get("active_device")

    fw_state_label = f"Model loaded ({active_device})" if model_loaded else "Model not loaded (lazy init)"
    cuda_state_label = "CUDA inference ready" if cuda_ready else ("GPU detected without CUDA runtime" if whisper_diag.get("gpu_detected") else "CUDA unavailable (CPU safe)")
    fallback_label = "CPU fallback enabled" if settings.whisper_cpu_fallback else "CPU fallback disabled"

    transcription_providers = [
        ProviderCapability(
            name="fallback",
            available=True,
            requires_gpu=False,
            requires_api_key=False,
            details="Guided manual/pasted transcript entry. Guaranteed to work offline without keys or GPU."
        ),
        ProviderCapability(
            name="groq",
            available=groq_transcriber.is_available(),
            requires_gpu=False,
            requires_api_key=True,
            details=f"Hosted Groq Whisper API ({settings.groq_transcription_model}). Requires GROQ_API_KEY."
        ),
        ProviderCapability(
            name="faster-whisper",
            available=fw_installed,
            requires_gpu=(settings.whisper_device.lower() == "cuda"),
            requires_api_key=False,
            details=(
                f"Local Faster-Whisper ({settings.whisper_model_size}). "
                f"Hardware: {gpu_label} [{cuda_state_label}]. "
                f"Config: Device={settings.whisper_device}, Precision={settings.whisper_compute_type}. "
                f"Status: {fw_state_label}. {fallback_label}."
            )
        )
    ]

    evaluation_providers = [
        ProviderCapability(
            name="deterministic",
            available=True,
            requires_gpu=False,
            requires_api_key=False,
            details="Offline heuristic rubric evaluator with verifiable scoring rules, evidence quotes and gap analysis."
        ),
        ProviderCapability(
            name="groq",
            available=groq_evaluator.is_available(),
            requires_gpu=False,
            requires_api_key=True,
            details=f"Hosted Groq LLM ({settings.groq_model}) with strict Pydantic JSON validation and automatic heuristic fallback."
        )
    ]

    research_providers = [
        ProviderCapability(
            name="curated_local",
            available=True,
            requires_gpu=False,
            requires_api_key=False,
            details="Curated local analyst benchmarks (Grand View Research, FAO, World Bank, McKinsey, OpenView) with verified provenance."
        )
    ]

    return CapabilitiesResponse(
        ffmpeg_available=ffmpeg_ok,
        ffmpeg_version=ffmpeg_ver,
        cuda_available=cuda_ready,
        transcription_providers=transcription_providers,
        evaluation_providers=evaluation_providers,
        research_providers=research_providers,
        active_transcription_provider=settings.transcription_provider,
        active_evaluation_provider=settings.evaluation_provider,
        active_research_provider="curated_local",
        hardware_diagnostics=whisper_diag
    )


@app.post("/ingest", response_model=IngestResponse)
def ingest_media_or_document(req: IngestRequest):
    # Case 1: Manual transcript supplied directly
    if req.manual_transcript and req.manual_transcript.strip():
        norm = normalize_text(req.manual_transcript)
        return IngestResponse(
            success=True,
            input_type="MANUAL",
            extracted_text=norm,
            detected_language="en"
        )

    if not req.file_path:
        raise HTTPException(status_code=400, detail="Either file_path or manual_transcript must be provided.")

    path = Path(req.file_path)
    if not path.is_file():
        # Fallback candidate checks across host and Docker container storage paths
        cand1 = Path("storage/uploads") / path.name
        cand2 = Path("/app/storage/uploads") / path.name
        if cand1.is_file():
            path = cand1
        elif cand2.is_file():
            path = cand2
        else:
            raise HTTPException(status_code=404, detail=f"File not found: {req.file_path}")

    ext = path.suffix.lower()

    # Case 2: PDF Document
    if ext == ".pdf":
        ok, text, err = extract_pdf_text(str(path))
        if not ok:
            return IngestResponse(
                success=False,
                input_type="PDF",
                error_message=err
            )
        return IngestResponse(
            success=True,
            input_type="PDF",
            extracted_text=text,
            detected_language="en"
        )

    # Case 3: Plain text or Markdown
    if ext in [".txt", ".md", ".markdown"]:
        ok, text, err = extract_plain_text(str(path))
        if not ok:
            return IngestResponse(
                success=False,
                input_type="TEXT",
                error_message=err
            )
        return IngestResponse(
            success=True,
            input_type="TEXT",
            extracted_text=text,
            detected_language="en"
        )

    # Case 4: Audio or Video
    video_exts = [".mp4", ".mov", ".webm", ".mkv", ".avi"]
    audio_exts = [".wav", ".mp3", ".m4a", ".aac", ".ogg", ".flac"]

    if ext in video_exts or ext in audio_exts:
        input_type = "VIDEO" if ext in video_exts else "AUDIO"
        ok, wav_path, duration, err = extract_audio(str(path))
        if not ok:
            return IngestResponse(
                success=False,
                input_type=input_type,
                error_message=err
            )
        return IngestResponse(
            success=True,
            input_type=input_type,
            extracted_audio_path=wav_path,
            duration_seconds=duration
        )

    return IngestResponse(
        success=False,
        input_type="UNKNOWN",
        error_message=f"Unsupported file extension: {ext}"
    )


@app.post("/transcribe", response_model=TranscribeResponse)
def transcribe_audio(req: TranscribeRequest):
    provider_name = req.provider_override or settings.transcription_provider
    provider = fallback_transcriber

    if provider_name == "groq":
        provider = groq_transcriber
    elif provider_name == "faster-whisper":
        provider = whisper_transcriber

    result = provider.transcribe(
        audio_file_path=req.audio_path,
        language_hint=req.language_hint
    )

    return TranscribeResponse(
        success=result.success,
        transcript=result.transcript,
        detected_language=result.detected_language,
        duration_seconds=result.duration_seconds,
        provider_used=result.provider_used,
        segments=[
            TranscriptSegment(start=s.start, end=s.end, text=s.text)
            for s in result.segments
        ],
        error_message=result.error_message
    )


@app.post("/translate", response_model=TranslateResponse)
def translate_transcript(req: TranslateRequest):
    provider = groq_translator if groq_translator.is_available() else fallback_translator
    res = provider.translate(req.text, target_language=req.target_language)

    return TranslateResponse(
        success=res.success,
        original_text=res.original_text,
        translated_text=res.translated_text,
        source_language=res.source_language,
        provider_used=res.provider_used,
        error_message=res.error_message
    )


@app.post("/evaluate", response_model=EvaluationResult)
def evaluate_pitch(req: EvaluationRequest):
    if not req.transcript or not req.transcript.strip():
        raise HTTPException(status_code=400, detail="Transcript is required for viability evaluation.")

    provider_name = req.provider_override or settings.evaluation_provider
    evaluator = groq_evaluator if provider_name == "groq" else deterministic_evaluator

    try:
        result = evaluator.evaluate(
            transcript=req.transcript,
            startup_name=req.startup_name,
            target_geography=req.target_geography,
            industry=req.industry,
            is_demo=req.is_demo,
            allow_fallback=req.allow_fallback
        )
        return result
    except RuntimeError as err:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(err)
        )
    except Exception as err:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Evaluation execution failed: {str(err)}"
        )


@app.post("/market-evidence", response_model=MarketEvidenceResponse)
def query_market_evidence(req: MarketEvidenceRequest):
    try:
        res = market_provider.search_evidence(
            category=req.category,
            geography=req.geography,
            query=req.query,
            is_demo=req.is_demo
        )
        return res
    except Exception as err:
        return MarketEvidenceResponse(
            items=[],
            gaps_identified=[f"External research query failed ({type(err).__name__}): {str(err)}"],
            provider_status="error"
        )
