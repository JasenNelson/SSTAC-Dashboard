'use client';

// =====================================================================
// Matrix Interactive Map -- Identify side panel (PR-MAP-3b)
// =====================================================================
//
// Lane:   Matrix Interactive Map
// Branch: feat/matrix-map-pr-map-3b-identify
// Plan:   docs/design/matrix-map/PR_MAP_3_PLAN.md sections 4.2 + 4.3 +
//         4.4 + 6.2.
//
// What this component does:
//   - Renders the side-panel ("right-rail") identify card when
//     IdentifyState != null.
//   - For kind='sample': shows the full sample card per plan section
//     4.2 + a DRA-detail subcard sourced from the on-demand fetch
//     (loading state if fetch in-flight; error state if it failed;
//     "not recorded" if sample.source_dra_id was null).
//   - For kind='overlay': loops through features array and renders
//     each via the hoisted formatIdentifyPopupHtml string output,
//     injected via dangerouslySetInnerHTML inside a safe container.
//     The hoisted helper already escapes HTML special characters in
//     property values (see escapeHtml in identify-format.ts).
//   - Provides a single Close button (X) that the parent MatrixMap
//     wires to setIdentifyState(null).
//
// Renders OUTSIDE the Leaflet MapContainer as a sibling DOM node
// (per the task brief). This keeps the React tree free of any react-
// leaflet dependency and lets the side panel layer above the map at
// the same z-index tier as the legend + banner.
//
// Plain ASCII only -- no em-dashes / smart quotes / Unicode arrows.
// Per L0 CLAUDE.md section 1.1.
// =====================================================================

import { X } from 'lucide-react';

import { formatIdentifyPopupHtml } from '@/lib/maps/identify-format';

import type { IdentifyState, IdentifySampleState } from './identify-state';

// URL-scheme allowlist for the on-demand DRA document_url field.
// Per codex PR-MAP-3b R1 P2: document_url is on-demand DB content (the
// dras row is fetched at identify-click via supabase.from('dras')). React
// escapes attribute values but does NOT neutralize javascript:, data:,
// or vbscript: schemes -- those would still execute on click. Allowlist
// http: + https: + mailto: only; everything else (including malformed
// URLs that fail parse) returns null and the link is suppressed entirely
// (the calling JSX checks for null and renders "Open source document"
// link only when isSafeDocumentUrl returns a value).
function isSafeDocumentUrl(raw: string | null): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return null;
  }
  if (parsed.protocol === 'http:' || parsed.protocol === 'https:' || parsed.protocol === 'mailto:') {
    return parsed.toString();
  }
  return null;
}

interface IdentifyPanelProps {
  state: IdentifyState | null;
  onClose: () => void;
}

export function IdentifyPanel({ state, onClose }: IdentifyPanelProps) {
  if (state === null) return null;

  return (
    <aside
      className="absolute right-4 top-20 bottom-4 z-[1100] flex w-[360px] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-lg border border-slate-200 bg-white/95 shadow-lg backdrop-blur"
      data-testid="matrix-map-identify-panel"
      role="region"
      aria-label="Identify panel"
    >
      <header className="flex items-center justify-between border-b border-slate-200 px-3 py-2">
        <h2 className="text-sm font-semibold text-slate-700">
          {state.kind === 'sample' ? 'Sample identified' : 'Overlay features'}
        </h2>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
          aria-label="Close identify panel"
          data-testid="matrix-map-identify-close"
        >
          <X className="h-4 w-4" />
        </button>
      </header>
      <div className="flex-1 overflow-y-auto px-3 py-2 text-xs text-slate-700">
        {state.kind === 'sample' ? (
          <SampleCard state={state} />
        ) : (
          <OverlayList state={state} />
        )}
      </div>
    </aside>
  );
}

// ---------------------------------------------------------------------
// Sample card (kind='sample')
// ---------------------------------------------------------------------

