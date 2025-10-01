# 🗳️ Complete Poll & Ranking System Guide

## 🚨 CRITICAL: This Guide Prevents Future Misunderstandings

**HISTORICAL CONTEXT**: This guide was created after January 2025 debugging incidents where multiple incorrect assumptions were made despite reviewing existing markdowns and running queries. Only after analyzing actual CSV exports of database tables was the true system structure understood.

**JANUARY 2025 UPDATE**: Added comprehensive debugging lessons from holistic protection question text update process, including question text synchronization issues, admin panel matching failures, matrix graph data integration complexity, and filter system implementation gaps. **MATRIX GRAPH VISUALIZATION ENHANCEMENT**: Added 4-mode overlapping data points visualization system (Jittered, Size-Scaled, Heatmap, Concentric), improved color spectrum, and comprehensive K6 testing with proper user ID generation.

## 📊 **ACTUAL Database Structure (Based on CSV Analysis)**

### **Three Completely Separate Poll Systems**

#### **1. Single-Choice Polls System**
- **Table**: `polls`
- **Votes Table**: `poll_votes`
- **Results View**: `poll_results`
- **Vote Storage**: One vote per user per poll (upsert on change)
- **Vote Counting**: Sum of all individual votes
- **CEW Behavior**: Multiple submissions allowed with unique user_id generation

#### **2. Ranking Polls System**
- **Table**: `ranking_polls`
- **Votes Table**: `ranking_votes`
- **Results View**: `ranking_results`
- **Vote Storage**: Multiple votes per user per poll (one per option with rank)
- **Vote Counting**: Count of unique participants (not sum of individual votes)
- **CEW Behavior**: Multiple submissions allowed with unique user_id generation

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
- **Overlapping Data Points**: 4-mode visualization system for handling identical coordinates:
  - **Jittered Mode**: Spreads overlapping points in small circular radius
  - **Size-Scaled Mode**: Larger dots represent more overlapping points (6px → 12px radius)
  - **Heatmap Mode**: Color intensity indicates number of overlapping points
  - **Concentric Mode**: Multiple rings around center point for clustering indication
- **Color Spectrum**: Improved from light blue to standard blue progression for better visibility
- **Mode Switching**: Icon-based UI controls (ScatterChart, Circle, Zap, Layers icons)
- **Enhanced Tooltips**: Show cluster size and individual user information
- **K6 Testing**: Enhanced test with proper user ID generation via `x-session-id` header

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
- **CEW No Deletions**: CEW submissions are never deleted - all responses preserved

## 📝 **Key Takeaways**

1. **Three separate systems**: Single-choice, ranking, and wordcloud polls are completely independent
2. **Vote counting differs**: Sum vs count of participants vs word frequency aggregation
3. **CSV exports are truth**: Always verify with actual data exports
4. **Admin panel complexity**: Question matching logic is sophisticated
5. **Wordcloud division by zero**: Always protect against empty polls in percentage calculations
6. **CEW vs Survey**: Same questions, different user_id values
7. **Views are critical**: Use `poll_results`, `ranking_results`, and `wordcloud_results` for aggregated data
8. **CEW Multiple Submissions**: All poll types (single-choice, ranking, wordcloud) allow multiple submissions from same CEW2025 code
9. **CEW User ID Generation**: Each submission gets unique user_id: `${authCode}_${timestamp}_${randomSuffix}`
10. **CEW No Deletions**: CEW submissions are never deleted - all responses preserved for conference attendees
11. **Authenticated vs CEW**: Authenticated users get vote replacement (delete + insert), CEW users get additive submissions
12. **Question 13 configuration**: Single-choice wordcloud (max_words=1) with predefined options

This guide should prevent future misunderstandings about the poll system structure and functionality.

## 🧪 **K6 Testing System Enhancements (January 2025)**

### **K6 Test User ID Generation Fix**
- **Problem**: K6 test submitted 12,018 votes but all used same user_id (`CEW2025_default`), making vote pairing impossible
- **Root Cause**: API ignored k6's `user_id` in JSON payload and generated its own from `x-session-id` header
- **Solution**: Added `x-session-id` header to K6 test vote submissions
- **Implementation**: `headers: { 'x-session-id': sessionId }` where `sessionId = userId`
- **Result**: Each virtual user now gets consistent user_id across all question submissions

### **Enhanced Matrix Graph Testing**
- **File**: `k6-matrix-graph-test-enhanced.js`
- **Features**:
  - Paired responses (Q1 + Q2) for each user
  - Varied distributions for realistic testing
  - Multiple graph types coverage (Holistic Protection, Prioritization, Tiered Framework)
  - Realistic scenarios (balanced, skewed, clustered, edge cases)
- **Expected Result**: ~100 unique users with proper vote pairing for matrix graphs

### **Critical API Behavior Understanding**
- **CEW Poll API**: Generates `user_id` from `x-session-id` header, ignores JSON payload `user_id`
- **K6 Test Requirement**: Must send `x-session-id` header with unique session per virtual user
- **Session ID Format**: `CEW2025_${uniqueSessionId}` for consistent user tracking
- **Vote Pairing**: Matrix graphs require same user_id for both importance & feasibility questions

## 🐛 **COMPREHENSIVE DEBUGGING SCENARIOS (January 2025)**

### **Scenario 1: Question Text Synchronization Issues**
**Problem**: Different question text displayed in CEW polls vs admin panel vs database
**Symptoms**: 
- CEW polls show correct text
- Admin panel shows "Question not found"
- Database has placeholder text ("Question 3 text")
**Root Cause**: Hardcoded question text in frontend components doesn't match database
**Debugging Steps**:
1. Check database question text: `SELECT question FROM polls WHERE page_path = '/cew-polls/holistic-protection'`
2. Check frontend hardcoded text in component files
3. Check admin panel `currentPollQuestions` array
4. Verify all locations have identical text
**Solution**: Update ALL locations simultaneously
**Prevention**: Always verify data flow from database → API → frontend

