# Temporary Scripts Cleanup Analysis

**Date:** 2025-01-31  
**Purpose:** Analyze temporary scripts and provide cleanup recommendations  
**Total Files Analyzed:** 41 SQL files + 24 JS test files + 10 plan documents

---

## 📊 **Summary**

| Category | Keep | Archive | Delete | Total |
|----------|------|---------|--------|-------|
| **Root SQL Scripts** | 7 | 9 | 2 | 18 |
| **scripts/debug/** | 4 | 13 | 0 | 17 |
| **scripts/cleanup/** | 2 | 4 | 0 | 6 |
| **Root Planning Docs** | 0 | 4 | 0 | 4 |
| **Root Debug Scripts** | 0 | 1 | 0 | 1 |
| **Test Scripts (k6)** | Keep in tests/ | - | - | 24 |
| **Total** | 13 | 31 | 2 | 75 |

---

## ✅ **KEEP: Active & Useful Scripts (13 files)**

### **Root Directory - Active Fixes (2 files)**
These are recently created security fixes - **KEEP ACTIVE**

1. ✅ **`fix_function_search_path.sql`** 
   - **Status:** Active security fix (just implemented)
   - **Reason:** Recently applied, may need reference
   - **Action:** Keep in root, document as active fix

2. ✅ **`fix_rls_no_policy_suggestions.sql`**
   - **Status:** Active security fix (just implemented)
   - **Reason:** Recently applied, may need reference
   - **Action:** Keep in root, document as active fix

### **Root Directory - Verification Scripts (5 files)**
Useful for ongoing maintenance - **KEEP**

3. ✅ **`verify_cew_security.sql`**
   - **Purpose:** Verify CEW poll security
   - **Value:** Useful for periodic security audits
   - **Action:** Keep in root or move to `scripts/verify/`

4. ✅ **`check_rls_policies.sql`**
   - **Purpose:** Verify RLS policies are configured
   - **Value:** Useful for security verification
   - **Action:** Keep in root or move to `scripts/verify/`

5. ✅ **`check_database_state.sql`**
   - **Purpose:** General database state check
   - **Value:** Useful diagnostic tool
   - **Action:** Keep in root or move to `scripts/verify/`

6. ✅ **`check-triggers.sql`**
   - **Purpose:** Verify database triggers
   - **Value:** Useful for maintenance
   - **Action:** Keep in root or move to `scripts/verify/`

7. ✅ **`verify-matrix-pairing-integrity.sql`**
   - **Purpose:** Verify matrix graph data integrity
   - **Value:** Useful for troubleshooting matrix graphs
   - **Action:** Keep in root or move to `scripts/verify/`

### **scripts/debug/ - Useful Diagnostic Tools (4 files)**
Keep most useful for future troubleshooting

8. ✅ **`database-vote-diagnostics.sql`**
   - **Purpose:** Comprehensive vote system diagnostics
   - **Value:** Very useful for general troubleshooting
   - **Action:** Keep in `scripts/debug/`

9. ✅ **`investigate-matrix-data-points.sql`**
   - **Purpose:** Comprehensive matrix graph analysis
   - **Value:** Very useful for matrix graph issues
   - **Action:** Keep in `scripts/debug/`

10. ✅ **`check-actual-vote-data.sql`**
    - **Purpose:** Verify vote data integrity
    - **Value:** Useful for vote verification
    - **Action:** Keep in `scripts/debug/`

11. ✅ **`user-id-analysis.sql`**
    - **Purpose:** Analyze user_id distribution
    - **Value:** Useful for user tracking issues
    - **Action:** Keep in `scripts/debug/`

### **scripts/cleanup/ - Useful Maintenance (2 files)**
Keep safe cleanup scripts

12. ✅ **`cleanup-matrix-test-data.sql`**
    - **Purpose:** Remove test data from matrix testing
    - **Value:** Useful for post-test cleanup
    - **Action:** Keep in `scripts/cleanup/`

13. ✅ **`update_prioritization_questions.sql`**
    - **Purpose:** Update question text
    - **Value:** Template for future question updates
    - **Action:** Keep in `scripts/cleanup/`

---

## 📦 **ARCHIVE: Historical Reference (31 files)**

### **Root Directory - One-Time Fixes (1 file)**

1. 📦 **`fix_poll_votes_delete_policy.sql`**
   - **Status:** Already applied (historical)
   - **Value:** Reference for what was fixed
   - **Action:** Move to `scripts/archive/fixes/`
   - **Reason:** Fix already applied, keep for reference

### **Root Directory - One-Time Debug Scripts (8 files)**
These solved specific past issues - **ARCHIVE**

2. 📦 **`test_api_directly.sql`**
   - **Purpose:** One-time API testing
   - **Action:** Move to `scripts/archive/debug/`

3. 📦 **`debug_vote_duplicates.sql`**
   - **Purpose:** Debugged duplicate vote issue (resolved)
   - **Action:** Move to `scripts/archive/debug/`

4. 📦 **`cleanup_duplicate_survey_votes.sql`**
   - **Purpose:** One-time cleanup (already executed)
   - **Action:** Move to `scripts/archive/cleanup/`

5. 📦 **`check_unique_index.sql`**
   - **Purpose:** Verified index creation (already exists)
   - **Action:** Move to `scripts/archive/checks/`

6. 📦 **`check-prioritization-q3-options.sql`**
   - **Purpose:** One-time option verification
   - **Action:** Move to `scripts/archive/checks/`

7. 📦 **`debug-k6-votes.sql`**
   - **Purpose:** Debugged k6 test issues (resolved)
   - **Action:** Move to `scripts/archive/debug/`

8. 📦 **`check-k6-issue.sql`**
   - **Purpose:** One-time k6 issue check
   - **Action:** Move to `scripts/archive/checks/`

9. 📦 **`check-poll-indices.sql`**
   - **Purpose:** One-time poll index verification
   - **Action:** Move to `scripts/archive/checks/`

10. 📦 **`debug-database-queries.sql`**
    - **Purpose:** Temporary debug script
    - **Action:** Move to `scripts/archive/debug/`

### **Root Directory - Planning Documents (4 files)**
Completed planning documents - **ARCHIVE**

11. 📦 **`MARKDOWN_UPDATE_PLAN.md`**
    - **Status:** Completed
    - **Action:** Move to `docs/review-analysis/archive/`

12. 📦 **`PRIORITIZATION_PAGE_UPDATE_PLAN.md`**
    - **Status:** Completed
    - **Action:** Move to `docs/review-analysis/archive/`

13. 📦 **`SURVEY_RESULTS_UPDATE_PLAN.md`**
    - **Status:** Completed
    - **Action:** Move to `docs/review-analysis/archive/`

14. 📦 **`TIERED_FRAMEWORK_PAGE_UPDATE_PLAN.md`**
    - **Status:** Completed
    - **Action:** Move to `docs/review-analysis/archive/`

### **Root Directory - Debug Scripts (1 file)**

15. 📦 **`debug-matrix-pairing.js`**
    - **Purpose:** One-time matrix pairing debug
    - **Action:** Move to `scripts/archive/debug/`

### **scripts/debug/ - Historical Investigation Scripts (13 files)**
Specific issue investigations (resolved) - **ARCHIVE**

16-28. 📦 **Archive these debug scripts:**
    - `check-cew-importance-poll.sql`
    - `check-matrix-graph-data.sql`
    - `check-prioritization-options.sql`
    - `check-user-id-generation.sql`
    - `investigate-all-users-pairing.sql`
    - `investigate-lost-pairs.sql`
    - `investigate-matrix-clustering.sql`
    - `investigate-missing-users.sql`
    - `investigate-pairing-mismatch.sql`
    - `investigate-poll-id-issue.sql`
    - `matrix-pairing-single-query.sql`
    - `matrix-vote-diagnostics.sql`
    - `matrix-vote-pairing-diagnostics.sql`
    - `run-database-checks.ps1`

    **Action:** Move to `scripts/archive/debug/`
    **Reason:** Specific past issues, solved. Keep for reference but not active use.

### **scripts/cleanup/ - Historical Cleanups (4 files)**
One-time cleanups (already executed) - **ARCHIVE**

29-32. 📦 **Archive these cleanup scripts:**
    - `purge-all-votes.sql` - ⚠️ DANGEROUS - Archive with warning
    - `purge-k6-test-data.sql` - One-time cleanup
    - `purge-single-choice-votes.sql` - One-time cleanup
    - `purge-votes-for-testing.sql` - One-time cleanup

    **Action:** Move to `scripts/archive/cleanup/`
    **Reason:** Historical cleanups, already executed. Archive with warnings about destructive nature.

---

## ❌ **DELETE: Truly Temporary (2 files)**

### **Root Directory - Superseded/Obsolete**

1. ❌ **`database_schema.sql`** 
   - **Wait!** This is the MAIN schema file - **DO NOT DELETE**
   - **Action:** KEEP - This is the production schema

2. ❌ Actually, let me reconsider - the truly obsolete ones:
   - Most scripts have some value, even if just historical
   - Better to archive than delete to preserve history

**Recommendation:** **Archive instead of delete** - Better to preserve history than risk losing useful information.

---

## 📁 **Recommended Archive Structure**

```
scripts/
├── archive/
│   ├── fixes/              # Historical fix scripts
│   │   └── fix_poll_votes_delete_policy.sql
│   ├── debug/              # Historical debug scripts (18 files)
│   │   ├── Root debug scripts (9 files)
│   │   └── scripts/debug moved files (13 files)
│   ├── cleanup/            # Historical cleanup scripts (5 files)
│   │   └── Root cleanup scripts (1 file)
│   │   └── scripts/cleanup moved files (4 files)
│   └── checks/             # Historical check scripts (4 files)
│       └── One-time verification scripts
├── verify/                 # NEW: Ongoing verification scripts
│   ├── verify_cew_security.sql (moved from root)
│   ├── check_rls_policies.sql (moved from root)
│   ├── check_database_state.sql (moved from root)
│   ├── check-triggers.sql (moved from root)
│   └── verify-matrix-pairing-integrity.sql (moved from root)
├── debug/                  # Active debug tools (4 files)
│   └── Keep: database-vote-diagnostics.sql, investigate-matrix-data-points.sql, etc.
└── cleanup/                # Active cleanup tools (2 files)
    └── Keep: cleanup-matrix-test-data.sql, update_prioritization_questions.sql
```

---

## 🎯 **Recommendations**

### **Priority 1: Organize Root Directory**
**Action:** Move verification scripts to `scripts/verify/` for better organization

**Move these 5 files:**
- `verify_cew_security.sql` → `scripts/verify/`
- `check_rls_policies.sql` → `scripts/verify/`
- `check_database_state.sql` → `scripts/verify/`
- `check-triggers.sql` → `scripts/verify/`
- `verify-matrix-pairing-integrity.sql` → `scripts/verify/`

**Keep these 2 files in root:**
- `fix_function_search_path.sql` (recent security fix)
- `fix_rls_no_policy_suggestions.sql` (recent security fix)

**Archive these 10 files:**
- Move all one-time debug/check/cleanup scripts to `scripts/archive/`

### **Priority 2: Archive Planning Documents**
**Action:** Move completed planning documents to `docs/review-analysis/archive/`

**Move these 4 files:**
- `MARKDOWN_UPDATE_PLAN.md`
- `PRIORITIZATION_PAGE_UPDATE_PLAN.md`
- `SURVEY_RESULTS_UPDATE_PLAN.md`
- `TIERED_FRAMEWORK_PAGE_UPDATE_PLAN.md`

### **Priority 3: Clean Up scripts/ Directory**
**Action:** Move historical scripts to `scripts/archive/`, keep active ones

**Archive from scripts/debug/ (13 files):**
- Move all `investigate-*` scripts
- Move `check-*` scripts that are one-time
- Move `matrix-*-diagnostics.sql` scripts

**Keep in scripts/debug/ (4 files):**
- `database-vote-diagnostics.sql`
- `investigate-matrix-data-points.sql`
- `check-actual-vote-data.sql`
- `user-id-analysis.sql`

**Archive from scripts/cleanup/ (4 files):**
- `purge-all-votes.sql` (with DANGER warning)
- `purge-k6-test-data.sql`
- `purge-single-choice-votes.sql`
- `purge-votes-for-testing.sql`

**Keep in scripts/cleanup/ (2 files):**
- `cleanup-matrix-test-data.sql`
- `update_prioritization_questions.sql`

### **Priority 4: Archive Root Debug Script**
**Action:** Move `debug-matrix-pairing.js` to `scripts/archive/debug/`

---

## ⚠️ **Safety Considerations**

### **Dangerous Scripts (Archive with Warnings):**
1. **`purge-all-votes.sql`** - Deletes ALL votes
2. **`purge-single-choice-votes.sql`** - Deletes all single-choice votes
3. **`purge-k6-test-data.sql`** - Deletes k6 test data
4. **`purge-votes-for-testing.sql`** - Deletes test votes
5. **`cleanup_duplicate_survey_votes.sql`** - Deletes duplicate votes

**Recommendation:** 
- Archive these with prominent warnings in filename or README
- Consider: `scripts/archive/cleanup/DANGEROUS-purge-all-votes.sql`
- Add README in archive/cleanup/ explaining danger levels

---

## 📋 **Implementation Steps**

### **Step 1: Create Archive Structure**
```bash
mkdir -p scripts/archive/{fixes,debug,cleanup,checks}
mkdir -p scripts/verify
```

### **Step 2: Move Root Verification Scripts**
Move 5 verification scripts to `scripts/verify/`

### **Step 3: Move Planning Documents**
Move 4 planning docs to `docs/review-analysis/archive/`

### **Step 4: Archive Historical Scripts**
Move historical debug/check/cleanup scripts to `scripts/archive/`

### **Step 5: Update scripts/README.md**
Document new structure and archive location

### **Step 6: Create Archive README**
Create `scripts/archive/README.md` explaining what's archived and why

---

## 📊 **Before & After**

### **Before:**
- Root directory: 18 SQL files
- scripts/debug/: 17 files
- scripts/cleanup/: 6 files
- Root planning docs: 4 files
- **Total clutter:** 45 files in root/scripts

### **After:**
- Root directory: 2 active fix scripts
- scripts/verify/: 5 verification scripts (NEW)
- scripts/debug/: 4 active debug tools
- scripts/cleanup/: 2 active cleanup tools
- scripts/archive/: 31 historical scripts
- docs/archive/: 4 planning documents
- **Total organized:** Clean structure, easy to find active tools

---

## ✅ **Benefits**

1. **Cleaner Root Directory:** Only active fixes remain
2. **Better Organization:** Verification scripts grouped together
3. **Preserved History:** Archived scripts available for reference
4. **Easier Navigation:** Clear separation of active vs historical
5. **Safety:** Dangerous scripts clearly marked and archived

---

## 📝 **Files to Keep Active (13 total)**

**Root (2):**
- `fix_function_search_path.sql`
- `fix_rls_no_policy_suggestions.sql`

**scripts/verify/ (5):**
- `verify_cew_security.sql`
- `check_rls_policies.sql`
- `check_database_state.sql`
- `check-triggers.sql`
- `verify-matrix-pairing-integrity.sql`

**scripts/debug/ (4):**
- `database-vote-diagnostics.sql`
- `investigate-matrix-data-points.sql`
- `check-actual-vote-data.sql`
- `user-id-analysis.sql`

**scripts/cleanup/ (2):**
- `cleanup-matrix-test-data.sql`
- `update_prioritization_questions.sql`

---

## 🎯 **Recommendation Summary**

**Action:** Archive, don't delete (preserve history)

**Organization:**
- ✅ Create `scripts/verify/` for verification scripts
- ✅ Create `scripts/archive/` with subfolders
- ✅ Move historical scripts to archive
- ✅ Keep active tools in appropriate directories
- ✅ Archive planning documents to `docs/review-analysis/archive/`

**Result:** Clean, organized structure with preserved history

---

**Next Step:** Create archive structure and move files systematically.

---

## ✅ **COMPLETED: Cleanup Implementation**

**Date Completed:** 2025-01-31

### **Actions Taken:**

1. ✅ Created archive structure (`scripts/archive/{fixes,debug,cleanup,checks}/`)
2. ✅ Created verification directory (`scripts/verify/`)
3. ✅ Moved 31 historical scripts to archive
4. ✅ Moved 5 verification scripts to `scripts/verify/`
5. ✅ Moved 4 planning documents to `docs/review-analysis/archive/`
6. ✅ Created `scripts/archive/README.md` with warnings
7. ✅ Updated `scripts/README.md` with new structure
8. ✅ Cleaned up root directory (only 2 active fix scripts remain)

### **Final Structure:**

**Root Directory (Clean):**
- `fix_function_search_path.sql` (active security fix)
- `fix_rls_no_policy_suggestions.sql` (active security fix)
- `database_schema.sql` (main schema - always keep)

**scripts/verify/** (5 files):
- Verification scripts for ongoing maintenance

**scripts/debug/** (3 files):
- Active debug tools

**scripts/cleanup/** (3 files):
- Safe cleanup scripts

**scripts/archive/** (28 files):
- Historical scripts organized by type

**docs/review-analysis/archive/** (4 planning docs):
- Completed planning documents

### **Result:**
✅ Root directory cleaned (18 → 3 SQL files)  
✅ Scripts organized by purpose  
✅ History preserved in archive  
✅ Dangerous scripts clearly marked  
✅ Documentation updated

