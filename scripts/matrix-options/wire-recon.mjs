import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..', '..');

const CATALOG_PATH = path.join(REPO_ROOT, 'matrix_research', 'reference_catalog', 'human_health_trv_values.json');
const LIBRARY_PATH = path.join(REPO_ROOT, 'src', 'lib', 'matrix-options', 'substanceLibrary.ts');
const OUT_DIR = path.join(__dirname, '_recon');
const OUT_JSON = path.join(OUT_DIR, 'wire_candidates.json');
const OUT_MD = path.join(OUT_DIR, 'wire_candidates_summary.md');

function run() {
  const catalogRaw = fs.readFileSync(CATALOG_PATH, 'utf-8');
  const catalog = JSON.parse(catalogRaw);

  const libText = fs.readFileSync(LIBRARY_PATH, 'utf-8');
  const existingKeys = new Set();
  const regex = /key:\s*'([^']+)'/g;
  let match;
  while ((match = regex.exec(libText)) !== null) {
    existingKeys.add(match[1]);
  }

  let skippedNonSingleValue = 0;
  const approvedRows = [];
  for (const row of catalog) {
    if (row.qa_status === 'approved') {
      if (row.value_type === 'single_value') {
        approvedRows.push(row);
      } else {
        skippedNonSingleValue++;
      }
    }
  }

  const INPUT_MAP = {
    'rfd_oral_mg_per_kg_bw_day': 'rfd_oral',
    'sf_oral_per_mg_per_kg_bw_per_day': 'sf_oral',
    'rfc_inhalation_mg_per_m3': 'rfc_inh',
    'unit_risk_inhalation_per_ug_m3': 'iur_inh'
  };

  const checkUnit = (inputKey, unit) => {
    if (!unit) return false;
    const u = unit.toLowerCase().trim().replace(/\s+/g, ' ');
    if (inputKey === 'rfd_oral_mg_per_kg_bw_day') {
      return u === 'mg/kg-bw/day';
    }
    if (inputKey === 'sf_oral_per_mg_per_kg_bw_per_day') {
      return u === 'per mg/kg-bw/day' || u === '(mg/kg-bw/day)^-1';
    }
    if (inputKey === 'rfc_inhalation_mg_per_m3') {
      return u === 'mg/m3';
    }
    if (inputKey === 'unit_risk_inhalation_per_ug_m3') {
      return u === 'per ug/m3' || u === '(ug/m3)^-1';
    }
    return false;
  };

  const bySubstance = new Map();
  const casMap = new Map();

  for (const row of approvedRows) {
    let list = bySubstance.get(row.substance_key);
    if (!list) {
      list = [];
      bySubstance.set(row.substance_key, list);
    }
    list.push(row);

    const casRegex = /\b\d{2,7}-\d{2}-\d\b/;
    const m = casRegex.exec(row.display_name || '');
    if (m) {
      const cas = m[0];
      let subs = casMap.get(cas);
      if (!subs) {
        subs = new Set();
        casMap.set(cas, subs);
      }
      subs.add(row.substance_key);
    }
  }

  const casCollisions = [];
  for (const [cas, subs] of casMap.entries()) {
    if (subs.size > 1) {
      casCollisions.push({ cas, substances: Array.from(subs) });
    }
  }
  casCollisions.sort((a, b) => a.cas.localeCompare(b.cas));

  const wireableNew = [];
  const augmentExisting = [];

  const sortedSubstances = Array.from(bySubstance.keys()).sort();

  for (const subKey of sortedSubstances) {
    const rows = bySubstance.get(subKey);
    const displayName = rows[0].display_name;

    const valuesObj = {};
    const flags = [];

    // group rows by input_key
    const rowsByInput = new Map();
    for (const r of rows) {
      if (!INPUT_MAP[r.input_key]) continue;
      let l = rowsByInput.get(r.input_key);
      if (!l) { l = []; rowsByInput.set(r.input_key, l); }
      l.push(r);
    }

    if (rowsByInput.size === 0) continue; // no inputs of interest

    for (const [rawInputKey, mappedInputKey] of Object.entries(INPUT_MAP)) {
      const inputRows = rowsByInput.get(rawInputKey);
      if (!inputRows || inputRows.length === 0) continue;

      const valMap = new Map();
      for (const r of inputRows) {
        if (r.value === null || r.value === undefined) continue;
        const num = Number(r.value);
        if (isNaN(num)) continue;
        let entry = valMap.get(num);
        if (!entry) {
          entry = {
            value: num,
            unit: r.unit,
            jurisdictions: new Set(),
            pathways: new Set(),
            source_ids: new Set(),
            candidate_group_ids: new Set()
          };
          valMap.set(num, entry);
        }
        if (r.jurisdiction) entry.jurisdictions.add(r.jurisdiction);
        if (r.pathway) entry.pathways.add(r.pathway);
        if (r.source_ids) {
          const ids = Array.isArray(r.source_ids) ? r.source_ids : [r.source_ids];
          for (const s of ids) entry.source_ids.add(s);
        }
        if (r.candidate_group_id) entry.candidate_group_ids.add(r.candidate_group_id);
      }

      const distinctKeys = Array.from(valMap.keys());
      if (distinctKeys.length === 1) {
        const entry = valMap.get(distinctKeys[0]);
        valuesObj[mappedInputKey] = {
          value: entry.value,
          unit: entry.unit,
          unit_canonical_ok: checkUnit(rawInputKey, entry.unit),
          source_ids: Array.from(entry.source_ids),
          jurisdictions: Array.from(entry.jurisdictions),
          pathways: Array.from(entry.pathways),
          candidate_group_ids: Array.from(entry.candidate_group_ids),
          selection_status: 'clean'
        };
      } else if (distinctKeys.length > 1) {
        const flag = 'multi-value-needs-jurisdiction-decision';
        if (!flags.includes(flag)) flags.push(flag);

        const candidates = distinctKeys.map(k => {
          const entry = valMap.get(k);
          return {
            value: entry.value,
            unit: entry.unit,
            jurisdictions: Array.from(entry.jurisdictions),
            pathways: Array.from(entry.pathways),
            source_ids: Array.from(entry.source_ids)
          };
        });

        const allGroupIds = new Set();
        for (const k of distinctKeys) {
          valMap.get(k).candidate_group_ids.forEach(id => allGroupIds.add(id));
        }

        valuesObj[mappedInputKey] = {
          value: null,
          selection_status: 'jurisdiction_conflict',
          candidates,
          candidate_group_ids: Array.from(allGroupIds)
        };
      }
    }

    if (Object.keys(valuesObj).length === 0) continue;

    const entry = {
      substance_key: subKey,
      display_name: displayName,
      runtime_key: subKey,
      values: valuesObj,
      flags
    };

    if (existingKeys.has(subKey)) {
      augmentExisting.push(entry);
    } else {
      wireableNew.push(entry);
    }
  }

  const allCandidates = [...wireableNew, ...augmentExisting];

  const summary = {
    wireable_new_total: wireableNew.length,
    clean_oral_rfd: 0,
    conflict_oral_rfd: 0,
    clean_any_input: 0,
    substances_fully_clean: 0
  };

  for (const w of allCandidates) {
    const vals = Object.values(w.values);
    if (vals.some(v => v.selection_status === 'clean')) summary.clean_any_input++;
    if (vals.length > 0 && vals.every(v => v.selection_status === 'clean')) summary.substances_fully_clean++;
    if (w.values.rfd_oral) {
      if (w.values.rfd_oral.selection_status === 'clean') summary.clean_oral_rfd++;
      if (w.values.rfd_oral.selection_status === 'jurisdiction_conflict') summary.conflict_oral_rfd++;
    }
  }

  const outJson = {
    generated_from: {
      catalog: 'matrix_research/reference_catalog/human_health_trv_values.json',
      library: 'src/lib/matrix-options/substanceLibrary.ts',
      approved_single_value_rows: approvedRows.length
    },
    summary,
    wireable_new: wireableNew,
    augment_existing: augmentExisting,
    cas_collisions: casCollisions,
    skipped_non_single_value: skippedNonSingleValue
  };

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(OUT_JSON, JSON.stringify(outJson, null, 2));

  const inputCounts = {};
  for (const key of Object.values(INPUT_MAP)) {
    inputCounts[key] = { clean: 0, conflict: 0 };
  }
  for (const w of allCandidates) {
    for (const [key, v] of Object.entries(w.values)) {
      if (v.selection_status === 'clean') inputCounts[key].clean++;
      if (v.selection_status === 'jurisdiction_conflict') inputCounts[key].conflict++;
    }
  }

  // Write MD
  let md = `# Matrix-Options Wire Recon Summary\n\n`;
  md += `**Counts (All Substances):**\n`;
  md += `- Approved single-value rows: ${approvedRows.length}\n`;
  md += `- Wireable new substances: ${summary.wireable_new_total}\n`;
  md += `- Fully clean substances: ${summary.substances_fully_clean}\n`;
  md += `- Clean any input: ${summary.clean_any_input}\n`;
  md += `- CAS Collisions: ${casCollisions.length}\n\n`;

  md += `**Input Breakdown (Clean vs Conflict):**\n`;
  for (const [key, counts] of Object.entries(inputCounts)) {
    md += `- ${key}: ${counts.clean} clean, ${counts.conflict} conflict\n`;
  }
  md += `\n`;

  md += `## Clean Oral RfD (First ~40)\n\n`;
  md += `| substance_key | display_name | rfd_oral | unit | sf_oral selection_status |\n`;
  md += `|---|---|---|---|---|\n`;
  
  const cleanRfdSubs = wireableNew.filter(w => w.values.rfd_oral && w.values.rfd_oral.selection_status === 'clean');
  const sample = cleanRfdSubs.slice(0, 40);
  for (const s of sample) {
    const rfd = s.values.rfd_oral.value;
    const unit = s.values.rfd_oral.unit || 'null';
    const sfStat = s.values.sf_oral ? s.values.sf_oral.selection_status : 'N/A';
    md += `| ${s.substance_key} | ${s.display_name} | ${rfd} | ${unit} | ${sfStat} |\n`;
  }

  fs.writeFileSync(OUT_MD, md);
}

run();
