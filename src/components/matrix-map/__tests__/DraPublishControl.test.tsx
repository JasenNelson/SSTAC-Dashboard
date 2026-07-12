import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DraPublishControl, DraRow, DraAuditRow } from '../DraPublishControl';

const mockDras: DraRow[] = [
  {
    id: '11111111-1111-4111-8111-111111111111',
    title: 'Test DRA 1',
    agency: 'Agency 1',
    year: 2026,
    public: false,
  },
  {
    id: '22222222-2222-4222-8222-222222222222',
    title: 'Test DRA 2',
    agency: 'Agency 2',
    year: 2026,
    public: true,
  }
];

const dra2AuditRow: DraAuditRow = {
  id: 'a1111111-1111-4111-8111-111111111111',
  dra_id: '22222222-2222-4222-8222-222222222222',
  prior_value: false,
  new_value: true,
  changed_at: '2026-07-01T12:00:00.000Z',
  changed_by_email: 'admin@example.com',
  reason: 'TWG review complete',
};

// The real component fetches BOTH the mutating publish endpoint and the
// read-only per-DRA audit-history endpoint via global fetch. Route the
// mock by URL so both call sites can be exercised independently, mirroring
// how the browser actually dispatches these two distinct requests.
function mockFetchRouter(opts: {
  publishResponse?: { ok: boolean; body: unknown };
  auditHistoryByDraId?: Record<string, unknown[]>;
  auditHistoryError?: boolean;
}) {
  return vi.spyOn(global, 'fetch').mockImplementation(async (input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input.toString();

    if (url.startsWith('/api/matrix-map/admin/audit-history')) {
      if (opts.auditHistoryError) {
        return {
          ok: false,
          json: async () => ({ error: 'query_failed', detail: 'boom' }),
        } as Response;
      }
      const draId = new URL(url, 'http://localhost').searchParams.get('dra_id') ?? '';
      const rows = opts.auditHistoryByDraId?.[draId] ?? [];
      return {
        ok: true,
        json: async () => ({ ok: true, dra_id: draId, rows }),
      } as Response;
    }

    if (url === '/api/matrix-map/admin/publish') {
      const resp = opts.publishResponse ?? { ok: true, body: { ok: true } };
      return {
        ok: resp.ok,
        json: async () => resp.body,
      } as Response;
    }

    throw new Error(`Unexpected fetch call in test: ${url}`);
  });
}

