# 🗳️ Poll & Ranking Question Update Procedure

## 🚨 CRITICAL: This Procedure Prevents System-Wide Failures

**HISTORICAL CONTEXT**: This procedure was developed after January 2025 debugging incidents where poll updates caused "CEW: 0 responses", blank option text, and filtering failures. The AI made multiple incorrect assumptions despite reviewing markdowns and running queries - only CSV exports revealed the true system structure. Following this protocol prevents such issues.

## 🚨 CRITICAL: Two Completely Separate Poll Systems

### **Single-Choice Polls System**
- **Table**: `polls`
- **Votes Table**: `poll_votes` 
- **Results View**: `poll_results`
- **Vote Counting**: Sum of all individual votes

### **Ranking Polls System**
- **Table**: `ranking_polls`
- **Votes Table**: `ranking_votes`
- **Results View**: `ranking_results` 
- **Vote Counting**: Count of unique participants

### **CRITICAL RULES**
- ❌ **NEVER** put ranking questions in `polls` table
- ❌ **NEVER** put single-choice questions in `ranking_polls` table
- ✅ **ALWAYS** use correct table for correct poll type
- ✅ **CSV exports are truth** - verify with actual data, not assumptions

## 📋 Pre-Update Safety Protocol

### **Phase 1: Pre-Update Verification & Backup**

#### **Step 1.1: Database State Verification**
```sql
-- Verify current poll system state
SELECT 'polls' as table_name, COUNT(*) as record_count FROM polls
UNION ALL
SELECT 'ranking_polls' as table_name, COUNT(*) as record_count FROM ranking_polls
UNION ALL
SELECT 'poll_votes' as table_name, COUNT(*) as record_count FROM poll_votes
UNION ALL
SELECT 'ranking_votes' as table_name, COUNT(*) as record_count FROM ranking_votes;

-- Check existing SINGLE-CHOICE poll questions and options
SELECT 'SINGLE-CHOICE POLLS' as poll_type, page_path, poll_index, LEFT(question, 50) as question_preview, jsonb_array_length(options) as option_count
FROM polls 
ORDER BY page_path, poll_index;

-- Check existing RANKING poll questions and options
SELECT 'RANKING POLLS' as poll_type, page_path, poll_index, LEFT(question, 50) as question_preview, jsonb_array_length(options) as option_count
FROM ranking_polls 
ORDER BY page_path, poll_index;
```

#### **Step 1.2: Critical System Verification**
```sql
-- Verify ranking_results view integrity (CRITICAL)
SELECT pg_get_viewdef('ranking_results'::regclass);

-- Verify poll_results view integrity
SELECT pg_get_viewdef('poll_results'::regclass);

-- Test current functionality
SELECT COUNT(*) FROM poll_results;
SELECT COUNT(*) FROM ranking_results;
```

#### **Step 1.3: Create Comprehensive Backup**
```sql
-- Create timestamped backups
CREATE TABLE polls_backup_$(date +%Y%m%d_%H%M%S) AS SELECT * FROM polls;
CREATE TABLE ranking_polls_backup_$(date +%Y%m%d_%H%M%S) AS SELECT * FROM ranking_polls;
CREATE TABLE poll_votes_backup_$(date +%Y%m%d_%H%M%S) AS SELECT * FROM poll_votes;
CREATE TABLE ranking_votes_backup_$(date +%Y%m%d_%H%M%S) AS SELECT * FROM ranking_votes;

-- Verify backup creation
SELECT 'Backup created' as status, COUNT(*) as polls_backup_count FROM polls_backup_$(date +%Y%m%d_%H%M%S);
SELECT 'Backup created' as status, COUNT(*) as ranking_polls_backup_count FROM ranking_polls_backup_$(date +%Y%m%d_%H%M%S);
```

#### **Step 1.4: Document Current State**
Record the following information:
- [ ] Current poll count in database
- [ ] Current ranking poll count in database
- [ ] Current vote counts
- [ ] Existing question text (first 50 characters)
- [ ] Existing options arrays
- [ ] Backup table names created

## 🔄 Modular Update Protocol

### **Phase 2: Database-First Updates**

