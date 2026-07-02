import type { ProvenancePathway } from './provenance/types';

export const REGULATORY_FRAME_IDS = [
  'bc-protocol1-v5-dra',
  'bc-csr-sediment-numerical',
  'canada-fcsap-aquatic',
  'ccme-sediment-quality',
  'us-epa-usace-sediment',
  'site-specific',
] as const;

export type RegulatoryFrameId = (typeof REGULATORY_FRAME_IDS)[number];

export type CatalogJurisdiction =
  | 'BC'
  | 'Canada_federal'
  | 'US_federal'
  | 'general';

export type PathwayApplicabilityStatus =
  | 'calculation_ready'
  | 'needs_review'
  | 'reference_only'
  | 'unsupported';

export interface PathwayApplicability {
  status: PathwayApplicabilityStatus;
  note: string;
}

export interface SourceHierarchyItem {
  tier: number;
  label: string;
  note: string;
}

export interface RegulatoryFrame {
  id: RegulatoryFrameId;
  label: string;
  shortLabel: string;
  description: string;
  eligibleCatalogJurisdictions: readonly CatalogJurisdiction[];
  sourceHierarchy: readonly SourceHierarchyItem[];
  conflictRule: string;
  valueEligibilityRule: string;
  safeUseNote: string;
  pathwayApplicability: Record<ProvenancePathway, PathwayApplicability>;
}

const BC_DEVELOPMENT_PATHWAYS: Record<ProvenancePathway, PathwayApplicability> = {
  'eco-direct-eqp': {
    status: 'needs_review',
    note:
      'EqP is eligible for framework development, but the selected FCV and equation source still require exact source locators before driving a BC default.',
  },
  'eco-food-bsaf': {
    status: 'needs_review',
    note:
      'Food-web derivation is eligible for framework development; current TRV and BSAF alternatives remain review candidates.',
  },
  'human-health-direct': {
    status: 'needs_review',
    note:
      'Human-health direct-contact derivation is eligible, but TRVs and sediment-specific exposure assumptions require source-by-source review.',
  },
  'human-health-food': {
    status: 'needs_review',
    note:
      'Human-health food-web derivation is eligible, with consumption assumptions and tissue-linkage values still requiring review.',
  },
  'background-adjustment': {
    status: 'calculation_ready',
    note:
      'Background adjustment remains available as the post-derivation comparison pattern for naturally elevated concentrations.',
  },
};

const FRAME_SOURCE_HIERARCHIES = {
  bcDevelopment: [
    {
      tier: 1,
      label: 'BC legal standards, Protocol 1, and ministry guidance',
      note:
        'Controls BC derivation framing and conflict resolution where an exact current locator is available.',
    },
    {
      tier: 2,
      label: 'Canadian federal, Health Canada, FCSAP, and CCME sources',
      note:
        'Eligible supporting government sources when BC methods point outward or do not provide a value.',
    },
    {
      tier: 3,
      label: 'US EPA, USACE, ERDC, and other regulatory sources',
      note:
        'Eligible technical support or source candidates, subject to BC applicability review.',
    },
    {
      tier: 4,
      label: 'Protocol 28 compilations, WQCIU leads, and supporting science',
      note:
        'Reference-mining aids only until the original source and locator are verified.',
    },
  ],
  canadaFederal: [
    {
      tier: 1,
      label: 'FCSAP, Health Canada, and CCME government guidance',
      note:
        'Canadian federal or intergovernmental sources control when directly applicable.',
    },
    {
      tier: 2,
      label: 'BC or US regulatory sources',
      note:
        'Supporting context where Canadian federal guidance is silent or requires comparison.',
    },
    {
      tier: 3,
      label: 'Supporting science and policy compilations',
      note:
        'Not calculation-driving until exact sources and QA are complete.',
    },
  ],
  usFederal: [
    {
      tier: 1,
      label: 'US EPA, USACE, and ERDC government guidance',
      note:
        'US federal regulatory and technical sources control when directly applicable.',
    },
    {
      tier: 2,
      label: 'Canadian and BC regulatory sources',
      note:
        'Comparison or transferability context only.',
    },
    {
      tier: 3,
      label: 'Supporting science and policy compilations',
      note:
        'Not calculation-driving until exact sources and QA are complete.',
    },
  ],
} as const satisfies Record<string, readonly SourceHierarchyItem[]>;

