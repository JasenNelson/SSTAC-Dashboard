import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SUBSTANCE_LIBRARY } from '../../src/lib/matrix-options/substanceLibrary.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..', '..');

export function floatEqual(a, b) {
  if (a === b) return true;
  if (a == null || b == null) return false;
  return Math.abs(Number(a) - Number(b)) <= 1e-9 * Math.max(1, Math.abs(Number(a)), Math.abs(Number(b)));
}

export function runAuditOnLibrary(substanceLibrary, parameterValueRecords) {
  const findings = [];

  const validClasses = new Set([
    'organic',
    'organic-PAH',
    'organic-halogenated',
    'divalent-metal',
    'methyl-Hg',
    'metalloid',
    'inorganic',
  ]);

  const FIELDS_TO_CHECK = [
    { fieldName: 'rfd_oral_mg_per_kg_bw_per_day', inputKey: 'rfd_oral_mg_per_kg_bw_day', pathway: 'human-health-direct' },
    { fieldName: 'sf_oral_per_mg_per_kg_bw_per_day', inputKey: 'sf_oral_per_mg_per_kg_bw_per_day', pathway: 'human-health-direct' },
    { fieldName: 'logKow', inputKey: 'logKow', pathway: 'eco-direct-eqp' },
    { fieldName: 'bsaf_loc_freshwater', inputKey: 'bsaf_loc_freshwater', pathway: 'eco-food-bsaf' },
    { fieldName: 'fcv_ug_per_L', inputKey: 'fcv_ug_per_L', pathway: 'eco-direct-eqp' },
    { fieldName: 'trv_eco_mg_per_kg_bw_day', inputKey: 'trv_eco_mg_per_kg_bw_day', pathway: 'eco-food-bsaf' }
  ];

  for (const entry of substanceLibrary) {
    const rawKey = entry.key;
    const key = (typeof rawKey === 'string' && rawKey.trim() !== '') ? rawKey : 'unknown';

    // 1. Enum/field types checks (strictly verify SubstanceEntry types)
    if (typeof rawKey !== 'string' || rawKey.trim() === '') {
      findings.push({
        key: 'unknown',
        severity: 'high',
        check: 'INVALID_FIELD_TYPE',
        detail: 'key must be a non-empty string.',
      });
    }

    if (typeof entry.displayName !== 'string' || entry.displayName.trim() === '') {
      findings.push({
        key,
        severity: 'high',
        check: 'INVALID_FIELD_TYPE',
        detail: 'displayName must be a non-empty string.',
      });
    }

    if (!validClasses.has(entry.contaminantClass)) {
      findings.push({
        key,
        severity: 'high',
        check: 'INVALID_CONTAMINANT_CLASS',
        detail: `contaminantClass "${entry.contaminantClass}" is invalid.`,
      });
    }

    if (entry.logKow !== null && typeof entry.logKow !== 'number') {
      findings.push({
        key,
        severity: 'high',
        check: 'INVALID_FIELD_TYPE',
        detail: 'logKow must be a number or null.',
      });
    }

    if (entry.rfd_oral_mg_per_kg_bw_per_day !== null && typeof entry.rfd_oral_mg_per_kg_bw_per_day !== 'number') {
      findings.push({
        key,
        severity: 'high',
        check: 'INVALID_FIELD_TYPE',
        detail: 'rfd_oral_mg_per_kg_bw_per_day must be a number or null.',
      });
    }

    if (entry.sf_oral_per_mg_per_kg_bw_per_day !== null && typeof entry.sf_oral_per_mg_per_kg_bw_per_day !== 'number') {
      findings.push({
        key,
        severity: 'high',
        check: 'INVALID_FIELD_TYPE',
        detail: 'sf_oral_per_mg_per_kg_bw_per_day must be a number or null.',
      });
    }

    if (entry.bsaf_loc_freshwater !== null && typeof entry.bsaf_loc_freshwater !== 'number') {
      findings.push({
        key,
        severity: 'high',
        check: 'INVALID_FIELD_TYPE',
        detail: 'bsaf_loc_freshwater must be a number or null.',
      });
    }

    if (entry.abs_dermal === undefined || entry.abs_dermal === null || typeof entry.abs_dermal !== 'number') {
      findings.push({
        key,
        severity: 'high',
        check: 'INVALID_FIELD_TYPE',
        detail: 'abs_dermal is missing or not a number.',
      });
    }

    if (entry.ba_oral === undefined || entry.ba_oral === null || typeof entry.ba_oral !== 'number') {
      findings.push({
        key,
        severity: 'high',
        check: 'INVALID_FIELD_TYPE',
        detail: 'ba_oral is missing or not a number.',
      });
    }

    if (entry.fcv_ug_per_L !== null && typeof entry.fcv_ug_per_L !== 'number') {
      findings.push({
        key,
        severity: 'high',
        check: 'INVALID_FIELD_TYPE',
        detail: 'fcv_ug_per_L must be a number or null.',
      });
    }

    if (entry.trv_eco_mg_per_kg_bw_day !== null && typeof entry.trv_eco_mg_per_kg_bw_day !== 'number') {
      findings.push({
        key,
        severity: 'high',
        check: 'INVALID_FIELD_TYPE',
        detail: 'trv_eco_mg_per_kg_bw_day must be a number or null.',
      });
    }

    if (typeof entry.sources !== 'string') {
      findings.push({
        key,
        severity: 'high',
        check: 'INVALID_FIELD_TYPE',
        detail: 'sources must be a string.',
      });
    }

    if (entry.notes !== undefined && entry.notes !== null && typeof entry.notes !== 'string') {
      findings.push({
        key,
        severity: 'high',
        check: 'INVALID_FIELD_TYPE',
        detail: 'notes must be a string.',
      });
    }

    const sourcesStr = typeof entry.sources === 'string' ? entry.sources : '';
    const notesStr = typeof entry.notes === 'string' ? entry.notes : '';

    // Check each catalog-backed field
    for (const { fieldName, inputKey, pathway } of FIELDS_TO_CHECK) {
      const libVal = entry[fieldName];
      if (libVal === null || libVal === undefined || typeof libVal !== 'number') continue;

      const candidates = parameterValueRecords.filter(
        (r) =>
          r.substance_key === key &&
          r.input_key === inputKey &&
          (pathway ? r.pathway === pathway : true) &&
          r.qa_status === 'approved'
      );

      const checkNameUpper = fieldName.toUpperCase();

      if (candidates.length === 0) {
        findings.push({
          key,
          severity: 'high',
          check: `${checkNameUpper}_NO_APPROVED_ROW`,
          detail: `No approved row found for ${fieldName} in catalog.`,
          library_value: libVal,
        });
      } else {
        const matches = candidates.filter((c) => floatEqual(c.value, libVal));
        if (matches.length === 0) {
          const distinctValues = Array.from(new Set(candidates.map((c) => c.value)));
          findings.push({
            key,
            severity: 'high',
            check: `${checkNameUpper}_VALUE_MISMATCH`,
            detail: `${fieldName} value ${libVal} does not match any approved catalog candidates.`,
            library_value: libVal,
            catalog_values: distinctValues,
          });
        } else {
          // Citation & Notes QA status checks for matched catalog rows
          for (const match of matches) {
            const pvidRegex = new RegExp(`(?<![a-zA-Z0-9_-])${match.parameter_value_id}(?![a-zA-Z0-9_-])`);
            if (!pvidRegex.test(sourcesStr)) {
              findings.push({
                key,
                severity: 'medium',
                check: 'CITATION_MISSING_PVID',
                detail: `Sources string does not cite matching catalog parameter_value_id "${match.parameter_value_id}".`,
                sources: sourcesStr,
                missing_pvid: match.parameter_value_id,
              });
            }

            // Notes QA status consistency check
            const notesLower = notesStr.toLowerCase();
            const hasPendingKeyword = notesLower.includes('needs_review') || notesLower.includes('needs review') || notesLower.includes('pending');
            if (hasPendingKeyword && notesStr.includes(match.parameter_value_id) && match.qa_status === 'approved') {
              findings.push({
                key,
                severity: 'medium',
                check: 'STALE_NOTES_QA_STATUS',
                detail: `Notes describe catalog row "${match.parameter_value_id}" as pending/needs_review, but it is now approved in the catalog.`,
                notes: notesStr,
              });
            }
          }
        }
      }
    }

    // 5. Notes consistency checks (check for stale notes like "HH RfD not wired" etc.)
    if (entry.rfd_oral_mg_per_kg_bw_per_day !== null && notesStr.includes('HH RfD not wired')) {
      findings.push({
        key,
        severity: 'medium',
        check: 'STALE_NOTES_RFD',
        detail: 'Notes contain "HH RfD not wired" but rfd_oral_mg_per_kg_bw_per_day is wired/non-null.',
        notes: notesStr,
      });
    }

    if (entry.sf_oral_per_mg_per_kg_bw_per_day !== null && notesStr.includes('HH SF not wired')) {
      findings.push({
        key,
        severity: 'medium',
        check: 'STALE_NOTES_SF',
        detail: 'Notes contain "HH SF not wired" but sf_oral_per_mg_per_kg_bw_per_day is wired/non-null.',
        notes: notesStr,
      });
    }
  }

  return findings;
}

