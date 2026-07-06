import fs from 'fs';

// Constants
const INPUT_KEY_TO_PDF_TYPE = {
  'rfd_oral_mg_per_kg_bw_day': ['Oral TDI', 'Oral RfD', 'Risk-specific dose', 'UL'],
  'sf_oral_per_mg_per_kg_bw_per_day': ['Oral SF'],
  'rfc_inhalation_mg_per_m3': ['Inhalation TC'],
  'unit_risk_inhalation_per_ug_m3': ['Inhalation UR'],
};

const CATALOG_TO_PDF_UNIT_FACTOR = {
  'rfd_oral_mg_per_kg_bw_day': 1,
  'sf_oral_per_mg_per_kg_bw_per_day': 1,
  'rfc_inhalation_mg_per_m3': 1,
  'unit_risk_inhalation_per_ug_m3': 1000,
};

function normalizeName(key) {
    const mappings = {
        'benzo_a_pyrene': ['Benzo[a]pyrene (BaP)', 'Benzo[a]pyrene', 'Benzo(a)pyrene'],
        'arsenic_inorganic': ['Arsenic (inorganic)', 'Arsenic'],
        'total_pcbs_aroclor_1254': ['Polychlorinated biphenyls (PCBs) (non dioxin-like i.e., non-coplanar)5', 'Polychlorinated biphenyls (PCBs) (non dioxin-like i.e., non-coplanar)'],
        'methylmercury': ['Methylmercury', 'Methyl mercury'],
        'lead': ['Lead'],
        'cadmium': ['Cadmium'],
        'copper': ['Copper'],
        'zinc': ['Zinc'],
        'barium': ['Barium'],
        'benzene': ['Benzene'],
        'beryllium': ['Beryllium'],
        'carbon_tetrachloride': ['Carbon tetrachloride'],
        'chlorobenzene': ['Chlorobenzene'],
        'chromium_trivalent': ['Chromium, trivalent3', 'Chromium, trivalent', 'Chromium (III)', 'Chromium'],
        'chromium_hexavalent': ['Chromium, hexavalent', 'Chromium, hexavalent (VI)', 'Chromium (VI)', 'Chromium'],
        'dichlorobenzene_1_2': ['Dichlorobenzene, 1,2-'],
        'dichlorobenzene_1_4': ['Dichlorobenzene, 1,4-'],
        'dichloroethane_1_2': ['Dichloroethane, 1,2- (DCA, 1,2-)'],
        'dichloroethylene_1_1': ['Dichloroethylene, 1,1'],
        'dichloromethane': ['Dichloromethane (methylene chloride)'],
        'ethylbenzene': ['Ethylbenzene'],
        'n_hexane': ['n-Hexane'],
        'manganese': ['Manganese'],
        'mercury_inorganic': ['Mercury (inorganic)'],
        'methylnaphthalene_2': ['Methylnaphthalene, 2-'],
        'naphthalene': ['Naphthalene'],
        'nickel_chloride': ['Nickel chloride'],
        'nickel_oxide': ['Nickel oxide'],
        'nickel_subsulfide': ['Nickel subsulfide (sulfidic nickel)'],
        'nickel_sulfate': ['Nickel sulfate'],
        'nickel_mixture': ['Nickel, mixture of oxidic, sulfidic and soluble inorganic nickel compounds'],
        'nickel_metallic': ['Nickel, metallic'],
        'pcbs_non_coplanar': ['Polychlorinated biphenyls (PCBs) (non dioxin-like i.e., non-coplanar)5', 'Polychlorinated biphenyls (PCBs) (non dioxin-like i.e., non-coplanar)'],
        'pyrene': ['Pyrene'],
        'tetrachloroethylene': ['Tetrachloroethylene (PCE)'],
        'toluene': ['Toluene'],
        'trichloroethylene': ['Trichloroethylene (TCE)'],
        'uranium': ['Uranium (non-radioactive)'],
        'vinyl_chloride': ['Vinyl chloride'],
        'xylenes': ['Xylenes, mixed isomers']
    };
    if (mappings[key]) return mappings[key];
    let variants = [key.replace(/_/g, ' ')];
    variants.push(key.split('_').map(w => w[0].toUpperCase() + w.slice(1)).join(' '));
    return variants;
}

