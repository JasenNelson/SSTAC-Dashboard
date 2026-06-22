// Owner-run promotion for the 14 EPA IRIS "duplicate candidate_group_id" CANONICAL rows that were
// EXCLUDED from PR #380. Plain ASCII.
//
// WHY THIS EXISTS
// #380 excluded 61 needs_review IRIS rows because multiple IRIS RfD/RfC estimates shared one
// candidate_group_id (two approved rows in one group create ambiguous frame-seed candidates). For
// the trimethylbenzenes (1,2,3- / 1,2,4- / 1,3,5-), 1,1,1-trichloroethane, and RDX, the extra rows
// are subchronic / matrix / artifact estimates -- NOT the chronic value. On 2026-06-22 the CHRONIC
// RfD/RfC for each was VERIFIED DIRECTLY against the live US EPA IRIS source (cfpub.epa.gov /
// iris.epa.gov; URLs + dates per row in data/iris-dupe-cg-canonical-2026-06-22.json). This tool
// promotes EXACTLY the 14 rows whose catalog value matches the EPA-verified canonical value; the
// non-canonical members of each group stay needs_review. Each promoted row becomes the SOLE approved
// member of its candidate_group_id (0 already approved -- verified at authoring), so no ambiguity.
//
// The PFAS dupe-cg groups (PFBA / PFDA / PFHxA) are NOT in scope: those are genuinely sex/endpoint-
// stratified 2024 IRIS values, not subchronic duplicates -- owner resolution pending.
//
// VERIFICATION BASIS: (1) the per-row EPA IRIS URL + chronic value in the data file (validate against
// the source, not memory); (2) the EPA IRIS canonical snapshot test still covers every IRIS value.
// This script hard-codes the per-row identity (substance/pathway/input/value/unit/source) so the
// fail-closed check is real drift-detection.
//
// LOAD-BEARING RULES honored (same as promote-iris-rfd-batch.mjs):
//  - AI NEVER writes qa_status. Owner runs this; --reviewer/--date are the HITL attestation.
//  - SCOPE: only the 14 listed records; default_status NEVER modified (stays available_option).
//  - SOURCE: both src-us-epa-iris-rfd-table-live (RfD rows) and src-us-epa-iris-chemical-details-live
//    (RfC rows) are expected ALREADY direct_source_verified (from #380) -> the SOURCE step is a no-op.
//  - AFTER --apply: npx tsc --noEmit; npm run lint; npm run test:ci.
//
// USAGE:
//   node scripts/matrix-options/promote-iris-dupe-cg-canonical.mjs --reviewer "J. Nelson" --date 2026-06-22
//   node scripts/matrix-options/promote-iris-dupe-cg-canonical.mjs --reviewer "J. Nelson" --date 2026-06-22 --apply

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..', '..');
const HH_TRV_FILE = path.join(REPO_ROOT, 'matrix_research', 'reference_catalog', 'human_health_trv_values.json');
const SOURCES_FILE = path.join(REPO_ROOT, 'matrix_research', 'reference_catalog', 'sources.json');
const DATA_FILE = path.join(__dirname, 'data', 'iris-dupe-cg-canonical-2026-06-22.json');

const JURISDICTION = 'US_federal';
const EXPECTED_SOURCE_IDS = ['src-us-epa-iris-rfd-table-live', 'src-us-epa-iris-chemical-details-live'];

// The EXACT records this tool will ever touch (14 EPA-verified canonical dupe-cg rows). Read via fs.
export const PROMOTION_ROWS = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
export const IRIS_DUPE_CG_CANONICAL_VALUE_IDS = PROMOTION_ROWS.map((r) => r.id);

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
const PROMOTION_STAMP_MARKER = 'PROMOTED to approved';
const STAMPED_PROVENANCE_FIELDS = ['applicability', 'uncertainty', 'review_notes'];

