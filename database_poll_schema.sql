-- Poll Database Schema for SSTAC & TWG Dashboard
-- This schema supports interactive polls with vote collection and result display

-- Polls table to store poll definitions
CREATE TABLE IF NOT EXISTS polls (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    page_path VARCHAR(255) NOT NULL, -- e.g., '/survey-results/holistic-protection'
    poll_index INTEGER NOT NULL, -- 0-based index of poll on the page
    question TEXT NOT NULL,
    options JSONB NOT NULL, -- Array of option strings
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Poll votes table to store individual votes
-- Updated to support both authenticated users (UUID) and CEW conference codes (TEXT)
CREATE TABLE IF NOT EXISTS poll_votes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    poll_id UUID REFERENCES polls(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL, -- Can be UUID (authenticated) or CEW code (e.g., "CEW2025")
    option_index INTEGER NOT NULL, -- 0-based index of selected option
    other_text TEXT, -- For "Other" option responses
    voted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(poll_id, user_id), -- One vote per user per poll
    CONSTRAINT poll_votes_user_id_check CHECK (
        user_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' OR 
        user_id LIKE 'anon_%' OR 
        user_id LIKE 'CEW%'
    )
);

-- Poll results view for aggregated data
CREATE OR REPLACE VIEW poll_results AS
SELECT 
    p.id as poll_id,
    p.page_path,
    p.poll_index,
    p.question,
    p.options,
    COALESCE(option_counts.total_votes, 0) as total_votes,
    COALESCE(
        jsonb_agg(
            jsonb_build_object(
                'option_index', option_counts.option_index,
                'option_text', p.options->>option_counts.option_index,
                'votes', option_counts.vote_count
            ) ORDER BY option_counts.option_index
        ) FILTER (WHERE option_counts.option_index IS NOT NULL),
        '[]'::jsonb
    ) as results
FROM polls p
LEFT JOIN (
    SELECT 
        poll_id, 
        option_index, 
        COUNT(*) as vote_count,
        SUM(COUNT(*)) OVER (PARTITION BY poll_id) as total_votes
    FROM poll_votes 
    GROUP BY poll_id, option_index
) option_counts ON p.id = option_counts.poll_id
GROUP BY p.id, p.page_path, p.poll_index, p.question, p.options, option_counts.total_votes;

-- RLS Policies for polls table
ALTER TABLE polls ENABLE ROW LEVEL SECURITY;

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

-- RLS Policies for poll_votes table
ALTER TABLE poll_votes ENABLE ROW LEVEL SECURITY;

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

-- Function to get or create poll
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

-- Function to submit a vote
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

-- Function to get poll results
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

-- CEW Conference Polling Support
-- The poll system now supports both authenticated dashboard users and unauthenticated conference attendees
-- Conference attendees use a shared code (e.g., "CEW2025") for authentication
-- This allows real-time polling during conferences with results combined in the same database

-- RLS Policies for Anonymous Users (CEW Conference Polling)
-- These policies allow unauthenticated users to participate in polls using conference codes

-- Allow anonymous users to read polls
CREATE POLICY IF NOT EXISTS "Allow anonymous users to read polls" ON polls
    FOR SELECT TO anon
    USING (true);

-- Allow anonymous users to vote on polls
CREATE POLICY IF NOT EXISTS "Allow anonymous users to vote on polls" ON poll_votes
    FOR INSERT TO anon
    WITH CHECK (true);

-- Allow anonymous users to read poll results
CREATE POLICY IF NOT EXISTS "Allow anonymous users to read poll results" ON poll_votes
    FOR SELECT TO anon
    USING (true);

-- Grant necessary permissions to anonymous role
GRANT SELECT ON polls TO anon;
GRANT INSERT ON poll_votes TO anon;
GRANT SELECT ON poll_votes TO anon;
GRANT SELECT ON poll_results TO anon;

-- Ranking Polls System
-- Supports ranking polls where users rank multiple options in order of preference

-- Ranking polls table to store ranking poll definitions
CREATE TABLE IF NOT EXISTS ranking_polls (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    page_path VARCHAR(255) NOT NULL, -- e.g., '/survey-results/prioritization'
    poll_index INTEGER NOT NULL, -- 0-based index of poll on the page
    question TEXT NOT NULL,
    options JSONB NOT NULL, -- Array of option strings
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Ranking votes table to store individual ranking votes
-- Updated to support both authenticated users (UUID) and CEW conference codes (TEXT)
CREATE TABLE IF NOT EXISTS ranking_votes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    ranking_poll_id UUID REFERENCES ranking_polls(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL, -- Can be UUID (authenticated) or CEW code (e.g., "CEW2025")
    option_index INTEGER NOT NULL, -- 0-based index of option being ranked
    rank INTEGER NOT NULL, -- 1-based rank (1 = highest priority)
    voted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(ranking_poll_id, user_id, option_index), -- One rank per option per user per poll
    CONSTRAINT ranking_votes_user_id_check CHECK (
        user_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' OR 
        user_id LIKE 'anon_%' OR 
        user_id LIKE 'CEW%'
    )
);

-- Ranking results view for aggregated data
CREATE OR REPLACE VIEW ranking_results AS
SELECT 
    rp.id as ranking_poll_id,
    rp.page_path,
    rp.poll_index,
    rp.question,
    rp.options,
    rp.created_at,
    rp.updated_at,
    COUNT(rv.id) as total_votes,
    COALESCE(
        jsonb_agg(
            jsonb_build_object(
                'option_index', rv.option_index,
                'option_text', rp.options[rv.option_index + 1], -- Convert 0-based to 1-based
                'averageRank', rv.rank::float,
                'votes', 1
            ) ORDER BY rv.option_index
        ) FILTER (WHERE rv.id IS NOT NULL),
        '[]'::jsonb
    ) as results
FROM ranking_polls rp
LEFT JOIN ranking_votes rv ON rp.id = rv.ranking_poll_id
GROUP BY rp.id, rp.page_path, rp.poll_index, rp.question, rp.options, rp.created_at, rp.updated_at;

-- RLS Policies for ranking_polls table
ALTER TABLE ranking_polls ENABLE ROW LEVEL SECURITY;

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

-- RLS Policies for ranking_votes table
ALTER TABLE ranking_votes ENABLE ROW LEVEL SECURITY;

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

-- CEW Conference Polling Support for Ranking Polls
-- Allow anonymous users to participate in ranking polls using conference codes

-- Allow anonymous users to read ranking polls
CREATE POLICY IF NOT EXISTS "Allow anonymous users to read ranking polls" ON ranking_polls
    FOR SELECT TO anon
    USING (true);

-- Allow anonymous users to vote on ranking polls
CREATE POLICY IF NOT EXISTS "Allow anonymous users to insert ranking votes" ON ranking_votes
    FOR INSERT TO anon
    WITH CHECK (true);

-- Allow anonymous users to read ranking votes
CREATE POLICY IF NOT EXISTS "Allow anonymous users to read ranking votes" ON ranking_votes
    FOR SELECT TO anon
    USING (true);

-- Grant necessary permissions to anonymous role for ranking polls
GRANT SELECT ON ranking_polls TO anon;
GRANT INSERT ON ranking_votes TO anon;
GRANT SELECT ON ranking_votes TO anon;
GRANT SELECT ON ranking_results TO anon;
