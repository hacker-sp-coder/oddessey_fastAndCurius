import os
import shutil
import subprocess
import uuid
from pathlib import Path
from typing import Optional, Tuple
from app.config import settings

def is_ffmpeg_available() -> bool:
    """Check if ffmpeg executable is available in PATH."""
    return shutil.which("ffmpeg") is not None

def get_ffmpeg_version() -> Optional[str]:
    """Retrieve FFmpeg version string."""
    if not is_ffmpeg_available():
        return None
    try:
        res = subprocess.run(
            ["ffmpeg", "-version"],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            timeout=5
        )
        first_line = res.stdout.splitlines()[0] if res.stdout else "Available"
        return first_line
    except Exception:
        return "Unknown"

def extract_audio(
    input_media_path: str,
    output_dir: Optional[Path] = None,
    max_duration_seconds: int = 1800  # 30 minutes cap for hackathon MVP
) -> Tuple[bool, Optional[str], Optional[float], str]:
    """
    Extract audio from video or audio file to 16kHz 16-bit mono PCM WAV.
    Returns: (success, output_wav_path, duration_seconds, error_message)
    """
    if not is_ffmpeg_available():
        return False, None, None, "FFmpeg is not installed or not found in system PATH."
    
    in_path = Path(input_media_path)
    if not in_path.is_file():
        return False, None, None, f"Input media file does not exist: {input_media_path}"
    
    target_dir = output_dir or settings.temp_dir
    target_dir.mkdir(parents=True, exist_ok=True)
    
    output_filename = f"extracted_{uuid.uuid4().hex[:8]}.wav"
    output_wav_path = target_dir / output_filename
    
    # Run FFmpeg command safely using subprocess list args (never shell=True with unvalidated inputs)
    cmd = [
        "ffmpeg",
        "-y",               # Overwrite if exists
        "-i", str(in_path), # Input file
        "-vn",              # Disable video stream
        "-acodec", "pcm_s16le",
        "-ar", "16000",     # 16kHz sample rate
        "-ac", "1",         # Mono channel
        "-t", str(max_duration_seconds),
        str(output_wav_path)
    ]
    
    try:
        proc = subprocess.run(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            timeout=120     # 2 minutes max processing time
        )
        if proc.returncode != 0:
            return False, None, None, f"FFmpeg extraction failed (code {proc.returncode}): {proc.stderr[:400]}"
        
        # Calculate duration
        duration = get_media_duration(str(output_wav_path))
        return True, str(output_wav_path), duration, ""
        
    except subprocess.TimeoutExpired:
        if output_wav_path.exists():
            output_wav_path.unlink()
        return False, None, None, "FFmpeg audio extraction timed out."
    except Exception as e:
        if output_wav_path.exists():
            output_wav_path.unlink()
        return False, None, None, f"FFmpeg execution error: {str(e)}"

def get_media_duration(file_path: str) -> Optional[float]:
    """Get media duration in seconds via ffprobe or ffmpeg output inspection."""
    ffprobe_cmd = shutil.which("ffprobe")
    if ffprobe_cmd:
        try:
            res = subprocess.run(
                [
                    "ffprobe",
                    "-v", "error",
                    "-show_entries", "format=duration",
                    "-of", "default=noprint_wrappers=1:nokey=1",
                    file_path
                ],
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                timeout=10
            )
            if res.returncode == 0 and res.stdout.strip():
                return round(float(res.stdout.strip()), 2)
        except Exception:
            pass

    # Fallback: estimate from wav file if it is a standard PCM WAV
    try:
        import wave
        with wave.open(file_path, "r") as wf:
            frames = wf.getnframes()
            rate = wf.getframerate()
            if rate > 0:
                return round(frames / float(rate), 2)
    except Exception:
        pass
    
    return None

def cleanup_file(path_str: Optional[str]) -> bool:
    """Safely delete a temporary file if it exists."""
    if not path_str:
        return False
    try:
        p = Path(path_str)
        if p.exists() and p.is_file():
            p.unlink()
            return True
    except Exception:
        pass
    return False
