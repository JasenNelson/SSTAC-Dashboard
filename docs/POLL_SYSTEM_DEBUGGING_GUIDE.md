# 🐛 Poll System Debugging Guide

## Overview
This guide documents critical debugging issues encountered with the admin poll results system and provides solutions to prevent future problems.

**JANUARY 2025 UPDATES**: Added change vote functionality fixes, duplicate vote prevention, database schema improvements, and comprehensive polling system debugging. Added matrix graph investigation findings, K6 test user ID mismatch resolution, overlapping data points visualization system, and admin panel improvements.

## 🚨 CRITICAL: Change Vote Functionality Issues (2025-01-27)

### **Duplicate Vote Creation Issue (RESOLVED)**
**Problem**: Authenticated users changing votes created duplicate entries instead of updating existing votes
**Root Cause**: Missing unique constraint on poll_votes table prevented upsert operations from working
**Bad Assumption**: "upsert works without unique constraints" - WRONG, upsert needs unique constraint to identify existing records
**Solution**: Added partial unique index on (poll_id, user_id) for authenticated users only
**Prevention**: Always verify database constraints support intended operations

### **CEW vs Authenticated User Behavior Confusion (RESOLVED)**
**Problem**: CEW users were affected by unique constraints, breaking insert-only behavior
**Root Cause**: Unique constraint applied to all users instead of just authenticated users
**Bad Assumption**: "One constraint fits all user types" - WRONG, CEW and authenticated users have different requirements
**Solution**: Used partial unique index with WHERE clause to exclude CEW users
**Prevention**: Always consider different user types when designing database constraints

### **API Upsert vs Delete-Insert Approach (RESOLVED)**
**Problem**: upsert operations failed due to missing unique constraints
**Root Cause**: Database schema didn't support upsert operations properly
**Bad Assumption**: "upsert is always better than delete-insert" - WRONG, depends on database constraints
**Solution**: Switched to delete-then-insert approach for vote changes
**Prevention**: Test database operations with actual constraints before implementing

### **UI State Management Issues (RESOLVED)**
**Problem**: Change vote buttons were disabled or submit buttons disappeared after clicking "Change Vote"
**Root Cause**: State management conflicts between fetchResults and change vote functions
**Bad Assumption**: "State updates happen synchronously" - WRONG, React state updates are asynchronous
**Solution**: Fixed state management order and prevented race conditions
**Prevention**: Always consider state update timing and dependencies

### **Wordcloud Image Persistence Issue (RESOLVED)**
**Problem**: Wordcloud images disappeared after browser refresh
**Root Cause**: fetchResults function was disabled, preventing data loading on component mount
**Bad Assumption**: "Disabled API calls don't affect functionality" - WRONG, they prevent data persistence
**Solution**: Re-enabled API calls for survey-results pages while preserving CEW privacy
**Prevention**: Test all user flows including browser refresh scenarios

## 🚨 CRITICAL: Holistic Protection Question Text Updates (2025-01-26)

### **Question Text Synchronization Issues (NEW ISSUE)**
**Problem**: Holistic protection questions showed different text in CEW polls vs admin panel vs database
**Root Cause**: Hardcoded question text in frontend components didn't match database content
**Bad Assumption**: "Frontend components fetch question text from database" - WRONG, they were hardcoded
**Solution**: Update ALL locations simultaneously - database, CEW polls, survey-results, admin panel, k6 tests
**Prevention**: Always verify data flow from database → API → frontend components

### **Admin Panel Question Matching Failures (NEW ISSUE)**
**Problem**: Admin panel showed "Question not found" for submitted responses
**Root Cause**: `currentPollQuestions` array in admin panel didn't match actual database question text
**Bad Assumption**: "Admin panel automatically matches questions" - WRONG, requires exact text matching
**Solution**: Update `currentPollQuestions` array to match database question text exactly
**Prevention**: Implement question matching validation in admin panel

### **Matrix Graph Data Integration Complexity (NEW ISSUE)**
**Problem**: Matrix graphs showed incorrect response counts (3 instead of 4)
**Root Cause**: API was not properly combining data from both `/survey-results` and `/cew-polls` paths
**Bad Assumption**: "Matrix graphs automatically aggregate all data" - WRONG, requires explicit data combination
**Solution**: Implement `combineResults` helper function to merge data from both paths
**Prevention**: Always test data aggregation with known data sets

### **Filter System Implementation Gaps (NEW ISSUE)**
**Problem**: Matrix graphs always showed combined data regardless of filter selection
**Root Cause**: Filter parameter wasn't being passed from frontend to API
**Bad Assumption**: "Filter system works automatically" - WRONG, requires explicit implementation
**Solution**: Pass `filterMode` from frontend to API and implement filtering logic
**Prevention**: Test all filter combinations with known data sets

### **Option Text Display Issues (NEW ISSUE)**
**Problem**: Admin panel showed "Option A", "Option B" instead of actual option text
**Root Cause**: Database `options` JSONB column contained placeholder values
**Bad Assumption**: "Option text is automatically generated" - WRONG, it's stored in database
**Solution**: Update `options` JSONB column with correct option strings
**Prevention**: Verify option text in database matches frontend expectations

