-- ============================================================================
-- BATCH 4: CEW poll tables + submit helper functions. Creates the 6 CEW poll
--   tables (polls, poll_votes, ranking_polls, ranking_votes, wordcloud_polls,
--   wordcloud_votes) + RLS + the 3 get_or_create_* helper functions the
--   poll-submit routes call before any vote insert (a project can have all 6
--   tables yet 500 on submit because a helper function is missing).
-- Idempotent: safe to run even if already applied (CREATE TABLE IF NOT EXISTS,
--   DO-guarded policies, CREATE OR REPLACE FUNCTION). Independent surface -- run
--   any time after BATCH 1; only needed if you will demo CEW polls.
-- Needed-if: STEP 0 probe 1c OR 1c-2 any present=false.
-- Source: DEMO_BLOCKER_RESOLUTION_KIT_2026_06_04.md Remedy E (verbatim full block).
-- ============================================================================

-- == Remedy E: CEW poll tables. Idempotent; safe to run twice. ==
CREATE TABLE IF NOT EXISTS polls (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    page_path VARCHAR(255) NOT NULL,
    poll_index INTEGER NOT NULL,
    question TEXT NOT NULL,
    options JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS poll_votes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    poll_id UUID REFERENCES polls(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL,
    option_index INTEGER NOT NULL,
    other_text TEXT,
    voted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS unique_authenticated_poll_vote
ON poll_votes (poll_id, user_id)
WHERE user_id NOT LIKE '%session_%' AND user_id NOT LIKE '%CEW%';
CREATE TABLE IF NOT EXISTS ranking_polls (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    page_path VARCHAR(255) NOT NULL,
    poll_index INTEGER NOT NULL,
    question TEXT NOT NULL,
    options JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS wordcloud_polls (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    page_path VARCHAR(255) NOT NULL,
    poll_index INTEGER NOT NULL,
    question TEXT NOT NULL,
    max_words INTEGER DEFAULT 3,
    word_limit INTEGER DEFAULT 20,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS ranking_votes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    ranking_poll_id UUID REFERENCES ranking_polls(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL,
    option_index INTEGER NOT NULL,
    rank INTEGER NOT NULL,
    voted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS wordcloud_votes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    poll_id UUID REFERENCES wordcloud_polls(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL,
    word TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(poll_id, user_id, word)
);
ALTER TABLE polls ENABLE ROW LEVEL SECURITY;
ALTER TABLE poll_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE ranking_polls ENABLE ROW LEVEL SECURITY;
ALTER TABLE ranking_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE wordcloud_polls ENABLE ROW LEVEL SECURITY;
ALTER TABLE wordcloud_votes ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "Anyone can view polls" ON polls FOR SELECT USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Anyone can create polls" ON polls FOR INSERT WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Anyone can vote in polls" ON poll_votes FOR INSERT WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Anyone can view poll votes" ON poll_votes FOR SELECT USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Authenticated users can delete their own votes" ON poll_votes FOR DELETE USING (auth.uid()::text = user_id AND user_id NOT LIKE '%session_%' AND user_id NOT LIKE '%CEW%'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Anyone can view ranking polls" ON ranking_polls FOR SELECT USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Anyone can create ranking polls" ON ranking_polls FOR INSERT WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Anyone can vote in ranking polls" ON ranking_votes FOR INSERT WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Anyone can view ranking votes" ON ranking_votes FOR SELECT USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Authenticated users can delete their own ranking votes" ON ranking_votes FOR DELETE USING (auth.uid()::text = user_id AND user_id NOT LIKE '%session_%' AND user_id NOT LIKE '%CEW%'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Anyone can view wordcloud polls" ON wordcloud_polls FOR SELECT USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Anyone can create wordcloud polls" ON wordcloud_polls FOR INSERT WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Anyone can vote in wordcloud polls" ON wordcloud_votes FOR INSERT WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Anyone can view wordcloud votes" ON wordcloud_votes FOR SELECT USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Authenticated users can delete their own wordcloud votes" ON wordcloud_votes FOR DELETE USING (auth.uid()::text = user_id AND user_id NOT LIKE '%session_%' AND user_id NOT LIKE '%CEW%'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- == Remedy E (cont.): poll-submit HELPER FUNCTIONS (rev4 2026-06-05 per codex Leg-2 round 4). ==
-- Copied EXACTLY from database_schema.sql (get_or_create_poll 1189, get_or_create_ranking_poll
-- 1214, get_or_create_wordcloud_poll_fixed 1240). These are what the three /api/*-polls/submit
-- routes call BEFORE any vote insert; without them every poll submit 500s even with all six tables
-- present (see STEP 1 probe 1c-2). CREATE OR REPLACE is idempotent / safe to run twice. The bodies
-- are self-contained (they only touch the poll tables created above). The paired GRANT EXECUTE
-- statements are the EXACT ones database_schema.sql:1302-1304 pairs with these functions -- scoped
-- to authenticated, anon only (the live submit routes run anon for CEW live polling); no broad grant.
CREATE OR REPLACE FUNCTION get_or_create_poll(
    p_page_path TEXT,
    p_poll_index INTEGER,
    p_question TEXT,
    p_options JSONB
) RETURNS UUID AS $$
DECLARE
    poll_id UUID;
BEGIN
    -- Try to get existing poll
    SELECT id INTO poll_id 
    FROM polls 
    WHERE page_path = p_page_path AND poll_index = p_poll_index;
    
    -- Create poll if it doesn't exist
    IF poll_id IS NULL THEN
        INSERT INTO polls (page_path, poll_index, question, options)
        VALUES (p_page_path, p_poll_index, p_question, p_options)
        RETURNING id INTO poll_id;
    END IF;
    
    RETURN poll_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION get_or_create_ranking_poll(
    p_page_path TEXT,
    p_poll_index INTEGER,
    p_question TEXT,
    p_options JSONB
) RETURNS UUID AS $$
DECLARE
    poll_id UUID;
BEGIN
    -- Try to get existing ranking poll
    SELECT id INTO poll_id 
    FROM ranking_polls 
    WHERE page_path = p_page_path AND poll_index = p_poll_index;
    
    -- Create ranking poll if it doesn't exist
    IF poll_id IS NULL THEN
        INSERT INTO ranking_polls (page_path, poll_index, question, options)
        VALUES (p_page_path, p_poll_index, p_question, p_options)
        RETURNING id INTO poll_id;
    END IF;
    
    RETURN poll_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION get_or_create_wordcloud_poll_fixed(
    p_page_path VARCHAR(255),
    p_poll_index INTEGER,
    p_question TEXT,
    p_max_words INTEGER DEFAULT 3,
    p_word_limit INTEGER DEFAULT 20
) RETURNS UUID AS $$
DECLARE
    poll_id UUID;
BEGIN
    -- Try to find existing poll
    SELECT id INTO poll_id
    FROM wordcloud_polls
    WHERE page_path = p_page_path AND poll_index = p_poll_index;
    
    -- If not found, create new poll
    IF poll_id IS NULL THEN
        INSERT INTO wordcloud_polls (page_path, poll_index, question, max_words, word_limit)
        VALUES (p_page_path, p_poll_index, p_question, p_max_words, p_word_limit)
        RETURNING id INTO poll_id;
    END IF;
    
    RETURN poll_id;
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION get_or_create_poll TO authenticated, anon;
GRANT EXECUTE ON FUNCTION get_or_create_ranking_poll TO authenticated, anon;
GRANT EXECUTE ON FUNCTION get_or_create_wordcloud_poll_fixed TO authenticated, anon;
