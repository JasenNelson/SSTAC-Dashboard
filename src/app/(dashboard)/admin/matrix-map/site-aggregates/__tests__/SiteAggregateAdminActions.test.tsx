import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import {
  SiteAggregateAdminActions,
  resolveSnapshotDriftState,
  type SiteAggregateCandidate,
} from '../SiteAggregateAdminActions';

const SOURCE_DRA_ID = '11111111-1111-4111-8111-111111111111';
const CLUSTER_ID = 'cluster-alpha';
const PUBLICATION_ID = '33333333-3333-4333-8333-333333333333';

const UPDATED_AT = '2026-07-28T12:34:56.789012+00:00';

function candidateFrom(over: Partial<SiteAggregateCandidate> = {}): SiteAggregateCandidate {
  return {
    publication_id: PUBLICATION_ID,
    source_dra_id: SOURCE_DRA_ID,
    coordinate_cluster_id: CLUSTER_ID,
    member_display_label: 'Neutral Label 1',
    is_published: false,
    sample_count_total: 10,
    // The SERVER decides drift; the client only reads this value.
    snapshot_drift_state: 'match',
    // Optimistic-concurrency token, exactly as PostgREST renders it. Kept as a
    // string with sub-millisecond precision on purpose: a round trip through
    // Date would truncate it and turn every publish into a false conflict.
    updated_at: UPDATED_AT,
    ...over,
  };
}

function renderActions(props: Partial<React.ComponentProps<typeof SiteAggregateAdminActions>> = {}) {
  return render(
    <SiteAggregateAdminActions
      source_dra_id={SOURCE_DRA_ID}
      coordinate_cluster_id={CLUSTER_ID}
      defaultLabel="Default Label"
      {...props}
    />,
  );
}

const reloadMock = vi.fn();
let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { ...window.location, reload: reloadMock },
  });
  fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({ ok: true }) }));
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('resolveSnapshotDriftState - the SERVER decides drift', () => {
  // The client used to recompute the live aggregate in TypeScript and compare
  // it field-by-field. That duplicated a PostgreSQL aggregate and could not be
  // reconciled over an unconstrained text column (population, blank handling,
  // trim semantics, collation order all differed), producing PERMANENT drift no
  // refresh could clear. matrix_map.fetch_admin_site_aggregate_publications now
  // returns snapshot_drift_state from a server-side source_sample_hash
  // comparison, and this module only reads it.

  it('passes through the server verdict verbatim', () => {
    expect(resolveSnapshotDriftState(candidateFrom({ snapshot_drift_state: 'match' }))).toBe('match');
    expect(resolveSnapshotDriftState(candidateFrom({ snapshot_drift_state: 'drift' }))).toBe('drift');
    expect(resolveSnapshotDriftState(candidateFrom({ snapshot_drift_state: 'unknown' }))).toBe(
      'unknown',
    );
  });

  it('returns "match" when there is no candidate at all', () => {
    // Nothing persisted means nothing can have drifted from it.
    expect(resolveSnapshotDriftState(undefined)).toBe('match');
  });

  it('returns "unknown" -- never "match" -- when the server omitted the field', () => {
    // A response from an RPC older than this client. Silently reporting "no
    // drift" here is exactly the failure mode this architecture removed.
    const partial = candidateFrom();
    delete (partial as { snapshot_drift_state?: string }).snapshot_drift_state;
    expect(resolveSnapshotDriftState(partial)).toBe('unknown');
  });

  it('returns "unknown" for an unrecognised or malformed value', () => {
    expect(resolveSnapshotDriftState(candidateFrom({ snapshot_drift_state: 'MATCH' }))).toBe(
      'unknown',
    );
    expect(resolveSnapshotDriftState(candidateFrom({ snapshot_drift_state: 'stale' }))).toBe(
      'unknown',
    );
    expect(
      resolveSnapshotDriftState(candidateFrom({ snapshot_drift_state: '' })),
    ).toBe('unknown');
    expect(
      resolveSnapshotDriftState(
        candidateFrom({ snapshot_drift_state: 42 as unknown as string }),
      ),
    ).toBe('unknown');
  });

  it('does NOT reimplement any SQL comparison: unrelated snapshot fields cannot change the verdict', () => {
    // Counts, coordinates, tier and coordinate_source are display/provenance
    // only now. Changing them must not move the drift state one bit.
    const drifted = candidateFrom({
      snapshot_drift_state: 'match',
      sample_count_total: 9999,
      representative_latitude: 1.234,
      coordinate_quality_tier: 'high',
      coordinate_source: 'something-else',
      source_sample_hash: 'a-different-hash',
    });
    expect(resolveSnapshotDriftState(drifted)).toBe('match');
  });
});

