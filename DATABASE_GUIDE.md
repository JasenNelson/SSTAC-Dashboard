# Database Guide for SSTAC & TWG Dashboard

## 🗄️ **Database Architecture Overview**

The SSTAC & TWG Dashboard uses Supabase (PostgreSQL) with a comprehensive schema designed for security, performance, and scalability.

### **Core Technology Stack**
- **Database**: PostgreSQL via Supabase
- **Authentication**: Supabase Auth with custom role management
- **Security**: Row Level Security (RLS) on all tables
- **Real-time**: Supabase real-time subscriptions

## 📊 **Database Schema**

### **Core Tables**

#### **`auth.users`** (Supabase Managed)
- **Purpose**: Core user authentication data
- **Contains**: `id` (UUID), `email`, `created_at`, `email_confirmed_at`, `last_sign_in_at`
- **Access**: Through secure `get_users_with_emails()` function
- **Security**: RLS policies and authentication required
- **Note**: DOES NOT contain application roles

#### **`user_roles`** (Custom Application Table)
- **Purpose**: User role management and access control
- **Contains**: `user_id` (UUID reference), `role`, `created_at`
- **Allowed Roles**: `admin`, `member`
- **Constraints**: Unique user-role combinations
- **Note**: DOES NOT store email addresses

#### **`discussions`** & **`discussion_replies`**
- **Purpose**: Forum functionality with user tracking
- **Features**: Threaded discussions, user attribution, real-time updates
- **Enhanced**: Like system integration

#### **`likes`** (Phase 3 Enhancement)
- **Purpose**: User interactions with discussions and replies
- **Constraints**: Users can only like either a discussion OR a reply, not both
- **Uniqueness**: Users can only like a specific discussion/reply once
- **Cascade**: Likes are automatically removed when discussions/replies are deleted

#### **`documents`**, **`tags`**, **`announcements`**, **`milestones`**
- **Purpose**: Content management system
- **Features**: File storage, categorization, project timeline

#### **`polls` & `poll_votes`** (Single-Choice Poll System)
- **Purpose**: Interactive single-choice poll system
- **Features**: Vote persistence, real-time results, admin management
- **CEW Support**: Accepts both UUID (authenticated) and CEW codes (e.g., "CEW2025")
- **Constraints**: Simplified - no unique constraints (handled in application logic)
- **Security**: RLS policies allow anonymous access for CEW polls

#### **`ranking_polls` & `ranking_votes`** (Ranking Poll System)
- **Purpose**: Interactive ranking poll system
- **Features**: Multi-option ranking, average rank calculation, real-time results
- **CEW Support**: Accepts both UUID (authenticated) and CEW codes (e.g., "CEW2025")
- **Constraints**: Simplified - no unique constraints (handled in application logic)
- **Security**: RLS policies allow anonymous access for CEW polls

### **Critical Database Views**

#### **`users_overview`**
- **Purpose**: Comprehensive user activity overview
- **Data Sources**: `user_roles`, `discussions`, `likes`, `auth.users`
- **Features**: Activity tracking, email display, role management

#### **`admin_users_comprehensive`**
- **Purpose**: Complete admin user management
- **Features**: 100% user coverage, real emails, engagement metrics
- **Use Case**: Primary admin dashboard user management

#### **`discussion_stats`**
- **Purpose**: Aggregated discussion metrics
- **Features**: Reply counts, last activity, user attribution

#### **`documents_with_tags`**
- **Purpose**: Document-tag relationships for efficient querying
- **Features**: Tag aggregation, document metadata

#### **`poll_results`** (Single-Choice Poll System View)
- **Purpose**: Aggregated single-choice poll results
- **Features**: Vote counts, percentage calculations, real-time updates
- **CEW Support**: Includes both authenticated and CEW conference votes
- **Data Sources**: `polls`, `poll_votes` tables
- **Performance**: Optimized for fast poll result retrieval

#### **`ranking_results`** (Ranking Poll System View - FIXED VERSION)
- **Purpose**: Aggregated ranking poll results
- **Features**: Average rank calculations, vote counts, option text mapping
- **CEW Support**: Includes both authenticated and CEW conference votes
- **Data Sources**: `ranking_polls`, `ranking_votes` tables
- **Performance**: Optimized with subquery approach to avoid aggregate function nesting
- **Fix Applied**: Corrected to count unique users instead of individual ranking votes

### **CEW Conference Polling System** ✅ COMPLETED (FINAL VERSION)