export const REGULATORY_FRAMES = [
  {
    id: 'bc-protocol1-v5-dra',
    label: 'BC Protocol 1 v5 DRA (2027)',
    shortLabel: 'BC Protocol 1 v5 DRA',
    description:
      'Target BC derivation frame for the next standards-development cycle. Protocol 1 v5 controls BC framing once in force; source-mined values remain candidates until verified.',
    eligibleCatalogJurisdictions: ['BC', 'Canada_federal', 'US_federal', 'general'],
    sourceHierarchy: FRAME_SOURCE_HIERARCHIES.bcDevelopment,
    conflictRule:
      'Use current BC legal or protocol direction first; external regulatory values support derivation only when BC method direction points outward or leaves a gap.',
    valueEligibilityRule:
      'Approved source-backed records may be shown as eligible options; pending locators, policy compilations, and source-of-sources leads stay read-only.',
    safeUseNote:
      'The selected frame changes lookup eligibility and warnings, not the current calculator defaults yet.',
    pathwayApplicability: BC_DEVELOPMENT_PATHWAYS,
  },
  {
    id: 'bc-csr-sediment-numerical',
    label: 'BC CSR sediment numerical standards',
    shortLabel: 'BC CSR numerical',
    description:
      'Current BC numerical-standards comparison frame. It emphasizes existing BC standards and background adjustment, not new derivation candidates.',
    eligibleCatalogJurisdictions: ['BC', 'general'],
    sourceHierarchy: FRAME_SOURCE_HIERARCHIES.bcDevelopment,
    conflictRule:
      'Current BC standards and protocols control. External sources are reference context unless BC explicitly incorporates them.',
    valueEligibilityRule:
      'Only BC and general scaffold records are visible from calculator drill-ins for this frame.',
    safeUseNote:
      'Use for comparison to current BC framing; new derivation values are not made authoritative here.',
    pathwayApplicability: {
      'eco-direct-eqp': {
        status: 'reference_only',
        note:
          'EqP derivation can be compared, but current BC numerical standards are not replaced by the calculator output.',
      },
      'eco-food-bsaf': {
        status: 'unsupported',
        note:
          'Food-web BSAF derivation is not represented as a current BC CSR numerical-standard pathway in this slice.',
      },
      'human-health-direct': {
        status: 'unsupported',
        note:
          'Human-health direct-contact derivation is not represented as a current BC CSR numerical-standard pathway in this slice.',
      },
      'human-health-food': {
        status: 'unsupported',
        note:
          'Human-health food-web derivation is not represented as a current BC CSR numerical-standard pathway in this slice.',
      },
      'background-adjustment': {
        status: 'calculation_ready',
        note:
          'Background adjustment is supported as a post-derivation comparison for naturally elevated concentrations.',
      },
    },
  },
  {
    id: 'canada-fcsap-aquatic',
    label: 'Canada FCSAP aquatic/sediment guidance',
    shortLabel: 'Canada FCSAP',
    description:
      'Canadian federal contaminated-sites frame for sediment and aquatic exposure sources, including Health Canada and FCSAP guidance.',
    eligibleCatalogJurisdictions: ['Canada_federal', 'general'],
    sourceHierarchy: FRAME_SOURCE_HIERARCHIES.canadaFederal,
    conflictRule:
      'Prefer current Canadian federal and Health Canada source records over provincial, US, or compiled values.',
    valueEligibilityRule:
      'Canadian federal and general records are visible; values still require source-backed approval before they can become defaults.',
    safeUseNote:
      'This frame filters the library to Canadian federal candidates. For the eco calculators ' +
      '(eco-direct EqP, eco-food TRV), a reference-only or unsupported frame now suppresses the ' +
      'calculator input default rather than showing an unsupported static value; on needs-review ' +
      'eco frames they still seed from the source-priority catalog or the current default. Other ' +
      'pathways are unaffected by this suppression.',
    pathwayApplicability: {
      'eco-direct-eqp': {
        status: 'reference_only',
        note:
          'Eco-direct EqP is available for comparison, but Canadian federal source hierarchy needs review before selecting defaults.',
      },
      'eco-food-bsaf': {
        status: 'needs_review',
        note:
          'Eco-food wildlife values may be available from FCSAP or related sources, pending locator and QA review.',
      },
      'human-health-direct': {
        status: 'needs_review',
        note:
          'Human-health direct-contact TRVs and exposure assumptions may use Health Canada sources after source review.',
      },
      'human-health-food': {
        status: 'needs_review',
        note:
          'Human-health food-web values may use Health Canada sources, with consumption and BSAF assumptions requiring review.',
      },
      'background-adjustment': {
        status: 'reference_only',
        note:
          'Background adjustment can be compared, but the BC-specific adjustment policy is not adopted automatically.',
      },
    },
  },
  {
    id: 'ccme-sediment-quality',
    label: 'CCME sediment quality guidelines',
    shortLabel: 'CCME SQG',
    description:
      'CCME sediment-quality guideline comparison frame, focused on ISQG/PEL-style ecological benchmarks rather than full calculator derivation.',
    eligibleCatalogJurisdictions: ['Canada_federal', 'general'],
    sourceHierarchy: FRAME_SOURCE_HIERARCHIES.canadaFederal,
    conflictRule:
      'Use CCME guideline records for comparison; do not substitute calculator derivations for guideline values without a reviewed method bridge.',
    valueEligibilityRule:
      'Canadian federal and general records are visible as references; calculator defaults remain unchanged.',
    safeUseNote:
      'Best used for guideline comparison and source lookup, not as a derivation selector.',
    pathwayApplicability: {
      'eco-direct-eqp': {
        status: 'reference_only',
        note:
          'CCME sediment guidelines can be compared to EqP outputs, but this frame does not make EqP the CCME method.',
      },
      'eco-food-bsaf': {
        status: 'unsupported',
        note:
          'The BSAF wildlife pathway is outside the current CCME guideline comparison slice.',
      },
      'human-health-direct': {
        status: 'unsupported',
        note:
          'Human-health direct-contact derivation is outside the current CCME sediment-guideline comparison slice.',
      },
      'human-health-food': {
        status: 'unsupported',
        note:
          'Human-health food-web derivation is outside the current CCME sediment-guideline comparison slice.',
      },
      'background-adjustment': {
        status: 'reference_only',
        note:
          'Background concepts can be reviewed, but no BC adjustment policy is implied by this frame.',
      },
    },
  },
  {
    id: 'us-epa-usace-sediment',
    label: 'US EPA/USACE sediment guidance',
    shortLabel: 'US EPA/USACE',
    description:
      'US federal sediment frame for EPA, USACE, and ERDC technical sources including EqP, Eco-SSL/TRV, and BSAF source candidates.',
    eligibleCatalogJurisdictions: ['US_federal', 'general'],
    sourceHierarchy: FRAME_SOURCE_HIERARCHIES.usFederal,
    conflictRule:
      'Prefer current US federal source records for this frame; use Canadian or BC sources only as comparison context.',
    valueEligibilityRule:
      'US federal and general records are visible; ERDC placeholder values remain non-driving until exact row locators are verified.',
    safeUseNote:
      'This frame narrows value lookup to US federal candidates without changing calculator defaults.',
    pathwayApplicability: {
      'eco-direct-eqp': {
        status: 'needs_review',
        note:
          'EPA EqP sources are eligible, pending source-specific method and value review.',
      },
      'eco-food-bsaf': {
        status: 'needs_review',
        note:
          'Eco-SSL/TRV and BSAF sources are eligible, with ERDC spreadsheet row locators still pending.',
      },
      'human-health-direct': {
        status: 'needs_review',
        note:
          'IRIS and EPA human-health values are eligible after currentness and locator review.',
      },
      'human-health-food': {
        status: 'needs_review',
        note:
          'IRIS and EPA human-health values are eligible, but food-web assumptions require review.',
      },
      'background-adjustment': {
        status: 'reference_only',
        note:
          'Background comparison can be reviewed but does not adopt BC adjustment policy.',
      },
    },
  },
  {
    id: 'site-specific',
    label: 'Site-specific derivation',
    shortLabel: 'Site-specific',
    description:
      'Professional-judgment frame for site-specific derivations. It exposes all catalog jurisdictions for comparison while preserving QA status.',
    eligibleCatalogJurisdictions: ['BC', 'Canada_federal', 'US_federal', 'general'],
    sourceHierarchy: [
      {
        tier: 1,
        label: 'Project-approved governing frame',
        note:
          'The qualified professional must select the controlling legal or regulatory context.',
      },
      {
        tier: 2,
        label: 'Source-backed regulatory values',
        note:
          'Use only approved records for calculation-driving values.',
      },
      {
        tier: 3,
        label: 'Candidate, compiled, and supporting values',
        note:
          'Visible for comparison and source mining only until reviewed.',
      },
    ],
    conflictRule:
      'Document the governing frame and site-specific rationale; do not let a generic catalog value silently override professional judgment.',
    valueEligibilityRule:
      'All catalog jurisdictions are visible, but unsupported and pending values remain non-driving.',
    safeUseNote:
      'This is the broadest lookup frame and should be accompanied by a documented professional rationale.',
    pathwayApplicability: {
      'eco-direct-eqp': {
        status: 'needs_review',
        note:
          'EqP can be used in site-specific review when method assumptions and source values are documented.',
      },
      'eco-food-bsaf': {
        status: 'needs_review',
        note:
          'Food-web derivation can be used when receptor, diet, TRV, and BSAF choices are documented.',
      },
      'human-health-direct': {
        status: 'needs_review',
        note:
          'Direct-contact derivation can be used when exposure assumptions and TRVs are documented.',
      },
      'human-health-food': {
        status: 'needs_review',
        note:
          'Food-web derivation can be used when consumption, tissue target, and accumulation assumptions are documented.',
      },
      'background-adjustment': {
        status: 'needs_review',
        note:
          'Background adjustment can be used when reference-set representativeness and policy fit are documented.',
      },
    },
  },
] as const satisfies readonly RegulatoryFrame[];

