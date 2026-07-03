// Owner-run promotion helper for the Total PCBs (Aroclor 1254) Eco-Direct FCV. Plain ASCII only.
//
// WHY THIS EXISTS
// 2026-07-02 eco-statics correction (owner-approved): pv-pcb-fcv (total_pcbs_aroclor_1254,
// eco-direct-eqp, fcv_ug_per_L, 0.014 ug/L) was a current_default catalog scaffold citing the
// generic "current calculator design" placeholder source. This session verified the VALUE is
// correct against a real source: the US EPA National Recommended Water Quality Criteria - Aquatic
// Life Criteria Table gives a total-PCBs chronic criterion (CCC) of 0.014 ug/L, and that criterion
// explicitly covers "the sum of all congener, isomer, homolog, and Aroclor analyses" -- so it is the
// correct FCV-equivalent for the Aroclor 1254 eco-direct row. Only the CITATION was a placeholder;
// this tool re-cites the record to the real source and promotes it to approved_source_backed.
//
// This is a companion, opposite-direction correction to the SAME-session demotions of pv-bap-fcv,
// pv-pcb-trv-eco, and pv-mehg-trv-eco (those 3 cited sources that do not exist / do not match and were
// nulled + deleted; see substanceLibrary.ts notes for benzo_a_pyrene / total_pcbs_aroclor_1254 /
// methylmercury dated 2026-07-02).
//
// SCOPE: default_status is NOT changed (stays current_default -- this is the currently wired
// calculator value; classifyCandidate's active_current_default disposition means this row is NEVER
// eligible for resolveEcoSeed regardless of qa_status, so the promotion is provenance-only and has
// no effect on which value the calculator uses). The VALUE (0.014 ug/L) is UNCHANGED; only the
// citation + qa/evidence/canonical status move to their correct, source-backed state.
//
// The cited source (src-us-epa-nrwqc-aquatic-life-live) is ALREADY direct_source_verified (pinned
// 2026-06-19 by J. Nelson per its notes field) -- this tool does not touch sources.json.
//
// LOAD-BEARING RULES honored:
//  - AI NEVER writes qa_status without HITL attestation. This tool is run on the OWNER's INLINE
//    APPROVAL (this correction was owner-directed in-session, 2026-07-02); --reviewer/--date are
//    the attestation. Per feedback_inline_approval_is_the_attestation_not_ps_commands.md, the AI runs
//    --apply itself on inline approval (reviewer J. Nelson).
//  - AFTER --apply (rule 3): run npx tsc --noEmit; npm run lint; npm run test:ci.
//
// USAGE (run from anywhere; paths resolve from the script location):
//   node scripts/matrix-options/promote-pcb-fcv-nrwqc.mjs --reviewer "J. Nelson" --date 2026-07-02
//   node scripts/matrix-options/promote-pcb-fcv-nrwqc.mjs --reviewer "J. Nelson" --date 2026-07-02 --apply
//
// Default is a DRY RUN (prints the per-record plan, writes nothing). --apply writes
// matrix_research/reference_catalog/parameter_values.json only (sources.json is untouched).

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

// The ONLY record this tool will ever touch. Hard-coded so scope is fixed + auditable.
export const PCB_FCV_PROMOTION_VALUE_ID = 'pv-pcb-fcv';
export const PCB_FCV_PROMOTION_SOURCE_ID = 'src-us-epa-nrwqc-aquatic-life-live';
const PLACEHOLDER_SOURCE_ID = 'src-current-calculator-design-v1';

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

