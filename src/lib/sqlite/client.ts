/**
 * SQLite Client for Regulatory Review Feature
 *
 * Uses better-sqlite3 for synchronous SQLite access.
 * Database location: src/data/regulatory-review.db
 *
 * INSTALLATION REQUIRED:
 *   npm install better-sqlite3
 *   npm install -D @types/better-sqlite3
 *
 * NOTE: This is intended for local development only.
 * It will not work in Vercel's serverless environment.
 */

import path from 'path';
import fs from 'fs';

// Database module type definition
type DatabaseModule = new (filename: string) => Database;

 
interface Database {
  pragma(pragma: string): void;
  exec(sql: string): void;
  prepare(sql: string): Statement;
  transaction<T>(fn: (...args: unknown[]) => T): (...args: unknown[]) => T;
  close(): void;
}

interface Statement {
  all(...params: unknown[]): unknown[];
  run(...params: unknown[]): { changes: number; lastInsertRowid: number };
  get(...params: unknown[]): unknown;
}

// Placeholder for Database module - loaded only when needed
let Database: DatabaseModule | null = null;

/**
 * Dynamically load better-sqlite3 on first use
 * This prevents build failures in environments where native modules can't be compiled
 */
function loadDatabase(): DatabaseModule | null {
  if (Database === null) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      Database = require('better-sqlite3');
    } catch {
      // better-sqlite3 not available (expected in Vercel/production)
      Database = null;
    }
  }
  return Database;
}

// Database file location
const DB_PATH = path.join(process.cwd(), 'src', 'data', 'regulatory-review.db');
const MIGRATIONS_PATH = path.join(process.cwd(), 'src', 'lib', 'sqlite', 'migrations');

// Singleton database instance
let dbInstance: Database | null = null;
let migrationsRun = false;

/**
 * Get or create the database connection
 * Automatically runs migrations on first access
 */
export function getDatabase(): Database {
  const DatabaseModule = loadDatabase();
  if (!DatabaseModule) {
    throw new Error(
      'SQLite database is not available in this environment. ' +
      'better-sqlite3 is required for local development only. ' +
      'This feature is not supported in serverless/Vercel deployments.'
    );
  }

  if (dbInstance) {
    // Run migrations if not yet done (handles case where db existed but migrations are new)
    if (!migrationsRun) {
      runMigrationsInternal(dbInstance);
      migrationsRun = true;
    }
    return dbInstance;
  }

  // Ensure data directory exists
  const dataDir = path.dirname(DB_PATH);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  // Create database connection with WAL mode for better concurrency
  dbInstance = new DatabaseModule(DB_PATH);
  dbInstance.pragma('journal_mode = WAL');
  dbInstance.pragma('foreign_keys = ON');

  // Auto-run migrations on first connection
  runMigrationsInternal(dbInstance);
  migrationsRun = true;

  return dbInstance;
}

/**
 * Close the database connection
 */
export function closeDatabase(): void {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
    migrationsRun = false;
  }
}

/**
 * Internal migration runner (takes db instance to avoid circular call)
 */
function runMigrationsInternal(db: Database): void {
  // Create migrations tracking table
  db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      applied_at TEXT DEFAULT (datetime('now'))
    );
  `);

  // Get already applied migrations
  const appliedMigrations = db
    .prepare('SELECT name FROM _migrations ORDER BY id')
    .all() as { name: string }[];
  const appliedSet = new Set(appliedMigrations.map((m) => m.name));

  // Get migration files
  if (!fs.existsSync(MIGRATIONS_PATH)) {
    // No migrations directory - this is fine for fresh installs
    return;
  }

  const migrationFiles = fs
    .readdirSync(MIGRATIONS_PATH)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  // Apply each pending migration
  for (const file of migrationFiles) {
    if (appliedSet.has(file)) {
      continue;
    }

    console.log(`[SQLite] Applying migration: ${file}`);
    const sql = fs.readFileSync(path.join(MIGRATIONS_PATH, file), 'utf-8');

    // Run migration in a transaction
    db.transaction(() => {
      db.exec(sql);
      db.prepare('INSERT INTO _migrations (name) VALUES (?)').run(file);
    })();

    console.log(`[SQLite] Migration applied: ${file}`);
  }
}

/**
 * Run all pending migrations (public wrapper)
 */
export function runMigrations(): void {
  const db = getDatabase();
  // Migrations already run by getDatabase(), but this ensures they're applied
  if (!migrationsRun) {
    runMigrationsInternal(db);
    migrationsRun = true;
  }
}

/**
 * Initialize database with migrations
 */
export function initDatabase(): Database {
  const db = getDatabase();
  runMigrations();
  return db;
}

/**
 * Execute a raw SQL query with parameters
 */
export function executeQuery<T>(sql: string, params: unknown[] = []): T[] {
  const db = getDatabase();
  return db.prepare(sql).all(...params) as T[];
}

/**
 * Execute a raw SQL statement (INSERT, UPDATE, DELETE)
 */
export function executeStatement(
  sql: string,
  params: unknown[] = []
): { changes: number; lastInsertRowid: number } {
  const db = getDatabase();
  return db.prepare(sql).run(...params);
}

/**
 * Get a single row by query
 */
export function getOne<T>(sql: string, params: unknown[] = []): T | undefined {
  const db = getDatabase();
  return db.prepare(sql).get(...params) as T | undefined;
}

/**
 * Check if the database exists and is initialized
 */
export function isDatabaseInitialized(): boolean {
  if (!fs.existsSync(DB_PATH)) {
    return false;
  }

  try {
    const db = getDatabase();
    const result = db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='submissions'"
      )
      .get();
    return !!result;
  } catch {
    return false;
  }
}

/**
 * Get database statistics
 */
export function getDatabaseStats(): {
  path: string;
  exists: boolean;
  initialized: boolean;
  sizeBytes: number | null;
} {
  const exists = fs.existsSync(DB_PATH);
  let sizeBytes: number | null = null;

  if (exists) {
    const stats = fs.statSync(DB_PATH);
    sizeBytes = stats.size;
  }

  return {
    path: DB_PATH,
    exists,
    initialized: isDatabaseInitialized(),
    sizeBytes,
  };
}

// Database API type definition
interface DatabaseAPI {
  instance: Database;
  init: () => Database;
  close: () => void;
  query: <T,>(sql: string, params?: unknown[]) => T[];
  execute: (sql: string, params?: unknown[]) => { changes: number; lastInsertRowid: number };
  getOne: <T,>(sql: string, params?: unknown[]) => T | undefined;
  stats: () => { path: string; exists: boolean; initialized: boolean; sizeBytes: number | null };
  isInitialized: () => boolean;
}

// Export the database instance getter
export const db: DatabaseAPI = {
  get instance() {
    return getDatabase();
  },
  init: initDatabase,
  close: closeDatabase,
  query: executeQuery,
  execute: executeStatement,
  getOne,
  stats: getDatabaseStats,
  isInitialized: isDatabaseInitialized,
};

export default db;
