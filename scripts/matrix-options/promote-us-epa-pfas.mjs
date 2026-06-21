// Owner-run promotion helper for the US EPA 2024 PFOA + PFOS oral-RfD records (direct + food
// pathways = 4 records, backed by TWO per-substance sources). Plain ASCII only.
//
// WHY THIS EXISTS
// The Matrix Options Evidence Library carries US EPA 2024 final human-health toxicity-assessment
// oral-RfD candidates for PFOA (EPA 815-R-24-006, RfD 3e-8 mg/kg-bw/day) and PFOS
// (EPA 815-R-24-007, RfD 1e-7 mg/kg-bw/day): one human-health-direct + one human-health-food row
// per substance (4 rows). The values were read verbatim from the EPA PDFs but the rows are still
// qa_status = 'needs_review', evidence_support_status = 'pending_source_locator',
// canonical_source_status = 'needs_direct_source_check' (pending the owner's QA attestation). This
// tool performs the exact, coupled promotion of EXACTLY those 4 VALUE records, fails closed on any
// precondition, and is idempotent.
//
// TWO-SOURCE NOTE: unlike the single-source HC/WLRS/IRIS tools, PFOA and PFOS each have their OWN
// per-document source (one URL per EPA report number). The PFOA rows link src-us-epa-pfoa-2024; the
// PFOS rows link src-us-epa-pfos-2024. The source-pin step handles BOTH distinct sources; each is
// expected to already be direct_source_verified on the real catalog and will SKIP.
//
// It mirrors promote-hc-pqra-lifestage.mjs (multi-record batch) and promote-wlrs-low-level.mjs
// (single-file catalog) in structure, style, and fail-closed discipline. The VALUE records here are
// read from human_health_trv_values.json (the human-health TRV catalog file), not parameter_values.json.
//
// LOAD-BEARING RULES honored:
//  - AI NEVER writes qa_status. This tool is run BY THE OWNER; --reviewer/--date are the owner's
//    HITL attestation. Author + dry-run only for AI.
//  - OWNER VERIFICATION REQUIRED (rule 1): Before running with --apply, the OWNER must verify the
//    4 RfD values against the primary US EPA 2024 PDFs (PFOA 815-R-24-006 = 3e-8 mg/kg/day; PFOS
//    815-R-24-007 = 1e-7 mg/kg/day). Running with --apply attests to that verification.
//  - SCOPE (rule 2): only the 4 listed PFOA/PFOS records are promoted. default_status is NEVER
//    modified (stays 'available_option'); the owner's FRAME_DEFAULT_PROFILES row is the activation step.
//  - SOURCE (rule 3): both src-us-epa-pfoa-2024 and src-us-epa-pfos-2024 are expected to ALREADY
//    carry canonical_source_status = 'direct_source_verified'. On the real catalog BOTH sources will
//    SKIP (already-done). The source promotion LOGIC is kept identical (handles already-done gracefully).
//    This field is REQUIRED because defaultSelectionPolicy.isDirectCurrentSource() checks
//    source.canonical_source_status === 'direct_source_verified'.
//  - AFTER --apply (rule 4): run npx tsc --noEmit; npm run lint; npm run test:ci.
//
// USAGE (run from anywhere; paths resolve from the script location):
//   node scripts/matrix-options/promote-us-epa-pfas.mjs --reviewer "J. Nelson" --date 2026-06-20
//   node scripts/matrix-options/promote-us-epa-pfas.mjs --reviewer "J. Nelson" --date 2026-06-20 --apply
//
// Default is a DRY RUN (prints the per-record plan, writes nothing). --apply writes both
// matrix_research/reference_catalog/human_health_trv_values.json and
// matrix_research/reference_catalog/sources.json.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..', '..');
const HH_TRV_FILE = path.join(
  REPO_ROOT, 'matrix_research', 'reference_catalog', 'human_health_trv_values.json',
);
const SOURCES_FILE = path.join(
  REPO_ROOT, 'matrix_research', 'reference_catalog', 'sources.json',
);

// These are the ONLY records this tool will ever touch. Hard-coded so scope is fixed + auditable.
// Export so a future catalog.test guard can import them.
export const US_EPA_PFAS_PROMOTION_VALUE_IDS = [
  'pv-us-epa-2024-perfluoroctanoic_acid_pfoa-hh-direct-rfd',
  'pv-us-epa-2024-perfluoroctanoic_acid_pfoa-hh-food-rfd',
  'pv-us-epa-2024-perfluorooctane_sulfonate-hh-direct-rfd',
  'pv-us-epa-2024-perfluorooctane_sulfonate-hh-food-rfd',
];
// Two distinct per-substance sources. Exported as an array (order independent).
export const US_EPA_PFAS_PROMOTION_SOURCE_IDS = [
  'src-us-epa-pfoa-2024',
  'src-us-epa-pfos-2024',
];

