-- SAFE Ranking Poll System - Separate from existing polls
-- This creates a completely separate system for ranking polls
-- No impact on existing single-choice poll functionality

-- ============================================================================
-- PHASE 1: CREATE SEPARATE RANKING POLL TABLES
-- ============================================================================

-- Create separate ranking polls table
CREATE TABLE IF NOT EXISTS ranking_polls (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    page_path VARCHAR(255) NOT NULL,
    poll_index INTEGER NOT NULL,
    question TEXT NOT NULL,
    options JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create separate ranking votes table
CREATE TABLE IF NOT EXISTS ranking_votes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    ranking_poll_id UUID REFERENCES ranking_polls(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    option_index INTEGER NOT NULL,
    rank INTEGER NOT NULL CHECK (rank >= 1),
    voted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(ranking_poll_id, user_id, option_index)
);

-- ============================================================================
-- PHASE 2: RLS POLICIES FOR RANKING SYSTEM
-- ============================================================================

-- Enable RLS on new tables
ALTER TABLE ranking_polls ENABLE ROW LEVEL SECURITY;
ALTER TABLE ranking_votes ENABLE ROW LEVEL SECURITY;

-- RLS policies for ranking_polls
CREATE POLICY "Allow authenticated users to read ranking polls" ON ranking_polls
    FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "Allow admin users to manage ranking polls" ON ranking_polls
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM user_roles 
            WHERE user_id = auth.uid() AND role = 'admin'
        )
    );

-- RLS policies for ranking_votes
CREATE POLICY "Allow users to vote on ranking polls" ON ranking_votes
    FOR INSERT TO authenticated
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Allow users to read their own ranking votes" ON ranking_votes
    FOR SELECT TO authenticated
    USING (user_id = auth.uid());

CREATE POLICY "Allow admin users to read all ranking votes" ON ranking_votes
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM user_roles 
            WHERE user_id = auth.uid() AND role = 'admin'
        )
    );

-- ============================================================================
-- PHASE 3: HELPER FUNCTIONS FOR RANKING SYSTEM
-- ============================================================================

-- Function to get or create ranking poll
CREATE OR REPLACE FUNCTION get_or_create_ranking_poll(
    p_page_path VARCHAR(255),
    p_poll_index INTEGER,
    p_question TEXT,
    p_options JSONB
) RETURNS UUID AS $$
DECLARE
    poll_id UUID;
BEGIN
    -- Try to find existing ranking poll
    SELECT id INTO poll_id 
    FROM ranking_polls 
    WHERE page_path = p_page_path AND poll_index = p_poll_index;
    
    -- If not found, create new ranking poll
    IF poll_id IS NULL THEN
        INSERT INTO ranking_polls (page_path, poll_index, question, options)
        VALUES (p_page_path, p_poll_index, p_question, p_options)
        RETURNING id INTO poll_id;
    END IF;
    
    RETURN poll_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to submit ranking votes
CREATE OR REPLACE FUNCTION submit_ranking_votes(
    p_ranking_poll_id UUID,
    p_rankings JSONB
) RETURNS BOOLEAN AS $$
DECLARE
    ranking_item JSONB;
    option_index INTEGER;
    rank_value INTEGER;
BEGIN
    -- Clear existing votes for this user and poll
    DELETE FROM ranking_votes 
    WHERE ranking_poll_id = p_ranking_poll_id AND user_id = auth.uid();
    
    -- Insert new ranking votes
    FOR ranking_item IN SELECT * FROM jsonb_array_elements(p_rankings)
    LOOP
        option_index := (ranking_item->>'optionIndex')::INTEGER;
        rank_value := (ranking_item->>'rank')::INTEGER;
        
        INSERT INTO ranking_votes (ranking_poll_id, user_id, option_index, rank)
        VALUES (p_ranking_poll_id, auth.uid(), option_index, rank_value);
    END LOOP;
    
    RETURN TRUE;
EXCEPTION
    WHEN OTHERS THEN
        RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- PHASE 4: RANKING RESULTS VIEW
-- ============================================================================

-- Create ranking results view
CREATE OR REPLACE VIEW ranking_results AS
SELECT 
    rp.id as ranking_poll_id,
    rp.page_path,
    rp.poll_index,
    rp.question,
    rp.options,
    COUNT(DISTINCT rv.user_id) as total_votes,
    COALESCE(
        jsonb_agg(
            jsonb_build_object(
                'option_index', rv.option_index,
                'option_text', rp.options->>rv.option_index,
                'votes', option_counts.vote_count,
                'averageRank', option_counts.average_rank
            ) ORDER BY rv.option_index
        ) FILTER (WHERE rv.id IS NOT NULL),
        '[]'::jsonb
    ) as results
FROM ranking_polls rp
LEFT JOIN ranking_votes rv ON rp.id = rv.ranking_poll_id
LEFT JOIN (
    SELECT 
        ranking_poll_id, 
        option_index, 
        COUNT(*) as vote_count,
        ROUND(AVG(rank)::numeric, 2) as average_rank
    FROM ranking_votes 
    GROUP BY ranking_poll_id, option_index
) option_counts ON rp.id = option_counts.ranking_poll_id AND rv.option_index = option_counts.option_index
GROUP BY rp.id, rp.page_path, rp.poll_index, rp.question, rp.options;

-- ============================================================================
-- PHASE 5: TRIGGERS
-- ============================================================================

-- Add trigger for ranking polls table
CREATE TRIGGER update_ranking_polls_updated_at 
    BEFORE UPDATE ON ranking_polls 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
