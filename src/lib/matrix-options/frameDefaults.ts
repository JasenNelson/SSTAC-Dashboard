// frameDefaults.ts
// Frame default-PROFILE seed layer -- the user-ADJUSTABLE per-frame default
// assumption set (owner vision 2026-06-09). This is PHYSICALLY SEPARATE from the
// hard parameterOverrides path in frameVariants.ts / equationDispatch.ts:
//
//   - parameterOverrides (frameVariants.ts): HARD, run-enforced inside
//     getEquation.run(); the user cannot change the value in-frame. For values a
//     frame genuinely MANDATES.
//   - frame default PROFILES (this file): SEED the calculator's user-editable input
//     state. They NEVER run inside getEquation. Selecting a frame brings that frame's
//     default value into the field; the user can still adjust it.
//
// Keeping them separate avoids the provenance LIE a hard IR override would cause
// (run() replaces the value while the input field + provenance panel still show the
// user's typed number). See docs/MATRIX_OPTIONS_PHASE_C_FRAME_VARIANT_DESIGN_2026_06_09.md.
//
// STARTS EMPTY INTENTIONALLY. With FRAME_DEFAULT_PROFILES = [], getFrameDefaults()
// returns [] for every frame and no calculator behavior changes. C0 builds and tests
// this seam; the calculator useEffect seed-wiring and the first real profile row land
// with C-BC (the first frame seed), gated on owner promotion of the cited value.
//
// PROMOTE-FIRST (owner 2026-06-09): a cited catalog record seeds an ACTIVE default
// ONLY if its qa_status === 'approved'. A 'needs_review' record resolves to status
// 'pending' (visible + citable in the UI, but NEVER drives the calculation). This
// preserves the standing guardrails: AI never sets a calculator default and never
// promotes qa_status. A frame default CITES a catalog record (parameter_value_id +
// candidate_group_id); it never hardcodes a value.
//
// Plain ASCII only.

import type { RegulatoryFrameId } from './regulatoryFrames';
import { getPathwayApplicability } from './regulatoryFrames';
import type { ProvenancePathway } from './provenance/types';
import type { ParameterValueRecord, SourceRecord } from './provenance/types';
import { PARAMETER_VALUE_RECORDS, SOURCE_RECORDS } from './provenance/catalog';
import { getFrameSeedCandidateEligibility } from './defaultSelectionPolicy';

// ---------------------------------------------------------------------------
// Seedable-key allowlist (owner 2026-06-09).
//
// The seed layer MAY set user-adjustable receptor / exposure assumptions. It MUST
// NOT seed site-MEASURED inputs (e.g. foc, fLipid) -- those are per-assessment and
// stay user-entered unless the owner explicitly approves seeding them. A pathway
// with [] has no seedable keys yet (add when that pathway gets a profile).
// ---------------------------------------------------------------------------
export const SEEDABLE_KEYS: Record<ProvenancePathway, readonly string[]> = {
  'eco-direct-eqp': [],
  'eco-food-bsaf': [],
  // Owner-approved for HH-direct (2026-06-12): the HC PQRA v4.0 receptor exposure
  // factors. abs_dermal / ba_oral are substance-specific and stay user-entered;
  // targetRisk / hazardQuotient are policy constants, not receptor assumptions.
  'human-health-direct': [
    'BW_kg',
    'IR_sed_mg_per_day',
    'EF_days_per_year',
    'ED_years',
    'AT_cancer_years',
    'SA_cm2',
    'AF_sed_mg_per_cm2',
  ],
  // Owner-approved for HH-food: fish ingestion rate + body weight (receptor
  // assumptions). foc / fLipid are site-measured and intentionally excluded.
  'human-health-food': ['IR_food_kg_per_day', 'BW_kg'],
  'background-adjustment': [],
};

// ---------------------------------------------------------------------------
// Canonical unit per seedable input key. A cited record MUST store its value in
// this exact unit -- the resolver does NOT convert. A record in a different unit
// (e.g. 111 g/day for IR_food_kg_per_day) is rejected (status 'invalid'), never
// silently seeded at 1000x error. (Consistent with the Phase B catalog decision to
// store IR in kg/day; unit normalization for exposure units is a separate, owner-
// gated change.) A seedable key with no entry here skips the unit check.
// ---------------------------------------------------------------------------
export const SEEDABLE_KEY_UNITS: Record<string, string> = {
  IR_food_kg_per_day: 'kg/day',
  BW_kg: 'kg',
  // HC PQRA v4.0 direct-contact receptor factors (units are input-key-scoped, not
  // pathway-scoped; BW_kg above is shared with HH-food).
  IR_sed_mg_per_day: 'mg/day',
  EF_days_per_year: 'days/year',
  ED_years: 'years',
  AT_cancer_years: 'years',
  SA_cm2: 'cm2',
  AF_sed_mg_per_cm2: 'mg/cm2',
};

// ---------------------------------------------------------------------------
// FrameDefaultSeed: one cited default within a profile.
// ---------------------------------------------------------------------------
export interface FrameDefaultSeed {
  /** Calculator input key this default seeds. Must be in SEEDABLE_KEYS[pathway]. */
  readonly inputKey: string;
  /** The catalog parameter_value_id this default CITES (the active candidate). */
  readonly parameterValueId: string;
  /** The candidate_group_id (slot) the cited record belongs to (the alternatives). */
  readonly candidateGroupId: string;
  /**
   * Optional per-seed source descriptor that OVERRIDES the profile row's label for
   * THIS input's calculator hint. Use when one input has a different provenance nuance
   * than the row label -- e.g. an adult body weight is the GENERAL adult value (Table 1),
   * not the row's "recreational" receptor, so it must not render "recreational". Falls
   * back to the row label when omitted (validateFrameDefaultProfiles rejects an empty string).
   */
  readonly label?: string;
}

