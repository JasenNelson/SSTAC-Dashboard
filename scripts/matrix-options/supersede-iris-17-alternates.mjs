// Owner-run disposal helper for the 41 unverified US EPA IRIS oral-RfD/RfC "alternate" needs_review
// rows identified in Stage 2 decision-log item S2-2 ("IRIS #17"). Plain ASCII only.
//
// WHY THIS EXISTS
// promote-iris-rfd-batch.mjs (2026-06-21) EXCLUDED 46 needs_review pv-iris-* rows from its 680-row
// promotion because multiple IRIS RfD/RfC estimates shared one candidate_group_id (two approved rows
// in one group would create ambiguous frame-seed candidates). promote-iris-dupe-cg-canonical.mjs
// (2026-06-22) then promoted 14 of those to approved -- the EPA-verified CHRONIC value for each of the
// trimethylbenzenes (1,2,3- / 1,2,4- / 1,3,5-), 1,1,1-trichloroethane, and RDX groups -- leaving the
// non-canonical members of each group needs_review. Separately, the PFAS groups (PFBA/PFDA/PFHxA) each
// already carry their own approved canonical member from an earlier PFAS promotion lane.
//
// This tool disposes (qa_status -> superseded) the 41 REMAINING needs_review pv-iris-* rows across
// those SAME 20 candidate_group_ids: 8 substances (1_1_1_trichloroethane, 1_2_3_trimethylbenzene,
// 1_2_4_trimethylbenzene, 1_3_5_trimethylbenzene, hexahydro_1_3_5_trinitro_1_3_5_triazine_rdx (RDX),
// perfluorobutanoic_acid_pfba, perfluorodecanoic_acid_pfda, perfluorohexanoic_acid_pfhxa).
//
// OWNER RULING (Stage 2 decision log, S2-2, 2026-07-16): "supersede all 41 needs_review IRIS
// alternates (across all 20 groups); keep each group's verified direct_source_verified canonical
// sibling." Rationale (decisive): ALL 41 alternates AND their approved canonical siblings share the
// SAME source (src-us-epa-iris-rfd-table-live or src-us-epa-iris-chemical-details-live),
// robot-extracted 2026-06-02 from the SAME "US EPA IRIS Chemicals_Details export" for the SAME CASRN.
// IRIS publishes ONE RfD/RfC per chemical -> the multiple values per group are unverified extraction
// variants of a single source, not independent more-protective values -- true even for the 4 groups
// (RDX direct/food, PFHxA direct/food) where an alternate happens to be numerically LOWER
// (more-protective) than the approved canonical: those are extraction noise, not a genuine
// more-conservative published value, so uniform supersede (not selective retention) is the defensible
// disposition. See STAGE2_DECISION_LOG_2026_07_16.md S2-2 for the full per-group analysis, including
// the PFDA (G17/G18) approved-canonical-value follow-up (RESOLVED separately; out of this tool's
// scope -- it touches only needs_review rows, never the approved canonical siblings).
//
// It mirrors promote-copper-hc0426.mjs in structure, style, and fail-closed discipline (inverse qa
// transition: needs_review -> superseded, not -> approved), scoped to ONE catalog file
// (human_health_trv_values.json -- all 41 rows live there; zero rows touched in parameter_values.json
// or any other catalog file).
//
// LOAD-BEARING RULES honored:
//  - AI NEVER writes qa_status. This tool is run BY THE OWNER; --reviewer/--date are the owner's HITL
//    attestation. Author + dry-run only for AI.
//  - SCOPE: only the 41 listed pv-iris-* records are touched. default_status is NEVER modified (stays
//    'available_option' on all 41 -- disposal is a qa_status-only transition; none are current_default).
//  - CONFIRM-ONLY (read-only): the 20 approved canonical sibling rows (one per candidate_group_id) are
//    asserted unchanged (value, qa_status=approved, canonical_source_status=direct_source_verified) as
//    a pre-state sanity check. This tool never mutates them.
//  - GUARD-TEST IMPACT: none of the existing provenance guard tests break. catalog.test.ts's
//    "constrains any qa-promoted IRIS TRV beyond the frozen batch" tripwire (~line 666) filters on
//    qa_status==='approved'; these 41 rows move to 'superseded', never 'approved', so they never enter
//    that filter. iris-canonical.test.ts and iris-snapshot-magnitude.test.ts match catalog IRIS values
//    against the EPA snapshot by substance_key/input_key regardless of qa_status (value/substance/input
//    are unchanged by this tool), so they are unaffected. library.test.ts's audit counts
//    (approvedSourceBacked, currentDefaults, available_option totals) are keyed on evidence_support_status
//    / default_status, neither of which this tool touches. The one universal invariant that DOES apply
//    (catalog.test.ts ~line 281: every evidence_items[].qa_status === record.qa_status) is satisfied by
//    this tool's top-level + nested flip. No test edits are required for this disposal.
//
// USAGE (run from anywhere; paths resolve from the script location):
//   node scripts/matrix-options/supersede-iris-17-alternates.mjs --reviewer "J. Nelson" --date 2026-07-16
//   node scripts/matrix-options/supersede-iris-17-alternates.mjs --reviewer "J. Nelson" --date 2026-07-16 --apply
//
// Default is a DRY RUN (prints the per-record plan, writes nothing). --apply writes
// matrix_research/reference_catalog/human_health_trv_values.json (the only file this tool ever writes).

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..', '..');
const HH_TRV_FILE = path.join(
  REPO_ROOT, 'matrix_research', 'reference_catalog', 'human_health_trv_values.json',
);

