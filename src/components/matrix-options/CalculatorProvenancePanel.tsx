import type {
  CalculatorUsedValue,
  EvidenceItem,
  EvidenceLibraryFilterRequest,
  ProvenancePathway,
} from '@/lib/matrix-options/provenance/types';
import {
  resolveEquationRecords,
  resolveEquationsForPathway,
  resolveProvenanceRows,
  resolveSourceRecords,
} from '@/lib/matrix-options/provenance/resolver';
import {
  buildCalculatorEvidenceRequest,
  getParameterValueReviewDisposition,
  humanizeCatalogLabel,
  isCalculatorEvidenceSource,
} from '@/lib/matrix-options/provenance/library';
import {
  regulatoryFrameEvidenceFilter,
  type RegulatoryFrameId,
} from '@/lib/matrix-options/regulatoryFrames';

interface CalculatorProvenancePanelProps {
  pathway: ProvenancePathway;
  usedValues: CalculatorUsedValue[];
  equationIds?: string[];
  regulatoryFrameId?: RegulatoryFrameId;
  title?: string;
  defaultOpen?: boolean;
  className?: string;
  onOpenEvidenceLibrary?: (request: EvidenceLibraryFilterRequest) => void;
}

function humanizeStatus(status: string): string {
  const catalogLabel = humanizeCatalogLabel(status);
  if (catalogLabel !== status) return catalogLabel;
  return status.replaceAll('_', ' ').replaceAll('-', ' ');
}

function statusTone(status: string): string {
  if (status === 'approved' || status === 'approved_source_backed') {
    return 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-200';
  }
  if (
    status.includes('needs') ||
    status === 'pending_source_locator' ||
    status === 'current_calculator_scaffold' ||
    status === 'reference_mining_lead'
  ) {
    return 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-200';
  }
  return 'border-slate-200 bg-white text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300';
}

