// Owner-run promotion helper for the TWN BIWQO 2021 toddler subsistence food-web records.
// Plain ASCII only.
//
// WHY THIS EXISTS
// The TWN Burrard Inlet Water Quality Objectives (BIWQO 2021) toddler subsistence scenario
// uses a toddler fish-ingestion rate (94 g/day = 0.094 kg/day) from the Tsleil-Waututh Nation
// Burrard Inlet WQO Tissue Quality Objectives report (ENV and HLTH 2021, Table 1). This is a
// MIXED-SOURCE receptor (mirrors the ACFN precedent, #316/2026-06-14):
//  - IR seed: TWN BIWQO 2021 (pv-twn-biwqo-2021-ir-food-toddler-bc, 0.094 kg/day); sourced to
//    src-bc-twn-burrard-inlet-wqo-tissue-2021. PENDING owner filing the TWN PDF + --apply.
//  - BW seed: HC PQRA v4.0 (pv-hc-pqra-v4-2024-bw-toddler-food-bc, 16.5 kg); sourced to
//    src-health-canada-pqra-v4-2024. HC source is ALREADY direct_source_verified (promoted
//    2026-06-12, J. Nelson). TWN only tabulates ADULT BW (76.5 kg); 16.5 kg is the standard
//    HC PQRA v4.0 Appendix E value, not TWN-sourced.
// This tool promotes BOTH value records (IR + BW) and ONLY the TWN BIWQO 2021 source. The HC
// PQRA v4.0 source is already verified and MUST NOT be re-promoted by this tool.
// Per-record nested-source guard: IR nested refs must be TWN source; BW nested refs must be HC.
//
// LOAD-BEARING RULES honored:
//  - AI NEVER writes qa_status. This tool is run BY THE OWNER; --reviewer/--date are the
//    owner's HITL attestation. Author + dry-run only for AI.
//  - OWNER VERIFICATION REQUIRED (rule 1): Before running with --apply, the OWNER must
//    file the TWN BIWQO 2021 PDF (open gov.bc.ca URL) in the reference library + Zotero and
//    verify the toddler fish-ingestion rate (IR_food = 94 g/day) against Table 1. The 16.5 kg
//    BW is the standard HC PQRA v4.0 value -- no separate TWN primary verification needed.
//    Running with --apply attests to the TWN IR verification.
//  - SCOPE (rule 2): only the two TWN toddler food-web value records + the TWN BIWQO 2021 source
//    are promoted. The HC PQRA v4.0 source (src-health-canada-pqra-v4-2024) is already
//    direct_source_verified and is NOT touched by this tool. default_status is NEVER modified
//    (stays 'available_option'); the FRAME_DEFAULT_PROFILES row is the activation step.
//  - AFTER --apply (rule 3): run npx tsc --noEmit; npm run lint; npm run test:ci.
//
// USAGE (run from anywhere; paths resolve from the script location):
//   node scripts/matrix-options/promote-twn-foodweb-toddler.mjs --reviewer "J. Nelson" --date 2026-06-14
//   node scripts/matrix-options/promote-twn-foodweb-toddler.mjs --reviewer "J. Nelson" --date 2026-06-14 --apply
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
export const TWN_TODDLER_IR_VALUE_ID = 'pv-twn-biwqo-2021-ir-food-toddler-bc';
export const TWN_TODDLER_BW_VALUE_ID = 'pv-hc-pqra-v4-2024-bw-toddler-food-bc';
export const TWN_TODDLER_SOURCE_ID = 'src-bc-twn-burrard-inlet-wqo-tissue-2021';
// The BW record cites the HC PQRA v4.0 source (already direct_source_verified). This tool
// promotes the VALUE records (both IR and BW) but only the TWN SOURCE. HC is NOT re-promoted.
export const HC_PQRA_SOURCE_ID = 'src-health-canada-pqra-v4-2024';
export const TWN_TODDLER_PROMOTION_VALUE_IDS = [TWN_TODDLER_IR_VALUE_ID, TWN_TODDLER_BW_VALUE_ID];

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