#### **System Overview**
The CEW conference polling system supports both authenticated dashboard users and anonymous conference attendees through a unified database schema.

#### **Key Design Decisions**
1. **Simplified Constraints**: Removed complex unique constraints that caused submission failures
2. **Privacy-Focused**: No client-side persistence for true privacy in incognito mode
3. **Anonymous Access**: RLS policies allow anonymous voting for CEW polls
4. **Unified Database**: CEW votes combined with authenticated user votes in same tables
5. **Application-Level Uniqueness**: Vote uniqueness handled in application logic, not database constraints

#### **Database Schema Changes**
- **`poll_votes.user_id`**: Changed from UUID to TEXT to accept both UUIDs and CEW codes
- **`ranking_votes.user_id`**: Changed from UUID to TEXT to accept both UUIDs and CEW codes
- **Unique Constraints**: Removed `UNIQUE(poll_id, user_id)` and `UNIQUE(ranking_poll_id, user_id)`
- **RLS Policies**: Updated to allow anonymous access for CEW polls
- **Helper Functions**: Enhanced to support both authentication modes

#### **CEW Poll Authentication Flow**
```
Conference Attendee → Enter "CEW2025" → Anonymous Supabase Client → Vote Submission
Dashboard User → Authenticated Session → Authenticated Supabase Client → Vote Submission
```

#### **Privacy Implementation**
- **No localStorage/sessionStorage**: CEW polls don't persist votes client-side
- **Anonymous Supabase Clients**: API routes use null cookie handlers for true anonymity
- **No Vote Retrieval**: CEW poll results APIs don't return user-specific vote data
- **Incognito Mode Compatible**: True privacy in incognito/private browsing modes

### **Database Functions**

#### **`get_users_with_emails()`**
```sql
-- Returns user information from auth.users
-- Only accessible to authenticated users
-- Filters confirmed email users only
-- Orders by creation date (newest first)
```

#### **`handle_new_user()`**
```sql
-- Trigger function for new user registration
-- Automatically assigns 'member' role
-- Handles conflicts gracefully
-- Maintains data integrity
```

### **TWG Review Data & Files**

#### **`review_files` Column Names**
Standardized columns are: `file_name`, `mime_type`, `created_at` (superseding older references `filename`, `mimetype`, `uploaded_at`).

#### **`admin_review_submissions` Aliases**
Exposes `submission_created_at` and `submission_updated_at` for clarity in server components.

#### **TWG Review Role Fallback**
`/twg/review` server component includes a safe, one-time fallback that inserts a `member` role for the current confirmed user if the `on_auth_user_created` trigger has not yet populated `user_roles`. This removes the need for manual role assignment and does not affect existing policies.

#### **`update_updated_at_column()`**
```sql
-- Automatic timestamp updates
-- Triggered on table updates
-- Maintains audit trail
```

## 🔐 **Security Implementation**

### **Row Level Security (RLS)**
- **All Tables**: Protected by RLS policies
- **User Isolation**: Users can only see their own data
- **Admin Access**: Admins can manage all user data
- **Policy Enforcement**: Automatic access control

### **Authentication & Authorization**
- **Supabase Auth**: Secure user authentication system
- **Role-Based Access**: Different capabilities for admins vs members
- **Session Management**: Secure session handling and validation
- **API Security**: Protected endpoints with proper authentication

### **Permission Management**
- **Granular Control**: Specific permissions for different operations
- **Role-Based Access**: Different capabilities for admins vs members
- **Function Permissions**: Controlled access to user management functions
- **View Permissions**: Secure access to user management views

## 🚨 **CRITICAL DATABASE SAFETY PROTOCOL**

### **⚠️ MANDATORY SAFETY CHECKS BEFORE ANY DATABASE CHANGES**

**HISTORICAL CONTEXT**: AI has previously provided SQL scripts that replaced and duplicated functional database policies, causing significant harm and days of lost debugging time. This protocol prevents such incidents.

### **🔍 PRE-MODIFICATION SAFETY CHECKS (MANDATORY)**

#### **1. Current State Verification**
```sql
-- ALWAYS run these queries before making changes
-- Check current table structure
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = '[TABLE_NAME]' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- Check existing policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE tablename = '[TABLE_NAME]' 
AND schemaname = 'public'
ORDER BY policyname;

-- Check RLS status
SELECT schemaname, tablename, rowsecurity as rls_enabled
FROM pg_tables 
WHERE tablename = '[TABLE_NAME]' 
AND schemaname = 'public';
```

