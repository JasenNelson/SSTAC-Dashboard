-- Wordcloud Poll Database Schema
-- Comprehensive database structure for wordcloud polling functionality
-- Follows existing poll system patterns and RLS security model

-- ============================================================================
-- WORDCLOUD POLL SYSTEM SCHEMA
-- ============================================================================

-- Wordcloud polls table to store wordcloud poll questions and settings
CREATE TABLE IF NOT EXISTS wordcloud_polls (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    page_path VARCHAR(255) NOT NULL, -- e.g., '/survey-results/tiered-framework'
    poll_index INTEGER NOT NULL, -- 0-based index of poll on the page
    question TEXT NOT NULL,
    max_words INTEGER NOT NULL DEFAULT 3, -- How many words each user can submit (1-3)
    word_limit INTEGER NOT NULL DEFAULT 20, -- Character limit per word
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(page_path, poll_index)
);

-- Enable RLS on wordcloud_polls
ALTER TABLE wordcloud_polls ENABLE ROW LEVEL SECURITY;

-- RLS policies for wordcloud_polls
CREATE POLICY "Anyone can view wordcloud polls" ON wordcloud_polls
    FOR SELECT USING (true);

CREATE POLICY "Admins can manage wordcloud polls" ON wordcloud_polls
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_roles 
            WHERE user_id = auth.uid() AND role = 'admin'
        )
    );

-- Wordcloud votes table to store individual word submissions
CREATE TABLE IF NOT EXISTS wordcloud_votes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    poll_id UUID NOT NULL REFERENCES wordcloud_polls(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL, -- UUID for authenticated users, CEW code for conference
    words TEXT[] NOT NULL, -- Array of submitted words (1-3 words)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(poll_id, user_id) -- One submission per user per poll
);

-- Enable RLS on wordcloud_votes
ALTER TABLE wordcloud_votes ENABLE ROW LEVEL SECURITY;

-- RLS policies for wordcloud_votes
CREATE POLICY "Users can view their own wordcloud votes" ON wordcloud_votes
    FOR SELECT USING (
        user_id = auth.uid()::text OR 
        user_id LIKE 'CEW%' -- Allow CEW conference attendees
    );

CREATE POLICY "Users can create wordcloud votes" ON wordcloud_votes
    FOR INSERT WITH CHECK (
        user_id = auth.uid()::text OR 
        user_id LIKE 'CEW%' -- Allow CEW conference attendees
    );

CREATE POLICY "Users can update their own wordcloud votes" ON wordcloud_votes
    FOR UPDATE USING (
        user_id = auth.uid()::text OR 
        user_id LIKE 'CEW%' -- Allow CEW conference attendees
    );

CREATE POLICY "Users can delete their own wordcloud votes" ON wordcloud_votes
    FOR DELETE USING (
        user_id = auth.uid()::text OR 
        user_id LIKE 'CEW%' -- Allow CEW conference attendees
    );

CREATE POLICY "Admins can manage all wordcloud votes" ON wordcloud_votes
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_roles 
            WHERE user_id = auth.uid() AND role = 'admin'
        )
    );

-- Wordcloud results view for aggregated word frequency data
CREATE OR REPLACE VIEW wordcloud_results AS
SELECT 
    wp.id as poll_id,
    wp.page_path,
    wp.poll_index,
    wp.question,
    wp.max_words,
    wp.word_limit,
    COUNT(DISTINCT wv.user_id) as total_votes,
    word_data.word,
    word_data.frequency,
    word_data.percentage
FROM wordcloud_polls wp
LEFT JOIN wordcloud_votes wv ON wp.id = wv.poll_id
LEFT JOIN LATERAL (
    SELECT 
        unnest(wv.words) as word,
        COUNT(*) as frequency,
        ROUND((COUNT(*)::float / (SELECT COUNT(*) FROM wordcloud_votes wv3 WHERE wv3.poll_id = wp.id)) * 100, 2) as percentage
    FROM wordcloud_votes wv2 
    WHERE wv2.poll_id = wp.id
    GROUP BY unnest(wv2.words)
) word_data ON true
GROUP BY wp.id, wp.page_path, wp.poll_index, wp.question, wp.max_words, wp.word_limit, word_data.word, word_data.frequency, word_data.percentage
ORDER BY word_data.frequency DESC;

-- Enable RLS on wordcloud_results view
ALTER VIEW wordcloud_results SET (security_invoker = on);

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Helper function to get or create wordcloud poll
CREATE OR REPLACE FUNCTION get_or_create_wordcloud_poll(
    p_page_path VARCHAR(255),
    p_poll_index INTEGER,
    p_question TEXT,
    p_max_words INTEGER DEFAULT 3,
    p_word_limit INTEGER DEFAULT 20
) RETURNS UUID AS $$
DECLARE
    poll_id UUID;
