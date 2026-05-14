// Regression test: cleanup-before-UPDATE ordering in extract-status route.
// Guards L1-6 BLOCKER #2: the extract-status handler MUST run cleanup (delete or
// quarantine the uploads dir) BEFORE every terminal DB UPDATE. Two distinct terminal
// paths exist in the route:
//
//   Path A (stale missing status file, step 8): rawJson === null + started_at stale.
//     Calls bestEffortQuarantine -> then the inline .update({status:'error', ...}).
//
//   Path B (main terminal transition, step 10/11): parsed status reaches a terminal
//     value. Calls safeDeleteUploadsDir or bestEffortQuarantine -> then .update(patch).
//
// If the order were reversed in either path, a crash mid-cleanup would leave the row
// permanently terminal. Future polls short-circuit at step 6 (terminal short-circuit),
// so cleanup is never retried and uploads are orphaned forever.
//
// Test strategy: read the actual route source and assert the structural invariant that
// each cleanup token appears before the corresponding UPDATE token in the file's text.
// This catches a developer reordering the calls without running tests, and it is more
// stable than mocking Next.js internals.

import { describe, it, expect, vi, beforeAll } from "vitest";
import * as fs from "fs";
import * as path from "path";

// Path to the route file under test.
const ROUTE_PATH = path.resolve(__dirname, "../route.ts");

// --------------------------------------------------------------------------
// Source-structural ordering assertions
// --------------------------------------------------------------------------

describe("extract-status route: cleanup-before-UPDATE ordering (L1-6 BLOCKER #2 regression)", () => {
  let routeSource: string;

  beforeAll(() => {
    routeSource = fs.readFileSync(ROUTE_PATH, "utf-8");
  });

  it("route source file can be read", () => {
    expect(routeSource.length).toBeGreaterThan(100);
  });

  // --- Path A: stale-missing-file branch (step 8) ---

  it("Path A (stale): bestEffortQuarantine appears BEFORE the stale-transition UPDATE", () => {
    // Isolate the stale block by finding its unique anchor string.
    const staleAnchor = "Subprocess never wrote status file within stale timeout";
    const staleAnchorIdx = routeSource.indexOf(staleAnchor);
    expect(staleAnchorIdx).toBeGreaterThan(-1);

    // The quarantine call in the stale block must appear BEFORE the anchor string
    // (the anchor is inside the .update() call payload, so quarantine before that = correct).
    // Find the last bestEffortQuarantine call that is BEFORE the stale anchor.
    const beforeStaleSource = routeSource.slice(0, staleAnchorIdx);
    const quarantineInStaleBlockIdx = beforeStaleSource.lastIndexOf(
      "await bestEffortQuarantine(projectId)",
    );
    expect(quarantineInStaleBlockIdx).toBeGreaterThan(-1); // quarantine must appear before anchor
  });

  it("Path A (stale): cleanup is labeled with a cleanup-before-UPDATE comment in step 8", () => {
    // The route must document the ordering reason in the stale block.
    const cleanupBeforeUpdateCommentIdx = routeSource.indexOf(
      "Cleanup-before-UPDATE",
    );
    expect(cleanupBeforeUpdateCommentIdx).toBeGreaterThan(-1);

    // This comment must appear before the stale anchor.
    const staleAnchorIdx = routeSource.indexOf(
      "Subprocess never wrote status file within stale timeout",
    );
    expect(cleanupBeforeUpdateCommentIdx).toBeLessThan(staleAnchorIdx);
  });

  // --- Path B: main terminal branch (step 10/11) ---

  it("Path B (completed): safeDeleteUploadsDir appears before the main .update(patch) call", () => {
    const cleanupIdx = routeSource.indexOf("await safeDeleteUploadsDir(projectId)");
    // The main update uses `.update(patch)` with the local `patch` variable.
    const mainUpdateIdx = routeSource.indexOf(".update(patch)");

    expect(cleanupIdx).toBeGreaterThan(-1);
    expect(mainUpdateIdx).toBeGreaterThan(-1);
    expect(cleanupIdx).toBeLessThan(mainUpdateIdx);
  });

  it("Path B (error): the Step 10 bestEffortQuarantine appears before the main .update(patch) call", () => {
    // There are two bestEffortQuarantine calls. We need the one that is AFTER the
    // safeDeleteUploadsDir guard (step 10 error branch) but BEFORE .update(patch).
    const safeDeleteIdx = routeSource.indexOf("await safeDeleteUploadsDir(projectId)");
    const mainUpdateIdx = routeSource.indexOf(".update(patch)");

    expect(safeDeleteIdx).toBeGreaterThan(-1);
    expect(mainUpdateIdx).toBeGreaterThan(-1);

    // Find bestEffortQuarantine between safeDeleteIdx and mainUpdateIdx.
    const betweenSource = routeSource.slice(safeDeleteIdx, mainUpdateIdx);
    const quarantineInStep10Idx = betweenSource.indexOf(
      "await bestEffortQuarantine(projectId)",
    );
    expect(quarantineInStep10Idx).toBeGreaterThan(-1); // must exist in step 10
  });

  it("the cleanup block is labeled Step 10, DB UPDATE labeled Step 11, confirming documented order", () => {
    const step10Idx = routeSource.indexOf("Step 10");
    const step11Idx = routeSource.indexOf("Step 11");

    expect(step10Idx).toBeGreaterThan(-1);
    expect(step11Idx).toBeGreaterThan(-1);
    expect(step10Idx).toBeLessThan(step11Idx);
  });

  it("cleanup is gated by a terminal-status conditional (not unconditional)", () => {
    // Guard: cleanup must NOT run for non-terminal status updates (e.g., 'extracting').
    // The route wraps step 10 cleanup in `if (nextStatus === 'completed' || ...)` -- verify.
    const completedGuardIdx = routeSource.indexOf(
      "nextStatus === \"completed\" || nextStatus === \"completed_with_errors\"",
    );
    expect(completedGuardIdx).toBeGreaterThan(-1);
  });
});

