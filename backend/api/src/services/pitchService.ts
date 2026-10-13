import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { getDatabase } from '../db/database.js';
import { config } from '../config.js';
import { aiServiceClient } from './aiServiceClient.js';
import { jobQueue } from './jobQueue.js';
import { InputType, PitchRecord, AnalysisRecord, PitchWithAnalysis } from '../types/index.js';

export class PitchService {
  createPitch(params: {
    startupName?: string;
    targetGeography?: string;
    industry?: string;
    originalFilename: string;
    inputType: InputType;
    mimeType: string;
    storedFilePath?: string | null;
    fileSize: number;
    manualTranscript?: string;
  }): PitchRecord {
    const db = getDatabase();
    const id = uuidv4();
    const now = new Date().toISOString();

    const initialStatus = params.inputType === 'MANUAL' ? 'TRANSCRIPTION_READY' : 'QUEUED';
    const transcript = params.manualTranscript ? params.manualTranscript.trim() : null;

    db.prepare(`
      INSERT INTO pitches (
        id, startup_name, target_geography, industry, original_filename,
        input_type, mime_type, stored_file_path, file_size, status,
        original_transcript, normalized_transcript, detected_language,
        error_message, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      params.startupName?.trim() || 'Untitled Startup',
      params.targetGeography?.trim() || 'Global',
      params.industry?.trim() || 'General Tech',
      params.originalFilename,
      params.inputType,
      params.mimeType,
      params.storedFilePath || null,
      params.fileSize,
      initialStatus,
      transcript,
      transcript,
      'en',
      null,
      now,
      now
    );

    // If media or doc needs ingestion/transcription
    if (params.inputType !== 'MANUAL') {
      jobQueue.enqueueIngestionTask(id);
    }

    return this.getPitch(id)!;
  }

  getPitch(id: string): PitchRecord | null {
    const db = getDatabase();
    const row = db.prepare('SELECT * FROM pitches WHERE id = ?').get(id) as PitchRecord | undefined;
    return row || null;
  }

  listPitches(): PitchRecord[] {
    const db = getDatabase();
    return db.prepare('SELECT * FROM pitches ORDER BY created_at DESC').all() as PitchRecord[];
  }

  updateTranscript(id: string, transcriptText: string): PitchRecord {
    const db = getDatabase();
    const pitch = this.getPitch(id);
    if (!pitch) throw new Error('Pitch not found');

    const cleanText = transcriptText.trim();
    const now = new Date().toISOString();

    db.prepare(`
      UPDATE pitches 
      SET original_transcript = ?, 
          normalized_transcript = ?, 
          status = 'TRANSCRIPTION_READY', 
          error_message = NULL,
          updated_at = ? 
      WHERE id = ?
    `).run(cleanText, cleanText, now, id);

    return this.getPitch(id)!;
  }

  async analyzePitch(id: string, providerOverride?: string): Promise<AnalysisRecord> {
    const db = getDatabase();
    const pitch = this.getPitch(id);
    if (!pitch) throw new Error('Pitch not found');

    const transcript = pitch.normalized_transcript || pitch.original_transcript;
    if (!transcript || !transcript.trim()) {
      throw new Error('Cannot analyze pitch without a valid transcript. Please supply a transcript first.');
    }

    const now = new Date().toISOString();
    // Update pitch status to ANALYZING
    db.prepare("UPDATE pitches SET status = 'ANALYZING', updated_at = ? WHERE id = ?").run(now, id);

    try {
      const evalResult = await aiServiceClient.evaluate({
        transcript,
        startupName: pitch.startup_name,
        targetGeography: pitch.target_geography,
        industry: pitch.industry,
        providerOverride
      });

      const analysisId = uuidv4();

      // Upsert analysis (delete previous if retry)
      db.prepare('DELETE FROM analyses WHERE pitch_id = ?').run(id);

      db.prepare(`
        INSERT INTO analyses (
          id, pitch_id, rubric_version, evaluation_provider, evaluation_method,
          overall_score, criteria_scores_json, strengths_json, risks_json,
          assumptions_json, missing_information_json, founder_questions_json,
          market_evidence_json, confidence_score, confidence_limitations,
          is_demo, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        analysisId,
        id,
        evalResult.rubric_version,
        evalResult.evaluation_provider,
        evalResult.evaluation_method,
        evalResult.overall_score,
        JSON.stringify(evalResult.criteria_scores),
        JSON.stringify(evalResult.strengths),
        JSON.stringify(evalResult.risks),
        JSON.stringify(evalResult.assumptions),
        JSON.stringify(evalResult.missing_information),
        JSON.stringify(evalResult.founder_questions),
        JSON.stringify(evalResult.market_evidence),
        evalResult.confidence_score,
        evalResult.confidence_limitations,
        evalResult.is_demo ? 1 : 0,
        evalResult.created_at || now
      );

      // Update pitch status to COMPLETED
      db.prepare("UPDATE pitches SET status = 'COMPLETED', updated_at = ? WHERE id = ?").run(
        new Date().toISOString(),
        id
      );

      return this.getAnalysis(id)!;
    } catch (err: any) {
      db.prepare(
        "UPDATE pitches SET status = 'FAILED', error_message = ?, updated_at = ? WHERE id = ?"
      ).run(`Analysis error: ${err.message}`, new Date().toISOString(), id);
      throw err;
    }
  }

