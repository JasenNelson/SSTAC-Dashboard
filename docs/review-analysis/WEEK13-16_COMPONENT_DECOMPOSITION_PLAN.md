# Weeks 13-16: Component Decomposition Planning - Phase 4

**Status:** 📋 **PLANNING IN PROGRESS**  
**Date Started:** 2025-11-02  
**Risk Level:** 🟢 **ZERO RISK** - Documentation and planning only  
**Approach:** Analysis and design, NO CODE CHANGES

---

## 📋 Overview

Phase 4 focuses on documenting and planning future refactoring work without executing any changes. This ensures we have a clear, battle-tested plan before touching any production code during a deployment window.

---

## 🎯 Goals

1. **Document** current component structure
2. **Identify** decomposition opportunities
3. **Design** service layer interfaces
4. **Plan** refactoring strategy
5. **Create** integration test requirements
6. **Prepare** but **NOT EXECUTE** refactoring

---

## 📊 Component Analysis

### **1. PollResultsClient.tsx - Current State**

**Statistics:**
- **Lines of Code:** 2,079
- **Component Type:** Client-side React component with heavy data management
- **Dependencies:** React, Supabase, 3 custom components (QRCode, WordCloud, MatrixGraph)
- **State Variables:** 15 useState hooks
- **Side Effects:** 2 useEffect hooks
- **Complexity:** Very High

**Key Functional Areas Identified:**

1. **Data Fetching Layer** (~200 lines)
   - `fetchPollResults()` - Fetches all poll data types
   - `fetchMatrixData()` - Fetches prioritization matrix data
   - Error handling for multiple Supabase queries
   - Data transformation and normalization

2. **Filtering & Grouping Logic** (~300 lines)
   - `filteredPolls` useMemo - Filters based on mode (all/twg/cew)
   - `getFilteredPollResults()` - Filters individual poll results
   - `groupPollsByTheme()` - Groups polls by thematic area
   - Complex nested filtering logic

3. **State Management** (~100 lines)
   - 15 useState hooks managing:
     - Poll results data
     - Loading/error states
     - UI state (expanded polls, panels, QR codes)
     - Filter modes
     - Matrix graphs visibility

4. **Navigation Logic** (~150 lines)
   - `navigateToNextQuestion()` - Moves between questions
   - `navigateToPreviousQuestion()` - Backward navigation
   - `scrollToSection()` - UI scrolling logic
   - Poll grouping and indexing

5. **Data Presentation Logic** (~600 lines)
   - Complex rendering of different poll types
   - Word cloud results display
   - Matrix graph rendering
   - Chart data transformation
   - Conditional rendering based on poll type

6. **UI Logic** (~500 lines)
   - Panel visibility toggles
   - Expand/collapse functionality
   - QR code display management
   - Responsive UI state management
   - Modal and popup handling

7. **Data Transformation** (~200 lines)
   - `getPercentage()` - Vote percentage calculations
   - Results aggregation logic
   - Combining survey and CEW data
   - Data normalization for charts

8. **Configuration & Constants** (~100 lines)
   - Current poll questions definition
   - Page title mappings
   - Poll group classifications
   - Theme groupings

---

### **2. WordCloudPoll.tsx - Current State**

**Statistics:**
- **Lines of Code:** 727
- **Component Type:** Client-side React component for word cloud submissions
- **Dependencies:** React, CustomWordCloud component
- **State Variables:** 12 useState hooks
- **Side Effects:** 2 useEffect hooks, 1 useCallback
- **Complexity:** High
- **Critical:** Used by CEW polls (active conference feature)

**Key Functional Areas Identified:**

1. **Submission Logic** (~150 lines)
   - `handleSubmitWords()` - Submit word cloud responses
   - `checkCEWWordStatus()` - Verify CEW user status
   - Vote counting and validation
   - Multiple vote handling for CEW

2. **Results Management** (~100 lines)
   - `fetchResults()` - Fetch aggregated results
   - `handleViewResults()` - Toggle results view
   - Aggregated results display
   - Results refresh logic

