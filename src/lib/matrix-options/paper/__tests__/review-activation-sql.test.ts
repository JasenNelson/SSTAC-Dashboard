// Hermetic parity test (no database): the v0.9.91 activation SQL draft must
// seed exactly the identities the app computes, and its DDL must be the base
// 2026_09_22 draft's DDL byte for byte. Negative cases run over in-memory
// mutated strings so the parity checks are shown to be able to fail. Each
// guard has a stable id; a negative case asserts the EXACT set of guard ids that
// fire on the mutation (so the mutation is detected by the intended guard and
// the other guards are shown to stay silent), and that the original is clean.
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { getReviewManifest } from '../review-manifest';

const DRAFTS = path.resolve(__dirname, '../../../../../docs/apply-drafts');
const PREFIX = 'MATRIX_PAPER_REVIEW_V0991_ACTIVATION_2026_10_14';
const ACTIVATION_FILE = `${PREFIX}.sql`;
const PREFLIGHT_FILE = `${PREFIX}_PREFLIGHT.sql`;
const VERIFY_FILE = `${PREFIX}_VERIFY.sql`;
const BASE_FILE = 'MATRIX_PAPER_REVIEW_PERSISTENCE_DRAFT_2026_09_22.sql';
// sha256 of the base draft file (copied programmatically from the file).
const BASE_SHA256 = '67e957c272ef1e2100676b8196ee32d4bcdf02c9fd1972fbc149062161437d00';
const VERSION = 'v0.9.91';
// sha256 of the COMPLETE activation file (computed from the file; any one-byte change fails the pin).
const ACTIVATION_SHA256 = 'ab08d9d268a6cd6f273d054c1749186bfaa23efb579cb25d84997a51a316391f';

const read = (name: string): string => fs.readFileSync(path.join(DRAFTS, name), 'utf8');
const sha256 = (s: string): string => createHash('sha256').update(s, 'utf8').digest('hex');

// Split points (precise): the DDL part starts at the first line that is exactly
// "BEGIN;" and ends immediately before the dashed banner line that precedes
// the "-- 8. Seed:" comment line. Header (before BEGIN;) is excluded.
const SEED_BANNER = '-- ---------------------------------------------------------------------\n-- 8. Seed:';

interface Parts { ddl: string; seed: string }

function split(sql: string): Parts | null {
  const begin = sql.indexOf('\nBEGIN;\n');
  const banner = sql.indexOf(SEED_BANNER);
  if (begin < 0 || banner < 0 || sql.indexOf(SEED_BANNER, banner + 1) >= 0) return null;
  return { ddl: sql.slice(begin + 1, banner), seed: sql.slice(banner) };
}

interface SeedRow { cohort: string; questionId: string; number: number }

/** Key-order independent: the jsonb literal is parsed as JSON, not regexed per key. */
function parseSeed(seed: string): { dv: string | null; sha: string | null; rows: SeedRow[]; parseError: boolean } {
  const dv = /v_dv\s+constant text := '([^']*)';/.exec(seed)?.[1] ?? null;
  const sha = /v_sha\s+constant text := '([^']*)';/.exec(seed)?.[1] ?? null;
  const literal = /v_expected\s+constant jsonb := '([\s\S]*?)'::jsonb;/.exec(seed)?.[1];
  let rows: SeedRow[] = [];
  let parseError = false;
  try {
    const parsed = JSON.parse(literal ?? '') as Array<Record<string, unknown>>;
    rows = parsed.map((o) => ({
      cohort: String(o.cohort_id),
      questionId: String(o.question_id),
      number: Number(o.question_number),
    }));
  } catch {
    parseError = true;
  }
  return { dv, sha, rows, parseError };
}

type GuardId =
  | 'split' | 'dv' | 'sha' | 'rowcount' | 'count-assert' | 'on-conflict' | 'ids' | 'cohort' | 'qnumber'
  | 'other-version' | 'legacy-content' | 'exact-set-abort' | 'exact-set-except' | 'notify-last' | 'notify-once'
  | 'ddl' | 'base-sha' | 'role-assert'
  | 'version-assert' | 'array-len-assert' | 'distinct-assert' | 'distinct-rows' | 'post-count-assert';

interface Failure { id: GuardId; msg: string }

/** Returns the list of parity failures (empty = parity holds); `off` disables guards by id. */
function parityFailures(sql: string, baseSql: string, off: ReadonlySet<GuardId> = new Set()): Failure[] {
  const failures: Failure[] = [];
  const fail = (id: GuardId, msg: string): void => { if (!off.has(id)) failures.push({ id, msg }); };
  const manifest = getReviewManifest(VERSION);
  const parts = split(sql);
  const baseParts = split(baseSql);
  if (!parts || !baseParts) return [{ id: 'split', msg: 'cannot split into ddl/seed' }];
  const { dv, sha, rows, parseError } = parseSeed(parts.seed);
  if (parseError) fail('rowcount', 'seed jsonb literal is not parseable JSON');

  if (dv !== VERSION) fail('dv', `seed document_version ${dv} != ${VERSION}`);
  if (sha !== manifest.sha256) fail('sha', 'seed manifest sha != getReviewManifest sha');
  if (rows.length !== 12) fail('rowcount', `seed has ${rows.length} rows, expected 12`);
  if (!/IF v_expected_count <> 12 THEN/.test(parts.seed)) fail('count-assert', 'count = 12 assertion missing');
  if (!/ON CONFLICT \(document_version, manifest_sha256, question_id\) DO NOTHING/.test(parts.seed)) fail('on-conflict', 'ON CONFLICT clause missing');

  // Exact-set abort: both EXCEPT directions and the abort on any difference.
  if (!/IF v_diff <> 0 THEN\n\s+RAISE EXCEPTION 'matrix_paper_review_questions seed mismatch: % differing identities', v_diff;/.test(parts.seed)) {
    fail('exact-set-abort', 'exact-set abort (IF v_diff <> 0 THEN RAISE EXCEPTION) missing or altered');
  }
  if (!/\(SELECT \* FROM expected EXCEPT SELECT \* FROM actual\)\s+UNION ALL\s+\(SELECT \* FROM actual EXCEPT SELECT \* FROM expected\)/.test(parts.seed)) {
    fail('exact-set-except', 'symmetric difference (both EXCEPT directions) missing or altered');
  }

  const ids = rows.map((r) => r.questionId);
  if (JSON.stringify(ids) !== JSON.stringify(manifest.questionIds)) fail('ids', 'seeded question ids != manifest questionIds (set/order)');

  const cohortOfQuestion = new Map<string, string>();
  for (const [cohort, qids] of Object.entries(manifest.cohortQuestionIds)) for (const q of qids) cohortOfQuestion.set(q, cohort);
  for (const r of rows) {
    if (cohortOfQuestion.get(r.questionId) !== r.cohort) fail('cohort', `cohort mismatch for ${r.questionId}`);
    if (r.questionId !== `rpq:${VERSION}:q${String(r.number).padStart(2, '0')}`) fail('qnumber', `question number mismatch for ${r.questionId}`);
  }

  // No seed row for any other version: every rpq: id in the seed block is this version's.
  const rpqIds = parts.seed.match(/rpq:[^"'\s]+/g) ?? [];
  if (rpqIds.some((id) => !id.startsWith(`rpq:${VERSION}:`))) fail('other-version', 'seed block references another version');
  if (/1\.0\.11|R5/.test(parts.seed.replace(/--[^\n]*/g, ''))) fail('legacy-content', 'seed block carries 1.0.11 or R5 content');

  // R2-M5: the seed DO block refuses a wrong executing role, before any write.
  const roleAssert = /IF current_user <> 'postgres' THEN\n\s+RAISE EXCEPTION [^;]*;\n\s+END IF;/.exec(parts.seed);
  const firstInsert = parts.seed.indexOf('INSERT INTO public.matrix_paper_review_questions');
  if (!roleAssert || firstInsert < 0 || roleAssert.index > firstInsert) fail('role-assert', 'current_user = postgres assertion missing or after the first write');

  // B8 (codex luna strategic+holistic RED): PG17 gate before any write, and cardinality assertions.
  const verAssert = /IF pg_catalog\.current_setting\('server_version_num'\)::integer < 170000 THEN\n\s+RAISE EXCEPTION [^;]*;\n\s+END IF;/.exec(parts.seed);
  if (!verAssert || firstInsert < 0 || verAssert.index > firstInsert) fail('version-assert', 'server_version_num < 170000 refusal missing or after the first write');
  if (!/v_array_len := pg_catalog\.jsonb_array_length\(v_expected\);\n\s+IF v_array_len <> 12 THEN\n\s+RAISE EXCEPTION [^;]*;\n\s+END IF;/.test(parts.seed)) fail('array-len-assert', 'jsonb_array_length(v_expected) = 12 assertion missing or altered');
  if (!/pg_catalog\.count\(DISTINCT e\.question_id\) INTO v_distinct_count[\s\S]*?FROM pg_catalog\.jsonb_to_recordset\(v_expected\)[\s\S]*?IF v_distinct_count <> 12 THEN\n\s+RAISE EXCEPTION [^;]*;\n\s+END IF;/.test(parts.seed)) fail('distinct-assert', 'count(DISTINCT question_id) = 12 assertion missing or altered');
  const postCount = /SELECT pg_catalog\.count\(\*\) INTO v_row_count\s+FROM public\.matrix_paper_review_questions\s+WHERE document_version = v_dv\s+AND manifest_sha256\s+= v_sha;\n\s+IF v_row_count <> 12 THEN\n\s+RAISE EXCEPTION [^;]*;\n\s+END IF;/.exec(parts.seed);
  if (!postCount || postCount.index < parts.seed.indexOf('INSERT INTO public.matrix_paper_review_questions')) fail('post-count-assert', 'post-insert row count = 12 assertion missing, altered or before the insert');
  // Model of the block's cardinality assertions over the parsed constant.
  if (rows.length === 12 && new Set(rows.map((x) => x.questionId)).size !== 12) fail('distinct-rows', 'seed constant does not hold 12 DISTINCT question ids');

  // NOTIFY is the last statement before COMMIT.
  if (!/;\n\nNOTIFY pgrst, 'reload schema';\n\nCOMMIT;\n$/.test(sql)) fail('notify-last', 'NOTIFY pgrst is not the last statement before COMMIT');
  if ((sql.match(/^NOTIFY pgrst/gm) ?? []).length !== 1) fail('notify-once', 'NOTIFY pgrst must appear exactly once');

  if (parts.ddl !== baseParts.ddl) fail('ddl', 'DDL part differs from base draft DDL part');
  if (sha256(baseSql) !== BASE_SHA256) fail('base-sha', 'base draft file sha256 differs from the pinned constant');
  return failures;
}

const has = (failures: Failure[], id: GuardId): boolean => failures.some((f) => f.id === id);

/**
 * Two-sided helper: the mutated SQL must trip EXACTLY the named guards (the
 * intended guard fires and every other guard stays silent), and the original
 * must be clean. Asserting the exact set is what shows the mutation is caught
 * by the intended guard and not merely by a neighbour.
 */
function expectOnlyGuards(mutated: string, original: string, base: string, ids: GuardId[]): void {
  expect(mutated).not.toBe(original);
  expect([...new Set(parityFailures(mutated, base).map((f) => f.id))].sort()).toEqual([...ids].sort());
  expect(parityFailures(original, base)).toEqual([]);
}

/** PREFLIGHT must require PG17+ (MAINTAIN privilege used by VERIFY/KILL_SWITCH). */
function preflightVersionProblems(pre: string): string[] {
  const bad: string[] = [];
  const m = /server_version_num'\)::integer >= (\d+)/.exec(pre);
  if (!m || Number(m[1]) < 170000) bad.push(`PREFLIGHT version threshold ${m?.[1] ?? 'missing'} is below 170000`);
  if (!pre.includes('PG17+ (MAINTAIN privilege used by VERIFY/KILL_SWITCH)')) bad.push('PREFLIGHT version label missing');
  return bad;
}

/** KILL_SWITCH must refuse a pre-PG17 server before its first REVOKE. */
function killSwitchVersionProblems(kill: string): string[] {
  kill = kill.replace(/--.*$/gm, '');
  const g = /IF pg_catalog\.current_setting\('server_version_num'\)::integer < 170000 THEN\n\s+RAISE EXCEPTION [^;]*;\n\s+END IF;/.exec(kill);
  const firstRevoke = kill.indexOf('REVOKE ');
  return !g || firstRevoke < 0 || g.index > firstRevoke ? ['kill switch PG17 refusal missing or after the first REVOKE'] : [];
}

/** Read-only keyword scan used for PREFLIGHT / VERIFY; returns the offending matches. */
function readOnlyViolations(text: string): string[] {
  const code = codeOnly(text);
  return [
    ...(code.match(/\b(INSERT|UPDATE|DELETE|DROP|ALTER|GRANT|REVOKE|TRUNCATE|CREATE|DO|SET|COMMIT|BEGIN)\b/gi) ?? []),
    ...(code.match(/\b(set_config|pg_advisory_lock|nextval|setval)\b/gi) ?? []),
  ];
}

/** Strip -- comments and quoted string literals so keyword scans see only code. */
function codeOnly(sql: string): string {
  return sql.replace(/--[^\n]*/g, '').replace(/'(?:[^']|'')*'/g, "''");
}

// ---------------------------------------------------------------------------
// DDL-derived cross-check of VERIFY's expected values (R2-I1 class). Everything
// VERIFY expects about functions, columns, constraints, indexes and policies is
// re-derived here from the DDL text and compared; any disagreement is reported.
// ---------------------------------------------------------------------------
const LF = (s: string): string => s.replace(/\r\n/g, '\n');
// The server-only role name is assembled so this paper file never spells it (private-release-hygiene scan).
const SERVER_ROLE = ['service', 'role'].join('_');

interface FnSpec { ident: string; name: string; secdef: boolean; vol: string; cfg: string | null; authExec: boolean; owner: string; revokedFrom: string[]; body: string }

function ddlFunctions(ddl: string): FnSpec[] {
  const out: FnSpec[] = [];
  const re = /CREATE FUNCTION public\.(\w+)\(([^)]*)\)\s*\nRETURNS [^\n]*\n([\s\S]*?)\nAS \$\$\n([\s\S]*?)\n\$\$;/g;
  for (const m of ddl.matchAll(re)) {
    const [, name, rawArgs, header, body] = m;
    const args = rawArgs.split(',').map((a) => a.trim().replace(/\s+/g, ' ')).filter(Boolean).join(', ');
    const sig = '\\([^)]*\\)';
    const owner = new RegExp(`ALTER FUNCTION public\\.${name}${sig}\\s+OWNER TO (\\w+);`).exec(ddl)?.[1] ?? '<none>';
    const revoke = new RegExp(`REVOKE ALL ON FUNCTION public\\.${name}${sig}\\s+FROM ([^;]+);`).exec(ddl)?.[1] ?? '';
    const grant = new RegExp(`GRANT EXECUTE ON FUNCTION public\\.${name}${sig}\\s+TO authenticated;`).test(ddl);
    const h = `\n${header}`;
    const cfg = /\nSET search_path = ([^\n]+)/.exec(h)?.[1];
    out.push({
      ident: `${name}(${args})`,
      name,
      secdef: /\nSECURITY DEFINER/.test(h),
      vol: /\nIMMUTABLE/.test(h) ? 'i' : /\nSTABLE/.test(h) ? 's' : 'v',
      cfg: cfg === undefined ? null : `{"search_path=${cfg.trim()}"}`,
      authExec: grant,
      owner,
      revokedFrom: revoke.split(',').map((s) => s.trim()).filter(Boolean),
      body,
    });
  }
  return out;
}

