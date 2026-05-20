/**
 * identify-format tests
 *
 * Covers formatIdentifyPopupHtml + formatIdentifyEmptyHtml. Moved from
 * `src/lib/bn-rrm/map-overlay-helpers.test.ts` as part of the PR-MAP-3b
 * hoist to a neutral location (mirrors the wms-identify hoist from
 * PR-MAP-2).
 *
 * Plain ASCII only.
 */

import { describe, expect, it } from 'vitest';
import {
  formatIdentifyEmptyHtml,
  formatIdentifyPopupHtml,
} from './identify-format';

describe('formatIdentifyPopupHtml', () => {
  it('handles empty input with a no-features message', () => {
    const html = formatIdentifyPopupHtml([]);
    expect(html).toContain('No features at this location');
  });

  it('formats a single hit with layer label and property rows', () => {
    const html = formatIdentifyPopupHtml([
      {
        layerLabel: 'Contaminated Sites Registry',
        properties: { SITE_ID: 101, STATUS: 'Active', NOTES: '' },
      },
    ]);
    expect(html).toContain('1 feature identified');
    expect(html).toContain('Contaminated Sites Registry');
    expect(html).toContain('SITE_ID');
    expect(html).toContain('101');
    expect(html).toContain('STATUS');
    expect(html).toContain('Active');
    // empty value excluded
    expect(html).not.toContain('NOTES');
    // no side-panel hint for single hit
    expect(html).not.toContain('See all');
  });

  it('shows total count and side-panel hint for multi-hit', () => {
    const html = formatIdentifyPopupHtml([
      { layerLabel: 'Layer A', properties: { id: 1 } },
      { layerLabel: 'Layer B', properties: { id: 2 } },
      { layerLabel: 'Layer C', properties: { id: 3 } },
    ]);
    expect(html).toContain('3 features identified');
    expect(html).toContain('Layer A'); // primary only
    expect(html).not.toContain('Layer B');
    expect(html).toContain('See all 3 in side panel');
  });

  it('escapes HTML in property values to prevent injection', () => {
    const html = formatIdentifyPopupHtml([
      {
        layerLabel: 'Test <img>',
        properties: { note: '<script>alert(1)</script>' },
      },
    ]);
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('Test &lt;img&gt;');
  });
});

describe('formatIdentifyEmptyHtml', () => {
  it('no_hits shows the generic "No features" title', () => {
    const html = formatIdentifyEmptyHtml('no_hits');
    expect(html).toContain('No features at this location');
    // No layer-menu hint in the plain no-hit case
    expect(html).not.toContain('layer menu');
  });

  it('no_overlays uses a distinct title and hints at the layer menu', () => {
    const html = formatIdentifyEmptyHtml('no_overlays');
    expect(html).toContain('No overlays enabled for Identify');
    expect(html).toContain('layer menu');
    expect(html).toContain('Contaminated Sites Registry');
    // Should NOT carry the generic "no features" copy in this case
    expect(html).not.toContain('No features at this location');
  });

  it('formatIdentifyPopupHtml([]) delegates to no_hits for backward compat', () => {
    expect(formatIdentifyPopupHtml([])).toBe(formatIdentifyEmptyHtml('no_hits'));
  });
});
