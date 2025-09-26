# 🗳️ Complete Poll & Ranking System Guide

## 🚨 CRITICAL: This Guide Prevents Future Misunderstandings

**HISTORICAL CONTEXT**: This guide was created after January 2025 debugging incidents where multiple incorrect assumptions were made despite reviewing existing markdowns and running queries. Only after analyzing actual CSV exports of database tables was the true system structure understood.

## 📊 **ACTUAL Database Structure (Based on CSV Analysis)**

### **Three Completely Separate Poll Systems**

#### **1. Single-Choice Polls System**
- **Table**: `polls`
- **Votes Table**: `poll_votes`
- **Results View**: `poll_results`
- **Vote Storage**: One vote per user per poll (upsert on change)
- **Vote Counting**: Sum of all individual votes

#### **2. Ranking Polls System**
- **Table**: `ranking_polls`
- **Votes Table**: `ranking_votes`
- **Results View**: `ranking_results`
- **Vote Storage**: Multiple votes per user per poll (one per option with rank)
- **Vote Counting**: Count of unique participants (not sum of individual votes)

#### **3. Wordcloud Polls System** ✅ **COMPLETED (January 2025)**
- **Table**: `wordcloud_polls`
- **Votes Table**: `wordcloud_votes`
- **Results View**: `wordcloud_results`
- **Vote Storage**: Multiple words per user per poll (1 word for Question 13, 1-3 words for other wordcloud polls, 20 char limit)
- **Vote Counting**: Count of unique participants and word frequency aggregation
- **Features**: Custom Canvas-based wordcloud rendering, aquatic blue/green color scheme
- **High-DPI Canvas Rendering**: Crisp, non-pixelated text with proper device pixel ratio scaling
- **Grid-Based Layout**: Eliminated overlapping words with collision detection and organized positioning
- **Dark Mode Support**: Dynamic theme detection with appropriate color palettes for both themes
- **Enhanced Readability**: Minimal text rotation and proper spacing between words
- **Better Color Contrast**: Inverted color selection so larger words get darker, more readable colors
- **Predefined Options**: Display descriptive options but submit simplified keywords
- **Either/Or Selection**: Users can select predefined options OR enter custom words, not both
- **Immediate Display**: Submitted words appear instantly in wordcloud and frequency table
- **Error Handling**: Division by zero protection and comprehensive error boundaries
- **CEW Multiple Submissions**: Unique user_id generation allows multiple submissions from same conference code
- **Unique Constraint**: `UNIQUE(poll_id, user_id, word)` prevents duplicate words from same user

#### **4. Prioritization Matrix Graph System** ✅ **COMPLETED (January 2025)**
- **API Endpoint**: `/api/graphs/prioritization-matrix`
- **Component**: `PrioritizationMatrixGraph.tsx`
- **Data Source**: Non-aggregated vote data from `poll_votes` table
- **Question Pairs**: 5 matrix graphs for question pairs 1-2, 3-4, 5-6, 7-8, 9-10
- **Scale Inversion**: Correctly inverts 1-5 scale (1=high, 5=low) for proper graph mapping
- **User Pairing**: Groups votes by user, only includes users who voted on both questions in pair
- **Visualization**: Custom SVG implementation with landscape orientation (16:9)
- **Color Coding**: Green for HIGH PRIORITY, red for NO GO, black for other quadrants
- **Dark Mode**: Dynamic theming with light text on dark backgrounds
- **Response Tracking**: Displays number of paired responses used for calculations

### **Current Database State (Post-Cleanup)**

#### **Polls Table (8 polls) - Single-Choice Questions Only**
```
/cew-polls/holistic-protection, poll_index 0
/survey-results/holistic-protection, poll_index 0
/cew-polls/prioritization, poll_index 3
/cew-polls/prioritization, poll_index 7
/cew-polls/tiered-framework, poll_index 0
/survey-results/prioritization, poll_index 3
/survey-results/prioritization, poll_index 7
/survey-results/tiered-framework, poll_index 0
```

