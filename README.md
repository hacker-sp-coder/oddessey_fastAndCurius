# PitchLens — Startup Pitch Intelligence & Screening Workspace

**PitchLens** is an evidence-first startup screening and viability research workspace that ingests multimodal pitches (video, audio, PDF, and text), extracts core claims, and produces an **explainable 7-dimension startup viability assessment** cross-referenced with empirical market benchmarks.

Built for rapid MVP execution, it functions completely offline without requiring a dedicated GPU or live AI credentials, while offering pluggable adapters for hosted Groq models (LLaMA 3.3 & Whisper) and local Faster-Whisper on NVIDIA GPU hardware.

---

## Architecture Overview

```
oddessey_fastAndCurius/
├── frontend/               # React 18, Vite, TypeScript, Vanilla CSS
├── backend/
│   ├── api/                # Node.js, Express, TypeScript, better-sqlite3
│   └── ai-service/         # Python 3.13, FastAPI, pypdf, FFmpeg integration
├── storage/                # Local uploads, temp audio, and reports (ignored in git)
├── fixtures/               # Test fixtures (sample pitch text, PDF, WAV, demo JSON)
├── docs/                   # Architecture, API specs, setup, rubric, demo script
├── package.json            # Unified monorepo commands
└── IMPLEMENTATION_LOG.md   # Chronological development log
```

---

## Key Features

- **Multimodal Ingestion**: Accepts MP4/MOV/WEBM video, WAV/MP3 audio, PDF decks, TXT/MD notes, or manual transcript entries.
- **Audio Extraction via FFmpeg**: Automatically isolates 16kHz mono audio streams safely using subprocess arrays without shell injection risks.
- **Explainable 7-Dimension Rubric (v1.0.0)**:
  1. Problem Clarity (15%)
  2. Target Customer (15%)
  3. Market Evidence & Traction (15%)
  4. Differentiation & Moat (15%)
  5. Technical & Operational Feasibility (15%)
  6. Business Model (15%)
  7. Scalability & Growth (10%)
- **Empirical Market Provenance**: Matches claims against curated FAO, World Bank, Grand View Research benchmarks, clearly labelling verified data vs synthetic demonstration fixtures.
- **Offline / Deterministic Independence**: The full application, test suite, and demo mode work without network connectivity or GPU hardware.
- **Zero Inert Buttons**: Every visible action in the UI triggers a real operation.
- **Instant Demo Mode**: Includes bundled `AgriScan AI` pitch fixture so judges can evaluate completed reports instantly.

---

---

## Quick Start with Docker (Recommended)

Start the entire application stack with a single command:

```bash
docker compose up --build
```

