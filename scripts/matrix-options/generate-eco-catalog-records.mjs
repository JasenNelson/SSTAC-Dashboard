// Generate ParameterValueRecord rows for the ECO pathways (eco-direct-eqp,
// eco-food-bsaf) of the Matrix-Options References & Values catalog, from a
// reviewed eco staging input. Plain ASCII only.
//
// WHY A SEPARATE GENERATOR
// generate-catalog-records.mjs is purpose-built for the human-health / IRIS passes
// (IRIS canonical-snapshot integrity gate, HH input-key map, receptor_groups=['human']).
// Eco values are a different family (aquatic-life FCV/SCV concentrations in ug/L for
// eco-direct, dose-based wildlife TRVs in mg/kg-bw/day for eco-food, per-receptor) with
// NO IRIS gate. Keeping them in a separate, eco-only generator avoids destabilizing the
// integrity-critical HH path while preserving the same standing rules.
//
// STANDING RULES honored (same as the HH generator):
//  - UNITS ALWAYS: every value normalized to the input_key canonical unit before write;
//    an unrecognized / unconvertible unit -> THROW (never silently emit a wrong magnitude).
//  - AI NEVER auto-selects a default: default_status='available_option', qa_status='needs_review'.
//  - AUTHORITATIVE SOURCE: every source_id must resolve in sources.json or the run THROWS.
//  - NO hand-copying at scale: input is a reviewed staging file; this transform is
//    deterministic + correct-by-construction.
//
// SCOPE / EXCLUSIONS (conservative; matches the candidate-sheet dispositions):
//  - Excludes rows with no numeric value (N/S None-Suitable, N/A None-Available).
//  - Excludes TEQ-basis rows (ng TEQ/kg-bw/day for PCB/dioxin): a toxic-equivalency dose is
//    NOT convertible to mg/kg-bw/day and needs a distinct TEQ handling -> flagged, not emitted.
//  - Excludes any row marked hold=true in staging (owner-flagged conflicts: Toxaphene, Aldrin,
//    PCB-pending, older-FRV pesticides).
//
// USAGE:
//   node scripts/matrix-options/generate-eco-catalog-records.mjs --dry-run
//   node scripts/matrix-options/generate-eco-catalog-records.mjs --write
//   node scripts/matrix-options/generate-eco-catalog-records.mjs --input <file> --out <file> --write

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..', '..');
const CATALOG_DIR = path.join(REPO_ROOT, 'matrix_research', 'reference_catalog');
const SOURCES_FILE = path.join(CATALOG_DIR, 'sources.json');
const DEFAULT_INPUT = path.join(CATALOG_DIR, 'eco_staging', 'eco_values_staging_2026_06_17.json');
const DEFAULT_OUT = path.join(CATALOG_DIR, 'eco_values.json');

export function parseArgs(argv) {
  const args = { dryRun: true, input: DEFAULT_INPUT, out: DEFAULT_OUT };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    const next = () => argv[++i];
    if (a === '--dry-run') args.dryRun = true;
    else if (a === '--write') args.dryRun = false;
    else if (a === '--input') args.input = next();
    else if (a === '--out') args.out = next();
    else if (a === '--quiet') args.quiet = true;
    else throw new Error('Unknown flag: ' + a);
  }
  return args;
}

// --- eco pathway / input-key contract ---------------------------------------
const EQUATION_FOR_PATHWAY = {
  'eco-direct-eqp': 'eq-eco-direct-eqp-di-toro',
  'eco-food-bsaf': 'eq-eco-food-bsaf',
};
const CANONICAL = {
  fcv_ug_per_L: { unit: 'ug/L', short: 'fcv' },
  trv_eco_mg_per_kg_bw_day: { unit: 'mg/kg-bw/day', short: 'trveco' },
};
const PATHWAY_FOR_INPUT = {
  fcv_ug_per_L: 'eco-direct-eqp',
  trv_eco_mg_per_kg_bw_day: 'eco-food-bsaf',
};
const VALID_RECEPTORS = new Set(['aquatic', 'mammal', 'bird']);

