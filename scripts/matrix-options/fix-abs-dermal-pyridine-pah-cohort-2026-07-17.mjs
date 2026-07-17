// Owner-run correction helper for HITL Group 2 retriage item #35
// (docs/MATRIX_OPTIONS_HITL_0701_RETRIAGE_2026_07_13.md, "STILL-OPEN items requiring an owner
// decision" #4 and #5). Plain ASCII only.
//
// WHY THIS EXISTS
// The 2026-07-13 re-triage of the 2026-07-01 consolidated HITL decisions doc left 2 of the 10
// Group 2 (abs_dermal anomalies) items STILL-OPEN:
//   (a) pyridine: HC TRV v4.0 Table 5 VOC RAFDerm default (0.03) vs organic SVOC default (0.1) --
//       explicitly flagged in-file as "0.03 kept as the VOC default awaiting a dedicated review"
//       (Method 8270-classified despite bp 115 C, a genuine VOC-vs-SVOC boundary case).
//   (b) PAH-class abs_dermal cohort: naphthalene is confirmed-correct at 0.148 (HC TRV v4.0/v3.0
//       Table 5, Moody et al. 2007); 11 sibling organic-PAH entries remained at 0.13 with no note
//       addressing the 0.148-vs-0.13 discrepancy.
//
// OWNER RULING (2026-07-17): (a) pyridine -> organic SVOC class default, abs_dermal 0.1. (b) the
// 11-entry PAH cohort -> uniform abs_dermal 0.148, matching naphthalene's HC TRV v4.0/v3.0 Table 5
// value (Moody et al. 2007).
//
// SCOPE: exactly 12 SUBSTANCE_LIBRARY entries in src/lib/matrix-options/substanceLibrary.ts (a
// hardcoded TypeScript source array, not a JSON catalog file -- these abs_dermal values are
// source-of-truth / class-default assignments held directly in the library, not derived from a
// matrix_research/reference_catalog/*.json parameter_value row for 11 of the 12 keys). Confirmed by
// direct search of parameter_values.json and human_health_trv_values.json: abs_dermal never appears
// as an input_key in human_health_trv_values.json; parameter_values.json carries only 8 abs_dermal
// scaffold rows total, and among this script's 12 keys only benzo_a_pyrene has one
// (pv-bap-hh-direct-abs-dermal, value 0.13, qa_status=needs_review, a "current_calculator_scaffold"
// placeholder explicitly marked "Do not treat as source-approved until exact source locator is
// confirmed" -- not an independent authority). That scaffold row is OUT OF SCOPE for this script
// (flagged to the owner separately) so this tool's blast radius stays limited to the one file the
// retriage doc actually discusses.
//
// FAIL-CLOSED DISCIPLINE (mirrors supersede-iris-17-alternates.mjs / promote-copper-hc0426.mjs):
//  - Hardcoded row allowlist with an asserted length (12). No dynamic filtering.
//  - Each row carries the EXACT expected old abs_dermal value and EXACT expected old notes text (or
//    old notes tail, for the append-only PAH rows). A mismatch against the on-disk file aborts with
//    no writes -- this tool refuses to touch a drifted entry.
//  - DRY RUN is the default (prints the full before/after plan, writes nothing). --apply is required
//    to write, and only after reviewing the dry-run output.
//  - Idempotent: a row already in the target state is reported SKIP (no-op), not re-applied.
//  - Postcondition: after --apply, the file is re-read from disk and every target row is re-verified
//    at its new value before declaring success.
//
// KNOWN DOWNSTREAM TEST IMPACT (not fixed by this script -- separate PR per house style: fix the
// test, do not silently break it):
//   src/lib/matrix-options/__tests__/substanceLibrary.test.ts "Group 2 abs_dermal source-verified
//   values (2026-07-02)" hardcodes { key: 'pyridine', absDermal: 0.03, source: 'HC VOC RAFDerm 0.03' }
//   (line ~927 as of 74900bf). Applying this script's pyridine change WILL fail that test until the
//   expectation is updated to absDermal: 0.1. No PAH-cohort abs_dermal value is locked by any test
//   (grep-confirmed against __tests__/substanceLibrary.test.ts).
//
// USAGE (run from anywhere; paths resolve from the script location):
//   node scripts/matrix-options/fix-abs-dermal-pyridine-pah-cohort-2026-07-17.mjs --reviewer "J. Nelson" --date 2026-07-17
//   node scripts/matrix-options/fix-abs-dermal-pyridine-pah-cohort-2026-07-17.mjs --reviewer "J. Nelson" --date 2026-07-17 --apply
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
// Hardcoded allowlist -- EXACTLY 12 rows (1 pyridine full-notes rewrite + 11 PAH-cohort value +
// append-clause corrections). Each `oldAbsDermal` / `newAbsDermal` pair and each `oldNotes` /
// `newNotesTail` string is asserted verbatim against the on-disk block before any mutation.
// ---------------------------------------------------------------------------

