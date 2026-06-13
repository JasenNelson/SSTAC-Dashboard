// Owner-run promotion helper for the BC WLRS fish-ingestion-rate default seed. Plain ASCII only.
//
// WHY THIS EXISTS
// The Phase C "C-BC" BC-frame default for the human-health food pathway (IR_food_kg_per_day)
// must seed from an approved, direct-source-verified catalog record. The BC WLRS 2023 recreational
// fisher rate (0.111 kg/day) is the provincially endorsed general-public receptor value and the
// correct BC-frame default candidate. This tool performs the exact, coupled promotion of EXACTLY
// the recreational-fisher VALUE record and its WLRS SOURCE record, fails closed on any
// precondition, and is idempotent.
//
// This helper was hardened to match promote-epa-ir-food.mjs (the later C-nonBC precedent), whose
// adversarial review surfaced the fail-closed gaps backported here: (a) main() now reads the plan
// RETURNED by applyPromotion (so a locator-only re-run actually writes); (b) the source-eligibility
// precondition now mirrors classifyCandidate / isDirectCurrentSource (source-role block + direct-
// current source check + exactly-one linked source); plus evidence-state coherence and a display-
// stamp REPAIR path (covers the applicability field, which the Evidence Library renders verbatim).
// NOTE: porting the repair CAPABILITY does not itself change any catalog record. The live WLRS
// record's applicability string is repaired only when the OWNER runs this with --apply (its own
// commit), exactly as the EPA flow landed the owner's --apply diff separately (#294).
//
// LOAD-BEARING RULES honored:
//  - AI NEVER writes qa_status. This tool is run BY THE OWNER; --reviewer/--date are the owner's
//    HITL attestation. Author + dry-run only for AI.
//  - OWNER VERIFICATION REQUIRED (rule 1): Before running with --apply, the OWNER must verify the
//    WLRS recreational rate (0.111 kg/day) against the primary BC WLRS 2023 PDF ("Derivation of
//    Screening Values for Contaminants in Fish Tissue", ISBN 978-1-0399-0019-6) and file that PDF
//    in the reference library + Zotero. Running with --apply attests to that verification.
//  - SCOPE (rule 2): only the recreational-fisher record is promoted as the BC default candidate.
//    The subsistence and low-level WLRS rows remain qa_status=needs_review as alternatives.
//    default_status is NEVER modified (stays 'available_option'); the owner's FRAME_DEFAULT_PROFILES
//    row is the activation step, not this tool.
//  - AFTER --apply (rule 3): run npx tsc --noEmit; npm run lint; npm run test:ci.
//
// USAGE (run from anywhere; paths resolve from the script location):
//   node scripts/matrix-options/promote-wlrs-default.mjs --reviewer "J. Nelson" --date 2026-06-09
//   node scripts/matrix-options/promote-wlrs-default.mjs --reviewer "J. Nelson" --date 2026-06-09 --apply
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
export const WLRS_PROMOTION_VALUE_ID = 'pv-wlrs-2023-ir-food-recreational-bc';
export const WLRS_PROMOTION_SOURCE_ID = 'src-bc-wlrs-fish-tissue-screening-2023';

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

