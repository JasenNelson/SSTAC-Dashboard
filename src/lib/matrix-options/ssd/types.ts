import type {
  EvidenceSupportStatus,
} from '@/lib/matrix-options/provenance/types';

export type SsdMedium = 'freshwater' | 'marine';
export type SsdEnvironmentFilter = 'all' | SsdMedium;
export type SsdMediaFilter = 'water' | 'sediment';
export type SsdMediumCode = 'FW' | 'MW';

export type SpeciesAggregationMethod =
  | 'geometric_mean'
  | 'most_sensitive';

export type SsdAnalysisMode =
  | 'empirical_preview'
  | 'model_averaging'
  | 'single_distribution';

export type SsdDistribution =
  | 'Gamma'
  | 'Log-Gumbel'
  | 'Log-Logistic'
  | 'Log-Normal'
  | 'Log-Normal Mixture'
  | 'Weibull';

export type SsdCurveDistribution = SsdDistribution | 'Model Average';

export type SsdExcludedReason =
  | 'chemical_mismatch'
  | 'media_mismatch'
  | 'medium_mismatch'
  | 'endpoint_mismatch'
  | 'missing_species'
  | 'invalid_endpoint_value'
  | 'non_positive_endpoint_value';

export interface RawEcotoxRecord {
  chemical_name: string | null;
  species_scientific_name: string | null;
  conc1_mean: string | number | null;
  unit?: string | null;
  species_group?: string | null;
  media_type?: string | null;
  endpoint?: string | null;
  reference_number?: string | number | null;
  test_id?: string | number | null;
}

export interface SsdWorkbenchSettings {
  chemicalNames: string[];
  mediaFilter: SsdMediaFilter;
  environmentFilter: SsdEnvironmentFilter;
  endpointFilters: string[];
  aggregationMethod: SpeciesAggregationMethod;
  pValue: number;
  analysisMode: SsdAnalysisMode;
  selectedDistribution?: SsdDistribution;
  bootstrapIterations: number;
  randomSeed: number;
  sourceMode: 'fixture' | 'upload' | 'ecotox_mirror';
  ecotoxMirrorRecordCount?: number;
  extractedAt: string;
}

export interface SsdCleanedRecord {
  chemicalName: string;
  speciesScientificName: string;
  concentration: number;
  speciesGroup: string;
  broadGroup: SsdBroadTaxonomicGroup;
  mediaType: string;
  endpoint: string;
  referenceNumber: string | null;
  testId: string | null;
  raw: RawEcotoxRecord;
}

export interface SsdExcludedRecord {
  reason: SsdExcludedReason;
  detail: string;
  raw: RawEcotoxRecord;
}

export type SsdBroadTaxonomicGroup =
  | 'Fish'
  | 'Invertebrate'
  | 'Plant'
  | 'Amphibian'
  | 'Other';

export interface SpeciesAggregate {
  speciesScientificName: string;
  broadGroup: SsdBroadTaxonomicGroup;
  value: number;
  valueCount: number;
  sourceRecordCount: number;
  minValue: number;
  maxValue: number;
}

export interface EmpiricalSsdPoint {
  speciesScientificName: string;
  broadGroup: SsdBroadTaxonomicGroup;
  value: number;
  percentAffected: number;
}

export interface SsdFittedCurvePoint {
  distribution: SsdCurveDistribution;
  value: number;
  percentAffected: number;
}

export interface SsdModelParameter {
  name: string;
  value: number;
}

export interface SsdModelDiagnostic {
  name: string;
  distribution?: SsdDistribution;
  mode: SsdAnalysisMode;
  hcp: number;
  weight: number;
  aic: number | null;
  aicc: number | null;
  deltaAicc?: number | null;
  parameters: SsdModelParameter[];
  note: string;
}

export interface SsdDerivedCandidate {
  label: string;
  inputKey: string;
  value: number;
  unit: string;
  evidenceSupportStatus: EvidenceSupportStatus;
  qaStatus: 'needs_review';
  canDriveCalculations: false;
  provenanceNote: string;
}

export interface SsdAnalysisResult {
  hcp: number;
  pValue: number;
  unit: string;
  speciesCount: number;
  cleanedRecordCount: number;
  excludedRecordCount: number;
  settings: SsdWorkbenchSettings;
  speciesAggregates: SpeciesAggregate[];
  empiricalPoints: EmpiricalSsdPoint[];
  fittedCurvePoints: SsdFittedCurvePoint[];
  diagnostics: SsdModelDiagnostic[];
  excludedRecords: SsdExcludedRecord[];
  warnings: string[];
  derivedCandidate: SsdDerivedCandidate;
}

export interface EcotoxChemicalSearchResult {
  chemicalName: string;
}

export interface EcotoxFetchRequest {
  chemicalNames: string[];
  medium?: SsdMedium;
  mediaFilter?: SsdMediaFilter;
  endpointFilters?: string[];
  maxRows?: number;
}