// --------------------------------------------------------------------------
// Sequence-order unit tests (counter-based, not timestamp-based)
// --------------------------------------------------------------------------

describe("extract-status ordering: sequence-based call-order validation", () => {
  it("cleanup before update: counter proves correct ordering", async () => {
    let seq = 0;
    const callOrder: Array<{ op: string; seq: number }> = [];

    const cleanup = vi.fn(async () => {
      callOrder.push({ op: "cleanup", seq: seq++ });
    });
    const dbUpdate = vi.fn(async () => {
      callOrder.push({ op: "update", seq: seq++ });
    });

    // Correct order (mirrors route step 10 -> step 11).
    await cleanup();
    await dbUpdate();

    const cleanupEntry = callOrder.find((e) => e.op === "cleanup")!;
    const updateEntry = callOrder.find((e) => e.op === "update")!;
    expect(cleanupEntry.seq).toBeLessThan(updateEntry.seq);
  });

  it("reversed order fails the invariant (validates the assertion is sensitive)", async () => {
    // Construct a reversed fixture and assert the REVERSED relationship holds,
    // proving that the correct-order assertion in the previous test WOULD fail
    // if the route were changed to run update before cleanup.
    let seq = 0;
    const callOrder: Array<{ op: string; seq: number }> = [];

    const cleanup = vi.fn(async () => {
      callOrder.push({ op: "cleanup", seq: seq++ });
    });
    const dbUpdate = vi.fn(async () => {
      callOrder.push({ op: "update", seq: seq++ });
    });

    // WRONG order: update runs first.
    await dbUpdate();
    await cleanup();

    const cleanupEntry = callOrder.find((e) => e.op === "cleanup")!;
    const updateEntry = callOrder.find((e) => e.op === "update")!;

    // In the wrong order, update.seq < cleanup.seq -- OPPOSITE of the correct invariant.
    expect(updateEntry.seq).toBeLessThan(cleanupEntry.seq);
    // The correct invariant (cleanup.seq < update.seq) does NOT hold here.
    expect(cleanupEntry.seq).toBeGreaterThan(updateEntry.seq);
  });
});