// Expected frame-eligible identity per record (fields classifyCandidate / getFrameSeedCandidateEligibility
// examine). Any mismatch -> fail closed. Each carries the EXPECTED source_id so the source_ids check is
// per-substance. Ordered to match US_EPA_PFAS_PROMOTION_VALUE_IDS above.
const EXPECTED_IDENTITIES = [
  // pv-us-epa-2024-perfluoroctanoic_acid_pfoa-hh-direct-rfd
  {
    source_id: 'src-us-epa-pfoa-2024',
    jurisdiction: 'US_federal',
    candidate_group_id: 'human-health-direct__perfluoroctanoic_acid_pfoa__rfd_oral_mg_per_kg_bw_day__US_federal',
    pathway: 'human-health-direct',
    input_key: 'rfd_oral_mg_per_kg_bw_day',
    substance_key: 'perfluoroctanoic_acid_pfoa',
    value: 3e-8,
    unit: 'mg/kg-bw/day',
    value_type: 'single_value',
    default_status: 'available_option',
  },
  // pv-us-epa-2024-perfluoroctanoic_acid_pfoa-hh-food-rfd
  {
    source_id: 'src-us-epa-pfoa-2024',
    jurisdiction: 'US_federal',
    candidate_group_id: 'human-health-food__perfluoroctanoic_acid_pfoa__rfd_oral_mg_per_kg_bw_day__US_federal',
    pathway: 'human-health-food',
    input_key: 'rfd_oral_mg_per_kg_bw_day',
    substance_key: 'perfluoroctanoic_acid_pfoa',
    value: 3e-8,
    unit: 'mg/kg-bw/day',
    value_type: 'single_value',
    default_status: 'available_option',
  },
  // pv-us-epa-2024-perfluorooctane_sulfonate-hh-direct-rfd
  {
    source_id: 'src-us-epa-pfos-2024',
    jurisdiction: 'US_federal',
    candidate_group_id: 'human-health-direct__perfluorooctane_sulfonate__rfd_oral_mg_per_kg_bw_day__US_federal',
    pathway: 'human-health-direct',
    input_key: 'rfd_oral_mg_per_kg_bw_day',
    substance_key: 'perfluorooctane_sulfonate',
    value: 1e-7,
    unit: 'mg/kg-bw/day',
    value_type: 'single_value',
    default_status: 'available_option',
  },
  // pv-us-epa-2024-perfluorooctane_sulfonate-hh-food-rfd
  {
    source_id: 'src-us-epa-pfos-2024',
    jurisdiction: 'US_federal',
    candidate_group_id: 'human-health-food__perfluorooctane_sulfonate__rfd_oral_mg_per_kg_bw_day__US_federal',
    pathway: 'human-health-food',
    input_key: 'rfd_oral_mg_per_kg_bw_day',
    substance_key: 'perfluorooctane_sulfonate',
    value: 1e-7,
    unit: 'mg/kg-bw/day',
    value_type: 'single_value',
    default_status: 'available_option',
  },
];

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// ---------------------------------------------------------------------------
// Arg parsing
// ---------------------------------------------------------------------------

export function parseArgs(argv) {
  const args = { apply: false, reviewer: null, date: null, help: false, sourceUrl: null, zoteroKey: null };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--apply') args.apply = true;
    else if (a === '--help' || a === '-h') args.help = true;
    else if (a === '--reviewer') args.reviewer = argv[++i];
    else if (a === '--date') args.date = argv[++i];
    else if (a === '--source-url') args.sourceUrl = argv[++i];
    else if (a === '--zotero-key') args.zoteroKey = argv[++i];
    else throw new Error('Unknown argument: ' + a);
  }
  return args;
}