const KEYWORD_PAIRS = [
    [['sensitive', 'child-bearing', 'infant', 'children'], ['non-sensitive', 'general population', 'adult']],
    [['from birth', 'from-birth'], ['adulthood', 'continuous lifetime exposure during adulthood']]
];

function normalizeLetterSpacing(text) {
    if (!text) return text;
    // Collapse single-spaced letter runs (e.g. "c h i l d - b e a r i n g" -> "child-bearing")
    return text.replace(/(?:[a-zA-Z0-9-]\s){2,}[a-zA-Z0-9-]/g, match => {
        return match.replace(/\s+/g, '');
    });
}

function checkKeywordMatch(normalizedText, keywordSet) {
    if (!normalizedText) return false;
    return keywordSet.some(kw => {
        const kwLower = kw.toLowerCase();
        if (kwLower === 'sensitive') {
            return normalizedText.replace(/non-sensitive/g, '').includes('sensitive');
        }
        return normalizedText.includes(kwLower);
    });
}

function disambiguate(catalogRow, pdfRows) {
    const catalogContext = [
        catalogRow.applicability,
        ...(catalogRow.population_groups || []),
        catalogRow.review_notes
    ].filter(Boolean).join(' ').toLowerCase();
    
    const catalogContext_normalized = normalizeLetterSpacing(catalogContext);

    let matchingRows = [];

    for (const pdfRow of pdfRows) {
        const pdfQualifier = (pdfRow.qualifier_hint || '').toLowerCase();
        const qualifier_hint_normalized = normalizeLetterSpacing(pdfQualifier);
        
        let hasMatch = false;

        for (const [setA, setB] of KEYWORD_PAIRS) {
            const catalogMatchesA = checkKeywordMatch(catalogContext_normalized, setA);
            const catalogMatchesB = checkKeywordMatch(catalogContext_normalized, setB);
            const pdfMatchesA = checkKeywordMatch(qualifier_hint_normalized, setA);
            const pdfMatchesB = checkKeywordMatch(qualifier_hint_normalized, setB);

            if ((catalogMatchesA && pdfMatchesA) || (catalogMatchesB && pdfMatchesB)) {
                hasMatch = true;
                break;
            }
        }

        if (hasMatch) {
            matchingRows.push(pdfRow);
        }
    }

    if (matchingRows.length === 1) {
        return { resolved: matchingRows[0] };
    } else {
        return { ambiguous: true };
    }
}

function normalizeType(type) {
    return type.replace(/\s*\(provisional\)\s*$/i, '').trim().toLowerCase();
}

function normalizePdfSubstance(substance) {
    return substance.trim().toLowerCase();
}

const table1Data = JSON.parse(fs.readFileSync('scripts/matrix-options/data/hc_trv_v4_table1_extracted.json', 'utf8'));
const catalogData = JSON.parse(fs.readFileSync('matrix_research/reference_catalog/human_health_trv_values.json', 'utf8'));

// Build Index
const pdfIndex = {}; // "substance_norm|type_norm" -> [row1, ...]
for (const row of table1Data) {
    const subNorm = normalizePdfSubstance(row.substance);
    const typeNorm = normalizeType(row.type_of_trv);
    const key = `${subNorm}|${typeNorm}`;
    if (!pdfIndex[key]) pdfIndex[key] = [];
    pdfIndex[key].push(row);
}

function compareValues(catalogVal, factor, pdfValStr) {
    const adjustedCatalog = catalogVal * factor;
    const parsedPdf = parseFloat(pdfValStr);
    if (isNaN(parsedPdf)) return false;
    // 2% relative tolerance
    const diff = Math.abs(adjustedCatalog - parsedPdf);
    const rel = diff / Math.abs(parsedPdf);
    return rel <= 0.02;
}

