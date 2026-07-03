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
//   node scripts/matrix-options/generate-eco-catalog-records.mjs --write --preserve-approvals
//     (--preserve-approvals carries HITL-approved rows forward; without it the generator REFUSES to
//      overwrite a catalog that already contains approved rows -- see reconcileApprovals below.)

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
    else if (a === '--preserve-approvals') args.preserveApprovals = true;
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

// Short source discriminator for the parameter_value_id, so two sources giving a value for the same
// substance/pathway/input do not collide on the id. Such rows SHARE a candidate_group_id (competing
// candidates for one slot) but each needs a unique id. Keyed by source_id; falls back to a sanitized
// short_citation so the unit tests + any future source keep working. (codex redesign 2026-06-17.)
const SOURCE_SHORT = {
  'src-us-epa-esb-tier2-nonionic-organics-2008': 'esb',
  'src-us-epa-nrwqc-aquatic-life-live': 'nrwqc',
  'src-ccme-cwqg-aquatic-life': 'ccme',
  'src-ccme-wildlife-trv-mehg': 'ccmetrg',
  'src-fcsap-era-module7-wildlife-trv-2021': 'fcsap',
};
function sourceShortFor(sourceId, resolvedSource) {
  return (
    SOURCE_SHORT[sourceId] ||
    String((resolvedSource && resolvedSource.short_citation) || sourceId || 'src')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '') ||
    'src'
  );
}

const BC_ALIGNMENT_BY_TIER = {
  tier_1_government_or_regulatory: 'protocol_1_v5_0_tier_1_government_source',
  tier_2_peer_reviewed_literature: 'protocol_1_v5_0_tier_2_peer_reviewed_literature',
  tier_3_supporting_science: 'protocol_1_v5_0_tier_3_supporting_science',
};

// Record-level bc_protocol_basis prose, kept consistent with the row's tier (codex holistic 2026-06-17).
const BC_BASIS_BY_TIER = {
  tier_1_government_or_regulatory:
    'Government or regulatory source aligned with the Protocol 1 source hierarchy; BC legal requirements and ministry guidance still control where conflicts exist.',
  tier_2_peer_reviewed_literature:
    'Recognized regulatory or peer-reviewed source under the Protocol 1 hierarchy, held at tier 2 pending a pinned primary artifact; verify before default use. BC legal requirements and ministry guidance still control where conflicts exist.',
  tier_3_supporting_science:
    'Supporting-science source under the Protocol 1 hierarchy (not a primary regulatory authority); verify before default use. BC legal requirements and ministry guidance still control where conflicts exist.',
};

const ECO_DIRECT_INELIGIBLE = new Set([
  'arsenic_inorganic', 'cadmium', 'chromium', 'chromium_hexavalent', 'chromium_trivalent',
  'copper', 'lead', 'mercury_inorganic', 'methylmercury', 'nickel', 'selenium', 'thallium',
  'uranium', 'vanadium', 'zinc', 'barium', 'silver', 'aluminum', 'iron', 'boron', 'manganese',
  'antimony', 'beryllium', 'cobalt', 'molybdenum', 'tin', 'strontium',
  'chloride', 'cyanide', 'free_cyanide', 'chlorine', 'sulfide', 'ammonia',
  'pentachlorophenol', 'glyphosate', 'trichlorfon', 'tributyltin', 'pfoa', 'pfos',
  'methanol', 'acrolein',
]);