  getAnalysis(pitchId: string): AnalysisRecord | null {
    const db = getDatabase();
    const row = db.prepare('SELECT * FROM analyses WHERE pitch_id = ?').get(pitchId) as any;
    if (!row) return null;

    return {
      id: row.id,
      pitch_id: row.pitch_id,
      rubric_version: row.rubric_version,
      evaluation_provider: row.evaluation_provider,
      evaluation_method: row.evaluation_method,
      overall_score: row.overall_score,
      criteria_scores: JSON.parse(row.criteria_scores_json),
      strengths: JSON.parse(row.strengths_json),
      risks: JSON.parse(row.risks_json),
      assumptions: JSON.parse(row.assumptions_json),
      missing_information: JSON.parse(row.missing_information_json),
      founder_questions: JSON.parse(row.founder_questions_json),
      market_evidence: JSON.parse(row.market_evidence_json),
      confidence_score: row.confidence_score,
      confidence_limitations: row.confidence_limitations,
      is_demo: Boolean(row.is_demo),
      created_at: row.created_at
    };
  }

  getPitchReport(id: string): PitchWithAnalysis | null {
    const pitch = this.getPitch(id);
    if (!pitch) return null;
    const analysis = this.getAnalysis(id);
    return { pitch, analysis };
  }

  deletePitch(id: string): boolean {
    const db = getDatabase();
    const pitch = this.getPitch(id);
    if (!pitch) return false;

    // Delete associated physical file safely
    if (pitch.stored_file_path && fs.existsSync(pitch.stored_file_path)) {
      try {
        fs.unlinkSync(pitch.stored_file_path);
      } catch (err) {
        console.warn(`Failed to unlink file ${pitch.stored_file_path}:`, err);
      }
    }

    db.prepare('DELETE FROM analyses WHERE pitch_id = ?').run(id);
    const res = db.prepare('DELETE FROM pitches WHERE id = ?').run(id);
    return res.changes > 0;
  }

  seedDemoPitch(): PitchWithAnalysis {
    const db = getDatabase();
    const demoId = 'demo-pitch-agriscan';

    // If already exists, return report
    const existing = this.getPitchReport(demoId);
    if (existing && existing.analysis) {
      return existing;
    }

    const demoJsonPath = path.join(config.fixturesDir, 'demo_pitch.json');
    if (!fs.existsSync(demoJsonPath)) {
      throw new Error(`Demo fixture not found at ${demoJsonPath}`);
    }

    const data = JSON.parse(fs.readFileSync(demoJsonPath, 'utf-8'));
    const p = data.pitch;
    const a = data.analysis;

    // Remove any stale demo entries
    db.prepare('DELETE FROM analyses WHERE pitch_id = ?').run(demoId);
    db.prepare('DELETE FROM pitches WHERE id = ?').run(demoId);

    // Insert pitch
    db.prepare(`
      INSERT INTO pitches (
        id, startup_name, target_geography, industry, original_filename,
        input_type, mime_type, stored_file_path, file_size, status,
        original_transcript, normalized_transcript, detected_language,
        error_message, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      demoId,
      p.startup_name,
      p.target_geography,
      p.industry,
      p.original_filename,
      p.input_type,
      p.mime_type,
      null,
      p.file_size,
      p.status,
      p.original_transcript,
      p.normalized_transcript,
      p.detected_language,
      null,
      p.created_at,
      p.updated_at
    );

    // Insert analysis
    db.prepare(`
      INSERT INTO analyses (
        id, pitch_id, rubric_version, evaluation_provider, evaluation_method,
        overall_score, criteria_scores_json, strengths_json, risks_json,
        assumptions_json, missing_information_json, founder_questions_json,
        market_evidence_json, confidence_score, confidence_limitations,
        is_demo, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      a.id,
      demoId,
      a.rubric_version,
      a.evaluation_provider,
      a.evaluation_method,
      a.overall_score,
      JSON.stringify(a.criteria_scores),
      JSON.stringify(a.strengths),
      JSON.stringify(a.risks),
      JSON.stringify(a.assumptions),
      JSON.stringify(a.missing_information),
      JSON.stringify(a.founder_questions),
      JSON.stringify(a.market_evidence),
      a.confidence_score,
      a.confidence_limitations,
      1,
      a.created_at
    );

    return this.getPitchReport(demoId)!;
  }
}

export const pitchService = new PitchService();