3. **Word Selection** (~150 lines)
   - `handlePredefinedToggle()` - Toggle predefined words
   - `handleCustomWordsChange()` - Handle custom input
   - `getAllSelectedWords()` - Combine selections
   - Word validation and limits

4. **UI State Management** (~100 lines)
   - Multiple visibility states
   - Loading states
   - Error handling
   - Form state management

5. **Word Cloud Rendering** (~100 lines)
   - `SafeWordCloud` wrapper component
   - Error boundary implementation
   - CustomWordCloud integration
   - Empty state handling

6. **Change/Cancel Logic** (~50 lines)
   - `handleChangeWords()` - Allow vote changes
   - `handleCancelChange()` - Cancel changes
   - Vote update handling

---

### **3. Critical Dependencies Analysis**

**Both components depend on:**
- ✅ `CustomWordCloud` component
- ✅ Supabase client (PollResultsClient only)
- ✅ Multiple error boundaries
- ✅ Complex state management

**Unique concerns:**
- ⚠️ WordCloudPoll: Active CEW functionality (high visibility)
- ⚠️ PollResultsClient: Admin dashboard (lower risk, more maintainable)

---

## 🏗️ Proposed Component Decomposition

### **Strategy: Service Layer + Smaller Components**

#### **Phase A: Extract Service Layer** ⚠️ LOW RISK

**Create:** `src/lib/services/poll-results.service.ts`

**Responsibilities:**
```typescript
class PollResultsService {
  // Data fetching
  fetchAllPollResults(): Promise<PollResult[]>
  fetchMatrixData(filterMode: string): Promise<MatrixData[]>
  
  // Data transformation
  transformPollData(rawData: any[]): PollResult[]
  combineSurveyAndCEW(results: PollResult[]): PollResult[]
  
  // Filtering
  filterPolls(polls: PollResult[], mode: 'all' | 'twg' | 'cew'): PollResult[]
  filterPollResults(poll: PollResult, mode: string): any
  
  // Grouping
  groupPollsByTheme(polls: PollResult[]): GroupedPolls
  getPollGroup(pagePath: string): PollGroup
  
  // Calculations
  calculatePercentage(votes: number, total: number): number
  aggregateResults(data: any[]): any
  
  // Configuration
  getCurrentPollQuestions(): string[]
  getPageTitle(pagePath: string): string
}
```

**Benefits:**
- ✅ Business logic separated from UI
- ✅ Reusable across components
- ✅ Easier to test
- ✅ Clearer separation of concerns

---

#### **Phase B: Extract Sub-Components** ⚠️ MEDIUM RISK

**1. PollResultsFilters.tsx** (~150 lines)
```typescript
interface PollResultsFiltersProps {
  filterMode: 'all' | 'twg' | 'cew'
  onFilterChange: (mode: string) => void
  leftPanelVisible: boolean
  onTogglePanel: () => void
  onRefresh: () => void
  lastRefresh: Date
}
```

**Responsibilities:**
- Filter mode selection
- Panel visibility controls
- Refresh button
- Last refresh timestamp display

---

**2. PollResultsList.tsx** (~300 lines)
```typescript
interface PollResultsListProps {
  polls: PollResult[]
  onPollClick: (pollId: string) => void
  expandedPoll: string | null
  onExpand: (pollId: string) => void
}
```

**Responsibilities:**
- Poll list rendering
- Expand/collapse functionality
- Group headings
- Empty state display

---

**3. PollResultDetail.tsx** (~400 lines)
```typescript
interface PollResultDetailProps {
  poll: PollResult
  onClose: () => void
  onNext: () => void
  onPrevious: () => void
  showMatrixGraph: boolean
  onToggleMatrix: () => void
}
```

**Responsibilities:**
- Individual poll result display
- Chart rendering based on poll type
- Navigation controls
- Matrix graph toggle

---

**4. SingleChoiceResults.tsx** (~200 lines)
```typescript
interface SingleChoiceResultsProps {
  results: Array<{ option_index: number, votes: number, option_text: string }>
  totalVotes: number
  onNavigate?: () => void
}
```

**Responsibilities:**
- Single-choice poll chart rendering
- Vote count display
- Percentage calculations
- Chart legend

