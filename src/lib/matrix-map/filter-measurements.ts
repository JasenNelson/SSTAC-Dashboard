// Shared filter helper extracted from MatrixMapRightPanel.tsx (~849-863 at the time
// of Phase 0 cut). Moved verbatim so both the left stats panel and the right
// measurement workbench apply identical filter logic.
//
// VERBATIM PRESERVATION NOTES:
//   - Lexical date-string comparison: `row.event_date < filterState.date_from`
//     relies on ISO-8601 YYYY-MM-DD strings comparing correctly as plain strings.
//     Do NOT replace with Date object arithmetic; that would change behavior for
//     rows with partial dates or undefined event_date values.
//   - `row.medium as MatrixMapMedium` cast: the runtime value is a plain string
//     from the RPC; the cast is correct because the medium chip filter only ever
//     contains valid MatrixMapMedium values (enforced by the filter store).
//
// Plain ASCII only (code point <= 127).

import type { MatrixMapMeasurementRow } from '@/stores/matrix-map/measurementStore';
import type { MatrixMapFilterState, MatrixMapMedium } from '@/stores/matrix-map/filterStore';

export function filterMeasurementRows(
  rows: MatrixMapMeasurementRow[],
  filterState: MatrixMapFilterState,
): MatrixMapMeasurementRow[] {
  const substanceIds = new Set(filterState.substance_ids);
  const mediums = new Set(filterState.mediums);

  return rows.filter((row) => {
    if (substanceIds.size > 0 && (!row.substance_id || !substanceIds.has(row.substance_id))) return false;
    if (mediums.size > 0 && !mediums.has(row.medium as MatrixMapMedium)) return false;
    if (filterState.qa === 'detected' && row.censored) return false;
    if (filterState.qa === 'censored' && !row.censored) return false;
    if (filterState.classification !== 'all' && row.classification !== filterState.classification) return false;
    // Undated rows (event_date === null) are EXCLUDED whenever a date filter is active -- the
    // null-guard is explicit so the comparison never relies on accidental null coercion.
    const eventDate = row.event_date;
    if (filterState.date_from && (eventDate === null || eventDate < filterState.date_from)) return false;
    if (filterState.date_to && (eventDate === null || eventDate > filterState.date_to)) return false;
    return true;
  });
}
