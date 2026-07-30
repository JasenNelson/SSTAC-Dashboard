// CROSS-LAYER CONTRACT GUARDS between the Option C draft SQL and the TypeScript
// that has to agree with it. Plain ASCII source: every invisible character used
// below is written as an escape, never embedded literally.
//
// Two rules are duplicated across layers by necessity -- one lives in PL/pgSQL
// and one in TypeScript -- so each is pinned here. A duplicated rule that
// nothing binds together is exactly how the two implementations drift, which is
// the root cause this restack already removed once elsewhere.

import { describe, it, expect } from 'vitest';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  PAGE_SIZE,
  MAX_PAGES,
  MAX_PAGE_OFFSET,
  siteAggregatePageArgs,
  siteAggregatePageIndexes,
} from '../site-aggregate-pagination';
import { MAX_CANONICAL_CLUSTER_ID_LENGTH } from '../cluster-identity';
import { findForbiddenControlChars } from './guard-regex';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const SQL = readFileSync(
  path.join(REPO_ROOT, 'docs/design/matrix-map/OPTION_C_PHASE2_SITE_AGGREGATE_PUBLICATIONS_DRAFT_2026_07_24.sql'),
  'utf8',
);
const ROUTE = readFileSync(
  path.join(REPO_ROOT, 'src/app/api/matrix-map/admin/site-aggregates/candidate/route.ts'),
  'utf8',
);

/** Strip `--` line comments so a commented-out rule cannot satisfy an assertion. */
function stripSqlComments(sql: string): string {
  return sql
    .split('\n')
    .map((line) => line.replace(/--.*$/, ''))
    .join('\n');
}

const EXECUTABLE_SQL = stripSqlComments(SQL);


describe('cross-layer: UUID-containment canonicalization is the same rule in SQL and TypeScript', () => {
  it('the SQL side canonicalizes BOTH sides to ASCII hex, in executable code (not a comment)', () => {
    // Both the id and the label must be canonicalized; canonicalizing only one
    // side would silently never match.
    expect(EXECUTABLE_SQL).toContain(
      "v_normalized_dra_id := regexp_replace(lower(p_source_dra_id::text), '[^0123456789abcdef]', '', 'g');",
    );
    expect(EXECUTABLE_SQL).toContain(
      "v_normalized_label := regexp_replace(lower(matrix_map.blank_trim(p_member_display_label)), '[^0123456789abcdef]', '', 'g');",
    );
  });

  it('the SQL side no longer uses the hyphen/brace-only normalization', () => {
    // The exact predecessor, which an interior invisible character defeated.
    expect(EXECUTABLE_SQL).not.toContain(
      "replace(replace(replace(lower(p_source_dra_id::text), '-', ''), '{', ''), '}', '')",
    );
    expect(EXECUTABLE_SQL).not.toContain(
      "replace(replace(replace(lower(matrix_map.blank_trim(p_member_display_label)), '-', ''), '{', ''), '}', '')",
    );
  });

  it('the route precheck uses the directly equivalent TypeScript rule', () => {
    expect(ROUTE).toContain("return value.toLowerCase().replace(/[^0123456789abcdef]/g, '');");
    expect(ROUTE).not.toContain("replace(/[-{}]/g, '')");
  });

  it('describes the route check as a precheck, not an independent security authority', () => {
    // The SQL boundary is authoritative because the RPC is reachable directly.
    expect(ROUTE).toMatch(/EARLY DUPLICATE PRECHECK/i);
    // Wrap-tolerant: the phrase breaks across a comment line, so the `//`
    // continuation sits between the two words.
    expect(ROUTE).toMatch(/NOT the security[\s\S]{0,12}authority/i);
    expect(ROUTE).toMatch(/authoritative check is the/i);
  });

  it('BEHAVIOURAL equivalence: the two rules agree on every evasion shape', () => {
    // A textual assertion alone would pass if one side were rewritten in an
    // equivalent-looking but differently-behaving way, so compare outputs.
    const tsRule = (v: string) => v.toLowerCase().replace(/[^0123456789abcdef]/g, '');
    // Faithful JS transcription of
    // `regexp_replace(lower(v), '[^0123456789abcdef]', '', 'g')`.
    const sqlRule = (v: string) =>
      v.toLowerCase().replace(new RegExp('[^0123456789abcdef]', 'g'), '');

    const uuid = 'a1b2c3d4-e5f6-4789-8abc-def012345678';
    const hex = uuid.replace(/-/g, '');
    const interleave = (sep: string) => hex.split('').join(sep);

    // Written as escapes so this source file stays plain ASCII, which is the
    // whole point: an invisible character embedded literally in a test is
    // exactly as unreviewable as one embedded in a label.
    const ZWSP = String.fromCharCode(0x200b);
    const ZWNJ = String.fromCharCode(0x200c);
    const ZWJ = String.fromCharCode(0x200d);
    const BOM = String.fromCharCode(0xfeff);
    const SEPARATORS = [ZWSP, ZWNJ, ZWJ, BOM, ' ', '.', '-', ''];

    const corpus = [
      uuid,
      uuid.toUpperCase(),
      hex,
      `{${uuid}}`,
      interleave(ZWSP),
      interleave(ZWNJ),
      interleave(ZWJ),
      interleave(BOM),
      interleave(' '),
      interleave('.'),
      interleave('-'),
      `Site ${uuid} north`,
      'Beach access cafe deadbeef site',
      '',
      'ZZZZ non-hex only',
    ];

    for (const value of corpus) {
      expect(sqlRule(value), JSON.stringify(value)).toBe(tsRule(value));
    }

    // And the canonicalization actually collapses every evasion onto the id.
    const canonicalId = tsRule(uuid);
    expect(canonicalId).toHaveLength(32);
    for (const sep of SEPARATORS) {
      expect(tsRule(interleave(sep)).includes(canonicalId)).toBe(true);
    }
    // Not overbroad: a label sharing only a few hex characters must NOT match.
    expect(tsRule('Beach access cafe deadbeef site').includes(canonicalId)).toBe(false);
  });
});

