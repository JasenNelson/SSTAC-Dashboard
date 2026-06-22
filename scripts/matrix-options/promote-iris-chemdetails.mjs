// Owner-run promotion helper for the US EPA IRIS chemical-details batch
// (src-us-epa-iris-chemical-details-live): 275 human-health TRV value records (inhalation unit risk,
// inhalation RfC, oral slope factor) across the direct + food pathways. Plain ASCII.
//
// WHY THIS EXISTS
// The Matrix Options Evidence Library carries 290 needs_review US EPA IRIS chemical-details candidates.
// 15 of them (4 substances: 1,1,1-trichloroethane + 1,2,3- / 1,2,4- / 1,3,5-trimethylbenzene RfC) carry
// DUPLICATE candidate_group_ids (multiple agency RfC estimates per substance) and are EXCLUDED from this
// batch -- promoting them would create ambiguous frame-seed candidates; they need separate owner
// resolution (pick the canonical estimate or add distinguishing suffixes). This tool promotes EXACTLY
// the 275 clean singleton rows in the data file below.
//
// VERIFICATION BASIS: value correctness is guarded by the EPA IRIS canonical snapshot test
// (iris-snapshot-magnitude.test.ts + epa_iris_canonical_snapshot.json), which covers all 275 rows and
// re-derives each magnitude from verbatim epa_raw (the inhalation-unit-scale defect class is covered).
// This script ADDITIONALLY hard-codes per-row identity from the committed data file (drift-detection).
//
// OWNER SPOT-CHECK FLAG (highest-risk magnitude): hexachlorodibenzo-p-dioxin (HxCDD, CASRN 57653-85-7)
// IUR = 1.3 per ug/m3 (~265x the next-highest IUR in the batch) and SF = 6200 per mg/kg-bw/day. Both are
// snapshot-covered but should be spot-checked against the live IRIS page before --apply.
//
// SCOPE: the exact 275 pv-iris-* ids in the data file ONLY (the 15 dupe-cg_id rows are NOT reachable).
//
// LOAD-BEARING RULES (same as promote-iris-rfd-batch.mjs):
//  - AI NEVER writes qa_status. Owner runs this; --reviewer/--date are the HITL attestation.
//  - SCOPE: only the 275 listed records; default_status NEVER modified.
//  - SOURCE: src-us-epa-iris-chemical-details-live is currently needs_direct_source_check, so this tool
//    WILL promote the source to direct_source_verified (unlike the RfD-table source which was already done).
//  - AFTER --apply: npx tsc --noEmit; npm run lint; npm run test:ci.
//
// USAGE:
//   node scripts/matrix-options/promote-iris-chemdetails.mjs --reviewer "J. Nelson" --date 2026-06-21
//   node scripts/matrix-options/promote-iris-chemdetails.mjs --reviewer "J. Nelson" --date 2026-06-21 --apply

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..', '..');
const HH_TRV_FILE = path.join(REPO_ROOT, 'matrix_research', 'reference_catalog', 'human_health_trv_values.json');
const SOURCES_FILE = path.join(REPO_ROOT, 'matrix_research', 'reference_catalog', 'sources.json');
const DATA_FILE = path.join(__dirname, 'data', 'iris-chemdetails-promotion-2026-06-21.json');

export const IRIS_CHEMDETAILS_PROMOTION_SOURCE_ID = 'src-us-epa-iris-chemical-details-live';
const JURISDICTION = 'US_federal';

export const PROMOTION_ROWS = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
export const IRIS_CHEMDETAILS_PROMOTION_VALUE_IDS = PROMOTION_ROWS.map((r) => r.id);

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
  if (!opts.reviewer || !String(opts.reviewer).trim()) errors.push('--reviewer "<id/name>" is required for --apply');
  if (!opts.date || !DATE_RE.test(opts.date)) errors.push('--date YYYY-MM-DD is required for --apply');
  if (errors.length) throw new Error('Invalid --apply options:\n  - ' + errors.join('\n  - '));
}

