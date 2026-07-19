// Owner-run promotion helper for the HC PQRA v4.0 inhalation direct-contact
// receptor profile records. Plain ASCII only.
//
// WHY THIS EXISTS
// This tool promotes the inhalation records (IR_air_m3_per_day, THQ, ILCR_target)
// so the direct-contact frame can offer the additional receptor options.
//
// It mirrors promote-hc-pqra-lifestage.mjs in structure, style, and fail-closed
// discipline (multi-record batch promotion).
//
// LOAD-BEARING RULES honored:
//  - AI NEVER writes qa_status. This tool is run BY THE OWNER; --reviewer/--date are the owner's
//    HITL attestation. Author + dry-run only for AI.
//  - OWNER VERIFICATION REQUIRED (rule 1): Before running with --apply, the OWNER must verify all
//    4 values against the primary Health Canada PQRA v4.0 PDF (Cat. H129-114/2023E-PDF, ISBN
//    978-0-660-68497-0, March 2024, Appendix E). Running with --apply attests to that verification.
//  - SCOPE (rule 2): only the 4 listed records are promoted. default_status is NEVER modified
//    (stays 'not_default'); the owner's FRAME_DEFAULT_PROFILES row is the activation step.
//  - AFTER --apply (rule 4): run npx tsc --noEmit; npm run lint; npm run test:ci.
//
// USAGE (run from anywhere; paths resolve from the script location):
//   node scripts/matrix-options/promote-hc-pqra-inhalation.mjs --reviewer "J. Nelson" --date 2026-06-20
//   node scripts/matrix-options/promote-hc-pqra-inhalation.mjs --reviewer "J. Nelson" --date 2026-06-20 --apply
//
// Default is a DRY RUN (prints the per-record plan, appends nothing). --apply writes
// matrix_research/reference_catalog/parameter_values.json (appends 4 new records).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..', '..');
const PARAM_VALUES_FILE = path.join(
  REPO_ROOT, 'matrix_research', 'reference_catalog', 'parameter_values.json',
);

// The locked contract for input_keys and units
export const INPUT_KEYS = {
  IR_AIR: 'IR_air_m3_per_day',
  THQ: 'THQ',
  ILCR_TARGET: 'ILCR_target',
};

export const UNITS = {
  M3_PER_DAY: 'm3/day',
  UNITLESS: 'unitless',
};

export const HC_PQRA_INHALATION_PROMOTION_SOURCE_ID = 'src-health-canada-pqra-v4-2024';

// These are the ONLY records this tool will ever append. Hard-coded so scope is fixed + auditable.
export const HC_PQRA_INHALATION_PROMOTION_VALUE_IDS = [
  'pv-hc-pqra-v4-2024-ir-air-adult-ca',
  'pv-hc-pqra-v4-2024-ir-air-toddler-ca',
  'pv-bc-csr-hi-target-ca',
  'pv-hc-pqra-v4-2024-ilcr-target-ca',
];

