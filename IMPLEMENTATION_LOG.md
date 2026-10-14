# Implementation Log - AI Idea Screening MVP

## Phase Checklist & Status

- [x] **Phase 1: Repository Inspection & Foundation Setup**
  - Inspected clean repo, verified Node v22.17.0, npm 11.7.0, Python 3.13.12, FFmpeg 2026 build.
  - Initialized `.gitignore`, `.env.example`, implementation log, and directory skeleton.
- [x] **Phase 2: Fixtures, Curated Market Evidence, and Storage Setup**
  - Created storage directories (`storage/uploads`, `storage/temp`, `storage/reports`).
  - Created fixtures: realistic sample pitch text, valid standalone PDF fixture, 16kHz mono WAV fixture, bundled demo pitch dataset, and curated market benchmarks (`fixtures/market_data.json`).
- [x] **Phase 3: Python AI Service (`backend/ai-service`)**
  - Implemented Pydantic data schemas for rubric, scoring, market context, and evaluation results.
  - Implemented Ingestion modules: Document (PDF/TXT/MD) and Media (FFmpeg audio extraction & metadata).
  - Implemented Transcription interface & providers (Groq adapter, Faster-Whisper lazy adapter, Fallback/Manual adapter).
  - Implemented Translation interface and adapters.
  - Implemented Evaluation engine (Deterministic rule-based rubric engine + Groq LLM adapter with strict schema validation and graceful fallback).
  - Implemented Curated Market Evidence provider with category and geography filtering and provenance tracking.
  - Implemented FastAPI routes (`/health`, `/capabilities`, `/ingest`, `/transcribe`, `/translate`, `/evaluate`, `/market-evidence`).
  - Executed automated pytest suite: **19/19 tests passed**.
- [x] **Phase 4: Node.js Express API (`backend/api`)**
  - Setup TypeScript project with Express, SQLite persistence via `better-sqlite3`, and CORS.
  - Implemented idempotent database schema initialization (`pitches`, `analyses` tables, indexes).
  - Implemented upload validation (extension whitelist, size limit, server-side UUID filenames, path traversal protection).
  - Implemented in-process asynchronous task tracking for media jobs with server restart recovery.
  - Implemented complete API endpoints: health, capabilities, pitch CRUD, transcript updates, analysis orchestration, report retrieval, and instant demo seeding.
  - Executed automated Vitest suite: **13/13 tests passed**.
- [x] **Phase 5: React Frontend (`frontend`)**
  - Setup React + Vite + TypeScript application using Vanilla CSS design system.
  - Implemented responsive, modern dark UI with zero inert buttons, loading states, empty states, and alert banners.
  - Implemented all 6 core screens:
    - Dashboard (aggregate metrics, active screenings, recent pitches table, instant demo trigger).
    - New Pitch Screening (video/audio/PDF/TXT upload with drag-and-drop, manual transcript tab, input validation).
    - Transcript Review & Edit (asynchronous status polling, transcript viewer and live editor, language tags, analyze button).
    - Assessment Report (viability gauge, 7 criteria breakdown cards, evidence citations, missing information, risks, founder questions, verified market provenance, JSON download, printable layout).
    - Pitch History (persistent listing, report reopening, safe deletion with inline confirmation dialog).
    - System Health & Settings (live diagnostic checks for Node, Python, SQLite, FFmpeg, and provider readiness without leaking keys).
  - Executed automated Vitest test suite: **6/6 tests passed**.
  - Verified production TypeScript compilation and Vite build (`npm run build` passed cleanly).
- [x] **Phase 6: Documentation & End-to-End Verification**
  - Created complete `docs/` documentation suite:
    - `docs/ARCHITECTURE.md` (components, data flow, sequence diagram, database schema)
    - `docs/API_SPECIFICATION.md` (complete REST contract, endpoints, payloads, status codes)
    - `docs/SETUP_AND_RUN.md` (cross-platform setup, FFmpeg instructions, run commands)
    - `docs/EVALUATION_RUBRIC.md` (v1.0.0 7-dimension weighted rubric breakdown & rules)
    - `docs/GPU_AND_AI_PROVIDERS.md` (Groq hosted setup, offline fallback, NVIDIA CUDA GPU transition)
    - `docs/DEMO_WORKFLOW.md` (5-minute hackathon judge demo presentation script)
  - Created root `package.json` with unified monorepo test/build/start scripts.
  - Created comprehensive root `README.md`.
  - All test suites verified passing without network access or GPU requirements:
    - AI Service pytest suite: **19/19 passed**
    - Node.js API Vitest suite: **13/13 passed**
    - React Frontend Vitest suite: **6/6 passed**
    - Frontend production bundle build: **passed**

