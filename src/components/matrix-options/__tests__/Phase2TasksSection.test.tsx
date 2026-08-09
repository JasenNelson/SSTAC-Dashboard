// Component tests for Phase2TasksSection
// Plain ASCII only.

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

import Phase2TasksSection from '../Phase2TasksSection';

vi.mock('../phase2Tasks', () => ({
  phase2Tasks: [
    {
      id: 'T1',
      title: 'Mixed Lead & Week to Month',
      subtasks: [
        { id: '1.1', subtask: 'A', deadline: 'Week 1', lead: 'ENV', estHours: 10 },
        { id: '1.2', subtask: 'B', deadline: 'Month 3', lead: 'TWG', estHours: 5 }
      ]
    },
    {
      id: 'T2',
      title: 'TWG Lead & Same Month String',
      subtasks: [
        { id: '2.1', subtask: 'A', deadline: 'Month 5', lead: 'twg review', estHours: 0 },
        { id: '2.2', subtask: 'B', deadline: 'Months 5', lead: 'TWG', estHours: 0 }
      ]
    },
    {
      id: 'T3',
      title: 'Internal Lead Default & Months Range',
      subtasks: [
        { id: '3.1', subtask: 'A', deadline: 'Month 4', lead: 'Contractor', estHours: 0 },
        { id: '3.2', subtask: 'B', deadline: 'Month 6', lead: 'Other', estHours: 0 }
      ]
    },
    {
      id: 'T4',
      title: 'No Subtasks',
      subtasks: []
    },
    {
      id: 'T5',
      title: 'Ongoing Test',
      subtasks: [
        { id: '5.1', subtask: 'A', deadline: 'Month 4', lead: 'Internal', estHours: 0 },
        { id: '5.2', subtask: 'B', deadline: 'Ongoing', lead: 'Internal', estHours: 0 }
      ]
    },
    {
      id: 'T6',
      title: 'SABCS Only',
      subtasks: [
        { id: '6.1', subtask: 'A', deadline: 'Month 10', lead: 'SABCS', estHours: 0 },
        { id: '6.2', subtask: 'B', deadline: 'Month 10', lead: 'SSTAC', estHours: 0 }
      ]
    },
    {
      id: 'T7',
      title: 'Week Only',
      subtasks: [
        { id: '7.1', subtask: 'A', deadline: 'Week 1', lead: 'Internal', estHours: 0 },
        { id: '7.2', subtask: 'B', deadline: 'Week 2', lead: 'Internal', estHours: 0 }
      ]
    },
    {
      id: 'T8',
      title: 'All Ongoing',
      subtasks: [
        { id: '8.1', subtask: 'A', deadline: 'Ongoing', lead: 'Internal', estHours: 0 },
        { id: '8.2', subtask: 'B', deadline: 'Ongoing', lead: 'Internal', estHours: 0 }
      ]
    }
  ]
}));

describe('Phase2TasksSection (internal pure logic via component rendering)', () => {
  it('mounts and renders the Gantt and detailed task list', () => {
    render(<Phase2TasksSection />);
    expect(screen.getByRole('heading', { name: /Phase 2 \(2026 - 2027\) Gantt Chart/i })).toBeInTheDocument();
    expect(screen.getByText(
      'Gantt chart showing the timeline for Phase 2 tasks from May 2026 to June 2027.'
    )).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Detailed Task List' })).toBeInTheDocument();

    const taskButtons = screen.getAllByRole('button', { name: /^T\d+ - / });
    expect(taskButtons).toHaveLength(8);
    const renderedSubtaskTotal = taskButtons.reduce((sum, button) => {
      const match = button.textContent?.match(/(\d+) subtasks/);
      return sum + Number(match?.[1] ?? 0);
    }, 0);
    expect(renderedSubtaskTotal).toBe(14);
  });

  it('computes correct Lead Type badges (Mixed, TWG, Internal)', () => {
    render(<Phase2TasksSection />);
    // T1 should have Mixed (ENV + TWG)
    const t1Button = screen.getByRole('button', { name: /T1 - Mixed Lead/i });
    expect(t1Button).toHaveTextContent('Mixed');

    // T2 should have TWG
    const t2Button = screen.getByRole('button', { name: /T2 - TWG Lead/i });
    expect(t2Button).toHaveTextContent('TWG');

    // T3 should have Internal (fallback)
    const t3Button = screen.getByRole('button', { name: /T3 - Internal Lead/i });
    expect(t3Button).toHaveTextContent('Internal');

    // T6 should have TWG (SABCS, SSTAC)
    const t6Button = screen.getByRole('button', { name: /T6 - SABCS Only/i });
    expect(t6Button).toHaveTextContent('TWG');
  });

  it('computes correct Deadline Spans based on chronological math', () => {
    render(<Phase2TasksSection />);
    expect(screen.getByText('2 subtasks - Week 1 to Month 3')).toBeInTheDocument();
    expect(screen.getByText('2 subtasks - Month 5')).toBeInTheDocument();
    expect(screen.getByText('2 subtasks - Months 4-6')).toBeInTheDocument();
    expect(screen.getByText('0 subtasks -')).toBeInTheDocument();
    expect(screen.getByText('2 subtasks - Month 4 to Ongoing')).toBeInTheDocument();
    expect(screen.getByText('2 subtasks - Month 10')).toBeInTheDocument();
    // T7: Week 1 & 2 => Weeks 1-2
    expect(screen.getByText('2 subtasks - Weeks 1-2')).toBeInTheDocument();
    expect(screen.getByText('2 subtasks - Ongoing')).toBeInTheDocument();
  });

  it('toggles task expansion and shows subtasks', () => {
    render(<Phase2TasksSection />);
    expect(screen.getByText('1.1 A')).not.toBeVisible();
    
    // Expand all
    const expandAllButton = screen.getByRole('button', { name: /Expand all/i });
    fireEvent.click(expandAllButton);
    expect(screen.getByText('1.1 A')).toBeVisible();
  });
});
