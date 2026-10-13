import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { config } from './config.js';
import { jobQueue } from './services/jobQueue.js';
import healthRoutes from './routes/health.js';
import pitchRoutes from './routes/pitches.js';

export const app = express();

// CORS configuration for local development
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps, curl, or same-origin)
    if (!origin) return callback(null, true);
    if (origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:')) {
      return callback(null, true);
    }
    return callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Route mounting
app.use('/api/health', healthRoutes);
app.use('/api/pitches', pitchRoutes);

// Root health ping
app.get('/', (_req: Request, res: Response) => {
  res.json({
    name: 'AI Idea Screening API',
    status: 'healthy',
    documentation: '/api/health'
  });
});

// Centralized error handling
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Unhandled server error:', err);
  const status = err.status || 500;
  res.status(status).json({
    error: err.message || 'Internal Server Error'
  });
});

// Start server if executed directly (not under test)
if (process.env.NODE_ENV !== 'test' && !process.env.VITEST) {
  jobQueue.recoverInterruptedJobs();
  app.listen(config.port, '0.0.0.0', () => {
    console.log(`[Node API] Server listening on http://0.0.0.0:${config.port}`);
    console.log(`[Node API] Connected to AI service at ${config.aiServiceUrl}`);
  });
}