// Validates the owner-supplied attestation. Required only when actually writing (--apply).
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
// Plan (fail-closed preconditions for a single value record)
// ---------------------------------------------------------------------------

// Expected identity for each value record: every field getFrameSeedCandidateEligibility /
// classifyCandidate examines must be correct so the helper cannot stamp an unexpected record.
const EXPECTED_VALUE_IDENTITIES = {
  [TWN_TODDLER_IR_VALUE_ID]: {
    jurisdiction: 'BC',
    candidate_group_id: 'human-health-food__generic__IR_food_kg_per_day__BC',
    pathway: 'human-health-food',
    input_key: 'IR_food_kg_per_day',
    substance_key: 'generic',
    value: 0.094,
    unit: 'kg/day',
    value_type: 'single_value',
    default_status: 'available_option',
  },
  [TWN_TODDLER_BW_VALUE_ID]: {
    jurisdiction: 'BC',
    candidate_group_id: 'human-health-food__generic__BW_kg__BC',
    pathway: 'human-health-food',
    input_key: 'BW_kg',
    substance_key: 'generic',
    value: 16.5,
    unit: 'kg',
    value_type: 'single_value',
    default_status: 'available_option',
  },
};

// Per-record expected source IDs for the nested-source guard and top-level source_ids check.
// The IR record is sourced to TWN; the BW record is sourced to HC PQRA v4.0 (standard value).
const EXPECTED_SOURCE_ID = {
  [TWN_TODDLER_IR_VALUE_ID]: TWN_TODDLER_SOURCE_ID,
  [TWN_TODDLER_BW_VALUE_ID]: HC_PQRA_SOURCE_ID,
};

