import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import {
  REVIEW_SUBMISSION_STATUSES,
  type ReviewSubmissionStatus,
} from '@/types/database';

// Mock the authenticated Supabase client factory used by BOTH the db query
// layer (src/lib/db/queries.ts) and the api client (src/lib/api/client.ts).
// Both import createAuthenticatedClient from '@/lib/supabase-auth'.
vi.mock('@/lib/supabase-auth', () => ({
  createAuthenticatedClient: vi.fn(),
}));

import { createAuthenticatedClient } from '@/lib/supabase-auth';
import {
  createReviewSubmission,
  submitReviewSubmission,
} from '@/lib/db/queries';
import { getApiClient, resetApiClient } from '@/lib/api/client';

// Capture every payload written to review_submissions (insert + update).
const writtenPayloads: Array<Record<string, unknown>> = [];

// A terminal result object that is awaitable (resolves to { data, error })
// AND exposes .single()/.eq() so it works for both call styles:
//   queries.ts:    .insert(p).single()  /  .update(p).eq().single()
//   api client.ts: .insert(p)           /  .update(p).eq()
interface MockTerminal {
  single: Mock;
  eq: Mock;
  then: (resolve: (v: { data: null; error: null }) => unknown) => unknown;
}

function makeTerminal(): MockTerminal {
  const result = { data: null, error: null };
  const terminal: MockTerminal = {
    single: vi.fn(async () => result),
    eq: vi.fn(() => terminal),
    then: (resolve: (v: typeof result) => unknown) => resolve(result),
  };
  return terminal;
}

function buildMockClient() {
  const insert = vi.fn((payload: Record<string, unknown>) => {
    writtenPayloads.push(payload);
    return makeTerminal();
  });
  const update = vi.fn((payload: Record<string, unknown>) => {
    writtenPayloads.push(payload);
    return makeTerminal();
  });
  const from = vi.fn((table: string) => {
    expect(table).toBe('review_submissions');
    return { insert, update };
  });
  return { from };
}

describe('review submission status integrity', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    writtenPayloads.length = 0;
    resetApiClient();
    (createAuthenticatedClient as unknown as Mock).mockResolvedValue(buildMockClient());
  });

  it('REVIEW_SUBMISSION_STATUSES matches the DB CHECK constraint set', () => {
    // database_schema.sql:452 CHECK (status IN ('IN_PROGRESS', 'SUBMITTED'))
    expect([...REVIEW_SUBMISSION_STATUSES]).toEqual(['IN_PROGRESS', 'SUBMITTED']);
  });

  it('createReviewSubmission writes a status allowed by the DB CHECK', async () => {
    await createReviewSubmission('user-123', { field: 'value' });

    expect(writtenPayloads).toHaveLength(1);
    const status = writtenPayloads[0].status as ReviewSubmissionStatus;
    expect(REVIEW_SUBMISSION_STATUSES).toContain(status);
    // Concretely: a newly created submission is IN_PROGRESS, never 'draft'.
    expect(status).toBe('IN_PROGRESS');
  });

  it('submitReviewSubmission writes a status allowed by the DB CHECK', async () => {
    await submitReviewSubmission('row-abc');

    expect(writtenPayloads).toHaveLength(1);
    const status = writtenPayloads[0].status as ReviewSubmissionStatus;
    expect(REVIEW_SUBMISSION_STATUSES).toContain(status);
    // Concretely: submitting transitions to SUBMITTED, never 'submitted'.
    expect(status).toBe('SUBMITTED');
  });

  it('apiClient.saveReviewSubmission (insert path) writes an allowed status', async () => {
    await getApiClient().saveReviewSubmission('user-123', { field: 'value' });

    expect(writtenPayloads).toHaveLength(1);
    const status = writtenPayloads[0].status as ReviewSubmissionStatus;
    expect(REVIEW_SUBMISSION_STATUSES).toContain(status);
    expect(status).toBe('IN_PROGRESS');
  });

  it('apiClient.submitReviewSubmission writes an allowed status', async () => {
    await getApiClient().submitReviewSubmission('row-abc');

    expect(writtenPayloads).toHaveLength(1);
    const status = writtenPayloads[0].status as ReviewSubmissionStatus;
    expect(REVIEW_SUBMISSION_STATUSES).toContain(status);
    expect(status).toBe('SUBMITTED');
  });

  it('every captured review_submissions write uses a CHECK-allowed status', async () => {
    await createReviewSubmission('user-1', { a: 1 });
    await submitReviewSubmission('row-1');
    await getApiClient().saveReviewSubmission('user-2', { b: 2 });
    await getApiClient().submitReviewSubmission('row-2');

    expect(writtenPayloads.length).toBeGreaterThanOrEqual(4);
    for (const payload of writtenPayloads) {
      // Only assert on writes that set a status (all four here do).
      if ('status' in payload) {
        expect(REVIEW_SUBMISSION_STATUSES).toContain(
          payload.status as ReviewSubmissionStatus
        );
      }
    }
  });
});
