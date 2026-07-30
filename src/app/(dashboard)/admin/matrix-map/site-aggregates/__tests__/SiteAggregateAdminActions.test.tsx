import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { parseServerClusterIdentity } from '@/lib/matrix-map/cluster-identity';

import {
  SiteAggregateAdminActions,
  resolveSnapshotDriftState,
  type SiteAggregateCandidate,
} from '../SiteAggregateAdminActions';

const SOURCE_DRA_ID = '11111111-1111-4111-8111-111111111111';
/**
 * F2: a REAL canonical rendering, not the former placeholder 'cluster-alpha'.
 * The component is handed a parsed `ServerClusterIdentity`, and the only
 * sanctioned way to obtain one is through the server-response parser -- which
 * rejects anything that is not two `FM9990.00000` renderings joined by a comma.
 */
const CLUSTER_ID = '49.28270,-123.12070';
const REPRESENTATIVE_LATITUDE = 49.2827;
const REPRESENTATIVE_LONGITUDE = -123.1207;

/**
 * Built through the parser rather than cast, so the fixture exercises the same
 * construction path production uses. A `null` here would mean the parser and
 * the canonical rendering have diverged, which must fail the suite loudly rather
 * than be papered over with a cast.
 */
const IDENTITY = (() => {
  const parsed = parseServerClusterIdentity(
    CLUSTER_ID,
    REPRESENTATIVE_LATITUDE,
    REPRESENTATIVE_LONGITUDE,
  );
  if (parsed === null) {
    throw new Error('test fixture: canonical cluster identity failed to parse');
  }
  return parsed;
})();

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

/**
 * The all-tier proposal a real row always carries.
 *
 * SUPPLIED BY DEFAULT, deliberately. Create and Refresh are now GATED on having
 * an all-tier proposal to show, because writing a snapshot the operator never saw
 * is the defect the proposal panel exists to prevent. Omitting it from the shared
 * helper would leave most of this file exercising a state in which the write
 * controls are disabled -- which is not the state those tests are about.
 *
 * Tests that are ABOUT the gate pass `lifecyclePreview: undefined` explicitly, so
 * the absence is visible at the call site rather than inherited from a default.
 */
const DEFAULT_LIFECYCLE_PREVIEW = {
  total: 41,
  high: 23,
  medium: 11,
  low: 7,
  tier: 'high',
  source: 'bc_csr_centroid; survey',
  distinctPoints: 1,
};

