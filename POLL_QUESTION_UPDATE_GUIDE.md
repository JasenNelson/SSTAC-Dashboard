# 🗳️ Poll Question & Option Update Guide

## 🚨 CRITICAL: This Guide Prevents System-Wide Failures

**HISTORICAL CONTEXT**: In January 2025, updating poll questions without following this protocol caused system-wide failures including "CEW: 0 responses", blank option text, and incorrect filtering. This guide prevents such issues.

## 📋 Pre-Update Checklist

### **MANDATORY SAFETY CHECKS**
- [ ] **Backup existing polls**: Create backup tables before any changes
- [ ] **Verify current state**: Check what polls currently exist in database
- [ ] **Document current questions**: Record existing question text and options
- [ ] **Plan synchronization**: Ensure all three systems will match after updates

## 🔄 Three-Way Synchronization Protocol

### **The Critical Rule**
Every poll question must exist in **THREE places** with identical content:

1. **Database Tables**: `polls` and `ranking_polls` with exact question text and options
2. **Survey Results Pages**: `/survey-results/[topic]` with matching questions
3. **CEW Poll Pages**: `/cew-polls/[topic]` with matching questions
4. **Admin Panel**: `PollResultsClient.tsx` `currentPollQuestions` array

### **Update Order (CRITICAL)**
1. **FIRST**: Update database tables
2. **SECOND**: Update admin panel `currentPollQuestions` array
3. **THIRD**: Update survey-results pages
4. **FOURTH**: Update cew-polls pages
5. **FIFTH**: Test all systems work together

## 🗄️ Database Update Protocol

### **Step 1: Backup Existing Data**
```sql
-- ALWAYS backup before changes
CREATE TABLE polls_backup_$(date) AS SELECT * FROM polls;
CREATE TABLE ranking_polls_backup_$(date) AS SELECT * FROM ranking_polls;
CREATE TABLE poll_votes_backup_$(date) AS SELECT * FROM poll_votes;
CREATE TABLE ranking_votes_backup_$(date) AS SELECT * FROM ranking_votes;
```

### **Step 2: Verify Current State**
```sql
-- Check what polls currently exist
SELECT page_path, poll_index, question, options 
FROM polls 
ORDER BY page_path, poll_index;

SELECT page_path, poll_index, question, options 
FROM ranking_polls 
ORDER BY page_path, poll_index;
```

### **Step 3: Update Database Questions**
```sql
-- Update single-choice polls
UPDATE polls 
SET question = 'New question text', 
    options = '["Option 1", "Option 2", "Option 3"]',
    updated_at = NOW()
WHERE page_path = '/survey-results/topic' 
AND poll_index = 0;

-- Update ranking polls
UPDATE ranking_polls 
SET question = 'New ranking question text', 
    options = '["Option 1", "Option 2", "Option 3"]',
    updated_at = NOW()
WHERE page_path = '/survey-results/topic' 
AND poll_index = 1;
```

### **Step 4: Verify Database Changes**
```sql
-- Confirm updates were applied
SELECT page_path, poll_index, question, options 
FROM polls 
WHERE page_path = '/survey-results/topic';

SELECT page_path, poll_index, question, options 
FROM ranking_polls 
WHERE page_path = '/survey-results/topic';
```

## 🎛️ Admin Panel Update Protocol

### **Step 1: Update currentPollQuestions Array**
In `src/app/(dashboard)/admin/poll-results/PollResultsClient.tsx`:

```javascript
const currentPollQuestions = [
  // Update this array to match EXACTLY with database questions
  "New question text for topic question 1",
  "New ranking question text for topic question 2",
  // ... etc
];
```

### **Step 2: Verify Question Matching Logic**
The admin panel uses this logic to filter polls:
```javascript
const matchesCurrentQuestion = currentPollQuestions.some(question => 
  poll.question.includes(question.substring(0, 50)) || 
  question.includes(poll.question.substring(0, 50))
);
```

**CRITICAL**: If database questions don't match this array, polls get filtered out and show 0 responses.

## 📄 UI Page Update Protocol

### **Step 1: Update Survey Results Pages**
In `src/app/(dashboard)/survey-results/[topic]/[TopicClient].tsx`:

```javascript
const pollQuestions = [
  {
    question: "New question text for topic question 1", // Must match database
    questionNumber: 1,
    options: ["Option 1", "Option 2", "Option 3"] // Must match database
  },
  {
    question: "New ranking question text for topic question 2", // Must match database
    questionNumber: 2,
    options: ["Option 1", "Option 2", "Option 3"] // Must match database
  }
];
```

### **Step 2: Update CEW Poll Pages**
In `src/app/cew-polls/[topic]/page.tsx`:

```javascript
const pollQuestions = [
  {
    question: "New question text for topic question 1", // Must match database
    questionNumber: 1,
    options: ["Option 1", "Option 2", "Option 3"] // Must match database
  },
  {
    question: "New ranking question text for topic question 2", // Must match database
    questionNumber: 2,
    options: ["Option 1", "Option 2", "Option 3"] // Must match database
  }
];
```