function classifyRow(catalogRow, overrideVal = null) {
    const inputKey = catalogRow.input_key;
    const types = INPUT_KEY_TO_PDF_TYPE[inputKey];
    if (!types) return { status: 'TYPE-OR-NAME-NOT-FOUND' };

    const variants = normalizeName(catalogRow.substance_key);
    let matchedPdfRows = [];
    
    for (const v of variants) {
        const subNorm = v.trim().toLowerCase();
        for (const t of types) {
            const typeNorm = normalizeType(t);
            const key = `${subNorm}|${typeNorm}`;
            if (pdfIndex[key]) {
                matchedPdfRows.push(...pdfIndex[key]);
            }
        }
    }
    
    // remove duplicates if any
    matchedPdfRows = [...new Set(matchedPdfRows)];

    if (matchedPdfRows.length === 0) {
        return { status: 'TYPE-OR-NAME-NOT-FOUND' };
    }

    const catalogVal = overrideVal !== null ? overrideVal : catalogRow.value;
    const factor = CATALOG_TO_PDF_UNIT_FACTOR[inputKey];

    if (matchedPdfRows.length === 1) {
        const pdfRow = matchedPdfRows[0];
        const isMatch = compareValues(catalogVal, factor, pdfRow.value);
        return { status: isMatch ? 'MATCH' : 'MISMATCH', matchedRow: pdfRow };
    }

    const disambigResult = disambiguate(catalogRow, matchedPdfRows);
    if (disambigResult.resolved) {
        const pdfRow = disambigResult.resolved;
        const isMatch = compareValues(catalogVal, factor, pdfRow.value);
        return { status: isMatch ? 'MATCH' : 'MISMATCH', matchedRow: pdfRow };
    } else {
        return { status: 'AMBIGUOUS', allCandidates: matchedPdfRows };
    }
}

// Validations
let validationResults = [];

// 1. Synthetic MISMATCH
const arSFRow = catalogData.find(d => d.substance_key === 'arsenic_inorganic' && d.input_key === 'sf_oral_per_mg_per_kg_bw_per_day' && (d.source_ids||[]).includes('src-health-canada-trv-v4-2025'));
const arSynthResult = classifyRow(arSFRow, 6.4);
const pass1 = arSynthResult.status === 'MISMATCH';
validationResults.push({ name: 'Synthetic MISMATCH case (Arsenic Oral SF vs 6.4)', pass: pass1 });

// 2. Control MATCH
const arURRow = catalogData.find(d => d.substance_key === 'arsenic_inorganic' && d.input_key === 'unit_risk_inhalation_per_ug_m3' && (d.source_ids||[]).includes('src-health-canada-trv-v4-2025'));
const pass2 = classifyRow(arSFRow).status === 'MATCH' && classifyRow(arURRow).status === 'MATCH';
validationResults.push({ name: 'Control MATCH case (Arsenic Oral SF and Inhalation UR)', pass: pass2 });

// 3. Ambiguity case
const vcRow = catalogData.find(d => d.substance_key === 'vinyl_chloride' && d.input_key === 'sf_oral_per_mg_per_kg_bw_per_day' && (d.source_ids||[]).includes('src-health-canada-trv-v4-2025'));
const pass3 = classifyRow(vcRow).status === 'AMBIGUOUS';
validationResults.push({ name: 'Ambiguity case (Vinyl chloride Oral SF)', pass: pass3 });

// 4. Unit-conversion case
const bzRow = catalogData.find(d => d.substance_key === 'benzene' && d.input_key === 'unit_risk_inhalation_per_ug_m3' && (d.source_ids||[]).includes('src-health-canada-trv-v4-2025'));
const pass4 = classifyRow(bzRow).status === 'MATCH';
validationResults.push({ name: 'Unit-conversion case (Benzene Inhalation UR)', pass: pass4 });

// Force pass if needed for tests, but we want it to actually pass
const allPass = validationResults.every(r => r.pass);
if (!allPass) {
    console.error("Validation failed", validationResults);
    process.exit(1);
}

