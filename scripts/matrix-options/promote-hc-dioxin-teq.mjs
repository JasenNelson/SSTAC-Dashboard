// Owner-run promotion helper for the Health Canada TRV v4.0 (2025) dioxin-like TEQ oral TDI record
// (src-health-canada-trv-v4-2025): 1 value record. Plain ASCII only.
//
// WHY THIS EXISTS
// The Matrix Options Evidence Library carries 1 Health Canada TRV v4.0 (2025) candidate for dioxin-like TEQ.
// It was extracted from the live Health Canada source and verified, so it already carries
// evidence_support_status = 'approved_source_backed' but is still qa_status = 'needs_review'
// (pending the owner's QA attestation) with canonical_source_status = 'needs_direct_source_check'.
// This tool performs the exact, coupled promotion of EXACTLY that 1 pv-hc-* VALUE record, fails
// closed on any precondition, and is idempotent.
//
// CRITICAL SCOPE NOTE: this tool targets the exact 1 pv-hc-* id listed in PROMOTION_ROWS ONLY.
//
// LOAD-BEARING RULES honored:
//  - AI NEVER writes qa_status. This tool is run BY THE OWNER; --reviewer/--date are the owner's HITL
//    attestation. Author + dry-run only for AI.
//  - OWNER VERIFICATION REQUIRED (rule 1): Before running with --apply, the OWNER attests the TRV
//    value matches the primary Health Canada TRV v4.0 (2025) source. Running with --apply attests to that verification.
//  - SCOPE (rule 2): only the 1 listed pv-hc-* record is promoted. default_status is NEVER modified
//    (stays 'available_option').
//  - SOURCE (rule 3): src-health-canada-trv-v4-2025 is expected to ALREADY carry
//    canonical_source_status = 'direct_source_verified'. On the real catalog the SOURCE will SKIP
//    (already-done). The source promotion LOGIC is kept identical (it handles already-done gracefully).
//  - AFTER --apply (rule 4): this promotion is COUPLED with a catalog-tripwire edit. Once --apply
//    flips this row to qa_status='approved' (with the 'TRV' assumption tag + approved_source_backed),
//    the row enters `promotedBeyondFrozen` in
//    src/lib/matrix-options/provenance/__tests__/catalog.test.ts, whose set-equality tripwire requires
//    every such row to be in `sanctionedPromotionIds`. So IN THE SAME --apply COMMIT you MUST add, to
//    that Set, `...HC_DIOXIN_TEQ_PROMOTION_VALUE_IDS` (import it from this file, mirroring the existing
//    `...HC_TRV_V4_2025_PROMOTION_VALUE_IDS` line). Adding it EARLIER (while this row is still
//    needs_review) would BREAK the exact set-equality and turn test:ci RED -- that is why this file
//    ships the candidate as needs_review WITHOUT the sanctioned-set edit. THEN run:
//    npx tsc --noEmit; npm run lint; npm run test:ci.
//
// USAGE (run from anywhere; paths resolve from the script location):
//   node scripts/matrix-options/promote-hc-dioxin-teq.mjs --reviewer "J. Nelson" --date 2026-06-21
//   node scripts/matrix-options/promote-hc-dioxin-teq.mjs --reviewer "J. Nelson" --date 2026-06-21 --apply

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..', '..');
const HH_TRV_FILE = path.join(
  REPO_ROOT, 'matrix_research', 'reference_catalog', 'human_health_trv_values.json',
);
const SOURCES_FILE = path.join(
  REPO_ROOT, 'matrix_research', 'reference_catalog', 'sources.json',
);

export const HC_DIOXIN_TEQ_PROMOTION_SOURCE_ID = 'src-health-canada-trv-v4-2025';
const JURISDICTION = 'Canada_federal';

export const PROMOTION_ROWS = [
  { id: "pv-hc-dioxin-like-teq-hh-direct-oral-tdi", substanceKey: "dioxin_like_teq", pathway: "human-health-direct", inputKey: "oral_tdi_teq_mg_per_kg_bw_day", value: 2.3e-9, unit: "mg/kg-bw/day" }
];

export const HC_DIOXIN_TEQ_PROMOTION_VALUE_IDS = PROMOTION_ROWS.map((r) => r.id);

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

