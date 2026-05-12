// engine_v2 frontend Lane 2a: Zod schemas at API boundaries for evaluation flow.
// Structural validation only. See plan v0.2.

import { z } from "zod";

// EvalTriggerPayload: empty object is valid (Lane 2a uses defaults).
// Reserved field extraction_run_id for explicit selection (Lane 2b).
export const EvalTriggerPayloadSchema = z.object({
  extraction_run_id: z.string().uuid().optional(),
  evaluation_backend: z.enum(["stub", "live"]).optional(),
}).strict();

export type EvalTriggerPayload = z.infer<typeof EvalTriggerPayloadSchema>;

// Used by /evaluation-status route per Finding 37 (POST with CSRF instead of GET).
export const EvalStatusSyncPayloadSchema = z.object({
  evaluation_id: z.string().uuid(),
}).strict();

export type EvalStatusSyncPayload = z.infer<typeof EvalStatusSyncPayloadSchema>;

// Lane 2b: judgment + memo schemas (appended; do not modify Lane 2a exports above).

import { ALLOWED_VERDICTS_BY_TIER, type JudgmentTier, type JudgmentVerdict } from "./types_lane2";

// Sanity reference list of all verdict values; not exported. The z.enum literal
// list in JudgmentUpsertPayloadSchema IS the schema source of truth.
const VERDICT_VALUES: JudgmentVerdict[] = [
  "ADEQUATE",
  "INADEQUATE",
  "DEFICIENT",
  "REQUIRES_REVIEW",
  "OBSERVATION_ONLY",
];
void VERDICT_VALUES;

// Tier-resolved verdict check happens in the route after fetching the
// per_policy_results row; the schema just enforces enum membership +
// per_policy_result_id UUID.
export const JudgmentUpsertPayloadSchema = z
  .object({
    per_policy_result_id: z.string().uuid(),
    verdict: z.enum([
      "ADEQUATE",
      "INADEQUATE",
      "DEFICIENT",
      "REQUIRES_REVIEW",
      "OBSERVATION_ONLY",
    ]),
    rationale: z.string().max(8192).nullable().optional(),
    evidence_refs: z.array(z.unknown()).optional(),
  })
  .strict();
export type JudgmentUpsertPayload = z.infer<typeof JudgmentUpsertPayloadSchema>;

export const MemoExportPayloadSchema = z.object({}).strict();
export type MemoExportPayload = z.infer<typeof MemoExportPayloadSchema>;

export function assertVerdictAllowedForTier(
  tier: JudgmentTier,
  verdict: JudgmentVerdict,
): void {
  if (!(ALLOWED_VERDICTS_BY_TIER[tier] as readonly JudgmentVerdict[]).includes(verdict)) {
    throw new Error(
      `verdict_not_allowed_for_tier: tier=${tier} verdict=${verdict}`,
    );
  }
}
