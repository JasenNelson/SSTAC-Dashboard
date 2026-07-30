/**
 * F1 / F5 behavioural coverage for the site-aggregate lifecycle classification.
 *
 * These exercise the real function rather than matching page source, which is
 * why the classification was extracted: the preview is an async server
 * component, so an inline implementation could only be "tested" by asserting
 * that certain text exists.
 *
 * The invariant under test: the classifier NEVER claims absence. `match` and
 * `drift` positively prove a live aggregate; every other unmatched state --
 * `unknown` (overloaded server-side with soft-delete), absent, null, an
 * unrecognized value, or a duplicated identity -- is reported as
 * status-unavailable. Rows stay reachable in both cases so Unpublish is never
 * lost, and the UI never claims an aggregate is gone.
 */
import { describe, it, expect } from 'vitest';
import {
  classifyLifecycleRows,
  deriveLifecycleEvidenceAxes,
  lifecycleRowKey,
} from '@/lib/matrix-map/site-aggregate-lifecycle-rows';

const DRA_A = '11111111-1111-4111-8111-111111111111';
const DRA_B = '22222222-2222-4222-8222-222222222222';

const agg = (source_dra_id: string | null, coordinate_cluster_id: string) => ({
  source_dra_id,
  coordinate_cluster_id,
});
const cand = (source_dra_id: string, coordinate_cluster_id: string, publication_id = 'p1') => ({
  source_dra_id,
  coordinate_cluster_id,
  publication_id,
});
/**
 * A candidate the SERVER explicitly reports as having no snapshot. Confirmed
 * absence needs positive evidence, so most orphan cases use this rather than a
 * bare `cand(...)`: an ABSENT drift state is indeterminate, not proof.
 */
const goneCand = (source_dra_id: string, coordinate_cluster_id: string, publication_id = 'p1') => ({
  ...cand(source_dra_id, coordinate_cluster_id, publication_id),
  snapshot_drift_state: 'unknown',
});

describe('lifecycle rows -- COMPLETE evidence', () => {
  it('reports a candidate with no live aggregate as status-unavailable', () => {
    const result = classifyLifecycleRows({
      aggregates: [agg(DRA_A, '1.00000,2.00000')],
      candidates: [cand(DRA_A, '1.00000,2.00000'), goneCand(DRA_B, '9.00000,9.00000', 'p2')],
      previewIncomplete: false,
      candidateIncomplete: false,
    });

    expect(result.lifecycleBlocked).toBe(false);
    expect(result.unknownStatusCandidates.map((c) => c.publication_id)).toEqual(['p2']);
    // No absence is claimed about it, and the live row is untouched.
    expect(result.outsidePreviewTier).toEqual([]);
  });

  it('reports nothing when every candidate has a live aggregate', () => {
    const result = classifyLifecycleRows({
      aggregates: [agg(DRA_A, '1.00000,2.00000')],
      candidates: [cand(DRA_A, '1.00000,2.00000')],
      previewIncomplete: false,
      candidateIncomplete: false,
    });

    expect(result.outsidePreviewTier).toEqual([]);
    expect(result.unknownStatusCandidates).toEqual([]);
  });

  it('matches a null-DRA aggregate to its candidate without collapsing distinct keys', () => {
    // `${null}` and `${''}` must not silently unify two different identities.
    const result = classifyLifecycleRows({
      aggregates: [agg(null, '1.00000,2.00000')],
      candidates: [cand('', '1.00000,2.00000'), goneCand(DRA_A, '1.00000,2.00000', 'p2')],
      previewIncomplete: false,
      candidateIncomplete: false,
    });

    expect(result.unknownStatusCandidates.map((c) => c.publication_id)).toEqual(['p2']);
  });
});

