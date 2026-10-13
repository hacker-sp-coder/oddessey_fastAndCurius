# Setup and Run Guide

This guide covers running the application via Docker Compose (recommended) as well as manual local development.

---

## ⚡ Quick Start: Docker (Single-Command Run)

To start the full stack with all dependencies, FFmpeg, SQLite, and reverse-proxy pre-configured:

```bash
docker compose up --build
```

- **Frontend**: [http://localhost:5173](http://localhost:5173)
- **Node API**: [http://localhost:4000](http://localhost:4000)
- **FastAPI AI**: [http://localhost:8000](http://localhost:8000)

To run container test suites:
```bash
docker compose exec api npm test
docker compose exec ai-service pytest
```

To stop:
```bash
docker compose down
```

---

## Alternative: Manual Local Development Setup

## 1. Prerequisites

1. **Node.js**: v18.0.0 or later (v22 LTS recommended).
2. **Python**: v3.10 or later (v3.13 tested).
3. **FFmpeg**: Required for media extraction and video audio separation.

### FFmpeg Installation

- **Windows (PowerShell)**:
  ```powershell
  winget install Gyan.FFmpeg
  # Verify installation:
  ffmpeg -version
  ```
- **macOS (Homebrew)**:
  ```bash
  brew install ffmpeg
  ```
- **Linux (Ubuntu / Debian)**:
  ```bash
  sudo apt update && sudo apt install -y ffmpeg
  ```

---

## 2. Environment Configuration

Copy the example environment configuration into your working `.env`:

```bash
# From workspace root:
cp .env.example .env
```

Safe default values are already populated for offline execution:
- `TRANSCRIPTION_PROVIDER=fallback` (Guides user to review transcript without requiring external keys)
- `EVALUATION_PROVIDER=deterministic` (Evaluates against the explainable rubric offline without external AI keys)
- Optional `GROQ_API_KEY`: Leave blank to use offline deterministic fallback, or supply a Groq key to enable LLaMA 3.3 and Groq Whisper.

---

## 3. Installation Steps

### 3.1 Python AI Service (`backend/ai-service`)

Create the virtual environment and install lightweight core dependencies:

```bash
# Windows
python -m venv backend/ai-service/.venv
backend\ai-service\.venv\Scripts\pip install -r backend/ai-service/requirements.txt

# macOS / Linux
python3 -m venv backend/ai-service/.venv
source backend/ai-service/.venv/bin/activate
pip install -r backend/ai-service/requirements.txt
```

### 3.2 Node.js Express API (`backend/api`)

Install Node dependencies:

```bash
cd backend/api
npm install
cd ../..
```

### 3.3 React Frontend (`frontend`)

Install frontend dependencies:

```bash
cd frontend
npm install
cd ..
```

---

## 4. Running the Automated Test Suites

All tests are designed to execute offline without GPU hardware, model weights, network calls, or API credentials.

### Run All Tests via Root Script:
```bash
npm run test:all
```

### Or Run Tests Component by Component:

1. **Python AI Service (19 pytest tests)**:
   ```powershell
   cd backend/ai-service
   .venv\Scripts\pytest tests
   cd ../..
   ```

2. **Node.js Express API (13 Vitest tests)**:
   ```bash
   cd backend/api
   npm test
   cd ../..
   ```

3. **React Frontend (6 Vitest tests + Build check)**:
   ```bash
   cd frontend
   npm test
   npm run build
   cd ..
   ```

---

## 5. Starting the Development Servers

For the full hackathon MVP demo, open three terminal windows:

### Terminal 1 — Python AI Service (Port 8000)
```powershell
# Windows
backend\ai-service\.venv\Scripts\uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload

# Linux/macOS
source backend/ai-service/.venv/bin/activate
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

### Terminal 2 — Node.js Express API (Port 4000)
```bash
cd backend/api
npm run dev
```

### Terminal 3 — React Frontend (Port 5173)
```bash
cd frontend
npm run dev
```

Open your browser at **`http://localhost:5173`**.

---

## 6. Verification Checklist

1. Visit **`http://localhost:5173`** — the Dashboard should display zero pitches screened or your existing history.
2. Click **"Demo Pitch"** in the top navigation bar — instantly loads the pre-computed AgriScan AI report with 7 criteria scores, evidence citations, and verified market provenance.
3. Click **"System Health"** in the navigation bar — verifies that Node API, SQLite, and Python AI Service are green and connected.
