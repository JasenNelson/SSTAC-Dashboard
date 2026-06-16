// Unit tests for path-traversal-safe filename handling.
// Uses win32 path semantics (matching safe-path.ts) so traversal with both
// "/" and "\\" separators is covered on a POSIX CI runner. Plain ASCII only.

import { describe, it, expect } from 'vitest';
import path from 'path';
import { safeFilename, resolveWithinBase } from '../safe-path';

describe('safeFilename', () => {
  it('returns a plain filename unchanged', () => {
    expect(safeFilename('report.pdf')).toBe('report.pdf');
    expect(safeFilename('2025 Annual Review.docx')).toBe('2025 Annual Review.docx');
  });

  it('strips POSIX-style traversal segments', () => {
    expect(safeFilename('../../etc/passwd')).toBe('passwd');
    expect(safeFilename('../evil.exe')).toBe('evil.exe');
    expect(safeFilename('sub/dir/file.pdf')).toBe('file.pdf');
  });

  it('strips Windows-style traversal segments and backslashes', () => {
    expect(safeFilename('..\\..\\..\\..\\Windows\\Temp\\evil.exe')).toBe('evil.exe');
    expect(safeFilename('C:\\Windows\\System32\\evil.dll')).toBe('evil.dll');
  });

  it('strips a leading absolute POSIX path', () => {
    expect(safeFilename('/etc/passwd')).toBe('passwd');
  });

  it('rejects empty, dot, and dot-dot names', () => {
    expect(safeFilename('')).toBeNull();
    expect(safeFilename('.')).toBeNull();
    expect(safeFilename('..')).toBeNull();
    expect(safeFilename('../..')).toBeNull(); // basename -> '..'
    expect(safeFilename('/')).toBeNull(); // basename -> ''
  });

  it('rejects null-byte names and non-string inputs', () => {
    expect(safeFilename('evil\0.pdf')).toBeNull();
    expect(safeFilename(undefined)).toBeNull();
    expect(safeFilename(null)).toBeNull();
    expect(safeFilename(42)).toBeNull();
    expect(safeFilename({ name: 'x.pdf' })).toBeNull();
  });

  it('rejects leading-dash names (argv option-injection into --files)', () => {
    expect(safeFilename('--source-dir')).toBeNull();
    expect(safeFilename('--chunk-size')).toBeNull();
    expect(safeFilename('-rf')).toBeNull();
    // traversal that reduces to a leading-dash basename is also rejected
    expect(safeFilename('../--output-dir')).toBeNull();
  });

  it('accepts legitimate names that merely begin with dots', () => {
    expect(safeFilename('..summary.pdf')).toBe('..summary.pdf');
    expect(safeFilename('...notes.txt')).toBe('...notes.txt');
    expect(safeFilename('.hidden.pdf')).toBe('.hidden.pdf');
  });
});

describe('resolveWithinBase', () => {
  const base = 'C:\\Projects\\Regulatory-Review\\1_Active_Reviews\\proj\\0_Source_Documents';
  const resolvedBase = path.win32.resolve(base);

  it('resolves a safe filename to a path inside the base', () => {
    const r = resolveWithinBase(base, 'report.pdf');
    expect(r).not.toBeNull();
    expect(r!.startsWith(resolvedBase)).toBe(true);
    expect(r!.endsWith('report.pdf')).toBe(true);
  });

  it('neutralizes traversal so the result stays inside the base', () => {
    const r = resolveWithinBase(base, '..\\..\\..\\..\\Windows\\Temp\\evil.exe');
    expect(r).not.toBeNull();
    expect(r!.startsWith(resolvedBase)).toBe(true);
    expect(r!.endsWith('evil.exe')).toBe(true);
    // It must NOT have escaped into Windows\Temp.
    expect(r!.includes('Temp')).toBe(false);
  });

  it('neutralizes POSIX traversal as well', () => {
    const r = resolveWithinBase(base, '../../../../etc/passwd');
    expect(r).not.toBeNull();
    expect(r!.startsWith(resolvedBase)).toBe(true);
    expect(r!.endsWith('passwd')).toBe(true);
  });

  it('accepts a legitimate name beginning with dots (no false-reject)', () => {
    const r = resolveWithinBase(base, '..summary.pdf');
    expect(r).not.toBeNull();
    expect(r!.startsWith(resolvedBase)).toBe(true);
    expect(r!.endsWith('..summary.pdf')).toBe(true);
  });

  it('rejects unsafe or empty names', () => {
    expect(resolveWithinBase(base, '..')).toBeNull();
    expect(resolveWithinBase(base, '')).toBeNull();
    expect(resolveWithinBase(base, 'x\0y')).toBeNull();
    expect(resolveWithinBase(base, undefined)).toBeNull();
    expect(resolveWithinBase(base, '--source-dir')).toBeNull();
  });
});
