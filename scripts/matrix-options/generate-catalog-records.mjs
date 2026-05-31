// Generate ParameterValueRecord rows for the Matrix-Options References & Values
// catalog from the already-extracted catalog-paste payloads. Plain ASCII only.
//
// WHY THIS EXISTS
// The shared reference content (Protocol 28, US EPA IRIS, Health Canada TRV v4.0)
// was extracted into .tmp/catalog-paste/*.sql staging payloads. This script is the
// DETERMINISTIC, correct-by-construction transform from those payloads into the
// in-repo JSON catalog (human_health_trv_values.json) that the Values view reads via
// buildEvidenceLibraryView -- with NO Supabase approve-gate. An LLM must NOT hand-copy
// regulatory values row by row (slow + hallucination risk); this script does it
// reproducibly and FAILS CLOSED on any unit it cannot confidently normalize.
//
// STANDING RULES honored:
//  - UNITS ALWAYS: every value normalized to the input_key's canonical catalog unit
//    before write; unrecognized unit -> throw (never silently emit a wrong magnitude).
//  - AI NEVER auto-selects a default: default_status='available_option', qa_status='needs_review'.
//  - AUTHORITATIVE SOURCE: source_ids must resolve in sources.json or the run throws.
//
// USAGE (run from anywhere; paths resolve from the script location):
//   node scripts/matrix-options/generate-catalog-records.mjs --pass d0c00003 --limit 8 --dry-run
//   node scripts/matrix-options/generate-catalog-records.mjs --pass d0c00003 --write
//   node scripts/matrix-options/generate-catalog-records.mjs --passes d0c00011,d0c00013 --write --emit-sql

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..', '..');
const CATALOG_DIR = path.join(REPO_ROOT, 'matrix_research', 'reference_catalog');
const HH_TRV_FILE = path.join(CATALOG_DIR, 'human_health_trv_values.json');
const PV_FILE = path.join(CATALOG_DIR, 'parameter_values.json');
const SOURCES_FILE = path.join(CATALOG_DIR, 'sources.json');

export function parseArgs(argv) {
  const args = { dryRun: true };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    const next = () => argv[++i];
    if (a === '--pass') args.passes = [next()];
    else if (a === '--passes') args.passes = next().split(',').map((s) => s.trim());
    else if (a === '--substances') args.substances = new Set(next().split(',').map((s) => s.trim()));
    else if (a === '--limit') args.limit = Number(next());
    else if (a === '--dry-run') args.dryRun = true;
    else if (a === '--write') args.dryRun = false;
    else if (a === '--emit-sql') args.emitSql = true;
    else if (a === '--input-dir') args.inputDir = next();
    else if (a === '--quiet') args.quiet = true;
    else throw new Error('Unknown flag: ' + a);
  }
  if (!args.passes || args.passes.length === 0) {
    throw new Error('Specify --pass <id> or --passes <id,id> (e.g. d0c00003)');
  }
  // Default to the shared checkout's scratch dir. Use an absolute path literal
  // (path.join('C:', ...) drops the drive separator on Windows -> 'C:Projects...').
  args.inputDir = args.inputDir || 'C:\\Projects\\SSTAC-Dashboard\\.tmp\\catalog-paste';
  return args;
}

// Each staging row encodes its JSON as $cat${...}$cat$::jsonb
export function parsePayloads(sqlFile) {
  const sql = fs.readFileSync(sqlFile, 'utf8');
  const re = /\$cat\$(\{[\s\S]*?\})\$cat\$::jsonb/g;
  const out = [];
  let m;
  while ((m = re.exec(sql)) !== null) out.push(JSON.parse(m[1]));
  return out;
}

function resolvePassFile(inputDir, passId) {
  const files = fs.readdirSync(inputDir).filter((f) => f.startsWith(passId) && f.endsWith('.sql'));
  if (files.length === 0) throw new Error('No .sql file for pass ' + passId + ' in ' + inputDir);
  return path.join(inputDir, files[0]);
}

const INPUT_KEY_MAP = {
  oral_rfd: 'rfd_oral_mg_per_kg_bw_day',
  oral_slope_factor: 'sf_oral_per_mg_per_kg_bw_per_day',
  inhalation_rfc: 'rfc_inhalation_mg_per_m3',
  inhalation_unit_risk: 'unit_risk_inhalation_per_ug_m3',
};

