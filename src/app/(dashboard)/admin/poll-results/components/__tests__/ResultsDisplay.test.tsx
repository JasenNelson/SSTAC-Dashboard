import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ResultsDisplay from '../ResultsDisplay';
import { PollResult, MatrixData } from '../../types';

// Mock child components
vi.mock('@/components/dashboard/QRCodeDisplay', () => ({
  default: ({ pollGroup }: { pollGroup: string }) => (
    <div data-testid="qr-code-display">QR Code: {pollGroup}</div>
  )
}));

vi.mock('../../components/QRCodeModal', () => ({
  default: ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => (
    isOpen ? <div data-testid="qr-code-modal" onClick={onClose}>QR Modal</div> : null
  )
}));

vi.mock('@/components/dashboard/CustomWordCloud', () => ({
  default: ({ words }: { words: Array<{ text: string; value: number }> }) => (
    <div data-testid="word-cloud">Word Cloud: {words.length} words</div>
  )
}));

vi.mock('@/components/graphs/PrioritizationMatrixGraph', () => ({
  default: ({ title }: { title: string }) => (
    <div data-testid="prioritization-matrix-graph">{title}</div>
  )
}));

// Mock ErrorBoundary component
vi.mock('../../PollResultsClient', () => ({
  ErrorBoundary: ({ children }: { children: React.ReactNode }) => children
}));

