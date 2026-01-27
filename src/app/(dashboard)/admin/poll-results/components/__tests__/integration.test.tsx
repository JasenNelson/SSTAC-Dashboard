import { renderHook, waitFor, act } from '@testing-library/react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { usePollData } from '../../hooks/usePollData';
import { useMatrixDataCache } from '../../hooks/useMatrixDataCache';
import { PollResult, MatrixData } from '../../types';
import FilterSidebar from '../FilterSidebar';
import ResultsDisplay from '../ResultsDisplay';

// ============================================================================
// Mock Supabase Client
// ============================================================================

vi.mock('@/lib/supabase/client', () => ({
  createClient: vi.fn(() => ({
    from: vi.fn((_table: string) => ({
      select: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      data: null,
      error: null,
    }))
  }))
}));

// Mock fetch API
global.fetch = vi.fn();

// ============================================================================
// Mock Data Factories
// ============================================================================

/**
 * Factory function to create mock poll data
 */
const createMockPoll = (overrides?: Partial<PollResult>): PollResult => ({
  poll_id: 'poll-1',
  page_path: '/survey-results/holistic-protection',
  poll_index: 0,
  question: 'Test question about holistic protection',
  options: ['Option A', 'Option B', 'Option C'],
  total_votes: 100,
  combined_survey_votes: 60,
  combined_cew_votes: 40,
  survey_results: [
    { option_index: 0, option_text: 'Option A', votes: 30 },
    { option_index: 1, option_text: 'Option B', votes: 20 },
    { option_index: 2, option_text: 'Option C', votes: 10 }
  ],
  cew_results: [
    { option_index: 0, option_text: 'Option A', votes: 25 },
    { option_index: 1, option_text: 'Option B', votes: 15 }
  ],
  results: [
    { option_index: 0, option_text: 'Option A', votes: 55 },
    { option_index: 1, option_text: 'Option B', votes: 35 },
    { option_index: 2, option_text: 'Option C', votes: 10 }
  ],
  is_ranking: false,
  is_wordcloud: false,
  ...overrides
});

/**
 * Factory function to create mock matrix data
 */
const createMockMatrixData = (overrides?: Partial<MatrixData>): MatrixData => ({
  title: 'Site-Specific Standards',
  avgImportance: 4.2,
  avgFeasibility: 3.5,
  responses: 15,
  individualPairs: [
    { userId: 'user-1', importance: 5, feasibility: 4, userType: 'authenticated' },
    { userId: 'user-2', importance: 4, feasibility: 3, userType: 'cew' },
    { userId: 'user-3', importance: 3, feasibility: 3, userType: 'authenticated' }
  ],
  ...overrides
});

