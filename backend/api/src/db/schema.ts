export const INIT_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS pitches (
  id TEXT PRIMARY KEY,
  startup_name TEXT,
  target_geography TEXT,
  industry TEXT,
  original_filename TEXT,
  input_type TEXT NOT NULL,
  mime_type TEXT,
  stored_file_path TEXT,
  file_size INTEGER DEFAULT 0,
  status TEXT NOT NULL,
  original_transcript TEXT,
  normalized_transcript TEXT,
  detected_language TEXT,
  error_message TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS analyses (
  id TEXT PRIMARY KEY,
  pitch_id TEXT NOT NULL,
  rubric_version TEXT NOT NULL,
  evaluation_provider TEXT NOT NULL,
  evaluation_method TEXT NOT NULL,
  overall_score REAL NOT NULL,
  criteria_scores_json TEXT NOT NULL,
  strengths_json TEXT NOT NULL,
  risks_json TEXT NOT NULL,
  assumptions_json TEXT NOT NULL,
  missing_information_json TEXT NOT NULL,
  founder_questions_json TEXT NOT NULL,
  market_evidence_json TEXT NOT NULL,
  confidence_score REAL NOT NULL,
  confidence_limitations TEXT NOT NULL,
  is_demo INTEGER DEFAULT 0,
  created_at TEXT NOT NULL,
  FOREIGN KEY (pitch_id) REFERENCES pitches(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_pitches_status ON pitches(status);
CREATE INDEX IF NOT EXISTS idx_pitches_created_at ON pitches(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analyses_pitch_id ON analyses(pitch_id);
`;
