// Owner-run promotion helper for the eco-pathway catalog (Step-6 4B). Plain ASCII only.
//
// WHY THIS EXISTS
// The eco catalog (matrix_research/reference_catalog/eco_values.json, 97 rows generated 2026-06-19)
// is emitted entirely at qa_status=needs_review. Step-6 promotes those rows to approved, in
// SOURCE-GROUPED batches, against pinned + verified sources. Each batch promotes EVERY eco row whose
// single source is the named --source, flips that source's provenance to direct-source-verified +
// current, fails closed on any drift, and is idempotent.
//
// LOAD-BEARING RULES honored:
//  - AI NEVER writes qa_status. This tool is run BY THE OWNER; --reviewer/--date are the owner's HITL
//    attestation. Author + dry-run only for AI.
//  - OWNER VERIFICATION (rule 1): before --apply the OWNER attests the source's values are verified
//    against the pinned source (see ECO_SOURCE_CONFIG.label). Running --apply attests that.
//  - SCOPE (rule 2): only the rows of the named source are touched; default_status is NEVER modified
//    (stays available_option). The expected per-source row COUNT is a fail-closed assertion.
//  - SOURCE PIN (rule 3): unlike the HC helpers, the eco sources are currentness_status=
//    needs_currentness_check; this tool FLIPS currentness_status -> current AND canonical_source_status
//    -> direct_source_verified on --apply. NRWQC stays tier_2 (owner-accepted access-dated live table);
//    no source is re-tiered here.
//  - The generator's preserve-approvals guard (--preserve-approvals) protects these approvals from a
//    later regenerate; run any future generate with that flag.
//  - AFTER --apply: npx tsc --noEmit; npm run lint; npm run test:ci (bump the audit-count guards).
//
// USAGE (run from anywhere; paths resolve from the script location):
//   node scripts/matrix-options/promote-eco-source.mjs --source <source_id>            (dry run)
//   node scripts/matrix-options/promote-eco-source.mjs --source <source_id> --reviewer "J. Nelson" --date 2026-06-19 --apply
//
// Default is a DRY RUN (prints the per-row plan, writes nothing). --apply writes both
// matrix_research/reference_catalog/eco_values.json and matrix_research/reference_catalog/sources.json.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..', '..');
const ECO_VALUES_FILE = path.join(REPO_ROOT, 'matrix_research', 'reference_catalog', 'eco_values.json');
const SOURCES_FILE = path.join(REPO_ROOT, 'matrix_research', 'reference_catalog', 'sources.json');

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// Per-source promotion config. Hardcoded so scope is fixed + auditable. expectedCount / pathway /
// inputKey are FAIL-CLOSED assertions against the frozen 97-row catalog (generated 2026-06-19).
export const ECO_SOURCE_CONFIG = {
  'src-us-epa-esb-tier2-nonionic-organics-2008': {
    expectedCount: 32, pathway: 'eco-direct-eqp', inputKey: 'fcv_ug_per_L',
    label: 'US EPA ESB Tier-2 nonionic-organics compendium (EPA/600/R-02/016, 2008, Table 3-1)',
  },
  'src-us-epa-nrwqc-aquatic-life-live': {
    expectedCount: 19, pathway: 'eco-direct-eqp', inputKey: 'fcv_ug_per_L',
    label: 'US EPA National Recommended Water Quality Criteria -- Aquatic Life (access-dated live table)',
  },
  'src-fcsap-era-module7-wildlife-trv-2021': {
    expectedCount: 45, pathway: 'eco-food-bsaf', inputKey: 'trv_eco_mg_per_kg_bw_day',
    label: 'FCSAP ERA Module 7 wildlife TRVs (En14-92-7-2021, 2021)',
  },
  'src-ccme-cwqg-aquatic-life': {
    expectedCount: 1, pathway: 'eco-direct-eqp', inputKey: 'fcv_ug_per_L',
    label: 'CCME CWQG aquatic-life -- chloroform interim freshwater guideline (1992)',
  },
};

export function parseArgs(argv) {
  const args = { apply: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--apply') args.apply = true;
    else if (a === '--help' || a === '-h') args.help = true;
    else if (a === '--source') args.source = argv[++i];
    else if (a === '--reviewer') args.reviewer = argv[++i];
    else if (a === '--date') args.date = argv[++i];
    else throw new Error('Unknown argument: ' + a);
  }
  return args;
}

