import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import {
  SiteAggregateAdminActions,
  computeSnapshotDrift,
  type SiteAggregateCandidate,
  type LiveAggregateSnapshot,
} from '../SiteAggregateAdminActions';

const SOURCE_DRA_ID = '11111111-1111-4111-8111-111111111111';
const CLUSTER_ID = 'cluster-alpha';
const PUBLICATION_ID = '33333333-3333-4333-8333-333333333333';

function liveSnapshot(over: Partial<LiveAggregateSnapshot> = {}): LiveAggregateSnapshot {
  return {
    sample_count_total: 10,
    sample_count_high: 1,
    sample_count_medium: 8,
    sample_count_low: 1,
    distinct_point_count: 1,
    representative_latitude: 49.2827,
    representative_longitude: -123.1207,
    coordinate_quality_tier: 'medium',
    ...over,
  };
}

function candidateFrom(over: Partial<SiteAggregateCandidate> = {}): SiteAggregateCandidate {
  const live = liveSnapshot();
  return {
    publication_id: PUBLICATION_ID,
    source_dra_id: SOURCE_DRA_ID,
    coordinate_cluster_id: CLUSTER_ID,
    member_display_label: 'Neutral Label 1',
    is_published: false,
    sample_count_total: live.sample_count_total,
    sample_count_high: live.sample_count_high,
    sample_count_medium: live.sample_count_medium,
    sample_count_low: live.sample_count_low,
    distinct_point_count: live.distinct_point_count,
    representative_latitude: live.representative_latitude,
    representative_longitude: live.representative_longitude,
    coordinate_quality_tier: live.coordinate_quality_tier,
    ...over,
  };
}

function renderActions(props: Partial<React.ComponentProps<typeof SiteAggregateAdminActions>> = {}) {
  return render(
    <SiteAggregateAdminActions
      source_dra_id={SOURCE_DRA_ID}
      coordinate_cluster_id={CLUSTER_ID}
      defaultLabel="Default Label"
      liveSnapshot={liveSnapshot()}
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

describe('computeSnapshotDrift', () => {
  it('reports "match" when the candidate matches live data', () => {
    expect(computeSnapshotDrift(candidateFrom(), liveSnapshot())).toBe('match');
  });

  it('reports "drift" when the total sample count changes', () => {
    expect(
      computeSnapshotDrift(candidateFrom({ sample_count_total: 9 }), liveSnapshot()),
    ).toBe('drift');
  });

  it('reports "drift" when tiers are redistributed but the TOTAL is unchanged', () => {
    // This is the case the previous sample_count_total-only check could not see.
    expect(
      computeSnapshotDrift(
        candidateFrom({ sample_count_high: 5, sample_count_medium: 4 }),
        liveSnapshot(),
      ),
    ).toBe('drift');
  });

  it('reports "drift" when the representative coordinate moves', () => {
    expect(
      computeSnapshotDrift(candidateFrom({ representative_latitude: 49.5 }), liveSnapshot()),
    ).toBe('drift');
  });

  it('reports "drift" when distinct point count changes', () => {
    expect(
      computeSnapshotDrift(candidateFrom({ distinct_point_count: 3 }), liveSnapshot()),
    ).toBe('drift');
  });

  it('reports "drift" when the dominant coordinate tier changes', () => {
    expect(
      computeSnapshotDrift(candidateFrom({ coordinate_quality_tier: 'high' }), liveSnapshot()),
    ).toBe('drift');
  });

  it('tolerates float noise beyond 5 decimal places', () => {
    expect(
      computeSnapshotDrift(
        candidateFrom({ representative_latitude: 49.28270000001 }),
        liveSnapshot(),
      ),
    ).toBe('match');
  });

  it('returns "match" when there is no candidate', () => {
    expect(computeSnapshotDrift(undefined, liveSnapshot())).toBe('match');
  });

  it('returns "unknown" when the live snapshot is unavailable', () => {
    expect(computeSnapshotDrift(candidateFrom(), undefined)).toBe('unknown');
  });

  it('computeSnapshotDrift returns "unknown" when liveSnapshot is undefined', () => {
    // Explicit standalone coverage for the tri-state contract: an orphaned
    // publication (candidate present, no live aggregate) must never be
    // reported as a confirmed match.
    expect(computeSnapshotDrift(candidateFrom(), undefined)).toBe('unknown');
  });

  it('reports "unknown" -- not a match -- for a candidate missing comparison fields (fixed defect: this previously reported false/match)', () => {
    // A partial or version-skewed admin row used to have its absent fields
    // silently skipped, which made an incomplete snapshot indistinguishable
    // from a confirmed match. That was the defect; it is now 'unknown'.
    const partial: SiteAggregateCandidate = {
      source_dra_id: SOURCE_DRA_ID,
      coordinate_cluster_id: CLUSTER_ID,
      member_display_label: 'Neutral Label 1',
      is_published: false,
      sample_count_total: 10,
    };
    expect(computeSnapshotDrift(partial, liveSnapshot())).toBe('unknown');
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
      candidate: candidateFrom({ sample_count_total: 9 }),
      liveSnapshot: liveSnapshot(),
    });

    expect(screen.getByText('(Drifted)')).toBeInTheDocument();
  });

  it('does not show the drift badge when the snapshot matches', () => {
    renderActions({ candidate: candidateFrom(), liveSnapshot: liveSnapshot() });

    expect(screen.queryByText('(Drifted)')).not.toBeInTheDocument();
  });

  it('does not claim hash semantics in the badge tooltip', () => {
    // The badge previously read "Hash drifted!" while comparing sample counts.
    renderActions({ candidate: candidateFrom({ sample_count_total: 9 }) });

    expect(screen.getByText('(Drifted)').getAttribute('title')).not.toMatch(/hash/i);
  });

  it('renders a "Drift unknown" indicator when a candidate is passed with no liveSnapshot prop', () => {
    renderActions({ candidate: candidateFrom(), liveSnapshot: undefined });

    expect(screen.getByText('Drift unknown')).toBeInTheDocument();
    expect(screen.queryByText('(Drifted)')).not.toBeInTheDocument();
  });

  it('renders neither "Drift unknown" nor "(Drifted)" when the candidate matches live data exactly', () => {
    renderActions({ candidate: candidateFrom(), liveSnapshot: liveSnapshot() });

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
      reason: 'pilot publish',
    });
  });

  it('shows an inline error and re-enables the form when the API fails', async () => {
    fetchMock.mockResolvedValue({ ok: false, json: async () => ({ error: 'conflict' }) });
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

  it('surfaces a network rejection as an inline error', async () => {
    fetchMock.mockRejectedValue(new Error('network down'));
    const user = userEvent.setup();
    renderActions();

    await user.click(screen.getByRole('button', { name: /create candidate/i }));
    await user.type(document.querySelectorAll('textarea')[0], 'initial candidate');
    await user.click(screen.getByRole('button', { name: /^create$/i }));

    expect(await screen.findByText('network down')).toBeInTheDocument();
    expect(reloadMock).not.toHaveBeenCalled();
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