// Full scan
const hcRows = catalogData.filter(d => (d.source_ids || []).includes('src-health-canada-trv-v4-2025'));
let stats = { MATCH: 0, MISMATCH: 0, AMBIGUOUS: 0, 'TYPE-OR-NAME-NOT-FOUND': 0, catalog_rows_scanned: hcRows.length };

const matchRows = [];
const mismatchRows = [];
const ambiguousRows = [];
const notFoundRows = [];

for (const row of hcRows) {
    const res = classifyRow(row);
    stats[res.status] = (stats[res.status] || 0) + 1;
    
    if (res.status === 'MATCH') {
        matchRows.push({ catalog: row, pdf: res.matchedRow });
    } else if (res.status === 'MISMATCH') {
        mismatchRows.push({ catalog: row, pdf: res.matchedRow });
    } else if (res.status === 'AMBIGUOUS') {
        ambiguousRows.push({ catalog: row, candidates: res.allCandidates });
    } else {
        notFoundRows.push({ catalog: row });
    }
}

// 2026-07-06 codex P2 (round 2): the adjudication notes below were hand-verified against the real PDF
// for an EXACT set of AMBIGUOUS parameter_value_ids. If the catalog or extractor changes such that a
// future rerun's AMBIGUOUS set differs (a new HC row becomes ambiguous, or an existing one resolves),
// the baked "hand-verified, zero errors" claim would be FALSE for the new/changed rows. Guard: compare
// the current run's AMBIGUOUS ids against the verified set and only emit the full adjudication claim
// when they match exactly; otherwise emit a loud STALE warning naming the drifted ids instead.
const VERIFIED_AMBIGUOUS_IDS_2026_07_06 = new Set([
    'pv-hc-zinc-hh-direct-ul-child',
    'pv-hc-zinc-hh-food-ul-adult',
    'pv-hc-manganese-hh-direct-rfc',
    'pv-hc-methylmercury-hh-direct-rfd',
    'pv-hc-vinyl_chloride-hh-direct-sf',
    'pv-hc-vinyl_chloride-hh-direct-iur',
]);
const currentAmbiguousIds = new Set(ambiguousRows.map(r => r.catalog.parameter_value_id));
const ambiguousSetMatches =
    currentAmbiguousIds.size === VERIFIED_AMBIGUOUS_IDS_2026_07_06.size &&
    [...currentAmbiguousIds].every(id => VERIFIED_AMBIGUOUS_IDS_2026_07_06.has(id));

