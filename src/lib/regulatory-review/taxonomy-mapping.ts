import { executeQuery } from '@/lib/sqlite/client';

export interface TaxonomyMappingEntry {
  internalRequirementId: string;
  stageId?: string;
  stageLabel?: string;
  topicId?: string;
  topicLabel?: string;
  subtopicId?: string;
  subtopicLabel?: string;
  code?: string;
  citationLabel?: string;
  notes?: string;
}

export interface TaxonomySummary {
  internalRequirementId: string;
  stageId?: string;
  stageLabel?: string;
  topicId?: string;
  topicLabel?: string;
  subtopicId?: string;
  subtopicLabel?: string;
  code?: string;
  citationLabel?: string;
}

// NOTE: Populate this list from the taxonomy mapping deliverable.
// Keep internalRequirementId stable; citationLabel is user-facing and can be aliased later.
export const taxonomyMapping: TaxonomyMappingEntry[] = [
  // Example:
  // {
  //   internalRequirementId: 'CSR_CHUNK_XX_XXX',
  //   stageId: 'STAGE_1',
  //   stageLabel: 'Preliminary Investigation',
  //   topicId: 'site-history',
  //   topicLabel: 'Site History Review',
  //   code: 'CSR',
  //   citationLabel: 'CSR s.18',
  //   notes: 'Alias for legal citation.'
  // },
];

const mappingById = new Map(
  taxonomyMapping.map((entry) => [entry.internalRequirementId, entry])
);

export function getTaxonomyEntry(internalRequirementId: string): TaxonomyMappingEntry | undefined {
  return mappingById.get(internalRequirementId);
}

export function getCitationLabel(internalRequirementId: string): string | undefined {
  return mappingById.get(internalRequirementId)?.citationLabel;
}

const SQLITE_CHUNK_SIZE = 900;

interface TaxonomyRow {
  internal_requirement_id: string;
  stage_id: string | null;
  stage_label: string | null;
  topic_id: string | null;
  topic_label: string | null;
  subtopic_id: string | null;
  subtopic_label: string | null;
  code: string | null;
  citation_label: string | null;
}

const STAGE_PRIORITY = new Map<string, number>([
  ['SITE_DISCOVERY', 1],
  ['PSI', 2],
  ['DSI', 3],
  ['REMEDIATION_PLAN', 4],
  ['REMEDIATION', 5],
]);

function selectStage(rows: TaxonomyRow[]): { stageId?: string; stageLabel?: string } {
  let best: { stageId?: string; stageLabel?: string; rank: number } | null = null;
  for (const row of rows) {
    const stageId = row.stage_id?.toUpperCase();
    if (!stageId) continue;
    const rank = STAGE_PRIORITY.get(stageId) ?? 999;
    if (!best || rank < best.rank) {
      best = { stageId, stageLabel: row.stage_label ?? undefined, rank };
    }
  }
  if (!best) return {};
  return { stageId: best.stageId, stageLabel: best.stageLabel };
}

function selectFirst(rows: TaxonomyRow[], key: keyof TaxonomyRow): string | undefined {
  for (const row of rows) {
    const value = row[key];
    if (value) return value;
  }
  return undefined;
}

export function getTaxonomySummaries(
  internalRequirementIds: string[]
): Map<string, TaxonomySummary> {
  const summaries = new Map<string, TaxonomySummary>();
  const uniqueIds = Array.from(new Set(internalRequirementIds)).filter(Boolean);

  if (uniqueIds.length === 0) {
    return summaries;
  }

  const rowsById = new Map<string, TaxonomyRow[]>();

  for (const id of uniqueIds) {
    const staticEntry = mappingById.get(id);
    if (staticEntry) {
      rowsById.set(id, [
        {
          internal_requirement_id: id,
          stage_id: staticEntry.stageId ?? null,
          stage_label: staticEntry.stageLabel ?? null,
          topic_id: staticEntry.topicId ?? null,
          topic_label: staticEntry.topicLabel ?? null,
          subtopic_id: staticEntry.subtopicId ?? null,
          subtopic_label: staticEntry.subtopicLabel ?? null,
          code: staticEntry.code ?? null,
          citation_label: staticEntry.citationLabel ?? null,
        },
      ]);
    }
  }

  const remainingIds = uniqueIds.filter((id) => !rowsById.has(id));
  if (remainingIds.length > 0) {
    try {
      for (let i = 0; i < remainingIds.length; i += SQLITE_CHUNK_SIZE) {
        const chunk = remainingIds.slice(i, i + SQLITE_CHUNK_SIZE);
        const placeholders = chunk.map(() => '?').join(',');
        const sql = `
          SELECT
            internal_requirement_id,
            stage_id,
            stage_label,
            topic_id,
            topic_label,
            subtopic_id,
            subtopic_label,
            code,
            citation_label
          FROM taxonomy_mapping
          WHERE internal_requirement_id IN (${placeholders})
        `;
        const rows = executeQuery<TaxonomyRow>(sql, chunk);
        for (const row of rows) {
          if (!rowsById.has(row.internal_requirement_id)) {
            rowsById.set(row.internal_requirement_id, []);
          }
          rowsById.get(row.internal_requirement_id)!.push(row);
        }
      }
    } catch {
      // Ignore DB lookup failures; fall back to static mapping only.
    }
  }

  for (const id of uniqueIds) {
    const rows = rowsById.get(id) ?? [];
    const stageSelection = selectStage(rows);
    const summary: TaxonomySummary = {
      internalRequirementId: id,
      stageId: stageSelection.stageId,
      stageLabel: stageSelection.stageLabel,
      topicId: selectFirst(rows, 'topic_id'),
      topicLabel: selectFirst(rows, 'topic_label'),
      subtopicId: selectFirst(rows, 'subtopic_id'),
      subtopicLabel: selectFirst(rows, 'subtopic_label'),
      code: selectFirst(rows, 'code'),
      citationLabel: selectFirst(rows, 'citation_label'),
    };

    const staticEntry = mappingById.get(id);
    if (staticEntry) {
      summary.stageId ??= staticEntry.stageId;
      summary.stageLabel ??= staticEntry.stageLabel;
      summary.topicId ??= staticEntry.topicId;
      summary.topicLabel ??= staticEntry.topicLabel;
      summary.subtopicId ??= staticEntry.subtopicId;
      summary.subtopicLabel ??= staticEntry.subtopicLabel;
      summary.code ??= staticEntry.code;
      summary.citationLabel ??= staticEntry.citationLabel;
    }

    if (
      summary.stageId ||
      summary.topicId ||
      summary.subtopicId ||
      summary.citationLabel ||
      summary.code
    ) {
      summaries.set(id, summary);
    }
  }

  return summaries;
}

export function getCitationLabels(
  internalRequirementIds: string[]
): Map<string, string> {
  const labels = new Map<string, string>();
  const summaries = getTaxonomySummaries(internalRequirementIds);
  for (const [id, summary] of summaries.entries()) {
    if (summary.citationLabel) {
      labels.set(id, summary.citationLabel);
    }
  }
  return labels;
}
