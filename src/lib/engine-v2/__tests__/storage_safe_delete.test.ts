import { describe, it, expect, vi } from "vitest";
import { deleteUnfinalizedStorageObject } from "../storage_safe_delete";

// Minimal SupabaseClient stub satisfying the helper's interface.
function makeClient(opts: {
  guard?: { data: unknown; error: { message: string } | null };
  remove?: { error: { message: string } | null };
  recordRemoveCall?: () => void;
}) {
  return {
    from(_t: string) {
      void _t;
      return {
        select() {
          return this;
        },
        eq() {
          return this;
        },
        is() {
          return this;
        },
        async maybeSingle() {
          return opts.guard ?? { data: null, error: null };
        },
      };
    },
    storage: {
      from(_b: string) {
        void _b;
        return {
          async remove(_paths: string[]) {
            void _paths;
            opts.recordRemoveCall?.();
            return opts.remove ?? { error: null };
          },
        };
      },
    },
  } as never;
}

describe("deleteUnfinalizedStorageObject (Findings 69, 73, 74)", () => {
  it("DELETEs when no finalized row exists", async () => {
    const recorded = vi.fn();
    const client = makeClient({
      guard: { data: null, error: null },
      recordRemoveCall: recorded,
    });
    const r = await deleteUnfinalizedStorageObject(client, "u/p/f/f.pdf");
    expect(r.deleted).toBe(true);
    expect(r.reason).toBeUndefined();
    expect(recorded).toHaveBeenCalledTimes(1);
  });

  it("refuses to DELETE when row exists at expectedPath", async () => {
    const recorded = vi.fn();
    const client = makeClient({
      guard: { data: { id: "f", storage_path: "u/p/f/f.pdf" }, error: null },
      recordRemoveCall: recorded,
    });
    const r = await deleteUnfinalizedStorageObject(client, "u/p/f/f.pdf");
    expect(r.deleted).toBe(false);
    expect(r.reason).toBe("finalized_row_references_path");
    expect(recorded).not.toHaveBeenCalled();
  });

  it("fails CLOSED on guard query error", async () => {
    const recorded = vi.fn();
    const client = makeClient({
      guard: { data: null, error: { message: "rls_blocked" } },
      recordRemoveCall: recorded,
    });
    const r = await deleteUnfinalizedStorageObject(client, "u/p/f/f.pdf");
    expect(r.deleted).toBe(false);
    expect(r.reason).toMatch(/^guard_query_error:rls_blocked$/);
    expect(recorded).not.toHaveBeenCalled();
  });

  it("returns storage_error reason when storage.remove fails", async () => {
    const client = makeClient({
      guard: { data: null, error: null },
      remove: { error: { message: "io_error" } },
    });
    const r = await deleteUnfinalizedStorageObject(client, "u/p/f/f.pdf");
    expect(r.deleted).toBe(false);
    expect(r.reason).toMatch(/^storage_error:io_error$/);
  });
});