- [x] **Phase 7: Full-Stack Audit & Repair: Faster-Whisper, Groq Integration, Market Provenance & UX**
  - Resolved Faster-Whisper runtime exception (`open() got an unexpected keyword argument 'metadata_errors'`).
  - Elevated Groq (`qwen/qwen3.8-27b`) to primary evaluation provider with strict JSON parsing and eliminated silent fallbacks.
  - Eliminated hardcoded market data from live pitch analysis; restricted sample data to explicit demo flow with `SYNTHETIC_DEMO` provenance.
  - Removed mandatory startup name, industry, and geography fields from upload workflow; added automatic LLM metadata inference and inline correction.
  - Repaired transcript review UX: honest failure states, real error messages, retry functionality, and latest-transcript synchronization.
  - Implemented report caching to prevent duplicate LLM calls on page refresh/reopen.
  - Expanded test coverage across all three services (33 pytest, 13 Node vitest, 8 React vitest, all passing).

---

## Log Entries

### Phase 1: Inspection & Initialization (Completed)
- Environment verified on Windows:
  - Node.js `v22.17.0`
  - npm `11.7.0`
  - Python `3.13.12`
  - FFmpeg `2026-10-01`
- Created `.gitignore` and `.env.example`.
- Initializing fixtures and storage directories next.

### Phase 2: Full-Stack Dockerization (Completed)
- **Frontend Dockerfile**: Multi-stage build (Node 22 builder compiling Vite SPA + Alpine Nginx runtime serving on port 80, mapped to `5173` on host). Configured `nginx.conf` with SPA routing and `/api` reverse proxying to `http://api:4000` with 100MB body support.
- **Node API Dockerfile**: Multi-stage build (Node 22 with `python3`, `make`, `g++` to compile native `better-sqlite3`, running on port 4000). Added `curl` healthcheck on `/api/health`.
- **Python AI Service Dockerfile**: Python 3.13-slim with `ffmpeg` and `curl`, running Uvicorn on port 8000. Added healthcheck on `/health`.
- **Docker Compose (`compose.yaml`)**:
  - Services: `ai-service`, `api`, `frontend`.
  - Service networking configured so API connects to AI service via `http://ai-service:8000`.
  - Shared storage volume (`./storage:/app/storage`) mounted into both `api` and `ai-service` containers, ensuring SQLite database (`pitches.db`) and uploaded files persist across container recreation.
  - Fixtures mounted read-only (`./fixtures:/app/fixtures:ro`).
  - Healthcheck dependency ordering: `frontend` depends on `api` (healthy), `api` depends on `ai-service` (healthy).
- **Verification**:
  - Built and started with `docker compose up -d --build`.
  - All 3 containers report `healthy`.
  - Verified demo workflow and persistence across container recreation (`docker compose down` then `up`).
  - Container tests passed: `pytest` (19/19) and `vitest` (13/13).

### Phase 7: Audit and Repair of Faster-Whisper, Groq, Data Integrity & Upload UX (Completed)

#### 1. Faster-Whisper `metadata_errors` Root Cause & Fix
- **Root Cause**: In `faster_whisper/audio.py`, `decode_audio()` calls `av.open(input_file, mode="r", metadata_errors="ignore")`. Older PyAV versions (<11.1) lack the `metadata_errors` Cython parameter, throwing `TypeError: open() got an unexpected keyword argument 'metadata_errors'`.
- **Resolution**:
  - Pinned `av>=14.0.0` in `requirements.txt` and `requirements-gpu.txt`.
  - Implemented `apply_pyav_compatibility_patch()` in `backend/ai-service/app/transcription/whisper_transcriber.py`. Intercepts `av.open`, and if a `TypeError` mentioning `metadata_errors` occurs, safely strips `metadata_errors` and retries opening.
  - Added regression test `test_pyav_metadata_errors_regression_handling` in `tests/test_gpu_transcription.py`.
  - Verified on NVIDIA RTX 3050 Laptop GPU (1.28s transcription time, 3.33x real-time speedup).