const CANONICAL = {
  rfd_oral_mg_per_kg_bw_day: { unit: 'mg/kg-bw/day', short: 'rfd' },
  sf_oral_per_mg_per_kg_bw_per_day: { unit: 'per mg/kg-bw/day', short: 'sf' },
  rfc_inhalation_mg_per_m3: { unit: 'mg/m3', short: 'rfc' },
  unit_risk_inhalation_per_ug_m3: { unit: 'per ug/m3', short: 'iur' },
};

const PATHWAYS_FOR_INPUT = {
  rfd_oral_mg_per_kg_bw_day: ['human-health-direct', 'human-health-food'],
  sf_oral_per_mg_per_kg_bw_per_day: ['human-health-direct', 'human-health-food'],
  rfc_inhalation_mg_per_m3: ['human-health-direct'],
  unit_risk_inhalation_per_ug_m3: ['human-health-direct'],
};

const EQUATION_FOR_PATHWAY = {
  'human-health-direct': 'eq-human-health-direct-contact',
  'human-health-food': 'eq-human-health-food-web',
};

// IRIS remap is input-key-aware: oral_rfd -> rfd-table; everything else -> chemical-details.
// This matches the existing curated catalog where slope-factors, RfCs, and IURs cite the
// chemical-details source (src-us-epa-iris-chemical-details-live).
const SOURCE_ID_REMAP_BY_INPUT = {
  'src-us-epa-iris': {
    oral_rfd: 'src-us-epa-iris-rfd-table-live',
    oral_slope_factor: 'src-us-epa-iris-chemical-details-live',
    inhalation_rfc: 'src-us-epa-iris-chemical-details-live',
    inhalation_unit_risk: 'src-us-epa-iris-chemical-details-live',
  },
};
const SOURCE_ID_REMAP = {
  'src-health-canada': 'src-health-canada-trv-v4-2025',
  'src-bc-protocol-28-2021-jan': 'src-bc-protocol-28-2021-jan',
};

// Source-level metadata that differs from the per-value extraction context.
const SOURCE_CRYSTALLIZATION_DATE = {
  'src-bc-protocol-28-2021-jan': '2021-01-31',
};

// Source relationship role: policy compilations are not the canonical scientific source.
function sourceRelationshipRole(resolvedSourceId) {
  if (resolvedSourceId.includes('protocol-28')) return 'policy_compilation';
  return 'canonical_candidate';
}

function srcTag(s) {
  if (s.includes('iris')) return 'iris';
  if (s.includes('health-canada')) return 'hc';
  if (s.includes('protocol-28')) return 'p28';
  return 'src';
}
function srcLabel(s) {
  if (s.includes('iris')) return 'US EPA IRIS';
  if (s.includes('health-canada')) return 'Health Canada TRV v4.0';
  if (s.includes('protocol-28')) return 'BC Protocol 28 (Jan 2021)';
  return s;
}
function jurisdictionFor(s) {
  if (s.includes('iris')) return 'US_federal';
  if (s.includes('health-canada')) return 'Canada_federal';
  if (s.includes('protocol-28')) return 'BC_provincial';
  return 'general';
}
function bcAlignmentFor(s) {
  if (s.includes('protocol-28')) return 'protocol_28_crystallized_bc_policy_trv';
  return 'protocol_1_v5_0_tier_1_government_source';
}
// Protocol 28 is a policy compilation: values need direct-source verification before use.
// Use 'pending_source_locator' consistent with existing p28 records in parameter_values.json.
// IRIS and Health Canada records (extracted with locators + directly checked) use 'approved_source_backed'.
function evidenceSupportStatusFor(s) {
  if (s.includes('protocol-28')) return 'pending_source_locator';
  return 'approved_source_backed';
}

