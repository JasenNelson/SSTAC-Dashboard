import React from "react";

export function isPathwayNotesArray(value: unknown): value is unknown[] {
  return Array.isArray(value);
}

function truncateHash(hash: string, n = 12): string {
  if (!hash) return "";
  return hash.length <= n ? hash : `${hash.slice(0, n)}...`;
}

// R3 check per contract
function isConformingItem(item: unknown): boolean {
  if (!item || typeof item !== "object" || Array.isArray(item)) return false;
  const obj = item as Record<string, unknown>;
  const keys = Object.keys(obj);
  if (keys.length !== 5) return false;
  
  if (typeof obj.pathway_id !== "string") return false;
  if (typeof obj.pathway_kind !== "string") return false;
  if (typeof obj.narrative !== "string" || obj.narrative.length < 1) return false;
  
  if (!Array.isArray(obj.edge_chain) || obj.edge_chain.length < 1) return false;
  for (const edge of obj.edge_chain) {
    if (typeof edge !== "string") return false;
  }
  
  if (!Array.isArray(obj.supporting_evidence_item_ids) || obj.supporting_evidence_item_ids.length < 1) return false;
  for (const id of obj.supporting_evidence_item_ids) {
    if (typeof id !== "string") return false;
  }

  // Contract: must have exactly the 5 keys
  const expectedKeys = new Set(["pathway_id", "pathway_kind", "narrative", "edge_chain", "supporting_evidence_item_ids"]);
  for (const k of keys) {
    if (!expectedKeys.has(k)) return false;
  }
  
  return true;
}

// L3A contract R3/X3 (as amended 2026-07-22): supporting ids are MATCHED
// against the row's rendered evidence items. The caller passes the id set
// derived from the SAME collectEvidenceItems output the evidence-citations
// render uses (post corpus-side regulatory filter) -- no duplicate
// traversal here, so the match semantics cannot drift from the citations
// render. A matched id gets an explicit in-packet marker; the clickable
// anchor is deferred to the Phase-0-populated era (no anchor targets exist
// in the pre-Phase-0 packet render).
export function PathwayNotesView({
  value,
  presentEvidenceIds,
}: {
  value: unknown[];
  presentEvidenceIds?: Set<string>;
}): React.ReactElement {
  if (value.length === 0) {
    return (
      <div
        data-testid="per-policy-pathway-notes-empty"
        className="italic text-slate-400 dark:text-slate-500"
      >
        No pathway notes recorded.
      </div>
    );
  }

  return (
    <div data-testid="per-policy-pathway-notes" className="space-y-3">
      {value.map((item, index) => {
        if (!isConformingItem(item)) {
          return (
            <pre
              key={index}
              data-testid="pathway-note-fallback"
              className="overflow-x-auto whitespace-pre-wrap break-words rounded bg-slate-100 dark:bg-slate-800 p-2 text-[11px] font-mono text-slate-700 dark:text-slate-300"
            >
              {JSON.stringify(item, null, 2)}
            </pre>
          );
        }

        const conforming = item as {
          pathway_id: string;
          pathway_kind: string;
          narrative: string;
          edge_chain: string[];
          supporting_evidence_item_ids: string[];
        };

        return (
          <div
            key={index}
            data-testid="pathway-note-card"
            className="rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3 space-y-2"
          >
            <div className="flex flex-wrap items-center gap-2">
              <span
                className="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium bg-slate-100 text-slate-700 dark:bg-slate-700/40 dark:text-slate-300"
                data-testid="pathway-kind-badge"
              >
                {conforming.pathway_kind}
              </span>
              <span
                data-testid="pathway-id-span"
                className="font-mono text-[10px] text-slate-500 dark:text-slate-400 truncate max-w-xs"
                title={conforming.pathway_id}
              >
                {truncateHash(conforming.pathway_id, 8)}
              </span>
            </div>
            <div
              data-testid="pathway-narrative"
              className="text-xs text-slate-700 dark:text-slate-300 whitespace-pre-line"
            >
              {conforming.narrative}
            </div>
            <div className="flex flex-wrap items-center gap-1">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                CHAIN
              </span>
              <span
                data-testid="pathway-edge-chain"
                className="text-[10px] text-slate-600 dark:text-slate-300 flex flex-wrap items-center gap-1"
              >
                {conforming.edge_chain.map((edge, i) => (
                  <React.Fragment key={i}>
                    <span className="rounded bg-slate-100 dark:bg-slate-800 px-1 py-0.5 border border-slate-200 dark:border-slate-700">
                      {edge}
                    </span>
                    {i < conforming.edge_chain.length - 1 && <span>-&gt;</span>}
                  </React.Fragment>
                ))}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-1">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                EVIDENCE
              </span>
              <span
                data-testid="pathway-evidence-ids"
                className="text-[10px] text-slate-600 dark:text-slate-300 flex flex-wrap gap-1"
              >
                {conforming.supporting_evidence_item_ids.map((id, i) => {
                  const matched = presentEvidenceIds?.has(id) ?? false;
                  return (
                    <span
                      key={i}
                      data-testid={
                        matched
                          ? "pathway-evidence-id-matched"
                          : "pathway-evidence-id-unmatched"
                      }
                      className={
                        "font-mono rounded px-1 py-0.5 border " +
                        (matched
                          ? "bg-emerald-50 dark:bg-emerald-900/30 border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300"
                          : "bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700")
                      }
                      title={
                        matched
                          ? `${id} (present in this row's evidence packet)`
                          : id
                      }
                    >
                      {/* Anchor-link deferred to Phase-0-populated era
                          (L3A R3 amendment 2026-07-22). */}
                      {truncateHash(id, 12)}
                      {matched ? " *" : ""}
                    </span>
                  );
                })}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
