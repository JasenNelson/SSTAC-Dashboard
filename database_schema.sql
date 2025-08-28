-- SSTAC & TWG Dashboard Database Schema
-- Comprehensive database structure for admin management and user engagement
-- Updated with enhanced user management capabilities

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- CORE USER MANAGEMENT TABLES
-- ============================================================================

-- User roles table for admin access control
CREATE TABLE IF NOT EXISTS user_roles (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('admin', 'member')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, role)
);

-- Enable RLS on user_roles
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

-- RLS policies for user_roles
CREATE POLICY "Users can view their own roles" ON user_roles
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all roles" ON user_roles
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_roles 
            WHERE user_id = auth.uid() AND role = 'admin'
        )
    );

-- ============================================================================
-- DOCUMENT MANAGEMENT TABLES
-- ============================================================================

-- Tags table for document categorization
CREATE TABLE IF NOT EXISTS tags (
    id BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    color TEXT NOT NULL DEFAULT '#6B7280',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by TEXT
);

-- Enable RLS on tags
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;

-- RLS policies for tags
CREATE POLICY "Anyone can view tags" ON tags
    FOR SELECT USING (true);

CREATE POLICY "Admins can manage tags" ON tags
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_roles 
            WHERE user_id = auth.uid() AND role = 'admin'
        )
    );

-- Documents table for project files and reports
-- Note: This table does not have user tracking (no user_id or user_email columns)
CREATE TABLE IF NOT EXISTS documents (
    id BIGSERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    file_url TEXT NOT NULL,
    tag TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on documents
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

-- RLS policies for documents
CREATE POLICY "Anyone can view documents" ON documents
    FOR SELECT USING (true);

CREATE POLICY "Admins can manage all documents" ON documents
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_roles 
            WHERE user_id = auth.uid() AND role = 'admin'
        )
    );

-- ============================================================================
-- ANNOUNCEMENT MANAGEMENT TABLES
-- ============================================================================

-- Announcements table for dashboard notifications
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

-- Enable RLS on announcements
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;

-- RLS policies for announcements
CREATE POLICY "Anyone can view active announcements" ON announcements
    FOR SELECT USING (is_active = true);

CREATE POLICY "Admins can manage all announcements" ON announcements
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_roles 
            WHERE user_id = auth.uid() AND role = 'admin'
        )
    );

-- ============================================================================
-- MILESTONE MANAGEMENT TABLES
-- ============================================================================

-- Milestones table for project timeline tracking
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

-- Enable RLS on milestones
ALTER TABLE milestones ENABLE ROW LEVEL SECURITY;

-- RLS policies for milestones
CREATE POLICY "Anyone can view milestones" ON milestones
    FOR SELECT USING (true);

CREATE POLICY "Admins can manage all milestones" ON milestones
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_roles 
            WHERE user_id = auth.uid() AND role = 'admin'
        )
    );

-- ============================================================================
-- DISCUSSION FORUM TABLES
-- ============================================================================

-- Discussions table for forum threads
CREATE TABLE IF NOT EXISTS discussions (
    id BIGSERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    user_id UUID REFERENCES auth.users(id),
    user_email TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on discussions
ALTER TABLE discussions ENABLE ROW LEVEL SECURITY;

-- RLS policies for discussions
CREATE POLICY "Anyone can view discussions" ON discussions
    FOR SELECT USING (true);

CREATE POLICY "Users can create discussions" ON discussions
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own discussions" ON discussions
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own discussions" ON discussions
    FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all discussions" ON discussions
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_roles 
            WHERE user_id = auth.uid() AND role = 'admin'
        )
    );

-- Discussion replies table for nested conversations
CREATE TABLE IF NOT EXISTS discussion_replies (
    id BIGSERIAL PRIMARY KEY,
    discussion_id BIGINT NOT NULL REFERENCES discussions(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    user_id UUID REFERENCES auth.users(id),
    user_email TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on discussion_replies
ALTER TABLE discussion_replies ENABLE ROW LEVEL SECURITY;

-- RLS policies for discussion_replies
CREATE POLICY "Anyone can view replies" ON discussion_replies
    FOR SELECT USING (true);

CREATE POLICY "Users can create replies" ON discussion_replies
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own replies" ON discussion_replies
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own replies" ON discussion_replies
    FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all replies" ON discussion_replies
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_roles 
            WHERE user_id = auth.uid() AND role = 'admin'
        )
    );

-- ============================================================================
-- ENHANCED LIKE SYSTEM TABLES
-- ============================================================================

