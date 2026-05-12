// engine_v2 frontend Lane 2a: Zod schemas at API boundaries for evaluation flow.
// Structural validation only. See plan v0.2.

import { z } from "zod";

// EvalTriggerPayload: empty object is valid (Lane 2a uses defaults).
// Reserved field extraction_run_id for explicit selection (Lane 2b).
export const EvalTriggerPayloadSchema = z.object({
  extraction_run_id: z.string().uuid().optional(),
}).strict();

export type EvalTriggerPayload = z.infer<typeof EvalTriggerPayloadSchema>;

// Used by /evaluation-status route per Finding 37 (POST with CSRF instead of GET).
export const EvalStatusSyncPayloadSchema = z.object({
  evaluation_id: z.string().uuid(),
}).strict();

export type EvalStatusSyncPayload = z.infer<typeof EvalStatusSyncPayloadSchema>;
