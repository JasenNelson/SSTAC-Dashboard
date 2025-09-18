-- Fix TWG Synthesis Page - Create Missing Tables and Views
-- Run this in Supabase SQL Editor to restore TWG synthesis functionality

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

CREATE POLICY "Users can insert their own submissions" ON review_submissions
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
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    file_name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_size BIGINT NOT NULL,
    mime_type TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on review_files
ALTER TABLE review_files ENABLE ROW LEVEL SECURITY;

-- RLS policies for review_files
CREATE POLICY "Users can view their own files" ON review_files
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own files" ON review_files
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all files" ON review_files
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM user_roles 
            WHERE user_id = auth.uid() AND role = 'admin'
        )
    );

-- ============================================================================
-- ADMIN VIEW FOR TWG SYNTHESIS
-- ============================================================================

-- Admin view that combines submissions with user data
CREATE OR REPLACE VIEW admin_review_submissions AS
SELECT 
    rs.id,
    rs.user_id,
    au.email,
    au.created_at as user_created_at,
    rs.status,
    rs.form_data,
    rs.created_at as submission_created_at,
    rs.updated_at as submission_updated_at,
    -- Extract key form data for easy display
    rs.form_data->>'name' as reviewer_name,
    rs.form_data->>'affiliation' as reviewer_affiliation,
    rs.form_data->>'expertise_area' as expertise_area,
    rs.form_data->>'review_status' as review_status,
    -- Count files
    COALESCE(file_count.count, 0) as file_count
FROM review_submissions rs
LEFT JOIN auth.users au ON rs.user_id = au.id
LEFT JOIN (
    SELECT 
        submission_id, 
        COUNT(*) as count 
    FROM review_files 
    GROUP BY submission_id
) file_count ON rs.id = file_count.submission_id
ORDER BY rs.created_at DESC;

-- Grant access to the view for authenticated users
GRANT SELECT ON admin_review_submissions TO authenticated;

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Create trigger for updated_at column
CREATE TRIGGER update_review_submissions_updated_at 
    BEFORE UPDATE ON review_submissions 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Check if everything was created successfully
SELECT 'Tables created' as status, 
       COUNT(*) as count 
FROM information_schema.tables 
WHERE table_name IN ('review_submissions', 'review_files');

SELECT 'Views created' as status, 
       COUNT(*) as count 
FROM information_schema.views 
WHERE table_name = 'admin_review_submissions';

SELECT 'Policies created' as status, 
       COUNT(*) as count 
FROM pg_policies 
WHERE tablename IN ('review_submissions', 'review_files');
