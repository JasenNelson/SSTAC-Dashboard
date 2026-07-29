/**
 * Parity between the TypeScript `blankTrim` mirror and the authoritative SQL
 * `matrix_map.blank_trim`.
 *
 * The TS copy exists only so the candidate route can predict what the database
 * will have persisted (JavaScript `.trim()` strips U+FEFF but NOT U+200B, and
 * does not track the SQL's explicitly enumerated set;
 * the SQL strips them). That duplication is only safe if it cannot drift, so
 * this test parses the character set OUT OF THE SQL and requires it to equal
 * the TypeScript set exactly.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { BLANK_TRIM_CODEPOINTS, blankTrim } from '@/lib/matrix-map/blank-trim';

const migrationSql = readFileSync(
  join(
    process.cwd(),
    'docs/design/matrix-map/OPTION_C_PHASE2_SITE_AGGREGATE_PUBLICATIONS_DRAFT_2026_07_24.sql',
  ),
  'utf8',
);

/** The `\uXXXX` escapes inside the SQL function's single E-string literal. */
function sqlTrimStringCodepoints(): number[] {
  const fnIdx = migrationSql.indexOf('CREATE OR REPLACE FUNCTION matrix_map.blank_trim(p_text text)');
  expect(fnIdx).toBeGreaterThan(-1);
  const end = migrationSql.indexOf('$blank_trim$;', fnIdx);
  expect(end).toBeGreaterThan(fnIdx);
  const body = migrationSql.slice(fnIdx, end);
  const literal = /E'((?:\\u[0-9A-Fa-f]{4})+)'/.exec(body);
  expect(literal, 'blank_trim must contain exactly one E-string escape literal').not.toBeNull();
  return Array.from(literal![1].matchAll(/\\u([0-9A-Fa-f]{4})/g)).map((m) => parseInt(m[1], 16));
}

describe('blankTrim -- parity with the authoritative SQL', () => {
  it('mirrors the SQL TrimString set EXACTLY, in the same order', () => {
    expect(sqlTrimStringCodepoints()).toEqual([...BLANK_TRIM_CODEPOINTS]);
  });

  it('excludes ZWNJ and ZWJ on BOTH sides', () => {
    // Invisible but orthographically meaningful; stripping them corrupts text.
    const sql = sqlTrimStringCodepoints();
    for (const cp of [0x200c, 0x200d]) {
      expect(sql).not.toContain(cp);
      expect([...BLANK_TRIM_CODEPOINTS]).not.toContain(cp);
    }
  });
});

describe('blankTrim -- behaviour', () => {
  it.each([
    ['tab', '	'],
    ['no-break space', '\u00A0'],
    ['zero width space', '\u200B'],
    ['BOM', '\uFEFF'],
    ['ideographic space', '\u3000'],
    ['mixed run', '	\u00A0\uFEFF'],
  ])('reduces a %s-only value to empty', (_label, value) => {
    expect(blankTrim(value)).toBe('');
  });

  it('strips only the edges, preserving the meaningful core', () => {
    expect(blankTrim('\u200BSite aggregate 1\u00A0')).toBe('Site aggregate 1');
  });

  it.each([
    ['accented text', '\u00E9tude'],
    ['CJK', '\u4F60\u597D'],
    ['ZWJ alone', '\u200D'],
    ['ZWNJ alone', '\u200C'],
  ])('leaves %s untouched', (_label, value) => {
    expect(blankTrim(value)).toBe(value);
  });

  it('differs from String.prototype.trim exactly where the SQL does', () => {
    // This divergence IS the defect the mirror exists to prevent: `.trim()`
    // would have kept the zero-width space, so the route would have compared a
    // label the database never stored.
    const label = '\u200BSite aggregate 1';
    expect(label.trim()).toBe(label);
    expect(blankTrim(label)).toBe('Site aggregate 1');
  });
});