describe('lifecycle rows -- INCOMPLETE evidence never manufactures an orphan', () => {
  // One case per way the load can be incomplete. Each asserts the same three
  // things: no confirmed orphan, the row still reachable, controls failing closed.
  it.each([
    ['a failed sample or DRA load (aggregates empty)', [] as ReturnType<typeof agg>[]],
    ['a truncated sample load (aggregates partial)', [agg(DRA_B, '9.00000,9.00000')]],
  ])('reports UNKNOWN rather than orphaned after %s', (_label, aggregates) => {
    const result = classifyLifecycleRows({
      aggregates,
      candidates: [cand(DRA_A, '1.00000,2.00000')],
      previewIncomplete: true,
      candidateIncomplete: false,
    });

    expect(result.lifecycleBlocked).toBe(true);
    // The false claim must not be reachable...
    expect(result.outsidePreviewTier).toEqual([]);
    // ...while the row itself stays visible so Unpublish is never stranded.
    expect(result.unknownStatusCandidates.map((c) => c.publication_id)).toEqual(['p1']);
  });

  it('reports UNKNOWN after a truncated CANDIDATE load', () => {
    // Truncated candidates reach the classifier as incompleteLoad: the live
    // aggregates may be complete, but the candidate set is not.
    const result = classifyLifecycleRows({
      aggregates: [agg(DRA_A, '1.00000,2.00000')],
      candidates: [cand(DRA_B, '9.00000,9.00000')],
      previewIncomplete: true,
      candidateIncomplete: false,
    });

    expect(result.outsidePreviewTier).toEqual([]);
    expect(result.unknownStatusCandidates).toHaveLength(1);
  });

  it('keeps a PUBLISHED candidate retractable without asserting it is orphaned', () => {
    // The exact case the ruling names: the escape hatch survives, the false
    // factual claim does not.
    const published = { ...cand(DRA_A, '1.00000,2.00000', 'pub-1'), is_published: true };
    const result = classifyLifecycleRows({
      aggregates: [],
      candidates: [published],
      previewIncomplete: true,
      candidateIncomplete: false,
    });

    expect(result.unknownStatusCandidates).toEqual([published]);
    expect(result.outsidePreviewTier).toEqual([]);
    // Still addressable by identity, so the Unpublish control has a target.
    expect(result.unmatchedCandidates).toContain(published);
  });
});

describe('lifecycle rows -- duplicate identities fail closed', () => {
  it('detects a duplicated publication identity instead of picking one arbitrarily', () => {
    const first = cand(DRA_A, '1.00000,2.00000', 'p1');
    const second = cand(DRA_A, '1.00000,2.00000', 'p2');
    const result = classifyLifecycleRows({
      aggregates: [agg(DRA_A, '1.00000,2.00000')],
      candidates: [first, second],
      previewIncomplete: false,
      candidateIncomplete: false,
    });

    expect(result.hasDuplicateCandidates).toBe(true);
    expect(result.duplicateCandidateKeys).toEqual([lifecycleRowKey(DRA_A, '1.00000,2.00000')]);
    // A duplicate makes the read untrustworthy, so evidence is incomplete even
    // though no load errored -- and no orphan claim may be made.
    expect(result.lifecycleBlocked).toBe(true);
    expect(result.outsidePreviewTier).toEqual([]);
  });

  it('reports each duplicated key once, not once per extra occurrence', () => {
    const result = classifyLifecycleRows({
      aggregates: [],
      candidates: [
        cand(DRA_A, '1.00000,2.00000', 'p1'),
        cand(DRA_A, '1.00000,2.00000', 'p2'),
        cand(DRA_A, '1.00000,2.00000', 'p3'),
      ],
      previewIncomplete: false,
      candidateIncomplete: false,
    });

    expect(result.duplicateCandidateKeys).toHaveLength(1);
  });

  it('leaves clean input free of duplicate signals', () => {
    const result = classifyLifecycleRows({
      aggregates: [],
      candidates: [cand(DRA_A, '1.00000,2.00000', 'p1'), cand(DRA_B, '3.00000,4.00000', 'p2')],
      previewIncomplete: false,
      candidateIncomplete: false,
    });

    expect(result.hasDuplicateCandidates).toBe(false);
    expect(result.lifecycleBlocked).toBe(false);
  });
});

describe('lifecycle rows -- F5 indexed lookup', () => {
  it('exposes an O(1) index keyed by publication identity', () => {
    const target = cand(DRA_B, '3.00000,4.00000', 'p2');
    const result = classifyLifecycleRows({
      aggregates: [],
      candidates: [cand(DRA_A, '1.00000,2.00000', 'p1'), target],
      previewIncomplete: false,
      candidateIncomplete: false,
    });

    expect(result.candidateByKey.get(lifecycleRowKey(DRA_B, '3.00000,4.00000'))).toBe(target);
    expect(result.candidateByKey.size).toBe(2);
  });

  it('keys the index the same way the aggregate side does, including a null DRA', () => {
    const result = classifyLifecycleRows({
      aggregates: [agg(null, '1.00000,2.00000')],
      candidates: [cand('', '1.00000,2.00000')],
      previewIncomplete: false,
      candidateIncomplete: false,
    });

    // If the two sides keyed differently this would be a false orphan.
    expect(result.unmatchedCandidates).toEqual([]);
  });
});