// Known non-canonical substance_key aliases -> the existing catalog's canonical key. FAIL CLOSED so a
// future staging file cannot re-orphan an eco value from its existing catalog substance (which would
// break the cross-pathway comparison join + provenance/filter joins). The reviewed staging uses the
// canonical keys directly; this guard rejects the aliases. (codex holistic 2026-06-17 finding.)
const NONCANONICAL_ALIASES = {
  chromium_vi: 'chromium_hexavalent',
  chromium_total: 'chromium',
  tetrachloroethene: 'tetrachloroethylene',
  tetrachloromethane: 'carbon_tetrachloride',
  trichloroethene: 'trichloroethylene',
  ddt_4_4: 'p_p_dichlorodiphenyltrichloroethane_ddt',
  lindane: 'hexachlorocyclohexane_gamma',
  alpha_bhc: 'alpha_hexachlorocyclohexane_alpha_hch',
  tribromomethane: 'bromoform',
  total_pcbs: 'polychlorinated_biphenyls_total_pcbs',
  butyl_benzyl_phthalate: 'butyl_benzyl_phthalate_bbp',
  di_n_butyl_phthalate: 'dibutyl_phthalate_dbp',
  diethyl_phthalate: 'diethyl_phthalate_dep',
  pentachlorobenzene: 'pentachlorobenzene_1_2_3_4_5',
  chlordane: 'chlordane_technical',
  xylene_m: 'xylenes',
};

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
  // FAIL CLOSED: eco FCV concentrations + TRV doses are strictly positive. A whitespace-only value
  // coerces to 0 and a negative typo is finite; both would silently emit a bogus benchmark. (codex.)
  if (num <= 0) throw new Error('Non-positive eco value "' + rawValue + '" (FCV/TRV must be > 0)');
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
  // Human-facing VALUE-CLASS label for applicability/review text. The eco-direct input mixes true
  // FCVs, ESB SCVs, and NRWQC CCCs -- all used AS the fcv_ug_per_L EqP input, so label them
  // "FCV-equivalent" rather than asserting plain "FCV"; the exact basis (SCV/CCC/FCV/CWQG) is preserved
  // in the evidence value_text/source_excerpt. (codex holistic 2026-06-17.)
  const valueClassLabel = inputKey === 'fcv_ug_per_L' ? 'FCV-equivalent' : 'eco-TRV';
  const receptorTag = pathway === 'eco-food-bsaf' ? '-' + row.receptor : '';
  const srcShort = sourceShortFor(row.source_id, resolvedSource);
  const id = 'pv-eco-' + row.substance_key + '-' + (pathway === 'eco-direct-eqp' ? 'direct' : 'food') + '-' + short + receptorTag + '-' + srcShort;
  const extractedAt = dateOnly(row.extracted_at);
  const framing = receptorFraming(pathway, row.receptor);
  const jurisdiction = row.jurisdiction || 'general';
  const tier = resolvedSource.source_authority_tier;
  // FAIL CLOSED: an unknown/missing source tier must not masquerade as tier_1. Require the source entry
  // to declare a recognized source_authority_tier before this row is emitted. (codex holistic 2026-06-17.)
  if (!BC_ALIGNMENT_BY_TIER[tier]) {
    throw new Error('Source ' + (row.source_id || '(none)') + ' has missing/unrecognized source_authority_tier "' + tier + '"; set it on the source entry in sources.json');
  }

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
      (resolvedSource.short_citation || row.source_id) + ' ' + valueClassLabel + ' for ' + row.substance_key +
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
      (resolvedSource.short_citation || row.source_id) + ' ' + valueClassLabel +
      ' ecological candidate, extracted ' + extractedAt +
      '. Read-only library value; verify against the source before any default-selection. qa_status=needs_review.' +
      (row.grade ? ' Grade ' + row.grade + '.' : ''),
    source_authority_tier: tier,
    canonical_source_status: 'needs_direct_source_check',
    bc_protocol_alignment: BC_ALIGNMENT_BY_TIER[tier],
    bc_protocol_basis: BC_BASIS_BY_TIER[tier],
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
  // Enforce a one-to-one source_id <-> source-short mapping across the run. The id suffix is a SOURCE
  // discriminator; if two DIFFERENT source_ids ever resolve to the same short (e.g. a future source not
  // in SOURCE_SHORT whose sanitized short_citation collides with another), the suffix silently stops
  // discriminating sources. FAIL CLOSED here so the collision is a loud build error, not a quiet
  // mis-attribution. (codex 5.5-xhigh 2026-06-17.)
  const sourceByShort = new Map();
  for (const row of input.rows) {
    if (row.hold === true) { skipped.hold++; continue; }
    if (row.raw_value == null || String(row.raw_value).trim() === '' || /^n\/?[sa]\b/i.test(String(row.raw_value).trim())) {
      skipped.no_value++; continue;
    }
    if (isTeqUnit(row.raw_unit)) { skipped.teq++; warnings.push('TEQ row excluded: ' + row.substance_key); continue; }
    if (NONCANONICAL_ALIASES[row.substance_key]) {
      throw new Error('Non-canonical substance_key "' + row.substance_key + '"; use the existing catalog key "' + NONCANONICAL_ALIASES[row.substance_key] + '" so eco values join the existing substance');
    }
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
    const short = sourceShortFor(row.source_id, resolvedSource);
    const priorSource = sourceByShort.get(short);
    if (priorSource && priorSource !== row.source_id) {
      throw new Error('Source-short collision: "' + short + '" maps to both ' + priorSource + ' and ' + row.source_id + ' (add a distinct SOURCE_SHORT entry for one of them)');
    }
    sourceByShort.set(short, row.source_id);
    const normalized = normalizeToCanonical(row.raw_value, row.raw_unit, row.input_key);
    const rec = buildEcoRecord(row, resolvedSource, normalized);
    if (seen.has(rec.parameter_value_id)) throw new Error('Duplicate parameter_value_id ' + rec.parameter_value_id);
    seen.add(rec.parameter_value_id);
    records.push(rec);
  }
  return { records, skipped, warnings };
}

