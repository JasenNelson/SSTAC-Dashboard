// Owner-run disposal helper for 6 redundant copper oral-RfD catalog rows. Plain ASCII only.
//
// WHY THIS EXISTS
// The copper oral-RfD (rfd_oral_mg_per_kg_bw_day) slot for human-health-direct and
// human-health-food carries FOUR competing candidates on top of the owner-approved Health
// Canada TRV v4.0 (2025) current_default (pv-hc-copper-hh-direct-rfd-tdi /
// pv-hc-copper-hh-food-rfd-tdi, value=0.426, direct_source_verified, promoted 2026-07-13):
//   - pv-p28-copper-hh-direct-rfd / pv-p28-copper-hh-food-rfd (BC Protocol 28 App 8A, value=0.09)
//   - pv-p28-copper-hh-direct-rfd-copper-rfd-water / pv-p28-copper-hh-food-rfd-copper-rfd-water
//     (BC Protocol 28 App 8C HH water use, value=0.141)
//   - pv-copper-hh-direct-rfd / pv-copper-hh-food-rfd (current-calculator scaffold, value=0.426)
// All 6 are needs_review / available_option and were never going to be promoted (the P28 rows
// are policy-compilation candidates that cannot drive a default; the scaffold rows are
// superseded in substance by the now-approved HC row carrying the identical 0.426 value from a
// direct, verified source). This tool DISPOSES (qa_status -> superseded) those 6 rows so they
// stop appearing as live needs_review candidates in the Evidence Library, while leaving them in
// the catalog as an audit trail (never deleted).
//
// It mirrors promote-hc-trv-v4-2025.mjs in structure, style, and fail-closed discipline, but
// performs the inverse qa transition (needs_review -> superseded, not -> approved) across TWO
// catalog files (human_health_trv_values.json for the 4 P28 rows + the 2 HC confirm rows;
// parameter_values.json for the 2 scaffold rows).
//
// LOAD-BEARING RULES honored:
//  - AI NEVER writes qa_status. This tool is run BY THE OWNER; --reviewer/--date are the owner's
//    HITL attestation. Author + dry-run only for AI.
//  - SCOPE: only the 6 listed pv-* records are touched. default_status is NEVER modified (stays
//    'available_option' on all 6 -- disposal is a qa_status-only transition).
//  - CONFIRM-ONLY (read-only): pv-hc-copper-hh-direct-rfd-tdi / pv-hc-copper-hh-food-rfd-tdi
//    (the HC current_default) are asserted unchanged (value=0.426, default_status=current_default,
//    qa_status=approved) as a pre-state sanity check. This tool never mutates them.
//  - GUARD-COUNT IMPACT (owner must review before running test:ci after --apply): disposing the 4
//    P28 rows will break the per-record assertion in
//    src/lib/matrix-options/provenance/__tests__/catalog.test.ts ("keeps Protocol 28 TRV
//    candidates pending until original sources are checked", ~line 1024, which asserts EVERY
//    record whose source_ids includes src-bc-protocol-28-v3-0-2024 has qa_status===needs_review).
//    Disposing the 2 scaffold rows will break two assertions in
//    src/lib/matrix-options/provenance/__tests__/library.test.ts: "keeps HH scaffolds as
//    current-calculator needs-review records" (~line 566/585) and "catalogs every current HH
//    calculator default input as a review scaffold" (~line 639, copper/rfd_oral_mg_per_kg_bw_day
//    cell only). These three tests MUST be updated (narrowed exclusions, not deleted) in the SAME
//    commit as any --apply run, per catalog.test.ts:281's own evidence_items[].qa_status ===
//    record.qa_status invariant (which this tool satisfies) and per the
//    cross_project_never_delete_regression_tests_during_cleanup rule (fix the test, do not delete
//    it). AI does not edit those tests; the owner or a follow-up commit does.
//
// USAGE (run from anywhere; paths resolve from the script location):
//   node scripts/matrix-options/promote-copper-hc0426.mjs --reviewer "J. Nelson" --date 2026-07-16
//   node scripts/matrix-options/promote-copper-hc0426.mjs --reviewer "J. Nelson" --date 2026-07-16 --apply
//
// Default is a DRY RUN (prints the per-record plan, writes nothing). --apply writes both
// matrix_research/reference_catalog/human_health_trv_values.json and
// matrix_research/reference_catalog/parameter_values.json (only the file(s) that actually change).

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..', '..');
const HH_TRV_FILE = path.join(
  REPO_ROOT, 'matrix_research', 'reference_catalog', 'human_health_trv_values.json',
);
const PARAM_VALUES_FILE = path.join(
  REPO_ROOT, 'matrix_research', 'reference_catalog', 'parameter_values.json',
);

