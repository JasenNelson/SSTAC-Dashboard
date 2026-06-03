// Phase B builder for the IRIS orphan expansion (new-input + ambiguous scope).
// Reads the Phase A recon artifact (.tmp/iris-orphan-recon.json) and:
//   1. Extends the committed EPA IRIS canonical snapshot with anchors for any
//      (substance_key, input_key) pair we are about to generate that is not yet anchored.
//      Anchor values come straight from the EPA Excel (via the recon), so the catalog records
//      generated next validate against the source -- never AI memory.
//   2. Emits a staging-payload pass (.tmp/catalog-paste/<pass>.sql, worktree-local) in the same
//      $cat${...}$cat$::jsonb shape the generator (generate-catalog-records.mjs) consumes.
// It does NOT write the catalog JSON -- that is the generator's job, run after this.
//
// SCOPE (owner decision 2026-06-02): new-input orphans + ambiguous (attached to the existing
// substance_key). NO new substances this batch. AI never sets a default; every row is
// default_status=available_option / qa_status=needs_review (enforced by the generator).
//
// Plain ASCII source. The snapshot is written with non-ASCII escaped to backslash-uXXXX so the
// committed fixture stays within code point 127 (the existing snapshot stores the micro sign that way).
//
// Usage: node scripts/matrix-options/build-iris-orphan-pass.mjs [--pass d0c00014] [--write-snapshot]
//   (default pass id d0c00014; without --write-snapshot it dry-reports the snapshot additions)

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..', '..');
const RECON = path.join(REPO_ROOT, '.tmp', 'iris-orphan-recon.json');
const SNAPSHOT_FILE = path.join(
  REPO_ROOT, 'src', 'lib', 'matrix-options', 'provenance', '__tests__',
  'epa_iris_canonical_snapshot.json',
);
const PASTE_DIR = path.join(REPO_ROOT, '.tmp', 'catalog-paste');

const args = process.argv.slice(2);
function argval(flag, dflt) {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : dflt;
}
const passId = argval('--pass', 'd0c00014');
const writeSnapshot = args.includes('--write-snapshot');
// --mode: 'newinput-ambiguous' (default; the 2026-06-02 first batch) or 'new-substance'.
const mode = argval('--mode', 'newinput-ambiguous');
// --substance-slice 'offset:count' selects a contiguous range of the sorted distinct target
// substance_keys (so a substance's multiple inputs stay together in one batch).
const slice = argval('--substance-slice', null);

// EPA values are 1-2 significant figures; strip float-repr artifacts (0.013000000000000001 -> 0.013).
function clean(v) {
  return Number(Number(v).toPrecision(6));
}
// Fold any non-ASCII to 'u' so catalog text stays ASCII (the only expected non-ASCII is the
// micro sign in IUR raws: 'per <micro>g/m3' -> 'per ug/m3', matching the existing catalog style).
function asciiFold(s) {
  let o = '';
  for (const c of String(s)) o += c.codePointAt(0) > 127 ? 'u' : c;
  return o;
}
// Prefix every line of a multi-line string with pad (for inserting array elements at depth).
function indent(s, pad) {
  return s.split('\n').map((l) => (l.length ? pad + l : l)).join('\n');
}
// Per-record provenance label so the staging audit trail reflects the actual orphan class
// (codex P2 2026-06-02: new-substance runs were mislabeled as 'new input').
function scopeLabel(cls) {
  if (cls === 'ORPHAN_NEW_SUBSTANCE') return 'new substance';
  if (cls === 'AMBIGUOUS') return 'attached to existing substance_key';
  return 'new input';
}
// Escape any non-ASCII to backslash-uXXXX so the committed JSON stays <= code point 127.
function asciiStringify(obj) {
  const s = JSON.stringify(obj, null, 2);
  let out = '';
  for (const c of s) {
    const code = c.codePointAt(0);
    out += code > 127 ? '\\u' + code.toString(16).padStart(4, '0') : c;
  }
  return out;
}
// Map canonical input_key -> short staging key the generator's INPUT_KEY_MAP expects.
const SHORT_BY_CANON = {
  rfd_oral_mg_per_kg_bw_day: 'oral_rfd',
  sf_oral_per_mg_per_kg_bw_per_day: 'oral_slope_factor',
  rfc_inhalation_mg_per_m3: 'inhalation_rfc',
  unit_risk_inhalation_per_ug_m3: 'inhalation_unit_risk',
};
const UNIT_BY_SHORT = {
  oral_rfd: 'mg/kg-day',
  oral_slope_factor: 'per mg/kg-day',
  inhalation_rfc: 'mg/m3',
  inhalation_unit_risk: 'per ug/m3',
};
const DESC_BY_SHORT = {
  oral_rfd: 'oral RfD',
  oral_slope_factor: 'oral slope factor',
  inhalation_rfc: 'inhalation RfC',
  inhalation_unit_risk: 'inhalation unit risk',
};