export const DEFAULT_REGULATORY_FRAME_ID: RegulatoryFrameId =
  'bc-protocol1-v5-dra';

export const LEGACY_JURISDICTION_FRAME_MAP = {
  'bc-csr': 'bc-protocol1-v5-dra',
  'federal-ccme': 'ccme-sediment-quality',
  'site-specific': 'site-specific',
} as const satisfies Record<string, RegulatoryFrameId>;

const REGULATORY_FRAME_BY_ID: Record<RegulatoryFrameId, RegulatoryFrame> =
  REGULATORY_FRAMES.reduce(
    (acc, frame) => {
      acc[frame.id] = frame;
      return acc;
    },
    {} as Record<RegulatoryFrameId, RegulatoryFrame>,
  );

export function isRegulatoryFrameId(
  value: unknown,
): value is RegulatoryFrameId {
  return (
    typeof value === 'string' &&
    (REGULATORY_FRAME_IDS as readonly string[]).includes(value)
  );
}

export function coerceRegulatoryFrameId(
  value: unknown,
): RegulatoryFrameId | null {
  if (isRegulatoryFrameId(value)) return value;
  if (
    typeof value === 'string' &&
    Object.prototype.hasOwnProperty.call(LEGACY_JURISDICTION_FRAME_MAP, value)
  ) {
    return LEGACY_JURISDICTION_FRAME_MAP[
      value as keyof typeof LEGACY_JURISDICTION_FRAME_MAP
    ];
  }
  return null;
}