const DISPOSAL_RATIONALE =
  'Superseded: unverified robot-extraction alternate of src-us-epa-iris-rfd-table-live; the group\'s ' +
  'direct_source_verified canonical sibling is retained. Owner ruling 2026-07-16 (IRIS #17).';

// The EXACT 41 records this tool will ever touch (fail-closed, hardcoded -- NOT a dynamic filter
// computed at apply time). Identity fields (value, candidateGroupId) are the drift-detection guard --
// any mismatch aborts with no writes. substanceKey is carried for audit/printout only.
export const DISPOSAL_ROWS = [
  { id: 'pv-iris-1_1_1_trichloroethane-hh-direct-rfc', value: 7, substanceKey: '1_1_1_trichloroethane', candidateGroupId: 'human-health-direct__1_1_1_trichloroethane__rfc_inhalation_mg_per_m3__US_federal' },
  { id: 'pv-iris-1_1_1_trichloroethane-hh-direct-rfc-inhalation-rfc-3', value: 9, substanceKey: '1_1_1_trichloroethane', candidateGroupId: 'human-health-direct__1_1_1_trichloroethane__rfc_inhalation_mg_per_m3__US_federal' },
  { id: 'pv-iris-1_1_1_trichloroethane-hh-direct-rfc-inhalation-rfc-4', value: 6, substanceKey: '1_1_1_trichloroethane', candidateGroupId: 'human-health-direct__1_1_1_trichloroethane__rfc_inhalation_mg_per_m3__US_federal' },
  { id: 'pv-iris-1_1_1_trichloroethane-hh-direct-rfd', value: 7, substanceKey: '1_1_1_trichloroethane', candidateGroupId: 'human-health-direct__1_1_1_trichloroethane__rfd_oral_mg_per_kg_bw_day__US_federal' },
  { id: 'pv-iris-1_1_1_trichloroethane-hh-food-rfd', value: 7, substanceKey: '1_1_1_trichloroethane', candidateGroupId: 'human-health-food__1_1_1_trichloroethane__rfd_oral_mg_per_kg_bw_day__US_federal' },
  { id: 'pv-iris-1_2_3_trimethylbenzene-hh-direct-rfc-inhalation-rfc-2', value: 0.2, substanceKey: '1_2_3_trimethylbenzene', candidateGroupId: 'human-health-direct__1_2_3_trimethylbenzene__rfc_inhalation_mg_per_m3__US_federal' },
  { id: 'pv-iris-1_2_3_trimethylbenzene-hh-direct-rfd', value: 0.04, substanceKey: '1_2_3_trimethylbenzene', candidateGroupId: 'human-health-direct__1_2_3_trimethylbenzene__rfd_oral_mg_per_kg_bw_day__US_federal' },
  { id: 'pv-iris-1_2_3_trimethylbenzene-hh-food-rfd', value: 0.04, substanceKey: '1_2_3_trimethylbenzene', candidateGroupId: 'human-health-food__1_2_3_trimethylbenzene__rfd_oral_mg_per_kg_bw_day__US_federal' },
  { id: 'pv-iris-1_2_4_trimethylbenzene-hh-direct-rfc', value: 0.2, substanceKey: '1_2_4_trimethylbenzene', candidateGroupId: 'human-health-direct__1_2_4_trimethylbenzene__rfc_inhalation_mg_per_m3__US_federal' },
  { id: 'pv-iris-1_2_4_trimethylbenzene-hh-direct-rfc-inhalation-rfc-2', value: 4, substanceKey: '1_2_4_trimethylbenzene', candidateGroupId: 'human-health-direct__1_2_4_trimethylbenzene__rfc_inhalation_mg_per_m3__US_federal' },
  { id: 'pv-iris-1_2_4_trimethylbenzene-hh-direct-rfc-inhalation-rfc-3', value: 3, substanceKey: '1_2_4_trimethylbenzene', candidateGroupId: 'human-health-direct__1_2_4_trimethylbenzene__rfc_inhalation_mg_per_m3__US_federal' },
  { id: 'pv-iris-1_2_4_trimethylbenzene-hh-direct-rfc-inhalation-rfc-5', value: 0.08, substanceKey: '1_2_4_trimethylbenzene', candidateGroupId: 'human-health-direct__1_2_4_trimethylbenzene__rfc_inhalation_mg_per_m3__US_federal' },
  { id: 'pv-iris-1_2_4_trimethylbenzene-hh-direct-rfd-nzene-oral-rfd-2', value: 0.04, substanceKey: '1_2_4_trimethylbenzene', candidateGroupId: 'human-health-direct__1_2_4_trimethylbenzene__rfd_oral_mg_per_kg_bw_day__US_federal' },
  { id: 'pv-iris-1_2_4_trimethylbenzene-hh-food-rfd-nzene-oral-rfd-2', value: 0.04, substanceKey: '1_2_4_trimethylbenzene', candidateGroupId: 'human-health-food__1_2_4_trimethylbenzene__rfd_oral_mg_per_kg_bw_day__US_federal' },
  { id: 'pv-iris-1_3_5_trimethylbenzene-hh-direct-rfc-inhalation-rfc-2', value: 4, substanceKey: '1_3_5_trimethylbenzene', candidateGroupId: 'human-health-direct__1_3_5_trimethylbenzene__rfc_inhalation_mg_per_m3__US_federal' },
  { id: 'pv-iris-1_3_5_trimethylbenzene-hh-direct-rfc-inhalation-rfc-3', value: 0.4, substanceKey: '1_3_5_trimethylbenzene', candidateGroupId: 'human-health-direct__1_3_5_trimethylbenzene__rfc_inhalation_mg_per_m3__US_federal' },
  { id: 'pv-iris-1_3_5_trimethylbenzene-hh-direct-rfc-inhalation-rfc-4', value: 0.2, substanceKey: '1_3_5_trimethylbenzene', candidateGroupId: 'human-health-direct__1_3_5_trimethylbenzene__rfc_inhalation_mg_per_m3__US_federal' },
  { id: 'pv-iris-1_3_5_trimethylbenzene-hh-direct-rfd-nzene-oral-rfd-2', value: 0.04, substanceKey: '1_3_5_trimethylbenzene', candidateGroupId: 'human-health-direct__1_3_5_trimethylbenzene__rfd_oral_mg_per_kg_bw_day__US_federal' },
  { id: 'pv-iris-1_3_5_trimethylbenzene-hh-food-rfd-nzene-oral-rfd-2', value: 0.04, substanceKey: '1_3_5_trimethylbenzene', candidateGroupId: 'human-health-food__1_3_5_trimethylbenzene__rfd_oral_mg_per_kg_bw_day__US_federal' },
  { id: 'pv-iris-hexahydro_1_3_5_trinitro_1_3_5_triazine_rdx-hh-direct-rfd', value: 0.01, substanceKey: 'hexahydro_1_3_5_trinitro_1_3_5_triazine_rdx', candidateGroupId: 'human-health-direct__hexahydro_1_3_5_trinitro_1_3_5_triazine_rdx__rfd_oral_mg_per_kg_bw_day__US_federal' },
  { id: 'pv-iris-hexahydro_1_3_5_trinitro_1_3_5_triazine_rdx-hh-direct-rfd-e-rdx-oral-rfd-2', value: 0.0008, substanceKey: 'hexahydro_1_3_5_trinitro_1_3_5_triazine_rdx', candidateGroupId: 'human-health-direct__hexahydro_1_3_5_trinitro_1_3_5_triazine_rdx__rfd_oral_mg_per_kg_bw_day__US_federal' },
  { id: 'pv-iris-hexahydro_1_3_5_trinitro_1_3_5_triazine_rdx-hh-food-rfd', value: 0.01, substanceKey: 'hexahydro_1_3_5_trinitro_1_3_5_triazine_rdx', candidateGroupId: 'human-health-food__hexahydro_1_3_5_trinitro_1_3_5_triazine_rdx__rfd_oral_mg_per_kg_bw_day__US_federal' },
  { id: 'pv-iris-hexahydro_1_3_5_trinitro_1_3_5_triazine_rdx-hh-food-rfd-e-rdx-oral-rfd-2', value: 0.0008, substanceKey: 'hexahydro_1_3_5_trinitro_1_3_5_triazine_rdx', candidateGroupId: 'human-health-food__hexahydro_1_3_5_trinitro_1_3_5_triazine_rdx__rfd_oral_mg_per_kg_bw_day__US_federal' },
  { id: 'pv-iris-perfluorobutanoic_acid_pfba-hh-direct-rfd', value: 0.01, substanceKey: 'perfluorobutanoic_acid_pfba', candidateGroupId: 'human-health-direct__perfluorobutanoic_acid_pfba__rfd_oral_mg_per_kg_bw_day__US_federal' },
  { id: 'pv-iris-perfluorobutanoic_acid_pfba-hh-direct-rfd--pfba-oral-rfd-2', value: 0.006, substanceKey: 'perfluorobutanoic_acid_pfba', candidateGroupId: 'human-health-direct__perfluorobutanoic_acid_pfba__rfd_oral_mg_per_kg_bw_day__US_federal' },
  { id: 'pv-iris-perfluorobutanoic_acid_pfba-hh-food-rfd', value: 0.01, substanceKey: 'perfluorobutanoic_acid_pfba', candidateGroupId: 'human-health-food__perfluorobutanoic_acid_pfba__rfd_oral_mg_per_kg_bw_day__US_federal' },
  { id: 'pv-iris-perfluorobutanoic_acid_pfba-hh-food-rfd--pfba-oral-rfd-2', value: 0.006, substanceKey: 'perfluorobutanoic_acid_pfba', candidateGroupId: 'human-health-food__perfluorobutanoic_acid_pfba__rfd_oral_mg_per_kg_bw_day__US_federal' },
  { id: 'pv-iris-perfluorodecanoic_acid_pfda-hh-direct-rfd--pfda-oral-rfd-2', value: 6e-7, substanceKey: 'perfluorodecanoic_acid_pfda', candidateGroupId: 'human-health-direct__perfluorodecanoic_acid_pfda__rfd_oral_mg_per_kg_bw_day__US_federal' },
  { id: 'pv-iris-perfluorodecanoic_acid_pfda-hh-direct-rfd--pfda-oral-rfd-3', value: 0.000003, substanceKey: 'perfluorodecanoic_acid_pfda', candidateGroupId: 'human-health-direct__perfluorodecanoic_acid_pfda__rfd_oral_mg_per_kg_bw_day__US_federal' },
  { id: 'pv-iris-perfluorodecanoic_acid_pfda-hh-direct-rfd--pfda-oral-rfd-4', value: 0.000001, substanceKey: 'perfluorodecanoic_acid_pfda', candidateGroupId: 'human-health-direct__perfluorodecanoic_acid_pfda__rfd_oral_mg_per_kg_bw_day__US_federal' },
  { id: 'pv-iris-perfluorodecanoic_acid_pfda-hh-food-rfd--pfda-oral-rfd-2', value: 6e-7, substanceKey: 'perfluorodecanoic_acid_pfda', candidateGroupId: 'human-health-food__perfluorodecanoic_acid_pfda__rfd_oral_mg_per_kg_bw_day__US_federal' },
  { id: 'pv-iris-perfluorodecanoic_acid_pfda-hh-food-rfd--pfda-oral-rfd-3', value: 0.000003, substanceKey: 'perfluorodecanoic_acid_pfda', candidateGroupId: 'human-health-food__perfluorodecanoic_acid_pfda__rfd_oral_mg_per_kg_bw_day__US_federal' },
  { id: 'pv-iris-perfluorodecanoic_acid_pfda-hh-food-rfd--pfda-oral-rfd-4', value: 0.000001, substanceKey: 'perfluorodecanoic_acid_pfda', candidateGroupId: 'human-health-food__perfluorodecanoic_acid_pfda__rfd_oral_mg_per_kg_bw_day__US_federal' },
  { id: 'pv-iris-perfluorohexanoic_acid_pfhxa-hh-direct-rfd', value: 0.001, substanceKey: 'perfluorohexanoic_acid_pfhxa', candidateGroupId: 'human-health-direct__perfluorohexanoic_acid_pfhxa__rfd_oral_mg_per_kg_bw_day__US_federal' },
  { id: 'pv-iris-perfluorohexanoic_acid_pfhxa-hh-direct-rfd-pfhxa-oral-rfd-2', value: 0.0008, substanceKey: 'perfluorohexanoic_acid_pfhxa', candidateGroupId: 'human-health-direct__perfluorohexanoic_acid_pfhxa__rfd_oral_mg_per_kg_bw_day__US_federal' },
  { id: 'pv-iris-perfluorohexanoic_acid_pfhxa-hh-direct-rfd-pfhxa-oral-rfd-4', value: 0.005, substanceKey: 'perfluorohexanoic_acid_pfhxa', candidateGroupId: 'human-health-direct__perfluorohexanoic_acid_pfhxa__rfd_oral_mg_per_kg_bw_day__US_federal' },
  { id: 'pv-iris-perfluorohexanoic_acid_pfhxa-hh-direct-rfd-pfhxa-oral-rfd-5', value: 0.0004, substanceKey: 'perfluorohexanoic_acid_pfhxa', candidateGroupId: 'human-health-direct__perfluorohexanoic_acid_pfhxa__rfd_oral_mg_per_kg_bw_day__US_federal' },
  { id: 'pv-iris-perfluorohexanoic_acid_pfhxa-hh-food-rfd', value: 0.001, substanceKey: 'perfluorohexanoic_acid_pfhxa', candidateGroupId: 'human-health-food__perfluorohexanoic_acid_pfhxa__rfd_oral_mg_per_kg_bw_day__US_federal' },
  { id: 'pv-iris-perfluorohexanoic_acid_pfhxa-hh-food-rfd-pfhxa-oral-rfd-2', value: 0.0008, substanceKey: 'perfluorohexanoic_acid_pfhxa', candidateGroupId: 'human-health-food__perfluorohexanoic_acid_pfhxa__rfd_oral_mg_per_kg_bw_day__US_federal' },
  { id: 'pv-iris-perfluorohexanoic_acid_pfhxa-hh-food-rfd-pfhxa-oral-rfd-4', value: 0.005, substanceKey: 'perfluorohexanoic_acid_pfhxa', candidateGroupId: 'human-health-food__perfluorohexanoic_acid_pfhxa__rfd_oral_mg_per_kg_bw_day__US_federal' },
  { id: 'pv-iris-perfluorohexanoic_acid_pfhxa-hh-food-rfd-pfhxa-oral-rfd-5', value: 0.0004, substanceKey: 'perfluorohexanoic_acid_pfhxa', candidateGroupId: 'human-health-food__perfluorohexanoic_acid_pfhxa__rfd_oral_mg_per_kg_bw_day__US_federal' },
];