describe('lifecycle rows -- the classifier never claims absence', () => {
  // The page's aggregate set is a MEDIUM-TIER preview; a candidate spans every
  // tier in its cluster. A cluster that keeps high- or low-tier samples but
  // loses its last medium one disappears from the preview while remaining alive
  // server-side. Calling that an orphan printed "No live aggregate" beside a
  // Drifted badge derived from the very aggregate it claimed was gone.
  it.each([['match'], ['drift']])(
    'reports an unmatched candidate the server calls %s as outside-tier, NOT orphaned',
    (state) => {
      const c = { ...cand(DRA_A, '1.00000,2.00000'), snapshot_drift_state: state };
      const result = classifyLifecycleRows({
        aggregates: [],
        candidates: [c],
        previewIncomplete: false,
      candidateIncomplete: false,
      });

      expect(result.outsidePreviewTier).toEqual([c]);
      expect(result.unknownStatusCandidates).toEqual([]);
    },
  );

  it("reports the server no-snapshot state as UNAVAILABLE, not as proven absence", () => {
    const c = { ...cand(DRA_A, '1.00000,2.00000'), snapshot_drift_state: 'unknown' };
    const result = classifyLifecycleRows({
      aggregates: [],
      candidates: [c],
      previewIncomplete: false,
      candidateIncomplete: false,
    });

    expect(result.unknownStatusCandidates).toEqual([c]);
    expect(result.outsidePreviewTier).toEqual([]);
  });

  it.each([[null], [undefined]])(
    'treats a %s drift state as status-unavailable, never as proven absence',
    (state) => {
      // Version skew or a truncated payload is not evidence the aggregate is
      // gone. Claiming "No live aggregate" here would contradict the action
      // component, which renders "Drift unknown" from the same value.
      const c = {
        ...cand(DRA_A, '1.00000,2.00000'),
        ...(state === undefined ? {} : { snapshot_drift_state: state }),
      };
      const result = classifyLifecycleRows({
        aggregates: [],
        candidates: [c],
        previewIncomplete: false,
      candidateIncomplete: false,
      });

      expect(result.outsidePreviewTier).toEqual([]);
      expect(result.outsidePreviewTier).toEqual([]);
      expect(result.unknownStatusCandidates).toEqual([c]);
    },
  );

  it('never confirms an orphan under incomplete evidence, whatever the server says', () => {
    const c = { ...cand(DRA_A, '1.00000,2.00000'), snapshot_drift_state: 'unknown' };
    const result = classifyLifecycleRows({
      aggregates: [],
      candidates: [c],
      previewIncomplete: true,
      candidateIncomplete: false,
    });

    expect(result.outsidePreviewTier).toEqual([]);
    expect(result.unknownStatusCandidates).toEqual([c]);
  });
});

describe('lifecycle rows -- duplicates are QUARANTINED, not silently resolved', () => {
  const first = { ...cand(DRA_A, '1.00000,2.00000', 'p1'), snapshot_drift_state: 'match' };
  const second = { ...cand(DRA_A, '1.00000,2.00000', 'p2'), snapshot_drift_state: 'match' };

  it('keeps NEITHER duplicate in the lookup, so no row is preferred', () => {
    const result = classifyLifecycleRows({
      aggregates: [agg(DRA_A, '1.00000,2.00000')],
      candidates: [first, second],
      previewIncomplete: false,
      candidateIncomplete: false,
    });

    expect(result.candidateByKey.has(lifecycleRowKey(DRA_A, '1.00000,2.00000'))).toBe(false);
    expect(result.quarantinedCandidates).toEqual([first, second]);
  });

  it('keeps BOTH duplicates reachable, so a published second row can still be unpublished', () => {
    // The defect: retaining only the first left a published SECOND candidate
    // with no reachable Unpublish control at all.
    const result = classifyLifecycleRows({
      aggregates: [agg(DRA_A, '1.00000,2.00000')],
      candidates: [first, second],
      previewIncomplete: false,
      candidateIncomplete: false,
    });

    expect(result.unknownStatusCandidates).toContain(first);
    expect(result.unknownStatusCandidates).toContain(second);
  });

  it('does not quarantine distinct identities', () => {
    const other = { ...cand(DRA_B, '3.00000,4.00000', 'p3'), snapshot_drift_state: 'match' };
    const result = classifyLifecycleRows({
      aggregates: [agg(DRA_A, '1.00000,2.00000'), agg(DRA_B, '3.00000,4.00000')],
      candidates: [first, other],
      previewIncomplete: false,
      candidateIncomplete: false,
    });

    expect(result.quarantinedCandidates).toEqual([]);
    expect(result.candidateByKey.size).toBe(2);
  });
});

