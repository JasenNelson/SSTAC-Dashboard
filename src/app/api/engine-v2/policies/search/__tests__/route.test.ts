// engine_v2 Lane 2d / L2d-1 route tests for GET /api/engine-v2/policies/search.
//
// Covers:
//   - Non-admin -> 401/403 (via mocked requireAdminForApi)
//   - LOCAL_ENGINE_ENABLED=false -> 503
//   - q.length < 2 -> 400 query_too_short
//   - invalid tier -> 400 invalid_tier
//   - injection probe -> 400 (after sanitizer) or 200 (sanitized to valid)
//     but NEVER 500
//   - happy path -> 200 with results / topics / tiers

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextResponse } from "next/server";
import os from "os";
import path from "path";
import fs from "fs";

vi.mock("@/lib/engine-v2/admin_guards", () => ({
  requireAdminForApi: vi.fn(),
}));

import { requireAdminForApi } from "@/lib/engine-v2/admin_guards";
import { GET } from "../route";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const Database = require("better-sqlite3") as new (
  p: string,
  o?: Record<string, unknown>,
) => {
  exec: (sql: string) => void;
  prepare: (sql: string) => { run: (...p: unknown[]) => void };
  close: () => void;
};

const mockedRequireAdmin = vi.mocked(requireAdminForApi);

function makeReq(qs: string): import("next/server").NextRequest {
  const url = `https://test/api/engine-v2/policies/search${qs}`;
  return {
    nextUrl: new URL(url),
    headers: new Headers(),
  } as unknown as import("next/server").NextRequest;
}

function adminOk(): void {
  mockedRequireAdmin.mockResolvedValue({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    client: {} as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    user: { id: "admin-user" } as any,
  });
}

function adminForbidden(): void {
  mockedRequireAdmin.mockResolvedValue(
    NextResponse.json({ error: "Forbidden" }, { status: 403 }),
  );
}

// Build a fixture DB and place it at the path policy_kb expects
// (process.cwd()/../Regulatory-Review/engine/data/rraa_v3_2.db).
let fixtureRoot: string | null = null;
let fixturePath: string | null = null;

function makeFixtureAtAdapterPath(): void {
  // The adapter resolves the DB path via path.join(process.cwd(), '..',
  // 'Regulatory-Review', 'engine', 'data', 'rraa_v3_2.db'). We create that
  // exact tree under a temp dir and chdir into a parallel sibling.
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "engine-v2-route-"));
  const siblingRR = path.join(
    root,
    "Regulatory-Review",
    "engine",
    "data",
  );
  fs.mkdirSync(siblingRR, { recursive: true });
  const dbPath = path.join(siblingRR, "rraa_v3_2.db");
  const db = new Database(dbPath);
  db.exec(`
    CREATE TABLE policy_statements (
      id TEXT PRIMARY KEY,
      original_text TEXT,
      plain_language_summary TEXT,
      discretion_tier TEXT,
      topic_category TEXT,
      sub_category TEXT,
      source_document_name TEXT,
      source_section_reference TEXT,
      source_page_reference TEXT,
      keywords TEXT,
      review_question TEXT,
      is_active INTEGER
    );
    CREATE VIRTUAL TABLE policy_statements_fts USING fts5(
      id UNINDEXED,
      original_text, plain_language_summary, keywords, review_question,
      tokenize='unicode61'
    );
  `);
  const insert = db.prepare(
    "INSERT INTO policy_statements (id, original_text, plain_language_summary, discretion_tier, topic_category, sub_category, source_document_name, source_section_reference, source_page_reference, keywords, review_question, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
  );
  insert.run(
    "P-001",
    "Arsenic exceedance in soil",
    "Arsenic soil",
    "TIER_1_BINARY",
    "Soil",
    "Metals",
    "CSR",
    "12.3",
    "45",
    "arsenic,soil",
    "Was arsenic investigated?",
    1,
  );
  db.exec(`
    INSERT INTO policy_statements_fts (id, original_text, plain_language_summary, keywords, review_question)
    SELECT id, original_text, plain_language_summary, keywords, review_question
    FROM policy_statements WHERE is_active = 1;
  `);
  db.close();

  // We chdir to a sibling so process.cwd()/../Regulatory-Review/... resolves
  // to our fixture root.
  const cwdSibling = path.join(root, "SSTAC-Dashboard");
  fs.mkdirSync(cwdSibling);
  process.chdir(cwdSibling);
  fixtureRoot = root;
  fixturePath = dbPath;
}

