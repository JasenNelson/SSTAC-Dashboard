/**
 * Regulatory Review Tier Logic
 *
 * Implements the three-tier discretion model for AI authority constraints.
 * These functions enforce the architectural constraints that prevent AI
 * from making inappropriate determinations based on discretion tier.
 *
 * Tier Model:
 * - TIER_1_BINARY: AI has full authority (must/shall/required)
 * - TIER_2_PROFESSIONAL: AI flags only, cannot return ADEQUATE (should/sufficient)
 * - TIER_3_STATUTORY: AI observes only, cannot evaluate (may/Director/Indigenous)
 */

import {
  AssessmentResult,
  ConfidenceLevel,
  DiscretionTier,
  HumanResult,
  type Assessment,
} from './types';

// ============================================================================
// Human Review Determination
// ============================================================================

/**
 * Determines if an assessment item requires human review based on its tier
 * and AI result.
 *
 * Rules:
 * - TIER_1_BINARY with PASS: No human review needed (AI has full authority)
 * - TIER_1_BINARY with other results: Human review recommended
 * - TIER_2_PROFESSIONAL: Always requires human review
 * - TIER_3_STATUTORY: Always requires human review (SDM determination)
 *
 * @param tier - The discretion tier of the assessment
 * @param aiResult - The AI's assessment result
 * @returns boolean indicating if human review is required
 */
export function requiresHumanReview(
  tier: DiscretionTier,
  aiResult: AssessmentResult
): boolean {
  switch (tier) {
    case DiscretionTier.TIER_1_BINARY:
      // AI has full authority for binary items that pass
      return aiResult !== AssessmentResult.PASS;

    case DiscretionTier.TIER_2_PROFESSIONAL:
      // Always requires professional judgment
      return true;

    case DiscretionTier.TIER_3_STATUTORY:
      // Always requires SDM determination
      return true;

    default:
      // Unknown tier - require human review to be safe
      return true;
  }
}

/**
 * Determines the routing target for an assessment based on tier.
 *
 * @param tier - The discretion tier
 * @returns The role/position to route the item to
 */
export function getRoutingTarget(tier: DiscretionTier): string {
  switch (tier) {
    case DiscretionTier.TIER_1_BINARY:
      return 'Reviewer';

    case DiscretionTier.TIER_2_PROFESSIONAL:
      return 'Qualified Professional';

    case DiscretionTier.TIER_3_STATUTORY:
      return 'Statutory Decision Maker';

    default:
      return 'Reviewer';
  }
}

/**
 * Gets the reason for routing based on tier and result.
 *
 * @param tier - The discretion tier
 * @param aiResult - The AI's assessment result
 * @returns Human-readable routing reason
 */
export function getRoutingReason(
  tier: DiscretionTier,
  aiResult: AssessmentResult
): string {
  switch (tier) {
    case DiscretionTier.TIER_1_BINARY:
      if (aiResult === AssessmentResult.FAIL) {
        return 'Binary requirement not met - confirm or identify evidence';
      }
      if (aiResult === AssessmentResult.PARTIAL) {
        return 'Binary requirement partially met - verify completeness';
      }
      return 'Review flagged assessment';

    case DiscretionTier.TIER_2_PROFESSIONAL:
      return 'Professional judgment required - AI cannot determine adequacy';

    case DiscretionTier.TIER_3_STATUTORY:
      return 'Statutory decision required - AI observes only';

    default:
      return 'Review required';
  }
}

// ============================================================================
// Allowed Human Actions by Tier
// ============================================================================

/**
 * Configuration for human actions allowed per tier
 */
export interface AllowedActions {
  /** Can accept the AI result as-is */
  canAccept: boolean;
  /** Can override to PASS */
  canOverridePass: boolean;
  /** Can override to FAIL */
  canOverrideFail: boolean;
  /** Can defer to another reviewer */
  canDefer: boolean;
  /** Available result options for UI dropdown */
  availableResults: HumanResult[];
  /** Warning message to display if applicable */
  warningMessage?: string;
  /** Required role for this tier */
  requiredRole: string;
}

