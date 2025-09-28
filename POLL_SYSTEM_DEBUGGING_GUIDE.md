# 🐛 Poll System Debugging Guide

## Overview
This guide documents critical debugging issues encountered with the admin poll results system and provides solutions to prevent future problems.

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

**Remember**: The poll system is complex and requires careful debugging. Always verify data sources, test thoroughly, and document solutions for future reference.