describe('lifecycle rows -- quarantined rows appear EXACTLY once', () => {
  // The bug: quarantined candidates were appended to unknownStatusCandidates
  // while ALSO remaining in the normal buckets, so the page rendered the same
  // publication twice -- duplicate keys and two Unpublish controls for one row.
  const mk = (pub: string, state: string | undefined) => ({
    ...cand(DRA_A, '1.00000,2.00000', pub),
    ...(state === undefined ? {} : { snapshot_drift_state: state }),
  });

  it.each([['unknown'], ['match'], ['drift'], [undefined]])(
    'never double-lists a duplicated identity whose state is %s',
    (state) => {
      const a = mk('p1', state);
      const b = mk('p2', state);
      const result = classifyLifecycleRows({
        aggregates: [],
        candidates: [a, b],
        previewIncomplete: false,
      candidateIncomplete: false,
      });

      const everywhere = [...result.outsidePreviewTier, ...result.unknownStatusCandidates];
      // Each candidate appears once in total, across ALL buckets.
      for (const c of [a, b]) {
        expect(everywhere.filter((x) => x === c)).toHaveLength(1);
      }
      expect(result.unknownStatusCandidates).toEqual([a, b]);
      expect(result.outsidePreviewTier).toEqual([]);
      expect(result.outsidePreviewTier).toEqual([]);
      // And it is absent from the normal unmatched population entirely.
      expect(result.unmatchedCandidates).not.toContain(a);
    },
  );
});

describe('lifecycle rows -- only match/drift prove liveness', () => {
  it.each([['weird'], ['MATCH'], ['live'], ['']])(
    'treats the unrecognized state %s as NOT proof of life',
    (state) => {
      // Version skew or a malformed payload must not let a row claim "Live,
      // but outside this medium-tier preview" while the action component
      // renders "Drift unknown" from the same value.
      const c = { ...cand(DRA_A, '1.00000,2.00000'), snapshot_drift_state: state };
      const result = classifyLifecycleRows({
        aggregates: [],
        candidates: [c],
        previewIncomplete: false,
      candidateIncomplete: false,
      });

      expect(result.outsidePreviewTier).toEqual([]);
      // Not proof of life AND not proof of absence: indeterminate.
      expect(result.outsidePreviewTier).toEqual([]);
      expect(result.unknownStatusCandidates).toEqual([c]);
    },
  );

  it.each([['match'], ['drift']])('accepts %s as proof of life', (state) => {
    const c = { ...cand(DRA_A, '1.00000,2.00000'), snapshot_drift_state: state };
    const result = classifyLifecycleRows({
      aggregates: [],
      candidates: [c],
      previewIncomplete: false,
      candidateIncomplete: false,
    });

    expect(result.outsidePreviewTier).toEqual([c]);
    expect(result.unknownStatusCandidates).toEqual([]);
  });
});

