# 🛡️ Safe Poll System Update Protocol

## 🚨 CRITICAL: This Protocol Prevents System Failures

**HISTORICAL CONTEXT**: This protocol was developed after January 2025 debugging incidents where poll system updates caused system-wide failures. Follow this exact process to ensure safe, efficient updates.

## 📋 **Pre-Update Checklist**

### **1. Verify Current System State**
```sql
-- Check current poll counts by system
SELECT 
  'Single-Choice Polls' as system,
  COUNT(*) as count,
  COUNT(DISTINCT page_path) as pages
FROM polls
UNION ALL
SELECT 
  'Ranking Polls' as system,
  COUNT(*) as count,
  COUNT(DISTINCT page_path) as pages
FROM ranking_polls
UNION ALL
SELECT 
  'Wordcloud Polls' as system,
  COUNT(*) as count,
  COUNT(DISTINCT page_path) as pages
FROM wordcloud_polls;

-- Check current vote counts
SELECT 
  'Single-Choice Votes' as system,
  COUNT(*) as votes,
  COUNT(DISTINCT user_id) as users
FROM poll_votes
UNION ALL
SELECT 
  'Ranking Votes' as system,
  COUNT(*) as votes,
  COUNT(DISTINCT user_id) as users
FROM ranking_votes
UNION ALL
SELECT 
  'Wordcloud Votes' as system,
  COUNT(*) as votes,
  COUNT(DISTINCT user_id) as users
FROM wordcloud_votes;
```

### **2. Create Comprehensive Backup**
```sql
-- Create timestamped backup tables
CREATE TABLE polls_backup_$(date +%Y%m%d_%H%M%S) AS SELECT * FROM polls;
CREATE TABLE ranking_polls_backup_$(date +%Y%m%d_%H%M%S) AS SELECT * FROM ranking_polls;
CREATE TABLE wordcloud_polls_backup_$(date +%Y%m%d_%H%M%S) AS SELECT * FROM wordcloud_polls;
CREATE TABLE poll_votes_backup_$(date +%Y%m%d_%H%M%S) AS SELECT * FROM poll_votes;
CREATE TABLE ranking_votes_backup_$(date +%Y%m%d_%H%M%S) AS SELECT * FROM ranking_votes;
CREATE TABLE wordcloud_votes_backup_$(date +%Y%m%d_%H%M%S) AS SELECT * FROM wordcloud_votes;
```

## 🔄 **Update Protocol by Poll Type**

### **Single-Choice Polls (`polls` table)**

#### **Step 1: Database Update**
```sql
-- Update question text and options
UPDATE polls 
SET 
  question = 'New question text',
  options = '["Option 1", "Option 2", "Option 3"]'::jsonb,
  updated_at = NOW()
WHERE 
  page_path = '/survey-results/topic' 
  AND poll_index = 0;

-- Update corresponding CEW poll
UPDATE polls 
SET 
  question = 'New question text',
  options = '["Option 1", "Option 2", "Option 3"]'::jsonb,
  updated_at = NOW()
WHERE 
  page_path = '/cew-polls/topic' 
  AND poll_index = 0;
```

#### **Step 2: UI Page Updates**
Update both:
- `src/app/(dashboard)/survey-results/[topic]/[Topic]Client.tsx`
- `src/app/cew-polls/[topic]/page.tsx`

#### **Step 3: Admin Panel Update**
Update `currentPollQuestions` array in `src/app/(dashboard)/admin/poll-results/PollResultsClient.tsx`

### **Ranking Polls (`ranking_polls` table)**

#### **Step 1: Database Update**
```sql
-- Update question text and options
UPDATE ranking_polls 
SET 
  question = 'New ranking question text',
  options = '["Option 1", "Option 2", "Option 3", "Option 4"]'::jsonb,
  updated_at = NOW()
WHERE 
  page_path = '/survey-results/topic' 
  AND poll_index = 0;

-- Update corresponding CEW poll
UPDATE ranking_polls 
SET 
  question = 'New ranking question text',
  options = '["Option 1", "Option 2", "Option 3", "Option 4"]'::jsonb,
  updated_at = NOW()
WHERE 
  page_path = '/cew-polls/topic' 
  AND poll_index = 0;
```

#### **Step 2: UI Page Updates**
Update both:
- `src/app/(dashboard)/survey-results/[topic]/[Topic]Client.tsx`
- `src/app/cew-polls/[topic]/page.tsx`

#### **Step 3: Admin Panel Update**
Update `currentPollQuestions` array in `src/app/(dashboard)/admin/poll-results/PollResultsClient.tsx`

### **Wordcloud Polls (`wordcloud_polls` table)**

#### **Step 1: Database Update**
```sql
-- Update question text and configuration
UPDATE wordcloud_polls 
SET 
  question = 'New wordcloud question text',
  max_words = 1, -- 1 for single-choice, 1-3 for multi-word
  word_limit = 20,
  updated_at = NOW()
WHERE 
  page_path = '/survey-results/topic' 
  AND poll_index = 0;

-- Update corresponding CEW poll
UPDATE wordcloud_polls 
SET 
  question = 'New wordcloud question text',
  max_words = 1, -- 1 for single-choice, 1-3 for multi-word
  word_limit = 20,
  updated_at = NOW()
WHERE 
  page_path = '/cew-polls/topic' 
  AND poll_index = 0;
```

#### **Step 2: UI Page Updates**
Update both:
- `src/app/(dashboard)/survey-results/[topic]/[Topic]Client.tsx`
- `src/app/cew-polls/[topic]/page.tsx`

#### **Step 3: Admin Panel Update**
Update `currentPollQuestions` array in `src/app/(dashboard)/admin/poll-results/PollResultsClient.tsx`