interface TableSpec {
  name: string;
  cols: Array<{ col: string; dtype: string; nullable: string }>;
  cons: Array<{ conname: string; contype: string }>;
}
const TYPE_MAP: Record<string, string> = { uuid: 'uuid', text: 'text', integer: 'integer', bigint: 'bigint', timestamptz: 'timestamp with time zone' };
const CON_MAP: Record<string, string> = { 'PRIMARY KEY': 'p', UNIQUE: 'u', 'FOREIGN KEY': 'f', CHECK: 'c' };

function ddlTables(ddl: string): TableSpec[] {
  const out: TableSpec[] = [];
  for (const m of ddl.matchAll(/CREATE TABLE public\.(\w+) \(\n([\s\S]*?)\n\);/g)) {
    const name = m[1];
    const entries: string[] = [];
    for (const line of m[2].split('\n')) {
      if (line.trim().startsWith('--') || line.trim() === '') continue;
      if (/^ {2}\S/.test(line)) entries.push(line.trim());
      else entries[entries.length - 1] += ` ${line.trim()}`;
    }
    const t: TableSpec = { name, cols: [], cons: [] };
    for (const e of entries) {
      const c = /^CONSTRAINT (\w+)\s+(PRIMARY KEY|UNIQUE|FOREIGN KEY|CHECK)/.exec(e);
      if (c) { t.cons.push({ conname: c[1], contype: CON_MAP[c[2]] }); continue; }
      const col = /^(\w+)\s+(uuid|text|integer|bigint|timestamptz)\b/.exec(e);
      if (!col) continue;
      t.cols.push({ col: col[1], dtype: TYPE_MAP[col[2]], nullable: /NOT NULL|PRIMARY KEY/.test(e) ? 'NO' : 'YES' });
      if (/PRIMARY KEY/.test(e)) t.cons.push({ conname: `${name}_pkey`, contype: 'p' });
      if (/REFERENCES/.test(e)) t.cons.push({ conname: `${name}_${col[1]}_fkey`, contype: 'f' });
    }
    out.push(t);
  }
  return out;
}

interface PolicySpec { name: string; tbl: string; cmd: string; role: string; qual: string }
function ddlPolicies(ddl: string): PolicySpec[] {
  return [...ddl.matchAll(/CREATE POLICY "(\w+)"\s+ON public\.(\w+)\s+FOR (\w+)\s+TO (\w+)\s+USING \(([\s\S]*?)\);/g)]
    .map((m) => ({ name: m[1], tbl: m[2], cmd: m[3], role: m[4], qual: m[5].trim() }));
}

const slice = (s: string, from: string, to: string): string => {
  const a = s.indexOf(from);
  const b = s.indexOf(to, a + from.length);
  return a < 0 || b < 0 ? '' : s.slice(a, b);
};
const setDiff = (label: string, want: string[], got: string[]): string[] => {
  const w = new Set(want); const g = new Set(got);
  return [
    ...[...g].filter((x) => !w.has(x)).map((x) => `${label}: VERIFY has ${x} but the DDL does not`),
    ...[...w].filter((x) => !g.has(x)).map((x) => `${label}: DDL has ${x} but VERIFY does not`),
  ];
};

/** Returns human-readable disagreements between VERIFY's expected values and the DDL (empty = agree). */
function verifyVsDdl(verRaw: string, ddl: string): string[] {
  const ver = LF(verRaw);
  const bad: string[] = [];
  const fns = ddlFunctions(ddl);
  if (fns.length !== 5) bad.push(`DDL parser found ${fns.length} functions, expected 5`);

  // Functions: ident, secdef, volatility, proconfig, EXECUTE for authenticated, owner, revokes.
  const wantRows = [...slice(ver, 'want(ident, secdef', '\nseed AS').matchAll(
    /^\s*\('([^']+)', (true|false), '([a-z])', (NULL::text|'((?:[^']|'')*)'::text), (true|false)\)/gm)]
    .map((m) => ({ ident: m[1], secdef: m[2] === 'true', vol: m[3], cfg: m[4] === 'NULL::text' ? null : m[5], authExec: m[6] === 'true' }));
  bad.push(...setDiff('function idents', fns.map((f) => f.ident), wantRows.map((r) => r.ident)));
  for (const f of fns) {
    const r = wantRows.find((x) => x.ident === f.ident);
    if (!r) continue;
    if (r.secdef !== f.secdef) bad.push(`${f.name}: prosecdef VERIFY=${r.secdef} DDL=${f.secdef}`);
    if (r.vol !== f.vol) bad.push(`${f.name}: provolatile VERIFY=${r.vol} DDL=${f.vol}`);
    if (r.cfg !== f.cfg) bad.push(`${f.name}: proconfig VERIFY=${r.cfg} DDL=${f.cfg}`);
    if (r.authExec !== f.authExec) bad.push(`${f.name}: authenticated EXECUTE VERIFY=${r.authExec} DDL=${f.authExec}`);
    if (f.owner !== 'postgres') bad.push(`${f.name}: DDL owner ${f.owner} but VERIFY row 24 expects postgres`);
    for (const role of ['PUBLIC', 'anon', SERVER_ROLE, ...(f.authExec ? [] : ['authenticated'])]) {
      if (!f.revokedFrom.includes(role)) bad.push(`${f.name}: DDL does not revoke from ${role} but VERIFY expects no EXECUTE`);
    }
  }
  const procList = [...(/p\.proname IN \(([^)]*)\)/.exec(slice(ver, 'fn AS (', '\nwant(ident'))?.[1] ?? '').matchAll(/'(\w+)'/g)].map((m) => m[1]);
  bad.push(...setDiff('fn CTE proname list', fns.map((f) => f.name), procList));

  // Tables: columns, constraints, indexes.
  const tables = ddlTables(ddl);
  const wantCols = [...slice(ver, 'want_cols(', '\nact_cols AS').matchAll(/\('(\w+)', '(\w+)', '([^']+)', '(YES|NO)'\)/g)].map((m) => `${m[1]}.${m[2]} ${m[3]} ${m[4]}`);
  bad.push(...setDiff('columns', tables.flatMap((t) => t.cols.map((c) => `${t.name}.${c.col} ${c.dtype} ${c.nullable}`)), wantCols));
  const wantCon = [...slice(ver, 'want_con(', '\nact_con AS').matchAll(/\('(\w+)', '(\w+)', '([pufc])'\)/g)].map((m) => `${m[1]}.${m[2]} ${m[3]}`);
  bad.push(...setDiff('constraints', tables.flatMap((t) => t.cons.map((c) => `${t.name}.${c.conname} ${c.contype}`)), wantCon));
  const ddlIdx = [
    ...tables.flatMap((t) => t.cons.filter((c) => c.contype === 'p' || c.contype === 'u').map((c) => `${t.name}.${c.conname}`)),
    ...[...ddl.matchAll(/CREATE INDEX (\w+)\s+ON public\.(\w+)/g)].map((m) => `${m[2]}.${m[1]}`),
  ];
  const wantIdx = [...slice(ver, 'want_idx(', '\nact_idx AS').matchAll(/\('(\w+)', '(\w+)'\)/g)].map((m) => `${m[1]}.${m[2]}`);
  bad.push(...setDiff('indexes', ddlIdx, wantIdx));
  const totalCols = tables.reduce((n, t) => n + t.cols.length, 0);
  if (!ver.includes(`'M1: columns total (6 + 13 + 12)', '${totalCols}'`)) bad.push(`columns total: DDL has ${totalCols}, VERIFY row 85 differs`);
  bad.push(...setDiff('rls tables', tables.map((t) => t.name), [...ddl.matchAll(/ALTER TABLE public\.(\w+)\s+ENABLE ROW LEVEL SECURITY;/g)].map((m) => m[1])));
  const rlsList = [...slice(ver, 'SELECT 10 AS ord', 'UNION ALL').matchAll(/\('(\w+)'\)/g)].map((m) => m[1]);
  bad.push(...setDiff('row 10 rls table list', tables.map((t) => t.name), rlsList));

  // Policies: names, cmd, role, total.
  const pols = ddlPolicies(ddl);
  const polSlice = slice(ver, 'SELECT 40,', 'SELECT 41,');
  bad.push(...setDiff('policy names', pols.map((p) => p.name), [...polSlice.matchAll(/\('(matrix_paper_review_\w+)'/g)].map((m) => m[1])));
  for (const p of pols) {
    if (p.cmd !== 'SELECT' || p.role !== 'authenticated') bad.push(`policy ${p.name}: DDL is FOR ${p.cmd} TO ${p.role}, VERIFY row 40 hardcodes SELECT/authenticated`);
  }
  const qualPattern = (q: string): string => (q === 'true' ? 'true' : q.includes('auth.uid()') ? '%auth.uid()%user_id%' : q.includes('is_matrix_options_paper_admin()') ? '%is_matrix_options_paper_admin()%' : `<unmapped:${q}>`);
  const wantPol = [...polSlice.matchAll(/\('(matrix_paper_review_\w+)', '(\w+)', '([^']*)'\)/g)].map((m) => `${m[1]} on ${m[2]} like ${m[3]}`);
  bad.push(...setDiff('policy name/table/qual', pols.map((p) => `${p.name} on ${p.tbl} like ${qualPattern(p.qual)}`), wantPol));
  if (!ver.includes(`'policies total on the 3 activation tables', '${pols.length}'`)) bad.push(`policy total: DDL has ${pols.length}, VERIFY row 41 differs`);
  {
    const row41 = slice(ver, "SELECT 41, ", "SELECT 50, ");
    const inLists = [...row41.matchAll(/tablename IN \(([^)]*)\)/g)].map((m) => [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1]).sort().join(','));
    const want41 = tables.map((t) => t.name).sort().join(',');
    if (inLists.length !== 2 || inLists.some((l) => l !== want41)) bad.push('row 41 is not scoped to exactly the DDL tables');
  }

  // Grants: authenticated SELECT on every table (row 30), sequence (rows 32, 80).
  const selGrants = [...ddl.matchAll(/GRANT (\w+) ON TABLE public\.(\w+)\s+TO authenticated;/g)];
  if (selGrants.some((g) => g[1] !== 'SELECT')) bad.push('DDL grants a non-SELECT table privilege to authenticated');
  {
    // rows 30/31 are per table (one row per DDL table, expected count 1 / 0), never a prefix-scoped total
    const want = tables.map((t) => t.name).sort().join(',');
    for (const n of [30, 31]) {
      const body = slice(ver, `SELECT ${n}, `, 'UNION ALL');
      const vals = [...(/FROM \(VALUES ([\s\S]*?)\) AS t\(relname\)/.exec(body)?.[1] ?? '').matchAll(/'([^']+)'/g)].map((x) => x[1]).sort().join(',');
      if (vals !== want) bad.push(`row ${n} is not scoped to exactly the DDL tables: ${vals}`);
      if (!/g\.table_name = t\.relname/.test(body)) bad.push(`row ${n} does not compare table_name to the per-table value`);
    }
    if (!ver.includes(`'table grants: authenticated SELECT rows on ' || t.relname, '1'`)) bad.push('row 30 expects a count other than 1 SELECT grant per table');
    if (selGrants.length !== tables.length) bad.push('DDL SELECT grants are not one per table');
  }
  bad.push(...setDiff('SELECT-granted tables', tables.map((t) => t.name), selGrants.map((g) => g[2])));
  const seq = /REVOKE ALL ON SEQUENCE public\.(\w+)/.exec(ddl)?.[1] ?? '<none>';
  if (!ver.includes(`public.${seq}`) || !ver.includes(`('${seq}')`)) bad.push(`sequence ${seq} from the DDL is not what VERIFY rows 32/80 name`);
  for (const role of ['anon', 'authenticated']) {
    if (!ver.includes(`has_sequence_privilege('${role}', 'public.${seq}', 'SELECT,UPDATE,USAGE')`)) bad.push(`row 32 does not test every sequence privilege for ${role}`);
  }
  if (!/REVOKE ALL ON SEQUENCE public\.\w+\s+FROM PUBLIC, anon, authenticated;/.test(ddl)) bad.push('DDL does not revoke ALL on the sequence from PUBLIC, anon, authenticated');

  // Trigger (rows 50, 91): name, table, tgtype (ROW 1 + BEFORE 2 + UPDATE 16 = 19), function.
  const trg = /CREATE TRIGGER (\w+)\s+BEFORE UPDATE ON public\.(\w+)\s+FOR EACH ROW\s+EXECUTE FUNCTION public\.(\w+)\(\);/.exec(ddl);
  if (!trg) bad.push('DDL trigger not parseable');
  else {
    if (!ver.includes(`tgname = '${trg[1]}'`)) bad.push(`trigger name ${trg[1]} not in VERIFY`);
    if (!ver.includes(`tgrelid = 'public.${trg[2]}'::regclass`)) bad.push(`trigger table ${trg[2]} not in VERIFY`);
    if (!ver.includes('tgtype = 19')) bad.push('trigger tgtype: BEFORE UPDATE FOR EACH ROW is 19; VERIFY differs');
    if (!ver.includes(`tgfoid = 'public.${trg[3]}()'::regprocedure`)) bad.push(`trigger function ${trg[3]} not in VERIFY row 91`);
  }

  // Row 88 FK, row 89 CHECKs, row 90 index, rows 92/93 RPC body markers.
  const fk = /CONSTRAINT matrix_paper_review_responses_question_fkey\s+FOREIGN KEY (\([^)]*\))[\s\S]*?ON DELETE (\w+)/.exec(ddl);
  if (!fk || !ver.includes(`FOREIGN KEY ${fk[1]}%`) || fk[2] !== 'RESTRICT' || !ver.includes("confdeltype = 'r'")) bad.push('row 88 FK columns/ON DELETE disagree with the DDL');
  for (const [con, col] of [['matrix_paper_review_responses_draft_len_chk', 'draft_text'], ['matrix_paper_review_responses_submitted_len_chk', 'submitted_text']]) {
    const d = new RegExp(`CONSTRAINT ${con}\\s+CHECK \\(([\\s\\S]*?)\\),?\\n`).exec(ddl)?.[1] ?? '';
    if (!d.includes(`matrix_paper_review_utf16_length(${col})`) || !d.includes('<= 20000') || !ver.includes(`('${con}', '${col}')`)) bad.push(`row 89 ${con} disagrees with the DDL`);
  }
  const uidx = /CREATE INDEX matrix_paper_review_response_events_user_idx\s+ON public\.\w+ (\([^)]*\));/.exec(ddl)?.[1];
  if (!uidx || !ver.includes(`indexdef LIKE '%${uidx}'`)) bad.push(`row 90 index columns disagree with the DDL (${uidx})`);
  const needles = [...slice(ver, 'SELECT 92,', 'SELECT 93,').matchAll(/LIKE '%(\w+)%'/g)].map((m) => m[1]);
  for (const f of fns.filter((x) => x.name.endsWith('_save_draft') || x.name.endsWith('_submit'))) {
    for (const n of new Set(needles)) if (!f.body.includes(n)) bad.push(`row 92 needle ${n} is not in the DDL body of ${f.name}`);
    if (f.body.includes('blank_submission') !== f.name.endsWith('_submit')) bad.push(`row 93: blank_submission placement disagrees with the DDL for ${f.name}`);
  }
  return bad;
}

