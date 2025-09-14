-- Create Review System Tables for TWG White Paper Review
-- This extends the existing SSTAC & TWG Dashboard database schema

-- Create review_submissions table
CREATE TABLE IF NOT EXISTS review_submissions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    status TEXT CHECK (status IN ('IN_PROGRESS', 'SUBMITTED')) DEFAULT 'IN_PROGRESS' NOT NULL,
    form_data JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Create review_files table for uploaded documents
CREATE TABLE IF NOT EXISTS review_files (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    submission_id UUID REFERENCES review_submissions(id) ON DELETE CASCADE NOT NULL,
    filename TEXT NOT NULL,
    file_path TEXT NOT NULL,
    mimetype TEXT NOT NULL,
    file_size INTEGER,
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_review_submissions_user_id ON review_submissions(user_id);
CREATE INDEX IF NOT EXISTS idx_review_submissions_status ON review_submissions(status);
CREATE INDEX IF NOT EXISTS idx_review_files_submission_id ON review_files(submission_id);

-- Enable RLS on both tables
ALTER TABLE review_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_files ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for review_submissions
CREATE POLICY "Users can view their own review submissions" ON review_submissions
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own review submissions" ON review_submissions
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own review submissions" ON review_submissions
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all review submissions" ON review_submissions
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM user_roles 
            WHERE user_id = auth.uid() AND role = 'admin'
        )
    );

-- Create RLS policies for review_files
CREATE POLICY "Users can view files for their own submissions" ON review_files
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM review_submissions 
            WHERE id = submission_id AND user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert files for their own submissions" ON review_files
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM review_submissions 
            WHERE id = submission_id AND user_id = auth.uid()
        )
    );

CREATE POLICY "Admins can view all review files" ON review_files
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM user_roles 
            WHERE user_id = auth.uid() AND role = 'admin'
        )
    );

-- Create updated_at trigger for review_submissions
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_review_submissions_updated_at 
    BEFORE UPDATE ON review_submissions 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create view for admin review management
CREATE OR REPLACE VIEW admin_review_submissions AS
SELECT 
    rs.id,
    rs.user_id,
    au.email,
    rs.status,
    rs.form_data,
    rs.created_at,
    rs.updated_at,
    COUNT(rf.id) as file_count
FROM review_submissions rs
LEFT JOIN auth.users au ON rs.user_id = au.id
LEFT JOIN review_files rf ON rs.id = rf.submission_id
GROUP BY rs.id, rs.user_id, au.email, rs.status, rs.form_data, rs.created_at, rs.updated_at;

-- Grant access to the view
GRANT SELECT ON admin_review_submissions TO authenticated;

-- Note: Views don't need RLS policies - they inherit permissions from the underlying tables