export function getRegulatoryFrame(
  frameId: RegulatoryFrameId,
): RegulatoryFrame {
  return REGULATORY_FRAME_BY_ID[frameId];
}

export function regulatoryFrameEvidenceFilter(
  frameId: RegulatoryFrameId,
): { jurisdictions: string[] } {
  return {
    jurisdictions: [...getRegulatoryFrame(frameId).eligibleCatalogJurisdictions],
  };
}

export function getPathwayApplicability(
  frameId: RegulatoryFrameId,
  pathway: ProvenancePathway,
): PathwayApplicability {
  return getRegulatoryFrame(frameId).pathwayApplicability[pathway];
}

export function pathwayApplicabilityLabel(
  status: PathwayApplicabilityStatus,
): string {
  if (status === 'calculation_ready') return 'Calculation-ready';
  if (status === 'needs_review') return 'Needs review';
  if (status === 'reference_only') return 'Reference-only';
  return 'Unsupported';
}

export function pathwayApplicabilityTone(
  status: PathwayApplicabilityStatus,
): string {
  if (status === 'calculation_ready') return 'emerald';
  if (status === 'needs_review') return 'amber';
  if (status === 'reference_only') return 'sky';
  return 'slate';
}

type AllFramesExhaustive =
  Exclude<
    RegulatoryFrameId,
    (typeof REGULATORY_FRAMES)[number]['id']
  > extends never
    ? true
    : false;
const _allFramesExhaustive: AllFramesExhaustive = true;
void _allFramesExhaustive;
