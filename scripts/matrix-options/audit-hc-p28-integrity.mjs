import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..', '..');

const CATALOG_PATHS = [
  path.join(REPO_ROOT, 'matrix_research', 'reference_catalog', 'parameter_values.json'),
  path.join(REPO_ROOT, 'matrix_research', 'reference_catalog', 'human_health_trv_values.json'),
  path.join(REPO_ROOT, 'matrix_research', 'reference_catalog', 'eco_values.json')
];

const LIBRARY_PATH = path.join(REPO_ROOT, 'src', 'lib', 'matrix-options', 'substanceLibrary.ts');
const OUT_DIR = path.join(__dirname, '_recon');
const OUT_JSON = path.join(OUT_DIR, 'hc_p28_integrity.json');
const OUT_MD = path.join(REPO_ROOT, 'docs', 'MATRIX_OPTIONS_HC_P28_INTEGRITY_AUDIT_2026_07_04.md');

const _isNumeric = (val) => {
  if (val === null || val === undefined) return false;
  if (typeof val === 'number') return isFinite(val);
  if (typeof val === 'string') return !isNaN(Number(val)) && val.trim() !== '';
  return false;
};

const _toNumber = (val) => {
  return Number(val);
};

const normalizeUnit = (s) => {
  if (!s) return '';
  let norm = s.toLowerCase().replace(/[\s()]/g, '');
  if (norm.startsWith('per')) {
    norm = norm.substring(3);
  }
  if (norm === 'mg/kgbw-day' || norm === 'mg/kg-bw/day') norm = 'mg/kgbwday';
  if (norm === 'mg/m3-1') norm = 'mg/m3';
  if (norm === 'ug/m3-1') norm = 'ug/m3';
  return norm;
};

