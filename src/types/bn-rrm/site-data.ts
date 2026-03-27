/**
 * Site Data Types
 *
 * Types for sediment site data that feeds into the BN-RRM
 */

export interface SiteLocation {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  siteType: 'reference' | 'exposure' | 'gradient';
  region?: string;
  waterbody?: string;
  dateCollected: string;
  sourceTag?: 'user' | 'training' | 'comparison';
  spatialClass?: 'EXACT' | 'APPROXIMATE' | 'ZONE' | 'SITE_CENTROID';
}

export interface SedimentChemistry {
  siteId: string;
  sampleId: string;
  dateCollected: string;
  depth?: { top: number; bottom: number };
  copper?: number;
  zinc?: number;
  lead?: number;
  cadmium?: number;
  mercury?: number;
  arsenic?: number;
  chromium?: number;
  nickel?: number;
  totalPAHs?: number;
  totalPCBs?: number;
  toc?: number;
  avs?: number;
  sem?: number;
  percentFines?: number;
  moisture?: number;
  ph?: number;
  redox?: number;
}

export interface PorewaterChemistry {
  siteId: string;
  sampleId: string;
  dateCollected: string;
  copperDissolved?: number;
  zincDissolved?: number;
  leadDissolved?: number;
  cadmiumDissolved?: number;
  ammonia?: number;
  sulfide?: number;
  doc?: number;
}

export interface TissueResidue {
  siteId: string;
  sampleId: string;
  species: string;
  tissue: 'whole_body' | 'liver' | 'muscle' | 'gill';
  dateCollected: string;
  copper?: number;
  zinc?: number;
  lead?: number;
  cadmium?: number;
  mercury?: number;
  totalPAHs?: number;
  totalPCBs?: number;
  lipidContent?: number;
}

export interface ToxicityTest {
  siteId: string;
  sampleId: string;
  dateCollected: string;
  testType: 'amphipod_survival' | 'microtox' | 'sea_urchin' | 'polychaete' | 'mussel_larvae';
  species?: string;
  endpoint: string;
  duration: number;
  result: number;
  unit: string;
  controlResult?: number;
  significantlyDifferent?: boolean;
  toxicityThreshold?: number;
}

export interface BenthicCommunity {
  siteId: string;
  sampleId: string;
  dateCollected: string;
  replicateNumber?: number;
  abundance: number;
  taxaRichness: number;
  shannonDiversity?: number;
  simpsonDiversity?: number;
  pielousEvenness?: number;
  amphipodAbundance?: number;
  polychaeteAbundance?: number;
  molluscsAbundance?: number;
  percentTolerant?: number;
  percentSensitive?: number;
  bioticIndex?: number;
}

export interface SiteData {
  location: SiteLocation;
  sedimentChemistry: SedimentChemistry[];
  porewaterChemistry?: PorewaterChemistry[];
  tissueResidues?: TissueResidue[];
  toxicityTests?: ToxicityTest[];
  benthicCommunity?: BenthicCommunity[];
}

export interface DataUploadResult {
  success: boolean;
  sitesLoaded: number;
  samplesLoaded: number;
  warnings: string[];
  errors: string[];
}

export interface ValidationResult {
  field: string;
  value: number | string;
  status: 'valid' | 'warning' | 'error';
  message?: string;
  guideline?: {
    name: string;
    value: number;
    exceedance?: number;
  };
}

export interface SiteAssessment {
  siteId: string;
  siteName: string;
  assessmentDate: string;
  chemistryDataPoints: number;
  toxicityTests: number;
  benthicSamples: number;
  impactProbabilities: {
    none: number;
    minor: number;
    moderate: number;
    severe: number;
  };
  mostLikelyImpact: 'none' | 'minor' | 'moderate' | 'severe';
  confidence: number;
  keyContaminants: string[];
  keyModifiers: string[];
  protectiveConcentrations?: {
    parameter: string;
    value: number;
    unit: string;
    targetImpact: string;
    targetProbability: number;
  }[];
}

export const CCME_GUIDELINES = {
  copper: { isqg: 35.7, pel: 197, unit: 'mg/kg' },
  zinc: { isqg: 123, pel: 315, unit: 'mg/kg' },
  lead: { isqg: 35, pel: 91.3, unit: 'mg/kg' },
  cadmium: { isqg: 0.6, pel: 3.5, unit: 'mg/kg' },
  mercury: { isqg: 0.17, pel: 0.486, unit: 'mg/kg' },
  arsenic: { isqg: 5.9, pel: 17, unit: 'mg/kg' },
  chromium: { isqg: 37.3, pel: 90, unit: 'mg/kg' },
  totalPAHs: { isqg: 1684, pel: 16770, unit: 'ug/kg' },
} as const;

export type GuidelineParameter = keyof typeof CCME_GUIDELINES;

// =============================================================================
// COMPARISON TYPES — External reference labels (NEVER training targets)
// See: COMPARISON_GOVERNANCE.md in bn_learning/docs/
// =============================================================================

export type ComparatorType = 'WOE' | 'SQT' | 'SQG' | 'PEC-Q' | 'mPEC-Q';
export type BNRiskClass = 'low' | 'moderate' | 'high';
export type MappingConfidence = 'defensible' | 'approximate' | 'not_mappable';
export type ExtractionMethod = 'manual' | 'pymupdf' | 'ai_assisted';
export type Extractor = 'human' | 'claude' | 'gemini' | 'other_ai';

export interface LabelProvenance {
  sourceDocument: string;
  sourcePage: number | string;
  sourceTableFigure?: string;
  extractedLabel: string;
  extractionMethod: ExtractionMethod;
  extractionDate: string;
  extractor: Extractor;
  directQuote?: string;
}

export interface ReportRiskEstimate {
  stationId: number;
  stationName: string;
  siteId: number;
  comparatorType: ComparatorType;
  originalLabel: string;
  mappedBNClass?: BNRiskClass;
  mappingConfidence?: MappingConfidence;
  mappingJustification?: string;
  continuousValue?: number;
  provenance: LabelProvenance;
  isTrainingTarget: false;
}

export interface SiteRiskComparison {
  siteId: number;
  siteName: string;
  registryId: string;
  stationComparisons: {
    stationId: number;
    stationName: string;
    bnrrmPredicted: BNRiskClass;
    bnrrmPosterior: Record<BNRiskClass, number>;
    reportEstimate?: ReportRiskEstimate;
  }[];
  siteRiskNarrative?: string;
  agreementMetrics?: {
    weightedKappa: number;
    weightedKappaCI: { lower: number; upper: number };
    accuracy: number;
    confusionMatrix: number[][];
    n: number;
    nExcluded: number;
    exclusionReason?: string;
  };
}

export interface CaseStudy {
  siteId: string;
  siteName: string;
  registryId?: string;
  region: string;
  isTrainingSite: boolean;
  dataAvailability: {
    chemistry: boolean;
    toxicity: boolean;
    community: boolean;
    modifiers: boolean;
  };
  reportRiskEstimates: ReportRiskEstimate[];
  bnrrmAssessment?: SiteAssessment;
  comparisonNotes: string;
}
