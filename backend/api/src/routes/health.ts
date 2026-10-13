import { Router } from 'express';
import { getDatabase } from '../db/database.js';
import { aiServiceClient } from '../services/aiServiceClient.js';
import { config } from '../config.js';

const router = Router();

router.get('/', async (_req, res) => {
  let dbStatus = 'ok';
  try {
    const db = getDatabase();
    db.prepare('SELECT 1').get();
  } catch (err: any) {
    dbStatus = `error: ${err.message}`;
  }

  const aiHealth = await aiServiceClient.getHealth();

  res.json({
    status: dbStatus === 'ok' ? 'ok' : 'degraded',
    service: 'api-server',
    node_version: process.version,
    database: {
      driver: 'better-sqlite3',
      status: dbStatus
    },
    ai_service: aiHealth || {
      status: 'offline',
      service: 'ai-service',
      message: `AI service unavailable at ${config.aiServiceUrl}`
    }
  });
});

router.get('/capabilities', async (_req, res) => {
  const aiCaps = await aiServiceClient.getCapabilities();

  res.json({
    api_server: {
      max_upload_size_mb: config.maxFileSizeMb,
      database: 'better-sqlite3 (WAL mode)',
      supported_inputs: ['VIDEO', 'AUDIO', 'PDF', 'TEXT', 'MANUAL']
    },
    ai_service: aiCaps || {
      status: 'offline',
      details: 'AI Service is not reachable. Offline fallback mechanisms are active.'
    }
  });
});

export default router;
