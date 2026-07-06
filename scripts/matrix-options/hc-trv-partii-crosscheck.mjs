import fs from 'fs';
import path from 'path';

// 1. Load data
const trvData = JSON.parse(fs.readFileSync('matrix_research/reference_catalog/human_health_trv_values.json', 'utf8'));
let paramData = [];
if (fs.existsSync('matrix_research/reference_catalog/parameter_values.json')) {
    paramData = JSON.parse(fs.readFileSync('matrix_research/reference_catalog/parameter_values.json', 'utf8'));
}
const allData = [...trvData, ...paramData];

// 2. Filter 33 rows
const rows = allData.filter(d => 
    d.source_ids && d.source_ids.includes('src-health-canada-trv-v4-2025') && 
    d.input_key === 'rfd_oral_mg_per_kg_bw_day' && 
    d.pathway === 'human-health-direct'
);

// Deduplicate
const uniqueRows = [];
const seenIds = new Set();
for (const r of rows) {
    if (!seenIds.has(r.parameter_value_id)) {
        seenIds.add(r.parameter_value_id);
        uniqueRows.push(r);
    }
}

// 3. Load text
const text = fs.readFileSync('.tmp_hc_partII.txt', 'utf8');
const lines = text.split('\n');
const TABLE_START_IDX = 200; // Skip introductory text to avoid bullet points

function normalizeName(key) {
    const mappings = {
        'chromium_trivalent': ['Chromium, trivalent', 'Chromium (III)', 'Chromium'],
        'chromium_hexavalent': ['Chromium, hexavalent', 'Chromium, hexavalent (VI)', 'Chromium (VI)', 'Chromium'],
        'total_pcbs_aroclor_1254': ['PCBs (total of non-coplanar)', 'non-dioxin-like polychlorinated biphenyls', 'Polychlorinated biphenyls', 'PCBs'],
        'arsenic_inorganic': ['Arsenic (inorganic)', 'Arsenic'],
        'benzo_a_pyrene': ['Benzo[a]pyrene', 'Benzo(a)pyrene'],
        'methylmercury': ['Methylmercury', 'Methyl mercury'],
        'cyanide_free': ['Cyanide'],
        'zinc': ['Zinc'],
        'uranium': ['Uranium (non-radiological)', 'Uranium'],
        'mercury_inorganic': ['Mercury, inorganic', 'Mercury'],
        'carbon_tetrachloride': ['Carbon tetrachloride'],
        'n_hexane': ['n-hexane', 'hexane'],
        'pcbs_non_coplanar': ['PCBs (total of non-coplanar)'],
        'xylenes': ['Xylenes (mixed isomers)', 'Xylene, mixed isomers', 'Xylene'],
        'dichloroethylene_1_1': ['Dichloroethylene, 1,1-', 'Dichloroethylene, 1,1', '1,1-Dichloroethylene']
    };
    if (mappings[key]) return mappings[key];

    let parts = key.split('_');
    let numbers = [];
    let words = [];
    for (let p of parts) {
        if (/^\d+$/.test(p) || /^[a-z]\d*$/.test(p) && p.length <= 2) {
            numbers.push(p);
        } else {
            words.push(p);
        }
    }
    let baseName = words.join(' ');
    let numStr = numbers.join(',');
    
    let variants = [key.replace(/_/g, ' '), baseName];
    if (numStr) {
        variants.push(`${baseName} ${numStr}`);
        variants.push(`${baseName}, ${numStr}-`);
        variants.push(`${baseName}, ${numStr}`);
        variants.push(`${numStr}-${baseName}`);
        variants.push(`${numStr} ${baseName}`);
    }
    return variants;
}

function getExtractedNumbers(key) {
    let variants = normalizeName(key);
    let foundLineIdx = -1;
    
    for (let i = TABLE_START_IDX; i < lines.length; i++) {
        const lineLower = lines[i].toLowerCase();
        let match = false;
        for (const v of variants) {
            const regex = new RegExp(`^\\s*${v.replace(/[-[\]{}()*+?.,\\\\^$|#\\s]/g, '\\\\$&')}`, 'i');
            if (regex.test(lineLower)) {
                match = true;
                break;
            }
        }
        if (match) {
            foundLineIdx = i;
            break;
        }
    }
    
    if (foundLineIdx === -1) {
        for (let i = TABLE_START_IDX; i < lines.length; i++) {
            const lineLower = lines[i].toLowerCase();
            let match = false;
            for (const v of variants) {
                if (lineLower.includes(v.toLowerCase())) {
                    match = true;
                    break;
                }
            }
            if (match) {
                foundLineIdx = i;
                break;
            }
        }
    }

    if (foundLineIdx !== -1) {
        const block = lines.slice(foundLineIdx, foundLineIdx + 3).join(' ');
        const numRegex = /\b\d+(?:\.\d+)?(?:E[+-]\d+)?\b/gi;
        let m;
        const nums = [];
        while ((m = numRegex.exec(block)) !== null) {
            const raw = m[0];
            const val = parseFloat(raw);
            // Noise filter: HC oral TDIs are small decimals/scientific values. Drop bare integers
            // (isomer positions like 1/2/4, other-column counts, citation years like 1992/2001) which
            // the mangled multi-column extraction otherwise mixes in. Keep only decimal/scientific
            // numbers in the plausible oral-TDI magnitude range (0 < v < 5).
            const isDecimalOrSci = /[.eE]/.test(raw);
            if (isDecimalOrSci && val > 0 && val < 5) {
                nums.push(val);
            }
        }
        return [...new Set(nums)];
    }
    return [];
}

