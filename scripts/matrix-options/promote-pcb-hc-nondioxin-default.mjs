// Owner-run default-selection helper for the Total PCBs (Aroclor 1254) human-health oral RfD.
// Plain ASCII only.
//
// WHY THIS EXISTS
// The owner (QP) ruled 2026-07-16 that the Health Canada non-dioxin-like PCB oral RfD
// (1.0e-5 mg/kg-bw/day, src-health-canada-trv-v4-2025, crystallized 2025-10-15) becomes the
// human-health default candidate for total_pcbs_aroclor_1254, ahead of the US EPA IRIS
// Aroclor 1254 oral RfD (2.0e-5 mg/kg-bw/day, last updated 1994-10-01): HC is BOTH more
// conservative (protective) AND newer than IRIS, and Protocol 1's source hierarchy prefers
// Health Canada over US EPA when both are otherwise eligible (see
// feedback_protocol1_hierarchy_hc_default_epa_when_newer_defensible.md). dl-PCBs are handled via
// a separate TEQ pathway and are not affected by this change.
//
// SCOPE: this tool performs a SINGLE coupled operation across TWO catalog files:
//   (A) PROMOTE 2 already-approved rows in human_health_trv_values.json:
//         pv-hc-pcb-hh-direct-rfd-nondioxin (human-health-direct)  available_option -> current_default
//         pv-hc-pcb-hh-food-rfd-nondioxin   (human-health-food)    available_option -> current_default
//       Both rows are ALREADY qa_status=approved / evidence_support_status=approved_source_backed /
//       canonical_source_status=direct_source_verified (frozen 2026-05-23 HC TRV v4.0 batch) -- this
//       tool does NOT touch those fields, or value, or evidence_items, for these 2 rows. Pure
//       default_status flip plus an idempotent display stamp on review_notes.
//   (B) DISPOSE 2 legacy current-calculator scaffold rows in parameter_values.json that were
//       DISCOVERED to already hold default_status=current_default for the SAME two tuples (a
//       tuple-uniqueness conflict the first draft of this tool's guard caught -- see below):
//         pv-pcb-hh-direct-rfd (human-health-direct)  current_default -> available_option, needs_review -> superseded
//         pv-pcb-hh-food-rfd   (human-health-food)    current_default -> available_option, needs_review -> superseded
//       (top-level qa_status AND every nested evidence_items[].qa_status). value is UNCHANGED
//       (0.00002 mg/kg-bw/day; the row is retained as an audit trail, never deleted). This mirrors
//       promote-copper-hc0426.mjs's disposal of copper's analogous scaffold rows exactly, except
//       here the scaffold ALSO held default_status=current_default (copper's did not), so this tool
//       additionally flips default_status as part of the SAME disposal.
//
// (A) and (B) are coupled: without (B), promoting the HC rows to current_default would leave TWO
// current_default rows per tuple (the HC row AND the still-current_default scaffold), which
// catalog.test.ts's per-tuple pin ("keeps the owner-approved current_default row for each 2026-07-05
// default-selection tuple" and the runtime PARAMETER_VALUE_RECORDS -- see
// src/lib/matrix-options/provenance/catalog.ts -- concatenates parameter_values.json +
// human_health_trv_values.json + eco_values.json into ONE candidate pool) explicitly forbids. This
// tool refuses to run unless BOTH sides can be completed together (fail-closed), and writes BOTH
// files atomically (all-or-nothing).
//
// The 2 competing US EPA IRIS Aroclor 1254 rows (pv-iris-pcb-hh-direct-rfd-aroclor1254 /
// pv-iris-pcb-hh-food-rfd-aroclor1254) are READ-ONLY sanity-checked (must still be
// default_status=available_option) and are NEVER mutated by this tool.
//
// It mirrors promote-copper-hc0426.mjs in structure and fail-closed discipline (duplicate-id
// guard, all-or-nothing write with rollback across BOTH files, postcondition re-read verification,
// disposal evidence-item rebuild) and promote-hc-trv-v4-2025.mjs / promote-wlrs-default.mjs for the
// frame-eligible identity check and nested-source-provenance guard on the promotion side.
//
// LOAD-BEARING RULES honored:
//  - AI NEVER writes default_status / qa_status without HITL attestation. This tool is run BY THE
//    OWNER; --reviewer/--date are the owner's HITL attestation. Author + dry-run only for AI.
//  - SCOPE: only the 2 promote targets + 2 disposal targets are touched. On the promote side,
//    qa_status / evidence_support_status / canonical_source_status / value / evidence_items are
//    UNCHANGED (already approved + source verified). On the disposal side, value is UNCHANGED
//    (retained as audit trail). The 2 pv-iris-* rows are confirmed unchanged, never mutated.
//  - TUPLE-UNIQUENESS GUARD: refuses to run if any row OTHER than the 2 known disposal targets
//    already holds default_status=current_default in the same (substance_key, input_key, pathway)
//    tuple as a promotion target -- promoting would otherwise create more than one current_default
//    in a tuple, which catalog.test.ts's per-tuple pin explicitly forbids. The 2 known disposal
//    targets are excluded from that check ONLY after their own disposal preconditions have been
//    independently validated (fail-closed) -- see planOneDisposalRow.
//  - GUARD-COUNT IMPACT (owner must update in the SAME commit as --apply, before test:ci): promoting
//    2 rows to current_default while ALSO demoting 2 scaffold rows off current_default is a NET-ZERO
//    change to audit.values.currentDefaults AND a NET-ZERO change to audit.values.availableOptions
//    (the 2 HC rows leave available_option, but the 2 scaffolds move current_default -> available_option
//    and RE-ENTER that count -- countByStatus is qa_status-agnostic -- so they offset). There is NO
//    dedicated superseded counter in EvidenceLibraryAudit.values, so the scaffold qa->superseded flips
//    shift no audit count. Also update APPROVED_CURRENT_DEFAULT_IDS and the PCB-mapping test in catalog.test.ts, and any
//    test asserting the scaffold rows' pre-disposal state (mirroring how copper's 3 guard tests were
//    handled -- fix, do not delete, per cross_project_never_delete_regression_tests_during_cleanup).
//
// USAGE (run from anywhere; paths resolve from the script location):
//   node scripts/matrix-options/promote-pcb-hc-nondioxin-default.mjs --reviewer "J. Nelson" --date 2026-07-16
//   node scripts/matrix-options/promote-pcb-hc-nondioxin-default.mjs --reviewer "J. Nelson" --date 2026-07-16 --apply
//
// Default is a DRY RUN (prints the per-record plan, writes nothing). --apply writes BOTH
// matrix_research/reference_catalog/human_health_trv_values.json (2 promotions) AND
// matrix_research/reference_catalog/parameter_values.json (2 disposals), atomically.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..', '..');
const HH_TRV_FILE = path.join(
  REPO_ROOT, 'matrix_research', 'reference_catalog', 'human_health_trv_values.json',
);
const PARAM_VALUES_FILE = path.join(
  REPO_ROOT, 'matrix_research', 'reference_catalog', 'parameter_values.json',
);