// Computes the promotion plan and enforces ALL preconditions (fail-closed). Throws on:
//  - a missing target record (id not found in the catalog)
//  - a value record in an unexpected qa_status (neither needs_review nor approved)
//  - a value record with no evidence_items
//  - a source record in an unexpected canonical_source_status / not direct-current eligible
// Records already in their target state are SKIPPED (idempotent no-op), never re-stamped.
export function planPromotion(paramValues, sources, _opts) {
  // -- VALUE record --
  const valueRecord = paramValues.find(
    (r) => r.parameter_value_id === WLRS_PROMOTION_VALUE_ID,
  );
  if (!valueRecord) {
    throw new Error(
      'Precondition failed: value record not found in parameter_values.json: ' +
      WLRS_PROMOTION_VALUE_ID,
    );
  }
  if (!Array.isArray(valueRecord.evidence_items) || valueRecord.evidence_items.length === 0) {
    throw new Error(
      'Precondition failed: ' + WLRS_PROMOTION_VALUE_ID + ' has no evidence_items',
    );
  }
  // Fail-closed IDENTITY check: only ever promote the EXACT intended WLRS recreational
  // record in its frame-eligible shape. Promoting the status fields on a record whose
  // jurisdiction/candidate_group/value/unit are wrong would "succeed" yet still be BLOCKED
  // by getFrameSeedCandidateEligibility (notably jurisdiction "BC_provincial" is not
  // admitted by bc-protocol1-v5-dra), so the promotion would be a silent no-seed.
  // Cover EVERY scalar field that getFrameSeedCandidateEligibility / classifyCandidate
  // examine, so the helper cannot "succeed" on a record that would still be blocked.
  const EXPECTED_VALUE = {
    jurisdiction: 'BC',
    candidate_group_id: 'human-health-food__generic__IR_food_kg_per_day__BC',
    pathway: 'human-health-food',
    input_key: 'IR_food_kg_per_day',
    substance_key: 'generic',
    value: 0.111,
    unit: 'kg/day',
    value_type: 'single_value', // classifyCandidate blocks non-single_value (blocked_range_or_formula)
    default_status: 'available_option', // not_default would be blocked_not_default
  };
  const identityMismatch = Object.entries(EXPECTED_VALUE).filter(
    ([k, v]) => valueRecord[k] !== v,
  );
  if (identityMismatch.length > 0) {
    throw new Error(
      'Precondition failed: ' + WLRS_PROMOTION_VALUE_ID +
      ' is not in the expected frame-eligible identity. Mismatched field(s):\n' +
      identityMismatch
        .map(([k, v]) => '  ' + k + ': expected ' + JSON.stringify(v) +
          ', actual ' + JSON.stringify(valueRecord[k]))
        .join('\n') +
      '\n(jurisdiction must be "BC" -- a "BC_provincial" row is not admitted by the ' +
      'bc-protocol1-v5-dra frame and could not seed C-BC; ensure PR #283 is merged.)\n' +
      'Refusing to promote a record that cannot seed the BC frame.',
    );
  }
  // source_ids must be EXACTLY [WLRS source]. classifyCandidate derives sourceRoles from EVERY
  // source_id (not just the one this helper hard-codes), so a SECOND linked source carrying a
  // policy_compilation / reference_mining role -- one not also listed in source_relationships --
  // would be blocked by the real frame-default pipeline yet slip past a mere "includes" check.
  // Requiring exactly one source (the WLRS source) keeps this helper genuinely fail-closed: the one
  // source it inspects IS the complete linked-source set. A row that legitimately gains a second
  // source must be re-evaluated (and this helper updated), not silently promoted.
  if (!Array.isArray(valueRecord.source_ids) ||
      valueRecord.source_ids.length !== 1 ||
      valueRecord.source_ids[0] !== WLRS_PROMOTION_SOURCE_ID) {
    throw new Error(
      'Precondition failed: ' + WLRS_PROMOTION_VALUE_ID + ' source_ids must be EXACTLY ["' +
      WLRS_PROMOTION_SOURCE_ID + '"] (actual: ' + JSON.stringify(valueRecord.source_ids) +
      '). A second linked source could carry a policy_compilation/reference_mining role that ' +
      'classifyCandidate would block but this single-source helper would miss. Refusing to promote.',
    );
  }
  // Fail-closed: accept ONLY the exact documented pre-promotion state or the exact
  // already-promoted state. A record drifted to any other combination is NOT silently
  // promoted -- it is rejected so a malformed catalog row cannot be approved.
  // The evidence items must move WITH the top-level statuses. A record whose top-level statuses are
  // promoted but whose evidence_items still hold needs_review (or vice versa) is a partially-promoted
  // DRIFT: classifying it as already-done would skip approveEvidence() and leave the Evidence Library
  // rendering stale evidence QA. So the already-done / expected-pre states require the evidence items
  // to agree, and any mixed state is rejected (fail-closed) rather than silently treated as a no-op.
  // Attestation guard (uniform backport 2026-06-13): an approved evidence item MUST carry the owner
  // attestation (reviewed_by + reviewed_at); an approved-but-unattested item is NOT counted approved
  // here, so the record fails closed (drift) rather than being silently skipped as already-done.
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
      'Precondition failed: ' + WLRS_PROMOTION_VALUE_ID +
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

  // -- SOURCE record --
  const sourceRecord = sources.find(
    (s) => s.source_id === WLRS_PROMOTION_SOURCE_ID,
  );
  if (!sourceRecord) {
    throw new Error(
      'Precondition failed: source record not found in sources.json: ' +
      WLRS_PROMOTION_SOURCE_ID,
    );
  }
  // Fail-closed: promote the source ONLY from the exact expected pre-state; reject any
  // other (e.g. not_applicable, needs_exact_source_locator) so a drifted source cannot
  // be overwritten to direct_source_verified.
  const sourceAlreadyDone =
    sourceRecord.canonical_source_status === 'direct_source_verified';
  const sourceExpectedPre =
    sourceRecord.canonical_source_status === 'needs_direct_source_check';

  if (!sourceAlreadyDone && !sourceExpectedPre) {
    throw new Error(
      'Precondition failed: source ' + WLRS_PROMOTION_SOURCE_ID +
      ' canonical_source_status="' + sourceRecord.canonical_source_status +
      '" is neither needs_direct_source_check (promotable) nor direct_source_verified (done). ' +
      'Refusing to promote a drifted source.',
    );
  }

  // Fail-closed on the SAME source-role / currentness fields that classifyCandidate
  // (defaultSelectionPolicy.ts) examines, so the helper cannot stamp a record approved that
  // getFrameSeedCandidateEligibility would still BLOCK. Mirrors:
  //  - the policy_compilation / reference_mining role blocks (classifyCandidate uses the UNION of
  //    the source's calculator_source_role and the value record's source_relationships roles), and
  //  - isDirectCurrentSource (file_storage != repo_metadata_only, role canonical_candidate,
  //    currentness_status current; canonical_source_status direct_source_verified is set by this
  //    promotion). With exactly one linked source, "some source isDirectCurrentSource" == this one.
  const srcRole = sourceRecord.calculator_source_role ?? 'canonical_candidate';
  const relationshipRoles = Array.isArray(valueRecord.source_relationships)
    ? valueRecord.source_relationships.map((r) => (r ? r.role : null))
    : [];
  const allRoles = [srcRole, ...relationshipRoles];
  if (allRoles.includes('policy_compilation') || allRoles.includes('reference_mining')) {
    throw new Error(
      'Precondition failed: ' + WLRS_PROMOTION_VALUE_ID + ' has a source role of ' +
      'policy_compilation/reference_mining (roles: ' + JSON.stringify(allRoles) + '). ' +
      'classifyCandidate would block such a record (blocked_policy_compilation / ' +
      'blocked_reference_mining); refusing to promote a record the frame-default pipeline blocks.',
    );
  }
  if (
    sourceRecord.file_storage === 'repo_metadata_only' ||
    srcRole !== 'canonical_candidate' ||
    sourceRecord.currentness_status !== 'current'
  ) {
    throw new Error(
      'Precondition failed: source ' + WLRS_PROMOTION_SOURCE_ID +
      ' is not direct-current eligible. isDirectCurrentSource requires file_storage != ' +
      'repo_metadata_only, calculator_source_role = canonical_candidate, currentness_status = ' +
      'current. Actual: file_storage=' + JSON.stringify(sourceRecord.file_storage) +
      ', calculator_source_role=' + JSON.stringify(srcRole) +
      ', currentness_status=' + JSON.stringify(sourceRecord.currentness_status) + '. ' +
      'Promoting it to direct_source_verified would still leave the frame default blocked (blocked_needs_qa).',
    );
  }

  return {
    valueRecord,
    sourceRecord,
    valueAlreadyDone,
    sourceAlreadyDone,
    promoteValue: !valueAlreadyDone,
    promoteSource: !sourceAlreadyDone,
  };
}

