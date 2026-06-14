// Owner-run promotion helper for the US EPA adult body-weight default seed. Plain ASCII only.
//
// WHY THIS EXISTS
// The Phase C "C-4" US-EPA-frame default for the human-health food pathway adds a SECOND seed --
// adult body weight (BW_kg) -- alongside the general-population fish-ingestion rate, mirroring the
// C-3 BC body-weight seed on the other frame. The US EPA 2000 AWQC default adult body weight
// (70 kg, EPA-822-B-00-004, equation parameter key Ch.1 p.1-9 + Section 4.3.1.1 p.4-19) is the
// matching receptor body weight for the 0.0175 kg/day (17.5 g/day) ingestion rate already seeded
// -- both from the SAME document, so the receptor is internally consistent. This tool promotes
// EXACTLY the EPA adult-body-weight VALUE record, fails closed on any precondition, and is idempotent.
//
// It mirrors promote-wlrs-bw-default.mjs re-scoped to the EPA records. The SAME EPA source backs
// both the IR and BW records and was already promoted to direct_source_verified by the IR
// promotion (#294) -- so this helper typically promotes ONLY the value record (the source is a
// no-op skip).
//
// LOAD-BEARING RULES honored:
//  - AI NEVER writes qa_status. This tool is run BY THE OWNER; --reviewer/--date are the owner's
//    HITL attestation. Author + dry-run only for AI.
//  - OWNER VERIFICATION REQUIRED (rule 1): Before running with --apply, the OWNER must verify the
//    EPA adult body weight (70 kg) against the primary US EPA 2000 AWQC Human Health Methodology
//    (EPA-822-B-00-004). Running with --apply attests to that verification. (The value was located
//    + confirmed against the primary PDF this session; the source row already carries the epa.gov URL.)
//  - SCOPE (rule 2): only the EPA adult-body-weight record is promoted. default_status is NEVER
//    modified (stays 'available_option'); the owner's FRAME_DEFAULT_PROFILES row is the activation step.
//  - AFTER --apply (rule 3): run npx tsc --noEmit; npm run lint; npm run test:ci.
//
// USAGE (run from anywhere; paths resolve from the script location):
//   node scripts/matrix-options/promote-epa-bw-default.mjs --reviewer "J. Nelson" --date 2026-06-11
//   node scripts/matrix-options/promote-epa-bw-default.mjs --reviewer "J. Nelson" --date 2026-06-11 --apply
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
export const EPA_BW_PROMOTION_VALUE_ID = 'pv-epa-2000-bw-adult-us';
export const EPA_BW_PROMOTION_SOURCE_ID = 'src-epa-2000-awqc-human-health';

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