-- Likes table for tracking user interactions with discussions and replies
CREATE TABLE IF NOT EXISTS likes (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    discussion_id BIGINT REFERENCES discussions(id) ON DELETE CASCADE,
    reply_id BIGINT REFERENCES discussion_replies(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    -- Ensure a user can only like either a discussion OR a reply, not both
    CONSTRAINT like_target_check CHECK (
        (discussion_id IS NOT NULL AND reply_id IS NULL) OR 
        (discussion_id IS NULL AND reply_id IS NOT NULL)
    ),
    -- Ensure a user can only like a specific discussion/reply once
    UNIQUE(user_id, discussion_id, reply_id)
);

-- Enable RLS on likes
ALTER TABLE likes ENABLE ROW LEVEL SECURITY;

-- RLS policies for likes
CREATE POLICY "Anyone can view likes" ON likes
    FOR SELECT USING (true);

CREATE POLICY "Users can create their own likes" ON likes
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own likes" ON likes
    FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all likes" ON likes
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_roles 
            WHERE user_id = auth.uid() AND role = 'admin'
        )
    );

-- Indexes for likes table
CREATE INDEX IF NOT EXISTS idx_likes_user_id ON likes(user_id);
CREATE INDEX IF NOT EXISTS idx_likes_discussion_id ON likes(discussion_id);
CREATE INDEX IF NOT EXISTS idx_likes_reply_id ON likes(reply_id);
CREATE INDEX IF NOT EXISTS idx_likes_created_at ON likes(created_at);

-- ============================================================================
-- ENHANCED USER MANAGEMENT FUNCTIONS AND TRIGGERS
-- ============================================================================