// Validates the owner-supplied attestation. Required only when actually writing (--apply); a dry
// run prints the plan with whatever was supplied so the owner can preview before committing to it.
//
// NOTE: --source-url / --zotero-key would apply to BOTH PFAS sources (they are per-document and
// differ), so they are intentionally NOT honored as a write path here -- both sources already carry
// their own durable per-document URL. They are parsed (for interface parity) but the apply step does
// not use them to mutate the two distinct sources; reject them on --apply to avoid silently
// stamping the wrong URL onto two different documents.
export function validateApplyOptions(opts) {
  const errors = [];
  if (!opts.reviewer || !String(opts.reviewer).trim()) {
    errors.push('--reviewer "<id/name>" is required for --apply (it becomes evidence.reviewed_by)');
  }
  if (!opts.date || !DATE_RE.test(opts.date)) {
    errors.push('--date YYYY-MM-DD is required for --apply (it becomes evidence.reviewed_at)');
  }
  if (opts.sourceUrl || opts.zoteroKey) {
    errors.push(
      '--source-url / --zotero-key are NOT supported by this two-source tool: PFOA and PFOS have ' +
      'distinct per-document sources, so a single URL/key cannot be applied to both. Each source ' +
      'already carries its own durable per-document URL. Edit the specific source row directly if a ' +
      'locator must change.',
    );
  }
  if (errors.length) throw new Error('Invalid --apply options:\n  - ' + errors.join('\n  - '));
}

// ---------------------------------------------------------------------------
// Plan
// ---------------------------------------------------------------------------

// Computes the promotion plan for a single value record and enforces preconditions (fail-closed).
// Throws on: missing record, no evidence_items, identity mismatch, wrong source_ids, stale nested
// source, unexpected qa state, or drifted/partial-promotion state.
// Returns { valueRecord, valueAlreadyDone, promoteValue, expectedSourceId }.
function planOneValueRecord(paramValues, valueId, expectedIdentity) {
  const expectedSourceId = expectedIdentity.source_id;
  const valueRecord = paramValues.find(
    (r) => r.parameter_value_id === valueId,
  );
  if (!valueRecord) {
    throw new Error(
      'Precondition failed: value record not found in human_health_trv_values.json: ' + valueId,
    );
  }
  if (!Array.isArray(valueRecord.evidence_items) || valueRecord.evidence_items.length === 0) {
    throw new Error(
      'Precondition failed: ' + valueId + ' has no evidence_items',
    );
  }
  // Fail-closed IDENTITY check: cover EVERY scalar field classifyCandidate examines so the helper
  // cannot "succeed" on a record that would still be blocked by the frame-default pipeline. The
  // source_id field is checked against source_ids separately below, so exclude it from the scalar loop.
  const identityMismatch = Object.entries(expectedIdentity)
    .filter(([k]) => k !== 'source_id')
    .filter(([k, v]) => valueRecord[k] !== v);
  if (identityMismatch.length > 0) {
    throw new Error(
      'Precondition failed: ' + valueId +
      ' is not in the expected frame-eligible identity. Mismatched field(s):\n' +
      identityMismatch
        .map(([k, v]) => '  ' + k + ': expected ' + JSON.stringify(v) +
          ', actual ' + JSON.stringify(valueRecord[k]))
        .join('\n') +
      '\nRefusing to promote a record that cannot seed the human-health frame.',
    );
  }
  // source_ids must be EXACTLY [this substance's per-document source]. classifyCandidate derives
  // sourceRoles from EVERY source_id, so a SECOND linked source carrying a policy_compilation /
  // reference_mining role would be blocked by the real frame-default pipeline yet slip past a mere
  // "includes" check. Each PFAS row is checked against ITS OWN expected source (not a shared one).
  if (!Array.isArray(valueRecord.source_ids) ||
      valueRecord.source_ids.length !== 1 ||
      valueRecord.source_ids[0] !== expectedSourceId) {
    throw new Error(
      'Precondition failed: ' + valueId + ' source_ids must be EXACTLY ["' +
      expectedSourceId + '"] (actual: ' + JSON.stringify(valueRecord.source_ids) +
      '). A second linked source could carry a policy_compilation/reference_mining role that ' +
      'classifyCandidate would block but this single-source helper would miss. Refusing to promote.',
    );
  }
  // Nested-source provenance guard (backport 2026-06-14): the top-level source_ids check above does
  // NOT cover evidence_items[*].source_id or source_relationships[*].source_id. A row forked from
  // another record could carry a stale nested source_id while its top-level source_ids is correct;
  // applyPromotion preserves those nested ids and stamps QA approved, so a stale nested ref would
  // survive as approved provenance. Require every nested source reference to be THIS row's source.
  const nestedSourceRefs = [
    ...(Array.isArray(valueRecord.evidence_items)
      ? valueRecord.evidence_items.map((ev) => (ev ? ev.source_id : undefined))
      : []),
    ...(Array.isArray(valueRecord.source_relationships)
      ? valueRecord.source_relationships.map((rel) => (rel ? rel.source_id : undefined))
      : []),
  ];
  const staleNestedSourceRefs = nestedSourceRefs.filter(
    (sid) => sid !== expectedSourceId,
  );
  if (staleNestedSourceRefs.length > 0) {
    throw new Error(
      'Precondition failed: ' + valueId + ' has nested provenance source ' +
      'reference(s) that are not the expected source (' + JSON.stringify(staleNestedSourceRefs) + '). ' +
      'Every evidence_items[*].source_id and source_relationships[*].source_id must be "' +
      expectedSourceId + '"; a stale nested source reference ' +
      'would otherwise survive as approved provenance. Refusing to promote.',
    );
  }
  // Fail-closed: accept ONLY the exact documented pre-promotion state or the exact already-promoted
  // state. Evidence items must move WITH the top-level statuses; a partial-promotion is rejected.
  // Attestation guard (uniform backport 2026-06-13): an approved evidence item MUST carry the owner
  // attestation (reviewed_by + reviewed_at).
  const allEvidenceApproved = valueRecord.evidence_items.every(
    (ev) => ev.qa_status === 'approved' && Boolean(ev.reviewed_by) && Boolean(ev.reviewed_at),
  );
  const allEvidenceNeedsReview = valueRecord.evidence_items.every((ev) => ev.qa_status === 'needs_review');
  const valueAlreadyDone =
    valueRecord.qa_status === 'approved' &&
    valueRecord.evidence_support_status === 'approved_source_backed' &&
    valueRecord.canonical_source_status === 'direct_source_verified' &&
    allEvidenceApproved;
  const valueExpectedPre =
    valueRecord.qa_status === 'needs_review' &&
    valueRecord.evidence_support_status === 'pending_source_locator' &&
    valueRecord.canonical_source_status === 'needs_direct_source_check' &&
    allEvidenceNeedsReview;

  if (!valueAlreadyDone && !valueExpectedPre) {
    const evStates = valueRecord.evidence_items.map((ev) => ev.qa_status);
    throw new Error(
      'Precondition failed: ' + valueId +
      ' is not in the expected pre-promotion state nor the already-promoted state.\n' +
      '  expected pre  : qa_status=needs_review, evidence_support_status=pending_source_locator, canonical_source_status=needs_direct_source_check, ALL evidence_items needs_review\n' +
      '  already-done  : qa_status=approved, evidence_support_status=approved_source_backed, canonical_source_status=direct_source_verified, ALL evidence_items approved\n' +
      '  actual        : qa_status=' + valueRecord.qa_status +
      ', evidence_support_status=' + valueRecord.evidence_support_status +
      ', canonical_source_status=' + valueRecord.canonical_source_status +
      ', evidence_items qa=' + JSON.stringify(evStates) + '\n' +
      'Refusing to promote a drifted/partially-promoted record (top-level statuses and evidence items disagree).',
    );
  }

  return { valueRecord, valueAlreadyDone, promoteValue: !valueAlreadyDone, expectedSourceId };
}