### **Poll Index vs Question Number Confusion (NEW ISSUE)**
**Problem**: Database `poll_index 0` corresponds to webpage "Question 1"
**Root Cause**: Zero-based indexing in database vs one-based indexing in UI
**Bad Assumption**: "poll_index matches question number" - WRONG, poll_index is zero-based
**Solution**: Always account for zero-based indexing when mapping database to UI
**Prevention**: Document indexing conventions clearly

### **Duplicate Question Cleanup Issues (NEW ISSUE)**
**Problem**: Prioritization group showed Q1-5, 11-13 instead of Q1-5
**Root Cause**: Old duplicate questions (poll_index 10-12) still existed in database
**Bad Assumption**: "Database cleanup was complete" - WRONG, duplicates remained
**Solution**: Delete old duplicate questions from all poll tables
**Prevention**: Implement comprehensive cleanup verification

### **k6 Test Command Execution Errors (NEW ISSUE)**
**Problem**: `node k6-test.js` failed with module not found error
**Root Cause**: k6 scripts must be run with `k6 run` command, not `node`
**Bad Assumption**: "k6 scripts run like regular Node.js scripts" - WRONG, they're k6-specific
**Solution**: Use `k6 run k6-test.js` command
**Prevention**: Document proper execution commands for all test scripts

### **TypeScript Build Safety Issues (NEW ISSUE)**
**Problem**: Production build failed due to TypeScript errors
**Root Cause**: Missing type annotations and unescaped quotes in JSX
**Bad Assumption**: "Code compiles locally so it will build in production" - WRONG, stricter production settings
**Solution**: Fix all TypeScript errors and JSX compliance issues
**Prevention**: Run `npm run build` frequently during development

## 🚨 CRITICAL: CEW Poll Multiple Submissions (2025-01-25)

### **CEW Poll Behavior Requirements (CRITICAL)**
**Problem**: CEW polls must allow multiple submissions from same conference code (CEW2025)
**Requirement**: Multiple conference attendees should be able to submit responses using the same CEW2025 code
**Behavior**: NO deletions for CEW submissions - all responses must be preserved

**Implementation**:
- **Unique User ID Generation**: Each CEW submission gets unique user_id: `${authCode}_${timestamp}_${randomSuffix}`
- **No Deletions**: CEW submissions are never deleted - all responses preserved
- **Applies to All Poll Types**: Single-choice, ranking, and wordcloud polls
- **Authenticated Users**: Still get vote replacement (delete + insert) for authenticated sessions

**Example User IDs**:
- CEW2025_1758936214034_276
- CEW2025_1758936214044_896
- CEW2025_1758936214060_708

**Prevention Protocol**:
- ✅ **NEVER delete CEW submissions** - always preserve all responses
- ✅ **Generate unique user_id** for each CEW submission
- ✅ **Test multiple submissions** from same CEW code
- ✅ **Verify admin panel counts** increase with each submission

## 🚨 CRITICAL: Recurring Security & Indexing Issues (2025-01-20)

## 🚨 CRITICAL: Prioritization Matrix Graph System Issues (2025-01-20)

### **Graph Integration TypeScript Errors (NEW ISSUE)**
**Problem**: TypeScript compilation errors in graph integration components
**Error**: `Variable 'wordsToShow' implicitly has type 'any[]' in some locations where its type cannot be determined`
**Impact**: Production build fails with TypeScript errors
**Root Cause**: Missing explicit type annotations in WordCloudPoll component

**Solution Applied**:
```typescript
// Explicit type annotation for wordsToShow variable
let wordsToShow: { text: string; value: number }[] = [];

// Proper undefined check for userWords
if (userWords && userWords.length > 0) {
  // ... processing logic
}
```

**Prevention Protocol**:
- ✅ **ALWAYS provide explicit type annotations** for complex variables
- ✅ **Use proper undefined checks** before accessing array properties
- ✅ **Test TypeScript builds frequently** during development
- ✅ **Avoid implicit 'any' types** in production code

### **Graph Data API Query Errors (RESOLVED)**
**Problem**: Initial graph API used incorrect database schema assumptions
**Error**: `Property 'selected_option' does not exist on type 'poll_votes'`
**Impact**: Graph data API returns 500 errors
**Root Cause**: Assumed non-existent column instead of actual `option_index`

**Solution Applied**:
```typescript
// Correct API query using actual database schema
const { data: votes } = await supabase
  .from('poll_votes')
  .select(`
    user_id,
    option_index,  // Correct column name
    polls!inner(poll_index)
  `)
  .in('polls.page_path', [
    '/survey-results/prioritization',
    '/cew-polls/prioritization'
  ]);
```

**Prevention Protocol**:
- ✅ **ALWAYS verify database schema** before writing queries
- ✅ **Use actual column names** from database tables
- ✅ **Test API endpoints** with real data before integration
- ✅ **Query both survey and CEW paths** for complete data

## 🚨 CRITICAL: Wordcloud Division by Zero Error (2025-01-20)

