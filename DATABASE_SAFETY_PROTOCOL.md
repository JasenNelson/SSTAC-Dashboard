# 🚨 CRITICAL DATABASE SAFETY PROTOCOL

## ⚠️ MANDATORY SAFETY CHECKS BEFORE ANY DATABASE CHANGES

**HISTORICAL CONTEXT**: AI has previously provided SQL scripts that replaced and duplicated functional database policies, causing significant harm and days of lost debugging time. This protocol prevents such incidents.

## 🔍 PRE-MODIFICATION SAFETY CHECKS (MANDATORY)

### 1. **Current State Verification**
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

### 2. **Functionality Testing**
```sql
-- Test current functionality works
-- Test read access
SELECT COUNT(*) FROM [TABLE_NAME];

-- Test write access (if applicable)
INSERT INTO [TABLE_NAME] (test_column) VALUES ('test') RETURNING id;

-- Test user permissions
SELECT auth.uid() as current_user_id;
```

### 3. **Impact Assessment**
- **Count existing records** that might be affected
- **Check for recent activity** (last 7 days)
- **Verify user roles** and permissions
- **Test current user access** levels

## 🛡️ SAFETY PRINCIPLES

### **NEVER ASSUME DATABASE STATE**
- Always verify current structure before changes
- Always test existing functionality first
- Always check for existing policies/constraints
- Always verify user permissions

### **ALWAYS PROVIDE ROLLBACK SCRIPTS**
```sql
-- Example rollback script (save before making changes)
-- Restore original state if needed
DROP POLICY IF EXISTS "new_policy_name" ON table_name;
CREATE POLICY "original_policy_name" ON table_name
    FOR [OPERATION] 
    TO [ROLES]
    [CONDITIONS];
```

### **ALWAYS TEST INCREMENTALLY**
- Make one change at a time
- Test after each change
- Verify functionality still works
- Document what was changed

## 🚫 WHAT NOT TO DO

### **NEVER**
- Replace existing policies without understanding their purpose
- Drop policies without checking dependencies
- Assume database schema matches documentation
- Make multiple changes simultaneously
- Skip functionality testing

### **NEVER ASSUME**
- Database state matches code expectations
- Existing policies are "wrong" without verification
- User has proper permissions
- Changes won't break existing functionality

## ✅ SAFETY CHECKLIST

Before ANY database modification:

- [ ] **Current state verified** with diagnostic queries
- [ ] **Existing functionality tested** and confirmed working
- [ ] **User permissions verified** for current user
- [ ] **Impact assessment completed** (records affected, recent activity)
- [ ] **Rollback script prepared** and saved
- [ ] **Incremental approach planned** (one change at a time)
- [ ] **Testing plan established** (how to verify success)
- [ ] **User notified** of potential impacts

## 🔄 ROLLBACK PROCEDURE

If something breaks:

1. **Immediately stop** making further changes
2. **Run rollback script** to restore previous state
3. **Test functionality** to confirm restoration
4. **Investigate root cause** before attempting fix again
5. **Document lessons learned** for future reference

## 📋 EXAMPLE SAFETY PROTOCOL

### **Before Modifying RLS Policies:**

```sql
-- 1. Check current policies
SELECT policyname, roles, cmd, qual FROM pg_policies 
WHERE tablename = 'documents';

-- 2. Test current access
SELECT COUNT(*) FROM documents;
INSERT INTO documents (title, file_url) VALUES ('test', 'test') RETURNING id;

-- 3. Check user permissions
SELECT auth.uid(), auth.role();

-- 4. Verify admin role
SELECT role FROM user_roles WHERE user_id = auth.uid();
```

### **After Making Changes:**

```sql
-- 5. Test functionality still works
SELECT COUNT(*) FROM documents;
INSERT INTO documents (title, file_url) VALUES ('test2', 'test2') RETURNING id;

-- 6. Verify new policies are active
SELECT policyname, roles, cmd, qual FROM pg_policies 
WHERE tablename = 'documents';
```

## 🎯 SUCCESS CRITERIA

A safe database modification:

- ✅ **Existing functionality preserved** - all current features still work
- ✅ **New functionality works** - intended changes are successful
- ✅ **No data loss** - all existing data remains intact
- ✅ **User access maintained** - users can still access what they should
- ✅ **Performance maintained** - no significant performance degradation
- ✅ **Rollback available** - can quickly restore if needed

## 🚨 EMERGENCY PROCEDURES

If database changes cause issues:

1. **STOP** - Don't make any more changes
2. **ASSESS** - Determine what's broken
3. **ROLLBACK** - Use prepared rollback scripts
4. **VERIFY** - Confirm functionality is restored
5. **INVESTIGATE** - Understand what went wrong
6. **PLAN** - Create better approach before retrying

## 📚 LESSONS LEARNED

**Historical Issues:**
- AI provided scripts that replaced functional policies
- Duplicate policies caused conflicts
- Assumptions about database state led to breakage
- Lack of testing caused issues to go unnoticed
- No rollback plan made recovery difficult

**Prevention Measures:**
- Always verify current state first
- Always test existing functionality
- Always provide rollback scripts
- Always make incremental changes
- Always test after each change

---

**REMEMBER**: It's better to take extra time with safety checks than to spend days debugging broken functionality. When in doubt, verify first, change second.