// Unit classification: drive type off the unit string. Reciprocal = "per X" or "(X)-1".
// Greek mu (U+03BC) and micro sign (U+00B5) are mapped to 'ug' BEFORE .toLowerCase() so that
// a raw microgram symbol never silently becomes 'g' (which would cause a 1000-fold error).
// All non-ASCII written as Unicode escapes to satisfy plain-ASCII source-file rule (CLAUDE.md 1.1).
const RE_MU_G = new RegExp('\u03bcg|\u00b5g', 'gi');
function canonUnit(u) {
  return String(u || '')
    .replace(RE_MU_G, 'ug')
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/bw/g, '')
    .replace(/cu\.?m/g, 'm3')
    .replace(/microg|mcg/g, 'ug');
}
const MASS_TO_MG = { ng: 1e-6, ug: 1e-3, mg: 1, g: 1e3 };
function numeratorPrefix(u) {
  const numerator = u.split('/')[0].replace(/[^a-z0-9]/g, '').replace(/^per/, '');
  const m = numerator.match(/^(ng|ug|mg|g)$/);
  return m ? m[1] : null;
}
function isReciprocalUnit(u) {
  return /per/.test(u) || /\)-1/.test(u) || /\^-1/.test(u) || /-1$/.test(u);
}

// Normalize raw value+unit into the canonical catalog value for targetInputKey.
// Throws (fail closed) when the unit cannot be confidently classified.
export function normalizeToCanonical(rawValue, rawUnit, targetInputKey) {
  const num = Number(String(rawValue).trim());
  if (!Number.isFinite(num)) throw new Error('Non-numeric value "' + rawValue + '"');
  const u = canonUnit(rawUnit);
  const recip = isReciprocalUnit(u);
  const isDose = u.includes('kg') && (u.includes('day') || /(^|[^a-z])d($|[^a-z])/.test(u));
  const isAir = u.includes('m3');
  const p = numeratorPrefix(u);

  if (targetInputKey === 'rfd_oral_mg_per_kg_bw_day') {
    if (!isDose || recip) throw new Error('Bad RfD unit "' + rawUnit + '"');
    if (!p) throw new Error('No mass prefix in RfD unit "' + rawUnit + '"');
    return { value: num * MASS_TO_MG[p], unit: CANONICAL[targetInputKey].unit };
  }
  if (targetInputKey === 'sf_oral_per_mg_per_kg_bw_per_day') {
    if (!isDose || !recip) throw new Error('Bad slope-factor unit "' + rawUnit + '"');
    if (!p) throw new Error('No mass prefix in slope-factor unit "' + rawUnit + '"');
    return { value: num / MASS_TO_MG[p], unit: CANONICAL[targetInputKey].unit };
  }
  if (targetInputKey === 'rfc_inhalation_mg_per_m3') {
    if (!isAir || recip) throw new Error('Bad RfC unit "' + rawUnit + '"');
    if (!p) throw new Error('No mass prefix in RfC unit "' + rawUnit + '"');
    return { value: num * MASS_TO_MG[p], unit: CANONICAL[targetInputKey].unit };
  }
  if (targetInputKey === 'unit_risk_inhalation_per_ug_m3') {
    if (!isAir || !recip) throw new Error('Bad IUR unit "' + rawUnit + '"');
    if (!p) throw new Error('No mass prefix in IUR unit "' + rawUnit + '"');
    // store as per ug/m3: factor = (ug->mg) / (p->mg)
    return { value: num * (MASS_TO_MG.ug / MASS_TO_MG[p]), unit: CANONICAL[targetInputKey].unit };
  }
  throw new Error('No normalization rule for ' + targetInputKey);
}

function dateOnly(s) {
  return s ? String(s).slice(0, 10) : '2026-05-29';
}