### **Wordcloud Results View Division by Zero (NEW ISSUE)**
**Problem**: `wordcloud_results` view causes division by zero error when no votes exist
**Error**: `{code: '22012', details: null, hint: null, message: 'division by zero'}`
**Impact**: Admin panel fails to load with 400 Bad Request error
**Root Cause**: Percentage calculation divides by zero when total word count is 0

**Solution Applied**:
```sql
-- Robust wordcloud_results view with division by zero protection
CREATE OR REPLACE VIEW wordcloud_results AS
WITH wordcloud_data AS (
    -- ... data aggregation logic
),
total_counts AS (
    -- ... total calculation logic
)
SELECT
    -- ... other fields
    CASE 
        WHEN tc.total_words IS NULL OR tc.total_words = 0 
        THEN 0.0
        ELSE ROUND((wd.frequency::numeric / tc.total_words::numeric) * 100, 2)
    END AS percentage
FROM wordcloud_data wd
LEFT JOIN total_counts tc ON wd.poll_id = tc.poll_id
WHERE wd.word IS NOT NULL;
```

**Prevention Protocol**:
- ✅ **ALWAYS include division by zero protection** in percentage calculations
- ✅ **Use CTE structure** to separate data aggregation from calculations
- ✅ **Test with empty polls** to ensure no division by zero errors
- ✅ **Use COALESCE and explicit zero checks** for robust error handling

### **Supabase Security Invoker Warning (RECURRING ISSUE)**
**Problem**: Supabase repeatedly warns about missing `security_invoker = on` in view definitions
**Frequency**: This occurs multiple times as Supabase automatically detects security improvements
**Root Cause**: Views created without explicit security settings use default creator permissions
**Impact**: Potential security vulnerabilities in production

**Solution Applied**:
```sql
-- Update both views with security_invoker
CREATE OR REPLACE VIEW poll_results WITH (security_invoker = on) AS ...
CREATE OR REPLACE VIEW ranking_results WITH (security_invoker = on) AS ...
```

**Prevention Protocol**:
- ✅ **ALWAYS include** `WITH (security_invoker = on)` when creating/updating views
- ✅ **Document this requirement** in database schema files
- ✅ **Apply to ALL views** for consistency and security

### **Ranking Results View Array Indexing Bug (RECURRING ISSUE)**
**Problem**: The `+1` offset keeps getting reintroduced in `ranking_results` view definition
**Frequency**: This bug has occurred multiple times during system updates
**Root Cause**: Misunderstanding of 0-based vs 1-based array indexing in PostgreSQL
**Impact**: Blank option text in admin panel for ranking polls

**Critical Fix**:
```sql
-- WRONG (causes blank options):
'option_text', rp.options[option_stats.option_index + 1]

-- CORRECT (working version):
'option_text', rp.options[option_stats.option_index]
```

**Safeguard Added to AGENTS.md**:
```markdown
- **CRITICAL: ranking_results View Array Indexing**: The ranking_results view uses `rp.options[option_stats.option_index]` (NOT +1). The option_index values in ranking_votes table are 0-based (0,1,2,3) and the options JSONB array is also 0-based. Adding +1 breaks the mapping and causes blank option text in admin panel. NEVER modify this line: `'option_text', rp.options[option_stats.option_index]`. The system uses 0-based indexing throughout - do not "fix" what appears to be a 1-based vs 0-based issue.
```

## ✅ Admin Panel Navigation Features (2025-01-20)

### **Bidirectional Question Navigation Implementation**
The admin poll results panel now includes advanced navigation features:

#### **Navigation Controls**
- **Left Arrow Button**: Navigate to previous question in current poll group
- **Right Arrow Button**: Navigate to next question in current poll group
- **Positioning**: Located between question number and expand button
- **Styling**: Small, subtle buttons with hover effects

#### **Smart Group Navigation**
- **Group-Aware**: Only navigates within current poll group (Holistic Protection, Tiered Framework, etc.)
- **Wrap-Around**: Seamlessly cycles from last question back to first, and vice versa
- **State Management**: Updates both `selectedQuestion` and `currentQuestionIndex`

#### **Technical Implementation**
```javascript
const navigateToNextQuestion = (currentPoll: PollResult) => {
  const pollGroup = getPollGroup(currentPoll.page_path);
  const groupPolls = filteredPolls.filter(poll => getPollGroup(poll.page_path) === pollGroup);
  const currentIndex = groupPolls.findIndex(poll => 
    poll.page_path === currentPoll.page_path && poll.poll_index === currentPoll.poll_index
  );
  const nextIndex = (currentIndex + 1) % groupPolls.length;
  const nextPoll = groupPolls[nextIndex];
  if (nextPoll) {
    const nextPollKey = nextPoll.poll_id || nextPoll.ranking_poll_id || `poll-${nextPoll.page_path}-${nextPoll.poll_index}`;
    setSelectedQuestion(nextPollKey);
    setCurrentQuestionIndex(nextIndex);
  }
};
```

