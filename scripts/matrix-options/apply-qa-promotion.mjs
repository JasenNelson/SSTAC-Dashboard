// Owner-run apply tool for the IRIS qa-promotion candidate sheet. Plain ASCII only.
//
// WHY THIS EXISTS
// The IRIS EPA-Excel data-integrity verification packet (#249) listed 20 EPA-IRIS rows that are
// currently qa_status='needs_review' and verify against the authoritative EPA source. Promoting
// them to 'approved' is an owner/HITL decision. A bare search-and-replace of qa_status would RED
// CI: catalog.test.ts requires evidence-level qa parity AND a truthy reviewed_by + dated
// reviewed_at on every approved evidence item. This tool performs the EXACT, coupled edit
// deterministically on EXACTLY the 20 rows, fails closed on any precondition, and is idempotent.
//
// LOAD-BEARING RULES honored:
//  - AI NEVER writes qa_status. This tool is run BY THE OWNER; --reviewer/--date are the owner's
//    HITL attestation and --canonical is the owner's modelling choice. Author + dry-run only for AI.
//  - VALIDATE AGAINST THE EPA SNAPSHOT, NOT MEMORY. Each row's value is re-checked against the
//    committed EPA IRIS snapshot (the same 2% rule as iris-canonical.test.ts) before promotion;
//    a drifted/anchorless value fails closed (never promoted).
//  - SCOPE: only the 20 hard-coded ids are ever touched; default_status/value/unit/other records
//    are never modified.
//
// USAGE (run from anywhere; paths resolve from the script location):
//   node scripts/matrix-options/apply-qa-promotion.mjs --reviewer "J. Nelson" --date 2026-06-04 --canonical verified
//   node scripts/matrix-options/apply-qa-promotion.mjs --reviewer "J. Nelson" --date 2026-06-04 --canonical verified --apply
//
// Default is a DRY RUN (prints the per-row plan, writes nothing). --apply writes
// matrix_research/reference_catalog/human_health_trv_values.json.
//
// See matrix_research/reference_catalog/iris_qa_promotion_apply_sheet_2026_06_04.md for the
// verification table, coupling map, and the two --canonical variants.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..', '..');
const HH_TRV_FILE = path.join(
  REPO_ROOT, 'matrix_research', 'reference_catalog', 'human_health_trv_values.json',
);
const SNAPSHOT_FILE = path.join(
  REPO_ROOT, 'src', 'lib', 'matrix-options', 'provenance', '__tests__', 'epa_iris_canonical_snapshot.json',
);

// The 20 EPA-IRIS rows from the #249 packet Section 4. Hard-coded so the tool's scope is fixed
// and auditable: it can ONLY ever touch these ids.
export const TARGET_IDS = [
  'pv-iris-benzo_a_pyrene-hh-direct-iur',
  'pv-iris-benzo_a_pyrene-hh-direct-rfc',
  'pv-iris-benzo_a_pyrene-hh-direct-rfc-inhalation-rfc-2',
  'pv-iris-carbon_tetrachloride-hh-direct-rfd',
  'pv-iris-carbon_tetrachloride-hh-food-rfd',
  'pv-iris-carbon_tetrachloride-hh-direct-rfc',
  'pv-iris-carbon_tetrachloride-hh-direct-sf',
  'pv-iris-carbon_tetrachloride-hh-food-sf',
  'pv-iris-carbon_tetrachloride-hh-direct-iur',
  'pv-iris-anthracene-hh-direct-rfd',
  'pv-iris-anthracene-hh-food-rfd',
  'pv-iris-p_p_dichlorodiphenyltrichloroethane_ddt-hh-direct-iur',
  'pv-iris-p_p_dichlorodiphenyltrichloroethane_ddt-hh-direct-sf',
  'pv-iris-p_p_dichlorodiphenyltrichloroethane_ddt-hh-food-sf',
  'pv-iris-p_p_dichlorodiphenyltrichloroethane_ddt-hh-direct-rfd',
  'pv-iris-p_p_dichlorodiphenyltrichloroethane_ddt-hh-food-rfd',
  'pv-iris-fluorine_soluble_fluoride-hh-direct-rfd',
  'pv-iris-fluorine_soluble_fluoride-hh-food-rfd',
  'pv-iris-uranium_soluble_salts-hh-direct-rfd',
  'pv-iris-uranium_soluble_salts-hh-food-rfd',
];

