-- Baseline Validations for HITL engine accuracy tracking
-- Stores human assessment of engine matching accuracy

CREATE TABLE IF NOT EXISTS baseline_validations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    assessment_id INTEGER NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
    validation_type TEXT NOT NULL CHECK (validation_type IN ('TRUE_POSITIVE', 'FALSE_POSITIVE', 'TRUE_NEGATIVE', 'FALSE_NEGATIVE')),
    notes TEXT,
    reviewer_id TEXT,
    reviewer_name TEXT,
    validated_at TEXT DEFAULT (datetime('now')),
    UNIQUE(assessment_id)
);

-- Index for querying validations by type
CREATE INDEX IF NOT EXISTS idx_validations_type ON baseline_validations(validation_type);
CREATE INDEX IF NOT EXISTS idx_validations_assessment ON baseline_validations(assessment_id);