#### **Step 2.1: Update Single-Choice Polls**
```sql
-- Update polls table (single-choice polls)
UPDATE polls 
SET question = 'NEW_QUESTION_TEXT_HERE', 
    options = '["Option 1", "Option 2", "Option 3"]',
    updated_at = NOW()
WHERE page_path = '/survey-results/TOPIC_NAME' 
AND poll_index = POLL_INDEX_NUMBER;

-- Verify update
SELECT page_path, poll_index, question, options 
FROM polls 
WHERE page_path = '/survey-results/TOPIC_NAME' 
AND poll_index = POLL_INDEX_NUMBER;
```

#### **Step 2.2: Update Ranking Polls**
```sql
-- Update ranking_polls table
UPDATE ranking_polls 
SET question = 'NEW_RANKING_QUESTION_TEXT_HERE', 
    options = '["Option 1", "Option 2", "Option 3", "Option 4"]',
    updated_at = NOW()
WHERE page_path = '/survey-results/TOPIC_NAME' 
AND poll_index = POLL_INDEX_NUMBER;

-- Verify update
SELECT page_path, poll_index, question, options 
FROM ranking_polls 
WHERE page_path = '/survey-results/TOPIC_NAME' 
AND poll_index = POLL_INDEX_NUMBER;
```

#### **Step 2.3: Create Missing Polls (if needed)**
```sql
-- Create new single-choice poll
INSERT INTO polls (page_path, poll_index, question, options)
VALUES ('/survey-results/TOPIC_NAME', POLL_INDEX, 'NEW_QUESTION_TEXT', '["Option 1", "Option 2", "Option 3"]');

-- Create new ranking poll
INSERT INTO ranking_polls (page_path, poll_index, question, options)
VALUES ('/survey-results/TOPIC_NAME', POLL_INDEX, 'NEW_RANKING_QUESTION_TEXT', '["Option 1", "Option 2", "Option 3", "Option 4"]');
```

#### **Step 2.4: Database Integrity Check**
```sql
-- Verify poll_results view still works
SELECT COUNT(*) as poll_results_count FROM poll_results;

-- Verify ranking_results view still works (CRITICAL - check for blank option text)
SELECT 
    page_path, 
    poll_index, 
    question,
    jsonb_array_length(options) as option_count,
    total_votes,
    CASE 
        WHEN results::text LIKE '%null%' THEN 'ERROR: NULL option text detected'
        ELSE 'OK'
    END as option_text_status
FROM ranking_results 
WHERE page_path = '/survey-results/TOPIC_NAME';

-- Test option text mapping
SELECT 
    page_path,
    poll_index,
    jsonb_array_elements_text(options) as option_text,
    ordinality - 1 as option_index
FROM ranking_polls, 
     jsonb_array_elements_text(options) WITH ORDINALITY
WHERE page_path = '/survey-results/TOPIC_NAME'
ORDER BY poll_index, option_index;
```

### **Phase 3: Admin Panel Synchronization**

#### **Step 3.1: Update currentPollQuestions Array**
**File**: `src/app/(dashboard)/admin/poll-results/PollResultsClient.tsx`

```javascript
const currentPollQuestions = [
    // Update this array to match EXACTLY with database questions
    "NEW_QUESTION_TEXT_HERE",
    "NEW_RANKING_QUESTION_TEXT_HERE",
    // ... other questions
];
```

**CRITICAL**: Use exact question text from database. Even minor differences cause filtering failures.

#### **Step 3.2: Verify Admin Panel Matching Logic**
The admin panel uses this logic:
```javascript
const matchesCurrentQuestion = currentPollQuestions.some(question => 
  poll.question.includes(question.substring(0, 50)) || 
  question.includes(poll.question.substring(0, 50))
);
```

#### **Step 3.3: Test Admin Panel Functionality**
- [ ] Navigate to `/admin/poll-results`
- [ ] Verify all poll groups appear
- [ ] Test filtering: All, TWG/SSTAC Only, CEW Only
- [ ] Verify vote counts are accurate
- [ ] Check that no polls show "0 responses"
- [ ] Verify no blank option text appears

### **Phase 4: UI Page Synchronization**

#### **Step 4.1: Update Survey Results Pages**
**File**: `src/app/(dashboard)/survey-results/[topic]/[TopicClient].tsx`

