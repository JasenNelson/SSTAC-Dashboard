// Owner-run doc-only correction helper for HITL Group 5 retriage item #36
// (docs/MATRIX_OPTIONS_HITL_0701_RETRIAGE_2026_07_13.md, "STILL-OPEN items requiring an owner
// decision" #10). Plain ASCII only.
//
// WHY THIS EXISTS
// The 2026-07-13 re-triage of the 2026-07-01 consolidated HITL decisions doc found that
// formaldehyde's SUBSTANCE_LIBRARY entry already carries a reciprocal cross-reference note --
// "abs_dermal is the HC TRV v4.0 Table 5 VOC RAF (cf. benzene/TCE/PCE)." -- but the 3 named
// substances (benzene, tetrachloroethylene, trichloroethylene) were never given the matching
// inline note back. Group 5 total: "6 RESOLVED, 0 SUPERSEDED, 1 STILL-OPEN (maneb + benzene/PCE/TCE
// cross-reference note -- both low-severity, documentation-only, no numeric change required)."
// Only the benzene/PCE/TCE half of that STILL-OPEN item is in scope here (maneb is a separate
// classification/disclosure judgment call, Group 4, not a 3-entry text update).
//
// OWNER RULING (2026-07-17): add the reciprocal cross-reference note to all 3 entries. ZERO
// numeric change -- abs_dermal stays 0.03 on all 3 (already correct; this is a documentation-only
// text update, per the retriage doc's own framing of item #36).
//
// SCOPE: exactly 3 SUBSTANCE_LIBRARY entries in src/lib/matrix-options/substanceLibrary.ts
// (benzene, tetrachloroethylene, trichloroethylene). No parameter_values.json or
// human_health_trv_values.json row is touched -- this is a notes-field text append only, no value
// field (abs_dermal or otherwise) is modified by this script.
//
// FAIL-CLOSED DISCIPLINE (mirrors fix-abs-dermal-pyridine-pah-cohort-2026-07-17.mjs, which mirrors
// supersede-iris-17-alternates.mjs / promote-copper-hc0426.mjs):
//  - Hardcoded row allowlist with an asserted length (3). No dynamic filtering.
//  - Each row's append clause is checked for absence (pre-state) or presence (already-applied
//    state) before any mutation; a block that is in neither state aborts with no writes.
//  - DRY RUN is the default (prints the full before/after plan, writes nothing). --apply is
//    required to write, and only after reviewing the dry-run output.
//  - Idempotent: a row already in the target state is reported SKIP (no-op), not re-applied.
//  - Postcondition: after --apply, the file is re-read from disk and every target row is
//    re-verified to carry the appended clause before declaring success.
//  - abs_dermal value is asserted UNCHANGED (still 0.03) both before and after, on every target
//    row -- this script refuses to run if any row's abs_dermal has drifted from 0.03, since a
//    drifted value would mean the "zero numeric change" premise of this correction no longer holds
//    and the note text (which asserts "0.03 is the ... default") would become inaccurate.
//
// KNOWN DOWNSTREAM TEST IMPACT: none. Grep-confirmed against
// src/lib/matrix-options/__tests__/substanceLibrary.test.ts: no test asserts exact `.notes` string
// content for benzene, tetrachloroethylene, or trichloroethylene (the file's only notes-adjacent
// assertions are on `.abs_dermal`, `.rfd_oral_mg_per_kg_bw_per_day`, `.sf_oral_per_mg_per_kg_bw_per_day`,
// and `.contaminantClass`, none of which this script touches).
//
// USAGE (run from anywhere; paths resolve from the script location):
//   node scripts/matrix-options/add-crossref-note-benzene-pce-tce-2026-07-17.mjs --reviewer "J. Nelson" --date 2026-07-17
//   node scripts/matrix-options/add-crossref-note-benzene-pce-tce-2026-07-17.mjs --reviewer "J. Nelson" --date 2026-07-17 --apply
//
// Default is a DRY RUN (prints the per-record plan, writes nothing). --apply writes
// src/lib/matrix-options/substanceLibrary.ts (the only file this tool ever writes).

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..', '..');
const LIBRARY_FILE = path.join(REPO_ROOT, 'src', 'lib', 'matrix-options', 'substanceLibrary.ts');

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// ---------------------------------------------------------------------------
// Hardcoded allowlist -- EXACTLY 3 rows. abs_dermal is asserted to remain 0.03 (unchanged) on all;
// this script only appends a sentence to the `notes` field.
// ---------------------------------------------------------------------------

