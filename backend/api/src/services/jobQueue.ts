import fs from 'fs';
import path from 'path';
import { getDatabase } from '../db/database.js';
import { aiServiceClient } from './aiServiceClient.js';
import { config } from '../config.js';
import { PitchRecord } from '../types/index.js';

class JobQueue {
  private activeJobs = new Map<string, Promise<void>>();

  /**
   * Reset interrupted jobs on server boot
   */
  recoverInterruptedJobs(): void {
    const db = getDatabase();
    const interrupted = db
      .prepare("SELECT id FROM pitches WHERE status IN ('QUEUED', 'PROCESSING', 'ANALYZING')")
      .all() as { id: string }[];

    for (const row of interrupted) {
      db.prepare(
        "UPDATE pitches SET status = 'FAILED', error_message = 'Task was interrupted by server restart. Please retry.', updated_at = ? WHERE id = ?"
      ).run(new Date().toISOString(), row.id);
    }
  }

  /**
   * Enqueue asynchronous ingestion & transcription task
   */
  enqueueIngestionTask(pitchId: string): void {
    const jobPromise = this.processPitchIngestion(pitchId);
    this.activeJobs.set(pitchId, jobPromise);

    jobPromise.finally(() => {
      this.activeJobs.delete(pitchId);
    });
  }

  private async processPitchIngestion(pitchId: string): Promise<void> {
    const db = getDatabase();
    const pitch = db.prepare('SELECT * FROM pitches WHERE id = ?').get(pitchId) as PitchRecord | undefined;
    if (!pitch) return;

    try {
      // Transition to PROCESSING
      db.prepare("UPDATE pitches SET status = 'PROCESSING', updated_at = ? WHERE id = ?").run(
        new Date().toISOString(),
        pitchId
      );

      // Resolve file path across host and container mount points if needed
      let filePath = pitch.stored_file_path || undefined;
      if (filePath) {
        if (!fs.existsSync(filePath)) {
          const candidate = path.join(config.uploadDir, path.basename(filePath));
          if (fs.existsSync(candidate)) {
            filePath = candidate;
            db.prepare('UPDATE pitches SET stored_file_path = ? WHERE id = ?').run(filePath, pitchId);
          }
        }
      }

      // Ingest through AI service
      const ingestRes = await aiServiceClient.ingest({
        filePath,
        inputType: pitch.input_type,
        manualTranscript: pitch.original_transcript || undefined
      });

      if (!ingestRes.success) {
        db.prepare(
          "UPDATE pitches SET status = 'FAILED', error_message = ?, updated_at = ? WHERE id = ?"
        ).run(ingestRes.error_message || 'File ingestion failed', new Date().toISOString(), pitchId);
        return;
      }

      // If text/pdf was extracted directly
      if (ingestRes.extracted_text) {
        db.prepare(
          `UPDATE pitches 
           SET status = 'TRANSCRIPTION_READY', 
               original_transcript = ?, 
               normalized_transcript = ?, 
               detected_language = ?, 
               error_message = NULL,
               updated_at = ? 
           WHERE id = ?`
        ).run(
          ingestRes.extracted_text,
          ingestRes.extracted_text,
          ingestRes.detected_language || 'en',
          new Date().toISOString(),
          pitchId
        );
        return;
      }

      // If audio was extracted for audio/video media
      if (ingestRes.extracted_audio_path) {
        // Attempt speech transcription
        const transRes = await aiServiceClient.transcribe({
          audioPath: ingestRes.extracted_audio_path
        });

        if (transRes.success && transRes.transcript) {
          if (db.open) {
            db.prepare(
              `UPDATE pitches 
               SET status = 'TRANSCRIPTION_READY', 
                   original_transcript = ?, 
                   normalized_transcript = ?, 
                   detected_language = ?, 
                   error_message = NULL,
                   updated_at = ? 
               WHERE id = ?`
            ).run(
              transRes.transcript,
              transRes.transcript,
              transRes.detected_language || 'en',
              new Date().toISOString(),
              pitchId
            );
          }
        } else {
          // Real failure: mark status as FAILED with actionable error so user can retry or enter transcript
          if (db.open) {
            db.prepare(
              `UPDATE pitches 
               SET status = 'FAILED', 
                   error_message = ?, 
                   updated_at = ? 
               WHERE id = ?`
            ).run(
              transRes.error_message || 'Automatic transcription failed. You can retry transcription or enter a manual transcript.',
              new Date().toISOString(),
              pitchId
            );
          }
        }
      }
    } catch (err: any) {
      if (db && db.open) {
        db.prepare(
          "UPDATE pitches SET status = 'FAILED', error_message = ?, updated_at = ? WHERE id = ?"
        ).run(err.message || 'Unexpected processing failure', new Date().toISOString(), pitchId);
      }
    }
  }
}

export const jobQueue = new JobQueue();