### **QR Code Expansion System**
#### **Click-to-Expand Functionality**
- **Clickable Elements**: Both "Join at" container and QR code are clickable
- **Conference Display**: 4x larger display centered on screen for conference attendees
- **Dynamic Content**: Shows correct web address and QR code for each poll group
- **Easy Dismissal**: Click outside overlay or close button to dismiss

#### **Z-Index Management**
- **Expanded View**: Uses `z-[60]` to appear above refresh button (`z-50`)
- **Header Clearance**: Positioned at `top-20` to avoid header overlap
- **Refresh Button Access**: Uses `left-20` when panel hidden to avoid obstruction

### **Enhanced Blue Bar Visibility**
#### **Height Improvements**
- **Normal View**: Increased from `h-3` (12px) to `h-5` (20px) - 67% increase
- **Expanded View**: Increased from `h-6` (24px) to `h-8` (32px) - 33% increase
- **Consistent Application**: Applied to both ranking polls and single-choice polls
- **No Layout Issues**: Adequate spacing maintained between response options

## 🚨 CRITICAL: Poll Question & Option Updates (2025-01-18)

### **MANDATORY PROTOCOL FOR UPDATING POLL QUESTIONS**
When updating poll questions and options across the system, follow this exact protocol to prevent system-wide failures:

#### **1. Database-First Approach**
- **ALWAYS update database first** with new poll questions and options
- **NEVER update UI pages** without corresponding database changes
- **VERIFY database state** before making any UI changes

#### **2. Three-Way Synchronization Required**
Every poll question must exist in **THREE places** with identical content:
1. **Database tables**: `polls` and `ranking_polls` with exact question text and options
2. **Survey Results pages**: `/survey-results/[topic]` with matching questions
3. **CEW Poll pages**: `/cew-polls/[topic]` with matching questions

#### **3. Admin Panel Question Matching Logic**
The admin panel (`PollResultsClient.tsx`) uses strict question matching:
```javascript
const currentPollQuestions = [
  // Must match EXACTLY with database questions
  "Given the potential for over-conservatism...",
  "Rank in order of highest to lowest importance...",
  // ... etc
];

const matchesCurrentQuestion = currentPollQuestions.some(question => 
  poll.question.includes(question.substring(0, 50)) || 
  question.includes(poll.question.substring(0, 50))
);
```

**CRITICAL**: If database questions don't match `currentPollQuestions` array, polls get filtered out and show 0 responses.

#### **4. Safe Update Protocol**
```sql
-- 1. FIRST: Backup existing data
CREATE TABLE polls_backup AS SELECT * FROM polls;
CREATE TABLE ranking_polls_backup AS SELECT * FROM ranking_polls;

-- 2. SECOND: Update database questions to match new requirements
UPDATE polls SET question = 'New question text', options = '["option1", "option2"]' 
WHERE page_path = '/survey-results/topic' AND poll_index = 0;

-- 3. THIRD: Update admin panel currentPollQuestions array
-- 4. FOURTH: Update survey-results and cew-polls pages
-- 5. FIFTH: Test all three systems work together
```

#### **5. Common Failure Points**
- **Question text mismatch**: Even minor differences cause filtering failures
- **Options array mismatch**: Different option order breaks result display
- **Missing polls**: If database poll doesn't exist, UI shows empty state
- **Index misalignment**: `poll_index` must match between database and UI

## 🚨 Critical Issues Resolved

### 1. Vote Counting Logic Errors
**Problem**: Admin page showing incorrect total responses (e.g., "Total Responses: 8" when individual polls showed 1 vote each)

**Root Cause**: Incorrect vote counting logic for different poll types
- Ranking polls: Each user ranks ALL options = 1 response per user
- Single-choice polls: Each user selects ONE option = 1 response per user

**Solution**:
```typescript
// Correct vote counting logic
if (group.isRanking) {
  // For ranking polls, use total_votes field (unique participants)
  surveyVotes = surveyPoll ? (surveyPoll.total_votes || 0) : 0;
  cewVotes = cewPoll ? (cewPoll.total_votes || 0) : 0;
} else {
  // For single-choice polls, sum up all votes in the results
  surveyVotes = surveyPoll ? (surveyPoll.results || []).reduce((sum: number, result: any) => sum + (result.votes || 0), 0) : 0;
  cewVotes = cewPoll ? (cewPoll.results || []).reduce((sum: number, result: any) => sum + (result.votes || 0), 0) : 0;
}
```

### 2. Path Recognition Issues
**Problem**: WIKS polls not displaying TWG/SSTAC responses due to path mismatch

**Root Cause**: WIKS polls in `/wiks` not recognized as survey polls

**Solution**:
```typescript
// Fixed path recognition
if (poll.page_path.startsWith('/survey-results') || poll.page_path === '/wiks') {
  group.surveyPoll = poll;
} else if (poll.page_path.startsWith('/cew-polls')) {
  group.cewPoll = poll;
}
```

### 3. Data Grouping Problems
**Problem**: Polls not properly grouped by topic, causing duplicate questions and incorrect data combination

**Root Cause**: Inconsistent grouping keys for different topics