export function planPromotion(paramValues, sources, _opts) {
  const valueRecord = paramValues.find(
    (r) => r.parameter_value_id === PCB_FCV_PROMOTION_VALUE_ID,
  );
  if (!valueRecord) {
    throw new Error(
      'Precondition failed: value record not found in parameter_values.json: ' +
      PCB_FCV_PROMOTION_VALUE_ID,
    );
  }
  if (!Array.isArray(valueRecord.evidence_items) || valueRecord.evidence_items.length === 0) {
    throw new Error(
      'Precondition failed: ' + PCB_FCV_PROMOTION_VALUE_ID + ' has no evidence_items',
    );
  }

  // Fail-closed IDENTITY check: only ever promote the EXACT intended PCB eco-direct FCV record.
  // default_status is intentionally NOT part of the target-state transition (stays current_default).
  const EXPECTED_VALUE = {
    substance_key: 'total_pcbs_aroclor_1254',
    pathway: 'eco-direct-eqp',
    input_key: 'fcv_ug_per_L',
    value: 0.014,
    unit: 'ug/L',
    value_type: 'single_value',
    default_status: 'current_default',
  };
  const identityMismatch = Object.entries(EXPECTED_VALUE).filter(
    ([k, v]) => valueRecord[k] !== v,
  );
  if (identityMismatch.length > 0) {
    throw new Error(
      'Precondition failed: ' + PCB_FCV_PROMOTION_VALUE_ID +
      ' is not in the expected identity. Mismatched field(s):\n' +
      identityMismatch
        .map(([k, v]) => '  ' + k + ': expected ' + JSON.stringify(v) +
          ', actual ' + JSON.stringify(valueRecord[k]))
        .join('\n') +
      '\nRefusing to promote a record that does not match the verified Total PCBs eco-direct FCV.',
    );
  }

  const alreadyDone =
    valueRecord.qa_status === 'approved' &&
    valueRecord.evidence_support_status === 'approved_source_backed' &&
    valueRecord.canonical_source_status === 'direct_source_verified' &&
    Array.isArray(valueRecord.source_ids) &&
    valueRecord.source_ids.length === 1 &&
    valueRecord.source_ids[0] === PCB_FCV_PROMOTION_SOURCE_ID &&
    valueRecord.evidence_items.every(
      (ev) => ev.qa_status === 'approved' && ev.source_id === PCB_FCV_PROMOTION_SOURCE_ID,
    );
  const expectedPre =
    valueRecord.qa_status === 'needs_review' &&
    valueRecord.evidence_support_status === 'current_calculator_scaffold' &&
    Array.isArray(valueRecord.source_ids) &&
    valueRecord.source_ids.length === 1 &&
    valueRecord.source_ids[0] === PLACEHOLDER_SOURCE_ID &&
    valueRecord.evidence_items.every(
      (ev) => ev.qa_status === 'needs_review' && ev.source_id === PLACEHOLDER_SOURCE_ID,
    );

  if (!alreadyDone && !expectedPre) {
    throw new Error(
      'Precondition failed: ' + PCB_FCV_PROMOTION_VALUE_ID +
      ' is not in the expected pre-promotion state nor the already-promoted state.\n' +
      '  expected pre  : qa_status=needs_review, evidence_support_status=current_calculator_scaffold, ' +
      'source_ids=["' + PLACEHOLDER_SOURCE_ID + '"]\n' +
      '  already-done  : qa_status=approved, evidence_support_status=approved_source_backed, ' +
      'canonical_source_status=direct_source_verified, source_ids=["' + PCB_FCV_PROMOTION_SOURCE_ID + '"]\n' +
      '  actual        : qa_status=' + valueRecord.qa_status +
      ', evidence_support_status=' + valueRecord.evidence_support_status +
      ', source_ids=' + JSON.stringify(valueRecord.source_ids) + '\n' +
      'Refusing to promote a drifted/partially-promoted record.',
    );
  }

  // The cited source must already be direct-source-verified (it is; pinned 2026-06-19). Fail closed
  // if that ever drifts, since this tool does not promote sources.json.
  const sourceRecord = sources.find((s) => s.source_id === PCB_FCV_PROMOTION_SOURCE_ID);
  if (!sourceRecord) {
    throw new Error(
      'Precondition failed: source record not found in sources.json: ' + PCB_FCV_PROMOTION_SOURCE_ID,
    );
  }
  if (sourceRecord.canonical_source_status !== 'direct_source_verified') {
    throw new Error(
      'Precondition failed: source ' + PCB_FCV_PROMOTION_SOURCE_ID +
      ' canonical_source_status="' + sourceRecord.canonical_source_status +
      '" is not direct_source_verified. This tool does not promote sources.json; promote the source ' +
      'first (or use a different tool) before re-citing this value to it.',
    );
  }

  return { valueRecord, sourceRecord, alreadyDone, promoteValue: !alreadyDone };
}