// Fail-closed sanity check on the allowlist itself: this tool has ONE job -- dispose EXACTLY these 41
// rows, no more, no fewer. If the hardcoded table above was ever edited to a different length, abort
// before touching the catalog at all.
if (DISPOSAL_ROWS.length !== 41) {
  throw new Error(
    'Invariant violated: DISPOSAL_ROWS must contain EXACTLY 41 hardcoded rows (Stage 2 S2-2 scope); ' +
    'found ' + DISPOSAL_ROWS.length + '. Refusing to run with a drifted allowlist.',
  );
}

export const IRIS_17_DISPOSAL_VALUE_IDS = DISPOSAL_ROWS.map((r) => r.id);

// Read-only idempotent confirmation: the 20 approved canonical siblings (one per candidate_group_id)
// this disposal is deferring to must not have drifted. Never mutated by this tool.
const CANONICAL_CONFIRM_ROWS = [
  { id: 'pv-iris-1_1_1_trichloroethane-hh-direct-rfc-inhalation-rfc-2', value: 5, candidateGroupId: 'human-health-direct__1_1_1_trichloroethane__rfc_inhalation_mg_per_m3__US_federal' },
  { id: 'pv-iris-1_1_1_trichloroethane-hh-direct-rfd-thane-oral-rfd-2', value: 2, candidateGroupId: 'human-health-direct__1_1_1_trichloroethane__rfd_oral_mg_per_kg_bw_day__US_federal' },
  { id: 'pv-iris-1_2_3_trimethylbenzene-hh-direct-rfc', value: 0.06, candidateGroupId: 'human-health-direct__1_2_3_trimethylbenzene__rfc_inhalation_mg_per_m3__US_federal' },
  { id: 'pv-iris-1_2_3_trimethylbenzene-hh-direct-rfd-nzene-oral-rfd-2', value: 0.01, candidateGroupId: 'human-health-direct__1_2_3_trimethylbenzene__rfd_oral_mg_per_kg_bw_day__US_federal' },
  { id: 'pv-iris-1_2_4_trimethylbenzene-hh-direct-rfc-inhalation-rfc-4', value: 0.06, candidateGroupId: 'human-health-direct__1_2_4_trimethylbenzene__rfc_inhalation_mg_per_m3__US_federal' },
  { id: 'pv-iris-1_2_4_trimethylbenzene-hh-direct-rfd', value: 0.01, candidateGroupId: 'human-health-direct__1_2_4_trimethylbenzene__rfd_oral_mg_per_kg_bw_day__US_federal' },
  { id: 'pv-iris-1_3_5_trimethylbenzene-hh-direct-rfc', value: 0.06, candidateGroupId: 'human-health-direct__1_3_5_trimethylbenzene__rfc_inhalation_mg_per_m3__US_federal' },
  { id: 'pv-iris-1_3_5_trimethylbenzene-hh-direct-rfd', value: 0.01, candidateGroupId: 'human-health-direct__1_3_5_trimethylbenzene__rfd_oral_mg_per_kg_bw_day__US_federal' },
  { id: 'pv-iris-hexahydro_1_3_5_trinitro_1_3_5_triazine_rdx-hh-direct-rfd-e-rdx-oral-rfd-3', value: 0.004, candidateGroupId: 'human-health-direct__hexahydro_1_3_5_trinitro_1_3_5_triazine_rdx__rfd_oral_mg_per_kg_bw_day__US_federal' },
  { id: 'pv-iris-perfluorobutanoic_acid_pfba-hh-direct-rfd--pfba-oral-rfd-3', value: 0.001, candidateGroupId: 'human-health-direct__perfluorobutanoic_acid_pfba__rfd_oral_mg_per_kg_bw_day__US_federal' },
  { id: 'pv-iris-perfluorodecanoic_acid_pfda-hh-direct-rfd', value: 2e-9, candidateGroupId: 'human-health-direct__perfluorodecanoic_acid_pfda__rfd_oral_mg_per_kg_bw_day__US_federal' },
  { id: 'pv-iris-perfluorohexanoic_acid_pfhxa-hh-direct-rfd-pfhxa-oral-rfd-3', value: 0.0005, candidateGroupId: 'human-health-direct__perfluorohexanoic_acid_pfhxa__rfd_oral_mg_per_kg_bw_day__US_federal' },
  { id: 'pv-iris-1_1_1_trichloroethane-hh-food-rfd-thane-oral-rfd-2', value: 2, candidateGroupId: 'human-health-food__1_1_1_trichloroethane__rfd_oral_mg_per_kg_bw_day__US_federal' },
  { id: 'pv-iris-1_2_3_trimethylbenzene-hh-food-rfd-nzene-oral-rfd-2', value: 0.01, candidateGroupId: 'human-health-food__1_2_3_trimethylbenzene__rfd_oral_mg_per_kg_bw_day__US_federal' },
  { id: 'pv-iris-1_2_4_trimethylbenzene-hh-food-rfd', value: 0.01, candidateGroupId: 'human-health-food__1_2_4_trimethylbenzene__rfd_oral_mg_per_kg_bw_day__US_federal' },
  { id: 'pv-iris-1_3_5_trimethylbenzene-hh-food-rfd', value: 0.01, candidateGroupId: 'human-health-food__1_3_5_trimethylbenzene__rfd_oral_mg_per_kg_bw_day__US_federal' },
  { id: 'pv-iris-hexahydro_1_3_5_trinitro_1_3_5_triazine_rdx-hh-food-rfd-e-rdx-oral-rfd-3', value: 0.004, candidateGroupId: 'human-health-food__hexahydro_1_3_5_trinitro_1_3_5_triazine_rdx__rfd_oral_mg_per_kg_bw_day__US_federal' },
  { id: 'pv-iris-perfluorobutanoic_acid_pfba-hh-food-rfd--pfba-oral-rfd-3', value: 0.001, candidateGroupId: 'human-health-food__perfluorobutanoic_acid_pfba__rfd_oral_mg_per_kg_bw_day__US_federal' },
  { id: 'pv-iris-perfluorodecanoic_acid_pfda-hh-food-rfd', value: 2e-9, candidateGroupId: 'human-health-food__perfluorodecanoic_acid_pfda__rfd_oral_mg_per_kg_bw_day__US_federal' },
  { id: 'pv-iris-perfluorohexanoic_acid_pfhxa-hh-food-rfd-pfhxa-oral-rfd-3', value: 0.0005, candidateGroupId: 'human-health-food__perfluorohexanoic_acid_pfhxa__rfd_oral_mg_per_kg_bw_day__US_federal' },
];

