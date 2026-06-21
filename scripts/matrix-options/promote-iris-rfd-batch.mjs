// Owner-run promotion helper for the US EPA IRIS oral-RfD batch (src-us-epa-iris-rfd-table-live):
// 680 human-health oral-RfD value records (direct + food pathways). Plain ASCII.
//
// WHY THIS EXISTS
// The Matrix Options Evidence Library carries 726 needs_review US EPA IRIS oral-RfD candidates,
// robot-extracted from the live IRIS RfD table and validated against the EPA "Chemicals_Details" Excel
// export. Each row is already evidence_support_status='approved_source_backed' but still
// qa_status='needs_review' with canonical_source_status='needs_direct_source_check'. This tool promotes
// EXACTLY the 680 clean pv-iris-* RfD records in the data file (the 726 needs_review rows MINUS 46
// duplicate-candidate_group_id rows -- multiple IRIS RfD estimates for the trimethylbenzenes,
// 1,1,1-trichloroethane, RDX, and short-chain PFAS PFBA/PFDA/PFHxA -- which are EXCLUDED here because
// two approved rows sharing one candidate_group_id would create ambiguous frame-seed candidates; they
// need separate owner resolution of the canonical estimate). Fails closed; idempotent.
//
// VERIFICATION BASIS (differs from promote-hc-trv-v4-2025.mjs): value correctness is guarded by the
// EPA IRIS canonical snapshot test (src/lib/matrix-options/provenance/__tests__/iris-canonical.test.ts +
// epa_iris_canonical_snapshot.json), which asserts every IRIS catalog value is a member of the EPA
// snapshot and self-consistently re-derives from its verbatim epa_raw. All 680 promoted rows are snapshot-covered.
// This script ADDITIONALLY hard-codes the per-row identity (substance/pathway/input/value/unit, loaded
// from the committed data file below) so the fail-closed check is real drift-detection, not a tautology.
//
// SCOPE: the exact 680 pv-iris-* ids in the data file ONLY (726 needs_review minus 46 dupe-cg). The 6 already-approved IRIS-carcinogen RfD
// rows (HCB/PCP/1,4-dioxane, promoted by promote-iris-carcinogen-rfd.mjs) are NOT in this set.
//
// LOAD-BEARING RULES honored (same as promote-iris-carcinogen-rfd.mjs):
//  - AI NEVER writes qa_status. Owner runs this; --reviewer/--date are the HITL attestation.
//  - OWNER VERIFICATION (rule 1): the owner attests the 680 RfD values via the snapshot + the
//    2026-06-04 IRIS EPA-Excel data-integrity verification packet. Running --apply attests to that.
//  - SCOPE (rule 2): only the 680 listed records; default_status NEVER modified (stays available_option).
//  - SOURCE (rule 3): src-us-epa-iris-rfd-table-live is expected ALREADY direct_source_verified -> the
//    SOURCE step SKIPs (no-op). Logic handles already-done gracefully.
//  - AFTER --apply (rule 4): npx tsc --noEmit; npm run lint; npm run test:ci.
//
// USAGE:
//   node scripts/matrix-options/promote-iris-rfd-batch.mjs --reviewer "J. Nelson" --date 2026-06-21
//   node scripts/matrix-options/promote-iris-rfd-batch.mjs --reviewer "J. Nelson" --date 2026-06-21 --apply

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..', '..');
const HH_TRV_FILE = path.join(REPO_ROOT, 'matrix_research', 'reference_catalog', 'human_health_trv_values.json');
const SOURCES_FILE = path.join(REPO_ROOT, 'matrix_research', 'reference_catalog', 'sources.json');
const DATA_FILE = path.join(__dirname, 'data', 'iris-rfd-promotion-2026-06-21.json');

export const IRIS_RFD_BATCH_PROMOTION_SOURCE_ID = 'src-us-epa-iris-rfd-table-live';
const JURISDICTION = 'US_federal';

// The EXACT records this tool will ever touch, loaded from the committed data file (680 rows generated
// from the catalog at authoring time; fixed + auditable scope). Read via fs (no import-attributes).
export const PROMOTION_ROWS = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
export const IRIS_RFD_BATCH_PROMOTION_VALUE_IDS = PROMOTION_ROWS.map((r) => r.id);

const EXPECTED_IDENTITIES = PROMOTION_ROWS.map((r) => ({
  jurisdiction: JURISDICTION,
  candidate_group_id: r.pathway + '__' + r.substanceKey + '__' + r.inputKey + '__' + JURISDICTION,
  pathway: r.pathway,
  input_key: r.inputKey,
  substance_key: r.substanceKey,
  value: r.value,
  unit: r.unit,
  value_type: 'single_value',
  default_status: 'available_option',
}));

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

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

