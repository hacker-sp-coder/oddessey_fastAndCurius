import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

function resolvePath(envVal: string | undefined, defaultRel: string): string {
  if (envVal) {
    return path.isAbsolute(envVal) ? envVal : path.resolve(process.cwd(), envVal);
  }
  return path.resolve(__dirname, defaultRel);
}

export const config = {
  port: parseInt(process.env.PORT || '4000', 10),
  aiServiceUrl: process.env.AI_SERVICE_URL || 'http://127.0.0.1:8000',
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  maxFileSizeMb: parseInt(process.env.MAX_FILE_SIZE_MB || '100', 10),
  databasePath: resolvePath(process.env.DATABASE_PATH, '../../../storage/pitches.db'),
  uploadDir: resolvePath(process.env.UPLOAD_DIR, '../../../storage/uploads'),
  tempDir: resolvePath(process.env.TEMP_DIR, '../../../storage/temp'),
  fixturesDir: resolvePath(process.env.FIXTURES_DIR, '../../../fixtures')
};

