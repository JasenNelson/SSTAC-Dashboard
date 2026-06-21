// Owner-run promotion helper for the Health Canada TRVs v4.0 (2025) human-health TRV records
// (src-health-canada-trv-v4-2025): 92 value records across 34 substances and 4 TRV input types
// (oral RfD, oral SF, inhalation RfC, inhalation unit risk), human-health-direct + human-health-food
// pathways. Plain ASCII only.
//
// WHY THIS EXISTS
// The Matrix Options Evidence Library carries 92 Health Canada TRV v4.0 (2025) candidates. They were
// extracted from the live Health Canada source (Table 1, pp. 17-51) and verified, so each row already
// carries evidence_support_status = 'approved_source_backed' but is still qa_status = 'needs_review'
// (pending the owner's QA attestation) with canonical_source_status = 'needs_direct_source_check'.
// This tool performs the exact, coupled promotion of EXACTLY those 92 pv-hc-* VALUE records, fails
// closed on any precondition, and is idempotent.
//
// CRITICAL SCOPE NOTE: this tool targets the exact 92 pv-hc-* ids listed in PROMOTION_ROWS ONLY (all
// linked to src-health-canada-trv-v4-2025). Other HC-prefixed rows (e.g. the older approved HC TRV
// rows, or HC PQRA exposure parameters in parameter_values.json) are NOT reachable -- the id allowlist
// is fixed and exact.
//
// It mirrors promote-iris-carcinogen-rfd.mjs in structure, style, and fail-closed discipline (same
// human_health_trv_values.json catalog file; same pre-state; same coupled qa_status +
// canonical_source_status flip). Unlike that 6-row tool, the 92 records here are data-driven from the
// PROMOTION_ROWS table below (id + identity fields), so EXPECTED_IDENTITIES is derived, not hand-typed.
//
// LOAD-BEARING RULES honored:
//  - AI NEVER writes qa_status. This tool is run BY THE OWNER; --reviewer/--date are the owner's HITL
//    attestation. Author + dry-run only for AI.
//  - OWNER VERIFICATION REQUIRED (rule 1): Before running with --apply, the OWNER attests the 92 TRV
//    values match the primary Health Canada TRV v4.0 (2025) source (catalog H129-108/2025E-PDF,
//    Table 1). Running with --apply attests to that verification.
//  - SCOPE (rule 2): only the 92 listed pv-hc-* records are promoted. default_status is NEVER modified
//    (stays 'available_option'); the owner's FRAME_DEFAULT_PROFILES row is the activation step.
//  - SOURCE (rule 3): src-health-canada-trv-v4-2025 is expected to ALREADY carry
//    canonical_source_status = 'direct_source_verified'. On the real catalog the SOURCE will SKIP
//    (already-done). The source promotion LOGIC is kept identical (it handles already-done gracefully).
//  - AFTER --apply (rule 4): run npx tsc --noEmit; npm run lint; npm run test:ci.
//
// USAGE (run from anywhere; paths resolve from the script location):
//   node scripts/matrix-options/promote-hc-trv-v4-2025.mjs --reviewer "J. Nelson" --date 2026-06-21
//   node scripts/matrix-options/promote-hc-trv-v4-2025.mjs --reviewer "J. Nelson" --date 2026-06-21 --apply
//
// Default is a DRY RUN (prints the per-record plan, writes nothing). --apply writes both
// matrix_research/reference_catalog/human_health_trv_values.json and
// matrix_research/reference_catalog/sources.json.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..', '..');
const HH_TRV_FILE = path.join(
  REPO_ROOT, 'matrix_research', 'reference_catalog', 'human_health_trv_values.json',
);
const SOURCES_FILE = path.join(
  REPO_ROOT, 'matrix_research', 'reference_catalog', 'sources.json',
);

export const HC_TRV_V4_2025_PROMOTION_SOURCE_ID = 'src-health-canada-trv-v4-2025';
const JURISDICTION = 'Canada_federal';

