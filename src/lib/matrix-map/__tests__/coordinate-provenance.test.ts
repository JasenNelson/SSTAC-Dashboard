import { describe, it, expect } from 'vitest';
import {
  COORD_TIER_LABEL,
  COORD_TIER_CAPTION,
  COORD_TIER_DASH_ARRAY,
} from '../coordinate-provenance';

describe('coordinate-provenance', () => {
  it('labels each tier', () => {
    expect(COORD_TIER_LABEL.high).toBe('Surveyed');
    expect(COORD_TIER_LABEL.medium).toBe('Centroid');
    expect(COORD_TIER_LABEL.low).toBe('Manual');
  });

  it('medium centroid caption is explicit that it is not surveyed', () => {
    expect(COORD_TIER_CAPTION.medium).toContain('Approximate BC CSR site centroid');
    expect(COORD_TIER_CAPTION.medium).toContain('not a surveyed');
  });

  it('high tier caption states surveyed', () => {
    expect(COORD_TIER_CAPTION.high.toLowerCase()).toContain('surveyed');
  });

  it('dash arrays: high solid, medium dashed, low dotted', () => {
    expect(COORD_TIER_DASH_ARRAY.high).toBeUndefined();
    expect(COORD_TIER_DASH_ARRAY.medium).toBe('4 3');
    expect(COORD_TIER_DASH_ARRAY.low).toBe('1 3');
  });

  it('all labels + captions are plain ASCII (code point <= 127)', () => {
    const strings = [
      ...Object.values(COORD_TIER_LABEL),
      ...Object.values(COORD_TIER_CAPTION),
    ];
    for (const s of strings) {
      expect([...s].every((c) => c.charCodeAt(0) <= 127)).toBe(true);
    }
  });
});
