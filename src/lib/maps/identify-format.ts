/**
 * identify-format
 *
 * @file-purpose
 * Neutral Identify-tool popup formatters shared by BN-RRM SiteMap and the
 * matrix-map surface. Hoisted from `src/lib/bn-rrm/map-overlay-helpers.ts`
 * per PR-MAP-3b Q-3 (symmetric to the wms-identify hoist in PR-MAP-2). This
 * module is self-contained -- it does NOT import anything from `bn-rrm/*`
 * so it can be consumed by `matrix-map/*` without dragging Jermilova-specific
 * overlay code along.
 *
 * Provides:
 *   - IdentifyPopupFeature minimal structural type (no wms-identify coupling)
 *   - IdentifyEmptyReason discriminator + formatIdentifyEmptyHtml
 *   - formatIdentifyPopupHtml (the primary identify popup body)
 *
 * Plain ASCII only. No em dashes. No emoji.
 */

// ---------------------------------------------------------------------------
// Internal popup styling (local copy; kept structurally identical to the
// BN-RRM map-overlay-helpers values so the two modules render the same way)
// ---------------------------------------------------------------------------

const POPUP_BASE_STYLE =
  'min-width:220px;max-width:320px;font-family:system-ui,sans-serif;font-size:12px;color:#1e293b;';

const POPUP_TITLE_STYLE =
  'font-weight:700;font-size:14px;color:#0f172a;margin:0 0 6px 0;';

const POPUP_ROW_STYLE = 'margin:2px 0;color:#475569;';

const POPUP_LABEL_STYLE = 'font-weight:600;color:#334155;';

/** Escape HTML special characters to prevent injection from feature properties. */
export function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function wrap(title: string, rowsHtml: string): string {
  return (
    `<div style="${POPUP_BASE_STYLE}">` +
    `<p style="${POPUP_TITLE_STYLE}">${title}</p>` +
    rowsHtml +
    '</div>'
  );
}

function row(label: string, value: string): string {
  return (
    `<p style="${POPUP_ROW_STYLE}">` +
    `<span style="${POPUP_LABEL_STYLE}">${escapeHtml(label)}:</span> ${value}` +
    '</p>'
  );
}

// ---------------------------------------------------------------------------
// Identify-tool popup formatter (WMS + GeoJSON hits)
// ---------------------------------------------------------------------------

/**
 * Minimal subset of IdentifiedFeature needed to render the popup teaser.
 * Intentionally structural - avoids importing the full type from wms-identify
 * so this helper stays isolated from that module.
 */
export interface IdentifyPopupFeature {
  layerLabel: string;
  properties: Record<string, unknown>;
}

function isPopupEmptyValue(v: unknown): boolean {
  if (v === null || v === undefined) return true;
  if (typeof v === 'string' && v.trim() === '') return true;
  return false;
}

function popupValueAsString(v: unknown): string {
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

/**
 * Reason for an empty Identify result. Determines the popup copy so the user
 * can distinguish "clicked empty space on an enabled overlay" from "no
 * identify-enabled overlays are currently active."
 */
export type IdentifyEmptyReason = 'no_hits' | 'no_overlays';

/**
 * Popup body for the two empty cases:
 *   - no_hits:    overlays are active but no feature under the click
 *   - no_overlays: no WMS overlays active, so Identify has nothing to query
 *
 * The no_overlays copy includes a short hint directing the user to the layer
 * menu, because a user who toggled every overlay off (or never toggled one
 * on) will otherwise see a misleading "no features here" message.
 */
export function formatIdentifyEmptyHtml(
  reason: IdentifyEmptyReason,
): string {
  if (reason === 'no_overlays') {
    const body =
      `<p style="${POPUP_ROW_STYLE}">` +
      'Identify searches only overlays that are currently enabled. ' +
      'Open the layer menu and turn on a WMS overlay ' +
      '(for example "Contaminated Sites Registry") to inspect features here.' +
      '</p>';
    return wrap('No overlays enabled for Identify', body);
  }
  return wrap('No features at this location', '');
}

/**
 * Compact popup body used by the Identify tool. Shows:
 *   - A count header ("N features identified")
 *   - Primary layer label + up to 3 non-empty property rows
 *   - A footer hint directing the user to the side panel for full detail
 *
 * features[0] is treated as the primary hit (topmost-first z-order upstream).
 *
 * For the zero-features case callers should prefer formatIdentifyEmptyHtml
 * with an explicit reason; this function keeps a no_hits fallback for
 * backward compatibility with any caller that still passes [].
 */
export function formatIdentifyPopupHtml(
  features: IdentifyPopupFeature[],
): string {
  if (!features || features.length === 0) {
    return formatIdentifyEmptyHtml('no_hits');
  }
  const total = features.length;
  const primary = features[0];
  const title =
    total === 1 ? '1 feature identified' : `${total} features identified`;

  const entries = Object.entries(primary.properties).filter(
    ([, v]) => !isPopupEmptyValue(v),
  );
  const shown = entries.slice(0, 3);

  let rows = row('Layer', escapeHtml(primary.layerLabel));
  for (const [k, v] of shown) {
    rows += row(k, escapeHtml(popupValueAsString(v)));
  }
  if (total > 1) {
    rows +=
      `<p style="${POPUP_ROW_STYLE};font-style:italic;">` +
      `See all ${total} in side panel.` +
      '</p>';
  }
  return wrap(title, rows);
}
