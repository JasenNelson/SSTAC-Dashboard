/**
 * Import Evaluation Results Script
 *
 * Imports RRAA evaluation results JSON into the SQLite database.
 * Uses better-sqlite3 directly for standalone script execution.
 *
 * Usage:
 *   npx ts-node scripts/import-evaluation-results.ts [path-to-json]
 *
 * Default path:
 *   F:\Regulatory-Review\1_Active_Reviews\Teck_Trail-WARP\2_Evaluation_Output\TECK_TRAIL_WARP_evaluation_results_v6.json
 */

import Database from 'better-sqlite3';
import * as fs from 'fs';
import * as path from 'path';

// =============================================================================
// Configuration
// =============================================================================

const DEFAULT_JSON_PATH = 'F:\\Regulatory-Review\\1_Active_Reviews\\Teck_Trail-WARP\\2_Evaluation_Output\\WARP_EvalResult_20260111_180401.json';
const DB_PATH = path.join(process.cwd(), 'src', 'data', 'regulatory-review.db');
const MIGRATIONS_PATH = path.join(process.cwd(), 'src', 'lib', 'sqlite', 'migrations');

// =============================================================================
// Types (matching the JSON structure)
// =============================================================================

interface EvidenceItem {
  spec_id: string;
  spec_description: string;
  evidence_type: string;
  location: string;
  page_reference?: string;
  excerpt: string;
  confidence: string;
  match_reasons: string[];
}

interface AssessmentJson {
  csap_id: string;
  csap_text: string;
  section: string;
  sheet: string;
  item_number: number;
  result: string;
  confidence: string;
  discretion_tier: string;
  evidence_coverage: number;
  regulatory_authority: string;
  linked_policies: string[];
  reviewer_notes: string;
  action_required: string;
  evidence_found: EvidenceItem[];
  keywords_matched: string[];
  sections_searched: number;
}

interface EvaluationJson {
  evaluation_id: string;
  submission_id: string;
  site_id: string;
  submission_type: string;
  evaluation_started: string;
  evaluation_completed: string;
  checklist_source: string;
  total_checklist_items: number;
  summary: {
    total_items: number;
    pass_count: number;
    partial_count: number;
    fail_count: number;
    na_count: number;
    requires_judgment_count: number;
    tier1_count: number;
    tier2_count: number;
    tier3_count: number;
    overall_coverage: number;
  };
  overall_recommendation: string;
  requires_human_review: boolean;
  assessments: AssessmentJson[];
}

// =============================================================================
// Database Setup
// =============================================================================

function initializeDatabase(db: Database.Database): void {
  console.log('Initializing database...');

  // Enable foreign keys and WAL mode
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

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
    console.log('No migrations directory found at:', MIGRATIONS_PATH);
    console.log('Creating tables directly...');
    createTablesDirectly(db);
    return;
  }

  const migrationFiles = fs
    .readdirSync(MIGRATIONS_PATH)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  if (migrationFiles.length === 0) {
    console.log('No migration files found, creating tables directly...');
    createTablesDirectly(db);
    return;
  }

  // Apply each pending migration
  for (const file of migrationFiles) {
    if (appliedSet.has(file)) {
      console.log(`  Migration already applied: ${file}`);
      continue;
    }

    console.log(`  Applying migration: ${file}`);
    const sql = fs.readFileSync(path.join(MIGRATIONS_PATH, file), 'utf-8');

    db.transaction(() => {
      db.exec(sql);
      db.prepare('INSERT INTO _migrations (name) VALUES (?)').run(file);
    })();

    console.log(`  Migration applied: ${file}`);
  }

  console.log('Database initialized.');
}