export function runAudit() {
  // Load catalogs
  const paramValuesPath = path.join(REPO_ROOT, 'matrix_research', 'reference_catalog', 'parameter_values.json');
  const hhValuesPath = path.join(REPO_ROOT, 'matrix_research', 'reference_catalog', 'human_health_trv_values.json');
  const ecoValuesPath = path.join(REPO_ROOT, 'matrix_research', 'reference_catalog', 'eco_values.json');

  const parameterValues = JSON.parse(fs.readFileSync(paramValuesPath, 'utf8'));
  const humanHealthTrvValues = JSON.parse(fs.readFileSync(hhValuesPath, 'utf8'));
  const ecoValues = JSON.parse(fs.readFileSync(ecoValuesPath, 'utf8'));

  const parameterValueRecords = [
    ...parameterValues,
    ...humanHealthTrvValues,
    ...ecoValues,
  ];

  return runAuditOnLibrary(SUBSTANCE_LIBRARY, parameterValueRecords);
}

// CLI Execution Handler
if (process.argv[1] && fileURLToPath(import.meta.url) === fs.realpathSync(process.argv[1])) {
  const findings = runAudit();
  const isTestRun = process.argv.includes('--test-run');

  if (isTestRun) {
    const tmpDir = path.join(REPO_ROOT, '.tmp');
    if (!fs.existsSync(tmpDir)) {
      fs.mkdirSync(tmpDir, { recursive: true });
    }
    const outputPath = path.join(tmpDir, 'audit_integrity_test_run.json');
    fs.writeFileSync(outputPath, JSON.stringify(findings, null, 2), 'utf8');
    console.log(`Test run audit complete. Written ${findings.length} findings to ${outputPath}`);
    process.exit(0);
  }

  const criticalFindings = findings.filter((f) => f.severity === 'high' || f.severity === 'medium');
  if (criticalFindings.length > 0) {
    console.error(`Audit failed with ${criticalFindings.length} critical findings (${findings.length} total findings):`);
    console.error(JSON.stringify(criticalFindings, null, 2));
    process.exit(1);
  }

  console.log(`Audit passed successfully with 0 critical findings (${findings.length} total findings).`);
  process.exit(0);
}