---

**5. RankingResults.tsx** (~250 lines)
```typescript
interface RankingResultsProps {
  results: Array<{ option_index: number, votes: number, averageRank: number, option_text: string }>
  totalVotes: number
}
```

**Responsibilities:**
- Ranking poll chart rendering
- Average rank display
- Heat map visualization
- Rank distribution

---

**6. WordCloudResults.tsx** (~150 lines)
```typescript
interface WordCloudResultsProps {
  words: Array<{ text: string, value: number }>
  totalVotes: number
}
```

**Responsibilities:**
- Word cloud rendering (wraps CustomWordCloud)
- Word frequency display
- Error boundary for word cloud

---

**7. MatrixGraphSection.tsx** (~200 lines)
```typescript
interface MatrixGraphSectionProps {
  matrixData: MatrixData[]
  showGraphs: { [key: string]: boolean }
  onToggleGraph: (key: string) => void
  filterMode: string
}
```

**Responsibilities:**
- Matrix graph section rendering
- Toggle matrix graphs
- Multiple graph display
- Graph legend and controls

---

#### **Phase C: Extract Hooks** ⚠️ LOW RISK

**1. usePollResults.ts**
```typescript
export function usePollResults() {
  const [pollResults, setPollResults] = useState<PollResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const fetchPollResults = async () => { /* ... */ };
  
  return { pollResults, loading, error, fetchPollResults };
}
```

**2. useMatrixData.ts**
```typescript
export function useMatrixData(filterMode: string) {
  const [matrixData, setMatrixData] = useState<MatrixData[]>([]);
  
  useEffect(() => {
    // Fetch matrix data
  }, [filterMode]);
  
  return matrixData;
}
```

**3. usePollNavigation.ts**
```typescript
export function usePollNavigation(
  polls: PollResult[],
  currentPoll: PollResult | null
) {
  const navigateNext = () => { /* ... */ };
  const navigatePrevious = () => { /* ... */ };
  const getCurrentIndex = () => { /* ... */ };
  
  return { navigateNext, navigatePrevious, getCurrentIndex };
}
```

---

## 🔧 Service Layer Design

### **Poll Results Service**

```typescript
// src/lib/services/poll-results.service.ts

interface PollResultsService {
  // Core data operations
  fetchAllPollResults(): Promise<PollResult[]>
  fetchMatrixData(filterMode: 'all' | 'twg' | 'cew'): Promise<MatrixData[]>
  
  // Data transformation
  transformRawPollData(rawData: any[]): PollResult[]
  normalizePollResults(results: PollResult[]): PollResult[]
  
  // Query operations
  filterPolls(polls: PollResult[], mode: 'all' | 'twg' | 'cew'): PollResult[]
  groupPollsByTheme(polls: PollResult[]): GroupedPolls
  
  // Business logic
  calculateVotePercentages(results: any[]): any[]
  aggregateResults(results: any[]): AggregatedResults
  combineSurveyAndCEW(surveyResults: any[], cewResults: any[]): any[]
  
  // Configuration
  getPageTitle(pagePath: string): string
  getPollGroup(pagePath: string): PollGroup | null
  isCurrentPoll(question: string): boolean
}

class PollResultsServiceImpl implements PollResultsService {
  private supabase: SupabaseClient
  
  constructor(supabase: SupabaseClient) {
    this.supabase = supabase
  }
  
  async fetchAllPollResults(): Promise<PollResult[]> {
    const [singleChoiceResult, rankingResult, wordcloudResult] = await Promise.all([
      this.supabase.from('poll_results').select('*').order('page_path', { ascending: true }).order('poll_index', { ascending: true }),
      this.supabase.from('ranking_results').select('*').order('page_path', { ascending: true }).order('poll_index', { ascending: true }),
      this.supabase.from('wordcloud_results').select('*').order('page_path', { ascending: true }).order('poll_index', { ascending: true })
    ])
    
    return this.transformRawPollData([
      ...(singleChoiceResult.data || []),
      ...(rankingResult.data || []),
      ...(wordcloudResult.data || [])
    ])
  }
  
  // ... other implementations
}

export const createPollResultsService = (supabase: SupabaseClient): PollResultsService => {
  return new PollResultsServiceImpl(supabase)
}
```