const CROSSREF_CLAUSE =
  ' abs_dermal 0.03 is the HC TRV v4.0 Table 5 VOC RAF default (cf. formaldehyde). Cross-reference ' +
  'added 2026-07-17 (HITL Group 5 retriage item #36, owner ruling); no abs_dermal value change.';

export const ROWS = [
  { key: 'benzene', absDermal: '0.03' },
  { key: 'tetrachloroethylene', absDermal: '0.03' },
  { key: 'trichloroethylene', absDermal: '0.03' },
].map((r) => ({ ...r, appendClause: CROSSREF_CLAUSE }));

if (ROWS.length !== 3) {
  throw new Error(
    'Invariant violated: ROWS must contain EXACTLY 3 hardcoded rows (HITL Group 5 retriage item ' +
    '#36 scope: benzene, tetrachloroethylene, trichloroethylene); found ' + ROWS.length +
    '. Refusing to run with a drifted allowlist.',
  );
}

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
    errors.push('--reviewer "<id/name>" is required for --apply (owner HITL attestation)');
  }
  if (!opts.date || !DATE_RE.test(opts.date)) {
    errors.push('--date YYYY-MM-DD is required for --apply');
  }
  if (errors.length) throw new Error('Invalid --apply options:\n  - ' + errors.join('\n  - '));
}

// ---------------------------------------------------------------------------
// Block location (same TypeScript-source-block approach as
// fix-abs-dermal-pyridine-pah-cohort-2026-07-17.mjs -- see that file for rationale).
// ---------------------------------------------------------------------------

const OPEN_NEEDLE = '\n  {\n';
const CLOSE_NEEDLE = '\n  },\n';

function findBlock(text, key) {
  const keyNeedle = "key: '" + key + "',";
  const keyIdx = text.indexOf(keyNeedle);
  if (keyIdx === -1) {
    throw new Error('Precondition failed: key not found in ' + LIBRARY_FILE + ': ' + key);
  }
  if (text.indexOf(keyNeedle, keyIdx + 1) !== -1) {
    throw new Error('Precondition failed: key is not unique in ' + LIBRARY_FILE + ': ' + key);
  }
  const startIdx = text.lastIndexOf(OPEN_NEEDLE, keyIdx);
  if (startIdx === -1) {
    throw new Error('Precondition failed: block open marker not found before key: ' + key);
  }
  const blockStart = startIdx + OPEN_NEEDLE.length;
  const blockEnd = text.indexOf(CLOSE_NEEDLE, keyIdx);
  if (blockEnd === -1) {
    throw new Error('Precondition failed: block close marker not found after key: ' + key);
  }
  return { blockStart, blockEnd };
}

// ---------------------------------------------------------------------------
// Plan (fail-closed preconditions; runs in both dry-run and --apply)
// ---------------------------------------------------------------------------

