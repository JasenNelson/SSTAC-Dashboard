import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import PartialVisibilityBanner, {
  type PartialVisibilityBannerProps,
} from './PartialVisibilityBanner';

const HIDDEN_DRA_ID = '11111111-2222-3333-4444-555555555555';

function renderBanner(
  overrides: Partial<PartialVisibilityBannerProps> = {},
) {
  const props: PartialVisibilityBannerProps = {
    hiddenSampleCount: 3,
    hiddenDraCount: 2,
    hiddenDraIds: [HIDDEN_DRA_ID],
    contactEmail: 'matrix-admin@example.com',
    onRefresh: vi.fn(),
    ...overrides,
  };

  const view = render(<PartialVisibilityBanner {...props} />);
  return { ...view, props };
}

describe('PartialVisibilityBanner', () => {
  it('renders when hiddenSampleCount is greater than zero', () => {
    renderBanner();

    expect(
      screen.getByText('Hidden samples behind private DRAs'),
    ).toBeInTheDocument();
  });

  it('does not render when hiddenSampleCount is zero', () => {
    renderBanner({ hiddenSampleCount: 0 });

    expect(
      screen.queryByTestId('matrix-map-partial-visibility-banner'),
    ).not.toBeInTheDocument();
  });

  it('renders the hidden sample and DRA count string', () => {
    renderBanner({ hiddenSampleCount: 12, hiddenDraCount: 4 });

    expect(
      screen.getByText(
        '12 sample(s) across 4 data review assessment(s) are hidden because access is restricted.',
      ),
    ).toBeInTheDocument();
  });

  it('calls onRefresh when the refresh button is clicked', () => {
    const onRefresh = vi.fn();
    renderBanner({ onRefresh });

    fireEvent.click(
      screen.getByRole('button', { name: 'Refresh matrix map samples' }),
    );

    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it('renders a mailto contact admin link', () => {
    renderBanner();

    expect(screen.getByRole('link', { name: 'Contact admin' })).toHaveAttribute(
      'href',
      expect.stringContaining('mailto:matrix-admin@example.com'),
    );
  });

  it('does not leak hidden DRA UUIDs into rendered output', () => {
    const { container } = renderBanner();

    expect(container.innerHTML).not.toContain(HIDDEN_DRA_ID);
  });
});