function StatusChip({ value }: { value: string }) {
  return (
    <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold ${statusTone(value)}`}>
      {humanizeStatus(value)}
    </span>
  );
}

function reviewToneClass(tone: 'approved' | 'blocked' | 'derived' | 'scaffold'): string {
  if (tone === 'approved') {
    return 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-200';
  }
  if (tone === 'derived') {
    return 'border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-800 dark:bg-sky-900/20 dark:text-sky-200';
  }
  if (tone === 'scaffold') {
    return 'border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200';
  }
  return 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-200';
}

function evidenceSupportSummary(status: string): string {
  if (status === 'approved_source_backed') return 'Approved source-backed';
  if (status === 'pending_source_locator') {
    return 'Pending exact source locator; candidate source metadata only';
  }
  if (status === 'current_calculator_scaffold') {
    return 'Current calculator scaffold only';
  }
  if (status === 'reference_mining_lead') {
    return 'Reference-mining lead; not canonical calculator evidence';
  }
  return 'User-entered or derived value';
}

function evidenceSummary(
  evidenceItems: EvidenceItem[],
  evidenceSupportStatus: string,
): string | null {
  const firstEvidence = evidenceItems[0];
  if (!firstEvidence) return evidenceSupportSummary(evidenceSupportStatus);
  const reviewText =
    firstEvidence.qa_status === 'approved'
      ? 'approved'
      : humanizeStatus(firstEvidence.qa_status);
  const locator =
    evidenceSupportStatus === 'current_calculator_scaffold' ||
    firstEvidence.extraction_method === 'current_calculator_scaffold' ||
    firstEvidence.locator_type === 'current_calculator'
      ? evidenceSupportSummary(evidenceSupportStatus)
      : firstEvidence.locator;
  const additionalEvidence =
    evidenceItems.length > 1
      ? `; +${evidenceItems.length - 1} more evidence item${
          evidenceItems.length === 2 ? '' : 's'
        }`
      : '';
  return `${locator} (${reviewText})${additionalEvidence}`;
}

function uniqueIds(ids: string[]): string[] {
  return Array.from(new Set(ids));
}

function countStatuses(statuses: string[], status: string): number {
  return statuses.filter((candidate) => candidate === status).length;
}

function calculatorAuditText(
  rows: ReturnType<typeof resolveProvenanceRows>,
  equations: ReturnType<typeof resolveEquationRecords>,
): string {
  const statuses = [
    ...rows.map((row) => row.evidence_support_status),
    ...equations.map((equation) => equation.evidence_support_status),
  ];
  const approved = countStatuses(statuses, 'approved_source_backed');
  const pending = countStatuses(statuses, 'pending_source_locator');
  const scaffolds = countStatuses(statuses, 'current_calculator_scaffold');
  const userDerived = countStatuses(statuses, 'user_entered_or_derived');

  return `${approved} approved, ${pending} pending source locator${
    pending === 1 ? '' : 's'
  }, ${scaffolds} current calculator scaffold${
    scaffolds === 1 ? '' : 's'
  }, ${userDerived} user input${userDerived === 1 ? '' : 's'}`;
}

export default function CalculatorProvenancePanel({
  pathway,
  usedValues,
  equationIds,
  regulatoryFrameId,
  title = 'References and provenance',
  defaultOpen = false,
  className,
  onOpenEvidenceLibrary,
}: CalculatorProvenancePanelProps) {
  const rows = resolveProvenanceRows(usedValues);
  const equations = equationIds
    ? resolveEquationRecords(equationIds)
    : resolveEquationsForPathway(pathway);
  const sourceIds = uniqueIds([
    ...rows.flatMap((row) => row.sources.map((source) => source.source_id)),
    ...equations.flatMap((equation) => equation.source_ids),
  ]);
  const sourceRecords = resolveSourceRecords(sourceIds).filter(
    isCalculatorEvidenceSource,
  );
  const sourceCount = sourceRecords.length;
  const auditText = calculatorAuditText(rows, equations);
  const regulatoryFrameFilters = regulatoryFrameId
    ? regulatoryFrameEvidenceFilter(regulatoryFrameId)
    : {};
  const openEvidenceLibrary = () => {
    if (!onOpenEvidenceLibrary) return;
    onOpenEvidenceLibrary({
      ...buildCalculatorEvidenceRequest(
        pathway,
        rows,
        equations.map((equation) => equation.equation_id),
      ),
      ...regulatoryFrameFilters,
    });
  };
  const openValueAlternatives = (row: (typeof rows)[number]) => {
    if (!onOpenEvidenceLibrary || !row.catalog_record) return;
    onOpenEvidenceLibrary({
      pathways: [pathway],
      substanceKeys: [row.catalog_record.substance_key],
      inputKeys: [row.input_key],
      ...regulatoryFrameFilters,
    });
  };

  return (
    <details
      open={defaultOpen}
      className={`mt-5 border border-slate-200 dark:border-slate-800 rounded-lg bg-slate-50 dark:bg-slate-950/30 overflow-hidden${className ? ` ${className}` : ''}`}
      data-testid="calculator-provenance-panel"
    >
      <summary className="cursor-pointer select-none px-4 py-3 text-sm font-semibold text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-900">
        <span>{title}</span>
        <span className="ml-2 text-xs font-normal text-slate-500 dark:text-slate-400">
          {rows.length} used values, {equations.length} equation
          {equations.length === 1 ? '' : 's'}, {sourceCount} source
          {sourceCount === 1 ? '' : 's'}
        </span>
      </summary>

      <div className="border-t border-slate-200 dark:border-slate-800 px-4 py-4 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h4 className="text-xs font-bold uppercase text-slate-500 dark:text-slate-400 mb-1">
              Values used in this calculation
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {auditText}
            </p>
          </div>
          {onOpenEvidenceLibrary && (
            <button
              type="button"
              onClick={openEvidenceLibrary}
              className="min-h-8 rounded-md border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 hover:border-sky-400 hover:text-sky-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:text-sky-300"
            >
              Open References & Values
            </button>
          )}
        </div>
        <div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                  <th className="py-2 pr-4 font-semibold">Value</th>
                  <th className="py-2 pr-4 font-semibold">Current input</th>
                  <th className="py-2 pr-4 font-semibold">Role</th>
                  <th className="py-2 pr-4 font-semibold">Default / evidence</th>
                  <th className="py-2 font-semibold">Source</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-3 py-4 text-center text-sm text-slate-500 dark:text-slate-400"
                    >
                      No values recorded for this calculation.
                    </td>
                  </tr>
                )}
                {rows.map((row) => {
                  const review = row.catalog_record
                    ? getParameterValueReviewDisposition(
                        row.catalog_record,
                        row.sources,
                      )
                    : {
                        label: 'Derived preview only',
                        detail:
                          'User-entered or derived values are not catalog defaults.',
                        tone: 'derived' as const,
                      };
                  return (
                    <tr
                      key={`${row.input_key}-${row.label}`}
                      className="border-b border-slate-200/70 dark:border-slate-800/70 align-top"
                    >
                        <td className="py-2 pr-4 font-medium text-slate-800 dark:text-slate-100">
                          {row.label}
                          {onOpenEvidenceLibrary && row.catalog_record && (
                            <button
                              type="button"
                              onClick={() => openValueAlternatives(row)}
                              aria-label={`View alternatives for ${row.label}`}
                              className="mt-1 block min-h-7 rounded-md border border-slate-300 bg-white px-2 text-xs font-semibold text-slate-700 hover:border-sky-400 hover:text-sky-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:text-sky-300"
                            >
                              View alternatives
                            </button>
                          )}
                        </td>
                        <td className="py-2 pr-4 font-mono text-slate-700 dark:text-slate-200 whitespace-nowrap">
                          {row.current_value}
                        </td>
                        <td className="py-2 pr-4 text-slate-600 dark:text-slate-300">
                          {row.role}
                        </td>
                        <td className="py-2 pr-4 text-slate-600 dark:text-slate-300">
                          <div className="flex flex-wrap gap-1">
                            {row.default_status !== 'not_cataloged' && (
                              <StatusChip value={row.default_status} />
                            )}
                            <StatusChip value={row.evidence_support_status} />
                            <StatusChip value={row.qa_status} />
                          </div>
                          <div
                            className={`mt-1 rounded-md border px-2 py-1 text-xs ${reviewToneClass(
                              review.tone,
                            )}`}
                          >
                            <span className="font-semibold">{review.label}</span>
                            <span className="block">{review.detail}</span>
                          </div>
                          {evidenceSummary(row.evidence_items, row.evidence_support_status) && (
                            <span className="block text-xs text-slate-500 dark:text-slate-400 mt-1">
                              Evidence:{' '}
                              {evidenceSummary(
                                row.evidence_items,
                                row.evidence_support_status,
                              )}
                            </span>
                          )}
                        </td>
                        <td className="py-2 text-slate-600 dark:text-slate-300">
                          {row.sources.filter(isCalculatorEvidenceSource).length > 0 ? (
                            <ul className="space-y-1">
                              {row.sources
                                .filter(isCalculatorEvidenceSource)
                                .slice(0, 2)
                                .map((source) => (
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
                                  {row.evidence_support_status === 'pending_source_locator' && (
                                    <span className="block text-xs text-slate-500 dark:text-slate-400">
                                      Pending exact locator; not approved source-backed.
                                    </span>
                                  )}
                                </li>
                              ))}
                              {row.sources.filter(isCalculatorEvidenceSource).length > 2 && (
                                <li className="text-xs text-slate-500 dark:text-slate-400">
                                  +{row.sources.filter(isCalculatorEvidenceSource).length - 2} more catalog sources
                                </li>
                              )}
                            </ul>
                          ) : row.sources.length > 0 ? (
                            <span className="text-slate-500 dark:text-slate-400">
                              Source review pending; current calculator scaffold only
                            </span>
                          ) : (
                            <span className="text-slate-500 dark:text-slate-400">
                              User input or derived value
                            </span>
                          )}
                        </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </details>
  );
}