const SNAPSHOT_REL_TOL = 0.02; // 2% -- mirrors iris-canonical.test.ts REL_TOL.
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
// Idempotency marker for the evidence-note stamp (mirrors promote-iris-rfd-batch.mjs). A stamped
// note CONTAINS this substring so the repair check below cannot re-stamp it.
const PROMOTION_STAMP_MARKER = 'PROMOTED to approved';

// ---------------------------------------------------------------------------
// Arg parsing
// ---------------------------------------------------------------------------

export function parseArgs(argv) {
  const args = { apply: false, reviewer: null, date: null, canonical: null, help: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--apply') args.apply = true;
    else if (a === '--help' || a === '-h') args.help = true;
    else if (a === '--reviewer') args.reviewer = argv[++i];
    else if (a === '--date') args.date = argv[++i];
    else if (a === '--canonical') args.canonical = argv[++i];
    else throw new Error('Unknown argument: ' + a);
  }
  return args;
}

// Validates the owner-supplied attestation. Required only when actually writing (--apply); a dry
// run prints the plan with whatever was supplied so the owner can preview before committing to it.
export function validateApplyOptions(opts) {
  const errors = [];
  if (!opts.reviewer || !String(opts.reviewer).trim()) {
    errors.push('--reviewer "<id/name>" is required for --apply (it becomes evidence.reviewed_by)');
  }
  if (!opts.date || !DATE_RE.test(opts.date)) {
    errors.push('--date YYYY-MM-DD is required for --apply (it becomes evidence.reviewed_at)');
  }
  if (opts.canonical !== 'verified' && opts.canonical !== 'keep') {
    errors.push('--canonical verified|keep is required for --apply (see the apply sheet, Section 4)');
  }
  if (errors.length) throw new Error('Invalid --apply options:\n  - ' + errors.join('\n  - '));
}

// ---------------------------------------------------------------------------
// Snapshot re-verification (value must match the EPA source, not memory)
// ---------------------------------------------------------------------------

function buildSnapshotIndex(snapshot) {
  const map = new Map();
  for (const r of snapshot.records) map.set(r.substance_key + '::' + r.input_key, r);
  return map;
}

function matchesSnapshot(value, epaValues) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return false;
  return epaValues.some((e) => Math.abs(value - e) <= Math.abs(e) * SNAPSHOT_REL_TOL);
}

// ---------------------------------------------------------------------------
// Plan
// ---------------------------------------------------------------------------

// Computes the promotion plan and enforces ALL preconditions (fail-closed). Throws on:
//  - a missing target id
//  - a record in an unexpected qa_status (neither needs_review nor approved)
//  - a record with no evidence_items
//  - a value that no longer matches its EPA snapshot anchor (data-integrity drift)
// Records already 'approved' are SKIPPED (idempotent no-op), never re-stamped or errored.
export function planPromotion(records, snapshotIndex, opts) {
  const byId = new Map(records.map((r) => [r.parameter_value_id, r]));
  const promote = [];
  const skip = [];

  for (const id of TARGET_IDS) {
    const r = byId.get(id);
    if (!r) throw new Error('Precondition failed: target id not found in catalog: ' + id);
    if (!Array.isArray(r.evidence_items) || r.evidence_items.length === 0) {
      throw new Error('Precondition failed: ' + id + ' has no evidence_items');
    }
    if (r.qa_status !== 'approved' && r.qa_status !== 'needs_review') {
      throw new Error(
        'Precondition failed: ' + id + ' has unexpected qa_status "' + r.qa_status +
        '" (expected needs_review or approved)',
      );
    }
    // Data-integrity gate -- applies to BOTH paths, because EITHER writes the catalog: a
    // needs_review row is promoted, and an already-approved row is repaired (evidence-note stamp).
    // The value must still match the committed EPA snapshot, else fail closed. "Validate against
    // the EPA snapshot, not memory" -- a drifted/anchorless value is never written.
    const snap = snapshotIndex.get(r.substance_key + '::' + r.input_key);
    if (!snap) {
      throw new Error('Precondition failed: no EPA snapshot anchor for ' + id +
        ' (' + r.substance_key + '/' + r.input_key + ')');
    }
    if (!matchesSnapshot(r.value, snap.epa_values)) {
      throw new Error('Precondition failed: ' + id + ' value ' + JSON.stringify(r.value) +
        ' is not within 2% of EPA snapshot ' + JSON.stringify(snap.epa_values) +
        ' -- value has drifted from the EPA source; refusing to write');
    }
    if (r.qa_status === 'approved') skip.push(id); // already promoted -> repair-only candidate
    else promote.push(id);
  }
  return { promote, skip };
}

