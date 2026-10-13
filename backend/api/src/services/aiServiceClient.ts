import { config } from '../config.js';

export interface IngestResult {
  success: boolean;
  input_type: string;
  extracted_text?: string;
  extracted_audio_path?: string;
  duration_seconds?: number;
  detected_language?: string;
  error_message?: string;
}

export interface TranscribeResult {
  success: boolean;
  transcript: string;
  detected_language?: string;
  duration_seconds?: number;
  provider_used: string;
  segments: Array<{ start: number; end: number; text: string }>;
  error_message?: string;
}

export interface EvaluateResult {
  rubric_version: string;
  evaluation_provider: string;
  evaluation_method: string;
  overall_score: number;
  criteria_scores: Record<string, any>;
  strengths: string[];
  risks: string[];
  assumptions: string[];
  missing_information: string[];
  founder_questions: string[];
  market_evidence: any[];
  confidence_score: number;
  confidence_limitations: string;
  is_demo: boolean;
  created_at: string;
}

export class AiServiceClient {
  private baseUrl: string;

  constructor(baseUrl: string = config.aiServiceUrl) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }

  async getHealth(): Promise<{ status: string; service: string; version: string; ffmpeg_available: boolean } | null> {
    try {
      const res = await fetch(`${this.baseUrl}/health`, { signal: AbortSignal.timeout(4000) });
      if (!res.ok) return null;
      return (await res.json()) as any;
    } catch {
      return null;
    }
  }

  async getCapabilities(): Promise<any | null> {
    try {
      const res = await fetch(`${this.baseUrl}/capabilities`, { signal: AbortSignal.timeout(5000) });
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  }

  async ingest(params: {
    filePath?: string;
    inputType?: string;
    manualTranscript?: string;
  }): Promise<IngestResult> {
    try {
      const res = await fetch(`${this.baseUrl}/ingest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          file_path: params.filePath,
          input_type: params.inputType || 'AUTO',
          manual_transcript: params.manualTranscript
        }),
        signal: AbortSignal.timeout(120000)
      });

      if (!res.ok) {
        const errText = await res.text();
        return {
          success: false,
          input_type: params.inputType || 'UNKNOWN',
          error_message: `AI service ingest error (${res.status}): ${errText.slice(0, 300)}`
        };
      }

      return (await res.json()) as IngestResult;
    } catch (err: any) {
      return {
        success: false,
        input_type: params.inputType || 'UNKNOWN',
        error_message: `Failed to connect to AI service at ${this.baseUrl}: ${err.message}`
      };
    }
  }

  async transcribe(params: {
    audioPath: string;
    languageHint?: string;
    providerOverride?: string;
  }): Promise<TranscribeResult> {
    try {
      const res = await fetch(`${this.baseUrl}/transcribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          audio_path: params.audioPath,
          language_hint: params.languageHint,
          provider_override: params.providerOverride
        }),
        signal: AbortSignal.timeout(180000)
      });

      if (!res.ok) {
        const errText = await res.text();
        return {
          success: false,
          transcript: '',
          provider_used: params.providerOverride || 'unknown',
          segments: [],
          error_message: `Transcription service error (${res.status}): ${errText.slice(0, 300)}`
        };
      }

      return (await res.json()) as TranscribeResult;
    } catch (err: any) {
      return {
        success: false,
        transcript: '',
        provider_used: params.providerOverride || 'unknown',
        segments: [],
        error_message: `Transcription connection error: ${err.message}`
      };
    }
  }

  async evaluate(params: {
    transcript: string;
    startupName?: string;
    targetGeography?: string;
    industry?: string;
    providerOverride?: string;
  }): Promise<EvaluateResult> {
    const res = await fetch(`${this.baseUrl}/evaluate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        transcript: params.transcript,
        startup_name: params.startupName,
        target_geography: params.targetGeography,
        industry: params.industry,
        provider_override: params.providerOverride
      }),
      signal: AbortSignal.timeout(60000)
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`AI service evaluation error (${res.status}): ${errText.slice(0, 300)}`);
    }

    return (await res.json()) as EvaluateResult;
  }
}

export const aiServiceClient = new AiServiceClient();