function renderActions(props: Partial<React.ComponentProps<typeof SiteAggregateAdminActions>> = {}) {
  return render(
    <SiteAggregateAdminActions
      source_dra_id={SOURCE_DRA_ID}
      identity={IDENTITY}
      defaultLabel="Default Label"
      lifecyclePreview={DEFAULT_LIFECYCLE_PREVIEW}
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
    // F2: the body carries the ASSERTED key AND the independent locator. The
    // exact-equality assertion is deliberate -- an extra or renamed field would
    // silently change what the route parses, and `toEqual` catches that where a
    // per-field check would not.
    expect(JSON.parse(init.body)).toEqual({
      source_dra_id: SOURCE_DRA_ID,
      expected_cluster_id: CLUSTER_ID,
      representative_latitude: REPRESENTATIVE_LATITUDE,
      representative_longitude: REPRESENTATIVE_LONGITUDE,
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

/**
 * F2 -- THE NULL-IDENTITY SAFETY GATES.
 *
 * A review found that every existing test in this file supplies the non-null
 * `IDENTITY` fixture, so the `identityMissing` gate had NO coverage: deleting it,
 * or accidentally applying it to Unpublish, would have left the whole suite green.
 *
 * The asymmetry is the point and is load-bearing. Create and Refresh ASSERT a
 * cluster identity, so without one there is nothing sound to send. Unpublish
 * asserts nothing -- it addresses the publication by id and the server
 * revalidates -- and it is the visibility-REDUCING retraction path, so stranding
 * it is the one failure this surface must never have.
 */
describe('null identity gates (F2)', () => {
  it('disables Create when no server-derived identity is available', () => {
    renderActions({ identity: null });

    const create = screen.getByRole('button', { name: /create candidate/i });
    expect(create).toBeDisabled();
    expect(
      screen.getByText(/Create and Refresh unavailable: no server-derived cluster identity/i),
    ).toBeTruthy();
  });

  it('disables Refresh on an unpublished candidate when the identity is unreadable', () => {
    renderActions({ identity: null, candidate: candidateFrom({ is_published: false }) });

    expect(screen.getByRole('button', { name: /refresh candidate/i })).toBeDisabled();
  });

  it('KEEPS Unpublish reachable on a published candidate with no identity', () => {
    // The retraction path must survive an unreadable identity. If this ever fails,
    // a published aggregate could become member-visible with no operator route to
    // retract it -- which is strictly worse than blocking a write.
    renderActions({ identity: null, candidate: candidateFrom({ is_published: true }) });

    expect(screen.getByRole('button', { name: /^unpublish$/i })).not.toBeDisabled();
  });

  it('DISCRIMINATES: the same controls are enabled once an identity IS present', () => {
    // Without this, the three assertions above would pass against a component
    // that disabled everything unconditionally.
    const { unmount } = renderActions({ identity: IDENTITY });
    expect(screen.getByRole('button', { name: /create candidate/i })).not.toBeDisabled();
    unmount();

    renderActions({ identity: IDENTITY, candidate: candidateFrom({ is_published: false }) });
    expect(screen.getByRole('button', { name: /refresh candidate/i })).not.toBeDisabled();
  });

  it('never dispatches a create request while the identity is null', async () => {
    // The gate is enforced in handleAction too, not only by the disabled
    // attribute -- a disabled attribute can be cleared and Enter-to-submit never
    // consults it.
    //
    // THE MODAL IS OPENED WITH A VALID IDENTITY FIRST, then the component is
    // rerendered with `identity: null` while the form is still mounted. A review
    // showed the previous version was VACUOUS: with a null identity from the
    // start no modal renders at all, so it submitted a detached fallback form
    // with no component listener -- which cannot dispatch whether or not the
    // guard exists. This sequence puts the real production form on screen and
    // then removes the identity underneath it.
    const user = userEvent.setup();
    const { rerender } = render(
      <SiteAggregateAdminActions
        source_dra_id={SOURCE_DRA_ID}
        identity={IDENTITY}
        defaultLabel="Default Label"
        lifecyclePreview={DEFAULT_LIFECYCLE_PREVIEW}
        candidate={candidateFrom({ is_published: false })}
      />,
    );

    await user.click(screen.getByRole('button', { name: /refresh candidate/i }));
    await user.type(document.querySelectorAll('textarea')[0], 'a reason');
    // The form is now genuinely rendered and wired to the component.
    expect(screen.getByRole('form', { name: /site aggregate candidate action/i })).toBeTruthy();

    rerender(
      <SiteAggregateAdminActions
        source_dra_id={SOURCE_DRA_ID}
        identity={null}
        defaultLabel="Default Label"
        lifecyclePreview={DEFAULT_LIFECYCLE_PREVIEW}
        candidate={candidateFrom({ is_published: false })}
      />,
    );

    fireEvent.submit(screen.getByRole('form', { name: /site aggregate candidate action/i }));

    await waitFor(() =>
      expect(
        screen.getByText(/no server-derived cluster identity, so a candidate cannot be created/i),
      ).toBeTruthy(),
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('DISCRIMINATES: the same sequence DOES dispatch when the identity survives', async () => {
    // Without this, the assertion above would pass against a component that never
    // dispatched anything from a rerendered form.
    const user = userEvent.setup();
    render(
      <SiteAggregateAdminActions
        source_dra_id={SOURCE_DRA_ID}
        identity={IDENTITY}
        defaultLabel="Default Label"
        lifecyclePreview={DEFAULT_LIFECYCLE_PREVIEW}
        candidate={candidateFrom({ is_published: false })}
      />,
    );

    await user.click(screen.getByRole('button', { name: /refresh candidate/i }));
    await user.type(document.querySelectorAll('textarea')[0], 'a reason');
    fireEvent.submit(screen.getByRole('form', { name: /site aggregate candidate action/i }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
  });
});

/**
 * F2 -- THE OPERATOR MUST SEE THE ALL-TIER SNAPSHOT BEFORE CREATE.
 *
 * A holistic review found this: on a mixed-tier cluster with no existing
 * candidate, only the lifecycle IDENTITY was passed in. The all-tier counts, tier
 * and source were returned by the RPC and then dropped, so the operator saw the
 * MEDIUM-TIER row, clicked Create, and only discovered the persisted all-tier
 * values afterwards.
 *
 * That contradicts F2's whole premise. A preview that cannot show what will be
 * written is not a preview -- and this is precisely the gap a per-half review
 * cannot see, because the SQL was returning the data correctly and the component
 * was rendering correctly; only the WIRING between them lost it.
 */
describe('all-tier snapshot is visible before Create (F2)', () => {
  const lifecyclePreview = DEFAULT_LIFECYCLE_PREVIEW;

  it('shows the all-tier counts, tier and source when there is NO candidate yet', () => {
    renderActions({ identity: IDENTITY, lifecyclePreview });

    const panel = screen.getByTestId('create-lifecycle-preview');
    expect(panel.textContent).toContain('41');
    expect(panel.textContent).toContain('23');
    expect(panel.textContent).toContain('11');
    expect(panel.textContent).toContain('7');
    expect(panel.textContent).toContain('high');
    expect(panel.textContent).toContain('bc_csr_centroid; survey');
  });

  it('says plainly that these differ from the medium-tier row beside them', () => {
    renderActions({ identity: IDENTITY, lifecyclePreview });

    expect(
      screen.getByText(/all-tier values are what would be written/i),
    ).toBeTruthy();
  });

  it('is rendered on the CREATE path specifically, alongside the Create control', () => {
    renderActions({ identity: IDENTITY, lifecyclePreview });

    expect(screen.getByRole('button', { name: /create candidate/i })).toBeTruthy();
    expect(screen.getByTestId('create-lifecycle-preview')).toBeTruthy();
  });

  it('DISCRIMINATES: absent without the prop, so the panel is genuinely data-driven', () => {
    // Without this the assertions above could pass against a hard-coded panel.
    renderActions({ identity: IDENTITY, lifecyclePreview: undefined });

    expect(screen.queryByTestId('create-lifecycle-preview')).toBeNull();
  });

  it('swaps the CREATE proposal for the REFRESH proposal once a candidate exists', () => {
    // THIS ASSERTION CHANGED, and the reason is worth stating. It used to require
    // that NO proposal panel render once a candidate existed, reasoning that the
    // persisted values are authoritative and that showing both invites the
    // operator to compare a proposal against stored state as if they were the
    // same kind of claim.
    //
    // That reasoning holds for CREATE, which is unreachable here. It does not
    // hold for REFRESH, which OVERWRITES the persisted panel with the current
    // all-tier snapshot -- so suppressing every proposal meant the operator
    // confirmed that overwrite while looking only at the values being discarded.
    // On a drifted cluster, the case where Refresh is the correct action, those
    // differ, and the difference is the whole reason to act.
    //
    // The original concern is answered by SEPARATION, not suppression: the
    // Refresh panel is distinctly labelled, sits beneath the persisted values it
    // would replace, and calls itself a proposal.
    renderActions({ identity: IDENTITY, lifecyclePreview, candidate: candidateFrom() });

    expect(screen.queryByTestId('create-lifecycle-preview')).toBeNull();
    expect(screen.getByTestId('refresh-lifecycle-preview')).toBeTruthy();
    expect(screen.getByText(/all-tier publication candidate/i)).toBeTruthy();
    expect(screen.getByText(/A PROPOSAL, not stored state/i)).toBeTruthy();
  });

  it('renders NO refresh proposal without the prop, so that panel is data-driven too', () => {
    // The discrimination the Create panel already has. Without it the assertion
    // above could pass against a hard-coded panel.
    renderActions({ identity: IDENTITY, candidate: candidateFrom(), lifecyclePreview: undefined });

    expect(screen.queryByTestId('refresh-lifecycle-preview')).toBeNull();
  });

  /**
   * AND WITH NO PROPOSAL, THE SNAPSHOT WRITES ARE BLOCKED.
   *
   * Rendering no panel is only half a fix. A candidate-only row has a valid
   * persisted identity, so `writeBlocked` stayed false and Refresh remained
   * clickable with nothing shown -- the very defect the panel exists to prevent,
   * reached by the path the panel does not cover. Two real ways in: an
   * `outsidePreviewTier` row, whose upsert necessarily fails its medium-sample
   * guard, and an unpublished soft-deleted DRA whose samples remain, whose upsert
   * can rewrite the candidate from values never shown.
   */
  it('DISABLES Refresh when there is no all-tier proposal to show', () => {
    renderActions({ identity: IDENTITY, candidate: candidateFrom(), lifecyclePreview: undefined });

    const refresh = screen.getByRole('button', { name: /refresh candidate/i });
    expect((refresh as HTMLButtonElement).disabled).toBe(true);
    expect(refresh.getAttribute('title')).toMatch(/values you have not seen/i);
  });

  it('ENABLES Refresh once the proposal is present, so the gate is not blanket', () => {
    // DISCRIMINATING: without this the assertion above could pass against a
    // Refresh button that is simply always disabled.
    renderActions({ identity: IDENTITY, candidate: candidateFrom(), lifecyclePreview });

    const refresh = screen.getByRole('button', { name: /refresh candidate/i });
    expect((refresh as HTMLButtonElement).disabled).toBe(false);
  });

  it('DISABLES Create when there is no all-tier proposal to show', () => {
    renderActions({ identity: IDENTITY, lifecyclePreview: undefined });

    const create = screen.getByRole('button', { name: /create candidate/i });
    expect((create as HTMLButtonElement).disabled).toBe(true);
  });

  it('ENABLES Create once the proposal is present', () => {
    renderActions({ identity: IDENTITY, lifecyclePreview });

    const create = screen.getByRole('button', { name: /create candidate/i });
    expect((create as HTMLButtonElement).disabled).toBe(false);
  });

  it('leaves UNPUBLISH available with no proposal, because it REDUCES visibility', () => {
    // The gate must not strand the only retraction path precisely when the
    // preview is unavailable -- that would turn a read failure into stale
    // member-visible data with no way to pull it back.
    renderActions({
      identity: IDENTITY,
      candidate: candidateFrom({ is_published: true }),
      lifecyclePreview: undefined,
    });

    const unpublish = screen.getByRole('button', { name: /unpublish/i });
    expect((unpublish as HTMLButtonElement).disabled).toBe(false);
  });
});
