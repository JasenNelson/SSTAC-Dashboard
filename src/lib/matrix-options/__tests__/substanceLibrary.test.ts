import { describe, expect, it } from 'vitest';
import { SUBSTANCE_LIBRARY, findSubstance } from '../substanceLibrary';

describe('SUBSTANCE_LIBRARY', () => {
  it('has 111 entries', () => {
    // 69 (through 2026-06-19) + 5 BC P28 metals (Batch A) = 74, + 6 HH-only PAHs
    // (Batch B) = 80, + 10 catalog WIRE substances (Batch C, 2026-06-20: aluminum,
    // boron, molybdenum, strontium, phenol, styrene, acetone, hexachlorobenzene,
    // pentachlorophenol, 1_4_dioxane) = 90, + 13 PFAS + HH-only sweep (Batch D,
    // 2026-06-20: perfluoroctanoic_acid_pfoa, perfluorooctane_sulfonate, aldrin,
    // endrin, hexachlorobutadiene, hexachlorocyclopentadiene, isophorone,
    // acrylonitrile, carbon_disulfide, bisphenol_a, nitrobenzene, pyridine,
    // 2_methylnaphthalene) = 103, + 8 chlorinated VOCs / organics (Batch E) = 111.
    expect(SUBSTANCE_LIBRARY).toHaveLength(111);
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

describe('SUBSTANCE_LIBRARY -- Batch B HH-only PAHs', () => {
  // Verified verbatim against human_health_trv_values.json
  // (pv-p28-<key>-hh-*-rfd / pv-iris-<key>-hh-*-rfd; dibenzo[a,h]anthracene -sf).
  const rfdPahs = [
    { key: 'anthracene', rfd: 0.3 },
    { key: 'fluoranthene', rfd: 0.04 },
    { key: 'phenanthrene', rfd: 0.04 },
    { key: 'acenaphthene', rfd: 0.06 },
    { key: 'fluorene', rfd: 0.04 },
  ] as const;

  for (const { key, rfd } of rfdPahs) {
    it(`${key} is an organic-PAH with RfD ${rfd}, HH-only`, () => {
      const r = findSubstance(key);
      expect(r).toBeDefined();
      expect(r?.contaminantClass).toBe('organic-PAH');
      expect(r?.rfd_oral_mg_per_kg_bw_per_day).toBeCloseTo(rfd);
      expect(r?.sf_oral_per_mg_per_kg_bw_per_day).toBeNull();
      // No logKow/eco in catalog -> eco pathways filtered out.
      expect(r?.logKow).toBeNull();
      expect(r?.fcv_ug_per_L).toBeNull();
      expect(r?.trv_eco_mg_per_kg_bw_day).toBeNull();
    });
  }

  it('dibenzo_a_h_anthracene is a carcinogenic PAH: sf set, rfd null', () => {
    const r = findSubstance('dibenzo_a_h_anthracene');
    expect(r).toBeDefined();
    expect(r?.contaminantClass).toBe('organic-PAH');
    expect(r?.sf_oral_per_mg_per_kg_bw_per_day).toBeCloseTo(7.3);
    expect(r?.rfd_oral_mg_per_kg_bw_per_day).toBeNull();
    expect(r?.logKow).toBeNull();
  });
});

describe('SUBSTANCE_LIBRARY -- Batch C catalog WIRE substances', () => {
  // Verified verbatim against human_health_trv_values.json.
  const rfdSubs = [
    { key: 'aluminum', rfd: 1.0, cls: 'divalent-metal' },
    { key: 'boron', rfd: 0.2, cls: 'metalloid' },
    { key: 'molybdenum', rfd: 0.005, cls: 'divalent-metal' },
    { key: 'strontium', rfd: 0.6, cls: 'divalent-metal' },
    { key: 'phenol', rfd: 0.3, cls: 'organic' },
    { key: 'styrene', rfd: 0.2, cls: 'organic' },
    { key: 'acetone', rfd: 0.9, cls: 'organic' },
  ] as const;

  for (const { key, rfd, cls } of rfdSubs) {
    it(`${key} (${cls}) carries RfD ${rfd}, sf null`, () => {
      const r = findSubstance(key);
      expect(r).toBeDefined();
      expect(r?.contaminantClass).toBe(cls);
      expect(r?.rfd_oral_mg_per_kg_bw_per_day).toBeCloseTo(rfd);
      expect(r?.sf_oral_per_mg_per_kg_bw_per_day).toBeNull();
      expect(r?.trv_eco_mg_per_kg_bw_day).toBeNull();
    });
  }

  // Carcinogens with BOTH endpoints seeded build-first (cancer SF + non-cancer RfD), so the
  // calculator can select the more conservative of the two (derivations.pickHumanHealthEndpoint).
  const sfSubs = [
    { key: 'hexachlorobenzene', sf: 1.6, rfd: 8.0e-4, cls: 'organic-halogenated' },
    { key: 'pentachlorophenol', sf: 0.4, rfd: 5.0e-3, cls: 'organic-halogenated' },
    { key: '1_4_dioxane', sf: 0.1, rfd: 3.0e-2, cls: 'organic' },
  ] as const;

  for (const { key, sf, rfd, cls } of sfSubs) {
    it(`${key} (${cls}) carries both endpoints: sf ${sf}, rfd ${rfd}`, () => {
      const r = findSubstance(key);
      expect(r).toBeDefined();
      expect(r?.contaminantClass).toBe(cls);
      expect(r?.sf_oral_per_mg_per_kg_bw_per_day).toBe(sf);
      expect(r?.rfd_oral_mg_per_kg_bw_per_day).toBe(rfd);
    });
  }
});

describe('SUBSTANCE_LIBRARY -- Batch D PFAS + HH-only sweep', () => {
  // Verified verbatim against human_health_trv_values.json. PFOA/PFOS use the
  // US EPA 2024 RfD (pv-us-epa-2024-*); the rest are US EPA IRIS (pv-iris-*).
  // All HH-only: logKow/fcv/trv_eco null -> eco pathways filtered out.

  // RfD-only substances (sf null).
  const rfdOnly = [
    { key: 'perfluoroctanoic_acid_pfoa', rfd: 3.0e-8, cls: 'organic-halogenated' },
    { key: 'perfluorooctane_sulfonate', rfd: 1.0e-7, cls: 'organic-halogenated' },
    { key: 'endrin', rfd: 3.0e-4, cls: 'organic-halogenated' },
    { key: 'hexachlorocyclopentadiene', rfd: 6.0e-3, cls: 'organic-halogenated' },
    { key: 'carbon_disulfide', rfd: 0.1, cls: 'organic' },
    { key: 'bisphenol_a', rfd: 0.05, cls: 'organic' },
    { key: 'nitrobenzene', rfd: 2.0e-3, cls: 'organic' },
    { key: 'pyridine', rfd: 1.0e-3, cls: 'organic' },
    { key: '2_methylnaphthalene', rfd: 4.0e-3, cls: 'organic-PAH' },
  ] as const;

  for (const { key, rfd, cls } of rfdOnly) {
    it(`${key} (${cls}) carries RfD ${rfd}, sf null, HH-only`, () => {
      const r = findSubstance(key);
      expect(r).toBeDefined();
      expect(r?.contaminantClass).toBe(cls);
      // Exact equality: these are tiny scientific-notation constants (down to 3e-8),
      // where toBeCloseTo's default 2-decimal precision would also accept 0.
      expect(r?.rfd_oral_mg_per_kg_bw_per_day).toBe(rfd);
      expect(r?.sf_oral_per_mg_per_kg_bw_per_day).toBeNull();
      expect(r?.logKow).toBeNull();
      expect(r?.fcv_ug_per_L).toBeNull();
      expect(r?.trv_eco_mg_per_kg_bw_day).toBeNull();
    });
  }

  // Carcinogens with sf only (rfd null).
  const sfOnly = [
    { key: 'hexachlorobutadiene', sf: 0.078, cls: 'organic-halogenated' },
    { key: 'acrylonitrile', sf: 0.54, cls: 'organic' },
  ] as const;

  for (const { key, sf, cls } of sfOnly) {
    it(`${key} (${cls}) is a carcinogen: sf ${sf} set, rfd null, HH-only`, () => {
      const r = findSubstance(key);
      expect(r).toBeDefined();
      expect(r?.contaminantClass).toBe(cls);
      expect(r?.sf_oral_per_mg_per_kg_bw_per_day).toBe(sf);
      expect(r?.rfd_oral_mg_per_kg_bw_per_day).toBeNull();
      expect(r?.logKow).toBeNull();
      expect(r?.trv_eco_mg_per_kg_bw_day).toBeNull();
    });
  }

  // Both-endpoint substances (sf + rfd) so the calculator picks the conservative.
  const both = [
    { key: 'aldrin', sf: 17, rfd: 3.0e-5, cls: 'organic-halogenated' },
    { key: 'isophorone', sf: 9.5e-4, rfd: 0.2, cls: 'organic' },
  ] as const;

  for (const { key, sf, rfd, cls } of both) {
    it(`${key} (${cls}) carries both endpoints: sf ${sf}, rfd ${rfd}`, () => {
      const r = findSubstance(key);
      expect(r).toBeDefined();
      expect(r?.contaminantClass).toBe(cls);
      expect(r?.sf_oral_per_mg_per_kg_bw_per_day).toBe(sf);
      expect(r?.rfd_oral_mg_per_kg_bw_per_day).toBe(rfd);
      expect(r?.logKow).toBeNull();
      expect(r?.trv_eco_mg_per_kg_bw_day).toBeNull();
    });
  }
});

describe('SUBSTANCE_LIBRARY -- Batch E chlorinated VOCs + organics', () => {
  const expected = [
    { key: 'dichloromethane', rfd: 0.014, sf: 0.002, cls: 'organic-halogenated' },
    { key: 'dichloroethylene_1_1', rfd: 0.003, sf: null, cls: 'organic-halogenated' },
    { key: '1_2_dichloroethane', rfd: null, sf: 0.091, cls: 'organic-halogenated' },
    { key: 'trichloroethane_1_1_2', rfd: 0.004, sf: 0.057, cls: 'organic-halogenated' },
    { key: 'tetrachloroethane_1_1_1_2', rfd: 0.03, sf: 0.026, cls: 'organic-halogenated' },
    { key: 'bis_2_ethylhexyl_phthalate_dehp', rfd: 0.02, sf: 0.014, cls: 'organic' },
    { key: '2_4_6_trinitrotoluene_tnt', rfd: 0.0005, sf: 0.03, cls: 'organic' },
    { key: 'formaldehyde', rfd: 0.2, sf: null, cls: 'organic' },
  ] as const;

  for (const { key, rfd, sf, cls } of expected) {
    it(`${key} carries the expected rfd, sf, and class ${cls}`, () => {
      const result = findSubstance(key);
      expect(result).toBeDefined();
      expect(result?.contaminantClass).toBe(cls);
      expect(result?.rfd_oral_mg_per_kg_bw_per_day).toBe(rfd);
      expect(result?.sf_oral_per_mg_per_kg_bw_per_day).toBe(sf);
    });
  }
});