describe('DraPublishControl', () => {
  let fetchMock: any;

  beforeEach(() => {
    fetchMock = mockFetchRouter({
      auditHistoryByDraId: {
        '22222222-2222-4222-8222-222222222222': [dra2AuditRow],
      },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('does not render publish/unpublish buttons when isAdmin is false', async () => {
    render(<DraPublishControl initialDras={mockDras} isAdmin={false} />);

    // Select a row to reveal details
    fireEvent.click(screen.getByTestId('dra-row-11111111-1111-4111-8111-111111111111'));

    // Let the per-DRA audit-history fetch settle before asserting.
    await waitFor(() => {
      expect(screen.getByTestId('dra-audit-history-empty')).toBeInTheDocument();
    });

    // Check that there is no publish or unpublish button
    expect(screen.queryByRole('button', { name: 'Publish' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Unpublish' })).not.toBeInTheDocument();
  });

  it('keeps the confirm submit button disabled when reason textarea is empty', async () => {
    render(<DraPublishControl initialDras={mockDras} isAdmin={true} />);

    // Select the first (private) row
    fireEvent.click(screen.getByTestId('dra-row-11111111-1111-4111-8111-111111111111'));

    // Click 'Publish' to open confirm form
    fireEvent.click(screen.getByRole('button', { name: 'Publish' }));

    // Find the textarea and the confirm button
    const confirmButton = screen.getByRole('button', { name: 'Confirm publish' });
    const textarea = screen.getByLabelText('Reason for visibility change');

    expect(textarea).toHaveValue('');
    expect(confirmButton).toBeDisabled();

    // Fill with only whitespace
    await userEvent.type(textarea, '   ');
    expect(confirmButton).toBeDisabled();
  });

  it('enables the confirm button when reason is filled and calls fetch correctly on submit', async () => {
    render(<DraPublishControl initialDras={mockDras} isAdmin={true} />);

    // Select the first (private) row
    fireEvent.click(screen.getByTestId('dra-row-11111111-1111-4111-8111-111111111111'));

    // Click 'Publish' to open confirm form
    fireEvent.click(screen.getByRole('button', { name: 'Publish' }));

    const confirmButton = screen.getByRole('button', { name: 'Confirm publish' });
    const textarea = screen.getByLabelText('Reason for visibility change');

    // Fill reason
    await userEvent.type(textarea, 'Ready for public view');
    expect(confirmButton).not.toBeDisabled();

    // Submit
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/matrix-map/admin/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dra_id: '11111111-1111-4111-8111-111111111111',
          public: true,
          reason: 'Ready for public view',
        }),
      });
    });
  });

  it('does not contain any bulk or publish all controls', () => {
    render(<DraPublishControl initialDras={mockDras} isAdmin={true} />);

    // Check by common bulk action texts
    const bulkTexts = [/publish all/i, /unpublish all/i, /bulk publish/i, /select all/i];

    bulkTexts.forEach((text) => {
      expect(screen.queryByText(text)).not.toBeInTheDocument();
    });
  });

  it('shows current public/private state and offers Unpublish for a public DRA', async () => {
    render(<DraPublishControl initialDras={mockDras} isAdmin={true} />);

    // Select the second (public) row
    fireEvent.click(screen.getByTestId('dra-row-22222222-2222-4222-8222-222222222222'));

    // Let the per-DRA audit-history fetch settle before asserting.
    await waitFor(() => {
      expect(screen.getByTestId('dra-audit-history-list')).toBeInTheDocument();
    });

    // Status line shows Public
    expect(screen.getByText('Status')).toBeInTheDocument();
    expect(screen.getAllByText('Public').length).toBeGreaterThan(0);

    // Action button offers Unpublish, not Publish, for an already-public DRA
    expect(screen.getByRole('button', { name: 'Unpublish' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Publish' })).not.toBeInTheDocument();
  });

  it('calls fetch with public:false when unpublishing', async () => {
    render(<DraPublishControl initialDras={mockDras} isAdmin={true} />);

    // Select the second (public) row
    fireEvent.click(screen.getByTestId('dra-row-22222222-2222-4222-8222-222222222222'));

    fireEvent.click(screen.getByRole('button', { name: 'Unpublish' }));

    const confirmButton = screen.getByRole('button', { name: 'Confirm unpublish' });
    const textarea = screen.getByLabelText('Reason for visibility change');

    await userEvent.type(textarea, 'Withdrawn pending correction');
    expect(confirmButton).not.toBeDisabled();

    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/matrix-map/admin/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dra_id: '22222222-2222-4222-8222-222222222222',
          public: false,
          reason: 'Withdrawn pending correction',
        }),
      });
    });

    // After a successful unpublish, the row's local state flips to Private
    // and the action button now offers Publish again.
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Publish' })).toBeInTheDocument();
    });
  });

  it('regression: refreshes the audit-history panel after a successful publish action instead of leaving it stale (codex P2 round 2)', async () => {
    // Codex flagged that the audit-history effect only refetches on
    // selection change, so a successful publish/unpublish -- which writes a
    // NEW dra_visibility_audit row -- left the panel stale until the DRA
    // was reselected. Simulate the server-side audit table gaining a new
    // row as a side effect of the POST, and assert the panel picks it up
    // without any reselection.
    const auditByDraId: Record<string, unknown[]> = {
      '11111111-1111-4111-8111-111111111111': [], // starts with no history
    };
    fetchMock = vi.spyOn(global, 'fetch').mockImplementation(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();

      if (url.startsWith('/api/matrix-map/admin/audit-history')) {
        const draId = new URL(url, 'http://localhost').searchParams.get('dra_id') ?? '';
        return {
          ok: true,
          json: async () => ({ ok: true, dra_id: draId, rows: auditByDraId[draId] ?? [] }),
        } as Response;
      }

      if (url === '/api/matrix-map/admin/publish') {
        // Simulate the RPC writing a new audit row as a side effect of a
        // successful publish, the same way the real flip_dra_public RPC
        // does server-side.
        auditByDraId['11111111-1111-4111-8111-111111111111'] = [
          {
            id: 'new-audit-row',
            dra_id: '11111111-1111-4111-8111-111111111111',
            prior_value: false,
            new_value: true,
            changed_at: '2026-07-11T12:00:00.000Z',
            changed_by_email: 'admin@example.com',
            reason: 'Just published',
          },
        ];
        return { ok: true, json: async () => ({ ok: true }) } as Response;
      }

      throw new Error(`Unexpected fetch call in test: ${url}`);
    });

    render(<DraPublishControl initialDras={mockDras} isAdmin={true} />);

    // Select the first (private, no history) row.
    fireEvent.click(screen.getByTestId('dra-row-11111111-1111-4111-8111-111111111111'));
    await waitFor(() => {
      expect(screen.getByTestId('dra-audit-history-empty')).toBeInTheDocument();
    });

    // Publish it.
    fireEvent.click(screen.getByRole('button', { name: 'Publish' }));
    const textarea = screen.getByLabelText('Reason for visibility change');
    await userEvent.type(textarea, 'Just published');
    fireEvent.click(screen.getByRole('button', { name: 'Confirm publish' }));

    // Without reselecting the row, the audit-history panel must pick up
    // the newly-written row -- not remain on the empty state.
    await waitFor(() => {
      expect(screen.getByTestId('dra-audit-history-list')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('dra-audit-history-empty')).not.toBeInTheDocument();
    expect(screen.getByText(/Just published/)).toBeInTheDocument();
  });

  it('regression: a stale post-publish refetch for a previously-selected DRA does not clobber the panel after the admin has since selected a different DRA (codex P2 round 3 -- race condition)', async () => {
    // Codex flagged that the round-2 fix guarded refetches by recency
    // (request id) only. If an admin submits publish for DRA 1, then
    // switches the selection to DRA 2 BEFORE that POST resolves, the
    // post-success refetch for DRA 1 becomes the numerically "latest"
    // request and would (without the additional selected-id check) render
    // DRA 1's rows under DRA 2's now-selected panel.
    let resolvePublish: (value: Response) => void = () => {};
    const publishPromise = new Promise<Response>((resolve) => {
      resolvePublish = resolve;
    });

    const auditByDraId: Record<string, unknown[]> = {
      '11111111-1111-4111-8111-111111111111': [],
      '22222222-2222-4222-8222-222222222222': [dra2AuditRow],
    };

    fetchMock = vi.spyOn(global, 'fetch').mockImplementation(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();

      if (url.startsWith('/api/matrix-map/admin/audit-history')) {
        const draId = new URL(url, 'http://localhost').searchParams.get('dra_id') ?? '';
        return {
          ok: true,
          json: async () => ({ ok: true, dra_id: draId, rows: auditByDraId[draId] ?? [] }),
        } as Response;
      }

      if (url === '/api/matrix-map/admin/publish') {
        // Deliberately left pending until resolved below, to simulate the
        // admin switching selection before the POST returns.
        return publishPromise;
      }

      throw new Error(`Unexpected fetch call in test: ${url}`);
    });

    render(<DraPublishControl initialDras={mockDras} isAdmin={true} />);

    // Select DRA 1 (no history) and start + submit a publish action.
    fireEvent.click(screen.getByTestId('dra-row-11111111-1111-4111-8111-111111111111'));
    await waitFor(() => {
      expect(screen.getByTestId('dra-audit-history-empty')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Publish' }));
    const textarea = screen.getByLabelText('Reason for visibility change');
    await userEvent.type(textarea, 'Just published');
    fireEvent.click(screen.getByRole('button', { name: 'Confirm publish' }));

    // Before the publish POST resolves, switch selection to DRA 2.
    fireEvent.click(screen.getByTestId('dra-row-22222222-2222-4222-8222-222222222222'));
    await waitFor(() => {
      expect(screen.getByTestId('dra-audit-history-list')).toBeInTheDocument();
    });
    expect(screen.getByText(/TWG review complete/)).toBeInTheDocument();

    // Now let the stale publish POST for DRA 1 resolve. Its post-success
    // refetch targets DRA 1 -- it must NOT clobber the DRA 2 panel that is
    // currently displayed.
    resolvePublish({ ok: true, json: async () => ({ ok: true }) } as Response);

    // Give the resolved (and now-superseded) refetch a chance to run and
    // be discarded; the panel must still show DRA 2's real history.
    await waitFor(() => {
      expect(screen.getByText(/TWG review complete/)).toBeInTheDocument();
    });
    expect(screen.queryByTestId('dra-audit-history-empty')).not.toBeInTheDocument();
  });

  it('fetches and renders audit history scoped to the selected DRA (per-DRA route, not a global list)', async () => {
    render(<DraPublishControl initialDras={mockDras} isAdmin={true} />);

    // DRA 2 has one audit row from the mocked per-DRA endpoint.
    fireEvent.click(screen.getByTestId('dra-row-22222222-2222-4222-8222-222222222222'));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/matrix-map/admin/audit-history?dra_id=22222222-2222-4222-8222-222222222222',
      );
    });

    await waitFor(() => {
      expect(screen.getByTestId('dra-audit-history-list')).toBeInTheDocument();
    });
    expect(screen.getByText(/admin@example.com/)).toBeInTheDocument();
    expect(screen.getByText(/TWG review complete/)).toBeInTheDocument();

    // DRA 1 has no audit rows (per the mocked endpoint) -- selecting it
    // shows the genuine empty state, not DRA 2's history.
    fireEvent.click(screen.getByTestId('dra-row-11111111-1111-4111-8111-111111111111'));

    await waitFor(() => {
      expect(screen.getByTestId('dra-audit-history-empty')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('dra-audit-history-list')).not.toBeInTheDocument();
  });

  it('regression: a DRA whose only audit rows are OLD (would be truncated out of any global top-N list) still shows its real history, not a false "no history"', async () => {
    // This is the exact codex P2 scenario: DRA 1's latest change is old
    // enough that a GLOBAL top-200-across-all-DRAs fetch could omit it
    // entirely if enough newer rows exist for OTHER DRAs. The per-DRA
    // route never truncates this way -- it is scoped to dra_id up front.
    const oldRow: DraAuditRow = {
      id: 'old-row-1',
      dra_id: '11111111-1111-4111-8111-111111111111',
      prior_value: true,
      new_value: false,
      changed_at: '2020-01-01T00:00:00.000Z',
      changed_by_email: 'legacy-admin@example.com',
      reason: 'Initial withdrawal (years ago)',
    };
    fetchMock = mockFetchRouter({
      auditHistoryByDraId: {
        '11111111-1111-4111-8111-111111111111': [oldRow],
      },
    });

    render(<DraPublishControl initialDras={mockDras} isAdmin={true} />);

    fireEvent.click(screen.getByTestId('dra-row-11111111-1111-4111-8111-111111111111'));

    await waitFor(() => {
      expect(screen.getByTestId('dra-audit-history-list')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('dra-audit-history-empty')).not.toBeInTheDocument();
    expect(screen.getByText(/legacy-admin@example.com/)).toBeInTheDocument();
    expect(screen.getByText(/Initial withdrawal \(years ago\)/)).toBeInTheDocument();
  });

  it('shows a distinct error state (not the empty state) when the audit-history fetch fails -- fail-closed, never a false "no history"', async () => {
    fetchMock = mockFetchRouter({ auditHistoryError: true });

    render(<DraPublishControl initialDras={mockDras} isAdmin={true} />);

    fireEvent.click(screen.getByTestId('dra-row-11111111-1111-4111-8111-111111111111'));

    await waitFor(() => {
      expect(screen.getByTestId('dra-audit-history-error')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('dra-audit-history-empty')).not.toBeInTheDocument();
    expect(screen.queryByTestId('dra-audit-history-list')).not.toBeInTheDocument();
  });

  it('renders the audit-history loading state before the per-DRA fetch resolves', async () => {
    let resolveFetch: (value: Response) => void = () => {};
    fetchMock = vi.spyOn(global, 'fetch').mockImplementation(
      () =>
        new Promise<Response>((resolve) => {
          resolveFetch = resolve;
        }),
    );

    render(<DraPublishControl initialDras={mockDras} isAdmin={true} />);
    fireEvent.click(screen.getByTestId('dra-row-11111111-1111-4111-8111-111111111111'));

    expect(screen.getByTestId('dra-audit-history-loading')).toBeInTheDocument();

    resolveFetch({
      ok: true,
      json: async () => ({ ok: true, dra_id: '11111111-1111-4111-8111-111111111111', rows: [] }),
    } as Response);

    await waitFor(() => {
      expect(screen.getByTestId('dra-audit-history-empty')).toBeInTheDocument();
    });
  });
});