**Solution**:
```typescript
// Consistent grouping logic
let key;
if (poll.page_path.includes('holistic-protection')) {
  key = `holistic-protection_${poll.poll_index}`;
} else if (poll.page_path.includes('tiered-framework')) {
  key = `tiered-framework_${poll.poll_index}`;
} else if (poll.page_path.includes('prioritization')) {
  key = `prioritization_${poll.poll_index}`;
} else if (poll.page_path.includes('wiks')) {
  key = `wiks_${poll.poll_index}`;
} else {
  const topic = poll.page_path.split('/').pop() || 'unknown';
  key = `${topic}_${poll.poll_index}`;
}
```

### 4. TypeScript Build Failures
**Problem**: Production build failing due to implicit `any` types

**Root Cause**: Missing type annotations in reduce functions and map operations

**Solution**:
```typescript
// Always use explicit type annotations
surveyVotes = surveyPoll ? (surveyPoll.results || []).reduce((sum: number, result: any) => sum + (result.votes || 0), 0) : 0;
cewVotes = cewPoll ? (cewPoll.results || []).reduce((sum: number, result: any) => sum + (result.votes || 0), 0) : 0;

// For map operations
surveyResults = (surveyPoll.results || []).map((result: any) => ({
  option_index: result.option_index,
  option_text: result.option_text,
  votes: surveyVotes,
  averageRank: result.averageRank || 0
}));

// For sort operations
})).sort((a: any, b: any) => a.averageRank - b.averageRank);
```

### 5. Filter Logic Complexity
**Problem**: Complex filtering system not working correctly for combined data

**Root Cause**: Original survey/CEW data not stored separately for accurate filtering

**Solution**:
```typescript
// Store original data separately for filtering
const combinedPoll = {
  ...basePoll,
  total_votes: totalVotes,
  results: pollResults,
  combined_survey_votes: surveyVotes,
  combined_cew_votes: cewVotes,
  is_ranking: group.isRanking,
  survey_results: surveyResults,  // Store original survey data
  cew_results: cewResults        // Store original CEW data
};

// Use original data for filtering
const getFilteredPollResults = (poll: PollResult) => {
  if (filterMode === 'all') {
    return poll.results;
  }
  
  if (poll.is_ranking) {
    // For ranking polls, use the original survey or CEW results
    if (filterMode === 'twg' && poll.survey_results) {
      return poll.survey_results;
    } else if (filterMode === 'cew' && poll.cew_results) {
      return poll.cew_results;
    }
    return poll.results;
  }
  // ... rest of filtering logic
};
```

### 7. Ranking Results View Array Indexing (CRITICAL)
**Problem**: Blank/empty option text appearing in admin panel for ranking polls

**Root Cause**: `ranking_results` view incorrectly using `+1` offset for array indexing
```sql
-- WRONG: This causes blank option text
'option_text', rp.options[(option_stats.option_index + 1)]

-- CORRECT: Use 0-based indexing
'option_text', rp.options[option_stats.option_index]
```

**Critical Fix Applied**: The `ranking_results` view was recreated to use correct 0-based indexing:
```sql
CREATE OR REPLACE VIEW ranking_results AS
SELECT rp.id AS ranking_poll_id,
    rp.page_path,
    rp.poll_index,
    rp.question,
    rp.options,
    rp.created_at,
    rp.updated_at,
    count(DISTINCT rv.user_id) AS total_votes,
    COALESCE(( SELECT jsonb_agg(jsonb_build_object('option_index', option_stats.option_index, 'option_text', rp.options[option_stats.option_index], 'averageRank', option_stats.avg_rank, 'votes', option_stats.vote_count) ORDER BY option_stats.option_index) AS jsonb_agg
           FROM ( SELECT rv2.option_index,
                    avg((rv2.rank)::numeric) AS avg_rank,
                    count(rv2.id) AS vote_count
                   FROM ranking_votes rv2
                  WHERE (rv2.ranking_poll_id = rp.id)
                  GROUP BY rv2.option_index) option_stats), '[]'::jsonb) AS results
   FROM (ranking_polls rp
     LEFT JOIN ranking_votes rv ON ((rp.id = rv.ranking_poll_id)))
  GROUP BY rp.id, rp.page_path, rp.poll_index, rp.question, rp.options, rp.created_at, rp.updated_at;
```

**Key Learning**: The system uses 0-based indexing throughout - do not "fix" what appears to be a 1-based vs 0-based issue.

## 🔍 Debugging Checklist

### Before Implementing Poll Changes
- [ ] Verify data sources - Check what data is actually being fetched from database
- [ ] Understand poll types - Ranking vs single-choice polls have different logic
- [ ] Test data combination - Use known data sets to verify combination logic
- [ ] Add comprehensive logging - Trace data flow through complex systems
- [ ] Verify path patterns - Ensure all poll paths follow consistent patterns

### During Development
- [ ] Test builds frequently - Catch TypeScript errors early
- [ ] Use explicit type annotations - No implicit `any` types
- [ ] Test edge cases - Empty data, missing fields, type mismatches
- [ ] Document data flow - Map out how data moves through the system
- [ ] Verify vote counting - Test with known vote counts

