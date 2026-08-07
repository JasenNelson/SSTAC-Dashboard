import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { phase2Tasks } from '../phase2Tasks';
import Phase2TasksSection from '../Phase2TasksSection';

describe('Phase 2 Tasks Data Integrity', () => {
  it('has exactly 10 tasks and 54 subtasks total', () => {
    expect(phase2Tasks).toHaveLength(10);
    const totalSubtasks = phase2Tasks.reduce((sum, t) => sum + t.subtasks.length, 0);
    expect(totalSubtasks).toBe(54);
  });

  it('verifies task-level estimated hours subtotals and grand total', () => {
    const expectedSubtotals = [109, 205, 1140, 270, 460, 380, 150, 260, 300, 315];
    const actualSubtotals = phase2Tasks.map((t) =>
      t.subtasks.reduce((sum, s) => sum + s.estHours, 0)
    );

    expect(actualSubtotals).toEqual(expectedSubtotals);

    const grandTotal = actualSubtotals.reduce((sum, h) => sum + h, 0);
    expect(grandTotal).toBe(3589);
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
             element?.textContent?.includes('10 tasks') === true &&
             element?.textContent?.includes('54 subtasks') === true &&
             element?.textContent?.includes('Phase 2 spans Week 1 to Ongoing.') === true;
    })).toBeInTheDocument();
    expect(screen.queryByText(/estimated hours/i)).not.toBeInTheDocument();

    // All accordion headers should be rendered
    expect(screen.getByText('Task 1 - Project Mobilization and Governance Setup')).toBeInTheDocument();
    expect(screen.getByText('Task 10 - Phase 2 Project Management')).toBeInTheDocument();

    // Tables/subtasks should start collapsed (hidden)
    expect(screen.getByText(/ENV & SABCS meeting to discuss this project plan/i)).not.toBeVisible();
  });

  it('expands and collapses task cards on click', () => {
    render(<Phase2TasksSection />);

    // Initially collapsed
    const task1Button = screen.getByRole('button', { name: /Task 1 - Project Mobilization and Governance Setup/i });
    expect(screen.getByText(/ENV & SABCS meeting to discuss this project plan/i)).not.toBeVisible();

    // Expand Task 1
    fireEvent.click(task1Button);
    expect(screen.getByText(/ENV & SABCS meeting to discuss this project plan/i)).toBeVisible();

    // Collapse Task 1
    fireEvent.click(task1Button);
    expect(screen.getByText(/ENV & SABCS meeting to discuss this project plan/i)).not.toBeVisible();
  });

  it('handles Expand all and Collapse all controls', () => {
    render(<Phase2TasksSection />);

    const expandAllButton = screen.getByRole('button', { name: /Expand all/i });
    const collapseAllButton = screen.getByRole('button', { name: /Collapse all/i });

    // Expand all
    fireEvent.click(expandAllButton);
    expect(screen.getByText(/ENV & SABCS meeting to discuss this project plan/i)).toBeVisible();
    expect(screen.getByText(/Communications/i)).toBeVisible();

    // Collapse all
    fireEvent.click(collapseAllButton);
    expect(screen.getByText(/ENV & SABCS meeting to discuss this project plan/i)).not.toBeVisible();
    expect(screen.getByText(/Communications/i)).not.toBeVisible();
  });
});

