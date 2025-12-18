#!/usr/bin/env node
/**
 * Update docs/_meta/docs-manifest.json facts from test outputs
 * 
 * This script extracts test counts from test command outputs and updates
 * the manifest facts automatically, preventing manual JSON edits.
 * 
 * Usage:
 *   npm run docs:manifest:update
 *   npm run docs:manifest:update -- --vitest
 *   npm run docs:manifest:update -- --playwright
 *   npm run docs:manifest:update -- --k6
 */

import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';

const MANIFEST_PATH = join(process.cwd(), 'docs/_meta/docs-manifest.json');
const TODAY = new Date().toISOString().split('T')[0];

function readManifest() {
  return JSON.parse(readFileSync(MANIFEST_PATH, 'utf-8'));
}

function writeManifest(manifest) {
  writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + '\n', 'utf-8');
}

function extractVitestCount() {
  try {
    // Run vitest with --reporter=json to get structured output
    // Fallback to parsing text output if JSON reporter not available
    const output = execSync('npm run test:unit 2>&1', { encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 });
    
    // Try to extract count from output
    // Vitest output format: "Test Files  X passed | Y failed | Z total"
    const testFilesMatch = output.match(/Test Files\s+(\d+)\s+passed/i);
    const testsMatch = output.match(/Tests\s+(\d+)\s+passed/i);
    
    if (testsMatch) {
      return parseInt(testsMatch[1], 10);
    }
    
    // Alternative: count test files and estimate (less accurate)
    if (testFilesMatch) {
      console.warn('⚠️  Could not extract exact test count, using test files count');
      return parseInt(testFilesMatch[1], 10);
    }
    
    throw new Error('Could not extract vitest count from output');
  } catch (error) {
    console.error('❌ Error extracting vitest count:', error.message);
    return null;
  }
}

function extractPlaywrightCount() {
  try {
    // Count test files in e2e directory
    const output = execSync('npx playwright test --list 2>&1', { encoding: 'utf-8' });
    const match = output.match(/(\d+)\s+test[s]?/i);
    if (match) {
      return parseInt(match[1], 10);
    }
    throw new Error('Could not extract playwright count');
  } catch (error) {
    console.error('❌ Error extracting playwright count:', error.message);
    return null;
  }
}

function extractK6Count() {
  try {
    // Count k6 test files
    const testsDir = join(process.cwd(), 'tests');
    const files = readdirSync(testsDir);
    const k6Files = files.filter(f => f.startsWith('k6-') && f.endsWith('.js'));
    return k6Files.length;
  } catch (error) {
    console.error('❌ Error extracting k6 count:', error.message);
    return null;
  }
}

function updateFact(manifest, category, key, value, source) {
  if (!manifest.facts[category]) {
    manifest.facts[category] = {};
  }
  
  if (!manifest.facts[category][key]) {
    manifest.facts[category][key] = {
      status: 'unknown',
      value: null,
      source: '',
      last_verified: null
    };
  }
  
  manifest.facts[category][key] = {
    status: value !== null ? 'verified' : 'unknown',
    value: value,
    source: source,
    last_verified: value !== null ? TODAY : null
  };
}

function main() {
  const args = process.argv.slice(2);
  const updateAll = args.length === 0 || args.includes('--all');
  const manifest = readManifest();
  let updated = false;

  if (updateAll || args.includes('--vitest')) {
    console.log('📊 Extracting Vitest test count...');
    const count = extractVitestCount();
    if (count !== null) {
      updateFact(manifest, 'testing', 'vitest_test_count', count, `npm run test:unit output (${TODAY})`);
      console.log(`✅ Updated vitest_test_count: ${count}`);
      updated = true;
    }
  }

  if (updateAll || args.includes('--playwright')) {
    console.log('📊 Extracting Playwright test count...');
    const count = extractPlaywrightCount();
    if (count !== null) {
      updateFact(manifest, 'testing', 'playwright_test_count', count, `playwright test --list output (${TODAY})`);
      console.log(`✅ Updated playwright_test_count: ${count}`);
      updated = true;
    }
  }

  if (updateAll || args.includes('--k6')) {
    console.log('📊 Extracting k6 script count...');
    const count = extractK6Count();
    if (count !== null) {
      updateFact(manifest, 'testing', 'k6_script_count', count, `tests/k6-*.js inventory (${TODAY})`);
      console.log(`✅ Updated k6_script_count: ${count}`);
      updated = true;
    }
  }

  if (updated) {
    writeManifest(manifest);
    console.log('\n✅ Manifest updated successfully!');
  } else {
    console.log('\n⚠️  No updates made. Check errors above.');
    process.exit(1);
  }
}

main();
