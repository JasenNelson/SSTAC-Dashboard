import { describe, expect, it } from 'vitest';
import { SUBSTANCE_LIBRARY, findSubstance } from '../substanceLibrary';

describe('SUBSTANCE_LIBRARY', () => {
  it('has 368 entries', () => {
    // 69 (through 2026-06-19) + 5 BC P28 metals (Batch A) = 74, + 6 HH-only PAHs
    // (Batch B) = 80, + 10 catalog WIRE substances (Batch C, 2026-06-20: aluminum,
    // boron, molybdenum, strontium, phenol, styrene, acetone, hexachlorobenzene,
    // pentachlorophenol, 1_4_dioxane) = 90, + 13 PFAS + HH-only sweep (Batch D,
    // 2026-06-20: perfluoroctanoic_acid_pfoa, perfluorooctane_sulfonate, aldrin,
    // endrin, hexachlorobutadiene, hexachlorocyclopentadiene, isophorone,
    // acrylonitrile, carbon_disulfide, bisphenol_a, nitrobenzene, pyridine,
    // 2_methylnaphthalene) = 103, + 8 chlorinated VOCs / organics (Batch E) = 111,
    // + 8 HH-only IRIS RfD substances (Batch F, 2026-06-24: 1_2_3/1_2_4/1_3_5
    // trimethylbenzene, bromobenzene, isopropylbenzene, chlorotoluene_2,
    // 1_2_4_5_tetrachlorobenzene, 2_4_dinitrotoluene) = 119, + 7 chlorophenoxy
    // herbicides (Batch G) = 126, + 7 nitroaromatic/energetic substances (Batch H,
    // 2026-06-30: 1_3_5_trinitrobenzene, 4_6_dinitro_o_cyclohexyl_phenol,
    // dinitrophenol_2_4, rdx, m_dinitrobenzene, nitroguanidine, hmx) = 133,
    // + 6 PBDE flame retardants (Batch I) = 139, + 7 carbamate pesticides (Batch J) = 146,
    // + 18 herbicides/chlorophenols/glycols (Batch K) = 164. + 22 organophosphate esters (Batch L) = 186. + 20 misc organics (Batch M) = 206. + 20 misc organics (Batch N) = 226. + 22 misc organics (Batch O) = 248. + 20 misc organics (Batch P) = 268. + 20 misc organics (Batch Q) = 288. + 20 misc organics (Batch R) = 308. + 20 misc organics (Batch S) = 328. + 20 misc organics (Batch T) = 348. + 20 misc organics (Batch U) = 368. + 21 misc organics (Batch V) = 389.
    expect(SUBSTANCE_LIBRARY).toHaveLength(389);
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

  it('benzo_a_pyrene has sf_oral value of 2.0', () => {
    const result = findSubstance('benzo_a_pyrene');
    expect(result?.sf_oral_per_mg_per_kg_bw_per_day).toBe(2.0);
  });

  it('benzo_a_pyrene has logKow of 6.13', () => {
    const result = findSubstance('benzo_a_pyrene');
    expect(result?.logKow).toBe(6.13);
  });

  it('lead has rfd_oral value of 5.0e-4', () => {
    const result = findSubstance('lead');
    expect(result?.rfd_oral_mg_per_kg_bw_per_day).toBeCloseTo(5.0e-4);
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

describe('SUBSTANCE_LIBRARY -- Batch F HH-only IRIS RfD substances', () => {
  // All values verified verbatim against the IRIS oral RfD rows carrying qa_status=approved in
  // matrix_research/reference_catalog/human_health_trv_values.json (matched by value + approved
  // status, NOT by a uniform parameter_value_id suffix). NOTE the trimethylbenzene IDs are not
  // uniform: for 1_2_4 / 1_3_5 the approved 0.01 is the unsuffixed pv-iris-<key>-hh-direct-rfd /
  // -hh-food-rfd row, but for 1_2_3 those unsuffixed IDs are a SUPERSEDED needs_review 0.04 and
  // the approved 0.01 lives in the suffixed pv-iris-1_2_3_trimethylbenzene-hh-{direct,food}-rfd-
  // nzene-oral-rfd-2 rows. All single-endpoint (RfD-only, sf null), HH-only (logKow/fcv/trv_eco
  // null -> Eco pathways filtered), abs_dermal 0.03 / ba_oral 1.0.
  const expected = [
    { key: '1_2_3_trimethylbenzene', rfd: 0.01, sf: null, cls: 'organic' },
    { key: '1_2_4_trimethylbenzene', rfd: 0.01, sf: null, cls: 'organic' },
    { key: '1_3_5_trimethylbenzene', rfd: 0.01, sf: null, cls: 'organic' },
    { key: 'bromobenzene', rfd: 0.02, sf: null, cls: 'organic-halogenated' },
    { key: 'isopropylbenzene', rfd: 0.1, sf: null, cls: 'organic' },
    { key: 'chlorotoluene_2', rfd: 0.02, sf: null, cls: 'organic-halogenated' },
    { key: '1_2_4_5_tetrachlorobenzene', rfd: 0.0003, sf: null, cls: 'organic-halogenated' },
    { key: '2_4_dinitrotoluene', rfd: 0.002, sf: null, cls: 'organic' },
  ] as const;

  for (const { key, rfd, sf, cls } of expected) {
    it(`${key} carries the expected rfd, sf, and class ${cls}`, () => {
      const result = findSubstance(key);
      expect(result).toBeDefined();
      expect(result?.contaminantClass).toBe(cls);
      expect(result?.rfd_oral_mg_per_kg_bw_per_day).toBe(rfd);
      expect(result?.sf_oral_per_mg_per_kg_bw_per_day).toBe(sf);
      // HH-only invariant: eco fields null so Eco pathways are filtered out.
      expect(result?.logKow).toBeNull();
      expect(result?.fcv_ug_per_L).toBeNull();
      expect(result?.trv_eco_mg_per_kg_bw_day).toBeNull();
    });
  }
});

describe('SUBSTANCE_LIBRARY -- Batch G chlorophenoxy herbicides', () => {
  const expected = [
    { key: '2_4_dichlorophenoxyacetic_acid_2_4_d', rfd: 0.01, sf: null, cls: 'organic-halogenated' },
    { key: '4_2_4_dichlorophenoxy_butyric_acid_2_4_db', rfd: 0.008, sf: null, cls: 'organic-halogenated' },
    { key: '2_4_5_trichlorophenoxyacetic_acid_2_4_5_t', rfd: 0.01, sf: null, cls: 'organic-halogenated' },
    { key: '2_2_4_5_trichlorophenoxy_propionic_acid_2_4_5_tp', rfd: 0.008, sf: null, cls: 'organic-halogenated' },
    { key: '2_methyl_4_chlorophenoxyacetic_acid_mcpa', rfd: 0.0005, sf: null, cls: 'organic-halogenated' },
    { key: '4_2_methyl_4_chlorophenoxy_butyric_acid_mcpb', rfd: 0.01, sf: null, cls: 'organic-halogenated' },
    { key: '2_2_methyl_4_chlorophenoxy_propionic_acid_mcpp', rfd: 0.001, sf: null, cls: 'organic-halogenated' },
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

describe('SUBSTANCE_LIBRARY -- Batch H nitroaromatics / energetics', () => {
  const expected = [
    { key: '1_3_5_trinitrobenzene', rfd: 0.03, sf: null, cls: 'organic' },
    { key: '4_6_dinitro_o_cyclohexyl_phenol', rfd: 0.002, sf: null, cls: 'organic' },
    { key: 'dinitrophenol_2_4', rfd: 0.002, sf: null, cls: 'organic' },
    { key: 'hexahydro_1_3_5_trinitro_1_3_5_triazine_rdx', rfd: 0.004, sf: 0.08, cls: 'organic' },
    { key: 'm_dinitrobenzene', rfd: 0.0001, sf: null, cls: 'organic' },
    { key: 'nitroguanidine', rfd: 0.1, sf: null, cls: 'organic' },
    { key: 'octahydro_1_3_5_7_tetranitro_1_3_5_7_tetrazocine_hmx', rfd: 0.05, sf: null, cls: 'organic' },
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

describe('SUBSTANCE_LIBRARY -- Batch I PBDE flame retardants', () => {
  const expected = [
    { key: '2_2_3_3_4_4_5_5_6_6_decabromodiphenyl_ether_bde_209', rfd: 0.007, sf: 0.0007, cls: 'organic-halogenated' },
    { key: '2_2_4_4_5_5_hexabromodiphenyl_ether_bde_153', rfd: 0.0002, sf: null, cls: 'organic-halogenated' },
    { key: '2_2_4_4_5_pentabromodiphenyl_ether_bde_99', rfd: 0.0001, sf: null, cls: 'organic-halogenated' },
    { key: '2_2_4_4_tetrabromodiphenyl_ether_bde_47', rfd: 0.0001, sf: null, cls: 'organic-halogenated' },
    { key: 'octabromodiphenyl_ether', rfd: 0.003, sf: null, cls: 'organic-halogenated' },
    { key: 'pentabromodiphenyl_ether', rfd: 0.002, sf: null, cls: 'organic-halogenated' },
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

describe('SUBSTANCE_LIBRARY -- Batch J carbamate pesticides', () => {
  const expected = [
    { key: 'aldicarb', rfd: 0.001, sf: null, cls: 'organic' },
    { key: 'aldicarb_sulfone', rfd: 0.001, sf: null, cls: 'organic' },
    { key: 'carbofuran', rfd: 0.005, sf: null, cls: 'organic' },
    { key: 'methomyl', rfd: 0.025, sf: null, cls: 'organic' },
    { key: 'oxamyl', rfd: 0.025, sf: null, cls: 'organic' },
    { key: 's_ethyl_dipropylthiocarbamate_eptc', rfd: 0.025, sf: null, cls: 'organic' },
    { key: 'sodium_diethyldithiocarbamate', rfd: 0.03, sf: null, cls: 'organic' },
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

describe('SUBSTANCE_LIBRARY -- Batch K herbicides/chlorophenols/glycols', () => {
  const expected = [
    { key: 'atrazine', rfd: 0.035, sf: null, cls: 'organic-halogenated' },
    { key: 'simazine', rfd: 0.005, sf: null, cls: 'organic-halogenated' },
    { key: 'propazine', rfd: 0.02, sf: null, cls: 'organic-halogenated' },
    { key: 'diuron', rfd: 0.002, sf: null, cls: 'organic-halogenated' },
    { key: 'linuron', rfd: 0.002, sf: null, cls: 'organic-halogenated' },
    { key: 'chlorophenol_2', rfd: 0.005, sf: null, cls: 'organic-halogenated' },
    { key: 'dichlorophenol_2_4', rfd: 0.003, sf: null, cls: 'organic-halogenated' },
    { key: 'trichlorophenol_2_4_5', rfd: 0.1, sf: null, cls: 'organic-halogenated' },
    { key: 'tetrachlorophenol_2_3_4_6', rfd: 0.03, sf: null, cls: 'organic-halogenated' },
    { key: 'hexazinone', rfd: 0.033, sf: null, cls: 'organic' },
    { key: 'metribuzin', rfd: 0.025, sf: null, cls: 'organic' },
    { key: 'prometon', rfd: 0.015, sf: null, cls: 'organic' },
    { key: 'tebuthiuron', rfd: 0.07, sf: null, cls: 'organic' },
    { key: 'ethylene_glycol', rfd: 2, sf: null, cls: 'organic' },
    { key: 'ethylene_glycol_monobutyl_ether_egbe_2_butoxyethanol', rfd: 0.1, sf: null, cls: 'organic' },
    { key: 'butylphthalyl_butylglycolate_bpbg', rfd: 1, sf: null, cls: 'organic' },
    { key: 'ethylphthalyl_ethylglycolate_epeg', rfd: 3, sf: null, cls: 'organic' },
    { key: 'sethoxydim', rfd: 0.09, sf: null, cls: 'organic' },
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

describe('SUBSTANCE_LIBRARY -- Batch L organophosphate pesticides', () => {
  const expected = [
    { key: 'acephate', rfd: 0.004, sf: null, cls: 'organic' },
    { key: 'dimethoate', rfd: 0.0002, sf: null, cls: 'organic' },
    { key: 'disulfoton', rfd: 0.00004, sf: null, cls: 'organic' },
    { key: 'ethion', rfd: 0.0005, sf: null, cls: 'organic' },
    { key: 'ethyl_p_nitrophenyl_phenylphosphorothioate_epn', rfd: 0.00001, sf: null, cls: 'organic' },
    { key: 'fenamiphos', rfd: 0.00025, sf: null, cls: 'organic' },
    { key: 'fonofos', rfd: 0.002, sf: null, cls: 'organic' },
    { key: 'glyphosate', rfd: 0.1, sf: null, cls: 'organic' },
    { key: 'isopropyl_methyl_phosphonic_acid_impa', rfd: 0.1, sf: null, cls: 'organic' },
    { key: 'diisopropyl_methylphosphonate_dimp', rfd: 0.08, sf: null, cls: 'organic' },
    { key: 'merphos', rfd: 0.00003, sf: null, cls: 'organic' },
    { key: 'merphos_oxide', rfd: 0.00003, sf: null, cls: 'organic' },
    { key: 'methamidophos', rfd: 0.00005, sf: null, cls: 'organic' },
    { key: 'methidathion', rfd: 0.001, sf: null, cls: 'organic' },
    { key: 'methyl_parathion', rfd: 0.00025, sf: null, cls: 'organic' },
    { key: 'phosmet', rfd: 0.02, sf: null, cls: 'organic' },
    { key: 'pirimiphos_methyl', rfd: 0.01, sf: null, cls: 'organic' },
    { key: 'quinalphos', rfd: 0.0005, sf: null, cls: 'organic' },
    { key: 'tetraethyldithiopyrophosphate', rfd: 0.0005, sf: null, cls: 'organic' },
    { key: 'naled', rfd: 0.002, sf: null, cls: 'organic-halogenated' },
    { key: 'tetrachlorovinphos', rfd: 0.03, sf: null, cls: 'organic-halogenated' },
    { key: 'dichlorvos', rfd: 0.0005, sf: 0.29, cls: 'organic-halogenated' },
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

describe('SUBSTANCE_LIBRARY -- Batch M misc organics', () => {
  const expected = [
    { key: '1_2_4_tribromobenzene', rfd: 0.005, sf: null, cls: 'organic-halogenated' },
    { key: '1_4_dibromobenzene', rfd: 0.01, sf: null, cls: 'organic-halogenated' },
    { key: '1_4_dithiane', rfd: 0.01, sf: null, cls: 'organic' },
    { key: '2_3_7_8_tetrachlorodibenzo_p_dioxin', rfd: 7e-10, sf: null, cls: 'organic-halogenated' },
    { key: '2_3_dichloropropanol', rfd: 0.003, sf: null, cls: 'organic-halogenated' },
    { key: 'acetochlor', rfd: 0.02, sf: null, cls: 'organic-halogenated' },
    { key: 'acetophenone', rfd: 0.1, sf: null, cls: 'organic' },
    { key: 'acifluorfen_sodium', rfd: 0.013, sf: null, cls: 'organic-halogenated' },
    { key: 'acrolein', rfd: 0.0005, sf: null, cls: 'organic' },
    { key: 'acrylamide', rfd: 0.002, sf: 0.83, cls: 'organic' },
    { key: 'acrylic_acid', rfd: 0.5, sf: null, cls: 'organic' },
    { key: 'alachlor', rfd: 0.01, sf: null, cls: 'organic-halogenated' },
    { key: 'allyl_alcohol', rfd: 0.005, sf: null, cls: 'organic' },
    { key: 'benzaldehyde', rfd: 0.1, sf: null, cls: 'organic' },
    { key: 'benzidine', rfd: 0.003, sf: 230, cls: 'organic' },
    { key: 'benzoic_acid', rfd: 4, sf: null, cls: 'organic' },
    { key: 'beta_chloronaphthalene', rfd: 0.08, sf: null, cls: 'organic-halogenated' },
    { key: 'bis_2_chloro_1_methylethyl_ether', rfd: 0.04, sf: null, cls: 'organic-halogenated' },
    { key: 'bromodichloromethane', rfd: 0.02, sf: 0.062, cls: 'organic-halogenated' },
    { key: 'bromomethane', rfd: 0.0014, sf: null, cls: 'organic-halogenated' },
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

describe('SUBSTANCE_LIBRARY -- Batch N misc organics', () => {
  const expected = [
    { key: '1_1_1_trichloroethane', rfd: 2, sf: null, cls: 'organic-halogenated' },
    { key: '2_hexanone', rfd: 0.005, sf: null, cls: 'organic' },
    { key: 'alar', rfd: 0.15, sf: null, cls: 'organic' },
    { key: 'ally', rfd: 0.25, sf: null, cls: 'organic' },
    { key: 'amdro', rfd: 0.0003, sf: null, cls: 'organic-halogenated' },
    { key: 'ametryn', rfd: 0.009, sf: null, cls: 'organic' },
    { key: 'amitraz', rfd: 0.0025, sf: null, cls: 'organic' },
    { key: 'apollo', rfd: 0.013, sf: null, cls: 'organic-halogenated' },
    { key: 'aroclor_1016', rfd: 0.00007, sf: null, cls: 'organic-halogenated' },
    { key: 'assure', rfd: 0.009, sf: null, cls: 'organic-halogenated' },
    { key: 'asulam', rfd: 0.05, sf: null, cls: 'organic' },
    { key: 'avermectin_b1', rfd: 0.0004, sf: null, cls: 'organic' },
    { key: 'baygon', rfd: 0.004, sf: null, cls: 'organic' },
    { key: 'bayleton', rfd: 0.03, sf: null, cls: 'organic-halogenated' },
    { key: 'baythroid', rfd: 0.025, sf: null, cls: 'organic-halogenated' },
    { key: 'benefin', rfd: 0.3, sf: null, cls: 'organic-halogenated' },
    { key: 'bentazon_basagran', rfd: 0.03, sf: null, cls: 'organic' },
    { key: 'bidrin', rfd: 0.0001, sf: null, cls: 'organic' },
    { key: 'biphenthrin', rfd: 0.015, sf: null, cls: 'organic-halogenated' },
    { key: 'bromoxynil', rfd: 0.02, sf: null, cls: 'organic-halogenated' },
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

describe('SUBSTANCE_LIBRARY -- Batch O misc organics', () => {
  const expected = [
    { key: 'bromoxynil_octanoate', rfd: 0.02, sf: null, cls: 'organic-halogenated' },
    { key: 'butylate', rfd: 0.05, sf: null, cls: 'organic' },
    { key: 'caprolactam', rfd: 0.5, sf: null, cls: 'organic' },
    { key: 'captafol', rfd: 0.002, sf: null, cls: 'organic-halogenated' },
    { key: 'captan', rfd: 0.13, sf: null, cls: 'organic-halogenated' },
    { key: 'carbosulfan', rfd: 0.01, sf: null, cls: 'organic' },
    { key: 'carboxin', rfd: 0.1, sf: null, cls: 'organic' },
    { key: 'chloral_hydrate', rfd: 0.1, sf: null, cls: 'organic-halogenated' },
    { key: 'chloramben', rfd: 0.015, sf: null, cls: 'organic-halogenated' },
    { key: 'chlordecone_kepone', rfd: 0.0003, sf: 10, cls: 'organic-halogenated' },
    { key: 'chlorimuron_ethyl', rfd: 0.02, sf: null, cls: 'organic-halogenated' },
    { key: 'chlorobenzilate', rfd: 0.02, sf: null, cls: 'organic-halogenated' },
    { key: 'chlorothalonil', rfd: 0.015, sf: null, cls: 'organic-halogenated' },
    { key: 'chlorpropham', rfd: 0.2, sf: null, cls: 'organic-halogenated' },
    { key: 'chlorsulfuron', rfd: 0.05, sf: null, cls: 'organic-halogenated' },
    { key: 'cis_1_2_dichloroethylene', rfd: 0.002, sf: null, cls: 'organic-halogenated' },
    { key: 'cyclohexanone', rfd: 5, sf: null, cls: 'organic' },
    { key: 'cyclohexylamine', rfd: 0.2, sf: null, cls: 'organic' },
    { key: 'cyhalothrin_karate', rfd: 0.005, sf: null, cls: 'organic-halogenated' },
    { key: 'cypermethrin', rfd: 0.01, sf: null, cls: 'organic-halogenated' },
    { key: 'cyromazine', rfd: 0.0075, sf: null, cls: 'organic' },
    { key: 'dacthal', rfd: 0.01, sf: null, cls: 'organic-halogenated' },
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

describe('SUBSTANCE_LIBRARY -- Batch P misc organics', () => {
  const expected = [
    { key: 'dalapon_sodium_salt', rfd: 0.03, sf: null, cls: 'organic-halogenated' },
    { key: 'danitol', rfd: 0.025, sf: null, cls: 'organic' },
    { key: 'di_2_ethylhexyl_adipate', rfd: 0.6, sf: 0.0012, cls: 'organic' },
    { key: 'dibromochloromethane', rfd: 0.02, sf: 0.084, cls: 'organic-halogenated' },
    { key: 'dibromoethane_1_2', rfd: 0.009, sf: 2, cls: 'organic-halogenated' },
    { key: 'dicamba', rfd: 0.03, sf: null, cls: 'organic-halogenated' },
    { key: 'dichloroacetic_acid', rfd: 0.004, sf: 0.05, cls: 'organic-halogenated' },
    { key: 'dichlorodifluoromethane', rfd: 0.2, sf: null, cls: 'organic-halogenated' },
    { key: 'dichloroethylene_1_2_trans', rfd: 0.02, sf: null, cls: 'organic-halogenated' },
    { key: 'dichloropropene_1_3_cis_trans', rfd: 0.03, sf: 0.1, cls: 'organic-halogenated' },
    { key: 'diethyl_ether', rfd: 0.2, sf: null, cls: 'organic' },
    { key: 'difenzoquat', rfd: 0.08, sf: null, cls: 'organic' },
    { key: 'diflubenzuron', rfd: 0.02, sf: null, cls: 'organic-halogenated' },
    { key: 'dimethipin', rfd: 0.02, sf: null, cls: 'organic' },
    { key: 'dimethyl_terephthalate_dmt', rfd: 0.1, sf: null, cls: 'organic' },
    { key: 'dimethylaniline_n_n_dma', rfd: 0.002, sf: null, cls: 'organic' },
    { key: 'dimethylphenol_2_4', rfd: 0.02, sf: null, cls: 'organic' },
    { key: 'dimethylphenol_2_6', rfd: 0.0006, sf: null, cls: 'organic' },
    { key: 'dimethylphenol_3_4', rfd: 0.001, sf: null, cls: 'organic' },
    { key: 'dinoseb', rfd: 0.001, sf: null, cls: 'organic' },
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

describe('SUBSTANCE_LIBRARY -- Batch Q misc organics', () => {
  const expected = [
    { key: 'benomyl', rfd: 0.05, sf: null, cls: 'organic' },
    { key: 'diphenamid', rfd: 0.03, sf: null, cls: 'organic' },
    { key: 'diphenylamine', rfd: 0.025, sf: null, cls: 'organic' },
    { key: 'diquat', rfd: 0.0022, sf: null, cls: 'organic' },
    { key: 'dodine', rfd: 0.004, sf: null, cls: 'organic' },
    { key: 'endothall', rfd: 0.02, sf: null, cls: 'organic' },
    { key: 'epichlorohydrin', rfd: null, sf: 0.0099, cls: 'organic-halogenated' },
    { key: 'ethephon', rfd: 0.005, sf: null, cls: 'organic-halogenated' },
    { key: 'ethyl_acetate', rfd: 0.9, sf: null, cls: 'organic' },
    { key: 'ethyl_tertiary_butyl_ether_etbe', rfd: 1, sf: null, cls: 'organic' },
    { key: 'ethylene_thiourea_etu', rfd: 0.00008, sf: null, cls: 'organic' },
    { key: 'express', rfd: 0.008, sf: null, cls: 'organic' },
    { key: 'fluometuron', rfd: 0.013, sf: null, cls: 'organic-halogenated' },
    { key: 'fluridone', rfd: 0.08, sf: null, cls: 'organic-halogenated' },
    { key: 'flurprimidol', rfd: 0.02, sf: null, cls: 'organic-halogenated' },
    { key: 'flutolanil', rfd: 0.06, sf: null, cls: 'organic-halogenated' },
    { key: 'fluvalinate', rfd: 0.01, sf: null, cls: 'organic-halogenated' },
    { key: 'folpet', rfd: 0.1, sf: null, cls: 'organic-halogenated' },
    { key: 'fosetyl_al', rfd: 3, sf: null, cls: 'organic' },
    { key: 'furan', rfd: 0.001, sf: null, cls: 'organic' },
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

describe('SUBSTANCE_LIBRARY -- Batch R misc organics', () => {
  const expected = [
    { key: 'furfural', rfd: 0.003, sf: null, cls: 'organic' },
    { key: 'furmecyclox', rfd: null, sf: 0.03, cls: 'organic' },
    { key: 'glufosinate_ammonium', rfd: 0.0004, sf: null, cls: 'organic' },
    { key: 'glycidaldehyde', rfd: 0.0004, sf: null, cls: 'organic' },
    { key: 'haloxyfop_methyl', rfd: 0.00005, sf: null, cls: 'organic-halogenated' },
    { key: 'harmony', rfd: 0.013, sf: null, cls: 'organic' },
    { key: 'hexabromobenzene', rfd: 0.002, sf: null, cls: 'organic-halogenated' },
    { key: 'hexachlorodibenzo_p_dioxin_hxcdd_mixture_of_1_2_3_6_7_8_hxcdd_and_1_2_3_7_8_9_hxcdd', rfd: null, sf: 6200, cls: 'organic-halogenated' },
    { key: 'hexachlorophene', rfd: 0.0003, sf: null, cls: 'organic-halogenated' },
    { key: 'imazalil', rfd: 0.013, sf: null, cls: 'organic-halogenated' },
    { key: 'imazaquin', rfd: 0.25, sf: null, cls: 'organic' },
    { key: 'iprodione', rfd: 0.04, sf: null, cls: 'organic-halogenated' },
    { key: 'isobutyl_alcohol', rfd: 0.3, sf: null, cls: 'organic' },
    { key: 'isopropalin', rfd: 0.015, sf: null, cls: 'organic' },
    { key: 'isoxaben', rfd: 0.05, sf: null, cls: 'organic' },
    { key: 'lactofen', rfd: 0.002, sf: null, cls: 'organic-halogenated' },
    { key: 'londax', rfd: 0.2, sf: null, cls: 'organic' },
    { key: 'm_phenylenediamine', rfd: 0.006, sf: null, cls: 'organic' },
    { key: 'maleic_anhydride', rfd: 0.1, sf: null, cls: 'organic' },
    { key: 'maleic_hydrazide', rfd: 0.5, sf: null, cls: 'organic' },
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

describe('SUBSTANCE_LIBRARY -- Batch S misc organics', () => {
  const expected = [
    { key: 'maneb', rfd: 0.005, sf: null, cls: 'organic' },
    { key: 'mepiquat_chloride', rfd: 0.03, sf: null, cls: 'organic' },
    { key: 'metalaxyl', rfd: 0.06, sf: null, cls: 'organic' },
    { key: 'methacrylonitrile', rfd: 0.0001, sf: null, cls: 'organic' },
    { key: 'methanol', rfd: 2, sf: null, cls: 'organic' },
    { key: 'methyl_ethyl_ketone_mek', rfd: 0.6, sf: null, cls: 'organic' },
    { key: 'methyl_methacrylate', rfd: 1.4, sf: null, cls: 'organic' },
    { key: 'methylnaphthalene_2', rfd: 0.004, sf: null, cls: 'organic-PAH' },
    { key: 'methylphenol_2', rfd: 0.05, sf: null, cls: 'organic' },
    { key: 'methylphenol_3', rfd: 0.05, sf: null, cls: 'organic' },
    { key: 'metolachlor', rfd: 0.15, sf: null, cls: 'organic-halogenated' },
    { key: 'molinate', rfd: 0.002, sf: null, cls: 'organic' },
    { key: 'n_butanol', rfd: 0.1, sf: null, cls: 'organic' },
    { key: 'n_hexane', rfd: 0.1, sf: null, cls: 'organic' },
    { key: 'n_nitroso_di_n_butylamine', rfd: null, sf: 5.4, cls: 'organic' },
    { key: 'n_nitroso_n_methylethylamine', rfd: null, sf: 22, cls: 'organic' },
    { key: 'n_nitrosodi_n_propylamine', rfd: null, sf: 7, cls: 'organic' },
    { key: 'n_nitrosodiethanolamine', rfd: null, sf: 2.8, cls: 'organic' },
    { key: 'n_nitrosodiethylamine', rfd: null, sf: 150, cls: 'organic' },
    { key: 'n_nitrosodimethylamine', rfd: null, sf: 51, cls: 'organic' },
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

describe('SUBSTANCE_LIBRARY -- Batch T misc organics', () => {
  const expected = [
    { key: 'n_nitrosodiphenylamine', rfd: null, sf: 0.0049, cls: 'organic' },
    { key: 'n_nitrosopyrrolidine', rfd: null, sf: 2.1, cls: 'organic' },
    { key: 'napropamide', rfd: 0.1, sf: null, cls: 'organic' },
    { key: 'norflurazon', rfd: 0.04, sf: null, cls: 'organic-halogenated' },
    { key: 'nustar', rfd: 0.0007, sf: null, cls: 'organic-halogenated' },
    { key: 'oryzalin', rfd: 0.05, sf: null, cls: 'organic' },
    { key: 'oxadiazon', rfd: 0.005, sf: null, cls: 'organic-halogenated' },
    { key: 'oxyfluorfen', rfd: 0.003, sf: null, cls: 'organic-halogenated' },
    { key: 'p_chloroaniline', rfd: 0.004, sf: null, cls: 'organic-halogenated' },
    { key: 'p_p_dichlorodiphenyl_dichloroethane_ddd', rfd: null, sf: 0.24, cls: 'organic-halogenated' },
    { key: 'p_p_dichlorodiphenyldichloroethylene_dde', rfd: null, sf: 0.34, cls: 'organic-halogenated' },
    { key: 'paclobutrazol', rfd: 0.013, sf: null, cls: 'organic-halogenated' },
    { key: 'paraquat', rfd: 0.0045, sf: null, cls: 'organic' },
    { key: 'pendimethalin', rfd: 0.04, sf: null, cls: 'organic' },
    { key: 'pentachloronitrobenzene_pcnb', rfd: 0.003, sf: null, cls: 'organic-halogenated' },
    { key: 'perfluorobutanoic_acid_pfba', rfd: 0.001, sf: null, cls: 'organic-halogenated' },
    { key: 'perfluorodecanoic_acid_pfda', rfd: 2.0e-9, sf: null, cls: 'organic-halogenated' },
    { key: 'perfluorohexanoic_acid_pfhxa', rfd: 0.0005, sf: null, cls: 'organic-halogenated' },
    { key: 'permethrin_cis_trans', rfd: 0.05, sf: null, cls: 'organic-halogenated' },
    { key: 'phenmedipham', rfd: 0.25, sf: null, cls: 'organic' },
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

describe('SUBSTANCE_LIBRARY -- Batch U misc organics', () => {
  const expected = [
    { key: 'phthalic_anhydride', rfd: 2, sf: null, cls: 'organic' },
    { key: 'picloram', rfd: 0.07, sf: null, cls: 'organic-halogenated' },
    { key: 'prochloraz', rfd: 0.009, sf: 0.15, cls: 'organic-halogenated' },
    { key: 'prometryn', rfd: 0.004, sf: null, cls: 'organic' },
    { key: 'pronamide', rfd: 0.075, sf: null, cls: 'organic-halogenated' },
    { key: 'propachlor', rfd: 0.013, sf: null, cls: 'organic-halogenated' },
    { key: 'propanil', rfd: 0.005, sf: null, cls: 'organic-halogenated' },
    { key: 'propargite', rfd: 0.02, sf: null, cls: 'organic' },
    { key: 'propargyl_alcohol', rfd: 0.002, sf: null, cls: 'organic' },
    { key: 'propham', rfd: 0.02, sf: null, cls: 'organic' },
    { key: 'propiconazole', rfd: 0.013, sf: null, cls: 'organic-halogenated' },
    { key: 'propylene_oxide', rfd: null, sf: 0.24, cls: 'organic' },
    { key: 'pursuit', rfd: 0.25, sf: null, cls: 'organic' },
    { key: 'pydrin', rfd: 0.025, sf: null, cls: 'organic-halogenated' },
    { key: 'quinoline', rfd: null, sf: 3, cls: 'organic' },
    { key: 'resmethrin', rfd: 0.03, sf: null, cls: 'organic' },
    { key: 'rotenone', rfd: 0.004, sf: null, cls: 'organic' },
    { key: 'savey', rfd: 0.025, sf: null, cls: 'organic-halogenated' },
    { key: 'sodium_fluoroacetate', rfd: 0.00002, sf: null, cls: 'organic-halogenated' },
    { key: 'strychnine', rfd: 0.0003, sf: null, cls: 'organic' },
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

describe('SUBSTANCE_LIBRARY -- Batch V misc organics', () => {
  const expected = [
    { key: 'systhane', rfd: 0.025, sf: null, cls: 'organic-halogenated' },
    { key: 'terbacil', rfd: 0.013, sf: null, cls: 'organic-halogenated' },
    { key: 'terbutryn', rfd: 0.001, sf: null, cls: 'organic' },
    { key: 'tert_butyl_alcohol_tba', rfd: 0.4, sf: 0.0005, cls: 'organic' },
    { key: 'tetrahydrofuran', rfd: 0.9, sf: null, cls: 'organic' },
    { key: 'thiobencarb', rfd: 0.01, sf: null, cls: 'organic-halogenated' },
    { key: 'thiophanate_methyl', rfd: 0.08, sf: null, cls: 'organic' },
    { key: 'thiram', rfd: 0.005, sf: null, cls: 'organic' },
    { key: 'tralomethrin', rfd: 0.0075, sf: null, cls: 'organic-halogenated' },
    { key: 'triallate', rfd: 0.013, sf: null, cls: 'organic-halogenated' },
    { key: 'triasulfuron', rfd: 0.01, sf: null, cls: 'organic-halogenated' },
    { key: 'trichloro_1_2_2_trifluoroethane_1_1_2', rfd: 30, sf: null, cls: 'organic-halogenated' },
    { key: 'trichloroacetic_acid', rfd: 0.02, sf: 0.07, cls: 'organic-halogenated' },
    { key: 'trichlorofluoromethane', rfd: 0.3, sf: null, cls: 'organic-halogenated' },
    { key: 'trichloropropane_1_1_2', rfd: 0.005, sf: null, cls: 'organic-halogenated' },
    { key: 'trichloropropane_1_2_3', rfd: 0.004, sf: 0.5, cls: 'organic-halogenated' },
    { key: 'tridiphane', rfd: 0.003, sf: null, cls: 'organic-halogenated' },
    { key: 'trifluralin', rfd: 0.0075, sf: 0.0077, cls: 'organic-halogenated' },
    { key: 'vernam', rfd: 0.001, sf: null, cls: 'organic' },
    { key: 'vinclozolin', rfd: 0.025, sf: null, cls: 'organic-halogenated' },
    { key: 'warfarin', rfd: 0.0003, sf: null, cls: 'organic' },
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