function planOneValueRecord(paramValues, valueId, expectedIdentity) {
  const valueRecord = paramValues.find((r) => r.parameter_value_id === valueId);
  if (!valueRecord) {
    throw new Error('Precondition failed: value record not found in human_health_trv_values.json: ' + valueId);
  }
  if (!Array.isArray(valueRecord.evidence_items) || valueRecord.evidence_items.length === 0) {
    throw new Error('Precondition failed: ' + valueId + ' has no evidence_items');
  }
  const identityMismatch = Object.entries(expectedIdentity).filter(([k, v]) => valueRecord[k] !== v);
  if (identityMismatch.length > 0) {
    throw new Error(
      'Precondition failed: ' + valueId + ' is not in the expected frame-eligible identity. Mismatched field(s):\n' +
      identityMismatch.map(([k, v]) => '  ' + k + ': expected ' + JSON.stringify(v) + ', actual ' + JSON.stringify(valueRecord[k])).join('\n') +
      '\nRefusing to promote a record that cannot seed the human-health frame.',
    );
  }
  if (!Array.isArray(valueRecord.source_ids) || valueRecord.source_ids.length !== 1 ||
      valueRecord.source_ids[0] !== IRIS_RFD_BATCH_PROMOTION_SOURCE_ID) {
    throw new Error(
      'Precondition failed: ' + valueId + ' source_ids must be EXACTLY ["' + IRIS_RFD_BATCH_PROMOTION_SOURCE_ID +
      '"] (actual: ' + JSON.stringify(valueRecord.source_ids) + '). Refusing to promote.',
    );
  }
  const nestedSourceRefs = [
    ...(Array.isArray(valueRecord.evidence_items) ? valueRecord.evidence_items.map((ev) => (ev ? ev.source_id : undefined)) : []),
    ...(Array.isArray(valueRecord.source_relationships) ? valueRecord.source_relationships.map((rel) => (rel ? rel.source_id : undefined)) : []),
  ];
  const staleNestedSourceRefs = nestedSourceRefs.filter((sid) => sid !== IRIS_RFD_BATCH_PROMOTION_SOURCE_ID);
  if (staleNestedSourceRefs.length > 0) {
    throw new Error(
      'Precondition failed: ' + valueId + ' has nested provenance source reference(s) that are not the ' +
      'expected source (' + JSON.stringify(staleNestedSourceRefs) + '). Refusing to promote.',
    );
  }
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
    valueRecord.evidence_support_status === 'approved_source_backed' &&
    valueRecord.canonical_source_status === 'needs_direct_source_check' &&
    allEvidenceNeedsReview;
  if (!valueAlreadyDone && !valueExpectedPre) {
    const evStates = valueRecord.evidence_items.map((ev) => ev.qa_status);
    throw new Error(
      'Precondition failed: ' + valueId + ' is not in the expected pre-promotion state nor the already-promoted state.\n' +
      '  expected pre  : qa_status=needs_review, evidence_support_status=approved_source_backed, canonical_source_status=needs_direct_source_check, ALL evidence_items needs_review\n' +
      '  already-done  : qa_status=approved, evidence_support_status=approved_source_backed, canonical_source_status=direct_source_verified, ALL evidence_items approved\n' +
      '  actual        : qa_status=' + valueRecord.qa_status + ', evidence_support_status=' + valueRecord.evidence_support_status +
      ', canonical_source_status=' + valueRecord.canonical_source_status + ', evidence_items qa=' + JSON.stringify(evStates) + '\n' +
      'Refusing to promote a drifted/partially-promoted record.',
    );
  }
  return { valueRecord, valueAlreadyDone, promoteValue: !valueAlreadyDone };
}

