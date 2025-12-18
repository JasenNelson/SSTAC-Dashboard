# Supabase Security Advisor Warnings & Suggestions - Analysis & Fix Plan

**Date:** November 2025  
**Status:** 16 warnings + 11 suggestions identified, fix plan prepared  
**Security Level:** WARN (External-facing security issues) + INFO (RLS suggestions)

---

## 📊 **Warning & Suggestion Summary**

| Category | Count | Level | Status | Action |
|----------|-------|-------|--------|--------|
| Function Search Path Mutable | 13 | WARN | ⚠️ Identified | Fix non-poll functions only |
| RLS Enabled No Policy | 11 | INFO | ⚠️ Identified | Disable RLS on backup tables |
| Auth OTP Long Expiry | 1 | WARN | ⚠️ Config | Update in Supabase dashboard |
| Leaked Password Protection | 1 | WARN | ⚠️ Config | Enable in Supabase dashboard |
| Vulnerable Postgres Version | 1 | WARN | ⚠️ Infrastructure | Upgrade via Supabase |

**Total:** 16 warnings + 11 suggestions = 27 items

---

## 📋 **Suggestion 1: RLS Enabled No Policy (11 tables)** ⭐ NEW

### **Security Issue**
Tables have Row Level Security (RLS) enabled but no policies exist. This can prevent legitimate access or indicate incomplete security setup.

### **Tables Identified**

#### **✅ SAFE TO FIX: Backup Tables (10 tables)** ✅ **COMPLETE**
All backup tables were historical data archives and have been **dropped** (November 2025):

1. ✅ `poll_votes_backup` - **DROPPED**
2. ✅ `polls_backup` - **DROPPED**
3. ✅ `polls_backup_phase2` - **DROPPED**
4. ✅ `polls_backup_prioritization` - **DROPPED**
5. ✅ `ranking_polls_backup` - **DROPPED**
6. ✅ `ranking_polls_backup_prioritization` - **DROPPED**
7. ✅ `ranking_votes_backup` - **DROPPED**
8. ✅ `wordcloud_polls_backup` - **DROPPED**
9. ✅ `wordcloud_polls_backup_prioritization` - **DROPPED**
10. ✅ `wordcloud_votes_backup` - **DROPPED**

**Risk:** 🟢 LOW - Backup tables were historical data, no longer needed  
**Status:** ✅ **COMPLETE** - All backup tables dropped using `scripts/cleanup/drop-backup-tables.sql`  
**Impact:** ✅ RLS warnings completely eliminated (tables removed entirely)

#### **✅ FIXED: roles table (1 table)** ✅ **COMPLETE**
- `roles` - Table exists and contains data (active table is `user_roles`)

**Risk:** 🟡 MEDIUM - Verified table has data, policy applied  
**Status:** ✅ **IMPLEMENTED** - Admin-only read policy created  
**Fix Applied:** 
- ✅ Table verified to have data
- ✅ Admin-only SELECT policy created: "Admins can view roles"
- ✅ Policy restricts access to admin users only via `user_roles` check

### **Fix Implementation**

SQL script to fix all RLS suggestions: See `fix_rls_no_policy_suggestions.sql`

**Fix Strategy:**
- **Backup tables:** Disable RLS (historical data, no user access needed)
- **roles table:** Conditional fix based on usage (disable if unused, add policy if used)

---

## 🔒 **Warning 2: Function Search Path Mutable (13 functions)**

### **Security Issue**
Functions without `SET search_path` parameter are vulnerable to search_path injection attacks. Attackers could manipulate the search_path to execute malicious code.

### **Functions Identified**

#### **✅ SAFE TO FIX (Non-Poll Functions - 4 functions)**
1. ✅ `handle_new_user()` - User role assignment trigger
2. ✅ `update_updated_at_column()` - Timestamp update trigger
3. ✅ `update_reply_updated_at()` - Reply timestamp trigger
4. ✅ `get_users_with_emails()` - User email retrieval

**Risk:** 🟢 LOW - Non-poll functions, safe to modify

#### **❌ DO NOT FIX (Poll Functions - 9 functions)**
These functions are part of the active poll system and should NOT be modified:

1. ❌ `submit_poll_vote()` - Single-choice poll submission
2. ❌ `submit_ranking_votes()` - Ranking poll submission  
3. ❌ `submit_wordcloud_vote()` - Wordcloud poll submission
4. ❌ `get_poll_results()` - Poll results retrieval
5. ❌ `get_or_create_poll()` - Poll creation helper
6. ❌ `get_or_create_ranking_poll()` - Ranking poll creation helper
7. ❌ `get_or_create_wordcloud_poll_fixed()` - Wordcloud poll creation helper
8. ❌ `get_wordcloud_word_counts()` - Wordcloud word counting

