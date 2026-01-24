import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MatrixGraphRenderer from '../MatrixGraphRenderer';
import { PollResult, MatrixData } from '../../types';

// Mock the PrioritizationMatrixGraph component
vi.mock('@/components/graphs/PrioritizationMatrixGraph', () => ({
  default: ({ title }: { title: string }) => <div data-testid={`matrix-graph-${title}`}>{title}</div>
}));

describe('MatrixGraphRenderer', () => {
  const mockPrioritizationPoll: PollResult = {
    poll_id: 'test-poll-1',
    page_path: '/survey-results/prioritization',
    poll_index: 1,
    question: 'Prioritization Question',
    is_wordcloud: false,
    is_ranking: true,
    options: ['Option 1', 'Option 2'],
    results: [],
    survey_results: [],
    cew_results: [],
    total_votes: 100,
    combined_survey_votes: 60,
    combined_cew_votes: 40,
    wordcloud_words: []
  };

  const mockHolisticPoll: PollResult = {
    poll_id: 'test-poll-2',
    page_path: '/survey-results/holistic-protection',
    poll_index: 1,
    question: 'Holistic Question',
    is_wordcloud: false,
    is_ranking: false,
    options: ['Option 1', 'Option 2'],
    results: [],
    survey_results: [],
    cew_results: [],
    total_votes: 100,
    combined_survey_votes: 60,
    combined_cew_votes: 40,
    wordcloud_words: []
  };

  const mockMatrixData: MatrixData[] = [
    {
      title: 'Prioritization Q1-Q2',
      avgImportance: 3.5,
      avgFeasibility: 3.0,
      responses: 100,
      individualPairs: []
    },
    {
      title: 'Holistic Q1-Q2',
      avgImportance: 3.2,
      avgFeasibility: 2.8,
      responses: 95,
      individualPairs: []
    },
    {
      title: 'Holistic Q3-Q4',
      avgImportance: 3.4,
      avgFeasibility: 2.9,
      responses: 92,
      individualPairs: []
    },
    {
      title: 'Holistic Q5-Q6',
      avgImportance: 3.1,
      avgFeasibility: 3.1,
      responses: 90,
      individualPairs: []
    },
    {
      title: 'Holistic Q7-Q8',
      avgImportance: 3.3,
      avgFeasibility: 2.7,
      responses: 88,
      individualPairs: []
    }
  ];

  const mockFilteredPolls: PollResult[] = [
    { ...mockPrioritizationPoll, poll_index: 0, question: 'Question 1' },
    mockPrioritizationPoll,
    { ...mockHolisticPoll, poll_index: 0, question: 'Holistic Q1' },
    { ...mockHolisticPoll, poll_index: 1, question: 'Holistic Q2' },
    { ...mockHolisticPoll, poll_index: 2, question: 'Holistic Q3' },
    { ...mockHolisticPoll, poll_index: 3, question: 'Holistic Q4' }
  ];

  const mockToggleMatrixGraph = vi.fn();
  const mockExportMatrixGraph = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render nothing when matrixData is empty', () => {
    const { container } = render(
      <MatrixGraphRenderer
        selectedPoll={mockPrioritizationPoll}
        matrixData={[]}
        showMatrixGraphs={{}}
        toggleMatrixGraph={mockToggleMatrixGraph}
        exportMatrixGraph={mockExportMatrixGraph}
        filteredPolls={mockFilteredPolls}
      />
    );

    expect(container.firstChild).toBeNull();
  });

  it('should render prioritization matrix graph for prioritization page at poll_index 1', () => {
    const showGraphs = { 'prioritization-q1-q2': true };

    render(
      <MatrixGraphRenderer
        selectedPoll={mockPrioritizationPoll}
        matrixData={mockMatrixData}
        showMatrixGraphs={showGraphs}
        toggleMatrixGraph={mockToggleMatrixGraph}
        exportMatrixGraph={mockExportMatrixGraph}
        filteredPolls={mockFilteredPolls}
      />
    );

    expect(screen.getByTestId('matrix-graph-Prioritization Q1-Q2')).toBeInTheDocument();
  });

  it('should not render prioritization matrix graph for prioritization page at other poll indices', () => {
    const pollAtIndex0 = { ...mockPrioritizationPoll, poll_index: 0 };
    const pollAtIndex2 = { ...mockPrioritizationPoll, poll_index: 2 };

    const { rerender } = render(
      <MatrixGraphRenderer
        selectedPoll={pollAtIndex0}
        matrixData={mockMatrixData}
        showMatrixGraphs={{}}
        toggleMatrixGraph={mockToggleMatrixGraph}
        exportMatrixGraph={mockExportMatrixGraph}
        filteredPolls={mockFilteredPolls}
      />
    );

    expect(screen.queryByTestId('matrix-graph-Prioritization Q1-Q2')).not.toBeInTheDocument();

    rerender(
      <MatrixGraphRenderer
        selectedPoll={pollAtIndex2}
        matrixData={mockMatrixData}
        showMatrixGraphs={{}}
        toggleMatrixGraph={mockToggleMatrixGraph}
        exportMatrixGraph={mockExportMatrixGraph}
        filteredPolls={mockFilteredPolls}
      />
    );

    expect(screen.queryByTestId('matrix-graph-Prioritization Q1-Q2')).not.toBeInTheDocument();
  });

  it('should render holistic matrix graphs for poll indices 1, 3, 5, 7', () => {
    const validIndices = [1, 3, 5, 7];

    validIndices.forEach((index) => {
      const poll = { ...mockHolisticPoll, poll_index: index };
      const showGraphs = { [`holistic-q${index}-q${index + 1}`]: true };

      const { unmount } = render(
        <MatrixGraphRenderer
          selectedPoll={poll}
          matrixData={mockMatrixData}
          showMatrixGraphs={showGraphs}
          toggleMatrixGraph={mockToggleMatrixGraph}
          exportMatrixGraph={mockExportMatrixGraph}
          filteredPolls={mockFilteredPolls}
        />
      );

      expect(screen.getByTestId(`matrix-graph-Holistic Q${index}-Q${index + 1}`)).toBeInTheDocument();
      unmount();
    });
  });

  it('should not render holistic matrix graphs for other poll indices', () => {
    const invalidIndices = [0, 2, 4, 6, 8];

    invalidIndices.forEach((index) => {
      const poll = { ...mockHolisticPoll, poll_index: index };

      render(
        <MatrixGraphRenderer
          selectedPoll={poll}
          matrixData={mockMatrixData}
          showMatrixGraphs={{}}
          toggleMatrixGraph={mockToggleMatrixGraph}
          exportMatrixGraph={mockExportMatrixGraph}
          filteredPolls={mockFilteredPolls}
        />
      );

      expect(screen.queryByText(/Holistic/)).not.toBeInTheDocument();
    });
  });

  it('should toggle matrix graph visibility when toggle button is clicked', () => {
    const showGraphs = { 'prioritization-q1-q2': false };

    const { rerender } = render(
      <MatrixGraphRenderer
        selectedPoll={mockPrioritizationPoll}
        matrixData={mockMatrixData}
        showMatrixGraphs={showGraphs}
        toggleMatrixGraph={mockToggleMatrixGraph}
        exportMatrixGraph={mockExportMatrixGraph}
        filteredPolls={mockFilteredPolls}
      />
    );

    const toggleButton = screen.getByRole('button', { name: /Show Matrix Graph/i });
    fireEvent.click(toggleButton);

    expect(mockToggleMatrixGraph).toHaveBeenCalledWith('prioritization-q1-q2');
  });

  it('should export matrix graph when export button is clicked', () => {
    const showGraphs = { 'prioritization-q1-q2': true };

    render(
      <MatrixGraphRenderer
        selectedPoll={mockPrioritizationPoll}
        matrixData={mockMatrixData}
        showMatrixGraphs={showGraphs}
        toggleMatrixGraph={mockToggleMatrixGraph}
        exportMatrixGraph={mockExportMatrixGraph}
        filteredPolls={mockFilteredPolls}
      />
    );

    const exportButton = screen.getByRole('button', { name: /Export CSV/i });
    fireEvent.click(exportButton);

    expect(mockExportMatrixGraph).toHaveBeenCalled();
  });

  it('should hide matrix graph content when visibility is false', () => {
    const showGraphs = { 'prioritization-q1-q2': false };

    render(
      <MatrixGraphRenderer
        selectedPoll={mockPrioritizationPoll}
        matrixData={mockMatrixData}
        showMatrixGraphs={showGraphs}
        toggleMatrixGraph={mockToggleMatrixGraph}
        exportMatrixGraph={mockExportMatrixGraph}
        filteredPolls={mockFilteredPolls}
      />
    );

    expect(screen.queryByTestId('matrix-graph-Prioritization Q1-Q2')).not.toBeInTheDocument();
  });

  it('should show matrix graph content when visibility is true', () => {
    const showGraphs = { 'prioritization-q1-q2': true };

    render(
      <MatrixGraphRenderer
        selectedPoll={mockPrioritizationPoll}
        matrixData={mockMatrixData}
        showMatrixGraphs={showGraphs}
        toggleMatrixGraph={mockToggleMatrixGraph}
        exportMatrixGraph={mockExportMatrixGraph}
        filteredPolls={mockFilteredPolls}
      />
    );

    expect(screen.getByTestId('matrix-graph-Prioritization Q1-Q2')).toBeInTheDocument();
  });

  it('should render correct text for toggle button based on visibility state', () => {
    const { rerender } = render(
      <MatrixGraphRenderer
        selectedPoll={mockPrioritizationPoll}
        matrixData={mockMatrixData}
        showMatrixGraphs={{ 'prioritization-q1-q2': false }}
        toggleMatrixGraph={mockToggleMatrixGraph}
        exportMatrixGraph={mockExportMatrixGraph}
        filteredPolls={mockFilteredPolls}
      />
    );

    expect(screen.getByRole('button', { name: /Show Matrix Graph/i })).toBeInTheDocument();

    rerender(
      <MatrixGraphRenderer
        selectedPoll={mockPrioritizationPoll}
        matrixData={mockMatrixData}
        showMatrixGraphs={{ 'prioritization-q1-q2': true }}
        toggleMatrixGraph={mockToggleMatrixGraph}
        exportMatrixGraph={mockExportMatrixGraph}
        filteredPolls={mockFilteredPolls}
      />
    );

    expect(screen.getByRole('button', { name: /Hide Matrix Graph/i })).toBeInTheDocument();
  });
});