export function planPromotion(paramValues, sources, _opts) {
  // candidate_group_id uniqueness guard: a frame default groups by candidate_group_id; two approved
  // rows sharing one would create ambiguous frame-seed candidates. Fail closed if the batch is not
  // 1 row per candidate_group_id (the IRIS RfD batch is single-input + paired direct/food, so each
  // (pathway, substance, rfd) group is unique).
  const cgCounts = new Map();
  for (const ei of EXPECTED_IDENTITIES) cgCounts.set(ei.candidate_group_id, (cgCounts.get(ei.candidate_group_id) || 0) + 1);
  const dupeGroups = [...cgCounts.entries()].filter(([, n]) => n > 1).map(([cg]) => cg);
  if (dupeGroups.length > 0) {
    throw new Error('Precondition failed: duplicate candidate_group_id(s) in the batch: ' + JSON.stringify(dupeGroups.slice(0, 5)) + ' (refusing -- would create ambiguous frame-seed candidates).');
  }

  const valueResults = IRIS_RFD_BATCH_PROMOTION_VALUE_IDS.map((valueId, i) => planOneValueRecord(paramValues, valueId, EXPECTED_IDENTITIES[i]));

  const sourceRecord = sources.find((s) => s.source_id === IRIS_RFD_BATCH_PROMOTION_SOURCE_ID);
  if (!sourceRecord) {
    throw new Error('Precondition failed: source record not found in sources.json: ' + IRIS_RFD_BATCH_PROMOTION_SOURCE_ID);
  }
  const csStatus = sourceRecord.canonical_source_status;
  const sourceAlreadyDone = csStatus === 'direct_source_verified';
  const sourceExpectedPre = csStatus === 'needs_direct_source_check';
  if (!sourceAlreadyDone && !sourceExpectedPre) {
    throw new Error('Precondition failed: source ' + IRIS_RFD_BATCH_PROMOTION_SOURCE_ID + ' canonical_source_status="' + csStatus + '" is neither needs_direct_source_check (promotable) nor direct_source_verified (done). Refusing.');
  }
  const srcRole = sourceRecord.calculator_source_role ?? 'canonical_candidate';
  for (const { valueRecord } of valueResults) {
    const relationshipRoles = Array.isArray(valueRecord.source_relationships) ? valueRecord.source_relationships.map((r) => (r ? r.role : null)) : [];
    const allRoles = [srcRole, ...relationshipRoles];
    if (allRoles.includes('policy_compilation') || allRoles.includes('reference_mining')) {
      throw new Error('Precondition failed: ' + valueRecord.parameter_value_id + ' has a source role of policy_compilation/reference_mining (roles: ' + JSON.stringify(allRoles) + '). Refusing.');
    }
  }
  if (sourceRecord.file_storage === 'repo_metadata_only' || srcRole !== 'canonical_candidate' || sourceRecord.currentness_status !== 'current') {
    throw new Error('Precondition failed: source ' + IRIS_RFD_BATCH_PROMOTION_SOURCE_ID + ' is not direct-current eligible. Actual: file_storage=' + JSON.stringify(sourceRecord.file_storage) + ', calculator_source_role=' + JSON.stringify(srcRole) + ', currentness_status=' + JSON.stringify(sourceRecord.currentness_status) + '.');
  }
  return { valueResults, sourceRecord, sourceAlreadyDone, promoteSource: !sourceAlreadyDone };
}

function approveEvidence(ev, reviewer, date) {
  const out = {};
  for (const [k, v] of Object.entries(ev)) {
    if (k === 'qa_status') { out.qa_status = 'approved'; out.reviewed_by = reviewer; out.reviewed_at = date; }
    else if (k === 'reviewed_by' || k === 'reviewed_at') { continue; }
    else { out[k] = v; }
  }
  if (!('qa_status' in out)) { out.qa_status = 'approved'; out.reviewed_by = reviewer; out.reviewed_at = date; }
  return out;
}

const PROMOTION_STAMP_MARKER = 'PROMOTED to approved';
const STAMPED_PROVENANCE_FIELDS = ['applicability', 'uncertainty', 'review_notes'];

function buildValueStamp(date, reviewer) {
  return ' [PROMOTED to approved (qa_status approved, source direct_source_verified) on ' + date + ' by ' + reviewer + '; the needs_review language above is superseded.]';
}
function stampValueProvenance(r, date, reviewer) {
  const stamp = buildValueStamp(date, reviewer);
  let changed = false;
  for (const field of STAMPED_PROVENANCE_FIELDS) {
    const v = r[field];
    if (typeof v === 'string' && v.length > 0 && !v.includes(PROMOTION_STAMP_MARKER)) { r[field] = v + stamp; changed = true; }
  }
  return changed;
}
function valueStampRepairNeeded(r) {
  return STAMPED_PROVENANCE_FIELDS.some((field) => typeof r[field] === 'string' && r[field].length > 0 && !r[field].includes(PROMOTION_STAMP_MARKER));
}