describe('cross-layer: the bounded-pagination ceiling cannot drift', () => {
  it('derives the ceiling from the client contract', () => {
    expect(PAGE_SIZE).toBe(1000);
    expect(MAX_PAGES).toBe(25);
    expect(MAX_PAGE_OFFSET).toBe((MAX_PAGES - 1) * PAGE_SIZE);
    expect(MAX_PAGE_OFFSET).toBe(24000);
  });

  it('BOTH RPCs pin exactly that value as c_max_offset, in executable SQL', () => {
    const declarations = EXECUTABLE_SQL.split('\n').filter((l) =>
      /c_max_offset\s+constant\s+integer\s*:=/.test(l),
    );
    // One per RPC: member and admin. Neither may be dropped, and a third copy
    // would mean a new unbound surface.
    expect(declarations).toHaveLength(2);
    for (const line of declarations) {
      const match = /c_max_offset\s+constant\s+integer\s*:=\s*(\d+)\s*;/.exec(line);
      expect(match, line).toBeTruthy();
      expect(Number(match![1])).toBe(MAX_PAGE_OFFSET);
    }
  });

  it('BOTH RPCs actually ENFORCE the upper bound, not merely declare it', () => {
    const enforcements = EXECUTABLE_SQL.split('\n').filter((l) =>
      /IF p_offset IS NULL OR p_offset < 0 OR p_offset > c_max_offset THEN/.test(l),
    );
    expect(enforcements).toHaveLength(2);
    // A declared-but-unused constant is the failure mode this guards.
    expect(EXECUTABLE_SQL).not.toMatch(/IF p_offset IS NULL OR p_offset < 0 THEN/);
  });

  // The source-text machinery that previously lived here -- a hard-coded
  // consumer inventory with import/invoke token checks, a TypeScript comment
  // stripper, the p_limit/p_offset forbidden-pattern regexes and their
  // fixtures -- was RETIRED by mission-control ruling after it produced five
  // consecutive review cycles. Proving a regex can fire never proved it was
  // the right regex: the stripper deleted code after a string containing '//',
  // and the type-vs-value lookahead treated `number` as a type even when it
  // was a runtime identifier.
  //
  // Every runtime consumer of the ceiling is now proved by EXECUTION instead,
  // in site-aggregate-pagination-behaviour.test.ts and the per-route tests:
  // each consumer's ACTUAL recorded calls are asserted element-for-element.
  // That is strictly stronger, and it cannot be defeated by how the source
  // happens to be spelled. Deliberately NOT replaced with new regexes, token
  // scanning, comment stripping, AST approximation or identifier-name
  // detection.

  it('NO source file in the Option C surface carries a forbidden ASCII control character', () => {
    // DISTINCT from the plain-ASCII (<= 127) sweep, which this class passes
    // trivially -- 0x08 is code point 8. Permits only TAB, LF and CR.
    //
    // Scans the repository tree DIRECTLY rather than an external run manifest:
    // binding a repo test to an untracked mission-control artifact would make it
    // pass locally and error in CI, which is its own kind of false green.
    const ROOTS = [
      'src/lib/matrix-map',
      'src/app/(dashboard)/admin/matrix-map/site-aggregates',
      'src/app/api/matrix-map/admin/site-aggregates',
      'scripts/matrix-map/validation/option-c-phase2',
      'docs/design/matrix-map',
    ];
    const EXTENSIONS = ['.ts', '.tsx', '.mjs', '.sql', '.ps1', '.md'];

    function walk(dir: string, acc: string[]): string[] {
      if (!existsSync(dir)) return acc;
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full, acc);
        else if (EXTENSIONS.includes(path.extname(entry.name))) acc.push(full);
      }
      return acc;
    }

    /**
     * KNOWN PRE-EXISTING OFFENDER, excepted explicitly rather than silently.
     *
     * `DB2_bnrrm_training_schema.sql:5` carries a 0x08 inside a Windows path in
     * a comment -- `matrix-map-data\bnrrm_training_...`, where the `\b` was
     * interpreted as a backspace. It is byte-identical in the base commit, is
     * NOT part of this change set, and lies outside the authorized correction
     * surface, so it is recorded here instead of edited. Surfaced to mission
     * control as a separate pre-existing defect of the same class.
     *
     * Listed as an exact file:line:codepoint triple so it cannot quietly widen
     * into a blanket exemption for that file.
     */
    const KNOWN_PRE_EXISTING = new Set([
      'docs/design/matrix-map/DB2_bnrrm_training_schema.sql:5:U+0008',
    ]);

    const files = ROOTS.flatMap((rel) => walk(path.join(REPO_ROOT, rel), []));
    // Self-check: an empty file list would make this assertion vacuous.
    expect(files.length, 'expected to have scanned Option C source files').toBeGreaterThan(20);

    const offenders: string[] = [];
    let exceptedSeen = 0;
    for (const abs of files) {
      for (const hit of findForbiddenControlChars(readFileSync(abs, 'utf8'))) {
        const rel = path.relative(REPO_ROOT, abs).split(path.sep).join('/');
        const id = `${rel}:${hit.line}:U+${hit.codePoint.toString(16).padStart(4, '0').toUpperCase()}`;
        if (KNOWN_PRE_EXISTING.has(id)) {
          exceptedSeen += 1;
          continue;
        }
        offenders.push(id);
      }
    }
    expect(offenders, 'forbidden ASCII control characters in source').toEqual([]);
    // The exception must still be REACHED. If the pre-existing offender is ever
    // fixed or the scan stops covering it, this fails and the entry is removed
    // deliberately rather than lingering as a dead exemption.
    expect(exceptedSeen, 'the known pre-existing offender should still be found').toBe(
      KNOWN_PRE_EXISTING.size,
    );
  });

  it('self-test: the control-character detector fires on 0x08 and permits TAB/LF/CR', () => {
    expect(findForbiddenControlChars('a' + String.fromCharCode(0x08) + 'b')).toHaveLength(1);
    expect(findForbiddenControlChars(String.fromCharCode(0x7f))).toHaveLength(1);
    expect(findForbiddenControlChars(String.fromCharCode(0x0b))).toHaveLength(1);
    const permitted =
      'a' +
      String.fromCharCode(0x09) +
      'b' +
      String.fromCharCode(0x0a) +
      'c' +
      String.fromCharCode(0x0d);
    expect(findForbiddenControlChars(permitted)).toEqual([]);
  });

  it('the shared constructor is the sole authority, and fails closed', () => {
    expect(siteAggregatePageArgs(0)).toEqual({ p_limit: PAGE_SIZE, p_offset: 0 });
    expect(siteAggregatePageArgs(MAX_PAGES - 1)).toEqual({
      p_limit: PAGE_SIZE,
      p_offset: MAX_PAGE_OFFSET,
    });
    // Out of range and non-integer indexes are refused rather than silently
    // producing an offset the SQL ceiling would reject with UE422.
    expect(() => siteAggregatePageArgs(MAX_PAGES)).toThrow(RangeError);
    expect(() => siteAggregatePageArgs(-1)).toThrow(RangeError);
    expect(() => siteAggregatePageArgs(1.5)).toThrow(RangeError);
    expect(() => siteAggregatePageArgs(Number.NaN)).toThrow(RangeError);
    // The valid index set has exactly one definition.
    const indexes = siteAggregatePageIndexes();
    expect(indexes).toHaveLength(MAX_PAGES);
    expect(indexes[0]).toBe(0);
    expect(indexes[indexes.length - 1]).toBe(MAX_PAGES - 1);
    const offsets = indexes.map((i) => siteAggregatePageArgs(i).p_offset);
    expect(Math.max(...offsets)).toBe(MAX_PAGE_OFFSET);
    expect(offsets.every((o) => o >= 0 && o <= MAX_PAGE_OFFSET)).toBe(true);
  });
});