if (CANONICAL_CONFIRM_ROWS.length !== 20) {
  throw new Error(
    'Invariant violated: CANONICAL_CONFIRM_ROWS must contain EXACTLY 20 rows (one per candidate_group_id ' +
    'in scope); found ' + CANONICAL_CONFIRM_ROWS.length + '.',
  );
}

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

function findById(records, id) {
  return records.find((r) => r.parameter_value_id === id);
}

function countById(records, id) {
  return records.filter((r) => r.parameter_value_id === id).length;
}

// Fail-closed precondition (runs in BOTH dry-run and --apply, before any mutation): every id this
// tool touches (dispose targets + read-only canonical confirm rows) must appear EXACTLY ONCE in
// the catalog file. `findById` above is an Array.find -- with a duplicated (or missing)
// parameter_value_id it would silently look up/mutate only the FIRST match while the run still
// "succeeds", leaving a duplicate row untouched. Abort with no writes if any id has 0 or >1 matches.
function assertUniqueIds(records, ids, fileLabel) {
  const problems = [];
  for (const id of ids) {
    const count = countById(records, id);
    if (count !== 1) {
      problems.push(id + ': found ' + count + ' matching row(s) in ' + fileLabel + ' (expected exactly 1)');
    }
  }
  if (problems.length > 0) {
    throw new Error(
      'Precondition failed: duplicate-id/missing-id guard tripped in ' + fileLabel + ':\n  ' +
      problems.join('\n  ') +
      '\nRefusing to proceed -- a non-unique parameter_value_id would let the first-match lookup ' +
      'silently mutate only one of several matching rows while reporting success. No writes performed.',
    );
  }
}

