// Contract guards for the OWNER-RUN Option C pre-apply runbook. Plain ASCII.
//
// The runbook is executed by a human against LIVE Supabase, so its defects are
// not caught by any other gate. Two classes are guarded here:
//
// 1. FIRST-APPLY SURVIVABILITY. An earlier revision's preflight selected
//    directly from matrix_map.site_aggregate_publications. On a clean first
//    apply that relation does not exist, so the mandatory preflight raised
//    42P01 and aborted before the owner could apply anything - it blocked the
//    exact state it exists to describe.
//
// 2. HASH TRUTH. The runbook pins the exact SQL bytes the owner is authorized to
//    apply. If the SQL changes and the recorded hash does not, the owner
//    verifies against a stale digest and the pin is worthless. The assertions
//    below make that drift a TEST FAILURE rather than a silent lie.

import { describe, it, expect } from 'vitest';
import { readFileSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const RUNBOOK = path.join(
  REPO_ROOT,
  'docs/design/matrix-map/OPTION_C_PREAPPLY_RUNBOOK_2026_07_26.md',
);
const SQL = path.join(
  REPO_ROOT,
  'docs/design/matrix-map/OPTION_C_PHASE2_SITE_AGGREGATE_PUBLICATIONS_DRAFT_2026_07_24.sql',
);

const runbook = readFileSync(RUNBOOK, 'utf8');

/**
 * Extract a single numbered section's body: from its "## N. " heading up to
 * (but excluding) the next "## " heading, or end of file.
 *
 * This is what makes the postflight assertions below section-SCOPED rather
 * than global. A global `runbook.toContain(...)` cannot tell the difference
 * between a guarded statement living in the postflight (section 5, where it
 * is REQUIRED) and the same string living only in the preflight (section 3,
 * where it is merely tolerant). Removing the postflight check while leaving
 * the preflight one in place would still satisfy a global assertion - it must
 * not satisfy a section-scoped one.
 */
function section(num) {
  const headingRe = new RegExp(`^## ${num}\\. .*$`, 'm');
  const startMatch = headingRe.exec(runbook);
  expect(startMatch, `expected to find a "## ${num}. " heading`).toBeTruthy();
  const start = startMatch.index;
  const afterHeading = start + startMatch[0].length;
  const rest = runbook.slice(afterHeading);
  const nextHeadingMatch = /^## /m.exec(rest);
  const end = nextHeadingMatch ? afterHeading + nextHeadingMatch.index : runbook.length;
  return runbook.slice(start, end);
}

const preflight = section(3);
const postflight = section(5);

/**
 * Extract the STATE NAME cell (first column, data rows only) from the "which
 * starting state are you in" markdown table within a section. Table rows are
 * lines starting with '|': the first such line is the header, the second is
 * the '---' separator, everything after is a data row whose first cell is the
 * state name (rendered bold, e.g. `**Clean first apply**`).
 *
 * Scoped to STATE NAME cells only, deliberately: the explanatory caveat prose
 * legitimately says `NOT called "compatible reapply"` (lowercase, in quotes)
 * a few paragraphs below the table. A whole-section, case-insensitive
 * `toMatch(/compatible\s+reapply/i)` would false-positive on that prose. Only
 * the state-name cell itself is the thing that must never be relabeled.
 */
function stateTableNames(sectionText) {
  const tableLines = sectionText.split('\n').filter((l) => l.trim().startsWith('|'));
  expect(tableLines.length, 'expected a markdown table in this section').toBeGreaterThan(2);
  const dataLines = tableLines.slice(2); // [0]=header, [1]=--- separator
  return dataLines.map((line) => (line.split('|')[1] ?? '').replace(/\*\*/g, '').trim());
}

/**
 * Concatenate the ```sql fenced blocks inside a section. Assertions about what
 * the owner actually RUNS must be made against executable SQL, not against the
 * whole section, because the section also contains prose that legitimately
 * discusses SQL it does not run.
 */
function fencedSql(sectionText) {
  const blocks = [...sectionText.matchAll(/```sql\n([\s\S]*?)```/g)].map((m) => m[1]);
  expect(blocks.length, 'expected at least one ```sql block in this section').toBeGreaterThan(0);
  return blocks.join('\n');
}

/**
 * Strip `--` line comments. This is what makes the signature assertion below
 * non-vacuous: an explanatory comment naming a REJECTED renderer must not be
 * able to satisfy (or trip) an assertion about the renderer actually executed.
 */
function stripSqlComments(sql) {
  return sql
    .split('\n')
    .map((line) => line.replace(/--.*$/, ''))
    .join('\n');
}

/** Split executable SQL into statements on `;`. */
function sqlStatements(sql) {
  return stripSqlComments(sql)
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean);
}