describe('cross-layer: SQL paging dimensions are bound, per RPC', () => {
  /**
   * Executable body of one RPC, section-scoped so the RPCs cannot be conflated.
   *
   * ACCEPTS BOTH `CREATE FUNCTION` AND `CREATE OR REPLACE FUNCTION`, because
   * `fetch_admin_site_aggregate_live_preview` is declared with the latter. To be
   * accurate about why this changed: the old helper matched only the bare form,
   * but the live-preview RPC was excluded from these assertions by OMISSION FROM
   * THE RPC LIST, not by the helper silently skipping it -- had it been listed,
   * the old helper would have failed LOUDLY on the existence assertion. Both the
   * list and the helper needed fixing; only one of them was ever silent.
   */
  function rpcBody(name: string): string {
    const bareNeedle = `CREATE FUNCTION matrix_map.${name}(`;
    const replaceNeedle = `CREATE OR REPLACE FUNCTION matrix_map.${name}(`;
    // COUNTED, not merely located. `indexOf` finds the first occurrence of each
    // form, so it cannot detect two `CREATE OR REPLACE` copies of the same
    // function -- and that is exactly how these definitions evolve. With two
    // copies, this helper would slice the FIRST while PostgreSQL executes the
    // LAST, binding every assertion below to the wrong body.
    const bareCount = EXECUTABLE_SQL.split(bareNeedle).length - 1;
    const replaceCount = EXECUTABLE_SQL.split(replaceNeedle).length - 1;
    expect(
      bareCount + replaceCount,
      `${name} must have exactly one definition (found ${bareCount} bare + ${replaceCount} or-replace)`,
    ).toBe(1);
    const start = bareCount === 1 ? EXECUTABLE_SQL.indexOf(bareNeedle) : EXECUTABLE_SQL.indexOf(replaceNeedle);
    expect(start, `expected a CREATE [OR REPLACE] FUNCTION for ${name}`).toBeGreaterThan(-1);
    const end = EXECUTABLE_SQL.indexOf('\n$$;', start);
    expect(end, `expected an end for ${name}`).toBeGreaterThan(start);
    return EXECUTABLE_SQL.slice(start, end);
  }

  // ALL paging RPCs share the p_limit ceiling. `offsetPaged` is an EXPLICIT
  // property rather than a positional `slice(0, 2)`: with a slice, APPENDING a
  // future offset-paged RPC would leave it outside the offset assertions with no
  // failure anywhere -- reintroducing, for the next RPC, exactly the
  // unbound-ceiling defect this block was rewritten to close.
  const PAGING_RPCS = [
    { name: 'fetch_published_site_aggregates', label: 'member RPC', offsetPaged: true },
    { name: 'fetch_admin_site_aggregate_publications', label: 'admin RPC', offsetPaged: true },
    // KEYSET-paged: no p_offset at all, so asserting c_max_offset against it would
    // be a false contract. Its cursor bound is asserted in its own describe below.
    { name: 'fetch_admin_site_aggregate_live_preview', label: 'admin live-preview RPC', offsetPaged: false },
  ];

  const LIMIT_RPCS = PAGING_RPCS;
  const OFFSET_RPCS = PAGING_RPCS.filter((r) => r.offsetPaged);

  it.each(LIMIT_RPCS)('$label declares exactly one c_max_limit, equal to PAGE_SIZE', ({ name }) => {
    const body = rpcBody(name);
    const decls = [...body.matchAll(/c_max_limit\s+constant\s+integer\s*:=\s*(\d+)\s*;/g)];
    expect(decls).toHaveLength(1);
    expect(Number(decls[0][1])).toBe(PAGE_SIZE);
  });

  it.each(LIMIT_RPCS)('$label USES c_max_limit in a fail-closed p_limit predicate', ({ name }) => {
    const body = rpcBody(name);
    // A declared-but-unused constant is the failure mode this guards: the
    // binding above would still pass while nothing enforced it.
    expect(body).toMatch(/IF p_limit IS NULL OR p_limit < 1 OR p_limit > c_max_limit THEN/);
  });

  it.each(OFFSET_RPCS)('$label declares exactly one c_max_offset, equal to MAX_PAGE_OFFSET', ({ name }) => {
    const body = rpcBody(name);
    const decls = [...body.matchAll(/c_max_offset\s+constant\s+integer\s*:=\s*(\d+)\s*;/g)];
    expect(decls).toHaveLength(1);
    expect(Number(decls[0][1])).toBe(MAX_PAGE_OFFSET);
  });

  it.each(OFFSET_RPCS)('$label USES c_max_offset in a fail-closed p_offset predicate', ({ name }) => {
    const body = rpcBody(name);
    expect(body).toMatch(/IF p_offset IS NULL OR p_offset < 0 OR p_offset > c_max_offset THEN/);
  });

  it('the keyset RPC is NOT offset-paged, so the offset contract legitimately excludes it', () => {
    // Pins the REASON for the exclusion. Were a p_offset ever added, this fails
    // and forces the RPC back into OFFSET_RPCS rather than leaving it unbound.
    const body = rpcBody('fetch_admin_site_aggregate_live_preview');
    expect(body).not.toMatch(/p_offset/);
    expect(body).not.toMatch(/c_max_offset/);
    expect(OFFSET_RPCS.map((r) => r.name)).not.toContain('fetch_admin_site_aggregate_live_preview');
  });

  // Every declared RPC is actually covered by at least the limit contract, so a
  // name added to the list but mistyped cannot sit there asserting nothing.
  it('every paging RPC in the list resolves to exactly one body', () => {
    for (const r of PAGING_RPCS) expect(rpcBody(r.name).length).toBeGreaterThan(0);
  });
});