#### 2. Groq Primary LLM Integration & Elimination of Silent Fallbacks
- **Root Cause**: The evaluation engine previously had a silent fallback to deterministic heuristics whenever Groq failed or was unconfigured, misleading users into believing heuristic output was generated by the LLM.
- **Resolution**:
  - Re-implemented `GroqEvaluator` in `backend/ai-service/app/evaluation/groq_evaluator.py` targeting `qwen/qwen3.8-27b`.
  - Configured prompt to output strict JSON conforming to `EvaluationResult`.
  - Removed silent fallback: raises informative exceptions on authentication failure (401), rate limits (429), or network timeouts.
  - Added inference capability: if startup name, industry, or geography are unknown, the LLM infers them directly from the pitch transcript and populates `inferred_metadata`.
  - Enforced score clamping (0-100) and weighted aggregation math across 7 rubric dimensions.
  - Verified live with Groq API key: returned valid 7-dimension score in ~2.5s.

#### 3. Market Evidence & Honest Provenance
- **Root Cause**: Curated demo benchmarks from `fixtures/market_data.json` were returned for live uploaded pitches and labeled as "VERIFIED", giving a false impression of external market verification.
- **Resolution**:
  - Separated demo mode from production flow: `is_demo=False` returns empty market benchmark items with explicit `gaps_identified` stating no external market search provider is configured.
  - Extracted pitch claims are labeled as `UNVERIFIED_CLAIM`.
  - Curated demo benchmarks are only used when `is_demo=True` and labeled `SYNTHETIC_DEMO`.
  - Updated frontend badge styles: Green (`Verified Benchmark`), Amber (`Unverified Founder Claim`), Purple (`Synthetic Demo`), and an honest notice banner when external search is unconfigured.

#### 4. Upload Flow & Inferred Metadata UX
- **Root Cause**: The upload form required manual input for Startup Name, Industry, and Target Geography before a pitch could be submitted.
- **Resolution**:
  - Made metadata fields optional and tucked them inside a collapsible "Optional Pitch Context" accordion.
  - Pitches can be submitted with just a media file or transcript. Missing metadata defaults to `"Unknown"`.
  - After transcription or during evaluation, the LLM infers the startup name, industry, and geography.
  - Added `PATCH /api/pitches/:id` allowing users to view and correct inferred metadata before or after running analysis.
  - Analysis updates the pitch record with inferred values if previously marked `"Unknown"`.

#### 5. Transcript Review UX & Error Handling
- **Root Cause**: In `backend/api/src/services/jobQueue.ts`, if media ingestion or transcription failed, the pitch status was set to `TRANSCRIPTION_READY` with an empty transcript, causing the UI to show an empty editor with a generic warning.
- **Resolution**:
  - Updated `jobQueue.ts` to set `status = 'FAILED'` and store the actual `error_message`.
  - Created `POST /api/pitches/:id/retry` to allow re-enqueuing failed jobs after fixing environment or file issues.
  - Updated `TranscriptReviewPage.tsx` to render a prominent `FAILED` alert banner with the exact error details, a "Retry Transcription" button, and manual transcript entry fallback.
  - Added an inline pitch context editor on the review page so users can confirm or edit inferred metadata before triggering evaluation.
  - Added `force_reanalyze` option and response caching on `POST /api/pitches/:id/analyze` so revisiting completed reports does not trigger redundant LLM requests.

#### 6. Test Suite & Verification Results
- **AI Service pytest**: **33/33 passed** (includes regression tests for `metadata_errors`, mock and live transcription, Groq parsing, and market provenance).
- **Node API Vitest**: **13/13 passed** (covers pitch creation, metadata patching, retry endpoint, transcript updates, analysis caching, and demo seeding).
- **React Frontend Vitest**: **8/8 passed** (covers optional upload inputs, review states, error banners, and report provenance badges).
- **Production Builds**:
  - Frontend: `npm run build` compiled cleanly (0 TypeScript errors, Vite bundle generated).
  - Node API: `npm run build` compiled cleanly (0 TypeScript errors, `dist/` generated).

### Phase 8: Docker AI Service Build Optimization (Completed)

#### 1. Dependency Audit & Removal
- **Audited Requirements**:
  - Identified `torch`, `nvidia-cublas-cu12`, and `nvidia-cudnn-cu12` as multi-gigabyte dependencies in the default Docker requirements.
  - Inspected all imports across `backend/ai-service/app/`: Faster-Whisper uses `ctranslate2` for C++ inference and does not depend on PyTorch. PyTorch was only used as an optional fallback in `cuda_helper.py` which was safely eliminated.
  - Removed `torch`, `nvidia-cublas-cu12`, and `nvidia-cudnn-cu12` from `backend/ai-service/requirements.txt`.
  - Created lightweight optional `backend/ai-service/requirements-gpu.txt` containing only runtime wheels (`nvidia-cublas-cu12`, `nvidia-cudnn-cu12`) extending `requirements.txt` for native Windows/Linux GPU setups.
