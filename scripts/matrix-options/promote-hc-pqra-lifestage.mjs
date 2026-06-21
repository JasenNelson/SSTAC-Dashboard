// Owner-run promotion helper for the HC PQRA v4.0 lifestage (infant / child / teen) direct-contact
// receptor profile records. Plain ASCII only.
//
// WHY THIS EXISTS
// The HC PQRA v4.0 adult-receptor profile (BW + IR_sed + SA) was promoted by promote-hc-pqra-adult.mjs.
// This sibling tool promotes the corresponding LIFESTAGE body-weight (BW_kg) and total-body skin
// surface area (SA_cm2) records for the infant, child, and teenager age groups so the direct-contact
// frame can offer the additional lifestage receptor options. Each record is backed by the same source
// (Health Canada PQRA v4.0, 2024). This tool promotes EXACTLY those 6 records + the source, fails
// closed on any precondition, and is idempotent.
//
// It mirrors promote-hc-pqra-adult.mjs in structure, style, and fail-closed discipline (multi-record
// batch promotion).
//
// LOAD-BEARING RULES honored:
//  - AI NEVER writes qa_status. This tool is run BY THE OWNER; --reviewer/--date are the owner's
//    HITL attestation. Author + dry-run only for AI.
//  - OWNER VERIFICATION REQUIRED (rule 1): Before running with --apply, the OWNER must verify all
//    6 values against the primary Health Canada PQRA v4.0 PDF (Cat. H129-114/2023E-PDF, ISBN
//    978-0-660-68497-0, March 2024, Appendix E). Running with --apply attests to that verification.
//  - SCOPE (rule 2): only the 6 listed records are promoted. default_status is NEVER modified
//    (stays 'available_option'); the owner's FRAME_DEFAULT_PROFILES row is the activation step.
//  - SOURCE (rule 3): src-health-canada-pqra-v4-2024 is expected to already carry
//    canonical_source_status = 'direct_source_verified' (promoted by the toddler run, #305). On the
//    real catalog the SOURCE will normally SKIP (already-done). The source promotion LOGIC is kept
//    identical (it handles the already-done case gracefully).
//    This field is REQUIRED because defaultSelectionPolicy.isDirectCurrentSource() checks
//    source.canonical_source_status === 'direct_source_verified'. Without it the frame seed stays
//    blocked even after value promotion.
//  - AFTER --apply (rule 4): run npx tsc --noEmit; npm run lint; npm run test:ci.
//
// USAGE (run from anywhere; paths resolve from the script location):
//   node scripts/matrix-options/promote-hc-pqra-lifestage.mjs --reviewer "J. Nelson" --date 2026-06-20
//   node scripts/matrix-options/promote-hc-pqra-lifestage.mjs --reviewer "J. Nelson" --date 2026-06-20 --apply
//
// Default is a DRY RUN (prints the per-record plan, writes nothing). --apply writes both
// matrix_research/reference_catalog/parameter_values.json and
// matrix_research/reference_catalog/sources.json.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..', '..');
const PARAM_VALUES_FILE = path.join(
  REPO_ROOT, 'matrix_research', 'reference_catalog', 'parameter_values.json',
);
const SOURCES_FILE = path.join(
  REPO_ROOT, 'matrix_research', 'reference_catalog', 'sources.json',
);

// These are the ONLY records this tool will ever touch. Hard-coded so scope is fixed + auditable.
// Export so a future catalog.test guard can import them and assert they are approved.
export const HC_PQRA_LIFESTAGE_PROMOTION_VALUE_IDS = [
  'pv-hc-pqra-v4-2024-bw-infant-ca',
  'pv-hc-pqra-v4-2024-bw-child-ca',
  'pv-hc-pqra-v4-2024-bw-teen-ca',
  'pv-hc-pqra-v4-2024-sa-total-infant-ca',
  'pv-hc-pqra-v4-2024-sa-total-child-ca',
  'pv-hc-pqra-v4-2024-sa-total-teen-ca',
];
export const HC_PQRA_LIFESTAGE_PROMOTION_SOURCE_ID = 'src-health-canada-pqra-v4-2024';