/**
 * Gets the allowed human actions based on discretion tier.
 *
 * @param tier - The discretion tier of the assessment
 * @returns Configuration of allowed actions
 */
export function getAllowedActionsByTier(tier: DiscretionTier): AllowedActions {
  switch (tier) {
    case DiscretionTier.TIER_1_BINARY:
      return {
        canAccept: true,
        canOverridePass: true,
        canOverrideFail: true,
        canDefer: true,
        availableResults: [
          HumanResult.ACCEPT,
          HumanResult.OVERRIDE_PASS,
          HumanResult.OVERRIDE_FAIL,
          HumanResult.DEFER,
        ],
        requiredRole: 'Reviewer',
      };

    case DiscretionTier.TIER_2_PROFESSIONAL:
      return {
        canAccept: true,
        canOverridePass: true, // QP can determine adequacy
        canOverrideFail: true,
        canDefer: true,
        availableResults: [
          HumanResult.ACCEPT,
          HumanResult.OVERRIDE_PASS,
          HumanResult.OVERRIDE_FAIL,
          HumanResult.DEFER,
        ],
        warningMessage:
          'This item requires professional judgment. AI cannot determine adequacy - only flag deficiencies.',
        requiredRole: 'Qualified Professional',
      };

    case DiscretionTier.TIER_3_STATUTORY:
      return {
        canAccept: false, // Cannot accept AI observation as determination
        canOverridePass: true, // SDM can make determination
        canOverrideFail: true, // SDM can make determination
        canDefer: true,
        availableResults: [
          HumanResult.OVERRIDE_PASS,
          HumanResult.OVERRIDE_FAIL,
          HumanResult.DEFER,
        ],
        warningMessage:
          'STATUTORY MATTER: This item requires Statutory Decision Maker determination. AI provides observation only.',
        requiredRole: 'Statutory Decision Maker',
      };

    default:
      // Default to most restrictive
      return {
        canAccept: false,
        canOverridePass: false,
        canOverrideFail: false,
        canDefer: true,
        availableResults: [HumanResult.DEFER],
        warningMessage: 'Unknown tier - please escalate',
        requiredRole: 'Administrator',
      };
  }
}

// ============================================================================
// Judgment Validation Against Tier Constraints
// ============================================================================

/**
 * Result of tier constraint validation
 */
export interface TierValidationResult {
  /** Whether the judgment is valid for the tier */
  isValid: boolean;
  /** Error message if invalid */
  errorMessage?: string;
  /** Warning message (valid but should be noted) */
  warningMessage?: string;
}

/**
 * Validates a proposed human judgment against tier constraints.
 *
 * Enforces the core architectural constraints:
 * - TIER_3: Cannot accept AI observation as determination
 * - All tiers: Override requires explanation
 *
 * @param tier - The discretion tier of the assessment
 * @param humanResult - The proposed human result
 * @param overrideReason - The explanation for override (if applicable)
 * @returns Validation result with any errors or warnings
 */
export function validateJudgmentAgainstTier(
  tier: DiscretionTier,
  humanResult: HumanResult,
  overrideReason?: string
): TierValidationResult {
  const allowedActions = getAllowedActionsByTier(tier);

  // Check if the action is allowed for this tier
  if (!allowedActions.availableResults.includes(humanResult)) {
    return {
      isValid: false,
      errorMessage: `${humanResult} is not allowed for ${formatTierName(tier)}. Allowed actions: ${allowedActions.availableResults.join(', ')}`,
    };
  }

  // TIER_3 specific: Cannot simply accept AI observation
  if (tier === DiscretionTier.TIER_3_STATUTORY && humanResult === HumanResult.ACCEPT) {
    return {
      isValid: false,
      errorMessage:
        'Cannot accept AI observation for statutory matters. SDM must make an explicit determination (OVERRIDE_PASS or OVERRIDE_FAIL).',
    };
  }

  // Override requires explanation
  if (
    (humanResult === HumanResult.OVERRIDE_PASS ||
      humanResult === HumanResult.OVERRIDE_FAIL) &&
    (!overrideReason || overrideReason.trim().length < 10)
  ) {
    return {
      isValid: false,
      errorMessage:
        'Override requires an explanation of at least 10 characters documenting the rationale.',
    };
  }

  // Valid with possible warning
  return {
    isValid: true,
    warningMessage: allowedActions.warningMessage,
  };
}