export function planPromotion(paramValues, sources, _opts) {
  // -- VALUE record --
  const valueRecord = paramValues.find(
    (r) => r.parameter_value_id === EPA_BW_PROMOTION_VALUE_ID,
  );
  if (!valueRecord) {
    throw new Error(
      'Precondition failed: value record not found in parameter_values.json: ' +
      EPA_BW_PROMOTION_VALUE_ID,
    );
  }
  if (!Array.isArray(valueRecord.evidence_items) || valueRecord.evidence_items.length === 0) {
    throw new Error(
      'Precondition failed: ' + EPA_BW_PROMOTION_VALUE_ID + ' has no evidence_items',
    );
  }
  // Fail-closed IDENTITY check: only ever promote the EXACT intended EPA adult-body-weight record
  // in its frame-eligible shape. Cover EVERY scalar field that getFrameSeedCandidateEligibility /
  // classifyCandidate examine, so the helper cannot "succeed" on a record that would still be blocked.
  const EXPECTED_VALUE = {
    jurisdiction: 'US_federal',
    candidate_group_id: 'human-health-food__generic__BW_kg__US_federal',
    pathway: 'human-health-food',
    input_key: 'BW_kg',
    substance_key: 'generic',
    value: 70,
    unit: 'kg',
    value_type: 'single_value',
    default_status: 'available_option',
  };
  const identityMismatch = Object.entries(EXPECTED_VALUE).filter(
    ([k, v]) => valueRecord[k] !== v,
  );
  if (identityMismatch.length > 0) {
    throw new Error(
      'Precondition failed: ' + EPA_BW_PROMOTION_VALUE_ID +
      ' is not in the expected frame-eligible identity. Mismatched field(s):\n' +
      identityMismatch
        .map(([k, v]) => '  ' + k + ': expected ' + JSON.stringify(v) +
          ', actual ' + JSON.stringify(valueRecord[k]))
        .join('\n') +
      '\n(jurisdiction must be "US_federal" with input_key "BW_kg" and value 70 kg; the ' +
      'us-epa-usace-sediment frame admits US_federal.)\nRefusing to promote a record that cannot seed the US EPA frame.',
    );
  }
  // source_ids must be EXACTLY [EPA source].
  if (!Array.isArray(valueRecord.source_ids) ||
      valueRecord.source_ids.length !== 1 ||
      valueRecord.source_ids[0] !== EPA_BW_PROMOTION_SOURCE_ID) {
    throw new Error(
      'Precondition failed: ' + EPA_BW_PROMOTION_VALUE_ID + ' source_ids must be EXACTLY ["' +
      EPA_BW_PROMOTION_SOURCE_ID + '"] (actual: ' + JSON.stringify(valueRecord.source_ids) +
      '). A second linked source could carry a policy_compilation/reference_mining role that ' +
      'classifyCandidate would block but this single-source helper would miss. Refusing to promote.',
    );
  }
  // Evidence-state coherence + pre/already-done states (fail-closed; reject partial promotion).
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
      'Precondition failed: ' + EPA_BW_PROMOTION_VALUE_ID +
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
    (s) => s.source_id === EPA_BW_PROMOTION_SOURCE_ID,
  );
  if (!sourceRecord) {
    throw new Error(
      'Precondition failed: source record not found in sources.json: ' +
      EPA_BW_PROMOTION_SOURCE_ID,
    );
  }
  const sourceAlreadyDone =
    sourceRecord.canonical_source_status === 'direct_source_verified';
  const sourceExpectedPre =
    sourceRecord.canonical_source_status === 'needs_direct_source_check';

  if (!sourceAlreadyDone && !sourceExpectedPre) {
    throw new Error(
      'Precondition failed: source ' + EPA_BW_PROMOTION_SOURCE_ID +
      ' canonical_source_status="' + sourceRecord.canonical_source_status +
      '" is neither needs_direct_source_check (promotable) nor direct_source_verified (done). ' +
      'Refusing to promote a drifted source.',
    );
  }

  // Fail-closed on the SAME source-role / currentness fields classifyCandidate examines.
  const srcRole = sourceRecord.calculator_source_role ?? 'canonical_candidate';
  const relationshipRoles = Array.isArray(valueRecord.source_relationships)
    ? valueRecord.source_relationships.map((r) => (r ? r.role : null))
    : [];
  const allRoles = [srcRole, ...relationshipRoles];
  if (allRoles.includes('policy_compilation') || allRoles.includes('reference_mining')) {
    throw new Error(
      'Precondition failed: ' + EPA_BW_PROMOTION_VALUE_ID + ' has a source role of ' +
      'policy_compilation/reference_mining (roles: ' + JSON.stringify(allRoles) + '). ' +
      'classifyCandidate would block such a record; refusing to promote a record the frame-default pipeline blocks.',
    );
  }
  if (
    sourceRecord.file_storage === 'repo_metadata_only' ||
    srcRole !== 'canonical_candidate' ||
    sourceRecord.currentness_status !== 'current'
  ) {
    throw new Error(
      'Precondition failed: source ' + EPA_BW_PROMOTION_SOURCE_ID +
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

// ---------------------------------------------------------------------------
// Apply
// ---------------------------------------------------------------------------

export function applyPromotion(paramValues, sources, opts) {
  const plan = planPromotion(paramValues, sources, opts);

  let valueTouched = false;
  if (plan.promoteValue) {
    const r = plan.valueRecord;
    r.qa_status = 'approved';
    r.evidence_support_status = 'approved_source_backed';
    r.canonical_source_status = 'direct_source_verified';
    r.evidence_items = r.evidence_items.map((ev) => approveEvidence(ev, opts.reviewer, opts.date));
    stampValueProvenance(r, opts.date, opts.reviewer);
  } else if (plan.valueAlreadyDone) {
    valueTouched = stampValueProvenance(plan.valueRecord, opts.date, opts.reviewer);
  }
  plan.valueTouched = valueTouched;

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
  '=========================================================================',
  ' promote-epa-bw-default.mjs -- owner-run US EPA adult body-weight promotion',
  '=========================================================================',
  '',
  'OWNER VERIFICATION REQUIRED before --apply:',
  '  Verify the US EPA adult body weight (70 kg, general adult population) against the',
  '  primary US EPA 2000 AWQC Human Health Methodology (EPA-822-B-00-004; equation key',
  '  Ch.1 p.1-9 + Section 4.3.1.1 p.4-19). Running --apply attests to that verification.',
  '',
  'DURABLE LOCATOR (already on file -- the fail-closed guard below will NOT fire):',
  '  The EPA source row ALREADY has the primary epa.gov PDF URL -- it was promoted to',
  '  direct_source_verified by the IR promotion (#294) -- so --apply satisfies the',
  '  provenance guard as-is and will NOT fail for lack of a locator. The Zotero item key',
  '  is still pending; optionally pass --zotero-key to link it.',
  '',
  'SCOPE: only the adult-body-weight value is promoted (the EPA source is normally a no-op',
  '  skip -- already verified). default_status is NOT changed (stays available_option).',
  '  The FRAME_DEFAULT_PROFILES BW_kg seed is the owner activation step, not this tool.',
  '',
].join('\n');

const HELP = [
  'promote-epa-bw-default.mjs -- owner-run US EPA adult body-weight promotion tool.',
  '',
  'Usage:',
  '  node scripts/matrix-options/promote-epa-bw-default.mjs --reviewer "<id>" --date YYYY-MM-DD [--apply]',
  '    [--source-url "<url>"] [--zotero-key "<key>"]',
  '',
  'Options:',
  '  --reviewer "<id>"        Reviewer attestation -> evidence.reviewed_by (required for --apply)',
  '  --date YYYY-MM-DD        Review date -> evidence.reviewed_at (required for --apply)',
  '  --source-url "<url>"     Override the stored source URL (only if it changed).',
  '  --zotero-key "<key>"     Zotero item key; sets zotero_item_key and zotero_status=linked.',
  '  --apply                  Write both catalog files (default is a dry run that writes nothing)',
  '',
  'Targets:',
  '  VALUE : pv-epa-2000-bw-adult-us         (parameter_values.json)',
  '  SOURCE: src-epa-2000-awqc-human-health  (sources.json; normally already verified)',
  '',
  'On --apply, VALUE record changes:',
  '  qa_status                 needs_review -> approved',
  '  evidence_support_status   pending_source_locator -> approved_source_backed',
  '  canonical_source_status   needs_direct_source_check -> direct_source_verified',
  '  evidence_items[*].qa_status needs_review -> approved (+ reviewed_by/at after qa_status)',
  '  default_status            UNCHANGED (stays available_option)',
  '',
  'AI never runs this with --apply. The owner runs it; --reviewer/--date are the HITL attestation.',
  'After --apply: npx tsc --noEmit; npm run lint; npm run test:ci',
].join('\n');

function printPlan(plan, opts) {
  if (plan.promoteValue) {
    const r = plan.valueRecord;
    console.log('  VALUE   PROMOTE  ' + EPA_BW_PROMOTION_VALUE_ID);
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
    console.log('  VALUE   SKIP     ' + EPA_BW_PROMOTION_VALUE_ID + ': already in target state (no-op)');
  }

  if (plan.promoteSource) {
    const s = plan.sourceRecord;
    console.log('  SOURCE  PROMOTE  ' + EPA_BW_PROMOTION_SOURCE_ID);
    console.log('    canonical_source_status : ' + s.canonical_source_status +
      ' -> direct_source_verified');
  } else {
    console.log('  SOURCE  SKIP     ' + EPA_BW_PROMOTION_SOURCE_ID +
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

  const totalToPromote = (plan.promoteValue ? 1 : 0) + (plan.promoteSource ? 1 : 0);
  const totalSkipped = (plan.valueAlreadyDone ? 1 : 0) + (plan.sourceAlreadyDone ? 1 : 0);
  console.log('Summary: ' + totalToPromote + ' record(s) to promote, ' +
    totalSkipped + ' already in target state.');

  if (plan.valueAlreadyDone && valueStampRepairNeeded(plan.valueRecord)) {
    console.log('NOTE: an already-approved record is MISSING a promotion display-stamp on one of ' +
      '{applicability, uncertainty, review_notes}; --apply will repair it (writes parameter_values.json).');
  }

  if (!opts.apply) {
    console.log('');
    console.log('DRY RUN -- no file written. Re-run with --apply (plus --reviewer/--date) to write.');
    return;
  }

  validateApplyOptions(opts);

  const sourceWillBeVerified = plan.promoteSource || plan.sourceAlreadyDone;
  const valueWillBeApproved = plan.promoteValue || plan.valueAlreadyDone;
  const effUrl = opts.sourceUrl || plan.sourceRecord.url;
  const effKey = opts.zoteroKey || plan.sourceRecord.zotero_item_key;
  if (valueWillBeApproved && sourceWillBeVerified && !effUrl && !effKey) {
    throw new Error(
      'Provenance guard: ' + EPA_BW_PROMOTION_VALUE_ID + ' would be approved against source ' +
      EPA_BW_PROMOTION_SOURCE_ID + ' (direct_source_verified), but that source has no durable' +
      ' locator (url=null, zotero_item_key=null).\n' +
      'Provide --source-url "<epa.gov URL>" and/or --zotero-key "<Zotero item key>".',
    );
  }

  const locatorWouldChange =
    (Boolean(opts.sourceUrl) && plan.sourceRecord.url !== opts.sourceUrl) ||
    (Boolean(opts.zoteroKey) && plan.sourceRecord.zotero_item_key !== opts.zoteroKey) ||
    (Boolean(opts.zoteroKey) && plan.sourceRecord.zotero_status !== 'linked');
  const stampRepairWouldChange = plan.valueAlreadyDone && valueStampRepairNeeded(plan.valueRecord);
  if (totalToPromote === 0 && !locatorWouldChange && !stampRepairWouldChange) {
    console.log('');
    console.log('Nothing to promote (both records already in target state). No write.');
    return;
  }

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

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : '';
if (invokedPath === fileURLToPath(import.meta.url)) {
  main();
}