const CANONICAL_HC_SOURCE_ID = 'src-health-canada-trv-v4-2025';
const DISPOSAL_RATIONALE =
  'Superseded: HC v4.0 0.426 (' + CANONICAL_HC_SOURCE_ID + ') is the canonical copper oral RfD; ' +
  'this P28/scaffold row is a redundant alternate.';

// The EXACT 6 records this tool will ever touch. `file` selects which catalog file the id lives
// in. Identity fields (value, defaultStatus) are the drift-detection guard -- any mismatch aborts
// with no writes. Exported so a test could build fixtures without re-typing the table.
export const DISPOSAL_ROWS = [
  { id: 'pv-p28-copper-hh-direct-rfd', file: 'HH_TRV', value: 0.09, defaultStatus: 'available_option' },
  { id: 'pv-p28-copper-hh-food-rfd', file: 'HH_TRV', value: 0.09, defaultStatus: 'available_option' },
  { id: 'pv-p28-copper-hh-direct-rfd-copper-rfd-water', file: 'HH_TRV', value: 0.141, defaultStatus: 'available_option' },
  { id: 'pv-p28-copper-hh-food-rfd-copper-rfd-water', file: 'HH_TRV', value: 0.141, defaultStatus: 'available_option' },
  { id: 'pv-copper-hh-direct-rfd', file: 'PARAM_VALUES', value: 0.426, defaultStatus: 'available_option' },
  { id: 'pv-copper-hh-food-rfd', file: 'PARAM_VALUES', value: 0.426, defaultStatus: 'available_option' },
];

export const COPPER_DISPOSAL_VALUE_IDS = DISPOSAL_ROWS.map((r) => r.id);

// Read-only idempotent confirmation: the HC current_default this disposal is deferring to must
// not have drifted. Lives in HH_TRV_FILE. Never mutated by this tool.
const HC_CONFIRM_ROWS = [
  { id: 'pv-hc-copper-hh-direct-rfd-tdi', value: 0.426, defaultStatus: 'current_default', qaStatus: 'approved' },
  { id: 'pv-hc-copper-hh-food-rfd-tdi', value: 0.426, defaultStatus: 'current_default', qaStatus: 'approved' },
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

function findById(records, id) {
  return records.find((r) => r.parameter_value_id === id);
}

function countById(records, id) {
  return records.filter((r) => r.parameter_value_id === id).length;
}

// Fail-closed precondition (runs in BOTH dry-run and --apply, before any mutation): every id this
// tool touches (dispose targets + read-only confirm rows) must appear EXACTLY ONCE in its catalog
// file. `findById` above is an Array.find -- with a duplicated (or missing) parameter_value_id it
// would silently look up/mutate only the FIRST match while the run still "succeeds", leaving a
// duplicate row untouched. Abort with no writes if any id has 0 or >1 matches.
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
      'silently mutate only one of several matching rows while reporting success. No writes performed.',
    );
  }
}