describe('SiteAggregateAdminActions - fail-closed Publish across every drift state', () => {
  // Publishing makes the snapshot member-visible, so it is permitted ONLY on a
  // confirmed server-side `match`. `unknown` is NOT safe -- it means the
  // comparison never happened -- and must block exactly as `drift` does.

  it('UNPUBLISHED + match: Publish is enabled', () => {
    renderActions({ candidate: candidateFrom({ snapshot_drift_state: 'match' }) });
    expect(screen.getByRole('button', { name: /^publish$/i })).toBeEnabled();
  });

  it('UNPUBLISHED + drift: Publish disabled, drift shown, Refresh still available', () => {
    renderActions({ candidate: candidateFrom({ snapshot_drift_state: 'drift' }) });
    expect(screen.getByRole('button', { name: /^publish$/i })).toBeDisabled();
    expect(screen.getByText('(Drifted)')).toBeInTheDocument();
    // Refresh is the REMEDY for drift, so it must stay usable.
    expect(screen.getByRole('button', { name: /refresh candidate/i })).toBeEnabled();
  });

  it('UNPUBLISHED + unknown: Publish disabled and unknown surfaced, not treated as safe', () => {
    renderActions({ candidate: candidateFrom({ snapshot_drift_state: 'unknown' }) });
    expect(screen.getByRole('button', { name: /^publish$/i })).toBeDisabled();
    expect(screen.getByText('Drift unknown')).toBeInTheDocument();
  });

  it('PUBLISHED + drift: drift is visible and Unpublish remains available', () => {
    // The badge used to live inside the unpublished branch, so a published
    // stale aggregate showed only "Published" and the operator never learned
    // the member-visible data no longer matched its source.
    renderActions({
      candidate: candidateFrom({ is_published: true, snapshot_drift_state: 'drift' }),
    });
    expect(screen.getByText('(Drifted)')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /unpublish/i })).toBeEnabled();
  });

  it('PUBLISHED + unknown: unknown is visible and Unpublish remains available', () => {
    renderActions({
      candidate: candidateFrom({ is_published: true, snapshot_drift_state: 'unknown' }),
    });
    expect(screen.getByText('Drift unknown')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /unpublish/i })).toBeEnabled();
  });

  it('PUBLISHED + match: no drift badge, Unpublish still available', () => {
    renderActions({
      candidate: candidateFrom({ is_published: true, snapshot_drift_state: 'match' }),
    });
    expect(screen.queryByText('(Drifted)')).not.toBeInTheDocument();
    expect(screen.queryByText('Drift unknown')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /unpublish/i })).toBeEnabled();
  });

  it('proves the Publish HANDLER is gated, not merely the disabled attribute', () => {
    // Defence in depth: clearing the attribute in devtools must not open the
    // modal, because no click handler is wired when publishing is blocked.
    renderActions({ candidate: candidateFrom({ snapshot_drift_state: 'drift' }) });
    const publish = screen.getByRole('button', { name: /^publish$/i }) as HTMLButtonElement;
    publish.disabled = false;
    fireEvent.click(publish);
    expect(screen.queryByRole('button', { name: /^confirm/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/reason/i)).not.toBeInTheDocument();
  });
});

describe('SiteAggregateAdminActions - the ALL-TIER candidate is shown, not the medium-tier row', () => {
  it('renders the persisted all-tier snapshot the action would publish', () => {
    // The table is a MEDIUM-TIER preview; the candidate spans every tier. The
    // operator must approve the population that actually becomes member-visible.
    renderActions({
      candidate: candidateFrom({
        sample_count_total: 12,
        sample_count_high: 3,
        sample_count_medium: 7,
        sample_count_low: 2,
        distinct_point_count: 4,
        coordinate_quality_tier: 'medium',
        count_bucket: '10-49',
      }),
    });
    expect(screen.getByText(/all-tier publication candidate/i)).toBeInTheDocument();
    expect(screen.getByText(/total 12/)).toBeInTheDocument();
    expect(screen.getByText(/high 3, medium 7, low 2/)).toBeInTheDocument();
    expect(screen.getByText(/distinct points 4/)).toBeInTheDocument();
    expect(screen.getByText(/bucket 10-49/)).toBeInTheDocument();
  });

  it('tells the operator that Create captures all tiers and stages only', () => {
    renderActions();
    expect(screen.getByText(/captures ALL tiers/i)).toBeInTheDocument();
    expect(screen.getByText(/publishes nothing/i)).toBeInTheDocument();
  });
});