// Expected frame-eligible identity per record (fields classifyCandidate / getFrameSeedCandidateEligibility
// examine). Any mismatch -> fail closed. Ordered to match HC_PQRA_LIFESTAGE_PROMOTION_VALUE_IDS above.
const EXPECTED_IDENTITIES = [
  // pv-hc-pqra-v4-2024-bw-infant-ca
  {
    jurisdiction: 'general',
    candidate_group_id: 'human-health-direct__generic__BW_kg__general',
    pathway: 'human-health-direct',
    input_key: 'BW_kg',
    substance_key: 'generic',
    value: 8.2,
    unit: 'kg',
    value_type: 'single_value',
    default_status: 'available_option',
  },
  // pv-hc-pqra-v4-2024-bw-child-ca
  {
    jurisdiction: 'general',
    candidate_group_id: 'human-health-direct__generic__BW_kg__general',
    pathway: 'human-health-direct',
    input_key: 'BW_kg',
    substance_key: 'generic',
    value: 32.9,
    unit: 'kg',
    value_type: 'single_value',
    default_status: 'available_option',
  },
  // pv-hc-pqra-v4-2024-bw-teen-ca
  {
    jurisdiction: 'general',
    candidate_group_id: 'human-health-direct__generic__BW_kg__general',
    pathway: 'human-health-direct',
    input_key: 'BW_kg',
    substance_key: 'generic',
    value: 59.7,
    unit: 'kg',
    value_type: 'single_value',
    default_status: 'available_option',
  },
  // pv-hc-pqra-v4-2024-sa-total-infant-ca
  {
    jurisdiction: 'general',
    candidate_group_id: 'human-health-direct__generic__SA_cm2__general',
    pathway: 'human-health-direct',
    input_key: 'SA_cm2',
    substance_key: 'generic',
    value: 3620,
    unit: 'cm2',
    value_type: 'single_value',
    default_status: 'available_option',
  },
  // pv-hc-pqra-v4-2024-sa-total-child-ca
  {
    jurisdiction: 'general',
    candidate_group_id: 'human-health-direct__generic__SA_cm2__general',
    pathway: 'human-health-direct',
    input_key: 'SA_cm2',
    substance_key: 'generic',
    value: 10140,
    unit: 'cm2',
    value_type: 'single_value',
    default_status: 'available_option',
  },
  // pv-hc-pqra-v4-2024-sa-total-teen-ca
  {
    jurisdiction: 'general',
    candidate_group_id: 'human-health-direct__generic__SA_cm2__general',
    pathway: 'human-health-direct',
    input_key: 'SA_cm2',
    substance_key: 'generic',
    value: 15470,
    unit: 'cm2',
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
export function validateApplyOptions(opts) {
  const errors = [];
  if (!opts.reviewer || !String(opts.reviewer).trim()) {
    errors.push('--reviewer "<id/name>" is required for --apply (it becomes evidence.reviewed_by)');
  }
  if (!opts.date || !DATE_RE.test(opts.date)) {
    errors.push('--date YYYY-MM-DD is required for --apply (it becomes evidence.reviewed_at)');
  }
  if (errors.length) throw new Error('Invalid --apply options:\n  - ' + errors.join('\n  - '));
}

// ---------------------------------------------------------------------------
// Plan
// ---------------------------------------------------------------------------

// Computes the promotion plan for a single value record and enforces preconditions (fail-closed).
// Throws on: missing record, no evidence_items, identity mismatch, wrong source_ids, unexpected
// qa state, or drifted/partial-promotion state.
// Returns { valueRecord, valueAlreadyDone, promoteValue }.
function planOneValueRecord(paramValues, valueId, expectedIdentity) {
  const valueRecord = paramValues.find(
    (r) => r.parameter_value_id === valueId,
  );
  if (!valueRecord) {
    throw new Error(
      'Precondition failed: value record not found in parameter_values.json: ' + valueId,
    );
  }
  if (!Array.isArray(valueRecord.evidence_items) || valueRecord.evidence_items.length === 0) {
    throw new Error(
      'Precondition failed: ' + valueId + ' has no evidence_items',
    );
  }
  // Fail-closed IDENTITY check: cover EVERY scalar field classifyCandidate examines so the helper
  // cannot "succeed" on a record that would still be blocked by the frame-default pipeline.
  const identityMismatch = Object.entries(expectedIdentity).filter(
    ([k, v]) => valueRecord[k] !== v,
  );
  if (identityMismatch.length > 0) {
    throw new Error(
      'Precondition failed: ' + valueId +
      ' is not in the expected frame-eligible identity. Mismatched field(s):\n' +
      identityMismatch
        .map(([k, v]) => '  ' + k + ': expected ' + JSON.stringify(v) +
          ', actual ' + JSON.stringify(valueRecord[k]))
        .join('\n') +
      '\nRefusing to promote a record that cannot seed the direct-contact frame.',
    );
  }
  // source_ids must be EXACTLY [HC PQRA source]. classifyCandidate derives sourceRoles from EVERY
  // source_id, so a SECOND linked source carrying a policy_compilation / reference_mining role
  // would be blocked by the real frame-default pipeline yet slip past a mere "includes" check.
  if (!Array.isArray(valueRecord.source_ids) ||
      valueRecord.source_ids.length !== 1 ||
      valueRecord.source_ids[0] !== HC_PQRA_LIFESTAGE_PROMOTION_SOURCE_ID) {
    throw new Error(
      'Precondition failed: ' + valueId + ' source_ids must be EXACTLY ["' +
      HC_PQRA_LIFESTAGE_PROMOTION_SOURCE_ID + '"] (actual: ' + JSON.stringify(valueRecord.source_ids) +
      '). A second linked source could carry a policy_compilation/reference_mining role that ' +
      'classifyCandidate would block but this single-source helper would miss. Refusing to promote.',
    );
  }
  // Nested-source provenance guard (backport 2026-06-14): the top-level source_ids check above does
  // NOT cover evidence_items[*].source_id or source_relationships[*].source_id. A row forked from
  // another record could carry a stale nested source_id while its top-level source_ids is correct;
  // applyPromotion preserves those nested ids and stamps QA approved, so a stale nested ref would
  // survive as approved provenance. Require every nested source reference to be the HC PQRA source.
  const nestedSourceRefs = [
    ...(Array.isArray(valueRecord.evidence_items)
      ? valueRecord.evidence_items.map((ev) => (ev ? ev.source_id : undefined))
      : []),
    ...(Array.isArray(valueRecord.source_relationships)
      ? valueRecord.source_relationships.map((rel) => (rel ? rel.source_id : undefined))
      : []),
  ];
  const staleNestedSourceRefs = nestedSourceRefs.filter(
    (sid) => sid !== HC_PQRA_LIFESTAGE_PROMOTION_SOURCE_ID,
  );
  if (staleNestedSourceRefs.length > 0) {
    throw new Error(
      'Precondition failed: ' + valueId + ' has nested provenance source ' +
      'reference(s) that are not the expected source (' + JSON.stringify(staleNestedSourceRefs) + '). ' +
      'Every evidence_items[*].source_id and source_relationships[*].source_id must be "' +
      HC_PQRA_LIFESTAGE_PROMOTION_SOURCE_ID + '"; a stale nested source reference ' +
      'would otherwise survive as approved provenance. Refusing to promote.',
    );
  }
  // Fail-closed: accept ONLY the exact documented pre-promotion state or the exact already-promoted
  // state. Evidence items must move WITH the top-level statuses; a partial-promotion is rejected.
  // Attestation guard (uniform backport 2026-06-13): an approved evidence item MUST carry the owner
  // attestation (reviewed_by + reviewed_at). An approved-but-unattested evidence item is NOT counted
  // as approved here, so the record fails BOTH valueAlreadyDone and valueExpectedPre and trips the
  // drifted/partially-promoted throw below (fail closed). catalog.test.ts backstops the EMITTED
  // catalog; this guards the promotion-script invariant itself for future reuse of this tooling.
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

  return { valueRecord, valueAlreadyDone, promoteValue: !valueAlreadyDone };
}

// Computes the promotion plan for all 6 value records + the source. Enforces ALL preconditions
// (fail-closed). Throws on any failure. Records already in target state are SKIPPED (idempotent).
// NOTE: the source src-health-canada-pqra-v4-2024 is expected to already be direct_source_verified
// (promoted by the toddler run, #305). On the real catalog the SOURCE will normally SKIP.
export function planPromotion(paramValues, sources, _opts) {
  // -- VALUE records (one by one; fail fast on first precondition failure) --
  const valueResults = HC_PQRA_LIFESTAGE_PROMOTION_VALUE_IDS.map((valueId, i) =>
    planOneValueRecord(paramValues, valueId, EXPECTED_IDENTITIES[i]),
  );

  // -- SOURCE record --
  const sourceRecord = sources.find(
    (s) => s.source_id === HC_PQRA_LIFESTAGE_PROMOTION_SOURCE_ID,
  );
  if (!sourceRecord) {
    throw new Error(
      'Precondition failed: source record not found in sources.json: ' +
      HC_PQRA_LIFESTAGE_PROMOTION_SOURCE_ID,
    );
  }
  // Fail-closed: the source is accepted ONLY in its expected pre-state or already-done state.
  // NOTE: the HC PQRA source may NOT have canonical_source_status at all (field is ABSENT on the
  // record today). Absent is treated the same as needs_direct_source_check (promotable).
  const csStatus = sourceRecord.canonical_source_status;
  const sourceAlreadyDone = csStatus === 'direct_source_verified';
  const sourceExpectedPre = csStatus === 'needs_direct_source_check' || csStatus == null;

  if (!sourceAlreadyDone && !sourceExpectedPre) {
    throw new Error(
      'Precondition failed: source ' + HC_PQRA_LIFESTAGE_PROMOTION_SOURCE_ID +
      ' canonical_source_status="' + csStatus +
      '" is neither needs_direct_source_check/absent (promotable) nor direct_source_verified (done). ' +
      'Refusing to promote a drifted source.',
    );
  }

  // Fail-closed on source-role / currentness fields classifyCandidate examines, so the helper
  // cannot stamp a record approved that getFrameSeedCandidateEligibility would still BLOCK.
  // NOTE: calculator_source_role is ABSENT on the HC PQRA source; the pipeline defaults to
  // 'canonical_candidate' via ??, which is the promotable role.
  const srcRole = sourceRecord.calculator_source_role ?? 'canonical_candidate';
  // Check source_relationships on each value record too.
  for (const { valueRecord } of valueResults) {
    const relationshipRoles = Array.isArray(valueRecord.source_relationships)
      ? valueRecord.source_relationships.map((r) => (r ? r.role : null))
      : [];
    const allRoles = [srcRole, ...relationshipRoles];
    if (allRoles.includes('policy_compilation') || allRoles.includes('reference_mining')) {
      throw new Error(
        'Precondition failed: ' + valueRecord.parameter_value_id + ' has a source role of ' +
        'policy_compilation/reference_mining (roles: ' + JSON.stringify(allRoles) + '). ' +
        'classifyCandidate would block such a record; refusing to promote a record the frame-default pipeline blocks.',
      );
    }
  }
  if (
    sourceRecord.file_storage === 'repo_metadata_only' ||
    srcRole !== 'canonical_candidate' ||
    sourceRecord.currentness_status !== 'current'
  ) {
    throw new Error(
      'Precondition failed: source ' + HC_PQRA_LIFESTAGE_PROMOTION_SOURCE_ID +
      ' is not direct-current eligible. isDirectCurrentSource requires file_storage != ' +
      'repo_metadata_only, calculator_source_role = canonical_candidate, currentness_status = ' +
      'current. Actual: file_storage=' + JSON.stringify(sourceRecord.file_storage) +
      ', calculator_source_role=' + JSON.stringify(srcRole) +
      ', currentness_status=' + JSON.stringify(sourceRecord.currentness_status) + '. ' +
      'Promoting it to direct_source_verified would still leave the frame default blocked (blocked_needs_qa).',
    );
  }

  return {
    valueResults,
    sourceRecord,
    sourceAlreadyDone,
    promoteSource: !sourceAlreadyDone,
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

// The human-readable provenance fields the Evidence Library renders directly.
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

  let sourceTouched = false;
  if (opts.sourceUrl && plan.sourceRecord.url !== opts.sourceUrl) {
    plan.sourceRecord.url = opts.sourceUrl;
    sourceTouched = true;
  }
  if (opts.zoteroKey) {
    if (plan.sourceRecord.zotero_item_key !== opts.zoteroKey) {
      plan.sourceRecord.zotero_item_key = opts.zoteroKey;
      sourceTouched = true;
    }
    if (plan.sourceRecord.zotero_status !== 'linked') {
      plan.sourceRecord.zotero_status = 'linked';
      sourceTouched = true;
    }
  }
  if (plan.promoteSource) {
    plan.sourceRecord.canonical_source_status = 'direct_source_verified';
    const srcStamp =
      ' [Source promoted to direct_source_verified on ' + opts.date + ' by ' + opts.reviewer +
      '; the pending / needs_review language above is superseded.]';
    if (typeof plan.sourceRecord.notes === 'string') plan.sourceRecord.notes += srcStamp;
    sourceTouched = true;
  }
  plan.sourceTouched = sourceTouched;

  return plan;
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

const BANNER = [
  '=============================================================================',
  ' promote-hc-pqra-lifestage.mjs -- owner-run HC PQRA v4.0 lifestage-receptor promotion',
  '=============================================================================',
  '',
  'OWNER VERIFICATION REQUIRED before --apply:',
  '  Verify the 6 lifestage values (infant/child/teen BW + SA) against the primary',
  '    Health Canada PQRA v4.0 PDF (Cat. H129-114/2023E-PDF, ISBN 978-0-660-68497-0,',
  '    March 2024, Appendix E).',
  '  Running --apply attests to that verification.',
  '',
  'SOURCE NOTE:',
  '  src-health-canada-pqra-v4-2024 is expected to already be direct_source_verified',
  '  (promoted by the toddler run, #305). On the real catalog the SOURCE will normally SKIP.',
  '  The promotion logic handles this gracefully (already-done case = no-op).',
  '  This field is required for defaultSelectionPolicy.isDirectCurrentSource() to pass.',
  '',
  'SCOPE: 6 lifestage value records + 1 source are promoted. default_status',
  '  is NOT changed (stays available_option). The FRAME_DEFAULT_PROFILES row is the owner',
  '  activation step, not this tool.',
  '',
].join('\n');

const HELP = [
  'promote-hc-pqra-lifestage.mjs -- owner-run HC PQRA v4.0 lifestage-receptor profile promotion.',
  '',
  'Usage:',
  '  node scripts/matrix-options/promote-hc-pqra-lifestage.mjs --reviewer "<id>" --date YYYY-MM-DD [--apply]',
  '    [--source-url "<url>"] [--zotero-key "<key>"]',
  '',
  'Options:',
  '  --reviewer "<id>"        Reviewer attestation -> evidence.reviewed_by (required for --apply)',
  '  --date YYYY-MM-DD        Review date -> evidence.reviewed_at (required for --apply)',
  '  --source-url "<url>"     Override the stored source URL (only if it changed).',
  '  --zotero-key "<key>"     Zotero item key; sets zotero_item_key and zotero_status=linked.',
  '  --apply                  Write both catalog files (default is a dry run that writes nothing)',
  '',
  'Targets (6 lifestage VALUE records + 1 SOURCE):',
  '  VALUE : pv-hc-pqra-v4-2024-bw-infant-ca',
  '  VALUE : pv-hc-pqra-v4-2024-bw-child-ca',
  '  VALUE : pv-hc-pqra-v4-2024-bw-teen-ca',
  '  VALUE : pv-hc-pqra-v4-2024-sa-total-infant-ca',
  '  VALUE : pv-hc-pqra-v4-2024-sa-total-child-ca',
  '  VALUE : pv-hc-pqra-v4-2024-sa-total-teen-ca',
  '  SOURCE: src-health-canada-pqra-v4-2024',
  '',
  'On --apply, each VALUE record changes:',
  '  qa_status                 needs_review -> approved',
  '  evidence_support_status   pending_source_locator -> approved_source_backed',
  '  canonical_source_status   needs_direct_source_check -> direct_source_verified',
  '  evidence_items[*].qa_status needs_review -> approved (+ reviewed_by/at after qa_status)',
  '  default_status            UNCHANGED (stays available_option)',
  'On --apply, the SOURCE record changes:',
  '  canonical_source_status   (absent) -> direct_source_verified  [FIELD ADDED if not already set]',
  '  NOTE: on the real catalog the source is expected already direct_source_verified; it will SKIP.',
  '',
  'AI never runs this with --apply. The owner runs it; --reviewer/--date are the HITL attestation.',
  'After --apply: npx tsc --noEmit; npm run lint; npm run test:ci',
].join('\n');

function printPlan(plan, opts) {
  for (let i = 0; i < plan.valueResults.length; i++) {
    const vr = plan.valueResults[i];
    const valueId = HC_PQRA_LIFESTAGE_PROMOTION_VALUE_IDS[i];
    if (vr.promoteValue) {
      const r = vr.valueRecord;
      console.log('  VALUE   PROMOTE  ' + valueId);
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

  if (plan.promoteSource) {
    const s = plan.sourceRecord;
    const currentStatus = s.canonical_source_status == null ? '(absent)' : s.canonical_source_status;
    console.log('  SOURCE  PROMOTE  ' + HC_PQRA_LIFESTAGE_PROMOTION_SOURCE_ID);
    console.log('    canonical_source_status : ' + currentStatus +
      ' -> direct_source_verified');
  } else {
    console.log('  SOURCE  SKIP     ' + HC_PQRA_LIFESTAGE_PROMOTION_SOURCE_ID +
      ': already in target state (no-op)');
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
  console.log('Files   : ' + PARAM_VALUES_FILE);
  console.log('          ' + SOURCES_FILE);
  console.log('reviewer: ' + (opts.reviewer || '(not set)'));
  console.log('date    : ' + (opts.date || '(not set)'));
  console.log('');

  const paramValues = JSON.parse(fs.readFileSync(PARAM_VALUES_FILE, 'utf8'));
  const sources = JSON.parse(fs.readFileSync(SOURCES_FILE, 'utf8'));

  const plan = planPromotion(paramValues, sources, opts);

  console.log('Before/after plan:');
  printPlan(plan, opts);
  console.log('');

  const totalToPromote =
    plan.valueResults.filter((vr) => vr.promoteValue).length +
    (plan.promoteSource ? 1 : 0);
  const totalSkipped =
    plan.valueResults.filter((vr) => vr.valueAlreadyDone).length +
    (plan.sourceAlreadyDone ? 1 : 0);
  console.log('Summary: ' + totalToPromote + ' record(s) to promote, ' +
    totalSkipped + ' already in target state.');

  const anyValueStampRepair = plan.valueResults.some(
    (vr) => vr.valueAlreadyDone && valueStampRepairNeeded(vr.valueRecord),
  );
  if (anyValueStampRepair) {
    console.log('NOTE: one or more already-approved records are MISSING a promotion display-stamp on ' +
      'one of {applicability, uncertainty, review_notes}; --apply will repair it (writes parameter_values.json).');
  }

  if (!opts.apply) {
    console.log('');
    console.log('DRY RUN -- no file written. Re-run with --apply (plus --reviewer/--date) to write.');
    return;
  }

  validateApplyOptions(opts);

  // Fail-closed provenance guard: a value approved against a direct_source_verified source
  // requires that source to have a durable locator. The HC PQRA source already has a url, so
  // this does not fire on the normal path.
  const sourceWillBeVerified = plan.promoteSource || plan.sourceAlreadyDone;
  const anyValueWillBeApproved = plan.valueResults.some((vr) => vr.promoteValue || vr.valueAlreadyDone);
  const effUrl = opts.sourceUrl || plan.sourceRecord.url;
  const effKey = opts.zoteroKey || plan.sourceRecord.zotero_item_key;
  if (anyValueWillBeApproved && sourceWillBeVerified && !effUrl && !effKey) {
    throw new Error(
      'Provenance guard: value records would be approved against source ' +
      HC_PQRA_LIFESTAGE_PROMOTION_SOURCE_ID + ' (direct_source_verified), but that source has no durable' +
      ' locator (url=null, zotero_item_key=null).\n' +
      'Provide --source-url "<url>" and/or --zotero-key "<Zotero item key>".',
    );
  }

  const locatorWouldChange =
    (Boolean(opts.sourceUrl) && plan.sourceRecord.url !== opts.sourceUrl) ||
    (Boolean(opts.zoteroKey) && plan.sourceRecord.zotero_item_key !== opts.zoteroKey) ||
    (Boolean(opts.zoteroKey) && plan.sourceRecord.zotero_status !== 'linked');
  const stampRepairWouldChange = plan.valueResults.some(
    (vr) => vr.valueAlreadyDone && valueStampRepairNeeded(vr.valueRecord),
  );
  if (totalToPromote === 0 && !locatorWouldChange && !stampRepairWouldChange) {
    console.log('');
    console.log('Nothing to promote (all records already in target state). No write.');
    return;
  }

  // Capture the applied plan: applyPromotion computes its OWN plan internally and is the only
  // object carrying valueTouchedFlags / sourceTouched. The write decision MUST read the returned object.
  const applied = applyPromotion(paramValues, sources, opts);

  const anyValueWrite =
    applied.valueResults.some((vr) => vr.promoteValue) ||
    applied.valueTouchedFlags.some(Boolean);
  if (anyValueWrite) {
    fs.writeFileSync(PARAM_VALUES_FILE, JSON.stringify(paramValues, null, 2) + '\n', 'utf8');
    console.log('WROTE ' + PARAM_VALUES_FILE);
  }
  if (applied.promoteSource || applied.sourceTouched) {
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
