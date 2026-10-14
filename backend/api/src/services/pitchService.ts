import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { getDatabase } from '../db/database.js';
import { config } from '../config.js';
import { aiServiceClient } from './aiServiceClient.js';
import { jobQueue } from './jobQueue.js';
import { InputType, PitchRecord, AnalysisRecord, PitchWithAnalysis, MarketEvidenceItem } from '../types/index.js';

export function isDoorDashDemo(pitch?: { id?: string; startup_name?: string | null; original_filename?: string | null } | null): boolean {
  if (!pitch) return false;
  if (pitch.id === 'demo-pitch-doordash') return true;
  const name = (pitch.startup_name || '').toLowerCase();
  const file = (pitch.original_filename || '').toLowerCase();
  return name.includes('doordash') || file.includes('doordash');
}

export function getDoorDashMarketEvidence(): MarketEvidenceItem[] {
  const fixturePath = path.join(config.fixturesDir, 'doordash_market_evidence.json');
  if (fs.existsSync(fixturePath)) {
    try {
      return JSON.parse(fs.readFileSync(fixturePath, 'utf-8'));
    } catch (e) {
      console.warn('Failed to parse doordash_market_evidence.json:', e);
    }
  }
  return [];
}

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
      params.startupName?.trim() || (params.originalFilename ? path.basename(params.originalFilename, path.extname(params.originalFilename)) : 'Unknown'),
      params.targetGeography?.trim() || 'Unknown',
      params.industry?.trim() || 'Unknown',
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
    return db.prepare(`
      SELECT 
        pitches.*,
        analyses.overall_score,
        analyses.evaluation_method
      FROM pitches
      LEFT JOIN analyses ON analyses.pitch_id = pitches.id
      ORDER BY pitches.created_at DESC
    `).all() as PitchRecord[];
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

  updatePitchMetadata(
    id: string,
    metadata: { startupName?: string; industry?: string; targetGeography?: string }
  ): PitchRecord {
    const db = getDatabase();
    const pitch = this.getPitch(id);
    if (!pitch) throw new Error('Pitch not found');

    const sName = metadata.startupName !== undefined ? metadata.startupName.trim() : pitch.startup_name;
    const ind = metadata.industry !== undefined ? metadata.industry.trim() : pitch.industry;
    const geo = metadata.targetGeography !== undefined ? metadata.targetGeography.trim() : pitch.target_geography;

    db.prepare(`
      UPDATE pitches 
      SET startup_name = ?, industry = ?, target_geography = ?, updated_at = ? 
      WHERE id = ?
    `).run(sName || 'Unknown', ind || 'Unknown', geo || 'Unknown', new Date().toISOString(), id);

    return this.getPitch(id)!;
  }

  retryPitch(id: string): PitchRecord {
    const db = getDatabase();
    const pitch = this.getPitch(id);
    if (!pitch) throw new Error('Pitch not found');

    const now = new Date().toISOString();

    // If a valid transcript already exists, skip re-ingestion and reset to TRANSCRIPTION_READY
    const existingTranscript = pitch.normalized_transcript || pitch.original_transcript;
    if (existingTranscript && existingTranscript.trim()) {
      db.prepare(`
        UPDATE pitches 
        SET status = 'TRANSCRIPTION_READY', error_message = NULL, updated_at = ? 
        WHERE id = ?
      `).run(now, id);
      return this.getPitch(id)!;
    }

    // For file-based pitches, verify the physical media file still exists
    if (pitch.stored_file_path) {
      let resolvedPath: string | null = null;
      if (fs.existsSync(pitch.stored_file_path)) {
        resolvedPath = pitch.stored_file_path;
      } else {
        const candidate = path.join(config.uploadDir, path.basename(pitch.stored_file_path));
        if (fs.existsSync(candidate)) {
          resolvedPath = candidate;
        }
      }

      if (!resolvedPath || fs.statSync(resolvedPath).size === 0) {
        const msg = `Original media file is not available on disk (${pitch.original_filename || 'video file'}). Please upload the file again to start a screening.`;
        db.prepare(`
          UPDATE pitches 
          SET status = 'FAILED', error_message = ?, updated_at = ? 
          WHERE id = ?
        `).run(msg, now, id);
        throw new Error(msg);
      }

      // Update path if resolved to alternate directory
      if (resolvedPath !== pitch.stored_file_path) {
        db.prepare('UPDATE pitches SET stored_file_path = ? WHERE id = ?').run(resolvedPath, id);
      }

      db.prepare(`
        UPDATE pitches 
        SET status = 'QUEUED', error_message = NULL, updated_at = ? 
        WHERE id = ?
      `).run(now, id);

      jobQueue.enqueueIngestionTask(id);
      return this.getPitch(id)!;
    }

    // Manual pitch without transcript cannot be processed
    const msg = 'No source file or manual transcript available to process.';
    db.prepare('UPDATE pitches SET status = "FAILED", error_message = ?, updated_at = ? WHERE id = ?').run(msg, now, id);
    throw new Error(msg);
  }

  async analyzePitch(id: string, providerOverride?: string, forceReanalyze: boolean = false): Promise<AnalysisRecord> {
    const db = getDatabase();
    const pitch = this.getPitch(id);
    if (!pitch) throw new Error('Pitch not found');

    const transcript = pitch.normalized_transcript || pitch.original_transcript;
    if (!transcript || !transcript.trim()) {
      throw new Error('Cannot analyze pitch without a valid transcript. Please supply a transcript first.');
    }

    // Avoid making repeated LLM calls unnecessarily when reopening an existing report
    if (!forceReanalyze) {
      const existing = this.getAnalysis(id);
      if (existing) {
        return existing;
      }
    }

    const now = new Date().toISOString();
    // Update pitch status to ANALYZING
    db.prepare("UPDATE pitches SET status = 'ANALYZING', updated_at = ? WHERE id = ?").run(now, id);

    const isDoorDash = isDoorDashDemo(pitch);
    try {
      const evalResult = await aiServiceClient.evaluate({
        transcript,
        startupName: pitch.startup_name,
        targetGeography: pitch.target_geography,
        industry: pitch.industry,
        providerOverride,
        isDemo: isDoorDash
      });

      if (isDoorDash) {
        evalResult.market_evidence = getDoorDashMarketEvidence();
        evalResult.is_demo = true;
      }

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

      // If metadata was Unknown and model inferred values, update pitch record with inferred values
      let finalStartup = pitch.startup_name;
      let finalIndustry = pitch.industry;
      let finalGeo = pitch.target_geography;

      if (evalResult.inferred_metadata) {
        const inf = evalResult.inferred_metadata;
        if ((!finalStartup || finalStartup === 'Unknown' || finalStartup === 'Untitled Startup') && inf.startup_name && inf.startup_name !== 'Unknown') {
          finalStartup = inf.startup_name;
        }
        if ((!finalIndustry || finalIndustry === 'Unknown' || finalIndustry === 'General Tech') && inf.industry && inf.industry !== 'Unknown') {
          finalIndustry = inf.industry;
        }
        if ((!finalGeo || finalGeo === 'Unknown' || finalGeo === 'Global') && inf.target_geography && inf.target_geography !== 'Unknown') {
          finalGeo = inf.target_geography;
        }
      }

      // Update pitch status to COMPLETED and update metadata if inferred
      db.prepare(`
        UPDATE pitches 
        SET startup_name = ?, industry = ?, target_geography = ?, status = 'COMPLETED', updated_at = ? 
        WHERE id = ?
      `).run(finalStartup, finalIndustry, finalGeo, new Date().toISOString(), id);

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

    let marketEvidence: MarketEvidenceItem[] = JSON.parse(row.market_evidence_json || '[]');
    let isDemo = Boolean(row.is_demo);

    const pitchRow = db.prepare('SELECT id, startup_name, original_filename FROM pitches WHERE id = ?').get(pitchId) as any;
    if (pitchRow && isDoorDashDemo(pitchRow)) {
      isDemo = true;
      if (!marketEvidence || marketEvidence.length === 0 || !marketEvidence.some((m: any) => m.id === 'mkt-doordash-001')) {
        marketEvidence = getDoorDashMarketEvidence();
      }
    }

    return {
      id: row.id,
      pitch_id: row.pitch_id,
      rubric_version: row.rubric_version,
      evaluation_provider: row.evaluation_provider,
      evaluation_method: row.evaluation_method,
      overall_score: row.overall_score,
      criteria_scores: JSON.parse(row.criteria_scores_json || '{}'),
      strengths: JSON.parse(row.strengths_json || '[]'),
      risks: JSON.parse(row.risks_json || '[]'),
      assumptions: JSON.parse(row.assumptions_json || '[]'),
      missing_information: JSON.parse(row.missing_information_json || '[]'),
      founder_questions: JSON.parse(row.founder_questions_json || '[]'),
      market_evidence: marketEvidence,
      confidence_score: row.confidence_score,
      confidence_limitations: row.confidence_limitations,
      is_demo: isDemo,
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

  seedDemoPitch(demoType?: string, force: boolean = false): PitchWithAnalysis {
    const db = getDatabase();
    const isDoorDash = demoType === 'doordash' || demoType === 'demo-pitch-doordash';
    const demoId = isDoorDash ? 'demo-pitch-doordash' : 'demo-pitch-agriscan';
    const fixtureFileName = isDoorDash ? 'doordash_demo_pitch.json' : 'demo_pitch.json';

    // If already exists and not forced, return report
    const existing = this.getPitchReport(demoId);
    if (!force && existing && existing.analysis && existing.analysis.market_evidence && existing.analysis.market_evidence.length > 0) {
      return existing;
    }

    const demoJsonPath = path.join(config.fixturesDir, fixtureFileName);
    if (!fs.existsSync(demoJsonPath)) {
      throw new Error(`Demo fixture not found at ${demoJsonPath}`);
    }

    const data = JSON.parse(fs.readFileSync(demoJsonPath, 'utf-8'));
    const p = data.pitch;
    const a = data.analysis;

    // Remove any stale demo entries
    db.prepare('DELETE FROM analyses WHERE pitch_id = ?').run(demoId);
    db.prepare('DELETE FROM pitches WHERE id = ?').run(demoId);

    // If physical DoorDash video exists in uploads, link stored_file_path
    let storedFilePath = null;
    if (isDoorDash) {
      const candidateUploads = [
        'upload_7d952183-bfb6-4468-80c9-2c4277124a25.mp4',
        'upload_b8682add-03ce-4878-a92b-5f59a47a8d1c.mp4',
        'upload_192f121d-e623-4261-9e86-f34f182b05d0.mp4'
      ];
      for (const f of candidateUploads) {
        const fullP = path.join(config.uploadDir, f);
        if (fs.existsSync(fullP)) {
          storedFilePath = fullP;
          break;
        }
      }
    }

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
      storedFilePath,
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
      JSON.stringify(isDoorDash ? getDoorDashMarketEvidence() : a.market_evidence),
      a.confidence_score,
      a.confidence_limitations,
      1,
      a.created_at
    );

    return this.getPitchReport(demoId)!;
  }
}

export const pitchService = new PitchService();
