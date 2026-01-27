# Database Schema Documentation

**Purpose:** Document the PostgreSQL database structure, relationships, constraints, and best practices for queries.

**Database Type:** PostgreSQL (via Supabase)
**Last Updated:** 2026-01-26

---

## Entity Relationship Diagram (ERD)

```
┌──────────────┐
│ users        │
├──────────────┤
│ id (PK)      │
│ email        │
│ user_role    │
│ created_at   │
└──────┬───────┘
       │
       │ FK
       ├─────────────────┐
       │                 │
       ▼                 ▼
┌──────────────┐   ┌──────────────────────┐
│ submissions  │   │ assessments          │
├──────────────┤   ├──────────────────────┤
│ id (PK)      │   │ id (PK)              │
│ user_id (FK) │   │ reviewer_id (FK)     │
│ poll_id (FK) │   │ poll_id (FK)         │
│ answer       │   │ phase                │
│ created_at   │   │ overall_grade        │
└──────────────┘   │ created_at           │
                   └──────────────────────┘
       │
       │ FK
       ▼
┌──────────────┐
│ polls        │
├──────────────┤
│ id (PK)      │
│ question     │
│ poll_type    │
│ status       │
│ options      │
│ created_at   │
│ closed_at    │
└──────────────┘
```

---

## Tables Overview

| Table | Rows | Purpose |
|---|---|---|
| `users` | 500-1000 | User accounts (CEW, TWG, SSTAC, admin) |
| `polls` | 100-150 | Poll definitions (single, ranking, wordcloud) |
| `submissions` | 10,000-50,000 | Individual poll responses |
| `assessments` | 50-200 | Phase assessments and grades |
| `regulatory_reviews` | 100-500 | Regulatory documents and submissions |
| `poll_metadata` | 100-150 | Additional poll configuration |

---

## Core Tables

### Table: `users`

**Purpose:** User accounts across all roles

**Schema:**
```sql
CREATE TABLE users (
  id VARCHAR(255) PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  user_role VARCHAR(50) NOT NULL DEFAULT 'cew_user',
  -- Roles: cew_user, twg_member, sstac_member, admin

  first_name VARCHAR(100),
  last_name VARCHAR(100),

  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

  -- Audit fields
  created_by VARCHAR(255),
  updated_by VARCHAR(255)
);
```

**Indexes:**
```sql
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(user_role);
CREATE INDEX idx_users_created_at ON users(created_at DESC);
```

**Constraints:**
- PK: `id` (unique identifier, format: `[access_code]_[device_id]`)
- UNIQUE: `email` (no duplicate emails)
- NOT NULL: `email`, `user_role`
- DEFAULT: `is_active = true`, `created_at = now()`

**Sample Data:**
```sql
INSERT INTO users (id, email, user_role)
VALUES ('123456_device1', 'user@example.com', 'cew_user');
```

---

### Table: `polls`

**Purpose:** Poll definitions (questions and options)

**Schema:**
```sql
CREATE TABLE polls (
  id VARCHAR(100) PRIMARY KEY,
  question TEXT NOT NULL,

  -- Poll type: single (single choice), ranking, wordcloud
  poll_type VARCHAR(50) NOT NULL,

  -- Poll status: draft, open, closed, archived
  status VARCHAR(50) DEFAULT 'draft',

  -- For single/ranking polls
  options JSON,  -- ["Option A", "Option B", "Option C"]

  -- For ranking polls
  allow_ties BOOLEAN DEFAULT false,

  -- Lifecycle
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  opened_at TIMESTAMP WITH TIME ZONE,
  closed_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE,

  -- Metadata
  description TEXT,
  created_by VARCHAR(255),
  is_anonymous BOOLEAN DEFAULT false,

  -- RLS (Row-Level Security)
  visible_to_roles VARCHAR(255)[]  -- ["cew_user", "twg_member"]
);
```

**Indexes:**
```sql
CREATE INDEX idx_polls_status ON polls(status);
CREATE INDEX idx_polls_type ON polls(poll_type);
CREATE INDEX idx_polls_created_at ON polls(created_at DESC);
CREATE INDEX idx_polls_expires_at ON polls(expires_at);
```