// Computes the disposal plan for a single value record and enforces preconditions (fail-closed).
// PRE-STATE: qa_status=needs_review, default_status=available_option (row's own `value`), exactly
// ONE evidence_items entry, that entry also qa_status=needs_review. ALREADY-DONE state: the same
// but qa_status=superseded top-level AND on the single evidence item. Anything else aborts.
function planOneRow(row, records) {
  const record = findById(records, row.id);
  if (!record) {
    throw new Error('Precondition failed: value record not found: ' + row.id);
  }
  if (record.value !== row.value) {
    throw new Error(
      'Precondition failed: ' + row.id + ' value mismatch. expected=' + row.value +
      ' actual=' + JSON.stringify(record.value) + '. Refusing to dispose a drifted record.',
    );
  }
  if (record.default_status !== row.defaultStatus) {
    throw new Error(
      'Precondition failed: ' + row.id + ' default_status mismatch. expected=' + row.defaultStatus +
      ' actual=' + JSON.stringify(record.default_status) +
      '. default_status must stay untouched by this tool; refusing to dispose a record whose ' +
      'default_status has already drifted from the documented pre-state.',
    );
  }
  if (!Array.isArray(record.evidence_items) || record.evidence_items.length !== 1) {
    throw new Error(
      'Precondition failed: ' + row.id + ' must have EXACTLY one evidence_items entry (actual: ' +
      (Array.isArray(record.evidence_items) ? record.evidence_items.length : 'not an array') + ').',
    );
  }
  const ev = record.evidence_items[0];
  const expectedPre = record.qa_status === 'needs_review' && ev.qa_status === 'needs_review';
  const alreadyDone = record.qa_status === 'superseded' && ev.qa_status === 'superseded';
  if (!expectedPre && !alreadyDone) {
    throw new Error(
      'Precondition failed: ' + row.id +
      ' is not in the expected pre-disposal state nor the already-disposed state.\n' +
      '  expected pre  : qa_status=needs_review, evidence_items[0].qa_status=needs_review\n' +
      '  already-done  : qa_status=superseded, evidence_items[0].qa_status=superseded\n' +
      '  actual        : qa_status=' + record.qa_status +
      ', evidence_items[0].qa_status=' + ev.qa_status + '\n' +
      'Refusing to dispose a drifted/partially-disposed record.',
    );
  }
  return { row, record, alreadyDone, dispose: !alreadyDone };
}

function planOneConfirmRow(confirmRow, hhTrvRecords) {
  const record = findById(hhTrvRecords, confirmRow.id);
  if (!record) {
    throw new Error('Precondition failed: HC confirm record not found: ' + confirmRow.id);
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
      'Precondition failed: HC confirm row ' + confirmRow.id + ' has drifted from the documented ' +
      'pre-state (this row is NEVER mutated by this tool; it is a sanity check that the canonical ' +
      'HC 0.426 current_default this disposal defers to has not itself drifted). Mismatch(es):\n  ' +
      mismatches.join('\n  ') + '\nRefusing to proceed.',
    );
  }
  return record;
}

// Computes the disposal plan for all 6 rows + the 2 read-only HC confirm rows. Idempotent
// (records already superseded are SKIPPED).
export function planDisposal(hhTrvRecords, paramValueRecords, _opts) {
  // Duplicate-id / missing-id guard FIRST, before any lookup or mutation (dry-run and --apply both
  // call this function, so both modes are covered).
  const hhTrvIds = [
    ...DISPOSAL_ROWS.filter((r) => r.file === 'HH_TRV').map((r) => r.id),
    ...HC_CONFIRM_ROWS.map((r) => r.id),
  ];
  const paramValueIds = DISPOSAL_ROWS.filter((r) => r.file === 'PARAM_VALUES').map((r) => r.id);
  assertUniqueIds(hhTrvRecords, hhTrvIds, 'human_health_trv_values.json');
  assertUniqueIds(paramValueRecords, paramValueIds, 'parameter_values.json');

  const confirmResults = HC_CONFIRM_ROWS.map((r) => planOneConfirmRow(r, hhTrvRecords));

  const rowResults = DISPOSAL_ROWS.map((row) => {
    const records = row.file === 'HH_TRV' ? hhTrvRecords : paramValueRecords;
    return planOneRow(row, records);
  });

  return { confirmResults, rowResults };
}

// ---------------------------------------------------------------------------
// Evidence item rebuild (mirrors approveEvidence in promote-hc-trv-v4-2025.mjs, inverted to
// 'superseded')
// ---------------------------------------------------------------------------

const DISPOSAL_STAMP_MARKER = 'SUPERSEDED (disposed)';
const STAMPED_PROVENANCE_FIELDS = ['applicability', 'uncertainty', 'review_notes'];

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