// Computes + enforces (fail-closed) the plan for one SOURCE record. Returns
// { sourceRecord, sourceAlreadyDone, promoteSource }.
function planOneSource(sources, sourceId) {
  const sourceRecord = sources.find((s) => s.source_id === sourceId);
  if (!sourceRecord) {
    throw new Error(
      'Precondition failed: source record not found in sources.json: ' + sourceId,
    );
  }
  const csStatus = sourceRecord.canonical_source_status;
  const sourceAlreadyDone = csStatus === 'direct_source_verified';
  const sourceExpectedPre = csStatus === 'needs_direct_source_check';
  if (!sourceAlreadyDone && !sourceExpectedPre) {
    throw new Error(
      'Precondition failed: source ' + sourceId +
      ' canonical_source_status="' + csStatus +
      '" is neither needs_direct_source_check (promotable) nor direct_source_verified (done). ' +
      'Refusing to promote a drifted source.',
    );
  }
  const srcRole = sourceRecord.calculator_source_role ?? 'canonical_candidate';
  if (srcRole === 'policy_compilation' || srcRole === 'reference_mining') {
    throw new Error(
      'Precondition failed: source ' + sourceId + ' has calculator_source_role=' +
      JSON.stringify(srcRole) + '; classifyCandidate would block such a record. Refusing to promote.',
    );
  }
  if (
    sourceRecord.file_storage === 'repo_metadata_only' ||
    srcRole !== 'canonical_candidate' ||
    sourceRecord.currentness_status !== 'current'
  ) {
    throw new Error(
      'Precondition failed: source ' + sourceId +
      ' is not direct-current eligible. isDirectCurrentSource requires file_storage != ' +
      'repo_metadata_only, calculator_source_role = canonical_candidate, currentness_status = ' +
      'current. Actual: file_storage=' + JSON.stringify(sourceRecord.file_storage) +
      ', calculator_source_role=' + JSON.stringify(srcRole) +
      ', currentness_status=' + JSON.stringify(sourceRecord.currentness_status) + '. ' +
      'Promoting it to direct_source_verified would still leave the frame default blocked (blocked_needs_qa).',
    );
  }
  return { sourceRecord, sourceAlreadyDone, promoteSource: !sourceAlreadyDone };
}

