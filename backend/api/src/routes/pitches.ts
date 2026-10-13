import fs from 'fs';
import path from 'path';
import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config.js';
import { pitchService } from '../services/pitchService.js';
import { InputType } from '../types/index.js';

const router = Router();

// Ensure upload directory exists
if (!fs.existsSync(config.uploadDir)) {
  fs.mkdirSync(config.uploadDir, { recursive: true });
}

// Multer storage with server-side sanitized UUID filenames
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, config.uploadDir);
  },
  filename: (_req, file, cb) => {
    const safeExt = path.extname(file.originalname).toLowerCase().replace(/[^a-z0-9.]/g, '');
    const uniqueName = `upload_${uuidv4()}${safeExt}`;
    cb(null, uniqueName);
  }
});

const ALLOWED_EXTENSIONS = new Set([
  // Video
  '.mp4', '.mov', '.webm', '.mkv', '.avi',
  // Audio
  '.wav', '.mp3', '.m4a', '.aac', '.ogg', '.flac',
  // Documents
  '.pdf', '.txt', '.md', '.markdown'
]);

const fileFilter = (_req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (ALLOWED_EXTENSIONS.has(ext)) {
    cb(null, true);
  } else {
    cb(new Error(`Unsupported file type '${ext}'. Allowed types: MP4, MOV, WEBM, WAV, MP3, M4A, PDF, TXT, MD.`));
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: config.maxFileSizeMb * 1024 * 1024
  }
});

function determineInputType(ext: string): InputType {
  const e = ext.toLowerCase();
  if (['.mp4', '.mov', '.webm', '.mkv', '.avi'].includes(e)) return 'VIDEO';
  if (['.wav', '.mp3', '.m4a', '.aac', '.ogg', '.flac'].includes(e)) return 'AUDIO';
  if (e === '.pdf') return 'PDF';
  return 'TEXT';
}

// GET /api/pitches
router.get('/', (_req, res) => {
  const pitches = pitchService.listPitches();
  res.json({ pitches });
});

// POST /api/pitches (multipart or json)
router.post(
  '/',
  (req: Request, res: Response, next: NextFunction) => {
    upload.single('file')(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({ error: `File exceeds maximum allowed size of ${config.maxFileSizeMb}MB.` });
        }
        return res.status(400).json({ error: err.message });
      } else if (err) {
        return res.status(400).json({ error: err.message });
      }
      next();
    });
  },
  (req: Request, res: Response) => {
    const { startup_name, target_geography, industry, manual_transcript } = req.body;
    const file = req.file;

    // Case 1: Manual transcript supplied without file upload
    if (!file && manual_transcript && manual_transcript.trim()) {
      const pitch = pitchService.createPitch({
        startupName: startup_name,
        targetGeography: target_geography,
        industry: industry,
        originalFilename: 'manual_transcript.txt',
        inputType: 'MANUAL',
        mimeType: 'text/plain',
        fileSize: Buffer.byteLength(manual_transcript, 'utf-8'),
        manualTranscript: manual_transcript
      });
      return res.status(201).json({ pitch });
    }

    // Case 2: File upload
    if (!file) {
      return res.status(400).json({
        error: 'Either a pitch file (video, audio, PDF, TXT) or a manual transcript must be provided.'
      });
    }

    const ext = path.extname(file.originalname);
    const inputType = determineInputType(ext);

    const pitch = pitchService.createPitch({
      startupName: startup_name,
      targetGeography: target_geography,
      industry: industry,
      originalFilename: path.basename(file.originalname),
      inputType,
      mimeType: file.mimetype || 'application/octet-stream',
      storedFilePath: file.path,
      fileSize: file.size,
      manualTranscript: manual_transcript
    });

    res.status(201).json({ pitch });
  }
);

// POST /api/pitches/demo (Seed or retrieve demo pitch fixture)
router.post('/demo', (_req, res) => {
  try {
    const report = pitchService.seedDemoPitch();
    res.json(report);
  } catch (err: any) {
    res.status(500).json({ error: `Failed to seed demo pitch: ${err.message}` });
  }
});

// GET /api/pitches/:id
router.get('/:id', (req, res) => {
  const pitch = pitchService.getPitch(req.params.id);
  if (!pitch) {
    return res.status(404).json({ error: 'Pitch not found' });
  }
  res.json({ pitch });
});

// POST /api/pitches/:id/transcript
router.post('/:id/transcript', (req, res) => {
  const { transcript } = req.body;
  if (!transcript || typeof transcript !== 'string' || !transcript.trim()) {
    return res.status(400).json({ error: 'Transcript text must be a non-empty string.' });
  }

  try {
    const updated = pitchService.updateTranscript(req.params.id, transcript);
    res.json({ pitch: updated });
  } catch (err: any) {
    res.status(404).json({ error: err.message });
  }
});

// POST /api/pitches/:id/analyze
router.post('/:id/analyze', async (req, res) => {
  const { provider_override } = req.body;
  try {
    const analysis = await pitchService.analyzePitch(req.params.id, provider_override);
    res.json({ analysis });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// GET /api/pitches/:id/report
router.get('/:id/report', (req, res) => {
  const report = pitchService.getPitchReport(req.params.id);
  if (!report) {
    return res.status(404).json({ error: 'Pitch report not found' });
  }
  res.json(report);
});

// DELETE /api/pitches/:id
router.delete('/:id', (req, res) => {
  const success = pitchService.deletePitch(req.params.id);
  if (!success) {
    return res.status(404).json({ error: 'Pitch not found' });
  }
  res.json({ success: true, message: 'Pitch and associated files deleted successfully.' });
});

export default router;
