# Archived Scripts

**Date:** 2025-01-31  
**Purpose:** Historical reference for past debugging, fixes, and investigations

---

## 📂 **Archive Structure**

```
archive/
├── fixes/          # Historical fix scripts (already applied)
├── debug/          # Historical debug/investigation scripts
├── cleanup/        # Historical cleanup scripts (some are DANGEROUS)
└── checks/         # Historical verification scripts
```

---

## ⚠️ **IMPORTANT WARNINGS**

### **DANGEROUS Scripts in cleanup/**

These scripts **DELETE DATA** - use with extreme caution:

- ⚠️ **`DANGEROUS-purge-all-votes.sql`** - Deletes ALL votes from ALL polls
- ⚠️ **`purge-single-choice-votes.sql`** - Deletes all single-choice votes
- ⚠️ **`purge-k6-test-data.sql`** - Deletes k6 test data
- ⚠️ **`purge-votes-for-testing.sql`** - Deletes test votes
- ⚠️ **`cleanup_duplicate_survey_votes.sql`** - Deletes duplicate votes

**Before using ANY cleanup script:**
1. ✅ Create full database backup
2. ✅ Verify you want to delete the data
3. ✅ Test in development/staging first
4. ✅ Have rollback plan ready

---

## 📦 **Archive Contents**

### **fixes/** (1 file)
- Historical fix scripts that have already been applied to production
- Keep for reference only

**Files:**
- `fix_poll_votes_delete_policy.sql` - Added DELETE policy (already applied)

### **debug/** (18 files)
- Historical debug and investigation scripts
- Used to solve specific past issues
- Keep for reference if similar issues occur

**Files:**
- Various `investigate-*.sql` scripts
- Various `check-*.sql` scripts  
- `debug-*.sql` scripts
- `matrix-*-diagnostics.sql` scripts
- `test_api_directly.sql`
- `debug-matrix-pairing.js`
- `run-database-checks.ps1`

### **cleanup/** (5 files)
- Historical cleanup scripts
- **Some are DANGEROUS** - see warnings above

**Files:**
- `DANGEROUS-purge-all-votes.sql` - ⚠️ HIGH RISK
- `purge-single-choice-votes.sql` - ⚠️ HIGH RISK
- `purge-k6-test-data.sql` - ⚠️ MEDIUM RISK
- `purge-votes-for-testing.sql` - ⚠️ MEDIUM RISK
- `cleanup_duplicate_survey_votes.sql` - ⚠️ MEDIUM RISK

### **checks/** (4 files)
- Historical one-time verification scripts
- Used to verify specific past configurations

**Files:**
- `check_unique_index.sql`
- `check-k6-issue.sql`
- `check-poll-indices.sql`
- `check-prioritization-q3-options.sql`

---

## 📝 **Why These Are Archived**

These scripts were created to solve specific past issues:

1. **Duplicate Vote Debugging** - Scripts used to debug and fix duplicate vote issues
2. **Matrix Graph Investigation** - Scripts used to debug matrix pairing problems
3. **K6 Testing Cleanup** - Scripts used to clean up after load testing
4. **One-Time Fixes** - Fixes that have already been applied

**They're preserved for:**
- Historical reference
- Understanding what was fixed
- Reference if similar issues occur

**They're NOT for:**
- Regular use (issues are resolved)
- Production operations (use current scripts instead)

---

## 🔍 **Finding Active Scripts**

For **active/current** scripts, see:
- `scripts/verify/` - Ongoing verification tools
- `scripts/debug/` - Active debug tools
- `scripts/cleanup/` - Safe cleanup scripts
- Root directory - Recent security fixes

---

## ⚠️ **Before Using Archived Scripts**

1. **Check if issue is resolved** - Most archived scripts addressed resolved issues
2. **Review active scripts first** - Use current tools when possible
3. **Understand the script** - Read entire script before running
4. **Test in staging** - Never run archived scripts directly in production
5. **Create backups** - Always backup before destructive operations

---

**Last Updated:** 2025-01-31  
**Maintained By:** SSTAC Dashboard Team

