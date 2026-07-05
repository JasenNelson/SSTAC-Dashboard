import { describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import { runAudit, runAuditOnLibrary } from '../../scripts/matrix-options/audit-library-provenance.mjs';
import { SUBSTANCE_LIBRARY } from '../../src/lib/matrix-options/substanceLibrary.ts';

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
        if (entry[field] !== null && entry[field] !== undefined) {
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
});
