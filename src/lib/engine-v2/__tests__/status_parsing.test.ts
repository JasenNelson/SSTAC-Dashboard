import { describe, it, expect } from "vitest";
import { parseStatusJson } from "../status_parsing";

const baseRecord = {
  totalFiles: 3,
  completedFiles: 1,
  currentFile: "file_a.pdf",
  progress: 33,
  errors: [],
  updatedAt: "2026-05-11T10:00:00.000Z",
};

describe("parseStatusJson (Findings 17, 43)", () => {
  it("returns empty Partial on null input", () => {
    expect(parseStatusJson(null)).toEqual({});
  });

  it("returns parse-error sentinel on malformed JSON", () => {
    const r = parseStatusJson("{not json");
    expect(r.status).toBe("error");
    expect(r.errors).toEqual(["status_json_parse_error"]);
  });

  it("returns parse-error sentinel on non-object JSON (array)", () => {
    const r = parseStatusJson("[1, 2, 3]");
    expect(r.status).toBe("error");
    expect(r.errors).toEqual(["status_json_parse_error"]);
  });

  it("returns parse-error sentinel on JSON null", () => {
    const r = parseStatusJson("null");
    expect(r.status).toBe("error");
  });

  it("parses status=pending", () => {
    const r = parseStatusJson(JSON.stringify({ ...baseRecord, status: "pending" }));
    expect(r.status).toBe("pending");
    expect(r.totalFiles).toBe(3);
    expect(r.completedFiles).toBe(1);
    expect(r.currentFile).toBe("file_a.pdf");
    expect(r.progress).toBe(33);
  });

  it("parses status=extracting", () => {
    const r = parseStatusJson(JSON.stringify({ ...baseRecord, status: "extracting" }));
    expect(r.status).toBe("extracting");
  });

  it("parses status=completed", () => {
    const r = parseStatusJson(JSON.stringify({ ...baseRecord, status: "completed" }));
    expect(r.status).toBe("completed");
  });

  it("parses status=completed_with_errors", () => {
    const r = parseStatusJson(
      JSON.stringify({ ...baseRecord, status: "completed_with_errors" }),
    );
    expect(r.status).toBe("completed_with_errors");
  });

  it("parses status=error with string errors", () => {
    const r = parseStatusJson(
      JSON.stringify({
        ...baseRecord,
        status: "error",
        errors: ["something broke", "another"],
      }),
    );
    expect(r.status).toBe("error");
    expect(r.errors).toEqual(["something broke", "another"]);
  });

  it("drops unknown status values", () => {
    const r = parseStatusJson(
      JSON.stringify({ ...baseRecord, status: "weird_status" }),
    );
    expect(r.status).toBeUndefined();
    // Other fields still parse.
    expect(r.totalFiles).toBe(3);
  });

  it("parses chunkProgress as scalar string (Finding 17)", () => {
    const r = parseStatusJson(
      JSON.stringify({
        ...baseRecord,
        status: "extracting",
        chunkProgress: "chunk 5/12",
      }),
    );
    expect(r.chunkProgress).toBe("chunk 5/12");
  });

  it("omits chunkProgress when absent", () => {
    const r = parseStatusJson(JSON.stringify({ ...baseRecord, status: "extracting" }));
    expect(r.chunkProgress).toBeUndefined();
  });

  it("drops chunkProgress when non-string (Finding 17 scalar string only)", () => {
    const r = parseStatusJson(
      JSON.stringify({
        ...baseRecord,
        status: "extracting",
        chunkProgress: { current: 5, total: 12 },
      }),
    );
    expect(r.chunkProgress).toBeUndefined();
  });

  it("drops chunkProgress when an array", () => {
    const r = parseStatusJson(
      JSON.stringify({
        ...baseRecord,
        status: "extracting",
        chunkProgress: ["chunk", "5"],
      }),
    );
    expect(r.chunkProgress).toBeUndefined();
  });

  it("currentFile optional (absent)", () => {
    const partial = { ...baseRecord, status: "extracting" } as Record<string, unknown>;
    delete partial.currentFile;
    const r = parseStatusJson(JSON.stringify(partial));
    expect(r.currentFile).toBeUndefined();
    expect(r.status).toBe("extracting");
  });

  it("drops errors when not a string array", () => {
    const r = parseStatusJson(
      JSON.stringify({
        ...baseRecord,
        status: "error",
        errors: [{ code: 1 }, "ok"],
      }),
    );
    expect(r.errors).toBeUndefined();
  });

  it("drops totalFiles when negative or non-integer", () => {
    const r = parseStatusJson(
      JSON.stringify({ ...baseRecord, status: "pending", totalFiles: -1 }),
    );
    expect(r.totalFiles).toBeUndefined();
    const r2 = parseStatusJson(
      JSON.stringify({ ...baseRecord, status: "pending", totalFiles: 3.5 }),
    );
    expect(r2.totalFiles).toBeUndefined();
  });

  it("drops progress when out of range [0,100]", () => {
    const r = parseStatusJson(
      JSON.stringify({ ...baseRecord, status: "pending", progress: 150 }),
    );
    expect(r.progress).toBeUndefined();
    const r2 = parseStatusJson(
      JSON.stringify({ ...baseRecord, status: "pending", progress: -5 }),
    );
    expect(r2.progress).toBeUndefined();
  });
});