// ---------------------------------------------------------------------------
// FrameDefaultProfileRow: one entry in the FRAME_DEFAULT_PROFILES table.
// One row per (frameId, pathway, receptorScenarioId) -- a (frameId, pathway) may
// carry MULTIPLE rows when it offers more than one receptor scenario (e.g. the
// HC PQRA direct-contact frame offers residential toddler + residential adult),
// distinguished by receptorScenarioId; a single-scenario (frameId, pathway) omits
// the scenario fields. Authored only from owner-provided content (verified
// catalog_sources + promoted catalog records). Tier 2 curated content, same as
// FRAME_VARIANTS.
// ---------------------------------------------------------------------------
export interface FrameDefaultProfileRow {
  readonly frameId: RegulatoryFrameId;
  readonly pathway: ProvenancePathway;
  /**
   * Optional stable id for a named RECEPTOR SCENARIO within a (frameId, pathway)
   * -- e.g. 'residential-toddler', 'residential-adult'. Omitted on a sole/legacy
   * profile (the single-scenario case). When a (frameId, pathway) has more than one
   * profile, EVERY row must carry a distinct non-empty receptorScenarioId (enforced
   * by validateFrameDefaultProfiles).
   */
  readonly receptorScenarioId?: string;
  /**
   * Short plain-ASCII label for the receptor-scenario selector (e.g. 'Residential
   * adult'). Required + non-empty when receptorScenarioId is present.
   */
  readonly scenarioLabel?: string;
  /**
   * Marks the profile selected when no scenarioId is requested. Required to be set on
   * EXACTLY ONE profile when a (frameId, pathway) has more than one profile; ignored
   * (optional) for a single-profile (frameId, pathway).
   */
  readonly isDefaultScenario?: boolean;
  /** Brief plain-ASCII note for UI surfacing. No markdown. */
  readonly note: string;
  /**
   * Short plain-ASCII source descriptor rendered in the calculator's frame-default
   * label, e.g. "BC WLRS 2023, recreational". A pure function of the profile (NOT
   * derived from the cited record), so each frame shows its OWN provenance label --
   * a US EPA default must not render "BC WLRS 2023". Non-empty required
   * (validateFrameDefaultProfiles enforces it).
   */
  readonly label: string;
  /**
   * The cited catalog source(s). Use the in-repo catalog_sources `source_id`
   * (resolvable via getSourceRecord) -- or a Stream D Supabase UUID once one
   * exists. Non-empty required, every id must resolve to a real source, and
   * the set must be a subset of the cited record's own source_ids
   * (validateFrameDefaultProfiles enforces all three).
   */
  readonly sourceIds: readonly string[];
  /** The cited per-input defaults for this frame + pathway. Non-empty required. */
  readonly defaults: readonly FrameDefaultSeed[];
}

