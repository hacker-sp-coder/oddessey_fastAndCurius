from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field

class HealthResponse(BaseModel):
    status: str = "ok"
    service: str = "ai-service"
    version: str = "1.0.0"
    ffmpeg_available: bool = False
    cuda_available: Optional[bool] = None
    gpu_device_name: Optional[str] = None

class ProviderCapability(BaseModel):
    name: str
    available: bool
    requires_gpu: bool = False
    requires_api_key: bool = False
    details: str = ""

class CapabilitiesResponse(BaseModel):
    ffmpeg_available: bool
    ffmpeg_version: Optional[str] = None
    cuda_available: bool = False
    transcription_providers: List[ProviderCapability] = []
    evaluation_providers: List[ProviderCapability] = []
    research_providers: List[ProviderCapability] = []
    active_transcription_provider: str
    active_evaluation_provider: str
    active_research_provider: str = "curated_local"
    hardware_diagnostics: Optional[Dict[str, Any]] = None

class IngestRequest(BaseModel):
    file_path: Optional[str] = None
    input_type: Optional[str] = "AUTO"
    manual_transcript: Optional[str] = None

class IngestResponse(BaseModel):
    success: bool
    input_type: str
    extracted_text: Optional[str] = None
    detected_language: Optional[str] = None
    extracted_audio_path: Optional[str] = None
    duration_seconds: Optional[float] = None
    error_message: Optional[str] = None

class TranscriptSegment(BaseModel):
    start: float
    end: float
    text: str

class TranscribeRequest(BaseModel):
    audio_path: str
    language_hint: Optional[str] = None
    provider_override: Optional[str] = None

class TranscribeResponse(BaseModel):
    success: bool
    transcript: str
    detected_language: Optional[str] = None
    duration_seconds: Optional[float] = None
    provider_used: str
    segments: List[TranscriptSegment] = []
    error_message: Optional[str] = None

class TranslateRequest(BaseModel):
    text: str
    target_language: str = "en"

class TranslateResponse(BaseModel):
    success: bool
    original_text: str
    translated_text: str
    source_language: Optional[str] = None
    provider_used: str
    error_message: Optional[str] = None

class CriterionScore(BaseModel):
    name: str
    score: float
    weight: float
    weighted_score: float
    rationale: str
    evidence: List[str] = Field(default_factory=list)
    missing_evidence: str = ""

class MarketEvidenceItem(BaseModel):
    id: str
    category: str
    geography: str
    claim: str
    source_title: str
    source_url: Optional[str] = ""
    publication_date: Optional[str] = None
    retrieval_date: Optional[str] = None
    verification_status: str  # 'VERIFIED' | 'UNVERIFIED_CLAIM' | 'UNAVAILABLE' | 'SYNTHETIC_DEMO'
    notes: Optional[str] = None

class MarketEvidenceRequest(BaseModel):
    category: Optional[str] = None
    geography: Optional[str] = None
    query: Optional[str] = None
    is_demo: bool = False

class MarketEvidenceResponse(BaseModel):
    items: List[MarketEvidenceItem] = Field(default_factory=list)
    gaps_identified: List[str] = Field(default_factory=list)
    provider_status: str = "unconfigured"

class InferredMetadata(BaseModel):
    startup_name: Optional[str] = None
    industry: Optional[str] = None
    target_geography: Optional[str] = None
    confidence: float = 0.0
    inferred: bool = False

class EvaluationRequest(BaseModel):
    transcript: str
    startup_name: Optional[str] = None
    target_geography: Optional[str] = None
    industry: Optional[str] = None
    provider_override: Optional[str] = None
    allow_fallback: bool = False
    is_demo: bool = False

class EvaluationResult(BaseModel):
    rubric_version: str
    evaluation_provider: str
    evaluation_method: str
    overall_score: float
    criteria_scores: Dict[str, CriterionScore]
    strengths: List[str] = Field(default_factory=list)
    risks: List[str] = Field(default_factory=list)
    assumptions: List[str] = Field(default_factory=list)
    missing_information: List[str] = Field(default_factory=list)
    founder_questions: List[str] = Field(default_factory=list)
    market_evidence: List[MarketEvidenceItem] = Field(default_factory=list)
    confidence_score: float = 0.8
    confidence_limitations: str = ""
    is_demo: bool = False
    inferred_metadata: Optional[InferredMetadata] = None
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
