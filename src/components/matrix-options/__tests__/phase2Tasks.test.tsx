import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { phase2Tasks } from '../phase2Tasks';
import Phase2TasksSection from '../Phase2TasksSection';

describe('Phase 2 Tasks Data Integrity', () => {
  it('has exactly 9 tasks and 39 subtasks total', () => {
    expect(phase2Tasks).toHaveLength(9);
    const totalSubtasks = phase2Tasks.reduce((sum, t) => sum + t.subtasks.length, 0);
    expect(totalSubtasks).toBe(39);
  });

  it('verifies task-level estimated hours subtotals and grand total', () => {
    const expectedSubtotals = [124, 84, 340, 190, 230, 200, 140, 130, 160];
    const actualSubtotals = phase2Tasks.map((t) =>
      t.subtasks.reduce((sum, s) => sum + s.estHours, 0)
    );
    
    expect(actualSubtotals).toEqual(expectedSubtotals);

    const grandTotal = actualSubtotals.reduce((sum, h) => sum + h, 0);
    expect(grandTotal).toBe(1598);
  });
});

describe('Phase2TasksSection Component', () => {
  it('renders correctly in collapsed state by default and does not display hours', () => {
    render(<Phase2TasksSection />);

    // Check header
    expect(screen.getByText('Phase 2 (2026) Tasks and Activities')).toBeInTheDocument();

    // Check summary line (default hides hours)
    expect(screen.getByText((_content, element) => {
      return element?.tagName === 'DIV' && 
             element?.classList.contains('text-slate-600') &&
             element?.textContent?.includes('9 tasks') === true && 
             element?.textContent?.includes('39 subtasks') === true && 
             element?.textContent?.includes('Phase 2 spans Week 0 to Month 9.') === true;
    })).toBeInTheDocument();
    expect(screen.queryByText(/estimated hours/i)).not.toBeInTheDocument();

    // All accordion headers should be rendered
    expect(screen.getByText('Task 1 - Options Paper Review and Finalization')).toBeInTheDocument();
    expect(screen.getByText('Task 9 - Phase 2 Reporting and Deliverables')).toBeInTheDocument();

    // Tables/subtasks should start collapsed (not in the document)
    expect(screen.queryByText(/Circulate draft Options Paper/i)).not.toBeInTheDocument();
  });

  it('expands and collapses task cards on click', () => {
    render(<Phase2TasksSection />);

    // Initially collapsed
    const task1Button = screen.getByRole('button', { name: /Task 1 - Options Paper Review and Finalization/i });
    expect(screen.queryByText(/Circulate draft Options Paper/i)).not.toBeInTheDocument();

    // Expand Task 1
    fireEvent.click(task1Button);
    expect(screen.getByText(/Circulate draft Options Paper/i)).toBeInTheDocument();

    // Collapse Task 1
    fireEvent.click(task1Button);
    expect(screen.queryByText(/Circulate draft Options Paper/i)).not.toBeInTheDocument();
  });

  it('handles Expand all and Collapse all controls', () => {
    render(<Phase2TasksSection />);

    const expandAllButton = screen.getByRole('button', { name: /Expand all/i });
    const collapseAllButton = screen.getByRole('button', { name: /Collapse all/i });

    // Expand all
    fireEvent.click(expandAllButton);
    expect(screen.getByText(/Circulate draft Options Paper/i)).toBeInTheDocument();
    expect(screen.getByText(/Draft Phase 2 summary report/i)).toBeInTheDocument();

    // Collapse all
    fireEvent.click(collapseAllButton);
    expect(screen.queryByText(/Circulate draft Options Paper/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Draft Phase 2 summary report/i)).not.toBeInTheDocument();
  });
});