```javascript
const pollQuestions = [
  {
    question: "NEW_QUESTION_TEXT_HERE", // Must match database exactly
    questionNumber: 1,
    options: ["Option 1", "Option 2", "Option 3"] // Must match database exactly
  },
  {
    question: "NEW_RANKING_QUESTION_TEXT_HERE", // Must match database exactly
    questionNumber: 2,
    options: ["Option 1", "Option 2", "Option 3", "Option 4"] // Must match database exactly
  }
];
```

#### **Step 4.2: Update CEW Poll Pages**
**File**: `src/app/cew-polls/[topic]/page.tsx`

```javascript
const pollQuestions = [
  {
    question: "NEW_QUESTION_TEXT_HERE", // Must match database exactly
    questionNumber: 1,
    options: ["Option 1", "Option 2", "Option 3"] // Must match database exactly
  },
  {
    question: "NEW_RANKING_QUESTION_TEXT_HERE", // Must match database exactly
    questionNumber: 2,
    options: ["Option 1", "Option 2", "Option 3", "Option 4"] // Must match database exactly
  }
];
```

#### **Step 4.3: Verify Three-Way Synchronization**
- [ ] Database questions match survey-results questions exactly
- [ ] Database questions match cew-polls questions exactly
- [ ] Database questions match admin panel currentPollQuestions exactly
- [ ] All options arrays match exactly across all three systems

## 🧪 Comprehensive Testing Protocol

### **Phase 5: System Integration Testing**

#### **Step 5.1: Database Functionality Tests**
```sql
-- Test poll creation
SELECT get_or_create_poll(
    '/survey-results/test', 
    999, 
    'Test question', 
    '["Test option 1", "Test option 2"]'::jsonb
);

-- Test ranking poll creation
SELECT get_or_create_ranking_poll(
    '/survey-results/test', 
    999, 
    'Test ranking question', 
    '["Test option 1", "Test option 2", "Test option 3"]'::jsonb
);

-- Clean up test data
DELETE FROM polls WHERE page_path = '/survey-results/test' AND poll_index = 999;
DELETE FROM ranking_polls WHERE page_path = '/survey-results/test' AND poll_index = 999;
```

#### **Step 5.2: Admin Panel Tests**
- [ ] Navigate to `/admin/poll-results`
- [ ] Verify all poll groups load without errors
- [ ] Test "All Responses" filter
- [ ] Test "TWG/SSTAC Only" filter
- [ ] Test "CEW Only" filter
- [ ] Verify vote counts display correctly
- [ ] Check ranking polls show "responses" not "votes"
- [ ] Verify no blank option text appears
- [ ] Test expand/collapse functionality

#### **Step 5.3: Survey Results Page Tests**
- [ ] Navigate to `/survey-results/[topic]`
- [ ] Verify questions display correctly
- [ ] Verify options display correctly
- [ ] Test voting functionality
- [ ] Verify vote persistence
- [ ] Test changing votes
- [ ] Verify results display correctly

#### **Step 5.4: CEW Poll Page Tests**
- [ ] Navigate to `/cew-polls/[topic]`
- [ ] Enter CEW code "CEW2025"
- [ ] Verify questions display correctly
- [ ] Verify options display correctly
- [ ] Test voting functionality
- [ ] Verify vote submission
- [ ] Test ranking poll drag-and-drop
- [ ] Verify results display correctly

#### **Step 5.5: Cross-System Integration Tests**
- [ ] Vote on survey-results page
- [ ] Vote on cew-polls page
- [ ] Verify votes appear in admin panel
- [ ] Test filtering shows correct data
- [ ] Verify vote counts are accurate
- [ ] Test both single-choice and ranking polls

### **Phase 6: Pre-Existing Functionality Verification**

#### **Step 6.1: Core Dashboard Functions**
- [ ] User authentication works
- [ ] Admin badge persistence works
- [ ] User management functions work
- [ ] Document management works
- [ ] Discussion forum works
- [ ] Like system works

#### **Step 6.2: Poll System Core Functions**
- [ ] Vote persistence works
- [ ] Real-time results updates work
- [ ] CEW conference polling works
- [ ] Device tracking works (CEW polls)
- [ ] Session persistence works
- [ ] Mobile optimization works