// Plan and enforce preconditions for a single value record. Throws on any violation.
// expectedSourceId: the single source this record must link (per EXPECTED_SOURCE_ID above).
function planSingleValue(paramValues, valueId) {
  const expectedSourceId = EXPECTED_SOURCE_ID[valueId];
  const valueRecord = paramValues.find((r) => r.parameter_value_id === valueId);
  if (!valueRecord) {
    throw new Error(
      'Precondition failed: value record not found in parameter_values.json: ' + valueId,
    );
  }
  if (!Array.isArray(valueRecord.evidence_items) || valueRecord.evidence_items.length === 0) {
    throw new Error('Precondition failed: ' + valueId + ' has no evidence_items');
  }

  // Frame-eligible identity check.
  const expected = EXPECTED_VALUE_IDENTITIES[valueId];
  const identityMismatch = Object.entries(expected).filter(([k, v]) => valueRecord[k] !== v);
  if (identityMismatch.length > 0) {
    throw new Error(
      'Precondition failed: ' + valueId + ' is not in the expected frame-eligible identity.' +
      ' Mismatched field(s):\n' +
      identityMismatch
        .map(([k, v]) => '  ' + k + ': expected ' + JSON.stringify(v) +
          ', actual ' + JSON.stringify(valueRecord[k]))
        .join('\n') +
      '\nRefusing to promote a record that cannot seed the intended frame.',
    );
  }

  // source_ids must be EXACTLY [expectedSourceId] for this record.
  // IR: must link exactly [TWN source]. BW: must link exactly [HC PQRA v4.0 source].
  // A second linked source could carry a policy_compilation/reference_mining role that
  // classifyCandidate would block but this per-record check would miss.
  if (!Array.isArray(valueRecord.source_ids) ||
      valueRecord.source_ids.length !== 1 ||
      valueRecord.source_ids[0] !== expectedSourceId) {
    throw new Error(
      'Precondition failed: ' + valueId + ' source_ids must be EXACTLY ["' +
      expectedSourceId + '"] (actual: ' + JSON.stringify(valueRecord.source_ids) +
      '). A second linked source could carry a policy_compilation/reference_mining role that ' +
      'classifyCandidate would block but this per-record helper would miss. Refusing to promote.',
    );
  }

  // Nested-source provenance guard (per-record): every evidence_items[*].source_id and
  // source_relationships[*].source_id must match the expected source for THIS record.
  // IR record: all nested refs must be the TWN source.
  // BW record: all nested refs must be the HC PQRA v4.0 source.
  // A forked record could carry a stale nested source_id while its top-level source_ids is
  // correct; that stale nested ref would survive as approved provenance if unchecked.
  const nestedSourceRefs = [
    ...(Array.isArray(valueRecord.evidence_items)
      ? valueRecord.evidence_items.map((ev) => (ev ? ev.source_id : undefined))
      : []),
    ...(Array.isArray(valueRecord.source_relationships)
      ? valueRecord.source_relationships.map((rel) => (rel ? rel.source_id : undefined))
      : []),
  ];
  const staleNestedSourceRefs = nestedSourceRefs.filter((sid) => sid !== expectedSourceId);
  if (staleNestedSourceRefs.length > 0) {
    throw new Error(
      'Precondition failed: ' + valueId + ' has nested provenance source reference(s) that are ' +
      'not the expected source for this record (' + JSON.stringify(staleNestedSourceRefs) + '). ' +
      'Every evidence_items[*].source_id and source_relationships[*].source_id must be "' +
      expectedSourceId + '" (IR record -> TWN source; BW record -> HC PQRA v4.0 source). ' +
      'A stale forked nested source would otherwise survive as approved provenance. Refusing to promote.',
    );
  }

  // Relationship-role guard (per codex review 2026-06-14): the nested-source guard above only
  // matches source_relationships[*].source_id, but the frame-seed eligibility path
  // (classifyCandidate / getFrameSeedCandidateEligibility) ALSO treats a source_relationships[*].role
  // of 'policy_compilation' or 'reference_mining' as BLOCKING. A relationship can point at the
  // expected source (passing the id check) yet carry a blocking role, which would leave the frame seed
  // blocked even though applyPromotion stamped the record approved. Reject blocking relationship roles
  // so the helper stays genuinely fail-closed against that partial-promotion state.
  const BLOCKING_RELATIONSHIP_ROLES = ['policy_compilation', 'reference_mining'];
  const blockingRoleRels = (Array.isArray(valueRecord.source_relationships)
    ? valueRecord.source_relationships
    : []
  ).filter((rel) => rel && BLOCKING_RELATIONSHIP_ROLES.includes(rel.role));
  if (blockingRoleRels.length > 0) {
    throw new Error(
      'Precondition failed: ' + valueId + ' has source_relationships carrying a blocking role (' +
      JSON.stringify(blockingRoleRels.map((rel) => rel.role)) + '). The frame-seed eligibility path ' +
      'blocks policy_compilation / reference_mining relationship roles, so promoting this record ' +
      'would stamp it approved while its frame seed stays blocked. Refusing to promote.',
    );
  }

  // Attestation guard: approved evidence must carry reviewed_by + reviewed_at.
  const allEvidenceApproved = valueRecord.evidence_items.every(
    (ev) => ev.qa_status === 'approved' && Boolean(ev.reviewed_by) && Boolean(ev.reviewed_at),
  );
  const allEvidenceNeedsReview = valueRecord.evidence_items.every(
    (ev) => ev.qa_status === 'needs_review',
  );

  // Fully-promoted state (both IR and BW): top-level approved + evidence approved + attested.
  const valueAlreadyDone =
    valueRecord.qa_status === 'approved' &&
    valueRecord.evidence_support_status === 'approved_source_backed' &&
    valueRecord.canonical_source_status === 'direct_source_verified' &&
    allEvidenceApproved;

  // Uniform pre-promotion state for BOTH IR and BW records:
  // qa_status=needs_review, evidence_support_status=pending_source_locator,
  // canonical_source_status=needs_direct_source_check, ALL evidence_items needs_review.
  // The BW record carries source_id=HC PQRA v4.0 (already a verified source) but the
  // catalog record itself is needs_review until the owner runs --apply for the whole scenario.
  const valueExpectedPre =
    valueRecord.qa_status === 'needs_review' &&
    valueRecord.evidence_support_status === 'pending_source_locator' &&
    valueRecord.canonical_source_status === 'needs_direct_source_check' &&
    allEvidenceNeedsReview;

  if (!valueAlreadyDone && !valueExpectedPre) {
    const evStates = valueRecord.evidence_items.map((ev) => ev.qa_status);
    throw new Error(
      'Precondition failed: ' + valueId + ' is not in the expected pre-promotion state nor the already-promoted state.\n' +
      '  expected pre  : qa_status=needs_review, evidence_support_status=pending_source_locator, canonical_source_status=needs_direct_source_check, ALL evidence_items needs_review\n' +
      '  already-done  : qa_status=approved, evidence_support_status=approved_source_backed, canonical_source_status=direct_source_verified, ALL evidence_items approved+attested\n' +
      '  actual        : qa_status=' + valueRecord.qa_status +
      ', evidence_support_status=' + valueRecord.evidence_support_status +
      ', canonical_source_status=' + valueRecord.canonical_source_status +
      ', evidence_items qa=' + JSON.stringify(evStates) + '\n' +
      'Refusing to promote a drifted/partially-promoted record.',
    );
  }

  return { valueRecord, valueAlreadyDone, promoteValue: !valueAlreadyDone };
}