export function buildRecord(payload, targetInputKey, pathway, resolvedSourceId, normalized, idSuffix) {
  const tag = srcTag(resolvedSourceId);
  const label = srcLabel(resolvedSourceId);
  const jurisdiction = jurisdictionFor(resolvedSourceId);
  const short = CANONICAL[targetInputKey].short;
  const pathShort = pathway === 'human-health-food' ? 'food' : 'direct';
  // idSuffix allows distinct payloads with the same substance+input+pathway to keep separate ids.
  const baseId = 'pv-' + tag + '-' + payload.substance_key + '-hh-' + pathShort + '-' + short;
  const id = idSuffix ? baseId + '-' + idSuffix : baseId;
  const extractedAt = dateOnly(payload.extracted_at || payload.extraction_pass_started_at);
  // Use the source's publication/crystallization date when known, not the extraction date.
  const crystDate = SOURCE_CRYSTALLIZATION_DATE[resolvedSourceId] || extractedAt;
  const isFood = pathway === 'human-health-food';
  const iarc = payload.iarc_iris_class ? ' IARC/IRIS class: ' + payload.iarc_iris_class + '.' : '';

  return {
    parameter_value_id: id,
    substance_key: payload.substance_key,
    pathway,
    input_key: targetInputKey,
    display_name: payload.display_name,
    value: normalized.value,
    unit: normalized.unit,
    value_type: 'single_value',
    default_status: 'available_option',
    evidence_support_status: evidenceSupportStatusFor(resolvedSourceId),
    extraction_status: 'extracted_from_source',
    qa_status: 'needs_review',
    source_ids: [resolvedSourceId],
    equation_ids: [EQUATION_FOR_PATHWAY[pathway]],
    jurisdiction,
    applicability:
      label + ' ' + short.toUpperCase() + ' for ' + payload.substance_key +
      '; human-health TRV candidate (needs review before default use).',
    uncertainty: null,
    evidence_items: [
      {
        source_id: resolvedSourceId,
        locator: payload.locator || '',
        value_text: payload.source_excerpt || '',
        extraction_method: 'manual_source_extraction',
        extracted_by: 'claude-opus-4-8',
        extracted_at: extractedAt,
        qa_status: 'needs_review',
        note: 'Robot-extracted from ' + label + '; pending direct-source verification.' + iarc,
        evidence_id: 'ev-' + id + '-1',
        locator_type: 'source_table',
      },
    ],
    review_notes:
      label + ' ' + short.toUpperCase() + ' candidate, robot-extracted ' + extractedAt +
      '. Read-only library value; verify against the live source before any default-selection. qa_status=needs_review.' + iarc,
    source_authority_tier: 'tier_1_government_or_regulatory',
    canonical_source_status: 'needs_direct_source_check',
    bc_protocol_alignment: bcAlignmentFor(resolvedSourceId),
    bc_protocol_basis:
      'Government or regulatory source aligned with the Protocol 1 source hierarchy; BC legal requirements and ministry guidance still control where conflicts exist.',
    source_crystallization_date: crystDate,
    source_relationships: [
      {
        source_id: resolvedSourceId,
        role: sourceRelationshipRole(resolvedSourceId),
        note: label + ' is the source for this extracted TRV row; source date ' + crystDate + '.',
      },
    ],
    receptor_groups: ['human'],
    population_groups: isFood ? ['screening adult'] : ['screening child'],
    species_groups: isFood ? ['fish or shellfish'] : [],
    assumption_tags: ['toxicology endpoint', isFood ? 'food web' : 'direct contact', 'TRV'],
    candidate_group_id: [pathway, payload.substance_key, targetInputKey, jurisdiction].join('__'),
  };
}

export function generate(args, sourceIdSet, existingIds) {
  const generated = [];
  const skipped = { duplicate: 0, weighting: 0, unmappedInput: 0, filtered: 0 };
  const warnings = [];
  for (const passId of args.passes) {
    const file = resolvePassFile(args.inputDir, passId);
    const payloads = parsePayloads(file);
    let used = 0;
    for (const payload of payloads) {
      if (args.limit && used >= args.limit) break;
      if (args.substances && !args.substances.has(payload.substance_key)) {
        skipped.filtered++;
        continue;
      }
      const targetInputKey = INPUT_KEY_MAP[payload.input_key];
      if (!targetInputKey) {
        if (payload.input_key === 'tef_relative_potency') skipped.weighting++;
        else skipped.unmappedInput++;
        continue;
      }
      const rawSourceId = (payload.source_ids && payload.source_ids[0]) || payload.source_doc_id;
      // Input-key-aware remap for IRIS (oral_rfd -> rfd-table; others -> chemical-details).
      const inputRemap = SOURCE_ID_REMAP_BY_INPUT[rawSourceId];
      const resolvedSourceId = (inputRemap && inputRemap[payload.input_key]) ||
        SOURCE_ID_REMAP[rawSourceId] || rawSourceId;
      if (!sourceIdSet.has(resolvedSourceId)) {
        throw new Error(
          'Source id "' + resolvedSourceId + '" (from "' + rawSourceId +
            '") not in sources.json. Add it before generating -- records must not carry unresolved source_ids.',
        );
      }
      let normalized;
      try {
        normalized = normalizeToCanonical(payload.value, payload.unit, targetInputKey);
      } catch (e) {
        warnings.push('SKIP ' + payload.parameter_value_id + ' [' + payload.input_key + '/' + payload.unit + ']: ' + e.message);
        continue;
      }
      used++;
      for (const pathway of PATHWAYS_FOR_INPUT[targetInputKey]) {
        let rec = buildRecord(payload, targetInputKey, pathway, resolvedSourceId, normalized);
        // A collision with existingIds means a prior write or cross-file dup: always skip.
        if (existingIds.has(rec.parameter_value_id)) {
          skipped.duplicate++;
          continue;
        }
        // A collision only within the current generated batch means two distinct payloads
        // share source/substance/input/pathway -- disambiguate with the payload's own id slug.
        if (generated.some((g) => g.parameter_value_id === rec.parameter_value_id)) {
          const slug = payload.parameter_value_id
            ? String(payload.parameter_value_id).replace(/[^a-z0-9]/gi, '-').toLowerCase().replace(/-+/g, '-').replace(/^-|-$/g, '').slice(-16)
            : null;
          if (slug) rec = buildRecord(payload, targetInputKey, pathway, resolvedSourceId, normalized, slug);
          if (!slug || existingIds.has(rec.parameter_value_id) || generated.some((g) => g.parameter_value_id === rec.parameter_value_id)) {
            skipped.duplicate++;
            continue;
          }
        }
        generated.push(rec);
      }
    }
  }
  return { generated, skipped, warnings };
}