// Computes the disposal plan for a single value record and enforces preconditions (fail-closed).
// PRE-STATE: qa_status=needs_review, default_status=available_option, candidate_group_id matches the
// hardcoded table, value matches the hardcoded table, exactly ONE evidence_items entry, that entry
// also qa_status=needs_review. ALREADY-DONE state: the same but qa_status=superseded top-level AND on
// the single evidence item. Anything else aborts (no writes).
function planOneRow(row, records) {
  const record = findById(records, row.id);
  if (!record) {
    throw new Error('Precondition failed: value record not found: ' + row.id);
  }
  if (record.value !== row.value) {
    throw new Error(
      'Precondition failed: ' + row.id + ' value mismatch. expected=' + row.value +
      ' actual=' + JSON.stringify(record.value) + '. Refusing to dispose a drifted record.',
    );
  }
  if (record.candidate_group_id !== row.candidateGroupId) {
    throw new Error(
      'Precondition failed: ' + row.id + ' candidate_group_id mismatch. expected=' + row.candidateGroupId +
      ' actual=' + JSON.stringify(record.candidate_group_id) + '. Refusing to dispose a drifted record.',
    );
  }
  if (record.default_status !== 'available_option') {
    throw new Error(
      'Precondition failed: ' + row.id + ' default_status must be available_option (this tool never ' +
      'touches default_status; a current_default here would mean a calculator default is being ' +
      'disposed, which this tool refuses). actual=' + JSON.stringify(record.default_status),
    );
  }
  if (!Array.isArray(record.evidence_items) || record.evidence_items.length !== 1) {
    throw new Error(
      'Precondition failed: ' + row.id + ' must have EXACTLY one evidence_items entry (actual: ' +
      (Array.isArray(record.evidence_items) ? record.evidence_items.length : 'not an array') + ').',
    );
  }
  const ev = record.evidence_items[0];
  const expectedPre = record.qa_status === 'needs_review' && ev.qa_status === 'needs_review';
  const alreadyDone = record.qa_status === 'superseded' && ev.qa_status === 'superseded';
  if (!expectedPre && !alreadyDone) {
    throw new Error(
      'Precondition failed: ' + row.id +
      ' is not in the expected pre-disposal state nor the already-disposed state.\n' +
      '  expected pre  : qa_status=needs_review, evidence_items[0].qa_status=needs_review\n' +
      '  already-done  : qa_status=superseded, evidence_items[0].qa_status=superseded\n' +
      '  actual        : qa_status=' + record.qa_status +
      ', evidence_items[0].qa_status=' + ev.qa_status + '\n' +
      'Refusing to dispose a drifted/partially-disposed record.',
    );
  }
  return { row, record, alreadyDone, dispose: !alreadyDone };
}