// ---------------------------------------------------------------------------
// Evidence item rebuild (mirrors apply-qa-promotion.mjs approveEvidence exactly)
// ---------------------------------------------------------------------------

// Rebuilds an evidence object with qa_status='approved' and reviewed_by/reviewed_at inserted
// immediately AFTER qa_status (the canonical position used by the existing approved batch),
// preserving all other keys in their original order and de-duplicating any pre-existing
// reviewed_* keys.
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
    // Evidence had no qa_status field (not expected for catalog rows); add the full set.
    out.qa_status = 'approved';
    out.reviewed_by = reviewer;
    out.reviewed_at = date;
  }
  return out;
}

// Marker substring used to detect an ALREADY-stamped provenance field (idempotency). Any field whose
// text already contains this is left untouched so reruns never double-stamp.
const PROMOTION_STAMP_MARKER = 'PROMOTED to approved';

// The human-readable provenance fields the Evidence Library renders directly. After promotion each
// must not keep stale "needs_review / pending" language on a now-approved record (applicability is
// rendered verbatim by EvidenceLibrary; uncertainty / review_notes likewise). Kept in one place so
// the fresh-promotion path and the repair path stamp the SAME set.
const STAMPED_PROVENANCE_FIELDS = ['applicability', 'uncertainty', 'review_notes'];