// Validate the source selector (required for BOTH dry-run and apply) + the owner attestation
// (required only for --apply).
export function validateOptions(opts, requireAttestation) {
  const errors = [];
  if (!opts.source || !ECO_SOURCE_CONFIG[opts.source]) {
    errors.push('--source must be one of: ' + Object.keys(ECO_SOURCE_CONFIG).join(', '));
  }
  if (requireAttestation) {
    if (!opts.reviewer || !String(opts.reviewer).trim()) {
      errors.push('--reviewer "<id/name>" is required for --apply (becomes evidence.reviewed_by)');
    }
    if (!opts.date || !DATE_RE.test(opts.date)) {
      errors.push('--date YYYY-MM-DD is required for --apply (becomes evidence.reviewed_at)');
    }
  }
  if (errors.length) throw new Error('Invalid options:\n  - ' + errors.join('\n  - '));
}

// ---------------------------------------------------------------------------
// Provenance stamping (mirrors apply-qa-promotion.mjs / promote-hc-pqra-direct.mjs)
// ---------------------------------------------------------------------------

const PROMOTION_STAMP_MARKER = 'PROMOTED to approved';
const STAMPED_PROVENANCE_FIELDS = ['applicability', 'uncertainty', 'review_notes'];

function buildValueStamp(date, reviewer) {
  return (
    ' [PROMOTED to approved (evidence approved_source_backed, source direct_source_verified) on ' +
    date + ' by ' + reviewer + '; the pending / needs_review language above is superseded.]'
  );
}

// Stamp the human-readable provenance fields the Evidence Library renders + the source_relationship
// notes (codex 2026-06-19: a row-level merge/promotion must carry the prose, not just statuses).
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
  if (Array.isArray(r.source_relationships)) {
    for (const rel of r.source_relationships) {
      if (rel && typeof rel.note === 'string' && rel.note.length > 0 && !rel.note.includes(PROMOTION_STAMP_MARKER)) {
        rel.note += stamp;
        changed = true;
      }
    }
  }
  return changed;
}

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
    out.qa_status = 'approved';
    out.reviewed_by = reviewer;
    out.reviewed_at = date;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Plan (fail-closed; no mutation)
// ---------------------------------------------------------------------------

