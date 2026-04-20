/**
 * Tests for SQL injection hardening in queries/index.ts.
 *
 * Covers:
 *   - getSubmissions: allowlist fallback for orderBy
 *   - getAssessments: LIMIT/OFFSET parameterization with preserved truthiness semantics
 *
 * Mocks `../client` so tests run without better-sqlite3's native build.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

const { executeQueryMock } = vi.hoisted(() => ({
  executeQueryMock: vi.fn<(sql: string, params?: unknown[]) => unknown[]>(() => []),
}));

vi.mock('../../client', () => ({
  executeQuery: (sql: string, params?: unknown[]) => executeQueryMock(sql, params),
  getDatabase: vi.fn(),
  getOne: vi.fn(),
  executeStatement: vi.fn(),
}));

import { getSubmissions, getAssessments } from '../index';

beforeEach(() => {
  executeQueryMock.mockClear();
});

describe('getSubmissions — orderBy allowlist', () => {
  it('retains valid orderBy="imported_at"', () => {
    getSubmissions('imported_at');
    const [sql] = executeQueryMock.mock.calls[0];
    expect(sql).toMatch(/ORDER BY imported_at DESC/);
  });

  it('retains valid orderBy="evaluation_completed"', () => {
    getSubmissions('evaluation_completed');
    const [sql] = executeQueryMock.mock.calls[0];
    expect(sql).toMatch(/ORDER BY evaluation_completed DESC/);
  });

  it('defaults to imported_at when orderBy is omitted', () => {
    getSubmissions();
    const [sql] = executeQueryMock.mock.calls[0];
    expect(sql).toMatch(/ORDER BY imported_at DESC/);
  });

  it('falls back to imported_at for a malicious string at runtime', () => {
    const malicious = "imported_at; DROP TABLE submissions --" as unknown as 'imported_at';
    getSubmissions(malicious);
    const [sql] = executeQueryMock.mock.calls[0];
    expect(sql).toMatch(/ORDER BY imported_at DESC/);
    expect(sql).not.toMatch(/DROP TABLE/i);
  });

  it('falls back to imported_at for an unknown column name', () => {
    const bogus = 'created_at' as unknown as 'imported_at';
    getSubmissions(bogus);
    const [sql] = executeQueryMock.mock.calls[0];
    expect(sql).toMatch(/ORDER BY imported_at DESC/);
    expect(sql).not.toMatch(/created_at/);
  });
});

describe('getAssessments — LIMIT/OFFSET parameterization', () => {
  it('omits LIMIT and OFFSET when no pagination filters are provided', () => {
    getAssessments('sub-1');
    const [sql, params] = executeQueryMock.mock.calls[0];
    expect(sql).not.toMatch(/LIMIT/);
    expect(sql).not.toMatch(/OFFSET/);
    expect(params).toEqual(['sub-1']);
  });

  it('uses LIMIT ? and appends limit to params', () => {
    getAssessments('sub-1', { limit: 50 });
    const [sql, params] = executeQueryMock.mock.calls[0];
    expect(sql).toMatch(/LIMIT \?/);
    expect(sql).not.toMatch(/LIMIT \d/);
    expect(params).toEqual(['sub-1', 50]);
  });

  it('uses LIMIT ? OFFSET ? and appends both to params', () => {
    getAssessments('sub-1', { limit: 25, offset: 100 });
    const [sql, params] = executeQueryMock.mock.calls[0];
    expect(sql).toMatch(/LIMIT \?/);
    expect(sql).toMatch(/OFFSET \?/);
    expect(sql).not.toMatch(/LIMIT \d/);
    expect(sql).not.toMatch(/OFFSET \d/);
    expect(params).toEqual(['sub-1', 25, 100]);
  });

  it('does not append LIMIT when limit is 0 (preserves truthiness semantics)', () => {
    getAssessments('sub-1', { limit: 0 });
    const [sql, params] = executeQueryMock.mock.calls[0];
    expect(sql).not.toMatch(/LIMIT/);
    expect(params).toEqual(['sub-1']);
  });

  it('ignores offset when limit is falsy (current behavior)', () => {
    getAssessments('sub-1', { offset: 50 });
    const [sql, params] = executeQueryMock.mock.calls[0];
    expect(sql).not.toMatch(/LIMIT/);
    expect(sql).not.toMatch(/OFFSET/);
    expect(params).toEqual(['sub-1']);
  });

  it('rejects injection attempts that would have been interpolated as raw SQL', () => {
    const malicious = "1; DROP TABLE assessments --" as unknown as number;
    getAssessments('sub-1', { limit: malicious });
    const [sql, params] = executeQueryMock.mock.calls[0];
    expect(sql).toMatch(/LIMIT \?$/m);
    expect(sql).not.toMatch(/DROP TABLE/i);
    expect(params).toEqual(['sub-1', malicious]);
  });
});