export function parseArgs(argv) {
  const args = { apply: false, reviewer: null, date: null, help: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--apply') args.apply = true;
    else if (a === '--help' || a === '-h') args.help = true;
    else if (a === '--reviewer') args.reviewer = argv[++i];
    else if (a === '--date') args.date = argv[++i];
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

function planOneValueRecord(paramValues, row, expectedIdentity) {
  const valueId = row.id;
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
      'Precondition failed: ' + valueId + ' identity mismatch (the EPA-verified canonical value must match the catalog):\n' +
      identityMismatch.map(([k, v]) => '  ' + k + ': expected ' + JSON.stringify(v) + ', actual ' + JSON.stringify(valueRecord[k])).join('\n'),
    );
  }
  // Per-row source check: source_ids must be EXACTLY [row.sourceId].
  if (!Array.isArray(valueRecord.source_ids) || valueRecord.source_ids.length !== 1 || valueRecord.source_ids[0] !== row.sourceId) {
    throw new Error('Precondition failed: ' + valueId + ' source_ids must be EXACTLY ["' + row.sourceId + '"] (actual: ' + JSON.stringify(valueRecord.source_ids) + ').');
  }
  const nestedSourceRefs = [
    ...(Array.isArray(valueRecord.evidence_items) ? valueRecord.evidence_items.map((ev) => (ev ? ev.source_id : undefined)) : []),
    ...(Array.isArray(valueRecord.source_relationships) ? valueRecord.source_relationships.map((rel) => (rel ? rel.source_id : undefined)) : []),
  ];
  const staleNested = nestedSourceRefs.filter((sid) => sid !== row.sourceId);
  if (staleNested.length > 0) {
    throw new Error('Precondition failed: ' + valueId + ' has nested provenance source ref(s) not equal to ' + row.sourceId + ' (' + JSON.stringify(staleNested) + ').');
  }
  const allEvidenceApproved = valueRecord.evidence_items.every((ev) => ev.qa_status === 'approved' && Boolean(ev.reviewed_by) && Boolean(ev.reviewed_at));
  const allEvidenceNeedsReview = valueRecord.evidence_items.every((ev) => ev.qa_status === 'needs_review');
  const valueAlreadyDone =
    valueRecord.qa_status === 'approved' && valueRecord.evidence_support_status === 'approved_source_backed' &&
    valueRecord.canonical_source_status === 'direct_source_verified' && allEvidenceApproved;
  const valueExpectedPre =
    valueRecord.qa_status === 'needs_review' && valueRecord.evidence_support_status === 'approved_source_backed' &&
    valueRecord.canonical_source_status === 'needs_direct_source_check' && allEvidenceNeedsReview;
  if (!valueAlreadyDone && !valueExpectedPre) {
    const evStates = valueRecord.evidence_items.map((ev) => ev.qa_status);
    throw new Error(
      'Precondition failed: ' + valueId + ' is neither the expected pre-promotion state nor already-promoted.\n' +
      '  actual: qa_status=' + valueRecord.qa_status + ', evidence_support_status=' + valueRecord.evidence_support_status +
      ', canonical_source_status=' + valueRecord.canonical_source_status + ', evidence qa=' + JSON.stringify(evStates),
    );
  }
  return { valueRecord, valueAlreadyDone, promoteValue: !valueAlreadyDone };
}

export function planPromotion(paramValues, sources, _opts) {
  // candidate_group_id uniqueness within the batch (14 rows -> 14 distinct cg). The OTHER members of
  // each cg stay needs_review (verified 0 already approved), so the promoted row is the sole approved.
  const cgCounts = new Map();
  for (const ei of EXPECTED_IDENTITIES) cgCounts.set(ei.candidate_group_id, (cgCounts.get(ei.candidate_group_id) || 0) + 1);
  const dupeGroups = [...cgCounts.entries()].filter(([, n]) => n > 1).map(([cg]) => cg);
  if (dupeGroups.length > 0) {
    throw new Error('Precondition failed: duplicate candidate_group_id(s) in the batch: ' + JSON.stringify(dupeGroups.slice(0, 5)) + '.');
  }
  // Also fail closed if ANY cg already has a DIFFERENT approved member (would create ambiguity).
  for (const ei of EXPECTED_IDENTITIES) {
    const approvedInGroup = paramValues.filter((r) => r.candidate_group_id === ei.candidate_group_id && r.qa_status === 'approved');
    const otherApproved = approvedInGroup.filter((r) => !IRIS_DUPE_CG_CANONICAL_VALUE_IDS.includes(r.parameter_value_id));
    if (otherApproved.length > 0) {
      throw new Error('Precondition failed: candidate_group_id ' + ei.candidate_group_id + ' already has a different approved member (' + JSON.stringify(otherApproved.map((r) => r.parameter_value_id)) + ') -- promoting would create ambiguous frame-seed candidates.');
    }
  }

  const valueResults = PROMOTION_ROWS.map((row, i) => planOneValueRecord(paramValues, row, EXPECTED_IDENTITIES[i]));

  // This lane promotes VALUE rows ONLY. Both IRIS sources were direct-source-verified in #380, so they
  // MUST already be direct_source_verified here -- fail closed otherwise. This lane NEVER promotes a
  // source (that would expand the owner attestation beyond the 14 EPA-verified values). [codex P2]
  const sourceResults = EXPECTED_SOURCE_IDS.map((sourceId) => {
    const sourceRecord = sources.find((s) => s.source_id === sourceId);
    if (!sourceRecord) throw new Error('Precondition failed: source record not found in sources.json: ' + sourceId);
    if (sourceRecord.canonical_source_status !== 'direct_source_verified') {
      throw new Error('Precondition failed: source ' + sourceId + ' must already be direct_source_verified for this value-only lane (actual: "' + sourceRecord.canonical_source_status + '"). This lane never promotes sources; run the source promotion separately first.');
    }
    const srcRole = sourceRecord.calculator_source_role ?? 'canonical_candidate';
    if (sourceRecord.file_storage === 'repo_metadata_only' || srcRole !== 'canonical_candidate' || sourceRecord.currentness_status !== 'current') {
      throw new Error('Precondition failed: source ' + sourceId + ' is not direct-current eligible. file_storage=' + JSON.stringify(sourceRecord.file_storage) + ', role=' + JSON.stringify(srcRole) + ', currentness=' + JSON.stringify(sourceRecord.currentness_status) + '.');
    }
    return { sourceRecord };
  });

  return { valueResults, sourceResults };
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
  // This lane never writes sources.json -- planPromotion already required both sources to be
  // direct_source_verified (fail-closed). Sources are read-only here.
  return plan;
}

