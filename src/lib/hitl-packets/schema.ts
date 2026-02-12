/**
 * Zod schemas for HITL Packet validation.
 *
 * These schemas provide runtime type checking for packet JSON
 * loaded from the filesystem. They mirror the Python-side contract
 * in engine/scripts/core/hitl_packet.py.
 */

import { z } from 'zod';
import { SCHEMA_VERSION } from './types';

// ---------------------------------------------------------------------------
// Record sub-schemas
// ---------------------------------------------------------------------------

export const qualityFlagsSchema = z.record(z.string(), z.boolean());

export const keywordSectionSchema = z.object({
  raw_score: z.number(),
  capped_score: z.number(),
  decision_score: z.number(),
  threshold: z.number(),
  quality_flags: qualityFlagsSchema,
}).passthrough();

export const aiSectionSchema = z.object({
  invoked: z.boolean(),
  invocation_reason: z.string(),
}).passthrough();

export const decisionSectionSchema = z.object({
  display_status: z.string(),
  confidence_label: z.string(),
  matched: z.boolean(),
});

export const evidenceSectionSchema = z.object({
  best_evidence_location: z.string(),
  best_evidence_excerpt: z.string(),
}).passthrough();

export const provenanceSectionSchema = z.object({
  keyword_source: z.string(),
}).passthrough();

export const criteriaSectionSchema = z.object({
  evidence_criteria_used: z.boolean(),
}).passthrough();

// ---------------------------------------------------------------------------
// Full record schema
// ---------------------------------------------------------------------------

export const packetRecordSchema = z.object({
  session_id: z.string(),
  policy_id: z.string(),
  tier: z.string(),
  keyword: keywordSectionSchema,
  ai: aiSectionSchema,
  decision: decisionSectionSchema,
  evidence: evidenceSectionSchema,
  provenance: provenanceSectionSchema,
  criteria: criteriaSectionSchema,
}).passthrough();

// ---------------------------------------------------------------------------
// Metadata schema
// ---------------------------------------------------------------------------

export const packetMetadataSchema = z.object({
  session_id: z.string(),
  generated_at: z.string(),
  schema_version: z.string(),
  record_count: z.number().int().nonnegative(),
  policies_evaluated: z.number().int().nonnegative().nullable(),
  policies_in_kb: z.number().int().nonnegative().nullable(),
  policies_filtered: z.number().int().nonnegative().nullable(),
});

// ---------------------------------------------------------------------------
// Top-level packet schema
// ---------------------------------------------------------------------------

export const hitlPacketSchema = z.object({
  schema_version: z.literal(SCHEMA_VERSION),
  metadata: packetMetadataSchema,
  records: z.array(packetRecordSchema),
});
