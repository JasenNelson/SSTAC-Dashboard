/**
 * Regulatory Review Zod Validation Schemas
 *
 * Provides type-safe validation for regulatory review API endpoints.
 * These schemas ensure data integrity and enforce the three-tier
 * discretion model constraints at the validation layer.
 */

import { z } from 'zod';
import {
  AssessmentResult,
  ConfidenceLevel,
  DiscretionTier,
  EvidenceSufficiency,
  HumanResult,
  ReviewStatus,
} from './types';

// ============================================================================
// Enum Schemas
// ============================================================================

/**
 * Zod schema for AssessmentResult enum
 */
export const assessmentResultSchema = z.nativeEnum(AssessmentResult);

/**
 * Zod schema for ConfidenceLevel enum
 */
export const confidenceLevelSchema = z.nativeEnum(ConfidenceLevel);

/**
 * Zod schema for DiscretionTier enum
 */
export const discretionTierSchema = z.nativeEnum(DiscretionTier);

/**
 * Zod schema for HumanResult enum
 */
export const humanResultSchema = z.nativeEnum(HumanResult);

/**
 * Zod schema for ReviewStatus enum
 */
export const reviewStatusSchema = z.nativeEnum(ReviewStatus);

/**
 * Zod schema for EvidenceSufficiency enum
 */
export const evidenceSufficiencySchema = z.nativeEnum(EvidenceSufficiency);

// ============================================================================
// Judgment Schemas
// ============================================================================

/**
 * Schema for creating a new judgment (POST /api/judgments)
 *
 * Validates that:
 * - assessmentId is a positive integer
 * - humanResult is a valid enum value
 * - overrideReason is required when overriding AI result
 * - Notes have reasonable length limits
 */
export const createJudgmentSchema = z
  .object({
    assessmentId: z
      .number()
      .int('Assessment ID must be an integer')
      .positive('Assessment ID must be positive'),

    humanResult: humanResultSchema.optional(),

    humanConfidence: confidenceLevelSchema.optional(),

    judgmentNotes: z
      .string()
      .max(5000, 'Judgment notes must be 5000 characters or less')
      .trim()
      .optional(),

    overrideReason: z
      .string()
      .max(2000, 'Override reason must be 2000 characters or less')
      .trim()
      .optional(),

    evidenceSufficiency: evidenceSufficiencySchema.optional(),

    includeInFinal: z.boolean().optional(),

    finalMemoSummary: z
      .string()
      .max(5000, 'Final memo summary must be 5000 characters or less')
      .trim()
      .optional(),

    followUpNeeded: z.boolean().optional(),

    routedTo: z
      .string()
      .max(100, 'Routed to must be 100 characters or less')
      .trim()
      .optional(),

    routingReason: z
      .string()
      .max(500, 'Routing reason must be 500 characters or less')
      .trim()
      .optional(),
  })
  .refine(
    (data) => {
      // If overriding (OVERRIDE_PASS or OVERRIDE_FAIL), require an explanation
      if (
        data.humanResult === HumanResult.OVERRIDE_PASS ||
        data.humanResult === HumanResult.OVERRIDE_FAIL
      ) {
        return (
          data.overrideReason !== undefined &&
          data.overrideReason.trim().length >= 10
        );
      }
      return true;
    },
    {
      message:
        'Override reason is required (minimum 10 characters) when overriding AI result',
      path: ['overrideReason'],
    }
  )
  .refine(
    (data) => {
      // If routing to someone, require a routing reason
      if (data.routedTo && data.routedTo.trim().length > 0) {
        return (
          data.routingReason !== undefined &&
          data.routingReason.trim().length > 0
        );
      }
      return true;
    },
    {
      message: 'Routing reason is required when routing to another reviewer',
      path: ['routingReason'],
    }
  );

/**
 * Schema for updating an existing judgment (PATCH /api/judgments/:id)
 *
 * All fields are optional, but same validation rules apply when provided.
 */
