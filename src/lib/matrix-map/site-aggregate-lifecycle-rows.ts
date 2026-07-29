/**
 * Classification of site-aggregate lifecycle rows for the Option C admin preview.
 *
 * Extracted as a PURE function because the preview is an async server component
 * that jsdom cannot render: left inline, its behaviour could only be asserted by
 * matching source strings, which proves the text exists rather than that the
 * classification is correct. This module is the single implementation; the page
 * renders what it returns.
 *
 * The rule it enforces: THE CURRENT RPC CONTRACT NEVER PROVES ABSENCE, so this
 * module never claims it. Liveness requires positive evidence -- `match` or
 * `drift` prove the server sees a live aggregate -- and EVERY other unmatched
 * state is reported as status-unavailable.
 *
 * Absence is unprovable here because `unknown` is overloaded server-side: the
 * admin RPC emits it both when the snapshot returns no row AND when the
 * publication's DRA is soft-deleted. An unmatched candidate may therefore be
 * genuinely gone, soft-deleted but still recomputable, unread because a load
 * errored or hit the page ceiling, or untrustworthy because its identity was
 * duplicated -- and nothing distinguishes those. Declaring any of them an orphan
 * would assert a falsehood to the operator and offer a retraction on a false
 * premise. Rows stay visible and keep their Unpublish control regardless.
 */
/**
 * Structurally typed over the identity fields ONLY, so this module stays
 * independent of the client component that owns the candidate type.
 */
export interface LifecycleAggregateKey {
  source_dra_id: string | null;
  coordinate_cluster_id: string;
}

export interface LifecycleCandidateKey {
  source_dra_id: string;
  coordinate_cluster_id: string;
  /**
   * The SERVER's verdict on whether a live aggregate exists for this
   * publication: 'match' | 'drift' | 'unknown'. Load-bearing for orphan
   * classification -- see classifyLifecycleRows.
   */
  snapshot_drift_state?: string | null;
}

export interface LifecycleRowInput<TCandidate extends LifecycleCandidateKey> {
  aggregates: LifecycleAggregateKey[];
  candidates: TCandidate[];
  /**
   * TWO SEPARATE AXES, deliberately not one conflated flag.
   *
   * `previewIncomplete` covers the SAMPLE/DRA side: a sample load error, a DRA
   * load error, or sample pagination truncation. It is the only thing that can
   * make a candidate's LOCAL ABSENCE unexplainable, because the local aggregate
   * set is what the absence is measured against.
   *
   * `candidateIncomplete` covers the CANDIDATE side: an RPC error, candidate
   * pagination truncation, or a duplicated identity. It means the candidate SET
   * may be missing rows -- but it says nothing about the rows that DID come
   * back, so it must not degrade their explanation.
   *
   * Conflating them is what produced two separate defects: a candidate-RPC
   * failure erased the sample preview, and a truncated sample load still let the
   * UI claim a candidate was merely "outside the medium-tier preview".
   */
  previewIncomplete: boolean;
  candidateIncomplete: boolean;
}

export interface LifecycleRows<TCandidate extends LifecycleCandidateKey> {
  /** O(1) lookup by publication identity. Built once, not per rendered row. */
  candidateByKey: Map<string, TCandidate>;
  /** Identities seen more than once. Non-empty means the read is inconsistent. */
  duplicateCandidateKeys: string[];
  /**
   * Every candidate sharing a duplicated identity. Excluded from
   * `candidateByKey` entirely -- none is preferred -- and surfaced as
   * unknown-status so each stays reachable.
   */
  quarantinedCandidates: TCandidate[];
  /** Any duplicate identity was observed. */
  hasDuplicateCandidates: boolean;
  /**
   * The fail-closed switch for MUTATING controls (Create / Refresh / Publish).
   * Either axis incomplete, or a duplicated identity, blocks them. Unpublish is
   * deliberately NOT gated on this -- see the actions component -- but it is only
   * ever offered for a candidate row that was actually returned.
   */
  lifecycleBlocked: boolean;
  /** Candidates with no live aggregate in this load, whatever that means. */
  unmatchedCandidates: TCandidate[];
  /**
   * Unmatched locally, ALIVE per the server, and the PREVIEW EVIDENCE IS
   * COMPLETE -- so the local omission is explained: the cluster is outside the
   * medium-tier preview.
   */
  outsidePreviewTier: TCandidate[];
  /**
   * Unmatched locally and ALIVE per the server, but the preview evidence is
   * INCOMPLETE. Liveness is proven; the reason for the local omission is not.
   */
  liveUnclassified: TCandidate[];
  /** No positive server liveness evidence, or a quarantined duplicate. */
  unknownStatusCandidates: TCandidate[];
}

/**
 * Raw load signals, split by which SIDE of the surface they come from.
 */