### After Implementation
- [ ] Test all filter modes - TWG/SSTAC Only, CEW Only, All Responses
- [ ] Verify vote counts - Math should add up correctly
- [ ] Test both poll types - Single-choice and ranking polls
- [ ] Check path recognition - All poll paths should be recognized
- [ ] Verify data grouping - Polls should be grouped correctly by topic

## 🚫 Common Mistakes to Avoid

### Database Interactions
- ❌ Don't assume `poll_index` values match question numbers
- ❌ Don't assume `total_votes` field is reliable for all poll types
- ❌ Don't assume all polls follow the same path pattern
- ❌ Don't assume data combination logic works for all scenarios

### TypeScript Safety
- ❌ Don't use implicit `any` types
- ❌ Don't ignore TypeScript build errors
- ❌ Don't assume type inference will work correctly
- ❌ Don't skip type annotations for complex data structures

### Data Processing
- ❌ Don't assume survey and CEW data have the same structure
- ❌ Don't assume all polls have the same question text
- ❌ Don't assume vote counting logic works the same for all poll types
- ❌ Don't assume filtering logic works without testing

## ✅ Best Practices

### Code Quality
- ✅ Always use explicit type annotations
- ✅ Test builds frequently during development
- ✅ Add comprehensive logging for debugging
- ✅ Document complex data flow logic
- ✅ Use consistent naming conventions

### Data Handling
- ✅ Verify data sources before processing
- ✅ Test with known data sets
- ✅ Handle edge cases gracefully
- ✅ Store original data separately for filtering
- ✅ Use consistent grouping keys

### Debugging
- ✅ Add logging at key points in data flow
- ✅ Test each component in isolation
- ✅ Verify assumptions with actual data
- ✅ Use systematic approach to debugging
- ✅ Document solutions for future reference

## 📊 Performance Considerations

### Database Queries
- Use indexed queries for poll result retrieval
- Avoid complex joins when simple queries suffice
- Cache frequently accessed data when appropriate
- Use database views for aggregated results

### Data Processing
- Process data in batches when possible
- Use efficient algorithms for data combination
- Avoid unnecessary data transformations
- Cache processed results when appropriate

### UI Updates
- Use React.memo for expensive components
- Implement proper loading states
- Avoid unnecessary re-renders
- Use efficient state management

## 🔧 Tools and Techniques

### Debugging Tools
- Browser Developer Tools for element inspection
- Console logging for data flow tracing
- TypeScript compiler for type checking
- Database query tools for data verification

### Testing Approaches
- Unit tests for individual functions
- Integration tests for data combination
- End-to-end tests for user workflows
- Performance tests for large datasets

### Monitoring
- Error tracking for production issues
- Performance monitoring for slow queries
- User feedback for UX issues
- Analytics for usage patterns

## 📝 Documentation Requirements

### Code Documentation
- Document complex data flow logic
- Explain vote counting algorithms
- Document path recognition patterns
- Explain filtering logic

### User Documentation
- Document poll types and their differences
- Explain how results are calculated
- Document filtering options
- Explain data combination process

### Maintenance Documentation
- Document debugging procedures
- Explain common issues and solutions
- Document performance considerations
- Explain testing requirements

## 🚀 Future Improvements

### Code Quality
- Implement comprehensive type definitions
- Add automated testing for poll logic
- Implement performance monitoring
- Add error handling improvements

### User Experience
- Improve loading states
- Add better error messages
- Implement real-time updates
- Add accessibility improvements

### Performance
- Optimize database queries
- Implement data caching
- Add lazy loading for large datasets
- Optimize UI rendering

### Monitoring
- Add comprehensive logging
- Implement error tracking
- Add performance metrics
- Implement user analytics

## 🚨 CRITICAL: Wordcloud UX Issues (2025-01-26)

### **Wordcloud Layout and Readability Problems (NEW ISSUE)**
**Problem**: Wordcloud had poor user experience with overlapping words, pixelated text, and poor contrast
**Issues**: 
- Words overlapping and unreadable
- Pixelated text on high-DPI displays
- Larger words appearing lighter (bad contrast)
- Words forming spiral shape instead of organized layout
- Poor readability in both light and dark modes

**Root Cause**: 
- Spiral positioning algorithm caused overlaps
- Canvas not scaled for high-DPI displays
- Color selection logic inverted (larger words got lighter colors)
- No dark mode support for wordcloud colors

**Solution Applied**:
```typescript
// High-DPI Canvas Setup
const devicePixelRatio = window.devicePixelRatio || 1;
const actualWidth = width * devicePixelRatio;
const actualHeight = height * devicePixelRatio;

canvas.width = actualWidth;
canvas.height = actualHeight;
canvas.style.width = `${width}px`;
canvas.style.height = `${height}px`;

ctx.scale(devicePixelRatio, devicePixelRatio);

// Grid-based Layout with Collision Detection
const hasCollision = (word, placedWords, padding = 25) => {
  return placedWords.some(placed => {
    const distance = Math.sqrt(
      Math.pow(word.x - placed.x, 2) + Math.pow(word.y - placed.y, 2)
    );
    return distance < (word.width + placed.width) / 2 + padding;
  });
};

// Inverted Color Selection for Better Contrast
const colorIndex = Math.floor((1 - normalizedValue) * (colors.length - 1));

// Dark Mode Support
const colors = isDarkMode ? darkColors : lightColors;
```