// ---------------------------------------------------------------------------
// Apply
// ---------------------------------------------------------------------------

const PROMOTION_STAMP_MARKER = 'PROMOTED to approved';

function buildValueStamp(date, reviewer) {
  return (
    ' [Re-cited to the real US EPA NRWQC total-PCBs chronic criterion (0.014 ug/L; covers Aroclor ' +
    'analyses) and PROMOTED to approved (evidence approved_source_backed, source ' +
    'direct_source_verified) on ' + date + ' by ' + reviewer +
    '; the prior placeholder-source language above is superseded.]'
  );
}

export function applyPromotion(paramValues, sources, opts) {
  const plan = planPromotion(paramValues, sources, opts);

  if (plan.promoteValue) {
    const r = plan.valueRecord;
    r.source_ids = [PCB_FCV_PROMOTION_SOURCE_ID];
    r.qa_status = 'approved';
    r.evidence_support_status = 'approved_source_backed';
    r.canonical_source_status = 'direct_source_verified';
    r.evidence_items = r.evidence_items.map((ev) => ({
      ...ev,
      source_id: PCB_FCV_PROMOTION_SOURCE_ID,
      locator:
        'EPA National Recommended Water Quality Criteria - Aquatic Life Criteria Table, total PCBs ' +
        'chronic (CCC)',
      value_text: '0.014 ug/L',
      // An approved evidence item must not retain the scaffold extraction_method/locator_type (the
      // catalog.test.ts "does not allow pending scaffold evidence to be marked approved" guard rejects
      // that combination).
      extraction_method: 'manual_source_extraction',
      locator_type: 'source_table',
      qa_status: 'approved',
      reviewed_by: opts.reviewer,
      reviewed_at: opts.date,
      note:
        'Re-verified 2026-07-02: the EPA NRWQC total-PCBs chronic criterion (CCC) is 0.014 ug/L and ' +
        'explicitly covers the sum of all congener/isomer/homolog/Aroclor analyses. The prior ' +
        '"current calculator scaffold" placeholder citation is superseded.',
    }));
    if (typeof r.review_notes === 'string' && !r.review_notes.includes(PROMOTION_STAMP_MARKER)) {
      r.review_notes += buildValueStamp(opts.date, opts.reviewer);
    }
  }

  return plan;
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

const BANNER = [
  '=========================================================================',
  ' promote-pcb-fcv-nrwqc.mjs -- owner-run Total PCBs Eco-Direct FCV re-citation',
  '=========================================================================',
  '',
  'OWNER-APPROVED 2026-07-02: pv-pcb-fcv (0.014 ug/L) is re-cited from the placeholder',
  '"current calculator design" source to the real US EPA NRWQC total-PCBs chronic criterion',
  '(same value, correct source). SCOPE: value + default_status (current_default) UNCHANGED;',
  'only citation + qa_status/evidence_support_status/canonical_source_status are promoted.',
  '',
].join('\n');

const HELP = [
  'promote-pcb-fcv-nrwqc.mjs -- owner-run Total PCBs Eco-Direct FCV re-citation tool.',
  '',
  'Usage:',
  '  node scripts/matrix-options/promote-pcb-fcv-nrwqc.mjs --reviewer "<id>" --date YYYY-MM-DD [--apply]',
  '',
  'Options:',
  '  --reviewer "<id>"        Reviewer attestation -> evidence.reviewed_by (required for --apply)',
  '  --date YYYY-MM-DD        Review date -> evidence.reviewed_at (required for --apply)',
  '  --apply                  Write parameter_values.json (default is a dry run that writes nothing)',
  '',
  'Target:',
  '  VALUE : pv-pcb-fcv (parameter_values.json)',
  '',
  'On --apply, VALUE record changes:',
  '  source_ids                 [src-current-calculator-design-v1] -> [src-us-epa-nrwqc-aquatic-life-live]',
  '  qa_status                  needs_review -> approved',
  '  evidence_support_status    current_calculator_scaffold -> approved_source_backed',
  '  canonical_source_status    (unset) -> direct_source_verified',
  '  default_status              UNCHANGED (stays current_default)',
  '  value                       UNCHANGED (0.014 ug/L)',
  '',
  'After --apply: npx tsc --noEmit; npm run lint; npm run test:ci',
].join('\n');

function printPlan(plan, opts) {
  if (plan.promoteValue) {
    const r = plan.valueRecord;
    console.log('  VALUE   PROMOTE  ' + PCB_FCV_PROMOTION_VALUE_ID);
    console.log('    source_ids              : ' + JSON.stringify(r.source_ids) +
      ' -> ["' + PCB_FCV_PROMOTION_SOURCE_ID + '"]');
    console.log('    qa_status               : ' + r.qa_status + ' -> approved');
    console.log('    evidence_support_status : ' + r.evidence_support_status +
      ' -> approved_source_backed');
    console.log('    canonical_source_status : ' + (r.canonical_source_status ?? '(unset)') +
      ' -> direct_source_verified');
    console.log('    default_status          : ' + r.default_status + ' (UNCHANGED)');
    console.log('    value                   : ' + r.value + ' ' + r.unit + ' (UNCHANGED)');
    console.log('      reviewer              : ' + (opts.reviewer || '(not set)'));
    console.log('      date                  : ' + (opts.date || '(not set)'));
  } else {
    console.log('  VALUE   SKIP     ' + PCB_FCV_PROMOTION_VALUE_ID + ': already in target state (no-op)');
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
  console.log('File    : ' + PARAM_VALUES_FILE);
  console.log('reviewer: ' + (opts.reviewer || '(not set)'));
  console.log('date    : ' + (opts.date || '(not set)'));
  console.log('');

  const paramValues = JSON.parse(fs.readFileSync(PARAM_VALUES_FILE, 'utf8'));
  const sources = JSON.parse(fs.readFileSync(SOURCES_FILE, 'utf8'));

  const plan = planPromotion(paramValues, sources, opts);

  console.log('Before/after plan:');
  printPlan(plan, opts);
  console.log('');

  if (!opts.apply) {
    console.log('DRY RUN -- no file written. Re-run with --apply (plus --reviewer/--date) to write.');
    return;
  }

  validateApplyOptions(opts);

  if (!plan.promoteValue) {
    console.log('Nothing to promote (already in target state). No write.');
    return;
  }

  applyPromotion(paramValues, sources, opts);
  fs.writeFileSync(PARAM_VALUES_FILE, JSON.stringify(paramValues, null, 2) + '\n', 'utf8');
  console.log('WROTE ' + PARAM_VALUES_FILE);

  console.log('');
  console.log('REQUIRED before test:ci -- promoting this record shifts the audit-count guards.');
  console.log('  Update src/lib/matrix-options/provenance/__tests__/library.test.ts in the SAME commit:');
  console.log('    audit.values.approvedSourceBacked        : +1');
  console.log('    audit.values.currentCalculatorScaffold    : -1');
  console.log('  (valueGroups / pendingSourceLocator / currentDefaults are UNCHANGED by this row --');
  console.log('   it was already current_calculator_scaffold, not pending_source_locator, and stays current_default.)');
  console.log('  Also update catalog.test.ts: pv-pcb-fcv qa_status assertion needs_review -> approved.');
  console.log('  Run npm run test:ci and bump to match the FAILING assertion (do not hard-set).');
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
