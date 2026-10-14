#!/usr/bin/env python3
"""
PitchLens Faster-Whisper GPU Acceleration Smoke Test
Verifies on-device NVIDIA CUDA speech-to-text inference on Windows.

Usage:
  python smoke_test_gpu.py [--model base] [--device cuda] [--compute-type float16] [--audio path/to/audio.wav]
"""

import argparse
import os
import platform
import sys
import time
from pathlib import Path
from typing import Optional

# Add project root to sys.path
SCRIPT_DIR = Path(__file__).resolve().parent
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))

from app.config import settings
from app.transcription.cuda_helper import (
    get_cuda_runtime_diagnostics,
    get_nvidia_gpu_hardware_info,
    setup_cuda_runtime_environment,
)


def run_smoke_test(
    model_size: str = "base",
    device: str = "cuda",
    compute_type: str = "float16",
    audio_path: Optional[str] = None,
    download_root: Optional[str] = None
) -> bool:
    print("=" * 70)
    print(" PitchLens Faster-Whisper GPU Acceleration Smoke Test")
    print("=" * 70)

    # 1. Environment & Architecture Diagnostics
    print("\n[Environment Diagnostics]")
    print(f"  Python Version:     {sys.version.split()[0]} ({platform.architecture()[0]} {platform.machine()})")
    print(f"  Operating System:   {platform.system()} {platform.release()} (Build {platform.version()})")
    print(f"  Executable Path:    {sys.executable}")

    # Initialize CUDA DLLs on Windows
    dll_info = setup_cuda_runtime_environment()
    if dll_info["dll_dirs_registered"]:
        print(f"  CUDA DLL Dirs:      {', '.join(dll_info['dll_dirs_registered'])}")
        print(f"  cuBLAS 12 Found:    {dll_info['cublas_found']}")
        print(f"  cuDNN 9 Found:      {dll_info['cudnn_found']}")

    # 2. Hardware Diagnostics
    hw_info = get_nvidia_gpu_hardware_info()
    print("\n[Hardware Diagnostics]")
    print(f"  NVIDIA GPU Detected:{' YES' if hw_info['gpu_detected'] else ' NO'}")
    if hw_info["gpu_detected"]:
        print(f"  Device Name:        {hw_info['gpu_name']}")
        print(f"  Total VRAM:         {hw_info['vram_total_mb']} MB (~{round((hw_info['vram_total_mb'] or 0)/1024, 1)} GB)")
        print(f"  NVIDIA Driver:      {hw_info['driver_version']}")

    # 3. Library & CUDA Runtime Diagnostics
    cuda_diag = get_cuda_runtime_diagnostics(refresh=True)
    print("\n[Library Diagnostics]")
    print(f"  faster-whisper:     {'Installed' if cuda_diag['faster_whisper_installed'] else 'NOT installed'}")
    print(f"  ctranslate2:        {cuda_diag['ctranslate2_version'] or 'NOT installed'}")
    print(f"  CUDA Devices:       {cuda_diag['cuda_device_count']}")
    print(f"  CUDA Inference:     {'READY' if cuda_diag['cuda_inference_available'] else 'UNAVAILABLE'}")
    if cuda_diag["supported_compute_types_cuda"]:
        print(f"  Supported Precision:{', '.join(cuda_diag['supported_compute_types_cuda'])}")

    if not cuda_diag["faster_whisper_installed"]:
        print("\n[ERROR] faster-whisper package is not installed.")
        print("  Fix: Run `.venv\\Scripts\\pip install -r requirements-gpu.txt`")
        return False

    if device.lower() == "cuda" and not cuda_diag["cuda_inference_available"]:
        print("\n[ERROR] CUDA inference is not available for faster-whisper.")
        if not hw_info["gpu_detected"]:
            print("  Reason: No NVIDIA GPU detected on this system.")
        elif cuda_diag["cuda_device_count"] == 0:
            print("  Reason: CTranslate2 did not detect any CUDA-capable devices.")
        elif not dll_info["cublas_found"] or not dll_info["cudnn_found"]:
            print("  Reason: Missing NVIDIA CUDA runtime DLLs (cublas64_12.dll or cudnn64_9.dll).")
            print("  Fix: Install runtime wheels into your virtual environment:")
            print("       .venv\\Scripts\\pip install nvidia-cublas-cu12 nvidia-cudnn-cu12")
        if cuda_diag.get("cuda_error"):
            print(f"  Detailed Error: {cuda_diag['cuda_error']}")
        return False

    # 4. Audio Fixture Validation
    default_fixtures = [
        Path(audio_path) if audio_path else None,
        settings.fixtures_dir / "spoken_test.wav",
        settings.fixtures_dir / "sample_audio.wav",
        SCRIPT_DIR.parent.parent / "fixtures" / "spoken_test.wav",
        SCRIPT_DIR.parent.parent / "fixtures" / "sample_audio.wav"
    ]
    resolved_audio: Optional[Path] = None
    for f in default_fixtures:
        if f and f.is_file():
            resolved_audio = f.resolve()
            break

    if not resolved_audio:
        print("\n[ERROR] No test audio fixture found.")
        print("  Please provide a valid audio file using `--audio <path>`:")
        print("    python smoke_test_gpu.py --audio R:\\path\\to\\recording.wav")
        return False

    print(f"\n[Test Audio Target]")
    print(f"  Target File:        {resolved_audio}")
    print(f"  File Size:          {resolved_audio.stat().st_size:,} bytes")

    cache_dir = download_root or str(settings.whisper_download_root)
    print(f"  Persistent Cache:   {cache_dir}")

    # 5. Model Loading Benchmark
    print(f"\n[Step 1/2] Loading model '{model_size}' on device='{device}' (precision='{compute_type}')...")
    try:
        from faster_whisper import WhisperModel
        t0 = time.time()
        model = WhisperModel(
            model_size_or_path=model_size,
            device=device,
            device_index=settings.whisper_device_index,
            compute_type=compute_type,
            download_root=cache_dir
        )
        load_time = time.time() - t0
        print(f"  SUCCESS: Model '{model_size}' loaded in {load_time:.2f} seconds.")
    except Exception as e:
        print(f"\n[ERROR] Model loading failed: {e}")
        if "cublas" in str(e).lower() or "cudnn" in str(e).lower():
            print("  Actionable resolution:")
            print("  NVIDIA cuBLAS/cuDNN runtime libraries could not be initialized.")
            print("  Ensure nvidia-cublas-cu12 and nvidia-cudnn-cu12 are installed:")
            print("    .venv\\Scripts\\pip install nvidia-cublas-cu12 nvidia-cudnn-cu12")
        return False

    # 6. Transcription Inference Benchmark
    print(f"\n[Step 2/2] Running speech transcription inference on '{resolved_audio.name}'...")
    try:
        t1 = time.time()
        segments_gen, info = model.transcribe(str(resolved_audio), beam_size=5)
        
        segments = []
        transcript_parts = []
        for s in segments_gen:
            clean_text = s.text.strip()
            if clean_text:
                segments.append((s.start, s.end, clean_text))
                transcript_parts.append(clean_text)

        transcribe_time = time.time() - t1
        full_transcript = " ".join(transcript_parts).strip()

        print(f"  SUCCESS: Transcription completed in {transcribe_time:.2f} seconds.")
        print(f"\n[Inference Results]")
        print(f"  Execution Device:   {device.upper()} ({hw_info['gpu_name'] or 'NVIDIA GPU'})")
        print(f"  Compute Type:       {compute_type}")
        print(f"  Detected Language:  {info.language} (probability: {info.language_probability:.2%})")
        print(f"  Audio Duration:     {info.duration:.2f}s")
        print(f"  Model Load Time:    {load_time:.2f}s")
        print(f"  Transcription Time: {transcribe_time:.2f}s")
        if info.duration > 0:
            speed_ratio = round(info.duration / transcribe_time, 2)
            print(f"  Real-Time Factor:   {speed_ratio}x faster than real-time")

        print(f"\n[Segments ({len(segments)} total)]")
        for start, end, text in segments:
            print(f"  [{start:05.2f}s -> {end:05.2f}s] {text}")

        print(f"\n[Full Transcript]")
        if full_transcript:
            print(f"  \"{full_transcript}\"")
        else:
            print("  (Audio fixture contains pure tone/silence with no detectable speech text.)")

        print("\n" + "=" * 70)
        print("  SMOKE TEST RESULT: PASSED - GPU Acceleration Verified!")
        print("=" * 70)
        return True

    except Exception as e:
        print(f"\n[ERROR] Transcription execution failed: {e}")
        return False


if __name__ == "__main__":
    from typing import Optional
    parser = argparse.ArgumentParser(description="PitchLens Faster-Whisper GPU Smoke Test")
    parser.add_argument("--model", default="base", help="Whisper model size (base, small, medium, etc.)")
    parser.add_argument("--device", default="cuda", help="Execution device (cuda or cpu)")
    parser.add_argument("--compute-type", default="float16", help="Precision (float16, int8_float16, int8, etc.)")
    parser.add_argument("--audio", default=None, help="Path to input audio file")
    parser.add_argument("--download-root", default=None, help="Directory to cache downloaded model weights")
    args = parser.parse_args()

    success = run_smoke_test(
        model_size=args.model,
        device=args.device,
        compute_type=args.compute_type,
        audio_path=args.audio,
        download_root=args.download_root
    )
    sys.exit(0 if success else 1)