#### **2. Functionality Testing**
```sql
-- Test current functionality works
-- Test read access
SELECT COUNT(*) FROM [TABLE_NAME];

-- Test write access (if applicable)
INSERT INTO [TABLE_NAME] (test_column) VALUES ('test') RETURNING id;

-- Test user permissions
SELECT auth.uid() as current_user_id;
```

#### **3. Impact Assessment**
- **Count existing records** that might be affected
- **Check for recent activity** (last 7 days)
- **Verify user roles** and permissions
- **Test current user access** levels

### **🛡️ SAFETY PRINCIPLES**

#### **NEVER ASSUME DATABASE STATE**
- Always verify current structure before changes
- Always test existing functionality first
- Always check for existing policies/constraints
- Always verify user permissions

#### **ALWAYS PROVIDE ROLLBACK SCRIPTS**
```sql
-- Example rollback script (save before making changes)
-- Restore original state if needed
DROP POLICY IF EXISTS "new_policy_name" ON table_name;
CREATE POLICY "original_policy_name" ON table_name
    FOR [OPERATION] 
    TO [ROLES]
    [CONDITIONS];
```

#### **ALWAYS TEST INCREMENTALLY**
- Make one change at a time
- Test after each change
- Verify functionality still works
- Document what was changed

### **🚫 WHAT NOT TO DO**

#### **NEVER**
- Replace existing policies without understanding their purpose
- Drop policies without checking dependencies
- Assume database schema matches documentation
- Make multiple changes simultaneously
- Skip functionality testing

#### **NEVER ASSUME**
- Database state matches code expectations
- Existing policies are "wrong" without verification
- User has proper permissions
- Changes won't break existing functionality

### **✅ SAFETY CHECKLIST**

Before ANY database modification:

- [ ] **Current state verified** with diagnostic queries
- [ ] **Existing functionality tested** and confirmed working
- [ ] **User permissions verified** for current user
- [ ] **Impact assessment completed** (records affected, recent activity)
- [ ] **Rollback script prepared** and saved
- [ ] **Incremental approach planned** (one change at a time)
- [ ] **Testing plan established** (how to verify success)
- [ ] **User notified** of potential impacts

### **🔄 ROLLBACK PROCEDURE**

If something breaks:

1. **Immediately stop** making further changes
2. **Run rollback script** to restore previous state
3. **Test functionality** to confirm restoration
4. **Investigate root cause** before attempting fix again
5. **Document lessons learned** for future reference

## 🗳️ **Poll System Database Schema**

### **Poll Tables Structure**

#### **`polls` Table**
```sql
CREATE TABLE IF NOT EXISTS polls (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    page_path VARCHAR(255) NOT NULL,
    poll_index INTEGER NOT NULL,
    question TEXT NOT NULL,
    options JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### **`poll_votes` Table**
```sql
CREATE TABLE IF NOT EXISTS poll_votes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    poll_id UUID REFERENCES polls(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    option_index INTEGER NOT NULL,
    voted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(poll_id, user_id)
);
```

#### **`poll_results` View**
```sql
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
```

### **Poll System RLS Policies**

#### **Polls Table Policies**
```sql
-- Allow authenticated users to read polls
CREATE POLICY "Allow authenticated users to read polls" ON polls
    FOR SELECT TO authenticated
    USING (true);

-- Allow admin users to manage polls
CREATE POLICY "Allow admin users to manage polls" ON polls
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM user_roles 
            WHERE user_id = auth.uid() AND role = 'admin'
        )
    );
```

#### **Poll Votes Table Policies**
```sql
-- Allow users to vote on polls
CREATE POLICY "Allow users to vote on polls" ON poll_votes
    FOR INSERT TO authenticated
    WITH CHECK (user_id = auth.uid());

-- Allow users to read their own votes
CREATE POLICY "Allow users to read their own votes" ON poll_votes
    FOR SELECT TO authenticated
    USING (user_id = auth.uid());

-- Allow admin users to read all votes
CREATE POLICY "Allow admin users to read all votes" ON poll_votes
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM user_roles 
            WHERE user_id = auth.uid() AND role = 'admin'
        )
    );