export const PCB_HC_DEFAULT_SOURCE_ID = 'src-health-canada-trv-v4-2025';
const SCAFFOLD_SOURCE_ID = 'src-current-calculator-design-v1';
const JURISDICTION = 'Canada_federal';
const SUBSTANCE_KEY = 'total_pcbs_aroclor_1254';
const INPUT_KEY = 'rfd_oral_mg_per_kg_bw_day';
const HC_VALUE = 0.00001;
const SCAFFOLD_VALUE = 0.00002;
const UNIT = 'mg/kg-bw/day';

// -- (A) PROMOTE targets (human_health_trv_values.json) --
// The EXACT 2 records this tool will ever promote. Exported so a test could build fixtures
// without re-typing the table.
export const PROMOTION_ROWS = [
  {
    id: 'pv-hc-pcb-hh-direct-rfd-nondioxin',
    pathway: 'human-health-direct',
  },
  {
    id: 'pv-hc-pcb-hh-food-rfd-nondioxin',
    pathway: 'human-health-food',
  },
];

export const PCB_HC_DEFAULT_VALUE_IDS = PROMOTION_ROWS.map((r) => r.id);

// Derived expected identity per promoted record (every scalar field the frame-default pipeline
// examines, per promote-hc-trv-v4-2025.mjs / promote-wlrs-default.mjs precedent). default_status is
// DELIBERATELY excluded here -- it is the field this tool transitions, handled by the
// pre/already-done state check below, not the fixed-identity check.
const EXPECTED_IDENTITIES = PROMOTION_ROWS.map((r) => ({
  jurisdiction: JURISDICTION,
  candidate_group_id: r.pathway + '__' + SUBSTANCE_KEY + '__' + INPUT_KEY + '__' + JURISDICTION,
  pathway: r.pathway,
  input_key: INPUT_KEY,
  substance_key: SUBSTANCE_KEY,
  value: HC_VALUE,
  unit: UNIT,
  value_type: 'single_value',
}));

// -- (B) DISPOSE targets (parameter_values.json) --
// The EXACT 2 legacy current-calculator scaffold records this tool will ever dispose. Discovered
// via the tuple-uniqueness guard: both already hold default_status=current_default for the SAME
// tuples the 2 promote targets above seed, which would otherwise leave 2 current_default rows per
// tuple after promotion.
export const DISPOSAL_ROWS = [
  { id: 'pv-pcb-hh-direct-rfd', pathway: 'human-health-direct' },
  { id: 'pv-pcb-hh-food-rfd', pathway: 'human-health-food' },
];

export const PCB_SCAFFOLD_DISPOSAL_IDS = DISPOSAL_ROWS.map((r) => r.id);

const DISPOSAL_RATIONALE =
  'Superseded: the Health Canada v4.0 non-dioxin-like PCB oral TDI (1.0e-5 mg/kg-bw/day, ' +
  PCB_HC_DEFAULT_SOURCE_ID + ') is now the human-health default for total_pcbs_aroclor_1254; this ' +
  'unsourced current-calculator scaffold (' + SCAFFOLD_SOURCE_ID + ', 2.0e-5 mg/kg-bw/day) is a ' +
  'redundant placeholder and is demoted off current_default.';

// The competing US EPA IRIS Aroclor 1254 rows: READ-ONLY sanity check (never mutated). If either
// has already drifted to current_default, this tool must refuse (that drift would mean the tuple
// already has a different current_default -- see the tuple-uniqueness guard below, which would
// also catch it, but this explicit confirm gives a clearer error message for the known pair).
const IRIS_CONFIRM_ROWS = [
  {
    id: 'pv-iris-pcb-hh-direct-rfd-aroclor1254',
    value: SCAFFOLD_VALUE,
    defaultStatus: 'available_option',
    qaStatus: 'approved',
  },
  {
    id: 'pv-iris-pcb-hh-food-rfd-aroclor1254',
    value: SCAFFOLD_VALUE,
    defaultStatus: 'available_option',
    qaStatus: 'approved',
  },
];

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// ---------------------------------------------------------------------------
// Arg parsing
// ---------------------------------------------------------------------------

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
    errors.push('--reviewer "<id/name>" is required for --apply (it becomes the promotion/disposal stamp attestation)');
  }
  if (!opts.date || !DATE_RE.test(opts.date)) {
    errors.push('--date YYYY-MM-DD is required for --apply (it becomes the promotion/disposal stamp date)');
  }
  if (errors.length) throw new Error('Invalid --apply options:\n  - ' + errors.join('\n  - '));
}