// PRESERVE-APPROVALS guard (codex R3 P1). The generator emits EVERY row at qa_status=needs_review and
// OVERWRITES eco_values.json WHOLESALE, so a regenerate AFTER a Step-6 promotion would silently erase
// the HITL approvals (an attestation loss that does not look like an AI judgment change). This pure
// helper reconciles a freshly-generated set against the existing on-disk catalog: an APPROVED existing
// row (qa_status === 'approved') is carried forward WHOLESALE -- preserving qa_status, the evidence
// reviewed_by/reviewed_at attestation, and ALL promotion prose (applicability / review_notes /
// uncertainty / source_relationships / row-level tier + crystallization). main() enforces the policy:
// it REFUSES to overwrite a catalog containing approved rows unless --preserve-approvals is passed, and
// REFUSES to drop an approved row that staging no longer produces. needs_review rows are always
// regenerated fresh (no preservation needed).
export function reconcileApprovals(generatedRecords, existingRecords) {
  const APPROVED = 'approved';
  // FAIL CLOSED on a malformed existing catalog -- a safety guard must never fail OPEN. An unexpected
  // shape (e.g. a recovery wrapper {records:[...]}) or duplicate ids could hide/shadow an approved row
  // and silently un-approve it (codex 5.5-xhigh 2026-06-19).
  if (!Array.isArray(existingRecords)) {
    throw new Error('reconcileApprovals: existing catalog must be a JSON array (got ' +
      (existingRecords === null ? 'null' : typeof existingRecords) +
      '); refusing to reconcile approvals against an unexpected catalog shape.');
  }
  const seenIds = new Set();
  const dupIds = new Set();
  for (const r of existingRecords) {
    const id = r && r.parameter_value_id;
    if (id == null) continue;
    if (seenIds.has(id)) dupIds.add(id);
    else seenIds.add(id);
  }
  if (dupIds.size > 0) {
    throw new Error('reconcileApprovals: existing catalog has duplicate parameter_value_id(s): ' +
      [...dupIds].join(', ') + '; refusing to reconcile approvals against a corrupt catalog ' +
      '(a duplicate could shadow an approved row and silently un-approve it).');
  }
  const existingById = new Map(existingRecords.map((r) => [r.parameter_value_id, r]));
  const generatedIds = new Set(generatedRecords.map((r) => r.parameter_value_id));
  const approvedExisting = existingRecords.filter((r) => r && r.qa_status === APPROVED);
  const approvedExistingIds = approvedExisting.map((r) => r.parameter_value_id);
  // An approved row with no matching freshly-generated row would be DROPPED on overwrite -> refuse.
  const droppedApprovedIds = approvedExisting
    .filter((r) => !generatedIds.has(r.parameter_value_id))
    .map((r) => r.parameter_value_id);
  // Merge: a matching APPROVED existing row wins wholesale; every other row uses the generated record.
  const records = generatedRecords.map((g) => {
    const prior = existingById.get(g.parameter_value_id);
    return prior && prior.qa_status === APPROVED ? prior : g;
  });
  // preservedIds = the existing approved rows that were actually carried forward (had a generated
  // match). preservedIds + droppedApprovedIds === approvedExistingIds.
  const preservedIds = approvedExisting
    .filter((r) => generatedIds.has(r.parameter_value_id))
    .map((r) => r.parameter_value_id);
  return { approvedExistingIds, droppedApprovedIds, preservedIds, records };
}