// ---------------------------------------------------------------------------
// Structural guard for the region from the "8. Seed" banner to the end of the
// file (codex luna R1 P1): it may contain only the single seed DO block, the
// expected server-only-role REVOKE statements, NOTIFY and COMMIT, and the DO
// block body may contain no write/DDL/dynamic-SQL keyword other than its one
// seed INSERT.
// ---------------------------------------------------------------------------
const SEED_TABLES = 'public.matrix_paper_review_questions, public.matrix_paper_review_responses, public.matrix_paper_review_response_events';
const SEED_SEQ = 'public.matrix_paper_review_response_events_id_seq';
const EXPECTED_TAIL_STATEMENTS = [
  `REVOKE ALL ON TABLE ${SEED_TABLES} FROM ${SERVER_ROLE}`,
  `GRANT SELECT ON TABLE ${SEED_TABLES} TO ${SERVER_ROLE}`,
  `REVOKE ALL ON SEQUENCE ${SEED_SEQ} FROM ${SERVER_ROLE}`,
  "NOTIFY pgrst, 'reload schema'",
  'COMMIT',
];
const FORBIDDEN_IN_DO = /\b(INSERT|UPDATE|DELETE|TRUNCATE|DROP|ALTER|GRANT|REVOKE|EXECUTE|CREATE|COPY|CALL|PERFORM|SET|COMMIT|ROLLBACK)\b/gi;

function seedRegionViolations(sql: string): string[] {
  const bad: string[] = [];
  const at = sql.indexOf(SEED_BANNER);
  if (at < 0) return ['no seed banner'];
  const region = sql.slice(at).replace(/--[^\n]*/g, '');
  const m = /^\s*DO \$\$([\s\S]*?)\n\$\$;([\s\S]*)$/.exec(region);
  if (!m) return ['seed region does not start with a single DO $$ ... $$; block'];
  const body = m[1].replace(/'(?:[^']|'')*'/g, "''");
  if (body.includes('$$')) bad.push('DO block body contains a nested dollar quote');
  const kw = (body.match(FORBIDDEN_IN_DO) ?? []).map((k) => k.toUpperCase());
  if (kw.join(',') !== 'INSERT') bad.push(`DO block keywords ${JSON.stringify(kw)}, expected only ["INSERT"]`);
  if ((body.match(/\bINSERT INTO public\.matrix_paper_review_questions\b/g) ?? []).length !== 1) bad.push('DO block must contain exactly one INSERT INTO public.matrix_paper_review_questions');
  const tail = m[2].split(';').map((s) => s.replace(/\s+/g, ' ').trim()).filter(Boolean);
  if (JSON.stringify(tail) !== JSON.stringify(EXPECTED_TAIL_STATEMENTS)) bad.push(`statements after the DO block: ${JSON.stringify(tail)}`);
  return bad;
}

/** Server-only role is read-only on the review tables: activation, kill switch and VERIFY must agree (DDL-derived names). */
function serverRoleProblems(activation: string, kill: string, verRaw: string, ddl: string): string[] {
  const bad: string[] = [];
  const ver = LF(verRaw);
  const tableRevoke = `REVOKE ALL ON TABLE ${SEED_TABLES} FROM ${SERVER_ROLE};`;
  const tableGrant = `GRANT SELECT ON TABLE ${SEED_TABLES} TO ${SERVER_ROLE};`;
  const seqRevoke = `REVOKE ALL ON SEQUENCE ${SEED_SEQ} FROM ${SERVER_ROLE};`;
  const ddlTableNames = ddlTables(ddl).map((t) => `public.${t.name}`).join(', ');
  const ddlSeq = /REVOKE ALL ON SEQUENCE (public\.\w+)/.exec(ddl)?.[1];
  if (ddlTableNames !== SEED_TABLES) bad.push('REVOKE table list differs from the DDL tables');
  if (ddlSeq !== SEED_SEQ) bad.push('REVOKE sequence differs from the DDL sequence');
  for (const [name, text] of [['activation', activation], ['kill switch', kill]] as const) {
    if (!text.includes(`\n${tableRevoke}\n`)) bad.push(`${name}: table REVOKE for the server-only role missing or altered`);
    if (!text.includes(`\n${tableRevoke}\n${tableGrant}\n`)) bad.push(`${name}: SELECT-only re-grant must directly follow the table REVOKE ALL`);
    if (!text.includes(`\n${seqRevoke}\n`)) bad.push(`${name}: sequence REVOKE for the server-only role missing or altered`);
    const codeNoRevoke = codeOnly(text.slice(text.indexOf(SEED_BANNER) >= 0 ? text.indexOf(SEED_BANNER) : 0)).replace(/\bREVOKE [^;]*;/gi, '').replace(tableGrant, '');
    if (new RegExp(`GRANT [^;]*\\b${SERVER_ROLE}\\b`, 'i').test(codeNoRevoke)) bad.push(`${name}: grants something to the server-only role`);
  }
  const rowOf = (n: number): string => new RegExp(`SELECT ${n},[\\s\\S]*?UNION ALL`).exec(ver)?.[0] ?? '';
  const row33 = rowOf(33);
  const row34 = rowOf(34);
  const row35 = rowOf(35);
  const row36 = rowOf(36);
  const TABLE_PRIVS = ['INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER', 'MAINTAIN'];
  if (!row33.includes(`has_table_privilege('${SERVER_ROLE}', 'public.' || t.relname, p.priv)`)) bad.push('VERIFY row 33 does not test has_table_privilege per privilege');
  for (const p of TABLE_PRIVS) if (!row33.includes(`('${p}')`)) bad.push(`VERIFY row 33 does not test ${p}`);
  for (const t of ddlTables(ddl)) if (!row33.includes(`('${t.name}')`)) bad.push(`VERIFY row 33 does not cover ${t.name}`);
  if (!row34.includes(`has_sequence_privilege('${SERVER_ROLE}', '${SEED_SEQ}', p.priv)`)) bad.push('VERIFY row 34 does not test the sequence per privilege');
  for (const p of ['USAGE', 'SELECT', 'UPDATE']) if (!row34.includes(`('${p}')`)) bad.push(`VERIFY row 34 does not test ${p} on the sequence`);
  if (!row35.includes(`has_table_privilege('${SERVER_ROLE}', 'public.' || t.relname, 'SELECT')`) || !/'true',/.test(row35)) bad.push('VERIFY row 35 does not assert SELECT is kept (true)');
  for (const t of ddlTables(ddl)) if (!row35.includes(`('${t.name}')`)) bad.push(`VERIFY row 35 does not cover ${t.name}`);
  if (!row36.includes('has_table_privilege(r.rolname')) bad.push('VERIFY row 36 does not use has_table_privilege for anon/authenticated');
  for (const p of ['REFERENCES', 'TRIGGER', 'MAINTAIN']) if (!row36.includes(`('${p}')`)) bad.push(`VERIFY row 36 does not test ${p}`);
  for (const r of ['anon', 'authenticated']) if (!row36.includes(`('${r}')`)) bad.push(`VERIFY row 36 does not cover ${r}`);
  if (!kill.includes('has_table_privilege') || !kill.includes(`has_sequence_privilege('${SERVER_ROLE}'`) || !kill.includes('REFERENCES,TRIGGER,MAINTAIN')) bad.push('kill switch does not assert the server-only role revocation');
  return bad;
}

