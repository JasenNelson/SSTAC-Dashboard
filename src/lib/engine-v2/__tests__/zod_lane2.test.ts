import { describe, it, expect } from "vitest";
import {
  EvalTriggerPayloadSchema,
  EvalStatusSyncPayloadSchema,
} from "../zod_lane2";

const uuid = "11111111-1111-4111-8111-111111111111";

describe("EvalTriggerPayloadSchema", () => {
  it("accepts empty object (Lane 2a defaults)", () => {
    const r = EvalTriggerPayloadSchema.parse({});
    expect(r).toEqual({});
  });

  it("accepts valid UUID extraction_run_id", () => {
    const r = EvalTriggerPayloadSchema.parse({ extraction_run_id: uuid });
    expect(r.extraction_run_id).toBe(uuid);
  });

  it("rejects non-UUID extraction_run_id", () => {
    expect(() =>
      EvalTriggerPayloadSchema.parse({ extraction_run_id: "not-a-uuid" }),
    ).toThrow();
  });

  it("rejects unknown fields (strict mode)", () => {
    expect(() =>
      EvalTriggerPayloadSchema.parse({ unknown_field: "x" }),
    ).toThrow();
  });

  it("rejects unknown fields alongside valid ones (strict mode)", () => {
    expect(() =>
      EvalTriggerPayloadSchema.parse({
        extraction_run_id: uuid,
        extra: 1,
      }),
    ).toThrow();
  });
});

describe("EvalStatusSyncPayloadSchema", () => {
  it("accepts valid UUID evaluation_id", () => {
    const r = EvalStatusSyncPayloadSchema.parse({ evaluation_id: uuid });
    expect(r.evaluation_id).toBe(uuid);
  });

  it("rejects missing evaluation_id", () => {
    expect(() => EvalStatusSyncPayloadSchema.parse({})).toThrow();
  });

  it("rejects non-UUID evaluation_id", () => {
    expect(() =>
      EvalStatusSyncPayloadSchema.parse({ evaluation_id: "not-a-uuid" }),
    ).toThrow();
  });

  it("rejects unknown fields (strict mode)", () => {
    expect(() =>
      EvalStatusSyncPayloadSchema.parse({
        evaluation_id: uuid,
        extra: 1,
      }),
    ).toThrow();
  });
});