/**
 * Validates a complete assessment object's judgment
 *
 * @param assessment - The full assessment record
 * @param proposedResult - The proposed human result
 * @param overrideReason - The explanation for override
 * @returns Validation result
 */
export function validateAssessmentJudgment(
  assessment: Assessment,
  proposedResult: HumanResult,
  overrideReason?: string
): TierValidationResult {
  return validateJudgmentAgainstTier(
    assessment.discretionTier,
    proposedResult,
    overrideReason
  );
}

// ============================================================================
// Indigenous Content Detection
// ============================================================================

/**
 * Keywords that trigger automatic TIER_3 classification for Indigenous matters.
 * These reflect Section 35 constitutional rights and DRIPA/UNDRIP commitments.
 */
const INDIGENOUS_KEYWORDS = [
  'indigenous',
  'first nation',
  'first nations',
  'aboriginal',
  'treaty',
  'métis',
  'metis',
  'inuit',
  'undrip',
  'dripa',
  'section 35',
  'duty to consult',
  'honour of the crown',
  'traditional territory',
  'traditional territories',
  'traditional knowledge',
  'tek',
  'consent',
  'reconciliation',
  'nation to nation',
  'indigenous rights',
  'aboriginal rights',
  'aboriginal title',
  'reserve',
  'band council',
];

/**
 * Checks if text contains Indigenous-related content that triggers TIER_3.
 *
 * @param text - Text to analyze (typically csapText or related content)
 * @returns Object with detection result and matched keywords
 */
