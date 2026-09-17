import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import MatrixOptionsPaperError from '@/app/(dashboard)/matrix-options/paper/error';
import MatrixOptionsPaperLoading from '@/app/(dashboard)/matrix-options/paper/loading';
import MatrixOptionsPaperNotFound from '@/app/(dashboard)/matrix-options/paper/not-found';

describe('Paper reader route states', () => {
  it('announces loading without requiring motion', () => {
    render(<MatrixOptionsPaperLoading />);
    expect(screen.getByText('Loading Options Paper section')).toBeInTheDocument();
    expect(screen.queryByRole('main')).not.toBeInTheDocument();
    expect(screen.getByText('Loading Options Paper section').parentElement).toHaveAttribute('aria-busy', 'true');
  });

  it('fails closed and offers an explicit retry after provider or integrity failure', () => {
    const reset = vi.fn();
    render(<MatrixOptionsPaperError error={new Error('sensitive detail')} reset={reset} />);
    expect(screen.queryByRole('main')).not.toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('No unverified content was displayed');
    expect(screen.queryByText('sensitive detail')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Retry verified load' }));
    expect(reset).toHaveBeenCalledOnce();
  });

  it('describes an unknown stable identity without falling back to other content', () => {
    render(<MatrixOptionsPaperNotFound />);
    expect(screen.queryByRole('main')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Paper version or section not found' })).toBeVisible();
    expect(screen.getByRole('link', { name: 'Open the current verified paper' })).toHaveAttribute('href', '/matrix-options/paper');
  });
});