## 🎯 **Three-Way Synchronization Requirements**

### **Critical Rule: Every poll must exist in THREE places with identical content**

1. **Database Tables**: `polls`, `ranking_polls`, or `wordcloud_polls`
2. **Survey Results Pages**: `/survey-results/[topic]`
3. **CEW Poll Pages**: `/cew-polls/[topic]`

### **Admin Panel Question Matching Logic**
The admin panel uses strict substring matching:
```javascript
const matchesCurrentQuestion = currentPollQuestions.some(question => 
  poll.question.includes(question.substring(0, 50)) || 
  question.includes(poll.question.substring(0, 50))
);
```

**CRITICAL**: If database questions don't match `currentPollQuestions` array, polls get filtered out and show 0 responses.

## ⚠️ **Common Failure Points & Prevention**

### **1. Question Text Mismatch**
- **Problem**: Even minor differences cause filtering failures
- **Prevention**: Use exact text matching across all three locations
- **Verification**: Check admin panel shows correct question count

### **2. Options Array Mismatch**
- **Problem**: Different option order breaks result display
- **Prevention**: Maintain identical option arrays in all locations
- **Verification**: Test vote submission and result display

### **3. Missing Polls**
- **Problem**: If database poll doesn't exist, UI shows empty state
- **Prevention**: Always create polls in database first
- **Verification**: Check all three locations have the poll

### **4. Index Misalignment**
- **Problem**: `poll_index` must match between database and UI
- **Prevention**: Use consistent 0-based indexing
- **Verification**: Test navigation between questions

### **5. Wordcloud Configuration Issues**
- **Problem**: `max_words` setting affects user experience
- **Prevention**: Set appropriate limits (1 for single-choice, 1-3 for multi-word)
- **Verification**: Test word submission limits

## 🧪 **Post-Update Verification**

### **1. Database Verification**
```sql
-- Verify poll counts
SELECT page_path, poll_index, question FROM polls WHERE page_path LIKE '%topic%';
SELECT page_path, poll_index, question FROM ranking_polls WHERE page_path LIKE '%topic%';
SELECT page_path, poll_index, question FROM wordcloud_polls WHERE page_path LIKE '%topic%';

-- Verify vote counts
SELECT COUNT(*) FROM poll_votes;
SELECT COUNT(*) FROM ranking_votes;
SELECT COUNT(*) FROM wordcloud_votes;
```

### **2. UI Testing**
- [ ] Survey results page displays correct questions
- [ ] CEW poll page displays correct questions
- [ ] Vote submission works for both pages
- [ ] Results display correctly

### **3. Admin Panel Testing**
- [ ] All questions appear in admin panel
- [ ] Question navigation works
- [ ] Vote counts display correctly
- [ ] Results charts render properly
- [ ] Wordcloud displays correctly (if applicable)

### **4. Build Verification**
```bash
npm run build
```
- [ ] Build completes successfully
- [ ] No TypeScript errors
- [ ] No linting errors

## 🚨 **Emergency Rollback Procedure**

### **If Update Causes Issues**
```sql
-- Restore from backup (replace timestamp with actual backup timestamp)
DROP TABLE polls;
DROP TABLE ranking_polls;
DROP TABLE wordcloud_polls;
DROP TABLE poll_votes;
DROP TABLE ranking_votes;
DROP TABLE wordcloud_votes;

CREATE TABLE polls AS SELECT * FROM polls_backup_20250126_143000;
CREATE TABLE ranking_polls AS SELECT * FROM ranking_polls_backup_20250126_143000;
CREATE TABLE wordcloud_polls AS SELECT * FROM wordcloud_polls_backup_20250126_143000;
CREATE TABLE poll_votes AS SELECT * FROM poll_votes_backup_20250126_143000;
CREATE TABLE ranking_votes AS SELECT * FROM ranking_votes_backup_20250126_143000;
CREATE TABLE wordcloud_votes AS SELECT * FROM wordcloud_votes_backup_20250126_143000;
```

### **Code Rollback**
```bash
# Revert UI changes
git checkout HEAD~1 -- src/app/(dashboard)/survey-results/[topic]/
git checkout HEAD~1 -- src/app/cew-polls/[topic]/
git checkout HEAD~1 -- src/app/(dashboard)/admin/poll-results/PollResultsClient.tsx
```

## 📝 **Update Log Template**

### **Update Record**
- **Date**: [YYYY-MM-DD]
- **Updated By**: [Name]
- **Poll Type**: [Single-Choice/Ranking/Wordcloud]
- **Topic**: [Holistic Protection/Tiered Framework/Prioritization/WIKS]
- **Questions Changed**: [List specific questions]
- **Backup Created**: [Backup table names]
- **Verification Status**: [Passed/Failed]
- **Issues Encountered**: [List any problems]
- **Resolution**: [How issues were resolved]

## 🎯 **Key Success Metrics**

### **Update Success Criteria**
- [ ] All three locations (database, survey, CEW) have identical content
- [ ] Admin panel displays all questions correctly
- [ ] Vote submission works for both authenticated and CEW users
- [ ] Results display correctly in admin panel
- [ ] Build completes without errors
- [ ] No data loss occurred
- [ ] System performance maintained

### **Quality Assurance Checklist**
- [ ] Question text matches exactly across all locations
- [ ] Options arrays are identical in all locations
- [ ] Poll indices are consistent (0-based)
- [ ] Wordcloud configuration is appropriate
- [ ] Admin panel question matching works
- [ ] Vote counting logic is correct
- [ ] Error handling is robust

---

**Remember**: This protocol exists because poll system updates have caused system-wide failures in the past. Follow it exactly to ensure safe, efficient updates without breaking existing functionality.