describe('SiteAggregateAdminActions - post-commit responses are not blindly retried', () => {
  it.each([
    ['null', null],
    ['a string', 'true'],
    ['a number', 1],
    ['absent', undefined],
  ])('LATCHES when a 409 carries retry_safe as %s (non-boolean is unusable)', async (_label, value) => {
    // Only `undefined` used to be rejected, so `null` / 'true' / 1 passed the
    // check and then failed the later strict `=== false` test -- re-enabling
    // the control on a response that may have COMMITTED. A boolean is required.
    const user = userEvent.setup();
    const body: Record<string, unknown> = { error: 'conflict', committed: null };
    if (value !== undefined) body.retry_safe = value;
    fetchMock.mockResolvedValueOnce({ ok: false, status: 409, json: async () => body });

    renderActions();
    await user.click(screen.getByRole('button', { name: /create candidate/i }));
    await user.type(document.querySelectorAll('textarea')[0], 'initial capture');
    await user.click(screen.getByRole('button', { name: /^create$/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /reload required/i })).toBeDisabled();
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('surfaces the detail and LATCHES the control when the server says retry_safe: false', async () => {
    // The write already committed. Re-enabling an identical submission would
    // perform a second upsert and write another refresh audit entry.
    const user = userEvent.setup();
    fetchMock.mockResolvedValueOnce({
      ok: false,
      json: async () => ({
        error: 'readback_failed',
        detail:
          'The candidate was written and COMMITTED, but the verification readback failed. Do not retry this action. Reload the page and reconcile.',
        committed: true,
        verified: false,
        retry_safe: false,
      }),
    });

    renderActions();
    await user.click(screen.getByRole('button', { name: /create candidate/i }));
    await user.type(document.querySelectorAll('textarea')[0], 'initial capture');
    await user.click(screen.getByRole('button', { name: /^create$/i }));

    // The operator must see the instruction, not just the machine code.
    await waitFor(() => {
      expect(screen.getByText(/do not retry this action/i)).toBeInTheDocument();
    });

    // Exactly ONE request was issued, and the control is latched shut.
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const submit = screen.getByRole('button', { name: /reload required/i }) as HTMLButtonElement;
    expect(submit).toBeDisabled();

    // Defence in depth: clearing the attribute must not issue a second write.
    submit.disabled = false;
    fireEvent.click(submit);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('does NOT latch on an ordinary retryable failure', async () => {
    // A pre-commit validation error is genuinely retryable; the operator must
    // be able to correct the input and submit again.
    const user = userEvent.setup();
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({
        error: 'invalid_payload',
        detail: 'reason must be a non-empty string',
        committed: false,
        retry_safe: true,
      }),
    });

    renderActions();
    await user.click(screen.getByRole('button', { name: /create candidate/i }));
    await user.type(document.querySelectorAll('textarea')[0], 'initial capture');
    await user.click(screen.getByRole('button', { name: /^create$/i }));

    await waitFor(() => {
      expect(screen.getByText(/reason must be a non-empty string/i)).toBeInTheDocument();
    });
    expect(screen.queryByRole('button', { name: /reload required/i })).not.toBeInTheDocument();
  });
});

describe('SiteAggregateAdminActions button matrix', () => {
  it('offers only Create Candidate when there is no candidate', () => {
    renderActions();

    expect(screen.getByRole('button', { name: /create candidate/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /publish/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /refresh candidate/i })).not.toBeInTheDocument();
  });

  it('offers Publish and Refresh for an unpublished candidate', () => {
    renderActions({ candidate: candidateFrom({ is_published: false }) });

    expect(screen.getByRole('button', { name: /^publish$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /refresh candidate/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /create candidate/i })).not.toBeInTheDocument();
    expect(screen.getByText('Unpublished')).toBeInTheDocument();
  });

  it('offers only Unpublish for a published candidate', () => {
    renderActions({ candidate: candidateFrom({ is_published: true }) });

    expect(screen.getByRole('button', { name: /unpublish/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^publish$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /refresh candidate/i })).not.toBeInTheDocument();
    expect(screen.getByText('Published')).toBeInTheDocument();
  });
});

describe('SiteAggregateAdminActions drift badge', () => {
  it('shows the drift badge when the candidate snapshot no longer matches live data', () => {
    renderActions({
      candidate: candidateFrom({ snapshot_drift_state: 'drift' }),
    });

    expect(screen.getByText('(Drifted)')).toBeInTheDocument();
  });

  it('does not show the drift badge when the snapshot matches', () => {
    renderActions({ candidate: candidateFrom() });

    expect(screen.queryByText('(Drifted)')).not.toBeInTheDocument();
  });

  it('does not claim hash semantics in the badge tooltip', () => {
    // The badge previously read "Hash drifted!" while comparing sample counts.
    renderActions({ candidate: candidateFrom({ snapshot_drift_state: 'drift' }) });

    expect(screen.getByText('(Drifted)').getAttribute('title')).not.toMatch(/hash/i);
  });

  it('renders a "Drift unknown" indicator when the server reports unknown', () => {
    // e.g. an orphaned publication: the server's LEFT LATERAL snapshot yields no
    // row, so it reports `unknown` rather than a confirmed match.
    renderActions({ candidate: candidateFrom({ snapshot_drift_state: 'unknown' }) });

    expect(screen.getByText('Drift unknown')).toBeInTheDocument();
    expect(screen.queryByText('(Drifted)')).not.toBeInTheDocument();
  });

  it('renders neither "Drift unknown" nor "(Drifted)" when the server reports match', () => {
    renderActions({ candidate: candidateFrom({ snapshot_drift_state: 'match' }) });

    expect(screen.queryByText('Drift unknown')).not.toBeInTheDocument();
    expect(screen.queryByText('(Drifted)')).not.toBeInTheDocument();
  });
});

describe('SiteAggregateAdminActions modal', () => {
  it('opens the modal with a label field for create', async () => {
    const user = userEvent.setup();
    renderActions();

    await user.click(screen.getByRole('button', { name: /create candidate/i }));

    expect(screen.getByText('Member Display Label')).toBeInTheDocument();
    expect(screen.getByText('Reason')).toBeInTheDocument();
  });

  it('omits the label field for publish', async () => {
    const user = userEvent.setup();
    renderActions({ candidate: candidateFrom({ is_published: false }) });

    await user.click(screen.getByRole('button', { name: /^publish$/i }));

    expect(screen.queryByText('Member Display Label')).not.toBeInTheDocument();
    expect(screen.getByText('Reason')).toBeInTheDocument();
  });

  it('closes on cancel without calling the API', async () => {
    const user = userEvent.setup();
    renderActions();

    await user.click(screen.getByRole('button', { name: /create candidate/i }));
    await user.click(screen.getByRole('button', { name: /cancel/i }));

    expect(screen.queryByText('Reason')).not.toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('SiteAggregateAdminActions validation', () => {
  it('requires a reason before creating, and calls no API', async () => {
    const user = userEvent.setup();
    renderActions();

    await user.click(screen.getByRole('button', { name: /create candidate/i }));
    await user.click(screen.getByRole('button', { name: /^create$/i }));

    expect(await screen.findByText('Label and reason are required.')).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('requires a reason before publishing, and calls no API', async () => {
    const user = userEvent.setup();
    renderActions({ candidate: candidateFrom({ is_published: false }) });

    await user.click(screen.getByRole('button', { name: /^publish$/i }));
    // Once the modal is open there are two "publish" buttons (row + modal submit);
    // the modal's is last in document order.
    const publishButtons = screen.getAllByRole('button', { name: /^publish$/i });
    await user.click(publishButtons[publishButtons.length - 1]);

    expect(await screen.findByText('Reason is required.')).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('SiteAggregateAdminActions fail-closed disabled state', () => {
  // Non-vacuous: each case asserts BOTH that the control renders disabled AND
  // that clicking it performs no fetch, so a regression that dropped only the
  // `disabled` attribute (while still gating the handler) or only the handler
  // gate (while still rendering `disabled={false}`) would be caught.

  it('disables Create Candidate and wires no click handler when data is incomplete', async () => {
    const user = userEvent.setup();
    renderActions({ disabled: true });

    const button = screen.getByRole('button', { name: /create candidate/i });
    expect(button).toBeDisabled();
    expect(screen.getByText(/Create, Refresh and Publish disabled/)).toBeInTheDocument();
    // The banner must NOT claim every action is disabled: Unpublish stays live.
    expect(screen.getByText(/Unpublish\s+remains available/)).toBeInTheDocument();

    await user.click(button);

    expect(screen.queryByText('Member Display Label')).not.toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('disables Publish and Refresh Candidate for an unpublished candidate when data is incomplete', async () => {
    const user = userEvent.setup();
    renderActions({ candidate: candidateFrom({ is_published: false }), disabled: true });

    const publishButton = screen.getByRole('button', { name: /^publish$/i });
    const refreshButton = screen.getByRole('button', { name: /refresh candidate/i });
    expect(publishButton).toBeDisabled();
    expect(refreshButton).toBeDisabled();

    await user.click(publishButton);
    await user.click(refreshButton);

    expect(screen.queryByText('Reason')).not.toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('KEEPS Unpublish available for a published candidate even when data is incomplete', async () => {
    // DELIBERATE REVERSAL of the earlier behaviour, on owner ruling that
    // Unpublish must remain an available safety action. `disabled` exists to
    // stop an operator INCREASING visibility from an unreliable view; applying
    // it to the only visibility-REDUCING control disabled retraction precisely
    // when a persistent load failure could leave stale member-visible data
    // unretractable. Unpublish needs nothing from the preview -- the
    // publication id comes from the candidate row and the server revalidates.
    const user = userEvent.setup();
    renderActions({ candidate: candidateFrom({ is_published: true }), disabled: true });

    const unpublishButton = screen.getByRole('button', { name: /unpublish/i });
    expect(unpublishButton).toBeEnabled();

    await user.click(unpublishButton);
    // The modal opens, so the operator can actually retract.
    expect(document.querySelectorAll('textarea').length).toBeGreaterThan(0);
  });

  it('Unpublish is exempt from `disabled` but NOT from the non-retryable latch', async () => {
    // COMPLETES THE ASYMMETRY. The exemption is narrow and must stay narrow:
    // `disabled` (incomplete evidence) does not gate Unpublish, but the
    // in-flight and non-retryable latches still do -- exactly as the button's
    // `disabled={loading || nonRetryable}` says.
    //
    // Without this, "Unpublish is exempt" could be over-applied into a control
    // that stays clickable after an already-committed write, which is how a
    // duplicate retraction plus a spurious audit row would be issued.
    const user = userEvent.setup();
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 409,
      json: async () => ({
        error: 'readback_failed',
        detail: 'committed but unverified',
        committed: true,
        verified: false,
        retry_safe: false,
      }),
    } as Response);

    renderActions({ candidate: candidateFrom({ is_published: true }), disabled: true });

    // Exempt from `disabled`: reachable even though evidence is incomplete.
    const unpublishButton = screen.getByRole('button', { name: /unpublish/i });
    expect(unpublishButton).toBeEnabled();

    await user.click(unpublishButton);
    const textarea = document.querySelector('textarea') as HTMLTextAreaElement;
    await user.type(textarea, 'retracting stale visibility');
    // The modal's SUBMIT, not the trigger -- both are labelled "Unpublish".
    const submit = document.querySelector('form button[type="submit"]') as HTMLButtonElement;
    expect(submit).toBeTruthy();
    await user.click(submit);

    // After a non-retryable outcome the latch applies to Unpublish too.
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /reload required/i })).toBeDisabled();
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('still disables PUBLISH-side controls when data is incomplete', () => {
    // The fail-closed flag is unchanged for every visibility-INCREASING action.
    renderActions({ candidate: candidateFrom({ is_published: false }), disabled: true });
    expect(screen.getByRole('button', { name: /^publish$/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /refresh candidate/i })).toBeDisabled();
  });

  it('does not render the incomplete-data notice or disable controls when disabled is false (default)', () => {
    renderActions({ candidate: candidateFrom({ is_published: false }) });

    expect(screen.queryByText(/Create, Refresh and Publish disabled/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^publish$/i })).not.toBeDisabled();
    expect(screen.getByRole('button', { name: /refresh candidate/i })).not.toBeDisabled();
  });

  // The three cases above prove the NATIVE `disabled` attribute is set, and that
  // a click while it is set performs no fetch. But a native `disabled` button
  // suppresses its own click regardless of what onClick is wired to -- so those
  // assertions alone would still pass even if the conditional
  // `onClick={disabled ? undefined : ...}` wiring were reverted to always wire
  // the handler. The three cases below prove the HANDLER ITSELF is gated,
  // independent of the native disabled attribute: they clear `disabled` on the
  // actual DOM node (bypassing React) before dispatching a click, so the click
  // is not suppressed by the browser -- if the handler were unconditionally
  // wired, this click would reach openModal/handleAction and fetch would fire.

  it('proves the CREATE handler itself is gated, not merely the native disabled attribute', () => {
    renderActions({ disabled: true });

    const button = screen.getByRole('button', { name: /create candidate/i }) as HTMLButtonElement;
    button.disabled = false;
    fireEvent.click(button);

    expect(screen.queryByText('Member Display Label')).not.toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('proves the PUBLISH and REFRESH handlers are gated, not merely the native disabled attribute', () => {
    renderActions({ candidate: candidateFrom({ is_published: false }), disabled: true });

    const publishButton = screen.getByRole('button', { name: /^publish$/i }) as HTMLButtonElement;
    const refreshButton = screen.getByRole('button', { name: /refresh candidate/i }) as HTMLButtonElement;
    publishButton.disabled = false;
    refreshButton.disabled = false;
    fireEvent.click(publishButton);
    fireEvent.click(refreshButton);

    expect(screen.queryByText('Reason')).not.toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('proves the UNPUBLISH control is LATCHED after a post-commit response, not merely styled', async () => {
    // Unpublish is no longer gated by `disabled` (see the ruling above), but it
    // MUST become un-submittable once a post-commit outcome has latched, so an
    // already-committed write cannot be reissued. Drive it end to end.
    const user = userEvent.setup();
    fetchMock.mockResolvedValueOnce({
      ok: false,
      json: async () => ({
        error: 'readback_failed',
        detail: 'The candidate was written and COMMITTED. Do not retry this action.',
        committed: true,
        verified: false,
        retry_safe: false,
      }),
    });

    renderActions({ candidate: candidateFrom({ is_published: true }) });

    await user.click(screen.getByRole('button', { name: /unpublish/i }));
    await user.type(document.querySelectorAll('textarea')[0], 'retracting');
    // Both the row control and the modal submit read "unpublish"; the modal's
    // is rendered last.
    const submitButtons = screen.getAllByRole('button', { name: /^unpublish$/i });
    await user.click(submitButtons[submitButtons.length - 1]);

    await waitFor(() => {
      expect(screen.getByText(/do not retry this action/i)).toBeInTheDocument();
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // Latched: attribute AND handler.
    const submit = screen.getByRole('button', { name: /reload required/i }) as HTMLButtonElement;
    expect(submit).toBeDisabled();
    submit.disabled = false;
    fireEvent.click(submit);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('treats an UNREADABLE response body as indeterminate and latches', async () => {
    // fetch resolved, but the body could not be parsed -- we do not know what
    // the server decided, and the write may already have committed.
    const user = userEvent.setup();
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 502,
      json: async () => {
        throw new Error('Unexpected end of JSON input');
      },
    });

    renderActions();
    await user.click(screen.getByRole('button', { name: /create candidate/i }));
    await user.type(document.querySelectorAll('textarea')[0], 'initial capture');
    await user.click(screen.getByRole('button', { name: /^create$/i }));

    await waitFor(() => {
      expect(screen.getByText(/could not be read/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/UNKNOWN whether it took effect/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /reload required/i })).toBeDisabled();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe('SiteAggregateAdminActions submission', () => {
  it('posts the candidate payload and reloads on success', async () => {
    const user = userEvent.setup();
    renderActions();

    await user.click(screen.getByRole('button', { name: /create candidate/i }));
    await user.type(document.querySelectorAll('textarea')[0], 'initial candidate');
    await user.click(screen.getByRole('button', { name: /^create$/i }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/matrix-map/admin/site-aggregates/candidate');
    expect(init.method).toBe('POST');
    expect(init.headers['Content-Type']).toBe('application/json');
    expect(JSON.parse(init.body)).toEqual({
      source_dra_id: SOURCE_DRA_ID,
      coordinate_cluster_id: CLUSTER_ID,
      member_display_label: 'Default Label',
      reason: 'initial candidate',
    });
    await waitFor(() => expect(reloadMock).toHaveBeenCalled());
  });

  it('posts to the publish route with the publication id', async () => {
    const user = userEvent.setup();
    renderActions({ candidate: candidateFrom({ is_published: false }) });

    await user.click(screen.getByRole('button', { name: /^publish$/i }));
    await user.type(document.querySelectorAll('textarea')[0], 'pilot publish');
    const dialogButtons = screen.getAllByRole('button', { name: /^publish$/i });
    await user.click(dialogButtons[dialogButtons.length - 1]);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/matrix-map/admin/site-aggregates/publish');
    expect(JSON.parse(init.body)).toEqual({
      publication_id: PUBLICATION_ID,
      public: true,
      // The reviewed version, transmitted VERBATIM. If this ever arrives
      // reformatted, the SQL comparison fails and publishing breaks.
      expected_updated_at: UPDATED_AT,
      reason: 'pilot publish',
    });
  });

  it('shows an inline error and re-enables the form when the API fails', async () => {
    // A pre-commit UE409 conflict. These routes also return 409 for POST-commit
    // outcomes, so the response must SAY it is retryable; the client cannot
    // infer that from the status alone and fails closed without it.
    fetchMock.mockResolvedValue({
      ok: false,
      status: 409,
      json: async () => ({ error: 'conflict', committed: false, retry_safe: true }),
    });
    const user = userEvent.setup();
    renderActions();

    await user.click(screen.getByRole('button', { name: /create candidate/i }));
    await user.type(document.querySelectorAll('textarea')[0], 'initial candidate');
    await user.click(screen.getByRole('button', { name: /^create$/i }));

    expect(await screen.findByText('conflict')).toBeInTheDocument();
    expect(reloadMock).not.toHaveBeenCalled();
    // Re-enabled so the operator can retry.
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /^create$/i })).not.toBeDisabled(),
    );
  });

  it('treats a network rejection AFTER dispatch as INDETERMINATE and latches, not as a clean failure', async () => {
    // DELIBERATE behaviour change. The request was already sent, so the upsert
    // may have COMMITTED and only the response was lost. Re-enabling the
    // control here invited exactly the duplicate upsert plus refresh audit
    // entry the server-side retry_safe contract exists to prevent.
    fetchMock.mockRejectedValue(new Error('network down'));
    const user = userEvent.setup();
    renderActions();

    await user.click(screen.getByRole('button', { name: /create candidate/i }));
    await user.type(document.querySelectorAll('textarea')[0], 'initial candidate');
    await user.click(screen.getByRole('button', { name: /^create$/i }));

    // The original message still reaches the operator...
    expect(await screen.findByText(/network down/)).toBeInTheDocument();
    // ...alongside the indeterminacy warning.
    expect(screen.getByText(/UNKNOWN whether it took effect/i)).toBeInTheDocument();
    expect(reloadMock).not.toHaveBeenCalled();

    // And the control is latched, so a second write cannot be issued.
    const submit = screen.getByRole('button', { name: /reload required/i }) as HTMLButtonElement;
    expect(submit).toBeDisabled();
    submit.disabled = false;
    fireEvent.click(submit);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('disables the submit control while the request is in flight', async () => {
    let release: (value: unknown) => void = () => {};
    fetchMock.mockImplementation(
      () => new Promise((resolve) => { release = resolve; }),
    );
    const user = userEvent.setup();
    renderActions();

    await user.click(screen.getByRole('button', { name: /create candidate/i }));
    await user.type(document.querySelectorAll('textarea')[0], 'initial candidate');
    await user.click(screen.getByRole('button', { name: /^create$/i }));

    expect(await screen.findByText('Processing...')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /processing/i })).toBeDisabled();

    release({ ok: true, json: async () => ({ ok: true }) });
  });
});

describe('member-visible label is shown before it is published (F7)', () => {
  // The table row beside this component shows the PRIVATE DRA name. Without
  // these surfaces an operator could approve a publication having never seen
  // the string members will actually be served -- and Publish sends no label,
  // so whatever is stored is what ships.
  const STORED = 'Harbour Site Aggregate (member view)';

  it('renders the exact persisted label in the all-tier candidate summary', () => {
    renderActions({ candidate: candidateFrom({ member_display_label: STORED }) });

    expect(screen.getByText(STORED)).toBeInTheDocument();
  });

  it('renders the exact persisted label in the Publish confirmation', async () => {
    const user = userEvent.setup();
    renderActions({
      candidate: candidateFrom({ member_display_label: STORED, is_published: false }),
    });

    await user.click(screen.getAllByRole('button', { name: /^publish$/i })[0]);

    const shown = await screen.findByTestId('publish-member-label');
    expect(shown).toHaveTextContent(STORED);
  });

  it('shows the STORED label, not the defaultLabel prop, in the Publish confirmation', async () => {
    // A substitution here would approve one string and publish another.
    const user = userEvent.setup();
    renderActions({
      candidate: candidateFrom({ member_display_label: STORED }),
      defaultLabel: 'Some Other Label',
    });

    await user.click(screen.getAllByRole('button', { name: /^publish$/i })[0]);

    const shown = await screen.findByTestId('publish-member-label');
    expect(shown).toHaveTextContent(STORED);
    expect(shown).not.toHaveTextContent('Some Other Label');
  });

  it('does not send any label with the publish request', async () => {
    // The database serves the stored value verbatim; the client must not get a
    // chance to recompute or edit it on the way through.
    const user = userEvent.setup();
    renderActions({ candidate: candidateFrom({ member_display_label: STORED }) });

    // The trigger and the modal's confirm share the name "Publish", so scope
    // explicitly: [0] opens the modal, the last one confirms.
    await user.click(screen.getAllByRole('button', { name: /^publish$/i })[0]);
    await user.type(document.querySelectorAll('textarea')[0], 'publishing for review');
    const buttons = screen.getAllByRole('button', { name: /^publish$/i });
    await user.click(buttons[buttons.length - 1]);

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body).not.toHaveProperty('member_display_label');
  });
});

describe('in-flight duplicate dispatch (F10)', () => {
  // Submitting the REAL form is what makes this discriminating. A click on the
  // disabled button is stopped by the DOM before React ever sees it, so a
  // click-based test passes whether or not the guard exists. `fireEvent.submit`
  // bypasses the disabled attribute -- exactly as Enter-to-submit or a cleared
  // attribute would -- while still traversing the production onSubmit wiring,
  // so the only thing that can stop the second dispatch is the guard itself.
  it('issues exactly ONE request when the real form is submitted again mid-flight', async () => {
    const user = userEvent.setup();
    let releaseFirst: (value: unknown) => void = () => {};
    const pending = new Promise((resolve) => {
      releaseFirst = resolve;
    });
    fetchMock.mockImplementationOnce(async () => {
      await pending;
      return { ok: true, json: async () => ({ ok: true }) };
    });

    renderActions({ candidate: undefined });
    await user.click(screen.getByRole('button', { name: /create candidate/i }));
    await user.type(document.querySelectorAll('textarea')[0], 'initial capture');

    const form = screen.getByRole('form', { name: /site aggregate candidate action/i });
    fireEvent.submit(form);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    // The component has re-rendered into its loading state.
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /processing/i })).toBeDisabled(),
    );

    // Resubmit the live form twice while the first request is still unresolved.
    fireEvent.submit(screen.getByRole('form', { name: /site aggregate candidate action/i }));
    fireEvent.submit(screen.getByRole('form', { name: /site aggregate candidate action/i }));

    expect(fetchMock).toHaveBeenCalledTimes(1);

    releaseFirst(null);
    await waitFor(() => expect(reloadMock).toHaveBeenCalled());
  });
});

describe('same-tick duplicate dispatch (G2)', () => {
  // DISTINCT FROM THE F10 REGRESSION ABOVE, which awaits the loading re-render
  // before resubmitting and therefore only covers the AFTER-RENDER bypass (a
  // cleared disabled attribute, Enter-to-submit). Both are kept.
  //
  // `loading` is React state read from the render closure, so two submissions
  // dispatched in the SAME TICK -- with no await between them and no re-render
  // in between -- both observe the same stale `false`. Only a synchronous ref
  // lock can refuse the second one. Dispatching both inside ONE `act()` scope is
  // what reproduces that: React batches the updates until the scope exits, so
  // the second dispatch runs against the same closure the first one did.
  it('issues exactly ONE request when the real form is submitted TWICE in a single tick', async () => {
    const user = userEvent.setup();
    let releaseFirst: (value: unknown) => void = () => {};
    const pending = new Promise((resolve) => {
      releaseFirst = resolve;
    });
    fetchMock.mockImplementationOnce(async () => {
      await pending;
      return { ok: true, json: async () => ({ ok: true }) };
    });

    renderActions({ candidate: undefined });
    await user.click(screen.getByRole('button', { name: /create candidate/i }));
    await user.type(document.querySelectorAll('textarea')[0], 'initial capture');

    const form = screen.getByRole('form', { name: /site aggregate candidate action/i });
    const submitEvent = () => new Event('submit', { bubbles: true, cancelable: true });

    // NO await between the two dispatches, and no re-render between them. The
    // first fetch is still unresolved throughout.
    await act(async () => {
      form.dispatchEvent(submitEvent());
      form.dispatchEvent(submitEvent());
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);

    releaseFirst(null);
    await waitFor(() => expect(reloadMock).toHaveBeenCalled());
    // Still exactly one dispatch after everything settles.
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('releases the synchronous lock after a retry-safe failure, so a corrected resubmission still works', async () => {
    // The lock must be cleared in `finally` on EVERY exit, not just on success.
    // A lock that leaked would silently brick the control after one ordinary
    // failure -- a regression the ref must not introduce.
    const user = userEvent.setup();
    fetchMock.mockImplementationOnce(async () => ({
      ok: false,
      status: 400,
      json: async () => ({ error: 'bad_request', retry_safe: true }),
    }));

    renderActions({ candidate: undefined });
    await user.click(screen.getByRole('button', { name: /create candidate/i }));
    await user.type(document.querySelectorAll('textarea')[0], 'initial capture');

    const form = screen.getByRole('form', { name: /site aggregate candidate action/i });
    fireEvent.submit(form);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    await screen.findByText(/bad_request/i);

    fireEvent.submit(screen.getByRole('form', { name: /site aggregate candidate action/i }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  });

  it('keeps the post-commit latch closed even though the lock is released', async () => {
    // Releasing the ref in `finally` must NOT re-open a latched control:
    // `nonRetryable` is an independent condition in the same guard.
    const user = userEvent.setup();
    fetchMock.mockImplementationOnce(async () => ({
      ok: false,
      status: 409,
      json: async () => ({ error: 'verification_label_mismatch', retry_safe: false }),
    }));

    renderActions({ candidate: undefined });
    await user.click(screen.getByRole('button', { name: /create candidate/i }));
    await user.type(document.querySelectorAll('textarea')[0], 'initial capture');

    fireEvent.submit(screen.getByRole('form', { name: /site aggregate candidate action/i }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    await screen.findByRole('button', { name: /reload required/i });

    fireEvent.submit(screen.getByRole('form', { name: /site aggregate candidate action/i }));
    fireEvent.submit(screen.getByRole('form', { name: /site aggregate candidate action/i }));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