**Prevention Protocol**:
- ✅ **ALWAYS implement collision detection** for word positioning
- ✅ **Use high-DPI canvas scaling** for crisp text rendering
- ✅ **Test color contrast** in both light and dark modes
- ✅ **Implement organized layouts** instead of random positioning
- ✅ **Provide theme-specific color palettes** for better readability

### **TypeScript Build Errors in Tiered Framework (RESOLVED)**
**Problem**: TypeScript compilation errors in Tiered Framework components
**Error**: `Property 'isWordcloud' does not exist on type '{ question: string; questionNumber: number; options: string[]; }'`
**Impact**: Production build fails with TypeScript errors
**Root Cause**: Tiered Framework components checking for properties that don't exist on single-choice polls

**Solution Applied**:
```typescript
// Removed unused wordcloud and ranking checks from Tiered Framework
// Simplified to only handle single-choice polls
{polls.map((poll, pollIndex) => {
  // All Tiered Framework polls are single-choice polls
  return (
    <PollWithResults
      key={pollIndex}
      pollIndex={pollIndex}
      question={poll.question}
      options={poll.options}
      pagePath="/survey-results/tiered-framework"
      questionNumber={poll.questionNumber}
      onVote={(pollIndex, optionIndex) => {
        console.log(`Vote submitted for poll ${pollIndex}, option ${optionIndex}`);
      }}
    />
  );
})}
```

**Prevention Protocol**:
- ✅ **Only check for poll types that actually exist** in each component
- ✅ **Remove unused imports** and interface properties
- ✅ **Test TypeScript builds** after component changes
- ✅ **Simplify component logic** when only one poll type is used

### **Admin Panel Filtering Logic Inconsistency (January 2025)**
**Problem**: Left panel vote counts for ranking and wordcloud polls show combined totals regardless of filter selection
**Symptoms**: 
- Left panel shows 948, 947, 945 responses even when "SSTAC & TWG" filter is selected
- Main page correctly shows filtered counts (e.g., 2 responses)
- Issue affects ranking polls (Q3, Q4) and wordcloud polls (Q5) in Prioritization group
**Root Cause**: 
- Left panel used `(poll.combined_survey_votes || 0) + (poll.combined_cew_votes || 0)` for ranking/wordcloud polls
- `getFilteredPollResults` function didn't handle wordcloud polls properly
- Wordcloud polls have empty `results` array and use `combined_survey_votes`/`combined_cew_votes` fields
**Debugging Steps**:
1. Check left panel vote count calculation logic
2. Verify `getFilteredPollResults` function handles all poll types
3. Test filtering with different poll types (single-choice, ranking, wordcloud)
4. Ensure consistent data flow between main page and left panel
**Solution Applied**:
```typescript
// Updated left panel to use filtered results for all poll types
const totalVotes = getFilteredPollResults(poll).reduce((sum, r) => sum + r.votes, 0);

// Added wordcloud-specific logic to getFilteredPollResults
if (poll.is_wordcloud) {
  const surveyVotes = poll.combined_survey_votes || 0;
  const cewVotes = poll.combined_cew_votes || 0;
  
  if (filterMode === 'twg') {
    return surveyVotes > 0 ? [{ option_index: 0, option_text: 'Survey Responses', votes: surveyVotes }] : [];
  } else if (filterMode === 'cew') {
    return cewVotes > 0 ? [{ option_index: 0, option_text: 'CEW Responses', votes: cewVotes }] : [];
  } else if (filterMode === 'all') {
    const totalVotes = surveyVotes + cewVotes;
    return totalVotes > 0 ? [{ option_index: 0, option_text: 'All Responses', votes: totalVotes }] : [];
  }
  return [];
}
```
**Prevention Protocol**:
- ✅ **Test filtering functionality across all poll types** (single-choice, ranking, wordcloud)
- ✅ **Ensure consistent data flow** between main page and left panel
- ✅ **Use filtered results** for all vote count calculations
- ✅ **Handle special cases** like wordcloud polls with empty results arrays

### **Question 13 Wordcloud Configuration Fix (RESOLVED)**
**Problem**: Question 13 wordcloud was allowing 3 words instead of single-choice behavior
**Error**: Users could submit multiple words when only one option should be allowed
**Impact**: Incorrect wordcloud behavior for single-choice question
**Root Cause**: Question 13 configured with `maxWords: 3` instead of `maxWords: 1`

**Solution Applied**:
```typescript
// Fixed Question 13 configuration in both CEW and survey-results pages
{
  question: "Overall, what is the greatest barrier to advancing holistic sediment protection in BC?",
  questionNumber: 13,
  isWordcloud: true,
  maxWords: 1, // Changed from 3 to 1 for single-choice behavior
  wordLimit: 20,
  predefinedOptions: [
    { display: "Data availability", keyword: "Data" },
    { display: "Tools (models, test protocols, decision trees)", keyword: "Tools" },
    { display: "Agreement on protection goals and spatial scale", keyword: "Policy" },
    { display: "Resourcing (e.g., developing approach/tools, agreeing across peers)", keyword: "Resourcing" }
  ]
}
```