function run() {
  let catalog = [];
  for (const cp of CATALOG_PATHS) {
    if (fs.existsSync(cp)) {
      const arr = JSON.parse(fs.readFileSync(cp, 'utf-8'));
      catalog = catalog.concat(arr);
    }
  }

  const singleValueRows = catalog.filter(r => r.value_type === 'single_value');

  const libText = fs.readFileSync(LIBRARY_PATH, 'utf-8');
  const libMap = new Map();
  const libEntriesRegex = /key:\s*'([^']+)'(.*?)(?=key:\s*'|$)/gs;
  let match;
  while ((match = libEntriesRegex.exec(libText)) !== null) {
    libMap.set(match[1], match[2]);
  }

  const INPUT_MAP = {
    'rfd_oral_mg_per_kg_bw_day': 'rfd_oral_mg_per_kg_bw_per_day',
    'sf_oral_per_mg_per_kg_bw_per_day': 'sf_oral_per_mg_per_kg_bw_per_day',
    'rfc_inhalation_mg_per_m3': 'rfc_inhalation_mg_per_m3',
    'unit_risk_inhalation_per_ug_m3': 'unit_risk_inhalation_per_ug_m3'
  };

  const isWired = (subKey, inputKey) => {
    if (!libMap.has(subKey)) return false;
    const block = libMap.get(subKey);
    const libField = INPUT_MAP[inputKey];
    if (!libField) return false;
    
    const fieldRegex = new RegExp(`${libField}:\\s*([\\d.eE+-]+)`);
    const fm = fieldRegex.exec(block);
    if (fm) {
      const num = Number(fm[1]);
      if (!isNaN(num)) return true;
    }
    return false;
  };

  const inScopeRows = [];
  for (const row of singleValueRows) {
    let sourceClass = null;
    const sourceIds = Array.isArray(row.source_ids) ? row.source_ids : (row.source_ids ? [row.source_ids] : []);
    const pvid = row.parameter_value_id || '';
    
    let isHC = false;
    let isP28 = false;
    
    for (const sid of sourceIds) {
      if (/^src-health-canada/.test(sid)) isHC = true;
      if (/^src-.*p28/i.test(sid) || /p28/i.test(sid)) isP28 = true;
    }
    if (pvid.startsWith('pv-hc-')) isHC = true;
    if (pvid.startsWith('pv-p28-')) isP28 = true;
    
    if (isHC) sourceClass = 'HC';
    else if (isP28) sourceClass = 'P28';
    
    if (sourceClass) {
      row.sourceClass = sourceClass;
      inScopeRows.push(row);
    }
  }

  for (const row of inScopeRows) {
    row.valueTextNumber = null;
    row.valueTextUnit = null;
    if (row.evidence_items && row.evidence_items.length > 0 && row.evidence_items[0].value_text) {
      const vt = row.evidence_items[0].value_text;
      const trvIdx = vt.toLowerCase().indexOf("trv value:");
      if (trvIdx !== -1) {
        const targetText = vt.substring(trvIdx + 10);
        const numMatch = targetText.match(/[-+]?\d*\.?\d+([eE][-+]?\d+)?/);
        if (numMatch) {
          row.valueTextNumber = Number(numMatch[0]);
          const afterNum = targetText.substring(numMatch.index + numMatch[0].length);
          const pipeIdx = afterNum.indexOf('|');
          row.valueTextUnit = pipeIdx !== -1 ? afterNum.substring(0, pipeIdx).trim() : afterNum.trim();
        }
      }
    }
  }

  const findings = [];
  const summary = {
    inScopeRows: inScopeRows.length,
    hc: inScopeRows.filter(r => r.sourceClass === 'HC').length,
    p28: inScopeRows.filter(r => r.sourceClass === 'P28').length,
    mismatch: 0,
    twinDivergence: 0,
    unwiredApproved: 0,
    valueTextUnparseable: 0,
    unitConvertedSkipped: 0
  };

  const pvidMap = new Map();
  for (const row of inScopeRows) {
    if (row.parameter_value_id) {
      pvidMap.set(row.parameter_value_id, row);
    }
  }

  for (const row of inScopeRows) {
    let defects = [];
    const vIsNumeric = _isNumeric(row.value);
    const vParsed = vIsNumeric ? _toNumber(row.value) : null;
    
    row.valueTextUnparseable = false;
    row.unitConverted = false;

    // Class A
    if (vIsNumeric) {
      if (row.valueTextNumber !== null && isFinite(row.valueTextNumber)) {
        if (normalizeUnit(row.valueTextUnit) === normalizeUnit(row.unit)) {
          const diff = Math.abs(vParsed - row.valueTextNumber);
          const tol = 0.01 * Math.max(Math.abs(vParsed), Math.abs(row.valueTextNumber));
          if (diff > tol) {
            defects.push('A');
          }
        } else {
          row.unitConverted = true;
        }
      } else {
        row.valueTextUnparseable = true;
      }
    }

    // Class B
    let twinDivergent = false;
    let twinPvid = null;
    
    if (vIsNumeric && row.substance_key !== 'generic' && row.parameter_value_id) {
      let otherPvid = null;
      if (row.pathway === 'human-health-direct') {
        otherPvid = row.parameter_value_id.replace('-hh-direct-', '-hh-food-');
      } else if (row.pathway === 'human-health-food') {
        otherPvid = row.parameter_value_id.replace('-hh-food-', '-hh-direct-');
      }
      
      if (otherPvid) {
        const otherRow = pvidMap.get(otherPvid);
        if (otherRow && _isNumeric(otherRow.value)) {
          const thisVal = vParsed;
          const otherVal = _toNumber(otherRow.value);
          const diff = Math.abs(thisVal - otherVal);
          const tol = 0.01 * Math.max(Math.abs(thisVal), Math.abs(otherVal));
          if (diff > tol) {
            twinDivergent = true;
            twinPvid = otherPvid;
          }
        }
      }
    }
    
    if (twinDivergent) {
      defects.push('B');
    }
    if (twinPvid) {
      row.twinPvid = twinPvid;
    }

    // Class C
    let unwiredOrUnverified = false;
    const wired = isWired(row.substance_key, row.input_key);
    
    if (row.qa_status === 'approved') {
      if (!wired) {
        unwiredOrUnverified = true;
      }
      if (row.canonical_source_status !== 'direct_source_verified') {
        unwiredOrUnverified = true;
      }
    }
    if (unwiredOrUnverified) {
      defects.push('C');
    }

    if (defects.length > 0) {
      findings.push({
        pvid: row.parameter_value_id,
        substance_key: row.substance_key,
        pathway: row.pathway,
        input_key: row.input_key,
        sourceClass: row.sourceClass,
        value: row.value,
        valueTextNumber: row.valueTextNumber,
        qa_status: row.qa_status,
        wired: wired,
        defects: defects,
        ...(row.twinPvid ? { twinPvid: row.twinPvid } : {})
      });
    }
  }

  for (const row of inScopeRows) {
    if (row.valueTextUnparseable) {
      summary.valueTextUnparseable++;
    }
    if (row.unitConverted) {
      summary.unitConvertedSkipped++;
    }
  }

  const findingsWithA = findings.filter(f => f.defects.includes('A')).length;
  const findingsWithB = findings.filter(f => f.defects.includes('B')).length;
  const findingsWithC = findings.filter(f => f.defects.includes('C')).length;
  summary.mismatch = findingsWithA;
  summary.twinDivergence = findingsWithB;
  summary.unwiredApproved = findingsWithC;

  const severityScore = (f) => {
    if (f.defects.includes('A')) return 1;
    if (f.defects.includes('B')) return 2;
    if (f.defects.includes('C')) return 3;
    return 4;
  };
  
  findings.sort((a, b) => {
    const sA = severityScore(a);
    const sB = severityScore(b);
    if (sA !== sB) return sA - sB;
    if (a.substance_key !== b.substance_key) return a.substance_key.localeCompare(b.substance_key);
    return a.pvid.localeCompare(b.pvid);
  });

  const outJson = {
    generated_note: "Generated by audit-hc-p28-integrity.mjs (run 2026-07-04)",
    summary,
    findings
  };

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(OUT_JSON, JSON.stringify(outJson, null, 2));

  let md = `# HC/P28 Catalog Integrity Audit\n\n`;
  md += `Generated by audit-hc-p28-integrity.mjs (run 2026-07-04)\n\n`;
  md += `## Summary\n\n`;
  md += `| Metric | Count |\n`;
  md += `|---|---|\n`;
  md += `| In-Scope Rows | ${summary.inScopeRows} |\n`;
  md += `| HC Rows | ${summary.hc} |\n`;
  md += `| P28 Rows | ${summary.p28} |\n`;
  md += `| Class A (Mismatch) | ${summary.mismatch} |\n`;
  md += `| Class B (Twin Divergence) | ${summary.twinDivergence} |\n`;
  md += `| Class C (Unwired/Unverified) | ${summary.unwiredApproved} |\n`;
  md += `| ValueText Unparseable | ${summary.valueTextUnparseable} |\n\n`;

  const renderSection = (defClass, title, prefixText = '') => {
    let secMd = `## ${title}\n\n`;
    if (prefixText) secMd += prefixText + `\n\n`;
    const fClass = findings.filter(f => f.defects.includes(defClass));
    if (fClass.length === 0) {
      secMd += `No findings for ${defClass}.\n\n`;
      return secMd;
    }
    secMd += `| substance_key | pvid | pathway | value | value_text# | qa_status | wired | note |\n`;
    secMd += `|---|---|---|---|---|---|---|---|\n`;
    for (const f of fClass) {
      const valStr = f.value !== null && f.value !== undefined ? String(f.value) : 'null';
      const vtStr = f.valueTextNumber !== null ? String(f.valueTextNumber) : 'null';
      const note = f.defects.join(',');
      secMd += `| ${f.substance_key} | ${f.pvid} | ${f.pathway} | ${valStr} | ${vtStr} | ${f.qa_status} | ${f.wired} | ${note} |\n`;
    }
    secMd += `\n`;
    return secMd;
  };

  const classAPrefix = `Class A compares only rows whose published unit matches the canonical unit; ${summary.unitConvertedSkipped} rows were unit-converted and excluded, ${summary.valueTextUnparseable} rows had no parseable 'TRV Value:' label.`;
  md += renderSection('A', 'Class A: Value vs ValueText Mismatch', classAPrefix);
  md += renderSection('B', 'Class B: Twin Divergence');
  md += renderSection('C', 'Class C: Unwired or Unverified');

  fs.writeFileSync(OUT_MD, md);

  console.log(`Audit complete. Mismatch (A): ${summary.mismatch}, TwinDivergence (B): ${summary.twinDivergence}, Unwired/Unverified (C): ${summary.unwiredApproved}`);
}

run();