### **Scenario 2: Admin Panel Question Matching Failures**
**Problem**: Admin panel cannot match submitted responses to questions
**Symptoms**:
- Responses submitted successfully
- Admin panel shows "Question not found"
- Console shows "Single-choice poll not matching current questions"
**Root Cause**: `currentPollQuestions` array doesn't match actual database question text
**Debugging Steps**:
1. Check `currentPollQuestions` array in `PollResultsClient.tsx`
2. Compare with actual database question text
3. Verify exact text matching (case-sensitive)
4. Check for extra spaces or special characters
**Solution**: Update `currentPollQuestions` array to match database exactly
**Prevention**: Implement question matching validation in admin panel

### **Scenario 3: Matrix Graph Data Integration Complexity**
**Problem**: Matrix graphs show incorrect response counts
**Symptoms**:
- Matrix graphs show 3 responses instead of 4
- Filter system doesn't work properly
- Data points don't match expected counts
**Root Cause**: API not properly combining data from both `/survey-results` and `/cew-polls` paths
**Debugging Steps**:
1. Check API endpoint `/api/graphs/prioritization-matrix`
2. Verify data fetching from both paths
3. Check `combineResults` helper function
4. Test with known data sets
**Solution**: Implement proper data combination logic
**Prevention**: Always test data aggregation with known data sets

### **Scenario 4: Filter System Implementation Gaps**
**Problem**: Matrix graphs always show combined data regardless of filter selection
**Symptoms**:
- Filter dropdown doesn't change graph data
- All filters show same response counts
- No filtering logic in API
**Root Cause**: Filter parameter not being passed from frontend to API
**Debugging Steps**:
1. Check frontend filter state management
2. Verify API receives filter parameter
3. Check API filtering logic
4. Test all filter combinations
**Solution**: Pass `filterMode` from frontend to API and implement filtering
**Prevention**: Test all filter combinations with known data sets

### **Scenario 5: Option Text Display Issues**
**Problem**: Admin panel shows "Option A", "Option B" instead of actual option text
**Symptoms**:
- Poll results show generic option labels
- No actual option text displayed
- Database has placeholder values
**Root Cause**: Database `options` JSONB column contains placeholder values
**Debugging Steps**:
1. Check database `options` column: `SELECT options FROM polls WHERE page_path = '/survey-results/holistic-protection'`
2. Compare with expected option text
3. Verify JSONB structure
4. Check frontend option display logic
**Solution**: Update `options` JSONB column with correct option strings
**Prevention**: Verify option text in database matches frontend expectations

### **Scenario 6: Poll Index vs Question Number Confusion**
**Problem**: Database `poll_index 0` corresponds to webpage "Question 1"
**Symptoms**:
- Admin panel shows wrong question numbers
- Question 1 missing from admin panel
- Confusion between database and UI indexing
**Root Cause**: Zero-based indexing in database vs one-based indexing in UI
**Debugging Steps**:
1. Check database `poll_index` values
2. Verify UI question numbering
3. Check mapping logic in admin panel
4. Test with known question data
**Solution**: Always account for zero-based indexing when mapping database to UI
**Prevention**: Document indexing conventions clearly

### **Scenario 7: Duplicate Question Cleanup Issues**
**Problem**: Prioritization group shows Q1-5, 11-13 instead of Q1-5
**Symptoms**:
- Extra questions appear in admin panel
- Question numbers don't match expected sequence
- Duplicate data in database
**Root Cause**: Old duplicate questions still exist in database
**Debugging Steps**:
1. Check for duplicate `poll_index` values
2. Verify question text matches
3. Check all poll tables for duplicates
4. Test admin panel display
**Solution**: Delete old duplicate questions from all poll tables
**Prevention**: Implement comprehensive cleanup verification

### **Scenario 8: k6 Test Command Execution Errors**
**Problem**: `node k6-test.js` fails with module not found error
**Symptoms**:
- Error: `Cannot find module 'D:\SSTAC-Dashboard\node_modules\k6\http'`
- k6 tests don't run
- Wrong command used
**Root Cause**: k6 scripts must be run with `k6 run` command, not `node`
**Debugging Steps**:
1. Check k6 installation
2. Verify script syntax
3. Use correct command: `k6 run k6-test.js`
4. Test script execution
**Solution**: Use `k6 run k6-test.js` command
**Prevention**: Document proper execution commands for all test scripts

### **Scenario 9: TypeScript Build Safety Issues**
**Problem**: Production build fails due to TypeScript errors
**Symptoms**:
- `npm run build` fails
- TypeScript compilation errors
- JSX compliance issues
**Root Cause**: Missing type annotations and unescaped quotes in JSX
**Debugging Steps**:
1. Run `npm run build` to identify errors
2. Fix TypeScript type annotations
3. Fix JSX quote escaping
4. Test build process
**Solution**: Fix all TypeScript errors and JSX compliance issues
**Prevention**: Run `npm run build` frequently during development

### **Scenario 10: Database vs Frontend Discrepancies**
**Problem**: Database has placeholder text while frontend shows correct text
**Symptoms**:
- Frontend displays correct questions
- Database has "Question 3 text" placeholders
- Admin panel cannot match questions
**Root Cause**: Frontend components are hardcoded, not fetching from database
**Debugging Steps**:
1. Check frontend component source code
2. Verify database content
3. Check API data fetching
4. Test admin panel matching
**Solution**: Update database to match frontend expectations, then update frontend to fetch from database
**Prevention**: Audit all components to ensure they fetch data from database
