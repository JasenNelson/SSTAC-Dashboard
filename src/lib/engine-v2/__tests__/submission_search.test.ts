// engine_v2 Lane 2d / Phase B tests for submission_search shared lib.

import { describe, it, expect } from "vitest";
import {
  buildSubmissionSearchQuery,
  clampSubmissionSearchLimit,
  renderSnippet,
  renderSnippetJs,
  SUBMISSION_SEARCH_LIMIT_DEFAULT,
  SUBMISSION_SEARCH_LIMIT_MIN,
  SUBMISSION_SEARCH_LIMIT_MAX,
  SUBMISSION_SEARCH_HEADLINE_OPTIONS,
} from "../submission_search";

const EVAL_ID = "11111111-2222-3333-4444-555555555555";

describe("clampSubmissionSearchLimit", () => {
  it("returns DEFAULT for non-numeric or missing input", () => {
    expect(clampSubmissionSearchLimit(undefined)).toBe(
      SUBMISSION_SEARCH_LIMIT_DEFAULT,
    );
    expect(clampSubmissionSearchLimit(null)).toBe(
      SUBMISSION_SEARCH_LIMIT_DEFAULT,
    );
    expect(clampSubmissionSearchLimit("abc")).toBe(
      SUBMISSION_SEARCH_LIMIT_DEFAULT,
    );
  });

  it("clamps below MIN", () => {
    expect(clampSubmissionSearchLimit(-5)).toBe(SUBMISSION_SEARCH_LIMIT_MIN);
    expect(clampSubmissionSearchLimit(0)).toBe(SUBMISSION_SEARCH_LIMIT_MIN);
  });

  it("clamps above MAX", () => {
    expect(clampSubmissionSearchLimit(9999)).toBe(SUBMISSION_SEARCH_LIMIT_MAX);
  });

  it("parses string-int inputs", () => {
    expect(clampSubmissionSearchLimit("25")).toBe(25);
  });

  it("floors fractional inputs", () => {
    expect(clampSubmissionSearchLimit(15.9)).toBe(15);
  });
});

describe("buildSubmissionSearchQuery", () => {
  it("emits a parameterized SELECT with $1=q, $2=evaluation_id, $3=limit", () => {
    const { sql, params } = buildSubmissionSearchQuery("traditional foods", {
      evaluationId: EVAL_ID,
      limit: 25,
    });
    expect(params).toEqual(["traditional foods", EVAL_ID, 25]);
    expect(sql).toMatch(/plainto_tsquery\('english', \$1\)/);
    expect(sql).toMatch(/evaluation_id = \$2/);
    expect(sql).toMatch(/LIMIT \$3/);
  });

  it("uses plainto_tsquery (NOT to_tsquery) so raw user input is safe", () => {
    const malicious = "fish & soil:* | injection";
    const { sql, params } = buildSubmissionSearchQuery(malicious, {
      evaluationId: EVAL_ID,
      limit: 10,
    });
    // SQL never embeds the query string literally.
    expect(sql.includes(malicious)).toBe(false);
    // The query is passed as a bind parameter.
    expect(params[0]).toBe(malicious);
    // No occurrence of to_tsquery (which would attempt to parse operators).
    expect(/to_tsquery\(/.test(sql)).toBe(true); // plainto_tsquery substring
    expect(/(^|[^a-z_])to_tsquery\(/.test(sql)).toBe(false); // bare to_tsquery
  });

  it("clamps the limit per clampSubmissionSearchLimit", () => {
    const { params } = buildSubmissionSearchQuery("x", {
      evaluationId: EVAL_ID,
      limit: 99999,
    });
    expect(params[2]).toBe(SUBMISSION_SEARCH_LIMIT_MAX);
  });

  it("includes ts_headline with the documented options literal", () => {
    const { sql } = buildSubmissionSearchQuery("x", {
      evaluationId: EVAL_ID,
      limit: 10,
    });
    expect(sql).toContain(SUBMISSION_SEARCH_HEADLINE_OPTIONS);
    expect(sql).toMatch(/ts_headline\('english', content, plainto_tsquery/);
  });

  it("orders by rank DESC then page_num ASC for stable result presentation", () => {
    const { sql } = buildSubmissionSearchQuery("x", {
      evaluationId: EVAL_ID,
      limit: 10,
    });
    expect(sql).toMatch(/ORDER BY rank DESC, page_num ASC NULLS LAST/);
  });
});

describe("renderSnippet", () => {
  it("returns a ts_headline fragment string that uses $1 as the bind position", () => {
    const frag = renderSnippet();
    expect(frag).toMatch(/^ts_headline\('english', content, plainto_tsquery\('english', \$1\)/);
    expect(frag).toContain(SUBMISSION_SEARCH_HEADLINE_OPTIONS);
  });
});

describe("renderSnippetJs (in-memory fallback)", () => {
  it("returns truncated content when query has no tokens that match", () => {
    const out = renderSnippetJs(
      "Lorem ipsum dolor sit amet, consectetur adipiscing elit.",
      "completely unrelated",
      40,
    );
    // No token matches -> returns first 40 chars.
    expect(out.length).toBeLessThanOrEqual(40);
    expect(out).toMatch(/^Lorem ipsum/);
  });

  it("centers the window around the first matching token", () => {
    const text =
      "Header header header. The traditional knowledge informed the site model in section 4.";
    const out = renderSnippetJs(text, "traditional", 50);
    expect(out).toContain("traditional");
    expect(out.length).toBeLessThanOrEqual(60); // includes ellipses
  });

  it("returns empty string on empty content", () => {
    expect(renderSnippetJs("", "anything")).toBe("");
  });

  it("ignores single-character tokens", () => {
    const text = "Some content here.";
    const out = renderSnippetJs(text, "a c", 50);
    // No multi-char tokens to match; returns truncated head.
    expect(out).toBe("Some content here.");
  });
});