```

### **Poll System Helper Functions**

#### **`get_or_create_poll()`**
```sql
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
```

#### **`submit_poll_vote()`**
```sql
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
```

## 🗳️ **CEW Conference Polling System Database Schema**

### **CEW Poll System Overview**

The CEW Conference Polling System allows unauthenticated conference attendees to vote using a shared authentication code (e.g., "CEW2025"). This system integrates with the existing poll infrastructure while providing anonymous access.

### **CEW Poll System Modifications**

#### **Modified `poll_votes` Table for CEW Support**
```sql
-- Modified user_id column to support both UUIDs and CEW codes
ALTER TABLE poll_votes 
ALTER COLUMN user_id TYPE TEXT;

-- Add CHECK constraint to validate user_id format
ALTER TABLE poll_votes 
ADD CONSTRAINT check_user_id_format 
CHECK (user_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' OR user_id ~ '^CEW[0-9]{4}$');

-- Update unique constraint
ALTER TABLE poll_votes 
DROP CONSTRAINT IF EXISTS poll_votes_poll_id_user_id_key;
ALTER TABLE poll_votes 
ADD CONSTRAINT poll_votes_poll_id_user_id_key UNIQUE (poll_id, user_id);
```

#### **Modified `ranking_votes` Table for CEW Support**
```sql
-- Modified user_id column to support both UUIDs and CEW codes
ALTER TABLE ranking_votes 
ALTER COLUMN user_id TYPE TEXT;

-- Add CHECK constraint to validate user_id format
ALTER TABLE ranking_votes 
ADD CONSTRAINT check_ranking_user_id_format 
CHECK (user_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' OR user_id ~ '^CEW[0-9]{4}$');

-- Update unique constraint
ALTER TABLE ranking_votes 
DROP CONSTRAINT IF EXISTS ranking_votes_ranking_poll_id_user_id_key;
ALTER TABLE ranking_votes 
ADD CONSTRAINT ranking_votes_ranking_poll_id_user_id_key UNIQUE (ranking_poll_id, user_id);
```

### **CEW Poll System RLS Policies**

#### **Anonymous User Policies for Polls**
```sql
-- Allow anonymous users to read polls
CREATE POLICY "Allow anonymous users to read polls" ON polls
    FOR SELECT TO anon
    USING (true);

-- Allow anonymous users to read poll results
CREATE POLICY "Allow anonymous users to read poll results" ON poll_votes
    FOR SELECT TO anon
    USING (true);
```

#### **Anonymous User Policies for Poll Votes**
```sql
-- Allow anonymous users to insert poll votes
CREATE POLICY "Allow anonymous users to insert poll votes" ON poll_votes
    FOR INSERT TO anon
    USING (true);

-- Allow anonymous users to read poll votes
CREATE POLICY "Allow anonymous users to read poll votes" ON poll_votes
    FOR SELECT TO anon
    USING (true);
```

#### **Anonymous User Policies for Ranking Polls**
```sql
-- Allow anonymous users to read ranking polls
CREATE POLICY "Allow anonymous users to read ranking polls" ON ranking_polls
    FOR SELECT TO anon
    USING (true);

-- Allow anonymous users to insert ranking votes
CREATE POLICY "Allow anonymous users to insert ranking votes" ON ranking_votes
    FOR INSERT TO anon
    USING (true);

-- Allow anonymous users to read ranking votes
CREATE POLICY "Allow anonymous users to read ranking votes" ON ranking_votes
    FOR SELECT TO anon
    USING (true);
```

### **CEW Poll System API Architecture**

#### **Unified API Endpoints**
- **`/api/polls/submit`**: Handles both authenticated and CEW poll submissions
- **`/api/polls/results`**: Handles both authenticated and CEW poll results
- **`/api/ranking-polls/submit`**: Handles both authenticated and CEW ranking submissions
- **`/api/ranking-polls/results`**: Handles both authenticated and CEW ranking results

#### **CEW Authentication Flow**
1. **Code Entry**: User enters shared code (e.g., "CEW2025")
2. **Session Storage**: Code stored in browser sessionStorage
3. **API Calls**: Code passed to API endpoints as `authCode` parameter
4. **Database Storage**: Code used as `user_id` for vote storage
5. **Device Tracking**: Prevents duplicate votes per device

### **CEW Poll System Security**

#### **Data Isolation**
- **CEW Votes**: Stored with CEW codes as user_id
- **Authenticated Votes**: Stored with UUIDs as user_id
- **Unified Results**: Both types combined in result views
- **RLS Policies**: Separate policies for anonymous and authenticated access

#### **Vote Prevention**
- **Device Tracking**: localStorage prevents multiple votes per device
- **Session Persistence**: sessionStorage remembers CEW code
- **No Change Votes**: CEW users cannot change votes (one vote per device)
- **Duplicate Prevention**: Database constraints prevent duplicate votes

### **CEW Poll System Performance**

#### **Optimized for Conference Use**
- **Fast Polling**: Optimized for 100 people in 15 minutes
- **Mobile-Friendly**: Responsive design for mobile devices
- **Real-time Results**: Live updates during presentations
- **Efficient Queries**: Optimized database queries for large audiences

#### **Scalability Features**
- **Anonymous Access**: No user account creation required
- **Shared Authentication**: Single code for all attendees
- **Device-Based Tracking**: Prevents duplicate votes efficiently
- **Unified Database**: All votes stored in same system

## 📈 **Performance Optimization**

### **Indexing Strategy**
- **User ID Indexes**: On all user-related tables
- **Activity Indexes**: On creation dates and activity types
- **Role Indexes**: On role assignments and lookups
- **Composite Indexes**: For complex queries

### **Query Optimization**
- **View Materialization**: Efficient data aggregation
- **Function Caching**: Secure function performance
- **RLS Optimization**: Minimal security overhead
- **Activity Counting**: Efficient subquery performance

### **Scalability Features**
- **Automatic Role Assignment**: No manual intervention needed
- **Efficient Views**: Optimized for large user bases
- **Security Scaling**: RLS policies scale automatically
- **Function Performance**: Secure and fast user data access

## 🔧 **Database Maintenance**

### **Regular Health Checks**
```sql
-- Monitor user growth
SELECT COUNT(*) FROM admin_users_comprehensive;

-- Check role distribution
SELECT role, COUNT(*) FROM user_roles GROUP BY role;

-- Verify function access
SELECT routine_name FROM information_schema.routines 
WHERE routine_name = 'get_users_with_emails';

-- Check RLS policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE tablename IN ('user_roles', 'discussions', 'likes');
```

### **Performance Monitoring**
```sql
-- View performance
EXPLAIN ANALYZE SELECT * FROM admin_users_comprehensive;

-- Function performance
EXPLAIN ANALYZE SELECT * FROM get_users_with_emails();
```

### **Security Auditing**
```sql
-- Check RLS policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE tablename IN ('user_roles', 'discussions', 'likes');

-- Verify permissions
SELECT grantee, privilege_type, table_name 
FROM information_schema.role_table_grants 
WHERE table_name IN ('users_overview', 'admin_users_comprehensive');
```

## 🚨 **Emergency Procedures**

### **Database Recovery**
If database changes cause issues:

1. **STOP** - Don't make any more changes
2. **ASSESS** - Determine what's broken
3. **ROLLBACK** - Use prepared rollback scripts
4. **VERIFY** - Confirm functionality is restored
5. **INVESTIGATE** - Understand what went wrong
6. **PLAN** - Create better approach before retrying

### **Emergency Rollback Scripts**

#### **Poll System Rollback**
```sql
-- Emergency rollback: Remove poll tables
DROP TABLE IF EXISTS poll_votes CASCADE;
DROP TABLE IF EXISTS polls CASCADE;
DROP VIEW IF EXISTS poll_results CASCADE;

-- Remove poll functions
DROP FUNCTION IF EXISTS get_or_create_poll(VARCHAR, INTEGER, TEXT, JSONB);
DROP FUNCTION IF EXISTS submit_poll_vote(UUID, INTEGER);
DROP FUNCTION IF EXISTS get_poll_results(UUID);

-- Verify existing system still works
SELECT COUNT(*) FROM user_roles;
SELECT COUNT(*) FROM discussions;
SELECT COUNT(*) FROM documents;
```

## 📚 **Database Documentation References**

### **Related Files**
- **README.md**: Project overview and quick start
- **AGENTS.md**: AI assistant guidelines for database work
- **PROJECT_MEMORY.md**: Database-related lessons learned
- **SETUP_GUIDE.md**: Database setup and migration procedures
- **PROJECT_STATUS.md**: Current database implementation status

### **Key Principles**
1. **Security First**: All database operations must respect RLS policies
2. **Safety Protocol**: Always verify before making changes
3. **Performance**: Optimize queries and use proper indexing
4. **Documentation**: Keep this guide updated with any changes
5. **Testing**: Always test changes in development first

---

**Remember**: This database system is production-ready and fully functional. Always follow the safety protocols and never assume the current state matches documentation.