// ---------------------------------------------------------------------------
// Apply (in-place mutation of the parsed records; only the 20 targets are touched)
// ---------------------------------------------------------------------------

// Rebuilds an evidence object with qa_status='approved' and reviewed_by/reviewed_at inserted
// immediately AFTER qa_status (the canonical position used by the existing approved batch),
// preserving all other keys in their original order and de-duplicating any pre-existing
// reviewed_* keys.
function approveEvidence(ev, reviewer, date) {
  const out = {};
  for (const [k, v] of Object.entries(ev)) {
    if (k === 'qa_status') {
      out.qa_status = 'approved';
      out.reviewed_by = reviewer;
      out.reviewed_at = date;
    } else if (k === 'reviewed_by' || k === 'reviewed_at') {
      continue; // re-inserted next to qa_status above
    } else {
      out[k] = v;
    }
  }
  if (!('qa_status' in out)) {
    // Evidence had no qa_status field at all (not expected for catalog rows); add the full set.
    out.qa_status = 'approved';
    out.reviewed_by = reviewer;
    out.reviewed_at = date;
  }
  // Supersede a stale "pending direct-source verification" note so approved evidence is not
  // contradictory. An evidence item HITL-approved (reviewed_by/at set above) should not keep the
  // robot-extraction "pending verification" caveat, independent of the --canonical choice.
  if (typeof out.note === 'string' && out.note.length > 0 && !out.note.includes(PROMOTION_STAMP_MARKER)) {
    out.note += buildEvidenceNoteStamp(date, reviewer);
  }
  return out;
}

// Evidence-item note stamp (verbatim from promote-iris-rfd-batch.mjs). The stamp CONTAINS
// PROMOTION_STAMP_MARKER so the idempotency check cannot re-stamp it. The stamp text deliberately
// holds no local-path tokens (C:\ / Downloads / .xlsx), so it never trips the catalog.test
// contamination check.
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
// A repair-only stamp asserts the evidence was PROMOTED to approved, so only stamp rows whose
// evidence is GENUINELY approved + attested (mirrors the valueAlreadyDone gate in the sibling
// promote scripts). A top-level-approved row with a still-needs_review (or unattested) evidence
// item is a drifted partial state -- do NOT stamp it; that would assert an approval that did not
// happen. The real packet rows are fully approved, so this never withholds a legitimate repair.
function evidenceFullyApproved(r) {
  return Array.isArray(r.evidence_items) && r.evidence_items.length > 0 &&
    r.evidence_items.every((ev) => ev && ev.qa_status === 'approved' && Boolean(ev.reviewed_by) && Boolean(ev.reviewed_at));
}

