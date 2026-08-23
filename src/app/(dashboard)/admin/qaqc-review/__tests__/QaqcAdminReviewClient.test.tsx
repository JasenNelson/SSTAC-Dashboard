import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QaqcAdminReviewClient } from '../QaqcAdminReviewClient';
import type { ParameterValueReview } from '@/lib/matrix-options/provenance/qa-review-sync';

vi.mock('@/lib/matrix-options/provenance/qa-review-sync', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/matrix-options/provenance/qa-review-sync')>();
  return {
    ...actual,
    submitReview: vi.fn().mockResolvedValue(true),
    fetchAllReviews: vi.fn().mockResolvedValue([]),
    fetchAllReviewsResult: vi.fn().mockResolvedValue({ success: true, reviews: [], error: null }),
  };
});

const mockReviews: ParameterValueReview[] = [
  {
    id: 'rev-1',
    parameter_value_id: 'pv-hc-benzene-hh-direct-tdi',
    old_qa_status: 'needs_review',
    new_qa_status: 'approved',
    old_evidence_support_status: null,
    new_evidence_support_status: null,
    reviewer_note: '[VERIFICATION: confirmed] Verified against Health Canada TRV Table 1',
    reviewed_by: 'user-toxicologist-1',
    reviewed_at: '2026-08-21T18:00:00Z',
  },
  {
    id: 'rev-2',
    parameter_value_id: 'pv-hc-toluene-hh-direct-iur',
    old_qa_status: 'needs_review',
    new_qa_status: 'needs_review',
    old_evidence_support_status: null,
    new_evidence_support_status: null,
    reviewer_note: '[VERIFICATION: discrepancy] Citation unit is ug/m3 not mg/m3',
    reviewed_by: 'user-toxicologist-2',
    reviewed_at: '2026-08-21T19:00:00Z',
  },
  {
    id: 'rev-3',
    parameter_value_id: 'pv-hc-benzene-hh-direct-iur',
    old_qa_status: 'needs_review',
    new_qa_status: 'needs_review',
    old_evidence_support_status: null,
    new_evidence_support_status: null,
    reviewer_note: '[FLAG: Transcription / Typo Discrepancy] Exponent mismatch on slope factor (Suggested: 1.7e-6)',
    reviewed_by: 'user-toxicologist-1',
    reviewed_at: '2026-08-21T19:30:00Z',
  },
];

describe('QaqcAdminReviewClient', () => {
  it('renders summary statistics correctly and distinguishes verified parameters from total audit events', () => {
    render(<QaqcAdminReviewClient initialReviews={mockReviews} isAdmin={true} />);

    expect(screen.getByText('Parameters Reviewed')).toBeDefined();
    expect(screen.getByText('Confirmed Parameters')).toBeDefined();
    expect(screen.getByText('Discrepancies Flagged')).toBeDefined();
    expect(screen.getByText('Potential Issue Flags')).toBeDefined();

    // 2 unique parameters with verification states (flag-only review excluded from verification count)
    expect(screen.getByText('2')).toBeDefined();
    expect(screen.getByText(/3 events in audit ledger/i)).toBeDefined();
  });

  it('filters verification records by search query', () => {
    render(<QaqcAdminReviewClient initialReviews={mockReviews} isAdmin={true} />);

    const searchInput = screen.getByPlaceholderText(/search parameter/i);
    fireEvent.change(searchInput, { target: { value: 'toluene' } });

    expect(screen.getByText('pv-hc-toluene-hh-direct-iur')).toBeDefined();
    expect(screen.queryByText('pv-hc-benzene-hh-direct-tdi')).toBeNull();
  });

  it('switches to the Flagged Issues Queue tab', () => {
    render(<QaqcAdminReviewClient initialReviews={mockReviews} isAdmin={true} />);

    const flagTabBtn = screen.getByRole('button', { name: /flagged issue queue/i });
    fireEvent.click(flagTabBtn);

    expect(screen.getByText('Transcription / Typo Discrepancy')).toBeDefined();
    expect(screen.getByText('Suggested Correction:')).toBeDefined();
    expect(screen.getByText('1.7e-6')).toBeDefined();
  });

  it('honors reducer fail-closed contradictory states and excludes flag events from verification list', () => {
    const contradictoryReviews: ParameterValueReview[] = [
      {
        id: 'rev-c1',
        parameter_value_id: 'pv-contra-approved-with-discrepancy',
        old_qa_status: 'needs_review',
        new_qa_status: 'approved',
        old_evidence_support_status: null,
        new_evidence_support_status: null,
        reviewer_note: '[VERIFICATION: discrepancy] Fatal mismatch in unit',
        reviewed_by: 'user-1',
        reviewed_at: '2026-08-21T10:00:00Z',
      },
      {
        id: 'rev-c2',
        parameter_value_id: 'pv-contra-needs-review-with-confirmed',
        old_qa_status: 'approved',
        new_qa_status: 'needs_review',
        old_evidence_support_status: null,
        new_evidence_support_status: null,
        reviewer_note: '[VERIFICATION: confirmed] Valid value',
        reviewed_by: 'user-1',
        reviewed_at: '2026-08-21T10:00:00Z',
      },
      {
        id: 'rev-flag-only',
        parameter_value_id: 'pv-flag-only-param',
        old_qa_status: 'needs_review',
        new_qa_status: 'needs_review',
        old_evidence_support_status: null,
        new_evidence_support_status: null,
        reviewer_note: '[FLAG: General Issue] Flagged without verification event',
        reviewed_by: 'user-2',
        reviewed_at: '2026-08-21T11:00:00Z',
      },
    ];

    render(<QaqcAdminReviewClient initialReviews={contradictoryReviews} isAdmin={true} />);

    // Both contradictory cases fail closed to needs_review
    expect(screen.getByText(/pv-contra-approved-with-discrepancy/)).toBeDefined();
    expect(screen.getByText(/pv-contra-needs-review-with-confirmed/)).toBeDefined();

    // Flag-only parameter is excluded from the verifications table
    expect(screen.queryByText('pv-flag-only-param')).toBeNull();

    // Filter by approved should show nothing because both failed closed to needs_review
    const approvedFilterBtn = screen.getByRole('button', { name: /approved/i });
    fireEvent.click(approvedFilterBtn);
    expect(screen.queryByText(/pv-contra-approved-with-discrepancy/)).toBeNull();
    expect(screen.queryByText(/pv-contra-needs-review-with-confirmed/)).toBeNull();
  });

  it('ensures interactive controls satisfy accessible minimum touch target', () => {
    render(<QaqcAdminReviewClient initialReviews={mockReviews} isAdmin={true} />);

    const syncBtn = screen.getByRole('button', { name: /sync database/i });
    expect(syncBtn.className).toContain('min-h-[44px]');

    const exportBtn = screen.getByRole('button', { name: /export/i });
    expect(exportBtn.className).toContain('min-h-[44px]');
  });

  it('cleans up feedback timeout on component unmount without throws', () => {
    const { unmount } = render(<QaqcAdminReviewClient initialReviews={mockReviews} isAdmin={true} />);
    const syncBtn = screen.getByRole('button', { name: /sync database/i });
    fireEvent.click(syncBtn);
    expect(() => unmount()).not.toThrow();
  });
});
