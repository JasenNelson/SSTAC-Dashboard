import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

import MatrixOptionsPrimaryNavigation from '../MatrixOptionsPrimaryNavigation';

describe('MatrixOptionsPrimaryNavigation', () => {
  beforeEach(() => push.mockReset());

  it('preserves all seven stable IDs and legacy local TWG Review behavior when disabled', () => {
    const onSelectView = vi.fn();
    render(<MatrixOptionsPrimaryNavigation activeViewId="The Guide" onSelectView={onSelectView} paperWorkspaceEnabled={false} panelId="panel" />);
    expect(screen.getAllByRole('tab')).toHaveLength(7);
    fireEvent.click(screen.getByRole('tab', { name: 'TWG Review' }));
    expect(onSelectView).toHaveBeenCalledWith('TWG Review');
    expect(push).not.toHaveBeenCalled();
  });

  it('routes TWG Review to the Options Paper when enabled', () => {
    render(<MatrixOptionsPrimaryNavigation activeViewId="The Guide" onSelectView={vi.fn()} paperWorkspaceEnabled />);
    fireEvent.click(screen.getByRole('tab', { name: 'TWG Review' }));
    expect(push).toHaveBeenCalledWith('/matrix-options/paper');
  });

  it('provides manual arrow-key focus without activating a view', () => {
    const onSelectView = vi.fn();
    render(<MatrixOptionsPrimaryNavigation activeViewId="The Guide" onSelectView={onSelectView} paperWorkspaceEnabled={false} />);
    const guide = screen.getByRole('tab', { name: 'Guide' });
    guide.focus();
    fireEvent.keyDown(guide, { key: 'ArrowRight' });
    expect(screen.getByRole('tab', { name: 'Modernizing Schedule 3.4' })).toHaveFocus();
    expect(onSelectView).not.toHaveBeenCalled();
  });

  it('returns from the paper shell to a query-selected dashboard view', () => {
    render(<MatrixOptionsPrimaryNavigation activeViewId="TWG Review" paperWorkspaceEnabled panelId="paper-panel" paperRoute />);
    expect(screen.getByRole('tab', { name: 'Options Paper' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Options Paper' })).toHaveAttribute('aria-controls', 'paper-panel');
    expect(screen.getByRole('tab', { name: 'Calculator' })).not.toHaveAttribute('aria-controls');
    fireEvent.click(screen.getByRole('tab', { name: 'Calculator' }));
    expect(push).toHaveBeenCalledWith('/matrix-options?view=Calculator');
  });
});