// ---------------------------------------------------------------------------
// Plan
// ---------------------------------------------------------------------------

function findById(records, id) {
  return records.find((r) => r.parameter_value_id === id);
}

function countById(records, id) {
  return records.filter((r) => r.parameter_value_id === id).length;
}

// Fail-closed precondition (runs in BOTH dry-run and --apply, before any mutation): every id this
// tool touches must appear EXACTLY ONCE in its catalog file. A duplicated (or missing)
// parameter_value_id would let a first-match lookup silently mutate/verify only one of several
// matching rows while the run still "succeeds". Abort with no writes if any id has 0 or >1 matches.
function assertUniqueIds(records, ids, fileLabel) {
  const problems = [];
  for (const id of ids) {
    const count = countById(records, id);
    if (count !== 1) {
      problems.push(id + ': found ' + count + ' matching row(s) in ' + fileLabel + ' (expected exactly 1)');
    }
  }
  if (problems.length > 0) {
    throw new Error(
      'Precondition failed: duplicate-id/missing-id guard tripped in ' + fileLabel + ':\n  ' +
      problems.join('\n  ') +
      '\nRefusing to proceed -- a non-unique parameter_value_id would let the first-match lookup ' +
      'silently mutate/verify only one of several matching rows while reporting success. No writes performed.',
    );
  }
}

function planOneConfirmRow(confirmRow, hhTrvRecords) {
  const record = findById(hhTrvRecords, confirmRow.id);
  if (!record) {
    throw new Error('Precondition failed: IRIS confirm record not found: ' + confirmRow.id);
  }
  const mismatches = [];
  if (record.value !== confirmRow.value) {
    mismatches.push('value: expected ' + confirmRow.value + ', actual ' + JSON.stringify(record.value));
  }
  if (record.default_status !== confirmRow.defaultStatus) {
    mismatches.push(
      'default_status: expected ' + confirmRow.defaultStatus + ', actual ' +
      JSON.stringify(record.default_status),
    );
  }
  if (record.qa_status !== confirmRow.qaStatus) {
    mismatches.push('qa_status: expected ' + confirmRow.qaStatus + ', actual ' + JSON.stringify(record.qa_status));
  }
  if (mismatches.length > 0) {
    throw new Error(
      'Precondition failed: IRIS confirm row ' + confirmRow.id + ' has drifted from the documented ' +
      'pre-state (this row is NEVER mutated by this tool; it is a sanity check that the competing ' +
      'US EPA IRIS Aroclor 1254 candidate has not itself been promoted to current_default). ' +
      'Mismatch(es):\n  ' + mismatches.join('\n  ') + '\nRefusing to proceed.',
    );
  }
  return record;
}