describe('evidence axes -- a candidate failure must not blank the preview (F6)', () => {
  // The production rule, exercised directly: `previewRenderable` decides whether
  // the medium-tier aggregates are computed at all.
  it('keeps the preview renderable when ONLY the candidate RPC fails', () => {
    const axes = deriveLifecycleEvidenceAxes({
      previewLoadError: null,
      previewTruncated: false,
      previewRowsUnreadable: false,
      candidateLoadError: 'function matrix_map.fetch_admin_site_aggregate_publications does not exist',
      candidateTruncated: false,
    });

    // This is the state the branch is in until the Option C SQL is applied.
    expect(axes.previewRenderable).toBe(true);
    expect(axes.previewIncomplete).toBe(false);
    expect(axes.candidateIncomplete).toBe(true);
  });

  it('keeps the preview renderable when the candidate read is merely truncated', () => {
    const axes = deriveLifecycleEvidenceAxes({
      previewLoadError: null,
      previewTruncated: false,
      previewRowsUnreadable: false,
      candidateLoadError: null,
      candidateTruncated: true,
    });

    expect(axes.previewRenderable).toBe(true);
    expect(axes.previewIncomplete).toBe(false);
    expect(axes.candidateIncomplete).toBe(true);
  });

  it('does NOT render the preview when the sample or DRA load itself errored', () => {
    const axes = deriveLifecycleEvidenceAxes({
      previewLoadError: 'samples query failed',
      previewTruncated: false,
      previewRowsUnreadable: false,
      candidateLoadError: null,
      candidateTruncated: false,
    });

    expect(axes.previewRenderable).toBe(false);
    expect(axes.previewIncomplete).toBe(true);
    expect(axes.candidateIncomplete).toBe(false);
  });

  it('does NOT render the preview when the DRA load itself errored (F11)', () => {
    // A DRA query error is merged into the same `loadError` sentinel as a
    // sample error before it ever reaches this function (see page.tsx), so
    // it must gate `previewRenderable` exactly like a sample-load error.
    const axes = deriveLifecycleEvidenceAxes({
      previewLoadError: 'dras query failed',
      previewTruncated: false,
      previewRowsUnreadable: false,
      candidateLoadError: null,
      candidateTruncated: false,
    });

    expect(axes.previewRenderable).toBe(false);
    expect(axes.previewIncomplete).toBe(true);
  });

  it('still renders a TRUNCATED preview, but marks it incomplete', () => {
    // Truncation is not corruption: the rows that loaded are real, so the table
    // stays useful while every claim derived from completeness is withheld.
    const axes = deriveLifecycleEvidenceAxes({
      previewLoadError: null,
      previewTruncated: true,
      previewRowsUnreadable: false,
      candidateLoadError: null,
      candidateTruncated: false,
    });

    expect(axes.previewRenderable).toBe(true);
    expect(axes.previewIncomplete).toBe(true);
  });

  it('makes previewIncomplete true when the DRA load is truncated (F11)', () => {
    // This is the defect: the DRA query was the one evidence source on this
    // page that was never paged, so its truncation never reached this axis.
    const axes = deriveLifecycleEvidenceAxes({
      previewLoadError: null,
      previewTruncated: false,
      previewRowsUnreadable: true,
      candidateLoadError: null,
      candidateTruncated: false,
    });

    expect(axes.previewIncomplete).toBe(true);
  });

  it('still renders a DRA-TRUNCATED preview -- truncated is not corrupt (F11)', () => {
    // Same rule as sample truncation: the rows that loaded are real, so the
    // preview stays renderable while `previewIncomplete` withholds any claim
    // that depends on completeness.
    const axes = deriveLifecycleEvidenceAxes({
      previewLoadError: null,
      previewTruncated: false,
      previewRowsUnreadable: true,
      candidateLoadError: null,
      candidateTruncated: false,
    });

    expect(axes.previewRenderable).toBe(true);
    expect(axes.previewIncomplete).toBe(true);
  });

  it('never lets a candidate signal contaminate the preview axis', () => {
    // Exhaustive over the candidate axis: no candidate-side input may change
    // either preview-side output.
    for (const candidateLoadError of [null, 'boom']) {
      for (const candidateTruncated of [false, true]) {
        const axes = deriveLifecycleEvidenceAxes({
          previewLoadError: null,
          previewTruncated: false,
          previewRowsUnreadable: false,
          candidateLoadError,
          candidateTruncated,
        });
        expect(axes.previewIncomplete).toBe(false);
        expect(axes.previewRenderable).toBe(true);
      }
    }
  });

  it('never lets a candidate signal contaminate the preview axis, even under DRA truncation (F11)', () => {
    // Candidate-side signals must still never affect the preview axis when
    // combined with the new DRA-truncation signal.
    for (const candidateLoadError of [null, 'boom']) {
      for (const candidateTruncated of [false, true]) {
        const axes = deriveLifecycleEvidenceAxes({
          previewLoadError: null,
          previewTruncated: false,
          previewRowsUnreadable: true,
          candidateLoadError,
          candidateTruncated,
        });
        // previewIncomplete is driven by previewRowsUnreadable alone here --
        // the candidate axis must not flip it back to false or add anything.
        expect(axes.previewIncomplete).toBe(true);
        expect(axes.previewRenderable).toBe(true);
      }
    }
  });
});

