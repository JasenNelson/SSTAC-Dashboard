-- ============================================================================
-- BATCH 1: App tables (admin pages + TWG review portal).
--   Creates user_roles, tags, documents, announcements, milestones, discussions,
--   discussion_replies, review_submissions, review_files, likes + RLS + indexes.
--   The documents / review_files blocks use the verified LIVE-CODE column contract
--   (not the stale database_schema.sql DDL) and relax the legacy NOT NULLs.
-- Idempotent: safe to run even if already applied. Every table is
--   CREATE TABLE IF NOT EXISTS, every index IF NOT EXISTS, every policy DO-guarded
--   (EXCEPTION WHEN duplicate_object), the NOT-NULL relax is conditional. Run first
--   (this is the foundation; Batches 2, 3, 7, 9, 10 depend on these tables).
-- Needed-if: STEP 0 probe 1b any present=false, OR 1h drift on documents/review_files.
-- Source: DEMO_BLOCKER_RESOLUTION_KIT_2026_06_04.md Remedy B (verbatim guarded block).
-- ============================================================================

-- == Remedy B: app tables (admin pages + TWG review). Idempotent; safe to run twice. ==
-- Excludes the sample-data INSERTs (duplicate demo content) and the broad
-- GRANT INSERT/UPDATE/DELETE ON ALL TABLES (privilege broadening) from database_schema.sql.

-- 1) user_roles (gates /admin)
CREATE TABLE IF NOT EXISTS user_roles (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('admin', 'member')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, role)
);
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "Users can view their own roles" ON user_roles FOR SELECT USING (auth.uid() = user_id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Admins can manage all roles" ON user_roles FOR ALL USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role ON user_roles(role);

-- 2) tags
CREATE TABLE IF NOT EXISTS tags (
    id BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    color TEXT NOT NULL DEFAULT '#6B7280',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by TEXT
);
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "Anyone can view tags" ON tags FOR SELECT USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Admins can manage tags" ON tags FOR ALL USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS idx_tags_name ON tags(name);
CREATE INDEX IF NOT EXISTS idx_tags_created_at ON tags(created_at);

-- 3) documents (rev2 2026-06-05 per codex Leg-2 round 2)
-- WARNING: database_schema.sql:282-289 (and the prior version of this block) is STALE vs the LIVE
--   code for documents. The live create path INSERTs user_id + user_email
--   (src/app/(dashboard)/twg/documents/actions.ts:69-76: { title, file_url, description, user_id,
--    user_email }), but neither the schema doc nor the prior Remedy B DDL defined those two columns.
--   Creating documents from the stale DDL makes the table PRESENT while the admin "create document"
--   action 500s (column user_id / user_email not found). Live reads use file_url/description/
--   created_at (twg/documents/[id]/edit/page.tsx:46) -- those are unchanged. The two columns are
--   added below (nullable, so existing rows + SELECT * reads are unaffected).
--   FOLLOW-UP BACKLOG: fold user_id/user_email into database_schema.sql:282 so the doc stops drifting.
CREATE TABLE IF NOT EXISTS documents (
    id BIGSERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    file_url TEXT NOT NULL,
    tag TEXT,
    user_id UUID REFERENCES auth.users(id),
    user_email TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
-- Defensive: if documents already exists from the stale DDL, add the live columns so the create
-- action stops erroring. No-ops when the table was just created with the live contract above.
ALTER TABLE documents ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);
ALTER TABLE documents ADD COLUMN IF NOT EXISTS user_email TEXT;
-- NOT-NULL audit (rev3 2026-06-05 per codex Leg-2 round 3): the stale documents DDL
-- (database_schema.sql:282-289) has only two NOT-NULL-without-default columns, title and file_url,
-- and the live insert (actions.ts:69-76) supplies BOTH. No legacy NOT NULL column is omitted by the
-- live insert, so -- unlike review_files -- there is NOTHING to relax here; the two ADD COLUMNs above
-- (added nullable) are the only drift fix documents needs.
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "Anyone can view documents" ON documents FOR SELECT USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Admins can manage all documents" ON documents FOR ALL USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS idx_documents_created_at ON documents(created_at);
CREATE INDEX IF NOT EXISTS idx_documents_tag ON documents(tag);

