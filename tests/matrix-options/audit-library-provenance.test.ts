import { describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import { runAudit, runAuditOnLibrary } from '../../scripts/matrix-options/audit-library-provenance.mjs';
import { SUBSTANCE_LIBRARY } from '../../src/lib/matrix-options/substanceLibrary';

describe('audit-library-provenance unit tests', () => {
  it('should run successfully on the live database and return findings', () => {
    const findings = runAudit();
    expect(Array.isArray(findings)).toBe(true);
  });

  it('should detect missing approved rows for every non-null catalog-backed field when catalogs are empty', () => {
    const originalRead = fs.readFileSync;
    const readSpy = vi.spyOn(fs, 'readFileSync').mockImplementation((path, options) => {
      if (typeof path === 'string' && path.endsWith('.json')) {
        return '[]';
      }
      return originalRead(path, options);
    });

    const findings = runAudit();
    expect(Array.isArray(findings)).toBe(true);

    // Compute expected count of non-null catalog-backed fields dynamically from SUBSTANCE_LIBRARY
    let expectedCount = 0;
    const fields = [
      'rfd_oral_mg_per_kg_bw_per_day',
      'sf_oral_per_mg_per_kg_bw_per_day',
      'logKow',
      'bsaf_loc_freshwater',
      'fcv_ug_per_L',
      'trv_eco_mg_per_kg_bw_day'
    ];
    for (const entry of SUBSTANCE_LIBRARY) {
      for (const field of fields) {
        if ((entry as any)[field] !== null && (entry as any)[field] !== undefined) {
          expectedCount++;
        }
      }
    }

    const noApprovedRowFindings = findings.filter(f => f.check.endsWith('_NO_APPROVED_ROW'));
    expect(noApprovedRowFindings.length).toBe(expectedCount);

    readSpy.mockRestore();
  });

  it('should throw an error and fail fast if a catalog file fails to load or parse', () => {
    const readSpy = vi.spyOn(fs, 'readFileSync').mockImplementationOnce(() => {
      throw new Error('Mock load failure');
    });

    expect(() => runAudit()).toThrow('Mock load failure');
    readSpy.mockRestore();
  });

  it('should avoid substring false-positives for parameter_value_id in citations', () => {
    const mockLibrary = [
      {
        key: 'substance_a',
        displayName: 'Substance A',
        contaminantClass: 'organic',
        logKow: null,
        rfd_oral_mg_per_kg_bw_per_day: 0.05,
        sf_oral_per_mg_per_kg_bw_per_day: null,
        bsaf_loc_freshwater: null,
        abs_dermal: 0.1,
        ba_oral: 1.0,
        fcv_ug_per_L: null,
        trv_eco_mg_per_kg_bw_day: null,
        sources: 'pv-substance-a-rfd-water', // contains PVID as substring but not exact match
      }
    ];

    const mockCatalog = [
      {
        parameter_value_id: 'pv-substance-a-rfd',
        substance_key: 'substance_a',
        pathway: 'human-health-direct',
        input_key: 'rfd_oral_mg_per_kg_bw_day',
        value: 0.05,
        qa_status: 'approved',
      }
    ];

    const findings = runAuditOnLibrary(mockLibrary as any, mockCatalog);
    expect(findings.some(f => f.check === 'CITATION_MISSING_PVID')).toBe(true);
  });

  it('should catch invalid field types', () => {
    const mockLibrary = [
      {
        key: '',
        displayName: 'Test empty key',
        contaminantClass: 'organic',
        logKow: 'invalid-string', // should be number
        rfd_oral_mg_per_kg_bw_per_day: null,
        sf_oral_per_mg_per_kg_bw_per_day: null,
        bsaf_loc_freshwater: null,
        abs_dermal: 0.1,
        ba_oral: 1.0,
        fcv_ug_per_L: null,
        trv_eco_mg_per_kg_bw_day: null,
        sources: 'Test source',
      },
      {
        key: 'test_substance',
        displayName: 123, // should be string
        contaminantClass: 'organic',
        logKow: null,
        rfd_oral_mg_per_kg_bw_per_day: null,
        sf_oral_per_mg_per_kg_bw_per_day: null,
        bsaf_loc_freshwater: null,
        abs_dermal: null, // should be number
        ba_oral: 1.0,
        fcv_ug_per_L: null,
        trv_eco_mg_per_kg_bw_day: null,
        sources: 456, // should be string
      }
    ];

    const findings = runAuditOnLibrary(mockLibrary as any, []);
    
    expect(findings.some(f => f.check === 'INVALID_FIELD_TYPE' && f.detail.includes('key'))).toBe(true);
    expect(findings.some(f => f.check === 'INVALID_FIELD_TYPE' && f.detail.includes('logKow'))).toBe(true);
    expect(findings.some(f => f.check === 'INVALID_FIELD_TYPE' && f.detail.includes('displayName'))).toBe(true);
    expect(findings.some(f => f.check === 'INVALID_FIELD_TYPE' && f.detail.includes('abs_dermal'))).toBe(true);
    expect(findings.some(f => f.check === 'INVALID_FIELD_TYPE' && f.detail.includes('sources'))).toBe(true);
  });

  it('should catch invalid contaminant class', () => {
    const mockLibrary = [
      {
        key: 'test_substance',
        displayName: 'Test',
        contaminantClass: 'invalid-class-name',
        logKow: null,
        rfd_oral_mg_per_kg_bw_per_day: null,
        sf_oral_per_mg_per_kg_bw_per_day: null,
        bsaf_loc_freshwater: null,
        abs_dermal: 0.1,
        ba_oral: 1.0,
        fcv_ug_per_L: null,
        trv_eco_mg_per_kg_bw_day: null,
        sources: 'Test source',
      }
    ];

    const findings = runAuditOnLibrary(mockLibrary as any, []);
    expect(findings.some(f => f.check === 'INVALID_CONTAMINANT_CLASS')).toBe(true);
  });

  it('should catch RFD value consistency issues', () => {
    const mockLibrary = [
      {
        key: 'substance_a',
        displayName: 'Substance A',
        contaminantClass: 'organic',
        logKow: null,
        rfd_oral_mg_per_kg_bw_per_day: 0.05,
        sf_oral_per_mg_per_kg_bw_per_day: null,
        bsaf_loc_freshwater: null,
        abs_dermal: 0.1,
        ba_oral: 1.0,
        fcv_ug_per_L: null,
        trv_eco_mg_per_kg_bw_day: null,
        sources: 'pv-substance-a-rfd',
      }
    ];

    const mockCatalog = [
      {
        parameter_value_id: 'pv-substance-a-rfd',
        substance_key: 'substance_a',
        pathway: 'human-health-direct',
        input_key: 'rfd_oral_mg_per_kg_bw_day',
        value: 0.02, // doesn't match library's 0.05
        qa_status: 'approved',
      }
    ];

    const findings1 = runAuditOnLibrary(mockLibrary as any, mockCatalog);
    expect(findings1.some(f => f.check === 'RFD_ORAL_MG_PER_KG_BW_PER_DAY_VALUE_MISMATCH')).toBe(true);

    const findings2 = runAuditOnLibrary(mockLibrary as any, []);
    expect(findings2.some(f => f.check === 'RFD_ORAL_MG_PER_KG_BW_PER_DAY_NO_APPROVED_ROW')).toBe(true);
  });

  it('should catch citation and stale notes issues', () => {
    const mockLibrary = [
      {
        key: 'substance_a',
        displayName: 'Substance A',
        contaminantClass: 'organic',
        logKow: null,
        rfd_oral_mg_per_kg_bw_per_day: 0.05,
        sf_oral_per_mg_per_kg_bw_per_day: null,
        bsaf_loc_freshwater: null,
        abs_dermal: 0.1,
        ba_oral: 1.0,
        fcv_ug_per_L: null,
        trv_eco_mg_per_kg_bw_day: null,
        sources: 'Some text missing the PVID', // missing 'pv-substance-a-rfd'
        notes: 'HH RfD not wired', // stale notes since value is wired
      }
    ];

    const mockCatalog = [
      {
        parameter_value_id: 'pv-substance-a-rfd',
        substance_key: 'substance_a',
        pathway: 'human-health-direct',
        input_key: 'rfd_oral_mg_per_kg_bw_day',
        value: 0.05,
        qa_status: 'approved',
      }
    ];

    const findings = runAuditOnLibrary(mockLibrary as any, mockCatalog);
    expect(findings.some(f => f.check === 'CITATION_MISSING_PVID')).toBe(true);
    expect(findings.some(f => f.check === 'STALE_NOTES_RFD')).toBe(true);
  });

  it('should catch stale notes when notes describe approved catalog row as pending/needs_review', () => {
    const mockLibrary = [
      {
        key: 'substance_a',
        displayName: 'Substance A',
        contaminantClass: 'organic',
        logKow: null,
        rfd_oral_mg_per_kg_bw_per_day: 0.05,
        sf_oral_per_mg_per_kg_bw_per_day: null,
        bsaf_loc_freshwater: null,
        abs_dermal: 0.1,
        ba_oral: 1.0,
        fcv_ug_per_L: null,
        trv_eco_mg_per_kg_bw_day: null,
        sources: 'pv-substance-a-rfd',
        notes: 'Oral RfD is pending needs_review under pv-substance-a-rfd',
      }
    ];

    const mockCatalog = [
      {
        parameter_value_id: 'pv-substance-a-rfd',
        substance_key: 'substance_a',
        pathway: 'human-health-direct',
        input_key: 'rfd_oral_mg_per_kg_bw_day',
        value: 0.05,
        qa_status: 'approved', // it is now approved in catalog!
      }
    ];

    const findings = runAuditOnLibrary(mockLibrary as any, mockCatalog);
    expect(findings.some(f => f.check === 'STALE_NOTES_QA_STATUS')).toBe(true);
  });
  it('should catch cross-source value divergence >= 10x', () => {
    const mockLibrary = [
      {
        key: 'substance_b',
        displayName: 'Substance B',
        contaminantClass: 'organic',
        logKow: null,
        rfd_oral_mg_per_kg_bw_per_day: 0.1,
        sf_oral_per_mg_per_kg_bw_per_day: null,
        bsaf_loc_freshwater: null,
        abs_dermal: 0.1,
        ba_oral: 1.0,
        fcv_ug_per_L: null,
        trv_eco_mg_per_kg_bw_day: null,
        sources: 'pv-1',
      }
    ];

    const mockCatalog = [
      {
        parameter_value_id: 'pv-1',
        substance_key: 'substance_b',
        pathway: 'human-health-direct',
        input_key: 'rfd_oral_mg_per_kg_bw_day',
        value: 0.1,
        qa_status: 'approved',
      },
      {
        parameter_value_id: 'pv-2',
        substance_key: 'substance_b',
        pathway: 'human-health-direct',
        input_key: 'rfd_oral_mg_per_kg_bw_day',
        value: 1.5, // 1.5 / 0.1 = 15x, >= 10x
        qa_status: 'approved',
      }
    ];

    const findings = runAuditOnLibrary(mockLibrary as any, mockCatalog);
    const divCheck = findings.find(f => f.check === 'CROSS_SOURCE_VALUE_DIVERGENCE');
    expect(divCheck).toBeDefined();
    expect(divCheck?.severity).toBe('info');
    expect(divCheck?.ratio).toBe(15);
  });

  // 2026-07-06: wrong-SUBSTANCE mode guard (the divergence check above catches wrong-VALUE mode).
  // Catches evidence text citing a DIFFERENT substance name than the row it's attached to -- the class
  // of error the chlorobenzene 1,2-DCB mis-attribution theory (2026-07-05) worried about (that specific
  // theory turned out to be unfounded, but the general failure mode is real and worth guarding).
  it('flags an HC TRV v4.0 row whose evidence locator cites a different substance name', () => {
    const mockCatalog = [
      {
        parameter_value_id: 'pv-hc-test_substance-hh-direct-rfd',
        substance_key: 'test_substance',
        display_name: 'Test Substance',
        pathway: 'human-health-direct',
        input_key: 'rfd_oral_mg_per_kg_bw_day',
        value: 0.1,
        qa_status: 'approved',
        source_ids: ['src-health-canada-trv-v4-2025'],
        evidence_items: [
          {
            locator: 'Health Canada TRVs v4.0 (2025), Table 1, Some Other Chemical, Type=Oral TDI, page 30',
            value_text: '1.0E-01 mg/kgBW-day',
          },
        ],
      },
    ];

    const findings = runAuditOnLibrary([], mockCatalog);
    const mismatch = findings.find((f) => f.check === 'EVIDENCE_SUBSTANCE_NAME_MISMATCH');
    expect(mismatch).toBeDefined();
    expect(mismatch?.severity).toBe('medium');
    expect(mismatch?.cited_name).toBe('Some Other Chemical');
  });

  it('does not flag an HC TRV v4.0 row whose evidence locator correctly names the substance', () => {
    const mockCatalog = [
      {
        parameter_value_id: 'pv-hc-chlorobenzene-hh-direct-rfd',
        substance_key: 'chlorobenzene',
        display_name: 'Chlorobenzene',
        pathway: 'human-health-direct',
        input_key: 'rfd_oral_mg_per_kg_bw_day',
        value: 0.43,
        qa_status: 'approved',
        source_ids: ['src-health-canada-trv-v4-2025'],
        evidence_items: [
          {
            locator: 'Health Canada TRVs v4.0 (2025), Table 1, Chlorobenzene, Type=Oral TDI, page 25',
            value_text: '4.3E-01 mg/kgBW-day',
          },
        ],
      },
    ];

    const findings = runAuditOnLibrary([], mockCatalog);
    expect(findings.some((f) => f.check === 'EVIDENCE_SUBSTANCE_NAME_MISMATCH')).toBe(false);
  });

  it('should find zero name mismatches on the live catalog', () => {
    const findings = runAudit();
    const mismatches = findings.filter((f) => f.check === 'EVIDENCE_SUBSTANCE_NAME_MISMATCH');
    expect(mismatches).toEqual([]);
  });

  // 2026-07-06 codex round 1: the original [^,]+ locator regex stopped at the FIRST comma, silently
  // skipping 23 of 92 real HC locators whose cited substance name itself contains a comma (e.g.
  // "Dichlorobenzene, 1,2-", "Chromium, hexavalent"). Fixed with a non-greedy `.+?` capture; this test
  // pins the regression so it can't silently reappear.
  it('correctly parses a comma-containing substance name in the HC locator (no false negative)', () => {
    const mockCatalog = [
      {
        parameter_value_id: 'pv-hc-dichlorobenzene_1_2-hh-direct-rfd',
        substance_key: 'dichlorobenzene_1_2',
        display_name: '1,2-Dichlorobenzene',
        pathway: 'human-health-direct',
        input_key: 'rfd_oral_mg_per_kg_bw_day',
        value: 0.43,
        qa_status: 'approved',
        source_ids: ['src-health-canada-trv-v4-2025'],
        evidence_items: [
          {
            locator: 'Health Canada TRVs v4.0 (2025), Table 1, Dichlorobenzene, 1,2-, Type=Oral TDI, page 28',
            value_text: '4.3E-01 mg/kgBW-day',
          },
        ],
      },
    ];

    const findings = runAuditOnLibrary([], mockCatalog);
    // Correct: no mismatch, since "dichlorobenzene" overlaps between the cited name and substance_key.
    expect(findings.some((f) => f.check === 'EVIDENCE_SUBSTANCE_NAME_MISMATCH')).toBe(false);
  });

  it('still flags a wrong-substance mismatch even when the cited name has an internal comma', () => {
    const mockCatalog = [
      {
        parameter_value_id: 'pv-hc-dichlorobenzene_1_2-hh-direct-rfd',
        substance_key: 'dichlorobenzene_1_2',
        display_name: '1,2-Dichlorobenzene',
        pathway: 'human-health-direct',
        input_key: 'rfd_oral_mg_per_kg_bw_day',
        value: 0.43,
        qa_status: 'approved',
        source_ids: ['src-health-canada-trv-v4-2025'],
        evidence_items: [
          {
            // Wrong substance entirely, but the cited name still has an internal comma -- must still
            // be flagged, proving the fix didn't just make the regex permissive enough to stop flagging.
            locator: 'Health Canada TRVs v4.0 (2025), Table 1, Chromium, hexavalent, Type=Oral TDI, page 27',
            value_text: '4.3E-01 mg/kgBW-day',
          },
        ],
      },
    ];

    const findings = runAuditOnLibrary([], mockCatalog);
    const mismatch = findings.find((f) => f.check === 'EVIDENCE_SUBSTANCE_NAME_MISMATCH');
    expect(mismatch).toBeDefined();
    expect(mismatch?.cited_name).toBe('Chromium, hexavalent');
  });

  it('does not crash on a null element inside evidence_items', () => {
    const mockCatalog = [
      {
        parameter_value_id: 'pv-hc-benzene-hh-direct-rfd',
        substance_key: 'benzene',
        display_name: 'Benzene',
        pathway: 'human-health-direct',
        input_key: 'rfd_oral_mg_per_kg_bw_day',
        value: 0.0004,
        qa_status: 'approved',
        source_ids: ['src-health-canada-trv-v4-2025'],
        // A null array element must be skipped, not abort the whole audit run.
        evidence_items: [
          null,
          {
            locator: 'Health Canada TRVs v4.0 (2025), Table 1, Benzene, Type=Oral TDI, page 12',
            value_text: '4.0E-04 mg/kgBW-day',
          },
        ],
      },
    ];

    expect(() => runAuditOnLibrary([], mockCatalog)).not.toThrow();
    const findings = runAuditOnLibrary([], mockCatalog);
    // The good (non-null) item correctly names Benzene, so no mismatch is raised.
    expect(findings.some((f) => f.check === 'EVIDENCE_SUBSTANCE_NAME_MISMATCH')).toBe(false);
  });

  it('parses the HC v4.0 locator variant that omits Type= (endpoint + PDF page) without false positive', () => {
    const mockCatalog = [
      {
        parameter_value_id: 'pv-hc-benzo_a_pyrene-hh-direct-sf',
        substance_key: 'benzo_a_pyrene',
        display_name: 'Benzo[a]pyrene',
        pathway: 'human-health-direct',
        input_key: 'sf_oral_per_mg_per_kg_bw_day',
        value: 2.0,
        qa_status: 'approved',
        source_ids: ['src-health-canada-trv-v4-2025'],
        evidence_items: [
          {
            // No "Type=" -- the live (b) shape: "..., <Name>, <endpoint>, PDF page <n>, ...".
            locator:
              'Health Canada TRVs v4.0, Table 1, Benzo[a]pyrene (BaP), Oral SF, PDF page 19, web page checked 2026-05-23',
            value_text: '2.0 per mg/kgBW-day',
          },
        ],
      },
    ];

    const findings = runAuditOnLibrary([], mockCatalog);
    // Cited "Benzo[a]pyrene (BaP)" shares the "benzo" / "pyrene" tokens with the row -> no mismatch.
    expect(findings.some((f) => f.check === 'EVIDENCE_SUBSTANCE_NAME_MISMATCH')).toBe(false);
  });

  it('flags a wrong-substance mismatch in the Type=-omitting locator variant', () => {
    const mockCatalog = [
      {
        parameter_value_id: 'pv-hc-cadmium-hh-direct-rfd',
        substance_key: 'cadmium',
        display_name: 'Cadmium',
        pathway: 'human-health-direct',
        input_key: 'rfd_oral_mg_per_kg_bw_day',
        value: 0.0005,
        qa_status: 'approved',
        source_ids: ['src-health-canada-trv-v4-2025'],
        evidence_items: [
          {
            // Wrong substance cited, in the no-Type= shape -- must still be flagged now that the
            // regex parses this variant.
            locator:
              'Health Canada TRVs v4.0, Table 1, Copper, Oral TDI, PDF page 27, web page checked 2026-05-23',
            value_text: '5.0E-04 mg/kgBW-day',
          },
        ],
      },
    ];

    const findings = runAuditOnLibrary([], mockCatalog);
    const mismatch = findings.find((f) => f.check === 'EVIDENCE_SUBSTANCE_NAME_MISMATCH');
    expect(mismatch).toBeDefined();
    expect(mismatch?.cited_name).toBe('Copper');
  });

  it('flags a wrong-substance swap that shares only a generic chemistry token', () => {
    const mockCatalog = [
      {
        parameter_value_id: 'pv-hc-vinyl_chloride-hh-direct-rfd',
        substance_key: 'vinyl_chloride',
        display_name: 'Vinyl chloride',
        pathway: 'human-health-direct',
        input_key: 'rfd_oral_mg_per_kg_bw_day',
        value: 0.003,
        qa_status: 'approved',
        source_ids: ['src-health-canada-trv-v4-2025'],
        evidence_items: [
          {
            // Wrong substance; shares only the generic group word "chloride" with the row. Must be
            // flagged -- generic tokens are stopworded so the overlap must rest on a distinctive token.
            locator: 'Health Canada TRVs v4.0, Table 1, Nickel chloride, Type=Oral TDI, PDF page 37',
            value_text: '3.0E-03 mg/kgBW-day',
          },
        ],
      },
    ];

    const findings = runAuditOnLibrary([], mockCatalog);
    const mismatch = findings.find((f) => f.check === 'EVIDENCE_SUBSTANCE_NAME_MISMATCH');
    expect(mismatch).toBeDefined();
    expect(mismatch?.cited_name).toBe('Nickel chloride');
  });

  // 2026-07-06: extended the divergence check beyond HH-direct rfd/sf to also cover HH-food, the two
  // HH inhalation input_keys, and the two eco input_keys/pathways.
  it('catches cross-source divergence on rfc_inhalation_mg_per_m3 (HH inhalation)', () => {
    const mockCatalog = [
      { parameter_value_id: 'pv-1', substance_key: 'substance_rfc', pathway: 'human-health-direct', input_key: 'rfc_inhalation_mg_per_m3', value: 0.01, qa_status: 'approved' },
      { parameter_value_id: 'pv-2', substance_key: 'substance_rfc', pathway: 'human-health-direct', input_key: 'rfc_inhalation_mg_per_m3', value: 0.5, qa_status: 'approved' }, // 50x
    ];
    const findings = runAuditOnLibrary([], mockCatalog);
    const divCheck = findings.find((f) => f.check === 'CROSS_SOURCE_VALUE_DIVERGENCE' && f.substance_key === 'substance_rfc');
    expect(divCheck).toBeDefined();
    expect(divCheck?.ratio).toBe(50);
  });

  it('catches cross-source divergence on unit_risk_inhalation_per_ug_m3 (HH inhalation)', () => {
    const mockCatalog = [
      { parameter_value_id: 'pv-1', substance_key: 'substance_iur', pathway: 'human-health-direct', input_key: 'unit_risk_inhalation_per_ug_m3', value: 0.0001, qa_status: 'approved' },
      { parameter_value_id: 'pv-2', substance_key: 'substance_iur', pathway: 'human-health-direct', input_key: 'unit_risk_inhalation_per_ug_m3', value: 0.002, qa_status: 'approved' }, // 20x
    ];
    const findings = runAuditOnLibrary([], mockCatalog);
    const divCheck = findings.find((f) => f.check === 'CROSS_SOURCE_VALUE_DIVERGENCE' && f.substance_key === 'substance_iur');
    expect(divCheck).toBeDefined();
    expect(divCheck?.ratio).toBe(20);
  });

  it('catches cross-source divergence on eco pathways (fcv_ug_per_L, eco-direct-eqp)', () => {
    const mockCatalog = [
      { parameter_value_id: 'pv-1', substance_key: 'substance_eco', pathway: 'eco-direct-eqp', input_key: 'fcv_ug_per_L', value: 1, qa_status: 'approved' },
      { parameter_value_id: 'pv-2', substance_key: 'substance_eco', pathway: 'eco-direct-eqp', input_key: 'fcv_ug_per_L', value: 25, qa_status: 'approved' }, // 25x
    ];
    const findings = runAuditOnLibrary([], mockCatalog);
    const divCheck = findings.find((f) => f.check === 'CROSS_SOURCE_VALUE_DIVERGENCE' && f.substance_key === 'substance_eco');
    expect(divCheck).toBeDefined();
    expect(divCheck?.ratio).toBe(25);
  });

  it('catches cross-source divergence on eco-food-bsaf pathway (trv_eco_mg_per_kg_bw_day)', () => {
    const mockCatalog = [
      { parameter_value_id: 'pv-1', substance_key: 'substance_eco_food', pathway: 'eco-food-bsaf', input_key: 'trv_eco_mg_per_kg_bw_day', value: 0.5, qa_status: 'approved' },
      { parameter_value_id: 'pv-2', substance_key: 'substance_eco_food', pathway: 'eco-food-bsaf', input_key: 'trv_eco_mg_per_kg_bw_day', value: 10, qa_status: 'approved' }, // 20x
    ];
    const findings = runAuditOnLibrary([], mockCatalog);
    const divCheck = findings.find((f) => f.check === 'CROSS_SOURCE_VALUE_DIVERGENCE' && f.substance_key === 'substance_eco_food');
    expect(divCheck).toBeDefined();
    expect(divCheck?.ratio).toBe(20);
  });

  it('does not flag a pathway/input_key combination outside the extended scope', () => {
    const mockCatalog = [
      { parameter_value_id: 'pv-1', substance_key: 'substance_out_of_scope', pathway: 'eco-direct-eqp', input_key: 'bsaf_loc_freshwater', value: 1, qa_status: 'approved' },
      { parameter_value_id: 'pv-2', substance_key: 'substance_out_of_scope', pathway: 'eco-direct-eqp', input_key: 'bsaf_loc_freshwater', value: 100, qa_status: 'approved' },
    ];
    const findings = runAuditOnLibrary([], mockCatalog);
    expect(findings.some((f) => f.check === 'CROSS_SOURCE_VALUE_DIVERGENCE' && f.substance_key === 'substance_out_of_scope')).toBe(false);
  });

  it('catches a divergence across DIFFERENT pathways for the same (substance_key, input_key)', () => {
    // The load-bearing new capability: grouping is keyed on (substance_key, input_key) WITHOUT
    // pathway, so a direct-route value and a food-route value for the same oral toxicity input that
    // disagree >=10x are still caught (an oral RfD should be identical whichever route it is applied
    // on -- a >=10x split signals a source mix-up). Pins behavior: this test FAILS if pathway is
    // re-added to the group key.
    const mockCatalog = [
      { parameter_value_id: 'pv-1', substance_key: 'substance_xpath', pathway: 'human-health-direct', input_key: 'rfd_oral_mg_per_kg_bw_day', value: 0.001, qa_status: 'approved', source_ids: ['src-a'] },
      { parameter_value_id: 'pv-2', substance_key: 'substance_xpath', pathway: 'human-health-food', input_key: 'rfd_oral_mg_per_kg_bw_day', value: 0.02, qa_status: 'approved', source_ids: ['src-b'] }, // 20x, different route
    ];
    const findings = runAuditOnLibrary([], mockCatalog);
    const divCheck = findings.find((f) => f.check === 'CROSS_SOURCE_VALUE_DIVERGENCE' && f.substance_key === 'substance_xpath');
    expect(divCheck).toBeDefined();
    expect(divCheck?.ratio).toBe(20);
  });

  it('does not flag agreeing values from different sources (ratio 1)', () => {
    // Two sources reporting the SAME value must not be flagged (distinct-value dedup -> ratio 1).
    const mockCatalog = [
      { parameter_value_id: 'pv-1', substance_key: 'substance_agree', pathway: 'human-health-direct', input_key: 'rfd_oral_mg_per_kg_bw_day', value: 0.01, qa_status: 'approved', source_ids: ['src-a'] },
      { parameter_value_id: 'pv-2', substance_key: 'substance_agree', pathway: 'human-health-food', input_key: 'rfd_oral_mg_per_kg_bw_day', value: 0.01, qa_status: 'approved', source_ids: ['src-b'] },
    ];
    const findings = runAuditOnLibrary([], mockCatalog);
    expect(findings.some((f) => f.check === 'CROSS_SOURCE_VALUE_DIVERGENCE' && f.substance_key === 'substance_agree')).toBe(false);
  });
});