const recon = JSON.parse(fs.readFileSync(RECON, 'utf8'));
const snapshot = JSON.parse(fs.readFileSync(SNAPSHOT_FILE, 'utf8'));

// Resolve the target substance_key for each selected entry (ambiguous -> existing key).
function targetKey(e) {
  return e.classification === 'AMBIGUOUS' ? e.existing_substance_key : e.substance_key;
}
const pool = mode === 'new-substance'
  ? recon.orphan_new_substance
  : [...recon.orphan_new_input, ...recon.ambiguous];
let selected = pool.map((e) => ({ ...e, target_key: targetKey(e) }));
// Optional batching by a contiguous slice of sorted distinct target substance_keys, with a
// manifest-backed overlap/gap guard (cursor 2026-06-02) so sibling batches and re-runs cannot
// silently double-cover or skip a substance.
if (slice) {
  const [offStr, cntStr] = slice.split(':');
  const offset = Number(offStr);
  const count = Number(cntStr);
  if (!Number.isInteger(offset) || !Number.isInteger(count) || offset < 0 || count <= 0) {
    throw new Error('Bad --substance-slice "' + slice + '" (want offset:count, non-negative ints)');
  }
  const distinct = [...new Set(selected.map((e) => e.target_key))].sort();
  if (offset >= distinct.length) {
    throw new Error('--substance-slice offset ' + offset + ' >= distinct substances ' + distinct.length);
  }
  const batchKeys = distinct.slice(offset, offset + count);
  const keep = new Set(batchKeys);
  selected = selected.filter((e) => keep.has(e.target_key));

  const manifestPath = path.join(PASTE_DIR, 'iris-batch-manifest.json');
  let manifest = { distinct_total: distinct.length, passes: {} };
  if (fs.existsSync(manifestPath)) manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const priorCovered = new Map();
  for (const [pid, keys] of Object.entries(manifest.passes)) {
    if (pid === passId) continue; // re-running the SAME pass id overwrites its own range, not a conflict
    for (const k of keys) priorCovered.set(k, pid);
  }
  const overlap = batchKeys.filter((k) => priorCovered.has(k));
  if (overlap.length) {
    throw new Error('substance-slice OVERLAP with pass ' + priorCovered.get(overlap[0]) + ': '
      + overlap.slice(0, 5).join(', ') + (overlap.length > 5 ? ' ...' : ''));
  }
  if (writeSnapshot) {
    manifest.distinct_total = distinct.length;
    manifest.passes[passId] = batchKeys;
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
    const covered = new Set(Object.values(manifest.passes).flat());
    console.log('manifest: covered', covered.size, 'of', distinct.length,
      '| remaining', distinct.length - covered.size);
  }
  console.log('substance-slice', slice, '-> distinct total', distinct.length, '| this batch',
    keep.size, '| range', batchKeys[0], '..', batchKeys[batchKeys.length - 1]);
}