// 4 New Rows to be appended, with exactly the 20 keys specified
const NEW_RECORDS = [
  {
    parameter_value_id: 'pv-hc-pqra-v4-2024-ir-air-adult-ca',
    substance_key: 'generic',
    pathway: 'human-health-direct',
    value_type: 'single_value',
    default_status: 'not_default',
    evidence_support_status: 'approved_source_backed',
    extraction_status: 'extracted_from_source',
    qa_status: 'needs_review',
    source_ids: [HC_PQRA_INHALATION_PROMOTION_SOURCE_ID],
    equation_ids: ['eq-human-health-direct-contact'],
    jurisdiction: 'general',
    source_authority_tier: 'tier_1_government_or_regulatory',
    canonical_source_status: 'direct_source_verified',
    bc_protocol_alignment: null,
    bc_protocol_basis: null,
    source_crystallization_date: '2024-03-31',
    receptor_groups: ['human'],
    species_groups: [],
    input_key: INPUT_KEYS.IR_AIR,
    display_name: 'Inhalation rate - adult (HC PQRA v4.0)',
    value: 16.6,
    unit: UNITS.M3_PER_DAY,
    applicability: 'Health Canada PQRA v4.0 (2024) adult inhalation rate. generic, substance-independent; needs_review candidate; non-operational -- no calculator consumer yet; not a default',
    uncertainty: 'Pending direct-source verification.',
    evidence_items: [
      {
        source_id: HC_PQRA_INHALATION_PROMOTION_SOURCE_ID,
        locator: 'Appendix E (Recommended Receptor Characteristics for HHRAs)',
        value_text: '16.6 m3/day',
        extraction_method: 'manual_source_extraction',
        extracted_by: 'agy',
        extracted_at: '2026-07-19',
        qa_status: 'needs_review',
        reviewed_by: null,
        reviewed_at: null,
        note: 'Health Canada PQRA v4.0 Appendix E adult inhalation rate.',
        evidence_id: 'ev-pv-hc-pqra-v4-2024-ir-air-adult-ca-1',
        locator_type: 'source_table'
      }
    ],
    review_notes: 'HC PQRA v4.0 Appendix E adult inhalation rate (16.6 m3/day). generic, substance-independent; needs_review candidate; non-operational -- no calculator consumer yet; not a default',
    source_relationships: [
      {
        source_id: HC_PQRA_INHALATION_PROMOTION_SOURCE_ID,
        role: 'canonical_candidate',
        note: 'Health Canada PQRA v4.0 section this parameter comes from -- inhalation rate'
      }
    ],
    population_groups: [
      'general population',
      'general adult',
      'worker',
      'commercial',
      'industrial'
    ],
    assumption_tags: [
      'inhalation rate',
      'receptor characteristic',
      'exposure factor'
    ],
    candidate_group_id: 'human-health-direct__generic__IR_air_m3_per_day__general'
  },
  {
    parameter_value_id: 'pv-hc-pqra-v4-2024-ir-air-toddler-ca',
    substance_key: 'generic',
    pathway: 'human-health-direct',
    value_type: 'single_value',
    default_status: 'not_default',
    evidence_support_status: 'approved_source_backed',
    extraction_status: 'extracted_from_source',
    qa_status: 'needs_review',
    source_ids: [HC_PQRA_INHALATION_PROMOTION_SOURCE_ID],
    equation_ids: ['eq-human-health-direct-contact'],
    jurisdiction: 'general',
    source_authority_tier: 'tier_1_government_or_regulatory',
    canonical_source_status: 'direct_source_verified',
    bc_protocol_alignment: null,
    bc_protocol_basis: null,
    source_crystallization_date: '2024-03-31',
    receptor_groups: ['human'],
    species_groups: [],
    input_key: INPUT_KEYS.IR_AIR,
    display_name: 'Inhalation rate - toddler (HC PQRA v4.0)',
    value: 8.3,
    unit: UNITS.M3_PER_DAY,
    applicability: 'Health Canada PQRA v4.0 (2024) toddler inhalation rate. generic, substance-independent; needs_review candidate; non-operational -- no calculator consumer yet; not a default',
    uncertainty: 'Pending direct-source verification.',
    evidence_items: [
      {
        source_id: HC_PQRA_INHALATION_PROMOTION_SOURCE_ID,
        locator: 'Appendix E (Recommended Receptor Characteristics for HHRAs)',
        value_text: '8.3 m3/day',
        extraction_method: 'manual_source_extraction',
        extracted_by: 'agy',
        extracted_at: '2026-07-19',
        qa_status: 'needs_review',
        reviewed_by: null,
        reviewed_at: null,
        note: 'Health Canada PQRA v4.0 Appendix E toddler inhalation rate.',
        evidence_id: 'ev-pv-hc-pqra-v4-2024-ir-air-toddler-ca-1',
        locator_type: 'source_table'
      }
    ],
    review_notes: 'HC PQRA v4.0 Appendix E toddler inhalation rate (8.3 m3/day). generic, substance-independent; needs_review candidate; non-operational -- no calculator consumer yet; not a default',
    source_relationships: [
      {
        source_id: HC_PQRA_INHALATION_PROMOTION_SOURCE_ID,
        role: 'canonical_candidate',
        note: 'Health Canada PQRA v4.0 section this parameter comes from -- inhalation rate'
      }
    ],
    population_groups: [
      'general population',
      'toddler'
    ],
    assumption_tags: [
      'inhalation rate',
      'receptor characteristic',
      'exposure factor'
    ],
    candidate_group_id: 'human-health-direct__generic__IR_air_m3_per_day__general'
  },
  {
    parameter_value_id: 'pv-bc-csr-hi-target-ca',
    substance_key: 'generic',
    pathway: 'human-health-direct',
    value_type: 'single_value',
    default_status: 'not_default',
    evidence_support_status: 'approved_source_backed',
    extraction_status: 'extracted_from_source',
    qa_status: 'needs_review',
    source_ids: ['src-bc-csr-375-96'],
    equation_ids: ['eq-human-health-direct-contact'],
    jurisdiction: 'BC',
    source_authority_tier: 'tier_1_government_or_regulatory',
    canonical_source_status: 'direct_source_verified',
    bc_protocol_alignment: null,
    bc_protocol_basis: null,
    source_crystallization_date: '1996-04-01',
    receptor_groups: ['human'],
    species_groups: [],
    input_key: 'HI',
    display_name: 'Acceptable Hazard Index (HI)',
    value: 1.0,
    unit: 'unitless',
    applicability: 'BC CSR (B.C. Reg. 375/96) Section 18 acceptable Hazard Index. generic, substance-independent; needs_review candidate; non-operational -- no calculator consumer yet; not a default',
    uncertainty: 'Pending direct-source verification.',
    evidence_items: [
      {
        source_id: 'src-bc-csr-375-96',
        locator: 'Section 18',
        value_text: 'HI = 1',
        extraction_method: 'manual_source_extraction',
        extracted_by: 'agy',
        extracted_at: '2026-07-19',
        qa_status: 'needs_review',
        reviewed_by: null,
        reviewed_at: null,
        note: 'BC CSR (B.C. Reg. 375/96) Section 18 acceptable Hazard Index.',
        evidence_id: 'ev-pv-bc-csr-hi-target-ca-1',
        locator_type: 'source_table'
      }
    ],
    review_notes: 'BC CSR (B.C. Reg. 375/96) s.18 acceptable Hazard Index = 1 (the BC operative threshold; HC PQRA per-substance target HQ 0.2 is a different concept). needs_review candidate; non-operational -- no calculator consumer yet; not a default.',
    source_relationships: [
      {
        source_id: 'src-bc-csr-375-96',
        role: 'canonical_candidate',
        note: 'BC Contaminated Sites Regulation (B.C. Reg. 375/96) Section 18 specifies an acceptable hazard index of 1.'
      }
    ],
    population_groups: [
      'general population'
    ],
    assumption_tags: [
      'hazard index',
      'screening threshold'
    ],
    candidate_group_id: 'human-health-direct__generic__HI__BC'
  },
  {
    parameter_value_id: 'pv-hc-pqra-v4-2024-ilcr-target-ca',
    substance_key: 'generic',
    pathway: 'human-health-direct',
    value_type: 'single_value',
    default_status: 'not_default',
    evidence_support_status: 'approved_source_backed',
    extraction_status: 'extracted_from_source',
    qa_status: 'needs_review',
    source_ids: [HC_PQRA_INHALATION_PROMOTION_SOURCE_ID],
    equation_ids: ['eq-human-health-direct-contact'],
    jurisdiction: 'general',
    source_authority_tier: 'tier_1_government_or_regulatory',
    canonical_source_status: 'direct_source_verified',
    bc_protocol_alignment: null,
    bc_protocol_basis: null,
    source_crystallization_date: '2024-03-31',
    receptor_groups: ['human'],
    species_groups: [],
    input_key: INPUT_KEYS.ILCR_TARGET,
    display_name: 'Target Incremental Lifetime Cancer Risk (HC PQRA v4.0)',
    value: 0.00001,
    unit: UNITS.UNITLESS,
    applicability: 'Health Canada PQRA v4.0 (2024) Target ILCR. generic, substance-independent; needs_review candidate; non-operational -- no calculator consumer yet; not a default',
    uncertainty: 'Pending direct-source verification.',
    evidence_items: [
      {
        source_id: HC_PQRA_INHALATION_PROMOTION_SOURCE_ID,
        locator: 'Health Canada PQRA v4.0',
        value_text: '0.00001',
        extraction_method: 'manual_source_extraction',
        extracted_by: 'agy',
        extracted_at: '2026-07-19',
        qa_status: 'needs_review',
        reviewed_by: null,
        reviewed_at: null,
        note: 'Health Canada PQRA v4.0 Target Incremental Lifetime Cancer Risk.',
        evidence_id: 'ev-pv-hc-pqra-v4-2024-ilcr-target-ca-1',
        locator_type: 'source_table'
      }
    ],
    review_notes: 'HC PQRA v4.0 Target Incremental Lifetime Cancer Risk (1e-5). generic, substance-independent; needs_review candidate; non-operational -- no calculator consumer yet; not a default',
    source_relationships: [
      {
        source_id: HC_PQRA_INHALATION_PROMOTION_SOURCE_ID,
        role: 'canonical_candidate',
        note: 'Health Canada PQRA v4.0 section this parameter comes from -- target incremental lifetime cancer risk'
      }
    ],
    population_groups: [
      'general population'
    ],
    assumption_tags: [
      'target cancer risk',
      'screening threshold'
    ],
    candidate_group_id: 'human-health-direct__generic__ILCR_target__general'
  }
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
    errors.push('--reviewer "<id/name>" is required for --apply');
  }
  if (!opts.date || !DATE_RE.test(opts.date)) {
    errors.push('--date YYYY-MM-DD is required for --apply');
  }
  if (errors.length) throw new Error('Invalid --apply options:\n  - ' + errors.join('\n  - '));
}

