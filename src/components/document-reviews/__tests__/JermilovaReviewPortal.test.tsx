/**
 * Tests for JermilovaReviewPortal -- collaborative-review portal forked
 * from TWGReviewPortal. The core safety behaviors (prototype-pollution,
 * MAX_CHARS clip, payload shape, user_id never in UPDATE) mirror the
 * TWGReviewPortal test contract; this suite adds coverage for the two
 * material UX differences:
 *
 *   - Initial DB load + pre-population from existing document_reviews row.
 *   - Save-edit-resubmit: status flip does not navigate away; user stays
 *     editable + can re-submit.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import JermilovaReviewPortal from '../JermilovaReviewPortal';
import { createClient } from '@/lib/supabase/client';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyFn = any;

vi.mock('@/lib/supabase/client', () => ({
  createClient: vi.fn(),
}));

vi.mock('../../MathRenderer', () => ({
  default: ({ content }: { content: string }) => (
    <div data-testid="math-renderer-mock">{content.slice(0, 50)}</div>
  ),
}));

const DOCUMENT_ID = 'jermilova_bnrrm';
const DRAFT_STORAGE_KEY_FOR_TEST = `document-review-draft-${DOCUMENT_ID}-v1`;

describe('JermilovaReviewPortal', () => {
  const mockInsert = vi.fn();
  const mockUpdate = vi.fn();
  const mockFrom = vi.fn();
  const mockGetUser = vi.fn();

  // SELECT chain: .from('document_reviews').select(...).eq('user_id', X).eq('document_id', Y).maybeSingle()
  function buildSelectChain(result: { data: unknown; error: unknown }) {
    const maybeSingle = vi.fn().mockResolvedValue(result);
    const eqDoc = vi.fn(() => ({ maybeSingle }));
    const eqUser = vi.fn(() => ({ eq: eqDoc }));
    const select = vi.fn(() => ({ eq: eqUser }));
    return { select, eqUser, eqDoc, maybeSingle };
  }

  // UPDATE chain: .update({...}).eq('id', X)
  function buildUpdateChain(result: { error: unknown }) {
    const eq = vi.fn().mockResolvedValue(result);
    mockUpdate.mockReturnValue({ eq });
    return { eq };
  }

  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();

    mockInsert.mockResolvedValue({ error: null });
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'test-user-123' } },
      error: null,
    });

    (createClient as AnyFn).mockReturnValue({
      auth: { getUser: mockGetUser },
      from: mockFrom,
    });

    vi.spyOn(window, 'alert').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('shows "Sign in required" when getUser returns no user', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null }, error: null });
    // Need a from() stub even though it won't be called, since render
    // synchronously kicks off the load effect.
    const lookup = buildSelectChain({ data: null, error: null });
    mockFrom.mockReturnValue({ select: lookup.select });

    render(<JermilovaReviewPortal methodologyContent={'## A\nbody'} />);
    expect(await screen.findByText(/Sign in required/i)).toBeInTheDocument();
  });

  it('on mount: fetches user + selects from document_reviews scoped to user_id + document_id', async () => {
    const lookup = buildSelectChain({ data: null, error: null });
    mockFrom.mockReturnValue({
      select: lookup.select,
      insert: mockInsert,
      update: mockUpdate,
    });

    render(<JermilovaReviewPortal methodologyContent={'## Section A\nbody'} />);

    await waitFor(() => {
      expect(mockGetUser).toHaveBeenCalled();
      expect(mockFrom).toHaveBeenCalledWith('document_reviews');
    });
    // SELECT scoped to (user_id, document_id) -- never spoofable client-side.
    expect(lookup.eqUser).toHaveBeenCalledWith('user_id', 'test-user-123');
    expect(lookup.eqDoc).toHaveBeenCalledWith('document_id', DOCUMENT_ID);
  });

  it('pre-populates comments + status from an existing DB row', async () => {
    const lookup = buildSelectChain({
      data: {
        id: 'existing-row-1',
        status: 'SUBMITTED',
        comments_data: { General: 'Looks good', 'Section A': 'Detail A' },
        updated_at: '2026-05-17T12:00:00Z',
      },
      error: null,
    });
    mockFrom.mockReturnValue({
      select: lookup.select,
      insert: mockInsert,
      update: mockUpdate,
    });

    render(<JermilovaReviewPortal methodologyContent={'## Section A\nbody'} />);

    // Wait for the load to complete (loading spinner replaced by content).
    const general = await screen.findByPlaceholderText(/Overall thoughts on the methodology/i);
    await waitFor(() => {
      expect((general as HTMLTextAreaElement).value).toBe('Looks good');
    });
    const sectionA = screen.getByPlaceholderText(/Specific feedback for Section A/i);
    expect((sectionA as HTMLTextAreaElement).value).toBe('Detail A');
    // SUBMITTED badge is rendered.
    expect(screen.getByText(/^Submitted$/)).toBeInTheDocument();
    // Resubmit label (not Submit Review) since status=SUBMITTED on load.
    expect(screen.getByRole('button', { name: /Re-submit/i })).toBeInTheDocument();
  });

  it('saves: INSERTs a new row with user_id + document_id + status=IN_PROGRESS when no row exists', async () => {
    const lookup = buildSelectChain({ data: null, error: null });
    mockFrom.mockReturnValue({
      select: lookup.select,
      insert: mockInsert,
      update: mockUpdate,
    });

    render(<JermilovaReviewPortal methodologyContent={'## Section A\nbody'} />);
    const general = await screen.findByPlaceholderText(/Overall thoughts/i);
    fireEvent.change(general, { target: { value: 'First pass' } });
    fireEvent.click(screen.getByTestId('jermilova-review-save'));

    await waitFor(() => expect(mockInsert).toHaveBeenCalledTimes(1));
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'test-user-123',
        document_id: DOCUMENT_ID,
        status: 'IN_PROGRESS',
        comments_data: expect.objectContaining({ General: 'First pass' }),
      }),
    );
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('submit: flips status to SUBMITTED + UPDATEs existing row (never carries user_id in UPDATE payload)', async () => {
    const lookup = buildSelectChain({
      data: {
        id: 'existing-row-2',
        status: 'IN_PROGRESS',
        comments_data: {},
        updated_at: '2026-05-17T10:00:00Z',
      },
      error: null,
    });
    const updateChain = buildUpdateChain({ error: null });
    mockFrom.mockReturnValue({
      select: lookup.select,
      insert: mockInsert,
      update: mockUpdate,
    });

    render(<JermilovaReviewPortal methodologyContent={'## Section A\nbody'} />);
    // Wait for load + ensure status badge NOT yet showing.
    await screen.findByPlaceholderText(/Overall thoughts/i);

    fireEvent.click(screen.getByTestId('jermilova-review-submit'));

    await waitFor(() => expect(mockUpdate).toHaveBeenCalledTimes(1));
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'SUBMITTED' }),
    );
    // user_id MUST NOT appear in the UPDATE payload -- column-level GRANT
    // would reject it, and we don't want to trust the API to do the
    // rejection on its own.
    expect(mockUpdate.mock.calls[0][0]).not.toHaveProperty('user_id');
    expect(mockUpdate.mock.calls[0][0]).not.toHaveProperty('document_id');
    expect(mockUpdate.mock.calls[0][0]).not.toHaveProperty('id');
    expect(updateChain.eq).toHaveBeenCalledWith('id', 'existing-row-2');
    // After SUBMITTED, the badge shows; user STAYS on the editing screen
    // (save-edit-resubmit semantics).
    expect(await screen.findByText(/^Submitted$/)).toBeInTheDocument();
    // The textareas remain mounted + editable (no navigation away).
    expect(screen.getByPlaceholderText(/Overall thoughts/i)).toBeInTheDocument();
  });

  it('save after SUBMITTED: keeps status=SUBMITTED on subsequent saves', async () => {
    const lookup = buildSelectChain({
      data: {
        id: 'existing-row-3',
        status: 'SUBMITTED',
        comments_data: { General: 'Old' },
        updated_at: '2026-05-17T08:00:00Z',
      },
      error: null,
    });
    const updateChain = buildUpdateChain({ error: null });
    mockFrom.mockReturnValue({
      select: lookup.select,
      insert: mockInsert,
      update: mockUpdate,
    });

    render(<JermilovaReviewPortal methodologyContent={'## A\nbody'} />);
    const general = await screen.findByPlaceholderText(/Overall thoughts/i);
    await waitFor(() => {
      expect((general as HTMLTextAreaElement).value).toBe('Old');
    });
    fireEvent.change(general, { target: { value: 'Edited after submit' } });
    fireEvent.click(screen.getByTestId('jermilova-review-save'));

    await waitFor(() => expect(mockUpdate).toHaveBeenCalledTimes(1));
    // Save preserves SUBMITTED -- does NOT flip status back to IN_PROGRESS.
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'SUBMITTED',
        comments_data: expect.objectContaining({ General: 'Edited after submit' }),
      }),
    );
    expect(updateChain.eq).toHaveBeenCalledWith('id', 'existing-row-3');
  });

  it('merges per-key against the latest remote payload (codex R1 P1 fix: two-tab data loss)', async () => {
    // Simulates two tabs: this tab opens with remote {Section B: 'from tab B'},
    // user edits ONLY Section A in this tab, clicks Save. Expected UPDATE
    // payload preserves Section B (we didn't touch it) and adds Section A
    // (this tab's dirty key). Whole-row last-writer-wins would drop B.
    const lookup = buildSelectChain({
      data: {
        id: 'existing-row-merge',
        status: 'IN_PROGRESS',
        comments_data: { 'Section B': 'from tab B' },
        updated_at: '2026-05-17T10:00:00Z',
      },
      error: null,
    });
    const updateChain = buildUpdateChain({ error: null });
    mockFrom.mockReturnValue({
      select: lookup.select,
      insert: mockInsert,
      update: mockUpdate,
    });

    const md = '## Section A\nbodyA\n## Section B\nbodyB';
    render(<JermilovaReviewPortal methodologyContent={md} />);

    // Wait for load -- Section B should pre-populate.
    const sectionB = await screen.findByPlaceholderText(/Specific feedback for Section B/i);
    await waitFor(() => {
      expect((sectionB as HTMLTextAreaElement).value).toBe('from tab B');
    });

    // Edit Section A ONLY (this tab's dirty key).
    const sectionA = screen.getByPlaceholderText(/Specific feedback for Section A/i);
    fireEvent.change(sectionA, { target: { value: 'from this tab' } });

    fireEvent.click(screen.getByTestId('jermilova-review-save'));
    await waitFor(() => expect(mockUpdate).toHaveBeenCalledTimes(1));

    const updatePayload = mockUpdate.mock.calls[0][0] as {
      comments_data: Record<string, string>;
    };
    // Section B must be preserved (we never touched it in this tab).
    expect(updatePayload.comments_data['Section B']).toBe('from tab B');
    // Section A must be added (this tab's dirty key).
    expect(updatePayload.comments_data['Section A']).toBe('from this tab');
    expect(updateChain.eq).toHaveBeenCalledWith('id', 'existing-row-merge');
  });

  it('clearing a dirty key removes it from the merged payload', async () => {
    // User loaded remote {General: 'Old', Section A: 'Keep'}. User cleared
    // General in this tab. Save should DELETE General from the payload
    // (not write empty string) so the admin pool reflects the deletion.
    const lookup = buildSelectChain({
      data: {
        id: 'existing-row-clear',
        status: 'IN_PROGRESS',
        comments_data: { General: 'Old', 'Section A': 'Keep' },
        updated_at: '2026-05-17T11:00:00Z',
      },
      error: null,
    });
    buildUpdateChain({ error: null });
    mockFrom.mockReturnValue({
      select: lookup.select,
      insert: mockInsert,
      update: mockUpdate,
    });

    render(<JermilovaReviewPortal methodologyContent={'## Section A\nbody'} />);
    const general = await screen.findByPlaceholderText(/Overall thoughts/i);
    await waitFor(() => {
      expect((general as HTMLTextAreaElement).value).toBe('Old');
    });
    fireEvent.change(general, { target: { value: '' } });

    fireEvent.click(screen.getByTestId('jermilova-review-save'));
    await waitFor(() => expect(mockUpdate).toHaveBeenCalledTimes(1));

    const updatePayload = mockUpdate.mock.calls[0][0] as {
      comments_data: Record<string, string>;
    };
    expect(updatePayload.comments_data).not.toHaveProperty('General');
    expect(updatePayload.comments_data['Section A']).toBe('Keep');
  });

  it('Save does NOT downgrade a remote SUBMITTED row back to IN_PROGRESS (codex R2 P2-1)', async () => {
    // Two-tab scenario: this tab loaded as IN_PROGRESS (matches what was
    // remote at load time). Tab B subsequently flipped the remote row to
    // SUBMITTED. This tab later clicks Save (NOT Submit). The persistToDb
    // SELECT picks up the now-SUBMITTED remote status; the write MUST
    // preserve SUBMITTED, not send statusIntent=save -> IN_PROGRESS.
    let selectCallCount = 0;
    const maybeSingle = vi.fn().mockImplementation(() => {
      selectCallCount += 1;
      if (selectCallCount === 1) {
        // Initial load: this tab sees IN_PROGRESS.
        return Promise.resolve({
          data: {
            id: 'row-stale',
            status: 'IN_PROGRESS',
            comments_data: {},
            updated_at: '2026-05-17T10:00:00Z',
          },
          error: null,
        });
      }
      // persistToDb re-SELECT: another tab has since flipped to SUBMITTED.
      return Promise.resolve({
        data: {
          id: 'row-stale',
          status: 'SUBMITTED',
          comments_data: {},
        },
        error: null,
      });
    });
    const eqDoc = vi.fn(() => ({ maybeSingle }));
    const eqUser = vi.fn(() => ({ eq: eqDoc }));
    const select = vi.fn(() => ({ eq: eqUser }));
    const updateChain = buildUpdateChain({ error: null });
    mockFrom.mockReturnValue({ select, insert: mockInsert, update: mockUpdate });

    render(<JermilovaReviewPortal methodologyContent={'## A\nbody'} />);
    const general = await screen.findByPlaceholderText(/Overall thoughts/i);
    fireEvent.change(general, { target: { value: 'edit from stale tab' } });
    fireEvent.click(screen.getByTestId('jermilova-review-save'));

    await waitFor(() => expect(mockUpdate).toHaveBeenCalledTimes(1));
    const updatePayload = mockUpdate.mock.calls[0][0] as { status: string };
    // CRITICAL: must NOT downgrade to IN_PROGRESS even though this tab's
    // in-memory status was IN_PROGRESS. Remote SUBMITTED wins for Save.
    expect(updatePayload.status).toBe('SUBMITTED');
    expect(updateChain.eq).toHaveBeenCalledWith('id', 'row-stale');
  });

  it('Submit ALWAYS sets SUBMITTED even if remote was somehow IN_PROGRESS (intent dominates)', async () => {
    const lookup = buildSelectChain({
      data: {
        id: 'row-submit',
        status: 'IN_PROGRESS',
        comments_data: {},
        updated_at: '2026-05-17T11:00:00Z',
      },
      error: null,
    });
    buildUpdateChain({ error: null });
    mockFrom.mockReturnValue({
      select: lookup.select,
      insert: mockInsert,
      update: mockUpdate,
    });

    render(<JermilovaReviewPortal methodologyContent={'## A\nbody'} />);
    await screen.findByPlaceholderText(/Overall thoughts/i);
    fireEvent.click(screen.getByTestId('jermilova-review-submit'));

    await waitFor(() => expect(mockUpdate).toHaveBeenCalledTimes(1));
    expect(mockUpdate.mock.calls[0][0]).toMatchObject({ status: 'SUBMITTED' });
  });

  it('restored localStorage draft is marked dirty so Save persists it (codex R2 P1-2)', async () => {
    // No DB row, but localStorage has a draft -- the portal should
    // pre-populate from the draft AND mark those keys as dirty so the
    // next Save actually persists them (otherwise the draft would be
    // displayed but never saved).
    window.localStorage.setItem(
      DRAFT_STORAGE_KEY_FOR_TEST,
      JSON.stringify({ general: 'restored draft text' }),
    );
    const lookup = buildSelectChain({ data: null, error: null });
    mockFrom.mockReturnValue({
      select: lookup.select,
      insert: mockInsert,
      update: mockUpdate,
    });

    render(<JermilovaReviewPortal methodologyContent={'## A\nbody'} />);
    const general = await screen.findByPlaceholderText(/Overall thoughts/i);
    await waitFor(() => {
      expect((general as HTMLTextAreaElement).value).toBe('restored draft text');
    });
    // Click Save without typing -- the restored draft must persist.
    fireEvent.click(screen.getByTestId('jermilova-review-save'));
    await waitFor(() => expect(mockInsert).toHaveBeenCalledTimes(1));
    // First-time save -> INSERT (no existing row).
    expect(mockInsert.mock.calls[0][0]).toMatchObject({
      comments_data: { General: 'restored draft text' },
    });
  });

  it('a throw on initial load (not a returned selectErr) also disables writes (codex R2 P2-2)', async () => {
    // getUser throws instead of returning {error}.
    mockGetUser.mockRejectedValueOnce(new Error('auth client crashed'));
    const lookup = buildSelectChain({ data: null, error: null });
    mockFrom.mockReturnValue({
      select: lookup.select,
      insert: mockInsert,
      update: mockUpdate,
    });

    render(<JermilovaReviewPortal methodologyContent={'## A\nbody'} />);
    await screen.findByText(/Could not load your existing review/i);
    expect(screen.getByTestId('jermilova-review-save')).toBeDisabled();
    expect(screen.getByTestId('jermilova-review-submit')).toBeDisabled();
    fireEvent.click(screen.getByTestId('jermilova-review-save'));
    fireEvent.click(screen.getByTestId('jermilova-review-submit'));
    expect(mockInsert).not.toHaveBeenCalled();
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('disables Save/Submit when the initial DB load fails (codex R1 P2 fix)', async () => {
    // The initial-load SELECT errors out. The portal must NOT issue any
    // writes -- otherwise the next Save would overwrite the remote row
    // with locally-empty state.
    const lookup = buildSelectChain({
      data: null,
      error: { message: 'network timeout' },
    });
    mockFrom.mockReturnValue({
      select: lookup.select,
      insert: mockInsert,
      update: mockUpdate,
    });

    render(<JermilovaReviewPortal methodologyContent={'## A\nbody'} />);
    // Wait for the load-failure banner to render.
    await screen.findByText(/Could not load your existing review/i);
    // Buttons are disabled.
    const save = screen.getByTestId('jermilova-review-save');
    const submit = screen.getByTestId('jermilova-review-submit');
    expect(save).toBeDisabled();
    expect(submit).toBeDisabled();
    // Even if a click somehow reaches the handler, no DB write fires
    // (the handler alerts + returns early).
    fireEvent.click(save);
    fireEvent.click(submit);
    expect(mockInsert).not.toHaveBeenCalled();
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('disambiguates duplicate H2 headings + rejects prototype-pollution keys from the payload', async () => {
    const lookup = buildSelectChain({ data: null, error: null });
    mockFrom.mockReturnValue({
      select: lookup.select,
      insert: mockInsert,
      update: mockUpdate,
    });

    const md = `
## Conclusions
first body
## __proto__
hostile body
## Conclusions
second body
    `;
    render(<JermilovaReviewPortal methodologyContent={md} />);
    const first = await screen.findByPlaceholderText('Specific feedback for Conclusions (#1)...');
    const second = screen.getByPlaceholderText('Specific feedback for Conclusions (#2)...');
    fireEvent.change(first, { target: { value: 'first comment' } });
    fireEvent.change(second, { target: { value: 'second comment' } });
    const proto = screen.queryByPlaceholderText('Specific feedback for __proto__...');
    if (proto) {
      fireEvent.change(proto, { target: { value: 'attack' } });
    }

    fireEvent.click(screen.getByTestId('jermilova-review-submit'));
    await waitFor(() => expect(mockInsert).toHaveBeenCalledTimes(1));
    const payload = mockInsert.mock.calls[0][0].comments_data as Record<string, string>;
    expect(payload).toEqual(
      expect.objectContaining({
        'Conclusions (#1)': 'first comment',
        'Conclusions (#2)': 'second comment',
      }),
    );
    expect(Object.keys(payload)).not.toContain('__proto__');
  });
});