let results = [];
let noMatchCount = 0;
let ourValuePresentCount = 0;

for (const row of uniqueRows) {
    const key = row.substance_key;
    const ourVal = row.value;
    
    let extractedNumbers = getExtractedNumbers(key);
    
    let classification = 'NAME-NOT-FOUND';
    let ratio = 'N/A';
    let smallestFound = null;
    let note = '';
    
    if (extractedNumbers.length > 0) {
        smallestFound = Math.min(...extractedNumbers.filter(n => n > 0));
        let matchFound = false;
        for (const n of extractedNumbers) {
            const max = Math.max(ourVal, n);
            const min = Math.min(ourVal, n);
            if (min > 0 && max / min < 2.0) {
                matchFound = true;
                break;
            }
        }
        
        if (matchFound) {
            classification = 'OUR_VALUE_PRESENT';
            ourValuePresentCount++;
        } else {
            classification = 'NO_HC_MATCH';
            noMatchCount++;
        }
        
        if (smallestFound && smallestFound > 0) {
            ratio = (ourVal / smallestFound).toFixed(2);
        }
    } else {
        // Did we find the name but no numbers? 
        // We can just assume NAME-NOT-FOUND since no numbers were extracted.
        classification = 'NAME-NOT-FOUND';
    }
    
    results.push({
        key,
        ourVal,
        foundNumbers: extractedNumbers.join(', '),
        classification,
        ratio,
        note
    });
}

let md = `# MATRIX OPTIONS HC TRV PART II CROSSCHECK\n\n`;
md += `> **CAVEAT (PRELIMINARY)**: this compares our catalog's Health Canada TRV **v4.0 (2025)** values against the **HC 2010 Part II** TRV table (the only HC TRV compilation available locally; the actual v4.0 tables are order-a-copy / not web-published). Because 2010 != v4.0, MOST differences below are LEGITIMATE HC v4.0 updates (e.g. carbon_tetrachloride 0.00071 vs 2010 0.02; cadmium 0.0008 vs 2010 0.126), NOT errors. The automated name-match + mangled-PDF extraction ALSO have known gaps (some substances show NAME-NOT-FOUND or empty values though they are in the table). Treat every row as a LEAD requiring adjudication against the actual v4.0 document -- NOT an audit conclusion.\n\n`;

md += `## CONFIRMED FINDINGS (manually verified)\n\n`;
md += `- **chlorobenzene** -- our catalog HC oral RfD 0.43 was the inhalation TC (mg/m3); HC oral TDI = 0.063. Fixed to US EPA IRIS 0.02 interim (PR #513).\n`;
md += `- **dichlorobenzene_1_2** -- our catalog HC oral RfD 0.43 is an outdated PSL1-1993 value; HC Part II oral TDI = 0.03. The HC 0.43 rows are quarantined (superseded); default remains US EPA IRIS 0.09 interim.\n\n`;
md += `## NEXT STEP\n\nA definitive full HC audit requires the HC TRV **v4.0 (2025)** document (order-a-copy / not web-published). Re-point this script at a v4.0 extraction when available for a clean cross-check.\n\n`;

md += `## PRIORITY REVIEW (NO_HC_MATCH)\n\n`;
md += `| Substance Key | Our v4.0 oral RfD | Part II Numbers Found | Classification | Ratio to Smallest | Note |\n`;
md += `|---|---|---|---|---|---|\n`;

for (const r of results) {
    if (r.key === 'chlorobenzene') {
        r.note += ' (HC 2010 TDI = 0.063, TC = 0.43; our catalog had 0.43, confirmed script classifies this)';
    }
    
    let isSwap = false;
    if (r.classification === 'OUR_VALUE_PRESENT' && parseFloat(r.ratio) > 2.0) {
        isSwap = true;
    }
    
    if (r.classification === 'NO_HC_MATCH' || r.classification === 'NAME-NOT-FOUND' || isSwap) {
        md += `| ${r.key} | ${r.ourVal} | ${r.foundNumbers} | ${r.classification} | ${r.ratio} | ${r.note} |\n`;
    }
}

md += `\n## ALL OTHER ROWS\n\n`;
md += `| Substance Key | Our v4.0 oral RfD | Part II Numbers Found | Classification | Ratio to Smallest | Note |\n`;
md += `|---|---|---|---|---|---|\n`;
for (const r of results) {
    let isSwap = r.classification === 'OUR_VALUE_PRESENT' && parseFloat(r.ratio) > 2.0;
    if (r.classification !== 'NO_HC_MATCH' && r.classification !== 'NAME-NOT-FOUND' && !isSwap) {
         md += `| ${r.key} | ${r.ourVal} | ${r.foundNumbers} | ${r.classification} | ${r.ratio} | ${r.note} |\n`;
    }
}

fs.mkdirSync('docs', { recursive: true });
fs.writeFileSync('docs/MATRIX_OPTIONS_HC_TRV_PARTII_CROSSCHECK_2026_07_05.md', md);

console.log(`ROWS PROCESSED: ${results.length}`);
console.log(`OUR_VALUE_PRESENT: ${ourValuePresentCount}`);
console.log(`NO_HC_MATCH: ${noMatchCount}`);
console.log(`NAME-NOT-FOUND: ${results.filter(r => r.classification === 'NAME-NOT-FOUND').length}`);

console.log(`\nSPOT CHECKS:`);
['chlorobenzene', 'carbon_tetrachloride', 'barium', 'benzene'].forEach(k => {
    let nums = getExtractedNumbers(k);
    console.log(`- ${k}: [${nums.join(', ')}]`);
});
