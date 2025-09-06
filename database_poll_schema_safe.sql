-- SAFE Poll Database Schema for SSTAC & TWG Dashboard
-- This schema adds poll functionality WITHOUT affecting existing features
-- Follows DATABASE_SAFETY_PROTOCOL_POLLS.md guidelines

-- ============================================================================
-- PHASE 1: ISOLATED POLL SCHEMA CREATION
-- ============================================================================

-- Step 1: Create polls table (isolated, no conflicts)
CREATE TABLE IF NOT EXISTS polls (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    page_path VARCHAR(255) NOT NULL,
    poll_index INTEGER NOT NULL,
    question TEXT NOT NULL,
    options JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Step 2: Create poll_votes table (isolated, no conflicts)
CREATE TABLE IF NOT EXISTS poll_votes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    poll_id UUID REFERENCES polls(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    option_index INTEGER NOT NULL,
    voted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(poll_id, user_id)
);

-- Step 3: Create poll_results view (isolated, no conflicts)
CREATE OR REPLACE VIEW poll_results AS
SELECT 
    p.id as poll_id,
    p.page_path,
    p.poll_index,
    p.question,
    p.options,
    COUNT(pv.id) as total_votes,
    COALESCE(
        jsonb_agg(
            jsonb_build_object(
                'option_index', pv.option_index,
                'option_text', p.options->>pv.option_index,
                'votes', option_counts.vote_count
            ) ORDER BY pv.option_index
        ) FILTER (WHERE pv.id IS NOT NULL),
        '[]'::jsonb
    ) as results
FROM polls p
LEFT JOIN poll_votes pv ON p.id = pv.poll_id
LEFT JOIN (
    SELECT 
        poll_id, 
        option_index, 
        COUNT(*) as vote_count
    FROM poll_votes 
    GROUP BY poll_id, option_index
) option_counts ON p.id = option_counts.poll_id AND pv.option_index = option_counts.option_index
GROUP BY p.id, p.page_path, p.poll_index, p.question, p.options;

-- ============================================================================
-- PHASE 2: RLS POLICIES (NON-INTRUSIVE)
-- ============================================================================

-- Step 4: Enable RLS on new tables (safe)
ALTER TABLE polls ENABLE ROW LEVEL SECURITY;
ALTER TABLE poll_votes ENABLE ROW LEVEL SECURITY;

-- Step 5: Create RLS policies (isolated, no conflicts)
CREATE POLICY "Allow authenticated users to read polls" ON polls
    FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "Allow admin users to manage polls" ON polls
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM user_roles 
            WHERE user_id = auth.uid() AND role = 'admin'
        )
    );

CREATE POLICY "Allow users to vote on polls" ON poll_votes
    FOR INSERT TO authenticated
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Allow users to read their own votes" ON poll_votes
    FOR SELECT TO authenticated
    USING (user_id = auth.uid());

CREATE POLICY "Allow admin users to read all votes" ON poll_votes
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM user_roles 
            WHERE user_id = auth.uid() AND role = 'admin'
        )
    );

-- ============================================================================
-- PHASE 3: HELPER FUNCTIONS (NON-CONFLICTING)
-- ============================================================================

-- Step 6: Create poll helper functions (isolated)
CREATE OR REPLACE FUNCTION get_or_create_poll(
    p_page_path VARCHAR(255),
    p_poll_index INTEGER,
    p_question TEXT,
    p_options JSONB
) RETURNS UUID AS $$
DECLARE
    poll_id UUID;
BEGIN
    -- Try to find existing poll
    SELECT id INTO poll_id 
    FROM polls 
    WHERE page_path = p_page_path AND poll_index = p_poll_index;
    
    -- If not found, create new poll
    IF poll_id IS NULL THEN
        INSERT INTO polls (page_path, poll_index, question, options)
        VALUES (p_page_path, p_poll_index, p_question, p_options)
        RETURNING id INTO poll_id;
    END IF;
    
    RETURN poll_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION submit_poll_vote(
    p_poll_id UUID,
    p_option_index INTEGER
) RETURNS BOOLEAN AS $$
BEGIN
    -- Insert or update vote
    INSERT INTO poll_votes (poll_id, user_id, option_index)
    VALUES (p_poll_id, auth.uid(), p_option_index)
    ON CONFLICT (poll_id, user_id) 
    DO UPDATE SET 
        option_index = p_option_index,
        voted_at = NOW();
    
    RETURN TRUE;
EXCEPTION
    WHEN OTHERS THEN
        RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_poll_results(p_poll_id UUID)
RETURNS TABLE (
    total_votes BIGINT,
    results JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        pr.total_votes,
        pr.results
    FROM poll_results pr
    WHERE pr.poll_id = p_poll_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- PHASE 4: UPDATE TRIGGERS (MINIMAL IMPACT)
-- ============================================================================

-- Step 7: Add triggers for poll tables (isolated)
-- Note: Uses existing update_updated_at_column() function
CREATE TRIGGER update_polls_updated_at 
    BEFORE UPDATE ON polls 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Test poll creation
-- SELECT get_or_create_poll('/test', 0, 'Test Question', '["Option 1", "Option 2"]'::jsonb);

-- Test poll results view
-- SELECT * FROM poll_results LIMIT 5;

-- Verify new tables exist
-- SELECT table_name FROM information_schema.tables 
-- WHERE table_schema = 'public' AND table_name IN ('polls', 'poll_votes');

-- Verify new functions exist
-- SELECT routine_name FROM information_schema.routines 
-- WHERE routine_name IN ('get_or_create_poll', 'submit_poll_vote', 'get_poll_results');

-- Verify RLS policies exist
-- SELECT policyname FROM pg_policies 
-- WHERE tablename IN ('polls', 'poll_votes');