export function applyPromotion(records, snapshotIndex, opts) {
  const { promote, skip } = planPromotion(records, snapshotIndex, opts);
  const byId = new Map(records.map((r) => [r.parameter_value_id, r]));
  for (const id of promote) {
    const r = byId.get(id);
    r.qa_status = 'approved';
    if (opts.canonical === 'verified') {
      r.canonical_source_status = 'direct_source_verified';
    }
    r.evidence_items = r.evidence_items.map((ev) => approveEvidence(ev, opts.reviewer, opts.date));
  }
  // Evidence-note repair pass over the already-approved (skip) rows: stamp any stale
  // "pending direct-source verification" note so an approved row is not contradictory. This is
  // INDEPENDENT of --canonical (it never reads or writes canonical_source_status), so re-running
  // under either --canonical verified or keep stays a no-op on canonical for these rows.
  const repaired = [];
  for (const id of skip) {
    const r = byId.get(id);
    // Only stamp rows whose evidence is genuinely approved + attested (see evidenceFullyApproved):
    // never assert "PROMOTED to approved" on a still-needs_review evidence item.
    if (evidenceFullyApproved(r) && stampEvidenceNotes(r, opts.date, opts.reviewer)) repaired.push(id);
  }
  return { promote, skip, repaired };
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

const HELP = [
  'apply-qa-promotion.mjs -- owner-run IRIS qa-promotion tool (20 rows from the #249 packet).',
  '',
  'Usage:',
  '  node scripts/matrix-options/apply-qa-promotion.mjs --reviewer "<id>" --date YYYY-MM-DD --canonical verified|keep [--apply]',
  '',
  'Options:',
  '  --reviewer "<id>"     Reviewer attestation -> evidence.reviewed_by (required for --apply)',
  '  --date YYYY-MM-DD     Review date -> evidence.reviewed_at (required for --apply)',
  '  --canonical verified  Also set canonical_source_status=direct_source_verified (join tier-1 batch)',
  '  --canonical keep      Leave canonical_source_status=needs_direct_source_check (independent gates)',
  '  --apply               Write the catalog file (default is a dry run that writes nothing)',
  '',
  'AI never runs this with --apply. The owner runs it; the reviewer/date/canonical inputs are the',
  'owner HITL attestation. See iris_qa_promotion_apply_sheet_2026_06_04.md.',
].join('\n');

function main() {
  const opts = parseArgs(process.argv);
  if (opts.help) {
    console.log(HELP);
    return;
  }
  const records = JSON.parse(fs.readFileSync(HH_TRV_FILE, 'utf8'));
  const snapshot = JSON.parse(fs.readFileSync(SNAPSHOT_FILE, 'utf8'));
  const snapshotIndex = buildSnapshotIndex(snapshot);

  // Plan first (enforces every precondition before any write).
  const { promote, skip } = planPromotion(records, snapshotIndex, opts);
  // Of the already-approved (skip) rows, which still carry an unstamped "pending" evidence note?
  const byId = new Map(records.map((r) => [r.parameter_value_id, r]));
  const repairNeededIds = skip.filter((id) => {
    const r = byId.get(id);
    return evidenceFullyApproved(r) && evidenceNoteRepairNeeded(r);
  });

  console.log('IRIS qa-promotion -- ' + (opts.apply ? 'APPLY' : 'DRY RUN'));
  console.log('catalog : ' + HH_TRV_FILE);
  console.log('canonical: ' + (opts.canonical || '(not set)') +
    (opts.canonical === 'verified' ? ' -> set direct_source_verified'
      : opts.canonical === 'keep' ? ' -> leave needs_direct_source_check' : ''));
  console.log('reviewer : ' + (opts.reviewer || '(not set)') + '  date: ' + (opts.date || '(not set)'));
  console.log('');
  for (const id of promote) {
    console.log('  PROMOTE  ' + id + ': qa needs_review->approved; evidence qa->approved +reviewed_by/at'
      + (opts.canonical === 'verified' ? '; canonical->direct_source_verified' : '; canonical kept'));
  }
  for (const id of skip) {
    const needsRepair = repairNeededIds.includes(id);
    console.log('  SKIP     ' + id + ': already approved' +
      (needsRepair ? '; evidence-note repair pending' : ' (no-op)'));
  }
  console.log('');
  console.log('Summary: ' + promote.length + ' to promote, ' + skip.length + ' already approved' +
    (repairNeededIds.length ? ', ' + repairNeededIds.length + ' evidence-note repair(s)' : '') + '.');

  if (!opts.apply) {
    console.log('\nDRY RUN -- no file written. Re-run with --apply (plus --reviewer/--date/--canonical) to write.');
    return;
  }

  // Writing requires the full owner attestation.
  validateApplyOptions(opts);
  if (promote.length === 0 && repairNeededIds.length === 0) {
    console.log('\nNothing to promote or repair (all targets already approved + stamped). No write.');
    return;
  }
  const { repaired } = applyPromotion(records, snapshotIndex, opts);
  fs.writeFileSync(HH_TRV_FILE, JSON.stringify(records, null, 2) + '\n', 'utf8');
  console.log('\nWROTE ' + HH_TRV_FILE + ' (' + promote.length + ' rows promoted, ' +
    repaired.length + ' evidence-note repair(s)).');
  console.log('Next: run the local gates: npx tsc --noEmit; npm run lint; npm run test:ci;');
  console.log('  npm run build:monitored:clean -- -TimeoutSeconds 360 -PollSeconds 10; npm run test:e2e');
  console.log('The reworked catalog.test.ts stays green for either --canonical variant.');
}

// Only run main() when invoked as a script, not when imported by a test.
const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : '';
if (invokedPath === fileURLToPath(import.meta.url)) {
  main();
}
