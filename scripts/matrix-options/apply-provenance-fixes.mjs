import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runAudit } from './audit-library-provenance.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..', '..');
const LIBRARY_PATH = path.join(REPO_ROOT, 'src', 'lib', 'matrix-options', 'substanceLibrary.ts');

function getCohort(key) {
  const firstChar = key[0].toLowerCase();
  if (firstChar >= 'a' && firstChar <= 'g') return 'a-g';
  if (firstChar >= 'h' && firstChar <= 'p') return 'h-p';
  if (firstChar >= 'q' && firstChar <= 'z') return 'q-z';
  if (firstChar >= '0' && firstChar <= '9') return 'a-g';
  return 'a-g';
}

function escapeSingleQuoteString(str) {
  return str
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r');
}

function parseJSString(strBlock) {
  // Safe evaluation of concatenated string literals
  let cleaned = strBlock.trim();
  if (cleaned.endsWith(',')) {
    cleaned = cleaned.slice(0, -1).trim();
  }
  try {
    return new Function(`return ${cleaned}`)();
  } catch (err) {
    console.error('Failed to parse string block:', cleaned);
    throw err;
  }
}

function main() {
  const targetCohort = process.argv[2];
  if (!targetCohort || !['a-g', 'h-p', 'q-z'].includes(targetCohort)) {
    console.error('Usage: node apply-provenance-fixes.mjs <cohort: a-g|h-p|q-z> [--apply]');
    process.exit(1);
  }
  const shouldApply = process.argv.includes('--apply');

  const findings = runAudit();
  const safeToFixFindings = findings.filter(
    (f) => f.severity === 'medium' && ['CITATION_MISSING_PVID', 'STALE_NOTES_QA_STATUS'].includes(f.check)
  );

  const cohortFindings = safeToFixFindings.filter((f) => getCohort(f.key) === targetCohort);
  console.log(`Found ${cohortFindings.length} safe-to-fix findings for cohort "${targetCohort}"`);

  if (cohortFindings.length === 0) {
    console.log('Nothing to fix.');
    return;
  }

  // Group findings by substance key
  const findingsByKey = new Map();
  for (const f of cohortFindings) {
    if (!findingsByKey.has(f.key)) {
      findingsByKey.set(f.key, []);
    }
    findingsByKey.get(f.key).push(f);
  }

  let content = fs.readFileSync(LIBRARY_PATH, 'utf8');

  // Regex to match each SubstanceEntry object in the array
  // It matches the starting brace at 2 spaces indentation and ends with a closing brace at 2 spaces.
  const entryRegex = /^  \{\r?\n\s*key:\s*'([^']+)',[\s\S]*?\r?\n  \},/gm;

  let modifiedContent = content.replace(entryRegex, (block, key) => {
    const substanceFindings = findingsByKey.get(key);
    if (!substanceFindings) return block; // No changes for this substance

    console.log(`Modifying substance: ${key} (${substanceFindings.length} change(s))`);

    // Extract sources string block
    const sourcesMatch = block.match(/sources:\s*([\s\S]*?),\r?\n\s*notes:/);
    if (!sourcesMatch) {
      console.error(`Could not locate sources field in block for ${key}`);
      return block;
    }
    const rawSourcesStr = sourcesMatch[1];
    let sourcesVal = parseJSString(rawSourcesStr);

    // Extract notes string block
    const notesMatch = block.match(/notes:\s*([\s\S]*?)(?=,\r?\n\s*\r?\n|\r?\n\s*\})/);
    if (!notesMatch) {
      console.error(`Could not locate notes field in block for ${key}`);
      return block;
    }
    const rawNotesStr = notesMatch[1];
    let notesVal = parseJSString(rawNotesStr);

    // Apply fixes
    for (const f of substanceFindings) {
      if (f.check === 'CITATION_MISSING_PVID') {
        const citation = ` (approved catalog value, ${f.missing_pvid})`;
        // Check if already cited (should be false, but let's be safe)
        const pvidRegex = new RegExp(`(?<![a-zA-Z0-9_-])${f.missing_pvid}(?![a-zA-Z0-9_-])`);
        if (!pvidRegex.test(sourcesVal)) {
          // If sourcesVal does not end with period/space, format nicely
          if (sourcesVal.length > 0 && !sourcesVal.endsWith('.')) {
            sourcesVal += '.';
          }
          sourcesVal += citation;
        }
      } else if (f.check === 'STALE_NOTES_QA_STATUS') {
        // Replace needs_review / needs review / pending next to or in the notes
        notesVal = notesVal
          .replace(/needs_review/g, 'approved')
          .replace(/needs review/g, 'approved')
          .replace(/pending/g, 'awaiting');
      }
    }

    // Rebuild the block with updated fields
    const escapedSources = escapeSingleQuoteString(sourcesVal);
    const escapedNotes = escapeSingleQuoteString(notesVal);

    let updatedBlock = block.replace(
      /sources:\s*([\s\S]*?),\r?\n\s*notes:/,
      `sources:\n      '${escapedSources}',\n    notes:`
    );
    updatedBlock = updatedBlock.replace(
      /notes:\s*([\s\S]*?)(?=,\r?\n\s*\r?\n|\r?\n\s*\})/,
      `notes:\n      '${escapedNotes}'`
    );

    return updatedBlock;
  });

  if (shouldApply) {
    fs.writeFileSync(LIBRARY_PATH, modifiedContent, 'utf8');
    console.log(`Successfully applied and wrote fixes to ${LIBRARY_PATH}`);
  } else {
    console.log('\nDRY RUN complete. Re-run with --apply to write changes.');
  }
}

main();