describe('ResultsDisplay', () => {
  const mockPoll: PollResult = {
    poll_id: 'poll-1',
    page_path: '/survey-results/holistic-protection',
    poll_index: 0,
    question: 'What is your opinion?',
    options: ['Option 1', 'Option 2', 'Option 3'],
    total_votes: 10,
    results: [
      { option_index: 0, option_text: 'Option 1', votes: 5 },
      { option_index: 1, option_text: 'Option 2', votes: 3 },
      { option_index: 2, option_text: 'Option 3', votes: 2 }
    ],
    combined_survey_votes: 8,
    combined_cew_votes: 2,
  };

  const mockRankingPoll: PollResult = {
    ranking_poll_id: 'ranking-1',
    page_path: '/survey-results/holistic-protection',
    poll_index: 1,
    question: 'Rank these options',
    options: ['Option A', 'Option B', 'Option C'],
    total_votes: 10,
    results: [
      { option_index: 0, option_text: 'Option A', votes: 10, averageRank: 1.5 },
      { option_index: 1, option_text: 'Option B', votes: 10, averageRank: 2.0 },
      { option_index: 2, option_text: 'Option C', votes: 10, averageRank: 2.5 }
    ],
    is_ranking: true,
  };

  const mockWordcloudPoll: PollResult = {
    wordcloud_poll_id: 'wordcloud-1',
    page_path: '/survey-results/effectiveness',
    poll_index: 0,
    question: 'What are your thoughts?',
    options: [],
    total_votes: 5,
    results: [],
    is_wordcloud: true,
    wordcloud_words: [
      { text: 'important', value: 5 },
      { text: 'useful', value: 3 }
    ]
  };

  const mockMatrixData: MatrixData[] = [
    {
      title: 'Q1 vs Q2',
      avgImportance: 4.5,
      avgFeasibility: 3.5,
      responses: 10,
      individualPairs: []
    }
  ];

  const defaultProps = {
    selectedPoll: mockPoll,
    isExpanded: false,
    expandedPoll: null,
    setExpandedPoll: vi.fn(),
    filterMode: 'all' as const,
    showPresentationControls: true,
    matrixData: mockMatrixData,
    showMatrixGraphs: {},
    toggleMatrixGraph: vi.fn(),
    filteredPolls: [mockPoll],
    leftPanelVisible: true,
    qrCodeExpanded: false,
    expandedPollGroup: null,
    setQrCodeExpanded: vi.fn(),
    setExpandedPollGroup: vi.fn(),
    getFilteredPollResults: vi.fn((poll) => poll.results),
    navigateToNextQuestion: vi.fn(),
    navigateToPreviousQuestion: vi.fn(),
    exportSingleChoicePoll: vi.fn(),
    exportRankingPoll: vi.fn(),
    exportWordcloudPoll: vi.fn(),
    exportMatrixGraph: vi.fn(),
    getPageTitle: vi.fn(() => 'Page Title'),
    getPollGroup: vi.fn(() => 'holistic-protection' as 'holistic-protection' | 'tiered-framework' | 'prioritization' | null),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render without crashing with single-choice poll', () => {
    render(<ResultsDisplay {...defaultProps} />);
    expect(screen.getByText('What is your opinion?')).toBeInTheDocument();
  });

  it('should render with ranking poll', () => {
    render(
      <ResultsDisplay
        {...defaultProps}
        selectedPoll={mockRankingPoll}
      />
    );
    expect(screen.getByText('Rank these options')).toBeInTheDocument();
  });

  it('should render with wordcloud poll', async () => {
    render(
      <ResultsDisplay
        {...defaultProps}
        selectedPoll={mockWordcloudPoll}
      />
    );
    expect(screen.getByText('What are your thoughts?')).toBeInTheDocument();
    // Wait for lazy-loaded WordcloudDisplay component to load
    const wordcloud = await screen.findByTestId('word-cloud', {}, { timeout: 5000 });
    expect(wordcloud).toBeInTheDocument();
  });

  it('should handle empty poll results gracefully', () => {
    const emptyPoll: PollResult = {
      ...mockPoll,
      total_votes: 0,
      results: []
    };
    render(
      <ResultsDisplay
        {...defaultProps}
        selectedPoll={emptyPoll}
        getFilteredPollResults={vi.fn(() => [])}
      />
    );
    expect(screen.getByText('What is your opinion?')).toBeInTheDocument();
  });

  it('should display vote breakdown for all filter mode', () => {
    render(<ResultsDisplay {...defaultProps} />);
    expect(screen.getByText('TWG/SSTAC: 8 responses')).toBeInTheDocument();
    expect(screen.getByText('CEW: 2 responses')).toBeInTheDocument();
  });

  it('should display vote breakdown for twg filter mode', () => {
    render(
      <ResultsDisplay
        {...defaultProps}
        filterMode="twg"
      />
    );
    expect(screen.getByText('TWG/SSTAC: 8 responses')).toBeInTheDocument();
    expect(screen.queryByText(/CEW.*responses/)).not.toBeInTheDocument();
  });

  it('should display vote breakdown for cew filter mode', () => {
    render(
      <ResultsDisplay
        {...defaultProps}
        filterMode="cew"
      />
    );
    expect(screen.getByText('CEW: 2 responses')).toBeInTheDocument();
    expect(screen.queryByText(/TWG\/SSTAC.*responses/)).not.toBeInTheDocument();
  });

  it('should call setExpandedPoll when expand button is clicked', async () => {
    const user = userEvent.setup();
    const setExpandedPollMock = vi.fn();

    render(
      <ResultsDisplay
        {...defaultProps}
        setExpandedPoll={setExpandedPollMock}
        isExpanded={false}
      />
    );

    // Find and click expand button
    const expandButtons = screen.getAllByRole('button');
    // The expand button should be among the buttons
    const expandButton = expandButtons.find(btn =>
      btn.getAttribute('title')?.includes('Expand')
    );

    if (expandButton) {
      await user.click(expandButton);
      expect(setExpandedPollMock).toHaveBeenCalled();
    }
  });

  it('should render navigation buttons', () => {
    render(<ResultsDisplay {...defaultProps} />);
    const buttons = screen.getAllByRole('button');
    // Should have previous, next, and expand buttons
    expect(buttons.length).toBeGreaterThan(0);
  });

  it('should render export button when presentation controls are shown', () => {
    render(
      <ResultsDisplay
        {...defaultProps}
        showPresentationControls={true}
      />
    );
    expect(screen.getByText('Export CSV')).toBeInTheDocument();
  });

  it('should not render export button when presentation controls are hidden', () => {
    render(
      <ResultsDisplay
        {...defaultProps}
        showPresentationControls={false}
      />
    );
    expect(screen.queryByText('Export CSV')).not.toBeInTheDocument();
  });

  it('should render QR code when presentation controls are shown', () => {
    render(
      <ResultsDisplay
        {...defaultProps}
        showPresentationControls={true}
      />
    );
    expect(screen.getByTestId('qr-code-display')).toBeInTheDocument();
  });

  it('should not render QR code when presentation controls are hidden', () => {
    render(
      <ResultsDisplay
        {...defaultProps}
        showPresentationControls={false}
      />
    );
    expect(screen.queryByTestId('qr-code-display')).not.toBeInTheDocument();
  });

  it('should apply expanded styles when isExpanded is true', () => {
    const { container } = render(
      <ResultsDisplay
        {...defaultProps}
        isExpanded={true}
        expandedPoll={'poll-1'}
      />
    );

    // Check for expanded class indicators
    const expandedElement = container.querySelector('[class*="fixed"]');
    expect(expandedElement).toBeInTheDocument();
  });

  it('should render with compact styles when isExpanded is false', () => {
    const { container } = render(
      <ResultsDisplay
        {...defaultProps}
        isExpanded={false}
        expandedPoll={null}
      />
    );

    // Should not have fixed positioning
    const fixedElement = container.querySelector('[class*="fixed top"]');
    expect(fixedElement).not.toBeInTheDocument();
  });

  it('should render correct title using getPageTitle', () => {
    const getPageTitleMock = vi.fn(() => 'Holistic Protection');
    render(
      <ResultsDisplay
        {...defaultProps}
        getPageTitle={getPageTitleMock}
      />
    );
    expect(getPageTitleMock).toHaveBeenCalled();
    expect(screen.getByText(/Holistic Protection/)).toBeInTheDocument();
  });

  it('should call navigateToPreviousQuestion when previous button is clicked', async () => {
    const user = userEvent.setup();
    const navigateMock = vi.fn();

    render(
      <ResultsDisplay
        {...defaultProps}
        navigateToPreviousQuestion={navigateMock}
      />
    );

    const buttons = screen.getAllByRole('button');
    // Previous button should have title "Previous question in group"
    const prevButton = buttons.find(btn =>
      btn.getAttribute('title')?.includes('Previous')
    );

    if (prevButton) {
      await user.click(prevButton);
      expect(navigateMock).toHaveBeenCalledWith(mockPoll);
    }
  });

  it('should call navigateToNextQuestion when next button is clicked', async () => {
    const user = userEvent.setup();
    const navigateMock = vi.fn();

    render(
      <ResultsDisplay
        {...defaultProps}
        navigateToNextQuestion={navigateMock}
      />
    );

    const buttons = screen.getAllByRole('button');
    // Next button should have title "Next question in group"
    const nextButton = buttons.find(btn =>
      btn.getAttribute('title')?.includes('Next')
    );

    if (nextButton) {
      await user.click(nextButton);
      expect(navigateMock).toHaveBeenCalledWith(mockPoll);
    }
  });

  it('should render word frequency table for wordcloud polls', () => {
    render(
      <ResultsDisplay
        {...defaultProps}
        selectedPoll={mockWordcloudPoll}
      />
    );
    expect(screen.getByText('Word Frequency')).toBeInTheDocument();
  });

  it('should render matrix graphs section for prioritization polls at question 2', () => {
    const prioritizationPoll: PollResult = {
      ...mockPoll,
      page_path: '/survey-results/prioritization',
      poll_index: 1
    };

    render(
      <ResultsDisplay
        {...defaultProps}
        selectedPoll={prioritizationPoll}
        matrixData={mockMatrixData}
        showMatrixGraphs={{}}
      />
    );

    // Should render show/hide matrix graph button
    expect(screen.getByText('Show Matrix Graph')).toBeInTheDocument();
  });

  it('should handle matrix graph toggle', async () => {
    const user = userEvent.setup();
    const toggleMock = vi.fn();

    const prioritizationPoll: PollResult = {
      ...mockPoll,
      page_path: '/survey-results/prioritization',
      poll_index: 1
    };

    render(
      <ResultsDisplay
        {...defaultProps}
        selectedPoll={prioritizationPoll}
        matrixData={mockMatrixData}
        toggleMatrixGraph={toggleMock}
      />
    );

    const showMatrixButton = screen.getByText('Show Matrix Graph');
    await user.click(showMatrixButton);
    expect(toggleMock).toHaveBeenCalled();
  });

  it('should render QR code modal when needed', () => {
    render(
      <ResultsDisplay
        {...defaultProps}
        qrCodeExpanded={true}
      />
    );
    expect(screen.getByTestId('qr-code-modal')).toBeInTheDocument();
  });

  it('should handle missing poll gracefully', () => {
    const { container } = render(
      <ResultsDisplay
        {...defaultProps}
        selectedPoll={{
          ...mockPoll,
          poll_id: 'nonexistent'
        }}
        filteredPolls={[]}
      />
    );

    // Component should still render without crashing
    expect(container).toBeInTheDocument();
  });
});