function stampRecordProvenance(r, date, reviewer) {
  const stamp = buildDisposalStamp(date, reviewer);
  let changed = false;
  for (const field of STAMPED_PROVENANCE_FIELDS) {
    const v = r[field];
    if (typeof v === 'string' && v.length > 0 && !v.includes(DISPOSAL_STAMP_MARKER)) {
      r[field] = v + stamp;
      changed = true;
    }
  }
  return changed;
}

function stampNeeded(r) {
  return STAMPED_PROVENANCE_FIELDS.some(
    (field) => typeof r[field] === 'string' && r[field].length > 0 && !r[field].includes(DISPOSAL_STAMP_MARKER),
  );
}

// ---------------------------------------------------------------------------
// Apply (in-place mutation of the parsed records; ONLY the 6 target records are touched)
// ---------------------------------------------------------------------------

export function applyDisposal(hhTrvRecords, paramValueRecords, opts) {
  const plan = planDisposal(hhTrvRecords, paramValueRecords, opts);

  const touchedByFile = { HH_TRV: false, PARAM_VALUES: false };
  const rowTouchedFlags = [];
  for (let i = 0; i < plan.rowResults.length; i++) {
    const vr = plan.rowResults[i];
    const row = DISPOSAL_ROWS[i];
    let touched = false;
    if (vr.dispose) {
      const r = vr.record;
      r.qa_status = 'superseded';
      // default_status is intentionally NOT modified (stays 'available_option').
      r.evidence_items = r.evidence_items.map((ev) => disposeEvidence(ev, opts.reviewer, opts.date));
      stampRecordProvenance(r, opts.date, opts.reviewer);
      touched = true;
    } else if (vr.alreadyDone) {
      touched = stampRecordProvenance(vr.record, opts.date, opts.reviewer);
    }
    if (touched) touchedByFile[row.file] = true;
    rowTouchedFlags.push(touched);
  }
  plan.rowTouchedFlags = rowTouchedFlags;
  plan.touchedByFile = touchedByFile;

  return plan;
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

const BANNER = [
  '=============================================================================',
  ' promote-copper-hc0426.mjs -- owner-run disposal of 6 redundant copper oral-RfD rows',
  '   (4 BC Protocol 28 candidates + 2 current-calculator scaffold rows; needs_review -> superseded)',
  '=============================================================================',
  '',
  'WHY: the HC v4.0 (2025) copper oral RfD (0.426 mg/kg-bw/day, src-health-canada-trv-v4-2025) is',
  '  already the owner-approved current_default (pv-hc-copper-hh-direct-rfd-tdi /',
  '  pv-hc-copper-hh-food-rfd-tdi). The 4 BC Protocol 28 rows (0.09 / 0.141) and the 2 legacy',
  '  current-calculator scaffold rows (0.426, unsourced) are redundant needs_review candidates for',
  '  the same slot. This tool marks them superseded (audit trail retained; NOT deleted).',
  '',
  'SCOPE: targets the 6 listed pv-* ids ONLY. default_status is NOT changed (stays available_option).',
  '  The 2 pv-hc-copper-*-tdi rows are READ-ONLY sanity-checked, never mutated.',
  '',
  'GUARD-COUNT IMPACT (owner must update in the SAME commit as --apply, before test:ci):',
  '  - catalog.test.ts "keeps Protocol 28 TRV candidates pending until original sources are',
  '    checked" (~line 1024): 4 P28 copper rows will fail the blanket qa_status===needs_review',
  '    per-record loop; narrow the assertion to exclude COPPER_DISPOSAL_VALUE_IDS.',
  '  - library.test.ts "keeps HH scaffolds as current-calculator needs-review records" (~line',
  '    566/585) and "catalogs every current HH calculator default input as a review scaffold"',
  '    (~line 639): the 2 scaffold copper rows will fail qa_status===needs_review; narrow or',
  '    special-case the copper / rfd_oral_mg_per_kg_bw_day cell.',
  '  Fix the tests (do not delete them) per cross_project_never_delete_regression_tests_during_cleanup.',
  '',
].join('\n');

const HELP = [
  'promote-copper-hc0426.mjs -- owner-run disposal of 6 redundant copper oral-RfD rows.',
  '',
  'Usage:',
  '  node scripts/matrix-options/promote-copper-hc0426.mjs --reviewer "<id>" --date YYYY-MM-DD [--apply]',
  '',
  'Options:',
  '  --reviewer "<id>"   Reviewer attestation -> evidence.reviewed_by (required for --apply)',
  '  --date YYYY-MM-DD   Review date -> evidence.reviewed_at (required for --apply)',
  '  --apply              Write catalog file(s) that changed (default is a dry run, writes nothing)',
  '',
  'Targets: 6 VALUE records (needs_review -> superseded) + 2 READ-ONLY HC confirm rows (sanity check).',
  '',
  'On --apply, each disposed VALUE record changes:',
  '  qa_status                   needs_review -> superseded',
  '  evidence_items[*].qa_status needs_review -> superseded (+ reviewed_by/at after qa_status)',
  '  default_status               UNCHANGED (stays available_option)',
  '',
  'AI never runs this with --apply. The owner runs it; --reviewer/--date are the HITL attestation.',
  'After --apply: update the 3 guard tests named in the banner, then run',
  '  npx tsc --noEmit; npm run lint; npm run test:ci',
].join('\n');

function printPlan(plan) {
  console.log('HC confirm rows (read-only sanity check, never mutated):');
  for (const record of plan.confirmResults) {
    console.log('  CONFIRM OK  ' + record.parameter_value_id + ': value=' + record.value +
      ' default_status=' + record.default_status + ' qa_status=' + record.qa_status);
  }
  console.log('');
  console.log('Disposal plan:');
  for (let i = 0; i < plan.rowResults.length; i++) {
    const vr = plan.rowResults[i];
    const id = DISPOSAL_ROWS[i].id;
    if (vr.dispose) {
      const r = vr.record;
      console.log('  VALUE   DISPOSE  ' + id);
      console.log('    qa_status                    : ' + r.qa_status + ' -> superseded');
      console.log('    evidence_items[0].qa_status  : ' + r.evidence_items[0].qa_status + ' -> superseded');
      console.log('    default_status                : ' + r.default_status + ' (UNCHANGED)');
    } else {
      console.log('  VALUE   SKIP     ' + id + ': already superseded (no-op)');
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
  console.log('          ' + PARAM_VALUES_FILE);
  console.log('reviewer: ' + (opts.reviewer || '(not set)'));
  console.log('date    : ' + (opts.date || '(not set)'));
  console.log('records : ' + DISPOSAL_ROWS.length + ' VALUE (dispose) + ' + HC_CONFIRM_ROWS.length + ' (confirm-only)');
  console.log('');

  // Retain the ORIGINAL raw text of BOTH files before any mutation, so an all-or-nothing write
  // (below) can roll back the first file if the second file's write throws.
  const hhTrvRawOriginal = fs.readFileSync(HH_TRV_FILE, 'utf8');
  const paramValuesRawOriginal = fs.readFileSync(PARAM_VALUES_FILE, 'utf8');
  const hhTrvRecords = JSON.parse(hhTrvRawOriginal);
  const paramValueRecords = JSON.parse(paramValuesRawOriginal);

  const plan = planDisposal(hhTrvRecords, paramValueRecords, opts);

  console.log('Before/after plan:');
  printPlan(plan);
  console.log('');

  const totalToDispose = plan.rowResults.filter((vr) => vr.dispose).length;
  const totalSkipped = plan.rowResults.filter((vr) => vr.alreadyDone).length;
  console.log('Summary: ' + totalToDispose + ' record(s) to dispose, ' +
    totalSkipped + ' already in target state.');

  const anyStampRepair = plan.rowResults.some(
    (vr) => vr.alreadyDone && stampNeeded(vr.record),
  );
  if (anyStampRepair) {
    console.log('NOTE: one or more already-disposed records are MISSING a disposal display-stamp; ' +
      '--apply will repair it.');
  }

  if (!opts.apply) {
    console.log('');
    console.log('DRY RUN -- no file written. Re-run with --apply (plus --reviewer/--date) to write.');
    return;
  }

  validateApplyOptions(opts);

  if (totalToDispose === 0 && !anyStampRepair) {
    console.log('');
    console.log('Nothing to dispose (all records already in target state). No write.');
    return;
  }

  const applied = applyDisposal(hhTrvRecords, paramValueRecords, opts);

  // All-or-nothing write across BOTH files: all in-memory mutation + validation already happened
  // above (planDisposal / applyDisposal). BOTH writes are wrapped in a single try/catch so that a
  // mid-write failure on EITHER file (partial/truncated write, disk-full, etc.) triggers a rollback
  // of BOTH files to their retained pre-run raw text before rethrowing -- the catalog can never be
  // left half-written. Restoring a file that was not actually mutated is a harmless no-op (it just
  // rewrites its identical original bytes).
  try {
    if (applied.touchedByFile.HH_TRV) {
      fs.writeFileSync(HH_TRV_FILE, JSON.stringify(hhTrvRecords, null, 2) + '\n', 'utf8');
      console.log('WROTE ' + HH_TRV_FILE);
    }
    if (applied.touchedByFile.PARAM_VALUES) {
      fs.writeFileSync(PARAM_VALUES_FILE, JSON.stringify(paramValueRecords, null, 2) + '\n', 'utf8');
      console.log('WROTE ' + PARAM_VALUES_FILE);
    }
  } catch (err) {
    console.error('ERROR during catalog write: ' + (err && err.message ? err.message : err));
    console.error('Rolling back BOTH catalog files to their pre-run state (all-or-nothing write)...');
    // Restore both from retained originals; each restore is independently guarded so one failing
    // restore is reported CRITICAL rather than masking the original error.
    for (const [file, original] of [[HH_TRV_FILE, hhTrvRawOriginal], [PARAM_VALUES_FILE, paramValuesRawOriginal]]) {
      try {
        fs.writeFileSync(file, original, 'utf8');
        console.error('ROLLED BACK ' + file + ' to its pre-run state.');
      } catch (restoreErr) {
        console.error('CRITICAL: failed to roll back ' + file + ': ' + (restoreErr && restoreErr.message ? restoreErr.message : restoreErr) + ' -- restore it manually from git.');
      }
    }
    console.error('Catalog left in its pre-run state (both files); no partial write.');
    throw err;
  }

  // Postcondition: re-read from disk and assert all 6 target rows are qa_status=superseded, both
  // top-level and on every evidence item. Abort (throw) if not -- this is a hard safety check, not
  // a rollback (the write has already happened; a failure here means the write did not do what was
  // intended and must be investigated immediately).
  const rereadHhTrv = JSON.parse(fs.readFileSync(HH_TRV_FILE, 'utf8'));
  const rereadParamValues = JSON.parse(fs.readFileSync(PARAM_VALUES_FILE, 'utf8'));
  const postconditionFailures = [];
  for (const row of DISPOSAL_ROWS) {
    const records = row.file === 'HH_TRV' ? rereadHhTrv : rereadParamValues;
    const record = findById(records, row.id);
    if (!record) {
      postconditionFailures.push(row.id + ': record disappeared after write');
      continue;
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
      'POSTCONDITION FAILED after write -- the on-disk state does not match the intended disposal:\n  ' +
      postconditionFailures.join('\n  '),
    );
  }
  console.log('Postcondition verified: all ' + DISPOSAL_ROWS.length +
    ' target rows are qa_status=superseded (top-level and nested evidence_items) on disk.');

  console.log('');
  console.log('REQUIRED before test:ci -- disposing these records will break 3 guard tests. Update in');
  console.log('the SAME commit (fix, do not delete, per cross_project_never_delete_regression_tests_during_cleanup):');
  console.log('  - src/lib/matrix-options/provenance/__tests__/catalog.test.ts');
  console.log('    "keeps Protocol 28 TRV candidates pending until original sources are checked" (~line 1024)');
  console.log('  - src/lib/matrix-options/provenance/__tests__/library.test.ts');
  console.log('    "keeps HH scaffolds as current-calculator needs-review records" (~line 566/585)');
  console.log('    "catalogs every current HH calculator default input as a review scaffold" (~line 639)');
  console.log('  Run npm run test:ci and adjust to match the FAILING assertions (do not hard-set blind).');

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