// Computes the default-selection plan for a single PROMOTE record and enforces preconditions
// (fail-closed). PRE-STATE: qa_status=approved, evidence_support_status=approved_source_backed,
// canonical_source_status=direct_source_verified, default_status=available_option, source_ids
// EXACTLY [HC source], all evidence_items approved + attested. ALREADY-DONE state: identical
// except default_status=current_default. Anything else aborts.
//
// excludedTupleIds: parameter_value_ids to EXCLUDE from the tuple-uniqueness "other current_default"
// scan -- these are the DISPOSAL targets, whose own preconditions have ALREADY been validated
// (fail-closed) by the time this runs (see planPromotion, which computes disposalResults first), so
// excluding them here is safe: by the time this check runs, they are guaranteed to either already be
// off current_default, or be validated-and-about-to-be-moved-off-current_default by THIS SAME
// coupled operation.
function planOneValueRecord(hhTrvRecords, valueId, expectedIdentity, allCatalogRecords, excludedTupleIds) {
  const record = findById(hhTrvRecords, valueId);
  if (!record) {
    throw new Error(
      'Precondition failed: value record not found in human_health_trv_values.json: ' + valueId,
    );
  }
  if (!Array.isArray(record.evidence_items) || record.evidence_items.length === 0) {
    throw new Error('Precondition failed: ' + valueId + ' has no evidence_items');
  }

  // Fixed-identity check (every field EXCEPT default_status, which this tool transitions).
  const identityMismatch = Object.entries(expectedIdentity).filter(
    ([k, v]) => record[k] !== v,
  );
  if (identityMismatch.length > 0) {
    throw new Error(
      'Precondition failed: ' + valueId +
      ' is not in the expected identity. Mismatched field(s):\n' +
      identityMismatch
        .map(([k, v]) => '  ' + k + ': expected ' + JSON.stringify(v) +
          ', actual ' + JSON.stringify(record[k]))
        .join('\n') +
      '\nRefusing to promote a record that does not match the verified HC non-dioxin-like PCB oral RfD.',
    );
  }

  // source_ids must be EXACTLY [HC TRV source]. A second linked source could carry a role the
  // frame-default pipeline would treat differently; keep this helper's scope single-source-exact.
  if (!Array.isArray(record.source_ids) ||
      record.source_ids.length !== 1 ||
      record.source_ids[0] !== PCB_HC_DEFAULT_SOURCE_ID) {
    throw new Error(
      'Precondition failed: ' + valueId + ' source_ids must be EXACTLY ["' +
      PCB_HC_DEFAULT_SOURCE_ID + '"] (actual: ' + JSON.stringify(record.source_ids) +
      '). Refusing to promote.',
    );
  }
  // Nested-source provenance guard: every evidence_items[*].source_id and
  // source_relationships[*].source_id must be the HC TRV source (a stale nested ref would survive
  // as approved provenance behind a correct top-level source_ids).
  const nestedSourceRefs = [
    ...(Array.isArray(record.evidence_items)
      ? record.evidence_items.map((ev) => (ev ? ev.source_id : undefined))
      : []),
    ...(Array.isArray(record.source_relationships)
      ? record.source_relationships.map((rel) => (rel ? rel.source_id : undefined))
      : []),
  ];
  const staleNestedSourceRefs = nestedSourceRefs.filter((sid) => sid !== PCB_HC_DEFAULT_SOURCE_ID);
  if (staleNestedSourceRefs.length > 0) {
    throw new Error(
      'Precondition failed: ' + valueId + ' has nested provenance source reference(s) that are not ' +
      'the expected source (' + JSON.stringify(staleNestedSourceRefs) + '). Refusing to promote.',
    );
  }

  // This tool assumes the row is ALREADY fully QA-approved and source-verified (the frozen
  // 2026-05-23 HC TRV v4.0 batch); it never mutates qa_status / evidence_support_status /
  // canonical_source_status. Fail closed if that assumption has drifted.
  const allEvidenceApproved = record.evidence_items.every(
    (ev) => ev.qa_status === 'approved' && Boolean(ev.reviewed_by) && Boolean(ev.reviewed_at),
  );
  if (
    record.qa_status !== 'approved' ||
    record.evidence_support_status !== 'approved_source_backed' ||
    record.canonical_source_status !== 'direct_source_verified' ||
    !allEvidenceApproved
  ) {
    throw new Error(
      'Precondition failed: ' + valueId + ' is not in the expected already-QA-approved state this ' +
      'tool requires (qa_status=approved, evidence_support_status=approved_source_backed, ' +
      'canonical_source_status=direct_source_verified, all evidence_items approved + attested).\n' +
      '  actual: qa_status=' + record.qa_status +
      ', evidence_support_status=' + record.evidence_support_status +
      ', canonical_source_status=' + record.canonical_source_status +
      ', evidence_items qa=' + JSON.stringify(record.evidence_items.map((ev) => ev.qa_status)) + '\n' +
      'This tool only flips default_status; it does not perform QA promotion. Refusing to proceed.',
    );
  }

  // default_status pre/already-done state check.
  const alreadyDone = record.default_status === 'current_default';
  const expectedPre = record.default_status === 'available_option';
  if (!alreadyDone && !expectedPre) {
    throw new Error(
      'Precondition failed: ' + valueId + ' default_status="' + record.default_status +
      '" is neither available_option (promotable) nor current_default (already-done). ' +
      'Refusing to promote a drifted record.',
    );
  }

  // Tuple-uniqueness guard: refuse if any OTHER row (not this record, not a known + validated
  // disposal target) in this (substance_key, input_key, pathway) tuple already holds
  // default_status=current_default. Scans allCatalogRecords (the parameter_values.json +
  // human_health_trv_values.json union -- the same composition as the runtime
  // PARAMETER_VALUE_RECORDS), NOT just hhTrvRecords, so a current_default row living in
  // parameter_values.json cannot be missed.
  const tupleOthers = allCatalogRecords.filter(
    (r) =>
      r.substance_key === record.substance_key &&
      r.input_key === record.input_key &&
      r.pathway === record.pathway &&
      r.parameter_value_id !== record.parameter_value_id &&
      !excludedTupleIds.includes(r.parameter_value_id) &&
      r.default_status === 'current_default',
  );
  if (tupleOthers.length > 0) {
    throw new Error(
      'Precondition failed: ' + valueId + ' tuple (' + record.substance_key + ' / ' +
      record.input_key + ' / ' + record.pathway + ') already has an UNEXPECTED current_default row: ' +
      JSON.stringify(tupleOthers.map((r) => r.parameter_value_id)) +
      ' (not one of the ' + excludedTupleIds.length + ' known + validated disposal targets). ' +
      'Promoting this record would leave more than one current_default in the tuple. ' +
      'Demote the other row first (a separate, owner-attested action), or resolve the conflict ' +
      'before running this tool. No writes performed.',
    );
  }

  return { record, alreadyDone, promote: !alreadyDone };
}