**Constraints:**
- PK: `id` (unique identifier, format: `poll-[timestamp]-[random]`)
- NOT NULL: `question`, `poll_type`
- DEFAULT: `status = 'draft'`
- CHECK: `poll_type IN ('single', 'ranking', 'wordcloud')`
- CHECK: `status IN ('draft', 'open', 'closed', 'archived')`

**Usage Notes:**
- **Immutable:** Once `closed_at` is set, poll cannot be modified
- **Options:** Stored as JSON array for flexibility
- **Visibility:** `visible_to_roles` controls who can see/vote on poll

**Sample Data:**
```sql
INSERT INTO polls (id, question, poll_type, options, status)
VALUES (
  'poll-001',
  'Which framework do you prefer?',
  'single',
  '["React", "Vue", "Angular"]'::json,
  'open'
);
```

---

### Table: `submissions`

**Purpose:** Individual poll responses (votes)

**Schema:**
```sql
CREATE TABLE submissions (
  id VARCHAR(100) PRIMARY KEY,

  -- Foreign keys
  poll_id VARCHAR(100) NOT NULL REFERENCES polls(id),
  user_id VARCHAR(255) NOT NULL REFERENCES users(id),

  -- The response
  answer TEXT NOT NULL,  -- For all types
  answer_json JSON,      -- For complex types (ranking, etc.)

  -- For ranking polls
  ranking JSON,          -- ["A", "B", "C"]

  -- For wordcloud polls
  word_text VARCHAR(255),

  -- Metadata
  submitted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  submission_order INTEGER,  -- When submitted relative to others

  -- Audit
  ip_address INET,
  user_agent TEXT
);
```

**Indexes:**
```sql
CREATE INDEX idx_submissions_poll_id ON submissions(poll_id);
CREATE INDEX idx_submissions_user_id ON submissions(user_id);
CREATE UNIQUE INDEX idx_submissions_poll_user ON submissions(poll_id, user_id);
  -- Ensures one submission per user per poll
CREATE INDEX idx_submissions_submitted_at ON submissions(submitted_at DESC);
```