// ---------------------------------------------------------------------------
// Plan
// ---------------------------------------------------------------------------

export function planPromotion(paramValues, opts) {
  // Guard against re-apply (idempotency): refuse if any of the 4 ids already exist.
  const existingIds = paramValues.map(r => r.parameter_value_id);
  for (const newId of HC_PQRA_INHALATION_PROMOTION_VALUE_IDS) {
    if (existingIds.includes(newId)) {
      throw new Error(`Precondition failed: idempotency guard rejected re-apply. ID ${newId} already exists in parameter_values.json.`);
    }
  }

  // Guard against existing default_status: none of the new records can be set to current_default
  for (const r of NEW_RECORDS) {
    if (r.default_status === 'current_default') {
      throw new Error('Precondition failed: default_status cannot be current_default.');
    }
  }

  return { appendRecords: NEW_RECORDS };
}

// ---------------------------------------------------------------------------
// Apply (in-place mutation of the parsed records)
// ---------------------------------------------------------------------------

export function applyPromotion(paramValues, opts) {
  const plan = planPromotion(paramValues, opts);
  
  // Append only
  for (const record of plan.appendRecords) {
    paramValues.push(record);
  }
  
  return plan;
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

const BANNER = [
  '=============================================================================',
  ' promote-hc-pqra-inhalation.mjs -- owner-run HC PQRA v4.0 inhalation promotion',
  '=============================================================================',
  '',
  'DRY RUN is the default. Use --apply to append the 4 records.',
].join('\n');

function main() {
  const opts = parseArgs(process.argv);
  if (opts.help) {
    console.log(BANNER);
    return;
  }

  console.log(BANNER);
  console.log('Mode    : ' + (opts.apply ? 'APPLY (will write files)' : 'DRY RUN (writes nothing)'));
  
  const paramValues = JSON.parse(fs.readFileSync(PARAM_VALUES_FILE, 'utf8'));

  const plan = planPromotion(paramValues, opts);

  console.log('Dry run plan:');
  plan.appendRecords.forEach(r => {
    console.log(`  VALUE   APPEND  ${r.parameter_value_id}`);
    console.log(`    input_key               : ${r.input_key}`);
    console.log(`    value                   : ${r.value}`);
    console.log(`    unit                    : ${r.unit}`);
  });
  console.log('');

  if (!opts.apply) {
    console.log('DRY RUN -- no file written. Re-run with --apply (plus --reviewer/--date) to write.');
    return;
  }

  validateApplyOptions(opts);
  applyPromotion(paramValues, opts);
  fs.writeFileSync(PARAM_VALUES_FILE, JSON.stringify(paramValues, null, 2) + '\n', 'utf8');
  console.log('WROTE ' + PARAM_VALUES_FILE);
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : '';
if (invokedPath === fileURLToPath(import.meta.url)) {
  main();
}
