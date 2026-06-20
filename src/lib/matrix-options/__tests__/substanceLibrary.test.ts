import { describe, expect, it } from 'vitest';
import { SUBSTANCE_LIBRARY, findSubstance } from '../substanceLibrary';

describe('SUBSTANCE_LIBRARY', () => {
  it('has 74 entries', () => {
    // 18 base + 10 pilot (2026-06-19) + 36 eco-registry fan-out (2026-06-19)
    // + 4 reconciliation (PR B, 2026-06-19: xylenes, total PCBs, chromium,
    // mercury_inorganic) + 1 CCME chloroform (2026-06-19) = 69, + 5 BC
    // Protocol 28 specialty metals (Batch A, 2026-06-20: antimony, cobalt,
    // manganese, silver, tin) = 74.
    expect(SUBSTANCE_LIBRARY).toHaveLength(74);
  });

  it('every entry has a non-null key', () => {
    for (const entry of SUBSTANCE_LIBRARY) {
      expect(entry.key).toBeTruthy();
      expect(typeof entry.key).toBe('string');
    }
  });

  it('every entry has a non-null displayName', () => {
    for (const entry of SUBSTANCE_LIBRARY) {
      expect(entry.displayName).toBeTruthy();
      expect(typeof entry.displayName).toBe('string');
    }
  });

  it('every entry has a non-null contaminantClass', () => {
    for (const entry of SUBSTANCE_LIBRARY) {
      expect(entry.contaminantClass).toBeTruthy();
      expect(typeof entry.contaminantClass).toBe('string');
    }
  });

  it('every entry has a non-null sources field', () => {
    for (const entry of SUBSTANCE_LIBRARY) {
      expect(entry.sources).toBeTruthy();
      expect(typeof entry.sources).toBe('string');
    }
  });

  it('has no duplicate keys', () => {
    const keys = SUBSTANCE_LIBRARY.map((entry) => entry.key);
    const uniqueKeys = new Set(keys);
    expect(uniqueKeys.size).toBe(keys.length);
  });
});

describe('findSubstance', () => {
  it('returns entry for benzo_a_pyrene with correct displayName', () => {
    const result = findSubstance('benzo_a_pyrene');
    expect(result).toBeDefined();
    expect(result?.displayName).toBe('Benzo[a]pyrene');
  });

  it('returns entry for lead with correct displayName', () => {
    const result = findSubstance('lead');
    expect(result).toBeDefined();
    expect(result?.displayName).toBe('Lead');
  });

  it('returns entry for copper with correct displayName', () => {
    const result = findSubstance('copper');
    expect(result).toBeDefined();
    expect(result?.displayName).toBe('Copper');
  });

  it('returns undefined for a nonexistent substance key', () => {
    const result = findSubstance('nonexistent_substance');
    expect(result).toBeUndefined();
  });

  it('benzo_a_pyrene has sf_oral value of 1.0', () => {
    const result = findSubstance('benzo_a_pyrene');
    expect(result?.sf_oral_per_mg_per_kg_bw_per_day).toBe(1.0);
  });

  it('benzo_a_pyrene has logKow of 6.13', () => {
    const result = findSubstance('benzo_a_pyrene');
    expect(result?.logKow).toBe(6.13);
  });

  it('lead has rfd_oral value of 3.5e-3', () => {
    const result = findSubstance('lead');
    expect(result?.rfd_oral_mg_per_kg_bw_per_day).toBeCloseTo(3.5e-3);
  });
});

describe('SUBSTANCE_LIBRARY -- Batch A BC Protocol 28 specialty metals', () => {
  // Verified verbatim against matrix_research/reference_catalog/
  // human_health_trv_values.json (pv-p28-<key>-hh-direct-rfd / -food-rfd).
  const expected = [
    { key: 'antimony', rfd: 6.0e-3, cls: 'metalloid' },
    { key: 'cobalt', rfd: 3.0e-4, cls: 'divalent-metal' },
    { key: 'manganese', rfd: 1.4e-1, cls: 'divalent-metal' },
    { key: 'silver', rfd: 5.0e-3, cls: 'divalent-metal' },
    { key: 'tin', rfd: 6.0e-1, cls: 'divalent-metal' },
  ] as const;

  for (const { key, rfd, cls } of expected) {
    it(`${key} carries the BC P28 RfD ${rfd} and class ${cls}`, () => {
      const result = findSubstance(key);
      expect(result).toBeDefined();
      expect(result?.rfd_oral_mg_per_kg_bw_per_day).toBeCloseTo(rfd);
      expect(result?.contaminantClass).toBe(cls);
      // Human-health only: no eco TRV seeded (Eco-Food is filtered out).
      expect(result?.trv_eco_mg_per_kg_bw_day).toBeNull();
      expect(result?.sf_oral_per_mg_per_kg_bw_per_day).toBeNull();
    });
  }
});
