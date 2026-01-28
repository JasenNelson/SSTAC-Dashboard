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
  citation_label: string | null;
}

export function getCitationLabels(
  internalRequirementIds: string[]
): Map<string, string> {
  const labels = new Map<string, string>();
  const uniqueIds = Array.from(new Set(internalRequirementIds)).filter(Boolean);

  if (uniqueIds.length === 0) {
    return labels;
  }

  // Preload any static overrides first
  for (const id of uniqueIds) {
    const staticLabel = mappingById.get(id)?.citationLabel;
    if (staticLabel) {
      labels.set(id, staticLabel);
    }
  }

  const remainingIds = uniqueIds.filter((id) => !labels.has(id));
  if (remainingIds.length === 0) {
    return labels;
  }

  try {
    for (let i = 0; i < remainingIds.length; i += SQLITE_CHUNK_SIZE) {
      const chunk = remainingIds.slice(i, i + SQLITE_CHUNK_SIZE);
      const placeholders = chunk.map(() => '?').join(',');
      const sql = `
        SELECT internal_requirement_id, citation_label
        FROM taxonomy_mapping
        WHERE internal_requirement_id IN (${placeholders})
      `;
      const rows = executeQuery<TaxonomyRow>(sql, chunk);
      for (const row of rows) {
        if (row.citation_label) {
          labels.set(row.internal_requirement_id, row.citation_label);
        }
      }
    }
  } catch {
    // Ignore DB lookup failures; fall back to static mapping only.
  }

  return labels;
}