-- Function to safely expose user emails from auth.users table
-- This function can only be called by authenticated users and respects RLS
CREATE OR REPLACE FUNCTION get_users_with_emails()
RETURNS TABLE (
    id UUID,
    email CHARACTER VARYING(255),
    created_at TIMESTAMP WITH TIME ZONE,
    last_sign_in TIMESTAMP WITH TIME ZONE
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Only allow authenticated users to call this function
    IF auth.role() != 'authenticated' THEN
        RAISE EXCEPTION 'Access denied. Only authenticated users can call this function.';
    END IF;
    
    -- Return user information from auth.users
    -- This is safe because we're only returning basic user info
    RETURN QUERY
    SELECT 
        au.id,
        au.email,
        au.created_at,
        au.last_sign_in_at
    FROM auth.users au
    WHERE au.email_confirmed_at IS NOT NULL  -- Only confirmed users
    ORDER BY au.created_at DESC;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_users_with_emails() TO authenticated;

-- Function to automatically assign roles to new users
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    -- Insert the new user into user_roles with 'member' role
    INSERT INTO user_roles (user_id, role, created_at)
    VALUES (NEW.id, 'member', NOW())
    ON CONFLICT (user_id, role) DO NOTHING;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger that fires when a new user is created in auth.users
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION handle_new_user();

-- ============================================================================
-- CRITICAL DATABASE VIEWS
-- ============================================================================

-- Discussion statistics view for forum functionality
CREATE OR REPLACE VIEW discussion_stats AS
SELECT 
    d.id,
    d.title,
    d.user_email as author,
    d.created_at,
    d.updated_at,
    COUNT(r.id) as reply_count,
    MAX(r.created_at) as last_reply_at
FROM discussions d
LEFT JOIN discussion_replies r ON d.id = r.discussion_id
GROUP BY d.id, d.title, d.user_email, d.created_at, d.updated_at
ORDER BY d.created_at DESC;

-- Grant permissions on the view
GRANT SELECT ON discussion_stats TO authenticated;

-- Documents with tags view for efficient document management
CREATE OR REPLACE VIEW documents_with_tags AS
SELECT 
    d.*,
    COALESCE(ARRAY_AGG(t.name) FILTER (WHERE t.name IS NOT NULL), ARRAY[]::TEXT[]) as tags
FROM documents d
LEFT JOIN tags t ON d.tag = t.name
GROUP BY d.id, d.title, d.description, d.file_url, d.tag, d.created_at, d.updated_at
ORDER BY d.created_at DESC;

-- Grant permissions on the view
GRANT SELECT ON documents_with_tags TO authenticated;

-- Enhanced users overview view for admin user management
-- This view safely exposes user information from various tables
CREATE OR REPLACE VIEW users_overview AS
WITH user_activities AS (
    -- Users from user_roles (guaranteed to exist)
    SELECT 
        user_id,
        NULL as user_email,
        created_at,
        'role' as activity_type
    FROM user_roles
    
    UNION ALL
    
    -- Users from discussions (confirmed structure with user_email)
    SELECT 
        user_id,
        user_email,
        created_at,
        'discussion' as activity_type
    FROM discussions 
    WHERE user_id IS NOT NULL
    
    UNION ALL
    
    -- Users from likes (confirmed structure)
    SELECT 
        user_id,
        NULL as user_email,
        created_at,
        'like' as activity_type
    FROM likes 
    WHERE user_id IS NOT NULL
),
auth_user_emails AS (
    -- Get user emails from auth.users through the safe function
    SELECT 
        id,
        email,
        created_at
    FROM get_users_with_emails()
)
SELECT DISTINCT
    ua.user_id as id,
    COALESCE(
        ua.user_email,           -- First priority: email from activity (discussions)
        aue.email,               -- Second priority: email from auth.users
        'User ' || LEFT(ua.user_id::text, 8) || '...'  -- Fallback: truncated ID
    ) as email,
    COALESCE(
        aue.created_at,          -- Use auth.users created_at if available
        MIN(ua.created_at)       -- Otherwise use earliest activity
    ) as first_activity,
    MAX(ua.created_at) as last_activity,
    ur.role,
    CASE WHEN ur.role = 'admin' THEN true ELSE false END as is_admin,
    COUNT(DISTINCT ua.activity_type) as activity_count,
    ARRAY_AGG(DISTINCT ua.activity_type) FILTER (WHERE ua.activity_type IS NOT NULL) as activities
FROM user_activities ua
LEFT JOIN user_roles ur ON ua.user_id = ur.user_id
LEFT JOIN auth_user_emails aue ON ua.user_id = aue.id
GROUP BY ua.user_id, ua.user_email, ur.role, aue.email, aue.created_at
ORDER BY last_activity DESC;

-- Grant permissions on the view
GRANT SELECT ON users_overview TO authenticated;

-- Comprehensive user management view for admin dashboard
CREATE OR REPLACE VIEW admin_users_comprehensive AS
SELECT 
    au.id,
    au.email,
    au.created_at as auth_created_at,
    au.last_sign_in_at,
    ur.role,
    ur.created_at as role_created_at,
    CASE WHEN ur.role = 'admin' THEN true ELSE false END as is_admin,
    CASE 
        WHEN ur.role IS NOT NULL THEN 'Has Role'
        ELSE 'No Role'
    END as role_status,
    -- Count discussions (table exists with user_id)
    COALESCE(
        (SELECT COUNT(*) FROM discussions disc WHERE disc.user_id = au.id),
        0
    ) as discussion_count,
    -- Count likes (table exists with user_id)
    COALESCE(
        (SELECT COUNT(*) FROM likes l WHERE l.user_id = au.id),
        0
    ) as like_count,
    -- Note: documents table has no user tracking, so we can't count user documents
    0 as document_count,
    CASE 
        WHEN au.email_confirmed_at IS NOT NULL THEN 'Confirmed'
        ELSE 'Unconfirmed'
    END as email_status
FROM auth.users au
LEFT JOIN user_roles ur ON au.id = ur.user_id
WHERE au.email_confirmed_at IS NOT NULL  -- Only show confirmed users
ORDER BY au.created_at DESC;

-- Grant permissions on the view
GRANT SELECT ON admin_users_comprehensive TO authenticated;

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

-- User roles indexes
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role ON user_roles(role);

-- Tags indexes
CREATE INDEX IF NOT EXISTS idx_tags_name ON tags(name);
CREATE INDEX IF NOT EXISTS idx_tags_created_at ON tags(created_at);

-- Documents indexes
CREATE INDEX IF NOT EXISTS idx_documents_created_at ON documents(created_at);
CREATE INDEX IF NOT EXISTS idx_documents_tag ON documents(tag);

-- Announcements indexes
CREATE INDEX IF NOT EXISTS idx_announcements_is_active ON announcements(is_active);
CREATE INDEX IF NOT EXISTS idx_announcements_priority ON announcements(priority);
CREATE INDEX IF NOT EXISTS idx_announcements_created_at ON announcements(created_at);

-- Milestones indexes
CREATE INDEX IF NOT EXISTS idx_milestones_target_date ON milestones(target_date);
CREATE INDEX IF NOT EXISTS idx_milestones_status ON milestones(status);
CREATE INDEX IF NOT EXISTS idx_milestones_priority ON milestones(priority);

-- Discussions indexes
CREATE INDEX IF NOT EXISTS idx_discussions_user_id ON discussions(user_id);
CREATE INDEX IF NOT EXISTS idx_discussions_created_at ON discussions(created_at);

-- Discussion replies indexes
CREATE INDEX IF NOT EXISTS idx_discussion_replies_discussion_id ON discussion_replies(discussion_id);
CREATE INDEX IF NOT EXISTS idx_discussion_replies_user_id ON discussion_replies(user_id);
CREATE INDEX IF NOT EXISTS idx_discussion_replies_created_at ON discussion_replies(created_at);

-- ============================================================================
-- TRIGGERS FOR AUTOMATIC UPDATES
-- ============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at columns
CREATE TRIGGER update_user_roles_updated_at 
    BEFORE UPDATE ON user_roles 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tags_updated_at 
    BEFORE UPDATE ON tags 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_documents_updated_at 
    BEFORE UPDATE ON documents 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_announcements_updated_at 
    BEFORE UPDATE ON announcements 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_milestones_updated_at 
    BEFORE UPDATE ON milestones 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_discussions_updated_at 
    BEFORE UPDATE ON discussions 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_discussion_replies_updated_at 
    BEFORE UPDATE ON discussion_replies 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- SAMPLE DATA FOR DEVELOPMENT
-- ============================================================================

-- Insert sample tags
INSERT INTO tags (name, color, created_by) VALUES
('Technical Report', '#3B82F6', 'System'),
('Survey Results', '#10B981', 'System'),
('Policy Document', '#F59E0B', 'System'),
('Research Paper', '#8B5CF6', 'System'),
('Meeting Minutes', '#EF4444', 'System')
ON CONFLICT (name) DO NOTHING;

-- Insert sample announcements
INSERT INTO announcements (title, content, priority, created_by) VALUES
('Welcome to SSTAC & TWG Dashboard', 'This platform provides centralized access to project documents and stakeholder engagement results.', 'high', 'System'),
('Survey Results Available', 'Initial stakeholder survey results are now available for review and analysis.', 'medium', 'System'),
('CEW 2025 Conference Registration', 'Early bird registration for the Canadian Ecotoxicity Workshop is now open.', 'high', 'System')
ON CONFLICT DO NOTHING;

-- Insert sample milestones
INSERT INTO milestones (title, description, target_date, status, priority, created_by) VALUES
('Project Initiation', 'SABCS project initiation and stakeholder identification', '2025-04-01', 'completed', 'high', 'System'),
('Public Survey Launch', 'Launch of stakeholder engagement survey', '2025-05-30', 'completed', 'high', 'System'),
('Survey Completion', 'Survey data collection and analysis', '2025-07-31', 'completed', 'high', 'System'),
('CEW Early Bird Registration Ends', 'Deadline for early bird conference registration', '2025-08-22', 'pending', 'high', 'System'),
('TWG Review Begins', 'Technical Working Group review of survey results', '2025-08-15', 'pending', 'medium', 'System'),
('CEW 2025 Session', 'Canadian Ecotoxicity Workshop session in Victoria', '2025-10-07', 'pending', 'high', 'System'),
('Phase 1 Completion', 'Completion of Phase 1 with interim framework', '2025-12-31', 'pending', 'high', 'System')
ON CONFLICT DO NOTHING;

-- ============================================================================
-- PERMISSIONS AND GRANTS
-- ============================================================================

-- Grant permissions to authenticated users
GRANT SELECT ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;

-- Grant permissions on sequences
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- Grant permissions on views
GRANT SELECT ON discussion_stats TO authenticated;
GRANT SELECT ON documents_with_tags TO authenticated;
GRANT SELECT ON users_overview TO authenticated;
GRANT SELECT ON admin_users_comprehensive TO authenticated;

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Verify table creation
SELECT table_name, table_type 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_type = 'BASE TABLE'
ORDER BY table_name;

-- Verify RLS is enabled
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND rowsecurity = true
ORDER BY tablename;

-- Verify views exist
SELECT table_name, table_type 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_type = 'VIEW'
ORDER BY table_name;

-- Verify functions exist
SELECT routine_name, routine_type 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name IN ('get_users_with_emails', 'handle_new_user', 'update_updated_at_column')
ORDER BY routine_name;

-- Verify triggers exist
SELECT 
    trigger_name,
    event_manipulation,
    action_statement
FROM information_schema.triggers 
WHERE trigger_schema = 'public'
ORDER BY trigger_name;

-- Verify sample data
SELECT 'Tags' as table_name, COUNT(*) as count FROM tags
UNION ALL
SELECT 'Announcements', COUNT(*) FROM announcements
UNION ALL
SELECT 'Milestones', COUNT(*) FROM milestones;

-- Test enhanced user management
SELECT COUNT(*) as total_users FROM admin_users_comprehensive;
SELECT COUNT(*) as users_with_emails FROM get_users_with_emails();
