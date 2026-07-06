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

  // 6. Cross-source value-divergence check
  // 2026-07-06: extended beyond the original HH-direct rfd/sf scope to also cover HH-food (the same
  // substance/input via the food-web route), the two HH inhalation input_keys (rfc, unit risk), and the
  // two eco input_keys (fcv, eco TRV) across both eco pathways. Grouping is still keyed on
  // (substance_key, input_key) only -- NOT pathway -- so a direct-vs-food divergence for the SAME
  // input_key is still caught (this mirrors how a real source mix-up could show up on either route).
  const targetInputs = new Set([
    'rfd_oral_mg_per_kg_bw_day',
    'sf_oral_per_mg_per_kg_bw_per_day',
    'rfc_inhalation_mg_per_m3',
    'unit_risk_inhalation_per_ug_m3',
    'fcv_ug_per_L',
    'trv_eco_mg_per_kg_bw_day',
  ]);
  const targetPathways = new Set([
    'human-health-direct',
    'human-health-food',
    'eco-direct-eqp',
    'eco-food-bsaf',
  ]);
  const divergenceCandidates = parameterValueRecords.filter(r =>
    r.qa_status === 'approved' &&
    targetPathways.has(r.pathway) &&
    targetInputs.has(r.input_key) &&
    typeof r.value === 'number' &&
    r.value > 0
  );

  const groups = new Map();
  for (const row of divergenceCandidates) {
    const key = `${row.substance_key}|${row.input_key}`;
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key).push(row);
  }

  for (const [groupKey, rows] of groups.entries()) {
    const [substance_key, input_key] = groupKey.split('|');
    const distinctValues = Array.from(new Set(rows.map(r => r.value))).sort((a, b) => a - b);

    if (distinctValues.length >= 2) {
      const min = distinctValues[0];
      const max = distinctValues[distinctValues.length - 1];
      const ratio = max / min;

      // Flag only a genuine CROSS-source divergence: SOME pair of rows from DIFFERENT source
      // provenance must disagree by >=10x. A same-source spread is a legitimate alternative (e.g.
      // FCSAP Module 7 eco TRVs give a MAMMAL and a BIRD value for one substance from the SAME source
      // -- a receptor difference, not a source disagreement) and must not be flagged under a check
      // named CROSS_SOURCE_VALUE_DIVERGENCE.
      //
      // A full PAIRWISE test (not just the global min/max extremes) is exact: checking only the
      // extremes would (a) MISS a real cross-source split that sits at an intermediate value while the
      // global min and max happen to share a source, and (b) risk flagging a same-source spread that
      // merely has a co-citation on one extreme. Verified on the live catalog: this keeps every genuine
      // cross-source divergence (chlorobenzene HC-vs-EPA, toxaphene EPA-ESB-vs-NRWQC, ...) and drops the
      // benzo_a_pyrene/vanadium eco mammal-vs-bird same-source pairs.
      const srcKey = (r) => [...new Set(r.source_ids || [])].sort().join(',');
      let hasCrossSourceDivergence = false;
      for (let i = 0; i < rows.length && !hasCrossSourceDivergence; i++) {
        for (let j = i + 1; j < rows.length; j++) {
          if (rows[i].value === rows[j].value) continue;
          const hi = Math.max(rows[i].value, rows[j].value);
          const lo = Math.min(rows[i].value, rows[j].value);
          // A pair is cross-source only if both rows carry a source AND those sources differ.
          const ki = srcKey(rows[i]);
          const kj = srcKey(rows[j]);
          if (hi / lo >= 10 && ki !== '' && kj !== '' && ki !== kj) {
            hasCrossSourceDivergence = true;
            break;
          }
        }
      }

      if (ratio >= 10 && hasCrossSourceDivergence) {
        const sourceMapping = rows.map(r => `${r.value}: src=${(r.source_ids || []).join(',')} pv=${r.parameter_value_id}`);
        findings.push({
          key: substance_key,
          severity: 'info',
          check: 'CROSS_SOURCE_VALUE_DIVERGENCE',
          detail: `substance_key=${substance_key}, input_key=${input_key}, values=[${distinctValues.join(', ')}], ratio=${Math.round(ratio)}, sources=[${sourceMapping.join('; ')}]`,
          substance_key,
          input_key,
          distinct_values: distinctValues,
          ratio: Math.round(ratio),
          sources: sourceMapping,
          message: `Approved values span ${Math.round(ratio)}x across sources for this substance/input; verify no mis-attribution and confirm the divergence is intended (real alternative TRVs), not a copy/read-across error (cf. chlorobenzene 2026-07-05).`
        });
      }
    }
  }

  // 7. Evidence-vs-substance name mismatch check (wrong-SUBSTANCE mode; #514's divergence check above
  // catches wrong-VALUE mode -- this catches evidence text that cites a DIFFERENT substance name than
  // the row it's attached to, e.g. a chlorobenzene row whose evidence locator actually names
  // "1,2-Dichlorobenzene". Scoped to HC TRV v4.0 rows first, where the locator format is consistent and
  // reliably parseable ("... Table 1, <Substance Name>, Type=..."); a substance/CAS mismatch here is a
  // strong signal of a copy/paste or cross-referencing error during extraction.
  // Non-greedy (not a [^,]+ exclusion class) so substance names with internal commas (e.g.
  // "Dichlorobenzene, 1,2-", "Chromium, hexavalent") are captured whole -- codex caught this: the
  // original [^,]+ version stopped at the FIRST comma and silently skipped 23 of 92 real HC locators.
  //
  // Two live HC v4.0 locator shapes exist and BOTH must be parsed (codex caught the 2nd being
  // skipped -- 19 of 111 rows, incl. benzo_a_pyrene / arsenic / PCBs / methylmercury / cadmium):
  //   (a) "... Table 1, <Name>, Type=<endpoint> ..."           -> terminate the name at ", Type="
  //   (b) "... Table 1, <Name>, <endpoint>, PDF page <n> ..."  -> terminate at ", <endpoint>, PDF page"
  // In shape (b) the endpoint segment (e.g. "Oral TDI", "adult Oral TDI", "UL age-band values") has no
  // internal comma, so [^,]+ safely matches it while the non-greedy name capture still absorbs
  // internal-comma names.
  //
  // KNOWN BLIND SPOT (documented, not covered): this is a cross-COMPOUND check, not a cross-ISOMER or
  // cross-SPECIATION one. nameTokens() drops isomer/position markers ("1,2-" / "1,4-" become <=2-char
  // tokens that are filtered) and the token-overlap test passes on any shared parent token, so a
  // locator citing "Dichlorobenzene, 1,4-" on a "dichlorobenzene_1_2" row, or "Chromium, hexavalent"
  // on a "chromium_trivalent" row, is NOT flagged -- both collapse to a shared token
  // ("dichlorobenzene" / "chromium"). This guard catches chlorobenzene-vs-dichlorobenzene class
  // errors; isomer/speciation-level mis-attribution needs a separate alias-aware check and is out of
  // scope here.
  const HC_LOCATOR_RE = /Table\s*1,\s*(.+?),\s*(?:Type\s*=|[^,]+,\s*PDF\s*page)/i;
  // STOPWORDS excludes both grammar filler AND generic chemistry group/suffix words. The generic
  // tokens matter for correctness: without them, two distinct HC substances that share only a
  // functional-group word register as a match and a copy/paste swap is missed -- e.g. "Vinyl
  // chloride" vs "Nickel chloride" both reduce to the shared token "chloride". Dropping the generic
  // tokens forces the overlap to rest on a DISTINCTIVE token (vinyl vs nickel). Verified against the
  // live HC v4.0 catalog: adding these leaves 0 rows empty-tokened and introduces 0 new mismatches.
  const STOPWORDS = new Set([
    'and', 'the', 'of', 'inorganic', 'organic', 'total', 'mixed', 'isomers',
    // generic chemistry group / suffix words (not distinctive on their own)
    'chloride', 'oxide', 'sulfate', 'sulphate', 'nitrate', 'acid', 'salt', 'salts',
    'compound', 'compounds',
  ]);

  function nameTokens(name) {
    return (name || '')
      .toLowerCase()
      .replace(/[()[\]{}.,\-_/+']/g, ' ')
      .split(/\s+/)
      .filter((t) => t.length > 2 && !STOPWORDS.has(t));
  }

  for (const row of parameterValueRecords) {
    if (!(row.source_ids || []).includes('src-health-canada-trv-v4-2025')) continue;
    const substanceTokens = new Set([
      ...nameTokens(row.substance_key),
      ...nameTokens(row.display_name),
    ]);
    if (substanceTokens.size === 0) continue;

    for (const evidence of row.evidence_items || []) {
      if (!evidence) continue; // defensive: a null/undefined array element must not abort the audit
      const match = evidence.locator && evidence.locator.match(HC_LOCATOR_RE);
      if (!match) continue;
      const citedName = match[1].trim();
      const citedTokens = nameTokens(citedName);
      if (citedTokens.length === 0) continue;

      const hasOverlap = citedTokens.some((t) => substanceTokens.has(t));
      if (!hasOverlap) {
        findings.push({
          key: row.substance_key,
          severity: 'medium',
          check: 'EVIDENCE_SUBSTANCE_NAME_MISMATCH',
          detail: `substance_key=${row.substance_key}, parameter_value_id=${row.parameter_value_id}, cited_name="${citedName}", locator="${evidence.locator}"`,
          substance_key: row.substance_key,
          parameter_value_id: row.parameter_value_id,
          cited_name: citedName,
          message: `Evidence locator cites "${citedName}", which shares no name tokens with this row's substance_key/display_name ("${row.substance_key}" / "${row.display_name}"). Verify this is not a copy/cross-reference error (cf. the chlorobenzene 1,2-DCB mis-attribution theory, 2026-07-05, which turned out to be unfounded but is exactly the class of error this check targets).`,
        });
      }
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