const BC_ALIGNMENT_BY_TIER = {
  tier_1_government_or_regulatory: 'protocol_1_v5_0_tier_1_government_source',
  tier_2_peer_reviewed_literature: 'protocol_1_v5_0_tier_2_peer_reviewed_literature',
  tier_3_supporting_science: 'protocol_1_v5_0_tier_3_supporting_science',
};

const ECO_DIRECT_INELIGIBLE = new Set([
  'arsenic_inorganic', 'cadmium', 'chromium_vi', 'chromium_total', 'copper', 'lead',
  'mercury_inorganic', 'methylmercury', 'nickel', 'selenium', 'thallium', 'uranium', 'vanadium',
  'zinc', 'barium', 'silver', 'aluminum', 'iron', 'boron', 'manganese',
  'antimony', 'beryllium', 'cobalt', 'molybdenum', 'tin', 'strontium',
  'chloride', 'cyanide', 'free_cyanide', 'chlorine', 'sulfide', 'ammonia',
  'pentachlorophenol', 'glyphosate', 'trichlorfon', 'tributyltin', 'pfoa', 'pfos',
  'methanol', 'acrolein',
]);

// --- unit normalization (fail closed) ---------------------------------------
const RE_MU_G = new RegExp('\\u03bcg|\\u00b5g', 'gi'); // greek mu + micro sign -> ug; \\u escapes keep this file plain-ASCII (CLAUDE.md 1.1)
function canonUnit(u) {
  return String(u || '')
    .replace(RE_MU_G, 'ug')
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/bw/g, '')
    .replace(/microg|mcg/g, 'ug');
}
const MASS_TO_UG = { ng: 1e-3, ug: 1, mg: 1e3, g: 1e9 };
const MASS_TO_MG = { ng: 1e-6, ug: 1e-3, mg: 1, g: 1e3 };

// Reject a TEQ (toxic-equivalency) basis -- not convertible to a mass dose/conc.
function isTeqUnit(rawUnit) {
  return /teq/i.test(String(rawUnit || ''));
}

export function normalizeToCanonical(rawValue, rawUnit, targetInputKey) {
  const num = Number(String(rawValue).trim());
  if (!Number.isFinite(num)) throw new Error('Non-numeric value "' + rawValue + '"');
  if (isTeqUnit(rawUnit)) {
    throw new Error('TEQ-basis unit "' + rawUnit + '" is not convertible to ' + targetInputKey + ' (exclude TEQ rows)');
  }
  const u = canonUnit(rawUnit);

  if (targetInputKey === 'fcv_ug_per_L') {
    // chronic aquatic-life water concentration: mass/volume -> ug/L
    const m = u.match(/^(ng|ug|mg|g)\/l$/);
    if (!m) throw new Error('Bad FCV concentration unit "' + rawUnit + '" (expected mass/L)');
    return { value: num * MASS_TO_UG[m[1]], unit: CANONICAL[targetInputKey].unit };
  }
  if (targetInputKey === 'trv_eco_mg_per_kg_bw_day') {
    // dose-based wildlife TRV: mass/kg/day -> mg/kg-bw/day. Require kg + a /day rate.
    const isDose = u.includes('kg') && (u.includes('day') || /(^|[^a-z])d($|[^a-z])/.test(u));
    if (!isDose) throw new Error('Bad eco-TRV dose unit "' + rawUnit + '" (expected mass/kg/day)');
    const numerator = u.split('/')[0].replace(/[^a-z0-9]/g, '');
    const pm = numerator.match(/^(ng|ug|mg|g)$/);
    if (!pm) throw new Error('No mass prefix in eco-TRV unit "' + rawUnit + '"');
    return { value: num * MASS_TO_MG[pm[1]], unit: CANONICAL[targetInputKey].unit };
  }
  throw new Error('No normalization rule for ' + targetInputKey);
}

function dateOnly(s) {
  return s ? String(s).slice(0, 10) : '2026-06-17';
}