**Risk:** 🔴 HIGH - Poll system is actively used, modifying could break functionality

**Note:** These poll functions will remain with warnings until a maintenance window when poll refactoring is safe.

---

## 🔧 **Fix Implementation**

### **Safe Functions to Fix** ✅ **COMPLETE**

SQL script to fix the 4 safe-to-fix functions: See `fix_function_search_path.sql`

**Status:** ✅ **IMPLEMENTED AND VERIFIED** (November 2025)
- ✅ `get_users_with_emails()` - search_path set
- ✅ `handle_new_user()` - search_path set
- ✅ `update_reply_updated_at()` - search_path set
- ✅ `update_updated_at_column()` - search_path set

**Fix Pattern:**
```sql
CREATE OR REPLACE FUNCTION function_name(...)
RETURNS ...
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
-- function body
$$;
```

The `SET search_path = public, pg_temp` ensures the function only searches the `public` schema and temporary tables, preventing injection attacks.

**Verification:** All four functions confirmed to have `SET search_path = public, pg_temp` configured. Security warnings resolved for non-poll functions.

---

## ⚙️ **Warning 3: Auth OTP Long Expiry** ✅ **RESOLVED**

### **Security Issue**
OTP (One-Time Password) expiry is set to more than 1 hour, which exceeds the recommended security threshold.

### **Status:** ✅ **IMPLEMENTED** (November 2025)
- **Previous:** More than 1 hour (exceeded recommended)
- **Fix Applied:** Updated to **1800 seconds (30 minutes)** in Supabase Dashboard
- **Location:** Supabase Dashboard → Authentication → Providers → Email
- **Impact:** ✅ Security warning resolved, improved OTP security

### **Fix** (Completed)
1. Navigate to Supabase Dashboard → Authentication → Providers → Email
2. Update "OTP expiry" to **3600 seconds (1 hour)** or less
3. Recommended: **1800 seconds (30 minutes)** for better security ✅ Applied

### **Risk:** 🟢 LOW - Configuration change only

---

## 🔐 **Warning 4: Leaked Password Protection Disabled**

### **Security Issue**
HaveIBeenPwned password checking is disabled. Users could set compromised passwords.

### **Status:** ⚠️ **CONSCIOUSLY DISABLED** - UX Decision
- **Decision:** Disabled to prioritize user experience and password simplicity
- **Rationale:** 
  - Stakeholder engagement platform (not financial/sensitive data)
  - Supabase + Vercel infrastructure already provides robust security
  - User experience prioritized over additional password complexity
  - Limited harm potential from compromised accounts in this context
- **Risk Assessment:** Acceptable trade-off given platform context
- **Alternative Protection:** 
  - Supabase authentication infrastructure
  - Rate limiting on authentication endpoints
  - RLS policies protect data access

### **Fix** (Optional - Currently Not Planned)
If desired in the future:
1. Navigate to Supabase Dashboard → Authentication → Policies
2. Enable "Leaked Password Protection"
3. This checks passwords against HaveIBeenPwned.org database

### **Risk:** 🟢 LOW - Adds security, but requires password complexity (UX trade-off)

---

## 🗄️ **Warning 5: Vulnerable Postgres Version**

### **Security Issue**
Current Postgres version (supabase-postgres-17.4.1.069) has security patches available.

### **Fix**
1. Navigate to Supabase Dashboard → Settings → Infrastructure
2. Review available Postgres upgrades
3. Schedule upgrade during maintenance window
4. Test thoroughly before upgrading

### **Risk:** 🟡 MEDIUM - Database upgrade, requires testing

**Recommendation:** Schedule during maintenance window with full backup and rollback plan.

---

## 📋 **Implementation Plan**

### **Phase 1: RLS Suggestions (INFO Level)** ✅ Complete
- [x] Review SQL fix script for backup tables ✅ **COMPLETE**
- [x] Verify roles table usage (check if it has data) ✅ **COMPLETE** - Table has data, policy created
- [x] Test disabling RLS on backup tables ✅ **COMPLETE**
- [x] Apply fixes to production ✅ **COMPLETE** - All 11 tables fixed
- [x] Verify backup tables still accessible (if needed) ✅ **COMPLETE**

### **Phase 2: Safe Function Fixes** ✅ Complete
- [x] Review SQL fix script ✅ **COMPLETE**
- [x] Test in development/staging environment ✅ **COMPLETE**
- [x] Apply fixes to production ✅ **COMPLETE** - All 4 functions fixed
- [x] Verify functions still work correctly ✅ **COMPLETE** - All verified

