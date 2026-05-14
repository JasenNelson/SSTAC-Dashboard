import { describe, it, expect } from "vitest";
import {
  ProjectCreatePayloadSchema,
  FileCompletePayloadSchema,
  OrphanCleanupPayloadSchema,
  ExtractStatusSyncPayloadSchema,
  FileExistsQuerySchema,
  ExtractionStatusUpsertSchema,
} from "../zod";

const uuid = "11111111-1111-4111-8111-111111111111";
const uuid2 = "22222222-2222-4222-8222-222222222222";

describe("ProjectCreatePayloadSchema", () => {
  it("accepts minimum valid payload", () => {
    const r = ProjectCreatePayloadSchema.parse({ name: "Smoke" });
    expect(r.name).toBe("Smoke");
    expect(r.application_types).toEqual([]);
  });

  it("rejects empty name", () => {
    expect(() => ProjectCreatePayloadSchema.parse({ name: "" })).toThrow();
  });

  it("rejects extra max_files (Finding 81: not allowed in Lane 1; .strict() enforces)", () => {
    // .strict() causes parse() to throw on unrecognized keys.
    // Clients MUST NOT send max_files; the schema rejects it outright.
    expect(() =>
      ProjectCreatePayloadSchema.parse({
        name: "Smoke",
        max_files: 1,
      } as unknown as Record<string, unknown>),
    ).toThrow();
  });
});

describe("FileCompletePayloadSchema", () => {
  const valid = {
    project_id: uuid,
    file_id: uuid2,
    original_filename: "smoke.pdf",
    size_bytes: 1234,
    content_type: "application/pdf",
  };

  it("accepts valid payload with PDF MIME", () => {
    const r = FileCompletePayloadSchema.parse(valid);
    expect(r.file_id).toBe(uuid2);
  });

  it("rejects disallowed MIME types", () => {
    expect(() =>
      FileCompletePayloadSchema.parse({ ...valid, content_type: "application/json" })
    ).toThrow();
    expect(() =>
      FileCompletePayloadSchema.parse({ ...valid, content_type: "image/png" })
    ).toThrow();
  });

  it("accepts DOCX and legacy DOC MIME", () => {
    expect(() =>
      FileCompletePayloadSchema.parse({
        ...valid,
        content_type:
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      })
    ).not.toThrow();
    expect(() =>
      FileCompletePayloadSchema.parse({ ...valid, content_type: "application/msword" })
    ).not.toThrow();
  });

  it("rejects non-UUID project_id and file_id", () => {
    expect(() => FileCompletePayloadSchema.parse({ ...valid, project_id: "bad" })).toThrow();
    expect(() => FileCompletePayloadSchema.parse({ ...valid, file_id: "bad" })).toThrow();
  });

  it("rejects negative size_bytes", () => {
    expect(() => FileCompletePayloadSchema.parse({ ...valid, size_bytes: -1 })).toThrow();
  });

  it("rejects client-claimed sha256 (.strict() enforcement; Finding 2 server-computes SHA)", () => {
    // .strict() causes parse() to throw when sha256 is included.
    // Clients MUST NOT supply sha256; server computes it via streaming hash.
    expect(() =>
      FileCompletePayloadSchema.parse({
        ...valid,
        sha256: "deadbeef",
      } as unknown as Record<string, unknown>),
    ).toThrow();
  });
});

describe("OrphanCleanupPayloadSchema", () => {
  it("accepts {project_id, file_id} only", () => {
    expect(
      OrphanCleanupPayloadSchema.parse({ project_id: uuid, file_id: uuid2 })
    ).toEqual({ project_id: uuid, file_id: uuid2 });
  });

  it("rejects client-supplied storage_path (.strict() enforcement; server derives path)", () => {
    // .strict() causes parse() to throw when storage_path is included.
    // Clients MUST NOT supply storage_path; server derives it from user_id/project_id/file_id.
    expect(() =>
      OrphanCleanupPayloadSchema.parse({
        project_id: uuid,
        file_id: uuid2,
        storage_path: "foo/bar",
      } as unknown as Record<string, unknown>),
    ).toThrow();
  });
});

describe("ExtractStatusSyncPayloadSchema", () => {
  it("accepts a UUID run_id", () => {
    expect(ExtractStatusSyncPayloadSchema.parse({ run_id: uuid })).toEqual({
      run_id: uuid,
    });
  });
  it("rejects non-UUID run_id", () => {
    expect(() => ExtractStatusSyncPayloadSchema.parse({ run_id: "x" })).toThrow();
  });
  it("rejects extra keys (.strict() enforcement -- body carries only run_id per Finding 37)", () => {
    expect(() =>
      ExtractStatusSyncPayloadSchema.parse({
        run_id: uuid,
        project_id: uuid2,
      } as unknown as Record<string, unknown>),
    ).toThrow();
  });
});

describe("FileExistsQuerySchema", () => {
  it("accepts both UUIDs", () => {
    expect(
      FileExistsQuerySchema.parse({ project_id: uuid, file_id: uuid2 })
    ).toEqual({ project_id: uuid, file_id: uuid2 });
  });
});

describe("ExtractionStatusUpsertSchema", () => {
  const base = {
    status: "extracting" as const,
    totalFiles: 1,
    completedFiles: 0,
    currentFile: "x.pdf",
    progress: 0,
    errors: [],
    updatedAt: "2026-05-11T00:00:00Z",
  };

  it("accepts all 5 status values", () => {
    for (const status of [
      "pending",
      "extracting",
      "completed",
      "completed_with_errors",
      "error",
    ] as const) {
      expect(() => ExtractionStatusUpsertSchema.parse({ ...base, status })).not.toThrow();
    }
  });

  it("rejects unknown status", () => {
    expect(() =>
      ExtractionStatusUpsertSchema.parse({ ...base, status: "bogus" as never })
    ).toThrow();
  });

  it("accepts optional chunkProgress as string", () => {
    expect(() =>
      ExtractionStatusUpsertSchema.parse({ ...base, chunkProgress: "3 of 10" })
    ).not.toThrow();
  });

  it("rejects non-string chunkProgress (Finding 17: scalar string per v1 extractor)", () => {
    expect(() =>
      ExtractionStatusUpsertSchema.parse({
        ...base,
        chunkProgress: { current: 3, total: 10 } as unknown as string,
      })
    ).toThrow();
  });

  it("rejects non-string entries in errors[]", () => {
    expect(() =>
      ExtractionStatusUpsertSchema.parse({
        ...base,
        errors: [{ message: "boom" } as unknown as string],
      })
    ).toThrow();
  });
});
