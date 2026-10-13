import path from 'path';
import fs from 'fs';
import request from 'supertest';
import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import { app } from '../src/index.js';
import { getDatabase, closeDatabase } from '../src/db/database.js';
import { aiServiceClient } from '../src/services/aiServiceClient.js';

describe('Node.js Express API Test Suite', () => {
  beforeEach(() => {
    // Reset database state for test isolation if needed
  });

  afterAll(() => {
    closeDatabase();
  });

  // 1. Health Endpoints
  describe('GET /api/health and /api/health/capabilities', () => {
    it('returns healthy status for api server and database', async () => {
      const res = await request(app).get('/api/health');
      expect(res.status).toBe(200);
      expect(res.body.service).toBe('api-server');
      expect(res.body.database.driver).toBe('better-sqlite3');
      expect(res.body.database.status).toBe('ok');
      expect(res.body.ai_service).toBeDefined();
    });

    it('returns system capabilities without exposing secrets', async () => {
      const res = await request(app).get('/api/capabilities');
      // Root or /api/health/capabilities
      const capRes = await request(app).get('/api/health/capabilities');
      expect(capRes.status).toBe(200);
      expect(capRes.body.api_server.supported_inputs).toContain('VIDEO');
      expect(capRes.body.api_server.supported_inputs).toContain('TEXT');
      // Ensure no API keys or passwords in response body string
      const jsonStr = JSON.stringify(capRes.body);
      expect(jsonStr).not.toContain('gsk_');
      expect(jsonStr).not.toContain('secret');
    });
  });

  // 2. Upload Validation & Rejection
  describe('Upload Validation', () => {
    it('rejects unsupported file extensions with 400 Bad Request', async () => {
      const res = await request(app)
        .post('/api/pitches')
        .attach('file', Buffer.from('malicious binary content'), 'malicious.exe');

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Unsupported file type');
    });

    it('rejects request with neither file nor manual transcript', async () => {
      const res = await request(app).post('/api/pitches').send({});
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Either a pitch file');
    });
  });

  // 3. Manual Transcript & Pitch Creation
  describe('Pitch Lifecycle with Manual Transcript', () => {
    let createdPitchId = '';

    it('creates a pitch directly with manual transcript', async () => {
      const res = await request(app)
        .post('/api/pitches')
        .send({
          startup_name: 'MedAI Diagnostics',
          target_geography: 'North America',
          industry: 'Healthcare',
          manual_transcript: 'MedAI diagnostics is developing automated triage algorithms for emergency rooms.'
        });

      expect(res.status).toBe(201);
      expect(res.body.pitch).toBeDefined();
      expect(res.body.pitch.startup_name).toBe('MedAI Diagnostics');
      expect(res.body.pitch.input_type).toBe('MANUAL');
      expect(res.body.pitch.status).toBe('TRANSCRIPTION_READY');
      expect(res.body.pitch.original_transcript).toContain('automated triage');

      createdPitchId = res.body.pitch.id;
    });

    it('retrieves pitch by ID', async () => {
      const res = await request(app).get(`/api/pitches/${createdPitchId}`);
      expect(res.status).toBe(200);
      expect(res.body.pitch.id).toBe(createdPitchId);
      expect(res.body.pitch.startup_name).toBe('MedAI Diagnostics');
    });

    it('updates pitch transcript text', async () => {
      const updatedText = 'Updated MedAI transcript: Our pilots show 40% reduction in patient wait time.';
      const res = await request(app)
        .post(`/api/pitches/${createdPitchId}/transcript`)
        .send({ transcript: updatedText });

      expect(res.status).toBe(200);
      expect(res.body.pitch.normalized_transcript).toBe(updatedText);
      expect(res.body.pitch.status).toBe('TRANSCRIPTION_READY');
    });

    it('runs analysis successfully with mocked AI service', async () => {
      const mockAnalysisResult = {
        rubric_version: '1.0.0',
        evaluation_provider: 'deterministic',
        evaluation_method: 'Deterministic Heuristic Rubric (Rule-Based Fallback)',
        overall_score: 79.5,
        criteria_scores: {
          problem_clarity: {
            name: 'Problem Clarity',
            score: 85,
            weight: 15,
            weighted_score: 12.75,
            rationale: 'Clear triage problem',
            evidence: ['emergency rooms'],
            missing_evidence: 'Cost figures'
          }
        },
        strengths: ['Strong domain focus'],
        risks: ['Hospital procurement cycles'],
        assumptions: ['Clinicians will adopt'],
        missing_information: ['CAC payback duration'],
        founder_questions: ['What is your sales cycle?'],
        market_evidence: [],
        confidence_score: 0.85,
        confidence_limitations: 'Heuristic evaluation aid',
        is_demo: false,
        created_at: new Date().toISOString()
      };

      vi.spyOn(aiServiceClient, 'evaluate').mockResolvedValueOnce(mockAnalysisResult as any);

      const res = await request(app)
        .post(`/api/pitches/${createdPitchId}/analyze`)
        .send({});

      expect(res.status).toBe(200);
      expect(res.body.analysis).toBeDefined();
      expect(res.body.analysis.overall_score).toBe(79.5);
      expect(res.body.analysis.pitch_id).toBe(createdPitchId);

      // Verify pitch status updated to COMPLETED
      const pitchRes = await request(app).get(`/api/pitches/${createdPitchId}`);
      expect(pitchRes.body.pitch.status).toBe('COMPLETED');
    });

    it('retrieves full pitch report including analysis', async () => {
      const res = await request(app).get(`/api/pitches/${createdPitchId}/report`);
      expect(res.status).toBe(200);
      expect(res.body.pitch).toBeDefined();
      expect(res.body.analysis).toBeDefined();
      expect(res.body.analysis.overall_score).toBe(79.5);
    });

    it('handles AI service failure and records error state', async () => {
      vi.spyOn(aiServiceClient, 'evaluate').mockRejectedValueOnce(new Error('AI Service Unavailable'));

      const res = await request(app)
        .post(`/api/pitches/${createdPitchId}/analyze`)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('AI Service Unavailable');

      const pitchRes = await request(app).get(`/api/pitches/${createdPitchId}`);
      expect(pitchRes.body.pitch.status).toBe('FAILED');
      expect(pitchRes.body.pitch.error_message).toContain('AI Service Unavailable');
    });

    it('deletes pitch and cascades clean-up', async () => {
      const res = await request(app).delete(`/api/pitches/${createdPitchId}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const checkRes = await request(app).get(`/api/pitches/${createdPitchId}`);
      expect(checkRes.status).toBe(404);
    });
  });

  // 4. Demo Pitch Seeding
  describe('Demo Pitch Seed Endpoint', () => {
    it('seeds the bundled demo pitch fixture and returns complete report', async () => {
      const res = await request(app).post('/api/pitches/demo');
      expect(res.status).toBe(200);
      expect(res.body.pitch).toBeDefined();
      expect(res.body.analysis).toBeDefined();
      expect(res.body.pitch.id).toBe('demo-pitch-agriscan');
      expect(res.body.pitch.status).toBe('COMPLETED');
      expect(res.body.analysis.is_demo).toBe(true);
      expect(res.body.analysis.overall_score).toBeGreaterThan(70);
    });
  });

  // 5. File Upload Ingestion
  describe('File Upload Flow', () => {
    it('accepts a plain text pitch file upload', async () => {
      const textBuffer = Buffer.from('Startup pitch: Clean energy battery recycling network.');
      const res = await request(app)
        .post('/api/pitches')
        .field('startup_name', 'EcoCycle')
        .field('industry', 'CleanTech')
        .attach('file', textBuffer, 'pitch_deck.txt');

      expect(res.status).toBe(201);
      expect(res.body.pitch).toBeDefined();
      expect(res.body.pitch.input_type).toBe('TEXT');
      expect(res.body.pitch.stored_file_path).toBeDefined();

      // Clean up created pitch
      await request(app).delete(`/api/pitches/${res.body.pitch.id}`);
    });
  });
});