## 🧪 Testing Protocol

### **Step 1: Database Verification**
```sql
-- Verify all polls exist and have correct content
SELECT COUNT(*) FROM polls WHERE page_path LIKE '/survey-results/%';
SELECT COUNT(*) FROM ranking_polls WHERE page_path LIKE '/survey-results/%';
SELECT COUNT(*) FROM polls WHERE page_path LIKE '/cew-polls/%';
SELECT COUNT(*) FROM ranking_polls WHERE page_path LIKE '/cew-polls/%';
```

### **Step 2: Admin Panel Testing**
- Navigate to `/admin/poll-results`
- Verify all poll groups appear
- Test filtering: All, TWG/SSTAC Only, CEW Only
- Verify vote counts are accurate
- Check that no polls show "0 responses"

### **Step 3: UI Page Testing**
- Test survey-results pages display correct questions
- Test cew-polls pages display correct questions
- Verify options match exactly
- Test voting functionality works
- Verify results display correctly

### **Step 4: Integration Testing**
- Vote on survey-results page
- Vote on cew-polls page
- Verify votes appear in admin panel
- Test filtering shows correct data
- Verify no blank option text appears

## 🚨 Common Failure Points & Solutions

### **"CEW: 0 responses" in Admin Panel**
**Cause**: Database questions don't match `currentPollQuestions` array
**Solution**: Update `currentPollQuestions` array to match database questions exactly

### **Blank Option Text in Ranking Polls**
**Cause**: `ranking_results` view array indexing error (using +1 instead of 0-based)
**Solution**: Verify view uses `rp.options[option_stats.option_index]` (NOT +1)

### **"CEW Only" Filter Showing TWG Data**
**Cause**: Filter logic using scaled combined results instead of original CEW data
**Solution**: Ensure filter logic uses original `cew_results` data for CEW-only view

### **Vote Count Mismatch**
**Cause**: Different counting logic for single-choice vs ranking polls
**Solution**: 
- Single-choice: Sum votes from results array
- Ranking: Use `total_votes` field (participant count)

### **Questions Not Appearing**
**Cause**: Poll doesn't exist in database or question text mismatch
**Solution**: Create missing poll or fix question text to match exactly

## 🔧 Emergency Rollback Protocol

### **If Updates Cause System Failures**
```sql
-- Restore from backup
DROP TABLE IF EXISTS polls;
DROP TABLE IF EXISTS ranking_polls;
DROP TABLE IF EXISTS poll_votes;
DROP TABLE IF EXISTS ranking_votes;

-- Restore backup tables
ALTER TABLE polls_backup_$(date) RENAME TO polls;
ALTER TABLE ranking_polls_backup_$(date) RENAME TO ranking_polls;
ALTER TABLE poll_votes_backup_$(date) RENAME TO poll_votes;
ALTER TABLE ranking_votes_backup_$(date) RENAME TO ranking_votes;

-- Restore views
-- Run the CREATE OR REPLACE VIEW statements from database_schema.sql
```

### **Revert Code Changes**
- Revert changes to `PollResultsClient.tsx`
- Revert changes to survey-results pages
- Revert changes to cew-polls pages
- Test system works as before

## 📚 Reference Files

### **Database Schema**
- `database_schema.sql` - Complete database structure
- `poll_results` view - Single-choice poll aggregation
- `ranking_results` view - Ranking poll aggregation

### **Admin Panel**
- `src/app/(dashboard)/admin/poll-results/PollResultsClient.tsx` - Main admin logic
- `currentPollQuestions` array - Question matching logic

### **UI Pages**
- `src/app/(dashboard)/survey-results/[topic]/[TopicClient].tsx` - Survey pages
- `src/app/cew-polls/[topic]/page.tsx` - CEW poll pages

### **API Routes**
- `src/app/api/polls/submit/route.ts` - Single-choice poll submission
- `src/app/api/ranking-polls/submit/route.ts` - Ranking poll submission
- `src/app/api/polls/results/route.ts` - Poll results retrieval
- `src/app/api/ranking-polls/results/route.ts` - Ranking poll results

## ⚠️ Critical Warnings

1. **NEVER update UI pages without updating database first**
2. **NEVER modify the `ranking_results` view array indexing** (it uses 0-based indexing)
3. **ALWAYS backup data before making changes**
4. **ALWAYS test all three systems after updates**
5. **ALWAYS verify question text matches exactly** (even minor differences cause failures)

## 🎯 Success Criteria

After following this protocol:
- [ ] All polls appear in admin panel with correct counts
- [ ] All filtering options work correctly
- [ ] No blank option text appears
- [ ] Survey-results and cew-polls pages show identical questions
- [ ] Voting functionality works on all pages
- [ ] Results display correctly in all views

---

**Remember**: This system is complex and requires careful coordination. Following this protocol prevents the debugging nightmares experienced in January 2025.