// --- 1. Snapshot anchors (APPEND-ONLY: preserve existing file bytes exactly) -------------------
// The committed snapshot is Python-generated (numbers like 6e-05, 32.0). Re-serializing it with
// JSON.stringify would reformat every existing value (identical magnitude, noisy diff). So we
// append new records as text before the records-array close and leave existing bytes untouched.
const snapByPair = new Map(
  snapshot.records.map((r) => [r.substance_key + '::' + r.input_key, r]),
);
const newRecords = [];
const newPairs = new Set();
const mergeNeeded = [];
for (const e of selected) {
  const pairKey = e.target_key + '::' + e.input_key;
  const cleanVals = e.epa_values.map(clean);
  const existing = snapByPair.get(pairKey);
  if (existing) {
    // Existing anchor: every value we will stage must already be covered within 2%. If not, an
    // append-only writer cannot safely edit the existing record -- stop and flag for manual handling.
    for (const v of cleanVals) {
      const ok = (existing.epa_values || []).some((x) => Math.abs(x - v) <= Math.abs(v) * 0.02);
      if (!ok) mergeNeeded.push(pairKey + ' value ' + v);
    }
  } else if (!newPairs.has(pairKey)) {
    newPairs.add(pairKey);
    newRecords.push({
      substance_key: e.target_key,
      cas_number: e.casrn,
      input_key: e.input_key,
      exposure_route: e.exposure_route,
      toxicity_value_type: e.toxicity_value_type,
      excel_chemical: [e.excel_chemical],
      epa_values: cleanVals,
      epa_raw: e.epa_raw.slice(),
    });
  }
}
if (mergeNeeded.length) {
  console.error('ERROR: these pairs need a value merged into an EXISTING snapshot anchor;');
  console.error('the append-only writer will not edit existing records. Handle manually:');
  mergeNeeded.forEach((m) => console.error('  ' + m));
  process.exit(1);
}
const addedAnchors = newRecords.map((r) => r.substance_key + '::' + r.input_key);

if (writeSnapshot && newRecords.length) {
  // Read + normalize to LF (autocrlf may have checked the file out as CRLF; HEAD is LF). Writing
  // pure LF keeps the committed diff a clean append rather than a whole-file line-ending churn.
  const orig = fs.readFileSync(SNAPSHOT_FILE, 'utf8').replace(/\r\n/g, '\n');
  const block = newRecords.map((r) => indent(asciiStringify(r), '    ')).join(',\n');
  const marker = '\n  ]'; // closes the records array (2-space indent), unique in this file
  const at = orig.lastIndexOf(marker);
  if (at < 0) throw new Error('could not locate records-array close in snapshot');
  let out = orig.slice(0, at) + ',\n' + block + orig.slice(at);
  // Bump records_count and stamp a per-pass provenance fragment (cumulative + mode-aware; cursor
  // 2026-06-02). Each batch records its own fragment; idempotent re-runs skip an already-stamped pass.
  out = out.replace(/("records_count":\s*)\d+/, '$1' + (snapshot.records.length + newRecords.length));
  const modeDesc = mode === 'new-substance' ? 'new-substance' : 'new-input + ambiguous';
  const passTag = 'pass ' + passId;
  if (!out.includes(passTag)) {
    const stamp = ' EXPANDED 2026-06-02 (' + passTag + ', ' + modeDesc + '): +' + newRecords.length
      + ' EPA IRIS orphan anchors from the EPA Chemicals_Details export (values rounded to EPA precision).';
    out = out.replace('",\n    "records_count":', stamp + '",\n    "records_count":');
  }
  fs.writeFileSync(SNAPSHOT_FILE, out, 'utf8');
}
const mergedAnchors = []; // append-only writer never merges (guarded above)

