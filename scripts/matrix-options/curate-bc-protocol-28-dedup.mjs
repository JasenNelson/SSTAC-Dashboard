// Owner-run curation to deduplicate BC Protocol 28 rows from the old source ID
// to the new canonical source ID. Plain ASCII.
//
// USAGE:
//   node scripts/matrix-options/curate-bc-protocol-28-dedup.mjs
//   node scripts/matrix-options/curate-bc-protocol-28-dedup.mjs --apply

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..', '..');
const HH_TRV_FILE = path.join(REPO_ROOT, 'matrix_research', 'reference_catalog', 'human_health_trv_values.json');
const SOURCES_FILE = path.join(REPO_ROOT, 'matrix_research', 'reference_catalog', 'sources.json');

export const CURATE_OLD_ID = 'src-bc-protocol-28-2021-jan';
export const CURATE_NEW_ID = 'src-bc-protocol-28-v3-0-2024';

export const BC_P28_DELETE_IDS = [
  'pv-p28-arsenic_inorganic-hh-food-rfd',
  'pv-p28-arsenic_inorganic-hh-food-sf',
  'pv-p28-benzo_a_pyrene-hh-direct-sf',
  'pv-p28-benzo_a_pyrene-hh-food-sf',
];

export function referencesOld(row) {
  if (Array.isArray(row.source_ids) && row.source_ids.includes(CURATE_OLD_ID)) return true;
  if (Array.isArray(row.evidence_items) && row.evidence_items.some(ev => ev && ev.source_id === CURATE_OLD_ID)) return true;
  if (Array.isArray(row.source_relationships) && row.source_relationships.some(rel => rel && rel.source_id === CURATE_OLD_ID)) return true;
  return false;
}

export function planCuration(paramValues, sources) {
  const newSource = sources.find(s => s.source_id === CURATE_NEW_ID);
  if (!newSource) {
    throw new Error(`Precondition failed: NEW_ID source record is missing: ${CURATE_NEW_ID}`);
  }

  const deleteIdsPresent = BC_P28_DELETE_IDS.filter(delId => paramValues.some(r => r.parameter_value_id === delId));
  const oldRefsRemaining = paramValues.filter(referencesOld);

  let deleteRows = [];
  let rekeyRows = [];

  if (deleteIdsPresent.length > 0 || oldRefsRemaining.length > 0) {
    for (const delId of BC_P28_DELETE_IDS) {
      const row = paramValues.find(r => r.parameter_value_id === delId);
      if (!row) {
        throw new Error(`Precondition failed: DELETE_ID not found in HH: ${delId}`);
      }
      if (!referencesOld(row)) {
        throw new Error(`Precondition failed: DELETE_ID row does not reference old source ID: ${delId}`);
      }
    }
    deleteRows = paramValues.filter(r => BC_P28_DELETE_IDS.includes(r.parameter_value_id));
    rekeyRows = paramValues.filter(r => referencesOld(r) && !BC_P28_DELETE_IDS.includes(r.parameter_value_id));
  }

  const oldSource = sources.find(s => s.source_id === CURATE_OLD_ID);
  const sourcePlan = {
    oldSource,
    newSource,
    action: oldSource ? (oldSource.currentness_status === 'superseded' ? 'none' : 'supersede') : 'none'
  };

  return {
    deleteRows,
    rekeyRows,
    deleteCount: deleteRows.length,
    rekeyCount: rekeyRows.length,
    sourcePlan
  };
}