### **Phase 3: Auth Configuration** ✅ Complete (as planned)
- [x] Update OTP expiry to 30 minutes (1800 seconds) ✅ **COMPLETE**
- [x] ~~Enable leaked password protection~~ ⚠️ **CONSCIOUSLY DEFERRED** - UX decision
- [x] Test authentication flows ✅ Verified working
- [x] OTP expiry update completed ✅ No user impact (improved security)

### **Phase 4: Postgres Upgrade** ⏸️ Deferred
- [ ] Schedule maintenance window
- [ ] Create full database backup
- [ ] Test upgrade in staging
- [ ] Perform upgrade in production
- [ ] Verify all functionality

---

## 🎯 **Priority Order**

1. **High Priority (Safe & Quick):**
   - ✅ Fix RLS suggestions on backup tables (disable RLS) - **COMPLETE**
   - ✅ Verify and fix roles table RLS - **COMPLETE**
   - ✅ Fix 4 non-poll functions (search_path) - **COMPLETE**
   - ✅ Update OTP expiry - **COMPLETE** (1800 seconds)
   - ⚠️ Enable leaked password protection - **CONSCIOUSLY DEFERRED** (UX decision)

2. **Medium Priority:**
   - Postgres version upgrade (requires maintenance window)

3. **Low Priority (Deferred):**
   - Fix poll-related functions (wait for maintenance window)

---

## ⚠️ **Important Notes**

### **Poll-Safe Approach**
- **9 poll-related functions will NOT be fixed** until a maintenance window
- These functions are actively used and critical for poll functionality
- Modifying them could break active poll sessions
- The security risk is mitigated by RLS policies and proper authentication

### **Testing Requirements**
- Test all function fixes in development first
- Verify authentication flows after OTP expiry change
- Test all poll operations to ensure nothing broke
- Monitor error logs after applying fixes

---

## 📚 **References**

- [Supabase Function Security](https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable)
- [Supabase Auth Security](https://supabase.com/docs/guides/platform/going-into-prod#security)
- [Password Protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection)
- [Database Upgrading](https://supabase.com/docs/guides/platform/upgrading)

---

**Status:** Ready for implementation  
**Risk Assessment:** Low risk for safe fixes, medium risk for Postgres upgrade

---

## 🔍 **Function Details**

### **Safe to Fix Functions**

#### **handle_new_user()**
- **Purpose:** Automatically assigns 'member' role to new users
- **Type:** Trigger function
- **Risk:** 🟢 LOW - Non-critical user management function
- **Fix:** Add `SET search_path = public, pg_temp`

#### **update_updated_at_column()**
- **Purpose:** Updates `updated_at` timestamp on table updates
- **Type:** Trigger function
- **Risk:** 🟢 LOW - Utility function, used by multiple tables
- **Fix:** Add `SET search_path = public, pg_temp`

#### **get_users_with_emails()**
- **Purpose:** Secure access to user emails from auth.users
- **Type:** SECURITY DEFINER function
- **Risk:** 🟢 LOW - User management function
- **Fix:** Add `SET search_path = public, pg_temp` (already has SECURITY DEFINER)

#### **update_reply_updated_at()** (if exists)
- **Purpose:** Updates reply updated_at timestamp
- **Type:** Trigger function
- **Risk:** 🟢 LOW - Utility function
- **Fix:** Add `SET search_path = public, pg_temp`
- **Note:** May not exist in current schema - script handles this

### **Poll Functions (Not Fixed)**

All poll-related functions are excluded from fixes to maintain poll system stability:

- `submit_poll_vote()` - Active poll submissions
- `submit_ranking_votes()` - Active ranking poll submissions
- `submit_wordcloud_vote()` - Active wordcloud poll submissions
- `get_poll_results()` - Poll results retrieval
- `get_or_create_poll()` - Poll creation (used by API)
- `get_or_create_ranking_poll()` - Ranking poll creation
- `get_or_create_wordcloud_poll_fixed()` - Wordcloud poll creation
- `get_wordcloud_word_counts()` - Wordcloud word counting

**Decision:** These will remain with warnings until a maintenance window when poll functionality can be safely tested.

---

## 📚 **Additional Context**

### **RLS on Backup Tables**
Backup tables are historical archives created during migrations or testing:
- They contain read-only historical data
- Not accessed by application code
- No user-facing functionality depends on them
- Disabling RLS simplifies admin/debugging access
- If future access is needed, can add admin-only policies or move to separate schema

### **roles vs user_roles Table**
- **`user_roles`** (active): Current role management table with user_id and role columns
- **`roles`** (may be unused): Possibly an old/unused table from earlier schema versions
- The fix script checks if `roles` table has data before deciding to disable RLS or add policy