// Enforce per-row preconditions. Accept ONLY the exact pre-promotion state or the exact already-done
// state; a drifted/partial row fails closed. Returns { row, alreadyDone, promote }.
function planOneEcoRow(row, cfg, sourceId) {
  const id = row.parameter_value_id;
  if (row.pathway !== cfg.pathway) {
    throw new Error('Precondition: ' + id + ' pathway=' + row.pathway + ' != expected ' + cfg.pathway);
  }
  if (row.input_key !== cfg.inputKey) {
    throw new Error('Precondition: ' + id + ' input_key=' + row.input_key + ' != expected ' + cfg.inputKey);
  }
  // Row-identity guard (codex 2026-06-19): promotion does NOT change default_status, so a drifted row
  // that is already a default (or wrong value shape) must not be silently approved+activated outside
  // the frozen available-option batch. The generator emits every eco row as a single_value
  // available_option with a defined jurisdiction; require exactly that.
  if (row.default_status !== 'available_option') {
    throw new Error('Precondition: ' + id + ' default_status=' + JSON.stringify(row.default_status) +
      ' != available_option. Refusing to promote a row outside the frozen available-option batch ' +
      '(promotion leaves default_status unchanged).');
  }
  if (row.value_type !== 'single_value') {
    throw new Error('Precondition: ' + id + ' value_type=' + JSON.stringify(row.value_type) +
      ' != single_value. Refusing.');
  }
  if (typeof row.jurisdiction !== 'string' || row.jurisdiction.trim() === '' ||
      row.jurisdiction.includes('undefined')) {
    throw new Error('Precondition: ' + id + ' has a missing/invalid jurisdiction (' +
      JSON.stringify(row.jurisdiction) + '). Refusing.');
  }
  if (!Array.isArray(row.source_ids) || row.source_ids.length !== 1 || row.source_ids[0] !== sourceId) {
    throw new Error('Precondition: ' + id + ' source_ids must be EXACTLY ["' + sourceId + '"] (actual ' +
      JSON.stringify(row.source_ids) + '). A 2nd source could carry a blocked role; refusing.');
  }
  // Nested-source provenance guard: every evidence_items[*].source_id and source_relationships[*].source_id
  // must be the named source, else a stale nested ref would survive as approved provenance.
  const nested = [
    ...(Array.isArray(row.evidence_items) ? row.evidence_items.map((e) => (e ? e.source_id : undefined)) : []),
    ...(Array.isArray(row.source_relationships) ? row.source_relationships.map((r) => (r ? r.source_id : undefined)) : []),
  ];
  const stale = nested.filter((s) => s !== sourceId);
  if (stale.length > 0) {
    throw new Error('Precondition: ' + id + ' has nested provenance source ref(s) not = "' + sourceId +
      '": ' + JSON.stringify(stale) + '. Refusing to promote a stale nested provenance.');
  }
  // Relationship-role guard (parity with the HC template): a policy_compilation / reference_mining
  // relationship role would be BLOCKED by classifyCandidate, so refuse to stamp such a row approved.
  // Moot for today's catalog (all eco relationships are canonical_candidate) but locks future drift.
  const relRoles = Array.isArray(row.source_relationships)
    ? row.source_relationships.map((r) => (r ? r.role : null))
    : [];
  if (relRoles.includes('policy_compilation') || relRoles.includes('reference_mining')) {
    throw new Error('Precondition: ' + id + ' has a blocked source_relationships role (' +
      JSON.stringify(relRoles) + '); classifyCandidate would block it. Refusing to promote.');
  }
  if (!Array.isArray(row.evidence_items) || row.evidence_items.length === 0) {
    throw new Error('Precondition: ' + id + ' has no evidence_items');
  }
  const allEvApproved = row.evidence_items.every(
    (e) => e.qa_status === 'approved' && Boolean(e.reviewed_by) && Boolean(e.reviewed_at),
  );
  const allEvNeeds = row.evidence_items.every((e) => e.qa_status === 'needs_review');
  const alreadyDone =
    row.qa_status === 'approved' &&
    row.evidence_support_status === 'approved_source_backed' &&
    row.canonical_source_status === 'direct_source_verified' &&
    allEvApproved;
  const expectedPre =
    row.qa_status === 'needs_review' &&
    row.evidence_support_status === 'pending_source_locator' &&
    row.canonical_source_status === 'needs_direct_source_check' &&
    allEvNeeds;
  if (!alreadyDone && !expectedPre) {
    throw new Error('Precondition: ' + id + ' is neither the expected pre-promotion state nor the ' +
      'already-promoted state (drifted/partial). Refusing.\n  actual: qa=' + row.qa_status +
      ', evidence_support=' + row.evidence_support_status + ', canonical=' + row.canonical_source_status +
      ', evidence qa=' + JSON.stringify(row.evidence_items.map((e) => e.qa_status)));
  }
  return { row, alreadyDone, promote: !alreadyDone };
}