export function applyCuration(paramValues, sources) {
  const plan = planCuration(paramValues, sources);
  const deleteCount = plan.deleteCount;
  const rekeyCount = plan.rekeyCount;

  const newParamValues = paramValues.filter(r => !BC_P28_DELETE_IDS.includes(r.parameter_value_id));

  for (const row of newParamValues) {
    if (referencesOld(row)) {
      if (Array.isArray(row.source_ids)) {
        const newSourceIds = [];
        let seenNew = false;
        for (const sid of row.source_ids) {
          if (sid === CURATE_OLD_ID || sid === CURATE_NEW_ID) {
            if (!seenNew) {
              newSourceIds.push(CURATE_NEW_ID);
              seenNew = true;
            }
          } else {
            newSourceIds.push(sid);
          }
        }
        row.source_ids = newSourceIds;
      }

      if (Array.isArray(row.evidence_items)) {
        for (const ev of row.evidence_items) {
          if (ev && ev.source_id === CURATE_OLD_ID) {
            ev.source_id = CURATE_NEW_ID;
          }
        }
      }

      if (Array.isArray(row.source_relationships)) {
        for (const rel of row.source_relationships) {
          if (rel && rel.source_id === CURATE_OLD_ID) {
            rel.source_id = CURATE_NEW_ID;
          }
        }
      }
    }
  }

  let sourceTouched = false;
  const oldSource = sources.find(s => s.source_id === CURATE_OLD_ID);
  const noteString = ' Superseded duplicate of src-bc-protocol-28-v3-0-2024 (same PDF; stored doc is v3.0 April 2024). 4 exact-duplicate HH rows removed (kept the verification-packet rows in parameter_values.json) and 351 HH rows re-keyed to the canonical id on 2026-06-22.';

  if (oldSource) {
    // Mark retired via the MODELED currentness_status field -- the app's source facets / Evidence
    // Library UI read currentness_status, NOT a custom 'status' key (codex holistic checkpoint P2,
    // 2026-06-22). 'superseded' is a valid SourceCurrentnessStatus enum value.
    if (oldSource.currentness_status !== 'superseded') {
      oldSource.currentness_status = 'superseded';
      sourceTouched = true;
    }
    // Drop the earlier unmodeled 'status' key (ignored by the app; superseded by currentness_status).
    if ('status' in oldSource) {
      delete oldSource.status;
      sourceTouched = true;
    }
    if (oldSource.superseded_by !== CURATE_NEW_ID) {
      oldSource.superseded_by = CURATE_NEW_ID;
      sourceTouched = true;
    }
    const currentNotes = oldSource.notes || '';
    if (!currentNotes.endsWith(noteString)) {
      oldSource.notes = currentNotes + noteString;
      sourceTouched = true;
    }
  }

  return {
    newParamValues,
    deleteCount,
    rekeyCount,
    sourceTouched
  };
}

export function parseArgs(argv) {
  const args = { apply: false, help: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--apply') {
      args.apply = true;
    } else if (a === '--help' || a === '-h') {
      args.help = true;
    } else {
      throw new Error('Unknown argument: ' + a);
    }
  }
  return args;
}

const BANNER = [
  '=============================================================================',
  ' curate-bc-protocol-28-dedup.mjs -- BC Protocol 28 dedup curation script',
  '=============================================================================',
  '',
].join('\n');

const HELP = [
  'Usage:',
  '  node scripts/matrix-options/curate-bc-protocol-28-dedup.mjs [--apply]',
  '',
].join('\n');

function main() {
  const opts = parseArgs(process.argv);
  if (opts.help) {
    console.log(BANNER);
    console.log(HELP);
    return;
  }

  console.log(BANNER);
  console.log('Mode: ' + (opts.apply ? 'APPLY (will write files)' : 'DRY RUN (writes nothing)'));
  console.log('');

  const paramValues = JSON.parse(fs.readFileSync(HH_TRV_FILE, 'utf8'));
  const sources = JSON.parse(fs.readFileSync(SOURCES_FILE, 'utf8'));

  const plan = planCuration(paramValues, sources);

  console.log(`delete: ${plan.deleteCount} rows`);
  if (plan.deleteCount > 0) {
    for (const id of BC_P28_DELETE_IDS) {
      console.log(`  - ${id}`);
    }
  }
  console.log(`re-key: ${plan.rekeyCount} rows`);
  const oldSourceCurrentness = plan.sourcePlan.oldSource ? plan.sourcePlan.oldSource.currentness_status : 'not found';
  if (oldSourceCurrentness === 'superseded') {
    console.log(`source ${CURATE_OLD_ID} -> (already superseded; currentness_status)`);
  } else {
    console.log(`source ${CURATE_OLD_ID} -> superseded (currentness_status)`);
  }
  console.log('');

  if (!opts.apply) {
    console.log('DRY RUN -- no file written. Re-run with --apply to write.');
    return;
  }

  const applied = applyCuration(paramValues, sources);
  
  if (applied.deleteCount > 0 || applied.rekeyCount > 0) {
    fs.writeFileSync(HH_TRV_FILE, JSON.stringify(applied.newParamValues, null, 2) + '\n', 'utf8');
    console.log('WROTE ' + HH_TRV_FILE);
  }
  if (applied.sourceTouched) {
    fs.writeFileSync(SOURCES_FILE, JSON.stringify(sources, null, 2) + '\n', 'utf8');
    console.log('WROTE ' + SOURCES_FILE);
  }
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : '';
if (invokedPath === fileURLToPath(import.meta.url)) {
  main();
}