#### **Ranking Polls Table (16 polls) - Ranking Questions Only**
```
/cew-polls/holistic-protection, poll_index 1
/survey-results/holistic-protection, poll_index 1
/cew-polls/tiered-framework, poll_index 1
/survey-results/tiered-framework, poll_index 1
/cew-polls/prioritization, poll_index 0,1,2,4,5,6 (6 polls)
/survey-results/prioritization, poll_index 0,1,2,4,5,6 (6 polls)
```

#### **Vote Tables**
- **poll_votes**: ~11 votes (single-choice votes only)
- **ranking_votes**: 72 votes (ranking votes only)

## 🏗️ **System Architecture**

### **Page Types & Their Poll Sources**

#### **1. Survey Results Pages** (`/survey-results/*`)
- **Source**: Both `polls` AND `ranking_polls` tables
- **Authentication**: Authenticated users only (TWG/SSTAC members)
- **Vote Storage**: 
  - Single-choice votes → `poll_votes` table
  - Ranking votes → `ranking_votes` table
- **Data Display**: Shows results from both authenticated users

#### **2. CEW Poll Pages** (`/cew-polls/*`)
- **Source**: Both `polls` AND `ranking_polls` tables
- **Authentication**: Unauthenticated (CEW conference code)
- **Vote Storage**:
  - Single-choice votes → `poll_votes` table (user_id = "CEW2025")
  - Ranking votes → `ranking_votes` table (user_id = "CEW2025")
- **Data Display**: Shows results from CEW conference attendees

#### **3. Admin Panel** (`/admin/poll-results`)
- **Source**: Both `polls` AND `ranking_polls` tables
- **Authentication**: Admin users only
- **Data Display**: 
  - Shows ALL results (survey + CEW combined)
  - Filtering: "All", "TWG Only", "CEW Only"
  - Question matching logic matches questions between survey and CEW versions

### **Critical Data Flow Understanding**

#### **Question Matching Logic**
The admin panel matches questions between survey and CEW versions using:
1. **Exact question text matching** (first 50 characters)
2. **Same page_path** (e.g., `/survey-results/holistic-protection` vs `/cew-polls/holistic-protection`)
3. **Same poll_index** (e.g., poll_index 0, poll_index 1)

#### **Vote Counting Differences**
- **Single-Choice Polls**: 
  - Display: "X votes"
  - Count: Sum of all individual votes
  - Example: 5 users vote = 5 votes displayed
- **Ranking Polls**:
  - Display: "X responses" 
  - Count: Number of unique participants
  - Example: 3 users rank 4 options each = 3 responses displayed (not 12 votes)

## 📋 **Current Poll Structure**

### **Holistic Protection (2 Questions)**
1. **Question 1** (Single-Choice): "Given the potential for over-conservatism..."
   - `/survey-results/holistic-protection`, poll_index 0
   - `/cew-polls/holistic-protection`, poll_index 0
2. **Question 2** (Ranking): "Rank in order of highest to lowest importance..."
   - `/survey-results/holistic-protection`, poll_index 1
   - `/cew-polls/holistic-protection`, poll_index 1

### **Tiered Framework (2 Questions)**
1. **Question 1** (Single-Choice): "In developing Protocol 2 requirements..."
   - `/survey-results/tiered-framework`, poll_index 0
   - `/cew-polls/tiered-framework`, poll_index 0
2. **Question 2** (Ranking): "Please rank the following lines of evidence..."
   - `/survey-results/tiered-framework`, poll_index 1
   - `/cew-polls/tiered-framework`, poll_index 1

### **Prioritization (13 Questions)**
- **Questions 0-9**: Single-choice questions (importance/feasibility pairs)
- **Questions 10-11**: Ranking questions
- **Question 12**: Wordcloud question with predefined options
- Each question exists in both `/survey-results/prioritization` and `/cew-polls/prioritization`
- **Matrix Graphs**: Questions 1-2, 3-4, 5-6, 7-8, 9-10 pairs have prioritization matrix graphs

