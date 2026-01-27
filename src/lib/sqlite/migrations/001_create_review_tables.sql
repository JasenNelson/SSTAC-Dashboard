PRAGMA foreign_keys = ON;

-- Submissions (imported evaluation results)
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

-- Assessments (individual checklist items)
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

-- Human Judgments
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

-- Review Sessions
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

-- Indexes
CREATE INDEX IF NOT EXISTS idx_assessments_submission ON assessments(submission_id);
CREATE INDEX IF NOT EXISTS idx_assessments_tier ON assessments(discretion_tier);
CREATE INDEX IF NOT EXISTS idx_assessments_result ON assessments(ai_result);
CREATE INDEX IF NOT EXISTS idx_judgments_status ON judgments(review_status);
CREATE INDEX IF NOT EXISTS idx_judgments_assessment ON judgments(assessment_id);