export function applyPromotion(paramValues, sources, opts) {
  const plan = planPromotion(paramValues, sources, opts);
  const valueTouchedFlags = [];
  for (const vr of plan.valueResults) {
    let touched = false;
    if (vr.promoteValue) {
      const r = vr.valueRecord;
      r.qa_status = 'approved';
      r.canonical_source_status = 'direct_source_verified';
      r.evidence_items = r.evidence_items.map((ev) => approveEvidence(ev, opts.reviewer, opts.date));
      stampValueProvenance(r, opts.date, opts.reviewer);
    } else if (vr.valueAlreadyDone) {
      touched = stampValueProvenance(vr.valueRecord, opts.date, opts.reviewer);
    }
    valueTouchedFlags.push(touched);
  }
  plan.valueTouchedFlags = valueTouchedFlags;
  let sourceTouched = false;
  if (opts.sourceUrl && plan.sourceRecord.url !== opts.sourceUrl) { plan.sourceRecord.url = opts.sourceUrl; sourceTouched = true; }
  if (opts.zoteroKey) {
    if (plan.sourceRecord.zotero_item_key !== opts.zoteroKey) { plan.sourceRecord.zotero_item_key = opts.zoteroKey; sourceTouched = true; }
    if (plan.sourceRecord.zotero_status !== 'linked') { plan.sourceRecord.zotero_status = 'linked'; sourceTouched = true; }
  }
  if (plan.promoteSource) {
    plan.sourceRecord.canonical_source_status = 'direct_source_verified';
    const srcStamp = ' [Source promoted to direct_source_verified on ' + opts.date + ' by ' + opts.reviewer + '; the pending / needs_review language above is superseded.]';
    if (typeof plan.sourceRecord.notes === 'string') plan.sourceRecord.notes += srcStamp;
    sourceTouched = true;
  }
  plan.sourceTouched = sourceTouched;
  return plan;
}

const BANNER = [
  '=============================================================================',
  ' promote-iris-rfd-batch.mjs -- owner-run US EPA IRIS oral-RfD batch promotion',
  '   (680 human-health oral-RfD rows; direct + food. 46 dupe-candidate_group_id rows EXCLUDED)',
  '=============================================================================',
  '',
  'OWNER VERIFICATION REQUIRED before --apply:',
  '  The 680 oral-RfD values are guarded by the EPA IRIS canonical snapshot test and the 2026-06-04',
  '  IRIS EPA-Excel data-integrity packet. Running --apply attests you accept that snapshot-backed basis.',
  '',
  'SCOPE: the 680 pv-iris-* RfD ids in data/iris-rfd-promotion-2026-06-21.json ONLY. default_status is',
  '  NOT changed (stays available_option). The FRAME_DEFAULT_PROFILES row is the owner activation step.',
  '',
  'SOURCE NOTE: src-us-epa-iris-rfd-table-live is expected already direct_source_verified (SKIP/no-op).',
  '',
].join('\n');

const HELP = [
  'promote-iris-rfd-batch.mjs -- owner-run US EPA IRIS oral-RfD batch promotion (680 rows).',
  '',
  'Usage:',
  '  node scripts/matrix-options/promote-iris-rfd-batch.mjs --reviewer "<id>" --date YYYY-MM-DD [--apply]',
  '    [--source-url "<url>"] [--zotero-key "<key>"]',
  '',
  'On --apply each VALUE: qa_status needs_review -> approved; canonical_source_status',
  '  needs_direct_source_check -> direct_source_verified; evidence_items qa -> approved + reviewed_by/at;',
  '  evidence_support_status UNCHANGED (already approved_source_backed); default_status UNCHANGED.',
  '',
  'AI never runs --apply. Owner runs it; --reviewer/--date are the HITL attestation.',
  'After --apply: npx tsc --noEmit; npm run lint; npm run test:ci',
].join('\n');

function printPlan(plan) {
  let promote = 0; let skip = 0;
  for (let i = 0; i < plan.valueResults.length; i++) {
    if (plan.valueResults[i].promoteValue) promote++; else skip++;
  }
  console.log('  VALUE   PROMOTE  ' + promote + ' rows (qa_status -> approved; canonical_source_status -> direct_source_verified)');
  console.log('  VALUE   SKIP     ' + skip + ' rows already in target state');
  if (plan.promoteSource) {
    console.log('  SOURCE  PROMOTE  ' + IRIS_RFD_BATCH_PROMOTION_SOURCE_ID + ': ' + plan.sourceRecord.canonical_source_status + ' -> direct_source_verified');
  } else {
    console.log('  SOURCE  SKIP     ' + IRIS_RFD_BATCH_PROMOTION_SOURCE_ID + ': already in target state (no-op)');
  }
}