function planOneConfirmRow(confirmRow, hhTrvRecords) {
  const record = findById(hhTrvRecords, confirmRow.id);
  if (!record) {
    throw new Error('Precondition failed: canonical confirm record not found: ' + confirmRow.id);
  }
  const mismatches = [];
  if (record.value !== confirmRow.value) {
    mismatches.push('value: expected ' + confirmRow.value + ', actual ' + JSON.stringify(record.value));
  }
  if (record.candidate_group_id !== confirmRow.candidateGroupId) {
    mismatches.push(
      'candidate_group_id: expected ' + confirmRow.candidateGroupId + ', actual ' +
      JSON.stringify(record.candidate_group_id),
    );
  }
  if (record.qa_status !== 'approved') {
    mismatches.push('qa_status: expected approved, actual ' + JSON.stringify(record.qa_status));
  }
  if (record.canonical_source_status !== 'direct_source_verified') {
    mismatches.push(
      'canonical_source_status: expected direct_source_verified, actual ' +
      JSON.stringify(record.canonical_source_status),
    );
  }
  if (mismatches.length > 0) {
    throw new Error(
      'Precondition failed: canonical confirm row ' + confirmRow.id + ' has drifted from the ' +
      'documented pre-state (this row is NEVER mutated by this tool; it is a sanity check that the ' +
      'group\'s verified canonical sibling this disposal defers to has not itself drifted). ' +
      'Mismatch(es):\n  ' + mismatches.join('\n  ') + '\nRefusing to proceed.',
    );
  }
  return record;
}

// Computes the disposal plan for all 41 rows + the 20 read-only canonical confirm rows. Idempotent
// (records already superseded are SKIPPED).
export function planDisposal(hhTrvRecords, _opts) {
  // Duplicate-id / missing-id guard FIRST, before any lookup or mutation (dry-run and --apply both
  // call this function, so both modes are covered). All 61 ids (41 dispose + 20 confirm-only) must
  // each appear exactly once in this single catalog file.
  const allIds = [
    ...DISPOSAL_ROWS.map((r) => r.id),
    ...CANONICAL_CONFIRM_ROWS.map((r) => r.id),
  ];
  assertUniqueIds(hhTrvRecords, allIds, 'human_health_trv_values.json');

  const confirmResults = CANONICAL_CONFIRM_ROWS.map((r) => planOneConfirmRow(r, hhTrvRecords));
  const rowResults = DISPOSAL_ROWS.map((row) => planOneRow(row, hhTrvRecords));
  return { confirmResults, rowResults };
}