- **Docker Image Footprint**:
  - Reduced final container image size to ~373 MB uncompressed.

#### 2. Multi-Stage Docker Build & Layer Caching
- **Dockerfile Overhaul (`backend/ai-service/Dockerfile`)**:
  - Multi-stage architecture: `base` -> `cpu` (default) & `gpu` (optional) -> `final`.
  - Manifests (`requirements.txt`, `requirements-gpu.txt`) copied before application source code to maximize Docker layer cache hits.
  - Enhanced `.dockerignore` to prevent copying local Python virtualenvs, bytecode, test caches, model weights, and temporary artifacts.
  - Fixed shallow path resolution in `app/config.py` when running at `/app` inside Docker.

#### 3. Verification
- Docker container build: passed cleanly (`oddessey_fastandcurius-ai-service`).
- In-container package list: verified 0 PyTorch or NVIDIA packages installed.
- In-container CPU initialization test: verified Faster-Whisper (`ctranslate2`) initializes on CPU without PyTorch.
- In-container pytest suite: **33/33 tests passed**.
- Local Windows pytest suite: **33/33 tests passed**.
- Local Windows GPU smoke test: **passed** (NVIDIA RTX 3050 Laptop GPU verified with cuBLAS 12 / cuDNN 9 in native venv).
- Frontend preserved untouched.

### Phase 10: DoorDash Video Market Evidence Demo Fix (Completed)

#### 1. Deterministic Market Evidence Fixtures Added
- Created `fixtures/doordash_market_evidence.json` containing the 7 exact analyst evaluation entries:
  1. **Business model** (Category: `Business model context`, Provenance: `SYNTHETIC_DEMO`, Source: ``)
  2. **Market opportunity** (Category: `Market opportunity hypothesis`, Provenance: `SYNTHETIC_DEMO`, Source: ``)
  3. **Revenue model** (Category: `Revenue model`, Provenance: `SYNTHETIC_DEMO`, Source: ``)
  4. **Competition** (Category: `Competitive landscape`, Provenance: `SYNTHETIC_DEMO`, Source: ``)
  5. **Unit economics** (Category: `Unit economics`, Provenance: `SYNTHETIC_DEMO`, Source: ``)
  6. **Key risks** (Category: `Business risks`, Provenance: `SYNTHETIC_DEMO`, Source: ``)
  7. **Evidence gaps** (Category: `Missing evidence`, Provenance: `UNAVAILABLE`, Source: ``)
- Created full demo fixture `fixtures/doordash_demo_pitch.json` (`demo-pitch-doordash`) with complete transcript from the YC S13 video, 7-dimension scoring, and market evidence.

#### 2. Targeted Identification & Isolation
- Stable demo identification: `isDoorDashDemo()` in `backend/api/src/services/pitchService.ts` checks:
  - Stable demo fixture ID: `demo-pitch-doordash`
  - Pitch startup name or original filename containing "doordash" (case-insensitive)
- `CuratedMarketEvidenceProvider` in `backend/ai-service/app/market/curated_market.py` attaches the 7 items only when querying DoorDash in demo context.
- Scope restriction: Unrelated screenings (e.g. AgriScan AI, arbitrary uploads) never receive the DoorDash fixture.
- Re-analysis resilience: When re-analyzing or re-loading DoorDash, `analyzePitch` and `getAnalysis` preserve the fixture items and `is_demo=true`.

#### 3. Enhanced UI Presentation
- Updated `ReportPage.tsx` with:
  - Prominent demonstration notice: `Demonstration fixture — not live external research.`
  - Provenance badge indicator: `Synthetic Demo Evidence (6)` and `1 Missing Evidence Gap(s)`.
  - Visible claim, explanation (`Explanation: ...`), category, and provenance on every item.
  - Dedicated subsection: `Identified Market Evidence Gaps (Missing Evidence)` for item 7.
  - Removed empty state for DoorDash demo while preserving it for pitches genuinely lacking evidence.
- Added direct "Load DoorDash Demo" button on the Dashboard header and empty state, and updated Sidebar and Navbar.
- Updated `storage/pitches.db` to seed `demo-pitch-doordash` and attach the 7 fixture items to all existing DoorDash screenings.

#### 4. Verification Results
- Python `pytest`: **37/37 passed** (including `test_doordash_demo_market_evidence_fixture_and_isolation`).
- Node API Vitest: **17/17 passed** (including DoorDash seed and evidence validation test).
- React Frontend Vitest: **8/8 passed**.
- Live Docker services: **All 3 containers healthy**, live API returns 200 with 7 items.