// --- 2. Staging payload pass ------------------------------------------------
const nowIso = '2026-06-02T00:00:00.000000+00:00';
const passUuid = passId + '-0000-4000-8000-' + passId.replace(/[^0-9a-f]/gi, '').padStart(12, '0').slice(-12);
const sqlBlocks = [];
let payloadCount = 0;
for (const e of selected) {
  const short = SHORT_BY_CANON[e.input_key];
  const unit = UNIT_BY_SHORT[short];
  const desc = DESC_BY_SHORT[short];
  e.epa_values.forEach((rawVal, i) => {
    const val = clean(rawVal);
    payloadCount += 1;
    const pvId = ['pv', 'iris', e.target_key, short, String(i + 1)].join('-')
      .replace(/[^a-z0-9-]/gi, '-').replace(/-+/g, '-').toLowerCase();
    const payload = {
      parameter_value_id: pvId,
      substance_key: e.target_key,
      input_key: short,
      value: String(val),
      unit,
      display_name: asciiFold(e.excel_chemical + ' ' + desc + ' (US EPA IRIS)'),
      source_ids: ['src-us-epa-iris'],
      source_doc_id: 'src-us-epa-iris',
      jurisdiction: 'US_federal',
      locator: asciiFold('US EPA IRIS Chemicals_Details export (' + e.toxicity_value_type
        + ', ' + e.exposure_route + ', CASRN ' + (e.casrn || 'n/a')
        + '); checked 2026-06-02'),
      source_excerpt: asciiFold(e.excel_chemical + ' | ' + e.toxicity_value_type + ' | '
        + e.epa_raw[i] + ' [Chemicals_Details export]'),
      source_excerpt_verbatim: false,
      extracted_at: '2026-06-02',
      extraction_pass_started_at: nowIso,
    };
    const j = JSON.stringify(payload).replace(/\$cat\$/g, '');
    sqlBlocks.push(
      '-- ' + pvId + '\nINSERT INTO public.catalog_extraction_staging (\n'
      + '  source_zotero_key, source_attachment_path, extraction_pass_id,\n'
      + '  extraction_pass_started_at, extraction_pass_finished_at, extracted_at,\n'
      + '  proposed_kind, proposed_payload, confidence, extraction_notes, extraction_model)\nVALUES (\n'
      + '  $cat$epa-iris$cat$,\n  NULL,\n  $cat$' + passUuid + '$cat$::uuid,\n'
      + '  $cat$' + nowIso + '$cat$::timestamptz,\n  NULL,\n  $cat$' + nowIso + '$cat$::timestamptz,\n'
      + '  $cat$parameter_value$cat$,\n  $cat$' + j + '$cat$::jsonb,\n  0.5,\n'
      + '  $cat$qa_status=needs_review; US EPA IRIS ' + desc + ' for ' + e.target_key
      + ' (CASRN ' + (e.casrn || 'n/a') + '); value verbatim from the EPA Chemicals_Details export; '
      + 'IRIS orphan ' + scopeLabel(e.classification)
      + '.$cat$,\n  $cat$claude-opus-4-8$cat$\n);',
    );
  });
}

if (!fs.existsSync(PASTE_DIR)) fs.mkdirSync(PASTE_DIR, { recursive: true });
const sqlPath = path.join(PASTE_DIR, passId + '-iris-orphans-2026-06-02.sql');
const scopeDesc = mode === 'new-substance'
  ? 'new-substance orphans (brand-new substance_keys)'
  : 'new-input + ambiguous (attached to existing substance_key)';
const header = '-- IRIS orphan staging pass (' + passId + '), generated 2026-06-02. Owner pastes into\n'
  + '-- Supabase Studio; AI never pastes. catalog_extraction_staging, hitl_status defaults pending.\n'
  + '-- Scope: ' + scopeDesc + '. ' + payloadCount + ' payloads.\n';
fs.writeFileSync(sqlPath, header + sqlBlocks.join('\n') + '\n', 'utf8');

console.log('selected groups:', selected.length, '| staging payloads:', payloadCount);
console.log('snapshot anchors added:', addedAnchors.length, '| merged into existing:', mergedAnchors.length);
console.log('added pairs:', addedAnchors.join(', ') || '(none)');
console.log('merged pairs:', mergedAnchors.join(', ') || '(none)');
console.log('staging SQL ->', sqlPath);
console.log('snapshot', writeSnapshot ? 'WRITTEN (records=' + snapshot.records.length + ')' : 'NOT written (dry; pass --write-snapshot)');