// Computes the promotion plan for all 4 value records + the TWO sources. Enforces ALL preconditions
// (fail-closed). Throws on any failure. Records already in target state are SKIPPED (idempotent).
// NOTE: both PFAS sources are expected to already be direct_source_verified; they normally SKIP.
export function planPromotion(paramValues, sources, _opts) {
  // -- VALUE records (one by one; fail fast on first precondition failure) --
  const valueResults = US_EPA_PFAS_PROMOTION_VALUE_IDS.map((valueId, i) =>
    planOneValueRecord(paramValues, valueId, EXPECTED_IDENTITIES[i]),
  );

  // -- SOURCE records (both per-document sources) --
  const sourceResults = US_EPA_PFAS_PROMOTION_SOURCE_IDS.map((sourceId) =>
    planOneSource(sources, sourceId),
  );

  // Cross-check: every value record's expected source must be one of the two known sources, and the
  // source_relationships roles must not be policy_compilation / reference_mining (per-value guard).
  for (const { valueRecord, expectedSourceId } of valueResults) {
    if (!US_EPA_PFAS_PROMOTION_SOURCE_IDS.includes(expectedSourceId)) {
      throw new Error(
        'Precondition failed: ' + valueRecord.parameter_value_id +
        ' expected source ' + expectedSourceId + ' is not one of the two known PFAS sources.',
      );
    }
    const relationshipRoles = Array.isArray(valueRecord.source_relationships)
      ? valueRecord.source_relationships.map((r) => (r ? r.role : null))
      : [];
    if (relationshipRoles.includes('policy_compilation') || relationshipRoles.includes('reference_mining')) {
      throw new Error(
        'Precondition failed: ' + valueRecord.parameter_value_id + ' has a source_relationships role of ' +
        'policy_compilation/reference_mining (roles: ' + JSON.stringify(relationshipRoles) + '). ' +
        'classifyCandidate would block such a record; refusing to promote a record the frame-default pipeline blocks.',
      );
    }
  }

  return {
    valueResults,
    sourceResults,
    promoteSource: sourceResults.some((sr) => sr.promoteSource),
  };
}

// ---------------------------------------------------------------------------
// Evidence item rebuild (mirrors apply-qa-promotion.mjs approveEvidence exactly)
// ---------------------------------------------------------------------------

function approveEvidence(ev, reviewer, date) {
  const out = {};
  for (const [k, v] of Object.entries(ev)) {
    if (k === 'qa_status') {
      out.qa_status = 'approved';
      out.reviewed_by = reviewer;
      out.reviewed_at = date;
    } else if (k === 'reviewed_by' || k === 'reviewed_at') {
      continue; // re-inserted next to qa_status above
    } else {
      out[k] = v;
    }
  }
  if (!('qa_status' in out)) {
    out.qa_status = 'approved';
    out.reviewed_by = reviewer;
    out.reviewed_at = date;
  }
  return out;
}

// Marker substring used to detect an ALREADY-stamped provenance field (idempotency).
const PROMOTION_STAMP_MARKER = 'PROMOTED to approved';

// The human-readable provenance fields the Evidence Library renders directly. NOTE: on these PFAS
// rows the uncertainty field is null, so only applicability + review_notes receive a stamp; the
// stamp logic skips non-string / empty fields.
const STAMPED_PROVENANCE_FIELDS = ['applicability', 'uncertainty', 'review_notes'];

function buildValueStamp(date, reviewer) {
  return (
    ' [PROMOTED to approved (evidence approved_source_backed, source direct_source_verified) on ' +
    date + ' by ' + reviewer + '; the pending / needs_review language above is superseded.]'
  );
}

function stampValueProvenance(r, date, reviewer) {
  const stamp = buildValueStamp(date, reviewer);
  let changed = false;
  for (const field of STAMPED_PROVENANCE_FIELDS) {
    const v = r[field];
    if (typeof v === 'string' && v.length > 0 && !v.includes(PROMOTION_STAMP_MARKER)) {
      r[field] = v + stamp;
      changed = true;
    }
  }
  return changed;
}