// ---------------------------------------------------------------------------
// Evidence item rebuild (mirrors disposeEvidence in promote-copper-hc0426.mjs)
// ---------------------------------------------------------------------------

const DISPOSAL_STAMP_MARKER = 'SUPERSEDED (disposed)';
const STAMPED_PROVENANCE_FIELDS = ['applicability', 'uncertainty', 'review_notes'];

function buildDisposalStamp(date, reviewer) {
  return ' [' + DISPOSAL_STAMP_MARKER + ' on ' + date + ' by ' + reviewer + '. ' + DISPOSAL_RATIONALE + ']';
}

function disposeEvidence(ev, reviewer, date) {
  const out = {};
  for (const [k, v] of Object.entries(ev)) {
    if (k === 'qa_status') {
      out.qa_status = 'superseded';
      out.reviewed_by = reviewer;
      out.reviewed_at = date;
    } else if (k === 'reviewed_by' || k === 'reviewed_at') {
      continue;
    } else {
      out[k] = v;
    }
  }
  if (!('qa_status' in out)) {
    out.qa_status = 'superseded';
    out.reviewed_by = reviewer;
    out.reviewed_at = date;
  }
  if (typeof out.note === 'string' && out.note.length > 0 && !out.note.includes(DISPOSAL_STAMP_MARKER)) {
    out.note += buildDisposalStamp(date, reviewer);
  }
  return out;
}

function stampRecordProvenance(r, date, reviewer) {
  const stamp = buildDisposalStamp(date, reviewer);
  let changed = false;
  for (const field of STAMPED_PROVENANCE_FIELDS) {
    const v = r[field];
    if (typeof v === 'string' && v.length > 0 && !v.includes(DISPOSAL_STAMP_MARKER)) {
      r[field] = v + stamp;
      changed = true;
    }
  }
  return changed;
}

function stampNeeded(r) {
  return STAMPED_PROVENANCE_FIELDS.some(
    (field) => typeof r[field] === 'string' && r[field].length > 0 && !r[field].includes(DISPOSAL_STAMP_MARKER),
  );
}

// ---------------------------------------------------------------------------
// Apply (in-place mutation of the parsed records; ONLY the 41 target records are touched)
// ---------------------------------------------------------------------------