export function planPromotion(ecoValues, sources, opts) {
  const cfg = ECO_SOURCE_CONFIG[opts.source];
  if (!cfg) throw new Error('Unknown --source: ' + opts.source);

  // Reject ANY row that references this source alongside another source BEFORE counting (codex
  // 2026-06-19): the single-source filter below would silently DROP such a row, so the count could
  // still match while source-linked provenance sits outside the reviewed batch. Fail closed instead.
  const crossLinked = ecoValues.filter(
    (r) => Array.isArray(r.source_ids) && r.source_ids.includes(opts.source) &&
      !(r.source_ids.length === 1 && r.source_ids[0] === opts.source),
  );
  if (crossLinked.length > 0) {
    throw new Error('Precondition: ' + crossLinked.length + ' row(s) reference source ' + opts.source +
      ' alongside other sources (' + crossLinked.map((r) => r.parameter_value_id).join(', ') +
      '). A multi-source row would leave source-linked provenance outside this single-source batch. Refusing.');
  }

  const rows = ecoValues.filter(
    (r) => Array.isArray(r.source_ids) && r.source_ids.length === 1 && r.source_ids[0] === opts.source,
  );
  if (rows.length !== cfg.expectedCount) {
    throw new Error('Precondition: expected EXACTLY ' + cfg.expectedCount + ' single-source rows for ' +
      opts.source + ', found ' + rows.length + '. Refusing to promote against a drifted catalog.');
  }
  const rowResults = rows.map((r) => planOneEcoRow(r, cfg, opts.source));

  const sourceRecord = sources.find((s) => s.source_id === opts.source);
  if (!sourceRecord) throw new Error('Precondition: source record not found: ' + opts.source);

  // The frame/seed pipeline requires a canonical, non-repo-only, current source. Absent role defaults
  // to canonical_candidate (as the pipeline does via ??).
  const srcRole = sourceRecord.calculator_source_role ?? 'canonical_candidate';
  if (srcRole !== 'canonical_candidate') {
    throw new Error('Precondition: source ' + opts.source + ' calculator_source_role=' +
      JSON.stringify(srcRole) + ' is not canonical_candidate. Refusing.');
  }
  if (sourceRecord.file_storage === 'repo_metadata_only') {
    throw new Error('Precondition: source ' + opts.source + ' file_storage=repo_metadata_only cannot ' +
      'back a direct-current value. Refusing.');
  }
  // Durable-locator guard (codex 2026-06-19): refuse to mint approved source-backed values whose
  // source is not reproducibly locatable. The source must carry a url OR a zotero_item_key.
  const hasLocator =
    (typeof sourceRecord.url === 'string' && sourceRecord.url.trim() !== '') ||
    (typeof sourceRecord.zotero_item_key === 'string' && sourceRecord.zotero_item_key.trim() !== '');
  if (!hasLocator) {
    throw new Error('Precondition: source ' + opts.source + ' has no durable locator (url or ' +
      'zotero_item_key). Refusing to verify a source that is not reproducibly locatable.');
  }
  // Source pin state machine (codex 2026-06-19): accept ONLY the exact pre-state or the exact
  // done-state. currentness + canonical must move TOGETHER; a partial combination (one flipped, the
  // other not) is an interrupted/manual promotion and must fail closed, not be silently completed.
  const cur = sourceRecord.currentness_status;
  const css = sourceRecord.canonical_source_status;
  const sourcePre = cur === 'needs_currentness_check' && (css == null || css === 'needs_direct_source_check');
  const sourceDone = cur === 'current' && css === 'direct_source_verified';
  if (!sourcePre && !sourceDone) {
    throw new Error('Precondition: source ' + opts.source + ' is in a partial/drifted pin state ' +
      '(currentness_status=' + JSON.stringify(cur) + ', canonical_source_status=' + JSON.stringify(css) +
      '). Accept ONLY the exact pre-state (needs_currentness_check + needs_direct_source_check/absent) ' +
      'or the exact done-state (current + direct_source_verified). Refusing a partial promotion.');
  }
  const sourceAlreadyDone = sourceDone;
  return { cfg, rowResults, sourceRecord, sourceAlreadyDone, promoteSource: !sourceAlreadyDone };
}

// ---------------------------------------------------------------------------
// Apply (in-place mutation; ONLY the named source's rows + the source record)
// ---------------------------------------------------------------------------