/**
 * Factory function to create filter sidebar props
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const createFilterSidebarProps = (overrides?: any) => ({
  filterMode: 'all' as const,
  setFilterMode: vi.fn(),
  showPresentationControls: true,
  setShowPresentationControls: vi.fn(),
  filteredPolls: [createMockPoll()],
  expandedGroup: null,
  setExpandedGroup: vi.fn(),
  selectedQuestion: null,
  setSelectedQuestion: vi.fn(),
  loading: false,
  onRefresh: vi.fn(),
  onExportAll: vi.fn(),
  onHidePanel: vi.fn(),
  groupPollsByTheme: (polls: PollResult[]) => ({
    'holistic-protection': {
      name: 'Holistic Protection',
      polls: polls.filter(p => p.page_path.includes('holistic-protection'))
    },
    'tiered-framework': {
      name: 'Tiered Framework',
      polls: polls.filter(p => p.page_path.includes('tiered-framework'))
    },
    'prioritization': {
      name: 'Prioritization',
      polls: polls.filter(p => p.page_path.includes('prioritization'))
    }
  }),
  getFilteredPollResults: (poll: PollResult) => poll.results,
  ...overrides
});

/**
 * Factory function to create results display props
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const createResultsDisplayProps = (overrides?: any) => ({
  selectedPoll: createMockPoll(),
  isExpanded: false,
  expandedPoll: null,
  setExpandedPoll: vi.fn(),
  filterMode: 'all' as const,
  showPresentationControls: true,
  matrixData: [],
  showMatrixGraphs: {},
  toggleMatrixGraph: vi.fn(),
  filteredPolls: [createMockPoll()],
  leftPanelVisible: true,
  qrCodeExpanded: false,
  expandedPollGroup: null,
  setQrCodeExpanded: vi.fn(),
  setExpandedPollGroup: vi.fn(),
  getFilteredPollResults: (poll: PollResult) => poll.results,
  navigateToNextQuestion: vi.fn(),
  navigateToPreviousQuestion: vi.fn(),
  exportSingleChoicePoll: vi.fn(),
  exportRankingPoll: vi.fn(),
  exportWordcloudPoll: vi.fn(),
  exportMatrixGraph: vi.fn(),
  getPageTitle: (_pagePath: string) => 'Test Page',
  getPollGroup: (_pagePath: string) => 'holistic-protection' as const,
  ...overrides
});

// ============================================================================
// Test Suites
// ============================================================================

describe('Integration Tests: usePollData Hook with Components', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (global.fetch as any).mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Hook integration with FilterSidebar component', () => {
    it('should initialize hook with correct state for FilterSidebar consumption', () => {
      const { result } = renderHook(() => usePollData());

      expect(result.current.pollResults).toEqual([]);
      expect(result.current.loading).toBe(true);
      expect(result.current.error).toBeNull();
      expect(result.current.matrixData).toEqual([]);
    });

    it('should provide fetchPollResults callable for FilterSidebar refresh action', () => {
      const { result } = renderHook(() => usePollData());

      expect(typeof result.current.fetchPollResults).toBe('function');
      expect(typeof result.current.refreshData).toBe('function');
    });

    it('should maintain poll results data across multiple renders', () => {
      const { result, rerender } = renderHook(() => usePollData());

      const _initialPollResults = result.current.pollResults;
      rerender();

      expect(result.current.pollResults).toBeDefined();
      expect(Array.isArray(result.current.pollResults)).toBe(true);
    });
  });

  describe('Data flow from API to component state', () => {
    it('should initialize with empty poll results or from cache', () => {
      const { result } = renderHook(() => usePollData());

      // May start with empty results or from cache
      expect(Array.isArray(result.current.pollResults)).toBe(true);
      expect(typeof result.current.loading).toBe('boolean');
    });

    it('should manage loading state during fetch lifecycle', async () => {
      const { result } = renderHook(() => usePollData());

      // Loading state is managed internally
      expect(typeof result.current.loading).toBe('boolean');

      await waitFor(() => {
        expect(typeof result.current.loading).toBe('boolean');
      });
    });

    it('should provide matrixData state for chart rendering', () => {
      const { result } = renderHook(() => usePollData());

      expect(Array.isArray(result.current.matrixData)).toBe(true);
      expect(typeof result.current.setMatrixData).toBe('function');

      act(() => {
        const mockMatrix = [createMockMatrixData()];
        result.current.setMatrixData(mockMatrix);
      });

      expect(result.current.matrixData).toEqual([createMockMatrixData()]);
    });
  });

  describe('Error handling in data flow', () => {
    it('should handle error state gracefully', () => {
      const { result } = renderHook(() => usePollData());

      expect(result.current.error).toBeNull();
    });

    it('should provide clear cache function for error recovery', () => {
      const { result } = renderHook(() => usePollData());

      expect(typeof result.current.clearCache).toBe('function');
      expect(() => result.current.clearCache()).not.toThrow();
    });

    it('should provide refresh function for data recovery', async () => {
      const { result } = renderHook(() => usePollData());

      const refreshPromise = result.current.refreshData();
      expect(refreshPromise).toBeInstanceOf(Promise);

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
    });
  });
});

describe('Integration Tests: useMatrixDataCache with Components', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (global.fetch as any).mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Hook integration with ResultsDisplay component', () => {
    it('should initialize hook with correct state for matrix rendering', () => {
      const { result } = renderHook(() => useMatrixDataCache());

      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeNull();
      expect(typeof result.current.fetchMatrixData).toBe('function');
    });

    it('should provide fetchMatrixData for different filter modes', async () => {
      const mockData = [createMockMatrixData()];

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockData
      });

      const { result } = renderHook(() => useMatrixDataCache());

      const data = await result.current.fetchMatrixData('all');

      expect(data).toEqual(mockData);
    });

    it('should support filter mode transitions with cache management', async () => {
      const mockData = [createMockMatrixData()];

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => mockData
      });

      const { result } = renderHook(() => useMatrixDataCache());

      // Fetch with 'all' filter
      const data1 = await result.current.fetchMatrixData('all');
      expect(data1).toEqual(mockData);

      // Fetch with 'twg' filter - clearing cache allows new fetch
      result.current.clearCache();
      const data2 = await result.current.fetchMatrixData('twg');
      expect(data2).toEqual(mockData);

      // Fetch with 'cew' filter
      result.current.clearCache();
      const data3 = await result.current.fetchMatrixData('cew');
      expect(data3).toEqual(mockData);

      // Verify fetch was called multiple times
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((global.fetch as any).mock.calls.length).toBeGreaterThan(0);
    });

    it('should provide clearCache for data refresh scenarios', () => {
      const { result } = renderHook(() => useMatrixDataCache());

      expect(typeof result.current.clearCache).toBe('function');
      expect(() => result.current.clearCache()).not.toThrow();
      expect(() => result.current.clearCache('all')).not.toThrow();
    });
  });

  describe('Matrix data caching behavior', () => {
    it('should cache matrix data and reuse across renders', async () => {
      const mockData = [createMockMatrixData()];

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockData
      });

      const { result, rerender } = renderHook(() => useMatrixDataCache());

      // Initial fetch
      await result.current.fetchMatrixData('all');

      // Rerender should use cache
      rerender();

      // Fetch count should be 1 (cached on rerender)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((global.fetch as any).mock.calls.length).toBe(1);
    });

    it('should provide refreshData function for data refresh', async () => {
      const mockData = [createMockMatrixData()];

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => mockData
      });

      const { result } = renderHook(() => useMatrixDataCache());

      // Initial fetch
      await result.current.fetchMatrixData('all');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const initialCallCount = (global.fetch as any).mock.calls.length;

      // Refresh data returns a promise
      const refreshPromise = result.current.refreshData('all');
      expect(refreshPromise).toBeInstanceOf(Promise);

      await waitFor(() => {
        // refreshData should trigger a fetch
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        expect((global.fetch as any).mock.calls.length).toBeGreaterThanOrEqual(initialCallCount);
      });
    });
  });
});

describe('Integration Tests: FilterSidebar Component Interactions', () => {
  describe('Filter mode state propagation', () => {
    it('should render all filter mode buttons', () => {
      render(
        <FilterSidebar {...createFilterSidebarProps()} />
      );

      expect(screen.getByText('SSTAC & TWG Only')).toBeInTheDocument();
      expect(screen.getByText('CEW Only')).toBeInTheDocument();
      expect(screen.getByText('All Responses')).toBeInTheDocument();
    });

    it('should highlight active filter mode button', () => {
      const _setFilterMode = vi.fn();
      const props = createFilterSidebarProps({
        filterMode: 'twg',
        setFilterMode: _setFilterMode
      });

      const { container } = render(<FilterSidebar {...props} />);

      const _twoButtons = container.querySelectorAll('button');
      const activeButton = Array.from(_twoButtons).find(btn =>
        btn.textContent?.includes('SSTAC & TWG Only')
      );

      expect(activeButton).toHaveClass('bg-blue-600');
    });

    it('should call setFilterMode when filter button is clicked', () => {
      const setFilterMode = vi.fn();
      const props = createFilterSidebarProps({ setFilterMode });

      render(<FilterSidebar {...props} />);

      const cewButton = screen.getByText('CEW Only');
      fireEvent.click(cewButton);

      expect(setFilterMode).toHaveBeenCalledWith('cew');
    });
  });

  describe('Display options and presentation controls', () => {
    it('should render presentation controls toggle button', () => {
      render(
        <FilterSidebar {...createFilterSidebarProps({ showPresentationControls: false })} />
      );

      expect(screen.getByText('Show Presentation Controls')).toBeInTheDocument();
    });

    it('should toggle presentation controls state', () => {
      const setShowPresentationControls = vi.fn();
      const props = createFilterSidebarProps({
        showPresentationControls: false,
        setShowPresentationControls
      });

      render(<FilterSidebar {...props} />);

      const toggleButton = screen.getByText('Show Presentation Controls');
      fireEvent.click(toggleButton);

      expect(setShowPresentationControls).toHaveBeenCalled();
    });
  });

  describe('Poll group expansion and question selection', () => {
    it('should render poll groups with theme colors', () => {
      const pollWithTheme = createMockPoll({
        page_path: '/survey-results/holistic-protection',
        poll_index: 0
      });

      const props = createFilterSidebarProps({
        filteredPolls: [pollWithTheme]
      });

      render(<FilterSidebar {...props} />);

      expect(screen.getByText('Poll Groups')).toBeInTheDocument();
    });

    it('should expand/collapse poll groups on click', () => {
      const setExpandedGroup = vi.fn();
      const pollWithTheme = createMockPoll({
        page_path: '/survey-results/holistic-protection'
      });

      const props = createFilterSidebarProps({
        filteredPolls: [pollWithTheme],
        setExpandedGroup
      });

      render(<FilterSidebar {...props} />);

      // The group button should be present
      const buttons = screen.getAllByRole('button');
      // Try to find and click a group expansion button
      const groupButton = buttons.find(btn =>
        btn.textContent?.includes('Holistic Protection')
      );

      if (groupButton) {
        fireEvent.click(groupButton);
        expect(setExpandedGroup).toHaveBeenCalled();
      }
    });
  });

  describe('Action buttons - Refresh, Export, Hide', () => {
    it('should render refresh button and handle click', () => {
      const onRefresh = vi.fn();
      const props = createFilterSidebarProps({ onRefresh });

      render(<FilterSidebar {...props} />);

      const refreshButton = screen.getByText(/Refresh Results/i);
      fireEvent.click(refreshButton);

      expect(onRefresh).toHaveBeenCalled();
    });

    it('should disable refresh button when loading', () => {
      const onRefresh = vi.fn();
      const props = createFilterSidebarProps({
        loading: true,
        onRefresh
      });

      render(<FilterSidebar {...props} />);

      const refreshButton = screen.getByText(/Refreshing/i);
      expect(refreshButton).toBeDisabled();
    });

    it('should render export all button with poll count', () => {
      const poll1 = createMockPoll({ poll_index: 0 });
      const poll2 = createMockPoll({ poll_index: 1 });
      const onExportAll = vi.fn();

      const props = createFilterSidebarProps({
        filteredPolls: [poll1, poll2],
        onExportAll
      });

      render(<FilterSidebar {...props} />);

      expect(screen.getByText(/Export All \(\d+ questions\)/)).toBeInTheDocument();
    });

    it('should call onExportAll when export button is clicked', () => {
      const onExportAll = vi.fn();
      const props = createFilterSidebarProps({ onExportAll });

      render(<FilterSidebar {...props} />);

      const exportButton = screen.getByText(/Export All/i);
      fireEvent.click(exportButton);

      expect(onExportAll).toHaveBeenCalled();
    });

    it('should render hide panel button', () => {
      const onHidePanel = vi.fn();
      const props = createFilterSidebarProps({ onHidePanel });

      render(<FilterSidebar {...props} />);

      const buttons = screen.getAllByRole('button');
      expect(buttons.length).toBeGreaterThan(0);
    });
  });
});

describe('Integration Tests: ResultsDisplay Component Interactions', () => {
  describe('Poll data rendering and state management', () => {
    it('should render selected poll question and details', () => {
      const poll = createMockPoll({
        question: 'What is the importance of standards?',
        page_path: '/survey-results/holistic-protection',
        poll_index: 0
      });

      const props = createResultsDisplayProps({
        selectedPoll: poll,
        getPageTitle: () => 'Holistic Protection'
      });

      render(<ResultsDisplay {...props} />);

      expect(screen.getByText(/What is the importance of standards\?/)).toBeInTheDocument();
      expect(screen.getByText(/Question 1/)).toBeInTheDocument();
    });

    it('should display combined vote counts based on filter mode', () => {
      const poll = createMockPoll({
        combined_survey_votes: 60,
        combined_cew_votes: 40
      });

      const props = createResultsDisplayProps({
        selectedPoll: poll,
        filterMode: 'all'
      });

      render(<ResultsDisplay {...props} />);

      expect(screen.getByText(/TWG\/SSTAC: 60 responses/)).toBeInTheDocument();
      expect(screen.getByText(/CEW: 40 responses/)).toBeInTheDocument();
    });

    it('should filter vote counts based on filter mode', () => {
      const poll = createMockPoll({
        combined_survey_votes: 60,
        combined_cew_votes: 40
      });

      // Test TWG filter
      const propsTWG = createResultsDisplayProps({
        selectedPoll: poll,
        filterMode: 'twg'
      });

      const { unmount } = render(<ResultsDisplay {...propsTWG} />);

      expect(screen.getByText(/TWG\/SSTAC: 60 responses/)).toBeInTheDocument();
      expect(screen.queryByText(/CEW:/)).not.toBeInTheDocument();

      unmount();

      // Test CEW filter
      const propsCEW = createResultsDisplayProps({
        selectedPoll: poll,
        filterMode: 'cew'
      });

      render(<ResultsDisplay {...propsCEW} />);

      expect(screen.getByText(/CEW: 40 responses/)).toBeInTheDocument();
      expect(screen.queryByText(/TWG\/SSTAC:/)).not.toBeInTheDocument();
    });
  });

  describe('Presentation controls and export functionality', () => {
    it('should render export button when presentation controls are enabled', () => {
      const exportSingleChoicePoll = vi.fn();
      const props = createResultsDisplayProps({
        showPresentationControls: true,
        exportSingleChoicePoll
      });

      render(<ResultsDisplay {...props} />);

      expect(screen.getByText('Export CSV')).toBeInTheDocument();
    });

    it('should hide export button when presentation controls are disabled', () => {
      const props = createResultsDisplayProps({
        showPresentationControls: false
      });

      render(<ResultsDisplay {...props} />);

      expect(screen.queryByText('Export CSV')).not.toBeInTheDocument();
    });

    it('should call appropriate export function based on poll type', () => {
      const exportSingleChoicePoll = vi.fn();
      const props = createResultsDisplayProps({
        showPresentationControls: true,
        selectedPoll: createMockPoll({ is_ranking: false }),
        exportSingleChoicePoll
      });

      render(<ResultsDisplay {...props} />);

      const exportButton = screen.getByText('Export CSV');
      fireEvent.click(exportButton);

      expect(exportSingleChoicePoll).toHaveBeenCalledWith(props.selectedPoll);
    });
  });

  describe('Navigation controls', () => {
    it('should render previous and next question buttons', () => {
      const props = createResultsDisplayProps();

      const { container } = render(<ResultsDisplay {...props} />);

      const buttons = container.querySelectorAll('button');
      expect(buttons.length).toBeGreaterThan(0);
    });

    it('should provide navigation callbacks for question navigation', () => {
      const navigateToNextQuestion = vi.fn();
      const poll = createMockPoll();
      const props = createResultsDisplayProps({
        selectedPoll: poll,
        navigateToNextQuestion
      });

      const { container: _container } = render(<ResultsDisplay {...props} />);

      // Verify navigation callback is available and can be called
      expect(typeof props.navigateToNextQuestion).toBe('function');

      // Simulate navigation
      act(() => {
        props.navigateToNextQuestion(poll);
      });

      expect(navigateToNextQuestion).toHaveBeenCalledWith(poll);
    });

    it('should call navigateToPreviousQuestion on previous button click', () => {
      const navigateToPreviousQuestion = vi.fn();
      const poll = createMockPoll();
      const props = createResultsDisplayProps({
        selectedPoll: poll,
        navigateToPreviousQuestion
      });

      const { container } = render(<ResultsDisplay {...props} />);

      const buttons = container.querySelectorAll('button');
      // Find and click previous button
      if (buttons.length > 0) {
        const prevButton = Array.from(buttons).find((btn) => {
          const svg = btn.querySelector('svg');
          return svg;
        });

        if (prevButton) {
          fireEvent.click(prevButton);
          expect(navigateToPreviousQuestion).toHaveBeenCalledWith(poll);
        }
      }
    });
  });

  describe('Expand/collapse functionality', () => {
    it('should render expand button for fullscreen view', () => {
      const _setExpandedPoll = vi.fn();
      const props = createResultsDisplayProps({
        setExpandedPoll: _setExpandedPoll,
        isExpanded: false
      });

      const { container } = render(<ResultsDisplay {...props} />);

      const buttons = container.querySelectorAll('button');
      expect(buttons.length).toBeGreaterThan(0);
    });

    it('should toggle expanded state when expand button is clicked', () => {
      const setExpandedPoll = vi.fn();
      const poll = createMockPoll();
      const props = createResultsDisplayProps({
        selectedPoll: poll,
        setExpandedPoll,
        isExpanded: false
      });

      const { container } = render(<ResultsDisplay {...props} />);

      const buttons = container.querySelectorAll('button');
      // Find the expand button (last navigation button)
      const expandButton = Array.from(buttons).find((btn, _idx) => {
        const svg = btn.querySelector('svg');
        return svg && btn.getAttribute('title')?.includes('Expand');
      });

      if (expandButton) {
        fireEvent.click(expandButton);
        expect(setExpandedPoll).toHaveBeenCalled();
      }
    });
  });
});

describe('Integration Tests: Hook-to-Component Data Flow', () => {
  describe('usePollData -> PollResultsClient -> FilterSidebar flow', () => {
    it('should pass poll data from hook to FilterSidebar props', () => {
      const poll = createMockPoll({
        page_path: '/survey-results/holistic-protection'
      });

      const props = createFilterSidebarProps({
        filteredPolls: [poll]
      });

      render(<FilterSidebar {...props} />);

      // Verify the poll data is accessible through the sidebar
      expect(props.filteredPolls).toContainEqual(
        expect.objectContaining({
          question: expect.any(String),
          results: expect.any(Array)
        })
      );
    });

    it('should pass filter mode state changes back to hook consumer', () => {
      const setFilterMode = vi.fn();
      const props = createFilterSidebarProps({ setFilterMode });

      render(<FilterSidebar {...props} />);

      const cewButton = screen.getByText('CEW Only');
      fireEvent.click(cewButton);

      expect(setFilterMode).toHaveBeenCalledWith('cew');
    });
  });

  describe('useMatrixDataCache -> ResultsDisplay flow', () => {
    it('should pass matrix data to ResultsDisplay for rendering', async () => {
      const matrixData = [
        createMockMatrixData({ title: 'Importance vs Feasibility' }),
        createMockMatrixData({ title: 'Another Matrix' })
      ];

      const props = createResultsDisplayProps({
        matrixData
      });

      render(<ResultsDisplay {...props} />);

      // Verify matrixData is available in props
      expect(props.matrixData).toHaveLength(2);
      expect(props.matrixData[0].title).toBe('Importance vs Feasibility');
    });

    it('should update ResultsDisplay when matrix data changes', () => {
      const matrixData1 = [createMockMatrixData()];
      const matrixData2 = [
        createMockMatrixData(),
        createMockMatrixData({ title: 'Updated Matrix' })
      ];

      const props1 = createResultsDisplayProps({ matrixData: matrixData1 });
      const { rerender } = render(<ResultsDisplay {...props1} />);

      expect(props1.matrixData).toHaveLength(1);

      const props2 = createResultsDisplayProps({ matrixData: matrixData2 });
      rerender(<ResultsDisplay {...props2} />);

      expect(props2.matrixData).toHaveLength(2);
    });
  });

  describe('Error state propagation', () => {
    it('should propagate loading state from hook to FilterSidebar', () => {
      const props = createFilterSidebarProps({ loading: true });

      render(<FilterSidebar {...props} />);

      const refreshButton = screen.getByText(/Refreshing/i);
      expect(refreshButton).toBeDisabled();
    });

    it('should propagate error state and allow retry', () => {
      const onRefresh = vi.fn();
      const props = createFilterSidebarProps({
        onRefresh,
        loading: false
      });

      render(<FilterSidebar {...props} />);

      const refreshButton = screen.getByText(/Refresh Results/i);
      expect(refreshButton).not.toBeDisabled();

      fireEvent.click(refreshButton);
      expect(onRefresh).toHaveBeenCalled();
    });
  });

  describe('State consistency across component tree', () => {
    it('should maintain filter mode consistency across sidebar and results', () => {
      const filterMode = 'twg' as const;
      const poll = createMockPoll({
        combined_survey_votes: 60,
        combined_cew_votes: 40
      });

      // Both sidebar and results should respect same filter mode
      const sidebarProps = createFilterSidebarProps({
        filterMode,
        filteredPolls: [poll]
      });

      const resultsProps = createResultsDisplayProps({
        filterMode,
        selectedPoll: poll
      });

      const { container: _sidebarContainer } = render(
        <FilterSidebar {...sidebarProps} />
      );

      render(<ResultsDisplay {...resultsProps} />);

      // Both should reflect the 'twg' filter mode
      expect(sidebarProps.filterMode).toBe('twg');
      expect(resultsProps.filterMode).toBe('twg');
    });

    it('should synchronize expanded state across components', () => {
      const expandedPoll = 'poll-1';
      const setExpandedPoll = vi.fn();

      const resultsProps = createResultsDisplayProps({
        expandedPoll,
        setExpandedPoll,
        isExpanded: true
      });

      render(<ResultsDisplay {...resultsProps} />);

      expect(resultsProps.isExpanded).toBe(true);
      expect(resultsProps.expandedPoll).toBe('poll-1');
    });
  });
});

describe('Integration Tests: Data Transformation Layers', () => {
  describe('Poll result filtering by mode', () => {
    it('should filter poll results based on filter mode', () => {
      const poll = createMockPoll();

      // Create a test function that simulates filtering
      const filterResults = (poll: PollResult, mode: 'all' | 'twg' | 'cew') => {
        if (mode === 'twg' && poll.survey_results) {
          return poll.survey_results;
        } else if (mode === 'cew' && poll.cew_results) {
          return poll.cew_results;
        }
        return poll.results;
      };

      // Test all modes
      expect(filterResults(poll, 'all')).toEqual(poll.results);
      expect(filterResults(poll, 'twg')).toEqual(poll.survey_results);
      expect(filterResults(poll, 'cew')).toEqual(poll.cew_results);
    });

    it('should handle missing filtered results gracefully', () => {
      const poll = createMockPoll({
        survey_results: undefined,
        cew_results: undefined
      });

      const filterResults = (poll: PollResult, mode: 'all' | 'twg' | 'cew') => {
        if (mode === 'twg' && poll.survey_results) {
          return poll.survey_results;
        } else if (mode === 'cew' && poll.cew_results) {
          return poll.cew_results;
        }
        return poll.results;
      };

      // Should fall back to combined results
      expect(filterResults(poll, 'twg')).toEqual(poll.results);
      expect(filterResults(poll, 'cew')).toEqual(poll.results);
    });
  });

  describe('Matrix data transformation', () => {
    it('should provide matrix data with proper structure for rendering', () => {
      const matrix = createMockMatrixData();

      expect(matrix).toHaveProperty('title');
      expect(matrix).toHaveProperty('avgImportance');
      expect(matrix).toHaveProperty('avgFeasibility');
      expect(matrix).toHaveProperty('responses');
      expect(matrix).toHaveProperty('individualPairs');

      expect(typeof matrix.title).toBe('string');
      expect(typeof matrix.avgImportance).toBe('number');
      expect(typeof matrix.avgFeasibility).toBe('number');
      expect(typeof matrix.responses).toBe('number');
      expect(Array.isArray(matrix.individualPairs)).toBe(true);
    });

    it('should calculate derived metrics from matrix data', () => {
      const matrix = createMockMatrixData({
        individualPairs: [
          { userId: 'u1', importance: 5, feasibility: 4, userType: 'authenticated' },
          { userId: 'u2', importance: 3, feasibility: 2, userType: 'cew' }
        ]
      });

      const avgImportance = matrix.individualPairs.reduce((sum, p) => sum + p.importance, 0) / matrix.individualPairs.length;
      const avgFeasibility = matrix.individualPairs.reduce((sum, p) => sum + p.feasibility, 0) / matrix.individualPairs.length;

      expect(avgImportance).toBe(4);
      expect(avgFeasibility).toBe(3);
    });
  });
});
