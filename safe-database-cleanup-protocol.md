# 🛡️ Safe Database Cleanup Protocol

## 🚨 CRITICAL SAFEGUARDS - READ FIRST

**HISTORICAL CONTEXT**: Previous cleanup attempts caused system-wide failures and took an entire day to resolve. This protocol prevents such issues.

## 📋 **Phase 1: Pre-Cleanup Verification (NO CHANGES)**

### **Step 1.1: Create Comprehensive Backup**
```sql
-- Create timestamped backups of ALL poll-related tables
CREATE TABLE polls_backup_$(date +%Y%m%d_%H%M%S) AS SELECT * FROM polls;
CREATE TABLE ranking_polls_backup_$(date +%Y%m%d_%H%M%S) AS SELECT * FROM ranking_polls;
CREATE TABLE poll_votes_backup_$(date +%Y%m%d_%H%M%S) AS SELECT * FROM poll_votes;
CREATE TABLE ranking_votes_backup_$(date +%Y%m%d_%H%M%S) AS SELECT * FROM ranking_votes;

-- Verify backups were created
SELECT 'polls_backup' as table_name, COUNT(*) as count FROM polls_backup_$(date +%Y%m%d_%H%M%S)
UNION ALL
SELECT 'ranking_polls_backup' as table_name, COUNT(*) as count FROM ranking_polls_backup_$(date +%Y%m%d_%H%M%S)
UNION ALL
SELECT 'poll_votes_backup' as table_name, COUNT(*) as count FROM poll_votes_backup_$(date +%Y%m%d_%H%M%S)
UNION ALL
SELECT 'ranking_votes_backup' as table_name, COUNT(*) as count FROM ranking_votes_backup_$(date +%Y%m%d_%H%M%S);
```

### **Step 1.2: Document Current State**
```sql
-- Document exactly what exists before any changes
SELECT 'BEFORE CLEANUP - Current Polls' as status;
SELECT page_path, poll_index, LEFT(question, 50) as question_preview FROM polls ORDER BY page_path, poll_index;

SELECT 'BEFORE CLEANUP - Current Ranking Polls' as status;
SELECT page_path, poll_index, LEFT(question, 50) as question_preview FROM ranking_polls ORDER BY page_path, poll_index;

-- Count current data
SELECT 'BEFORE CLEANUP - Counts' as status;
SELECT 'polls' as table_name, COUNT(*) as count FROM polls
UNION ALL
SELECT 'ranking_polls' as table_name, COUNT(*) as count FROM ranking_polls
UNION ALL
SELECT 'poll_votes' as table_name, COUNT(*) as count FROM poll_votes
UNION ALL
SELECT 'ranking_votes' as table_name, COUNT(*) as count FROM ranking_votes;
```

### **Step 1.3: Identify What Should Exist (Based on Current Pages)**
```sql
-- Based on current page definitions, what polls SHOULD exist:
-- Holistic Protection: 1 single-choice (poll_index 0) + 1 ranking (poll_index 1)
-- Tiered Framework: 1 single-choice (poll_index 0) + 1 ranking (poll_index 1)  
-- Prioritization: 8 ranking polls (poll_index 0-7)
-- NO WIKS polls should exist
-- NO test polls should exist
```

## 📋 **Phase 2: Modular Cleanup (ONE STEP AT A TIME)**

### **Step 2.1: Remove WIKS Polls (SAFEST FIRST)**
```sql
-- ONLY remove WIKS polls - these are clearly outdated
-- First, check what WIKS polls exist
SELECT 'WIKS Polls to Remove' as action;
SELECT id, page_path, poll_index, LEFT(question, 50) as question_preview 
FROM polls 
WHERE page_path LIKE '%wiks%' 
ORDER BY page_path, poll_index;

-- Remove WIKS polls (but keep votes for now)
DELETE FROM polls WHERE page_path LIKE '%wiks%';

-- Verify removal
SELECT 'After WIKS Removal - Polls Count' as status;
SELECT COUNT(*) as remaining_polls FROM polls;
```

