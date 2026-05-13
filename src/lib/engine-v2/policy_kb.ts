// engine_v2 frontend Lane 2d / Module L2d-1: Policy KB adapter.
//
// Single shared read-only adapter over `engine/data/rraa_v3_2.db` (the
// canonical RRAA knowledge base; ~5,968 policies). Replaces the duplicated
// FTS5 SQL that previously lived inside both the v1 search route and the v1
// chat route. Lane 2d's search + (future) chat retrieval both call this
// adapter.
//
// Connection management:
//   - Each call opens a NEW readonly connection, runs the query, and ALWAYS
//     closes it in a `finally` block. No long-lived handles; matches the v1
//     route pattern.
//   - The engine DB lives in a sibling repo
//     (`C:\Projects\Regulatory-Review\engine\data\rraa_v3_2.db`). The path is
//     built once via `path.join` (ED-2d-12 codex pre-emption: NOT string
//     concatenation) and lives in this module so the brittleness is
//     centralized.
//   - `better-sqlite3` is loaded via dynamic require so that the bundle still
//     builds (Vercel) when the native binding is absent; route handlers are
//     also `requireLocalEngine`-guarded so the adapter is never reached when
//     `LOCAL_ENGINE_ENABLED !== 'true'`.
//
// Query strategy:
//   - searchPolicies tries FTS5 first using `buildFtsQuery`. If the sanitizer
//     returns null (no usable tokens), or if the FTS prepare/execute throws
//     (table absent, malformed FTS expression after a hypothetical sanitizer
//     regression), the adapter transparently falls back to a LIKE search.
//   - LIKE patterns use the escape helper so reviewer punctuation does not
//     become a wildcard.
//
// Filter values:
//   - `tier` and `topic` are validated against closed enums in the ROUTE,
//     not here. The adapter receives already-validated strings (or undefined
//     /'all') and parameter-binds them.

import path from "path";
import { buildFtsQuery, escapeLikePattern } from "./fts5_query";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type BetterSqlite3Module = any;

let cachedDriver: BetterSqlite3Module | null = null;
let driverLoadAttempted = false;

// Lazy-at-first-call: `loadDriver` is invoked only from `searchPolicies` /
// `getPolicyById` (and `isDriverAvailable`), NOT at module import. This means
// the Vercel route-tree import (which bundles every route's module graph but
// does not execute their handlers) does NOT trigger the better-sqlite3
// native binding. The route-level `requireLocalEngine` guard short-circuits
// long before this driver is touched in cloud builds.
function loadDriver(): BetterSqlite3Module | null {
  if (driverLoadAttempted) return cachedDriver;
  driverLoadAttempted = true;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    cachedDriver = require("better-sqlite3") as BetterSqlite3Module;
  } catch {
    cachedDriver = null;
  }
  return cachedDriver;
}

// Centralized engine DB path. Computed lazily (NOT at module load) so that
// process.cwd() reflects the request-time working directory rather than the
// import-time one. Mirrors v1 `search/route.ts:25` semantics.
export function getDefaultDbPath(): string {
  return path.join(
    process.cwd(),
    "..",
    "Regulatory-Review",
    "engine",
    "data",
    "rraa_v3_2.db",
  );
}

// Note: there is intentionally NO eager `export const RRAA_DB_PATH` here.
// An earlier draft exported one; adversarial Round 2 flagged it as dead code
// (no L2d-1 caller imported it; v1 routes have their own local const of the
// same name in their own files). All callers in this module go through
// `getDefaultDbPath()` so the path resolves at request time.

export const POLICY_TIERS = [
  "TIER_1_BINARY",
  "TIER_2_PROFESSIONAL",
  "TIER_3_STATUTORY",
] as const;
export type PolicyTier = (typeof POLICY_TIERS)[number];

export interface PolicySearchRow {
  id: string;
  originalText: string | null;
  plainLanguage: string | null;
  discretionTier: string | null;
  topicCategory: string | null;
  subCategory: string | null;
  sourceDocument: string | null;
  sourceSection: string | null;
  sourcePage: string | null;
  keywords: string | null;
  reviewQuestion: string | null;
  matchExplanation: string | null;
}

export interface PolicyRow extends PolicySearchRow {
  // Reserved for future fields (Lane 2e per-policy detail).
  isActive: number | null;
}

export interface SearchPoliciesOptions {
  tier?: string | null;
  topic?: string | null;
  limit?: number;
  dbPathOverride?: string;
}

export interface SearchPoliciesResult {
  rows: PolicySearchRow[];
  topics: string[];
  usedFallback: boolean;
}

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;
const MIN_LIMIT = 1;

function clampLimit(raw: number | undefined): number {
  if (typeof raw !== "number" || !Number.isFinite(raw)) return DEFAULT_LIMIT;
  const intVal = Math.floor(raw);
  if (intVal < MIN_LIMIT) return MIN_LIMIT;
  if (intVal > MAX_LIMIT) return MAX_LIMIT;
  return intVal;
}

const FTS_SQL_BASE = `
  SELECT
    p.id,
    p.original_text as originalText,
    p.plain_language_summary as plainLanguage,
    p.discretion_tier as discretionTier,
    p.topic_category as topicCategory,
    p.sub_category as subCategory,
    p.source_document_name as sourceDocument,
    p.source_section_reference as sourceSection,
    p.source_page_reference as sourcePage,
    p.keywords as keywords,
    p.review_question as reviewQuestion,
    CASE
      WHEN rank < -10 THEN 'High'
      WHEN rank < -2 THEN 'Medium'
      ELSE 'Low'
    END as matchExplanation
  FROM policy_statements p
  INNER JOIN policy_statements_fts fts ON p.id = fts.id
  WHERE policy_statements_fts MATCH ?
    AND p.is_active = 1
`;

