import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateReport } from '../../scripts/matrix-options/generate-provenance-audit-report.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..', '..');

describe('generate-provenance-audit-report tests', () => {
  it('should generate a report file with the correct format from mock findings without re-import mock issues', () => {
    const mockFindings = [
      {
        key: 'benzo_a_pyrene',
        severity: 'high',
        check: 'SF_ORAL_PER_MG_PER_KG_BW_PER_DAY_VALUE_MISMATCH',
        detail: 'sf_oral_per_mg_per_kg_bw_per_day value 2.0 does not match any approved catalog candidates.',
        library_value: 2.0,
        catalog_values: [1.289],
      },
      {
        key: 'lead',
        severity: 'medium',
        check: 'CITATION_MISSING_PVID',
        detail: 'Sources string does not cite matching catalog parameter_value_id "pv-hc-lead-hh-direct-risk-dose".',
        sources: 'Health Canada TRV v4.0 (2025)...',
        missing_pvid: 'pv-hc-lead-hh-direct-risk-dose',
      },
      {
        key: 'zinc',
        check: 'SOME_CHECK',
        detail: 'Test detail without severity',
      }
    ];

    const tempOutputPath = path.join(REPO_ROOT, '.tmp', 'TEMP_MATRIX_OPTIONS_PROVENANCE_AUDIT_REPORT_TEST.md');

    // Ensure .tmp directory exists
    fs.mkdirSync(path.dirname(tempOutputPath), { recursive: true });

    const reportPath = generateReport({
      findings: mockFindings,
      outputPath: tempOutputPath,
    });
    expect(fs.existsSync(reportPath)).toBe(true);

    const content = fs.readFileSync(reportPath, 'utf8');

    // Verify sections and structure
    expect(content).toContain('# Substance Library Provenance Audit Report');
    expect(content).toContain('## 1. Summary of Findings');
    expect(content).toContain('## 2. Details by Substance');
    
    // Verify mock findings details are formatted
    expect(content).toContain('benzo_a_pyrene');
    expect(content).toContain('SF_ORAL_PER_MG_PER_KG_BW_PER_DAY_VALUE_MISMATCH');
    expect(content).toContain('Library: `2`');
    expect(content).toContain('Catalog Options: `[1.289]`');

    expect(content).toContain('lead');
    expect(content).toContain('CITATION_MISSING_PVID');
    expect(content).toContain('Missing citation: `pv-hc-lead-hh-direct-risk-dose`');

    // Verify severity fallback for Zinc
    expect(content).toContain('zinc');
    expect(content).toContain('SOME_CHECK');
    expect(content).toContain('LOW');

    // Clean up temp file
    if (fs.existsSync(tempOutputPath)) {
      fs.unlinkSync(tempOutputPath);
    }
  });

  it('should run successfully on live database findings and write to temporary output path', () => {
    const tempOutputPath = path.join(REPO_ROOT, '.tmp', 'TEMP_MATRIX_OPTIONS_PROVENANCE_AUDIT_REPORT_TEST_LIVE.md');
    
    // Ensure .tmp directory exists
    fs.mkdirSync(path.dirname(tempOutputPath), { recursive: true });

    const reportPath = generateReport({
      outputPath: tempOutputPath,
    });
    expect(fs.existsSync(reportPath)).toBe(true);
    const content = fs.readFileSync(reportPath, 'utf8');
    expect(content).toContain('# Substance Library Provenance Audit Report');

    // Clean up temp file
    if (fs.existsSync(tempOutputPath)) {
      fs.unlinkSync(tempOutputPath);
    }
  });
});