function main() {
  const opts = parseArgs(process.argv);
  if (opts.help) { console.log(BANNER); console.log(HELP); return; }
  console.log(BANNER);
  console.log('Mode    : ' + (opts.apply ? 'APPLY (will write files)' : 'DRY RUN (writes nothing)'));
  console.log('reviewer: ' + (opts.reviewer || '(not set)'));
  console.log('date    : ' + (opts.date || '(not set)'));
  console.log('records : ' + IRIS_RFD_BATCH_PROMOTION_VALUE_IDS.length + ' VALUE + 1 SOURCE');
  console.log('');
  const paramValues = JSON.parse(fs.readFileSync(HH_TRV_FILE, 'utf8'));
  const sources = JSON.parse(fs.readFileSync(SOURCES_FILE, 'utf8'));
  const plan = planPromotion(paramValues, sources, opts);
  console.log('Before/after plan:');
  printPlan(plan);
  console.log('');
  const totalToPromote = plan.valueResults.filter((vr) => vr.promoteValue).length + (plan.promoteSource ? 1 : 0);
  const totalSkipped = plan.valueResults.filter((vr) => vr.valueAlreadyDone).length + (plan.sourceAlreadyDone ? 1 : 0);
  console.log('Summary: ' + totalToPromote + ' record(s) to promote, ' + totalSkipped + ' already in target state.');
  if (!opts.apply) {
    console.log('\nDRY RUN -- no file written. Re-run with --apply (plus --reviewer/--date) to write.');
    return;
  }
  validateApplyOptions(opts);
  const sourceWillBeVerified = plan.promoteSource || plan.sourceAlreadyDone;
  const anyValueWillBeApproved = plan.valueResults.some((vr) => vr.promoteValue || vr.valueAlreadyDone);
  const effUrl = opts.sourceUrl || plan.sourceRecord.url;
  const effKey = opts.zoteroKey || plan.sourceRecord.zotero_item_key;
  if (anyValueWillBeApproved && sourceWillBeVerified && !effUrl && !effKey) {
    throw new Error('Provenance guard: values would be approved against ' + IRIS_RFD_BATCH_PROMOTION_SOURCE_ID + ' (direct_source_verified) but it has no durable locator (url/zotero_item_key both null). Provide --source-url and/or --zotero-key.');
  }
  const locatorWouldChange =
    (Boolean(opts.sourceUrl) && plan.sourceRecord.url !== opts.sourceUrl) ||
    (Boolean(opts.zoteroKey) && plan.sourceRecord.zotero_item_key !== opts.zoteroKey) ||
    (Boolean(opts.zoteroKey) && plan.sourceRecord.zotero_status !== 'linked');
  const stampRepairWouldChange = plan.valueResults.some((vr) => vr.valueAlreadyDone && valueStampRepairNeeded(vr.valueRecord));
  if (totalToPromote === 0 && !locatorWouldChange && !stampRepairWouldChange) {
    console.log('\nNothing to promote (all records already in target state). No write.');
    return;
  }
  const applied = applyPromotion(paramValues, sources, opts);
  const anyValueWrite = applied.valueResults.some((vr) => vr.promoteValue) || applied.valueTouchedFlags.some(Boolean);
  if (anyValueWrite) { fs.writeFileSync(HH_TRV_FILE, JSON.stringify(paramValues, null, 2) + '\n', 'utf8'); console.log('WROTE ' + HH_TRV_FILE); }
  if (applied.promoteSource || applied.sourceTouched) { fs.writeFileSync(SOURCES_FILE, JSON.stringify(sources, null, 2) + '\n', 'utf8'); console.log('WROTE ' + SOURCES_FILE); }
  const promotedCount = applied.valueResults.filter((vr) => vr.promoteValue).length;
  if (promotedCount > 0) {
    console.log('\nREQUIRED before test:ci:');
    console.log('  - Add IRIS_RFD_BATCH_PROMOTION_VALUE_IDS to the catalog.test.ts HH tripwire union.');
    console.log('  - library.test approvedSourceBacked/pendingSourceLocator UNCHANGED (rows already approved_source_backed).');
    console.log('  Run npm run test:ci and bump any FAILING assertion to match (do not hard-set).');
  }
  console.log('\nNext: npx tsc --noEmit; npm run lint; npm run test:ci; build; e2e');
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : '';
if (invokedPath === fileURLToPath(import.meta.url)) { main(); }
