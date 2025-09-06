# Poll Implementation Safety Checklist

## 🚨 CRITICAL: Follow This Checklist Exactly

**HISTORICAL CONTEXT**: AI has previously caused significant database issues. This checklist prevents similar problems.

## ✅ Pre-Implementation Checklist

### 1. **System Status Verification** (MANDATORY)
- [ ] Run verification queries from `DATABASE_SAFETY_PROTOCOL_POLLS.md`
- [ ] Confirm all existing tables exist and are functional
- [ ] Confirm all existing functions exist and work
- [ ] Confirm all existing triggers exist and work
- [ ] Confirm all existing RLS policies are intact
- [ ] Test user role functionality works
- [ ] Test discussion functionality works
- [ ] Test document functionality works
- [ ] Test user email function works

### 2. **Backup Preparation** (MANDATORY)
- [ ] Document current database state
- [ ] Note all existing table counts
- [ ] Note all existing function names
- [ ] Note all existing trigger names
- [ ] Note all existing policy names
- [ ] Have rollback script ready

## ✅ Implementation Checklist

### Phase 1: **Isolated Poll Schema Creation**
- [ ] Create `polls` table (isolated)
- [ ] Create `poll_votes` table (isolated)
- [ ] Create `poll_results` view (isolated)
- [ ] Verify tables created successfully
- [ ] Verify no naming conflicts

### Phase 2: **RLS Policies (Non-Intrusive)**
- [ ] Enable RLS on `polls` table
- [ ] Enable RLS on `poll_votes` table
- [ ] Create "Allow authenticated users to read polls" policy
- [ ] Create "Allow admin users to manage polls" policy
- [ ] Create "Allow users to vote on polls" policy
- [ ] Create "Allow users to read their own votes" policy
- [ ] Create "Allow admin users to read all votes" policy
- [ ] Verify policies created successfully

### Phase 3: **Helper Functions (Non-Conflicting)**
- [ ] Create `get_or_create_poll()` function
- [ ] Create `submit_poll_vote()` function
- [ ] Create `get_poll_results()` function
- [ ] Verify functions created successfully
- [ ] Test functions work correctly

### Phase 4: **Update Triggers (Minimal Impact)**
- [ ] Add trigger for `polls` table
- [ ] Verify trigger created successfully
- [ ] Test trigger works correctly

## ✅ Post-Implementation Verification

### 1. **New Functionality Works**
- [ ] Test poll creation works
- [ ] Test poll results view works
- [ ] Test vote submission works
- [ ] Test poll results retrieval works
- [ ] Test admin poll management works

### 2. **Existing Functionality Still Works**
- [ ] User role functionality unchanged
- [ ] Discussion functionality unchanged
- [ ] Document functionality unchanged
- [ ] User email function unchanged
- [ ] Admin dashboard unchanged
- [ ] User management unchanged
- [ ] All existing queries return identical results

### 3. **No Conflicts**
- [ ] No naming conflicts with existing functions
- [ ] No naming conflicts with existing policies
- [ ] No naming conflicts with existing triggers
- [ ] No naming conflicts with existing tables
- [ ] No naming conflicts with existing views

## 🚨 Emergency Rollback Checklist

If ANY issues arise:

### Immediate Actions
- [ ] **STOP immediately**
- [ ] Run emergency rollback script
- [ ] Verify existing system still works
- [ ] Document the issue
- [ ] Re-analyze the problem

### Rollback Script
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

- [ ] **All existing functionality works unchanged**
- [ ] **New poll tables are created and functional**
- [ ] **RLS policies work correctly**
- [ ] **No naming conflicts exist**
- [ ] **All existing queries return identical results**
- [ ] **Admin dashboard still works**
- [ ] **User management still works**
- [ ] **Document management still works**
- [ ] **Discussion forum still works**

## 🚫 What NOT to Do

- [ ] **NEVER modify existing tables**
- [ ] **NEVER modify existing functions**
- [ ] **NEVER modify existing triggers**
- [ ] **NEVER modify existing RLS policies**
- [ ] **NEVER use conflicting names**
- [ ] **NEVER assume database state**
- [ ] **NEVER skip verification steps**

## 📋 Implementation Order

1. **Run pre-implementation verification**
2. **Execute `database_poll_schema_safe.sql`**
3. **Run post-implementation verification**
4. **Test new poll functionality**
5. **Verify existing functionality unchanged**
6. **Document success**

## 🔍 Verification Commands

### Before Implementation
```sql
-- Check existing system
SELECT COUNT(*) FROM user_roles;
SELECT COUNT(*) FROM discussions;
SELECT COUNT(*) FROM documents;
SELECT * FROM get_users_with_emails() LIMIT 5;
```

### After Implementation
```sql
-- Check new poll system
SELECT COUNT(*) FROM polls;
SELECT COUNT(*) FROM poll_votes;
SELECT * FROM poll_results LIMIT 5;

-- Verify existing system unchanged
SELECT COUNT(*) FROM user_roles;
SELECT COUNT(*) FROM discussions;
SELECT COUNT(*) FROM documents;
SELECT * FROM get_users_with_emails() LIMIT 5;
```

---

**Remember**: This system is production-ready and fully functional. The poll schema is an ADDITION, not a replacement. Always verify before acting.
