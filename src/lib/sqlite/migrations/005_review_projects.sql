-- Review Projects for new submission workflow
CREATE TABLE IF NOT EXISTS review_projects (
    id TEXT PRIMARY KEY,
    site_id TEXT NOT NULL,
    site_name TEXT,
    applicant_name TEXT,
    applicant_company TEXT,
    application_type TEXT NOT NULL,
    selected_services TEXT NOT NULL,
    submission_date TEXT,
    site_address TEXT,
    site_region TEXT,
    folder_path TEXT NOT NULL,
    notes TEXT,
    status TEXT NOT NULL DEFAULT 'created',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS review_project_files (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id TEXT NOT NULL REFERENCES review_projects(id) ON DELETE CASCADE,
    filename TEXT NOT NULL,
    file_size INTEGER,
    file_type TEXT,
    processed INTEGER DEFAULT 0,
    uploaded_at TEXT DEFAULT (datetime('now')),
    processed_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_review_projects_status ON review_projects(status);
CREATE INDEX IF NOT EXISTS idx_review_projects_site_id ON review_projects(site_id);
CREATE INDEX IF NOT EXISTS idx_review_project_files_project ON review_project_files(project_id);
CREATE INDEX IF NOT EXISTS idx_review_project_files_processed ON review_project_files(processed);