export const updateJudgmentSchema = z
  .object({
    humanResult: humanResultSchema.optional(),

    humanConfidence: confidenceLevelSchema.optional(),

    judgmentNotes: z
      .string()
      .max(5000, 'Judgment notes must be 5000 characters or less')
      .trim()
      .optional(),

    overrideReason: z
      .string()
      .max(2000, 'Override reason must be 2000 characters or less')
      .trim()
      .optional(),

    evidenceSufficiency: evidenceSufficiencySchema.optional(),

    includeInFinal: z.boolean().optional(),

    finalMemoSummary: z
      .string()
      .max(5000, 'Final memo summary must be 5000 characters or less')
      .trim()
      .optional(),

    followUpNeeded: z.boolean().optional(),

    routedTo: z
      .string()
      .max(100, 'Routed to must be 100 characters or less')
      .trim()
      .optional(),

    routingReason: z
      .string()
      .max(500, 'Routing reason must be 500 characters or less')
      .trim()
      .optional(),

    reviewStatus: reviewStatusSchema.optional(),
  })
  .refine(
    (data) => {
      // If overriding, require an explanation
      if (
        data.humanResult === HumanResult.OVERRIDE_PASS ||
        data.humanResult === HumanResult.OVERRIDE_FAIL
      ) {
        return (
          data.overrideReason !== undefined &&
          data.overrideReason.trim().length >= 10
        );
      }
      return true;
    },
    {
      message:
        'Override reason is required (minimum 10 characters) when overriding AI result',
      path: ['overrideReason'],
    }
  );

// ============================================================================
// Assessment Filter Schema
// ============================================================================

/**
 * Schema for assessment query parameters
 *
 * Handles both single values and arrays for multi-select filters.
 * Includes pagination parameters.
 */
export const assessmentFilterSchema = z.object({
  // Result filters (supports single or multiple)
  results: z
    .union([assessmentResultSchema, z.array(assessmentResultSchema)])
    .transform((val) => (Array.isArray(val) ? val : [val]))
    .optional(),

  // Confidence filters
  confidenceLevels: z
    .union([confidenceLevelSchema, z.array(confidenceLevelSchema)])
    .transform((val) => (Array.isArray(val) ? val : [val]))
    .optional(),

  // Tier filters
  discretionTiers: z
    .union([discretionTierSchema, z.array(discretionTierSchema)])
    .transform((val) => (Array.isArray(val) ? val : [val]))
    .optional(),

  // Sheet filters (string array)
  sheets: z
    .union([z.string(), z.array(z.string())])
    .transform((val) => (Array.isArray(val) ? val : [val]))
    .optional(),

  // Section filters (string array)
  sections: z
    .union([z.string(), z.array(z.string())])
    .transform((val) => (Array.isArray(val) ? val : [val]))
    .optional(),

  // Review status filters
  reviewStatuses: z
    .union([reviewStatusSchema, z.array(reviewStatusSchema)])
    .transform((val) => (Array.isArray(val) ? val : [val]))
    .optional(),

  // Boolean filter for action required
  hasActionRequired: z
    .union([z.boolean(), z.string().transform((val) => val === 'true')])
    .optional(),

  // Pagination
  offset: z.coerce
    .number()
    .int()
    .min(0, 'Offset must be non-negative')
    .default(0),

  limit: z.coerce
    .number()
    .int()
    .min(1, 'Limit must be at least 1')
    .max(500, 'Limit cannot exceed 500')
    .default(50),

  // Sorting
  sortBy: z
    .enum([
      'itemNumber',
      'section',
      'sheet',
      'aiResult',
      'aiConfidence',
      'discretionTier',
      'evidenceCoverage',
      'reviewStatus',
    ])
    .default('itemNumber'),

  sortOrder: z.enum(['asc', 'desc']).default('asc'),
});

// ============================================================================
// Export Options Schema
// ============================================================================

/**
 * Schema for export endpoint options
 *
 * Validates export format, content selection, and filter criteria.
 */