function main() {
  const args = parseArgs(process.argv);
  const sources = JSON.parse(fs.readFileSync(SOURCES_FILE, 'utf8'));
  const sourceIdSet = new Set(sources.map((s) => s.source_id));
  const existing = JSON.parse(fs.readFileSync(HH_TRV_FILE, 'utf8'));
  // Also load parameter_values.json IDs so cross-file duplicates are detected.
  const pvRecords = JSON.parse(fs.readFileSync(PV_FILE, 'utf8'));
  const existingIds = new Set([
    ...existing.map((r) => r.parameter_value_id),
    ...pvRecords.map((r) => r.parameter_value_id),
  ]);

  const { generated, skipped, warnings } = generate(args, sourceIdSet, existingIds);

  const lines = [];
  lines.push('passes: ' + args.passes.join(','));
  lines.push('generated NEW records: ' + generated.length);
  lines.push('skipped: ' + JSON.stringify(skipped));
  if (warnings.length) {
    lines.push('WARNINGS (' + warnings.length + '):');
    for (const w of warnings) lines.push('  ' + w);
  }
  if (args.dryRun) {
    lines.push('--- sample (first 2) ---');
    lines.push(JSON.stringify(generated.slice(0, 2), null, 2));
    lines.push('DRY RUN: nothing written. Re-run with --write to append.');
    process.stdout.write(lines.join('\n') + '\n');
    return;
  }

  const merged = existing.concat(generated);
  fs.writeFileSync(HH_TRV_FILE, JSON.stringify(merged, null, 2) + '\n', 'utf8');
  lines.push('WROTE ' + generated.length + ' records -> human_health_trv_values.json (total ' + merged.length + ')');

  if (args.emitSql) {
    const outDir = path.join(args.inputDir, 'json-migration');
    fs.mkdirSync(outDir, { recursive: true });
    const sqlPath = path.join(outDir, 'promoted_' + args.passes.join('_') + '.sql');
    const sqlRows = generated
      .map((r) => {
        const j = JSON.stringify(r).replace(/\$cat\$/g, '');
        return '-- ' + r.parameter_value_id + '\nINSERT INTO public.promoted_parameter_values (parameter_value_id, payload) VALUES ($cat$' + r.parameter_value_id + '$cat$, $cat$' + j + '$cat$::jsonb) ON CONFLICT (parameter_value_id) DO NOTHING;';
      })
      .join('\n');
    fs.writeFileSync(sqlPath, '-- Later-batch migration SQL. Owner pastes into Supabase Studio. AI never pastes.\nBEGIN;\n' + sqlRows + '\nCOMMIT;\n', 'utf8');
    lines.push('WROTE paste-SQL -> ' + sqlPath);
  }
  process.stdout.write(lines.join('\n') + '\n');
}

const invokedDirectly = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) main();