// The EXACT 92 records this tool will ever touch. Each carries the identity fields classifyCandidate /
// getFrameSeedCandidateEligibility examine (substance/pathway/input/value/unit); candidate_group_id is
// derived deterministically below. Values are the verified catalog floats (exact, so the strict
// identity check is drift-detection, not a tautology against a re-rounded literal). Ordered by id.
// Exported so the test can build complete fixtures (all 92) without re-typing the table.
export const PROMOTION_ROWS = [
  { id: "pv-hc-arsenic_inorganic-hh-direct-iur", substanceKey: "arsenic_inorganic", pathway: "human-health-direct", inputKey: "unit_risk_inhalation_per_ug_m3", value: 0.0064, unit: "per ug/m3" },
  { id: "pv-hc-barium-hh-direct-rfd", substanceKey: "barium", pathway: "human-health-direct", inputKey: "rfd_oral_mg_per_kg_bw_day", value: 0.19, unit: "mg/kg-bw/day" },
  { id: "pv-hc-barium-hh-food-rfd", substanceKey: "barium", pathway: "human-health-food", inputKey: "rfd_oral_mg_per_kg_bw_day", value: 0.19, unit: "mg/kg-bw/day" },
  { id: "pv-hc-benzene-hh-direct-iur", substanceKey: "benzene", pathway: "human-health-direct", inputKey: "unit_risk_inhalation_per_ug_m3", value: 0.000016, unit: "per ug/m3" },
  { id: "pv-hc-benzene-hh-direct-sf", substanceKey: "benzene", pathway: "human-health-direct", inputKey: "sf_oral_per_mg_per_kg_bw_per_day", value: 0.083, unit: "per mg/kg-bw/day" },
  { id: "pv-hc-benzene-hh-food-sf", substanceKey: "benzene", pathway: "human-health-food", inputKey: "sf_oral_per_mg_per_kg_bw_per_day", value: 0.083, unit: "per mg/kg-bw/day" },
  { id: "pv-hc-benzo_a_pyrene-hh-direct-iur", substanceKey: "benzo_a_pyrene", pathway: "human-health-direct", inputKey: "unit_risk_inhalation_per_ug_m3", value: 0.0006, unit: "per ug/m3" },
  { id: "pv-hc-benzo_a_pyrene-hh-direct-rfc", substanceKey: "benzo_a_pyrene", pathway: "human-health-direct", inputKey: "rfc_inhalation_mg_per_m3", value: 0.000002, unit: "mg/m3" },
  { id: "pv-hc-beryllium-hh-direct-iur", substanceKey: "beryllium", pathway: "human-health-direct", inputKey: "unit_risk_inhalation_per_ug_m3", value: 0.0024, unit: "per ug/m3" },
  { id: "pv-hc-beryllium-hh-direct-rfc", substanceKey: "beryllium", pathway: "human-health-direct", inputKey: "rfc_inhalation_mg_per_m3", value: 0.00002, unit: "mg/m3" },
  { id: "pv-hc-beryllium-hh-direct-rfd", substanceKey: "beryllium", pathway: "human-health-direct", inputKey: "rfd_oral_mg_per_kg_bw_day", value: 0.002, unit: "mg/kg-bw/day" },
  { id: "pv-hc-beryllium-hh-food-rfd", substanceKey: "beryllium", pathway: "human-health-food", inputKey: "rfd_oral_mg_per_kg_bw_day", value: 0.002, unit: "mg/kg-bw/day" },
  { id: "pv-hc-cadmium-hh-direct-iur", substanceKey: "cadmium", pathway: "human-health-direct", inputKey: "unit_risk_inhalation_per_ug_m3", value: 0.004200000000000001, unit: "per ug/m3" },
  { id: "pv-hc-carbon_tetrachloride-hh-direct-iur", substanceKey: "carbon_tetrachloride", pathway: "human-health-direct", inputKey: "unit_risk_inhalation_per_ug_m3", value: 0.000006, unit: "per ug/m3" },
  { id: "pv-hc-carbon_tetrachloride-hh-direct-rfd", substanceKey: "carbon_tetrachloride", pathway: "human-health-direct", inputKey: "rfd_oral_mg_per_kg_bw_day", value: 0.00071, unit: "mg/kg-bw/day" },
  { id: "pv-hc-carbon_tetrachloride-hh-food-rfd", substanceKey: "carbon_tetrachloride", pathway: "human-health-food", inputKey: "rfd_oral_mg_per_kg_bw_day", value: 0.00071, unit: "mg/kg-bw/day" },
  { id: "pv-hc-chlorobenzene-hh-direct-rfc", substanceKey: "chlorobenzene", pathway: "human-health-direct", inputKey: "rfc_inhalation_mg_per_m3", value: 0.01, unit: "mg/m3" },
  { id: "pv-hc-chlorobenzene-hh-direct-rfd", substanceKey: "chlorobenzene", pathway: "human-health-direct", inputKey: "rfd_oral_mg_per_kg_bw_day", value: 0.43, unit: "mg/kg-bw/day" },
  { id: "pv-hc-chlorobenzene-hh-food-rfd", substanceKey: "chlorobenzene", pathway: "human-health-food", inputKey: "rfd_oral_mg_per_kg_bw_day", value: 0.43, unit: "mg/kg-bw/day" },
  { id: "pv-hc-chromium_hexavalent-hh-direct-iur", substanceKey: "chromium_hexavalent", pathway: "human-health-direct", inputKey: "unit_risk_inhalation_per_ug_m3", value: 0.076, unit: "per ug/m3" },
  { id: "pv-hc-chromium_hexavalent-hh-direct-rfc", substanceKey: "chromium_hexavalent", pathway: "human-health-direct", inputKey: "rfc_inhalation_mg_per_m3", value: 0.0001, unit: "mg/m3" },
  { id: "pv-hc-chromium_hexavalent-hh-direct-rfd", substanceKey: "chromium_hexavalent", pathway: "human-health-direct", inputKey: "rfd_oral_mg_per_kg_bw_day", value: 0.0022, unit: "mg/kg-bw/day" },
  { id: "pv-hc-chromium_hexavalent-hh-food-rfd", substanceKey: "chromium_hexavalent", pathway: "human-health-food", inputKey: "rfd_oral_mg_per_kg_bw_day", value: 0.0022, unit: "mg/kg-bw/day" },
  { id: "pv-hc-chromium_trivalent-hh-direct-rfd", substanceKey: "chromium_trivalent", pathway: "human-health-direct", inputKey: "rfd_oral_mg_per_kg_bw_day", value: 0.3, unit: "mg/kg-bw/day" },
  { id: "pv-hc-chromium_trivalent-hh-food-rfd", substanceKey: "chromium_trivalent", pathway: "human-health-food", inputKey: "rfd_oral_mg_per_kg_bw_day", value: 0.3, unit: "mg/kg-bw/day" },
  { id: "pv-hc-dichlorobenzene_1_2-hh-direct-rfd", substanceKey: "dichlorobenzene_1_2", pathway: "human-health-direct", inputKey: "rfd_oral_mg_per_kg_bw_day", value: 0.43, unit: "mg/kg-bw/day" },
  { id: "pv-hc-dichlorobenzene_1_2-hh-food-rfd", substanceKey: "dichlorobenzene_1_2", pathway: "human-health-food", inputKey: "rfd_oral_mg_per_kg_bw_day", value: 0.43, unit: "mg/kg-bw/day" },
  { id: "pv-hc-dichlorobenzene_1_4-hh-direct-rfc", substanceKey: "dichlorobenzene_1_4", pathway: "human-health-direct", inputKey: "rfc_inhalation_mg_per_m3", value: 0.06, unit: "mg/m3" },
  { id: "pv-hc-dichlorobenzene_1_4-hh-direct-rfd", substanceKey: "dichlorobenzene_1_4", pathway: "human-health-direct", inputKey: "rfd_oral_mg_per_kg_bw_day", value: 0.11, unit: "mg/kg-bw/day" },
  { id: "pv-hc-dichlorobenzene_1_4-hh-food-rfd", substanceKey: "dichlorobenzene_1_4", pathway: "human-health-food", inputKey: "rfd_oral_mg_per_kg_bw_day", value: 0.11, unit: "mg/kg-bw/day" },
  { id: "pv-hc-dichloroethane_1_2-hh-direct-sf", substanceKey: "dichloroethane_1_2", pathway: "human-health-direct", inputKey: "sf_oral_per_mg_per_kg_bw_per_day", value: 0.0033, unit: "per mg/kg-bw/day" },
  { id: "pv-hc-dichloroethane_1_2-hh-food-sf", substanceKey: "dichloroethane_1_2", pathway: "human-health-food", inputKey: "sf_oral_per_mg_per_kg_bw_per_day", value: 0.0033, unit: "per mg/kg-bw/day" },
  { id: "pv-hc-dichloroethylene_1_1-hh-direct-iur", substanceKey: "dichloroethylene_1_1", pathway: "human-health-direct", inputKey: "unit_risk_inhalation_per_ug_m3", value: 1.6999999999999998e-10, unit: "per ug/m3" },
  { id: "pv-hc-dichloroethylene_1_1-hh-direct-rfd", substanceKey: "dichloroethylene_1_1", pathway: "human-health-direct", inputKey: "rfd_oral_mg_per_kg_bw_day", value: 0.003, unit: "mg/kg-bw/day" },
  { id: "pv-hc-dichloroethylene_1_1-hh-food-rfd", substanceKey: "dichloroethylene_1_1", pathway: "human-health-food", inputKey: "rfd_oral_mg_per_kg_bw_day", value: 0.003, unit: "mg/kg-bw/day" },
  { id: "pv-hc-dichloromethane-hh-direct-iur", substanceKey: "dichloromethane", pathway: "human-health-direct", inputKey: "unit_risk_inhalation_per_ug_m3", value: 1e-8, unit: "per ug/m3" },
  { id: "pv-hc-dichloromethane-hh-direct-rfc", substanceKey: "dichloromethane", pathway: "human-health-direct", inputKey: "rfc_inhalation_mg_per_m3", value: 0.6, unit: "mg/m3" },
  { id: "pv-hc-dichloromethane-hh-direct-rfd", substanceKey: "dichloromethane", pathway: "human-health-direct", inputKey: "rfd_oral_mg_per_kg_bw_day", value: 0.014, unit: "mg/kg-bw/day" },
  { id: "pv-hc-dichloromethane-hh-direct-sf", substanceKey: "dichloromethane", pathway: "human-health-direct", inputKey: "sf_oral_per_mg_per_kg_bw_per_day", value: 0.002, unit: "per mg/kg-bw/day" },
  { id: "pv-hc-dichloromethane-hh-food-rfd", substanceKey: "dichloromethane", pathway: "human-health-food", inputKey: "rfd_oral_mg_per_kg_bw_day", value: 0.014, unit: "mg/kg-bw/day" },
  { id: "pv-hc-dichloromethane-hh-food-sf", substanceKey: "dichloromethane", pathway: "human-health-food", inputKey: "sf_oral_per_mg_per_kg_bw_per_day", value: 0.002, unit: "per mg/kg-bw/day" },
  { id: "pv-hc-ethylbenzene-hh-direct-rfc", substanceKey: "ethylbenzene", pathway: "human-health-direct", inputKey: "rfc_inhalation_mg_per_m3", value: 2, unit: "mg/m3" },
  { id: "pv-hc-ethylbenzene-hh-direct-rfd", substanceKey: "ethylbenzene", pathway: "human-health-direct", inputKey: "rfd_oral_mg_per_kg_bw_day", value: 0.022, unit: "mg/kg-bw/day" },
  { id: "pv-hc-ethylbenzene-hh-food-rfd", substanceKey: "ethylbenzene", pathway: "human-health-food", inputKey: "rfd_oral_mg_per_kg_bw_day", value: 0.022, unit: "mg/kg-bw/day" },
  { id: "pv-hc-manganese-hh-direct-rfc", substanceKey: "manganese", pathway: "human-health-direct", inputKey: "rfc_inhalation_mg_per_m3", value: 0.00005, unit: "mg/m3" },
  { id: "pv-hc-manganese-hh-direct-rfd", substanceKey: "manganese", pathway: "human-health-direct", inputKey: "rfd_oral_mg_per_kg_bw_day", value: 0.025, unit: "mg/kg-bw/day" },
  { id: "pv-hc-manganese-hh-food-rfd", substanceKey: "manganese", pathway: "human-health-food", inputKey: "rfd_oral_mg_per_kg_bw_day", value: 0.025, unit: "mg/kg-bw/day" },
  { id: "pv-hc-mercury_inorganic-hh-direct-rfd", substanceKey: "mercury_inorganic", pathway: "human-health-direct", inputKey: "rfd_oral_mg_per_kg_bw_day", value: 0.0003, unit: "mg/kg-bw/day" },
  { id: "pv-hc-mercury_inorganic-hh-food-rfd", substanceKey: "mercury_inorganic", pathway: "human-health-food", inputKey: "rfd_oral_mg_per_kg_bw_day", value: 0.0003, unit: "mg/kg-bw/day" },
  { id: "pv-hc-methylmercury-hh-direct-rfd", substanceKey: "methylmercury", pathway: "human-health-direct", inputKey: "rfd_oral_mg_per_kg_bw_day", value: 0.00047, unit: "mg/kg-bw/day" },
  { id: "pv-hc-methylnaphthalene_2-hh-direct-rfd", substanceKey: "methylnaphthalene_2", pathway: "human-health-direct", inputKey: "rfd_oral_mg_per_kg_bw_day", value: 0.004, unit: "mg/kg-bw/day" },
  { id: "pv-hc-methylnaphthalene_2-hh-food-rfd", substanceKey: "methylnaphthalene_2", pathway: "human-health-food", inputKey: "rfd_oral_mg_per_kg_bw_day", value: 0.004, unit: "mg/kg-bw/day" },
  { id: "pv-hc-n_hexane-hh-direct-rfc", substanceKey: "n_hexane", pathway: "human-health-direct", inputKey: "rfc_inhalation_mg_per_m3", value: 0.7, unit: "mg/m3" },
  { id: "pv-hc-n_hexane-hh-direct-rfd", substanceKey: "n_hexane", pathway: "human-health-direct", inputKey: "rfd_oral_mg_per_kg_bw_day", value: 0.1, unit: "mg/kg-bw/day" },
  { id: "pv-hc-n_hexane-hh-food-rfd", substanceKey: "n_hexane", pathway: "human-health-food", inputKey: "rfd_oral_mg_per_kg_bw_day", value: 0.1, unit: "mg/kg-bw/day" },
  { id: "pv-hc-naphthalene-hh-direct-rfc", substanceKey: "naphthalene", pathway: "human-health-direct", inputKey: "rfc_inhalation_mg_per_m3", value: 0.01, unit: "mg/m3" },
  { id: "pv-hc-naphthalene-hh-direct-rfd", substanceKey: "naphthalene", pathway: "human-health-direct", inputKey: "rfd_oral_mg_per_kg_bw_day", value: 0.02, unit: "mg/kg-bw/day" },
  { id: "pv-hc-naphthalene-hh-food-rfd", substanceKey: "naphthalene", pathway: "human-health-food", inputKey: "rfd_oral_mg_per_kg_bw_day", value: 0.02, unit: "mg/kg-bw/day" },
  { id: "pv-hc-nickel_chloride-hh-direct-rfd", substanceKey: "nickel_chloride", pathway: "human-health-direct", inputKey: "rfd_oral_mg_per_kg_bw_day", value: 0.0013, unit: "mg/kg-bw/day" },
  { id: "pv-hc-nickel_chloride-hh-food-rfd", substanceKey: "nickel_chloride", pathway: "human-health-food", inputKey: "rfd_oral_mg_per_kg_bw_day", value: 0.0013, unit: "mg/kg-bw/day" },
  { id: "pv-hc-nickel_metallic-hh-direct-rfc", substanceKey: "nickel_metallic", pathway: "human-health-direct", inputKey: "rfc_inhalation_mg_per_m3", value: 0.000018, unit: "mg/m3" },
  { id: "pv-hc-nickel_mixture-hh-direct-iur", substanceKey: "nickel_mixture", pathway: "human-health-direct", inputKey: "unit_risk_inhalation_per_ug_m3", value: 0.0013000000000000002, unit: "per ug/m3" },
  { id: "pv-hc-nickel_oxide-hh-direct-rfc", substanceKey: "nickel_oxide", pathway: "human-health-direct", inputKey: "rfc_inhalation_mg_per_m3", value: 0.000025, unit: "mg/m3" },
  { id: "pv-hc-nickel_subsulfide-hh-direct-rfc", substanceKey: "nickel_subsulfide", pathway: "human-health-direct", inputKey: "rfc_inhalation_mg_per_m3", value: 0.000018, unit: "mg/m3" },
  { id: "pv-hc-nickel_sulfate-hh-direct-rfc", substanceKey: "nickel_sulfate", pathway: "human-health-direct", inputKey: "rfc_inhalation_mg_per_m3", value: 0.00002, unit: "mg/m3" },
  { id: "pv-hc-nickel_sulfate-hh-direct-rfd", substanceKey: "nickel_sulfate", pathway: "human-health-direct", inputKey: "rfd_oral_mg_per_kg_bw_day", value: 0.012, unit: "mg/kg-bw/day" },
  { id: "pv-hc-nickel_sulfate-hh-food-rfd", substanceKey: "nickel_sulfate", pathway: "human-health-food", inputKey: "rfd_oral_mg_per_kg_bw_day", value: 0.012, unit: "mg/kg-bw/day" },
  { id: "pv-hc-pcbs_non_coplanar-hh-direct-rfd", substanceKey: "pcbs_non_coplanar", pathway: "human-health-direct", inputKey: "rfd_oral_mg_per_kg_bw_day", value: 0.00001, unit: "mg/kg-bw/day" },
  { id: "pv-hc-pcbs_non_coplanar-hh-food-rfd", substanceKey: "pcbs_non_coplanar", pathway: "human-health-food", inputKey: "rfd_oral_mg_per_kg_bw_day", value: 0.00001, unit: "mg/kg-bw/day" },
  { id: "pv-hc-pyrene-hh-direct-rfd", substanceKey: "pyrene", pathway: "human-health-direct", inputKey: "rfd_oral_mg_per_kg_bw_day", value: 0.03, unit: "mg/kg-bw/day" },
  { id: "pv-hc-pyrene-hh-food-rfd", substanceKey: "pyrene", pathway: "human-health-food", inputKey: "rfd_oral_mg_per_kg_bw_day", value: 0.03, unit: "mg/kg-bw/day" },
  { id: "pv-hc-tetrachloroethylene-hh-direct-iur", substanceKey: "tetrachloroethylene", pathway: "human-health-direct", inputKey: "unit_risk_inhalation_per_ug_m3", value: 2.6e-7, unit: "per ug/m3" },
  { id: "pv-hc-tetrachloroethylene-hh-direct-rfc", substanceKey: "tetrachloroethylene", pathway: "human-health-direct", inputKey: "rfc_inhalation_mg_per_m3", value: 0.04, unit: "mg/m3" },
  { id: "pv-hc-tetrachloroethylene-hh-direct-rfd", substanceKey: "tetrachloroethylene", pathway: "human-health-direct", inputKey: "rfd_oral_mg_per_kg_bw_day", value: 0.0047, unit: "mg/kg-bw/day" },
  { id: "pv-hc-tetrachloroethylene-hh-food-rfd", substanceKey: "tetrachloroethylene", pathway: "human-health-food", inputKey: "rfd_oral_mg_per_kg_bw_day", value: 0.0047, unit: "mg/kg-bw/day" },
  { id: "pv-hc-toluene-hh-direct-rfc", substanceKey: "toluene", pathway: "human-health-direct", inputKey: "rfc_inhalation_mg_per_m3", value: 2.3, unit: "mg/m3" },
  { id: "pv-hc-toluene-hh-direct-rfd", substanceKey: "toluene", pathway: "human-health-direct", inputKey: "rfd_oral_mg_per_kg_bw_day", value: 0.0097, unit: "mg/kg-bw/day" },
  { id: "pv-hc-toluene-hh-food-rfd", substanceKey: "toluene", pathway: "human-health-food", inputKey: "rfd_oral_mg_per_kg_bw_day", value: 0.0097, unit: "mg/kg-bw/day" },
  { id: "pv-hc-trichloroethylene-hh-direct-iur", substanceKey: "trichloroethylene", pathway: "human-health-direct", inputKey: "unit_risk_inhalation_per_ug_m3", value: 0.0000041000000000000006, unit: "per ug/m3" },
  { id: "pv-hc-trichloroethylene-hh-direct-rfc", substanceKey: "trichloroethylene", pathway: "human-health-direct", inputKey: "rfc_inhalation_mg_per_m3", value: 0.002, unit: "mg/m3" },
  { id: "pv-hc-trichloroethylene-hh-direct-rfd", substanceKey: "trichloroethylene", pathway: "human-health-direct", inputKey: "rfd_oral_mg_per_kg_bw_day", value: 0.00146, unit: "mg/kg-bw/day" },
  { id: "pv-hc-trichloroethylene-hh-direct-sf", substanceKey: "trichloroethylene", pathway: "human-health-direct", inputKey: "sf_oral_per_mg_per_kg_bw_per_day", value: 0.000811, unit: "per mg/kg-bw/day" },
  { id: "pv-hc-trichloroethylene-hh-food-rfd", substanceKey: "trichloroethylene", pathway: "human-health-food", inputKey: "rfd_oral_mg_per_kg_bw_day", value: 0.00146, unit: "mg/kg-bw/day" },
  { id: "pv-hc-trichloroethylene-hh-food-sf", substanceKey: "trichloroethylene", pathway: "human-health-food", inputKey: "sf_oral_per_mg_per_kg_bw_per_day", value: 0.000811, unit: "per mg/kg-bw/day" },
  { id: "pv-hc-uranium-hh-direct-rfd", substanceKey: "uranium", pathway: "human-health-direct", inputKey: "rfd_oral_mg_per_kg_bw_day", value: 0.0006, unit: "mg/kg-bw/day" },
  { id: "pv-hc-uranium-hh-food-rfd", substanceKey: "uranium", pathway: "human-health-food", inputKey: "rfd_oral_mg_per_kg_bw_day", value: 0.0006, unit: "mg/kg-bw/day" },
  { id: "pv-hc-vinyl_chloride-hh-direct-iur", substanceKey: "vinyl_chloride", pathway: "human-health-direct", inputKey: "unit_risk_inhalation_per_ug_m3", value: 0.0000044, unit: "per ug/m3" },
  { id: "pv-hc-vinyl_chloride-hh-direct-sf", substanceKey: "vinyl_chloride", pathway: "human-health-direct", inputKey: "sf_oral_per_mg_per_kg_bw_per_day", value: 0.24, unit: "per mg/kg-bw/day" },
  { id: "pv-hc-vinyl_chloride-hh-food-sf", substanceKey: "vinyl_chloride", pathway: "human-health-food", inputKey: "sf_oral_per_mg_per_kg_bw_per_day", value: 0.24, unit: "per mg/kg-bw/day" },
  { id: "pv-hc-xylenes-hh-direct-rfc", substanceKey: "xylenes", pathway: "human-health-direct", inputKey: "rfc_inhalation_mg_per_m3", value: 0.1, unit: "mg/m3" },
  { id: "pv-hc-xylenes-hh-direct-rfd", substanceKey: "xylenes", pathway: "human-health-direct", inputKey: "rfd_oral_mg_per_kg_bw_day", value: 0.013, unit: "mg/kg-bw/day" },
  { id: "pv-hc-xylenes-hh-food-rfd", substanceKey: "xylenes", pathway: "human-health-food", inputKey: "rfd_oral_mg_per_kg_bw_day", value: 0.013, unit: "mg/kg-bw/day" },
];