// --- receptor framing (eco) -------------------------------------------------
function receptorFraming(pathway, receptor) {
  if (pathway === 'eco-direct-eqp') {
    return {
      receptor_groups: ['aquatic life'],
      species_groups: ['benthic invertebrate', 'fish', 'aquatic plant'],
      population_groups: ['aquatic community (chronic)'],
      assumption_tags: ['ecotoxicology endpoint', 'aquatic life criterion', 'equilibrium partitioning', 'FCV'],
    };
  }
  // eco-food-bsaf -- dose-based wildlife TRV, per receptor (mammal | bird)
  if (!VALID_RECEPTORS.has(receptor) || receptor === 'aquatic') {
    throw new Error('eco-food-bsaf row requires receptor mammal|bird, got "' + receptor + '"');
  }
  return {
    receptor_groups: ['wildlife'],
    species_groups: [receptor === 'mammal' ? 'mammal' : 'bird'],
    population_groups: [receptor === 'mammal' ? 'generic mammal' : 'generic bird'],
    assumption_tags: ['ecotoxicology endpoint', 'food web', 'dose-based wildlife TRV', 'TRV'],
  };
}

export function buildEcoRecord(row, resolvedSource, normalized) {
  const inputKey = row.input_key;
  const pathway = PATHWAY_FOR_INPUT[inputKey];
  const short = CANONICAL[inputKey].short;
  const receptorTag = pathway === 'eco-food-bsaf' ? '-' + row.receptor : '';
  const id = 'pv-eco-' + row.substance_key + '-' + (pathway === 'eco-direct-eqp' ? 'direct' : 'food') + '-' + short + receptorTag;
  const extractedAt = dateOnly(row.extracted_at);
  const framing = receptorFraming(pathway, row.receptor);
  const jurisdiction = row.jurisdiction || 'general';
  const tier = resolvedSource.source_authority_tier;

  return {
    parameter_value_id: id,
    substance_key: row.substance_key,
    pathway,
    input_key: inputKey,
    display_name: row.display_name || (row.substance_key + ' ' + short),
    value: normalized.value,
    unit: normalized.unit,
    value_type: 'single_value',
    default_status: 'available_option',
    evidence_support_status: 'pending_source_locator',
    extraction_status: 'extracted_from_source',
    qa_status: 'needs_review',
    source_ids: [row.source_id],
    equation_ids: [EQUATION_FOR_PATHWAY[pathway]],
    jurisdiction,
    applicability:
      (resolvedSource.short_citation || row.source_id) + ' ' + short.toUpperCase() + ' for ' + row.substance_key +
      (pathway === 'eco-food-bsaf' ? ' (' + row.receptor + ')' : '') +
      '; ecological screening candidate (needs review before default use).',
    uncertainty: null,
    evidence_items: [
      {
        source_id: row.source_id,
        locator: row.locator || '',
        value_text: row.source_excerpt || '',
        extraction_method: 'manual_source_extraction',
        extracted_by: 'claude-opus-4-8',
        extracted_at: extractedAt,
        qa_status: 'needs_review',
        note:
          'Extracted from ' + (resolvedSource.short_citation || row.source_id) +
          (row.grade ? '; FCSAP/Eco-SSL grade ' + row.grade : '') +
          '; pending direct-source verification.' + (row.note ? ' ' + row.note : ''),
        evidence_id: 'ev-' + id + '-1',
        locator_type: 'source_table',
      },
    ],
    review_notes:
      (resolvedSource.short_citation || row.source_id) + ' ' + short.toUpperCase() +
      ' ecological candidate, extracted ' + extractedAt +
      '. Read-only library value; verify against the source before any default-selection. qa_status=needs_review.' +
      (row.grade ? ' Grade ' + row.grade + '.' : ''),
    source_authority_tier: tier,
    canonical_source_status: 'needs_direct_source_check',
    bc_protocol_alignment: BC_ALIGNMENT_BY_TIER[tier] || 'protocol_1_v5_0_tier_1_government_source',
    bc_protocol_basis:
      'Government or regulatory source aligned with the Protocol 1 source hierarchy; BC legal requirements and ministry guidance still control where conflicts exist.',
    source_crystallization_date: row.source_date || extractedAt,
    source_relationships: [
      {
        source_id: row.source_id,
        role: 'canonical_candidate',
        note: (resolvedSource.short_citation || row.source_id) + ' is the source for this extracted eco value; source date ' + (row.source_date || extractedAt) + '.',
      },
    ],
    receptor_groups: framing.receptor_groups,
    population_groups: framing.population_groups,
    species_groups: framing.species_groups,
    assumption_tags: framing.assumption_tags,
    candidate_group_id: [pathway, row.substance_key, inputKey, jurisdiction].join('__'),
  };
}

