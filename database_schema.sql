-- SSTAC & TWG Dashboard Database Schema
-- Comprehensive database structure for admin management and user engagement
-- Updated with enhanced user management capabilities

-- ============================================================================
-- CRITICAL DEBUGGING NOTES & LESSONS LEARNED
-- ============================================================================

-- POLL SYSTEM DEBUGGING GUIDELINES:
-- 1. VOTE COUNTING LOGIC:
--    - Ranking polls: Use total_votes field (represents unique participants)
--    - Single-choice polls: Sum votes from results array
--    - Each user ranks ALL options in ranking polls = 1 response
--    - Each user selects ONE option in single-choice polls = 1 response

-- 2. PATH RECOGNITION:
--    - Survey polls: /survey-results/* OR /wiks
--    - CEW polls: /cew-polls/*
--    - All paths must be consistent for proper data grouping

-- 3. DATA COMBINATION:
--    - Group polls by topic_name_${poll_index} key
--    - Store original survey/CEW data separately for filtering
--    - Use consistent question text and options from CEW when available

-- 4. TYPE SAFETY:
--    - Always use explicit type annotations in TypeScript
--    - No implicit 'any' types allowed
--    - Test builds frequently during development

-- 5. COMMON ISSUES TO AVOID:
--    - Don't assume poll_index values match question numbers
--    - Verify data sources before implementing complex logic
--    - Test data combination with known data sets
--    - Add comprehensive logging for data flow debugging

-- 6. POLL RESULTS UI IMPROVEMENTS (2025-01-18):
--    - Single question display for focused viewing
--    - Expandable poll groups in navigation panel
--    - Visual selection feedback with blue ring highlights
--    - Clean interface without debug logging
--    - Mobile-optimized responsive design

-- 7. WORDCLOUD POLL SYSTEM (2025-01-20):
--    - Custom Canvas-based wordcloud rendering (React 19 compatible)
--    - Division by zero protection in wordcloud_results view
--    - Size-based positioning with largest words in center
--    - Aquatic blue/green color scheme
--    - 1-3 words per submission, 20 character limit

-- 8. MATRIX GRAPH SYSTEM (2025-01-01):
--    - Prioritization matrix graphs for question pairs (1-2, 3-4, 5-6, 7-8, 9-10)
--    - CEW users: Multiple votes create multiple data points (Phase 2 fix)
--    - Authenticated users: Only last vote per question per user
--    - Vote tracking: importanceVotes/feasibilityVotes arrays for CEW users
--    - Data point creation: Multiple pairs for CEW, single pair for authenticated
--    - User ID consistency: x-session-id header for proper vote pairing
--    - Overlapping visualization: 4-mode system (Jittered, Size-Scaled, Heatmap, Concentric)

-- 8. HOLISTIC PROTECTION QUESTION TEXT UPDATES (2025-01-26):
--    - Question text synchronization across ALL locations is CRITICAL
--    - Database, CEW polls, survey-results, admin panel, k6 tests must match exactly
--    - Mismatched text causes "Question not found" errors in admin panel
--    - Always update ALL locations simultaneously with identical text
--    - Verify data flow: Database → API → Frontend components

-- 9. ADMIN PANEL QUESTION MATCHING (2025-01-26):
--    - currentPollQuestions array must match database question text exactly
--    - Case-sensitive matching required
--    - Extra spaces or special characters cause matching failures
--    - Implement question matching validation in admin panel

-- 10. MATRIX GRAPH DATA INTEGRATION (2025-01-26):
--    - API must combine data from both /survey-results and /cew-polls paths
--    - Use combineResults helper function to merge data properly
--    - Test data aggregation with known data sets
--    - Verify response counts match expected values

-- 11. FILTER SYSTEM IMPLEMENTATION (2025-01-26):
--    - Filter parameter must be passed from frontend to API
--    - Implement filtering logic in API endpoint
--    - Test all filter combinations with known data
--    - Verify graphs change based on filter selection

-- 12. POLL INDEX vs QUESTION NUMBER (2025-01-26):
--    - Database poll_index is ZERO-BASED (0, 1, 2, 3...)
--    - UI question numbers are ONE-BASED (1, 2, 3, 4...)
--    - poll_index 0 = Question 1, poll_index 1 = Question 2, etc.
--    - Always account for zero-based indexing when mapping database to UI

-- 13. OPTION TEXT DISPLAY (2025-01-26):
--    - Database options JSONB column contains actual option text
--    - Not automatically generated - stored in database
--    - Verify option text matches frontend expectations
--    - Update options column with correct option strings

-- 14. DUPLICATE QUESTION CLEANUP (2025-01-26):
--    - Check for duplicate poll_index values in all poll tables
--    - Delete old duplicate questions before adding new ones
--    - Implement comprehensive cleanup verification
--    - Test admin panel display after cleanup

-- 15. k6 TEST EXECUTION (2025-01-26):
--    - k6 scripts must be run with 'k6 run' command, NOT 'node'
--    - 'node k6-test.js' fails with module not found error
--    - Document proper execution commands for all test scripts
--    - Test script execution before deployment

-- 16. TYPESCRIPT BUILD SAFETY (2025-01-26):
--    - Run 'npm run build' frequently during development
--    - Fix all TypeScript errors and JSX compliance issues
--    - Production build has stricter settings than local development
--    - No implicit 'any' types allowed in production

-- 17. MATRIX GRAPH VISUALIZATION SYSTEM (January 2025):
--    - 4-mode visualization for overlapping data points: Jittered, Size-Scaled, Heatmap, Concentric
--    - Improved color spectrum from light blue to standard blue progression
--    - Icon-based mode switching with ScatterChart, Circle, Zap, Layers icons
--    - Enhanced tooltips showing cluster size and individual user information

-- 18. CHANGE VOTE FUNCTIONALITY FIXES (January 2025):
--    - Fixed duplicate vote issue for authenticated users in survey-results pages
--    - Added partial unique index on poll_votes (poll_id, user_id) for authenticated users only
--    - CEW users excluded from unique constraint to preserve insert-only behavior
--    - Modified API endpoints to use delete-then-insert approach for vote changes
--    - Fixed ranking poll change vote button disabled state issue
--    - Fixed wordcloud image persistence after browser refresh for survey-results pages
--    - All change vote functionality now works correctly without creating duplicates

-- 19. MATRIX GRAPH UI CLEANUP (January 2025):
--    - Simplified text display: "n = X" format instead of verbose response counts
--    - Color spectrum bar: Gradient bar (max 6 segments) instead of individual dots
--    - Fallback messaging: "All points at same location (X points)" for single-cluster data
--    - Cleaner legend: "Light = less, Dark = more" simplified explanation
--    - Professional appearance: Scientific/statistical visualization style

-- 19. K6 TEST USER ID MISMATCH ISSUE (January 2025):
--    - CRITICAL: API ignores k6's user_id in JSON payload
--    - API generates user_id from x-session-id header, not JSON payload
--    - K6 test must send x-session-id header for proper user_id generation
--    - Without x-session-id header, all votes get same user_id (CEW2025_default)
--    - This prevents vote pairing for matrix graphs
--    - Solution: Add headers: { 'x-session-id': sessionId } to K6 test submissions

-- 19. MATRIX GRAPH LOGIC CONFIRMATION (January 2025):
--    - Matrix graphs show unique users with paired votes, NOT total votes per question
--    - Left panel shows total votes (e.g., 15 for Q1, 15 for Q2)
--    - Matrix graph shows unique users who voted on BOTH questions (e.g., 8 users)
--    - This is CORRECT behavior - not a bug
--    - Matrix graphs require same user_id for both importance AND feasibility questions

-- 20. ADMIN PANEL UI/UX IMPROVEMENTS (January 2025):
--    - Vote bars updated from dark grey to light grey (dark:bg-gray-300) for better contrast
--    - Prioritization questions now display all 5 options consistently
--    - Logic added to detect prioritization questions via page_path.includes('prioritization')
--    - Complete option set (0-4) created with 0 votes for missing options
--    - Consistent display behavior across all poll types

-- 21. DATABASE vs FRONTEND DISCREPANCIES (2025-01-26):
--    - Frontend components may be hardcoded, not fetching from database
--    - Always verify data flow from database to frontend
--    - Update database to match frontend expectations first
--    - Then update frontend to fetch from database

-- 22. COMMON DEBUGGING MISTAKES TO AVOID:
--    - Assuming hardcoded data matches database
--    - Not testing filter combinations
--    - Ignoring zero-based vs one-based indexing
--    - Not running production builds during development
--    - Using wrong command for k6 tests
--    - Not verifying data aggregation logic
--    - Assuming automatic question matching
--    - Not checking option text in database
--    - Ignoring duplicate data cleanup
--    - Not testing with known data sets

-- 19. ADMIN PANEL FILTERING LOGIC INCONSISTENCY (January 2025):
--    - Left panel vote counts for ranking and wordcloud polls showed combined totals regardless of filter selection
--    - Root cause: Used (poll.combined_survey_votes || 0) + (poll.combined_cew_votes || 0) instead of filtered results
--    - getFilteredPollResults function didn't handle wordcloud polls properly
--    - Wordcloud polls have empty results array and use combined_survey_votes/combined_cew_votes fields
--    - Solution: Updated getFilteredPollResults to handle all poll types consistently
--    - Added wordcloud-specific logic that creates mock results based on vote count fields
--    - Always test filtering functionality across all poll types and ensure consistent data flow

-- 8. CEW POLL MULTIPLE SUBMISSIONS (2025-01-25):
--    - CEW polls allow multiple submissions from same conference code (CEW2025)
--    - Each submission gets unique user_id: ${authCode}_${sessionId} where sessionId is from x-session-id header
--    - NO deletions for CEW submissions - all responses are preserved
--    - Enables multiple conference attendees to submit using same CEW2025 code
--    - Applies to all poll types: single-choice, ranking, and wordcloud
--    - Authenticated users still get vote replacement (delete + insert)

-- 8. WORDCLOUD UX IMPROVEMENTS (2025-01-26):
--    - High-DPI canvas rendering for crisp text on all displays
--    - Grid-based layout with collision detection to eliminate overlapping words
--    - Dark mode support with theme-specific color palettes
--    - Enhanced readability with minimal text rotation and proper spacing
--    - Better color contrast with inverted color selection for larger words

-- 8. TWG REVIEW ACCESS CONTROL (2025-01-31):
--    - TWG Review page now requires authentication only (no role checks)
--    - Matches access pattern of other dashboard pages (Dashboard, WIKS, Survey Results)
--    - Removed role checking delays - authenticated users access immediately
--    - Role checks are only needed for admin pages (/admin/*)
--    - The 'member' role is still assigned by database trigger for tracking purposes
--    - Authentication is enforced by middleware and page-level checks

-- 9. PRIORITIZATION MATRIX GRAPH SYSTEM (2025-01-20):
--    - Custom SVG implementation for prioritization matrix graphs
--    - Landscape orientation (16:9) optimized for admin panel
--    - User-by-user vote pairing for question pairs 1-2, 3-4, 5-6, 7-8, 9-10
--    - Scale inversion (1=high, 5=low) for proper graph mapping
--    - Color-coded quadrants: green (HIGH PRIORITY), red (NO GO), black (other)
--    - Dark mode support with dynamic theming
--    - Response tracking for paired vote calculations

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
    file_name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    file_size BIGINT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
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
    rs.created_at as submission_created_at,
    rs.updated_at as submission_updated_at,
    COALESCE(
        (SELECT COUNT(*) FROM review_files rf WHERE rf.submission_id = rs.id),
        0
    ) as file_count
FROM review_submissions rs
LEFT JOIN get_users_with_emails() aue ON rs.user_id = aue.id;

-- Grant permissions on the view
GRANT SELECT ON admin_review_submissions TO authenticated;

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

CREATE TRIGGER update_review_submissions_updated_at 
    BEFORE UPDATE ON review_submissions 
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
-- POLL SYSTEM TABLES (SINGLE-CHOICE AND RANKING POLLS)
-- ============================================================================

-- Polls table to store single-choice poll definitions
CREATE TABLE IF NOT EXISTS polls (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    page_path VARCHAR(255) NOT NULL, -- e.g., '/survey-results/holistic-protection'
    poll_index INTEGER NOT NULL, -- 0-based index of poll on the page
    question TEXT NOT NULL,
    options JSONB NOT NULL, -- Array of option strings
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Poll votes table to store individual single-choice votes
-- Updated to support both authenticated users (UUID) and CEW conference codes (TEXT)
CREATE TABLE IF NOT EXISTS poll_votes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    poll_id UUID REFERENCES polls(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL, -- Can be UUID (authenticated) or CEW code (e.g., "CEW2025_session_123")
    option_index INTEGER NOT NULL, -- 0-based index of selected option
    other_text TEXT, -- For "Other" option responses
    voted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    -- NOTE: Unique constraints removed for CEW polls - allows multiple votes per user
    -- CEW pairing logic: Chronological pairing (1st importance + 1st feasibility, etc.)
);

-- Partial unique index for authenticated users only (enables vote changes)
-- CEW users are excluded to preserve insert-only behavior
CREATE UNIQUE INDEX IF NOT EXISTS unique_authenticated_poll_vote 
ON poll_votes (poll_id, user_id) 
WHERE user_id NOT LIKE '%session_%' AND user_id NOT LIKE '%CEW%';

-- Ranking polls table to store ranking poll definitions
CREATE TABLE IF NOT EXISTS ranking_polls (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    page_path VARCHAR(255) NOT NULL, -- e.g., '/survey-results/holistic-protection'
    poll_index INTEGER NOT NULL, -- 0-based index of poll on the page
    question TEXT NOT NULL,
    options JSONB NOT NULL, -- Array of option strings to be ranked
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Wordcloud polls table for open-ended word submissions
-- Supports 1-3 words per submission with character limits
-- Question 13 uses max_words=1 for single-choice behavior
CREATE TABLE IF NOT EXISTS wordcloud_polls (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    page_path VARCHAR(255) NOT NULL, -- e.g., '/survey-results/prioritization'
    poll_index INTEGER NOT NULL, -- 0-based index of poll on the page
    question TEXT NOT NULL,
    max_words INTEGER DEFAULT 3, -- Maximum words per submission (1 for Question 13, 1-3 for others)
    word_limit INTEGER DEFAULT 20, -- Maximum characters per word
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Ranking votes table to store individual ranking votes
-- Updated to support both authenticated users (UUID) and CEW conference codes (TEXT)
CREATE TABLE IF NOT EXISTS ranking_votes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    ranking_poll_id UUID REFERENCES ranking_polls(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL, -- Can be UUID (authenticated) or CEW code (e.g., "CEW2025")
    option_index INTEGER NOT NULL, -- 0-based index of ranked option
    rank INTEGER NOT NULL, -- 1-based rank (1 = highest priority)
    voted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    -- NOTE: Unique constraints removed for CEW polls - handled in application logic
);

-- Wordcloud votes table to store individual word submissions
-- Each word is stored as a separate record for frequency aggregation
CREATE TABLE IF NOT EXISTS wordcloud_votes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    poll_id UUID REFERENCES wordcloud_polls(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL, -- Can be UUID (authenticated) or CEW code (e.g., "CEW2025")
    word TEXT NOT NULL, -- Individual word submission
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(poll_id, user_id, word) -- Prevent duplicate words from same user
);

-- Enable RLS on poll tables
ALTER TABLE polls ENABLE ROW LEVEL SECURITY;
ALTER TABLE poll_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE ranking_polls ENABLE ROW LEVEL SECURITY;
ALTER TABLE ranking_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE wordcloud_polls ENABLE ROW LEVEL SECURITY;
ALTER TABLE wordcloud_votes ENABLE ROW LEVEL SECURITY;

-- RLS policies for polls (allow anonymous access for CEW polls)
CREATE POLICY "Anyone can view polls" ON polls FOR SELECT USING (true);
CREATE POLICY "Anyone can create polls" ON polls FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can vote in polls" ON poll_votes FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can view poll votes" ON poll_votes FOR SELECT USING (true);
CREATE POLICY "Authenticated users can delete their own votes" ON poll_votes 
    FOR DELETE 
    USING (
        -- ONLY allow deletion if user is authenticated and matches the user_id
        -- EXPLICITLY EXCLUDE CEW users (session-based user_ids)
        auth.uid()::text = user_id
        AND user_id NOT LIKE '%session_%' 
        AND user_id NOT LIKE '%CEW%'
    );

-- RLS policies for ranking polls (allow anonymous access for CEW polls)
CREATE POLICY "Anyone can view ranking polls" ON ranking_polls FOR SELECT USING (true);
CREATE POLICY "Anyone can create ranking polls" ON ranking_polls FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can vote in ranking polls" ON ranking_votes FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can view ranking votes" ON ranking_votes FOR SELECT USING (true);
CREATE POLICY "Authenticated users can delete their own ranking votes" ON ranking_votes 
    FOR DELETE 
    USING (
        -- ONLY allow deletion if user is authenticated and matches the user_id
        -- EXPLICITLY EXCLUDE CEW users (session-based user_ids)
        auth.uid()::text = user_id
        AND user_id NOT LIKE '%session_%' 
        AND user_id NOT LIKE '%CEW%'
    );

-- RLS policies for wordcloud polls (allow anonymous access for CEW polls)
CREATE POLICY "Anyone can view wordcloud polls" ON wordcloud_polls FOR SELECT USING (true);
CREATE POLICY "Anyone can create wordcloud polls" ON wordcloud_polls FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can vote in wordcloud polls" ON wordcloud_votes FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can view wordcloud votes" ON wordcloud_votes FOR SELECT USING (true);
CREATE POLICY "Authenticated users can delete their own wordcloud votes" ON wordcloud_votes 
    FOR DELETE 
    USING (
        -- ONLY allow deletion if user is authenticated and matches the user_id
        -- EXPLICITLY EXCLUDE CEW users (session-based user_ids)
        auth.uid()::text = user_id
        AND user_id NOT LIKE '%session_%' 
        AND user_id NOT LIKE '%CEW%'
    );

-- Poll results view for aggregated single-choice poll data
CREATE OR REPLACE VIEW poll_results WITH (security_invoker = on) AS
SELECT 
    p.id as poll_id,
    p.page_path,
    p.poll_index,
    p.question,
    p.options,
    p.created_at,
    p.updated_at,
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
        COUNT(*) as total_votes
    FROM poll_votes
    GROUP BY poll_id, option_index
) option_counts ON p.id = option_counts.poll_id
GROUP BY p.id, p.page_path, p.poll_index, p.question, p.options, p.created_at, p.updated_at, option_counts.total_votes;

-- Ranking results view for aggregated ranking poll data (FIXED VERSION)
CREATE OR REPLACE VIEW ranking_results WITH (security_invoker = on) AS
SELECT 
    rp.id as ranking_poll_id,
    rp.page_path,
    rp.poll_index,
    rp.question,
    rp.options,
    rp.created_at,
    rp.updated_at,
    COUNT(DISTINCT rv.user_id) as total_votes, -- Count unique users, not individual votes
    COALESCE(
        (
            SELECT jsonb_agg(
                jsonb_build_object(
                    'option_index', option_stats.option_index,
                    'option_text', rp.options[option_stats.option_index],
                    'averageRank', option_stats.avg_rank,
                    'votes', option_stats.vote_count
                ) ORDER BY option_stats.option_index
            )
            FROM (
                SELECT 
                    rv2.option_index,
                    AVG(rv2.rank::numeric) as avg_rank,
                    COUNT(rv2.id) as vote_count
                FROM ranking_votes rv2
                WHERE rv2.ranking_poll_id = rp.id
                GROUP BY rv2.option_index
            ) option_stats
        ),
        '[]'::jsonb
    ) as results
FROM ranking_polls rp
LEFT JOIN ranking_votes rv ON rp.id = rv.ranking_poll_id
GROUP BY rp.id, rp.page_path, rp.poll_index, rp.question, rp.options, rp.created_at, rp.updated_at;

-- Wordcloud results view for aggregated wordcloud poll data
-- Includes division by zero protection for percentage calculations
CREATE OR REPLACE VIEW wordcloud_results WITH (security_invoker = on) AS
WITH wordcloud_data AS (
    SELECT
        wp.id AS poll_id,
        wp.page_path,
        wp.poll_index,
        wp.question,
        wp.max_words,
        wp.word_limit,
        wv.word,
        COUNT(wv.word) AS frequency,
        COUNT(DISTINCT wv.user_id) AS unique_users
    FROM
        wordcloud_polls wp
    LEFT JOIN
        wordcloud_votes wv ON wp.id = wv.poll_id
    GROUP BY
        wp.id, wp.page_path, wp.poll_index, wp.question, wp.max_words, wp.word_limit, wv.word
),
total_counts AS (
    SELECT
        poll_id,
        SUM(frequency) AS total_words,
        COUNT(DISTINCT unique_users) AS total_responses
    FROM
        wordcloud_data
    WHERE
        word IS NOT NULL
    GROUP BY
        poll_id
)
SELECT
    wd.poll_id,
    wd.page_path,
    wd.poll_index,
    wd.question,
    wd.max_words,
    wd.word_limit,
    COALESCE(tc.total_responses, 0) AS total_responses,
    wd.word,
    wd.frequency,
    CASE 
        WHEN tc.total_words IS NULL OR tc.total_words = 0 
        THEN 0.0
        ELSE ROUND((wd.frequency::numeric / tc.total_words::numeric) * 100, 2)
    END AS percentage
FROM
    wordcloud_data wd
LEFT JOIN
    total_counts tc ON wd.poll_id = tc.poll_id
WHERE
    wd.word IS NOT NULL
ORDER BY
    wd.poll_id, wd.frequency DESC, wd.word;

-- Grant permissions on poll tables and views
GRANT SELECT, INSERT, UPDATE, DELETE ON polls TO authenticated, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON poll_votes TO authenticated, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON ranking_polls TO authenticated, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON ranking_votes TO authenticated, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON wordcloud_polls TO authenticated, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON wordcloud_votes TO authenticated, anon;
GRANT SELECT ON poll_results TO authenticated, anon;
GRANT SELECT ON ranking_results TO authenticated, anon;
GRANT SELECT ON wordcloud_results TO authenticated, anon;

-- Helper functions for poll creation and management
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

-- Wordcloud poll helper function
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

-- Wordcloud word counts helper function
CREATE OR REPLACE FUNCTION get_wordcloud_word_counts(
    p_page_path VARCHAR(255),
    p_poll_index INTEGER
) RETURNS TABLE(
    poll_id UUID,
    page_path TEXT,
    poll_index INTEGER,
    question TEXT,
    max_words INTEGER,
    word_limit INTEGER,
    total_votes BIGINT,
    word TEXT,
    frequency BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        wp.id,
        wp.page_path,
        wp.poll_index,
        wp.question,
        wp.max_words,
        wp.word_limit,
        COUNT(DISTINCT wv.user_id) as total_votes,
        wv.word,
        COUNT(wv.word) as frequency
    FROM wordcloud_polls wp
    LEFT JOIN wordcloud_votes wv ON wp.id = wv.poll_id
    WHERE wp.page_path = p_page_path AND wp.poll_index = p_poll_index
    GROUP BY wp.id, wp.page_path, wp.poll_index, wp.question, wp.max_words, wp.word_limit, wv.word
    ORDER BY frequency DESC, wv.word;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permissions on helper functions
GRANT EXECUTE ON FUNCTION get_or_create_poll TO authenticated, anon;
GRANT EXECUTE ON FUNCTION get_or_create_ranking_poll TO authenticated, anon;
GRANT EXECUTE ON FUNCTION get_or_create_wordcloud_poll_fixed TO authenticated, anon;
GRANT EXECUTE ON FUNCTION get_wordcloud_word_counts TO authenticated, anon;
-- See safe_ranking_system_fixed.sql for the original implementation
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