// Computes the disposal plan for a single scaffold record and enforces preconditions (fail-closed).
// PRE-STATE: default_status=current_default, qa_status=needs_review, value=0.00002 (fixed),
// source_ids EXACTLY [scaffold source], exactly ONE evidence_items entry, that entry also
// qa_status=needs_review. ALREADY-DONE state: default_status=available_option, qa_status=superseded,
// the evidence item also qa_status=superseded. Anything else aborts.
function planOneDisposalRow(row, paramValueRecords) {
  const record = findById(paramValueRecords, row.id);
  if (!record) {
    throw new Error('Precondition failed: scaffold record not found in parameter_values.json: ' + row.id);
  }
  if (record.value !== SCAFFOLD_VALUE) {
    throw new Error(
      'Precondition failed: ' + row.id + ' value mismatch. expected=' + SCAFFOLD_VALUE +
      ' actual=' + JSON.stringify(record.value) + '. Refusing to dispose a drifted record.',
    );
  }
  if (
    record.substance_key !== SUBSTANCE_KEY ||
    record.input_key !== INPUT_KEY ||
    record.pathway !== row.pathway
  ) {
    throw new Error(
      'Precondition failed: ' + row.id + ' identity mismatch. expected substance_key=' + SUBSTANCE_KEY +
      ' input_key=' + INPUT_KEY + ' pathway=' + row.pathway + '; actual substance_key=' +
      JSON.stringify(record.substance_key) + ' input_key=' + JSON.stringify(record.input_key) +
      ' pathway=' + JSON.stringify(record.pathway) + '. Refusing to dispose a drifted record.',
    );
  }
  if (!Array.isArray(record.source_ids) || record.source_ids.length !== 1 ||
      record.source_ids[0] !== SCAFFOLD_SOURCE_ID) {
    throw new Error(
      'Precondition failed: ' + row.id + ' source_ids must be EXACTLY ["' + SCAFFOLD_SOURCE_ID +
      '"] (actual: ' + JSON.stringify(record.source_ids) +
      '). Refusing to dispose a row that is not the expected unsourced scaffold.',
    );
  }
  if (!Array.isArray(record.evidence_items) || record.evidence_items.length !== 1) {
    throw new Error(
      'Precondition failed: ' + row.id + ' must have EXACTLY one evidence_items entry (actual: ' +
      (Array.isArray(record.evidence_items) ? record.evidence_items.length : 'not an array') + ').',
    );
  }
  const ev = record.evidence_items[0];
  const expectedPre =
    record.default_status === 'current_default' &&
    record.qa_status === 'needs_review' &&
    ev.qa_status === 'needs_review';
  const alreadyDone =
    record.default_status === 'available_option' &&
    record.qa_status === 'superseded' &&
    ev.qa_status === 'superseded';
  if (!expectedPre && !alreadyDone) {
    throw new Error(
      'Precondition failed: ' + row.id +
      ' is not in the expected pre-disposal state nor the already-disposed state.\n' +
      '  expected pre  : default_status=current_default, qa_status=needs_review, evidence_items[0].qa_status=needs_review\n' +
      '  already-done  : default_status=available_option, qa_status=superseded, evidence_items[0].qa_status=superseded\n' +
      '  actual        : default_status=' + record.default_status + ', qa_status=' + record.qa_status +
      ', evidence_items[0].qa_status=' + ev.qa_status + '\n' +
      'Refusing to dispose a drifted/partially-disposed record.',
    );
  }
  return { row, record, alreadyDone, dispose: !alreadyDone };
}

// Computes the FULL coupled plan: 2 IRIS read-only confirms + 2 disposals (validated FIRST, so
// their outcome can safely exclude them from the promote side's tuple-uniqueness scan) + 2
// promotions. Idempotent (records already in target state are SKIPPED).
export function planPromotion(hhTrvRecords, paramValueRecords, _opts) {
  assertUniqueIds(
    hhTrvRecords,
    [...PCB_HC_DEFAULT_VALUE_IDS, ...IRIS_CONFIRM_ROWS.map((r) => r.id)],
    'human_health_trv_values.json',
  );
  assertUniqueIds(paramValueRecords, PCB_SCAFFOLD_DISPOSAL_IDS, 'parameter_values.json');

  const confirmResults = IRIS_CONFIRM_ROWS.map((r) => planOneConfirmRow(r, hhTrvRecords));

  // Disposal preconditions validated FIRST (fail-closed) -- if either scaffold has drifted from its
  // documented pre/already-done state, this throws BEFORE any promotion is planned, so the coupled
  // operation never partially plans.
  const disposalResults = DISPOSAL_ROWS.map((row) => planOneDisposalRow(row, paramValueRecords));

  const allCatalogRecords = [...paramValueRecords, ...hhTrvRecords];
  const valueResults = PROMOTION_ROWS.map((row, i) =>
    planOneValueRecord(
      hhTrvRecords, row.id, EXPECTED_IDENTITIES[i], allCatalogRecords, PCB_SCAFFOLD_DISPOSAL_IDS,
    ),
  );

  return { confirmResults, valueResults, disposalResults };
}

// ---------------------------------------------------------------------------
// Display stamps
// ---------------------------------------------------------------------------

// -- (A) Promotion stamp (review_notes only -- no qa_status / evidence_items mutation on these rows) --
const PROMOTION_STAMP_MARKER = 'PROMOTED to current_default';

function buildPromotionStamp(date, reviewer) {
  return (
    ' [' + PROMOTION_STAMP_MARKER + ' on ' + date + ' by ' + reviewer +
    '; owner/QP ruling 2026-07-16: HC non-dioxin-like PCB oral TDI (1.0e-5) is the human-health ' +
    'default for total_pcbs_aroclor_1254 (more protective + newer than IRIS Aroclor 1254 2.0e-5 / ' +
    '1994); the prior "read-only source-backed library value" language above is superseded.]'
  );
}

function stampReviewNotes(r, date, reviewer) {
  const stamp = buildPromotionStamp(date, reviewer);
  if (typeof r.review_notes === 'string' && r.review_notes.length > 0 &&
      !r.review_notes.includes(PROMOTION_STAMP_MARKER)) {
    r.review_notes += stamp;
    return true;
  }
  return false;
}

function promotionStampNeeded(r) {
  return (
    typeof r.review_notes === 'string' && r.review_notes.length > 0 &&
    !r.review_notes.includes(PROMOTION_STAMP_MARKER)
  );
}

// -- (B) Disposal stamp (mirrors promote-copper-hc0426.mjs's disposeEvidence / stampRecordProvenance) --
const DISPOSAL_STAMP_MARKER = 'SUPERSEDED (disposed)';
const DISPOSAL_STAMPED_FIELDS = ['applicability', 'uncertainty', 'review_notes'];

function buildDisposalStamp(date, reviewer) {
  return ' [' + DISPOSAL_STAMP_MARKER + ' on ' + date + ' by ' + reviewer + '. ' + DISPOSAL_RATIONALE + ']';
}

function disposeEvidence(ev, reviewer, date) {
  const out = {};
  for (const [k, v] of Object.entries(ev)) {
    if (k === 'qa_status') {
      out.qa_status = 'superseded';
      out.reviewed_by = reviewer;
      out.reviewed_at = date;
    } else if (k === 'reviewed_by' || k === 'reviewed_at') {
      continue;
    } else {
      out[k] = v;
    }
  }
  if (!('qa_status' in out)) {
    out.qa_status = 'superseded';
    out.reviewed_by = reviewer;
    out.reviewed_at = date;
  }
  if (typeof out.note === 'string' && out.note.length > 0 && !out.note.includes(DISPOSAL_STAMP_MARKER)) {
    out.note += buildDisposalStamp(date, reviewer);
  }
  return out;
}

