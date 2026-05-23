import type {
  CalculatorUsedValue,
  EvidenceItem,
  ProvenancePathway,
} from '@/lib/matrix-options/provenance/types';
import {
  resolveEquationRecords,
  resolveEquationsForPathway,
  resolveProvenanceRows,
  resolveSourceRecords,
} from '@/lib/matrix-options/provenance/resolver';

interface CalculatorProvenancePanelProps {
  pathway: ProvenancePathway;
  usedValues: CalculatorUsedValue[];
  equationIds?: string[];
  title?: string;
  defaultOpen?: boolean;
  className?: string;
}

function humanizeStatus(status: string): string {
  return status.replaceAll('_', ' ').replaceAll('-', ' ');
}

function humanizeDefaultStatus(status: string): string {
  if (status === 'source_backed_default') return 'source linked default';
  return humanizeStatus(status);
}

function evidenceSummary(evidenceItems: EvidenceItem[]): string | null {
  const firstEvidence = evidenceItems[0];
  if (!firstEvidence) return null;
  const reviewText =
    firstEvidence.qa_status === 'approved'
      ? 'approved'
      : humanizeStatus(firstEvidence.qa_status);
  const additionalEvidence =
    evidenceItems.length > 1
      ? `; +${evidenceItems.length - 1} more evidence item${
          evidenceItems.length === 2 ? '' : 's'
        }`
      : '';
  return `${firstEvidence.locator} (${reviewText})${additionalEvidence}`;
}

export default function CalculatorProvenancePanel({
  pathway,
  usedValues,
  equationIds,
  title = 'References and provenance',
  defaultOpen = false,
  className,
}: CalculatorProvenancePanelProps) {
  const rows = resolveProvenanceRows(usedValues);
  const equations = equationIds
    ? resolveEquationRecords(equationIds)
    : resolveEquationsForPathway(pathway);
  const sourceCount = new Set(
    [
      ...rows.flatMap((row) => row.sources.map((source) => source.source_id)),
      ...equations.flatMap((equation) => equation.source_ids),
    ],
  ).size;

  return (
    <details
      open={defaultOpen}
      className={`mt-5 border border-slate-200 dark:border-slate-800 rounded-lg bg-slate-50 dark:bg-slate-950/30 overflow-hidden${className ? ` ${className}` : ''}`}
      data-testid="calculator-provenance-panel"
    >
      <summary className="cursor-pointer select-none px-4 py-3 text-sm font-semibold text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-900">
        <span>{title}</span>
        <span className="ml-2 text-xs font-normal text-slate-500 dark:text-slate-400">
          {rows.length} values, {equations.length} equation
          {equations.length === 1 ? '' : 's'}, {sourceCount} catalog source
          {sourceCount === 1 ? '' : 's'}
        </span>
      </summary>

      <div className="border-t border-slate-200 dark:border-slate-800 px-4 py-4 space-y-4">
        <div>
          <h4 className="text-xs font-bold uppercase text-slate-500 dark:text-slate-400 mb-2">
            Values used in this calculation
          </h4>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                  <th className="py-2 pr-4 font-semibold">Value</th>
                  <th className="py-2 pr-4 font-semibold">Current input</th>
                  <th className="py-2 pr-4 font-semibold">Role</th>
                  <th className="py-2 pr-4 font-semibold">Status</th>
                  <th className="py-2 font-semibold">Source</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={`${row.input_key}-${row.label}`}
                    className="border-b border-slate-200/70 dark:border-slate-800/70 align-top"
                  >
                    <td className="py-2 pr-4 font-medium text-slate-800 dark:text-slate-100">
                      {row.label}
                    </td>
                    <td className="py-2 pr-4 font-mono text-slate-700 dark:text-slate-200 whitespace-nowrap">
                      {row.current_value}
                    </td>
                    <td className="py-2 pr-4 text-slate-600 dark:text-slate-300">
                      {row.role}
                    </td>
                    <td className="py-2 pr-4 text-slate-600 dark:text-slate-300">
                      <span className="block">{humanizeStatus(row.qa_status)}</span>
                      <span className="block text-xs text-slate-500 dark:text-slate-400">
                        {humanizeDefaultStatus(row.default_status)}
                      </span>
                      {evidenceSummary(row.evidence_items) && (
                        <span className="block text-xs text-slate-500 dark:text-slate-400 mt-1">
                          Evidence: {evidenceSummary(row.evidence_items)}
                        </span>
                      )}
                    </td>
                    <td className="py-2 text-slate-600 dark:text-slate-300">
                      {row.sources.length > 0 ? (
                        <ul className="space-y-1">
                          {row.sources.slice(0, 2).map((source) => (
                            <li key={source.source_id}>
                              {source.url ? (
                                <a
                                  href={source.url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-sky-700 dark:text-sky-300 hover:underline"
                                >
                                  {source.short_citation}
                                </a>
                              ) : (
                                source.short_citation
                              )}
                              <span className="ml-1 text-xs text-slate-500 dark:text-slate-400">
                                ({humanizeStatus(source.zotero_status)})
                              </span>
                              <span className="block text-xs text-slate-500 dark:text-slate-400">
                                Currentness:{' '}
                                {humanizeStatus(source.currentness_status)};
                                authority:{' '}
                                {humanizeStatus(source.authority_scope)}
                              </span>
                              {source.conflict_rule && (
                                <span className="block text-xs text-amber-700 dark:text-amber-300">
                                  {source.conflict_rule}
                                </span>
                              )}
                            </li>
                          ))}
                          {row.sources.length > 2 && (
                            <li className="text-xs text-slate-500 dark:text-slate-400">
                              +{row.sources.length - 2} more catalog sources
                            </li>
                          )}
                        </ul>
                      ) : (
                        <span className="text-slate-500 dark:text-slate-400">
                          User input or derived value
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {equations.length > 0 && (
          <div>
            <h4 className="text-xs font-bold uppercase text-slate-500 dark:text-slate-400 mb-2">
              Equation records
            </h4>
            <div className="space-y-2">
              {equations.map((equation) => (
                <div
                  key={equation.equation_id}
                  className="text-sm text-slate-700 dark:text-slate-200"
                >
                  <div className="font-semibold">{equation.display_name}</div>
                  <p className="text-slate-600 dark:text-slate-300">
                    {equation.plain_language}
                  </p>
                  <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
                    Sources:{' '}
                    {resolveSourceRecords(equation.source_ids)
                      .map((source) => source.short_citation)
                      .join('; ')}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Status: {humanizeStatus(equation.qa_status)}.{' '}
                    {equation.applicability}
                  </p>
                  {evidenceSummary(equation.evidence_items) && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      Evidence: {evidenceSummary(equation.evidence_items)}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </details>
  );
}