**Prevention Protocol**:
- ✅ **Verify question requirements** before setting maxWords configuration
- ✅ **Update both CEW and survey-results pages** simultaneously
- ✅ **Test wordcloud behavior** after configuration changes
- ✅ **Document question-specific configurations** in markdown files

---

## 🚨 **NEW DEBUGGING SCENARIOS (January 2025)**

### **Scenario 11: K6 Test User ID Mismatch Issue**
**Problem**: K6 test submitted 12,018 votes but all used same user_id (`CEW2025_default`), making vote pairing impossible for matrix graphs
**Symptoms**:
- K6 test reported 66.89% success rate (12,018 successful votes)
- Matrix graphs showed only 5-8 manual test data points instead of expected 100+
- All k6 votes appeared with same user_id in database
**Root Cause**: API ignored k6's `user_id` in JSON payload and generated its own from `x-session-id` header. K6 test didn't send `x-session-id` header, resulting in default `sessionId = 'default'`
**Debugging Steps**:
1. Check database vote distribution: `SELECT user_id, COUNT(*) FROM poll_votes GROUP BY user_id`
2. Verify API user_id generation logic in `/api/polls/submit/route.ts`
3. Check k6 test headers: Look for `x-session-id` header in vote submissions
4. Test API behavior: Send vote with/without `x-session-id` header
**Solution**: Added `x-session-id` header to K6 test: `headers: { 'x-session-id': sessionId }`
**Prevention**: Always send `x-session-id` header for CEW poll API calls to ensure consistent user_id generation

### **Scenario 12: Matrix Graph Logic Confirmation**
**Problem**: User reported "15 paired responses" but only "8 individual data points" displayed, suspecting algorithm bug
**Symptoms**:
- Left panel showed 15 total votes per question
- Matrix graph showed only 8 individual data points
- User expected all 15 votes to appear as dots
**Root Cause**: Matrix graph logic was working correctly - shows unique users with paired votes, not total votes per question
**Debugging Steps**:
1. Verify matrix graph pairing logic in API
2. Check database for users who voted on both questions in pair
3. Confirm vote pairing algorithm behavior
4. Test with known data sets
**Solution**: Confirmed correct behavior: Left panel shows total votes (15), matrix graph shows unique users with paired votes (8)
**Prevention**: Understand that matrix graphs require same user_id for both importance AND feasibility questions for pairing

### **Scenario 13: Matrix Graph Overlapping Data Points**
**Problem**: Multiple users submitting identical (x,y) coordinates appeared as single dots, obscuring data density
**Symptoms**:
- 15 users rated something as "Very Important" (1) and "Very Feasible" (1)
- All 15 points appeared as single blue dot
- Users couldn't tell if there was 1 response or 15 responses at that location
**Root Cause**: No visualization system for handling overlapping data points in matrix graphs
**Debugging Steps**:
1. Identify overlapping coordinates in matrix graph data
2. Test with high-density voting scenarios
3. Analyze user feedback about data visibility
4. Research data visualization best practices
**Solution**: Implemented 4-mode visualization system:
- **Jittered Mode**: Spreads overlapping points in small circular radius
- **Size-Scaled Mode**: Larger dots represent more overlapping points (6px → 12px radius)
- **Heatmap Mode**: Color intensity indicates number of overlapping points
- **Concentric Mode**: Multiple rings around center point for clustering indication
**Prevention**: Always consider data density visualization when multiple users can have identical coordinates

### **Scenario 14: Admin Panel Vote Bar Color Issues**
**Problem**: Dark grey vote bars were harsh and hard to read in admin panel
**Symptoms**:
- Vote bars appeared too dark and had poor contrast
- Hard to distinguish between different vote counts
- Poor readability in both light and dark modes
**Root Cause**: Vote bars used dark grey background (`dark:bg-gray-700`) which was too harsh
**Solution**: Updated all vote bars to use light grey (`dark:bg-gray-300`) for better contrast
**Prevention**: Test color contrast in both light and dark modes for accessibility

### **Scenario 15: Prioritization Questions Options Display**
**Problem**: Prioritization questions (1-2) only showed options with votes, unlike holistic questions (1-8) which showed all 5 options
**Symptoms**:
- Holistic Protection questions displayed all 5 options consistently
- Prioritization questions only showed options that received votes
- Inconsistent display behavior between poll groups
**Root Cause**: Missing logic to ensure all 5 options always display in order for prioritization questions
**Solution**: Added logic to detect prioritization questions via `page_path.includes('prioritization')` and create complete option set (0-4) with 0 votes for missing options
**Prevention**: Ensure consistent option display logic across all poll types

---

**Remember**: The poll system is complex and requires careful debugging. Always verify data sources, test thoroughly, and document solutions for future reference.
