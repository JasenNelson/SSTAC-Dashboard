import fs from 'fs';
import path from 'path';
import { SUBSTANCE_LIBRARY } from '../../src/lib/matrix-options/substanceLibrary';

interface Finding {
  key: string;
  severity: string;
  check: string;
  detail: string;
  library_value?: unknown;
  catalog_value?: unknown;
}

function audit() {
  const catalogPath = path.resolve('matrix_research/reference_catalog/human_health_trv_values.json');
  let rawCatalog: any;
  try {
    rawCatalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
  } catch (err) {
    console.error(`Failed to read catalog at ${catalogPath}:`, err);
    process.exit(1);
  }

  let catalog: any[] = [];
  if (Array.isArray(rawCatalog)) {
    catalog = rawCatalog;
  } else {
    for (const key of Object.keys(rawCatalog)) {
      if (Array.isArray(rawCatalog[key])) {
        catalog = rawCatalog[key];
        break;
      }
    }
  }

  const ecoCatalogPath = path.resolve('matrix_research/reference_catalog/eco_values.json');
  let rawEcoCatalog: any;
  try {
    rawEcoCatalog = JSON.parse(fs.readFileSync(ecoCatalogPath, 'utf8'));
  } catch (err) {
    console.error(`Failed to read eco catalog at ${ecoCatalogPath}:`, err);
    process.exit(1);
  }

  let ecoCatalog: any[] = [];
  if (Array.isArray(rawEcoCatalog)) {
    ecoCatalog = rawEcoCatalog;
  } else {
    for (const key of Object.keys(rawEcoCatalog)) {
      if (Array.isArray(rawEcoCatalog[key])) {
        ecoCatalog = rawEcoCatalog[key];
        break;
      }
    }
  }

  const findings: Finding[] = [];
  const keySet = new Set<string>();

  for (const entry of SUBSTANCE_LIBRARY as unknown as any[]) {
    if (keySet.has(entry.key)) {
      findings.push({
        key: entry.key,
        severity: 'high',
        check: 'DUPLICATE_KEY',
        detail: `Key appears more than once in library.`
      });
    } else {
      keySet.add(entry.key);
    }
  }

  function floatEqual(a: number, b: number): boolean {
    return Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));
  }

  const absDermalByClass: Record<string, number[]> = {};
  for (const entry of SUBSTANCE_LIBRARY as unknown as any[]) {
    if (typeof entry.contaminantClass === 'string' && typeof entry.abs_dermal === 'number') {
      if (!absDermalByClass[entry.contaminantClass]) {
        absDermalByClass[entry.contaminantClass] = [];
      }
      absDermalByClass[entry.contaminantClass].push(entry.abs_dermal);
    }
  }
  const modalAbsDermalByClass: Record<string, number> = {};
  for (const [cClass, values] of Object.entries(absDermalByClass)) {
    const counts = new Map<number, number>();
    let maxCount = 0;
    let mode = values[0];
    for (const v of values) {
      const c = (counts.get(v) || 0) + 1;
      counts.set(v, c);
      if (c > maxCount) {
        maxCount = c;
        mode = v;
      }
    }
    modalAbsDermalByClass[cClass] = mode;
  }

  for (const entry of SUBSTANCE_LIBRARY as unknown as any[]) {
    const key = entry.key;

    // 5. FIELD_TYPES
    if (typeof key !== 'string' || key.trim() === '') {
      findings.push({ key, severity: 'medium', check: 'FIELD_TYPE', detail: 'key must be a non-empty string' });
    }
    if (typeof entry.displayName !== 'string' || entry.displayName.trim() === '') {
      findings.push({ key: key || 'unknown', severity: 'medium', check: 'FIELD_TYPE', detail: 'displayName must be a non-empty string' });
    }
    if (typeof entry.contaminantClass !== 'string' || entry.contaminantClass.trim() === '') {
      findings.push({ key: key || 'unknown', severity: 'medium', check: 'FIELD_TYPE', detail: 'contaminantClass must be a non-empty string' });
    }
    if (typeof entry.sources !== 'string' || entry.sources.trim() === '') {
      findings.push({ key: key || 'unknown', severity: 'medium', check: 'FIELD_TYPE', detail: 'sources must be a non-empty string' });
    }
    if (entry.abs_dermal != null && typeof entry.abs_dermal !== 'number') {
      findings.push({ key: key || 'unknown', severity: 'medium', check: 'FIELD_TYPE', detail: 'abs_dermal must be a number' });
    }
    if (entry.ba_oral != null && typeof entry.ba_oral !== 'number') {
      findings.push({ key: key || 'unknown', severity: 'medium', check: 'FIELD_TYPE', detail: 'ba_oral must be a number' });
    }

    // 6. CLASS_HALOGEN_HEURISTIC
    const tokens = /chloro|bromo|fluoro|iodo|chlor|brom|fluor/i;
    const testStr = `${key} ${entry.displayName}`;
    const hasHalogen = tokens.test(testStr);
    if (entry.contaminantClass === 'organic' && hasHalogen) {
      findings.push({ key: key || 'unknown', severity: 'soft', check: 'CLASS_MAYBE_HALOGENATED', detail: 'organic with halogen token' });
    } else if (entry.contaminantClass === 'organic-halogenated' && !hasHalogen) {
      findings.push({ key: key || 'unknown', severity: 'soft', check: 'CLASS_MAYBE_NOT_HALOGENATED', detail: 'organic-halogenated without halogen token' });
    }

    // 1. RFD_VALUE
    let rfdMatchedRows: any[] = [];
    if (entry.rfd_oral_mg_per_kg_bw_per_day != null) {
      const approvedRows = catalog.filter(r => r.substance_key === key && r.input_key === 'rfd_oral_mg_per_kg_bw_day' && r.qa_status === 'approved' && r.value_type === 'single_value');
      if (approvedRows.length === 0) {
        findings.push({ key, severity: 'high', check: 'RFD_NO_APPROVED_ROW', detail: 'No approved row found for rfd' });
      } else {
        const matches = approvedRows.filter(r => floatEqual(Number(r.value), entry.rfd_oral_mg_per_kg_bw_per_day));
        if (matches.length === 0) {
          const distinctValues = Array.from(new Set(approvedRows.map(r => Number(r.value))));
          findings.push({
            key,
            severity: 'high',
            check: 'RFD_VALUE_MISMATCH',
            detail: 'Entry value does not match any approved row',
            library_value: entry.rfd_oral_mg_per_kg_bw_per_day,
            catalog_value: distinctValues
          });
        } else {
          rfdMatchedRows = matches;
        }
      }
    }

    // 2. SF_VALUE
    let sfMatchedRows: any[] = [];
    if (entry.sf_oral_per_mg_per_kg_bw_per_day != null) {
      const approvedRows = catalog.filter(r => r.substance_key === key && r.input_key === 'sf_oral_per_mg_per_kg_bw_per_day' && r.qa_status === 'approved' && r.value_type === 'single_value');
      if (approvedRows.length === 0) {
        findings.push({ key, severity: 'high', check: 'SF_NO_APPROVED_ROW', detail: 'No approved row found for sf' });
      } else {
        const matches = approvedRows.filter(r => floatEqual(Number(r.value), entry.sf_oral_per_mg_per_kg_bw_per_day));
        if (matches.length === 0) {
          const distinctValues = Array.from(new Set(approvedRows.map(r => Number(r.value))));
          findings.push({
            key,
            severity: 'high',
            check: 'SF_VALUE_MISMATCH',
            detail: 'Entry value does not match any approved row',
            library_value: entry.sf_oral_per_mg_per_kg_bw_per_day,
            catalog_value: distinctValues
          });
        } else {
          sfMatchedRows = matches;
        }
      }
    }

    // 3. DUAL_SOURCE_CITATION
    if (entry.rfd_oral_mg_per_kg_bw_per_day != null && entry.sf_oral_per_mg_per_kg_bw_per_day != null) {
      const sourceIds = new Set<string>();
      rfdMatchedRows.forEach(r => {
        if (Array.isArray(r.source_ids)) {
          r.source_ids.forEach((id: string) => sourceIds.add(id));
        }
      });
      sfMatchedRows.forEach(r => {
        if (Array.isArray(r.source_ids)) {
          r.source_ids.forEach((id: string) => sourceIds.add(id));
        }
      });

      const missingIds: string[] = [];
      const sourcesStr = (entry.sources || '').toString();
      for (const sid of sourceIds) {
        if (!sourcesStr.includes(sid)) {
          missingIds.push(sid);
        }
      }
      if (missingIds.length > 0) {
        findings.push({
          key,
          severity: 'medium',
          check: 'DUAL_SOURCE_CITATION_INCOMPLETE',
          detail: `Missing source ids: ${missingIds.join(', ')}`
        });
      }
    }

    // New check 1. CROSS_KEY_BORROW
    const checkCrossKeyBorrow = (val: any, inputKey: string) => {
      if (val != null) {
        const hasOwnRow = catalog.some(r => r.substance_key === key && r.input_key === inputKey);
        if (!hasOwnRow) {
          const otherRows = catalog.filter(r => r.input_key === inputKey && floatEqual(Number(r.value), val));
          if (otherRows.length > 0) {
            const otherKeys = Array.from(new Set(otherRows.map(r => r.substance_key)));
            findings.push({
              key,
              severity: 'high',
              check: 'CROSS_KEY_BORROW',
              detail: `Borrowed from: ${otherKeys.join(', ')}`
            });
          }
        }
      }
    };
    checkCrossKeyBorrow(entry.rfd_oral_mg_per_kg_bw_per_day, 'rfd_oral_mg_per_kg_bw_day');
    checkCrossKeyBorrow(entry.sf_oral_per_mg_per_kg_bw_per_day, 'sf_oral_per_mg_per_kg_bw_per_day');

    // New check 2. ABS_DERMAL_CLASS_DEVIATION
    if (entry.contaminantClass && modalAbsDermalByClass[entry.contaminantClass] !== undefined && typeof entry.abs_dermal === 'number') {
      const mode = modalAbsDermalByClass[entry.contaminantClass];
      if (entry.abs_dermal !== mode) {
        const notes = (entry.notes || '').toString().toLowerCase();
        const disclosures = ['raf', 'chemical-specific', 'override', 'voc', 'table 5'];
        const hasDisclosure = disclosures.some(d => notes.includes(d));
        if (!hasDisclosure) {
          findings.push({
            key,
            severity: 'medium',
            check: 'ABS_DERMAL_CLASS_DEVIATION',
            detail: `value ${entry.abs_dermal} vs class mode ${mode}`
          });
        }
      }
    }

    // New check 3. ECO_UNWIRED_GAP and ECO_VALUE_MISMATCH
    const checkEco = (val: any, inputKey: string) => {
      const approvedRows = ecoCatalog.filter(r => r.substance_key === key && r.input_key === inputKey && r.qa_status === 'approved' && r.value_type === 'single_value');
      if (val == null) {
        if (approvedRows.length > 0) {
          const vals = Array.from(new Set(approvedRows.map(r => r.value)));
          findings.push({
            key,
            severity: 'medium',
            check: 'ECO_UNWIRED_GAP',
            detail: `approved value(s): ${vals.join(', ')}`
          });
        }
      } else {
        if (approvedRows.length > 0) {
          const matches = approvedRows.some(r => floatEqual(Number(r.value), val));
          if (!matches) {
            const vals = Array.from(new Set(approvedRows.map(r => r.value)));
            findings.push({
              key,
              severity: 'high',
              check: 'ECO_VALUE_MISMATCH',
              detail: `library value ${val} vs approved value(s) ${vals.join(', ')}`
            });
          }
        }
      }
    };
    checkEco(entry.fcv_ug_per_L, 'fcv_ug_per_L');
    checkEco(entry.trv_eco_mg_per_kg_bw_day, 'trv_eco_mg_per_kg_bw_day');

    // New check 4. ECO_TEXT_DATA_CONTRADICTION
    const combinedText = `${entry.sources || ''} ${entry.notes || ''}`.toLowerCase();
    
    const isFcvClaim = combinedText.includes('seeded from the eco catalog') ||
                       combinedText.includes('eco fcv from catalog') ||
                       combinedText.includes('eco-direct fcv') ||
                       /fcv[\s\S]*from /i.test(combinedText);
                       
    const isTrvClaim = combinedText.includes('eco-food trv seeded') ||
                       combinedText.includes('trv seeded');

    if (isFcvClaim && entry.fcv_ug_per_L == null) {
      findings.push({
        key,
        severity: 'high',
        check: 'ECO_TEXT_DATA_CONTRADICTION',
        detail: 'FCV claim present but field fcv_ug_per_L is null'
      });
    }
    if (isTrvClaim && entry.trv_eco_mg_per_kg_bw_day == null) {
      findings.push({
        key,
        severity: 'high',
        check: 'ECO_TEXT_DATA_CONTRADICTION',
        detail: 'TRV claim present but field trv_eco_mg_per_kg_bw_day is null'
      });
    }
  }

  const outDir = path.join(__dirname, '_recon');
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }
  const outFile = path.join(outDir, 'audit_mechanical.json');
  fs.writeFileSync(outFile, JSON.stringify(findings, null, 2), 'utf8');

  const counts: Record<string, number> = { high: 0, medium: 0, soft: 0 };
  const checkCounts: Record<string, number> = {};
  for (const f of findings) {
    counts[f.severity] = (counts[f.severity] || 0) + 1;
    checkCounts[f.check] = (checkCounts[f.check] || 0) + 1;
  }
  
  const newChecks = ['CROSS_KEY_BORROW', 'ABS_DERMAL_CLASS_DEVIATION', 'ECO_UNWIRED_GAP', 'ECO_VALUE_MISMATCH', 'ECO_TEXT_DATA_CONTRADICTION'];
  const newCheckCounts = newChecks.map(c => `${c}=${checkCounts[c] || 0}`).join(', ');

  console.log(`Audit complete. ${SUBSTANCE_LIBRARY.length} entries processed. Findings: high=${counts.high}, medium=${counts.medium}, soft=${counts.soft}. New checks: ${newCheckCounts}. Wrote findings to ${outFile}`);
}

audit();