function buildValueStamp(date, reviewer) {
  return (
    ' [PROMOTED to approved (evidence approved_source_backed, source direct_source_verified) on ' +
    date + ' by ' + reviewer + '; the pending / needs_review language above is superseded.]'
  );
}

// Append the promotion stamp to each STAMPED_PROVENANCE_FIELDS entry that is a non-empty string and
// not already stamped (idempotent). Returns true if any field changed. Used both on fresh promotion
// and as a display-stamp REPAIR for an already-approved record that is missing a stamp (e.g. a field
// an earlier tool version did not cover).
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

// Would a display-stamp repair change the already-approved value record? (Mirrors stampValueProvenance
// without mutating, so main() can include it in the no-op / write decision before applyPromotion runs.)
function valueStampRepairNeeded(r) {
  return STAMPED_PROVENANCE_FIELDS.some(
    (field) =>
      typeof r[field] === 'string' &&
      r[field].length > 0 &&
      !r[field].includes(PROMOTION_STAMP_MARKER),
  );
}

// ---------------------------------------------------------------------------
// Apply (in-place mutation of the parsed records; ONLY the two target records are touched)
// ---------------------------------------------------------------------------

export function applyPromotion(paramValues, sources, opts) {
  const plan = planPromotion(paramValues, sources, opts);

  let valueTouched = false;
  if (plan.promoteValue) {
    const r = plan.valueRecord;
    r.qa_status = 'approved';
    r.evidence_support_status = 'approved_source_backed';
    r.canonical_source_status = 'direct_source_verified';
    // default_status is intentionally NOT modified (stays 'available_option').
    r.evidence_items = r.evidence_items.map((ev) => approveEvidence(ev, opts.reviewer, opts.date));
    // Stamp the human-readable provenance fields (applicability / uncertainty / review_notes) so the
    // Evidence Library, which renders them verbatim, does not show stale "pending / needs_review"
    // text on a now-approved record. Appended (not mangled), preserving the original extraction note.
    stampValueProvenance(r, opts.date, opts.reviewer);
  } else if (plan.valueAlreadyDone) {
    // Display-stamp REPAIR: an already-approved record may be missing a provenance stamp on a field an
    // earlier tool version did not cover (e.g. applicability). Append idempotently so an approved row
    // never renders a stale needs_review label. valueTouched drives the param_values write in main().
    valueTouched = stampValueProvenance(plan.valueRecord, opts.date, opts.reviewer);
  }
  plan.valueTouched = valueTouched;

  // Apply owner-provided locator(s) even if the source is ALREADY verified, so an
  // already-verified-but-unlocatable source (e.g. from a prior partial run) can still be
  // made locatable. sourceTouched drives the write decision in main().
  let sourceTouched = false;
  if (opts.sourceUrl && plan.sourceRecord.url !== opts.sourceUrl) {
    plan.sourceRecord.url = opts.sourceUrl;
    sourceTouched = true;
  }
  if (opts.zoteroKey) {
    // Set the key if it changed, AND independently repair a stale zotero_status -- a prior partial
    // run may have written the same key but left zotero_status at e.g. pending_owner_export. Mirror
    // the url branch's locator-only repair so a status-only fix is not silently dropped as a no-op.
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
    // Stamp the rendered source note so the Evidence Library does not show "needs_review
    // pending direct-source verification" on a now-verified source (appended, not mangled).
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
  '=========================================================================',
  ' promote-wlrs-default.mjs -- owner-run WLRS fish-ingestion-rate promotion',
  '=========================================================================',
  '',
  'OWNER VERIFICATION REQUIRED before --apply:',
  '  Verify the WLRS recreational rate (0.111 kg/day = 111 g/day) against the',
  '  primary BC WLRS 2023 PDF (ISBN 978-1-0399-0019-6, Table 2, adult recreational',
  '  fisher). File the PDF in the reference library + Zotero before running --apply.',
  '  Running --apply attests to that verification.',
  '',
  'DURABLE LOCATOR (already on file -- the fail-closed guard below will NOT fire):',
  '  The committed source row ALREADY has the primary BC WLRS 2023 PDF URL (gov.bc.ca),',
  '  so --apply satisfies the provenance guard as-is and will NOT fail for lack of a',
  '  locator. The Zotero item key is still pending (zotero_status=pending_owner_export).',
  '  Optional provenance strengthening:',
  '    --zotero-key "<Zotero item key>"  link the Zotero record when you file the PDF',
  '    --source-url "<gov.bc.ca URL>"    override the stored URL only if it changed',
  '  (Fail-closed guard: --apply fails ONLY if the source row has NEITHER url nor key.)',
  '',
  'SCOPE: only the recreational-fisher value + its WLRS source are promoted.',
  '  Subsistence and low-level WLRS rows stay needs_review as alternatives.',
  '  default_status is NOT changed (stays available_option).',
  '  The FRAME_DEFAULT_PROFILES row is the owner activation step, not this tool.',
  '',
].join('\n');

const HELP = [
  'promote-wlrs-default.mjs -- owner-run BC WLRS fish-ingestion-rate promotion tool.',
  '',
  'Usage:',
  '  node scripts/matrix-options/promote-wlrs-default.mjs --reviewer "<id>" --date YYYY-MM-DD [--apply]',
  '    [--source-url "<url>"] [--zotero-key "<key>"]',
  '',
  'Options:',
  '  --reviewer "<id>"        Reviewer attestation -> evidence.reviewed_by (required for --apply)',
  '  --date YYYY-MM-DD        Review date -> evidence.reviewed_at (required for --apply)',
  '  --source-url "<url>"     URL to the primary PDF (e.g. gov.bc.ca download link).',
  '                           Set on the source row when --apply writes sources.json.',
  '  --zotero-key "<key>"     Zotero item key (e.g. ABCD1234; right-click item in Zotero).',
  '                           Sets zotero_item_key and zotero_status=linked on the source row.',
  '  --apply                  Write both catalog files (default is a dry run that writes nothing)',
  '',
  'DURABLE LOCATOR (already on file):',
  '  The committed source row ALREADY has the primary BC WLRS 2023 PDF URL (gov.bc.ca),',
  '  so the fail-closed provenance guard is satisfied and --apply will NOT fail for lack',
  '  of a locator. --source-url / --zotero-key are OPTIONAL: pass --zotero-key to link',
  '  the Zotero record (still pending), or --source-url to override the stored URL.',
  '  (The guard fails --apply ONLY when the source row has NEITHER url nor zotero key.)',
  '',
  'Targets:',
  '  VALUE : pv-wlrs-2023-ir-food-recreational-bc  (parameter_values.json)',
  '  SOURCE: src-bc-wlrs-fish-tissue-screening-2023 (sources.json)',
  '',
  'On --apply, VALUE record changes:',
  '  qa_status                 needs_review -> approved',
  '  evidence_support_status   pending_source_locator -> approved_source_backed',
  '  canonical_source_status   needs_direct_source_check -> direct_source_verified',
  '  evidence_items[*].qa_status needs_review -> approved (+ reviewed_by/at after qa_status)',
  '  default_status            UNCHANGED (stays available_option)',
  '',
  'On --apply, SOURCE record changes:',
  '  canonical_source_status   needs_direct_source_check -> direct_source_verified',
  '  url                       set from --source-url (if provided)',
  '  zotero_item_key           set from --zotero-key (if provided)',
  '  zotero_status             set to "linked" when --zotero-key is provided',
  '',
  'AI never runs this with --apply. The owner runs it; --reviewer/--date are the HITL attestation.',
  'After --apply: npx tsc --noEmit; npm run lint; npm run test:ci',
].join('\n');

function printPlan(plan, opts) {
  if (plan.promoteValue) {
    const r = plan.valueRecord;
    console.log('  VALUE   PROMOTE  ' + WLRS_PROMOTION_VALUE_ID);
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
    console.log('  VALUE   SKIP     ' + WLRS_PROMOTION_VALUE_ID + ': already in target state (no-op)');
  }

  if (plan.promoteSource) {
    const s = plan.sourceRecord;
    console.log('  SOURCE  PROMOTE  ' + WLRS_PROMOTION_SOURCE_ID);
    console.log('    canonical_source_status : ' + s.canonical_source_status +
      ' -> direct_source_verified');
    console.log('    url                     : ' +
      (opts.sourceUrl || s.url || '(none -- REQUIRED: provide --source-url or --zotero-key)'));
    console.log('    zotero_item_key         : ' +
      (opts.zoteroKey || s.zotero_item_key || '(none)'));
    if (opts.zoteroKey) {
      console.log('    zotero_status           : linked (set from --zotero-key)');
    }
  } else {
    console.log('  SOURCE  SKIP     ' + WLRS_PROMOTION_SOURCE_ID +
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

  // Plan first (enforces every precondition before any write).
  const plan = planPromotion(paramValues, sources, opts);

  console.log('Before/after plan:');
  printPlan(plan, opts);
  console.log('');

  const totalToPromote = (plan.promoteValue ? 1 : 0) + (plan.promoteSource ? 1 : 0);
  const totalSkipped = (plan.valueAlreadyDone ? 1 : 0) + (plan.sourceAlreadyDone ? 1 : 0);
  console.log('Summary: ' + totalToPromote + ' record(s) to promote, ' +
    totalSkipped + ' already in target state.');

  // Surface a pending display-stamp repair so a "0 to promote" rerun is not mistaken for a no-op.
  if (plan.valueAlreadyDone && valueStampRepairNeeded(plan.valueRecord)) {
    console.log('NOTE: an already-approved record is MISSING a promotion display-stamp on one of ' +
      '{applicability, uncertainty, review_notes}; --apply will repair it (writes parameter_values.json).');
  }

  if (!opts.apply) {
    console.log('');
    console.log('DRY RUN -- no file written. Re-run with --apply (plus --reviewer/--date) to write.');
    return;
  }

  // Writing requires the full owner attestation.
  validateApplyOptions(opts);

  // Fail-closed provenance guard: a value approved against a direct_source_verified source
  // requires that source to have a durable locator. Fires whether the source is newly
  // promoted OR was ALREADY verified (closes the edge case where a prior partial run left
  // the source verified-but-unlocatable). Effective locator accounts for --source-url/--zotero-key.
  const sourceWillBeVerified = plan.promoteSource || plan.sourceAlreadyDone;
  const valueWillBeApproved = plan.promoteValue || plan.valueAlreadyDone;
  const effUrl = opts.sourceUrl || plan.sourceRecord.url;
  const effKey = opts.zoteroKey || plan.sourceRecord.zotero_item_key;
  if (valueWillBeApproved && sourceWillBeVerified && !effUrl && !effKey) {
    throw new Error(
      'Provenance guard: ' + WLRS_PROMOTION_VALUE_ID + ' would be approved against source ' +
      WLRS_PROMOTION_SOURCE_ID + ' (direct_source_verified), but that source has no durable' +
      ' locator (url=null, zotero_item_key=null).\n' +
      'Provide --source-url "<gov.bc.ca URL>" and/or --zotero-key "<Zotero item key>"' +
      ' (set when you file the PDF in Zotero) so the primary PDF is reproducibly locatable.',
    );
  }

  // A locator-only change (owner adds a locator to an already-verified source) is also work.
  // Includes a Zotero status-only repair (key already set but zotero_status stale), mirroring the
  // applyPromotion zotero branch so it is not dropped by the early-return below.
  const locatorWouldChange =
    (Boolean(opts.sourceUrl) && plan.sourceRecord.url !== opts.sourceUrl) ||
    (Boolean(opts.zoteroKey) && plan.sourceRecord.zotero_item_key !== opts.zoteroKey) ||
    (Boolean(opts.zoteroKey) && plan.sourceRecord.zotero_status !== 'linked');
  // A display-stamp repair (already-approved value record missing a provenance stamp, e.g. a stale
  // needs_review applicability string) is also work even when nothing is promoted.
  const stampRepairWouldChange = plan.valueAlreadyDone && valueStampRepairNeeded(plan.valueRecord);
  if (totalToPromote === 0 && !locatorWouldChange && !stampRepairWouldChange) {
    console.log('');
    console.log('Nothing to promote (both records already in target state). No write.');
    return;
  }

  // Capture the applied plan: applyPromotion computes its OWN plan internally and is the only
  // object that carries valueTouched / sourceTouched (the stamp-repair + locator-only write signals).
  // main's outer `plan` never gets those flags, so the write decision MUST read the returned object --
  // otherwise a locator-only update (both records already promoted, only the url/zotero key changing)
  // or a display-stamp repair mutates the in-memory records but never writes the file.
  const applied = applyPromotion(paramValues, sources, opts);

  if (applied.promoteValue || applied.valueTouched) {
    fs.writeFileSync(PARAM_VALUES_FILE, JSON.stringify(paramValues, null, 2) + '\n', 'utf8');
    console.log('WROTE ' + PARAM_VALUES_FILE);
  }
  if (applied.promoteSource || applied.sourceTouched) {
    fs.writeFileSync(SOURCES_FILE, JSON.stringify(sources, null, 2) + '\n', 'utf8');
    console.log('WROTE ' + SOURCES_FILE);
  }

  if (applied.promoteValue) {
    console.log('');
    console.log('REQUIRED before test:ci -- promoting this record shifts the audit-count guards.');
    console.log('  Update src/lib/matrix-options/provenance/__tests__/library.test.ts in the SAME commit:');
    console.log('    audit.values.approvedSourceBacked : +1 (this record moves to approved_source_backed)');
    console.log('    audit.values.pendingSourceLocator : -1 (it leaves pending_source_locator)');
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