**Constraints:**
- PK: `id` (unique submission identifier)
- FK: `poll_id` → `polls(id)` (RESTRICT delete - can't delete poll with submissions)
- FK: `user_id` → `users(id)` (CASCADE delete - delete user's submissions)
- UNIQUE: `(poll_id, user_id)` (one vote per user per poll)
- NOT NULL: `poll_id`, `user_id`, `answer`
- DEFAULT: `submitted_at = now()`

**Immutability:**
```sql
-- Submissions cannot be updated after creation
CREATE TRIGGER prevent_submission_updates
BEFORE UPDATE ON submissions
FOR EACH ROW
EXECUTE FUNCTION raise_immutable_error();
```

**Usage Notes:**
- **Immutable:** Once submitted, cannot be edited or deleted
- **One per user per poll:** Enforced by unique constraint
- **Audit trail:** `submitted_at`, `ip_address`, `user_agent` track who/when/where

**Sample Data:**
```sql
INSERT INTO submissions (id, poll_id, user_id, answer)
VALUES ('sub-001', 'poll-001', '123456_device1', 'React');
```

---

### Table: `assessments`

**Purpose:** Phase assessments and expert reviews

**Schema:**
```sql
CREATE TABLE assessments (
  id VARCHAR(100) PRIMARY KEY,

  -- Foreign keys
  poll_id VARCHAR(100) NOT NULL REFERENCES polls(id),
  reviewer_id VARCHAR(255) NOT NULL REFERENCES users(id),

  -- Assessment phase
  phase VARCHAR(50) NOT NULL,  -- phase-1, phase-2, etc.

  -- Scoring
  overall_grade FLOAT,  -- 0-100
  feedback TEXT,

  -- Components (JSON for flexibility)
  component_scores JSON,  -- {"analysis": 8.5, "relevance": 9.0}

  -- Lifecycle
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  submitted_at TIMESTAMP WITH TIME ZONE
);
```

**Indexes:**
```sql
CREATE INDEX idx_assessments_poll_id ON assessments(poll_id);
CREATE INDEX idx_assessments_reviewer_id ON assessments(reviewer_id);
CREATE INDEX idx_assessments_phase ON assessments(phase);
CREATE UNIQUE INDEX idx_assessments_poll_reviewer_phase
  ON assessments(poll_id, reviewer_id, phase);
```

**Constraints:**
- PK: `id`
- FK: `poll_id` → `polls(id)`
- FK: `reviewer_id` → `users(id)`
- UNIQUE: `(poll_id, reviewer_id, phase)` (one assessment per reviewer per poll per phase)
- NOT NULL: `poll_id`, `reviewer_id`, `phase`
- CHECK: `overall_grade BETWEEN 0 AND 100`

**Sample Data:**
```sql
INSERT INTO assessments (id, poll_id, reviewer_id, phase, overall_grade)
VALUES ('asst-001', 'poll-001', 'admin-123', 'phase-1', 85.5);
```

---

### Table: `regulatory_reviews`

**Purpose:** Regulatory documents and approval tracking

**Schema:**
```sql
CREATE TABLE regulatory_reviews (
  id VARCHAR(100) PRIMARY KEY,

  -- Document
  document_id VARCHAR(100) UNIQUE NOT NULL,
  title VARCHAR(255) NOT NULL,
  document_type VARCHAR(100),  -- policy, guidance, assessment

  -- File storage (Supabase Storage)
  file_path VARCHAR(500),
  file_size INT,
  file_type VARCHAR(50),  -- pdf, docx, txt

  -- Metadata
  version VARCHAR(20) DEFAULT '1.0',
  status VARCHAR(50) DEFAULT 'pending',  -- pending, approved, rejected, archived

  -- Submission
  submitted_by VARCHAR(255) NOT NULL REFERENCES users(id),
  submitted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

  -- Review
  reviewed_by VARCHAR(255) REFERENCES users(id),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  review_comments TEXT,

  -- Lifecycle
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  archived_at TIMESTAMP WITH TIME ZONE
);
```

**Indexes:**
```sql
CREATE INDEX idx_regulatory_reviews_status ON regulatory_reviews(status);
CREATE INDEX idx_regulatory_reviews_type ON regulatory_reviews(document_type);
CREATE INDEX idx_regulatory_reviews_submitted_at ON regulatory_reviews(submitted_at DESC);
```

**Constraints:**
- PK: `id`
- FK: `submitted_by` → `users(id)`
- FK: `reviewed_by` → `users(id)` (nullable)
- UNIQUE: `document_id`
- NOT NULL: `document_id`, `title`, `submitted_by`

**Sample Data:**
```sql
INSERT INTO regulatory_reviews (id, document_id, title, document_type, submitted_by)
VALUES ('rev-001', 'doc-001', 'Data Protection Policy', 'policy', 'user-123');
```

---

## Relationships & Foreign Keys

### User → Submissions (1:N)
```sql
CONSTRAINT fk_submissions_user_id
FOREIGN KEY (user_id) REFERENCES users(id)
ON DELETE CASCADE  -- Delete user's submissions when user deleted
ON UPDATE CASCADE
```

**Effect:** When user is deleted, all their submissions are deleted

### Poll → Submissions (1:N)
```sql
CONSTRAINT fk_submissions_poll_id
FOREIGN KEY (poll_id) REFERENCES polls(id)
ON DELETE RESTRICT  -- Cannot delete poll with submissions
ON UPDATE CASCADE
```

**Effect:** Protects poll data integrity (can't delete poll with votes)

### User → Assessments (1:N)
```sql
CONSTRAINT fk_assessments_reviewer_id
FOREIGN KEY (reviewer_id) REFERENCES users(id)
ON DELETE SET NULL  -- Keep assessment record, clear reviewer
ON UPDATE CASCADE
```

**Effect:** Preserves assessment history even if reviewer removed

### Poll → Assessments (1:N)
```sql
CONSTRAINT fk_assessments_poll_id
FOREIGN KEY (poll_id) REFERENCES polls(id)
ON DELETE CASCADE  -- Delete assessments if poll deleted
ON UPDATE CASCADE
```

**Effect:** Assessments tied to poll lifecycle

---

## Data Integrity Rules

### Submission Immutability
```sql
-- Prevent any updates to submitted data
CREATE TRIGGER submissions_immutable_trigger
BEFORE UPDATE ON submissions
FOR EACH ROW
EXECUTE FUNCTION fn_raise_immutable_error('Submissions are immutable');
```

**Why:** Regulatory compliance - audit trail must be permanent

### Poll Closure Enforcement
```sql
-- Cannot accept new submissions to closed polls
CREATE TRIGGER check_poll_open
BEFORE INSERT ON submissions
FOR EACH ROW
WHEN (NEW.poll_id IN (
  SELECT id FROM polls WHERE status = 'closed'
))
EXECUTE FUNCTION fn_prevent_insert('Cannot submit to closed poll');
```

**Why:** Poll integrity - can't vote after poll closes

### One Vote Per User Per Poll
```sql
-- Unique constraint on (poll_id, user_id) enforces this
-- Attempt to vote twice results in:
-- ERROR: duplicate key value violates unique constraint "idx_submissions_poll_user"
```

**Why:** Poll validity - each user counted once

### Role-Based Access Control (RLS)
```sql
-- Voters can only see polls meant for their role
CREATE POLICY poll_visibility ON polls
USING (
  visible_to_roles IS NULL OR  -- NULL = visible to all
  current_user_role = ANY(visible_to_roles)
);
```

**Why:** Different poll visibility for different roles

---

## Indexes & Performance

### Why Indexes Matter

Index on `polls(status)`:
```sql
-- Without index: scan all 150 polls → 150ms
SELECT * FROM polls WHERE status = 'open';

-- With index: seek to "open" polls → 5ms
CREATE INDEX idx_polls_status ON polls(status);
```

### Index Guidelines

**Create index when:**
- Column is in WHERE clause: `WHERE poll_id = ?`
- Column is in JOIN condition: `ON submissions.poll_id = polls.id`
- Column is in ORDER BY: `ORDER BY created_at DESC`
- Column is in GROUP BY: `GROUP BY user_role`

**Don't index when:**
- Column has few unique values: `is_active` (only true/false)
- Table is very small: < 1000 rows
- Column is rarely queried
- Write performance matters more

### Current Indexes
```sql
-- Users
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(user_role);

-- Polls
CREATE INDEX idx_polls_status ON polls(status);
CREATE INDEX idx_polls_type ON polls(poll_type);
CREATE INDEX idx_polls_created_at ON polls(created_at DESC);

-- Submissions
CREATE UNIQUE INDEX idx_submissions_poll_user ON submissions(poll_id, user_id);
CREATE INDEX idx_submissions_poll_id ON submissions(poll_id);
CREATE INDEX idx_submissions_user_id ON submissions(user_id);

-- Assessments
CREATE UNIQUE INDEX idx_assessments_poll_reviewer_phase
  ON assessments(poll_id, reviewer_id, phase);
```

### Query Optimization Example

**Slow Query (no index):**
```sql
-- Scans ALL 50,000 submissions
SELECT COUNT(*) FROM submissions WHERE poll_id = 'poll-123';
-- Time: 500ms
```

**Fast Query (with index):**
```sql
-- Uses index, seeks to matching rows
CREATE INDEX idx_submissions_poll_id ON submissions(poll_id);
SELECT COUNT(*) FROM submissions WHERE poll_id = 'poll-123';
-- Time: 5ms (100x faster!)
```

---

## Common Queries

### Get Poll Results
```sql
-- Count votes per option
SELECT
  answer as option,
  COUNT(*) as vote_count,
  ROUND(100.0 * COUNT(*) /
    (SELECT COUNT(*) FROM submissions WHERE poll_id = 'poll-123'), 1) as percentage
FROM submissions
WHERE poll_id = 'poll-123'
GROUP BY answer
ORDER BY vote_count DESC;
```

### Check User Has Voted
```sql
-- Returns true if user voted, false otherwise
SELECT EXISTS(
  SELECT 1 FROM submissions
  WHERE poll_id = 'poll-123' AND user_id = 'user-456'
) as has_voted;
```

### Get All Submissions for Export
```sql
-- Join user and submission data
SELECT
  u.email,
  u.user_role,
  s.answer,
  s.submitted_at
FROM submissions s
JOIN users u ON s.user_id = u.id
WHERE s.poll_id = 'poll-123'
ORDER BY s.submitted_at;
```

### Identify Slow Queries
```sql
-- Find queries taking > 1 second
SELECT
  query,
  calls,
  total_time,
  mean_time
FROM pg_stat_statements
WHERE mean_time > 1000
ORDER BY mean_time DESC
LIMIT 10;
```

---

## Migration Procedures

### Adding a New Column

**Safe procedure:**
```bash
# 1. Create migration file
npx supabase migration new add_new_column

# 2. Edit migration file (generated in migrations/)
ALTER TABLE polls ADD COLUMN new_field VARCHAR(255) DEFAULT NULL;

# 3. Test locally
npx supabase db push

# 4. Commit and deploy
git add migrations/
git commit -m "feat: add new_field to polls"
npm run build && git push

# 5. Verify in production
psql -h [prod-host] -d [db_name] -c "SELECT new_field FROM polls LIMIT 1;"
```

### Modifying a Column Type

**More complex - requires data migration:**
```sql
-- 1. Create new column with target type
ALTER TABLE users ADD COLUMN email_new VARCHAR(255);

-- 2. Copy/transform data
UPDATE users SET email_new = CAST(email AS VARCHAR(255));

-- 3. Drop old column (after verification)
ALTER TABLE users DROP COLUMN email CASCADE;

-- 4. Rename new column
ALTER TABLE users RENAME COLUMN email_new TO email;

-- 5. Re-add constraints
ALTER TABLE users ADD CONSTRAINT email_unique UNIQUE (email);
```

### Adding an Index (No Downtime)

```sql
-- Create index concurrently (doesn't lock table)
CREATE INDEX CONCURRENTLY idx_polls_status ON polls(status);

-- Verify index was created
SELECT * FROM pg_stat_user_indexes WHERE relname = 'polls';
```

---

## Backup & Recovery

### Automated Backups
- **Daily:** Kept for 7 days (Supabase default)
- **Weekly:** Kept for 4 weeks
- **Monthly:** Kept indefinitely

### Restore from Backup
```bash
# Via Supabase UI:
# 1. Dashboard → [Project] → Database → Backups
# 2. Select desired backup
# 3. Click "Restore"
# 4. Confirm (database will be unavailable for 1-2 minutes)

# Via CLI:
npx supabase db push --remote  # Applies current migrations to production
```

### Point-in-Time Recovery
```bash
# Restore to specific timestamp (within 24 hours)
# Requires Supabase support or use console
```

---

## Row-Level Security (RLS)

### Concept
RLS ensures users can only see/modify data they have permission to access.

### Example: Users Can Only See Their Own Submissions
```sql
CREATE POLICY submissions_user_isolation ON submissions
USING (user_id = current_user_id);
-- User only sees their own submissions
-- User cannot see other users' votes
```

### Example: Only Reviewers Can Approve Documents
```sql
CREATE POLICY assessments_reviewer_only ON assessments
USING (
  current_user_role = 'admin' OR
  reviewer_id = current_user_id
)
WITH CHECK (
  current_user_role = 'admin'
);
```

---

## Size & Growth Projections

**Current Database Size:** ~100MB
**Expected Growth:** ~50MB/year

| Table | Current Rows | Projected Year 1 | Disk Usage |
|---|---|---|---|
| users | 500 | 1000 | 1MB |
| polls | 150 | 200 | 5MB |
| submissions | 15,000 | 100,000 | 50MB |
| assessments | 100 | 500 | 2MB |
| regulatory_reviews | 200 | 500 | 100MB (includes files) |

**Upgrade Path:**
- Current: 8GB (Supabase default)
- Year 1: 8GB sufficient
- Year 2+: Monitor, upgrade if > 6GB usage

---

## Performance Baseline

**Typical Query Performance:**
- Simple SELECT: 5-10ms
- Aggregation (COUNT, GROUP BY): 50-200ms
- Complex JOIN: 100-500ms
- Full table scan: 500-2000ms (want to avoid)

**Target**: All queries < 1 second for user-facing endpoints

---

**Last Updated:** 2026-01-26
**Maintained by:** Database Administrator
**Review Cycle:** Quarterly