export interface LifecycleLoadSignals {
  /** Sample or DRA query error. Governs the PREVIEW only. */
  previewLoadError: string | null;
  /** Sample pagination hit its ceiling. Governs the PREVIEW only. */
  previewTruncated: boolean;
  /**
   * DRA pagination hit its ceiling. Governs the PREVIEW only, same as
   * `previewTruncated` -- a truncated DRA read silently drops every sample
   * whose DRA fell beyond the page ceiling (computeSiteAggregates treats a
   * missing DRA as an orphan), so it is exactly as corrupting to the preview
   * as a truncated sample read, not merely a candidate-side concern.
   */
  previewDrasTruncated: boolean;
  /** Candidate RPC error. Governs the LIFECYCLE surface only. */
  candidateLoadError: string | null;
  /** Candidate pagination hit its ceiling. Governs the LIFECYCLE surface only. */
  candidateTruncated: boolean;
}

export interface LifecycleEvidenceAxes {
  previewIncomplete: boolean;
  candidateIncomplete: boolean;
  /**
   * Whether the medium-tier aggregates may be computed and rendered. Depends on
   * the PREVIEW axis ALONE.
   *
   * This is the rule a candidate-side failure previously broke: a failing
   * candidate RPC was written into the same error sentinel as the sample load,
   * so it blanked a table, summary and map that had loaded perfectly. The
   * candidate RPC does not even exist until the Option C SQL is applied, so
   * that path was not an edge case -- it was the default state.
   */
  previewRenderable: boolean;
}

/**
 * Derive the two evidence axes from raw load signals. Exported and pure so the
 * rule is exercised directly by tests rather than inferred from page source.
 */
export function deriveLifecycleEvidenceAxes({
  previewLoadError,
  previewTruncated,
  previewDrasTruncated,
  candidateLoadError,
  candidateTruncated,
}: LifecycleLoadSignals): LifecycleEvidenceAxes {
  const previewIncomplete = Boolean(previewLoadError) || previewTruncated || previewDrasTruncated;
  const candidateIncomplete = Boolean(candidateLoadError) || candidateTruncated;
  return {
    previewIncomplete,
    candidateIncomplete,
    // Deliberately NOT `&& !candidateIncomplete`.
    previewRenderable: !previewLoadError,
  };
}

/** The publication identity: source DRA plus coordinate cluster. */
export function lifecycleRowKey(
  source_dra_id: string | null | undefined,
  coordinate_cluster_id: string,
): string {
  return `${source_dra_id ?? ''}::${coordinate_cluster_id}`;
}