describe('lifecycle rows -- the local-omission CLAIM depends only on the preview axis (F8)', () => {
  const live = (state: string) => ({
    ...cand(DRA_A, '1.00000,2.00000'),
    snapshot_drift_state: state,
  });

  it.each([['match'], ['drift']])(
    'explains the omission as tiering when the preview is COMPLETE (%s)',
    (state) => {
      const c = live(state);
      const result = classifyLifecycleRows({
        aggregates: [],
        candidates: [c],
        previewIncomplete: false,
        candidateIncomplete: false,
      });

      expect(result.outsidePreviewTier).toEqual([c]);
      expect(result.liveUnclassified).toEqual([]);
    },
  );

  it.each([['match'], ['drift']])(
    'REFUSES to explain the omission when the preview is INCOMPLETE (%s)',
    (state) => {
      // Liveness is proven; the CAUSE of the local absence is not. It could be
      // tiering, or it could be the truncated read.
      const c = live(state);
      const result = classifyLifecycleRows({
        aggregates: [],
        candidates: [c],
        previewIncomplete: true,
        candidateIncomplete: false,
      });

      expect(result.liveUnclassified).toEqual([c]);
      expect(result.outsidePreviewTier).toEqual([]);
      expect(result.unknownStatusCandidates).toEqual([]);
    },
  );

  it('keeps the tiering explanation when ONLY the candidate read was incomplete', () => {
    // Candidate-side incompleteness means the candidate SET may be short. It
    // says nothing about a row that DID come back, so the explanation for that
    // row survives -- the axes must not be re-conflated in this direction.
    const c = live('match');
    const result = classifyLifecycleRows({
      aggregates: [],
      candidates: [c],
      previewIncomplete: false,
      candidateIncomplete: true,
    });

    expect(result.outsidePreviewTier).toEqual([c]);
    expect(result.liveUnclassified).toEqual([]);
  });

  it('blocks mutating controls on EITHER axis', () => {
    const base = { aggregates: [], candidates: [] as ReturnType<typeof cand>[] };
    expect(
      classifyLifecycleRows({ ...base, previewIncomplete: true, candidateIncomplete: false })
        .lifecycleBlocked,
    ).toBe(true);
    expect(
      classifyLifecycleRows({ ...base, previewIncomplete: false, candidateIncomplete: true })
        .lifecycleBlocked,
    ).toBe(true);
    expect(
      classifyLifecycleRows({ ...base, previewIncomplete: false, candidateIncomplete: false })
        .lifecycleBlocked,
    ).toBe(false);
  });

  it.each([['match'], ['drift']])(
    'under DRA truncation, routes an unmatched %s candidate to liveUnclassified, NOT outsidePreviewTier (F11)',
    (state) => {
      // End-to-end through both exported functions: DRA truncation must reach
      // classification via the SAME previewIncomplete axis as a sample-load
      // truncation, so a candidate with live server evidence is never claimed
      // to be merely "outside this medium-tier preview" when the real cause is
      // that the DRA read itself was incomplete.
      const c = live(state);
      const { previewIncomplete } = deriveLifecycleEvidenceAxes({
        previewLoadError: null,
        previewTruncated: false,
        previewRowsUnreadable: true,
        candidateLoadError: null,
        candidateTruncated: false,
      });
      const result = classifyLifecycleRows({
        aggregates: [],
        candidates: [c],
        previewIncomplete,
        candidateIncomplete: false,
      });

      expect(result.liveUnclassified).toEqual([c]);
      expect(result.outsidePreviewTier).toEqual([]);
      expect(result.unknownStatusCandidates).toEqual([]);
    },
  );

  it('never fabricates a candidate: only returned rows are ever classified', () => {
    // Every output bucket is drawn from the input array by identity.
    const a = live('match');
    const b = { ...cand(DRA_B, '3.00000,4.00000', 'p2'), snapshot_drift_state: 'unknown' };
    const result = classifyLifecycleRows({
      aggregates: [],
      candidates: [a, b],
      previewIncomplete: false,
      candidateIncomplete: true,
    });

    const rendered = [
      ...result.outsidePreviewTier,
      ...result.liveUnclassified,
      ...result.unknownStatusCandidates,
    ];
    expect(rendered).toHaveLength(2);
    for (const row of rendered) {
      expect([a, b]).toContain(row);
    }
  });
});