export function applyDisposal(hhTrvRecords, opts) {
  const plan = planDisposal(hhTrvRecords, opts);

  let anyTouched = false;
  const rowTouchedFlags = [];
  for (const vr of plan.rowResults) {
    let touched = false;
    if (vr.dispose) {
      const r = vr.record;
      r.qa_status = 'superseded';
      // default_status is intentionally NOT modified (stays 'available_option').
      r.evidence_items = r.evidence_items.map((ev) => disposeEvidence(ev, opts.reviewer, opts.date));
      stampRecordProvenance(r, opts.date, opts.reviewer);
      touched = true;
    } else if (vr.alreadyDone) {
      touched = stampRecordProvenance(vr.record, opts.date, opts.reviewer);
    }
    if (touched) anyTouched = true;
    rowTouchedFlags.push(touched);
  }
  plan.rowTouchedFlags = rowTouchedFlags;
  plan.anyTouched = anyTouched;

  return plan;
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

const BANNER = [
  '=============================================================================',
  ' supersede-iris-17-alternates.mjs -- owner-run disposal of 41 unverified IRIS alternate rows',
  '   (Stage 2 decision log S2-2, "IRIS #17"; 8 substances / 20 candidate_group_ids; needs_review -> superseded)',
  '=============================================================================',
  '',
  'WHY: each of the 20 candidate_group_ids in scope already has ONE approved, direct_source_verified',
  '  canonical sibling (from promote-iris-dupe-cg-canonical.mjs or an earlier PFAS promotion). The 41',
  '  rows here are the OTHER needs_review members of those same groups -- unverified robot-extraction',
  '  variants of the SAME EPA IRIS source for the SAME CASRN (IRIS publishes one RfD/RfC per chemical).',
  '  Owner ruling 2026-07-16 (STAGE2_DECISION_LOG_2026_07_16.md S2-2): supersede all 41 uniformly, even',
  '  the 4 rows (RDX direct/food, PFHxA direct/food) that are numerically LOWER than their canonical',
  '  sibling -- those are extraction noise, not independent more-protective values.',
  '',
  'SCOPE: the 41 listed pv-iris-* ids ONLY, in human_health_trv_values.json. default_status is NOT',
  '  changed (stays available_option on all 41 -- none are current_default). The 20 approved canonical',
  '  sibling rows are READ-ONLY sanity-checked, never mutated.',
  '',
  'GUARD-TEST IMPACT: none. catalog.test.ts\'s IRIS mass-promotion tripwire filters on qa_status===',
  '  \'approved\' (these rows move to \'superseded\', never \'approved\'); iris-canonical.test.ts and',
  '  iris-snapshot-magnitude.test.ts match by substance_key/input_key regardless of qa_status; ',
  '  library.test.ts\'s audit counts key on evidence_support_status/default_status, both unchanged here.',
  '  No test edits are required for this disposal.',
  '',
].join('\n');

const HELP = [
  'supersede-iris-17-alternates.mjs -- owner-run disposal of 41 unverified IRIS alternate rows.',
  '',
  'Usage:',
  '  node scripts/matrix-options/supersede-iris-17-alternates.mjs --reviewer "<id>" --date YYYY-MM-DD [--apply]',
  '',
  'Options:',
  '  --reviewer "<id>"   Reviewer attestation -> evidence.reviewed_by (required for --apply)',
  '  --date YYYY-MM-DD   Review date -> evidence.reviewed_at (required for --apply)',
  '  --apply              Write the catalog file if it changed (default is a dry run, writes nothing)',
  '',
  'Targets: 41 VALUE records (needs_review -> superseded) + 20 READ-ONLY canonical confirm rows.',
  '',
  'On --apply, each disposed VALUE record changes:',
  '  qa_status                   needs_review -> superseded',
  '  evidence_items[*].qa_status needs_review -> superseded (+ reviewed_by/at after qa_status)',
  '  default_status               UNCHANGED (stays available_option)',
  '',
  'AI never runs this with --apply. The owner runs it; --reviewer/--date are the HITL attestation.',
  'After --apply: npx tsc --noEmit; npm run lint; npm run test:ci',
].join('\n');

function printPlan(plan) {
  console.log('Canonical sibling confirm rows (read-only sanity check, never mutated):');
  for (const record of plan.confirmResults) {
    console.log('  CONFIRM OK  ' + record.parameter_value_id + ': value=' + record.value +
      ' qa_status=' + record.qa_status + ' canonical_source_status=' + record.canonical_source_status);
  }
  console.log('');
  console.log('Disposal plan (' + plan.rowResults.length + ' rows):');
  for (const vr of plan.rowResults) {
    const id = vr.row.id;
    if (vr.dispose) {
      const r = vr.record;
      console.log('  VALUE   DISPOSE  ' + id + ' (' + vr.row.substanceKey + ')');
      console.log('    qa_status                    : ' + r.qa_status + ' -> superseded');
      console.log('    evidence_items[0].qa_status  : ' + r.evidence_items[0].qa_status + ' -> superseded');
      console.log('    default_status                : ' + r.default_status + ' (UNCHANGED)');
    } else {
      console.log('  VALUE   SKIP     ' + id + ': already superseded (no-op)');
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
  console.log('File    : ' + HH_TRV_FILE);
  console.log('reviewer: ' + (opts.reviewer || '(not set)'));
  console.log('date    : ' + (opts.date || '(not set)'));
  console.log('records : ' + DISPOSAL_ROWS.length + ' VALUE (dispose) + ' + CANONICAL_CONFIRM_ROWS.length + ' (confirm-only)');
  console.log('');

  const hhTrvRecords = JSON.parse(fs.readFileSync(HH_TRV_FILE, 'utf8'));

  const plan = planDisposal(hhTrvRecords, opts);

  console.log('Before/after plan:');
  printPlan(plan);
  console.log('');

  const totalToDispose = plan.rowResults.filter((vr) => vr.dispose).length;
  const totalSkipped = plan.rowResults.filter((vr) => vr.alreadyDone).length;
  console.log('Summary: ' + totalToDispose + ' record(s) to dispose, ' +
    totalSkipped + ' already in target state.');

  const anyStampRepair = plan.rowResults.some(
    (vr) => vr.alreadyDone && stampNeeded(vr.record),
  );
  if (anyStampRepair) {
    console.log('NOTE: one or more already-disposed records are MISSING a disposal display-stamp; ' +
      '--apply will repair it.');
  }

  if (!opts.apply) {
    console.log('');
    console.log('DRY RUN -- no file written. Re-run with --apply (plus --reviewer/--date) to write.');
    return;
  }

  validateApplyOptions(opts);

  if (totalToDispose === 0 && !anyStampRepair) {
    console.log('');
    console.log('Nothing to dispose (all records already in target state). No write.');
    return;
  }

  const applied = applyDisposal(hhTrvRecords, opts);

  if (applied.anyTouched) {
    fs.writeFileSync(HH_TRV_FILE, JSON.stringify(hhTrvRecords, null, 2) + '\n', 'utf8');
    console.log('WROTE ' + HH_TRV_FILE);
  }

  // Postcondition: re-read from disk and assert all 41 target rows are qa_status=superseded, both
  // top-level and on every evidence item. Abort (throw) if not -- this is a hard safety check, not a
  // rollback (the write has already happened; a failure here means the write did not do what was
  // intended and must be investigated immediately).
  const rereadHhTrv = JSON.parse(fs.readFileSync(HH_TRV_FILE, 'utf8'));
  const postconditionFailures = [];
  for (const row of DISPOSAL_ROWS) {
    const record = findById(rereadHhTrv, row.id);
    if (!record) {
      postconditionFailures.push(row.id + ': record disappeared after write');
      continue;
    }
    if (record.qa_status !== 'superseded') {
      postconditionFailures.push(row.id + ': qa_status=' + record.qa_status + ' (expected superseded)');
    }
    for (const ev of record.evidence_items || []) {
      if (ev.qa_status !== 'superseded') {
        postconditionFailures.push(
          row.id + ': evidence_items[' + ev.evidence_id + '].qa_status=' + ev.qa_status +
          ' (expected superseded)',
        );
      }
    }
  }
  if (postconditionFailures.length > 0) {
    throw new Error(
      'POSTCONDITION FAILED after write -- the on-disk state does not match the intended disposal:\n  ' +
      postconditionFailures.join('\n  '),
    );
  }
  console.log('Postcondition verified: all ' + DISPOSAL_ROWS.length +
    ' target rows are qa_status=superseded (top-level and nested evidence_items) on disk.');

  console.log('');
  console.log('No guard-test updates are required for this disposal (see the file-header GUARD-TEST');
  console.log('IMPACT note). Still run the full local gates before pushing:');
  console.log('  npx tsc --noEmit; npm run lint; npm run test:ci;');
  console.log('  npm run build:monitored:clean -- -TimeoutSeconds 360 -PollSeconds 10;');
  console.log('  npm run test:e2e');
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : '';
if (invokedPath === fileURLToPath(import.meta.url)) {
  main();
}
