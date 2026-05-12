// engine_v2 frontend Lane 2c: tests for evidence_slices dereferencing helper.
//
// Covers schema_version 0.1.0 contract:
//   - extractEvidenceSlices returns null for null / non-object / missing-field inputs.
//   - Returns a populated map for well-formed input.
//   - Skips malformed entries (missing content / content_hash).
//   - Defaults source fields when source is partial / missing.
//   - dereferenceSlice returns the slice when present; null when missing or map null.

import { describe, it, expect } from "vitest";
import {
  extractEvidenceSlices,
  dereferenceSlice,
  type EvidenceSliceMap,
} from "../evidence_slices";

describe("extractEvidenceSlices null/degenerate inputs", () => {
  it("returns null for null", () => {
    expect(extractEvidenceSlices(null)).toBeNull();
  });

  it("returns null for undefined", () => {
    expect(extractEvidenceSlices(undefined)).toBeNull();
  });

  it("returns null for non-object scalar", () => {
    expect(extractEvidenceSlices(42)).toBeNull();
    expect(extractEvidenceSlices("string")).toBeNull();
    expect(extractEvidenceSlices(true)).toBeNull();
  });

  it("returns null when evidence_slices field is missing", () => {
    expect(extractEvidenceSlices({ schema_version: "0.0.1" })).toBeNull();
    expect(
      extractEvidenceSlices({
        schema_version: "0.1.0",
        per_policy_results: [],
      }),
    ).toBeNull();
  });

  it("returns null when evidence_slices is not an object (e.g. array)", () => {
    expect(extractEvidenceSlices({ evidence_slices: [] })).toBeNull();
    expect(extractEvidenceSlices({ evidence_slices: "oops" })).toBeNull();
    expect(extractEvidenceSlices({ evidence_slices: null })).toBeNull();
  });
});

describe("extractEvidenceSlices well-formed input", () => {
  it("returns a populated map for well-formed input", () => {
    const blob = {
      schema_version: "0.1.0",
      evidence_slices: {
        slice_abc: {
          content_hash: "abc123",
          content: "verbatim policy text here",
          field: "original_text",
          policy_id: "P-001",
          source: {
            doc_id: "doc-1",
            title: "Doc One",
            page: 5,
            section: "3.2",
            chunk_id: "c-9",
            source_path: "/path/to/doc.pdf",
          },
        },
      },
    };
    const out = extractEvidenceSlices(blob);
    expect(out).not.toBeNull();
    expect(Object.keys(out as EvidenceSliceMap)).toEqual(["slice_abc"]);
    const slice = (out as EvidenceSliceMap)["slice_abc"]!;
    expect(slice.content).toBe("verbatim policy text here");
    expect(slice.content_hash).toBe("abc123");
    expect(slice.field).toBe("original_text");
    expect(slice.policy_id).toBe("P-001");
    expect(slice.source.doc_id).toBe("doc-1");
    expect(slice.source.title).toBe("Doc One");
    expect(slice.source.page).toBe(5);
    expect(slice.source.section).toBe("3.2");
    expect(slice.source.chunk_id).toBe("c-9");
    expect(slice.source.source_path).toBe("/path/to/doc.pdf");
  });

  it("skips malformed entries (missing content)", () => {
    const blob = {
      evidence_slices: {
        good: {
          content_hash: "h1",
          content: "ok",
          field: "original_text",
          policy_id: "P-1",
          source: {},
        },
        bad_no_content: {
          content_hash: "h2",
          policy_id: "P-2",
          source: {},
        },
        bad_no_hash: {
          content: "no hash",
          policy_id: "P-3",
          source: {},
        },
        bad_not_object: "this is a string, not an object",
        bad_null: null,
      },
    };
    const out = extractEvidenceSlices(blob);
    expect(out).not.toBeNull();
    const map = out as EvidenceSliceMap;
    expect(Object.keys(map).sort()).toEqual(["good"]);
  });

  it("defaults source fields when source is partial or missing", () => {
    const blob = {
      evidence_slices: {
        partial_source: {
          content_hash: "h",
          content: "x",
          // field omitted -> defaults to "original_text"
          // policy_id omitted -> defaults to ""
          source: {
            title: "Title Only",
            // doc_id missing, page missing, section missing, chunk_id missing,
            // source_path missing
          },
        },
        no_source: {
          content_hash: "h2",
          content: "y",
          // source entirely missing
        },
        wrong_type_page: {
          content_hash: "h3",
          content: "z",
          source: {
            doc_id: "d",
            title: "T",
            page: "not-a-number",
            section: 123, // wrong type -> defaults to null
            chunk_id: false,
            source_path: 99,
          },
        },
      },
    };
    const out = extractEvidenceSlices(blob);
    expect(out).not.toBeNull();
    const map = out as EvidenceSliceMap;

    const partial = map["partial_source"]!;
    expect(partial.field).toBe("original_text");
    expect(partial.policy_id).toBe("");
    expect(partial.source.doc_id).toBe("");
    expect(partial.source.title).toBe("Title Only");
    expect(partial.source.page).toBeNull();
    expect(partial.source.section).toBeNull();
    expect(partial.source.chunk_id).toBeNull();
    expect(partial.source.source_path).toBeNull();

    const noSrc = map["no_source"]!;
    expect(noSrc.source.doc_id).toBe("");
    expect(noSrc.source.title).toBe("");
    expect(noSrc.source.page).toBeNull();
    expect(noSrc.source.section).toBeNull();
    expect(noSrc.source.chunk_id).toBeNull();
    expect(noSrc.source.source_path).toBeNull();

    const wrong = map["wrong_type_page"]!;
    expect(wrong.source.page).toBeNull();
    expect(wrong.source.section).toBeNull();
    expect(wrong.source.chunk_id).toBeNull();
    expect(wrong.source.source_path).toBeNull();
  });
});

describe("dereferenceSlice", () => {
  it("returns the slice when present", () => {
    const map: EvidenceSliceMap = {
      slice_1: {
        content_hash: "h",
        content: "c",
        field: "original_text",
        policy_id: "P-1",
        source: {
          doc_id: "",
          title: "",
          page: null,
          section: null,
          chunk_id: null,
          source_path: null,
        },
      },
    };
    const got = dereferenceSlice(map, "slice_1");
    expect(got).not.toBeNull();
    expect(got!.content).toBe("c");
  });

  it("returns null when the id is missing", () => {
    const map: EvidenceSliceMap = {};
    expect(dereferenceSlice(map, "missing")).toBeNull();
  });

  it("returns null when the map is null", () => {
    expect(dereferenceSlice(null, "any")).toBeNull();
  });
});
