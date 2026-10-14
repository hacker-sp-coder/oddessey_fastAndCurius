# AI Providers & GPU Acceleration Guide

This document outlines how PitchLens supports offline CPU fallback execution, hosted Groq AI providers, and local NVIDIA CUDA GPU hardware acceleration on Windows.

---

## 1. Pluggable Architecture Overview

The system features pluggable interfaces for speech-to-text transcription and startup viability evaluation:

| Component | Default Offline Mode | Optional Hosted Mode | Verified GPU Mode |
|---|---|---|---|
| **Transcription** | `fallback` (guided user transcript entry) | `groq` (Groq Whisper API) | `faster-whisper` (NVIDIA CUDA float16) |
| **Evaluation** | `deterministic` (7-dimension rule rubric) | `groq` (LLaMA 3.3 70B structured JSON) | Local LLM via Ollama / vLLM |
| **Translation** | `fallback` (preserves original text) | `groq` (LLaMA 3.3 Translation) | Local NLLB / MarianMT |
| **Market Evidence**| `curated_local` (benchmarks dataset) | External Search API adapter | Vector store / Embeddings |

---

## 2. Using the Hosted Groq AI Provider

Groq provides sub-second hosted inference for speech recognition and language models.

### Step 1: Obtain API Key
Sign up at [Groq Console](https://console.groq.com) and generate an API key.

### Step 2: Configure Environment
Add your key to `.env` (or set in PowerShell):

```bash
GROQ_API_KEY=gsk_your_actual_key_here
GROQ_MODEL=llama-3.3-70b-versatile
GROQ_TRANSCRIPTION_MODEL=whisper-large-v3-turbo
TRANSCRIPTION_PROVIDER=groq
EVALUATION_PROVIDER=groq
```

### Step 3: Restart Services
Restart the Python AI Service. The System Health page (`/settings`) will immediately recognize the Groq provider as active.

> [!NOTE]
> If Groq encounters network errors, rate limits, or invalid responses, the system **automatically and safely degrades to the deterministic heuristic evaluator** with a diagnostic notice. No pitch data is lost.

---

## 3. NVIDIA GPU Acceleration Setup (Faster-Whisper on Windows)

PitchLens is verified to run Faster-Whisper on Windows using the **NVIDIA GeForce RTX 3050 Laptop GPU** (6 GB VRAM) with CUDA 12 and cuDNN 9 runtimes.

### 3.1 Hardware & Driver Prerequisites
1. **Verify NVIDIA GPU Driver**:
   Run in PowerShell:
   ```powershell
   nvidia-smi
   ```
   Confirm your GPU is detected with driver version 525+ (verified on driver 617.14 with CUDA 13.4/12.x support).

2. **Python Environment**:
   Python 3.10–3.13 64-bit (`win32` AMD64 architecture).

### 3.2 Virtual Environment & Package Installation
We use isolated PyPI wheels (`nvidia-cublas-cu12`, `nvidia-cudnn-cu12`) so **no full system CUDA Toolkit installation is required**.

Run in PowerShell:
```powershell
cd backend\ai-service

# 1. Create virtual environment (if not already created)
python -m venv .venv

# 2. Activate virtual environment
.venv\Scripts\Activate.ps1

# 3. Upgrade pip
python -m pip install --upgrade pip

# 4. Install GPU packages
pip install -r requirements-gpu.txt
```

`requirements-gpu.txt` contains:
- `fastapi`, `uvicorn`, `pydantic`, `pypdf`, `httpx`, `python-dotenv`, `pytest`, `pytest-asyncio`
- `faster-whisper>=1.0.0`
- `nvidia-cublas-cu12` (provides `cublas64_12.dll` and `cublasLt64_12.dll`)
- `nvidia-cudnn-cu12` (provides `cudnn64_9.dll` and associated engine libraries)

### 3.3 Windows Dynamic Library (DLL) Resolution Mechanics
Starting with Python 3.8 on Windows, DLL search behavior changed:
- Python C extensions require directories to be registered via `os.add_dll_directory()`.
- However, CTranslate2's internal C++ dynamic loader calls Windows API `LoadLibrary("cublas64_12.dll")`, which resolves DLLs via `PATH`.

PitchLens solves this automatically via `app/transcription/cuda_helper.py`:
1. Discovers the virtual environment's `site-packages/nvidia/*/bin` folders.
2. Calls `os.add_dll_directory()` for Python C extensions.
3. Prepends these directories to `os.environ["PATH"]` for CTranslate2 C++ runtime calls.
4. Also inspects system `CUDA_PATH` if present.

### 3.4 Persistent Local Model Caching
- Models are cached locally in `storage/models` (configured via `WHISPER_DOWNLOAD_ROOT`).
- The initial run downloads model weights (e.g. `base` is ~140 MB).
- Subsequent restarts load directly from `storage/models` in ~1.5 seconds with zero network access.
- `storage/models/*` is protected by `.gitignore` so weights are never committed to Git.

### 3.5 Lazy Loading & CPU Fallback Guarantees
- **Lazy Loading**: Starting the FastAPI AI service does not download weights or allocate GPU memory. Weights are loaded only on the first transcription request.
- **CPU Fallback**: If `WHISPER_DEVICE=cuda` is set but GPU drivers or CUDA DLLs fail at runtime, the provider automatically falls back to CPU (`device="cpu"`, `compute_type="int8"`) with a diagnostic annotation (`provider_used="faster-whisper (cpu-fallback)"`). GPU execution is never falsely claimed.

### 3.6 Environment Configuration (`.env`)
To enable GPU transcription natively on Windows, set in `.env`:

```bash
# Enable Faster-Whisper with GPU acceleration
TRANSCRIPTION_PROVIDER=faster-whisper
WHISPER_DEVICE=cuda
WHISPER_COMPUTE_TYPE=float16
WHISPER_MODEL_SIZE=base
WHISPER_CPU_FALLBACK=true
WHISPER_DOWNLOAD_ROOT=../../storage/models
```

---

## 4. Standalone GPU Smoke Test & Verification

To verify that Faster-Whisper is utilizing your NVIDIA GPU and that CUDA/cuDNN libraries initialize correctly, run the standalone smoke test:

```powershell
cd backend\ai-service
.venv\Scripts\python smoke_test_gpu.py --model base --device cuda --compute-type float16
```

### Verified Test Output (NVIDIA GeForce RTX 3050 Laptop GPU)
```text
======================================================================
 ScreenAI Faster-Whisper GPU Acceleration Smoke Test
======================================================================

[Environment Diagnostics]
  Python Version:     3.11.9 (64bit AMD64)
  Operating System:   Windows 10 (Build 10.0.26200)
  CUDA DLL Dirs:      ...\Lib\site-packages\nvidia\cublas\bin, ...\cudnn\bin
  cuBLAS 12 Found:    True
  cuDNN 9 Found:      True

[Hardware Diagnostics]
  NVIDIA GPU Detected: YES
  Device Name:        NVIDIA GeForce RTX 3050 6GB Laptop GPU
  Total VRAM:         6144 MB (~6.0 GB)
  NVIDIA Driver:      617.14

[Library Diagnostics]
  faster-whisper:     Installed
  ctranslate2:        4.8.3
  CUDA Devices:       1
  CUDA Inference:     READY
  Supported Precision:bfloat16, float16, float32, int8, int8_bfloat16, int8_float16, int8_float32

[Test Audio Target]
  Target File:        R:\PP\oddessey_fastAndCurius\fixtures\spoken_test.wav
  File Size:          187,420 bytes
  Persistent Cache:   R:\PP\oddessey_fastAndCurius\storage\models

[Step 1/2] Loading model 'base' on device='cuda' (precision='float16')...
  SUCCESS: Model 'base' loaded in 1.52 seconds.

[Step 2/2] Running speech transcription inference on 'spoken_test.wav'...
  SUCCESS: Transcription completed in 1.26 seconds.

[Inference Results]
  Execution Device:   CUDA (NVIDIA GeForce RTX 3050 6GB Laptop GPU)
  Compute Type:       float16
  Detected Language:  en (probability: 98.68%)
  Audio Duration:     4.25s
  Model Load Time:    1.52s
  Transcription Time: 1.26s
  Real-Time Factor:   3.38x faster than real-time

[Segments (1 total)]
  [00.00s -> 03.52s] Screen AI Offline Pitch Screening on Nvidia GPU

[Full Transcript]
  "Screen AI Offline Pitch Screening on Nvidia GPU"

======================================================================
  SMOKE TEST RESULT: PASSED - GPU Acceleration Verified!
======================================================================
```

To test the CPU fallback path:
```powershell
.venv\Scripts\python smoke_test_gpu.py --model base --device cpu --compute-type int8
```

---

## 5. Running the AI Service Natively on Windows

To start the FastAPI service with GPU acceleration enabled:

```powershell
cd backend\ai-service
.venv\Scripts\uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

Then check the live health and capabilities endpoints:
- Health: `http://127.0.0.1:8000/health` (reports `cuda_available: true`, `gpu_device_name: "NVIDIA GeForce RTX 3050 6GB Laptop GPU"`)
- Capabilities: `http://127.0.0.1:8000/capabilities` (reports `faster-whisper` hardware details, precision, lazy status)

---

## 6. Automated Unit Tests

Run the full automated pytest suite (27 tests including GPU provider routing, CUDA error simulation, CPU fallback, and lazy loading):

```powershell
cd backend\ai-service
.venv\Scripts\pytest tests
```

---

## 7. Troubleshooting Guide

| Issue | Root Cause | Actionable Solution |
|---|---|---|
| `RuntimeError: Library cublas64_12.dll is not found` | `nvidia-cublas-cu12` wheel not installed, or Windows PATH did not include the bin dir. | Run `.venv\Scripts\pip install nvidia-cublas-cu12 nvidia-cudnn-cu12`. Ensure `cuda_helper.py` runs before importing `ctranslate2`. |
| `RuntimeError: Library cudnn_ops64_9.dll is not found` | `nvidia-cudnn-cu12` missing or incomplete wheel. | Run `.venv\Scripts\pip install --force-reinstall nvidia-cudnn-cu12`. |
| `CUDA out of memory` | Model size exceeds 6 GB VRAM (e.g. `large-v3` concurrently with other GPU tasks). | Switch to `WHISPER_MODEL_SIZE=base` or `WHISPER_MODEL_SIZE=small`, or set `WHISPER_COMPUTE_TYPE=int8_float16`. |
| `UserWarning: huggingface_hub cache uses symlinks` | Windows Developer Mode not active. | Benign warning. Caching still functions normally without symlinks in `storage/models`. To silence, set `HF_HUB_DISABLE_SYMLINKS_WARNING=1` in `.env`. |
| Audio file contains no text | Synthetic tone fixture used. | Provide spoken speech audio or use `fixtures/spoken_test.wav`. |

---

## 8. Security & Secret Protection

- GPU acceleration executes 100% locally on-device. No audio data, transcripts, or model telemetry leave the machine.
- API keys (e.g. Groq) are never exposed via health check endpoints or frontend responses.