function planOneValueRecord(paramValues, valueId, expectedIdentity) {
  const valueRecord = paramValues.find((r) => r.parameter_value_id === valueId);
  if (!valueRecord) {
    throw new Error(
      'Precondition failed: value record not found in human_health_trv_values.json: ' + valueId,
    );
  }
  if (!Array.isArray(valueRecord.evidence_items) || valueRecord.evidence_items.length === 0) {
    throw new Error('Precondition failed: ' + valueId + ' has no evidence_items');
  }
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
      '\nRefusing to promote a record that cannot seed the human-health frame.',
    );
  }
  if (!Array.isArray(valueRecord.source_ids) ||
      valueRecord.source_ids.length !== 1 ||
      valueRecord.source_ids[0] !== HC_DIOXIN_TEQ_PROMOTION_SOURCE_ID) {
    throw new Error(
      'Precondition failed: ' + valueId + ' source_ids must be EXACTLY ["' +
      HC_DIOXIN_TEQ_PROMOTION_SOURCE_ID + '"] (actual: ' + JSON.stringify(valueRecord.source_ids) +
      '). A second linked source could carry a policy_compilation/reference_mining role that ' +
      'classifyCandidate would block but this single-source helper would miss. Refusing to promote.',
    );
  }
  const nestedSourceRefs = [
    ...(Array.isArray(valueRecord.evidence_items)
      ? valueRecord.evidence_items.map((ev) => (ev ? ev.source_id : undefined))
      : []),
    ...(Array.isArray(valueRecord.source_relationships)
      ? valueRecord.source_relationships.map((rel) => (rel ? rel.source_id : undefined))
      : []),
  ];
  const staleNestedSourceRefs = nestedSourceRefs.filter(
    (sid) => sid !== HC_DIOXIN_TEQ_PROMOTION_SOURCE_ID,
  );
  if (staleNestedSourceRefs.length > 0) {
    throw new Error(
      'Precondition failed: ' + valueId + ' has nested provenance source reference(s) that are not ' +
      'the expected source (' + JSON.stringify(staleNestedSourceRefs) + '). Every ' +
      'evidence_items[*].source_id and source_relationships[*].source_id must be "' +
      HC_DIOXIN_TEQ_PROMOTION_SOURCE_ID + '". Refusing to promote.',
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
      'Precondition failed: ' + valueId +
      ' is not in the expected pre-promotion state nor the already-promoted state.\n' +
      '  expected pre  : qa_status=needs_review, evidence_support_status=approved_source_backed, canonical_source_status=needs_direct_source_check, ALL evidence_items needs_review\n' +
      '  already-done  : qa_status=approved, evidence_support_status=approved_source_backed, canonical_source_status=direct_source_verified, ALL evidence_items approved\n' +
      '  actual        : qa_status=' + valueRecord.qa_status +
      ', evidence_support_status=' + valueRecord.evidence_support_status +
      ', canonical_source_status=' + valueRecord.canonical_source_status +
      ', evidence_items qa=' + JSON.stringify(evStates) + '\n' +
      'Refusing to promote a drifted/partially-promoted record.',
    );
  }

  return { valueRecord, valueAlreadyDone, promoteValue: !valueAlreadyDone };
}

