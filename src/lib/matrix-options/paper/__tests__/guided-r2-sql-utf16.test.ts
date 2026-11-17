import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../../../..');
const drafts = resolve(root, 'docs/apply-drafts');
const migration = readFileSync(resolve(drafts, 'MATRIX_GUIDED_R2_INACTIVE_2026_11_16.sql'), 'utf8');
const postflight = readFileSync(resolve(drafts, 'MATRIX_GUIDED_R2_POSTFLIGHT_2026_11_16.sql'), 'utf8');
const legacy = readFileSync(resolve(drafts, 'MATRIX_PAPER_REVIEW_PERSISTENCE_DRAFT_2026_09_22.sql'), 'utf8');

function helperBody(sql: string, name: string): string {
  const pattern = new RegExp(`create function public\\.${name}\\(p_(?:value|text) text\\)[\\s\\S]*?as \\$\\$([\\s\\S]*?)\\$\\$;`, 'i');
  const match = sql.match(pattern);
  expect(match, `${name} definition`).not.toBeNull();
  return match![1]
    .replace(/--[^\r\n]*/g, '')
    .replace(/\bp_text\b/g, 'p_value')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

describe('guided R2 SQL UTF-16 helper', () => {
  it('uses the existing legacy SQL formula instead of empty-input regex splitting', () => {
    const guidedBody = helperBody(migration, 'matrix_guided_r2_utf16_units');
    const legacyBody = helperBody(legacy, 'matrix_paper_review_utf16_length');
    expect(guidedBody).toBe(legacyBody);
    expect(guidedBody).not.toContain('regexp_split_to_table');
    expect(migration).toMatch(/language sql immutable strict set search_path = pg_catalog/i);
  });

  it('preserves NULL, empty, ASCII, BMP, and supplementary self-tests in both SQL files', () => {
    const cases = [
      { value: '', literal: "''", units: 0 },
      { value: 'A', literal: "'A'", units: 1 },
      { value: 'ABC', literal: "'ABC'", units: 3 },
      { value: '\u00e9', literal: "U&'\\00E9'", units: 1 },
      { value: '\u{1f600}', literal: "U&'\\+01F600'", units: 2 },
      { value: 'A\u00e9\u{1f600}', literal: "'A' || U&'\\00E9' || U&'\\+01F600'", units: 4 },
    ];

    for (const { value, literal, units } of cases) {
      // PostgreSQL char_length counts code points; the legacy regex adds one
      // for every supplementary code point. JS length is the UTF-16 oracle.
      const points = Array.from(value);
      const formulaUnits = points.length + points.filter((point) => point.codePointAt(0)! > 0xffff).length;
      expect(formulaUnits).toBe(units);
      expect(formulaUnits).toBe(value.length);
      expect(migration).toContain(`public.matrix_guided_r2_utf16_units(${literal}) <> ${units}`);
      expect(postflight).toContain(`public.matrix_guided_r2_utf16_units(${literal}) = ${units}`);
    }

    expect(migration).toContain('public.matrix_guided_r2_utf16_units(null::text) is not null');
    expect(postflight).toContain('public.matrix_guided_r2_utf16_units(null::text) is null');
  });
});