function planOneValueRecord(paramValues, valueId, expectedIdentity) {
  const valueRecord = paramValues.find((r) => r.parameter_value_id === valueId);
  if (!valueRecord) throw new Error('Precondition failed: value record not found in human_health_trv_values.json: ' + valueId);
  if (!Array.isArray(valueRecord.evidence_items) || valueRecord.evidence_items.length === 0) throw new Error('Precondition failed: ' + valueId + ' has no evidence_items');
  const identityMismatch = Object.entries(expectedIdentity).filter(([k, v]) => valueRecord[k] !== v);
  if (identityMismatch.length > 0) {
    throw new Error('Precondition failed: ' + valueId + ' is not in the expected frame-eligible identity. Mismatched field(s):\n' +
      identityMismatch.map(([k, v]) => '  ' + k + ': expected ' + JSON.stringify(v) + ', actual ' + JSON.stringify(valueRecord[k])).join('\n') +
      '\nRefusing to promote a record that cannot seed the human-health frame.');
  }
  if (!Array.isArray(valueRecord.source_ids) || valueRecord.source_ids.length !== 1 || valueRecord.source_ids[0] !== IRIS_CHEMDETAILS_PROMOTION_SOURCE_ID) {
    throw new Error('Precondition failed: ' + valueId + ' source_ids must be EXACTLY ["' + IRIS_CHEMDETAILS_PROMOTION_SOURCE_ID + '"] (actual: ' + JSON.stringify(valueRecord.source_ids) + '). Refusing.');
  }
  const nestedSourceRefs = [
    ...(Array.isArray(valueRecord.evidence_items) ? valueRecord.evidence_items.map((ev) => (ev ? ev.source_id : undefined)) : []),
    ...(Array.isArray(valueRecord.source_relationships) ? valueRecord.source_relationships.map((rel) => (rel ? rel.source_id : undefined)) : []),
  ];
  const stale = nestedSourceRefs.filter((sid) => sid !== IRIS_CHEMDETAILS_PROMOTION_SOURCE_ID);
  if (stale.length > 0) throw new Error('Precondition failed: ' + valueId + ' has nested provenance source reference(s) not the expected source (' + JSON.stringify(stale) + '). Refusing.');
  const allEvidenceApproved = valueRecord.evidence_items.every((ev) => ev.qa_status === 'approved' && Boolean(ev.reviewed_by) && Boolean(ev.reviewed_at));
  const allEvidenceNeedsReview = valueRecord.evidence_items.every((ev) => ev.qa_status === 'needs_review');
  const valueAlreadyDone = valueRecord.qa_status === 'approved' && valueRecord.evidence_support_status === 'approved_source_backed' && valueRecord.canonical_source_status === 'direct_source_verified' && allEvidenceApproved;
  const valueExpectedPre = valueRecord.qa_status === 'needs_review' && valueRecord.evidence_support_status === 'approved_source_backed' && valueRecord.canonical_source_status === 'needs_direct_source_check' && allEvidenceNeedsReview;
  if (!valueAlreadyDone && !valueExpectedPre) {
    const evStates = valueRecord.evidence_items.map((ev) => ev.qa_status);
    throw new Error('Precondition failed: ' + valueId + ' is not in the expected pre-promotion state nor the already-promoted state.\n' +
      '  actual: qa_status=' + valueRecord.qa_status + ', evidence_support_status=' + valueRecord.evidence_support_status + ', canonical_source_status=' + valueRecord.canonical_source_status + ', evidence_items qa=' + JSON.stringify(evStates) + '\nRefusing to promote a drifted/partially-promoted record.');
  }
  return { valueRecord, valueAlreadyDone, promoteValue: !valueAlreadyDone };
}