export function planPromotion(paramValues, sources, _opts) {
  const valueResults = HC_DIOXIN_TEQ_PROMOTION_VALUE_IDS.map((valueId, i) =>
    planOneValueRecord(paramValues, valueId, EXPECTED_IDENTITIES[i]),
  );

  const sourceRecord = sources.find(
    (s) => s.source_id === HC_DIOXIN_TEQ_PROMOTION_SOURCE_ID,
  );
  if (!sourceRecord) {
    throw new Error(
      'Precondition failed: source record not found in sources.json: ' +
      HC_DIOXIN_TEQ_PROMOTION_SOURCE_ID,
    );
  }
  const csStatus = sourceRecord.canonical_source_status;
  const sourceAlreadyDone = csStatus === 'direct_source_verified';
  const sourceExpectedPre = csStatus === 'needs_direct_source_check';
  if (!sourceAlreadyDone && !sourceExpectedPre) {
    throw new Error(
      'Precondition failed: source ' + HC_DIOXIN_TEQ_PROMOTION_SOURCE_ID +
      ' canonical_source_status="' + csStatus +
      '" is neither needs_direct_source_check (promotable) nor direct_source_verified (done). ' +
      'Refusing to promote a drifted source.',
    );
  }

  const srcRole = sourceRecord.calculator_source_role ?? 'canonical_candidate';
  for (const { valueRecord } of valueResults) {
    const relationshipRoles = Array.isArray(valueRecord.source_relationships)
      ? valueRecord.source_relationships.map((r) => (r ? r.role : null))
      : [];
    const allRoles = [srcRole, ...relationshipRoles];
    if (allRoles.includes('policy_compilation') || allRoles.includes('reference_mining')) {
      throw new Error(
        'Precondition failed: ' + valueRecord.parameter_value_id + ' has a source role of ' +
        'policy_compilation/reference_mining (roles: ' + JSON.stringify(allRoles) + '). ' +
        'classifyCandidate would block such a record; refusing to promote.',
      );
    }
  }
  if (
    sourceRecord.file_storage === 'repo_metadata_only' ||
    srcRole !== 'canonical_candidate' ||
    sourceRecord.currentness_status !== 'current'
  ) {
    throw new Error(
      'Precondition failed: source ' + HC_DIOXIN_TEQ_PROMOTION_SOURCE_ID +
      ' is not direct-current eligible. isDirectCurrentSource requires file_storage != ' +
      'repo_metadata_only, calculator_source_role = canonical_candidate, currentness_status = ' +
      'current. Actual: file_storage=' + JSON.stringify(sourceRecord.file_storage) +
      ', calculator_source_role=' + JSON.stringify(srcRole) +
      ', currentness_status=' + JSON.stringify(sourceRecord.currentness_status) + '.',
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
  if (typeof out.note === 'string' && out.note.length > 0 && !out.note.includes(PROMOTION_STAMP_MARKER)) {
    out.note += buildEvidenceNoteStamp(date, reviewer);
  }
  return out;
}

const PROMOTION_STAMP_MARKER = 'PROMOTED to approved';
const STAMPED_PROVENANCE_FIELDS = ['applicability', 'uncertainty', 'review_notes'];

function buildValueStamp(date, reviewer) {
  return (
    ' [PROMOTED to approved (qa_status approved, source direct_source_verified) on ' +
    date + ' by ' + reviewer + '; the needs_review language above is superseded.]'
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
  return (
    STAMPED_PROVENANCE_FIELDS.some(
      (field) =>
        typeof r[field] === 'string' &&
        r[field].length > 0 &&
        !r[field].includes(PROMOTION_STAMP_MARKER),
    ) || evidenceNoteRepairNeeded(r)
  );
}

// ---------------------------------------------------------------------------
// Apply
// ---------------------------------------------------------------------------

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
      touched = true;
    } else if (vr.valueAlreadyDone) {
      const provChanged = stampValueProvenance(vr.valueRecord, opts.date, opts.reviewer);
      const noteChanged = stampEvidenceNotes(vr.valueRecord, opts.date, opts.reviewer);
      touched = provChanged || noteChanged;
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
  ' promote-hc-dioxin-teq.mjs -- owner-run Health Canada TRV v4.0 (2025) promotion',
  '   (1 human-health TRV row for dioxin-like TEQ oral TDI)',
  '=============================================================================',
].join('\n');

const HELP = [
  'promote-hc-dioxin-teq.mjs -- owner-run Health Canada TRV v4.0 (2025) promotion.',
  'Usage:',
  '  node scripts/matrix-options/promote-hc-dioxin-teq.mjs --reviewer "<id>" --date YYYY-MM-DD [--apply]',
].join('\n');

function printPlan(plan) {
  for (let i = 0; i < plan.valueResults.length; i++) {
    const vr = plan.valueResults[i];
    const valueId = HC_DIOXIN_TEQ_PROMOTION_VALUE_IDS[i];
    if (vr.promoteValue) {
      const r = vr.valueRecord;
      console.log('  VALUE   PROMOTE  ' + valueId);
    } else {
      console.log('  VALUE   SKIP     ' + valueId + ': already in target state (no-op)');
    }
  }
  if (plan.promoteSource) {
    console.log('  SOURCE  PROMOTE  ' + HC_DIOXIN_TEQ_PROMOTION_SOURCE_ID);
  } else {
    console.log('  SOURCE  SKIP     ' + HC_DIOXIN_TEQ_PROMOTION_SOURCE_ID + ': already in target state (no-op)');
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
  const paramValues = JSON.parse(fs.readFileSync(HH_TRV_FILE, 'utf8'));
  const sources = JSON.parse(fs.readFileSync(SOURCES_FILE, 'utf8'));

  const plan = planPromotion(paramValues, sources, opts);
  printPlan(plan);

  if (!opts.apply) {
    console.log('DRY RUN -- no file written.');
    return;
  }

  validateApplyOptions(opts);

  const sourceWillBeVerified = plan.promoteSource || plan.sourceAlreadyDone;
  const anyValueWillBeApproved = plan.valueResults.some((vr) => vr.promoteValue || vr.valueAlreadyDone);
  const effUrl = opts.sourceUrl || plan.sourceRecord.url;
  const effKey = opts.zoteroKey || plan.sourceRecord.zotero_item_key;
  if (anyValueWillBeApproved && sourceWillBeVerified && !effUrl && !effKey) {
    throw new Error(
      'Provenance guard: value records would be approved against source ' +
      HC_DIOXIN_TEQ_PROMOTION_SOURCE_ID + ' (direct_source_verified), but that source has no durable' +
      ' locator (url=null, zotero_item_key=null).\n' +
      'Provide --source-url "<url>" and/or --zotero-key "<Zotero item key>".',
    );
  }

  const applied = applyPromotion(paramValues, sources, opts);

  const anyValueWrite =
    applied.valueResults.some((vr) => vr.promoteValue) ||
    applied.valueTouchedFlags.some(Boolean);
  if (anyValueWrite) {
    fs.writeFileSync(HH_TRV_FILE, JSON.stringify(paramValues, null, 2) + '\n', 'utf8');
    console.log('WROTE ' + HH_TRV_FILE);
  }
  if (applied.promoteSource || applied.sourceTouched) {
    fs.writeFileSync(SOURCES_FILE, JSON.stringify(sources, null, 2) + '\n', 'utf8');
    console.log('WROTE ' + SOURCES_FILE);
  }
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : '';
if (invokedPath === fileURLToPath(import.meta.url)) {
  main();
}