export const exportOptionsSchema = z.object({
  // Export format
  format: z.enum(['csv', 'xlsx', 'json', 'pdf']).default('csv'),

  // What to include in export
  includeEvidence: z.boolean().default(true),
  includeJudgments: z.boolean().default(true),
  includeLinkedPolicies: z.boolean().default(false),

  // Column selection (empty = all columns)
  columns: z
    .array(
      z.enum([
        'csapId',
        'csapText',
        'section',
        'sheet',
        'itemNumber',
        'aiResult',
        'aiConfidence',
        'discretionTier',
        'evidenceCoverage',
        'regulatoryAuthority',
        'reviewerNotes',
        'actionRequired',
        'humanResult',
        'humanConfidence',
        'judgmentNotes',
        'reviewStatus',
        'reviewedAt',
        'reviewerName',
      ])
    )
    .optional(),

  // Filter by assessment IDs (for exporting specific selections)
  assessmentIds: z
    .array(z.number().int().positive())
    .max(1000, 'Cannot export more than 1000 specific assessments at once')
    .optional(),

  // Or use filter criteria (same as assessment filters)
  filters: assessmentFilterSchema.omit({ offset: true, limit: true }).optional(),

  // Filename (optional, will be generated if not provided)
  filename: z
    .string()
    .max(100, 'Filename must be 100 characters or less')
    .regex(
      /^[a-zA-Z0-9_-]+$/,
      'Filename can only contain letters, numbers, underscores, and hyphens'
    )
    .optional(),
});

// ============================================================================
// Submission Query Schema
// ============================================================================

/**
 * Schema for querying submissions list
 */
export const submissionQuerySchema = z.object({
  // Filter by site
  siteId: z.string().optional(),

  // Filter by submission type
  submissionType: z.string().optional(),

  // Filter by human review requirement
  requiresHumanReview: z
    .union([z.boolean(), z.string().transform((val) => val === 'true')])
    .optional(),

  // Pagination
  offset: z.coerce
    .number()
    .int()
    .min(0, 'Offset must be non-negative')
    .default(0),

  limit: z.coerce
    .number()
    .int()
    .min(1, 'Limit must be at least 1')
    .max(100, 'Limit cannot exceed 100')
    .default(20),

  // Sorting
  sortBy: z
    .enum([
      'submissionId',
      'siteId',
      'submissionType',
      'totalItems',
      'importedAt',
      'evaluationCompleted',
      'overallCoverage',
    ])
    .default('importedAt'),

  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

// ============================================================================
// Type Exports
// ============================================================================

/**
 * Inferred types from schemas for use in API handlers
 */
export type CreateJudgmentInput = z.infer<typeof createJudgmentSchema>;
export type UpdateJudgmentInput = z.infer<typeof updateJudgmentSchema>;
export type AssessmentFilterInput = z.infer<typeof assessmentFilterSchema>;
export type ExportOptionsInput = z.infer<typeof exportOptionsSchema>;
export type SubmissionQueryInput = z.infer<typeof submissionQuerySchema>;

// ============================================================================
// Validation Helpers
// ============================================================================

/**
 * Parse and validate JSON body for judgment creation
 */
export function parseCreateJudgment(
  data: unknown
): { data?: CreateJudgmentInput; error?: string } {
  const result = createJudgmentSchema.safeParse(data);
  if (result.success) {
    return { data: result.data };
  }
  const firstError = result.error.issues[0];
  return {
    error: firstError
      ? `${firstError.path.join('.')}: ${firstError.message}`
      : 'Validation failed',
  };
}

/**
 * Parse and validate JSON body for judgment update
 */
export function parseUpdateJudgment(
  data: unknown
): { data?: UpdateJudgmentInput; error?: string } {
  const result = updateJudgmentSchema.safeParse(data);
  if (result.success) {
    return { data: result.data };
  }
  const firstError = result.error.issues[0];
  return {
    error: firstError
      ? `${firstError.path.join('.')}: ${firstError.message}`
      : 'Validation failed',
  };
}

/**
 * Parse and validate query parameters for assessment filtering
 */
export function parseAssessmentFilters(
  params: Record<string, unknown>
): { data?: AssessmentFilterInput; error?: string } {
  const result = assessmentFilterSchema.safeParse(params);
  if (result.success) {
    return { data: result.data };
  }
  const firstError = result.error.issues[0];
  return {
    error: firstError
      ? `${firstError.path.join('.')}: ${firstError.message}`
      : 'Validation failed',
  };
}

/**
 * Parse and validate export options
 */
export function parseExportOptions(
  data: unknown
): { data?: ExportOptionsInput; error?: string } {
  const result = exportOptionsSchema.safeParse(data);
  if (result.success) {
    return { data: result.data };
  }
  const firstError = result.error.issues[0];
  return {
    error: firstError
      ? `${firstError.path.join('.')}: ${firstError.message}`
      : 'Validation failed',
  };
}
