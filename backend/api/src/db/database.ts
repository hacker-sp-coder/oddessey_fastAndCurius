import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';
import { config } from '../config.js';
import { INIT_SCHEMA_SQL } from './schema.js';
import { sanitizeUtf8Filename } from '../utils/text.js';

let dbInstance: Database.Database | null = null;

export function getDatabase(): Database.Database {
  if (dbInstance) {
    return dbInstance;
  }

  if (config.databasePath !== ':memory:') {
    const dbDir = path.dirname(config.databasePath);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }
  }

  dbInstance = new Database(config.databasePath);
  if (config.databasePath !== ':memory:') {
    dbInstance.pragma('journal_mode = WAL');
  }
  dbInstance.pragma('foreign_keys = ON');

  // Idempotent initialization
  dbInstance.exec(INIT_SCHEMA_SQL);

  // Self-healing migration for UTF-8 mojibake (e.g., latin1-decoded multipart headers)
  repairMojibakeRecords(dbInstance);

  return dbInstance;
}

function repairMojibakeRecords(db: Database.Database): void {
  try {
    const rows = db.prepare('SELECT id, startup_name, original_filename FROM pitches').all() as Array<{
      id: string;
      startup_name: string;
      original_filename: string;
    }>;

    for (const r of rows) {
      const fixedName = sanitizeUtf8Filename(r.startup_name);
      const fixedFilename = sanitizeUtf8Filename(r.original_filename);
      if (fixedName !== r.startup_name || fixedFilename !== r.original_filename) {
        db.prepare('UPDATE pitches SET startup_name = ?, original_filename = ? WHERE id = ?').run(
          fixedName,
          fixedFilename,
          r.id
        );
      }
    }
  } catch (err) {
    console.warn('Notice: Could not run mojibake repair migration:', err);
  }
}

export function closeDatabase(): void {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}