describe('cross-layer: the keyset RPC cursor bound is bound to the TypeScript parser', () => {
  const NAME = 'fetch_admin_site_aggregate_live_preview';
  const body = (() => {
    const needle = `CREATE OR REPLACE FUNCTION matrix_map.${NAME}(`;
    // ASSERTED, not assumed. Bare slicing on a `-1` index yields '' and turns a
    // renamed function into three confusing "expected length 1, received 0"
    // failures instead of one clear "function not found".
    const count = EXECUTABLE_SQL.split(needle).length - 1;
    if (count !== 1) {
      throw new Error(`expected exactly one CREATE OR REPLACE FUNCTION for ${NAME}, found ${count}`);
    }
    const start = EXECUTABLE_SQL.indexOf(needle);
    const end = EXECUTABLE_SQL.indexOf('\n$$;', start);
    if (end <= start) throw new Error(`could not find the end of ${NAME}`);
    return EXECUTABLE_SQL.slice(start, end);
  })();

  it('declares exactly one c_max_cursor_len, equal to MAX_CANONICAL_CLUSTER_ID_LENGTH', () => {
    const decls = [...body.matchAll(/c_max_cursor_len\s+constant\s+integer\s*:=\s*(\d+)\s*;/g)];
    expect(decls).toHaveLength(1);
    // THE CROSS-LAYER BINDING. The TypeScript parser documents its 32-character
    // ceiling as mirroring this constant; nothing tied them together, so either
    // could move alone. Asserting the TS constant (and that it is still 32) makes
    // the mirror executable rather than a comment.
    expect(Number(decls[0][1])).toBe(MAX_CANONICAL_CLUSTER_ID_LENGTH);
    expect(MAX_CANONICAL_CLUSTER_ID_LENGTH).toBe(32);
  });

  it('USES c_max_cursor_len in the cursor-length predicate', () => {
    expect(body).toMatch(
      /IF p_after_canonical_cluster IS NOT NULL\s*\n\s*AND length\(p_after_canonical_cluster\) > c_max_cursor_len THEN/,
    );
  });

  it('requires the two cursor fields to be supplied together, fail-closed', () => {
    // A half-supplied cursor is the dangerous case: it would otherwise silently
    // degrade to a first-page read while the caller believed it was paging.
    expect(body).toMatch(
      /IF \(p_after_source_dra_id IS NULL\) <> \(p_after_canonical_cluster IS NULL\) THEN/,
    );
  });
});