// Exported allowlist (single source of truth for the catalog.test guard import).
export const HC_TRV_V4_2025_PROMOTION_VALUE_IDS = PROMOTION_ROWS.map((r) => r.id);

// Derived expected identity per record. candidate_group_id is the deterministic catalog pattern
// (pathway__substance__inputKey__jurisdiction); a drift in any examined field fails closed.
const EXPECTED_IDENTITIES = PROMOTION_ROWS.map((r) => ({
  jurisdiction: JURISDICTION,
  candidate_group_id: r.pathway + '__' + r.substanceKey + '__' + r.inputKey + '__' + JURISDICTION,
  pathway: r.pathway,
  input_key: r.inputKey,
  substance_key: r.substanceKey,
  value: r.value,
  unit: r.unit,
  value_type: 'single_value',
  default_status: 'available_option',
}));

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// ---------------------------------------------------------------------------
// Arg parsing
// ---------------------------------------------------------------------------

export function parseArgs(argv) {
  const args = { apply: false, reviewer: null, date: null, help: false, sourceUrl: null, zoteroKey: null };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--apply') args.apply = true;
    else if (a === '--help' || a === '-h') args.help = true;
    else if (a === '--reviewer') args.reviewer = argv[++i];
    else if (a === '--date') args.date = argv[++i];
    else if (a === '--source-url') args.sourceUrl = argv[++i];
    else if (a === '--zotero-key') args.zoteroKey = argv[++i];
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

// Computes the promotion plan for a single value record and enforces preconditions (fail-closed).
// PRE-STATE: these rows are ALREADY evidence_support_status = 'approved_source_backed'; promotion only
// flips qa_status (needs_review -> approved) and canonical_source_status (needs_direct_source_check ->
// direct_source_verified). evidence_support_status is unchanged.
function planOneValueRecord(paramValues, valueId, expectedIdentity) {
  const valueRecord = paramValues.find((r) => r.parameter_value_id === valueId);
  if (!valueRecord) {
    throw new Error(
      'Precondition failed: value record not found in human_health_trv_values.json: ' + valueId,
    );
  }
  if (!Array.isArray(valueRecord.evidence_items) || valueRecord.evidence_items.length === 0) {
    throw new Error('Precondition failed: ' + valueId + ' has no evidence_items');
  }
  const identityMismatch = Object.entries(expectedIdentity).filter(
    ([k, v]) => valueRecord[k] !== v,
  );
  if (identityMismatch.length > 0) {
    throw new Error(
      'Precondition failed: ' + valueId +
      ' is not in the expected frame-eligible identity. Mismatched field(s):\n' +
      identityMismatch
        .map(([k, v]) => '  ' + k + ': expected ' + JSON.stringify(v) +
          ', actual ' + JSON.stringify(valueRecord[k]))
        .join('\n') +
      '\nRefusing to promote a record that cannot seed the human-health frame.',
    );
  }
  // source_ids must be EXACTLY [HC TRV source].
  if (!Array.isArray(valueRecord.source_ids) ||
      valueRecord.source_ids.length !== 1 ||
      valueRecord.source_ids[0] !== HC_TRV_V4_2025_PROMOTION_SOURCE_ID) {
    throw new Error(
      'Precondition failed: ' + valueId + ' source_ids must be EXACTLY ["' +
      HC_TRV_V4_2025_PROMOTION_SOURCE_ID + '"] (actual: ' + JSON.stringify(valueRecord.source_ids) +
      '). A second linked source could carry a policy_compilation/reference_mining role that ' +
      'classifyCandidate would block but this single-source helper would miss. Refusing to promote.',
    );
  }
  // Nested-source provenance guard: every evidence_items[*].source_id and source_relationships[*]
  // .source_id must be the HC TRV source (a stale nested ref would survive as approved provenance).
  const nestedSourceRefs = [
    ...(Array.isArray(valueRecord.evidence_items)
      ? valueRecord.evidence_items.map((ev) => (ev ? ev.source_id : undefined))
      : []),
    ...(Array.isArray(valueRecord.source_relationships)
      ? valueRecord.source_relationships.map((rel) => (rel ? rel.source_id : undefined))
      : []),
  ];
  const staleNestedSourceRefs = nestedSourceRefs.filter(
    (sid) => sid !== HC_TRV_V4_2025_PROMOTION_SOURCE_ID,
  );
  if (staleNestedSourceRefs.length > 0) {
    throw new Error(
      'Precondition failed: ' + valueId + ' has nested provenance source reference(s) that are not ' +
      'the expected source (' + JSON.stringify(staleNestedSourceRefs) + '). Every ' +
      'evidence_items[*].source_id and source_relationships[*].source_id must be "' +
      HC_TRV_V4_2025_PROMOTION_SOURCE_ID + '". Refusing to promote.',
    );
  }
  // Fail-closed: accept ONLY the exact documented pre-promotion state or the exact already-promoted
  // state. An approved evidence item MUST carry reviewed_by + reviewed_at (attestation guard).
  const allEvidenceApproved = valueRecord.evidence_items.every(
    (ev) => ev.qa_status === 'approved' && Boolean(ev.reviewed_by) && Boolean(ev.reviewed_at),
  );
  const allEvidenceNeedsReview = valueRecord.evidence_items.every((ev) => ev.qa_status === 'needs_review');
  const valueAlreadyDone =
    valueRecord.qa_status === 'approved' &&
    valueRecord.evidence_support_status === 'approved_source_backed' &&
    valueRecord.canonical_source_status === 'direct_source_verified' &&
    allEvidenceApproved;
  const valueExpectedPre =
    valueRecord.qa_status === 'needs_review' &&
    valueRecord.evidence_support_status === 'approved_source_backed' &&
    valueRecord.canonical_source_status === 'needs_direct_source_check' &&
    allEvidenceNeedsReview;

  if (!valueAlreadyDone && !valueExpectedPre) {
    const evStates = valueRecord.evidence_items.map((ev) => ev.qa_status);
    throw new Error(
      'Precondition failed: ' + valueId +
      ' is not in the expected pre-promotion state nor the already-promoted state.\n' +
      '  expected pre  : qa_status=needs_review, evidence_support_status=approved_source_backed, canonical_source_status=needs_direct_source_check, ALL evidence_items needs_review\n' +
      '  already-done  : qa_status=approved, evidence_support_status=approved_source_backed, canonical_source_status=direct_source_verified, ALL evidence_items approved\n' +
      '  actual        : qa_status=' + valueRecord.qa_status +
      ', evidence_support_status=' + valueRecord.evidence_support_status +
      ', canonical_source_status=' + valueRecord.canonical_source_status +
      ', evidence_items qa=' + JSON.stringify(evStates) + '\n' +
      'Refusing to promote a drifted/partially-promoted record.',
    );
  }

  return { valueRecord, valueAlreadyDone, promoteValue: !valueAlreadyDone };
}

// Computes the promotion plan for all 92 value records + the source. Idempotent (records already in
// target state are SKIPPED). The source src-health-canada-trv-v4-2025 is expected already
// direct_source_verified; on the real catalog the SOURCE will normally SKIP.
export function planPromotion(paramValues, sources, _opts) {
  const valueResults = HC_TRV_V4_2025_PROMOTION_VALUE_IDS.map((valueId, i) =>
    planOneValueRecord(paramValues, valueId, EXPECTED_IDENTITIES[i]),
  );

  const sourceRecord = sources.find(
    (s) => s.source_id === HC_TRV_V4_2025_PROMOTION_SOURCE_ID,
  );
  if (!sourceRecord) {
    throw new Error(
      'Precondition failed: source record not found in sources.json: ' +
      HC_TRV_V4_2025_PROMOTION_SOURCE_ID,
    );
  }
  const csStatus = sourceRecord.canonical_source_status;
  const sourceAlreadyDone = csStatus === 'direct_source_verified';
  const sourceExpectedPre = csStatus === 'needs_direct_source_check';
  if (!sourceAlreadyDone && !sourceExpectedPre) {
    throw new Error(
      'Precondition failed: source ' + HC_TRV_V4_2025_PROMOTION_SOURCE_ID +
      ' canonical_source_status="' + csStatus +
      '" is neither needs_direct_source_check (promotable) nor direct_source_verified (done). ' +
      'Refusing to promote a drifted source.',
    );
  }

  const srcRole = sourceRecord.calculator_source_role ?? 'canonical_candidate';
  for (const { valueRecord } of valueResults) {
    const relationshipRoles = Array.isArray(valueRecord.source_relationships)
      ? valueRecord.source_relationships.map((r) => (r ? r.role : null))
      : [];
    const allRoles = [srcRole, ...relationshipRoles];
    if (allRoles.includes('policy_compilation') || allRoles.includes('reference_mining')) {
      throw new Error(
        'Precondition failed: ' + valueRecord.parameter_value_id + ' has a source role of ' +
        'policy_compilation/reference_mining (roles: ' + JSON.stringify(allRoles) + '). ' +
        'classifyCandidate would block such a record; refusing to promote.',
      );
    }
  }
  if (
    sourceRecord.file_storage === 'repo_metadata_only' ||
    srcRole !== 'canonical_candidate' ||
    sourceRecord.currentness_status !== 'current'
  ) {
    throw new Error(
      'Precondition failed: source ' + HC_TRV_V4_2025_PROMOTION_SOURCE_ID +
      ' is not direct-current eligible. isDirectCurrentSource requires file_storage != ' +
      'repo_metadata_only, calculator_source_role = canonical_candidate, currentness_status = ' +
      'current. Actual: file_storage=' + JSON.stringify(sourceRecord.file_storage) +
      ', calculator_source_role=' + JSON.stringify(srcRole) +
      ', currentness_status=' + JSON.stringify(sourceRecord.currentness_status) + '.',
    );
  }

  return {
    valueResults,
    sourceRecord,
    sourceAlreadyDone,
    promoteSource: !sourceAlreadyDone,
  };
}

// ---------------------------------------------------------------------------
// Evidence item rebuild (mirrors apply-qa-promotion.mjs approveEvidence exactly)
// ---------------------------------------------------------------------------

function approveEvidence(ev, reviewer, date) {
  const out = {};
  for (const [k, v] of Object.entries(ev)) {
    if (k === 'qa_status') {
      out.qa_status = 'approved';
      out.reviewed_by = reviewer;
      out.reviewed_at = date;
    } else if (k === 'reviewed_by' || k === 'reviewed_at') {
      continue;
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

const PROMOTION_STAMP_MARKER = 'PROMOTED to approved';
const STAMPED_PROVENANCE_FIELDS = ['applicability', 'uncertainty', 'review_notes'];

function buildValueStamp(date, reviewer) {
  return (
    ' [PROMOTED to approved (qa_status approved, source direct_source_verified) on ' +
    date + ' by ' + reviewer + '; the needs_review language above is superseded.]'
  );
}

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
  return changed;
}

function valueStampRepairNeeded(r) {
  return STAMPED_PROVENANCE_FIELDS.some(
    (field) =>
      typeof r[field] === 'string' &&
      r[field].length > 0 &&
      !r[field].includes(PROMOTION_STAMP_MARKER),
  );
}

// ---------------------------------------------------------------------------
// Apply (in-place mutation of the parsed records; ONLY the target records are touched)
// ---------------------------------------------------------------------------

export function applyPromotion(paramValues, sources, opts) {
  const plan = planPromotion(paramValues, sources, opts);

  const valueTouchedFlags = [];
  for (const vr of plan.valueResults) {
    let touched = false;
    if (vr.promoteValue) {
      const r = vr.valueRecord;
      r.qa_status = 'approved';
      // evidence_support_status is ALREADY approved_source_backed; leave it.
      r.canonical_source_status = 'direct_source_verified';
      // default_status is intentionally NOT modified (stays 'available_option').
      r.evidence_items = r.evidence_items.map((ev) => approveEvidence(ev, opts.reviewer, opts.date));
      stampValueProvenance(r, opts.date, opts.reviewer);
    } else if (vr.valueAlreadyDone) {
      touched = stampValueProvenance(vr.valueRecord, opts.date, opts.reviewer);
    }
    valueTouchedFlags.push(touched);
  }
  plan.valueTouchedFlags = valueTouchedFlags;

  let sourceTouched = false;
  if (opts.sourceUrl && plan.sourceRecord.url !== opts.sourceUrl) {
    plan.sourceRecord.url = opts.sourceUrl;
    sourceTouched = true;
  }
  if (opts.zoteroKey) {
    if (plan.sourceRecord.zotero_item_key !== opts.zoteroKey) {
      plan.sourceRecord.zotero_item_key = opts.zoteroKey;
      sourceTouched = true;
    }
    if (plan.sourceRecord.zotero_status !== 'linked') {
      plan.sourceRecord.zotero_status = 'linked';
      sourceTouched = true;
    }
  }
  if (plan.promoteSource) {
    plan.sourceRecord.canonical_source_status = 'direct_source_verified';
    const srcStamp =
      ' [Source promoted to direct_source_verified on ' + opts.date + ' by ' + opts.reviewer +
      '; the pending / needs_review language above is superseded.]';
    if (typeof plan.sourceRecord.notes === 'string') plan.sourceRecord.notes += srcStamp;
    sourceTouched = true;
  }
  plan.sourceTouched = sourceTouched;

  return plan;
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

const BANNER = [
  '=============================================================================',
  ' promote-hc-trv-v4-2025.mjs -- owner-run Health Canada TRV v4.0 (2025) promotion',
  '   (92 human-health TRV rows across 34 substances; RfD/SF/RfC/IUR; direct + food)',
  '=============================================================================',
  '',
  'OWNER VERIFICATION REQUIRED before --apply:',
  '  Verify the 92 TRV values against the primary Health Canada TRV v4.0 (2025) source',
  '  (catalog H129-108/2025E-PDF, Table 1, pp. 17-51). Running --apply attests to that verification.',
  '',
  'SCOPE: targets the 92 listed pv-hc-* ids ONLY (all linked to src-health-canada-trv-v4-2025).',
  '  default_status is NOT changed (stays available_option). The FRAME_DEFAULT_PROFILES row is the',
  '  owner activation step, not this tool.',
  '',
  'SOURCE NOTE:',
  '  src-health-canada-trv-v4-2025 is expected to already be direct_source_verified.',
  '  On the real catalog the SOURCE will normally SKIP (already-done = no-op).',
  '',
].join('\n');

const HELP = [
  'promote-hc-trv-v4-2025.mjs -- owner-run Health Canada TRV v4.0 (2025) promotion (92 rows).',
  '',
  'Usage:',
  '  node scripts/matrix-options/promote-hc-trv-v4-2025.mjs --reviewer "<id>" --date YYYY-MM-DD [--apply]',
  '    [--source-url "<url>"] [--zotero-key "<key>"]',
  '',
  'Options:',
  '  --reviewer "<id>"        Reviewer attestation -> evidence.reviewed_by (required for --apply)',
  '  --date YYYY-MM-DD        Review date -> evidence.reviewed_at (required for --apply)',
  '  --source-url "<url>"     Override the stored source URL (only if it changed).',
  '  --zotero-key "<key>"     Zotero item key; sets zotero_item_key and zotero_status=linked.',
  '  --apply                  Write both catalog files (default is a dry run that writes nothing)',
  '',
  'Targets: 92 HC TRV VALUE records + 1 SOURCE (src-health-canada-trv-v4-2025).',
  '',
  'On --apply, each VALUE record changes:',
  '  qa_status                 needs_review -> approved',
  '  evidence_support_status   approved_source_backed (UNCHANGED -- already source-backed)',
  '  canonical_source_status   needs_direct_source_check -> direct_source_verified',
  '  evidence_items[*].qa_status needs_review -> approved (+ reviewed_by/at after qa_status)',
  '  default_status            UNCHANGED (stays available_option)',
  '',
  'AI never runs this with --apply. The owner runs it; --reviewer/--date are the HITL attestation.',
  'After --apply: npx tsc --noEmit; npm run lint; npm run test:ci',
].join('\n');

function printPlan(plan, opts) {
  for (let i = 0; i < plan.valueResults.length; i++) {
    const vr = plan.valueResults[i];
    const valueId = HC_TRV_V4_2025_PROMOTION_VALUE_IDS[i];
    if (vr.promoteValue) {
      const r = vr.valueRecord;
      console.log('  VALUE   PROMOTE  ' + valueId);
      console.log('    qa_status               : ' + r.qa_status + ' -> approved');
      console.log('    canonical_source_status : ' + r.canonical_source_status +
        ' -> direct_source_verified  (evidence_support_status ' + r.evidence_support_status + ' UNCHANGED)');
    } else {
      console.log('  VALUE   SKIP     ' + valueId + ': already in target state (no-op)');
    }
  }
  if (plan.promoteSource) {
    console.log('  SOURCE  PROMOTE  ' + HC_TRV_V4_2025_PROMOTION_SOURCE_ID +
      ': ' + plan.sourceRecord.canonical_source_status + ' -> direct_source_verified');
  } else {
    console.log('  SOURCE  SKIP     ' + HC_TRV_V4_2025_PROMOTION_SOURCE_ID + ': already in target state (no-op)');
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
  console.log('Files   : ' + HH_TRV_FILE);
  console.log('          ' + SOURCES_FILE);
  console.log('reviewer: ' + (opts.reviewer || '(not set)'));
  console.log('date    : ' + (opts.date || '(not set)'));
  console.log('records : ' + HC_TRV_V4_2025_PROMOTION_VALUE_IDS.length + ' VALUE + 1 SOURCE');
  console.log('');

  const paramValues = JSON.parse(fs.readFileSync(HH_TRV_FILE, 'utf8'));
  const sources = JSON.parse(fs.readFileSync(SOURCES_FILE, 'utf8'));

  const plan = planPromotion(paramValues, sources, opts);

  console.log('Before/after plan:');
  printPlan(plan, opts);
  console.log('');

  const totalToPromote =
    plan.valueResults.filter((vr) => vr.promoteValue).length +
    (plan.promoteSource ? 1 : 0);
  const totalSkipped =
    plan.valueResults.filter((vr) => vr.valueAlreadyDone).length +
    (plan.sourceAlreadyDone ? 1 : 0);
  console.log('Summary: ' + totalToPromote + ' record(s) to promote, ' +
    totalSkipped + ' already in target state.');

  const anyValueStampRepair = plan.valueResults.some(
    (vr) => vr.valueAlreadyDone && valueStampRepairNeeded(vr.valueRecord),
  );
  if (anyValueStampRepair) {
    console.log('NOTE: one or more already-approved records are MISSING a promotion display-stamp; ' +
      '--apply will repair it.');
  }

  if (!opts.apply) {
    console.log('');
    console.log('DRY RUN -- no file written. Re-run with --apply (plus --reviewer/--date) to write.');
    return;
  }

  validateApplyOptions(opts);

  const sourceWillBeVerified = plan.promoteSource || plan.sourceAlreadyDone;
  const anyValueWillBeApproved = plan.valueResults.some((vr) => vr.promoteValue || vr.valueAlreadyDone);
  const effUrl = opts.sourceUrl || plan.sourceRecord.url;
  const effKey = opts.zoteroKey || plan.sourceRecord.zotero_item_key;
  if (anyValueWillBeApproved && sourceWillBeVerified && !effUrl && !effKey) {
    throw new Error(
      'Provenance guard: value records would be approved against source ' +
      HC_TRV_V4_2025_PROMOTION_SOURCE_ID + ' (direct_source_verified), but that source has no durable' +
      ' locator (url=null, zotero_item_key=null).\n' +
      'Provide --source-url "<url>" and/or --zotero-key "<Zotero item key>".',
    );
  }

  const locatorWouldChange =
    (Boolean(opts.sourceUrl) && plan.sourceRecord.url !== opts.sourceUrl) ||
    (Boolean(opts.zoteroKey) && plan.sourceRecord.zotero_item_key !== opts.zoteroKey) ||
    (Boolean(opts.zoteroKey) && plan.sourceRecord.zotero_status !== 'linked');
  const stampRepairWouldChange = plan.valueResults.some(
    (vr) => vr.valueAlreadyDone && valueStampRepairNeeded(vr.valueRecord),
  );
  if (totalToPromote === 0 && !locatorWouldChange && !stampRepairWouldChange) {
    console.log('');
    console.log('Nothing to promote (all records already in target state). No write.');
    return;
  }

  const applied = applyPromotion(paramValues, sources, opts);

  const anyValueWrite =
    applied.valueResults.some((vr) => vr.promoteValue) ||
    applied.valueTouchedFlags.some(Boolean);
  if (anyValueWrite) {
    fs.writeFileSync(HH_TRV_FILE, JSON.stringify(paramValues, null, 2) + '\n', 'utf8');
    console.log('WROTE ' + HH_TRV_FILE);
  }
  if (applied.promoteSource || applied.sourceTouched) {
    fs.writeFileSync(SOURCES_FILE, JSON.stringify(sources, null, 2) + '\n', 'utf8');
    console.log('WROTE ' + SOURCES_FILE);
  }

  const promotedCount = applied.valueResults.filter((vr) => vr.promoteValue).length;
  if (promotedCount > 0) {
    console.log('');
    console.log('REQUIRED before test:ci -- promoting these records shifts the audit-count guards.');
    console.log('  Update src/lib/matrix-options/provenance/__tests__/library.test.ts in the SAME commit:');
    console.log('    audit.values.needsReview : -' + promotedCount + ' (records leave needs_review)');
    console.log('    audit.values.approved    : +' + promotedCount + ' (records become approved)');
    console.log('  (approvedSourceBacked / pendingSourceLocator UNCHANGED -- rows were ALREADY');
    console.log('   approved_source_backed; default_status stays available_option so valueGroups /');
    console.log('   availableOptions / currentDefaults UNCHANGED.)');
    console.log('  Also add HC_TRV_V4_2025_PROMOTION_VALUE_IDS to the catalog.test.ts HH tripwire union.');
    console.log('  Run npm run test:ci and bump to match the FAILING assertion (do not hard-set).');
  }

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