function createTablesDirectly(db: Database.Database): void {
  db.exec(`
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS submissions (
        id TEXT PRIMARY KEY,
        submission_id TEXT NOT NULL UNIQUE,
        site_id TEXT NOT NULL,
        submission_type TEXT NOT NULL,
        checklist_source TEXT,
        total_items INTEGER NOT NULL,
        evaluation_started TEXT,
        evaluation_completed TEXT,
        overall_recommendation TEXT,
        requires_human_review INTEGER DEFAULT 1,
        imported_at TEXT DEFAULT (datetime('now')),
        pass_count INTEGER DEFAULT 0,
        partial_count INTEGER DEFAULT 0,
        fail_count INTEGER DEFAULT 0,
        requires_judgment_count INTEGER DEFAULT 0,
        tier1_count INTEGER DEFAULT 0,
        tier2_count INTEGER DEFAULT 0,
        tier3_count INTEGER DEFAULT 0,
        overall_coverage REAL DEFAULT 0.0
    );

    CREATE TABLE IF NOT EXISTS assessments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        submission_id TEXT NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
        csap_id TEXT NOT NULL,
        csap_text TEXT NOT NULL,
        section TEXT,
        sheet TEXT,
        item_number INTEGER,
        ai_result TEXT NOT NULL,
        ai_confidence TEXT,
        discretion_tier TEXT NOT NULL,
        evidence_coverage REAL DEFAULT 0.0,
        regulatory_authority TEXT,
        linked_policies TEXT,
        reviewer_notes TEXT,
        action_required TEXT,
        evidence_found TEXT,
        keywords_matched TEXT,
        sections_searched INTEGER DEFAULT 0,
        UNIQUE(submission_id, csap_id)
    );

    CREATE TABLE IF NOT EXISTS judgments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        assessment_id INTEGER NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
        human_result TEXT,
        human_confidence TEXT,
        judgment_notes TEXT,
        override_reason TEXT,
        routed_to TEXT,
        routing_reason TEXT,
        reviewer_id TEXT,
        reviewer_name TEXT,
        reviewed_at TEXT DEFAULT (datetime('now')),
        review_status TEXT DEFAULT 'PENDING',
        UNIQUE(assessment_id)
    );

    CREATE TABLE IF NOT EXISTS review_sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        submission_id TEXT NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
        reviewer_id TEXT,
        session_start TEXT DEFAULT (datetime('now')),
        session_end TEXT,
        items_reviewed INTEGER DEFAULT 0,
        items_accepted INTEGER DEFAULT 0,
        items_overridden INTEGER DEFAULT 0,
        items_deferred INTEGER DEFAULT 0,
        session_notes TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_assessments_submission ON assessments(submission_id);
    CREATE INDEX IF NOT EXISTS idx_assessments_tier ON assessments(discretion_tier);
    CREATE INDEX IF NOT EXISTS idx_assessments_result ON assessments(ai_result);
    CREATE INDEX IF NOT EXISTS idx_judgments_status ON judgments(review_status);
    CREATE INDEX IF NOT EXISTS idx_judgments_assessment ON judgments(assessment_id);
  `);
}

// =============================================================================
// Import Logic
// =============================================================================

function checkSubmissionExists(db: Database.Database, submissionId: string): boolean {
  const result = db
    .prepare('SELECT id FROM submissions WHERE submission_id = ?')
    .get(submissionId);
  return !!result;
}

function deleteExistingSubmission(db: Database.Database, evaluationId: string, submissionId: string): void {
  // Delete by evaluation_id (which we use as id) or by submission_id
  db.prepare('DELETE FROM submissions WHERE id = ? OR submission_id = ?').run(evaluationId, submissionId);
}

function insertSubmission(
  db: Database.Database,
  evaluation: EvaluationJson
): void {
  const stmt = db.prepare(`
    INSERT INTO submissions (
      id, submission_id, site_id, submission_type, checklist_source,
      total_items, evaluation_started, evaluation_completed,
      overall_recommendation, requires_human_review,
      pass_count, partial_count, fail_count, requires_judgment_count,
      tier1_count, tier2_count, tier3_count, overall_coverage
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
    )
  `);

  stmt.run(
    evaluation.evaluation_id,
    evaluation.submission_id,
    evaluation.site_id,
    evaluation.submission_type,
    evaluation.checklist_source,
    evaluation.total_checklist_items,
    evaluation.evaluation_started,
    evaluation.evaluation_completed,
    evaluation.overall_recommendation,
    evaluation.requires_human_review ? 1 : 0,
    evaluation.summary.pass_count,
    evaluation.summary.partial_count,
    evaluation.summary.fail_count,
    evaluation.summary.requires_judgment_count,
    evaluation.summary.tier1_count,
    evaluation.summary.tier2_count,
    evaluation.summary.tier3_count,
    evaluation.summary.overall_coverage
  );
}

