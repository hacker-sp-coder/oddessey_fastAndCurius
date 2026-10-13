# API Specification Contract

This document specifies the REST HTTP endpoints exposed by the **Node.js Express API** and the internal **Python FastAPI AI Service**.

---

## 1. Node.js Express API (`http://localhost:4000/api`)

### 1.1 `GET /api/health`
Checks health of the API server, database connection, and AI service bridge.
- **Response (200 OK):**
```json
{
  "status": "ok",
  "service": "api-server",
  "node_version": "v22.17.0",
  "database": {
    "driver": "better-sqlite3",
    "status": "ok"
  },
  "ai_service": {
    "status": "ok",
    "service": "ai-service",
    "version": "1.0.0",
    "ffmpeg_available": true
  }
}
```

### 1.2 `GET /api/health/capabilities`
Returns host environment limits, storage configuration, and model engine capabilities without leaking secrets.
- **Response (200 OK):**
```json
{
  "api_server": {
    "max_upload_size_mb": 100,
    "database": "better-sqlite3 (WAL mode)",
    "supported_inputs": ["VIDEO", "AUDIO", "PDF", "TEXT", "MANUAL"]
  },
  "ai_service": {
    "ffmpeg_available": true,
    "ffmpeg_version": "ffmpeg version 2026-10-01...",
    "cuda_available": false,
    "transcription_providers": [...],
    "evaluation_providers": [...],
    "active_transcription_provider": "fallback",
    "active_evaluation_provider": "deterministic"
  }
}
```

### 1.3 `GET /api/pitches`
Returns an array of all ingested pitches ordered by `created_at DESC`.
- **Response (200 OK):**
```json
{
  "pitches": [
    {
      "id": "78b27f42-...",
      "startup_name": "AgriScan AI",
      "target_geography": "South Asia",
      "industry": "Agriculture",
      "original_filename": "pitch.txt",
      "input_type": "TEXT",
      "mime_type": "text/plain",
      "stored_file_path": ".../storage/uploads/upload_78b27f42.txt",
      "file_size": 1420,
      "status": "COMPLETED",
      "original_transcript": "...",
      "normalized_transcript": "...",
      "detected_language": "en",
      "error_message": null,
      "created_at": "2026-10-13T09:00:00.000Z",
      "updated_at": "2026-10-13T09:02:30.000Z"
    }
  ]
}
```

### 1.4 `POST /api/pitches`
Accepts either a multipart file upload (`multipart/form-data`) or a manual transcript JSON body.
- **Multipart Form Data Fields:**
  - `file`: Media or document file (MP4, MOV, WEBM, WAV, MP3, PDF, TXT, MD)
  - `startup_name` (optional): String
  - `target_geography` (optional): String
  - `industry` (optional): String
- **JSON Body (Manual Mode):**
```json
{
  "startup_name": "MedAI",
  "target_geography": "North America",
  "industry": "Healthcare",
  "manual_transcript": "MedAI provides automated triage..."
}
```
- **Response (201 Created):** `{ "pitch": PitchRecord }`
- **Error Responses:**
  - `400 Bad Request`: Unsupported file extension, file size > 100MB, or empty payload.

### 1.5 `GET /api/pitches/:id`
Retrieves a single pitch record and its processing status.
- **Response (200 OK):** `{ "pitch": PitchRecord }`
- **Error (404 Not Found):** `{ "error": "Pitch not found" }`

### 1.6 `POST /api/pitches/:id/transcript`
Allows the user to supply or revise the pitch transcript before running analysis.
- **Request Body:**
```json
{
  "transcript": "Updated transcript narrative with timestamps..."
}
```
- **Response (200 OK):** `{ "pitch": PitchRecord }`

### 1.7 `POST /api/pitches/:id/analyze`
Triggers viability analysis on the saved transcript.
- **Request Body (optional):**
```json
{
  "provider_override": "deterministic"
}
```
- **Response (200 OK):** `{ "analysis": AnalysisRecord }`
- **Error (400 Bad Request):** `{ "error": "Cannot analyze pitch without a valid transcript." }`

### 1.8 `GET /api/pitches/:id/report`
Retrieves the pitch record paired with its completed analysis record.
- **Response (200 OK):**
```json
{
  "pitch": PitchRecord,
  "analysis": AnalysisRecord
}
```

### 1.9 `DELETE /api/pitches/:id`
Deletes a pitch record, its analysis record, and unlinks the uploaded file from disk.
- **Response (200 OK):** `{ "success": true, "message": "Pitch and associated files deleted successfully." }`

### 1.10 `POST /api/pitches/demo`
Seeds the bundled `fixtures/demo_pitch.json` fixture into the database and returns the completed report immediately.
- **Response (200 OK):** `{ "pitch": PitchRecord, "analysis": AnalysisRecord }`

---

## 2. Python FastAPI AI Service (`http://127.0.0.1:8000`)

### 2.1 `GET /health`
Returns service status and FFmpeg installation flag.
- **Response (200 OK):** `{ "status": "ok", "service": "ai-service", "version": "1.0.0", "ffmpeg_available": true }`

### 2.2 `GET /capabilities`
Returns comprehensive hardware diagnostics (CUDA, compute type, Whisper availability, Groq availability).

### 2.3 `POST /ingest`
Extracts text from PDF/TXT or extracts 16kHz mono audio from video/audio via FFmpeg.
- **Request Body:**
```json
{
  "file_path": "C:/storage/uploads/video.mp4",
  "input_type": "VIDEO"
}
```
- **Response (200 OK):**
```json
{
  "success": true,
  "input_type": "VIDEO",
  "extracted_audio_path": "C:/storage/temp/extracted_8f1a2b.wav",
  "duration_seconds": 134.2
}
```

### 2.4 `POST /transcribe`
Transcribes audio using the selected provider (`groq`, `faster-whisper`, or `fallback`).
- **Request Body:** `{ "audio_path": "...", "provider_override": "fallback" }`
- **Response (200 OK):**
```json
{
  "success": true,
  "transcript": "[00:00] AgriScan AI...",
  "detected_language": "en",
  "duration_seconds": 134.2,
  "provider_used": "groq",
  "segments": [{ "start": 0.0, "end": 4.5, "text": "AgriScan AI..." }]
}
```

### 2.5 `POST /evaluate`
Evaluates viability against the versioned 7-dimension rubric and merges market evidence.
- **Request Body:**
```json
{
  "transcript": "...",
  "startup_name": "AgriScan AI",
  "target_geography": "South Asia",
  "industry": "Agriculture"
}
```
- **Response (200 OK):** Validated `EvaluationResult` JSON.

### 2.6 `POST /market-evidence`
Searches curated market benchmarks and identifies evidence gaps.
- **Request Body:** `{ "category": "Agriculture", "geography": "South Asia" }`
- **Response (200 OK):**
```json
{
  "items": [
    {
      "id": "mkt-agri-002",
      "category": "Agriculture",
      "geography": "South Asia",
      "claim": "Smallholder farmers account for over 80%...",
      "source_title": "FAO & World Bank South Asia Agritech Diagnostic Report",
      "source_url": "https://www.fao.org/publications/agritech-south-asia",
      "verification_status": "VERIFIED"
    }
  ],
  "gaps_identified": []
}
```