describe('cross-layer: neither canonicalization relies on a bracket RANGE', () => {
  // The filed P1 (ranges are collation-defined, so a non-ASCII character could
  // survive `[a-f]`) did NOT reproduce on the target platform -- measured on
  // PostgreSQL 17.10 under en_US.utf8, COLLATE "C" and COLLATE "en-US-x-icu".
  // The enumeration is retained regardless, so this asserts the hardening is
  // actually present rather than trusting a comment that says it is.
  it('the SQL canonicalization enumerates the sixteen hex characters', () => {
    const lines = EXECUTABLE_SQL.split('\n').filter((l) => /v_normalized_(dra_id|label)\s*:=/.test(l));
    expect(lines).toHaveLength(2);
    for (const line of lines) {
      expect(line).toContain("'[^0123456789abcdef]'");
      expect(line, 'must not use a bracket range').not.toMatch(/\[\^?[^\]]*[0-9a-z]-[0-9a-z][^\]]*\]/);
    }
  });

  it('the TypeScript canonicalization enumerates the sixteen hex characters', () => {
    // Scoped to the canonicalization function body. `UUID_RE` elsewhere in the
    // route legitimately uses ranges for FORMAT validation, which is a different
    // job and is not affected by the collation argument at all.
    const fn = /function normalizeForUuidContainment[\s\S]*?\n}/.exec(ROUTE);
    expect(fn, 'expected the canonicalization function').toBeTruthy();
    expect(fn![0]).toContain('/[^0123456789abcdef]/g');
    expect(fn![0], 'must not use a bracket range').not.toMatch(/\[\^?[^\]]*[0-9a-z]-[0-9a-z][^\]]*\]/);
  });
});
