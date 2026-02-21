PRAGMA foreign_keys = ON;

-- Add memo-centric reviewer fields to judgments
ALTER TABLE judgments ADD COLUMN evidence_sufficiency TEXT DEFAULT 'UNREVIEWED';
ALTER TABLE judgments ADD COLUMN include_in_final INTEGER DEFAULT 0;
ALTER TABLE judgments ADD COLUMN final_memo_summary TEXT;
ALTER TABLE judgments ADD COLUMN follow_up_needed INTEGER DEFAULT 0;