export function planPromotion(paramValues, sources, _opts) {
  const cgCounts = new Map();
  for (const ei of EXPECTED_IDENTITIES) cgCounts.set(ei.candidate_group_id, (cgCounts.get(ei.candidate_group_id) || 0) + 1);
  const dupeGroups = [...cgCounts.entries()].filter(([, n]) => n > 1).map(([cg]) => cg);
  if (dupeGroups.length > 0) throw new Error('Precondition failed: duplicate candidate_group_id(s) in the batch: ' + JSON.stringify(dupeGroups.slice(0, 5)) + ' (refusing -- ambiguous frame-seed candidates).');

  const valueResults = IRIS_CHEMDETAILS_PROMOTION_VALUE_IDS.map((valueId, i) => planOneValueRecord(paramValues, valueId, EXPECTED_IDENTITIES[i]));

  const sourceRecord = sources.find((s) => s.source_id === IRIS_CHEMDETAILS_PROMOTION_SOURCE_ID);
  if (!sourceRecord) throw new Error('Precondition failed: source record not found in sources.json: ' + IRIS_CHEMDETAILS_PROMOTION_SOURCE_ID);
  const csStatus = sourceRecord.canonical_source_status;
  const sourceAlreadyDone = csStatus === 'direct_source_verified';
  const sourceExpectedPre = csStatus === 'needs_direct_source_check';
  if (!sourceAlreadyDone && !sourceExpectedPre) throw new Error('Precondition failed: source ' + IRIS_CHEMDETAILS_PROMOTION_SOURCE_ID + ' canonical_source_status="' + csStatus + '" is neither needs_direct_source_check nor direct_source_verified. Refusing.');
  const srcRole = sourceRecord.calculator_source_role ?? 'canonical_candidate';
  for (const { valueRecord } of valueResults) {
    const relationshipRoles = Array.isArray(valueRecord.source_relationships) ? valueRecord.source_relationships.map((r) => (r ? r.role : null)) : [];
    const allRoles = [srcRole, ...relationshipRoles];
    if (allRoles.includes('policy_compilation') || allRoles.includes('reference_mining')) throw new Error('Precondition failed: ' + valueRecord.parameter_value_id + ' has source role policy_compilation/reference_mining (roles: ' + JSON.stringify(allRoles) + '). Refusing.');
  }
  if (sourceRecord.file_storage === 'repo_metadata_only' || srcRole !== 'canonical_candidate' || sourceRecord.currentness_status !== 'current') {
    throw new Error('Precondition failed: source ' + IRIS_CHEMDETAILS_PROMOTION_SOURCE_ID + ' is not direct-current eligible. Actual: file_storage=' + JSON.stringify(sourceRecord.file_storage) + ', calculator_source_role=' + JSON.stringify(srcRole) + ', currentness_status=' + JSON.stringify(sourceRecord.currentness_status) + '.');
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
  if (typeof out.note === 'string' && out.note.length > 0 && !out.note.includes(PROMOTION_STAMP_MARKER)) {
    out.note += buildEvidenceNoteStamp(date, reviewer);
  }
  return out;
}

const PROMOTION_STAMP_MARKER = 'PROMOTED to approved';
const STAMPED_PROVENANCE_FIELDS = ['applicability', 'uncertainty', 'review_notes'];
function buildValueStamp(date, reviewer) { return ' [PROMOTED to approved (qa_status approved, source direct_source_verified) on ' + date + ' by ' + reviewer + '; the needs_review language above is superseded.]'; }
function stampValueProvenance(r, date, reviewer) {
  const stamp = buildValueStamp(date, reviewer);
  let changed = false;
  for (const field of STAMPED_PROVENANCE_FIELDS) { const v = r[field]; if (typeof v === 'string' && v.length > 0 && !v.includes(PROMOTION_STAMP_MARKER)) { r[field] = v + stamp; changed = true; } }
  return changed;
}
function buildEvidenceNoteStamp(date, reviewer) {
  return ' [Evidence PROMOTED to approved on ' + date + ' by ' + reviewer + '; the pending direct-source verification note above is superseded.]';
}
function stampEvidenceNotes(r, date, reviewer) {
  if (!Array.isArray(r.evidence_items)) return false;
  const stamp = buildEvidenceNoteStamp(date, reviewer);
  let changed = false;
  for (const ev of r.evidence_items) {
    if (ev && typeof ev.note === 'string' && ev.note.length > 0 && !ev.note.includes(PROMOTION_STAMP_MARKER)) {
      ev.note += stamp; changed = true;
    }
  }
  return changed;
}
function evidenceNoteRepairNeeded(r) {
  return Array.isArray(r.evidence_items) && r.evidence_items.some(
    (ev) => ev && typeof ev.note === 'string' && ev.note.length > 0 && !ev.note.includes(PROMOTION_STAMP_MARKER),
  );
}
function valueStampRepairNeeded(r) {
  return STAMPED_PROVENANCE_FIELDS.some((field) => typeof r[field] === 'string' && r[field].length > 0 && !r[field].includes(PROMOTION_STAMP_MARKER))
    || evidenceNoteRepairNeeded(r);
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
      const provChanged = stampValueProvenance(vr.valueRecord, opts.date, opts.reviewer);
      const noteChanged = stampEvidenceNotes(vr.valueRecord, opts.date, opts.reviewer);
      touched = provChanged || noteChanged;
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
  ' promote-iris-chemdetails.mjs -- owner-run US EPA IRIS chemical-details promotion',
  '   (275 human-health IUR/RfC/SF rows; 15 dupe-candidate_group_id rows EXCLUDED)',
  '=============================================================================',
  '',
  'OWNER VERIFICATION REQUIRED before --apply:',
  '  Values guarded by the EPA IRIS canonical snapshot magnitude test. SPOT-CHECK the HxCDD anomaly',
  '  (CASRN 57653-85-7: IUR 1.3 per ug/m3; SF 6200 per mg/kg-bw/day) against the live IRIS page.',
  '  Running --apply attests you accept the snapshot-backed basis + the HxCDD value.',
  '',
  'SCOPE: 275 clean pv-iris-* ids in data/iris-chemdetails-promotion-2026-06-21.json ONLY. The 15',
  '  trimethylbenzene/TCA RfC rows with duplicate candidate_group_ids are EXCLUDED (need separate',
  '  owner resolution). default_status NOT changed.',
  '',
  'SOURCE NOTE: src-us-epa-iris-chemical-details-live is currently needs_direct_source_check, so this',
  '  tool PROMOTES the source to direct_source_verified (writes sources.json).',
  '',
].join('\n');

const HELP = [
  'promote-iris-chemdetails.mjs -- owner-run US EPA IRIS chemical-details promotion (275 rows).',
  '',
  'Usage:',
  '  node scripts/matrix-options/promote-iris-chemdetails.mjs --reviewer "<id>" --date YYYY-MM-DD [--apply]',
  '    [--source-url "<url>"] [--zotero-key "<key>"]',
  '',
  'On --apply each VALUE: qa_status needs_review -> approved; canonical_source_status -> direct_source_verified;',
  '  evidence_items qa -> approved + reviewed_by/at; evidence_support_status UNCHANGED; default_status UNCHANGED.',
  'On --apply the SOURCE: canonical_source_status needs_direct_source_check -> direct_source_verified.',
  '',
  'AI never runs --apply. Owner runs it; --reviewer/--date are the HITL attestation.',
  'After --apply: npx tsc --noEmit; npm run lint; npm run test:ci',
].join('\n');

function printPlan(plan) {
  let promote = 0; let skip = 0;
  for (const vr of plan.valueResults) { if (vr.promoteValue) promote++; else skip++; }
  console.log('  VALUE   PROMOTE  ' + promote + ' rows (qa_status -> approved; canonical_source_status -> direct_source_verified)');
  console.log('  VALUE   SKIP     ' + skip + ' rows already in target state');
  if (plan.promoteSource) console.log('  SOURCE  PROMOTE  ' + IRIS_CHEMDETAILS_PROMOTION_SOURCE_ID + ': ' + plan.sourceRecord.canonical_source_status + ' -> direct_source_verified');
  else console.log('  SOURCE  SKIP     ' + IRIS_CHEMDETAILS_PROMOTION_SOURCE_ID + ': already in target state (no-op)');
}

function main() {
  const opts = parseArgs(process.argv);
  if (opts.help) { console.log(BANNER); console.log(HELP); return; }
  console.log(BANNER);
  console.log('Mode    : ' + (opts.apply ? 'APPLY (will write files)' : 'DRY RUN (writes nothing)'));
  console.log('reviewer: ' + (opts.reviewer || '(not set)'));
  console.log('date    : ' + (opts.date || '(not set)'));
  console.log('records : ' + IRIS_CHEMDETAILS_PROMOTION_VALUE_IDS.length + ' VALUE + 1 SOURCE');
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
  if (!opts.apply) { console.log('\nDRY RUN -- no file written. Re-run with --apply (plus --reviewer/--date) to write.'); return; }
  validateApplyOptions(opts);
  const sourceWillBeVerified = plan.promoteSource || plan.sourceAlreadyDone;
  const anyValueWillBeApproved = plan.valueResults.some((vr) => vr.promoteValue || vr.valueAlreadyDone);
  const effUrl = opts.sourceUrl || plan.sourceRecord.url;
  const effKey = opts.zoteroKey || plan.sourceRecord.zotero_item_key;
  if (anyValueWillBeApproved && sourceWillBeVerified && !effUrl && !effKey) {
    throw new Error('Provenance guard: values would be approved against ' + IRIS_CHEMDETAILS_PROMOTION_SOURCE_ID + ' (direct_source_verified) but it has no durable locator. Provide --source-url and/or --zotero-key.');
  }
  const locatorWouldChange = (Boolean(opts.sourceUrl) && plan.sourceRecord.url !== opts.sourceUrl) || (Boolean(opts.zoteroKey) && plan.sourceRecord.zotero_item_key !== opts.zoteroKey) || (Boolean(opts.zoteroKey) && plan.sourceRecord.zotero_status !== 'linked');
  const stampRepairWouldChange = plan.valueResults.some((vr) => vr.valueAlreadyDone && valueStampRepairNeeded(vr.valueRecord));
  if (totalToPromote === 0 && !locatorWouldChange && !stampRepairWouldChange) { console.log('\nNothing to promote (all records already in target state). No write.'); return; }
  const applied = applyPromotion(paramValues, sources, opts);
  const anyValueWrite = applied.valueResults.some((vr) => vr.promoteValue) || applied.valueTouchedFlags.some(Boolean);
  if (anyValueWrite) { fs.writeFileSync(HH_TRV_FILE, JSON.stringify(paramValues, null, 2) + '\n', 'utf8'); console.log('WROTE ' + HH_TRV_FILE); }
  if (applied.promoteSource || applied.sourceTouched) { fs.writeFileSync(SOURCES_FILE, JSON.stringify(sources, null, 2) + '\n', 'utf8'); console.log('WROTE ' + SOURCES_FILE); }
  const promotedCount = applied.valueResults.filter((vr) => vr.promoteValue).length;
  if (promotedCount > 0) {
    console.log('\nREQUIRED before test:ci: add IRIS_CHEMDETAILS_PROMOTION_VALUE_IDS to the catalog.test.ts HH tripwire union. library.test approvedSourceBacked UNCHANGED. Run npm run test:ci and bump any FAILING assertion.');
  }
  console.log('\nNext: npx tsc --noEmit; npm run lint; npm run test:ci; build; e2e');
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : '';
if (invokedPath === fileURLToPath(import.meta.url)) { main(); }