let adjudicationSection;
if (ambiguousSetMatches && stats.MISMATCH === 0) {
    adjudicationSection = [
        `## Adjudication Notes (hand-verified against the real PDF, 2026-07-06)`,
        ``,
        `All 6 AMBIGUOUS rows were checked directly against the source PDF (via PyMuPDF) and are LEGITIMATE`,
        `ambiguities, not tool bugs -- no catalog edit is warranted for any of them:`,
        ``,
        `- **zinc (2 rows):** the real PDF has a genuinely age-stratified UL (0 to <6mo / 6mo-5yrs / 5-12yrs /`,
        `  12-20yrs / >=20yrs, 5 distinct values 0.49/0.48/0.51/0.54/0.57 mg/kgBW-day, page 52). The catalog's`,
        `  child (0.51) and adult (0.57) rows both correspond to real age-bracket values within this`,
        `  stratification -- exactly as the original May 2026 pass's review note documented as a deliberate`,
        `  "skip full stratification" decision. Confirmed correct; no fix needed.`,
        `- **manganese (1 row):** the "second candidate value" (3.5) is a FALSE POSITIVE in the extraction,`,
        `  confirmed by direct PDF read (page 35) -- it's the "3.5" in the unit annotation "mg/m3 (in PM3.5)"`,
        `  (particulate size fraction), not a second TRV value. The real (and only) Inhalation TC is 5.0E-05`,
        `  mg/m3, matching the catalog's 0.00005 exactly. This is a benign extractor quirk (fails toward`,
        `  AMBIGUOUS, never toward a false MATCH/MISMATCH) -- noted here for the record; not worth a parser`,
        `  fix given the AMBIGUOUS classification is itself safe.`,
        `- **methylmercury (1 row, \`pv-hc-methylmercury-hh-direct-rfd\`):** correctly AMBIGUOUS -- its`,
        `  \`applicability\` text is generic ("Health Canada TRV v4.0 RFD for methylmercury") with no`,
        `  sensitive/adult qualifier keyword, so there is genuinely no catalog-side basis to pick between the`,
        `  PDF's two population-variant Oral TDI rows (0.0002 sensitive / 0.00047 adult). The OTHER 3`,
        `  methylmercury rows correctly resolved to MATCH once the qualifier-matching keyword bug was fixed --`,
        `  this one's own applicability text is just less specific than its siblings.`,
        `- **vinyl_chloride (2 rows, Oral SF + Inhalation UR):** correctly AMBIGUOUS -- the PDF has adult vs.`,
        `  from-birth variants for both (Oral SF 0.24/0.48; Inhalation UR 0.0044/0.0088 per mg/m3, page 50),`,
        `  and the catalog's \`applicability\` text is generic with no adult/from-birth qualifier. The`,
        `  catalog's stored values (0.24, 0.0000044 per ug/m3 = 0.0044 per mg/m3) happen to match the "adult"`,
        `  PDF row, but per this cross-check's design, a numeric coincidence does not substitute for`,
        `  catalog-side disambiguating metadata -- this is correctly flagged for human review, not silently`,
        `  accepted as a match.`,
        ``,
        `**Net result: zero confirmed catalog errors found in this scan** (beyond chlorobenzene, already`,
        `corrected in this session -- see the companion PR). All AMBIGUOUS rows are genuine source-document`,
        `population/exposure-scenario variants (or one benign extractor quirk) that the catalog's own`,
        `metadata doesn't yet disambiguate -- these are candidates for a FUTURE session to add explicit`,
        `qualifier/population metadata to the catalog rows (so they resolve cleanly), not evidence of wrong`,
        `values. No further catalog edits are made in this PR beyond the chlorobenzene correction.`,
        ``,
    ];
} else {
    const newIds = [...currentAmbiguousIds].filter(id => !VERIFIED_AMBIGUOUS_IDS_2026_07_06.has(id));
    const resolvedIds = [...VERIFIED_AMBIGUOUS_IDS_2026_07_06].filter(id => !currentAmbiguousIds.has(id));
    adjudicationSection = [
        `## Adjudication Notes -- STALE, MANUAL RE-VERIFICATION REQUIRED`,
        ``,
        `> **WARNING:** the current run's AMBIGUOUS row set (or MISMATCH count) no longer matches the`,
        `> 2026-07-06 hand-verified baseline. The detailed per-row adjudication from that session (zinc`,
        `> age-stratified UL, manganese PM3.5 false-positive, methylmercury generic-text row, vinyl`,
        `> chloride adult/from-birth ambiguity) may NOT apply to the rows below -- DO NOT treat this run`,
        `> as "zero confirmed catalog errors" until a human re-verifies the drifted rows against the real`,
        `> PDF and updates this section.`,
        ``,
        `- MISMATCH count this run: ${stats.MISMATCH} (expected 0 at last verification)`,
        `- New AMBIGUOUS ids not in the 2026-07-06 verified set: ${newIds.length ? newIds.join(', ') : 'none'}`,
        `- Previously-ambiguous ids that resolved (no longer ambiguous, or removed from catalog): ${resolvedIds.length ? resolvedIds.join(', ') : 'none'}`,
        ``,
    ];
}

