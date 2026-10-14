import os
from pathlib import Path
from pydantic import BaseModel
from dotenv import load_dotenv

# Load .env if present
load_dotenv()

BASE_DIR = Path(__file__).resolve().parent.parent
# In monorepo: parents[3] is project root (R:\PP\oddessey_fastAndCurius)
# In Docker container (/app/app/config.py): len(parents) is 2, so project root is BASE_DIR (/app)
parents = Path(__file__).resolve().parents
PROJECT_ROOT = parents[3] if len(parents) > 3 else BASE_DIR

def _resolve_dir(env_key: str, default_rel: str) -> Path:
    raw = os.getenv(env_key)
    if not raw:
        return (PROJECT_ROOT / default_rel).resolve()
    p = Path(raw)
    if p.is_absolute():
        return p.resolve()
    # Handle paths relative from project root or backend
    clean_rel = raw.replace("../../", "").replace("../", "")
    cand_root = (PROJECT_ROOT / clean_rel).resolve()
    if cand_root.exists():
        return cand_root
    cand_base = (BASE_DIR / raw).resolve()
    if cand_base.exists():
        return cand_base
    return cand_root

STORAGE_TEMP_DIR = _resolve_dir("TEMP_STORAGE_DIR", "storage/temp")
STORAGE_MODELS_DIR = _resolve_dir("WHISPER_DOWNLOAD_ROOT", "storage/models")
FIXTURES_DIR = _resolve_dir("FIXTURES_DIR", "fixtures")

# Ensure temp and models directories exist
STORAGE_TEMP_DIR.mkdir(parents=True, exist_ok=True)
STORAGE_MODELS_DIR.mkdir(parents=True, exist_ok=True)

class Settings(BaseModel):
    port: int = int(os.getenv("AI_PORT", "8000"))
    host: str = os.getenv("AI_HOST", "127.0.0.1")
    
    # Providers
    transcription_provider: str = os.getenv("TRANSCRIPTION_PROVIDER", "faster-whisper")
    evaluation_provider: str = os.getenv("EVALUATION_PROVIDER", "groq")
    research_provider: str = os.getenv("RESEARCH_PROVIDER", "curated_local")
    
    # Groq credentials & models
    groq_api_key: str = os.getenv("GROQ_API_KEY", "")
    groq_model: str = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")
    groq_transcription_model: str = os.getenv("GROQ_TRANSCRIPTION_MODEL", "whisper-large-v3-turbo")
    groq_max_tokens: int = int(os.getenv("GROQ_MAX_TOKENS", "750"))
    
    # Faster Whisper settings
    whisper_model_size: str = os.getenv("WHISPER_MODEL_SIZE", "base")
    whisper_device: str = os.getenv("WHISPER_DEVICE", "cpu")
    whisper_compute_type: str = os.getenv("WHISPER_COMPUTE_TYPE", "int8")
    whisper_device_index: int = int(os.getenv("WHISPER_DEVICE_INDEX", "0"))
    whisper_cpu_fallback: bool = os.getenv("WHISPER_CPU_FALLBACK", "true").lower() in ("true", "1", "yes")
    whisper_download_root: Path = STORAGE_MODELS_DIR
    
    # Paths
    temp_dir: Path = STORAGE_TEMP_DIR
    models_dir: Path = STORAGE_MODELS_DIR
    fixtures_dir: Path = FIXTURES_DIR

settings = Settings()