BEGIN
    -- Try to get existing poll
    SELECT id INTO poll_id
    FROM wordcloud_polls
    WHERE page_path = p_page_path AND poll_index = p_poll_index;
    
    -- If poll doesn't exist, create it
    IF poll_id IS NULL THEN
        INSERT INTO wordcloud_polls (page_path, poll_index, question, max_words, word_limit)
        VALUES (p_page_path, p_poll_index, p_question, p_max_words, p_word_limit)
        RETURNING id INTO poll_id;
    END IF;
    
    RETURN poll_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to get wordcloud poll results
CREATE OR REPLACE FUNCTION get_wordcloud_poll_results(
    p_page_path VARCHAR(255),
    p_poll_index INTEGER,
    p_user_id TEXT DEFAULT NULL
) RETURNS TABLE (
    poll_id UUID,
    question TEXT,
    max_words INTEGER,
    word_limit INTEGER,
    total_votes BIGINT,
    words JSONB,
    user_words TEXT[]
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        wr.poll_id,
        wr.question,
        wr.max_words,
        wr.word_limit,
        wr.total_votes,
        COALESCE(
            jsonb_agg(
                jsonb_build_object(
                    'text', wr.word,
                    'value', wr.frequency
                ) ORDER BY wr.frequency DESC
            ) FILTER (WHERE wr.word IS NOT NULL),
            '[]'::jsonb
        ) as words,
        CASE 
            WHEN p_user_id IS NOT NULL THEN
                (SELECT wv.words FROM wordcloud_votes wv 
                 WHERE wv.poll_id = wr.poll_id AND wv.user_id = p_user_id)
            ELSE NULL
        END as user_words
    FROM wordcloud_results wr
    WHERE wr.page_path = p_page_path AND wr.poll_index = p_poll_index
    GROUP BY wr.poll_id, wr.question, wr.max_words, wr.word_limit, wr.total_votes;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

-- Index on wordcloud_polls for fast lookups
CREATE INDEX IF NOT EXISTS idx_wordcloud_polls_page_path_poll_index 
ON wordcloud_polls(page_path, poll_index);

-- Index on wordcloud_votes for fast lookups
CREATE INDEX IF NOT EXISTS idx_wordcloud_votes_poll_id 
ON wordcloud_votes(poll_id);

CREATE INDEX IF NOT EXISTS idx_wordcloud_votes_user_id 
ON wordcloud_votes(user_id);

-- Index on wordcloud_votes for word frequency queries
CREATE INDEX IF NOT EXISTS idx_wordcloud_votes_words_gin 
ON wordcloud_votes USING GIN(words);

-- ============================================================================
-- TRIGGERS FOR UPDATED_AT
-- ============================================================================

-- Trigger to update updated_at on wordcloud_polls
CREATE OR REPLACE FUNCTION update_wordcloud_polls_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_wordcloud_polls_updated_at
    BEFORE UPDATE ON wordcloud_polls
    FOR EACH ROW
    EXECUTE FUNCTION update_wordcloud_polls_updated_at();

-- ============================================================================
-- SAMPLE DATA FOR TESTING
-- ============================================================================

-- Insert sample wordcloud poll for tiered framework
INSERT INTO wordcloud_polls (page_path, poll_index, question, max_words, word_limit) VALUES
('/survey-results/tiered-framework', 11, 'Overall, what is the greatest barrier to advancing holistic sediment protection in BC?', 3, 20),
('/cew-polls/tiered-framework', 11, 'Overall, what is the greatest barrier to advancing holistic sediment protection in BC?', 3, 20);

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Verify tables were created
SELECT 'wordcloud_polls' as table_name, 'EXISTS' as status 
FROM information_schema.tables 
WHERE table_schema = 'public' AND table_name = 'wordcloud_polls'
UNION ALL
SELECT 'wordcloud_votes' as table_name, 'EXISTS' as status 
FROM information_schema.tables 
WHERE table_schema = 'public' AND table_name = 'wordcloud_votes'
UNION ALL
SELECT 'wordcloud_results' as view_name, 'EXISTS' as status 
FROM information_schema.views 
WHERE table_schema = 'public' AND view_name = 'wordcloud_results';

-- Verify functions were created
SELECT 'get_or_create_wordcloud_poll' as function_name, 'EXISTS' as status 
FROM information_schema.routines 
WHERE routine_name = 'get_or_create_wordcloud_poll'
UNION ALL
SELECT 'get_wordcloud_poll_results' as function_name, 'EXISTS' as status 
FROM information_schema.routines 
WHERE routine_name = 'get_wordcloud_poll_results';

-- Verify RLS policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE tablename IN ('wordcloud_polls', 'wordcloud_votes')
ORDER BY tablename, policyname;
