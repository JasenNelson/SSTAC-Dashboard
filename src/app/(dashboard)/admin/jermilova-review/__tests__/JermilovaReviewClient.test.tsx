/**
 * Tests for JermilovaReviewClient -- admin pool view for Jermilova
 * collaborative reviews. Focuses on the filter behavior, status counts,
 * and per-row comment rendering. The server component does auth + role
 * gate + RLS-safe fetch; the client purely renders.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import JermilovaReviewClient, {
  type JermilovaReview,
} from '../JermilovaReviewClient';

// Stub AdminFunctionsNav to keep tests focused on the pool view.
vi.mock('@/components/dashboard/AdminFunctionsNav', () => ({
  default: () => <div data-testid="admin-functions-nav" />,
}));

// Next/navigation usePathname is referenced transitively by the stubbed
// nav, but the stub above replaces the consumer. No mock needed.

const fixtureReviews: JermilovaReview[] = [
  {
    id: 'r1',
    user_id: 'u1',
    email: 'alice@example.com',
    status: 'SUBMITTED',
    comments_data: {
      General: 'Strong methodology paper overall.',
      'Part IV CPT Fitting': 'The BDeu walkthrough is clear.',
    },
    created_at: '2026-05-17T10:00:00Z',
    updated_at: '2026-05-17T11:00:00Z',
  },
  {
    id: 'r2',
    user_id: 'u2',
    email: 'bob@example.com',
    status: 'IN_PROGRESS',
    comments_data: { General: 'Still reading.' },
    created_at: '2026-05-17T09:00:00Z',
    updated_at: '2026-05-17T09:30:00Z',
  },
  {
    id: 'r3',
    user_id: 'u3',
    email: 'carol@example.com',
    status: 'SUBMITTED',
    comments_data: {},
    created_at: '2026-05-17T08:00:00Z',
    updated_at: '2026-05-17T08:00:00Z',
  },
  // Hostile row: __proto__ as a section name must NEVER render.
  {
    id: 'r4',
    user_id: 'u4',
    email: 'mallory@example.com',
    status: 'SUBMITTED',
    comments_data: {
      __proto__: 'pollution attempt',
      'Safe Section': 'legitimate comment',
    },
    created_at: '2026-05-17T07:00:00Z',
    updated_at: '2026-05-17T07:00:00Z',
  },
];

describe('JermilovaReviewClient', () => {
  it('renders status counts (total, submitted, in-progress)', () => {
    render(<JermilovaReviewClient reviews={fixtureReviews} />);
    // 4 total reviews; 3 submitted (alice, carol, mallory); 1 in-progress (bob).
    // Use heading + sibling pattern -- the counts are large <p> elements.
    expect(screen.getByText('4')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
  });

  it('lists every review row by default', () => {
    render(<JermilovaReviewClient reviews={fixtureReviews} />);
    const rows = screen.getAllByTestId('jermilova-admin-review-row');
    expect(rows).toHaveLength(4);
    expect(screen.getByText('alice@example.com')).toBeInTheDocument();
    expect(screen.getByText('bob@example.com')).toBeInTheDocument();
    expect(screen.getByText('carol@example.com')).toBeInTheDocument();
  });

  it('filters by email search (case-insensitive substring)', () => {
    render(<JermilovaReviewClient reviews={fixtureReviews} />);
    fireEvent.change(screen.getByTestId('jermilova-admin-search'), {
      target: { value: 'ALICE' },
    });
    const rows = screen.getAllByTestId('jermilova-admin-review-row');
    expect(rows).toHaveLength(1);
    expect(screen.getByText('alice@example.com')).toBeInTheDocument();
  });

  it('filters by status = SUBMITTED', () => {
    render(<JermilovaReviewClient reviews={fixtureReviews} />);
    fireEvent.change(screen.getByTestId('jermilova-admin-status-filter'), {
      target: { value: 'SUBMITTED' },
    });
    const rows = screen.getAllByTestId('jermilova-admin-review-row');
    // alice + carol + mallory
    expect(rows).toHaveLength(3);
    expect(screen.queryByText('bob@example.com')).toBeNull();
  });

  it('filters by status = IN_PROGRESS', () => {
    render(<JermilovaReviewClient reviews={fixtureReviews} />);
    fireEvent.change(screen.getByTestId('jermilova-admin-status-filter'), {
      target: { value: 'IN_PROGRESS' },
    });
    const rows = screen.getAllByTestId('jermilova-admin-review-row');
    expect(rows).toHaveLength(1);
    expect(screen.getByText('bob@example.com')).toBeInTheDocument();
  });

  it('shows "No comments provided" for empty comment payloads', () => {
    render(<JermilovaReviewClient reviews={fixtureReviews} />);
    // carol's row has comments_data = {}
    expect(screen.getByText(/No comments provided/i)).toBeInTheDocument();
  });

  it('renders General + per-section comments for non-empty rows', () => {
    render(<JermilovaReviewClient reviews={fixtureReviews} />);
    // alice has 2 sections; their content must appear in the DOM.
    expect(
      screen.getByText('Strong methodology paper overall.'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('The BDeu walkthrough is clear.'),
    ).toBeInTheDocument();
    // alice + bob each have a "General" section; both must render.
    expect(screen.getAllByText('General')).toHaveLength(2);
    expect(screen.getByText('Part IV CPT Fitting')).toBeInTheDocument();
  });

  it('NEVER renders __proto__ as a section name even if present in comments_data', () => {
    render(<JermilovaReviewClient reviews={fixtureReviews} />);
    // mallory's row: __proto__ section + Safe Section.
    expect(screen.getByText('Safe Section')).toBeInTheDocument();
    expect(screen.getByText('legitimate comment')).toBeInTheDocument();
    // __proto__ MUST NOT appear as a rendered section label.
    expect(screen.queryByText('__proto__')).toBeNull();
    expect(screen.queryByText('pollution attempt')).toBeNull();
  });

  it('renders a fetch-error banner when the server reports a Supabase fetch failure (codex 2026-05-17 P2)', () => {
    render(
      <JermilovaReviewClient
        reviews={[]}
        fetchError="permission denied for table document_reviews"
      />,
    );
    const banner = screen.getByTestId('jermilova-admin-fetch-error');
    expect(banner).toBeInTheDocument();
    expect(banner).toHaveTextContent(/Could not load review submissions/i);
    expect(banner).toHaveTextContent(/permission denied for table document_reviews/);
    // Treat-as-load-failure clarification text is included.
    expect(banner).toHaveTextContent(/treat the zero/i);
  });

  it('does NOT render the fetch-error banner when fetchError is null/undefined', () => {
    render(<JermilovaReviewClient reviews={fixtureReviews} />);
    expect(screen.queryByTestId('jermilova-admin-fetch-error')).toBeNull();
  });

  it('shows a no-match message when filters narrow to zero rows', () => {
    render(<JermilovaReviewClient reviews={fixtureReviews} />);
    fireEvent.change(screen.getByTestId('jermilova-admin-search'), {
      target: { value: 'no-such-user-zzzz' },
    });
    expect(
      screen.getByText(/No reviews match the current filters/i),
    ).toBeInTheDocument();
    expect(screen.queryAllByTestId('jermilova-admin-review-row')).toHaveLength(0);
  });
});
