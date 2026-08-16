import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import Phase2GanttChart, { parseCol, GANTT_DATA } from '../Phase2GanttChart';

describe('Phase2GanttChart logic', () => {
  describe('parseCol', () => {
    it('correctly maps week to month logic', () => {
      expect(parseCol('Week 1')).toEqual({ start: 1, end: 1 });
      expect(parseCol('Weeks 1-4')).toEqual({ start: 1, end: 1 });
      expect(parseCol('Weeks 1-5')).toEqual({ start: 1, end: 2 });
    });

    it('correctly parses month logic', () => {
      expect(parseCol('Month 1')).toEqual({ start: 1, end: 1 });
      expect(parseCol('Month 4')).toEqual({ start: 4, end: 4 });
      expect(parseCol('Months 6-9')).toEqual({ start: 6, end: 9 });
    });

    it('correctly parses ongoing logic', () => {
      expect(parseCol('Month 4 - ongoing')).toEqual({ start: 4, end: 14 });
      expect(parseCol('Ongoing')).toEqual({ start: 1, end: 14 });
    });
  });

  describe('GANTT_DATA segmentation', () => {
    it('accurately maps Task 3 with bounded ongoing gaps', () => {
      const t3 = GANTT_DATA.find(t => t.id === '3');
      expect(t3).toBeDefined();
      expect(t3?.segments).toEqual([{ start: 1, end: 14 }]);
    });

    it('accurately maps Task 6 gaps without filling them in', () => {
      const t6 = GANTT_DATA.find(t => t.id === '6');
      expect(t6).toBeDefined();
      expect(t6?.segments).toEqual([
        { start: 1, end: 3 },
        { start: 6, end: 9 }
      ]);
    });

    it('maps Task 10 as full continuous ongoing', () => {
      const t10 = GANTT_DATA.find(t => t.id === '10');
      expect(t10).toBeDefined();
      expect(t10?.segments).toEqual([{ start: 1, end: 14 }]);
    });
  });
});

// Decision #2 (docs/UI_DECISIONS_2026_08_15.md): the Gantt figure's
// overflow-x-auto region gets the shared ScrollFadeRegion affordance.
describe('Phase2GanttChart rendering', () => {
  it('wraps the visual (aria-hidden) Gantt grid in a ScrollFadeRegion, leaving the sr-only table outside it', () => {
    // Two-sided falsification: the old assertion (`queryByRole('table')` inside the region
    // must be absent) passed trivially because the region never renders ANY table element --
    // it would pass even if the sr-only table were deleted entirely. Replaced with a real
    // positive-and-negative check: the table must exist in the document (positive) AND must
    // specifically NOT be a descendant of the scroll region (negative) -- this fails if a
    // regression moves the table inside the region, and also fails if the table is removed.
    render(<Phase2GanttChart />);

    const region = screen.getByTestId('scroll-fade-region');
    // The visual grid content lives inside the scroll region.
    expect(within(region).getByText('Project Tasks')).toBeInTheDocument();

    const table = screen.getByRole('table', { hidden: true });
    expect(table).toBeInTheDocument();
    expect(region.contains(table)).toBe(false);
  });

  it('hides the scroll container from AT without leaving a keyboard-focusable element inside it (P3-1)', () => {
    // Round-2 wrapped the whole ScrollFadeRegion in an outer `aria-hidden="true"` div. That
    // hid content from AT (positive: still true here) but left the `overflow-x-auto` scroll
    // container -- implicitly tabbable in Chrome 127+ once it has no focusable children --
    // reachable by keyboard inside a hidden subtree (axe aria-hidden-focus). Two-sided:
    //  - Positive: the scroll container itself carries aria-hidden="true" (content is still
    //    hidden from AT; the sr-only table is the equivalent) AND tabIndex="-1" (removed from
    //    the tab order), so a keyboard user cannot land on it.
    //  - Negative: there is no separate outer wrapper div with aria-hidden="true" around the
    //    whole region (the fix moved the attribute onto the scroll container, it did not just
    //    add a second one) -- the region root itself must NOT carry aria-hidden.
    render(<Phase2GanttChart />);

    const region = screen.getByTestId('scroll-fade-region');
    expect(region.getAttribute('aria-hidden')).toBeNull();
    expect(region.parentElement?.getAttribute('aria-hidden')).toBeNull();

    const scrollContainer = region.querySelector('[aria-hidden="true"]');
    expect(scrollContainer).not.toBeNull();
    expect(scrollContainer?.getAttribute('tabindex')).toBe('-1');
    expect(within(region).getByText('Project Tasks')).toBeInTheDocument();
  });
});