## 🔧 **Database Schema Details**

### **polls Table Structure**
```sql
CREATE TABLE polls (
  id UUID PRIMARY KEY,
  page_path TEXT NOT NULL,
  poll_index INTEGER NOT NULL,
  question TEXT NOT NULL,
  options JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### **ranking_polls Table Structure**
```sql
CREATE TABLE ranking_polls (
  id UUID PRIMARY KEY,
  page_path TEXT NOT NULL,
  poll_index INTEGER NOT NULL,
  question TEXT NOT NULL,
  options JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### **poll_votes Table Structure**
```sql
CREATE TABLE poll_votes (
  id UUID PRIMARY KEY,
  poll_id UUID REFERENCES polls(id),
  user_id TEXT NOT NULL,
  option_index INTEGER NOT NULL,
  voted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  other_text TEXT
);
```

### **ranking_votes Table Structure**
```sql
CREATE TABLE ranking_votes (
  id UUID PRIMARY KEY,
  ranking_poll_id UUID REFERENCES ranking_polls(id),
  user_id TEXT NOT NULL,
  option_index INTEGER NOT NULL,
  rank INTEGER NOT NULL,
  voted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

## 🎯 **Key System Rules**

### **1. Never Mix Poll Types**
- ❌ **NEVER** put ranking questions in `polls` table
- ❌ **NEVER** put single-choice questions in `ranking_polls` table
- ✅ **ALWAYS** use correct table for correct poll type

### **2. Question Synchronization**
- ✅ **MUST** have identical questions in both survey and CEW versions
- ✅ **MUST** use same poll_index for matching questions
- ✅ **MUST** have same options array

### **3. Vote Storage Rules**
- ✅ **Single-choice**: One vote per user per poll (upsert)
- ✅ **Ranking**: Multiple votes per user per poll (one per option)
- ✅ **CEW votes**: Always use user_id = "CEW2025"
- ✅ **Survey votes**: Use authenticated user UUID

### **4. Results View Usage**
- ✅ **poll_results**: For single-choice poll data
- ✅ **ranking_results**: For ranking poll data
- ✅ **NEVER** query base tables directly for results
- ✅ **ALWAYS** use views for aggregated data

## 🚫 **Common Mistakes to Avoid**

### **Database Assumptions**
- ❌ **Don't assume** polls table contains all questions
- ❌ **Don't assume** ranking questions are missing if not in polls table
- ❌ **Don't assume** vote counts represent individual votes for ranking polls
- ❌ **Don't assume** CEW polls don't exist based on admin panel display issues

### **Query Mistakes**
- ❌ **Don't query** `total_votes` from base tables (only exists in views)
- ❌ **Don't use** `array_length()` for JSONB arrays (use `jsonb_array_length()`)
- ❌ **Don't assume** missing polls without checking both tables

### **Admin Panel Assumptions**
- ❌ **Don't assume** "CEW: 0 responses" means no CEW data exists
- ❌ **Don't assume** blank option text means missing options
- ❌ **Don't assume** filtering issues mean data problems

## 📊 **Verification Queries**

### **Check Current Poll State**
```sql
-- Check single-choice polls
SELECT page_path, poll_index, LEFT(question, 50) as question_preview 
FROM polls 
ORDER BY page_path, poll_index;

-- Check ranking polls  
SELECT page_path, poll_index, LEFT(question, 50) as question_preview 
FROM ranking_polls 
ORDER BY page_path, poll_index;
```

### **Check Vote Counts**
```sql
-- Single-choice votes
SELECT COUNT(*) FROM poll_votes;

-- Ranking votes
SELECT COUNT(*) FROM ranking_votes;

-- Votes by user type
SELECT 
  CASE 
    WHEN user_id = 'CEW2025' THEN 'CEW'
    ELSE 'TWG/SSTAC'
  END as user_type,
  COUNT(*) as vote_count
FROM poll_votes
GROUP BY user_id = 'CEW2025'
UNION ALL
SELECT 
  CASE 
    WHEN user_id = 'CEW2025' THEN 'CEW'
    ELSE 'TWG/SSTAC'
  END as user_type,
  COUNT(*) as vote_count
FROM ranking_votes
GROUP BY user_id = 'CEW2025';
```

### **Check Results Views**
```sql
-- Check poll_results view
SELECT COUNT(*) FROM poll_results;

-- Check ranking_results view
SELECT COUNT(*) FROM ranking_results;
```

## 🔄 **Update Procedures**

### **Adding New Poll Questions**
1. **Determine poll type**: Single-choice or ranking?
2. **Create in correct table**: `polls` or `ranking_polls`
3. **Create both versions**: Survey and CEW with identical questions
4. **Use same poll_index**: For matching between survey and CEW
5. **Test admin panel**: Verify questions display and match correctly

### **Modifying Existing Questions**
1. **Find both versions**: Survey and CEW polls
2. **Update both simultaneously**: Keep questions identical
3. **Verify admin panel**: Check matching logic still works
4. **Test vote submission**: Ensure both versions work

### **Database Cleanup**
1. **Always backup first**: Create timestamped backups
2. **Remove duplicates**: Check for questions in wrong tables
3. **Verify functionality**: Test admin panel after cleanup
4. **Document changes**: Record what was removed/added

## 🚨 **CRITICAL: Wordcloud System Implementation (January 2025)**

### **Division by Zero Protection**
**ALWAYS include division by zero protection** in wordcloud_results view percentage calculations:

```sql
CASE 
    WHEN tc.total_words IS NULL OR tc.total_words = 0 
    THEN 0.0
    ELSE ROUND((wd.frequency::numeric / tc.total_words::numeric) * 100, 2)
END AS percentage
```

Without this protection, empty wordcloud polls cause division by zero errors and prevent admin panel from loading.

### **Custom Wordcloud Component**
- **Library**: Custom Canvas-based implementation (no external dependencies)
- **React 19 Compatible**: Replaces react-wordcloud and wordcloud2.js
- **Layout Algorithm**: Size-based positioning with largest words in center
- **Color Scheme**: Aquatic blue and green gradient
- **Features**: Collision detection, dynamic sizing, rotation variety

### **Wordcloud Poll Configuration**
- **Max Words**: 1 word for Question 13 (single choice), 1-3 words for other wordcloud polls
- **Character Limit**: 20 characters per word
- **Vote Storage**: Individual word records in wordcloud_votes table
- **Aggregation**: Real-time word frequency calculation
- **Question 13 Specific**: Single-choice wordcloud with predefined options + custom input
- **CEW Submission Behavior**: Multiple submissions allowed with unique user_id generation
- **Unique Constraint**: Prevents duplicate words from same user while allowing multiple submissions

## 📝 **Key Takeaways**

1. **Three separate systems**: Single-choice, ranking, and wordcloud polls are completely independent
2. **Vote counting differs**: Sum vs count of participants vs word frequency aggregation
3. **CSV exports are truth**: Always verify with actual data exports
4. **Admin panel complexity**: Question matching logic is sophisticated
5. **Wordcloud division by zero**: Always protect against empty polls in percentage calculations
6. **CEW vs Survey**: Same questions, different user_id values
7. **Views are critical**: Use `poll_results`, `ranking_results`, and `wordcloud_results` for aggregated data
8. **Wordcloud CEW behavior**: Multiple submissions allowed with unique user_id generation for conference attendees
9. **Question 13 configuration**: Single-choice wordcloud (max_words=1) with predefined options

This guide should prevent future misunderstandings about the poll system structure and functionality.
