# Database Safety Protocol for Poll Schema Implementation

## 🚨 CRITICAL SAFETY PROTOCOL

**HISTORICAL CONTEXT**: AI has previously provided SQL scripts that replaced and duplicated functional database policies, causing significant harm and days of lost debugging time. This protocol prevents similar issues.

## 📋 Pre-Implementation Safety Checks

### 1. **MANDATORY: Current System Status Verification**

Before implementing ANY poll schema changes, run these verification queries:

```sql
-- Check current system status
SELECT 'System Status' as check_type, 'VERIFY BEFORE ACTING' as instruction;

-- Verify all existing tables exist and are functional
SELECT table_name, 'EXISTS' as status 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('user_roles', 'discussions', 'likes', 'documents', 'tags', 'announcements', 'milestones');

-- Verify all existing functions exist
SELECT routine_name, 'EXISTS' as status 
FROM information_schema.routines 
WHERE routine_name IN ('get_users_with_emails', 'handle_new_user', 'update_updated_at_column');

-- Verify all existing triggers exist
SELECT trigger_name, 'EXISTS' as status 
FROM information_schema.triggers 
WHERE trigger_name = 'on_auth_user_created';

-- Verify RLS policies are intact
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE tablename IN ('user_roles', 'discussions', 'likes', 'documents', 'tags', 'announcements', 'milestones');
```

### 2. **MANDATORY: Test Existing Functionality**

Before making changes, verify these critical functions work:

```sql
-- Test user role functionality
SELECT COUNT(*) as user_count FROM user_roles;
SELECT COUNT(*) as admin_count FROM user_roles WHERE role = 'admin';

-- Test discussion functionality
SELECT COUNT(*) as discussion_count FROM discussions;

-- Test document functionality
SELECT COUNT(*) as document_count FROM documents;

-- Test user email function
SELECT * FROM get_users_with_emails() LIMIT 5;
```

## 🛡️ Safe Implementation Strategy

### Phase 1: **Isolated Poll Schema Creation**

**GOAL**: Create poll tables without affecting existing functionality

```sql
-- Step 1: Create polls table (isolated)
CREATE TABLE IF NOT EXISTS polls (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    page_path VARCHAR(255) NOT NULL,
    poll_index INTEGER NOT NULL,
    question TEXT NOT NULL,
    options JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Step 2: Create poll_votes table (isolated)
CREATE TABLE IF NOT EXISTS poll_votes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    poll_id UUID REFERENCES polls(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    option_index INTEGER NOT NULL,
    voted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(poll_id, user_id)
);

-- Step 3: Create poll_results view (isolated)
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

### Phase 2: **RLS Policies (Non-Intrusive)**

**GOAL**: Add RLS policies without modifying existing ones

```sql
-- Step 4: Enable RLS on new tables (safe)
ALTER TABLE polls ENABLE ROW LEVEL SECURITY;
ALTER TABLE poll_votes ENABLE ROW LEVEL SECURITY;

-- Step 5: Create RLS policies (isolated, no conflicts)
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
```

### Phase 3: **Helper Functions (Non-Conflicting)**

**GOAL**: Add poll functions without affecting existing functions

```sql
-- Step 6: Create poll helper functions (isolated)
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
```

### Phase 4: **Update Triggers (Minimal Impact)**

**GOAL**: Add poll table triggers without affecting existing ones

```sql
-- Step 7: Add triggers for poll tables (isolated)
CREATE TRIGGER update_polls_updated_at 
    BEFORE UPDATE ON polls 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

## 🔍 Post-Implementation Verification

### 1. **Verify New Tables Work**

```sql
-- Test poll creation
SELECT get_or_create_poll('/test', 0, 'Test Question', '["Option 1", "Option 2"]'::jsonb);

-- Test poll results view
SELECT * FROM poll_results LIMIT 5;

-- Test vote submission (replace with actual poll_id)
-- SELECT submit_poll_vote('poll-id-here', 0);
```

### 2. **Verify Existing Functionality Still Works**

```sql
-- Re-run all verification queries from Phase 1
-- All should return the same results as before
```

### 3. **Verify No Conflicts**

```sql
-- Check for any naming conflicts
SELECT routine_name FROM information_schema.routines 
WHERE routine_name LIKE '%poll%';

-- Check for any policy conflicts
SELECT policyname FROM pg_policies 
WHERE policyname LIKE '%poll%';
```

## 🚨 Emergency Rollback Plan

If ANY issues arise, immediately run:

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

## ✅ Success Criteria

The poll schema implementation is successful when:

1. **All existing functionality works unchanged**
2. **New poll tables are created and functional**
3. **RLS policies work correctly**
4. **No naming conflicts exist**
5. **All existing queries return identical results**
6. **Admin dashboard still works**
7. **User management still works**
8. **Document management still works**
9. **Discussion forum still works**

## 🚫 What NOT to Do

- **NEVER modify existing tables**
- **NEVER modify existing functions**
- **NEVER modify existing triggers**
- **NEVER modify existing RLS policies**
- **NEVER use conflicting names**
- **NEVER assume database state**
- **NEVER skip verification steps**

## 📞 Emergency Contacts

If issues arise:
1. **STOP immediately**
2. **Run rollback script**
3. **Verify existing functionality**
4. **Document the issue**
5. **Re-analyze the problem**

---

**Remember**: This system is production-ready and fully functional. The poll schema is an ADDITION, not a replacement. Always verify before acting.
