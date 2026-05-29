import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import { CatalogStagingReview } from '../CatalogStagingReview';
import type {
  CatalogStagingRow,
  ListPendingStagingRowsArgs,
} from '@/lib/catalog/staging';

// ---------------------------------------------------------------------------
// Mock staging module so the component's default imports never call the
// real server actions (which require @/lib/supabase-auth + 'use server').
// Tests can also override per-test via the component props.
// ---------------------------------------------------------------------------

vi.mock('@/lib/catalog/staging', () => ({
  listPendingStagingRows: vi.fn(async () => []),
  approveStagingRow: vi.fn(async () => ({ ok: true, promotedToId: 'promoted-default' })),
  rejectStagingRow: vi.fn(async () => ({ ok: true })),
}));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeRow(overrides: Partial<CatalogStagingRow> = {}): CatalogStagingRow {
  return {
    id: 'staging-1',
    source_zotero_key: 'ZK_001',
    source_attachment_path: '/zotero/a.pdf',
    extraction_pass_id: 'pass-1',
    extraction_pass_started_at: '2026-05-27T10:00:00Z',
    extraction_pass_finished_at: null,
    extracted_at: '2026-05-27T10:05:00Z',
    proposed_kind: 'parameter_value',
    proposed_payload: {
      substance_key: 'cadmium',
      value: '0.6',
      unit: 'mg/kg dw',
    },
    confidence: 0.85,
    extraction_notes: 'Page 12, Table 3',
    extraction_model: 'gemma3:12b',
    hitl_status: 'pending',
    hitl_reviewed_by: null,
    hitl_reviewed_at: null,
    hitl_review_notes: null,
    promoted_to_id: null,
    created_by: null,
    created_by_role: 'agent_service_role',
    created_at: '2026-05-27T10:05:00Z',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('CatalogStagingReview', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders empty state when no pending rows', async () => {
    const list = vi.fn(async () => [] as CatalogStagingRow[]);
    render(
      <CatalogStagingReview
        isAdmin
        listPendingStagingRowsFn={list}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId('staging-empty-state')).toBeInTheDocument();
    });
    expect(list).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('staging-row-list')).not.toBeInTheDocument();
  });

  it('renders rows when present and shows confidence + kind', async () => {
    const rows = [
      makeRow({ id: 'staging-A', confidence: 0.9 }),
      makeRow({
        id: 'staging-B',
        proposed_kind: 'evidence_item',
        confidence: 0.5,
        source_zotero_key: 'ZK_002',
      }),
    ];
    const list = vi.fn(async () => rows);

    render(
      <CatalogStagingReview isAdmin listPendingStagingRowsFn={list} />,
    );

    await waitFor(() => {
      expect(screen.getByTestId('staging-row-list')).toBeInTheDocument();
    });
    expect(screen.getByTestId('staging-row-staging-A')).toBeInTheDocument();
    expect(screen.getByTestId('staging-row-staging-B')).toBeInTheDocument();
    expect(screen.getByText(/Parameter value/)).toBeInTheDocument();
    expect(screen.getByText(/Evidence item/)).toBeInTheDocument();
    expect(screen.getByText(/90%/)).toBeInTheDocument();
    expect(screen.getByText(/50%/)).toBeInTheDocument();
    expect(screen.queryByTestId('staging-empty-state')).not.toBeInTheDocument();
  });

  it('admin sees Approve and Reject buttons after selecting a row', async () => {
    const rows = [makeRow({ id: 'staging-1' })];
    const list = vi.fn(async () => rows);

    render(
      <CatalogStagingReview isAdmin listPendingStagingRowsFn={list} />,
    );

    await waitFor(() => {
      expect(screen.getByTestId('staging-row-staging-1')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId('staging-row-staging-1'));

    expect(screen.getByTestId('staging-action-approve')).toBeInTheDocument();
    expect(screen.getByTestId('staging-action-reject')).toBeInTheDocument();
  });

  it('non-admin does NOT see Approve or Reject buttons', async () => {
    const rows = [makeRow({ id: 'staging-1' })];
    const list = vi.fn(async () => rows);

    render(
      <CatalogStagingReview isAdmin={false} listPendingStagingRowsFn={list} />,
    );

    await waitFor(() => {
      expect(screen.getByTestId('staging-row-staging-1')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId('staging-row-staging-1'));

    expect(screen.queryByTestId('staging-action-approve')).not.toBeInTheDocument();
    expect(screen.queryByTestId('staging-action-reject')).not.toBeInTheDocument();
    // Read-only notice is shown in the filter panel.
    expect(
      screen.getByText(/Read-only view: admin role required/),
    ).toBeInTheDocument();
  });

  it('clicking Approve and confirming calls approveStagingRowFn with stagingId and notes', async () => {
    const rows = [makeRow({ id: 'staging-A' })];
    const list = vi.fn(async () => rows);
    const approve = vi.fn(async () => ({ ok: true as const, promotedToId: 'prom-A' }));
    const reject = vi.fn();

    render(
      <CatalogStagingReview
        isAdmin
        listPendingStagingRowsFn={list}
        approveStagingRowFn={approve}
        rejectStagingRowFn={reject}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId('staging-row-staging-A')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId('staging-row-staging-A'));
    fireEvent.click(screen.getByTestId('staging-action-approve'));

    const notes = screen.getByTestId('staging-action-notes');
    fireEvent.change(notes, { target: { value: 'LGTM' } });
    fireEvent.click(screen.getByTestId('staging-action-submit'));

    await waitFor(() => {
      expect(approve).toHaveBeenCalledWith({
        stagingId: 'staging-A',
        hitlNotes: 'LGTM',
      });
    });
    expect(reject).not.toHaveBeenCalled();
    // Success message surfaced.
    await waitFor(() => {
      expect(screen.getByTestId('staging-action-success')).toBeInTheDocument();
    });
  });

  it('clicking Reject and confirming calls rejectStagingRowFn (not approve)', async () => {
    const rows = [makeRow({ id: 'staging-A' })];
    const list = vi.fn(async () => rows);
    const approve = vi.fn();
    const reject = vi.fn(async () => ({ ok: true as const }));

    render(
      <CatalogStagingReview
        isAdmin
        listPendingStagingRowsFn={list}
        approveStagingRowFn={approve}
        rejectStagingRowFn={reject}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId('staging-row-staging-A')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId('staging-row-staging-A'));
    fireEvent.click(screen.getByTestId('staging-action-reject'));
    fireEvent.change(screen.getByTestId('staging-action-notes'), {
      target: { value: 'Out of scope' },
    });
    fireEvent.click(screen.getByTestId('staging-action-submit'));

    await waitFor(() => {
      expect(reject).toHaveBeenCalledWith({
        stagingId: 'staging-A',
        hitlNotes: 'Out of scope',
      });
    });
    expect(approve).not.toHaveBeenCalled();
  });

  it('surfaces an error message when approve throws', async () => {
    const rows = [makeRow({ id: 'staging-A' })];
    const list = vi.fn(async () => rows);
    const approve = vi.fn(async () => {
      throw new Error('catalog-staging.approveStagingRow: unknown proposed_kind');
    });

    render(
      <CatalogStagingReview
        isAdmin
        listPendingStagingRowsFn={list}
        approveStagingRowFn={approve}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId('staging-row-staging-A')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId('staging-row-staging-A'));
    fireEvent.click(screen.getByTestId('staging-action-approve'));
    fireEvent.click(screen.getByTestId('staging-action-submit'));

    await waitFor(() => {
      expect(screen.getByTestId('staging-action-error')).toBeInTheDocument();
    });
    expect(screen.getByTestId('staging-action-error')).toHaveTextContent(
      /unknown proposed_kind/,
    );
  });

  it('applying a pass id filter re-queries with that pass id', async () => {
    const rows = [makeRow({ id: 'staging-1' })];
    const list = vi.fn(async (_args?: ListPendingStagingRowsArgs) => rows);

    render(
      <CatalogStagingReview isAdmin listPendingStagingRowsFn={list} />,
    );

    // Initial load with no filter.
    await waitFor(() => {
      expect(list).toHaveBeenCalledTimes(1);
    });
    expect(list.mock.calls[0][0]).toEqual({});

    // Type a pass id and click Apply.
    fireEvent.change(screen.getByTestId('staging-filter-pass-id'), {
      target: { value: 'pass-XYZ' },
    });
    fireEvent.click(screen.getByTestId('staging-filter-apply'));

    await waitFor(() => {
      expect(list).toHaveBeenCalledTimes(2);
    });
    expect(list.mock.calls[1][0]).toEqual({ extractionPassId: 'pass-XYZ' });
  });

  it('clears selection when the previously-selected row drops out of the refreshed list', async () => {
    const rowsBefore = [makeRow({ id: 'staging-A' }), makeRow({ id: 'staging-B' })];
    const rowsAfter = [makeRow({ id: 'staging-B' })];  // A was approved + dropped
    const list = vi.fn();
    list.mockImplementationOnce(async () => rowsBefore);
    list.mockImplementationOnce(async () => rowsAfter);

    render(
      <CatalogStagingReview isAdmin listPendingStagingRowsFn={list} />,
    );

    await waitFor(() => {
      expect(screen.getByTestId('staging-row-staging-A')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId('staging-row-staging-A'));
    expect(screen.getByTestId('staging-detail')).toBeInTheDocument();

    // Trigger refresh; row A drops out.
    fireEvent.click(screen.getByTestId('staging-refresh'));

    await waitFor(() => {
      expect(screen.queryByTestId('staging-row-staging-A')).not.toBeInTheDocument();
    });
    // Detail panel should now show the empty state (selection cleared).
    expect(screen.getByTestId('staging-detail-empty')).toBeInTheDocument();
  });

  it('refresh button triggers a re-query', async () => {
    const list = vi.fn(async () => [] as CatalogStagingRow[]);

    render(
      <CatalogStagingReview isAdmin listPendingStagingRowsFn={list} />,
    );

    await waitFor(() => expect(list).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByTestId('staging-refresh'));

    await waitFor(() => expect(list).toHaveBeenCalledTimes(2));
  });

  it('renders error banner when listPendingStagingRows rejects', async () => {
    const list = vi.fn(async () => {
      throw new Error('network down');
    });

    render(
      <CatalogStagingReview isAdmin listPendingStagingRowsFn={list} />,
    );

    await waitFor(() => {
      expect(screen.getByTestId('staging-load-error')).toBeInTheDocument();
    });
    expect(screen.getByTestId('staging-load-error')).toHaveTextContent(
      /network down/,
    );
  });
});
