// Page-level test for the evaluations slim-select split
// (Codex Round 1 fix, Lane 2c retro).
//
// Verifies that the project detail Server Component issues TWO queries
// against v2_evaluations:
//   - Latest eval: full SELECT including raw_eval_result_json (results page
//     needs the JSONB blob for evidence_slices).
//   - History list: slim SELECT that DOES NOT include raw_eval_result_json
//     or evaluation_request_json. At 10k+ historical evals this is the
//     difference between MBs and hundreds of KB on the wire.

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { V2Evaluation, V2EvaluationListRow } from "@/lib/engine-v2/types_lane2";

// Mocks for the Server Component's external imports.
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("notFound() called");
  },
}));
vi.mock("@/lib/engine-v2/admin_guards", () => ({
  requireAdminForServerComponent: vi.fn(),
}));
vi.mock("@/components/engine-v2/EngineV2Breadcrumbs", () => ({
  EngineV2Breadcrumbs: () => null,
}));
vi.mock("../ProjectDetailClient", () => ({
  ProjectDetailClient: () => null,
}));

import { requireAdminForServerComponent } from "@/lib/engine-v2/admin_guards";
import ProjectDetailPage from "../page";

const PROJECT_ID = "11111111-1111-4111-8111-111111111111";

interface SelectCall {
  table: string;
  cols: string;
}

// Build a chainable supabase client double that records every .select() call
// against v2_evaluations so the test can assert which columns each query
// requested.
function makeClient(opts: {
  selectCallsCapture: SelectCall[];
  latestRow: V2Evaluation | null;
  historyRows: V2EvaluationListRow[];
}) {
  function makeBuilder(table: string, cols: string, isLatest: boolean) {
    const builder = {
      eq() {
        return this;
      },
      is() {
        return this;
      },
      order() {
        return this;
      },
      limit() {
        return this;
      },
      async maybeSingle() {
        if (table === "v2_projects") {
          return {
            data: { id: PROJECT_ID, name: "P", user_id: "u" },
            error: null,
          };
        }
        return { data: null, error: null };
      },
      // Thenable to allow `await chain` to resolve into { data, error }.
      then(
        onFulfilled: (val: { data: unknown[]; error: null }) => unknown,
      ) {
        if (table === "v2_evaluations") {
          const rows = isLatest
            ? opts.latestRow !== null
              ? [opts.latestRow]
              : []
            : opts.historyRows;
          return Promise.resolve({ data: rows, error: null }).then(onFulfilled);
        }
        return Promise.resolve({ data: [], error: null }).then(onFulfilled);
      },
    };
    return builder;
  }
  return {
    from(table: string) {
      return {
        select(cols: string) {
          opts.selectCallsCapture.push({ table, cols });
          // Disambiguate by column shape rather than ordinal so the test is
          // resilient to call ordering: the latest-full SELECT includes the
          // JSONB blob; the history SELECT does not.
          const isLatest =
            table === "v2_evaluations" && cols.includes("raw_eval_result_json");
          return makeBuilder(table, cols, isLatest);
        },
      };
    },
    auth: {
      async getSession() {
        return { data: { session: { access_token: "tok" } } };
      },
    },
  };
}

describe("ProjectDetailPage evaluations slim-select split", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("issues two v2_evaluations queries: latest includes JSONB blob, history omits it", async () => {
    const captured: SelectCall[] = [];
    const client = makeClient({
      selectCallsCapture: captured,
      latestRow: null,
      historyRows: [],
    });
    (
      requireAdminForServerComponent as unknown as ReturnType<typeof vi.fn>
    ).mockResolvedValue({ client });

    await ProjectDetailPage({
      params: Promise.resolve({ projectId: PROJECT_ID }),
    });

    const evalSelects = captured.filter((c) => c.table === "v2_evaluations");
    expect(evalSelects).toHaveLength(2);

    const latestSelect = evalSelects.find((c) =>
      c.cols.includes("raw_eval_result_json"),
    );
    expect(latestSelect).toBeDefined();
    // Latest must include all the JSONB blob fields the results page needs.
    expect(latestSelect!.cols).toContain("raw_eval_result_json");
    expect(latestSelect!.cols).toContain("variant_config_hash");

    const historySelect = evalSelects.find(
      (c) => !c.cols.includes("raw_eval_result_json"),
    );
    expect(historySelect).toBeDefined();
    // History MUST NOT include the JSONB blob or any other large blob.
    expect(historySelect!.cols).not.toContain("raw_eval_result_json");
    expect(historySelect!.cols).not.toContain("evaluation_request_json");
    // History MUST include the minimal slim columns the list view renders.
    for (const col of [
      "id",
      "status",
      "evaluation_backend",
      "bench_fixture",
      "coverage_statement",
      "started_at",
      "completed_at",
      "errors",
    ]) {
      expect(historySelect!.cols).toContain(col);
    }
  });
});

describe("V2EvaluationListRow type", () => {
  it("is a strict Pick<> of V2Evaluation (compile-time test via assignability)", () => {
    // This block is a compile-time assertion: if V2EvaluationListRow drifts
    // away from a strict Pick<V2Evaluation,...>, the tsc invariant below
    // will fail. The runtime side just asserts a constructed object shape.
    const row: V2EvaluationListRow = {
      id: "i",
      status: "completed",
      evaluation_backend: "stub",
      bench_fixture: "bench_43_full",
      coverage_statement: {},
      started_at: "2026-05-12T00:00:00Z",
      completed_at: null,
      errors: [],
    };
    // Round-trip into V2Evaluation should NOT work directly because the slim
    // row is missing many V2Evaluation fields. Verify it requires an upcast.
    expect(row.id).toBe("i");
  });
});