export function applyPromotion(ecoValues, sources, opts) {
  const plan = planPromotion(ecoValues, sources, opts);
  let promoted = 0;
  let restamped = 0;
  for (const rr of plan.rowResults) {
    if (rr.promote) {
      const r = rr.row;
      r.qa_status = 'approved';
      r.evidence_support_status = 'approved_source_backed';
      r.canonical_source_status = 'direct_source_verified';
      // default_status intentionally NOT modified (stays available_option).
      r.evidence_items = r.evidence_items.map((ev) => approveEvidence(ev, opts.reviewer, opts.date));
      stampValueProvenance(r, opts.date, opts.reviewer);
      promoted++;
    } else if (rr.alreadyDone) {
      if (stampValueProvenance(rr.row, opts.date, opts.reviewer)) restamped++;
    }
  }
  let sourceTouched = false;
  if (plan.promoteSource) {
    plan.sourceRecord.canonical_source_status = 'direct_source_verified';
    plan.sourceRecord.currentness_status = 'current';
    const stamp =
      ' [Source promoted to direct_source_verified + currentness_status current on ' + opts.date +
      ' by ' + opts.reviewer + '; the pending / needs_currentness language above is superseded.]';
    if (typeof plan.sourceRecord.notes === 'string' &&
        !plan.sourceRecord.notes.includes('Source promoted to direct_source_verified')) {
      plan.sourceRecord.notes += stamp;
    }
    sourceTouched = true;
  }
  return { plan, promoted, restamped, sourceTouched };
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

const HELP = [
  'promote-eco-source.mjs -- owner-run eco-pathway source-grouped promotion (Step-6 4B).',
  '',
  'Usage:',
  '  node scripts/matrix-options/promote-eco-source.mjs --source <source_id>            (dry run)',
  '  node scripts/matrix-options/promote-eco-source.mjs --source <source_id> \\',
  '       --reviewer "J. Nelson" --date YYYY-MM-DD --apply',
  '',
  'Sources (one batch each):',
  ...Object.entries(ECO_SOURCE_CONFIG).map(
    ([id, c]) => '  ' + id + '  (' + c.expectedCount + ' rows; ' + c.pathway + ')',
  ),
  '',
  'On --apply, each VALUE row of the source changes:',
  '  qa_status                 needs_review -> approved',
  '  evidence_support_status   pending_source_locator -> approved_source_backed',
  '  canonical_source_status   needs_direct_source_check -> direct_source_verified',
  '  evidence_items[*].qa_status needs_review -> approved (+ reviewed_by/at)',
  '  default_status            UNCHANGED (stays available_option)',
  'On --apply, the SOURCE record changes:',
  '  canonical_source_status   needs_direct_source_check -> direct_source_verified',
  '  currentness_status        needs_currentness_check -> current',
  '',
  'AI never runs this with --apply. The owner runs it; --reviewer/--date are the HITL attestation.',
  'After --apply: npx tsc --noEmit; npm run lint; npm run test:ci (bump the audit-count guards).',
].join('\n');

function printPlan(plan, opts, applied) {
  const cfg = plan.cfg;
  process.stdout.write('\n=== promote-eco-source: ' + opts.source + ' ===\n');
  process.stdout.write('Source: ' + cfg.label + '\n');
  process.stdout.write('Pathway/input: ' + cfg.pathway + ' / ' + cfg.inputKey + '\n');
  const toPromote = plan.rowResults.filter((r) => r.promote);
  const done = plan.rowResults.filter((r) => r.alreadyDone);
  process.stdout.write('Rows: ' + plan.rowResults.length + ' total -- ' + toPromote.length +
    ' to promote, ' + done.length + ' already approved.\n');
  process.stdout.write('Source pin: ' + (plan.promoteSource
    ? 'canonical_source_status -> direct_source_verified, currentness_status -> current'
    : 'already pinned (no change)') + '\n');
  process.stdout.write('\nPer-row (' + (applied ? 'APPLIED' : 'would promote') + '):\n');
  for (const rr of plan.rowResults) {
    const r = rr.row;
    const tag = rr.promote ? (applied ? 'PROMOTED ' : 'promote  ') : 'already  ';
    process.stdout.write('  ' + tag + r.parameter_value_id + '  = ' + r.value + ' (' +
      r.substance_key + ', ' + r.jurisdiction + ')\n');
  }
}

function main() {
  const args = parseArgs(process.argv);
  if (args.help) {
    process.stdout.write(HELP + '\n');
    return;
  }
  validateOptions(args, args.apply);

  const ecoValues = JSON.parse(fs.readFileSync(ECO_VALUES_FILE, 'utf8'));
  const sources = JSON.parse(fs.readFileSync(SOURCES_FILE, 'utf8'));

  if (args.apply) {
    const result = applyPromotion(ecoValues, sources, args);
    printPlan(result.plan, args, true);
    fs.writeFileSync(ECO_VALUES_FILE, JSON.stringify(ecoValues, null, 2) + '\n', 'utf8');
    fs.writeFileSync(SOURCES_FILE, JSON.stringify(sources, null, 2) + '\n', 'utf8');
    process.stdout.write('\n[apply] promoted ' + result.promoted + ' row(s); restamped ' +
      result.restamped + '; source ' + (result.sourceTouched ? 'pinned' : 'unchanged') +
      '. Wrote eco_values.json + sources.json.\n');
  } else {
    // Dry run: plan only (NO mutation), then report what would change.
    const plan = planPromotion(ecoValues, sources, args);
    printPlan(plan, args, false);
    const n = plan.rowResults.filter((r) => r.promote).length;
    process.stdout.write('\n[dry-run] ' + n + ' row(s) would be promoted; no files written. ' +
      'Add --reviewer/--date/--apply (owner only) to write.\n');
  }
}

const _entry = process.argv[1] || '';
if (_entry.endsWith('promote-eco-source.mjs')) {
  main();
}