-- 4) announcements
CREATE TABLE IF NOT EXISTS announcements (
    id BIGSERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    priority TEXT NOT NULL CHECK (priority IN ('low', 'medium', 'high')),
    is_active BOOLEAN DEFAULT true,
    created_by TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "Anyone can view active announcements" ON announcements FOR SELECT USING (is_active = true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Admins can manage all announcements" ON announcements FOR ALL USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS idx_announcements_is_active ON announcements(is_active);
CREATE INDEX IF NOT EXISTS idx_announcements_priority ON announcements(priority);
CREATE INDEX IF NOT EXISTS idx_announcements_created_at ON announcements(created_at);

-- 5) milestones
CREATE TABLE IF NOT EXISTS milestones (
    id BIGSERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    target_date DATE NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('pending', 'in_progress', 'completed', 'delayed')),
    priority TEXT NOT NULL CHECK (priority IN ('low', 'medium', 'high')),
    created_by TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
ALTER TABLE milestones ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "Anyone can view milestones" ON milestones FOR SELECT USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Admins can manage all milestones" ON milestones FOR ALL USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS idx_milestones_target_date ON milestones(target_date);
CREATE INDEX IF NOT EXISTS idx_milestones_status ON milestones(status);
CREATE INDEX IF NOT EXISTS idx_milestones_priority ON milestones(priority);

-- 6) discussions
CREATE TABLE IF NOT EXISTS discussions (
    id BIGSERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    user_id UUID REFERENCES auth.users(id),
    user_email TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
ALTER TABLE discussions ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "Anyone can view discussions" ON discussions FOR SELECT USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Users can create discussions" ON discussions FOR INSERT WITH CHECK (auth.uid() = user_id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Users can update their own discussions" ON discussions FOR UPDATE USING (auth.uid() = user_id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Users can delete their own discussions" ON discussions FOR DELETE USING (auth.uid() = user_id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Admins can manage all discussions" ON discussions FOR ALL USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS idx_discussions_user_id ON discussions(user_id);
CREATE INDEX IF NOT EXISTS idx_discussions_created_at ON discussions(created_at);

-- 7) discussion_replies
CREATE TABLE IF NOT EXISTS discussion_replies (
    id BIGSERIAL PRIMARY KEY,
    discussion_id BIGINT NOT NULL REFERENCES discussions(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    user_id UUID REFERENCES auth.users(id),
    user_email TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
ALTER TABLE discussion_replies ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "Anyone can view replies" ON discussion_replies FOR SELECT USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Users can create replies" ON discussion_replies FOR INSERT WITH CHECK (auth.uid() = user_id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Users can update their own replies" ON discussion_replies FOR UPDATE USING (auth.uid() = user_id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Users can delete their own replies" ON discussion_replies FOR DELETE USING (auth.uid() = user_id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Admins can manage all replies" ON discussion_replies FOR ALL USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS idx_discussion_replies_discussion_id ON discussion_replies(discussion_id);
CREATE INDEX IF NOT EXISTS idx_discussion_replies_user_id ON discussion_replies(user_id);
CREATE INDEX IF NOT EXISTS idx_discussion_replies_created_at ON discussion_replies(created_at);

-- 8) review_submissions (TWG review portal)
CREATE TABLE IF NOT EXISTS review_submissions (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    status TEXT NOT NULL CHECK (status IN ('IN_PROGRESS', 'SUBMITTED')),
    form_data JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
ALTER TABLE review_submissions ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "Users can view their own submissions" ON review_submissions FOR SELECT USING (auth.uid() = user_id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Users can create their own submissions" ON review_submissions FOR INSERT WITH CHECK (auth.uid() = user_id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Users can update their own submissions" ON review_submissions FOR UPDATE USING (auth.uid() = user_id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Admins can view all submissions" ON review_submissions FOR SELECT USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 9) review_files (TWG review uploads) (rev2 2026-06-05 per codex Leg-2 round 2)
-- WARNING: database_schema.sql:480-488 is STALE vs the LIVE code for review_files. It defines
--   file_name / mime_type / created_at, but origin/main's upload route INSERTs
--   filename / mimetype / file_size (src/app/api/review/upload/route.ts:105-111) and the admin
--   synthesis page SELECTs filename / mimetype / uploaded_at via aliases
--   (src/app/(dashboard)/admin/twg-synthesis/page.tsx:59:
--    'id, submission_id, file_name:filename, file_path, mime_type:mimetype, file_size,
--     created_at:uploaded_at'). The route test asserts the same insert shape
--   (src/app/api/review/upload/__tests__/route.test.ts:322-325). Creating the table from the STALE
--   schema-doc DDL makes review_files PRESENT while /api/review/upload STILL 500s (column not found)
--   and the admin synthesis SELECT errors. The block below creates the LIVE-CODE contract instead.
--   FOLLOW-UP BACKLOG: reconcile database_schema.sql:480 with the live filename/mimetype/uploaded_at
--   columns (and add a forward migration) so the schema doc stops drifting. Do NOT use its DDL here.
CREATE TABLE IF NOT EXISTS review_files (
    id BIGSERIAL PRIMARY KEY,
    submission_id BIGINT NOT NULL REFERENCES review_submissions(id) ON DELETE CASCADE,
    filename TEXT NOT NULL,
    file_path TEXT NOT NULL,
    mimetype TEXT NOT NULL,
    file_size BIGINT NOT NULL,
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
-- Defensive: if review_files already exists from the STALE schema-doc DDL (file_name/mime_type/
-- created_at), add the live columns so the upload route + admin SELECT stop erroring. These ADDs are
-- no-ops when the table was just created with the live contract above. Manual follow-up may still be
-- needed to backfill/drop the stale columns; this only un-blocks the demo path.
ALTER TABLE review_files ADD COLUMN IF NOT EXISTS filename TEXT;
ALTER TABLE review_files ADD COLUMN IF NOT EXISTS mimetype TEXT;
ALTER TABLE review_files ADD COLUMN IF NOT EXISTS file_size BIGINT;
ALTER TABLE review_files ADD COLUMN IF NOT EXISTS uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
-- Defensive NOT-NULL RELAX (rev3 2026-06-05 per codex Leg-2 round 3): the STALE schema-doc DDL made
-- file_name and mime_type NOT NULL with no default, but the live upload route inserts only
-- filename/mimetype (route.ts:105-111) and never supplies file_name/mime_type -- so adding the live
-- columns alone is NOT enough: the INSERT still fails the legacy NOT NULL constraints. Each block
-- below drops NOT NULL only when the legacy column EXISTS and is currently NOT NULL, so it is a
-- no-op on a fresh schema created with the live contract above (the IF EXISTS guard) and idempotent
-- on re-run (once relaxed, is_nullable='YES' and the IF is skipped). We relax (not drop) the columns
-- to avoid touching existing data; backfilling/removing the stale columns is a manual follow-up.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
            WHERE table_schema='public' AND table_name='review_files'
              AND column_name='file_name' AND is_nullable='NO') THEN
    ALTER TABLE public.review_files ALTER COLUMN file_name DROP NOT NULL;
  END IF;
END $$;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
            WHERE table_schema='public' AND table_name='review_files'
              AND column_name='mime_type' AND is_nullable='NO') THEN
    ALTER TABLE public.review_files ALTER COLUMN mime_type DROP NOT NULL;
  END IF;
END $$;
ALTER TABLE review_files ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "Users can view files for their submissions" ON review_files FOR SELECT USING (EXISTS (SELECT 1 FROM review_submissions WHERE id = review_files.submission_id AND user_id = auth.uid())); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Users can create files for their submissions" ON review_files FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM review_submissions WHERE id = review_files.submission_id AND user_id = auth.uid())); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Admins can view all files" ON review_files FOR SELECT USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 10) likes
CREATE TABLE IF NOT EXISTS likes (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    discussion_id BIGINT REFERENCES discussions(id) ON DELETE CASCADE,
    reply_id BIGINT REFERENCES discussion_replies(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT like_target_check CHECK (
        (discussion_id IS NOT NULL AND reply_id IS NULL) OR
        (discussion_id IS NULL AND reply_id IS NOT NULL)
    ),
    UNIQUE(user_id, discussion_id, reply_id)
);
ALTER TABLE likes ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "Anyone can view likes" ON likes FOR SELECT USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Users can create their own likes" ON likes FOR INSERT WITH CHECK (auth.uid() = user_id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Users can delete their own likes" ON likes FOR DELETE USING (auth.uid() = user_id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Admins can manage all likes" ON likes FOR ALL USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS idx_likes_user_id ON likes(user_id);
CREATE INDEX IF NOT EXISTS idx_likes_discussion_id ON likes(discussion_id);
CREATE INDEX IF NOT EXISTS idx_likes_reply_id ON likes(reply_id);
CREATE INDEX IF NOT EXISTS idx_likes_created_at ON likes(created_at);