// pyridine: full notes replacement (the old notes text is now factually stale after the value
// correction -- it says "0.03 kept as the VOC default awaiting a dedicated review", which would
// directly contradict a value of 0.1 if merely appended to; a full swap avoids that contradiction).
const PYRIDINE_ROW = {
  key: 'pyridine',
  oldAbsDermal: '0.03',
  newAbsDermal: '0.1',
  oldNotes:
    "'Human-health pathways only; RfD seeded build-first from the approved row ' +\n" +
    "      'pv-iris-pyridine-hh-direct-rfd / -food-rfd (value 0.001). logKow not in catalog ' +\n" +
    "      '-> eco pathways filtered. abs_dermal 0.03 = HC TRV v4.0 Table 5 VOC RAFDerm ' +\n" +
    "      'default (0.03, MECP 2011). Boundary case: volatile (bp 115 C) but Method ' +\n" +
    "      '8270-classified; 0.03 kept as the VOC default awaiting a dedicated review.'",
  newNotes:
    "'Human-health pathways only; RfD seeded build-first from the approved row ' +\n" +
    "      'pv-iris-pyridine-hh-direct-rfd / -food-rfd (value 0.001). logKow not in catalog ' +\n" +
    "      '-> eco pathways filtered. abs_dermal 0.1 = organic-class SVOC default (EPA RAGS ' +\n" +
    "      'Part E); Method 8270-classified (SVOC), not treated as a VOC despite being ' +\n" +
    "      'volatile (bp 115 C); prior 0.03 HC VOC RAFDerm label was the flagged VOC-vs-SVOC ' +\n" +
    "      'boundary case (HITL Group 2 retriage item #35), now resolved by owner ruling " +
    "2026-07-17.'",
};

// 11-entry organic-PAH cohort: value 0.13 -> 0.148, matching naphthalene's confirmed-correct HC
// TRV v4.0/v3.0 Table 5 value (Moody et al. 2007). Each row appends a corrective clause to the END
// of its existing notes field (verified to end in the literal `.',` before appending) rather than
// rewriting the whole notes string, since none of the 11 existing notes make a claim that would
// contradict the new value (unlike pyridine).
// NOTE: no apostrophes/single-quotes anywhere in this clause -- it is spliced verbatim into a
// single-quoted TypeScript string literal in substanceLibrary.ts, and an unescaped apostrophe would
// terminate that string literal early and corrupt the file (caught by tmp_syntax_check.mjs during
// script development; the original draft used "naphthalene's", rephrased to avoid the possessive).
const PAH_APPEND_CLAUSE =
  ' Corrected 2026-07-17 (HITL Group 2 retriage item #35, owner ruling): abs_dermal 0.13 -> 0.148 ' +
  'to match the confirmed-correct naphthalene value (HC TRV v4.0/v3.0 Table 5 PAH-class dermal RAF, ' +
  'Moody et al. 2007); 0.13 was not independently defensible for this congener.';

