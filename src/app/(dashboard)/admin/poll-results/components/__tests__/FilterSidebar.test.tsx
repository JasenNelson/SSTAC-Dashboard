import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import FilterSidebar from '../FilterSidebar';
import { PollResult } from '../../types';

describe('FilterSidebar', () => {
  // Mock poll data
  const mockPoll = (overrides?: Partial<PollResult>): PollResult => ({
    poll_id: 'poll-1',
    ranking_poll_id: '',
    wordcloud_poll_id: undefined,
    question: 'Test question',
    options: ['Option A', 'Option B'],
    is_wordcloud: false,
    is_ranking: false,
    poll_index: 0,
    page_path: '/holistic-protection',
    total_votes: 100,
    combined_survey_votes: 60,
    combined_cew_votes: 40,
    survey_results: [],
    cew_results: [],
    wordcloud_words: [],
    results: [],
    ...overrides
  });

  // Mock group polls by theme
  const mockGroupPollsByTheme = (polls: PollResult[]) => ({
    'holistic-protection': {
      name: 'Holistic Protection',
      polls: polls.filter(p => p.page_path === '/holistic-protection')
    },
    'tiered-framework': {
      name: 'Tiered Framework',
      polls: polls.filter(p => p.page_path === '/tiered-framework')
    },
    'prioritization': {
      name: 'Prioritization',
      polls: polls.filter(p => p.page_path === '/prioritization')
    }
  });

  // Mock getFilteredPollResults
  const mockGetFilteredPollResults = (_poll: PollResult) => [
    { option_index: 0, option_text: 'Option A', votes: 60 },
    { option_index: 1, option_text: 'Option B', votes: 40 }
  ];

  it('should render filter buttons for all modes', () => {
    const setFilterMode = vi.fn();
    const setShowPresentationControls = vi.fn();
    const setExpandedGroup = vi.fn();
    const setSelectedQuestion = vi.fn();

    render(
      <FilterSidebar
        filterMode="all"
        setFilterMode={setFilterMode}
        showPresentationControls={true}
        setShowPresentationControls={setShowPresentationControls}
        filteredPolls={[]}
        expandedGroup={null}
        setExpandedGroup={setExpandedGroup}
        selectedQuestion={null}
        setSelectedQuestion={setSelectedQuestion}
        loading={false}
        onRefresh={vi.fn()}
        onExportAll={vi.fn()}
        onHidePanel={vi.fn()}
        groupPollsByTheme={mockGroupPollsByTheme}
        getFilteredPollResults={mockGetFilteredPollResults}
      />
    );

    expect(screen.getByText('SSTAC & TWG Only')).toBeInTheDocument();
    expect(screen.getByText('CEW Only')).toBeInTheDocument();
    expect(screen.getByText('All Responses')).toBeInTheDocument();
  });

  it('should highlight active filter mode button', () => {
    const setFilterMode = vi.fn();
    const setShowPresentationControls = vi.fn();
    const setExpandedGroup = vi.fn();
    const setSelectedQuestion = vi.fn();

    render(
      <FilterSidebar
        filterMode="twg"
        setFilterMode={setFilterMode}
        showPresentationControls={true}
        setShowPresentationControls={setShowPresentationControls}
        filteredPolls={[]}
        expandedGroup={null}
        setExpandedGroup={setExpandedGroup}
        selectedQuestion={null}
        setSelectedQuestion={setSelectedQuestion}
        loading={false}
        onRefresh={vi.fn()}
        onExportAll={vi.fn()}
        onHidePanel={vi.fn()}
        groupPollsByTheme={mockGroupPollsByTheme}
        getFilteredPollResults={mockGetFilteredPollResults}
      />
    );

    const twgButton = screen.getByRole('button', { name: /SSTAC & TWG Only/i });
    expect(twgButton).toHaveClass('bg-blue-600');
  });

  it('should call setFilterMode when filter button is clicked', () => {
    const setFilterMode = vi.fn();
    const setShowPresentationControls = vi.fn();
    const setExpandedGroup = vi.fn();
    const setSelectedQuestion = vi.fn();

    render(
      <FilterSidebar
        filterMode="all"
        setFilterMode={setFilterMode}
        showPresentationControls={true}
        setShowPresentationControls={setShowPresentationControls}
        filteredPolls={[]}
        expandedGroup={null}
        setExpandedGroup={setExpandedGroup}
        selectedQuestion={null}
        setSelectedQuestion={setSelectedQuestion}
        loading={false}
        onRefresh={vi.fn()}
        onExportAll={vi.fn()}
        onHidePanel={vi.fn()}
        groupPollsByTheme={mockGroupPollsByTheme}
        getFilteredPollResults={mockGetFilteredPollResults}
      />
    );

    const twgButton = screen.getByRole('button', { name: /SSTAC & TWG Only/i });
    fireEvent.click(twgButton);

    expect(setFilterMode).toHaveBeenCalledWith('twg');
  });

  it('should display poll groups correctly', () => {
    const polls = [
      mockPoll({ poll_index: 0, page_path: '/holistic-protection' }),
      mockPoll({ poll_index: 1, page_path: '/tiered-framework' })
    ];

    const setFilterMode = vi.fn();
    const setShowPresentationControls = vi.fn();
    const setExpandedGroup = vi.fn();
    const setSelectedQuestion = vi.fn();

    render(
      <FilterSidebar
        filterMode="all"
        setFilterMode={setFilterMode}
        showPresentationControls={true}
        setShowPresentationControls={setShowPresentationControls}
        filteredPolls={polls}
        expandedGroup={null}
        setExpandedGroup={setExpandedGroup}
        selectedQuestion={null}
        setSelectedQuestion={setSelectedQuestion}
        loading={false}
        onRefresh={vi.fn()}
        onExportAll={vi.fn()}
        onHidePanel={vi.fn()}
        groupPollsByTheme={mockGroupPollsByTheme}
        getFilteredPollResults={mockGetFilteredPollResults}
      />
    );

    expect(screen.getByText('Holistic Protection')).toBeInTheDocument();
    expect(screen.getByText('Tiered Framework')).toBeInTheDocument();
  });

  it('should expand and collapse poll groups', () => {
    const polls = [mockPoll({ poll_index: 0, page_path: '/holistic-protection' })];
    const setFilterMode = vi.fn();
    const setShowPresentationControls = vi.fn();
    const setExpandedGroup = vi.fn();
    const setSelectedQuestion = vi.fn();

    render(
      <FilterSidebar
        filterMode="all"
        setFilterMode={setFilterMode}
        showPresentationControls={true}
        setShowPresentationControls={setShowPresentationControls}
        filteredPolls={polls}
        expandedGroup={null}
        setExpandedGroup={setExpandedGroup}
        selectedQuestion={null}
        setSelectedQuestion={setSelectedQuestion}
        loading={false}
        onRefresh={vi.fn()}
        onExportAll={vi.fn()}
        onHidePanel={vi.fn()}
        groupPollsByTheme={mockGroupPollsByTheme}
        getFilteredPollResults={mockGetFilteredPollResults}
      />
    );

    const groupButton = screen.getByRole('button', { name: /Holistic Protection/i });
    fireEvent.click(groupButton);

    expect(setExpandedGroup).toHaveBeenCalledWith('holistic-protection');
  });

  it('should display questions in expanded group', () => {
    const polls = [mockPoll({ poll_index: 0, page_path: '/holistic-protection' })];
    const setFilterMode = vi.fn();
    const setShowPresentationControls = vi.fn();
    const setExpandedGroup = vi.fn();
    const setSelectedQuestion = vi.fn();

    render(
      <FilterSidebar
        filterMode="all"
        setFilterMode={setFilterMode}
        showPresentationControls={true}
        setShowPresentationControls={setShowPresentationControls}
        filteredPolls={polls}
        expandedGroup="holistic-protection"
        setExpandedGroup={setExpandedGroup}
        selectedQuestion={null}
        setSelectedQuestion={setSelectedQuestion}
        loading={false}
        onRefresh={vi.fn()}
        onExportAll={vi.fn()}
        onHidePanel={vi.fn()}
        groupPollsByTheme={mockGroupPollsByTheme}
        getFilteredPollResults={mockGetFilteredPollResults}
      />
    );

    expect(screen.getByText(/Question 1/i)).toBeInTheDocument();
  });

  it('should highlight selected question', () => {
    const polls = [mockPoll({ poll_id: 'poll-1', poll_index: 0, page_path: '/holistic-protection' })];
    const setFilterMode = vi.fn();
    const setShowPresentationControls = vi.fn();
    const setExpandedGroup = vi.fn();
    const setSelectedQuestion = vi.fn();

    render(
      <FilterSidebar
        filterMode="all"
        setFilterMode={setFilterMode}
        showPresentationControls={true}
        setShowPresentationControls={setShowPresentationControls}
        filteredPolls={polls}
        expandedGroup="holistic-protection"
        setExpandedGroup={setExpandedGroup}
        selectedQuestion="poll-1"
        setSelectedQuestion={setSelectedQuestion}
        loading={false}
        onRefresh={vi.fn()}
        onExportAll={vi.fn()}
        onHidePanel={vi.fn()}
        groupPollsByTheme={mockGroupPollsByTheme}
        getFilteredPollResults={mockGetFilteredPollResults}
      />
    );

    const questionButton = screen.getByRole('button', { name: /Question 1/i });
    expect(questionButton).toHaveClass('ring-2');
  });

  it('should toggle presentation controls visibility', () => {
    const setFilterMode = vi.fn();
    const setShowPresentationControls = vi.fn();
    const setExpandedGroup = vi.fn();
    const setSelectedQuestion = vi.fn();

    render(
      <FilterSidebar
        filterMode="all"
        setFilterMode={setFilterMode}
        showPresentationControls={false}
        setShowPresentationControls={setShowPresentationControls}
        filteredPolls={[]}
        expandedGroup={null}
        setExpandedGroup={setExpandedGroup}
        selectedQuestion={null}
        setSelectedQuestion={setSelectedQuestion}
        loading={false}
        onRefresh={vi.fn()}
        onExportAll={vi.fn()}
        onHidePanel={vi.fn()}
        groupPollsByTheme={mockGroupPollsByTheme}
        getFilteredPollResults={mockGetFilteredPollResults}
      />
    );

    const presentationButton = screen.getByRole('button', { name: /Show Presentation Controls/i });
    fireEvent.click(presentationButton);

    expect(setShowPresentationControls).toHaveBeenCalled();
  });

  it('should disable export all button when loading', () => {
    const polls = [mockPoll()];
    const setFilterMode = vi.fn();
    const setShowPresentationControls = vi.fn();
    const setExpandedGroup = vi.fn();
    const setSelectedQuestion = vi.fn();

    render(
      <FilterSidebar
        filterMode="all"
        setFilterMode={setFilterMode}
        showPresentationControls={true}
        setShowPresentationControls={setShowPresentationControls}
        filteredPolls={polls}
        expandedGroup={null}
        setExpandedGroup={setExpandedGroup}
        selectedQuestion={null}
        setSelectedQuestion={setSelectedQuestion}
        loading={true}
        onRefresh={vi.fn()}
        onExportAll={vi.fn()}
        onHidePanel={vi.fn()}
        groupPollsByTheme={mockGroupPollsByTheme}
        getFilteredPollResults={mockGetFilteredPollResults}
      />
    );

    const exportButton = screen.getByRole('button', { name: /Export All/i });
    expect(exportButton).toBeDisabled();
  });

  it('should disable export all button when no polls available', () => {
    const setFilterMode = vi.fn();
    const setShowPresentationControls = vi.fn();
    const setExpandedGroup = vi.fn();
    const setSelectedQuestion = vi.fn();

    render(
      <FilterSidebar
        filterMode="all"
        setFilterMode={setFilterMode}
        showPresentationControls={true}
        setShowPresentationControls={setShowPresentationControls}
        filteredPolls={[]}
        expandedGroup={null}
        setExpandedGroup={setExpandedGroup}
        selectedQuestion={null}
        setSelectedQuestion={setSelectedQuestion}
        loading={false}
        onRefresh={vi.fn()}
        onExportAll={vi.fn()}
        onHidePanel={vi.fn()}
        groupPollsByTheme={mockGroupPollsByTheme}
        getFilteredPollResults={mockGetFilteredPollResults}
      />
    );

    const exportButton = screen.getByRole('button', { name: /Export All/i });
    expect(exportButton).toBeDisabled();
  });

  it('should call onExportAll when export button is clicked', () => {
    const onExportAll = vi.fn();
    const polls = [mockPoll()];
    const setFilterMode = vi.fn();
    const setShowPresentationControls = vi.fn();
    const setExpandedGroup = vi.fn();
    const setSelectedQuestion = vi.fn();

    render(
      <FilterSidebar
        filterMode="all"
        setFilterMode={setFilterMode}
        showPresentationControls={true}
        setShowPresentationControls={setShowPresentationControls}
        filteredPolls={polls}
        expandedGroup={null}
        setExpandedGroup={setExpandedGroup}
        selectedQuestion={null}
        setSelectedQuestion={setSelectedQuestion}
        loading={false}
        onRefresh={vi.fn()}
        onExportAll={onExportAll}
        onHidePanel={vi.fn()}
        groupPollsByTheme={mockGroupPollsByTheme}
        getFilteredPollResults={mockGetFilteredPollResults}
      />
    );

    const exportButton = screen.getByRole('button', { name: /Export All/i });
    fireEvent.click(exportButton);

    expect(onExportAll).toHaveBeenCalled();
  });

  it('should display loading state in refresh button', () => {
    const setFilterMode = vi.fn();
    const setShowPresentationControls = vi.fn();
    const setExpandedGroup = vi.fn();
    const setSelectedQuestion = vi.fn();

    render(
      <FilterSidebar
        filterMode="all"
        setFilterMode={setFilterMode}
        showPresentationControls={true}
        setShowPresentationControls={setShowPresentationControls}
        filteredPolls={[]}
        expandedGroup={null}
        setExpandedGroup={setExpandedGroup}
        selectedQuestion={null}
        setSelectedQuestion={setSelectedQuestion}
        loading={true}
        onRefresh={vi.fn()}
        onExportAll={vi.fn()}
        onHidePanel={vi.fn()}
        groupPollsByTheme={mockGroupPollsByTheme}
        getFilteredPollResults={mockGetFilteredPollResults}
      />
    );

    expect(screen.getByText('Refreshing...')).toBeInTheDocument();
  });

  it('should display poll vote counts in questions list', () => {
    const polls = [mockPoll({ poll_id: 'poll-1', poll_index: 0, page_path: '/holistic-protection' })];
    const setFilterMode = vi.fn();
    const setShowPresentationControls = vi.fn();
    const setExpandedGroup = vi.fn();
    const setSelectedQuestion = vi.fn();

    const getFilteredPollResults = (_poll: PollResult) => [
      { option_index: 0, option_text: 'Option A', votes: 75 },
      { option_index: 1, option_text: 'Option B', votes: 25 }
    ];

    render(
      <FilterSidebar
        filterMode="all"
        setFilterMode={setFilterMode}
        showPresentationControls={true}
        setShowPresentationControls={setShowPresentationControls}
        filteredPolls={polls}
        expandedGroup="holistic-protection"
        setExpandedGroup={setExpandedGroup}
        selectedQuestion={null}
        setSelectedQuestion={setSelectedQuestion}
        loading={false}
        onRefresh={vi.fn()}
        onExportAll={vi.fn()}
        onHidePanel={vi.fn()}
        groupPollsByTheme={mockGroupPollsByTheme}
        getFilteredPollResults={getFilteredPollResults}
      />
    );

    expect(screen.getByText('100 votes')).toBeInTheDocument();
  });

  it('should display response count for ranking polls', () => {
    const polls = [
      mockPoll({
        poll_id: 'ranking-1',
        ranking_poll_id: 'ranking-1',
        poll_index: 0,
        page_path: '/holistic-protection',
        is_ranking: true
      })
    ];
    const setFilterMode = vi.fn();
    const setShowPresentationControls = vi.fn();
    const setExpandedGroup = vi.fn();
    const setSelectedQuestion = vi.fn();

    render(
      <FilterSidebar
        filterMode="all"
        setFilterMode={setFilterMode}
        showPresentationControls={true}
        setShowPresentationControls={setShowPresentationControls}
        filteredPolls={polls}
        expandedGroup="holistic-protection"
        setExpandedGroup={setExpandedGroup}
        selectedQuestion={null}
        setSelectedQuestion={setSelectedQuestion}
        loading={false}
        onRefresh={vi.fn()}
        onExportAll={vi.fn()}
        onHidePanel={vi.fn()}
        groupPollsByTheme={mockGroupPollsByTheme}
        getFilteredPollResults={mockGetFilteredPollResults}
      />
    );

    expect(screen.getByText('100 responses')).toBeInTheDocument();
  });
});