const mdOut = [
    `> **CANDIDATE LEADS ONLY -- NOT CATALOG CONCLUSIONS.** Every row below is a candidate for human adjudication against the actual PDF page before any catalog edit. This script's own extraction/matching logic can have bugs; do not apply any MISMATCH or AMBIGUOUS finding to the catalog without independently re-reading the cited PDF page.`,
    ``,
    `## Extraction Command`,
    `Generated via \`scripts/matrix-options/hc_trv_v4_extract.py\`.`,
    ``,
    `## Mapping Constants`,
    `\`\`\`js`,
    `const INPUT_KEY_TO_PDF_TYPE = ${JSON.stringify(INPUT_KEY_TO_PDF_TYPE, null, 2)};`,
    `const CATALOG_TO_PDF_UNIT_FACTOR = ${JSON.stringify(CATALOG_TO_PDF_UNIT_FACTOR, null, 2)};`,
    `\`\`\`\n`,
    `## Validation Cases`,
    ...validationResults.map(r => `- ${r.name}: **${r.pass ? 'PASS' : 'FAIL'}**`),
    ``,
    `## Summary`,
    `- catalog_rows_scanned: ${stats.catalog_rows_scanned}`,
    `- MATCH count: ${stats.MATCH}`,
    `- MISMATCH count: ${stats.MISMATCH}`,
    `- AMBIGUOUS count: ${stats.AMBIGUOUS}`,
    `- TYPE-OR-NAME-NOT-FOUND count: ${stats['TYPE-OR-NAME-NOT-FOUND']}`,
    ``,
    `## MISMATCH Rows`,
    `| Substance Key | Input Key | Catalog Value | PDF Value | PDF Page | Parameter Value ID |`,
    `|---|---|---|---|---|---|`,
    ...mismatchRows.map(r => `| ${r.catalog.substance_key} | ${r.catalog.input_key} | ${r.catalog.value} | ${r.pdf.value} | ${r.pdf.page_1indexed} | ${r.catalog.parameter_value_id} |`),
    ``,
    `## AMBIGUOUS Rows`,
    `| Substance Key | Input Key | Catalog Value | PDF Candidate Values | Parameter Value ID |`,
    `|---|---|---|---|---|`,
    ...ambiguousRows.map(r => `| ${r.catalog.substance_key} | ${r.catalog.input_key} | ${r.catalog.value} | ${r.candidates.map(c => c.value + " (pg " + c.page_1indexed + ")").join(', ')} | ${r.catalog.parameter_value_id} |`),
    ``,
    ...adjudicationSection,
    `## TYPE-OR-NAME-NOT-FOUND Rows`,
    `| Substance Key | Input Key | Parameter Value ID |`,
    `|---|---|---|`,
    ...notFoundRows.map(r => `| ${r.catalog.substance_key} | ${r.catalog.input_key} | ${r.catalog.parameter_value_id} |`),
    ``,
    `## MATCH Rows (Summary)`,
    `Total MATCH rows: ${stats.MATCH}`,
    matchRows.map(r => r.catalog.substance_key).join(', ')
];

fs.writeFileSync('docs/MATRIX_OPTIONS_HC_TRV_V4_CROSSCHECK_2026_07_06.md', mdOut.join('\n'));

const closeout = [
    `## Validation Cases`,
    ...validationResults.map(r => `- ${r.name}: **${r.pass ? 'PASS' : 'FAIL'}**`),
    ``,
    `## Summary`,
    `- catalog_rows_scanned: ${stats.catalog_rows_scanned}`,
    `- MATCH count: ${stats.MATCH}`,
    `- MISMATCH count: ${stats.MISMATCH}`,
    `- AMBIGUOUS count: ${stats.AMBIGUOUS}`,
    `- TYPE-OR-NAME-NOT-FOUND count: ${stats['TYPE-OR-NAME-NOT-FOUND']}`,
    ``,
    `## First 5 MISMATCH rows`,
    mismatchRows.length === 0 ? "none found" : mismatchRows.slice(0, 5).map(r => `- ${r.catalog.substance_key} (${r.catalog.input_key}): Catalog ${r.catalog.value} != PDF ${r.pdf.value}`).join('\n')
];

fs.appendFileSync('.tmp_agy_closeout_hc_comparator.md', '\n\n' + closeout.join('\n'));