The application will build all containers, run health checks, and start services in the correct dependency order:
- **Frontend (Web UI)**: [http://localhost:5173](http://localhost:5173) (Production Vite build served by Nginx with reverse proxy to `/api`)
- **API Server (Express + SQLite)**: [http://localhost:4000](http://localhost:4000) (or via reverse-proxy at `http://localhost:5173/api`)
- **AI Service (FastAPI + FFmpeg)**: [http://localhost:8000](http://localhost:8000) (accessible internally to the API as `http://ai-service:8000`)

> [!NOTE]
> The application functions completely offline out of the box with zero GPU or external API credentials required. Groq is optional.

---

## Docker Commands Cheat Sheet

### 1. Startup & Background Execution
```bash
# Start in foreground with real-time logs
docker compose up --build

# Start in background (detached mode)
docker compose up -d --build

# View container status and health
docker compose ps
```

### 2. Inspecting Logs
```bash
# Stream logs for all services
docker compose logs -f

# Stream logs for a specific service
docker compose logs -f frontend
docker compose logs -f api
docker compose logs -f ai-service
```

### 3. Running Automated Tests inside Containers
```bash
# Run backend API test suite (13/13 passing)
docker compose exec api npm test

# Run Python AI service test suite (19/19 passing)
docker compose exec ai-service pytest
```

### 4. Stopping & Shutdown
```bash
# Stop and remove containers and internal network (keeps persistent ./storage intact)
docker compose down

# Stop and remove containers including anonymous volumes
docker compose down -v
```

### 5. Rebuilding Containers
```bash
# Standard rebuild and startup
docker compose up --build

# Rebuild without cache if dependencies change
docker compose build --no-cache
docker compose up -d
```

---

## Data Persistence & Storage Architecture

Application state is mapped to the host filesystem under `./storage/` and persists across container creation, shutdown, and rebuilds:
- `./storage/pitches.db`: SQLite database containing pitch metadata, evaluation scores, and transcripts.
- `./storage/uploads/`: Original uploaded pitch files (video, audio, PDF, text).
- `./storage/temp/`: Extracted 16kHz audio files created during FFmpeg processing.
- `./storage/reports/`: Exported viability summaries.

To reset the database and application state back to clean initial state:
```bash
# Windows PowerShell
Remove-Item -Force storage/pitches.db
# Linux / macOS
rm -f storage/pitches.db
```

---

## Docker Troubleshooting

| Issue | Cause | Resolution |
| :--- | :--- | :--- |
| `Ports are not available: 5173 / 4000 / 8000` | Another process is already running on port 5173, 4000, or 8000 | Find and terminate the conflicting process (e.g., `Get-Process -Id (Get-NetTCPConnection -LocalPort 5173).OwningProcess \| Stop-Process` on Windows) or adjust ports in `compose.yaml`. |
| `API container is unhealthy` | SQLite database lock or volume mount issue | Run `docker compose logs api` to inspect initialization errors. Check that `./storage` folder exists on the host. |
| `AI Service is unhealthy` | Python initialization failure or FFmpeg missing | Run `docker compose logs ai-service`. Verify that Docker Desktop has adequate CPU/RAM allocated. |
| `Network error when calling AI service from Node` | Node API attempting to connect to `localhost:8000` instead of `ai-service:8000` | Ensure `AI_SERVICE_URL=http://ai-service:8000` is set in the environment or `compose.yaml`. |
| `Upload size exceeded` | Nginx or Multer upload limit triggered | Nginx is configured for `client_max_body_size 100M;` and API `MAX_FILE_SIZE_MB=100`. Increase `MAX_FILE_SIZE_MB` in `compose.yaml` if larger files are required. |

---

## Alternative: Local Development Setup (Without Docker)

For developers actively modifying code on the host machine without Docker:

### 1. Prerequisites
- Node.js (v18+) & npm
- Python (v3.10+)
- FFmpeg (verified in system PATH)

### 2. Dependency Installation
```bash
cp .env.example .env

# Set up Python virtual environment
python -m venv backend/ai-service/.venv
backend\ai-service\.venv\Scripts\pip install -r backend/ai-service/requirements.txt

# Install Node API dependencies
cd backend/api && npm install && cd ../..

# Install Frontend dependencies
cd frontend && npm install && cd ..
```

### 3. Run Automated Tests on Host
```bash
npm run test:all
```
- **Python AI Service**: 19/19 tests passing (`pytest`)
- **Node.js Express API**: 13/13 tests passing (`vitest`)
- **React Frontend**: 6/6 tests passing (`vitest`)

### 4. Launch Services Locally
```bash
# Terminal 1: Python AI Service (Port 8000)
npm run start:ai

# Terminal 2: Node.js Express API (Port 4000)
npm run start:api

# Terminal 3: React Frontend (Port 5173)
npm run start:ui
```

Visit **`http://localhost:5173`** in your browser.

---

## Documentation Index

- [Architecture & Design Details](docs/ARCHITECTURE.md)
- [REST API Contract Specification](docs/API_SPECIFICATION.md)
- [Setup & Run Guide](docs/SETUP_AND_RUN.md)
- [Evaluation Rubric & Weights](docs/EVALUATION_RUBRIC.md)
- [AI Providers & GPU Acceleration Guide](docs/GPU_AND_AI_PROVIDERS.md)
- [Hackathon Demo Walkthrough Script](docs/DEMO_WORKFLOW.md)
- [Implementation Progress Log](IMPLEMENTATION_LOG.md)

---

## License & Usage

Developed for the Fast & Curious Hackathon. Free for prototype and educational evaluation.