export function detectIndigenousContent(text: string): {
  isIndigenous: boolean;
  matchedKeywords: string[];
  recommendedTier: DiscretionTier;
  routingMessage?: string;
} {
  const lowerText = text.toLowerCase();
  const matchedKeywords = INDIGENOUS_KEYWORDS.filter((keyword) =>
    lowerText.includes(keyword)
  );

  if (matchedKeywords.length > 0) {
    return {
      isIndigenous: true,
      matchedKeywords,
      recommendedTier: DiscretionTier.TIER_3_STATUTORY,
      routingMessage:
        'Indigenous content detected. Auto-elevated to TIER_3. Requires Statutory Decision Maker determination. AI cannot provide adequacy assessment.',
    };
  }

  return {
    isIndigenous: false,
    matchedKeywords: [],
    recommendedTier: DiscretionTier.TIER_1_BINARY, // Default, actual tier set elsewhere
  };
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Formats tier enum to human-readable name
 */
export function formatTierName(tier: DiscretionTier): string {
  switch (tier) {
    case DiscretionTier.TIER_1_BINARY:
      return 'Tier 1 (Binary)';
    case DiscretionTier.TIER_2_PROFESSIONAL:
      return 'Tier 2 (Professional Judgment)';
    case DiscretionTier.TIER_3_STATUTORY:
      return 'Tier 3 (Statutory Decision)';
    default:
      return 'Unknown Tier';
  }
}

/**
 * Gets color coding for tier display
 */
export function getTierColor(tier: DiscretionTier): {
  bg: string;
  text: string;
  border: string;
} {
  switch (tier) {
    case DiscretionTier.TIER_1_BINARY:
      return {
        bg: 'bg-green-100',
        text: 'text-green-800',
        border: 'border-green-300',
      };
    case DiscretionTier.TIER_2_PROFESSIONAL:
      return {
        bg: 'bg-yellow-100',
        text: 'text-yellow-800',
        border: 'border-yellow-300',
      };
    case DiscretionTier.TIER_3_STATUTORY:
      return {
        bg: 'bg-red-100',
        text: 'text-red-800',
        border: 'border-red-300',
      };
    default:
      return {
        bg: 'bg-gray-100',
        text: 'text-gray-800',
        border: 'border-gray-300',
      };
  }
}

/**
 * Gets color coding for assessment result display
 */
export function getResultColor(result: AssessmentResult): {
  bg: string;
  text: string;
  border: string;
} {
  switch (result) {
    case AssessmentResult.PASS:
      return {
        bg: 'bg-green-100',
        text: 'text-green-800',
        border: 'border-green-300',
      };
    case AssessmentResult.PARTIAL:
      return {
        bg: 'bg-yellow-100',
        text: 'text-yellow-800',
        border: 'border-yellow-300',
      };
    case AssessmentResult.FAIL:
      return {
        bg: 'bg-red-100',
        text: 'text-red-800',
        border: 'border-red-300',
      };
    case AssessmentResult.REQUIRES_JUDGMENT:
      return {
        bg: 'bg-purple-100',
        text: 'text-purple-800',
        border: 'border-purple-300',
      };
    default:
      return {
        bg: 'bg-gray-100',
        text: 'text-gray-800',
        border: 'border-gray-300',
      };
  }
}

/**
 * Gets color coding for confidence level display
 */
export function getConfidenceColor(confidence: ConfidenceLevel): {
  bg: string;
  text: string;
} {
  switch (confidence) {
    case ConfidenceLevel.HIGH:
      return { bg: 'bg-green-500', text: 'text-white' };
    case ConfidenceLevel.MEDIUM:
      return { bg: 'bg-yellow-500', text: 'text-black' };
    case ConfidenceLevel.LOW:
      return { bg: 'bg-orange-500', text: 'text-white' };
    case ConfidenceLevel.NONE:
      return { bg: 'bg-gray-400', text: 'text-white' };
    default:
      return { bg: 'bg-gray-300', text: 'text-gray-700' };
  }
}

/**
 * Calculates priority score for review queue ordering.
 * Higher score = higher priority.
 *
 * Factors:
 * - Tier (TIER_3 > TIER_2 > TIER_1)
 * - Result (FAIL > REQUIRES_JUDGMENT > PARTIAL > PASS)
 * - Confidence (lower confidence = higher priority for review)
 * - Evidence coverage (lower coverage = higher priority)
 */
export function calculateReviewPriority(assessment: Assessment): number {
  let score = 0;

  // Tier weight (0-30)
  switch (assessment.discretionTier) {
    case DiscretionTier.TIER_3_STATUTORY:
      score += 30;
      break;
    case DiscretionTier.TIER_2_PROFESSIONAL:
      score += 20;
      break;
    case DiscretionTier.TIER_1_BINARY:
      score += 10;
      break;
  }

  // Result weight (0-40)
  switch (assessment.aiResult) {
    case AssessmentResult.FAIL:
      score += 40;
      break;
    case AssessmentResult.REQUIRES_JUDGMENT:
      score += 30;
      break;
    case AssessmentResult.PARTIAL:
      score += 20;
      break;
    case AssessmentResult.PASS:
      score += 0;
      break;
  }

  // Confidence weight (0-20) - inverse (low confidence = high priority)
  switch (assessment.aiConfidence) {
    case ConfidenceLevel.NONE:
      score += 20;
      break;
    case ConfidenceLevel.LOW:
      score += 15;
      break;
    case ConfidenceLevel.MEDIUM:
      score += 5;
      break;
    case ConfidenceLevel.HIGH:
      score += 0;
      break;
  }

  // Evidence coverage weight (0-10) - inverse
  const coverageScore = Math.round((100 - assessment.evidenceCoverage) / 10);
  score += Math.min(10, Math.max(0, coverageScore));

  return score;
}

/**
 * Sorts assessments by review priority (highest first)
 */
export function sortByReviewPriority(assessments: Assessment[]): Assessment[] {
  return [...assessments].sort(
    (a, b) => calculateReviewPriority(b) - calculateReviewPriority(a)
  );
}