function valueStampRepairNeeded(r) {
  return STAMPED_PROVENANCE_FIELDS.some(
    (field) =>
      typeof r[field] === 'string' &&
      r[field].length > 0 &&
      !r[field].includes(PROMOTION_STAMP_MARKER),
  );
}

// ---------------------------------------------------------------------------
// Apply (in-place mutation of the parsed records; ONLY the target records are touched)
// ---------------------------------------------------------------------------

export function applyPromotion(paramValues, sources, opts) {
  const plan = planPromotion(paramValues, sources, opts);

  const valueTouchedFlags = [];
  for (const vr of plan.valueResults) {
    let touched = false;
    if (vr.promoteValue) {
      const r = vr.valueRecord;
      r.qa_status = 'approved';
      r.evidence_support_status = 'approved_source_backed';
      r.canonical_source_status = 'direct_source_verified';
      // default_status is intentionally NOT modified (stays 'available_option').
      r.evidence_items = r.evidence_items.map((ev) => approveEvidence(ev, opts.reviewer, opts.date));
      stampValueProvenance(r, opts.date, opts.reviewer);
    } else if (vr.valueAlreadyDone) {
      touched = stampValueProvenance(vr.valueRecord, opts.date, opts.reviewer);
    }
    valueTouchedFlags.push(touched);
  }
  plan.valueTouchedFlags = valueTouchedFlags;

  const sourceTouchedFlags = [];
  for (const sr of plan.sourceResults) {
    let touched = false;
    if (sr.promoteSource) {
      sr.sourceRecord.canonical_source_status = 'direct_source_verified';
      const srcStamp =
        ' [Source promoted to direct_source_verified on ' + opts.date + ' by ' + opts.reviewer +
        '; the pending / needs_review language above is superseded.]';
      if (typeof sr.sourceRecord.notes === 'string') sr.sourceRecord.notes += srcStamp;
      touched = true;
    }
    sourceTouchedFlags.push(touched);
  }
  plan.sourceTouchedFlags = sourceTouchedFlags;
  plan.sourceTouched = sourceTouchedFlags.some(Boolean);

  return plan;
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

const BANNER = [
  '=============================================================================',
  ' promote-us-epa-pfas.mjs -- owner-run US EPA 2024 PFOA + PFOS oral-RfD promotion',
  '   (PFOA 815-R-24-006, PFOS 815-R-24-007; direct + food = 4 rows, 2 sources)',
  '=============================================================================',
  '',
  'OWNER VERIFICATION REQUIRED before --apply:',
  '  Verify the 4 PFAS oral-RfD values against the primary US EPA 2024 PDFs:',
  '    PFOA (EPA 815-R-24-006) : 3 x 10-8 mg/kg/day  (3e-8)',
  '    PFOS (EPA 815-R-24-007) : 1 x 10-7 mg/kg/day  (1e-7)',
  '  Running --apply attests to that verification.',
  '',
  'SCOPE: 4 value records (2 PFOA + 2 PFOS) are promoted. default_status is NOT changed',
  '  (stays available_option). The FRAME_DEFAULT_PROFILES row is the owner activation step.',
  '',
  'TWO SOURCES: PFOA and PFOS each have their OWN per-document source. Both',
  '  (src-us-epa-pfoa-2024, src-us-epa-pfos-2024) are expected to already be',
  '  direct_source_verified; on the real catalog BOTH sources will normally SKIP.',
  '',
].join('\n');

const HELP = [
  'promote-us-epa-pfas.mjs -- owner-run US EPA 2024 PFOA + PFOS oral-RfD promotion (4 rows, 2 sources).',
  '',
  'Usage:',
  '  node scripts/matrix-options/promote-us-epa-pfas.mjs --reviewer "<id>" --date YYYY-MM-DD [--apply]',
  '',
  'Options:',
  '  --reviewer "<id>"        Reviewer attestation -> evidence.reviewed_by (required for --apply)',
  '  --date YYYY-MM-DD        Review date -> evidence.reviewed_at (required for --apply)',
  '  --apply                  Write both catalog files (default is a dry run that writes nothing)',
  '  NOTE: --source-url / --zotero-key are NOT supported (PFOA/PFOS have distinct per-document',
  '        sources; a single locator cannot apply to both). Each source already carries its own URL.',
  '',
  'Targets (4 PFAS VALUE records + 2 SOURCES):',
  '  VALUE : pv-us-epa-2024-perfluoroctanoic_acid_pfoa-hh-direct-rfd   (src-us-epa-pfoa-2024)',
  '  VALUE : pv-us-epa-2024-perfluoroctanoic_acid_pfoa-hh-food-rfd     (src-us-epa-pfoa-2024)',
  '  VALUE : pv-us-epa-2024-perfluorooctane_sulfonate-hh-direct-rfd    (src-us-epa-pfos-2024)',
  '  VALUE : pv-us-epa-2024-perfluorooctane_sulfonate-hh-food-rfd      (src-us-epa-pfos-2024)',
  '  SOURCE: src-us-epa-pfoa-2024',
  '  SOURCE: src-us-epa-pfos-2024',
  '',
  'On --apply, each VALUE record changes:',
  '  qa_status                 needs_review -> approved',
  '  evidence_support_status   pending_source_locator -> approved_source_backed',
  '  canonical_source_status   needs_direct_source_check -> direct_source_verified',
  '  evidence_items[*].qa_status needs_review -> approved (+ reviewed_by/at after qa_status)',
  '  default_status            UNCHANGED (stays available_option)',
  'On --apply, each SOURCE record changes:',
  '  canonical_source_status   needs_direct_source_check -> direct_source_verified',
  '  NOTE: on the real catalog both sources are expected already direct_source_verified; they SKIP.',
  '',
  'AI never runs this with --apply. The owner runs it; --reviewer/--date are the HITL attestation.',
  'After --apply: npx tsc --noEmit; npm run lint; npm run test:ci',
].join('\n');

function printPlan(plan, opts) {
  for (let i = 0; i < plan.valueResults.length; i++) {
    const vr = plan.valueResults[i];
    const valueId = US_EPA_PFAS_PROMOTION_VALUE_IDS[i];
    if (vr.promoteValue) {
      const r = vr.valueRecord;
      console.log('  VALUE   PROMOTE  ' + valueId + '  (source ' + vr.expectedSourceId + ')');
      console.log('    qa_status               : ' + r.qa_status + ' -> approved');
      console.log('    evidence_support_status : ' + r.evidence_support_status +
        ' -> approved_source_backed');
      console.log('    canonical_source_status : ' + r.canonical_source_status +
        ' -> direct_source_verified');
      console.log('    default_status          : ' + r.default_status + ' (UNCHANGED)');
      const evCount = r.evidence_items ? r.evidence_items.length : 0;
      console.log('    evidence_items          : ' + evCount + ' item(s) -> qa approved + reviewed_by/at');
      console.log('      reviewer              : ' + (opts.reviewer || '(not set)'));
      console.log('      date                  : ' + (opts.date || '(not set)'));
    } else {
      console.log('  VALUE   SKIP     ' + valueId + ': already in target state (no-op)');
    }
  }

  for (let i = 0; i < plan.sourceResults.length; i++) {
    const sr = plan.sourceResults[i];
    const sourceId = US_EPA_PFAS_PROMOTION_SOURCE_IDS[i];
    if (sr.promoteSource) {
      console.log('  SOURCE  PROMOTE  ' + sourceId);
      console.log('    canonical_source_status : ' + sr.sourceRecord.canonical_source_status +
        ' -> direct_source_verified');
    } else {
      console.log('  SOURCE  SKIP     ' + sourceId + ': already in target state (no-op)');
    }
  }
}

function main() {
  const opts = parseArgs(process.argv);
  if (opts.help) {
    console.log(BANNER);
    console.log(HELP);
    return;
  }

  console.log(BANNER);
  console.log('Mode    : ' + (opts.apply ? 'APPLY (will write files)' : 'DRY RUN (writes nothing)'));
  console.log('Files   : ' + HH_TRV_FILE);
  console.log('          ' + SOURCES_FILE);
  console.log('reviewer: ' + (opts.reviewer || '(not set)'));
  console.log('date    : ' + (opts.date || '(not set)'));
  console.log('');

  const paramValues = JSON.parse(fs.readFileSync(HH_TRV_FILE, 'utf8'));
  const sources = JSON.parse(fs.readFileSync(SOURCES_FILE, 'utf8'));

  const plan = planPromotion(paramValues, sources, opts);

  console.log('Before/after plan:');
  printPlan(plan, opts);
  console.log('');

  const totalToPromote =
    plan.valueResults.filter((vr) => vr.promoteValue).length +
    plan.sourceResults.filter((sr) => sr.promoteSource).length;
  const totalSkipped =
    plan.valueResults.filter((vr) => vr.valueAlreadyDone).length +
    plan.sourceResults.filter((sr) => sr.sourceAlreadyDone).length;
  console.log('Summary: ' + totalToPromote + ' record(s) to promote, ' +
    totalSkipped + ' already in target state.');

  const anyValueStampRepair = plan.valueResults.some(
    (vr) => vr.valueAlreadyDone && valueStampRepairNeeded(vr.valueRecord),
  );
  if (anyValueStampRepair) {
    console.log('NOTE: one or more already-approved records are MISSING a promotion display-stamp on ' +
      'one of {applicability, uncertainty, review_notes}; --apply will repair it (writes human_health_trv_values.json).');
  }

  if (!opts.apply) {
    console.log('');
    console.log('DRY RUN -- no file written. Re-run with --apply (plus --reviewer/--date) to write.');
    return;
  }

  validateApplyOptions(opts);

  // Fail-closed provenance guard: each value approved against a direct_source_verified source
  // requires that source to have a durable locator. Both PFAS sources already have a url, so this
  // does not fire on the normal path.
  for (const vr of plan.valueResults) {
    if (!(vr.promoteValue || vr.valueAlreadyDone)) continue;
    const sr = plan.sourceResults.find((s) => s.sourceRecord.source_id === vr.expectedSourceId);
    const sourceWillBeVerified = sr && (sr.promoteSource || sr.sourceAlreadyDone);
    const effUrl = sr ? sr.sourceRecord.url : null;
    const effKey = sr ? sr.sourceRecord.zotero_item_key : null;
    if (sourceWillBeVerified && !effUrl && !effKey) {
      throw new Error(
        'Provenance guard: ' + vr.valueRecord.parameter_value_id + ' would be approved against source ' +
        vr.expectedSourceId + ' (direct_source_verified), but that source has no durable' +
        ' locator (url=null, zotero_item_key=null). Edit the source row to add a URL/Zotero key.',
      );
    }
  }

  const stampRepairWouldChange = plan.valueResults.some(
    (vr) => vr.valueAlreadyDone && valueStampRepairNeeded(vr.valueRecord),
  );
  if (totalToPromote === 0 && !stampRepairWouldChange) {
    console.log('');
    console.log('Nothing to promote (all records already in target state). No write.');
    return;
  }

  // Capture the applied plan: applyPromotion computes its OWN plan internally and is the only
  // object carrying valueTouchedFlags / sourceTouchedFlags. The write decision MUST read the returned object.
  const applied = applyPromotion(paramValues, sources, opts);

  const anyValueWrite =
    applied.valueResults.some((vr) => vr.promoteValue) ||
    applied.valueTouchedFlags.some(Boolean);
  if (anyValueWrite) {
    fs.writeFileSync(HH_TRV_FILE, JSON.stringify(paramValues, null, 2) + '\n', 'utf8');
    console.log('WROTE ' + HH_TRV_FILE);
  }
  if (applied.sourceTouched) {
    fs.writeFileSync(SOURCES_FILE, JSON.stringify(sources, null, 2) + '\n', 'utf8');
    console.log('WROTE ' + SOURCES_FILE);
  }

  const promotedCount = applied.valueResults.filter((vr) => vr.promoteValue).length;
  if (promotedCount > 0) {
    console.log('');
    console.log('REQUIRED before test:ci -- promoting these records shifts the audit-count guards.');
    console.log('  Update src/lib/matrix-options/provenance/__tests__/library.test.ts in the SAME commit:');
    console.log('    audit.values.approvedSourceBacked : +' + promotedCount + ' (records move to approved_source_backed)');
    console.log('    audit.values.pendingSourceLocator : -' + promotedCount + ' (they leave pending_source_locator)');
    console.log('    audit.values.needsReview          : -' + promotedCount + ' (records leave needs_review)');
    console.log('    audit.values.approved             : +' + promotedCount + ' (records become approved)');
    console.log('  (valueGroups / availableOptions / currentDefaults are UNCHANGED -- default_status stays available_option.)');
    console.log('  Run npm run test:ci and bump to match the FAILING assertion (do not hard-set).');
  }

  console.log('');
  console.log('Next: run the local gates:');
  console.log('  npx tsc --noEmit; npm run lint; npm run test:ci;');
  console.log('  npm run build:monitored:clean -- -TimeoutSeconds 360 -PollSeconds 10;');
  console.log('  npm run test:e2e');
}

// Only run main() when invoked as a script, not when imported by a test.
const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : '';
if (invokedPath === fileURLToPath(import.meta.url)) {
  main();
}