const BANNER = [
  '=============================================================================',
  ' promote-iris-dupe-cg-canonical.mjs -- 14 EPA-verified canonical dupe-cg IRIS rows',
  '   (trimethylbenzenes x3, 1,1,1-TCA, RDX; the 61-row dupe-cg set MINUS subchronic/PFAS)',
  '=============================================================================',
  '',
  'VERIFICATION: each value was confirmed against the live US EPA IRIS source 2026-06-22',
  '  (URLs + dates per row in data/iris-dupe-cg-canonical-2026-06-22.json). Running --apply attests it.',
  '',
  'SCOPE: the 14 ids in the data file ONLY. The non-canonical members of each candidate_group_id stay',
  '  needs_review. default_status is NOT changed. PFAS (PFBA/PFDA/PFHxA) are NOT in scope.',
  '',
].join('\n');

const HELP = [
  'promote-iris-dupe-cg-canonical.mjs -- owner-run promotion of 14 EPA-verified canonical dupe-cg rows.',
  '',
  'Usage:',
  '  node scripts/matrix-options/promote-iris-dupe-cg-canonical.mjs --reviewer "<id>" --date YYYY-MM-DD [--apply]',
  '',
  'On --apply each VALUE: qa_status needs_review -> approved; canonical_source_status -> direct_source_verified;',
  '  evidence_items qa -> approved + reviewed_by/at + note stamp; value-level provenance stamped.',
  'AI never runs --apply. Owner runs it; --reviewer/--date are the HITL attestation.',
  'After --apply: npx tsc --noEmit; npm run lint; npm run test:ci',
].join('\n');

function main() {
  const opts = parseArgs(process.argv);
  if (opts.help) { console.log(BANNER); console.log(HELP); return; }
  console.log(BANNER);
  console.log('Mode    : ' + (opts.apply ? 'APPLY (will write files)' : 'DRY RUN (writes nothing)'));
  console.log('reviewer: ' + (opts.reviewer || '(not set)'));
  console.log('date    : ' + (opts.date || '(not set)'));
  console.log('records : ' + IRIS_DUPE_CG_CANONICAL_VALUE_IDS.length + ' VALUE');
  console.log('');
  const paramValues = JSON.parse(fs.readFileSync(HH_TRV_FILE, 'utf8'));
  const sources = JSON.parse(fs.readFileSync(SOURCES_FILE, 'utf8'));
  const plan = planPromotion(paramValues, sources, opts);
  let promote = 0; let skip = 0;
  for (const vr of plan.valueResults) { if (vr.promoteValue) promote++; else skip++; }
  console.log('  VALUE   PROMOTE  ' + promote + ' rows (qa_status -> approved; canonical_source_status -> direct_source_verified)');
  console.log('  VALUE   SKIP     ' + skip + ' rows already in target state');
  for (const sr of plan.sourceResults) {
    console.log('  SOURCE  OK       ' + sr.sourceRecord.source_id + ': already direct_source_verified (this lane never promotes sources)');
  }
  console.log('');
  if (!opts.apply) {
    console.log('DRY RUN -- no file written. Re-run with --apply (plus --reviewer/--date) to write.');
    return;
  }
  validateApplyOptions(opts);
  const stampRepairWouldChange = plan.valueResults.some((vr) => vr.valueAlreadyDone && valueStampRepairNeeded(vr.valueRecord));
  if (promote === 0 && !stampRepairWouldChange) {
    console.log('Nothing to promote (all records already in target state). No write.');
    return;
  }
  const applied = applyPromotion(paramValues, sources, opts);
  const anyValueWrite = applied.valueResults.some((vr) => vr.promoteValue) || applied.valueTouchedFlags.some(Boolean);
  if (anyValueWrite) { fs.writeFileSync(HH_TRV_FILE, JSON.stringify(paramValues, null, 2) + '\n', 'utf8'); console.log('WROTE ' + HH_TRV_FILE); }
  // This lane never writes sources.json (value-only promotion; sources required pre-verified).
  console.log('\nREQUIRED before test:ci: add IRIS_DUPE_CG_CANONICAL_VALUE_IDS to the catalog.test.ts HH tripwire union.');
  console.log('Next: npx tsc --noEmit; npm run lint; npm run test:ci; build; e2e');
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : '';
if (invokedPath === fileURLToPath(import.meta.url)) { main(); }