const LIKE_SQL_BASE = `
  SELECT
    id,
    original_text as originalText,
    plain_language_summary as plainLanguage,
    discretion_tier as discretionTier,
    topic_category as topicCategory,
    sub_category as subCategory,
    source_document_name as sourceDocument,
    source_section_reference as sourceSection,
    source_page_reference as sourcePage,
    keywords as keywords,
    review_question as reviewQuestion,
    NULL as matchExplanation
  FROM policy_statements
  WHERE is_active = 1
    AND (
      original_text LIKE ? ESCAPE '\\'
      OR plain_language_summary LIKE ? ESCAPE '\\'
      OR keywords LIKE ? ESCAPE '\\'
      OR review_question LIKE ? ESCAPE '\\'
    )
`;

const TOPICS_SQL = `
  SELECT DISTINCT topic_category
  FROM policy_statements
  WHERE topic_category IS NOT NULL AND is_active = 1
  ORDER BY topic_category
`;

function runFtsQuery(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  ftsExpr: string,
  tier: string | null,
  topic: string | null,
  limit: number,
): PolicySearchRow[] {
  let sql = FTS_SQL_BASE;
  const params: (string | number)[] = [ftsExpr];
  if (tier && tier !== "all") {
    sql += " AND p.discretion_tier = ?";
    params.push(tier);
  }
  if (topic && topic !== "all") {
    sql += " AND p.topic_category = ?";
    params.push(topic);
  }
  sql += " ORDER BY rank LIMIT ?";
  params.push(limit);
  return db.prepare(sql).all(...params) as PolicySearchRow[];
}

function runLikeQuery(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  rawQuery: string,
  tier: string | null,
  topic: string | null,
  limit: number,
): PolicySearchRow[] {
  const likePattern = `%${escapeLikePattern(rawQuery)}%`;
  let sql = LIKE_SQL_BASE;
  const params: (string | number)[] = [
    likePattern,
    likePattern,
    likePattern,
    likePattern,
  ];
  if (tier && tier !== "all") {
    sql += " AND discretion_tier = ?";
    params.push(tier);
  }
  if (topic && topic !== "all") {
    sql += " AND topic_category = ?";
    params.push(topic);
  }
  sql += " LIMIT ?";
  params.push(limit);
  return db.prepare(sql).all(...params) as PolicySearchRow[];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function fetchTopics(db: any): string[] {
  const rows = db.prepare(TOPICS_SQL).all() as { topic_category: string }[];
  return rows
    .map((r) => r.topic_category)
    .filter((t): t is string => typeof t === "string" && t.length > 0);
}

export function isDriverAvailable(): boolean {
  return loadDriver() !== null;
}

export function searchPolicies(
  rawQuery: string,
  options: SearchPoliciesOptions = {},
): SearchPoliciesResult {
  const Database = loadDriver();
  if (!Database) {
    throw new Error("better-sqlite3 not available in this runtime");
  }

  const dbPath = options.dbPathOverride ?? getDefaultDbPath();
  const limit = clampLimit(options.limit);
  const tier = options.tier ?? null;
  const topic = options.topic ?? null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let db: any = null;
  try {
    db = new Database(dbPath, { readonly: true });

    const ftsExpr = buildFtsQuery(rawQuery);
    let rows: PolicySearchRow[] = [];
    let usedFallback = false;

    if (ftsExpr !== null) {
      try {
        rows = runFtsQuery(db, ftsExpr, tier, topic, limit);
      } catch (ftsErr) {
        // FTS table missing or malformed expression. Fall back to LIKE so the
        // call still returns something useful (matches v1 behavior).
        console.warn(
          `[engine-v2 policy_kb] FTS5 query failed, falling back to LIKE: ${String(ftsErr)}`,
        );
        rows = runLikeQuery(db, rawQuery, tier, topic, limit);
        usedFallback = true;
      }
    } else {
      rows = runLikeQuery(db, rawQuery, tier, topic, limit);
      usedFallback = true;
    }

    const topics = fetchTopics(db);
    return { rows, topics, usedFallback };
  } finally {
    if (db) {
      try {
        db.close();
      } catch {
        // best effort
      }
    }
  }
}

export interface GetPolicyByIdOptions {
  dbPathOverride?: string;
}

const POLICY_BY_ID_SQL = `
  SELECT
    id,
    original_text as originalText,
    plain_language_summary as plainLanguage,
    discretion_tier as discretionTier,
    topic_category as topicCategory,
    sub_category as subCategory,
    source_document_name as sourceDocument,
    source_section_reference as sourceSection,
    source_page_reference as sourcePage,
    keywords as keywords,
    review_question as reviewQuestion,
    NULL as matchExplanation,
    is_active as isActive
  FROM policy_statements
  WHERE id = ?
  LIMIT 1
`;

export function getPolicyById(
  policyId: string,
  options: GetPolicyByIdOptions = {},
): PolicyRow | null {
  const Database = loadDriver();
  if (!Database) {
    throw new Error("better-sqlite3 not available in this runtime");
  }
  const dbPath = options.dbPathOverride ?? getDefaultDbPath();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let db: any = null;
  try {
    db = new Database(dbPath, { readonly: true });
    const row = db.prepare(POLICY_BY_ID_SQL).get(policyId) as
      | PolicyRow
      | undefined;
    return row ?? null;
  } finally {
    if (db) {
      try {
        db.close();
      } catch {
        // best effort
      }
    }
  }
}
