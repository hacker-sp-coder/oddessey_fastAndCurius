# Hackathon MVP Demo Workflow & Presentation Script

This document details the exact walk-through for demonstrating **ScreenAI** to judges or evaluators.

---

## 1. Demo Objectives

1. Demonstrate that ScreenAI works **end-to-end today** without GPU hardware or external AI API keys.
2. Show the difference between unverified pitch claims and third-party verified market benchmarks.
3. Show that the rubric is transparent, versioned, explainable, and includes transcript citations.
4. Demonstrate real file ingestion across PDF, plain text, and media uploads.

---

## 2. Step-by-Step Presentation Script (5-Minute Walkthrough)

### Step 1: Instant Demo Mode (The "Wow" Impression)
1. Open the web browser at **`http://localhost:5173`**.
2. Point out the clean startup screening dashboard with metric summaries.
3. Click the glowing **"Demo Pitch"** button in the top navigation bar.
4. **Judge Takeaway**: The system instantly renders a completed viability report for **AgriScan AI** (an agritech diagnostic tool for smallholders):
   - **Composite Score**: **82/100** (Strong Viability Signal).
   - **Explainability**: Expand any of the 7 criteria (e.g. *Problem Clarity: 90/100* or *Business Model: 80/100*). Show the verbatim transcript citations extracted with timestamps (`[00:08] Every year, over 120 million smallholder farmers...`).
   - **Evidence Gaps**: Point out that the system flags missing evidence (e.g. "Direct farmer willingness to pay if subsidies expire").
   - **Market Provenance**: Scroll to the Market Context section showing verified third-party benchmarks from the **FAO & World Bank** with direct links and publication dates. Show the green **VERIFIED** badge vs synthetic demonstration tags.
   - **Exporting**: Click **"Print Report"** to show the clean printable layout, or **"Export JSON"** to download the raw structured assessment.

### Step 2: Screen a Real File (PDF or Text Document)
1. Click **"New Pitch"** in the top navigation bar.
2. Enter:
   - **Startup Name**: AgriScan AI Deck
   - **Industry**: Agriculture
   - **Target Geography**: South Asia
3. Drag and drop the test fixture file **`fixtures/sample_pitch.pdf`** or **`fixtures/sample_pitch.txt`**.
4. Click **"Continue to Screening"**.
5. The system immediately parses the document via `pypdf` / text normalizer and opens the **Transcript Review** screen.
6. Make a quick text edit in the transcript editor (e.g. adding a custom sentence). Click **"Save Transcript Changes"**.
7. Click **"Run Viability Analysis"**.
8. In under 2 seconds, the deterministic heuristic rubric evaluates the narrative, merges market benchmarks, and presents the newly calculated report!

### Step 3: Audio/Video Media Ingestion & Offline Handling
1. Click **"New Pitch"**.
2. Select **`fixtures/sample_audio.wav`** (or any `.mp4`/`.wav` media file).
3. The server receives the file, assigns a server-side UUID, and triggers the in-process background job.
4. FFmpeg extracts the mono 16kHz audio stream.
5. In offline development mode (without Faster-Whisper or Groq configured), the system guides the user:
   - Sets status to **Transcript Ready** with an actionable banner: *"Automatic transcription is disabled or unconfigured in this mode. Audio extracted successfully. Please review and paste transcript below to proceed."*
   - Paste text or use sample transcript and proceed to evaluation.

### Step 4: History Management & File Deletion
1. Click **"History"** in the navigation bar.
2. Show all past screenings preserved in SQLite.
3. Click the delete icon (trash can) on any pitch.
4. Notice the inline **"Confirm"** safety dialog to prevent accidental deletion. Confirm deletion and verify that both the database record and physical uploaded file are removed.

### Step 5: System Health & Hardware Diagnostics
1. Click **"System Health"** in the top navigation bar.
2. Show live status indicators:
   - Node.js Express API: **Online**
   - SQLite Storage: **Connected (WAL Mode)**
   - Python AI Service: **Online (FastAPI)**
   - FFmpeg: **Available**
   - Active Evaluation Provider: **Deterministic (Offline Rubric)**
3. Point out that **zero secrets or API keys are exposed** in network responses, adhering to security best practices.