export function classifyLifecycleRows<TCandidate extends LifecycleCandidateKey>({
  aggregates,
  candidates,
  previewIncomplete,
  candidateIncomplete,
}: LifecycleRowInput<TCandidate>): LifecycleRows<TCandidate> {
  // Index ONCE. A `candidates.find(...)` per aggregate is O(n*m): at the
  // documented 25,000-row cap that is ~625M comparisons during server render,
  // which can stall the page after the queries have already succeeded.
  //
  // Duplicates are DETECTED, never resolved by arbitrary iteration order.
  // `(source_dra_id, coordinate_cluster_id)` IS the publication identity, so two
  // candidates sharing it means the read is inconsistent -- silently keeping
  // either would attach a real publication_id to the wrong row and let Unpublish
  // act on a publication the operator never saw.
  const byKey = new Map<string, TCandidate[]>();
  for (const c of candidates) {
    const key = lifecycleRowKey(c.source_dra_id, c.coordinate_cluster_id);
    const bucket = byKey.get(key);
    if (bucket) bucket.push(c);
    else byKey.set(key, [c]);
  }

  // QUARANTINE, do not select. Keeping the first of two candidates sharing an
  // identity is still an arbitrary choice: the page would render only that one,
  // so a published SECOND candidate would have no reachable Unpublish control
  // while the first stayed retractable. Neither is safe to prefer, so the key is
  // removed from the lookup entirely and every colliding candidate is surfaced
  // as unknown-status, keeping each row -- and its Unpublish -- reachable.
  const candidateByKey = new Map<string, TCandidate>();
  const duplicateCandidateKeys: string[] = [];
  const quarantinedCandidates: TCandidate[] = [];
  for (const [key, bucket] of byKey) {
    if (bucket.length > 1) {
      duplicateCandidateKeys.push(key);
      quarantinedCandidates.push(...bucket);
      continue;
    }
    candidateByKey.set(key, bucket[0]);
  }
  const hasDuplicateCandidates = duplicateCandidateKeys.length > 0;

  // A duplicated identity makes the CANDIDATE read untrustworthy in exactly the
  // way a truncated candidate page does, so it joins that axis -- NOT the
  // preview axis, which is about sample/DRA data.
  const candidateEvidenceIncomplete = candidateIncomplete || hasDuplicateCandidates;
  // Mutating controls fail closed on EITHER axis.
  const lifecycleBlocked = previewIncomplete || candidateEvidenceIncomplete;

  const liveKeys = new Set(
    aggregates.map((a) => lifecycleRowKey(a.source_dra_id, a.coordinate_cluster_id)),
  );
  // ABSENCE FROM `liveKeys` IS NOT ENOUGH. The page's aggregate set is a
  // MEDIUM-TIER preview, while a candidate spans EVERY tier in its cluster. A
  // cluster that keeps high- or low-tier samples but loses its last medium one
  // vanishes from the preview while remaining perfectly alive server-side --
  // and `current_site_aggregate_snapshot` still returns it, so the RPC reports
  // 'match' or 'drift'. Calling that an orphan would print "No live aggregate"
  // beside a Drifted badge derived from the very aggregate it says is gone.
  //
  // The server is the authority (settled ruling), but only for LIVENESS: it can
  // prove an aggregate exists, and cannot prove one does not.
  // ALLOW-LIST, not a deny-list. Only these two states are positive evidence
  // that the server sees a live aggregate. `unknown`, null, absent, or any
  // unrecognized value (version skew, malformed RPC payload) must NOT be read
  // as proof of life -- otherwise the row would claim "Live, but outside this
  // medium-tier preview" while the action component renders "Drift unknown"
  // from the same value.
  const LIVE_DRIFT_STATES = new Set(['match', 'drift']);
  const serverProvesLive = (c: TCandidate) =>
    typeof c.snapshot_drift_state === 'string' &&
    LIVE_DRIFT_STATES.has(c.snapshot_drift_state);

  // QUARANTINED ROWS ARE EXCLUDED HERE, not appended later. They are surfaced
  // exclusively as unknown-status; leaving them in the normal population too
  // would render the same candidate twice -- duplicate React keys and two
  // Unpublish controls for one publication.
  const quarantinedSet = new Set(quarantinedCandidates);
  const classifiable = candidates.filter((c) => !quarantinedSet.has(c));

  const unmatchedCandidates = classifiable.filter(
    (c) => !liveKeys.has(lifecycleRowKey(c.source_dra_id, c.coordinate_cluster_id)),
  );
  // Absent from the medium-tier preview, but the SERVER still sees an aggregate.
  // Not an orphan, and not "unknown" either -- its status is known and it is
  // alive. It is simply outside this preview's tier.
  // NOTHING IN THE CURRENT RPC CONTRACT PROVES ABSENCE.
  //
  // `unknown` is OVERLOADED server-side: the admin RPC emits it both when the
  // snapshot genuinely returns no row AND when the publication's DRA is
  // soft-deleted (`WHEN d.is_deleted THEN 'unknown'`), which is a fail-closed
  // guard for Publish, not a statement that the aggregate is gone. The admin
  // page separately filters soft-deleted DRAs out of its own aggregate load, so
  // such a candidate is absent from the preview AND reports `unknown` -- while
  // its samples may still exist and still recompute.
  //
  // Treating `unknown` as proof of absence therefore printed "No live aggregate
  // for this publication" for a live-but-deleted DRA. Since the contract cannot
  // distinguish the two causes, this classifier no longer claims absence at all:
  // liveness still requires positive evidence, and EVERYTHING ELSE is reported
  // as status-unavailable. Rows stay visible and Unpublish stays reachable
  // either way -- only the unfounded claim is gone.
  //
  // Restoring a confirmed-orphan signal would need the SQL to emit a DISTINCT
  // state for soft-deleted (e.g. 'deleted') so the two causes are separable.
  // That is an owner-scoped change, deliberately not made here.
  // THE LOCAL-OMISSION EXPLANATION DEPENDS ONLY ON THE PREVIEW AXIS.
  //
  // Server liveness (`match`/`drift`) proves the aggregate EXISTS. It does not
  // explain why the row is missing from the LOCAL preview. That explanation --
  // "it is outside the medium-tier preview" -- is only available when the
  // preview itself is known complete. If the sample or DRA load errored or was
  // truncated, the omission could equally be an artefact of the truncated read,
  // so the cause must not be asserted.
  //
  // Candidate-side incompleteness is deliberately IRRELEVANT here: it means the
  // candidate SET may be missing rows, not that a row which DID come back is
  // less trustworthy. Gating this on the candidate axis would re-conflate the
  // two axes in the opposite direction.
  const liveCandidates = unmatchedCandidates.filter(serverProvesLive);
  const outsidePreviewTier = previewIncomplete ? [] : liveCandidates;
  const liveUnclassified = previewIncomplete ? liveCandidates : [];
  const indeterminateCandidates = unmatchedCandidates.filter((c) => !serverProvesLive(c));

  return {
    candidateByKey,
    duplicateCandidateKeys,
    quarantinedCandidates,
    hasDuplicateCandidates,
    lifecycleBlocked,
    unmatchedCandidates,
    // Both lists stay reachable in the UI so the Unpublish escape hatch is never
    // lost (settled ruling); only the CLAIM made about them differs.
    outsidePreviewTier,
    liveUnclassified,
    // Every unmatched row the server does not positively call live, plus every
    // quarantined duplicate. No absence claim is made about any of them.
    unknownStatusCandidates: indeterminateCandidates.concat(quarantinedCandidates),
  };
}