function insertAssessmentsBulk(
  db: Database.Database,
  evaluationId: string,
  assessments: AssessmentJson[]
): number {
  const stmt = db.prepare(`
    INSERT INTO assessments (
      submission_id, csap_id, csap_text, section, sheet, item_number,
      ai_result, ai_confidence, discretion_tier, evidence_coverage,
      regulatory_authority, linked_policies, reviewer_notes, action_required,
      evidence_found, keywords_matched, sections_searched
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  let insertedCount = 0;
  const batchSize = 100;
  const totalBatches = Math.ceil(assessments.length / batchSize);

  for (let batch = 0; batch < totalBatches; batch++) {
    const start = batch * batchSize;
    const end = Math.min(start + batchSize, assessments.length);
    const batchItems = assessments.slice(start, end);

    db.transaction(() => {
      for (const item of batchItems) {
        try {
          stmt.run(
            evaluationId,
            item.csap_id || '',
            item.csap_text || '',
            item.section || null,
            item.sheet || null,
            item.item_number ?? null,
            item.result || 'REQUIRES_JUDGMENT',
            item.confidence || null,
            item.discretion_tier || 'TIER_1_BINARY',
            item.evidence_coverage ?? 0,
            item.regulatory_authority || null,
            item.linked_policies ? JSON.stringify(item.linked_policies) : null,
            item.reviewer_notes || null,
            item.action_required || null,
            item.evidence_found ? JSON.stringify(item.evidence_found) : null,
            item.keywords_matched ? JSON.stringify(item.keywords_matched) : null,
            item.sections_searched ?? 0
          );
          insertedCount++;
        } catch (error) {
          console.error(`  Error inserting assessment ${item.csap_id}:`, error);
        }
      }
    })();

    // Progress indicator
    const progress = Math.round(((batch + 1) / totalBatches) * 100);
    process.stdout.write(`\r  Importing assessments: ${progress}% (${end}/${assessments.length})`);
  }

  console.log(); // New line after progress
  return insertedCount;
}

// =============================================================================
// Main
// =============================================================================

async function main(): Promise<void> {
  const jsonPath = process.argv[2] || DEFAULT_JSON_PATH;

  console.log('='.repeat(70));
  console.log('SSTAC Dashboard - Evaluation Results Import');
  console.log('='.repeat(70));
  console.log();

  // Validate JSON file exists
  if (!fs.existsSync(jsonPath)) {
    console.error(`ERROR: JSON file not found: ${jsonPath}`);
    process.exit(1);
  }

  console.log(`Source JSON: ${jsonPath}`);
  console.log(`Target DB:   ${DB_PATH}`);
  console.log();

  // Ensure data directory exists
  const dataDir = path.dirname(DB_PATH);
  if (!fs.existsSync(dataDir)) {
    console.log(`Creating data directory: ${dataDir}`);
    fs.mkdirSync(dataDir, { recursive: true });
  }

  // Read and parse JSON
  console.log('Reading JSON file...');
  const jsonContent = fs.readFileSync(jsonPath, 'utf-8');
  const evaluation: EvaluationJson = JSON.parse(jsonContent);

  console.log(`  Evaluation ID: ${evaluation.evaluation_id}`);
  console.log(`  Submission ID: ${evaluation.submission_id}`);
  console.log(`  Site ID: ${evaluation.site_id}`);
  console.log(`  Type: ${evaluation.submission_type}`);
  console.log(`  Total Assessments: ${evaluation.assessments.length}`);
  console.log();

  // Open database
  console.log('Opening database...');
  const db = new Database(DB_PATH);

  try {
    // Initialize database
    initializeDatabase(db);
    console.log();

    // Check if submission already exists
    const exists = checkSubmissionExists(db, evaluation.submission_id);
    if (exists) {
      console.log(`Submission "${evaluation.submission_id}" already exists.`);
      console.log('Deleting existing data and reimporting...');
      deleteExistingSubmission(db, evaluation.evaluation_id, evaluation.submission_id);
      console.log('Existing data deleted.');
      console.log();
    }

    // Insert submission
    console.log('Inserting submission record...');
    insertSubmission(db, evaluation);
    console.log('  Submission inserted.');
    console.log();

    // Insert assessments
    console.log('Inserting assessments...');
    const insertedCount = insertAssessmentsBulk(
      db,
      evaluation.evaluation_id,
      evaluation.assessments
    );
    console.log(`  ${insertedCount} assessments inserted.`);
    console.log();

    // Verify import
    console.log('Verifying import...');
    const submissionCount = db.prepare('SELECT COUNT(*) as count FROM submissions').get() as { count: number };
    const assessmentCount = db.prepare('SELECT COUNT(*) as count FROM assessments WHERE submission_id = ?').get(evaluation.evaluation_id) as { count: number };

    console.log(`  Submissions in DB: ${submissionCount.count}`);
    console.log(`  Assessments for this submission: ${assessmentCount.count}`);
    console.log();

    // Summary by result type
    const resultSummary = db.prepare(`
      SELECT ai_result, COUNT(*) as count
      FROM assessments
      WHERE submission_id = ?
      GROUP BY ai_result
      ORDER BY count DESC
    `).all(evaluation.evaluation_id) as { ai_result: string; count: number }[];

    console.log('Summary by Result:');
    for (const row of resultSummary) {
      console.log(`  ${row.ai_result}: ${row.count}`);
    }
    console.log();

    // Summary by tier
    const tierSummary = db.prepare(`
      SELECT discretion_tier, COUNT(*) as count
      FROM assessments
      WHERE submission_id = ?
      GROUP BY discretion_tier
      ORDER BY discretion_tier
    `).all(evaluation.evaluation_id) as { discretion_tier: string; count: number }[];

    console.log('Summary by Tier:');
    for (const row of tierSummary) {
      console.log(`  ${row.discretion_tier}: ${row.count}`);
    }
    console.log();

    console.log('='.repeat(70));
    console.log('Import completed successfully!');
    console.log('='.repeat(70));

  } finally {
    db.close();
  }
}

main().catch((error) => {
  console.error('Import failed:', error);
  process.exit(1);
});