function stampDisposalProvenance(r, date, reviewer) {
  const stamp = buildDisposalStamp(date, reviewer);
  let changed = false;
  for (const field of DISPOSAL_STAMPED_FIELDS) {
    const v = r[field];
    if (typeof v === 'string' && v.length > 0 && !v.includes(DISPOSAL_STAMP_MARKER)) {
      r[field] = v + stamp;
      changed = true;
    }
  }
  return changed;
}

function disposalStampNeeded(r) {
  return DISPOSAL_STAMPED_FIELDS.some(
    (field) => typeof r[field] === 'string' && r[field].length > 0 && !r[field].includes(DISPOSAL_STAMP_MARKER),
  );
}

// ---------------------------------------------------------------------------
// Apply (in-place mutation of the parsed records; ONLY the 2 promote + 2 dispose records are touched)
// ---------------------------------------------------------------------------

export function applyPromotion(hhTrvRecords, paramValueRecords, opts) {
  const plan = planPromotion(hhTrvRecords, paramValueRecords, opts);

  const valueTouchedFlags = [];
  for (const vr of plan.valueResults) {
    let touched = false;
    if (vr.promote) {
      vr.record.default_status = 'current_default';
      touched = true;
    }
    // Stamp (fresh promotion OR repair of an already-done record missing the display stamp).
    const stamped = stampReviewNotes(vr.record, opts.date, opts.reviewer);
    touched = touched || stamped;
    valueTouchedFlags.push(touched);
  }
  plan.valueTouchedFlags = valueTouchedFlags;

  const disposalTouchedFlags = [];
  for (const dr of plan.disposalResults) {
    let touched = false;
    if (dr.dispose) {
      const r = dr.record;
      r.default_status = 'available_option';
      r.qa_status = 'superseded';
      r.evidence_items = r.evidence_items.map((ev) => disposeEvidence(ev, opts.reviewer, opts.date));
      stampDisposalProvenance(r, opts.date, opts.reviewer);
      touched = true;
    } else if (dr.alreadyDone) {
      touched = stampDisposalProvenance(dr.record, opts.date, opts.reviewer);
    }
    disposalTouchedFlags.push(touched);
  }
  plan.disposalTouchedFlags = disposalTouchedFlags;

  return plan;
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

const BANNER = [
  '=============================================================================',
  ' promote-pcb-hc-nondioxin-default.mjs -- owner-run Total PCBs HH default selection',
  '   (2 rows PROMOTE available_option->current_default + 2 rows DISPOSE current_default->available_option/superseded)',
  '=============================================================================',
  '',
  'OWNER RULING (2026-07-16): the Health Canada non-dioxin-like PCB oral TDI',
  '  (1.0e-5 mg/kg-bw/day, src-health-canada-trv-v4-2025, crystallized 2025-10-15) becomes the',
  '  human-health default for total_pcbs_aroclor_1254, ahead of the US EPA IRIS Aroclor 1254',
  '  oral RfD (2.0e-5 mg/kg-bw/day, last updated 1994-10-01): HC is more conservative AND newer.',
  '  Running --apply attests to that ruling.',
  '',
  'SCOPE (coupled, atomic across BOTH catalog files):',
  '  (A) PROMOTE pv-hc-pcb-hh-direct-rfd-nondioxin + pv-hc-pcb-hh-food-rfd-nondioxin',
  '      (human_health_trv_values.json): default_status available_option -> current_default.',
  '      qa_status / evidence_support_status / canonical_source_status / value / evidence_items UNCHANGED.',
  '  (B) DISPOSE pv-pcb-hh-direct-rfd + pv-pcb-hh-food-rfd (parameter_values.json): the legacy',
  '      current-calculator scaffolds that were ALREADY current_default for the SAME 2 tuples.',
  '      default_status current_default -> available_option; qa_status needs_review -> superseded',
  '      (top-level AND every nested evidence_items[].qa_status). value UNCHANGED (audit trail kept).',
  '  The 2 competing US EPA IRIS rows are READ-ONLY sanity-checked (must stay available_option),',
  '  never mutated.',
  '',
  'TUPLE-UNIQUENESS GUARD: refuses to run if any row OTHER than the 2 known + validated disposal',
  '  targets already holds current_default in the same tuple as a promotion target.',
  '',
].join('\n');

const HELP = [
  'promote-pcb-hc-nondioxin-default.mjs -- owner-run Total PCBs HH default-selection tool.',
  '',
  'Usage:',
  '  node scripts/matrix-options/promote-pcb-hc-nondioxin-default.mjs --reviewer "<id>" --date YYYY-MM-DD [--apply]',
  '',
  'Options:',
  '  --reviewer "<id>"   Reviewer attestation -> promotion/disposal display stamp (required for --apply)',
  '  --date YYYY-MM-DD   Review date -> promotion/disposal display stamp (required for --apply)',
  '  --apply              Write both catalog files (default is a dry run that writes nothing)',
  '',
  'Targets: 2 PROMOTE records (human_health_trv_values.json) + 2 DISPOSE records',
  '(parameter_values.json) + 2 READ-ONLY IRIS confirm rows.',
  '',
  'On --apply, each PROMOTED record changes:',
  '  default_status   available_option -> current_default',
  '  review_notes     appended with an idempotent promotion display stamp',
  '  (qa_status / evidence_support_status / canonical_source_status / value / evidence_items UNCHANGED)',
  '',
  'On --apply, each DISPOSED record changes:',
  '  default_status               current_default -> available_option',
  '  qa_status                    needs_review -> superseded',
  '  evidence_items[*].qa_status  needs_review -> superseded (+ reviewed_by/at)',
  '  applicability/uncertainty/review_notes appended with an idempotent disposal display stamp',
  '  (value UNCHANGED -- retained as audit trail, never deleted)',
  '',
  'AI never runs this with --apply. The owner runs it; --reviewer/--date are the HITL attestation.',
  'After --apply: update the guard tests named in the file header comment, then run',
  '  npx tsc --noEmit; npm run lint; npm run test:ci',
].join('\n');

function printPlan(plan) {
  console.log('IRIS confirm rows (read-only sanity check, never mutated):');
  for (const record of plan.confirmResults) {
    console.log('  CONFIRM OK  ' + record.parameter_value_id + ': value=' + record.value +
      ' default_status=' + record.default_status + ' qa_status=' + record.qa_status);
  }
  console.log('');
  console.log('(A) Promotion plan (human_health_trv_values.json):');
  for (const vr of plan.valueResults) {
    const id = vr.record.parameter_value_id;
    if (vr.promote) {
      console.log('  VALUE   PROMOTE  ' + id);
      console.log('    default_status : ' + vr.record.default_status + ' -> current_default');
    } else {
      console.log('  VALUE   SKIP     ' + id + ': already current_default (no-op)');
    }
  }
  console.log('');
  console.log('(B) Disposal plan (parameter_values.json):');
  for (const dr of plan.disposalResults) {
    const id = dr.record.parameter_value_id;
    if (dr.dispose) {
      console.log('  VALUE   DISPOSE  ' + id);
      console.log('    default_status : ' + dr.record.default_status + ' -> available_option');
      console.log('    qa_status      : ' + dr.record.qa_status + ' -> superseded');
    } else {
      console.log('  VALUE   SKIP     ' + id + ': already superseded/available_option (no-op)');
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
  console.log('Files   : ' + HH_TRV_FILE + ' (write target -- promotions)');
  console.log('          ' + PARAM_VALUES_FILE + ' (write target -- disposals)');
  console.log('reviewer: ' + (opts.reviewer || '(not set)'));
  console.log('date    : ' + (opts.date || '(not set)'));
  console.log('records : ' + PCB_HC_DEFAULT_VALUE_IDS.length + ' VALUE (promote) + ' +
    PCB_SCAFFOLD_DISPOSAL_IDS.length + ' VALUE (dispose) + ' + IRIS_CONFIRM_ROWS.length + ' (confirm-only)');
  console.log('');

  // Retain the ORIGINAL raw text of BOTH files before any mutation, so an all-or-nothing write
  // (below) can roll back both if either write fails.
  const hhTrvRawOriginal = fs.readFileSync(HH_TRV_FILE, 'utf8');
  const paramValuesRawOriginal = fs.readFileSync(PARAM_VALUES_FILE, 'utf8');
  const hhTrvRecords = JSON.parse(hhTrvRawOriginal);
  const paramValueRecords = JSON.parse(paramValuesRawOriginal);

  const plan = planPromotion(hhTrvRecords, paramValueRecords, opts);

  console.log('Before/after plan:');
  printPlan(plan);
  console.log('');

  const totalToPromote = plan.valueResults.filter((vr) => vr.promote).length;
  const totalPromoteSkipped = plan.valueResults.filter((vr) => vr.alreadyDone).length;
  const totalToDispose = plan.disposalResults.filter((dr) => dr.dispose).length;
  const totalDisposeSkipped = plan.disposalResults.filter((dr) => dr.alreadyDone).length;
  console.log('Summary: ' + totalToPromote + ' record(s) to promote (' + totalPromoteSkipped +
    ' already current_default), ' + totalToDispose + ' record(s) to dispose (' + totalDisposeSkipped +
    ' already superseded).');

  const anyPromoteStampRepair = plan.valueResults.some(
    (vr) => vr.alreadyDone && promotionStampNeeded(vr.record),
  );
  const anyDisposeStampRepair = plan.disposalResults.some(
    (dr) => dr.alreadyDone && disposalStampNeeded(dr.record),
  );
  if (anyPromoteStampRepair || anyDisposeStampRepair) {
    console.log('NOTE: one or more already-processed records are MISSING a display-stamp; ' +
      '--apply will repair it.');
  }

  if (!opts.apply) {
    console.log('');
    console.log('DRY RUN -- no file written. Re-run with --apply (plus --reviewer/--date) to write.');
    return;
  }

  validateApplyOptions(opts);

  if (totalToPromote === 0 && totalToDispose === 0 && !anyPromoteStampRepair && !anyDisposeStampRepair) {
    console.log('');
    console.log('Nothing to do (all records already in target state). No write.');
    return;
  }

  const applied = applyPromotion(hhTrvRecords, paramValueRecords, opts);

  const anyHhWrite = applied.valueTouchedFlags.some(Boolean);
  const anyParamWrite = applied.disposalTouchedFlags.some(Boolean);

  // All-or-nothing write across BOTH files: all in-memory mutation + validation already happened
  // above. BOTH writes are wrapped in a single try/catch so that a mid-write failure on EITHER file
  // (partial/truncated write, disk-full, etc.) triggers a rollback of BOTH files to their retained
  // pre-run raw text before rethrowing -- the catalog can never be left half-written. Restoring a
  // file that was not actually mutated is a harmless no-op (it just rewrites its identical original
  // bytes).
  try {
    if (anyHhWrite) {
      fs.writeFileSync(HH_TRV_FILE, JSON.stringify(hhTrvRecords, null, 2) + '\n', 'utf8');
      console.log('WROTE ' + HH_TRV_FILE);
    }
    if (anyParamWrite) {
      fs.writeFileSync(PARAM_VALUES_FILE, JSON.stringify(paramValueRecords, null, 2) + '\n', 'utf8');
      console.log('WROTE ' + PARAM_VALUES_FILE);
    }
  } catch (err) {
    console.error('ERROR during catalog write: ' + (err && err.message ? err.message : err));
    console.error('Rolling back BOTH catalog files to their pre-run state (all-or-nothing write)...');
    for (const [file, original] of [[HH_TRV_FILE, hhTrvRawOriginal], [PARAM_VALUES_FILE, paramValuesRawOriginal]]) {
      try {
        fs.writeFileSync(file, original, 'utf8');
        console.error('ROLLED BACK ' + file + ' to its pre-run state.');
      } catch (restoreErr) {
        console.error('CRITICAL: failed to roll back ' + file + ': ' +
          (restoreErr && restoreErr.message ? restoreErr.message : restoreErr) +
          ' -- restore it manually from git.');
      }
    }
    console.error('Catalog left in its pre-run state (both files); no partial write.');
    throw err;
  }

  // Postcondition: re-read BOTH files from disk and assert the intended coupled end-state. Abort
  // (throw) if not -- the write already happened; a failure here means it did not do what was
  // intended and must be investigated immediately.
  const rereadHhTrv = JSON.parse(fs.readFileSync(HH_TRV_FILE, 'utf8'));
  const rereadParamValues = JSON.parse(fs.readFileSync(PARAM_VALUES_FILE, 'utf8'));
  const combinedReread = [...rereadParamValues, ...rereadHhTrv];
  const postconditionFailures = [];

  for (const row of PROMOTION_ROWS) {
    const record = findById(rereadHhTrv, row.id);
    if (!record) {
      postconditionFailures.push(row.id + ': record disappeared after write');
      continue;
    }
    if (record.default_status !== 'current_default') {
      postconditionFailures.push(
        row.id + ': default_status=' + record.default_status + ' (expected current_default)',
      );
      continue;
    }
    const tupleCurrentDefaults = combinedReread.filter(
      (r) =>
        r.substance_key === record.substance_key &&
        r.input_key === record.input_key &&
        r.pathway === record.pathway &&
        r.default_status === 'current_default',
    );
    if (tupleCurrentDefaults.length !== 1 || tupleCurrentDefaults[0].parameter_value_id !== row.id) {
      postconditionFailures.push(
        row.id + ': tuple (' + record.substance_key + ' / ' + record.input_key + ' / ' +
        record.pathway + ') has current_default row(s) ' +
        JSON.stringify(tupleCurrentDefaults.map((r) => r.parameter_value_id)) +
        ' (expected exactly [' + row.id + '])',
      );
    }
  }

  for (const row of DISPOSAL_ROWS) {
    const record = findById(rereadParamValues, row.id);
    if (!record) {
      postconditionFailures.push(row.id + ': record disappeared after write');
      continue;
    }
    if (record.default_status !== 'available_option') {
      postconditionFailures.push(
        row.id + ': default_status=' + record.default_status + ' (expected available_option)',
      );
    }
    if (record.qa_status !== 'superseded') {
      postconditionFailures.push(row.id + ': qa_status=' + record.qa_status + ' (expected superseded)');
    }
    for (const ev of record.evidence_items || []) {
      if (ev.qa_status !== 'superseded') {
        postconditionFailures.push(
          row.id + ': evidence_items[' + ev.evidence_id + '].qa_status=' + ev.qa_status +
          ' (expected superseded)',
        );
      }
    }
  }

  if (postconditionFailures.length > 0) {
    throw new Error(
      'POSTCONDITION FAILED after write -- the on-disk state does not match the intended coupled ' +
      'promote+dispose operation:\n  ' + postconditionFailures.join('\n  '),
    );
  }
  console.log('Postcondition verified: both PROMOTE rows are current_default (sole current_default ' +
    'in their tuple) and both DISPOSE rows are available_option/superseded (top+nested), on disk.');

  console.log('');
  console.log('REQUIRED before test:ci -- this coupled promote+dispose shifts the audit-count guards.');
  console.log('  Update src/lib/matrix-options/provenance/__tests__/library.test.ts in the SAME commit:');
  console.log('    audit.values.currentDefaults  : NET ZERO (+' + totalToPromote + ' promoted, -' +
    totalToDispose + ' demoted off current_default)');
  console.log('    audit.values.availableOptions : NET ZERO (the ' + totalToPromote + ' HC rows leave ' +
    'available_option, but the ' + totalToDispose + ' disposed scaffolds move current_default -> ' +
    'available_option and RE-ENTER this count -- countByStatus is qa_status-agnostic -- so they offset)');
  console.log('    (no dedicated superseded counter exists in EvidenceLibraryAudit.values; the ' +
    totalToDispose + ' scaffold qa->superseded flips shift no audit count.)');
  console.log('  Add pv-hc-pcb-hh-direct-rfd-nondioxin + pv-hc-pcb-hh-food-rfd-nondioxin to');
  console.log('  APPROVED_CURRENT_DEFAULT_IDS in catalog.test.ts (bump the Set-size assertion).');
  console.log('  Update/exclude any test asserting pv-pcb-hh-direct-rfd / pv-pcb-hh-food-rfd pre-disposal');
  console.log('  state (mirror how the copper scaffold disposal handled its 3 guard tests).');
  console.log('  Also update src/lib/matrix-options/substanceLibrary.ts (total_pcbs_aroclor_1254 HH');
  console.log('  rfd_oral_mg_per_kg_bw_per_day: 2.0e-5 -> 1.0e-5) in the SAME commit.');
  console.log('  Run npm run test:ci and bump to match the FAILING assertions (do not hard-set blind).');

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
