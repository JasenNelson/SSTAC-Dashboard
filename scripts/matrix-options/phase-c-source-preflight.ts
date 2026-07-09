import * as fs from 'fs';
import * as path from 'path';

// Preflight check script for Phase C source PDFs
// Usage: ts-node phase-c-source-preflight.ts [optional-root-path]

const REQUIRED_FILES = [
  'WHO-2005_TEF_paper.pdf',
  'WHO-1998_TEF_paper.pdf',
  'HC_PQRA_v4.0.pdf'
];

// Helper to recursively find files
function findFile(dir: string, fileName: string): string | null {
  if (!fs.existsSync(dir)) return null;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const result = findFile(fullPath, fileName);
      if (result) return result;
    } else if (entry.name === fileName) {
      return fullPath;
    }
  }
  return null;
}

function checkSources(rootPath: string) {
  let allFound = true;
  console.log(`Starting Phase C source preflight check...`);
  console.log(`Scanning root path: ${rootPath}\n`);

  for (const fileName of REQUIRED_FILES) {
    const foundPath = findFile(rootPath, fileName);
    
    if (foundPath) {
      console.log(`[PASS] Found: ${fileName} at ${foundPath}`);
    } else {
      console.log(`[FAIL] Missing: ${fileName}`);
      allFound = false;
    }
  }

  console.log('\n--- Preflight Summary ---');
  if (allFound) {
    console.log('All required Phase C source PDFs are present. You may proceed.');
    process.exit(0);
  } else {
    console.error('ERROR: One or more required source PDFs are missing.');
    console.error('Please ensure the owner uploads these to the reference catalog to satisfy data provenance requirements.');
    process.exit(1);
  }
}

const targetPath = process.argv[2] || path.resolve('matrix_research/reference_catalog');
checkSources(targetPath);
