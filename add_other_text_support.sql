-- Add support for "Other" text input in polls
-- This adds an other_text field to store custom text when users select "Other"

-- Add other_text column to poll_votes table
ALTER TABLE poll_votes 
ADD COLUMN IF NOT EXISTS other_text TEXT;

-- Add comment to explain the field
COMMENT ON COLUMN poll_votes.other_text IS 'Custom text entered when user selects "Other" option';

-- Update the submit_poll_vote function to handle other_text
CREATE OR REPLACE FUNCTION submit_poll_vote(
    p_poll_id UUID,
    p_option_index INTEGER,
    p_other_text TEXT DEFAULT NULL
) RETURNS BOOLEAN AS $$
BEGIN
    -- Insert or update vote
    INSERT INTO poll_votes (poll_id, user_id, option_index, other_text)
    VALUES (p_poll_id, auth.uid(), p_option_index, p_other_text)
    ON CONFLICT (poll_id, user_id) 
    DO UPDATE SET 
        option_index = p_option_index,
        other_text = p_other_text,
        voted_at = NOW();
    
    RETURN TRUE;
EXCEPTION
    WHEN OTHERS THEN
        RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update the poll_results view to include other_text in the results
DROP VIEW IF EXISTS poll_results;

CREATE VIEW poll_results AS
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
                'votes', option_counts.vote_count,
                'other_texts', option_counts.other_texts
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
        SUM(COUNT(*)) OVER (PARTITION BY poll_id) as total_votes,
        COALESCE(
            jsonb_agg(other_text) FILTER (WHERE other_text IS NOT NULL AND other_text != ''),
            '[]'::jsonb
        ) as other_texts
    FROM poll_votes 
    GROUP BY poll_id, option_index
) option_counts ON p.id = option_counts.poll_id
GROUP BY p.id, p.page_path, p.poll_index, p.question, p.options, option_counts.total_votes;