#### **Step 6.3: Database Integrity**
- [ ] All views return data correctly
- [ ] RLS policies work correctly
- [ ] Helper functions work correctly
- [ ] Backup/restore procedures work
- [ ] Performance is acceptable

## 🚨 Emergency Rollback Protocol

### **Phase 7: Emergency Procedures**

#### **Step 7.1: Database Rollback**
```sql
-- If database updates cause issues
DROP TABLE IF EXISTS polls;
DROP TABLE IF EXISTS ranking_polls;
DROP TABLE IF EXISTS poll_votes;
DROP TABLE IF EXISTS ranking_votes;

-- Restore from backup
ALTER TABLE polls_backup_$(date +%Y%m%d_%H%M%S) RENAME TO polls;
ALTER TABLE ranking_polls_backup_$(date +%Y%m%d_%H%M%S) RENAME TO ranking_polls;
ALTER TABLE poll_votes_backup_$(date +%Y%m%d_%H%M%S) RENAME TO poll_votes;
ALTER TABLE ranking_votes_backup_$(date +%Y%m%d_%H%M%S) RENAME TO ranking_votes;

-- Restore views
-- Run CREATE OR REPLACE VIEW statements from database_schema.sql
```

#### **Step 7.2: Code Rollback**
- [ ] Revert changes to `PollResultsClient.tsx`
- [ ] Revert changes to survey-results pages
- [ ] Revert changes to cew-polls pages
- [ ] Test system works as before

#### **Step 7.3: Verification After Rollback**
- [ ] All polls appear in admin panel
- [ ] All filtering works correctly
- [ ] No blank option text appears
- [ ] Vote counts are accurate
- [ ] All UI pages work correctly

## 📚 Reference Documentation

### **Critical Files to Reference**
1. **`POLL_QUESTION_UPDATE_GUIDE.md`** - Comprehensive update guide
2. **`POLL_SYSTEM_DEBUGGING_GUIDE.md`** - Technical troubleshooting
3. **`DATABASE_GUIDE.md`** - Database structure and requirements
4. **`PROJECT_MEMORY.md`** - Historical debugging incidents
5. **`AGENTS.md`** - AI assistant guidelines and safeguards

### **Key Technical Knowledge**
- **Three-way synchronization**: Database, survey-results, cew-polls must match exactly
- **Array indexing**: System uses 0-based indexing throughout (never add +1)
- **Vote counting**: Single-choice polls sum votes, ranking polls count participants
- **Question matching**: Admin panel uses strict substring matching
- **Filter logic**: Store original survey/CEW data separately for accurate filtering

## ✅ Success Criteria Checklist

### **Final Verification**
- [ ] All poll questions match exactly across all three systems
- [ ] All poll options match exactly across all three systems
- [ ] Admin panel shows all polls with correct counts
- [ ] All filtering options work correctly
- [ ] No blank option text appears anywhere
- [ ] Survey-results and cew-polls pages show identical content
- [ ] Voting functionality works on all pages
- [ ] Results display correctly in all views
- [ ] Pre-existing functionality remains intact
- [ ] Database integrity is maintained
- [ ] Performance is acceptable
- [ ] All tests pass

## 🎯 Post-Update Documentation

### **Document Changes Made**
- [ ] Record which polls were updated
- [ ] Record old vs new question text
- [ ] Record old vs new options
- [ ] Record any new polls created
- [ ] Record any polls deleted
- [ ] Update documentation if needed

### **Update Reference Files**
- [ ] Update `currentPollQuestions` array documentation
- [ ] Update poll question examples in guides
- [ ] Update troubleshooting scenarios if new issues arise
- [ ] Document any new patterns or procedures discovered

---

## ⚠️ Critical Warnings

1. **NEVER skip the backup step** - Always create comprehensive backups
2. **NEVER update UI pages before database** - Database-first approach is mandatory
3. **NEVER modify ranking_results view array indexing** - It uses 0-based indexing
4. **NEVER assume question text matches** - Verify exact matches across all systems
5. **ALWAYS test all three systems** - Database, admin panel, and UI pages
6. **ALWAYS verify pre-existing functionality** - Ensure no regression issues

**Remember**: This procedure was developed from real debugging experiences. Following it prevents the system-wide failures that occurred in January 2025.