// ---------------------------------------------------------------------------
// FRAME_DEFAULT_PROFILES: the canonical seed table.
// Tier 2 protected (see CLAUDE.md) now that it has a real entry.
// C-BC: BC Protocol 1 v5 DRA HH-food seeds IR_food from the owner-PROMOTED
// (PR #285, HITL) BC WLRS 2023 recreational fish-ingestion rate.
// C-nonBC: us-epa-usace-sediment HH-food seeds IR_food from the owner-PROMOTED
// (HITL) US EPA 2000 AWQC general-population fish-ingestion rate -- the cross-frame
// smoke test (a non-BC frame, a different receptor: general adult vs BC recreational).
// ---------------------------------------------------------------------------
export const FRAME_DEFAULT_PROFILES: readonly FrameDefaultProfileRow[] = [
  {
    frameId: 'bc-protocol1-v5-dra',
    pathway: 'human-health-food',
    note:
      'BC WLRS 2023: recreational fish-ingestion rate (0.111 kg/day, Table 2) + adult ' +
      'body weight (70.7 kg, Table 1). Owner-promoted, user-adjustable seeds for the BC ' +
      'Protocol 1 frame.',
    label: 'BC WLRS 2023, recreational',
    // In-repo catalog_sources source_id (resolves via getSourceRecord; subset of BOTH
    // cited records' source_ids). No Supabase UUID exists for this source yet.
    sourceIds: ['src-bc-wlrs-fish-tissue-screening-2023'],
    defaults: [
      {
        inputKey: 'IR_food_kg_per_day',
        parameterValueId: 'pv-wlrs-2023-ir-food-recreational-bc',
        candidateGroupId: 'human-health-food__generic__IR_food_kg_per_day__BC',
      },
      {
        inputKey: 'BW_kg',
        parameterValueId: 'pv-wlrs-2023-bw-adult-bc',
        candidateGroupId: 'human-health-food__generic__BW_kg__BC',
        // Per-seed label override: the body weight is the GENERAL adult value (Table 1,
        // 70.7 kg), shared across all fisher receptors -- so it must not render the row's
        // "recreational" descriptor, which is specific to the fish-ingestion rate.
        label: 'BC WLRS 2023, adult 70.7 kg (Table 1)',
      },
    ],
  },
  {
    frameId: 'us-epa-usace-sediment',
    pathway: 'human-health-food',
    note:
      'US EPA 2000 AWQC general adult population, from one methodology (EPA-822-B-00-004): ' +
      'fish-ingestion rate 0.0175 kg/day (17.5 g/day) + adult body weight 70 kg. ' +
      'Owner-promoted, user-adjustable seeds for the US EPA frame. NOTE: a general-population ' +
      'receptor (vs the BC frame recreational receptor) -- a deliberate cross-frame delta.',
    label: 'US EPA 2000 AWQC, general adult population',
    // In-repo catalog_sources source_id (resolves via getSourceRecord; subset of BOTH
    // cited records' source_ids). us-epa-usace-sediment lists US_federal in
    // eligibleCatalogJurisdictions, so the seeds resolve 'active' once promoted.
    sourceIds: ['src-epa-2000-awqc-human-health'],
    defaults: [
      {
        inputKey: 'IR_food_kg_per_day',
        parameterValueId: 'pv-epa-2000-ir-food-general-us',
        candidateGroupId: 'human-health-food__generic__IR_food_kg_per_day__US_federal',
      },
      {
        inputKey: 'BW_kg',
        parameterValueId: 'pv-epa-2000-bw-adult-us',
        candidateGroupId: 'human-health-food__generic__BW_kg__US_federal',
        // No per-seed label override: the row label "US EPA 2000 AWQC, general adult
        // population" is already correct for the 70 kg general-adult body weight (unlike
        // the BC row, where the "recreational" label needed a BW override).
      },
    ],
  },
  {
    // C-HH-direct (2026-06-12): the Canada FCSAP frame seeds the HH direct-contact
    // calculator with the HC PQRA v4.0 (2024) RESIDENTIAL TODDLER receptor (the
    // critical receptor for incidental soil/sediment ingestion + dermal contact).
    // PQRA is FCSAP guidance, so the federal Canada FCSAP frame is its native home.
    // Owner-promoted (inline-approved 2026-06-12) via promote-hc-pqra-direct.mjs;
    // user-adjustable seeds. Until promotion they resolve 'pending' and never drive
    // the calculation (promote-first guardrail).
    frameId: 'canada-fcsap-aquatic',
    pathway: 'human-health-direct',
    receptorScenarioId: 'residential-toddler',
    scenarioLabel: 'Residential toddler',
    isDefaultScenario: true,
    note:
      'HC PQRA v4.0 (2024) residential toddler receptor: BW 16.5 kg, IR_sed 80 mg/day, ' +
      'EF 364 days/yr, ED 80 yr, AT_cancer 80 yr, SA(total body) 6130 cm2, AF 0.01 mg/cm2.',
    label: 'HC PQRA v4.0 2024, residential toddler',
    sourceIds: ['src-health-canada-pqra-v4-2024'],
    defaults: [
      {
        inputKey: 'BW_kg',
        parameterValueId: 'pv-hc-pqra-v4-2024-bw-toddler-ca',
        candidateGroupId: 'human-health-direct__generic__BW_kg__general',
        label: 'HC PQRA v4.0 2024, residential toddler (16.5 kg, Appendix E)',
      },
      {
        inputKey: 'IR_sed_mg_per_day',
        parameterValueId: 'pv-hc-pqra-v4-2024-ir-sed-toddler-ca',
        candidateGroupId: 'human-health-direct__generic__IR_sed_mg_per_day__general',
        label: 'HC PQRA v4.0 2024, toddler incidental ingestion (80 mg/day)',
      },
      {
        inputKey: 'EF_days_per_year',
        parameterValueId: 'pv-hc-pqra-v4-2024-ef-residential-ca',
        candidateGroupId: 'human-health-direct__generic__EF_days_per_year__general',
        label: 'HC PQRA v4.0 2024, residential exposure frequency (364 days/yr)',
      },
      {
        inputKey: 'ED_years',
        parameterValueId: 'pv-hc-pqra-v4-2024-ed-residential-ca',
        candidateGroupId: 'human-health-direct__generic__ED_years__general',
        label: 'HC PQRA v4.0 2024, residential exposure duration (80 yr)',
      },
      {
        inputKey: 'AT_cancer_years',
        parameterValueId: 'pv-hc-pqra-v4-2024-at-cancer-lifetime-ca',
        candidateGroupId: 'human-health-direct__generic__AT_cancer_years__general',
        label: 'HC PQRA v4.0 2024, lifetime cancer averaging time (80 yr)',
      },
      {
        inputKey: 'SA_cm2',
        parameterValueId: 'pv-hc-pqra-v4-2024-sa-total-toddler-ca',
        candidateGroupId: 'human-health-direct__generic__SA_cm2__general',
        label: 'HC PQRA v4.0 2024, toddler total-body skin surface area (6130 cm2)',
      },
      {
        inputKey: 'AF_sed_mg_per_cm2',
        parameterValueId: 'pv-hc-pqra-v4-2024-af-sed-other-general-ca',
        candidateGroupId: 'human-health-direct__generic__AF_sed_mg_per_cm2__general',
        label: 'HC PQRA v4.0 2024, non-hand soil loading (0.01 mg/cm2)',
      },
    ],
  },
  {
    // C-HH-direct 2nd scenario (2026-06-12): the Canada FCSAP frame also offers the
    // HC PQRA v4.0 (2024) RESIDENTIAL ADULT receptor. It differs from the toddler
    // scenario only in the three receptor-specific seeds (BW, IR_sed, SA); the
    // residential EF/ED/AT and the non-hand AF are receptor-independent and reuse the
    // SAME already-approved records the toddler scenario cites. Owner-promoted (inline-
    // approved) the 3 adult-specific records; until promotion they resolve 'pending' and
    // this scenario is NOT selectable (scenario-completeness gate -> no hybrid calc).
    frameId: 'canada-fcsap-aquatic',
    pathway: 'human-health-direct',
    receptorScenarioId: 'residential-adult',
    scenarioLabel: 'Residential adult',
    note:
      'HC PQRA v4.0 (2024) residential adult receptor: BW 70.7 kg, IR_sed 20 mg/day, ' +
      'EF 364 days/yr, ED 80 yr, AT_cancer 80 yr, SA(total body) 17640 cm2, AF 0.01 mg/cm2.',
    label: 'HC PQRA v4.0 2024, residential adult',
    sourceIds: ['src-health-canada-pqra-v4-2024'],
    defaults: [
      {
        inputKey: 'BW_kg',
        parameterValueId: 'pv-hc-pqra-v4-2024-bw-adult-ca',
        candidateGroupId: 'human-health-direct__generic__BW_kg__general',
        label: 'HC PQRA v4.0 2024, residential adult (70.7 kg, Table 1)',
      },
      {
        inputKey: 'IR_sed_mg_per_day',
        parameterValueId: 'pv-hc-pqra-v4-2024-ir-sed-general-ca',
        candidateGroupId: 'human-health-direct__generic__IR_sed_mg_per_day__general',
        label: 'HC PQRA v4.0 2024, general-population incidental ingestion (20 mg/day)',
      },
      {
        inputKey: 'EF_days_per_year',
        parameterValueId: 'pv-hc-pqra-v4-2024-ef-residential-ca',
        candidateGroupId: 'human-health-direct__generic__EF_days_per_year__general',
        label: 'HC PQRA v4.0 2024, residential exposure frequency (364 days/yr)',
      },
      {
        inputKey: 'ED_years',
        parameterValueId: 'pv-hc-pqra-v4-2024-ed-residential-ca',
        candidateGroupId: 'human-health-direct__generic__ED_years__general',
        label: 'HC PQRA v4.0 2024, residential exposure duration (80 yr)',
      },
      {
        inputKey: 'AT_cancer_years',
        parameterValueId: 'pv-hc-pqra-v4-2024-at-cancer-lifetime-ca',
        candidateGroupId: 'human-health-direct__generic__AT_cancer_years__general',
        label: 'HC PQRA v4.0 2024, lifetime cancer averaging time (80 yr)',
      },
      {
        inputKey: 'SA_cm2',
        parameterValueId: 'pv-hc-pqra-v4-2024-sa-total-adult-ca',
        candidateGroupId: 'human-health-direct__generic__SA_cm2__general',
        label: 'HC PQRA v4.0 2024, adult total-body skin surface area (17640 cm2)',
      },
      {
        inputKey: 'AF_sed_mg_per_cm2',
        parameterValueId: 'pv-hc-pqra-v4-2024-af-sed-other-general-ca',
        candidateGroupId: 'human-health-direct__generic__AF_sed_mg_per_cm2__general',
        label: 'HC PQRA v4.0 2024, non-hand soil loading (0.01 mg/cm2)',
      },
    ],
  },
  {
    // C-HH-direct 3rd scenario (2026-06-13): the Canada FCSAP frame also offers the HC PQRA v4.0
    // (2024) COMMERCIAL/INDUSTRIAL WORKER receptor. Differs from the residential scenarios in five
    // seeds: IR_sed (100 mg/day, Appendix E worker col; MassDEP 2002), EF (240 days/yr, Table 2:
    // 5 d/wk x 48 wk/yr), ED (35 yr, Table 2 commercial/industrial), SA (16640 cm2 total body --
    // OWNER-ATTESTED correction of the Appendix E '1 640' typesetting error; see the SA record note),
    // and AF (0.1 mg/cm2, surfaces other than hands; Kissel). BW (70.7 kg, shared with the adult) and
    // AT_cancer (80 yr) reuse the SAME already-approved records the adult scenario cites. Owner-promoted
    // (inline-attested 2026-06-13) the 5 worker-specific records via promote-hc-pqra-worker.mjs; until
    // promotion they resolve 'pending' and this scenario is NOT selectable (completeness gate -> no
    // hybrid calc).
    frameId: 'canada-fcsap-aquatic',
    pathway: 'human-health-direct',
    receptorScenarioId: 'commercial-industrial-worker',
    scenarioLabel: 'Commercial/industrial worker',
    note:
      'HC PQRA v4.0 (2024) commercial/industrial worker receptor: BW 70.7 kg, IR_sed 100 mg/day, ' +
      'EF 240 days/yr, ED 35 yr, AT_cancer 80 yr, SA(total body) 16640 cm2, AF 0.1 mg/cm2.',
    label: 'HC PQRA v4.0 2024, commercial/industrial worker',
    sourceIds: ['src-health-canada-pqra-v4-2024'],
    defaults: [
      {
        inputKey: 'BW_kg',
        parameterValueId: 'pv-hc-pqra-v4-2024-bw-adult-ca',
        candidateGroupId: 'human-health-direct__generic__BW_kg__general',
        // Body weight is the GENERAL adult value (Appendix E, 70.7 kg), shared by the adult and the
        // construction/utility worker -- so it carries the adult/worker descriptor, not "worker only".
        label: 'HC PQRA v4.0 2024, adult/worker body weight (70.7 kg, Appendix E)',
      },
      {
        inputKey: 'IR_sed_mg_per_day',
        parameterValueId: 'pv-hc-pqra-v4-2024-ir-sed-worker-ca',
        candidateGroupId: 'human-health-direct__generic__IR_sed_mg_per_day__general',
        label: 'HC PQRA v4.0 2024, worker incidental ingestion (100 mg/day)',
      },
      {
        inputKey: 'EF_days_per_year',
        parameterValueId: 'pv-hc-pqra-v4-2024-ef-commercial-ca',
        candidateGroupId: 'human-health-direct__generic__EF_days_per_year__general',
        label: 'HC PQRA v4.0 2024, commercial/industrial exposure frequency (240 days/yr)',
      },
      {
        inputKey: 'ED_years',
        parameterValueId: 'pv-hc-pqra-v4-2024-ed-commercial-ca',
        candidateGroupId: 'human-health-direct__generic__ED_years__general',
        label: 'HC PQRA v4.0 2024, commercial/industrial exposure duration (35 yr)',
      },
      {
        inputKey: 'AT_cancer_years',
        parameterValueId: 'pv-hc-pqra-v4-2024-at-cancer-lifetime-ca',
        candidateGroupId: 'human-health-direct__generic__AT_cancer_years__general',
        label: 'HC PQRA v4.0 2024, lifetime cancer averaging time (80 yr)',
      },
      {
        inputKey: 'SA_cm2',
        parameterValueId: 'pv-hc-pqra-v4-2024-sa-total-worker-ca',
        candidateGroupId: 'human-health-direct__generic__SA_cm2__general',
        label: 'HC PQRA v4.0 2024, worker total-body skin surface area (16640 cm2)',
      },
      {
        inputKey: 'AF_sed_mg_per_cm2',
        parameterValueId: 'pv-hc-pqra-v4-2024-af-sed-other-worker-ca',
        candidateGroupId: 'human-health-direct__generic__AF_sed_mg_per_cm2__general',
        label: 'HC PQRA v4.0 2024, worker non-hand soil loading (0.1 mg/cm2)',
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// Resolution.
// ---------------------------------------------------------------------------

/**
 * Resolution status of a cited frame default:
 *  - 'active'     : cited record found, valid, qa_status approved, AND default-
 *                   eligible (source-backed + source-verified + not excluded +
 *                   jurisdiction eligible for the frame) -> SEEDS the input.
 *  - 'pending'    : cited record found + valid but qa_status needs_review -> visible,
 *                   citable, NEVER seeds (promote-first guardrail).
 *  - 'blocked'    : cited record approved + valid but NOT default-eligible (e.g.
 *                   default_status=not_default, evidence not approved_source_backed,
 *                   canonical not direct_source_verified, or jurisdiction not eligible
 *                   for the frame) -> visible, NEVER seeds. Mirrors the
 *                   defaultSelectionPolicy candidate gates so an approved-but-blocked
 *                   record cannot become calculation-driving.
 *  - 'superseded' : cited record found but qa_status superseded -> never seeds.
 *  - 'unresolved' : parameter_value_id not found in the catalog.
 *  - 'invalid'    : found but a contract field mismatches (pathway / input_key /
 *                   candidate_group_id / non-generic substance / unit / non-seedable
 *                   key / non-numeric value).
 */
export type FrameDefaultStatus =
  | 'active'
  | 'pending'
  | 'blocked'
  | 'superseded'
  | 'unresolved'
  | 'invalid';

export interface ResolvedFrameDefault {
  readonly inputKey: string;
  readonly parameterValueId: string;
  readonly candidateGroupId: string;
  /** Per-frame source descriptor (the profile row's label), for the calculator UI. */
  readonly label: string;
  readonly status: FrameDefaultStatus;
  /** Numeric seed value when status is 'active' or 'pending'; null otherwise. */
  readonly value: number | null;
  readonly unit: string | null;
  readonly qaStatus: ParameterValueRecord['qa_status'] | null;
  /** Human-readable explanation (esp. for non-active statuses). */
  readonly reason: string;
}

interface ResolveOptions {
  readonly profiles?: readonly FrameDefaultProfileRow[];
  readonly records?: readonly ParameterValueRecord[];
  /**
   * Optional receptor-scenario selector. When provided, resolve the profile whose
   * receptorScenarioId matches (no match -> []). When omitted, resolve the DEFAULT
   * profile for the (frameId, pathway): the sole row if there is one, else the row
   * flagged isDefaultScenario. Existing callers that omit it keep their behavior.
   */
  readonly scenarioId?: string;
}

function resolveSeed(
  frameId: RegulatoryFrameId,
  seed: FrameDefaultSeed,
  pathway: ProvenancePathway,
  seedableKeys: readonly string[],
  records: readonly ParameterValueRecord[],
  label: string,
): ResolvedFrameDefault {
  const base = {
    inputKey: seed.inputKey,
    parameterValueId: seed.parameterValueId,
    candidateGroupId: seed.candidateGroupId,
    // The label defaults to the per-profile-row descriptor, but a seed MAY override it
    // (seed.label) when one input's provenance differs from the row -- threaded through so
    // every resolved status carries the correct per-frame, per-input source descriptor.
    label: seed.label ?? label,
  };
  if (!seedableKeys.includes(seed.inputKey)) {
    return {
      ...base,
      status: 'invalid',
      value: null,
      unit: null,
      qaStatus: null,
      reason: 'input_key "' + seed.inputKey + '" is not seedable for pathway "' + pathway + '"',
    };
  }
  const record = records.find((r) => r.parameter_value_id === seed.parameterValueId);
  if (!record) {
    return {
      ...base,
      status: 'unresolved',
      value: null,
      unit: null,
      qaStatus: null,
      reason: 'parameter_value_id "' + seed.parameterValueId + '" not found in catalog',
    };
  }
  const mismatches: string[] = [];
  if (record.pathway !== pathway) mismatches.push('pathway (record=' + record.pathway + ')');
  if (record.input_key !== seed.inputKey) mismatches.push('input_key (record=' + record.input_key + ')');
  if (record.candidate_group_id !== seed.candidateGroupId) {
    mismatches.push('candidate_group_id (record=' + record.candidate_group_id + ')');
  }
  // Exposure factors are substance-INDEPENDENT (substance_key=generic). A frame
  // default must not silently cite a substance-specific TRV as a global default.
  if (record.substance_key !== 'generic') {
    mismatches.push('substance_key (record=' + record.substance_key + ', expected generic)');
  }
  if (typeof record.value !== 'number' || !Number.isFinite(record.value)) {
    mismatches.push('value (non-numeric: ' + String(record.value) + ')');
  }
  // Unit must match the canonical seed unit exactly (no conversion); a record in a
  // different unit would seed a scale-wrong value.
  const expectedUnit = SEEDABLE_KEY_UNITS[seed.inputKey];
  if (expectedUnit !== undefined && record.unit !== expectedUnit) {
    mismatches.push('unit (record=' + record.unit + ', expected ' + expectedUnit + ')');
  }
  if (mismatches.length > 0) {
    return {
      ...base,
      status: 'invalid',
      value: null,
      unit: record.unit ?? null,
      qaStatus: record.qa_status,
      reason: 'cited record mismatch: ' + mismatches.join(', '),
    };
  }
  const numericValue = record.value as number;
  if (record.qa_status === 'approved') {
    // Reuse the canonical default-candidate gate (no drift). Seeds only when the
    // record is fully default-eligible ('eligible_pending_approval'); an approved
    // record blocked for any policy reason (source role, value_type, jurisdiction,
    // unverified source, missing QA/direct-current source) -> status 'blocked'.
    const eligibility = getFrameSeedCandidateEligibility(frameId, pathway, record);
    if (!eligibility.eligible) {
      return {
        ...base,
        status: 'blocked',
        value: null,
        unit: record.unit,
        qaStatus: record.qa_status,
        reason: 'approved but not default-eligible (' + eligibility.disposition + '): ' + eligibility.rationale,
      };
    }
    return {
      ...base,
      status: 'active',
      value: numericValue,
      unit: record.unit,
      qaStatus: record.qa_status,
      reason: 'approved + default-eligible catalog default; seeds the input',
    };
  }
  if (record.qa_status === 'superseded') {
    return {
      ...base,
      status: 'superseded',
      value: null,
      unit: record.unit,
      qaStatus: record.qa_status,
      reason: 'cited record is superseded; does not seed',
    };
  }
  // needs_review -> pending (visible/citable; never seeds until owner promotes).
  return {
    ...base,
    status: 'pending',
    value: numericValue,
    unit: record.unit,
    qaStatus: record.qa_status,
    reason: 'cited record is needs_review (pending promotion); does not seed',
  };
}

/**
 * Resolve a frame's default seeds for a pathway. Returns [] when the frame/pathway
 * is unsupported, has no profile row, or (default) FRAME_DEFAULT_PROFILES is empty.
 *
 * opts.profiles / opts.records are test seams (default to the live table/catalog).
 *
 * Callers that SEED an input should use only entries with status 'active'. Entries
 * with status 'pending' may be SHOWN ("frame default, pending source verification")
 * but must not drive the calculation.
 */
export function getFrameDefaults(
  frameId: RegulatoryFrameId,
  pathway: ProvenancePathway,
  opts: ResolveOptions = {},
): readonly ResolvedFrameDefault[] {
  const profiles = opts.profiles ?? FRAME_DEFAULT_PROFILES;
  const records = opts.records ?? PARAMETER_VALUE_RECORDS;
  // A frame that does not support the pathway never seeds it.
  if (getPathwayApplicability(frameId, pathway).status === 'unsupported') return [];
  const candidates = profiles.filter((p) => p.frameId === frameId && p.pathway === pathway);
  const row = selectFrameProfile(candidates, opts.scenarioId);
  if (!row) return [];
  const seedableKeys = SEEDABLE_KEYS[pathway] ?? [];
  return row.defaults.map((seed) => resolveSeed(frameId, seed, pathway, seedableKeys, records, row.label));
}

/**
 * Pick the profile for a (frameId, pathway) candidate set given an optional scenarioId.
 *  - scenarioId provided -> the profile with that receptorScenarioId (or undefined).
 *  - omitted -> the sole profile if there is one, else the isDefaultScenario profile.
 * Returns undefined when nothing matches (caller -> []).
 */
function selectFrameProfile(
  candidates: readonly FrameDefaultProfileRow[],
  scenarioId?: string,
): FrameDefaultProfileRow | undefined {
  if (candidates.length === 0) return undefined;
  if (scenarioId !== undefined) {
    return candidates.find((p) => p.receptorScenarioId === scenarioId);
  }
  if (candidates.length === 1) return candidates[0];
  return candidates.find((p) => p.isDefaultScenario === true);
}

/** Convenience: only the entries that actually seed (status 'active'). */
export function getActiveFrameDefaults(
  frameId: RegulatoryFrameId,
  pathway: ProvenancePathway,
  opts: ResolveOptions = {},
): readonly ResolvedFrameDefault[] {
  return getFrameDefaults(frameId, pathway, opts).filter((d) => d.status === 'active');
}

// ---------------------------------------------------------------------------
// Receptor-scenario discovery (for the calculator's scenario selector).
// ---------------------------------------------------------------------------

/** One named receptor scenario available for a (frameId, pathway). */
export interface FrameScenarioOption {
  readonly scenarioId: string;
  readonly scenarioLabel: string;
  readonly isDefault: boolean;
}

/**
 * ALL named receptor scenarios for a (frameId, pathway) -- i.e. every profile that
 * carries a receptorScenarioId (a sole/legacy scenario-less profile is not a "named
 * scenario" and is excluded). Order follows FRAME_DEFAULT_PROFILES. For introspection;
 * the UI should use getSelectableFrameScenarios so an INCOMPLETE scenario is never offered.
 */
export function getFrameScenarios(
  frameId: RegulatoryFrameId,
  pathway: ProvenancePathway,
  opts: ResolveOptions = {},
): readonly FrameScenarioOption[] {
  const profiles = opts.profiles ?? FRAME_DEFAULT_PROFILES;
  if (getPathwayApplicability(frameId, pathway).status === 'unsupported') return [];
  return profiles
    .filter((p) => p.frameId === frameId && p.pathway === pathway && p.receptorScenarioId !== undefined)
    .map((p) => ({
      scenarioId: p.receptorScenarioId as string,
      scenarioLabel: p.scenarioLabel ?? (p.receptorScenarioId as string),
      isDefault: p.isDefaultScenario === true,
    }));
}

/**
 * Named scenarios whose EVERY seed currently resolves to status 'active'. A scenario
 * with any pending/blocked/invalid seed is EXCLUDED so it can never be selected and
 * drive a HYBRID calculation (some seeds source-backed, some falling back to baseline).
 * This is the scenario-completeness gate: an incomplete scenario (e.g. before its
 * receptor-specific records are promoted, or if a seed is later superseded) is unreachable.
 */
export function getSelectableFrameScenarios(
  frameId: RegulatoryFrameId,
  pathway: ProvenancePathway,
  opts: ResolveOptions = {},
): readonly FrameScenarioOption[] {
  return getFrameScenarios(frameId, pathway, opts).filter((s) => {
    const resolved = getFrameDefaults(frameId, pathway, { ...opts, scenarioId: s.scenarioId });
    return resolved.length > 0 && resolved.every((d) => d.status === 'active');
  });
}

/**
 * The scenarioId a calculator should select by default for a (frameId, pathway): the
 * flagged default scenario when it is SELECTABLE (complete), else the first selectable
 * scenario, else undefined (no selectable named scenario -> the calculator falls back to
 * the sole/legacy profile via getActiveFrameDefaults with no scenarioId, or to baselines).
 */
export function getDefaultSelectableScenarioId(
  frameId: RegulatoryFrameId,
  pathway: ProvenancePathway,
  opts: ResolveOptions = {},
): string | undefined {
  const selectable = getSelectableFrameScenarios(frameId, pathway, opts);
  if (selectable.length === 0) return undefined;
  return (selectable.find((s) => s.isDefault) ?? selectable[0]).scenarioId;
}

/**
 * Calculator-facing active-default resolver that FAILS CLOSED for named-scenario frames.
 * Returns the active defaults for `scenarioId`. If `scenarioId` is undefined AND the frame has
 * NAMED receptor scenarios, "no scenario" is NOT a legacy sole-profile case -- it means no
 * scenario is selected/selectable -- so this returns [] rather than falling back to an incomplete
 * named default profile (which would seed only its active subset and baseline the rest = a HYBRID
 * calculation the completeness gate exists to prevent). A frame with NO named scenarios keeps the
 * legacy behavior (undefined -> the sole/default profile). Use THIS (not getActiveFrameDefaults)
 * wherever a scenario-aware calculator seeds inputs.
 */
export function getActiveScenarioFrameDefaults(
  frameId: RegulatoryFrameId,
  pathway: ProvenancePathway,
  scenarioId: string | undefined,
  opts: ResolveOptions = {},
): readonly ResolvedFrameDefault[] {
  if (scenarioId === undefined && getFrameScenarios(frameId, pathway, opts).length > 0) {
    return [];
  }
  return getActiveFrameDefaults(frameId, pathway, { ...opts, scenarioId });
}

// ---------------------------------------------------------------------------
// Receptor-scenario PROVIDER frame (frame-independent receptor selection).
//
// A receptor's exposure factors (body weight, ingestion rate, skin area, ...) are a property of the
// RECEPTOR (age / land-use), not of the regulatory FRAME -- a toddler is 16.5 kg whether the policy
// frame is BC, FCSAP, or US EPA. The frame governs the EQUATION + policy; the receptor governs the
// exposure factors. So for pathways whose receptor scenarios live under a single source-of-record
// frame, the calculator resolves the scenario selector + seeds from that PROVIDER frame regardless of
// the selected regulatory frame. human-health-direct receptors come from HC PQRA v4.0, stored under
// canada-fcsap-aquatic. (Resolving under the provider is also REQUIRED for eligibility: the HC PQRA
// records are jurisdiction 'general', eligible under canada-fcsap-aquatic; resolving them under a frame
// that does not list 'general' could block them.)
// ---------------------------------------------------------------------------
const RECEPTOR_SCENARIO_PROVIDER_FRAME: Partial<Record<ProvenancePathway, RegulatoryFrameId>> = {
  'human-health-direct': 'canada-fcsap-aquatic',
};

/**
 * The frame to resolve receptor scenarios + their seeds from for a (selected frame, pathway):
 *  - the SELECTED frame, if it defines its own named scenarios for the pathway (a frame with its own
 *    receptor profiles takes precedence); else
 *  - the pathway's fixed receptor-PROVIDER frame (so the selector + seeds are frame-INDEPENDENT); else
 *  - the selected frame (pathways with no provider keep frame-scoped behavior).
 * Use this (not the raw selected frame) wherever a scenario-aware calculator resolves receptor seeds.
 */
export function getReceptorScenarioFrame(
  frameId: RegulatoryFrameId,
  pathway: ProvenancePathway,
  opts: ResolveOptions = {},
): RegulatoryFrameId {
  if (getFrameScenarios(frameId, pathway, opts).length > 0) return frameId;
  return RECEPTOR_SCENARIO_PROVIDER_FRAME[pathway] ?? frameId;
}

// ---------------------------------------------------------------------------
// Structural validation (dev/test). Fails CLOSED: a malformed profile is an error,
// never a silent skip. Called with the live table by default; tests pass synthetic
// rows + records.
// ---------------------------------------------------------------------------
export function validateFrameDefaultProfiles(
  profiles: readonly FrameDefaultProfileRow[] = FRAME_DEFAULT_PROFILES,
  records: readonly ParameterValueRecord[] = PARAMETER_VALUE_RECORDS,
  sources: readonly SourceRecord[] = SOURCE_RECORDS,
): string[] {
  const errors: string[] = [];
  const knownSourceIds = new Set(sources.map((s) => s.source_id));
  const seenKeys = new Set<string>();
  profiles.forEach((row, i) => {
    const at = 'Index ' + i + ' (' + row.frameId + ', ' + row.pathway + '): ';
    // Dedup key includes the scenario so two scenario-less rows for the same
    // (frameId, pathway) is still an error, while distinct named scenarios are allowed.
    const key = row.frameId + '__' + row.pathway + '__' + (row.receptorScenarioId ?? '__sole__');
    if (seenKeys.has(key)) {
      errors.push(at + 'duplicate (frameId, pathway, receptorScenarioId) profile.');
    }
    seenKeys.add(key);
    // Per-row scenario field shape.
    if (row.receptorScenarioId !== undefined) {
      if (typeof row.receptorScenarioId !== 'string' || row.receptorScenarioId.trim().length === 0) {
        errors.push(at + 'receptorScenarioId, when present, must be a non-empty string.');
      }
      if (typeof row.scenarioLabel !== 'string' || row.scenarioLabel.trim().length === 0) {
        errors.push(at + 'scenarioLabel must be a non-empty string when receptorScenarioId is present.');
      }
    }
    if (row.isDefaultScenario !== undefined && typeof row.isDefaultScenario !== 'boolean') {
      errors.push(at + 'isDefaultScenario, when present, must be a boolean.');
    }
    if (getPathwayApplicability(row.frameId, row.pathway).status === 'unsupported') {
      errors.push(at + 'pathway is unsupported for this frame; no frame default allowed.');
    }
    if (typeof row.label !== 'string' || row.label.trim().length === 0) {
      errors.push(at + 'label must be a non-empty string (rendered as the per-frame source descriptor).');
    }
    if (row.sourceIds.length === 0) {
      errors.push(at + 'sourceIds must be non-empty (every profile cites catalog_sources).');
    }
    // Every cited sourceId must resolve to a real catalog source (no dangling /
    // placeholder ids). The per-seed subset check below ties them to the record.
    row.sourceIds.forEach((sid) => {
      if (!knownSourceIds.has(sid)) {
        errors.push(at + 'sourceId "' + sid + '" does not resolve to a catalog source.');
      }
    });
    if (row.defaults.length === 0) {
      errors.push(at + 'defaults must be non-empty.');
    }
    const seedableKeys = SEEDABLE_KEYS[row.pathway] ?? [];
    const seenInputKeys = new Set<string>();
    row.defaults.forEach((seed, j) => {
      const dat = at + 'default ' + j + ' (' + seed.inputKey + '): ';
      if (seenInputKeys.has(seed.inputKey)) errors.push(dat + 'duplicate input_key within profile.');
      seenInputKeys.add(seed.inputKey);
      // Optional per-seed label override: when present it must be a non-empty string
      // (it falls back to the row label when omitted; an empty override would blank the UI).
      if (seed.label !== undefined && (typeof seed.label !== 'string' || seed.label.trim().length === 0)) {
        errors.push(dat + 'label override, when present, must be a non-empty string.');
      }
      if (!seedableKeys.includes(seed.inputKey)) {
        errors.push(dat + 'input_key is not in the seedable allowlist for ' + row.pathway + '.');
      }
      const record = records.find((r) => r.parameter_value_id === seed.parameterValueId);
      if (!record) {
        errors.push(dat + 'cited parameter_value_id "' + seed.parameterValueId + '" not found.');
        return;
      }
      if (record.pathway !== row.pathway) errors.push(dat + 'cited record pathway mismatch.');
      if (record.input_key !== seed.inputKey) errors.push(dat + 'cited record input_key mismatch.');
      if (record.candidate_group_id !== seed.candidateGroupId) {
        errors.push(dat + 'cited record candidate_group_id mismatch.');
      }
      if (record.substance_key !== 'generic') {
        errors.push(dat + 'cited record substance_key must be "generic" (substance-independent).');
      }
      if (typeof record.value !== 'number' || !Number.isFinite(record.value)) {
        errors.push(dat + 'cited record value must be a finite number.');
      }
      const expectedUnit = SEEDABLE_KEY_UNITS[seed.inputKey];
      if (expectedUnit !== undefined && record.unit !== expectedUnit) {
        errors.push(
          dat + 'cited record unit "' + record.unit + '" must be the canonical seed unit "' + expectedUnit + '".',
        );
      }
      // The profile must not cite a source the record itself does not claim:
      // every profile sourceId has to be in the cited record's own source_ids.
      const recordSourceIds = new Set(record.source_ids ?? []);
      row.sourceIds.forEach((sid) => {
        if (!recordSourceIds.has(sid)) {
          errors.push(
            dat + 'profile sourceId "' + sid + '" is not in the cited record source_ids.',
          );
        }
      });
    });
  });

  // Multi-profile (frameId, pathway) group invariants: when a (frameId, pathway) offers
  // more than one receptor scenario, every row must be a NAMED scenario (distinct
  // receptorScenarioId + scenarioLabel) and EXACTLY ONE must be flagged isDefaultScenario
  // (so getFrameDefaults with no scenarioId resolves deterministically).
  const groups = new Map<string, FrameDefaultProfileRow[]>();
  profiles.forEach((row) => {
    const gkey = row.frameId + '__' + row.pathway;
    const list = groups.get(gkey) ?? [];
    list.push(row);
    groups.set(gkey, list);
  });
  groups.forEach((rows, gkey) => {
    if (rows.length < 2) return;
    const at = 'Group (' + gkey + '): ';
    const namedCount = rows.filter(
      (r) => typeof r.receptorScenarioId === 'string' && r.receptorScenarioId.trim().length > 0,
    ).length;
    if (namedCount !== rows.length) {
      errors.push(at + 'every profile in a multi-scenario (frameId, pathway) must have a receptorScenarioId.');
    }
    const defaultCount = rows.filter((r) => r.isDefaultScenario === true).length;
    if (defaultCount !== 1) {
      errors.push(
        at + 'a multi-scenario (frameId, pathway) must have EXACTLY ONE isDefaultScenario; found ' + defaultCount + '.',
      );
    }
  });
  return errors;
}
