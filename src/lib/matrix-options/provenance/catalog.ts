import sourcesRaw from '../../../../matrix_research/reference_catalog/sources.json';
import equationsRaw from '../../../../matrix_research/reference_catalog/equations.json';
import parameterValuesRaw from '../../../../matrix_research/reference_catalog/parameter_values.json';
import type {
  EquationRecord,
  ParameterValueRecord,
  ProvenancePathway,
  SourceRecord,
} from './types';

export const SOURCE_RECORDS = sourcesRaw as SourceRecord[];
export const EQUATION_RECORDS = equationsRaw as EquationRecord[];
export const PARAMETER_VALUE_RECORDS =
  parameterValuesRaw as ParameterValueRecord[];

export function getSourceRecord(sourceId: string): SourceRecord | undefined {
  return SOURCE_RECORDS.find((source) => source.source_id === sourceId);
}

export function getEquationRecord(
  equationId: string,
): EquationRecord | undefined {
  return EQUATION_RECORDS.find(
    (equation) => equation.equation_id === equationId,
  );
}

export function getPathwayEquationRecords(
  pathway: ProvenancePathway,
): EquationRecord[] {
  return EQUATION_RECORDS.filter((equation) => equation.pathway === pathway);
}

export function getParameterValueRecord(
  substanceKey: string,
  pathway: ProvenancePathway,
  inputKey: string,
): ParameterValueRecord | undefined {
  return PARAMETER_VALUE_RECORDS.find(
    (record) =>
      record.substance_key === substanceKey &&
      record.pathway === pathway &&
      record.input_key === inputKey,
  );
}

export function getParameterValueRecordsForSubstance(
  substanceKey: string,
  pathway: ProvenancePathway,
): ParameterValueRecord[] {
  return PARAMETER_VALUE_RECORDS.filter(
    (record) =>
      record.substance_key === substanceKey && record.pathway === pathway,
  );
}
