import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { checkSources, REQUIRED_FILES } from '../phase-c-source-preflight';

describe('Phase C Source Preflight', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'preflight-test-'));
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it('fails when no files are present (empty directory)', () => {
    const success = checkSources(tmpDir);
    expect(success).toBe(false);
    expect(console.error).toHaveBeenCalledWith('ERROR: One or more required source PDFs are missing.');
  });

  it('fails when directory does not exist', () => {
    const success = checkSources(path.join(tmpDir, 'nonexistent'));
    expect(success).toBe(false);
  });

  it('succeeds when all required files are present', () => {
    // Create all required files
    for (const file of REQUIRED_FILES) {
      fs.writeFileSync(path.join(tmpDir, file), 'dummy content');
    }

    const success = checkSources(tmpDir);
    expect(success).toBe(true);
    expect(console.log).toHaveBeenCalledWith('All required Phase C source PDFs are present. You may proceed.');
  });

  it('fails when a required file has the wrong extension', () => {
    // Create files, but give one a .txt extension instead of .pdf
    for (const file of REQUIRED_FILES) {
      if (file === REQUIRED_FILES[0]) {
        fs.writeFileSync(path.join(tmpDir, file.replace('.pdf', '.txt')), 'dummy content');
      } else {
        fs.writeFileSync(path.join(tmpDir, file), 'dummy content');
      }
    }

    const success = checkSources(tmpDir);
    expect(success).toBe(false);
    expect(console.log).toHaveBeenCalledWith(`[FAIL] Missing: ${REQUIRED_FILES[0]}`);
  });

  it('finds files in nested subdirectories', () => {
    const nestedDir = path.join(tmpDir, 'deeply', 'nested', 'folder');
    fs.mkdirSync(nestedDir, { recursive: true });

    // Place files in different locations
    fs.writeFileSync(path.join(tmpDir, REQUIRED_FILES[0]), 'dummy');
    fs.writeFileSync(path.join(path.join(tmpDir, 'deeply'), REQUIRED_FILES[1]), 'dummy');
    fs.writeFileSync(path.join(nestedDir, REQUIRED_FILES[2]), 'dummy');

    const success = checkSources(tmpDir);
    expect(success).toBe(true);
  });
});