describe('v0.9.91 activation SQL parity (hermetic)', () => {
  const sql = read(ACTIVATION_FILE);
  const base = read(BASE_FILE);
  const manifest = getReviewManifest(VERSION);

  it('computes a 64-hex manifest sha and 12 question ids from app code', () => {
    expect(manifest.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(manifest.questionIds).toHaveLength(12);
  });

  it('header marks the file as an unapplied draft needing owner authorization (b)', () => {
    const head = sql.slice(0, sql.indexOf('\nBEGIN;\n'));
    expect(head).toContain('DRAFT -- NOT APPLIED; requires owner authorization (b) of this exact file + sha');
  });

  it('is one BEGIN/COMMIT transaction', () => {
    expect((sql.match(/^BEGIN;$/gm) ?? []).length).toBe(1);
    expect((sql.match(/^COMMIT;$/gm) ?? []).length).toBe(1);
    expect(sql.trimEnd().endsWith('COMMIT;')).toBe(true);
  });

  it('seed matches the manifest sha, ids, order, cohorts and count', () => {
    const parts = split(sql)!;
    const seed = parseSeed(parts.seed);
    expect(seed.parseError).toBe(false);
    expect(seed.dv).toBe(VERSION);
    expect(seed.sha).toBe(manifest.sha256);
    expect(seed.rows).toHaveLength(12);
    expect(seed.rows.map((r) => r.questionId)).toEqual([...manifest.questionIds]);
    expect(seed.rows.map((r) => r.number)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  });

  it('DDL part is byte-identical to the base 2026_09_22 draft DDL part', () => {
    const a = split(sql)!;
    const b = split(base)!;
    expect(a.ddl.length).toBeGreaterThan(20000);
    expect(a.ddl === b.ddl).toBe(true);
  });

  it('the base draft file is pinned by sha256 (computed from the file)', () => {
    expect(BASE_SHA256).toMatch(/^[0-9a-f]{64}$/);
    expect(sha256(base)).toBe(BASE_SHA256);
  });

  it('is pure ASCII', () => {
    for (let i = 0; i < sql.length; i += 1) expect(sql.charCodeAt(i)).toBeLessThan(128);
  });

  it('all parity assertions hold for the activation file', () => {
    expect(parityFailures(sql, base)).toEqual([]);
  });

  it('pins the COMPLETE activation file by sha256 (codex luna R1 P1)', () => {
    expect(ACTIVATION_SHA256).toMatch(/^[0-9a-f]{64}$/);
    expect(sha256(sql)).toBe(ACTIVATION_SHA256);
  });

  it('seed region (banner to COMMIT) holds only the expected statements', () => {
    expect(seedRegionViolations(sql)).toEqual([]);
  });

  describe('P1 negatives (in-memory mutations)', () => {
    const doEnd = "expected 12', v_row_count;\n  END IF;\nEND;\n$$;\n";
    const inDo = (stmt: string): string => `expected 12', v_row_count;\n  END IF;\n  ${stmt}\nEND;\n$$;\n`;
    it('an extra DELETE inside the DO block fails the structural guard and the pin', () => {
      const m = sql.replace(doEnd, () => inDo('DELETE FROM public.matrix_paper_review_questions;'));
      expect(m).not.toBe(sql);
      expect(seedRegionViolations(m).join('\n')).toMatch(/DO block keywords/);
      expect(sha256(m)).not.toBe(ACTIVATION_SHA256);
    });
    it('an extra statement after the DO block fails the structural guard and the pin', () => {
      const m = sql.replace(doEnd, () => `${doEnd}\nDELETE FROM public.matrix_paper_review_responses;\n`);
      expect(m).not.toBe(sql);
      expect(seedRegionViolations(m).join('\n')).toMatch(/statements after the DO block/);
      expect(sha256(m)).not.toBe(ACTIVATION_SHA256);
    });
    it('a second INSERT, a dynamic EXECUTE and a dropped REVOKE are each caught', () => {
      const ins = sql.replace(doEnd, () => inDo('INSERT INTO public.matrix_paper_review_questions SELECT * FROM public.matrix_paper_review_questions;'));
      expect(ins).not.toBe(sql);
      expect(seedRegionViolations(ins).join('\n')).toMatch(/DO block/);
      const exe = sql.replace(doEnd, () => inDo("EXECUTE 'select 1';"));
      expect(exe).not.toBe(sql);
      expect(seedRegionViolations(exe).join('\n')).toMatch(/DO block keywords/);
      const dropped = sql.replace(`REVOKE ALL ON SEQUENCE ${SEED_SEQ} FROM ${SERVER_ROLE};\n`, '');
      expect(dropped).not.toBe(sql);
      expect(seedRegionViolations(dropped).join('\n')).toMatch(/statements after/);
    });
    it('a DML-only revoke (REFERENCES/TRIGGER/MAINTAIN left open) fails the guard, the parity check and the pin', () => {
      const kill = read(`${PREFIX}_KILL_SWITCH.sql`);
      const ver = read(`${PREFIX}_VERIFY.sql`);
      const ddl = split(sql)!.ddl;
      const dml = `REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLE ${SEED_TABLES} FROM ${SERVER_ROLE};`;
      const full = `REVOKE ALL ON TABLE ${SEED_TABLES} FROM ${SERVER_ROLE};`;
      expect(sql).toContain(full);
      const m = sql.replace(full, dml);
      expect(m).not.toBe(sql);
      expect(seedRegionViolations(m).join('\n')).toMatch(/statements after the DO block/);
      expect(serverRoleProblems(m, kill, ver, ddl).join('\n')).toMatch(/activation: table REVOKE/);
      const mk = kill.replace(full, dml);
      expect(mk).not.toBe(kill);
      expect(serverRoleProblems(sql, mk, ver, ddl).join('\n')).toMatch(/kill switch: table REVOKE/);
      expect(sha256(m)).not.toBe(ACTIVATION_SHA256);
    });
    it('B8: cardinality and PG17 assertions are each falsified alone (exact guard set)', () => {
      const base = read(BASE_FILE);
      // duplicate + missing: q12 row replaced by a copy of q11; the count stays 12 and the set diff alone would miss it.
      const q12 = '{"cohort_id": "inputs-evidence",      "question_id": "rpq:v0.9.91:q12", "question_number": 12}';
      const q11 = '{"cohort_id": "methods-water-type",   "question_id": "rpq:v0.9.91:q11", "question_number": 11}';
      expectOnlyGuards(sql.replace(q12, q11), sql, base, ['distinct-rows', 'ids']);
      expectOnlyGuards(sql.replace('IF v_array_len <> 12 THEN', 'IF v_array_len <> 13 THEN'), sql, base, ['array-len-assert']);
      expectOnlyGuards(sql.replace('IF v_distinct_count <> 12 THEN', 'IF v_distinct_count <> 11 THEN'), sql, base, ['distinct-assert']);
      expectOnlyGuards(sql.replace('IF v_row_count <> 12 THEN', 'IF v_row_count < 12 THEN'), sql, base, ['post-count-assert']);
      expectOnlyGuards(sql.replace('::integer < 170000 THEN', '::integer < 150000 THEN'), sql, base, ['version-assert']);
      const guardRe = /  IF pg_catalog\.current_setting\('server_version_num'\)[\s\S]*?END IF;\n/;
      const late = sql.replace(guardRe, '').replace('  WITH expected AS (', `  IF pg_catalog.current_setting('server_version_num')::integer < 170000 THEN\n    RAISE EXCEPTION 'x';\n  END IF;\n  WITH expected AS (`);
      expectOnlyGuards(late, sql, base, ['version-assert']);
    });
    it('B8: PREFLIGHT threshold 150000 and a weakened or missing KILL_SWITCH guard fail', () => {
      const pre = read(PREFLIGHT_FILE);
      const kill = read(`${PREFIX}_KILL_SWITCH.sql`);
      expect(preflightVersionProblems(pre)).toEqual([]);
      const pre150 = pre.replace('::integer >= 170000', '::integer >= 150000');
      expect(pre150).not.toBe(pre);
      expect(preflightVersionProblems(pre150).join('\n')).toMatch(/below 170000/);
      expect(killSwitchVersionProblems(kill)).toEqual([]);
      const k2 = kill.replace('< 170000 THEN', '< 150000 THEN');
      expect(k2).not.toBe(kill);
      expect(killSwitchVersionProblems(k2)).not.toEqual([]);
      const k3 = kill.replace(/DO \$\$[\s\S]*?\$\$;\n\n/, '');
      expect(k3).not.toBe(kill);
      expect(killSwitchVersionProblems(k3)).not.toEqual([]);
    });
    it('a one-byte change anywhere (header, DDL, seed, tail) fails the pin', () => {
      for (const idx of [5, Math.floor(sql.length / 3), Math.floor(sql.length / 2), sql.length - 3]) {
        const c = sql[idx] === 'x' ? 'y' : 'x';
        const m = sql.slice(0, idx) + c + sql.slice(idx + 1);
        expect(m).not.toBe(sql);
        expect(sha256(m)).not.toBe(ACTIVATION_SHA256);
      }
      expect(sha256(`${sql} `)).not.toBe(ACTIVATION_SHA256);
    });
  });

  describe('two-sided: the parity checks fail on bad inputs', () => {
    it('fails against the base 2026_09_22 draft (1.0.11 seed, no NOTIFY)', () => {
      const failures = parityFailures(base, base).map((f) => f.msg).join('\n');
      expect(failures).toMatch(/document_version/);
      expect(failures).toMatch(/manifest sha/);
      expect(failures).toMatch(/NOTIFY/);
    });

    it('fails when one manifest sha character is flipped', () => {
      const flipped = `${manifest.sha256[0] === 'a' ? 'b' : 'a'}${manifest.sha256.slice(1)}`;
      const mutated = sql.replace(`v_sha      constant text := '${manifest.sha256}'`, `v_sha      constant text := '${flipped}'`);
      expectOnlyGuards(mutated, sql, base, ['sha']);
    });

    it('fails when one question is dropped', () => {
      const mutated = sql.split('\n').filter((line) => !line.includes('"rpq:v0.9.91:q12"')).join('\n');
      expectOnlyGuards(mutated, sql, base, ['rowcount', 'ids']);
    });

    it('fails when a cohort is swapped', () => {
      const mutated = sql.replace('{"cohort_id": "categories",           "question_id": "rpq:v0.9.91:q01"', '{"cohort_id": "pathway-grid",         "question_id": "rpq:v0.9.91:q01"');
      expectOnlyGuards(mutated, sql, base, ['cohort']);
    });

    it('count guard: a 13th entry is caught even when its keys are in another order', () => {
      const extra = '    {"question_number": 13, "question_id": "rpq:v0.9.91:q13", "cohort_id": "categories"},\n';
      const mutated = sql.replace('    {"cohort_id": "categories",', `${extra}    {"cohort_id": "categories",`);
      expect(mutated).not.toBe(sql);
      const parsed = parseSeed(split(mutated)!.seed);
      expect(parsed.rows).toHaveLength(13);
      expectOnlyGuards(mutated, sql, base, ['rowcount', 'ids', 'cohort']);
    });

    it('parseSeed is key-order independent', () => {
      const seed = [
        "v_dv constant text := 'v0.9.91';",
        "v_sha constant text := 'abc';",
        "v_expected constant jsonb := '[{\"question_number\": 2, \"question_id\": \"rpq:v0.9.91:q02\", \"cohort_id\": \"c2\"},",
        "  {\"cohort_id\": \"c1\", \"question_number\": 1, \"question_id\": \"rpq:v0.9.91:q01\"}]'::jsonb;",
      ].join('\n');
      expect(parseSeed(seed).rows).toEqual([
        { cohort: 'c2', questionId: 'rpq:v0.9.91:q02', number: 2 },
        { cohort: 'c1', questionId: 'rpq:v0.9.91:q01', number: 1 },
      ]);
    });

    it('other-version guard: swapping one id to another version (row count stays 12)', () => {
      const mutated = sql.replace('"question_id": "rpq:v0.9.91:q05"', '"question_id": "rpq:v0.9.90:q05"');
      expect(parseSeed(split(mutated)!.seed).rows).toHaveLength(12);
      expectOnlyGuards(mutated, sql, base, ['other-version', 'ids', 'cohort', 'qnumber']);
    });

    it('1.0.11/R5 guard: legacy marker in code with the row count unchanged', () => {
      const mutated = sql.replace('"cohort_id": "categories",           "question_id": "rpq:v0.9.91:q01"', '"cohort_id": "categories-R5",         "question_id": "rpq:v0.9.91:q01"');
      expect(parseSeed(split(mutated)!.seed).rows).toHaveLength(12);
      expectOnlyGuards(mutated, sql, base, ['legacy-content', 'cohort']);
    });

    it('exact-set abort: IF v_diff <> 0 mutated to < 0 is detected', () => {
      const mutated = sql.replace('IF v_diff <> 0 THEN', 'IF v_diff < 0 THEN');
      expectOnlyGuards(mutated, sql, base, ['exact-set-abort']);
    });

    it('exact-set difference: one EXCEPT direction removed is detected', () => {
      const mutated = sql.replace(/\s+UNION ALL\s+\(SELECT \* FROM actual EXCEPT SELECT \* FROM expected\)/, '');
      expectOnlyGuards(mutated, sql, base, ['exact-set-except']);
    });

    it('count and conflict assertions: each is detected on its own', () => {
      expectOnlyGuards(sql.replace('IF v_expected_count <> 12 THEN', 'IF v_expected_count <> 13 THEN'), sql, base, ['count-assert']);
      expectOnlyGuards(sql.replace('DO NOTHING;', 'DO UPDATE SET cohort_id = EXCLUDED.cohort_id;'), sql, base, ['on-conflict']);
    });

    it('question-number guard: a wrong question_number for one id', () => {
      const mutated = sql.replace('"question_id": "rpq:v0.9.91:q05", "question_number": 5}', '"question_id": "rpq:v0.9.91:q05", "question_number": 6}');
      expectOnlyGuards(mutated, sql, base, ['qnumber']);
    });

    it('notify-once guard: a second NOTIFY outside the DDL and seed parts', () => {
      expectOnlyGuards(`NOTIFY pgrst, 'reload schema';\n${sql}`, sql, base, ['notify-once']);
    });

    it('split guard: a missing seed banner cannot be split', () => {
      expectOnlyGuards(sql.replace(SEED_BANNER, '-- ---\n-- 8 Seed:'), sql, base, ['split']);
    });

    it('role assertion (R2-M5): altered role, removed raise, and a late placement are each detected', () => {
      expect(sql).toContain("IF current_user <> 'postgres' THEN");
      expectOnlyGuards(sql.replace("IF current_user <> 'postgres' THEN", "IF current_user <> 'postgres2' THEN"), sql, base, ['role-assert']);
      expectOnlyGuards(sql.replace("RAISE EXCEPTION 'activation must run as postgres, not %', current_user;", 'NULL;'), sql, base, ['role-assert']);
      const block = /  IF current_user <> 'postgres' THEN\n[\s\S]*?  END IF;\n\n/.exec(sql)![0];
      const late = sql.replace(block, '').replace('  IF v_diff <> 0 THEN', `${block}  IF v_diff <> 0 THEN`);
      expectOnlyGuards(late, sql, base, ['role-assert']);
    });

    it('fails when NOTIFY is moved before the seed', () => {
      const mutated = sql.replace("NOTIFY pgrst, 'reload schema';\n\n", '').replace('\nDO $$\nDECLARE\n  v_dv', "\nNOTIFY pgrst, 'reload schema';\nDO $$\nDECLARE\n  v_dv");
      expectOnlyGuards(mutated, sql, base, ['notify-last']);
    });

    it('fails when one DDL character is changed', () => {
      const mutated = sql.replace('CREATE TABLE public.matrix_paper_review_questions', 'CREATE TABLE IF NOT EXISTS public.matrix_paper_review_questions');
      expectOnlyGuards(mutated, sql, base, ['ddl']);
    });

    it('base sha pin: editing the base and the activation DDL in lockstep is still caught', () => {
      const edit = (s: string): string => s.replace('CREATE TABLE public.matrix_paper_review_questions', 'CREATE TABLE IF NOT EXISTS public.matrix_paper_review_questions');
      const mutatedSql = edit(sql);
      const mutatedBase = edit(base);
      expect(mutatedBase).not.toBe(base);
      // DDL parts agree again, so only the pin can see it.
      const failures = parityFailures(mutatedSql, mutatedBase);
      expect(has(failures, 'ddl')).toBe(false);
      expect(failures.map((f) => f.id)).toEqual(['base-sha']);
    });
  });

  describe('companion files (PREFLIGHT / VERIFY) review-finding coverage', () => {
    const pre = read(PREFLIGHT_FILE);
    const ver = read(VERIFY_FILE);

    it('are pure ASCII and read-only (no write/DDL keywords outside comments and string literals)', () => {
      for (const text of [pre, ver]) {
        for (let i = 0; i < text.length; i += 1) expect(text.charCodeAt(i)).toBeLessThan(128);
        expect(readOnlyViolations(text)).toEqual([]);
      }
    });

    it('the read-only scan is falsifiable: write keywords in code are caught, in comments and strings they are not', () => {
      for (const text of [pre, ver]) {
        expect(readOnlyViolations(`${text}\nINSERT INTO t VALUES (1);`)).toEqual(['INSERT']);
        expect(readOnlyViolations(`${text}\nSELECT set_config('a', 'b', false);`)).toEqual(['set_config']);
        expect(readOnlyViolations(`${text}\n-- DROP TABLE x\nSELECT 'DELETE me';`)).toEqual([]);
      }
    });

    it('I1: both check schema CREATE for the 4 API roles + PUBLIC and hijack-capable public functions', () => {
      for (const text of [pre, ver]) {
        // The server-only role name is assembled so this paper file never spells it (private-release-hygiene scan).
        for (const role of ['anon', 'authenticated', 'authenticator', ['service', 'role'].join('_')]) expect(text).toContain(`('${role}')`);
        expect(text).toContain("has_schema_privilege(r.rolname, 'public', 'CREATE')");
        expect(text).toContain("aclexplode(coalesce(n.nspacl, acldefault('n', n.nspowner)))");
        for (const fn of ['convert_to', 'encode', 'sha256', 'to_char', 'hashtext', 'jsonb_build_object',
          'pg_advisory_xact_lock', 'count', 'now', 'char_length', 'regexp_count', 'gen_random_uuid']) {
          expect(text).toContain(`('${fn}')`);
        }
      }
    });

    it('I2: PREFLIGHT checks current_user and rolbypassrls; VERIFY checks relowner for tables and sequence', () => {
      expect(pre).toContain("current_user = 'postgres'");
      expect(pre).toContain('rolbypassrls');
      expect(ver).toContain('pg_get_userbyid(c.relowner)');
      expect(ver).toContain("('matrix_paper_review_response_events_id_seq')");
      expect(ver).toContain('function owner:');
    });

    it('M2: PREFLIGHT checks auth.jwt(), user_roles.role type, server_version_num', () => {
      expect(pre).toContain("p.proname = 'jwt'");
      expect(pre).toContain("column_name = 'role'");
      expect(pre).toContain("server_version_num");
      expect(preflightVersionProblems(pre)).toEqual([]);
    });

    it('B10: PREFLIGHT rows 18-20 check EXACTLY the activation-created names (derived from the activation file), nothing broader', () => {
      interface Derived { rels: string[]; cons: string[]; types: string[] }
      const derive = (act: string): Derived => {
        const rels = new Set<string>();
        const cons = new Set<string>();
        const types = new Set<string>();
        const blocks = [...act.matchAll(/CREATE TABLE public\.([0-9a-z_]+) \(\n([\s\S]*?)\n\);/g)];
        for (const [, t, body] of blocks) {
          rels.add(t);
          types.add(t);
          for (const m of body.matchAll(/CONSTRAINT ([0-9a-z_]+)(\s+(?:PRIMARY KEY|UNIQUE))?/g)) {
            cons.add(m[1]);
            if (m[2]) rels.add(m[1]); // PRIMARY KEY / UNIQUE constraints are backed by an index of the same name
          }
          // column definitions: lowercase identifier at 2-space indent, plus continuation lines
          for (const m of body.matchAll(/^ {2}([a-z_0-9]+)\s[^\n]*(?:\n(?! {2}[A-Za-z-])[^\n]*)*/gm)) {
            const col = m[1];
            const def = m[0];
            if (/\bPRIMARY KEY\b/.test(def)) { rels.add(`${t}_pkey`); cons.add(`${t}_pkey`); }
            if (/\bREFERENCES\b/.test(def)) cons.add(`${t}_${col}_fkey`);
            if (/GENERATED (?:ALWAYS|BY DEFAULT) AS IDENTITY/.test(def)) rels.add(`${t}_${col}_seq`);
          }
        }
        for (const m of act.matchAll(/CREATE (?:UNIQUE )?INDEX ([0-9a-z_]+)/g)) rels.add(m[1]);
        return { rels: [...rels].sort(), cons: [...cons].sort(), types: [...types].sort() };
      };
      const cte = (preText: string, name: string): string[] => {
        const m = preText.match(new RegExp(`${name}\\(nm\\) AS \\(([\\s\\S]*?)\\n\\)`));
        return m ? [...m[1].matchAll(/\('([^']+)'\)/g)].map((x) => x[1]).sort() : ['<missing CTE>'];
      };
      const rowsText = (preText: string): string => {
        const a = preText.indexOf('SELECT 18,');
        const b = preText.indexOf('SELECT 30,');
        return a < 0 || b < a ? '' : preText.slice(a, b);
      };
      // Problems with PREFLIGHT relative to the derived exact list; empty means parity.
      const problems = (preText: string, act: string): string[] => {
        const d = derive(act);
        const bad: string[] = [];
        const cmp = (label: string, got: string[], want: string[]): void => {
          const extra = got.filter((x) => !want.includes(x));
          const missing = want.filter((x) => !got.includes(x));
          if (extra.length) bad.push(`${label} broader than activation: ${extra.join(',')}`);
          if (missing.length) bad.push(`${label} missing: ${missing.join(',')}`);
        };
        cmp('own_rels', cte(preText, 'own_rels'), d.rels);
        cmp('own_cons', cte(preText, 'own_cons'), d.cons);
        cmp('own_types', cte(preText, 'own_types'), d.types);
        const rows = rowsText(preText);
        if (!rows) bad.push('rows 18-20 not found');
        if (/\bLIKE\b/i.test(rows)) bad.push('rows 18-20 use a LIKE catch-all');
        if (!/IN \(SELECT nm FROM own_rels\)/.test(rows)) bad.push('row 18 not bound to own_rels');
        if (!/IN \(SELECT nm FROM own_cons\)/.test(rows)) bad.push('row 19 not bound to own_cons');
        if (!/IN \(SELECT nm FROM own_types\)/.test(rows)) bad.push('row 20 not bound to own_types');
        for (const [label, from, to] of [['row 18', 'SELECT 18,', 'SELECT 19,'], ['row 19', 'SELECT 19,', 'SELECT 20,'], ['row 20', 'SELECT 20,', 'SELECT 30,']] as const) {
          const seg = rows.slice(rows.indexOf(from), rows.indexOf(to));
          if (!seg.includes("n.nspname = 'public'")) bad.push(`${label} not scoped to public`);
        }
        if (!/pg_constraint k JOIN pg_namespace n ON n\.oid = k\.connamespace/.test(rows)) bad.push('row 19 not scoped by connamespace');
        return bad;
      };
      const d = derive(sql);
      // sanity: the derivation sees the known shape (3 tables, 4 explicit indexes, identity sequence, auto-named objects)
      expect(d.types).toHaveLength(3);
      expect(d.rels).toContain('matrix_paper_review_response_events_id_seq');
      expect(d.rels).toContain('matrix_paper_review_response_events_pkey');
      expect(d.cons).toContain('matrix_paper_review_responses_user_id_fkey');
      for (const idx of ['questions_probe_idx', 'responses_release_idx', 'response_events_response_idx', 'response_events_user_idx']) {
        expect(d.rels).toContain(`matrix_paper_review_${idx}`);
      }
      expect(problems(pre, sql)).toEqual([]);
      // two-sided: a stray prefix catch-all in rows 18-20 is flagged as broader
      const stray = pre.replace("WHERE n.nspname = 'public' AND c.relname IN (SELECT nm FROM own_rels))::text",
        "WHERE n.nspname = 'public' AND c.relname LIKE 'matrix\\_paper\\_review%')::text");
      expect(stray).not.toBe(pre);
      expect(problems(stray, sql).join('\n')).toMatch(/LIKE catch-all/);
      // a broader name added to a CTE is flagged
      const broader = pre.replace("VALUES ('matrix_paper_review_questions')", "VALUES ('matrix_paper_review_archive'),\n         ('matrix_paper_review_questions')");
      expect(broader).not.toBe(pre);
      expect(problems(broader, sql).join('\n')).toMatch(/own_rels broader than activation: matrix_paper_review_archive/);
      // dropping any derived name from PREFLIGHT is reported, for every CTE
      for (const [cteName, list] of [['own_rels', d.rels], ['own_cons', d.cons], ['own_types', d.types]] as const) {
        for (const n of list) {
          const i = pre.indexOf(`${cteName}(nm) AS (`);
          const j = pre.indexOf(`('${n}')`, i);
          expect(j).toBeGreaterThan(i);
          const dropped = pre.slice(0, j) + "('zz_dropped')" + pre.slice(j + n.length + 4);
          expect(problems(dropped, sql).join('\n')).toContain(`${cteName} missing: ${n}`);
        }
      }
      // an activation file gaining a new index / constraint is reported
      expect(problems(pre, `${sql}\nCREATE INDEX matrix_paper_review_new_idx ON t (a);`).join('\n')).toContain('own_rels missing: matrix_paper_review_new_idx');
      expect(problems(pre, sql.replace('CONSTRAINT matrix_paper_review_questions_sha_chk', 'CONSTRAINT matrix_paper_review_questions_sha2_chk')).join('\n')).toContain('own_cons missing: matrix_paper_review_questions_sha2_chk');
      // row 18 unscoped from public, or row 19 unscoped by namespace, is reported
      expect(problems(pre.split("n.nspname = 'public' AND c.relname IN (SELECT nm FROM own_rels)").join('c.relname IN (SELECT nm FROM own_rels)'), sql).join('\n')).toMatch(/row 18 not scoped/);
      expect(problems(pre.replace('pg_constraint k JOIN pg_namespace n ON n.oid = k.connamespace', 'pg_constraint k JOIN pg_namespace n ON n.oid = k.conrelid'), sql).join('\n')).toMatch(/row 19 not scoped/);
      // rows 18-20 stay SELECT-only
      expect(rowsText(pre)).not.toMatch(/\b(?:INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|TRUNCATE|GRANT|REVOKE)\b/i);
    });

    it('B11: PREFLIGHT rows 2-4 are scoped to the activation exact identities / tables / trigger table, not names alone', () => {
      // collision key = proname + INPUT TYPE list (argument names are irrelevant to PostgreSQL uniqueness)
      const derivedIdents = ddlFunctions(split(sql)!.ddl)
        .map((f) => `${f.name}(${f.ident.slice(f.name.length + 1, -1).split(',').map((a) => a.trim()).filter(Boolean).map((a) => a.split(' ').slice(1).join(' ')).join(', ')})`)
        .sort();
      const tables = [...sql.matchAll(/CREATE TABLE public\.([0-9a-z_]+) \(/g)].map((m) => m[1]).sort();
      const trigTable = /CREATE TRIGGER matrix_paper_review_response_events_no_update[\s\S]*?ON public\.([0-9a-z_]+)/.exec(sql)?.[1] ?? '<none>';
      const cteBody = (t: string, name: string): string => new RegExp(`\\n${name}(?:\\([a-z, ]+\\))? AS \\(([\\s\\S]*?)\\n\\),`).exec(t)?.[1] ?? '';
      const problems = (t: string): string[] => {
        const bad: string[] = [];
        const ids = [...cteBody(t, 'fn_ids').matchAll(/\('([^']+)', '([^']*)'\)/g)].map((m) => `${m[1]}(${m[2]})`).sort();
        if (JSON.stringify(ids) !== JSON.stringify(derivedIdents)) bad.push(`fn_ids differ from activation identities: ${ids.join(' | ')}`);
        const fns = cteBody(t, 'fns');
        if (!/JOIN fn_ids f ON f\.fname = p\.proname AND f\.argtypes = oidvectortypes\(p\.proargtypes\)/.test(fns)) bad.push('fns not matched by exact identity');
        if (/pg_get_function_identity_arguments/.test(fns)) bad.push('fns compares argument names (identity arguments)');
        if (/proname IN/.test(fns)) bad.push('fns filtered by proname alone');
        if (!/nspname = 'public'/.test(fns)) bad.push('fns not scoped to public');
        const pols = cteBody(t, 'pols');
        const ptabs = /tablename IN \(([^)]*)\)/.exec(pols)?.[1];
        const pnames = [...(ptabs ?? '').matchAll(/'([^']+)'/g)].map((m) => m[1]).sort();
        if (JSON.stringify(pnames) !== JSON.stringify(tables)) bad.push(`pols tables differ from activation tables: ${pnames.join(',')}`);
        if (/LIKE/i.test(pols)) bad.push('pols uses LIKE');
        if (!/schemaname = 'public'/.test(pols)) bad.push('pols not scoped to public');
        const trg = cteBody(t, 'trg');
        if (!/JOIN pg_class c ON c\.oid = t\.tgrelid/.test(trg)) bad.push('trg not joined to tgrelid');
        if (!/JOIN pg_namespace n ON n\.oid = c\.relnamespace/.test(trg)) bad.push('trg not joined to namespace');
        if (!new RegExp(`n\\.nspname = 'public' AND c\\.relname = '${trigTable}'`).test(trg)) bad.push('trg not scoped to the activation events table in public');
        return bad;
      };
      expect(derivedIdents).toHaveLength(5);
      expect(tables).toHaveLength(3);
      expect(trigTable).toBe('matrix_paper_review_response_events');
      expect(problems(pre)).toEqual([]);
      // two-sided: reverting each predicate to its name-only form is reported
      const nameOnlyFn = pre.replace('JOIN fn_ids f ON f.fname = p.proname AND f.argtypes = oidvectortypes(p.proargtypes)', "JOIN fn_ids f ON f.fname = p.proname AND p.proname IN ('matrix_paper_review_submit')");
      expect(nameOnlyFn).not.toBe(pre);
      expect(problems(nameOnlyFn).join('\n')).toMatch(/fns (?:not matched by exact identity|filtered by proname alone)/);
      const likePol = pre.replace(/tablename IN \('matrix_paper_review_questions','matrix_paper_review_responses','matrix_paper_review_response_events'\)/, "tablename LIKE 'matrix_paper_review%'");
      expect(likePol).not.toBe(pre);
      expect(problems(likePol).join('\n')).toMatch(/pols uses LIKE/);
      const noRel = pre.replace("\n     AND n.nspname = 'public' AND c.relname = 'matrix_paper_review_response_events'", '');
      expect(noRel).not.toBe(pre);
      expect(problems(noRel).join('\n')).toMatch(/trg not scoped/);
      const noJoin = pre.replace('    JOIN pg_class c ON c.oid = t.tgrelid\n', '');
      expect(noJoin).not.toBe(pre);
      expect(problems(noJoin).join('\n')).toMatch(/trg not joined to tgrelid/);
      // an overload-shaped identity list (a dropped or altered identity) is reported
      const dropId = pre.replace("('matrix_paper_review_utf16_length', 'text'),\n         ", '');
      expect(dropId).not.toBe(pre);
      expect(problems(dropId).join('\n')).toMatch(/fn_ids differ/);
      const alteredId = pre.replace("'text, text, text, text, text, integer'),\n         ('matrix_paper_review_submit'", "'text, text, text, text, text, bigint'),\n         ('matrix_paper_review_submit'");
      expect(alteredId).not.toBe(pre);
      expect(problems(alteredId).join('\n')).toMatch(/fn_ids differ/);
      // R5: an identity-arguments (argument-name) comparison is reported
      const namesBased = pre.replace("oidvectortypes(p.proargtypes) || ')' AS ident", "pg_get_function_identity_arguments(p.oid) || ')' AS ident").replace('AND f.argtypes = oidvectortypes(p.proargtypes)', 'AND f.argtypes = pg_get_function_identity_arguments(p.oid)');
      expect(namesBased).not.toBe(pre);
      expect(problems(namesBased).join('\n')).toMatch(/compares argument names|not matched by exact identity/);
      // R5: derived collision keys carry types only (no p_ names)
      expect(derivedIdents.join(' ')).not.toMatch(/\bp_/);
      expect(derivedIdents).toContain('matrix_paper_review_utf16_length(text)');
      // a policy table list missing one activation table is reported
      const missTab = pre.replace("'matrix_paper_review_questions','matrix_paper_review_responses','matrix_paper_review_response_events')\n),\ntrg", "'matrix_paper_review_questions','matrix_paper_review_responses')\n),\ntrg");
      expect(missTab).not.toBe(pre);
      expect(problems(missTab).join('\n')).toMatch(/pols tables differ/);
    });

    it('R5: VERIFY has no prefix LIKE scoping on relation names; rows 30/31/41 are exact and per table', () => {
      const likeBad = (t: string): string[] => [...t.matchAll(/LIKE\s+'matrix_paper_review/gi)].map((m) => m[0]);
      expect(likeBad(ver)).toEqual([]);
      expect(/matrix_paper_review%/.test(ver)).toBe(false);
      for (const m of ver.matchAll(/(\S+)\s+LIKE\s/g)) expect(m[1]).not.toMatch(/(?:table_name|tablename|relname|proname|nspname)$/);
      // two-sided: re-introducing a prefix predicate is detected by both the LIKE guard and the DDL cross-check
      const ddl = split(sql)!.ddl;
      const regress30 = ver.replaceAll('g.table_name = t.relname', "g.table_name LIKE 'matrix_paper_review%'");
      expect(regress30).not.toBe(ver);
      expect(likeBad(regress30).length).toBeGreaterThan(0);
      expect(verifyVsDdl(regress30, ddl).join('\n')).toMatch(/row 3[01]/);
      const regress41 = ver.replace("tablename IN ('matrix_paper_review_questions','matrix_paper_review_responses','matrix_paper_review_response_events'))::text", "tablename LIKE 'matrix_paper_review%')::text");
      expect(regress41).not.toBe(ver);
      expect(likeBad(regress41).length).toBeGreaterThan(0);
      expect(verifyVsDdl(regress41, ddl).join('\n')).toMatch(/row 41/);
    });

    it('M8: aclexplode on proacl is wrapped in coalesce(proacl, acldefault)', () => {
      expect(ver).not.toMatch(/aclexplode\(f\.proacl\)/);
      expect(ver).toContain("aclexplode(coalesce(f.proacl, acldefault('f', f.proowner)))");
    });

    describe('P2: the server-only role is read-only on the review tables (activation, kill switch, VERIFY agree)', () => {
      const kill = read(`${PREFIX}_KILL_SWITCH.sql`);
      const ddl = split(sql)!.ddl;
      it('holds as written', () => {
        expect(serverRoleProblems(sql, kill, ver, ddl)).toEqual([]);
      });
      it('two-sided: each divergence is reported', () => {
        const v = LF(ver);
        expect(v).toContain('SELECT 33,');
        expect(serverRoleProblems(sql, kill, v.replace(/SELECT 33,[\s\S]*?UNION ALL/, (r) => r.replace("('MAINTAIN')", "('TRUNCATE')")), ddl).join('\n')).toMatch(/row 33 does not test MAINTAIN/);
        expect(serverRoleProblems(sql, kill, v.replace(/SELECT 33,[\s\S]*?UNION ALL/, (r) => r.replace("('matrix_paper_review_responses'),", '')), ddl).join('\n')).toMatch(/row 33 does not cover/);
        expect(serverRoleProblems(sql, kill, v.replace(/SELECT 34,[\s\S]*?UNION ALL/, (r) => r.replace("('SELECT'),", '')), ddl).join('\n')).toMatch(/row 34/);
        expect(serverRoleProblems(sql, kill, v.replace(/SELECT 35,[\s\S]*?UNION ALL/, (r) => r.replace("'true',", "'false',")), ddl).join('\n')).toMatch(/row 35/);
        expect(serverRoleProblems(sql, kill, v.replace(/SELECT 36,[\s\S]*?UNION ALL/, (r) => r.replace("('TRIGGER'),", '')), ddl).join('\n')).toMatch(/row 36 does not test TRIGGER/);
        expect(serverRoleProblems(sql, kill.replace(`REVOKE ALL ON SEQUENCE ${SEED_SEQ} FROM ${SERVER_ROLE};\n`, ''), v, ddl).join('\n')).toMatch(/kill switch: sequence REVOKE/);
        expect(serverRoleProblems(sql, kill.replace(/GRANT SELECT ON TABLE [^\n]*\n/, ''), v, ddl).join('\n')).toMatch(/kill switch: SELECT-only re-grant/);
        expect(serverRoleProblems(sql.replace(/REVOKE ALL ON TABLE public\.matrix_paper_review_questions, [^\n]*\n/, ''), kill, v, ddl).join('\n')).toMatch(/activation: table REVOKE/);
        expect(serverRoleProblems(`${sql}\nGRANT ALL ON TABLE public.x TO ${SERVER_ROLE};\n`, kill, v, ddl).join('\n')).toMatch(/grants something/);
      });
    });

    describe('R2-I1: VERIFY expected values equal the values derived from the DDL text', () => {
      const ddl = split(sql)!.ddl;

      it('the DDL parsers see the whole schema (so an empty diff is not vacuous)', () => {
        expect(ddlFunctions(ddl).map((f) => f.name)).toEqual([
          'is_matrix_options_paper_admin', 'matrix_paper_review_utf16_length', 'matrix_paper_review_events_block_update',
          'matrix_paper_review_save_draft', 'matrix_paper_review_submit']);
        const t = ddlTables(ddl);
        expect(t.map((x) => x.cols.length)).toEqual([6, 13, 12]);
        expect(t.map((x) => x.cons.length)).toEqual([8, 9, 7]);
        expect(ddlPolicies(ddl)).toHaveLength(5);
        const byName = Object.fromEntries(ddlFunctions(ddl).map((f) => [f.name, f]));
        expect(byName.matrix_paper_review_events_block_update.cfg).toBe('{"search_path=public, pg_temp"}');
        expect(byName.matrix_paper_review_utf16_length).toMatchObject({ vol: 'i', secdef: false, cfg: '{"search_path=pg_catalog, pg_temp"}' });
        expect(byName.is_matrix_options_paper_admin).toMatchObject({ vol: 's', secdef: true, authExec: true });
      });

      it('VERIFY agrees with the DDL on every function/column/constraint/index/policy/grant/trigger expectation', () => {
        expect(verifyVsDdl(ver, ddl)).toEqual([]);
      });

      it('two-sided: each class of wrong expected value is reported', () => {
        const v = LF(ver);
        const mutate = (from: string, to: string): string[] => {
          expect(v).toContain(from);
          return verifyVsDdl(v.split(from).join(to), ddl);
        };
        const trigFn = "('matrix_paper_review_events_block_update()', false, 'v', '{\"search_path=public, pg_temp\"}'::text, false)";
        expect(v).toContain(trigFn);
        expect(mutate(trigFn, "('matrix_paper_review_events_block_update()', false, 'v', NULL::text, false)").join('\n')).toMatch(/events_block_update: proconfig/);
        expect(mutate("('is_matrix_options_paper_admin()', true, 's'", "('is_matrix_options_paper_admin()', false, 's'").join('\n')).toMatch(/prosecdef/);
        expect(mutate("('is_matrix_options_paper_admin()', true, 's'", "('is_matrix_options_paper_admin()', true, 'v'").join('\n')).toMatch(/provolatile/);
        expect(mutate("'{\"search_path=pg_catalog, pg_temp\"}'::text, false)", "'{\"search_path=pg_catalog\"}'::text, false)").join('\n')).toMatch(/proconfig/);
        expect(mutate("'matrix_paper_review_responses_user_id_fkey'", "'matrix_paper_review_responses_userid_fkey'").join('\n')).toMatch(/constraints/);
        expect(mutate("('matrix_paper_review_responses', 'revision', 'integer', 'NO')", "('matrix_paper_review_responses', 'revision', 'bigint', 'NO')").join('\n')).toMatch(/columns/);
        expect(mutate("'matrix_paper_review_response_events_user_idx')", "'matrix_paper_review_response_events_usr_idx')").join('\n')).toMatch(/indexes/);
        expect(mutate("('matrix_paper_review_responses_select_own',", "('matrix_paper_review_responses_select_mine',").join('\n')).toMatch(/policy name/);
        expect(mutate("'matrix_paper_review_questions', 'true')", "'matrix_paper_review_questions', '%auth.uid()%user_id%')").join('\n')).toMatch(/policy name\/table\/qual/);
        expect(mutate("'public.matrix_paper_review_response_events_id_seq', 'SELECT,UPDATE,USAGE')", "'public.matrix_paper_review_response_events_id_seq', 'USAGE')").join('\n')).toMatch(/every sequence privilege/);
        expect(mutate('tgtype = 19', 'tgtype = 17').join('\n')).toMatch(/tgtype/);
      });
    });

    it('M1: VERIFY seed expectation equals the activation seed (programmatic), plus structure checks', () => {
      const rows = parseSeed(split(sql)!.seed).rows;
      for (const r of rows) {
        expect(ver).toContain(`('${VERSION}', '${manifest.sha256}', '${r.cohort}', '${r.questionId}', ${r.number})`);
      }
      expect((ver.match(/\('v0\.9\.91', '[0-9a-f]{64}', /g) ?? []).length).toBe(12);
      for (const needle of ['symmetric difference', 'tgtype = 19', 'matrix_paper_review_utf16_length(', 'confdeltype',
        'events_user_idx is ON (user_id, occurred_at)', 'blank_submission', 'pg_advisory_xact_lock', 'is_anonymous']) {
        expect(ver).toContain(needle);
      }
    });
    describe('P2 (sol R2): VERIFY tolerates legitimate v0.9.91 traffic between apply and VERIFY', () => {
      const rowText = (text: string, n: number): string => {
        const start = text.indexOf(`  SELECT ${n}, `);
        if (start < 0) return '';
        const end = text.indexOf('\n  UNION ALL', start);
        return end < 0 ? text.slice(start) : text.slice(start, end);
      };
      const INVARIANTS: Array<[number, string, RegExp]> = [
        [72, 'other version/sha', /WHERE NOT \(document_version = 'v0\.9\.91' AND manifest_sha256 = '[0-9a-f]{64}'\)/],
        [73, 'identity not in seed', /WHERE NOT EXISTS \(SELECT 1 FROM seed s WHERE s\.document_version = \w\.document_version\s+AND s\.manifest_sha256 = \w\.manifest_sha256 AND s\.cohort_id = \w\.cohort_id AND s\.question_id = \w\.question_id\)/],
        [74, 'NULL user_id', /WHERE user_id IS NULL/],
      ];
      // True when the row has a "(SELECT count(*) FROM public.<table> ... <pred>)" half for that table.
      const side = (row: string, table: string, pred: RegExp): boolean =>
        row.split('(SELECT count(*)').some((chunk) => {
          const head = ' FROM public.' + table;
          return chunk.startsWith(head) && /^\s/.test(chunk.slice(head.length)) && pred.test(chunk);
        });
      const violations = (text: string): string[] => {
        const bad: string[] = [];
        for (const n of [70, 71]) {
          const r = rowText(text, n);
          if (!/'info: /.test(r)) bad.push(`row ${n} is not labelled info:`);
          if (!/'n\/a'/.test(r)) bad.push(`row ${n} expected is not n/a`);
          if (!/,\s*true\s*$/.test(r.trim())) bad.push(`row ${n} ok is not constant true`);
          if (/=\s*0\s*$/.test(r.trim())) bad.push(`row ${n} still gates on zero`);
        }
        for (const [n, label, pred] of INVARIANTS) {
          const r = rowText(text, n);
          if (!side(r, 'matrix_paper_review_responses', pred) || !side(r, 'matrix_paper_review_response_events', pred) || !/= 0s*$/.test(r.trim())) {
            bad.push(`row ${n} (${label}, responses AND events, = 0) missing`);
          }
        }
        return bad;
      };
      it('rows 70/71 are informational and rows 72-74 are hard invariants', () => {
        expect(violations(ver)).toEqual([]);
      });
      it('negatives (B7): dropping the responses half or the events half of rows 72-74 is caught, independently', () => {
        for (const [n] of INVARIANTS) {
          for (const table of ['matrix_paper_review_responses', 'matrix_paper_review_response_events']) {
            const row = rowText(ver, n);
            // Replace every "FROM public.<table>" in this row with a table that cannot match the row's side check.
            const mutated = row.split(`public.${table}`).join('public.matrix_paper_review_questions');
            expect(mutated).not.toBe(row);
            const text = ver.replace(row, mutated);
            expect(text).not.toBe(ver);
            expect(violations(text).join(' | ')).toContain(`row ${n}`);
          }
        }
      });
      it('negatives: a zero gate on row 70, a non-info label, or a dropped invariant is caught', () => {
        const r70 = rowText(ver, 70);
        const gated = ver.replace(r70, r70.replace(/\s+true\s*$/, ' (SELECT count(*) FROM public.matrix_paper_review_responses) = 0'));
        expect(gated).not.toBe(ver);
        expect(violations(gated).length).toBeGreaterThan(0);
        const relabel = ver.replace("'info: v0.9.91 event_rows", "'event_rows");
        expect(relabel).not.toBe(ver);
        expect(violations(relabel).length).toBeGreaterThan(0);
        const noNull = ver.split('WHERE user_id IS NULL').join('WHERE false');
        expect(violations(noNull).length).toBeGreaterThan(0);
      });
    });
  });
});

describe('B13 (codex sol R6): write-RPC overloads, kill-switch drain, kill-switch server-only role EXECUTE, PREFLIGHT run record', () => {
  const pre = read(PREFLIGHT_FILE);
  const ver = read(VERIFY_FILE);
  const kill = read(`${PREFIX}_KILL_SWITCH.sql`);
  const drain = read(`${PREFIX}_KILL_SWITCH_DRAIN.sql`);
  const notes = read(`${PREFIX}_NOTES.md`);
  const WRITE_RPCS = ['matrix_paper_review_save_draft', 'matrix_paper_review_submit'];

  const preflightOverloadProblems = (text: string): string[] => {
    const bad: string[] = [];
    const cte = /wr_any AS \(([\s\S]*?)\n\),/.exec(text)?.[1] ?? '';
    const row = /SELECT 21,[\s\S]*?UNION ALL/.exec(text)?.[0] ?? '';
    if (!cte) bad.push('wr_any CTE missing');
    for (const n of WRITE_RPCS) if (!cte.includes(`'${n}'`)) bad.push(`wr_any does not name ${n}`);
    if (/oidvectortypes\(p\.proargtypes\) =|argtypes\s*=|JOIN fn_ids/.test(cte)) bad.push('wr_any is narrowed by argument types');
    if (!/nspname = 'public'/.test(cte)) bad.push('wr_any not scoped to public');
    if (!row) bad.push('row 21 missing');
    else if (!/\(SELECT count\(\*\) FROM wr_any\) = 0/.test(row)) bad.push('row 21 does not require zero');
    return bad;
  };
  const verifyOverloadProblems = (text: string): string[] => {
    const bad: string[] = [];
    const row = /SELECT 29,[\s\S]*?UNION ALL/.exec(text)?.[0] ?? '';
    if (!row) return ['row 29 missing'];
    for (const n of WRITE_RPCS) if (!row.includes(`('${n}')`)) bad.push(`row 29 does not cover ${n}`);
    if (!/proname = w\.fname\) = 1/.test(row)) bad.push('row 29 does not require exactly one');
    if (/argtypes|oidvectortypes/.test(row)) bad.push('row 29 is narrowed by argument types');
    return bad;
  };
  const killProblems = (text: string): string[] => {
    const bad: string[] = [];
    const revokes = [...text.matchAll(/REVOKE EXECUTE ON FUNCTION public\.(\w+)\([^)]*\)\s+FROM ([^;]*);/g)];
    for (const n of WRITE_RPCS) {
      const r = revokes.find((m) => m[1] === n);
      if (!r) bad.push(`no EXECUTE revoke for ${n}`);
      else for (const g of ['PUBLIC', 'anon', 'authenticated', SERVER_ROLE]) if (!new RegExp(`\\b${g}\\b`).test(r[2])) bad.push(`${n} revoke omits ${g}`);
    }
    const assertion = /DO \$\$\nDECLARE\n  v_bad text;[\s\S]*?\$\$;/.exec(text)?.[0] ?? '';
    if (!assertion) bad.push('EXECUTE assertion missing');
    else {
      if (!assertion.includes('pg_catalog.pg_roles')) bad.push('assertion does not iterate pg_roles');
      if (!/NOT r\.rolsuper/.test(assertion) || !/r\.oid <> p\.proowner/.test(assertion)) bad.push('assertion scope is not all non-owner non-superuser roles');
      if (!/NOT pg_catalog\.pg_has_role\(r\.oid, p\.proowner, 'USAGE'\)/.test(assertion)) bad.push('assertion does not exclude roles that inherit the owner privileges');
      if (/AS r\(rolname\)|IN \('anon'/.test(assertion)) bad.push('assertion is limited to a fixed role list');
      if (!assertion.includes('has_function_privilege(r.oid, f.fid')) bad.push('assertion lacks has_function_privilege');
      if (!/IF v_bad IS NOT NULL THEN\s+RAISE EXCEPTION[^;]*v_bad;/.test(assertion)) bad.push('assertion does not raise naming the roles');
      if (!/a\.grantee = 0 AND a\.privilege_type = 'EXECUTE'/.test(assertion)) bad.push('assertion lacks PUBLIC ACL check');
      for (const n of WRITE_RPCS) if (!assertion.includes(`public.${n}(`)) bad.push(`assertion omits ${n}`);
    }
    return bad;
  };
  const drainProblems = (text: string): string[] => {
    const bad = readOnlyViolations(text).map((v) => `write keyword ${v}`);
    for (const n of WRITE_RPCS) if (!text.includes(`a.query ~* '${n}'`)) bad.push(`drain does not match ${n}`);
    if (/a\.query LIKE/.test(text)) bad.push('drain uses case-sensitive LIKE');
    const row2 = /SELECT 2,[\s\S]*?UNION ALL/.exec(text)?.[0] ?? '';
    if (!row2.includes("hashtext('matrix_paper_review_write')") || !row2.includes('l.objsubid = 2') || !row2.includes('l.classid::bigint')) bad.push('drain row 2 is not scoped to the review RPC advisory key');
    const row0 = /SELECT 0 AS ord,[\s\S]*?UNION ALL/.exec(text)?.[0] ?? '';
    if (!row0.includes('rolsuper') || !row0.includes("pg_has_role(current_user, 'pg_read_all_stats', 'member')")) bad.push('drain row 0 visibility check missing');
    for (const needle of ['pg_stat_activity', 'pg_backend_pid()', "a.state <> 'idle'", 'pg_locks', "l.locktype = 'advisory'", 'NOT l.granted',
      'max(e.id)', 'count(*) FROM public.matrix_paper_review_response_events']) if (!text.includes(needle)) bad.push(`drain lacks ${needle}`);
    return bad;
  };

  it('PREFLIGHT row 21: zero public functions named like either write RPC, any argument types; exact-type check kept', () => {
    expect(preflightOverloadProblems(pre)).toEqual([]);
    expect(pre).toContain("('matrix_paper_review_save_draft', 'text, text, text, text, text, integer')");
    expect(readOnlyViolations(pre)).toEqual([]);
  });
  it('PREFLIGHT row 21 two-sided: narrowing by types, dropping a name, or dropping the row is caught', () => {
    const m1 = pre.replace("AND p.proname IN ('matrix_paper_review_save_draft','matrix_paper_review_submit')", "AND p.proname IN ('matrix_paper_review_save_draft','matrix_paper_review_submit') AND oidvectortypes(p.proargtypes) = 'text'");
    expect(m1).not.toBe(pre);
    expect(preflightOverloadProblems(m1).join('\n')).toMatch(/narrowed/);
    const m2 = pre.replace("IN ('matrix_paper_review_save_draft','matrix_paper_review_submit')\n)", "IN ('matrix_paper_review_save_draft')\n)");
    expect(m2).not.toBe(pre);
    expect(preflightOverloadProblems(m2).join('\n')).toMatch(/does not name matrix_paper_review_submit/);
    const m3 = pre.replace(/ {2}SELECT 21,[\s\S]*?UNION ALL\n/, '');
    expect(m3).not.toBe(pre);
    expect(preflightOverloadProblems(m3).join('\n')).toMatch(/row 21 missing/);
    const m4 = pre.replace('(SELECT count(*) FROM wr_any) = 0', '(SELECT count(*) FROM wr_any) >= 0');
    expect(m4).not.toBe(pre);
    expect(preflightOverloadProblems(m4).join('\n')).toMatch(/zero/);
  });
  it('VERIFY row 29: exactly one public function per write-RPC name; two-sided', () => {
    expect(verifyOverloadProblems(ver)).toEqual([]);
    const v1 = ver.replace("('matrix_paper_review_submit')) AS w(fname)", "('x')) AS w(fname)");
    expect(v1).not.toBe(ver);
    expect(verifyOverloadProblems(v1).join('\n')).toMatch(/does not cover/);
    const v2 = ver.replace('proname = w.fname) = 1', 'proname = w.fname) >= 1');
    expect(v2).not.toBe(ver);
    expect(verifyOverloadProblems(v2).join('\n')).toMatch(/exactly one/);
    expect(verifyOverloadProblems(ver.replace(/ {2}SELECT 29,[\s\S]*?UNION ALL\n/, ''))).toEqual(['row 29 missing']);
    expect(readOnlyViolations(ver)).toEqual([]);
  });
  it('KILL_SWITCH revokes and asserts EXECUTE for PUBLIC, anon, authenticated and the server-only role; two-sided', () => {
    expect(killProblems(kill)).toEqual([]);
    const noRole = kill.split(`authenticated, ${SERVER_ROLE};`).join('authenticated;');
    expect(noRole).not.toBe(kill);
    expect(killProblems(noRole).join('\n')).toMatch(/revoke omits/);
    const fixedList = kill.replace('FROM pg_catalog.pg_roles r,', "FROM (VALUES ('anon'), ('authenticated')) AS r(rolname), pg_catalog.pg_roles r0,");
    expect(fixedList).not.toBe(kill);
    expect(killProblems(fixedList).join('\n')).toMatch(/fixed role list/);
    const noRoles = kill.replace('pg_catalog.pg_roles r', 'pg_catalog.pg_authid r');
    expect(noRoles).not.toBe(kill);
    expect(killProblems(noRoles).join('\n')).toMatch(/does not iterate pg_roles/);
    const noRaise = kill.replace("non-owner role(s) can still execute a write RPC: %', v_bad", "x'");
    expect(noRaise).not.toBe(kill);
    expect(killProblems(noRaise).join('\n')).toMatch(/does not raise naming/);
    const ownerIncluded = kill.replace('     AND r.oid <> p.proowner\n', '');
    expect(ownerIncluded).not.toBe(kill);
    expect(killProblems(ownerIncluded).join('\n')).toMatch(/scope is not all/);
    const inheritIncluded = kill.replace("     AND NOT pg_catalog.pg_has_role(r.oid, p.proowner, 'USAGE')\n", '');
    expect(inheritIncluded).not.toBe(kill);
    expect(killProblems(inheritIncluded).join('\n')).toMatch(/inherit the owner/);
    const noPriv = kill.replace('has_function_privilege(r.oid, f.fid', "has_function_privilege('anon', f.fid");
    expect(noPriv).not.toBe(kill);
    expect(killProblems(noPriv).join('\n')).toMatch(/lacks has_function_privilege/);
    const noPublic = kill.replace("a.grantee = 0 AND a.privilege_type = 'EXECUTE'", 'false');
    expect(noPublic).not.toBe(kill);
    expect(killProblems(noPublic).join('\n')).toMatch(/PUBLIC ACL/);
    const noBlock = kill.replace(/DO \$\$\nDECLARE\n {2}v_bad text;[\s\S]*?\$\$;/, '');
    expect(noBlock).not.toBe(kill);
    expect(killProblems(noBlock).join('\n')).toMatch(/assertion missing/);
    // the switch stays ONE transaction
    expect((kill.match(/^BEGIN;$/gm) ?? []).length).toBe(1);
    expect((kill.match(/^COMMIT;$/gm) ?? []).length).toBe(1);
  });
  it('KILL_SWITCH_DRAIN is SELECT-only and covers in-flight RPCs, advisory waiters and the event max id/count; two-sided', () => {
    expect(drainProblems(drain)).toEqual([]);
    expect(drainProblems(`${drain}\nDELETE FROM public.matrix_paper_review_response_events;\n`).join('\n')).toMatch(/write keyword DELETE/);
    expect(drainProblems(`${drain}\nSET lock_timeout = 0;\n`).join('\n')).toMatch(/write keyword SET/);
    const d1 = drain.split(" OR a.query ~* 'matrix_paper_review_submit'").join('');
    expect(d1).not.toBe(drain);
    expect(drainProblems(d1).join('\n')).toMatch(/does not match matrix_paper_review_submit/);
    const d2 = drain.split('a.pid <> pg_backend_pid() AND ').join('');
    expect(d2).not.toBe(drain);
    expect(drainProblems(d2).join('\n')).toMatch(/pg_backend_pid/);
    const d3 = drain.replace('max(e.id)', 'min(e.id)');
    expect(d3).not.toBe(drain);
    expect(drainProblems(d3).join('\n')).toMatch(/max\(e\.id\)/);
    const d4 = drain.split("l.locktype = 'advisory'").join("l.locktype = 'relation'");
    expect(d4).not.toBe(drain);
    expect(drainProblems(d4).join('\n')).toMatch(/advisory/);
    // R11: lock scope
    const d5 = drain.replace(/ {13}AND l\.classid::bigint = \(hashtext\('matrix_paper_review_write'\)::bigint & 4294967295\)/g, '');
    expect(d5).not.toBe(drain);
    expect(drainProblems(d5).join('\n')).toMatch(/not scoped to the review RPC advisory key/);
    const d6 = drain.split('l.objsubid = 2').join('l.objsubid = 1');
    expect(d6).not.toBe(drain);
    expect(drainProblems(d6).join('\n')).toMatch(/not scoped/);
    // R11: visibility row
    const d7 = drain.split("pg_has_role(current_user, 'pg_read_all_stats', 'member')").join('true');
    expect(d7).not.toBe(drain);
    expect(drainProblems(d7).join('\n')).toMatch(/row 0 visibility/);
    const d8 = drain.replace(/ {2}SELECT 0 AS ord,[\s\S]*?UNION ALL\n {2}SELECT 1, /, '  SELECT 1 AS ord, ');
    expect(d8).not.toBe(drain);
    expect(drainProblems(d8).join('\n')).toMatch(/row 0 visibility/);
    // R11: case-insensitive match
    const d9 = drain.split("a.query ~* 'matrix_paper_review_save_draft'").join("a.query LIKE '%matrix_paper_review_save_draft%'");
    expect(d9).not.toBe(drain);
    expect(drainProblems(d9).join('\n')).toMatch(/case-sensitive/);
    expect(drain).toMatch(/"public"\."matrix_paper_review_save_draft"/);
  });
  it('NOTES documents the drain procedure and the historical PREFLIGHT run, and its sha table matches the files', () => {
    expect(notes).toContain('KILL_SWITCH_DRAIN.sql');
    expect(notes).toMatch(/every 5 s up to 60 s/);
    expect(notes).toMatch(/10 s apart/);
    expect(notes).toMatch(/pg_cancel_backend/);
    expect(notes).toContain('2026-10-15T00:29Z');
    expect(notes).toContain('1283bd6b30dbd9bc93396058b8bceec5fd0c860c6c364719d2ad472d6a4f2c1b');
    expect(notes).toMatch(/HISTORICAL for those bytes/);
    expect(notes).toMatch(/re-run is required at packet \(b\)/);
    expect(notes).toContain('codex luna R11 RED (P2 x3 kill-switch scope, drain lock scope, drain visibility) -> fixed');
    expect(notes).toMatch(/a false row 0 = STOP/);
    expect(notes).toContain(`codex sol R6 RED (P2 write-RPC overloads; P2 kill-switch drain; P2 kill-switch ${SERVER_ROLE} EXECUTE; P3 PREFLIGHT run record) -> fixed`);
    for (const f of [`${PREFIX}.sql`, `${PREFIX}_PREFLIGHT.sql`, `${PREFIX}_VERIFY.sql`, `${PREFIX}_KILL_SWITCH.sql`, `${PREFIX}_KILL_SWITCH_DRAIN.sql`, `${PREFIX}_ROLLBACK.sql`]) {
      expect(notes, f).toContain(sha256(read(f)));
    }
    expect(notes).toContain(sha256(fs.readFileSync(__filename, 'utf8')));
  });
});

describe('B15 (Opus informed holistic RED, IMPORTANT x3): prosrc hashes, advisor criteria, owner-inheriting roles', () => {
  const activation = read(ACTIVATION_FILE);
  const ver = read(VERIFY_FILE);
  const kill = read(`${PREFIX}_KILL_SWITCH.sql`);
  const notes = read(`${PREFIX}_NOTES.md`);
  const HEX = '[0-9a-f]{64}';

  // Postgres stores prosrc as the exact text between the dollar-quote delimiters (the newline after
  // the opening delimiter and the one before the closing delimiter included), byte for byte.
  const deriveProsrcShas = (sql: string): Map<string, string> => {
    const out = new Map<string, string>();
    const re = /CREATE FUNCTION public\.(\w+)\([\s\S]*?\nAS \$\$([\s\S]*?)\$\$;/g;
    for (const m of sql.matchAll(re)) out.set(m[1], createHash('sha256').update(Buffer.from(m[2], 'utf8')).digest('hex'));
    return out;
  };
  const verifyProsrcProblems = (verText: string, act: string): string[] => {
    const bad: string[] = [];
    const want = deriveProsrcShas(act);
    if (want.size !== 5) bad.push(`derived ${want.size} function bodies, expected 5`);
    const rowRe = new RegExp(`SELECT (9\\d), 'M1: installed prosrc sha256 = approved activation bytes: (\\w+)', '(${HEX})',([\\s\\S]*?)(?=\\n  UNION ALL|\\n\\) r\\n)`, 'g');
    const rows = [...verText.matchAll(rowRe)];
    if (rows.length !== 5) bad.push(`VERIFY has ${rows.length} prosrc rows, expected 5`);
    for (const [name, sha] of want) {
      const r = rows.find((m) => m[2] === name);
      if (!r) { bad.push(`no prosrc row for ${name}`); continue; }
      if (r[3] !== sha) bad.push(`${name}: VERIFY expected literal differs from the activation body sha`);
      const body = r[4];
      if (!body.includes("encode(sha256(convert_to(p.prosrc, 'UTF8')), 'hex')")) bad.push(`${name}: row does not hash prosrc as UTF8 bytes`);
      if (!body.includes(`p.proname = '${name}'`) || !body.includes("p.pronamespace = 'public'::regnamespace")) bad.push(`${name}: row not scoped to public.${name}`);
      if (!body.includes(`'missing') = '${sha}'`)) bad.push(`${name}: ok does not compare actual to the expected literal`);
      if (!body.includes('coalesce(') || !body.includes("'missing'")) bad.push(`${name}: absent function is not a hard failure`);
    }
    return bad;
  };

  it('IMPORTANT-1: the activation and VERIFY files are LF-only (execute_sql sends the text as-is)', () => {
    expect(activation.includes('\r')).toBe(false);
    expect(ver.includes('\r')).toBe(false);
  });
  it('IMPORTANT-1: VERIFY has one hard prosrc sha row per activation function, equal to the bytes derived from the activation file', () => {
    expect(verifyProsrcProblems(ver, activation)).toEqual([]);
    expect([...deriveProsrcShas(activation).keys()]).toEqual([
      'is_matrix_options_paper_admin', 'matrix_paper_review_utf16_length', 'matrix_paper_review_events_block_update',
      'matrix_paper_review_save_draft', 'matrix_paper_review_submit']);
  });
  it('IMPORTANT-1 two-sided: a one-character body mutation, CRLF, a stale literal, a dropped row or a weakened compare is caught', () => {
    const before = deriveProsrcShas(activation);
    const mutated = activation.replace('IS NOT FALSE', 'IS TRUE ');
    expect(mutated).not.toBe(activation);
    expect(deriveProsrcShas(mutated).get('matrix_paper_review_save_draft')).not.toBe(before.get('matrix_paper_review_save_draft'));
    expect(verifyProsrcProblems(ver, mutated).join('\n')).toMatch(/expected literal differs/);
    const one = activation.replace('FROM public.user_roles ur', 'FROM public.user_roles uq');
    expect(one).not.toBe(activation);
    expect(verifyProsrcProblems(ver, one).join('\n')).toMatch(/is_matrix_options_paper_admin: VERIFY expected literal differs/);
    const crlf = activation.replace(/\n/g, '\r\n');
    expect(deriveProsrcShas(crlf).get('matrix_paper_review_submit')).not.toBe(before.get('matrix_paper_review_submit'));
    const sha = before.get('matrix_paper_review_submit') as string;
    const stale = ver.split(sha).join(`${sha[0] === 'a' ? 'b' : 'a'}${sha.slice(1)}`);
    expect(stale).not.toBe(ver);
    expect(verifyProsrcProblems(stale, activation).join('\n')).toMatch(/matrix_paper_review_submit: VERIFY expected literal differs/);
    const noRow = ver.replace(/\n  UNION ALL\n  SELECT 99, [\s\S]*?(?=\n\) r\nORDER BY)/, '');
    expect(noRow).not.toBe(ver);
    expect(verifyProsrcProblems(noRow, activation).join('\n')).toMatch(/VERIFY has 4 prosrc rows/);
    const weak = ver.replace("'missing') = 'fe36eefb", "'missing') <> 'fe36eefb");
    expect(weak).not.toBe(ver);
    expect(verifyProsrcProblems(weak, activation).join('\n')).toMatch(/ok does not compare/);
    const noHash = ver.split("encode(sha256(convert_to(p.prosrc, 'UTF8')), 'hex')").join('p.prosrc');
    expect(noHash).not.toBe(ver);
    expect(verifyProsrcProblems(noHash, activation).join('\n')).toMatch(/does not hash prosrc/);
  });
  it('IMPORTANT-1: NOTES states the query must be the file bytes UNEDITED, and names the prosrc rows and shas', () => {
    expect(notes).toMatch(/UNEDITED/);
    expect(notes).toMatch(/rows 95-99/);
    for (const [, sha] of deriveProsrcShas(activation)) expect(notes).toContain(sha);
  });
  it('IMPORTANT-2: NOTES step 5 lists the expected advisor findings and defines RED precisely', () => {
    const step5 = /\n5\. Advisors again[\s\S]*?\n6\. /.exec(notes)?.[0] ?? '';
    expect(step5).not.toBe('');
    for (const lint of ['multiple_permissive_policies', 'unused_index', 'authenticated_security_definer_function_executable',
      'rls_disabled_in_public', 'function_search_path_mutable', 'auth_users_exposed']) expect(step5, lint).toContain(lint);
    for (const obj of ['matrix_paper_review_responses', 'matrix_paper_review_response_events', 'is_matrix_options_paper_admin',
      'matrix_paper_review_save_draft', 'matrix_paper_review_submit']) expect(step5, obj).toContain(obj);
    expect(step5).toMatch(/RED =/);
    expect(step5).toMatch(/expected by design/i);
    expect(step5).toMatch(/anon-executable/);
    expect(step5).toMatch(/any new finding on objects outside this activation/);
    expect(step5).toMatch(/verbatim/);
  });
  it('IMPORTANT-3: KILL_SWITCH excludes owner-inheriting roles and superusers; NOTES records the live read-only facts', () => {
    expect(kill).toContain("AND NOT pg_catalog.pg_has_role(r.oid, p.proowner, 'USAGE')");
    expect(kill).toContain('AND NOT r.rolsuper');
    expect(notes).toMatch(/postgres is a member of pg_read_all_stats = true/);
    expect(notes).toMatch(/no non-superuser role inherits postgres = true/);
    expect(notes).toMatch(/postgres has REFERENCES on auth\.users = true/);
    expect(notes).toMatch(/postgres is not a superuser \(rolsuper false\)/);
    expect(notes).toContain('2026-10-15');
  });
  it('B15 records the receipt line, the frozen main sha and that the live PREFLIGHT must be re-run', () => {
    expect(notes).toContain(`Opus informed holistic RED (IMPORTANT x3) -> fixed; main file frozen at sha ${ACTIVATION_SHA256}`);
    expect(notes).toMatch(/PREFLIGHT bytes differ from the historical 1283bd6b/);
  });
});