// Plan and enforce preconditions for the source record.
function planSource(sources) {
  const sourceRecord = sources.find((s) => s.source_id === TWN_TODDLER_SOURCE_ID);
  if (!sourceRecord) {
    throw new Error(
      'Precondition failed: source record not found in sources.json: ' + TWN_TODDLER_SOURCE_ID,
    );
  }
  const sourceAlreadyDone = sourceRecord.canonical_source_status === 'direct_source_verified';
  const sourceExpectedPre = sourceRecord.canonical_source_status === 'needs_direct_source_check';

  if (!sourceAlreadyDone && !sourceExpectedPre) {
    throw new Error(
      'Precondition failed: source ' + TWN_TODDLER_SOURCE_ID +
      ' canonical_source_status="' + sourceRecord.canonical_source_status +
      '" is neither needs_direct_source_check (promotable) nor direct_source_verified (done). ' +
      'Refusing to promote a drifted source.',
    );
  }

  // Source-role / currentness gates that classifyCandidate also checks.
  const srcRole = sourceRecord.calculator_source_role ?? 'canonical_candidate';
  const allRoles = [srcRole];
  if (allRoles.includes('policy_compilation') || allRoles.includes('reference_mining')) {
    throw new Error(
      'Precondition failed: ' + TWN_TODDLER_SOURCE_ID + ' has a source role of ' +
      'policy_compilation/reference_mining (roles: ' + JSON.stringify(allRoles) + '). ' +
      'classifyCandidate would block such a record; refusing to promote.',
    );
  }
  if (
    sourceRecord.file_storage === 'repo_metadata_only' ||
    srcRole !== 'canonical_candidate' ||
    sourceRecord.currentness_status !== 'current'
  ) {
    throw new Error(
      'Precondition failed: source ' + TWN_TODDLER_SOURCE_ID +
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

/**
 * Computes the promotion plan and enforces ALL preconditions (fail-closed). Throws on any
 * precondition failure. Returns a plan object consumed by applyPromotion.
 */
// Read-only precondition for the HC PQRA v4.0 source the BW record relies on (per codex review
// 2026-06-14). Unlike the TWN source (which planSource UPGRADES needs_direct_source_check ->
// direct_source_verified), the HC source must ALREADY be direct_source_verified + direct-current
// eligible -- the BW promotion DEPENDS on it and does not upgrade it. If the HC source is missing or
// drifts out of direct-current status, the frame seed would stay blocked even after --apply stamps the
// BW value approved, leaving approved-but-not-source-backed provenance. Fail closed (read-only; throws).
function planBwSource(sources) {
  const hc = sources.find((s) => s.source_id === HC_PQRA_SOURCE_ID);
  if (!hc) {
    throw new Error(
      'Precondition failed: BW source record not found in sources.json: ' + HC_PQRA_SOURCE_ID +
      '. The BW record relies on the HC PQRA v4.0 source; refusing to promote without it.',
    );
  }
  if (hc.canonical_source_status !== 'direct_source_verified') {
    throw new Error(
      'Precondition failed: BW source ' + HC_PQRA_SOURCE_ID + ' canonical_source_status="' +
      hc.canonical_source_status + '" is not direct_source_verified. The BW promotion depends on the ' +
      'HC source already being verified (this helper does not upgrade it); refusing to promote a BW ' +
      'value whose source is not source-backed.',
    );
  }
  const hcRole = hc.calculator_source_role ?? 'canonical_candidate';
  if (
    hc.file_storage === 'repo_metadata_only' ||
    hcRole !== 'canonical_candidate' ||
    hc.currentness_status !== 'current'
  ) {
    throw new Error(
      'Precondition failed: BW source ' + HC_PQRA_SOURCE_ID + ' is not direct-current eligible ' +
      '(file_storage=' + JSON.stringify(hc.file_storage) + ', calculator_source_role=' +
      JSON.stringify(hcRole) + ', currentness_status=' + JSON.stringify(hc.currentness_status) +
      '). The frame seed requires the BW source to be direct/current; promoting the BW value would ' +
      'leave the scenario blocked (blocked_needs_qa). Refusing to promote.',
    );
  }
  return { sourceRecord: hc };
}

export function planPromotion(paramValues, sources, _opts) {
  const irPlan = planSingleValue(paramValues, TWN_TODDLER_IR_VALUE_ID);
  const bwPlan = planSingleValue(paramValues, TWN_TODDLER_BW_VALUE_ID);
  const srcPlan = planSource(sources);
  // Read-only: the BW record relies on the HC source being already verified + direct-current.
  planBwSource(sources);
  return {
    irRecord: irPlan.valueRecord,
    irAlreadyDone: irPlan.valueAlreadyDone,
    promoteIr: irPlan.promoteValue,
    bwRecord: bwPlan.valueRecord,
    bwAlreadyDone: bwPlan.valueAlreadyDone,
    promoteBw: bwPlan.promoteValue,
    sourceRecord: srcPlan.sourceRecord,
    sourceAlreadyDone: srcPlan.sourceAlreadyDone,
    promoteSource: srcPlan.promoteSource,
  };
}

// ---------------------------------------------------------------------------
// Evidence item rebuild
// ---------------------------------------------------------------------------

function approveEvidence(ev, reviewer, date) {
  const out = {};
  for (const [k, v] of Object.entries(ev)) {
    if (k === 'qa_status') {
      out.qa_status = 'approved';
      out.reviewed_by = reviewer;
      out.reviewed_at = date;
    } else if (k === 'reviewed_by' || k === 'reviewed_at') {
      continue;
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

const PROMOTION_STAMP_MARKER = 'PROMOTED to approved';
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

// Promote a single value record in-place. Returns {touched: boolean}.
function promoteSingleValue(valueRecord, alreadyDone, opts) {
  let touched = false;
  if (!alreadyDone) {
    valueRecord.qa_status = 'approved';
    valueRecord.evidence_support_status = 'approved_source_backed';
    valueRecord.canonical_source_status = 'direct_source_verified';
    valueRecord.evidence_items = valueRecord.evidence_items.map(
      (ev) => approveEvidence(ev, opts.reviewer, opts.date),
    );
    stampValueProvenance(valueRecord, opts.date, opts.reviewer);
    touched = true;
  } else {
    touched = stampValueProvenance(valueRecord, opts.date, opts.reviewer);
  }
  return { touched };
}

// ---------------------------------------------------------------------------
// Apply
// ---------------------------------------------------------------------------

export function applyPromotion(paramValues, sources, opts) {
  const plan = planPromotion(paramValues, sources, opts);

  const irResult = promoteSingleValue(plan.irRecord, plan.irAlreadyDone, opts);
  const bwResult = promoteSingleValue(plan.bwRecord, plan.bwAlreadyDone, opts);
  plan.irTouched = irResult.touched;
  plan.bwTouched = bwResult.touched;

  // Apply owner-provided locator(s) even if the source is already verified.
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
  ' promote-twn-foodweb-toddler.mjs -- TWN BIWQO 2021 toddler subsistence food-web promotion',
  '=============================================================================',
  '',
  'MIXED-SOURCE receptor: IR=TWN BIWQO 2021, BW=HC PQRA v4.0 (standard Canadian toddler value).',
  '  TWN only tabulates an ADULT body weight (76.5 kg); 16.5 kg is the standard HC value.',
  '',
  'OWNER VERIFICATION REQUIRED before --apply:',
  '  File the TWN BIWQO 2021 PDF (open gov.bc.ca URL) in the reference library + Zotero.',
  '  Verify the toddler fish-ingestion rate (IR_food = 94 g/day = 0.094 kg/day) against Table 1.',
  '  The 16.5 kg BW is the standard HC PQRA v4.0 Appendix E value (already verified 2026-06-12);',
  '  no separate TWN primary verification is needed for the BW value.',
  '  Running --apply attests to the TWN IR_food verification.',
  '',
  'DURABLE LOCATOR (for the TWN source only):',
  '  Provide --source-url and/or --zotero-key to satisfy the TWN source provenance guard.',
  '  Optional provenance strengthening:',
  '    --zotero-key "<Zotero item key>"  link the Zotero record when you file the document',
  '    --source-url "<url>"              set or override the stored TWN source URL',
  '  (Fail-closed guard: --apply fails ONLY if the TWN source row has NEITHER url nor key.)',
  '  HC PQRA v4.0 source (src-health-canada-pqra-v4-2024) is already verified; no locator needed.',
  '',
  'SCOPE: only the two TWN toddler food-web value records + the TWN BIWQO 2021 source are promoted.',
  '  HC PQRA v4.0 source is ALREADY direct_source_verified and is NOT touched by this tool.',
  '  Other TWN or food-web rows are not touched.',
  '  default_status is NOT changed (stays available_option).',
  '  The FRAME_DEFAULT_PROFILES row is the owner activation step, not this tool.',
  '',
].join('\n');

const HELP = [
  'promote-twn-foodweb-toddler.mjs -- TWN BIWQO 2021 toddler subsistence food-web promotion tool.',
  '',
  'Mixed-source receptor: IR=TWN BIWQO 2021 (94 g/day), BW=HC PQRA v4.0 (16.5 kg Appendix E).',
  '  TWN only tabulates an adult BW (76.5 kg); the 16.5 kg is the standard HC PQRA v4.0 value.',
  '',
  'Usage:',
  '  node scripts/matrix-options/promote-twn-foodweb-toddler.mjs --reviewer "<id>" --date YYYY-MM-DD [--apply]',
  '    [--source-url "<url>"] [--zotero-key "<key>"]',
  '',
  'Options:',
  '  --reviewer "<id>"        Reviewer attestation -> evidence.reviewed_by (required for --apply)',
  '  --date YYYY-MM-DD        Review date -> evidence.reviewed_at (required for --apply)',
  '  --source-url "<url>"     URL to the TWN primary document (set on the TWN source row).',
  '  --zotero-key "<key>"     Zotero item key. Sets zotero_item_key and zotero_status=linked on TWN source.',
  '  --apply                  Write both catalog files (default is a dry run that writes nothing)',
  '',
  'Targets:',
  '  VALUE (IR) : pv-twn-biwqo-2021-ir-food-toddler-bc    (parameter_values.json; sourced to TWN)',
  '  VALUE (BW) : pv-hc-pqra-v4-2024-bw-toddler-food-bc   (parameter_values.json; sourced to HC)',
  '  SOURCE     : src-bc-twn-burrard-inlet-wqo-tissue-2021  (sources.json; TWN source only)',
  '  NOTE       : src-health-canada-pqra-v4-2024 is NOT touched (already direct_source_verified)',
  '',
  'On --apply, VALUE (IR) record changes:',
  '  qa_status                 needs_review -> approved',
  '  evidence_support_status   pending_source_locator -> approved_source_backed',
  '  canonical_source_status   needs_direct_source_check -> direct_source_verified',
  '  evidence_items[*].qa_status needs_review -> approved (+ reviewed_by/at after qa_status)',
  '  default_status            UNCHANGED (stays available_option)',
  '',
  'On --apply, VALUE (BW) record changes:',
  '  qa_status                 needs_review -> approved',
  '  evidence_support_status   pending_source_locator -> approved_source_backed',
  '  canonical_source_status   needs_direct_source_check -> direct_source_verified',
  '  evidence_items[*].qa_status needs_review -> approved (+ reviewed_by/at after qa_status)',
  '  default_status            UNCHANGED (stays available_option)',
  '',
  'On --apply, SOURCE (TWN) record changes:',
  '  canonical_source_status   needs_direct_source_check -> direct_source_verified',
  '  url                       set from --source-url (if provided)',
  '  zotero_item_key           set from --zotero-key (if provided)',
  '  zotero_status             set to "linked" when --zotero-key is provided',
  '',
  'AI never runs this with --apply. The owner runs it; --reviewer/--date are the HITL attestation.',
  'After --apply: npx tsc --noEmit; npm run lint; npm run test:ci',
].join('\n');

function printPlan(plan, opts) {
  if (plan.promoteIr) {
    console.log('  VALUE (IR)   PROMOTE  ' + TWN_TODDLER_IR_VALUE_ID);
    console.log('    qa_status               : needs_review -> approved');
    console.log('    evidence_support_status : pending_source_locator -> approved_source_backed');
    console.log('    canonical_source_status : needs_direct_source_check -> direct_source_verified');
    console.log('    default_status          : available_option (UNCHANGED)');
    console.log('    source                  : ' + TWN_TODDLER_SOURCE_ID + ' (TWN)');
    console.log('      reviewer              : ' + (opts.reviewer || '(not set)'));
    console.log('      date                  : ' + (opts.date || '(not set)'));
  } else {
    console.log('  VALUE (IR)   SKIP     ' + TWN_TODDLER_IR_VALUE_ID + ': already in target state (no-op)');
  }
  if (plan.promoteBw) {
    console.log('  VALUE (BW)   PROMOTE  ' + TWN_TODDLER_BW_VALUE_ID);
    console.log('    qa_status               : needs_review -> approved');
    console.log('    evidence_support_status : pending_source_locator -> approved_source_backed');
    console.log('    canonical_source_status : needs_direct_source_check -> direct_source_verified');
    console.log('    default_status          : available_option (UNCHANGED)');
    console.log('    source                  : ' + HC_PQRA_SOURCE_ID + ' (HC PQRA v4.0)');
    console.log('      reviewer              : ' + (opts.reviewer || '(not set)'));
    console.log('      date                  : ' + (opts.date || '(not set)'));
  } else {
    console.log('  VALUE (BW)   SKIP     ' + TWN_TODDLER_BW_VALUE_ID + ': already in target state (no-op)');
  }
  if (plan.promoteSource) {
    console.log('  SOURCE  PROMOTE  ' + TWN_TODDLER_SOURCE_ID);
    console.log('    canonical_source_status : ' + plan.sourceRecord.canonical_source_status +
      ' -> direct_source_verified');
    console.log('    url                     : ' +
      (opts.sourceUrl || plan.sourceRecord.url || '(none -- REQUIRED: provide --source-url or --zotero-key)'));
    if (opts.zoteroKey) {
      console.log('    zotero_status           : linked (set from --zotero-key)');
    }
  } else {
    console.log('  SOURCE  SKIP     ' + TWN_TODDLER_SOURCE_ID + ': already in target state (no-op)');
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
    (plan.promoteIr ? 1 : 0) + (plan.promoteBw ? 1 : 0) + (plan.promoteSource ? 1 : 0);
  const totalSkipped =
    (plan.irAlreadyDone ? 1 : 0) + (plan.bwAlreadyDone ? 1 : 0) + (plan.sourceAlreadyDone ? 1 : 0);
  console.log('Summary: ' + totalToPromote + ' record(s) to promote, ' +
    totalSkipped + ' already in target state.');

  if (!opts.apply) {
    console.log('');
    console.log('DRY RUN -- no file written. Re-run with --apply (plus --reviewer/--date) to write.');
    return;
  }

  validateApplyOptions(opts);

  // Fail-closed provenance guard: a value approved against a direct_source_verified source
  // requires that source to have a durable locator.
  const sourceWillBeVerified = plan.promoteSource || plan.sourceAlreadyDone;
  const effUrl = opts.sourceUrl || plan.sourceRecord.url;
  const effKey = opts.zoteroKey || plan.sourceRecord.zotero_item_key;
  if (sourceWillBeVerified && !effUrl && !effKey) {
    throw new Error(
      'Provenance guard: the TWN toddler value records would be approved against source ' +
      TWN_TODDLER_SOURCE_ID + ' (direct_source_verified), but that source has no durable' +
      ' locator (url=null, zotero_item_key=null).\n' +
      'Provide --source-url "<url>" and/or --zotero-key "<Zotero item key>"' +
      ' so the primary document is reproducibly locatable.',
    );
  }

  const locatorWouldChange =
    (Boolean(opts.sourceUrl) && plan.sourceRecord.url !== opts.sourceUrl) ||
    (Boolean(opts.zoteroKey) && plan.sourceRecord.zotero_item_key !== opts.zoteroKey) ||
    (Boolean(opts.zoteroKey) && plan.sourceRecord.zotero_status !== 'linked');
  const irStampRepair = plan.irAlreadyDone && valueStampRepairNeeded(plan.irRecord);
  const bwStampRepair = plan.bwAlreadyDone && valueStampRepairNeeded(plan.bwRecord);

  if (totalToPromote === 0 && !locatorWouldChange && !irStampRepair && !bwStampRepair) {
    console.log('');
    console.log('Nothing to promote (all records already in target state). No write.');
    return;
  }

  const applied = applyPromotion(paramValues, sources, opts);

  if (applied.promoteIr || applied.irTouched || applied.promoteBw || applied.bwTouched) {
    fs.writeFileSync(PARAM_VALUES_FILE, JSON.stringify(paramValues, null, 2) + '\n', 'utf8');
    console.log('WROTE ' + PARAM_VALUES_FILE);
  }
  if (applied.promoteSource || applied.sourceTouched) {
    fs.writeFileSync(SOURCES_FILE, JSON.stringify(sources, null, 2) + '\n', 'utf8');
    console.log('WROTE ' + SOURCES_FILE);
  }

  if (applied.promoteIr || applied.promoteBw) {
    console.log('');
    console.log('REQUIRED before test:ci -- promoting these records shifts the audit-count guards.');
    console.log('  Update src/lib/matrix-options/provenance/__tests__/library.test.ts in the SAME commit:');
    console.log('    audit.values.approvedSourceBacked : +2 (both IR and BW move to approved_source_backed)');
    console.log('    audit.values.pendingSourceLocator : -2 (both IR and BW leave pending_source_locator)');
    console.log('    view.valueGroups: +0 (both use existing BC candidate_group_id slots)');
    console.log('    view.audit.values.availableOptions: +0 (default_status unchanged)');
    console.log('  Run npm run test:ci and bump to match the FAILING assertion (do not hard-set).');
  }

  console.log('');
  console.log('Next: run the local gates:');
  console.log('  npx tsc --noEmit; npm run lint; npm run test:ci;');
  console.log('  npm run build:monitored:clean -- -TimeoutSeconds 360 -PollSeconds 10;');
  console.log('  npm run test:e2e');
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : '';
if (invokedPath === fileURLToPath(import.meta.url)) {
  main();
}