function planRow(text, row) {
  const { blockStart, blockEnd } = findBlock(text, row.key);
  const block = text.slice(blockStart, blockEnd);

  const absLine = 'abs_dermal: ' + row.absDermal + ',';
  const absCount = block.split(absLine).length - 1;
  if (absCount !== 1) {
    throw new Error(
      'Precondition failed: ' + row.key + ' abs_dermal is not ' + row.absDermal +
      ' (expected exactly one `' + absLine + '` in the block; found ' + absCount + '). This script ' +
      'is a doc-only cross-reference note (zero numeric change) and refuses to run against a ' +
      'drifted abs_dermal value. No writes performed.',
    );
  }

  const clauseCount = block.split(row.appendClause).length - 1;
  const endsWithNotesTail = block.endsWith(".',");
  const isPreState = clauseCount === 0 && endsWithNotesTail;
  const isDoneState = clauseCount === 1;

  if (!isPreState && !isDoneState) {
    throw new Error(
      'Precondition failed: ' + row.key + ' entry is not in the expected pre-state nor the ' +
      'already-applied state.\n  append-clause matches : ' + clauseCount + ' (expect 0 pre / 1 done)\n' +
      '  block ends with `.\',` : ' + endsWithNotesTail + ' (expect true for pre-state splice)\n' +
      'Refusing to touch a drifted/partially-applied entry. No writes performed.',
    );
  }

  return {
    key: row.key,
    blockStart,
    blockEnd,
    alreadyDone: isDoneState,
    apply: !isDoneState
      ? (b) => {
          // Splice the cross-reference clause in immediately before the trailing `',` (the notes
          // field's closing quote + comma), i.e. AFTER the existing closing period, so it reads as
          // a new appended sentence. No other field in the block is touched by this script.
          const insertAt = b.length - 2;
          return b.slice(0, insertAt) + row.appendClause + b.slice(insertAt);
        }
      : null,
  };
}

export function planAll(text) {
  return ROWS.map((row) => planRow(text, row));
}

// ---------------------------------------------------------------------------
// Apply (returns the new full file text; does not write)
// ---------------------------------------------------------------------------

