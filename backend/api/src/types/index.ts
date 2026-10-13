export type PitchStatus = 
  | 'QUEUED' 
  | 'PROCESSING' 
  | 'TRANSCRIPTION_READY' 
  | 'ANALYZING' 
  | 'COMPLETED' 
  | 'FAILED';

export type InputType = 'VIDEO' | 'AUDIO' | 'PDF' | 'TEXT' | 'MANUAL';

export interface PitchRecord {
  id: string;
  startup_name: string;
  target_geography: string;
  industry: string;
  original_filename: string;
  input_type: InputType;
  mime_type: string;
  stored_file_path: string | null;
  file_size: number;
  status: PitchStatus;
  original_transcript: string | null;
  normalized_transcript: string | null;
  detected_language: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export interface CriterionScore {
  name: string;
  score: number;
  weight: number;
  weighted_score: number;
  rationale: string;
  evidence: string[];
  missing_evidence: string;
}

export interface MarketEvidenceItem {
  id: string;
  category: string;
  geography: string;
  claim: string;
  source_title: string;
  source_url: string;
  publication_date?: string;
  retrieval_date?: string;
  verification_status: 'VERIFIED' | 'SYNTHETIC_DEMO';
  notes?: string;
}

export interface AnalysisRecord {
  id: string;
  pitch_id: string;
  rubric_version: string;
  evaluation_provider: string;
  evaluation_method: string;
  overall_score: number;
  criteria_scores: Record<string, CriterionScore>;
  strengths: string[];
  risks: string[];
  assumptions: string[];
  missing_information: string[];
  founder_questions: string[];
  market_evidence: MarketEvidenceItem[];
  confidence_score: number;
  confidence_limitations: string;
  is_demo: boolean;
  created_at: string;
}

export interface PitchWithAnalysis {
  pitch: PitchRecord;
  analysis: AnalysisRecord | null;
}