function fencedSqlBlocks(sectionText) {
  return [...sectionText.matchAll(/```sql\n([\s\S]*?)```/g)].map((m) => m[1]);
}

describe('pre-apply runbook - section extraction is sane', () => {
  it('extracts two distinct, non-empty sections', () => {
    expect(preflight.length).toBeGreaterThan(0);
    expect(postflight.length).toBeGreaterThan(0);
    expect(postflight).not.toBe(preflight);
    expect(preflight).toMatch(/^## 3\. /);
    expect(postflight).toMatch(/^## 5\. /);
  });
});

describe('pre-apply runbook - survives a clean first apply', () => {
  it('guards the publications lookup with to_regclass instead of a bare select (preflight)', () => {
    expect(preflight).toContain("to_regclass('matrix_map.site_aggregate_publications')");
  });

  it('also checks the candidate-audit table in the preflight, tolerant of it being absent', () => {
    expect(preflight).toContain("to_regclass('matrix_map.site_aggregate_candidate_audit')");
  });

  it('the FIRST preflight block is safe to run on a clean first apply', () => {
    // The only authorized state has none of the relations. A statement that
    // references one DIRECTLY raises 42P01 and aborts the very block that
    // exists to describe that state -- which is why 3.3 uses to_regclass.
    // A published/total COUNT once sat in this same block and reintroduced the
    // hazard, so assert the block as a whole, not just that to_regclass appears.
    const firstBlock = fencedSqlBlocks(preflight)[0];
    // Statement-level, and deliberately NOT a hand-built regex: a previous
    // version used a template literal whose escapes collapsed, so it matched
    // nothing and the guard was inert. Any statement that names a lifecycle
    // relation must do so ONLY through to_regclass(), which returns NULL
    // instead of raising 42P01 when the relation is absent.
    const RELATIONS = [
      'matrix_map.site_aggregate_publications',
      'matrix_map.site_aggregate_publication_audit',
      'matrix_map.site_aggregate_candidate_audit',
    ];
    // PER RELATION and CASE-INSENSITIVE. A single guarded to_regclass call must
    // not exempt a statement that ALSO references a relation directly, and SQL
    // identifiers are case-insensitive so an uppercase spelling must not slip
    // past. Strategy: strip every guarded `to_regclass('<relation>')` use, then
    // any surviving mention of that relation is a direct reference.
    // Identifiers are normalized first, because PostgreSQL accepts spellings
    // that are equivalent to the bare relation name but do not contain it as a
    // literal substring: double-quoted identifiers (`matrix_map."site_..."`),
    // per-part quoting, and whitespace around the qualifying dot. Each such
    // spelling still raises 42P01 on a clean apply, so the guard must see them.
    const normalize = (stmt) =>
      stmt
        .toLowerCase()
        .replace(/"([a-z0-9_]+)"/g, '$1') // drop quotes around simple identifiers
        .replace(/\s*\.\s*/g, '.'); // collapse whitespace around qualification
    const referencesDirectly = (stmt) => {
      const normalized = normalize(stmt);
      return RELATIONS.some((relation) => {
        const stripped = normalized.split(`to_regclass('${relation}')`).join('');
        if (stripped.includes(relation)) return true;
        // Also catch the UNQUALIFIED basename. `FROM site_aggregate_publications`
        // resolves through search_path and raises 42P01 on a clean first apply
        // just as the qualified form does, but contains no schema prefix. Word
        // boundaries keep it from matching a longer identifier that merely ends
        // with the same characters.
        const basename = relation.split('.').pop();
        return new RegExp(`(^|[^a-z0-9_.])${basename}([^a-z0-9_]|$)`).test(stripped);
      });
    };
    const offenders = sqlStatements(firstBlock).filter(referencesDirectly);
    expect(
      offenders,
      'the first preflight block must reference lifecycle relations only via to_regclass',
    ).toEqual([]);

    // Self-test: the detector must actually fire on the statement that caused
    // this defect, and stay silent on the guarded form.
    const guarded = "SELECT to_regclass('matrix_map.site_aggregate_publications') IS NOT NULL";
    const hazards = [
      // the exact statement that caused the defect
      'SELECT count(*) FROM matrix_map.site_aggregate_publications',
      // a guarded call that ALSO references the relation directly
      guarded + ', (SELECT count(*) FROM matrix_map.site_aggregate_publications)',
      // an UPPERCASE spelling, which SQL accepts and a case-sensitive check missed
      'SELECT count(*) FROM MATRIX_MAP.SITE_AGGREGATE_PUBLICATIONS',
      // double-quoted identifiers: equivalent SQL, no literal substring match
      'SELECT count(*) FROM matrix_map."site_aggregate_publications"',
      'SELECT count(*) FROM "matrix_map"."site_aggregate_publications"',
      // whitespace around the qualifying dot, which PostgreSQL also accepts
      'SELECT count(*) FROM matrix_map . site_aggregate_publications',
      // UNQUALIFIED, resolved via search_path -- same 42P01 on a clean apply
      'SELECT count(*) FROM site_aggregate_publications',
      'SELECT count(*) FROM "site_aggregate_publications"',
    ];
    for (const hazard of hazards) {
      expect([hazard].filter(referencesDirectly), hazard).toHaveLength(1);
    }
    expect([guarded].filter(referencesDirectly)).toHaveLength(0);
    // The basename rule must not fire on a DIFFERENT identifier that merely
    // contains the basename as a prefix or suffix.
    expect(
      [
        'SELECT count(*) FROM other_site_aggregate_publications_backup',
        'SELECT count(*) FROM site_aggregate_publications_archive',
      ].filter(referencesDirectly),
    ).toHaveLength(0);
  });

  it('keeps the conditional publication COUNT in its own skippable block', () => {
    const blocks = fencedSqlBlocks(preflight);
    expect(blocks.length, 'expected the count query to live in a separate block').toBeGreaterThan(1);
    const countBlock = blocks.find((b) => /count\(\*\)\s*FILTER\s*\(WHERE is_published\)/i.test(b));
    expect(countBlock, 'expected a published/total count block').toBeTruthy();
    // And it must be labelled skippable on the clean path.
    expect(preflight).toMatch(/Skip it entirely on a clean first[\s\S]{0,20}apply/i);
    expect(preflight).toMatch(/42P01/);
  });

  it('checks ALL THREE lifecycle tables in the preflight, not just two', () => {
    // The draft creates three tables. Checking only publications and
    // candidate_audit left a REACHABLE partial install - publication_audit
    // dropped, everything else intact - classifying as "Complete object
    // presence" and authorizing the apply, contradicting the STOP rule.
    for (const relation of [
      'matrix_map.site_aggregate_publications',
      'matrix_map.site_aggregate_publication_audit',
      'matrix_map.site_aggregate_candidate_audit',
    ]) {
      expect(preflight).toContain(`to_regclass('${relation}')`);
    }
  });

  it('authorizes ONLY a clean first apply, and STOPS on any existing install', () => {
    // The generic runbook used to send "complete object presence" on to section
    // 4. That was unsafe generic authority: object and signature presence prove
    // nothing about bodies, grants, policies, triggers, CHECK constraints or
    // column types on objects that already exist, and REAPPLY_01 proves only
    // that the PINNED BYTES are idempotent against a controlled fixture -- not
    // that an arbitrary live installation is compatible.
    const names = stateTableNames(preflight);
    expect(names).toEqual(['Clean first apply', 'Any existing install']);

    // ASSERT THE ACTIONABLE CELL, not just the row label. Flipping the
    // "Any existing install" action from STOP back to "Proceed to section 4"
    // would otherwise pass every other assertion here.
    const rows = preflight
      .split(String.fromCharCode(10))
      .filter((l) => l.trim().startsWith('|') && !l.includes('---'));
    const existingRow = rows.find((l) => l.includes('Any existing install'));
    expect(existingRow, 'expected an "Any existing install" table row').toBeTruthy();
    expect(existingRow).toMatch(/STOP/);
    expect(existingRow).not.toMatch(/Proceed to section 4/i);

    const cleanRow = rows.find((l) => l.includes('Clean first apply'));
    expect(cleanRow, 'expected a "Clean first apply" table row').toBeTruthy();
    expect(cleanRow).toMatch(/Proceed to section 4/i);

    // Exactly ONE row may authorize proceeding.
    expect(rows.filter((l) => /Proceed to section 4/i.test(l))).toHaveLength(1);

    // The old label must not silently come back either.
    expect(preflight).not.toMatch(/Complete object presence[^|]*\|[^|]*Proceed to section 4/);
    expect(preflight).toMatch(/Only ONE is authorized to proceed/i);
    expect(preflight).toMatch(/does not authorize/i);
    expect(preflight).toMatch(/case-specific reapply\/recovery adjudication/i);
  });

  it('states that REAPPLY_01 does not authorize an arbitrary live reapply', () => {
    // The tested capability is real; the GENERIC authorization is what was
    // withdrawn. Saying so explicitly is what stops a future reader from
    // reinstating "the reapply is tested, so proceeding is fine".
    expect(preflight).toMatch(/REAPPLY_01 does not close this gap/i);
    expect(preflight).toMatch(/controlled fixture/i);
  });

  it('does NOT restore preflight 3.3c while withdrawing the reapply authority', () => {
    // The apply-time invariant must remain the single implementation.
    expect(duplicatedInvariantStatements(preflight)).toEqual([]);
    expect(preflight).toMatch(/Do not restore preflight 3\.3c/i);
  });

  it('does NOT name the second state "compatible reapply" - checked against the STATE NAME cell only, not the whole section', () => {
    // The preflight proves the expected relations and signatures exist and that
    // the candidate-audit invariants hold. It does NOT prove every grant,
    // trigger, policy and function BODY matches this draft - that is settled at
    // apply time by the SQL's own fail-closed block. Naming the state
    // "compatible reapply" would promise more than the query proves.
    //
    // A case-sensitive `not.toContain('Compatible reapply')` over the whole
    // section would pass if the row were relabeled to lowercase `compatible
    // reapply` - and a naive case-INSENSITIVE whole-section check would in turn
    // false-positive on the legitimate caveat prose a few lines below the table
    // (`NOT called "compatible reapply"`). Parsing the table and checking only
    // the state-name cell avoids both failure modes.
    const names = stateTableNames(preflight);
    expect(names).toEqual(['Clean first apply', 'Any existing install']);
    for (const name of names) {
      expect(name).not.toMatch(/compatible\s+reapply/i);
    }
    // The caveat must NOT promise that the apply establishes compatibility. The
    // apply-time block validates the candidate-audit publication_id invariant
    // and nothing else; CREATE TABLE IF NOT EXISTS never inspects an existing
    // table, so drift in any other object survives both paths and the migration
    // still commits. The wording is pinned so that overstatement cannot return.
    expect(preflight).toMatch(
      /neither this preflight nor the apply[\s>]+establishes full compatibility/i,
    );
    expect(preflight).not.toMatch(/Full compatibility is established at APPLY time/i);
  });

  it('self-test: the state-name parser catches a lowercase-relabeled row and does not false-positive on legitimate caveat prose', () => {
    // Proves the detector actually closes the gap described above, rather than
    // merely asserting it does in a comment.
    const relabeledFixture = [
      '## 3. Fixture',
      '',
      '| State | Col |',
      '|---|---|',
      '| **Clean first apply** | x |',
      '| **compatible reapply** | y |',
    ].join('\n');
    const relabeledNames = stateTableNames(relabeledFixture);
    expect(relabeledNames).toContain('compatible reapply');
    expect(relabeledNames.some((n) => /compatible\s+reapply/i.test(n))).toBe(true);

    const caveatOnlyFixture = [
      '## 3. Fixture',
      '',
      '| State | Col |',
      '|---|---|',
      '| **Clean first apply** | x |',
      '| **Any existing install** | y |',
      '',
      'Why the second row is NOT called "compatible reapply". Presence is not compatibility.',
    ].join('\n');
    const caveatOnlyNames = stateTableNames(caveatOnlyFixture);
    expect(caveatOnlyNames.some((n) => /compatible\s+reapply/i.test(n))).toBe(false);
  });

  it('classifies by exact function signature, never by a name count', () => {
    // A bare count(*) is satisfiable by one missing function plus one duplicate
    // overload, and CREATE OR REPLACE never removes a stale overload.
    expect(preflight).toContain('unexpected_overloads');
    expect(preflight).toMatch(/never by a name count/i);

    // The renderer assertion is made against COMMENT-STRIPPED executable SQL.
    // pg_get_function_identity_arguments() includes PARAMETER NAMES for
    // functions declared with them, so it renders
    // '...(p_schema text, p_table text)' and can never match the expected
    // '(text, text)' - it would BLOCK every conforming reapply. It is named in
    // an explanatory comment in the runbook precisely so nobody reintroduces
    // it. A whole-section assertion could therefore be satisfied by that
    // comment while the executed query used the broken renderer, which is
    // exactly the vacuity this replaces.
    // Bound to the STATEMENT that actually classifies, not to the file. A
    // file-wide assertion is satisfied by `oidvectortypes(...)` appearing in any
    // unrelated or dead statement, so the executable 3.4 classifier could
    // regress to the broken renderer while this test stayed green.
    const classifier = sqlStatements(fencedSql(preflight)).filter(
      (stmt) => stmt.includes('actual(sig)') && stmt.includes('expected(sig)'),
    );
    expect(classifier, 'expected exactly one signature-classifier statement').toHaveLength(1);
    expect(classifier[0]).toContain('oidvectortypes(p.proargtypes)');
    expect(classifier[0]).not.toContain('pg_get_function_identity_arguments');

    // And nowhere in executable preflight SQL may the broken renderer appear.
    const executable = stripSqlComments(fencedSql(preflight));
    expect(executable).not.toContain('pg_get_function_identity_arguments');
  });

  it('self-test: the comment stripper prevents a commented-out renderer from satisfying the assertion', () => {
    // Proves the mechanism above, rather than asserting it in a comment.
    const commentOnly = "-- we do NOT use pg_get_function_identity_arguments here\nSELECT oidvectortypes(p.proargtypes);";
    expect(stripSqlComments(commentOnly)).not.toContain('pg_get_function_identity_arguments');
    expect(stripSqlComments(commentOnly)).toContain('oidvectortypes(p.proargtypes)');

    const executableBroken = 'SELECT pg_get_function_identity_arguments(p.oid);';
    expect(stripSqlComments(executableBroken)).toContain('pg_get_function_identity_arguments');
  });

  it('tells the owner to STOP on anything but a clean first apply, within the preflight', () => {
    const partialLine = preflight
      .split('\n')
      .find((l) => l.includes('Anything other than a clean first apply'));
    expect(partialLine).toBeDefined();
    expect(partialLine.toUpperCase()).toContain('STOP');
  });

  it('states plainly that any state other than the two safe rows is malformed, not an enumeration', () => {
    expect(preflight).toMatch(/not an enumerable checklist/i);
  });
});

describe('pre-apply runbook - the mandatory replay gate requires all three controls', () => {
  // The harness runs ONE control per invocation and exits, and both full-script
  // controls are opt-in switches. A gate that shows only the bare command lets
  // an owner produce a GREEN 29-test receipt while proving nothing about
  // reapply behaviour or rollback -- precisely the gap that allowed a
  // non-reapply-safe migration to reach review in the first place.
  const gate = section(2);

  it('shows THREE SEPARATE invocations, one per control, with distinct output dirs', () => {
    // Asserting only that both switch names appear SOMEWHERE would pass for a
    // single combined invocation -- which cannot work: the harness runs one
    // control per invocation and exits, so a combined command would run
    // NegativeLegacyReplay and never reach PositiveReapplyControl. Parse the
    // actual invocations instead.
    const fenced = [...gate.matchAll(/```\n([\s\S]*?)```/g)].map((m) => m[1]).join('\n');
    const invocations = fenced
      .split(/(?=pwsh -File)/)
      .filter((chunk) => chunk.includes('replay-migrations-postgis.ps1'));

    expect(invocations, 'expected exactly three replay invocations').toHaveLength(3);

    const withNegative = invocations.filter((i) => i.includes('-NegativeLegacyReplay'));
    const withPositive = invocations.filter((i) => i.includes('-PositiveReapplyControl'));
    const withNeither = invocations.filter(
      (i) => !i.includes('-NegativeLegacyReplay') && !i.includes('-PositiveReapplyControl'),
    );
    expect(withNegative, 'exactly one invocation runs NEG_01').toHaveLength(1);
    expect(withPositive, 'exactly one invocation runs REAPPLY_01').toHaveLength(1);
    expect(withNeither, 'exactly one invocation runs the base suite').toHaveLength(1);

    // Reusing an output directory would overwrite the previous control's
    // receipts, so the three must be distinct.
    const outputDirs = invocations.map((i) => {
      const m = /-OutputDir\s+(\S.*?)\s*(?:`|\n)/.exec(i);
      return m ? m[1].trim() : null;
    });
    expect(outputDirs.every(Boolean), 'every invocation must name an -OutputDir').toBe(true);
    expect(new Set(outputDirs).size, 'the three output directories must differ').toBe(3);
  });

  it('requires both full-script control receipts, not just the test receipt', () => {
    expect(gate).toContain('neg01_receipt.json');
    expect(gate).toContain('reapply01_receipt.json');
    expect(gate).toContain('second_apply_reached_commit');
    expect(gate).toContain('fingerprints_match');
  });

  it('binds EACH control receipt to the pinned SQL digest, per receipt', () => {
    // Asserting the token occurs once anywhere in section 2 passed even if the
    // binding were dropped from one receipt, or left only in prose.
    const rows = gate
      .split(String.fromCharCode(10))
      .filter((l) => l.trim().startsWith('|'));
    for (const receipt of ['neg01_receipt.json', 'reapply01_receipt.json']) {
      const row = rows.find((l) => l.includes(receipt));
      expect(row, `expected an acceptance row for ${receipt}`).toBeTruthy();
    }
    // And the digest requirement must name BOTH receipts explicitly.
    expect(gate).toMatch(/In BOTH receipts/i);
    expect(gate).toContain('draft_sql_sha256');
    expect(gate).toMatch(/MUST equal the SHA-256 pinned in section 1/i);
  });
});

describe('pre-apply runbook - the replay acceptance baseline is TRUE', () => {
  // THREE ARTIFACTS MUST AGREE ON ONE NUMBER: the SQL suite (how many TEST_*
  // ids it actually emits), the harness (how many it REQUIRES), and the runbook
  // (what the owner is told to accept).
  //
  // They did not. The harness required through TEST_64 while the suite had
  // grown to TEST_69, and the runbook carried its own "at least 64" threshold
  // that agreed with the stale harness. A replay that never emitted TEST_65-69
  // -- the exact-ID contract checks -- would have satisfied all three and
  // reported strict_pass = true with the newest safety checks absent.
  //
  // The separate "at least N" row is GONE. The harness is the single authority
  // and emits `required_test_count` / `required_test_ids` into the receipt;
  // this test binds the suite and the runbook to it.
  const HARNESS = path.join(
    REPO_ROOT,
    'scripts/matrix-map/validation/option-c-phase2/replay-migrations-postgis.ps1',
  );
  const SUITE = path.join(
    REPO_ROOT,
    'scripts/matrix-map/validation/option-c-phase2/test-option-c.sql',
  );

  /** The upper bound of the harness's single required-id authority. */
  function harnessRequiredMax(harness) {
    const range = /\$requiredTestIds\s*=\s*@\(\s*1\.\.(\d+)\s*\|/.exec(harness);
    expect(range, 'expected $requiredTestIds = @(1..N | ...) in the replay harness').toBeTruthy();
    return Number(range[1]);
  }

  it('requires every TEST_* id the SQL suite actually emits', () => {
    const suite = readFileSync(SUITE, 'utf8');
    const emitted = [...suite.matchAll(/'(TEST_\d+)'/g)].map((m) => Number(m[1].slice(5)));
    expect(emitted.length).toBeGreaterThan(0);
    const suiteMax = Math.max(...emitted);

    // The decisive assertion: adding a test without extending the harness
    // baseline fails HERE rather than silently weakening the gate.
    expect(harnessRequiredMax(readFileSync(HARNESS, 'utf8')), 'harness baseline is older than the suite').toBe(
      suiteMax,
    );
  });

  it('the runbook accepts on the receipt fields, not a separate threshold', () => {
    const harnessMax = harnessRequiredMax(readFileSync(HARNESS, 'utf8'));

    // The retired alternative authority must not come back.
    expect(
      /`passed_tests`\s*\|\s*at least \d+/.test(runbook),
      'the runbook must not carry a separate "at least N" threshold',
    ).toBe(false);

    expect(runbook).toContain('`strict_pass` | `true`');
    expect(runbook).toContain('`missing_test_ids` | empty');
    // The documented count and upper id must match the harness authority.
    expect(runbook).toContain(`\`required_test_count\` | \`${harnessMax}\``);
    expect(runbook).toContain(`runs through \`TEST_${harnessMax}\``);
  });

  it('the harness emits the fields the runbook is told to read', () => {
    const harness = readFileSync(HARNESS, 'utf8');
    for (const field of [
      'required_test_ids =',
      'required_test_count =',
      'missing_test_ids =',
      'strict_pass =',
    ]) {
      expect(harness, `receipt must carry ${field}`).toContain(field);
    }
  });
});

/**
 * THE ANTI-DUPLICATION GUARD.
 *
 * Four consecutive review rounds each found a NEW way the runbook's preflight
 * copy of the candidate-audit publication_id invariant disagreed with the
 * apply-time helper that owns it - first the apply was laxer than the
 * preflight, then the preflight was stricter than the apply, which made the
 * intended legacy-upgrade path unreachable through this procedure. Two
 * hand-maintained implementations of one rule kept generating defects, so the
 * preflight copy was DELETED and the apply-time fail-closed block (inside the
 * migration's single BEGIN/COMMIT transaction) is now the sole authority.
 *
 * A contract test that merely asserts prose exists cannot prevent that
 * regression, because it asserts TEXT rather than agreement. This one instead
 * asserts the absence of a CATEGORY: no executable preflight statement may
 * combine the candidate-audit relation with a constraint or nullability
 * catalog. That is checkable, and it is what actually went wrong.
 *
 * Deliberately NARROW. It bars only the candidate-audit FK/NOT NULL predicate.
 * A future preflight check that queries pg_constraint about a DIFFERENT table,
 * or that reads the candidate-audit table for some unrelated purpose, remains
 * legal - the guard requires BOTH signals in the SAME statement.
 */
// Lower-cased before matching, and broadened beyond pg_catalog: SQL is
// case-insensitive, so a reintroduced predicate written as `PG_CONSTRAINT` would
// have slipped past a case-sensitive check, and the same invariant can be
// expressed through pg_attribute or information_schema without naming any of the
// original tokens.
const CATALOG_TOKENS = [
  'pg_constraint',
  'pg_attribute',
  'information_schema',
  'attnotnull',
  'confdeltype',
  'conkey',
  'confkey',
  'convalidated',
  'is_nullable',
  'constraint_column_usage',
  'referential_constraints',
  'key_column_usage',
  'table_constraints',
];
const CANDIDATE_AUDIT_RELATION = 'site_aggregate_candidate_audit';

function duplicatedInvariantStatements(sectionText) {
  return sqlStatements(fencedSql(sectionText)).filter((stmt) => {
    const lower = stmt.toLowerCase();
    return (
      lower.includes(CANDIDATE_AUDIT_RELATION) &&
      CATALOG_TOKENS.some((token) => lower.includes(token))
    );
  });
}

describe('pre-apply runbook - the invariant has exactly one implementation', () => {
  it('has no preflight statement combining the candidate-audit relation with a constraint/nullability catalog', () => {
    expect(duplicatedInvariantStatements(preflight)).toEqual([]);
  });

  it('still permits the tolerant to_regclass presence check on the same relation', () => {
    // Guards against the detector being overbroad: 3.3b legitimately names the
    // candidate-audit relation, and must not be collateral damage.
    expect(preflight).toContain("to_regclass('matrix_map.site_aggregate_candidate_audit')");
  });

  it('self-test: the detector fires on a reintroduced 3.3c and stays silent on unrelated pg_constraint use', () => {
    const reintroduced = [
      '## 3. Fixture',
      '',
      '```sql',
      'SELECT EXISTS (',
      '  SELECT 1 FROM pg_constraint con',
      '  JOIN pg_class c ON c.oid = con.conrelid',
      "  WHERE c.relname = 'site_aggregate_candidate_audit'",
      "    AND con.confdeltype = 'r'",
      ') AS conforming_fk_present;',
      '```',
    ].join('\n');
    expect(duplicatedInvariantStatements(reintroduced)).toHaveLength(1);

    const unrelatedCatalogUse = [
      '## 3. Fixture',
      '',
      '```sql',
      "SELECT count(*) FROM pg_constraint con JOIN pg_class c ON c.oid = con.conrelid WHERE c.relname = 'some_other_table';",
      "SELECT to_regclass('matrix_map.site_aggregate_candidate_audit') IS NOT NULL AS candidate_audit_table_exists;",
      '```',
    ].join('\n');
    expect(duplicatedInvariantStatements(unrelatedCatalogUse)).toEqual([]);

    const commentedOutOnly = [
      '## 3. Fixture',
      '',
      '```sql',
      "-- site_aggregate_candidate_audit pg_constraint confdeltype are named here only in prose",
      "SELECT to_regclass('matrix_map.site_aggregate_candidate_audit') IS NOT NULL AS x;",
      '```',
    ].join('\n');
    expect(duplicatedInvariantStatements(commentedOutOnly)).toEqual([]);
  });

  it('keeps the post-failure FK diagnostic in section 4, never in the preflight', () => {
    // The diagnostic enumerates every FK on publication_id so an operator does
    // not drop the CONFORMING constraint the helper's message happens to name
    // (it samples the alphabetically first). It is read-only and runs only
    // AFTER the apply has already failed and rolled back, so it gates nothing.
    // It must stay OUT of section 3: a preflight copy would recreate exactly
    // the duplicated-authority defect this runbook was rewritten to remove,
    // which the guard above already forbids.
    const apply = section(4);
    expect(apply).toContain("c.relname = 'site_aggregate_candidate_audit'");
    expect(duplicatedInvariantStatements(preflight)).toEqual([]);

    // The diagnostic must surface the SAME four conditions the apply-time helper
    // enforces, or it will call a constraint conforming that the helper rejects
    // and send the operator hunting elsewhere. The referenced target is checked
    // by explicit schema/table/COLUMN booleans rather than a rendered relation
    // name: confrelid::regclass omits the schema when the relation is on
    // search_path, and an FK pointing at some OTHER unique column of the right
    // table would otherwise display as fully conforming.
    for (const condition of [
      "con.confdeltype = 'r'",
      "fn.nspname = 'matrix_map'",
      "fc.relname = 'site_aggregate_publications'",
      "fa.attname = 'id'",
      'array_length(con.conkey, 1) = 1',
      'array_length(con.confkey, 1) = 1',
      'con.convalidated',
    ]) {
      expect(apply, `section 4 diagnostic must expose ${condition}`).toContain(condition);
    }
    expect(apply).toContain('targets_publications_id');
  });

  it('states in the runbook that the apply-time block is the sole authority', () => {
    expect(preflight).toMatch(/Invariant ownership/i);
    expect(preflight).toMatch(/sole authority/i);
    // The legacy-upgrade path must be documented as EXPECTED to pass preflight,
    // which is the exact behaviour round 4 found unreachable.
    // The preflight no longer evaluates the candidate-audit invariant, and it
    // must say so WITHOUT that reading as permission to apply: an existing
    // install stops regardless. Assert both halves, so neither can drift back.
    expect(preflight).toMatch(/does not evaluate that invariant/i);
    // Wrap-tolerant: the phrase breaks across a line in the rendered runbook.
    expect(preflight).toMatch(/NOT permission to\s+apply/i);
    expect(preflight).not.toMatch(/is not a reason to stop/i);
  });
});

describe('pre-apply runbook - postflight assertions are section-scoped', () => {
  it('requires BOTH tables in the postflight - checked within section 5 itself, not merely somewhere in the doc', () => {
    // This is the fix for the global-toContain weakness: these two strings
    // also occur in the (tolerant) preflight, so a global assertion would
    // pass even if the postflight's own copy of this check were deleted.
    // Asserting against `postflight` (not `runbook`) closes that gap.
    expect(postflight).toContain("to_regclass('matrix_map.site_aggregate_publications')");
    expect(postflight).toContain("to_regclass('matrix_map.site_aggregate_publication_audit')");
    expect(postflight).toContain("to_regclass('matrix_map.site_aggregate_candidate_audit')");
  });

  it('makes 5.1 an EXECUTABLE function-presence check, not prose', () => {
    // Section 5 declares every check REQUIRED, so a prose-only 5.1 was a
    // requirement the owner could not actually perform.
    const executablePostflight = stripSqlComments(fencedSql(postflight));
    expect(executablePostflight).toContain('oidvectortypes(p.proargtypes)');
    expect(executablePostflight).toContain('unexpected_overloads');
  });

  it('states the postflight is an ASSERTION step, within the postflight section itself', () => {
    expect(postflight).toMatch(/Postflight is an ASSERTION step/i);
  });

  it('does NOT rely on the preflight to carry the "ASSERTION step" language', () => {
    // Guards the scoping itself: if this phrase leaked into being preflight-only
    // (e.g. moved out of section 5), the section-scoped assertion above would
    // fail even though a global one would still pass.
    expect(preflight).not.toMatch(/Postflight is an ASSERTION step/i);
  });
});

describe('pre-apply runbook - the pinned SQL identity is TRUE', () => {
  const actualBytes = statSync(SQL).size;
  const actualHash = createHash('sha256')
    .update(readFileSync(SQL))
    .digest('hex')
    .toUpperCase();

  it('records the CURRENT SQL SHA-256, not a stale one', () => {
    // This is the assertion that makes "never preserve the old hash" enforceable.
    // If the SQL is edited and the runbook is not updated, this fails.
    expect(runbook).toContain(actualHash);
  });

  it('records the CURRENT SQL byte count', () => {
    expect(runbook).toContain(String(actualBytes));
  });

  it('pins exactly one SHA-256 so there is no ambiguity about which is current', () => {
    const digests = new Set(runbook.match(/\b[A-F0-9]{64}\b/g) ?? []);
    expect(digests.size).toBe(1);
    expect([...digests][0]).toBe(actualHash);
  });

  it('states plainly that the whole procedure is owner-run', () => {
    expect(runbook).toMatch(/OWNER-RUN/);
    expect(runbook).toMatch(/Never Claude-run|never Claude-run/);
  });
});