export function applyAll(text) {
  const plans = planAll(text);
  const ordered = [...plans].sort((a, b) => b.blockStart - a.blockStart);
  let newText = text;
  const touched = [];
  for (const plan of ordered) {
    if (plan.apply) {
      const block = newText.slice(plan.blockStart, plan.blockEnd);
      const newBlock = plan.apply(block);
      newText = newText.slice(0, plan.blockStart) + newBlock + newText.slice(plan.blockEnd);
      touched.push(plan.key);
    }
  }
  return { newText, touched, plans };
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

const BANNER = [
  '=============================================================================',
  ' add-crossref-note-benzene-pce-tce-2026-07-17.mjs',
  '   HITL Group 5 retriage item #36 -- benzene/PCE/TCE abs_dermal cross-reference note',
  '   (doc-only, ZERO numeric change)',
  '=============================================================================',
  '',
  'WHY: formaldehyde\'s entry already says "abs_dermal is the HC TRV v4.0 Table 5 VOC RAF',
  '  (cf. benzene/TCE/PCE)." but benzene, tetrachloroethylene, and trichloroethylene never got the',
  '  matching note back. docs/MATRIX_OPTIONS_HITL_0701_RETRIAGE_2026_07_13.md Group 5, STILL-OPEN',
  '  item #10 (low-severity, documentation-only, no numeric change required).',
  '',
  'SCOPE: src/lib/matrix-options/substanceLibrary.ts ONLY, 3 entries, notes field only.',
  '  abs_dermal value (0.03) is asserted UNCHANGED on all 3 -- this script never modifies it and',
  '  refuses to run if it has drifted.',
  '',
  'KNOWN TEST IMPACT: none (no test asserts exact notes-string content for these 3 substances).',
  '',
].join('\n');

const HELP = [
  'add-crossref-note-benzene-pce-tce-2026-07-17.mjs -- owner-run doc-only note append (3 rows).',
  '',
  'Usage:',
  '  node scripts/matrix-options/add-crossref-note-benzene-pce-tce-2026-07-17.mjs --reviewer "<id>" --date YYYY-MM-DD [--apply]',
  '',
  'Options:',
  '  --reviewer "<id>"   Reviewer attestation (required for --apply; printed in the run log)',
  '  --date YYYY-MM-DD   Review date (required for --apply; printed in the run log)',
  '  --apply              Write the file if it changed (default is a dry run, writes nothing)',
  '',
  'Targets: benzene, tetrachloroethylene, trichloroethylene -- appends a reciprocal cross-reference',
  'sentence to each notes field. ZERO numeric/value change.',
  '',
  'AI never runs this with --apply. The owner runs it; --reviewer/--date are the HITL attestation.',
  'After --apply: npx tsc --noEmit; npm run lint; npm run test:ci',
].join('\n');

function printPlan(plans) {
  for (const plan of plans) {
    if (plan.alreadyDone) {
      console.log('  SKIP     ' + plan.key + ': already carries the cross-reference note (no-op)');
    } else {
      console.log('  UPDATE   ' + plan.key + ': append cross-reference note to notes field (no value change)');
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
  console.log('Mode    : ' + (opts.apply ? 'APPLY (will write file)' : 'DRY RUN (writes nothing)'));
  console.log('File    : ' + LIBRARY_FILE);
  console.log('reviewer: ' + (opts.reviewer || '(not set)'));
  console.log('date    : ' + (opts.date || '(not set)'));
  console.log('records : ' + ROWS.length + ' SUBSTANCE_LIBRARY entries');
  console.log('');

  const originalText = fs.readFileSync(LIBRARY_FILE, 'utf8');
  const plans = planAll(originalText);

  console.log('Before/after plan:');
  printPlan(plans);
  console.log('');

  const totalToApply = plans.filter((p) => !p.alreadyDone).length;
  const totalSkipped = plans.filter((p) => p.alreadyDone).length;
  console.log('Summary: ' + totalToApply + ' record(s) to update, ' + totalSkipped + ' already in target state.');

  if (!opts.apply) {
    console.log('');
    console.log('DRY RUN -- no file written. Re-run with --apply (plus --reviewer/--date) to write.');
    return;
  }

  validateApplyOptions(opts);

  if (totalToApply === 0) {
    console.log('');
    console.log('Nothing to update (all records already in target state). No write.');
    return;
  }

  const { newText, touched } = applyAll(originalText);
  fs.writeFileSync(LIBRARY_FILE, newText, 'utf8');
  console.log('WROTE ' + LIBRARY_FILE + ' (' + touched.length + ' entries updated)');

  // Postcondition: re-read from disk and assert every target row now carries the appended clause
  // exactly once, AND that abs_dermal is still exactly 0.03 (zero numeric change enforced).
  const rereadText = fs.readFileSync(LIBRARY_FILE, 'utf8');
  const postFailures = [];
  for (const row of ROWS) {
    const { blockStart, blockEnd } = findBlock(rereadText, row.key);
    const block = rereadText.slice(blockStart, blockEnd);
    if (block.split(row.appendClause).length - 1 !== 1) {
      postFailures.push(row.key + ': expected the cross-reference clause exactly once after write.');
    }
    const absLine = 'abs_dermal: ' + row.absDermal + ',';
    if (block.split(absLine).length - 1 !== 1) {
      postFailures.push(row.key + ': abs_dermal drifted from ' + row.absDermal + ' after write (should be unchanged).');
    }
  }
  if (postFailures.length > 0) {
    throw new Error(
      'POSTCONDITION FAILED after write -- on-disk state does not match the intended correction:\n  ' +
      postFailures.join('\n  '),
    );
  }
  console.log('Postcondition verified: all ' + ROWS.length + ' target entries carry the cross-reference note, abs_dermal unchanged.');

  console.log('');
  console.log('No test updates are required for this doc-only change (see the file-header KNOWN TEST');
  console.log('IMPACT note). Still run the full local gates before pushing:');
  console.log('  npx tsc --noEmit; npm run lint; npm run test:ci;');
  console.log('  npm run build:monitored:clean -- -TimeoutSeconds 360 -PollSeconds 10;');
  console.log('  npm run test:e2e');
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : '';
if (invokedPath === fileURLToPath(import.meta.url)) {
  main();
}
