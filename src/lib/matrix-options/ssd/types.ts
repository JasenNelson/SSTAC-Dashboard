import type {
  EvidenceSupportStatus,
} from '@/lib/matrix-options/provenance/types';

export type SsdMedium = 'freshwater' | 'marine';
export type SsdMediumCode = 'FW' | 'MW';

export type SpeciesAggregationMethod =
  | 'geometric_mean'
  | 'most_sensitive';

export type SsdAnalysisMode =
  | 'empirical_preview'
  | 'model_averaging'
  | 'single_distribution';

export type SsdDistribution =
  | 'Log-Normal'
  | 'Log-Logistic'
  | 'Weibull'
  | 'Gamma';

export type SsdExcludedReason =
  | 'chemical_mismatch'
  | 'medium_mismatch'
  | 'endpoint_mismatch'
  | 'missing_species'
  | 'invalid_endpoint_value'
  | 'non_positive_endpoint_value';

export interface RawEcotoxRecord {
  chemical_name: string | null;
  species_scientific_name: string | null;
  conc1_mean: string | number | null;
  species_group?: string | null;
  media_type?: string | null;
  endpoint?: string | null;
  reference_number?: string | number | null;
  test_id?: string | number | null;
}

export interface SsdWorkbenchSettings {
  chemicalNames: string[];
  medium: SsdMedium;
  endpointFilters: string[];
  aggregationMethod: SpeciesAggregationMethod;
  pValue: number;
  analysisMode: SsdAnalysisMode;
  selectedDistribution?: SsdDistribution;
  bootstrapIterations: number;
  randomSeed: number;
  sourceMode: 'fixture' | 'ecotox_mirror';
  ecotoxMirrorRecordCount?: number;
  extractedAt: string;
}

export interface SsdCleanedRecord {
  chemicalName: string;
  speciesScientificName: string;
  concentration: number;
  speciesGroup: string;
  broadGroup: SsdBroadTaxonomicGroup;
  mediaType: SsdMediumCode;
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

export interface SsdModelDiagnostic {
  name: string;
  mode: SsdAnalysisMode;
  hcp: number;
  weight: number;
  aicc: number | null;
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
  endpointFilters?: string[];
  maxRows?: number;
}