// Enforces the approval-preservation POLICY (the load-bearing safety wiring), separated from main() so
// it is unit-testable without spawning the script. Throws on a real write that would erase or drop a
// HITL approval; on dry-run it records a warning instead (dry-run never mutates). Returns the records
// to write + any warnings + the count of preserved approved rows.
export function applyApprovalGuard(generatedRecords, existingRecords, opts = {}) {
  const { preserveApprovals = false, dryRun = false, outPath = 'eco_values.json' } = opts;
  const recon = reconcileApprovals(generatedRecords, existingRecords);
  const warnings = [];
  if (recon.approvedExistingIds.length > 0 && !preserveApprovals) {
    const msg = outPath + ' contains ' + recon.approvedExistingIds.length +
      ' approved (HITL-promoted) eco row(s); a plain regenerate would reset them to needs_review and ' +
      'erase the attestation. Re-run with --preserve-approvals to carry the approved rows forward, or ' +
      'promote against the frozen catalog instead. Approved ids: ' + recon.approvedExistingIds.join(', ');
    if (!dryRun) throw new Error('Refusing to overwrite: ' + msg);
    warnings.push('WOULD REFUSE WRITE (run with --write to enforce): ' + msg);
  }
  if (recon.approvedExistingIds.length > 0 && preserveApprovals && recon.droppedApprovedIds.length > 0) {
    const msg = recon.droppedApprovedIds.length + ' approved eco row(s) are no longer produced from ' +
      'staging (substance_key/pathway/source changed) and would be DROPPED. Reconcile staging so every ' +
      'approved row is still generated. Dropped ids: ' + recon.droppedApprovedIds.join(', ');
    if (!dryRun) throw new Error('Refusing to drop approved rows: ' + msg);
    warnings.push('WOULD REFUSE WRITE (run with --write to enforce): ' + msg);
  }
  const records = preserveApprovals ? recon.records : generatedRecords;
  return { records, warnings, preservedCount: recon.preservedIds.length };
}

function main() {
  const args = parseArgs(process.argv);
  const sources = JSON.parse(fs.readFileSync(SOURCES_FILE, 'utf8'));
  const sourcesById = new Map(sources.map((s) => [s.source_id, s]));
  const input = JSON.parse(fs.readFileSync(args.input, 'utf8'));
  const { records: generated, skipped, warnings } = generate(input, sourcesById);

  // Approval-preservation guard: never silently un-approve or drop HITL-promoted rows on a regenerate.
  // Pass the parsed catalog through UNCOERCED so a malformed shape fails closed in reconcileApprovals
  // (a missing file is the only [] default). (codex 5.5-xhigh 2026-06-19.)
  const existing = fs.existsSync(args.out) ? JSON.parse(fs.readFileSync(args.out, 'utf8')) : [];
  const guard = applyApprovalGuard(generated, existing, {
    preserveApprovals: args.preserveApprovals,
    dryRun: args.dryRun,
    outPath: args.out,
  });
  const records = guard.records;
  warnings.push(...guard.warnings);

  const summary = {
    input: args.input, out: args.out,
    emitted: records.length, skipped,
    preserved_approved: args.preserveApprovals ? guard.preservedCount : 0,
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