const PAH_ROWS = [
  { key: 'benzo_a_pyrene' },
  { key: 'pyrene' },
  { key: 'benz_a_anthracene' },
  { key: 'anthracene' },
  { key: 'fluoranthene' },
  { key: 'phenanthrene' },
  { key: 'acenaphthene' },
  { key: 'fluorene' },
  { key: 'dibenzo_a_h_anthracene' },
  { key: '2_methylnaphthalene' },
  { key: 'methylnaphthalene_2' },
].map((r) => ({
  ...r,
  oldAbsDermal: '0.13',
  newAbsDermal: '0.148',
  appendClause: PAH_APPEND_CLAUSE,
}));

export const ALL_ROWS = [PYRIDINE_ROW, ...PAH_ROWS];

if (ALL_ROWS.length !== 12) {
  throw new Error(
    'Invariant violated: ALL_ROWS must contain EXACTLY 12 hardcoded rows (HITL Group 2 retriage ' +
    'item #35 scope: 1 pyridine + 11 PAH-cohort); found ' + ALL_ROWS.length +
    '. Refusing to run with a drifted allowlist.',
  );
}
if (PAH_ROWS.length !== 11) {
  throw new Error('Invariant violated: PAH_ROWS must contain EXACTLY 11 rows; found ' + PAH_ROWS.length + '.');
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
// Block location (TypeScript source, not JSON -- locate each SUBSTANCE_LIBRARY entry by its unique
// `key: '<key>',` line, then bound the entry object literal by the enclosing `  {\n` / `\n  },\n`
// markers, which are consistently 2-space-indented for every top-level array entry in this file).
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

function planPyridine(text) {
  const { blockStart, blockEnd } = findBlock(text, PYRIDINE_ROW.key);
  const block = text.slice(blockStart, blockEnd);

  const oldAbsLine = 'abs_dermal: ' + PYRIDINE_ROW.oldAbsDermal + ',';
  const newAbsLine = 'abs_dermal: ' + PYRIDINE_ROW.newAbsDermal + ',';
  const absCountOld = block.split(oldAbsLine).length - 1;
  const absCountNew = block.split(newAbsLine).length - 1;

  const notesCountOld = block.split(PYRIDINE_ROW.oldNotes).length - 1;
  const notesCountNew = block.split(PYRIDINE_ROW.newNotes).length - 1;

  const isPreState = absCountOld === 1 && notesCountOld === 1;
  const isDoneState = absCountNew === 1 && notesCountNew === 1;

  if (!isPreState && !isDoneState) {
    throw new Error(
      'Precondition failed: pyridine entry is not in the expected pre-state nor the already-applied ' +
      'state.\n  abs_dermal old-line matches: ' + absCountOld + ' (expect 1 for pre-state)\n' +
      '  abs_dermal new-line matches: ' + absCountNew + ' (expect 1 for done-state)\n' +
      '  notes old-text matches     : ' + notesCountOld + ' (expect 1 for pre-state)\n' +
      '  notes new-text matches     : ' + notesCountNew + ' (expect 1 for done-state)\n' +
      'Refusing to touch a drifted/partially-applied entry. No writes performed.',
    );
  }

  return {
    key: PYRIDINE_ROW.key,
    blockStart,
    blockEnd,
    alreadyDone: isDoneState,
    apply: !isDoneState
      ? (b) => b.replace(oldAbsLine, newAbsLine).replace(PYRIDINE_ROW.oldNotes, PYRIDINE_ROW.newNotes)
      : null,
    oldAbsDermal: PYRIDINE_ROW.oldAbsDermal,
    newAbsDermal: PYRIDINE_ROW.newAbsDermal,
  };
}

function planPahRow(text, row) {
  const { blockStart, blockEnd } = findBlock(text, row.key);
  const block = text.slice(blockStart, blockEnd);

  const oldAbsLine = 'abs_dermal: ' + row.oldAbsDermal + ',';
  const newAbsLine = 'abs_dermal: ' + row.newAbsDermal + ',';
  const absCountOld = block.split(oldAbsLine).length - 1;
  const absCountNew = block.split(newAbsLine).length - 1;

  const clauseCount = block.split(row.appendClause).length - 1;

  // Pre-state: exactly one old abs_dermal line, zero new abs_dermal lines, clause absent, block
  // ends with the literal notes-closing sequence `.',` (verified so the append-before-tail splice
  // below is unambiguous).
  const endsWithNotesTail = block.endsWith(".',");
  const isPreState = absCountOld === 1 && absCountNew === 0 && clauseCount === 0 && endsWithNotesTail;
  const isDoneState = absCountNew === 1 && absCountOld === 0 && clauseCount === 1;

  if (!isPreState && !isDoneState) {
    throw new Error(
      'Precondition failed: ' + row.key + ' entry is not in the expected pre-state nor the ' +
      'already-applied state.\n  abs_dermal old-line matches: ' + absCountOld + ' (expect 1 for pre-state)\n' +
      '  abs_dermal new-line matches: ' + absCountNew + ' (expect 1 for done-state)\n' +
      '  append-clause matches      : ' + clauseCount + ' (expect 0 pre / 1 done)\n' +
      '  block ends with `.\',`      : ' + endsWithNotesTail + ' (expect true for pre-state splice)\n' +
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
          const withValue = b.replace(oldAbsLine, newAbsLine);
          // Splice the corrective clause in immediately before the trailing `',` (the notes
          // field's closing quote + comma), i.e. AFTER the existing closing period, so it reads
          // as a new appended sentence rather than swallowing the period ("...catalog." + clause
          // + "',", not "...catalog" + clause + ".',"). The abs_dermal value substitution above
          // never touches the tail, so `length - 2` still points at the same "',"" that the
          // pre-state precondition verified via `endsWith(".',")`.
          const insertAt = withValue.length - 2;
          return withValue.slice(0, insertAt) + row.appendClause + withValue.slice(insertAt);
        }
      : null,
    oldAbsDermal: row.oldAbsDermal,
    newAbsDermal: row.newAbsDermal,
  };
}

export function planAll(text) {
  const pyridinePlan = planPyridine(text);
  const pahPlans = PAH_ROWS.map((row) => planPahRow(text, row));
  return [pyridinePlan, ...pahPlans];
}

// ---------------------------------------------------------------------------
// Apply (returns the new full file text; does not write)
// ---------------------------------------------------------------------------

export function applyAll(text) {
  const plans = planAll(text);
  // Apply back-to-front by blockStart so earlier splice offsets are not invalidated by later ones.
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
  ' fix-abs-dermal-pyridine-pah-cohort-2026-07-17.mjs',
  '   HITL Group 2 retriage item #35 -- pyridine + 11-entry PAH-cohort abs_dermal correction',
  '=============================================================================',
  '',
  'WHY: docs/MATRIX_OPTIONS_HITL_0701_RETRIAGE_2026_07_13.md left 2 Group-2 items STILL-OPEN:',
  '  (a) pyridine: VOC RAF (0.03) vs organic SVOC default (0.1) boundary case.',
  '  (b) 11 organic-PAH entries at 0.13 vs naphthalene\'s confirmed-correct 0.148.',
  'Owner ruling 2026-07-17: pyridine -> 0.1 (SVOC class default); PAH cohort -> uniform 0.148',
  '(matching naphthalene, HC TRV v4.0/v3.0 Table 5, Moody et al. 2007).',
  '',
  'SCOPE: src/lib/matrix-options/substanceLibrary.ts ONLY, 12 entries. No parameter_values.json or',
  '  human_health_trv_values.json row is touched by this script (verified: abs_dermal is not an',
  '  input_key in the HH TRV catalog; only benzo_a_pyrene has a parameter_values.json abs_dermal',
  '  scaffold row, and it is a needs_review current_calculator_scaffold placeholder, out of scope',
  '  here -- flagged separately for owner decision).',
  '',
  'KNOWN TEST IMPACT: substanceLibrary.test.ts locks pyridine at absDermal 0.03 (Group 2 block,',
  '  ~line 927). That test expectation must be updated to 0.1 in the same PR as --apply. No test',
  '  locks any PAH-cohort abs_dermal value.',
  '',
].join('\n');

const HELP = [
  'fix-abs-dermal-pyridine-pah-cohort-2026-07-17.mjs -- owner-run abs_dermal correction (12 rows).',
  '',
  'Usage:',
  '  node scripts/matrix-options/fix-abs-dermal-pyridine-pah-cohort-2026-07-17.mjs --reviewer "<id>" --date YYYY-MM-DD [--apply]',
  '',
  'Options:',
  '  --reviewer "<id>"   Reviewer attestation (required for --apply; printed in the run log)',
  '  --date YYYY-MM-DD   Review date (required for --apply; printed in the run log)',
  '  --apply              Write the file if it changed (default is a dry run, writes nothing)',
  '',
  'Targets: pyridine (abs_dermal 0.03 -> 0.1, full notes rewrite) + 11 organic-PAH entries',
  '(abs_dermal 0.13 -> 0.148, appended corrective clause).',
  '',
  'AI never runs this with --apply. The owner runs it; --reviewer/--date are the HITL attestation.',
  'After --apply: update substanceLibrary.test.ts pyridine expectation to 0.1, then',
  'npx tsc --noEmit; npm run lint; npm run test:ci',
].join('\n');

function printPlan(plans) {
  for (const plan of plans) {
    if (plan.alreadyDone) {
      console.log('  SKIP     ' + plan.key + ': already at target state (no-op)');
    } else {
      console.log('  UPDATE   ' + plan.key);
      console.log('    abs_dermal : ' + plan.oldAbsDermal + ' -> ' + plan.newAbsDermal);
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
  console.log('records : ' + ALL_ROWS.length + ' SUBSTANCE_LIBRARY entries');
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

  // Postcondition: re-read from disk and assert every target row now carries its new abs_dermal
  // value exactly once within its own block.
  const rereadText = fs.readFileSync(LIBRARY_FILE, 'utf8');
  const postFailures = [];
  for (const row of ALL_ROWS) {
    const { blockStart, blockEnd } = findBlock(rereadText, row.key);
    const block = rereadText.slice(blockStart, blockEnd);
    const newAbsLine = 'abs_dermal: ' + row.newAbsDermal + ',';
    if (block.split(newAbsLine).length - 1 !== 1) {
      postFailures.push(row.key + ': expected exactly one `' + newAbsLine + '` after write, not found.');
    }
  }
  if (postFailures.length > 0) {
    throw new Error(
      'POSTCONDITION FAILED after write -- on-disk state does not match the intended correction:\n  ' +
      postFailures.join('\n  '),
    );
  }
  console.log('Postcondition verified: all ' + ALL_ROWS.length + ' target entries carry their new abs_dermal value on disk.');

  console.log('');
  console.log('REQUIRED FOLLOW-UP (same PR): update substanceLibrary.test.ts pyridine expectation');
  console.log('  (Group 2 abs_dermal source-verified values block) from absDermal: 0.03 to 0.1.');
  console.log('Then run the full local gates before pushing:');
  console.log('  npx tsc --noEmit; npm run lint; npm run test:ci;');
  console.log('  npm run build:monitored:clean -- -TimeoutSeconds 360 -PollSeconds 10;');
  console.log('  npm run test:e2e');
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : '';
if (invokedPath === fileURLToPath(import.meta.url)) {
  main();
}
