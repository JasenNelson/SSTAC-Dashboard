-- Create TWG Review Submission Tables
-- This file creates the missing database tables for the TWG review system

-- ============================================================================
-- TWG REVIEW SUBMISSION TABLES
-- ============================================================================

-- Review submissions table for TWG white paper review
CREATE TABLE IF NOT EXISTS review_submissions (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    status TEXT NOT NULL CHECK (status IN ('IN_PROGRESS', 'SUBMITTED')),
    form_data JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on review_submissions
ALTER TABLE review_submissions ENABLE ROW LEVEL SECURITY;

-- RLS policies for review_submissions
CREATE POLICY "Users can view their own submissions" ON review_submissions
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own submissions" ON review_submissions
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own submissions" ON review_submissions
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all submissions" ON review_submissions
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM user_roles 
            WHERE user_id = auth.uid() AND role = 'admin'
        )
    );

-- Review files table for uploaded files
CREATE TABLE IF NOT EXISTS review_files (
    id BIGSERIAL PRIMARY KEY,
    submission_id BIGINT NOT NULL REFERENCES review_submissions(id) ON DELETE CASCADE,
    filename TEXT NOT NULL,
    file_path TEXT NOT NULL,
    mimetype TEXT NOT NULL,
    file_size BIGINT NOT NULL,
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on review_files
ALTER TABLE review_files ENABLE ROW LEVEL SECURITY;

-- RLS policies for review_files
CREATE POLICY "Users can view files for their submissions" ON review_files
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM review_submissions 
            WHERE id = review_files.submission_id AND user_id = auth.uid()
        )
    );

CREATE POLICY "Users can create files for their submissions" ON review_files
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM review_submissions 
            WHERE id = review_files.submission_id AND user_id = auth.uid()
        )
    );

CREATE POLICY "Admins can view all files" ON review_files
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM user_roles 
            WHERE user_id = auth.uid() AND role = 'admin'
        )
    );

-- Admin view for review submissions with user emails
CREATE OR REPLACE VIEW admin_review_submissions AS
SELECT 
    rs.id,
    rs.user_id,
    COALESCE(
        aue.email,
        'User ' || LEFT(rs.user_id::text, 8) || '...'
    ) as email,
    rs.status,
    rs.form_data,
    rs.created_at,
    rs.updated_at,
    COALESCE(
        (SELECT COUNT(*) FROM review_files rf WHERE rf.submission_id = rs.id),
        0
    ) as file_count
FROM review_submissions rs
LEFT JOIN get_users_with_emails() aue ON rs.user_id = aue.id;

-- Grant permissions on the view
GRANT SELECT ON admin_review_submissions TO authenticated;

-- Add trigger for updated_at column
CREATE TRIGGER update_review_submissions_updated_at 
    BEFORE UPDATE ON review_submissions 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Verify tables were created
SELECT 
    table_name, 
    table_type,
    'CREATED' as status
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('review_submissions', 'review_files', 'admin_review_submissions')
ORDER BY table_name;

-- Test the admin view
SELECT COUNT(*) as total_submissions FROM admin_review_submissions;
