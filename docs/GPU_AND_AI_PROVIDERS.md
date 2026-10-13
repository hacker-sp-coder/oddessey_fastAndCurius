# AI Providers & GPU Acceleration Guide

This document outlines how ScreenAI supports offline CPU fallback execution today, and how to configure hosted Groq AI providers or enable local NVIDIA CUDA GPU hardware when available.

---

## 1. Provider Architecture Overview

The system features pluggable interfaces for transcription and viability evaluation:

| Component | Default Offline Mode | Optional Hosted Mode | Future GPU Mode |
|---|---|---|---|
| **Transcription** | `fallback` (guided user transcript entry) | `groq` (Groq Whisper API) | `faster-whisper` (CUDA accelerated) |
| **Evaluation** | `deterministic` (7-dimension rule rubric) | `groq` (LLaMA 3.3 70B structured JSON) | Local LLM via Ollama / vLLM |
| **Translation** | `fallback` (preserves original text) | `groq` (LLaMA 3.3 Translation) | Local NLLB / MarianMT |
| **Market Evidence**| `curated_local` (benchmarks dataset) | External Search API adapter | Vector store / Embeddings |

---

## 2. Using the Hosted Groq AI Provider

Groq provides sub-second inference for speech recognition and language models.

### Step 1: Obtain API Key
Sign up at [Groq Console](https://console.groq.com) and generate an API key.

### Step 2: Configure Environment
Add your key to `.env` (or set in shell):

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

## 3. Transitioning to NVIDIA GPU & Faster-Whisper

When you receive the target NVIDIA GPU laptop, follow these steps to enable local on-device speech transcription without external API keys:

### 3.1 Hardware & Driver Prerequisites
1. Ensure the NVIDIA GPU driver is installed:
   ```bash
   nvidia-smi
   ```
2. Verify CUDA toolkit support (CUDA 11.8 or 12.x).

### 3.2 Install GPU Packages in AI Service Virtualenv
Install `faster-whisper` and CUDA-accelerated `ctranslate2`:

```powershell
# In backend/ai-service virtualenv:
.venv\Scripts\pip install faster-whisper
```

### 3.3 Update `.env` Settings
Configure the device and compute precision:

```bash
TRANSCRIPTION_PROVIDER=faster-whisper
WHISPER_MODEL_SIZE=base          # or 'small', 'medium', 'large-v3'
WHISPER_DEVICE=cuda              # Use 'cuda' for GPU, 'cpu' for fallback
WHISPER_COMPUTE_TYPE=float16     # Use 'float16' for GPU, 'int8' for CPU
```

### 3.4 Run the Optional Model Smoke Test
To verify model loading and GPU inference without running the entire web app, run our smoke test script:

```powershell
backend\ai-service\.venv\Scripts\python -c "
from app.transcription.whisper_transcriber import FasterWhisperProvider
p = FasterWhisperProvider()
print('Diagnostics:', p.get_hardware_diagnostics())
if p.is_available():
    res = p.transcribe('fixtures/sample_audio.wav')
    print('Smoke test transcription:', res)
else:
    print('Faster-Whisper not installed in this environment.')
"
```

---

## 4. Security & Secret Protection

- API credentials are **never logged**, committed to git, or passed through frontend network responses.
- The Node.js health endpoints (`/api/health` and `/api/health/capabilities`) verify connectivity and capability flags without ever exposing raw API keys.