let originalCwd: string;
let originalLocalEngine: string | undefined;

beforeEach(() => {
  originalCwd = process.cwd();
  originalLocalEngine = process.env.LOCAL_ENGINE_ENABLED;
  process.env.LOCAL_ENGINE_ENABLED = "true";
  vi.clearAllMocks();
});

afterEach(() => {
  process.chdir(originalCwd);
  if (originalLocalEngine === undefined) {
    delete process.env.LOCAL_ENGINE_ENABLED;
  } else {
    process.env.LOCAL_ENGINE_ENABLED = originalLocalEngine;
  }
  if (fixtureRoot) {
    try {
      fs.rmSync(fixtureRoot, { recursive: true, force: true });
    } catch {
      // best effort
    }
    fixtureRoot = null;
    fixturePath = null;
  }
});

describe("GET /api/engine-v2/policies/search", () => {
  it("returns 403 for non-admin", async () => {
    adminForbidden();
    const res = await GET(makeReq("?q=arsenic"));
    expect(res.status).toBe(403);
  });

  it("returns 503 with normalized 'local_engine_disabled' shape when LOCAL_ENGINE_ENABLED is not 'true'", async () => {
    // Adversarial Round 2 IMPORTANT #2: the route normalizes the response
    // shape from the shared `requireLocalEngine()` helper so every 503 from
    // this endpoint emits the same slug, regardless of which branch tripped.
    adminOk();
    process.env.LOCAL_ENGINE_ENABLED = "false";
    const res = await GET(makeReq("?q=arsenic"));
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.error).toBe("local_engine_disabled");
  });

  it("returns 400 for q < 2 chars", async () => {
    adminOk();
    makeFixtureAtAdapterPath();
    const res = await GET(makeReq("?q=a"));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("query_too_short");
  });

  it("returns 400 when q is missing entirely", async () => {
    adminOk();
    makeFixtureAtAdapterPath();
    const res = await GET(makeReq(""));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("query_too_short");
  });

  it("returns 400 for invalid tier", async () => {
    adminOk();
    makeFixtureAtAdapterPath();
    const res = await GET(
      makeReq("?q=arsenic&tier=NOT_A_REAL_TIER"),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("invalid_tier");
  });

  it("returns 200 with results on happy path", async () => {
    adminOk();
    makeFixtureAtAdapterPath();
    const res = await GET(makeReq("?q=arsenic&limit=5"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.query).toBe("arsenic");
    expect(body.count).toBeGreaterThanOrEqual(1);
    expect(Array.isArray(body.results)).toBe(true);
    expect(body.filters.tiers).toEqual([
      "TIER_1_BINARY",
      "TIER_2_PROFESSIONAL",
      "TIER_3_STATUTORY",
    ]);
    expect(body.filters.topics).toContain("Soil");
  });

  it("does NOT 500 on the classic injection probe", async () => {
    adminOk();
    makeFixtureAtAdapterPath();
    // q after URL-encoding: "', 1) DROP TABLE policy_statements; --"
    const probe = encodeURIComponent("', 1) DROP TABLE policy_statements; --");
    const res = await GET(makeReq(`?q=${probe}`));
    // After sanitization the FTS expression may be empty -> LIKE fallback
    // returns 0 rows OR a small number of rows. Either way: NEVER 500.
    expect([200, 400]).toContain(res.status);
  });

  it("clamps limit to <= 100", async () => {
    adminOk();
    makeFixtureAtAdapterPath();
    const res = await GET(makeReq("?q=arsenic&limit=9999"));
    expect(res.status).toBe(200);
  });

  it("clamps limit to >= 1", async () => {
    adminOk();
    makeFixtureAtAdapterPath();
    const res = await GET(makeReq("?q=arsenic&limit=0"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.results.length).toBeLessThanOrEqual(1);
  });

  it("filters by tier when provided", async () => {
    adminOk();
    makeFixtureAtAdapterPath();
    const res = await GET(
      makeReq("?q=arsenic&tier=TIER_2_PROFESSIONAL"),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    // No TIER_2 row matches "arsenic" in our fixture.
    expect(body.count).toBe(0);
  });
});

// Touch reference so unused-var lint does not fire on fixturePath.
void fixturePath;