export function generate(input, sourcesById) {
  const records = [];
  const skipped = { hold: 0, no_value: 0, teq: 0 };
  const warnings = [];
  const seen = new Set();
  for (const row of input.rows) {
    if (row.hold === true) { skipped.hold++; continue; }
    if (row.raw_value == null || row.raw_value === '' || /^n\/?[sa]\b/i.test(String(row.raw_value).trim())) {
      skipped.no_value++; continue;
    }
    if (isTeqUnit(row.raw_unit)) { skipped.teq++; warnings.push('TEQ row excluded: ' + row.substance_key); continue; }
    if (!CANONICAL[row.input_key]) throw new Error('Unknown eco input_key "' + row.input_key + '" for ' + row.substance_key);
    if (row.input_key === 'fcv_ug_per_L') {
      // eco-direct EqP is nonionic-organics-ONLY. FAIL CLOSED: every fcv_ug_per_L row MUST be
      // explicitly marked eco_direct_eligible:true in the reviewed staging file (the FCV sheet's
      // "EqP-usable" column). The metal/ion/ionizable denylist below is a SECONDARY tripwire only --
      // a denylist can never be exhaustive, so the explicit eligibility flag is the load-bearing
      // guard (a mis-flagged known metal is still caught by the denylist).
      if (ECO_DIRECT_INELIGIBLE.has(row.substance_key)) {
        throw new Error('Substance ' + row.substance_key + ' is ineligible for eco-direct fcv_ug_per_L (metal/ion/ionizable; route to eco-food TRV)');
      }
      if (row.eco_direct_eligible !== true) {
        throw new Error('fcv_ug_per_L row for ' + row.substance_key + ' must set eco_direct_eligible:true (nonionic-organic EqP only; reviewed against the FCV sheet)');
      }
    }
    const resolvedSource = sourcesById.get(row.source_id);
    if (!resolvedSource) throw new Error('Unresolved source_id "' + row.source_id + '" for ' + row.substance_key + ' (add it to sources.json)');
    if (resolvedSource.calculator_source_role === 'reference_mining') {
      throw new Error('Source ' + row.source_id + ' is reference_mining and cannot back a value row (' + row.substance_key + ')');
    }
    if (!row.locator || String(row.locator).trim() === '') {
      throw new Error('Empty locator for ' + row.substance_key + ' (' + row.input_key + ')');
    }
    const normalized = normalizeToCanonical(row.raw_value, row.raw_unit, row.input_key);
    const rec = buildEcoRecord(row, resolvedSource, normalized);
    if (seen.has(rec.parameter_value_id)) throw new Error('Duplicate parameter_value_id ' + rec.parameter_value_id);
    seen.add(rec.parameter_value_id);
    records.push(rec);
  }
  return { records, skipped, warnings };
}

function main() {
  const args = parseArgs(process.argv);
  const sources = JSON.parse(fs.readFileSync(SOURCES_FILE, 'utf8'));
  const sourcesById = new Map(sources.map((s) => [s.source_id, s]));
  const input = JSON.parse(fs.readFileSync(args.input, 'utf8'));
  const { records, skipped, warnings } = generate(input, sourcesById);
  const summary = {
    input: args.input, out: args.out,
    emitted: records.length, skipped,
    by_pathway: records.reduce((a, r) => ((a[r.pathway] = (a[r.pathway] || 0) + 1), a), {}),
    warnings,
  };
  if (!args.quiet) process.stdout.write(JSON.stringify(summary, null, 2) + '\n');
  if (args.dryRun) {
    process.stdout.write('[dry-run] ' + records.length + ' eco records (no write). Use --write to emit.\n');
  } else {
    fs.writeFileSync(args.out, JSON.stringify(records, null, 2) + '\n', 'utf8');
    process.stdout.write('[write] wrote ' + records.length + ' eco records -> ' + args.out + '\n');
  }
}

const _entry = process.argv[1] || '';
if (_entry.endsWith('generate-eco-catalog-records.mjs')) {
  main();
}