### **Step 2.2: Remove Test Polls**
```sql
-- Remove test polls
SELECT 'Test Polls to Remove' as action;
SELECT id, page_path, poll_index, LEFT(question, 50) as question_preview 
FROM polls 
WHERE page_path LIKE '%test%' 
ORDER BY page_path, poll_index;

DELETE FROM polls WHERE page_path LIKE '%test%';

-- Verify removal
SELECT 'After Test Removal - Polls Count' as status;
SELECT COUNT(*) as remaining_polls FROM polls;
```

### **Step 2.3: Move Ranking Questions to Correct Table**
```sql
-- Identify ranking questions in polls table that should be in ranking_polls table
SELECT 'Ranking Questions in Wrong Table' as action;
SELECT id, page_path, poll_index, LEFT(question, 50) as question_preview 
FROM polls 
WHERE question LIKE '%rank%' OR question LIKE '%Rank%'
ORDER BY page_path, poll_index;

-- For each ranking question found:
-- 1. Insert into ranking_polls table
-- 2. Move associated votes from poll_votes to ranking_votes
-- 3. Remove from polls table
-- (This will be done one question at a time with verification)
```

## 📋 **Phase 3: Post-Cleanup Verification**

### **Step 3.1: Verify Final State**
```sql
-- Verify what remains after cleanup
SELECT 'AFTER CLEANUP - Final Polls' as status;
SELECT page_path, poll_index, LEFT(question, 50) as question_preview FROM polls ORDER BY page_path, poll_index;

SELECT 'AFTER CLEANUP - Final Ranking Polls' as status;
SELECT page_path, poll_index, LEFT(question, 50) as question_preview FROM ranking_polls ORDER BY page_path, poll_index;

-- Verify counts
SELECT 'AFTER CLEANUP - Final Counts' as status;
SELECT 'polls' as table_name, COUNT(*) as count FROM polls
UNION ALL
SELECT 'ranking_polls' as table_name, COUNT(*) as count FROM ranking_polls;
```

### **Step 3.2: Test System Functionality**
- [ ] Test admin panel loads correctly
- [ ] Test poll results display correctly
- [ ] Test filtering works (All, CEW, TWG)
- [ ] Test navigation between questions
- [ ] Test QR code expansion
- [ ] Test vote submission on pages

## 📋 **Phase 4: Rollback Plan (If Needed)**

### **Step 4.1: Restore from Backup**
```sql
-- If anything goes wrong, restore from backup
DROP TABLE IF EXISTS polls;
DROP TABLE IF EXISTS ranking_polls;
DROP TABLE IF EXISTS poll_votes;
DROP TABLE IF EXISTS ranking_votes;

-- Restore from backup
ALTER TABLE polls_backup_$(date +%Y%m%d_%H%M%S) RENAME TO polls;
ALTER TABLE ranking_polls_backup_$(date +%Y%m%d_%H%M%S) RENAME TO ranking_polls;
ALTER TABLE poll_votes_backup_$(date +%Y%m%d_%H%M%S) RENAME TO poll_votes;
ALTER TABLE ranking_votes_backup_$(date +%Y%m%d_%H%M%S) RENAME TO ranking_votes;
```

## 🚨 **CRITICAL RULES:**

1. **ONE STEP AT A TIME** - Never do multiple operations simultaneously
2. **VERIFY AFTER EACH STEP** - Check system functionality after each change
3. **STOP IF ISSUES ARISE** - Don't continue if any step causes problems
4. **KEEP BACKUPS** - Never delete backup tables until system is fully verified
5. **TEST THOROUGHLY** - Verify all functionality works before considering cleanup complete

## ❓ **USER APPROVAL REQUIRED:**

Before proceeding with ANY cleanup steps, user must:
- [ ] Review this protocol
- [ ] Approve each phase individually
- [ ] Confirm backup creation was successful
- [ ] Verify current system state is documented
- [ ] Approve proceeding with Phase 2, Step 2.1 (WIKS removal only)