---

## 🧪 Integration Test Requirements

### **Critical Flows to Test**

1. **Poll Results Fetching**
   - ✅ Fetch all poll types successfully
   - ✅ Handle missing data gracefully
   - ✅ Transform data correctly
   - ✅ Error handling works

2. **Filtering & Grouping**
   - ✅ Filter by mode (all/twg/cew)
   - ✅ Group polls by theme correctly
   - ✅ Maintain poll order
   - ✅ Handle empty states

3. **Navigation**
   - ✅ Navigate between questions
   - ✅ Maintain context between navigations
   - ✅ Handle edge cases (first/last poll)

4. **Data Presentation**
   - ✅ Render all poll types correctly
   - ✅ Display charts accurately
   - ✅ Calculate percentages correctly
   - ✅ Show word clouds properly

5. **Matrix Graphs**
   - ✅ Toggle matrix graphs correctly
   - ✅ Filter matrix data properly
   - ✅ Display multiple graphs
   - ✅ Handle missing data

6. **UI Interactions**
   - ✅ Expand/collapse polls
   - ✅ Toggle panels
   - ✅ Display QR codes
   - ✅ Handle refresh

---

## 📅 Implementation Timeline (NOT EXECUTED YET)

### **Week 13-14: Planning & Design** ✅ CURRENT PHASE
- ✅ Document component structure
- ✅ Design service layer interfaces
- ✅ Identify decomposition boundaries
- ✅ Create refactoring plan
- ⏸️ **NO CODE CHANGES**

### **Week 15-16: Test Infrastructure** ⏸️ NOT STARTED
- ⏸️ Write integration tests
- ⏸️ Create component test utilities
- ⏸️ Setup test fixtures
- ⏸️ **NO PRODUCTION CODE CHANGES**

### **Future Deployment Window: Refactoring** ⏸️ DEFERRED
- ⏸️ Extract service layer
- ⏸️ Split into sub-components
- ⏸️ Extract custom hooks
- ⏸️ Update tests
- ⏸️ Deploy during low-traffic window

---

## ⚠️ Risk Assessment & Mitigation

### **Phase A: Service Layer Extraction**
- **Risk:** 🟡 LOW
- **Mitigation:**
  - Extract gradually, one method at a time
  - Maintain backward compatibility
  - Test thoroughly after each extraction
  - Keep old code until verified

### **Phase B: Component Splitting**
- **Risk:** 🟡 MEDIUM
- **Mitigation:**
  - Extract leaf components first
  - Test each component in isolation
  - Use storybook for visual testing
  - Maintain integration tests

### **Phase C: Hook Extraction**
- **Risk:** 🟢 LOW
- **Mitigation:**
  - Extract one hook at a time
  - Test hooks with React Testing Library
  - Verify no state management bugs
  - Monitor for performance regressions

---

## ✅ Definition of Done

**For Planning Phase:**
- ✅ Component structure documented
- ✅ Decomposition plan created
- ✅ Service layer designed
- ✅ Test requirements defined
- ✅ Risk assessment complete
- ✅ Timeline created

**For Future Implementation:**
- ⏸️ All unit tests passing
- ⏸️ Integration tests passing
- ⏸️ No performance regressions
- ⏸️ Visual regression tests passing
- ⏸️ Deployed to staging
- ⏸️ Performance monitored
- ⏸️ Ready for production

---

## 📚 Next Steps

1. **Complete Planning** (Current)
   - Finish documenting PollResultsClient
   - Design remaining interfaces
   - Create detailed test plans

2. **Write Integration Tests** (Week 15-16)
   - Test critical flows
   - Create test utilities
   - Setup fixtures

3. **Schedule Implementation** (Future)
   - Choose low-traffic window
   - Get stakeholder approval
   - Communicate to team
   - Execute refactoring

---

**Status:** Planning in progress, NO production code changes made or planned during this phase.  
**Last Updated:** 2025-11-02  
**Next Review:** After planning complete

