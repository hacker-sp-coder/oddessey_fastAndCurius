import os
from pathlib import Path
from pydantic import BaseModel
from dotenv import load_dotenv

# Load .env if present
load_dotenv()

BASE_DIR = Path(__file__).resolve().parent.parent
STORAGE_TEMP_DIR = Path(os.getenv("TEMP_STORAGE_DIR", str(BASE_DIR.parent.parent / "storage" / "temp"))).resolve()
FIXTURES_DIR = Path(os.getenv("FIXTURES_DIR", str(BASE_DIR.parent.parent / "fixtures"))).resolve()

# Ensure temp directory exists
STORAGE_TEMP_DIR.mkdir(parents=True, exist_ok=True)

class Settings(BaseModel):
    port: int = int(os.getenv("AI_PORT", "8000"))
    host: str = os.getenv("AI_HOST", "127.0.0.1")
    
    # Providers
    transcription_provider: str = os.getenv("TRANSCRIPTION_PROVIDER", "fallback")
    evaluation_provider: str = os.getenv("EVALUATION_PROVIDER", "deterministic")
    
    # Groq credentials & models
    groq_api_key: str = os.getenv("GROQ_API_KEY", "")
    groq_model: str = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")
    groq_transcription_model: str = os.getenv("GROQ_TRANSCRIPTION_MODEL", "whisper-large-v3-turbo")
    
    # Faster Whisper settings
    whisper_model_size: str = os.getenv("WHISPER_MODEL_SIZE", "base")
    whisper_device: str = os.getenv("WHISPER_DEVICE", "cpu")
    whisper_compute_type: str = os.getenv("WHISPER_COMPUTE_TYPE", "int8")
    
    # Paths
    temp_dir: Path = STORAGE_TEMP_DIR
    fixtures_dir: Path = FIXTURES_DIR

settings = Settings()