function SampleCard({ state }: { state: IdentifySampleState }) {
  const { sample, dra, draLoading, draError } = state;
  return (
    <div data-testid="matrix-map-identify-sample-card" className="space-y-3">
      <section>
        <p className="font-mono text-[11px] uppercase tracking-wider text-slate-400">
          Station
        </p>
        <p className="text-sm font-semibold text-slate-900">
          {sample.display_name}
        </p>
        <KV label="BN-RRM station id" value={String(sample.bnrrm_station_id)} />
        <KV label="Station id" value={sample.station_id} />
      </section>

      <section className="border-t border-slate-100 pt-2">
        <KV label="Classification" value={sample.classification} />
        <KV
          label="Classification source"
          value={sample.classification_source}
        />
        <KV
          label="Confidence"
          value={sample.classification_confidence ?? 'not set'}
        />
        <KV
          label="Coordinate quality"
          value={sample.coordinate_quality_tier}
        />
        <KV label="Coordinate source" value={sample.coordinate_source} />
        <KV label="BC region" value={sample.bc_region ?? 'not set'} />
        <KV
          label="Waterbody"
          value={
            sample.waterbody
              ? sample.waterbody_type
                ? `${sample.waterbody} (${sample.waterbody_type})`
                : sample.waterbody
              : 'not set'
          }
        />
      </section>

      <section className="border-t border-slate-100 pt-2">
        <p className="font-mono text-[11px] uppercase tracking-wider text-slate-400">
          Classification rationale
        </p>
        <p className="mt-0.5 whitespace-pre-wrap leading-snug text-slate-700">
          {sample.classification_rationale ?? 'no rationale recorded'}
        </p>
      </section>

      <section className="border-t border-slate-100 pt-2">
        <p className="font-mono text-[11px] uppercase tracking-wider text-slate-400">
          Source DRA
        </p>
        {sample.source_dra_id === null ? (
          <p
            className="mt-0.5 italic text-slate-500"
            data-testid="matrix-map-identify-dra-missing"
          >
            not recorded
          </p>
        ) : draLoading ? (
          <p
            className="mt-0.5 italic text-slate-500"
            data-testid="matrix-map-identify-dra-loading"
          >
            Loading DRA detail...
          </p>
        ) : draError ? (
          <p
            className="mt-0.5 rounded border border-rose-200 bg-rose-50 px-2 py-1 text-rose-800"
            data-testid="matrix-map-identify-dra-error"
            role="alert"
          >
            DRA fetch failed: {draError}
          </p>
        ) : dra ? (
          <div
            className="mt-0.5 space-y-0.5"
            data-testid="matrix-map-identify-dra-card"
          >
            <p className="font-semibold text-slate-900">
              {dra.title ?? 'untitled DRA'}
            </p>
            {dra.agency || dra.year !== null ? (
              <p className="text-slate-600">
                {dra.agency ?? 'unknown agency'}
                {dra.year !== null ? ` (${dra.year})` : ''}
              </p>
            ) : null}
            {dra.citation ? (
              <p className="text-slate-600">Citation: {dra.citation}</p>
            ) : null}
            {dra.site_id ? (
              <p className="text-slate-600">Site id: {dra.site_id}</p>
            ) : null}
            <p className="text-slate-600">
              Public:{' '}
              {dra.public ? 'Yes' : 'No (private; access granted to you)'}
            </p>
            {(() => {
              const safeUrl = isSafeDocumentUrl(dra.document_url);
              return safeUrl ? (
                <p>
                  <a
                    href={safeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-700 underline hover:text-blue-900"
                    data-testid="matrix-map-identify-dra-url"
                  >
                    Open source document
                  </a>
                </p>
              ) : null;
            })()}
            {dra.confidentiality_notes ? (
              <p
                className="mt-1 rounded border border-amber-200 bg-amber-50 px-2 py-1 text-amber-900"
                data-testid="matrix-map-identify-dra-confidentiality"
              >
                Confidentiality: {dra.confidentiality_notes}
              </p>
            ) : null}
          </div>
        ) : (
          <p
            className="mt-0.5 italic text-slate-500"
            data-testid="matrix-map-identify-dra-empty"
          >
            DRA detail not available
          </p>
        )}
      </section>
    </div>
  );
}

function KV({ label, value }: { label: string; value: string }) {
  return (
    <p className="mt-0.5 leading-snug">
      <span className="font-semibold text-slate-600">{label}:</span>{' '}
      <span className="text-slate-800">{value}</span>
    </p>
  );
}

// ---------------------------------------------------------------------
// Overlay list (kind='overlay')
// ---------------------------------------------------------------------

function OverlayList({
  state,
}: {
  state: Extract<IdentifyState, { kind: 'overlay' }>;
}) {
  if (state.features.length === 0) {
    return (
      <p
        className="italic text-slate-500"
        data-testid="matrix-map-identify-overlay-empty"
      >
        No overlay features at this location.
      </p>
    );
  }
  // Group features by layerKey so multi-hit layers cluster together
  // while preserving topmost-first input order. queryActiveOverlays
  // already returns layers in z-order; we just bucket them.
  const groups: { layerKey: string; layerLabel: string; html: string }[] = [];
  const indexByKey = new Map<string, number>();
  for (const feature of state.features) {
    const existing = indexByKey.get(feature.layerKey);
    if (existing === undefined) {
      indexByKey.set(feature.layerKey, groups.length);
      groups.push({
        layerKey: feature.layerKey,
        layerLabel: feature.layerLabel,
        html: formatIdentifyPopupHtml([
          { layerLabel: feature.layerLabel, properties: feature.properties },
        ]),
      });
    } else {
      // Append additional features by re-running the formatter on the
      // accumulated subset (the formatter shows "See all N in side
      // panel." when total > 1; for a side-panel render we want the
      // raw per-feature card instead). Append a secondary HTML block
      // rather than coalescing -- keeps each feature's properties
      // independently visible.
      groups[existing].html +=
        formatIdentifyPopupHtml([
          { layerLabel: feature.layerLabel, properties: feature.properties },
        ]);
    }
  }
  return (
    <div className="space-y-2" data-testid="matrix-map-identify-overlay-list">
      <p className="text-[11px] text-slate-500">
        Click at lat {state.latlng.lat.toFixed(4)}, lng{' '}
        {state.latlng.lng.toFixed(4)}.
      </p>
      {groups.map((g) => (
        <div
          key={g.layerKey}
          className="rounded border border-slate-200 bg-slate-50 px-2 py-1"
          data-testid={`matrix-map-identify-overlay-group-${g.layerKey}`}
          // formatIdentifyPopupHtml escapes user-controlled property
          // values via escapeHtml in identify-format.ts; the static
          // wrapper markup is hard-coded inside the same module. The
          // dangerouslySetInnerHTML here is safe so long as that
          // contract holds (covered by identify-format.test.ts).
          dangerouslySetInnerHTML={{ __html: g.html }}
        />
      ))}
    </div>
  );
}
