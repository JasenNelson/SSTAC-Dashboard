/**
 * Tests for Tier Logic
 *
 * Validates the three-tier discretion model for AI authority constraints.
 * These tests ensure:
 * - TIER_1_BINARY: AI has full authority for binary items
 * - TIER_2_PROFESSIONAL: AI flags only, cannot return ADEQUATE
 * - TIER_3_STATUTORY: AI observes only, cannot evaluate (Indigenous/Section 35)
 */

import { describe, it, expect } from 'vitest';
import {
  requiresHumanReview,
  getRoutingTarget,
  getRoutingReason,
  getAllowedActionsByTier,
  validateJudgmentAgainstTier,
  validateAssessmentJudgment,
  detectIndigenousContent,
  formatTierName,
  getTierColor,
  getResultColor,
  getConfidenceColor,
  calculateReviewPriority,
  sortByReviewPriority,
} from './tier-logic';
import {
  AssessmentResult,
  ConfidenceLevel,
  DiscretionTier,
  HumanResult,
  type Assessment,
} from './types';

// ============================================================================
// Test Data Factories
// ============================================================================

function createMockAssessment(
  overrides?: Partial<Assessment>
): Assessment {
  return {
    id: 'test-123',
    submissionId: 'sub-123',
    policyId: 'policy-123',
    policyText: 'Test policy',
    requirementText: 'Test requirement',
    discretionTier: DiscretionTier.TIER_1_BINARY,
    aiResult: AssessmentResult.PASS,
    aiConfidence: ConfidenceLevel.HIGH,
    aiExplanation: 'Test explanation',
    evidenceCoverage: 100,
    humanResult: null,
    humanExplanation: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

// ============================================================================
// requiresHumanReview Tests
// ============================================================================

describe('requiresHumanReview', () => {
  describe('TIER_1_BINARY', () => {
    it('returns false when result is PASS (AI has authority)', () => {
      expect(
        requiresHumanReview(
          DiscretionTier.TIER_1_BINARY,
          AssessmentResult.PASS
        )
      ).toBe(false);
    });

    it('returns true when result is FAIL', () => {
      expect(
        requiresHumanReview(
          DiscretionTier.TIER_1_BINARY,
          AssessmentResult.FAIL
        )
      ).toBe(true);
    });

    it('returns true when result is PARTIAL', () => {
      expect(
        requiresHumanReview(
          DiscretionTier.TIER_1_BINARY,
          AssessmentResult.PARTIAL
        )
      ).toBe(true);
    });

    it('returns true when result is REQUIRES_JUDGMENT', () => {
      expect(
        requiresHumanReview(
          DiscretionTier.TIER_1_BINARY,
          AssessmentResult.REQUIRES_JUDGMENT
        )
      ).toBe(true);
    });
  });

  describe('TIER_2_PROFESSIONAL', () => {
    it('always returns true (requires professional judgment)', () => {
      expect(
        requiresHumanReview(
          DiscretionTier.TIER_2_PROFESSIONAL,
          AssessmentResult.PASS
        )
      ).toBe(true);
      expect(
        requiresHumanReview(
          DiscretionTier.TIER_2_PROFESSIONAL,
          AssessmentResult.FAIL
        )
      ).toBe(true);
    });
  });

  describe('TIER_3_STATUTORY', () => {
    it('always returns true (requires SDM determination)', () => {
      expect(
        requiresHumanReview(
          DiscretionTier.TIER_3_STATUTORY,
          AssessmentResult.PASS
        )
      ).toBe(true);
      expect(
        requiresHumanReview(
          DiscretionTier.TIER_3_STATUTORY,
          AssessmentResult.FAIL
        )
      ).toBe(true);
    });
  });
});

// ============================================================================
// getRoutingTarget Tests
// ============================================================================

describe('getRoutingTarget', () => {
  it('returns "Reviewer" for TIER_1_BINARY', () => {
    expect(getRoutingTarget(DiscretionTier.TIER_1_BINARY)).toBe('Reviewer');
  });

  it('returns "Qualified Professional" for TIER_2_PROFESSIONAL', () => {
    expect(getRoutingTarget(DiscretionTier.TIER_2_PROFESSIONAL)).toBe(
      'Qualified Professional'
    );
  });

  it('returns "Statutory Decision Maker" for TIER_3_STATUTORY', () => {
    expect(getRoutingTarget(DiscretionTier.TIER_3_STATUTORY)).toBe(
      'Statutory Decision Maker'
    );
  });

  it('defaults to "Reviewer" for unknown tier', () => {
    const unknownTier = 'UNKNOWN_TIER' as DiscretionTier;
    expect(getRoutingTarget(unknownTier)).toBe('Reviewer');
  });
});

// ============================================================================
// getRoutingReason Tests
// ============================================================================

describe('getRoutingReason', () => {
  describe('TIER_1_BINARY reasons', () => {
    it('returns FAIL-specific reason', () => {
      const reason = getRoutingReason(
        DiscretionTier.TIER_1_BINARY,
        AssessmentResult.FAIL
      );
      expect(reason).toContain('Binary requirement not met');
    });

    it('returns PARTIAL-specific reason', () => {
      const reason = getRoutingReason(
        DiscretionTier.TIER_1_BINARY,
        AssessmentResult.PARTIAL
      );
      expect(reason).toContain('Binary requirement partially met');
    });

    it('returns generic reason for PASS', () => {
      const reason = getRoutingReason(
        DiscretionTier.TIER_1_BINARY,
        AssessmentResult.PASS
      );
      expect(reason).toContain('Review flagged assessment');
    });
  });

  describe('TIER_2_PROFESSIONAL reasons', () => {
    it('returns professional judgment required reason', () => {
      const reason = getRoutingReason(
        DiscretionTier.TIER_2_PROFESSIONAL,
        AssessmentResult.PASS
      );
      expect(reason).toContain('Professional judgment required');
    });
  });

  describe('TIER_3_STATUTORY reasons', () => {
    it('returns statutory decision reason', () => {
      const reason = getRoutingReason(
        DiscretionTier.TIER_3_STATUTORY,
        AssessmentResult.PASS
      );
      expect(reason).toContain('Statutory decision required');
    });
  });
});

// ============================================================================
// getAllowedActionsByTier Tests
// ============================================================================

describe('getAllowedActionsByTier', () => {
  describe('TIER_1_BINARY actions', () => {
    const actions = getAllowedActionsByTier(DiscretionTier.TIER_1_BINARY);

    it('allows accepting AI result', () => {
      expect(actions.canAccept).toBe(true);
    });

    it('allows overriding to PASS', () => {
      expect(actions.canOverridePass).toBe(true);
    });

    it('allows overriding to FAIL', () => {
      expect(actions.canOverrideFail).toBe(true);
    });

    it('allows deferring', () => {
      expect(actions.canDefer).toBe(true);
    });

    it('includes all actions in availableResults', () => {
      expect(actions.availableResults).toContain(HumanResult.ACCEPT);
      expect(actions.availableResults).toContain(HumanResult.OVERRIDE_PASS);
      expect(actions.availableResults).toContain(HumanResult.OVERRIDE_FAIL);
      expect(actions.availableResults).toContain(HumanResult.DEFER);
    });

    it('requires Reviewer role', () => {
      expect(actions.requiredRole).toBe('Reviewer');
    });

    it('does not have warning message', () => {
      expect(actions.warningMessage).toBeUndefined();
    });
  });

  describe('TIER_2_PROFESSIONAL actions', () => {
    const actions = getAllowedActionsByTier(DiscretionTier.TIER_2_PROFESSIONAL);

    it('allows accepting and overriding', () => {
      expect(actions.canAccept).toBe(true);
      expect(actions.canOverridePass).toBe(true);
      expect(actions.canOverrideFail).toBe(true);
    });

    it('requires Qualified Professional role', () => {
      expect(actions.requiredRole).toBe('Qualified Professional');
    });

    it('includes warning about professional judgment', () => {
      expect(actions.warningMessage).toContain('professional judgment');
    });
  });

  describe('TIER_3_STATUTORY actions', () => {
    const actions = getAllowedActionsByTier(DiscretionTier.TIER_3_STATUTORY);

    it('does NOT allow accepting AI observation', () => {
      expect(actions.canAccept).toBe(false);
    });

    it('allows overriding (making determination)', () => {
      expect(actions.canOverridePass).toBe(true);
      expect(actions.canOverrideFail).toBe(true);
    });

    it('only includes override actions and defer', () => {
      expect(actions.availableResults).not.toContain(HumanResult.ACCEPT);
      expect(actions.availableResults).toContain(HumanResult.OVERRIDE_PASS);
      expect(actions.availableResults).toContain(HumanResult.OVERRIDE_FAIL);
      expect(actions.availableResults).toContain(HumanResult.DEFER);
    });

    it('requires Statutory Decision Maker role', () => {
      expect(actions.requiredRole).toBe('Statutory Decision Maker');
    });

    it('includes STATUTORY warning message', () => {
      expect(actions.warningMessage).toContain('STATUTORY');
    });
  });

  describe('unknown tier', () => {
    const actions = getAllowedActionsByTier('UNKNOWN' as DiscretionTier);

    it('defaults to most restrictive (only defer)', () => {
      expect(actions.canAccept).toBe(false);
      expect(actions.canOverridePass).toBe(false);
      expect(actions.availableResults).toEqual([HumanResult.DEFER]);
    });

    it('includes escalation warning', () => {
      expect(actions.warningMessage).toContain('escalate');
    });
  });
});

// ============================================================================
// validateJudgmentAgainstTier Tests
// ============================================================================

describe('validateJudgmentAgainstTier', () => {
  describe('TIER_1_BINARY validation', () => {
    it('allows ACCEPT for TIER_1', () => {
      const result = validateJudgmentAgainstTier(
        DiscretionTier.TIER_1_BINARY,
        HumanResult.ACCEPT
      );
      expect(result.isValid).toBe(true);
    });

    it('allows OVERRIDE_PASS with sufficient explanation', () => {
      const result = validateJudgmentAgainstTier(
        DiscretionTier.TIER_1_BINARY,
        HumanResult.OVERRIDE_PASS,
        'Override because evidence shows requirement is met'
      );
      expect(result.isValid).toBe(true);
    });

    it('rejects OVERRIDE without explanation', () => {
      const result = validateJudgmentAgainstTier(
        DiscretionTier.TIER_1_BINARY,
        HumanResult.OVERRIDE_PASS
      );
      expect(result.isValid).toBe(false);
      expect(result.errorMessage).toContain('Override requires an explanation');
    });

    it('rejects OVERRIDE with insufficient explanation (<10 chars)', () => {
      const result = validateJudgmentAgainstTier(
        DiscretionTier.TIER_1_BINARY,
        HumanResult.OVERRIDE_PASS,
        'Too short'
      );
      expect(result.isValid).toBe(false);
      expect(result.errorMessage).toContain('10 characters');
    });

    it('allows DEFER', () => {
      const result = validateJudgmentAgainstTier(
        DiscretionTier.TIER_1_BINARY,
        HumanResult.DEFER
      );
      expect(result.isValid).toBe(true);
    });
  });

  describe('TIER_2_PROFESSIONAL validation', () => {
    it('allows ACCEPT', () => {
      const result = validateJudgmentAgainstTier(
        DiscretionTier.TIER_2_PROFESSIONAL,
        HumanResult.ACCEPT
      );
      expect(result.isValid).toBe(true);
      expect(result.warningMessage).toContain('professional judgment');
    });

    it('includes warning message', () => {
      const result = validateJudgmentAgainstTier(
        DiscretionTier.TIER_2_PROFESSIONAL,
        HumanResult.OVERRIDE_PASS,
        'Sufficient explanation of adequacy'
      );
      expect(result.isValid).toBe(true);
      expect(result.warningMessage).toBeDefined();
    });
  });

  describe('TIER_3_STATUTORY validation', () => {
    it('rejects ACCEPT (cannot accept AI observation)', () => {
      const result = validateJudgmentAgainstTier(
        DiscretionTier.TIER_3_STATUTORY,
        HumanResult.ACCEPT
      );
      expect(result.isValid).toBe(false);
      // Error comes from allowed actions check
      expect(result.errorMessage).toContain('not allowed');
    });

    it('allows OVERRIDE_PASS with explanation', () => {
      const result = validateJudgmentAgainstTier(
        DiscretionTier.TIER_3_STATUTORY,
        HumanResult.OVERRIDE_PASS,
        'SDM determines this requirement is met based on consultation'
      );
      expect(result.isValid).toBe(true);
    });

    it('allows OVERRIDE_FAIL with explanation', () => {
      const result = validateJudgmentAgainstTier(
        DiscretionTier.TIER_3_STATUTORY,
        HumanResult.OVERRIDE_FAIL,
        'SDM determines this requirement is not met'
      );
      expect(result.isValid).toBe(true);
    });

    it('allows DEFER', () => {
      const result = validateJudgmentAgainstTier(
        DiscretionTier.TIER_3_STATUTORY,
        HumanResult.DEFER
      );
      expect(result.isValid).toBe(true);
    });

    it('includes STATUTORY warning', () => {
      const result = validateJudgmentAgainstTier(
        DiscretionTier.TIER_3_STATUTORY,
        HumanResult.OVERRIDE_PASS,
        'Valid determination'
      );
      expect(result.warningMessage).toContain('STATUTORY');
    });
  });

  describe('invalid actions by tier', () => {
    it('rejects ACCEPT for TIER_3', () => {
      const result = validateJudgmentAgainstTier(
        DiscretionTier.TIER_3_STATUTORY,
        HumanResult.ACCEPT
      );
      expect(result.isValid).toBe(false);
    });

    it('includes helpful error message about allowed actions', () => {
      const result = validateJudgmentAgainstTier(
        DiscretionTier.TIER_3_STATUTORY,
        HumanResult.ACCEPT
      );
      expect(result.errorMessage).toBeDefined();
    });
  });
});

// ============================================================================
// validateAssessmentJudgment Tests
// ============================================================================

describe('validateAssessmentJudgment', () => {
  it('uses assessment tier for validation', () => {
    const assessment = createMockAssessment({
      discretionTier: DiscretionTier.TIER_3_STATUTORY,
    });

    const result = validateAssessmentJudgment(
      assessment,
      HumanResult.ACCEPT
    );
    expect(result.isValid).toBe(false);
    expect(result.errorMessage).toBeDefined();
    expect(result.errorMessage).toContain('not allowed');
  });

  it('passes through explanation to validation', () => {
    const assessment = createMockAssessment({
      discretionTier: DiscretionTier.TIER_1_BINARY,
    });

    const result = validateAssessmentJudgment(
      assessment,
      HumanResult.OVERRIDE_PASS,
      'Too short'
    );
    expect(result.isValid).toBe(false);
    expect(result.errorMessage).toContain('10 characters');
  });
});

// ============================================================================
// detectIndigenousContent Tests
// ============================================================================

describe('detectIndigenousContent', () => {
  describe('keyword detection', () => {
    it('detects "indigenous"', () => {
      const result = detectIndigenousContent('This relates to indigenous peoples');
      expect(result.isIndigenous).toBe(true);
      expect(result.matchedKeywords).toContain('indigenous');
    });

    it('detects "first nation"', () => {
      const result = detectIndigenousContent('First nation consultation required');
      expect(result.isIndigenous).toBe(true);
      expect(result.matchedKeywords.some(k => k.includes('first nation'))).toBe(true);
    });

    it('detects "treaty"', () => {
      const result = detectIndigenousContent('Treaty rights must be respected');
      expect(result.isIndigenous).toBe(true);
      expect(result.matchedKeywords).toContain('treaty');
    });

    it('detects "métis"', () => {
      const result = detectIndigenousContent('Métis harvesting rights');
      expect(result.isIndigenous).toBe(true);
    });

    it('detects "section 35"', () => {
      const result = detectIndigenousContent('Section 35 rights apply');
      expect(result.isIndigenous).toBe(true);
      expect(result.matchedKeywords).toContain('section 35');
    });

    it('detects "duty to consult"', () => {
      const result = detectIndigenousContent('Duty to consult applies here');
      expect(result.isIndigenous).toBe(true);
      expect(result.matchedKeywords).toContain('duty to consult');
    });

    it('detects "undrip"', () => {
      const result = detectIndigenousContent('UNDRIP principles guide this assessment');
      expect(result.isIndigenous).toBe(true);
      expect(result.matchedKeywords).toContain('undrip');
    });

    it('detects "traditional knowledge"', () => {
      const result = detectIndigenousContent('Traditional knowledge is essential');
      expect(result.isIndigenous).toBe(true);
      expect(result.matchedKeywords).toContain('traditional knowledge');
    });

    it('is case-insensitive', () => {
      const result = detectIndigenousContent('INDIGENOUS PEOPLES AND ABORIGINAL RIGHTS');
      expect(result.isIndigenous).toBe(true);
      expect(result.matchedKeywords.length).toBeGreaterThan(0);
    });
  });

  describe('no indigenous content', () => {
    it('returns false when no keywords match', () => {
      const result = detectIndigenousContent('This is a regular policy about buildings');
      expect(result.isIndigenous).toBe(false);
      expect(result.matchedKeywords).toEqual([]);
    });

    it('returns TIER_1 as recommended tier when not indigenous', () => {
      const result = detectIndigenousContent('Generic policy text');
      expect(result.recommendedTier).toBe(DiscretionTier.TIER_1_BINARY);
    });
  });

  describe('tier elevation', () => {
    it('auto-elevates to TIER_3 when indigenous', () => {
      const result = detectIndigenousContent('Indigenous content detected');
      expect(result.recommendedTier).toBe(DiscretionTier.TIER_3_STATUTORY);
    });

    it('includes routing message for indigenous', () => {
      const result = detectIndigenousContent('Indigenous content');
      expect(result.routingMessage).toBeDefined();
      expect(result.routingMessage).toContain('TIER_3');
    });

    it('mentions SDM in routing message', () => {
      const result = detectIndigenousContent('First nations');
      expect(result.routingMessage).toContain('Statutory Decision Maker');
    });
  });

  describe('multiple keywords', () => {
    it('detects multiple matches', () => {
      const result = detectIndigenousContent(
        'Indigenous peoples and Aboriginal rights under Section 35'
      );
      expect(result.matchedKeywords.length).toBeGreaterThanOrEqual(2);
    });
  });
});

// ============================================================================
// Formatting Functions Tests
// ============================================================================

describe('formatTierName', () => {
  it('formats TIER_1_BINARY correctly', () => {
    expect(formatTierName(DiscretionTier.TIER_1_BINARY)).toContain(
      'Tier 1'
    );
  });

  it('formats TIER_2_PROFESSIONAL correctly', () => {
    expect(formatTierName(DiscretionTier.TIER_2_PROFESSIONAL)).toContain(
      'Tier 2'
    );
  });

  it('formats TIER_3_STATUTORY correctly', () => {
    expect(formatTierName(DiscretionTier.TIER_3_STATUTORY)).toContain(
      'Tier 3'
    );
  });

  it('includes descriptive text', () => {
    expect(formatTierName(DiscretionTier.TIER_1_BINARY)).toContain('Binary');
    expect(formatTierName(DiscretionTier.TIER_2_PROFESSIONAL)).toContain(
      'Professional'
    );
    expect(formatTierName(DiscretionTier.TIER_3_STATUTORY)).toContain(
      'Statutory'
    );
  });
});

describe('getTierColor', () => {
  it('returns colors for TIER_1_BINARY', () => {
    const colors = getTierColor(DiscretionTier.TIER_1_BINARY);
    expect(colors.bg).toBe('bg-green-100');
    expect(colors.text).toBe('text-green-800');
    expect(colors.border).toBe('border-green-300');
  });

  it('returns colors for TIER_2_PROFESSIONAL', () => {
    const colors = getTierColor(DiscretionTier.TIER_2_PROFESSIONAL);
    expect(colors.bg).toBe('bg-yellow-100');
    expect(colors.text).toBe('text-yellow-800');
    expect(colors.border).toBe('border-yellow-300');
  });

  it('returns colors for TIER_3_STATUTORY', () => {
    const colors = getTierColor(DiscretionTier.TIER_3_STATUTORY);
    expect(colors.bg).toBe('bg-red-100');
    expect(colors.text).toBe('text-red-800');
    expect(colors.border).toBe('border-red-300');
  });

  it('returns gray for unknown tier', () => {
    const colors = getTierColor('UNKNOWN' as DiscretionTier);
    expect(colors.bg).toContain('gray');
  });
});

describe('getResultColor', () => {
  it('returns green for PASS', () => {
    const colors = getResultColor(AssessmentResult.PASS);
    expect(colors.bg).toContain('green');
  });

  it('returns yellow for PARTIAL', () => {
    const colors = getResultColor(AssessmentResult.PARTIAL);
    expect(colors.bg).toContain('yellow');
  });

  it('returns red for FAIL', () => {
    const colors = getResultColor(AssessmentResult.FAIL);
    expect(colors.bg).toContain('red');
  });

  it('returns purple for REQUIRES_JUDGMENT', () => {
    const colors = getResultColor(AssessmentResult.REQUIRES_JUDGMENT);
    expect(colors.bg).toContain('purple');
  });
});

describe('getConfidenceColor', () => {
  it('returns green for HIGH confidence', () => {
    const colors = getConfidenceColor(ConfidenceLevel.HIGH);
    expect(colors.bg).toContain('green');
  });

  it('returns yellow for MEDIUM confidence', () => {
    const colors = getConfidenceColor(ConfidenceLevel.MEDIUM);
    expect(colors.bg).toContain('yellow');
  });

  it('returns orange for LOW confidence', () => {
    const colors = getConfidenceColor(ConfidenceLevel.LOW);
    expect(colors.bg).toContain('orange');
  });

  it('returns gray for NONE confidence', () => {
    const colors = getConfidenceColor(ConfidenceLevel.NONE);
    expect(colors.bg).toContain('gray');
  });
});

// ============================================================================
// Review Priority Tests
// ============================================================================

describe('calculateReviewPriority', () => {
  describe('tier weighting (0-30)', () => {
    it('gives highest weight to TIER_3', () => {
      const tier3 = createMockAssessment({
        discretionTier: DiscretionTier.TIER_3_STATUTORY,
        aiResult: AssessmentResult.PASS,
        aiConfidence: ConfidenceLevel.HIGH,
        evidenceCoverage: 100,
      });

      const tier1 = createMockAssessment({
        discretionTier: DiscretionTier.TIER_1_BINARY,
        aiResult: AssessmentResult.PASS,
        aiConfidence: ConfidenceLevel.HIGH,
        evidenceCoverage: 100,
      });

      expect(calculateReviewPriority(tier3)).toBeGreaterThan(
        calculateReviewPriority(tier1)
      );
    });

    it('tier scores: TIER_3(30) > TIER_2(20) > TIER_1(10)', () => {
      const basescore = (tier: DiscretionTier) =>
        calculateReviewPriority(
          createMockAssessment({
            discretionTier: tier,
            aiResult: AssessmentResult.PASS,
            aiConfidence: ConfidenceLevel.HIGH,
            evidenceCoverage: 100,
          })
        );

      expect(basescore(DiscretionTier.TIER_3_STATUTORY)).toBeGreaterThan(
        basescore(DiscretionTier.TIER_2_PROFESSIONAL)
      );
      expect(basescore(DiscretionTier.TIER_2_PROFESSIONAL)).toBeGreaterThan(
        basescore(DiscretionTier.TIER_1_BINARY)
      );
    });
  });

  describe('result weighting (0-40)', () => {
    it('gives highest weight to FAIL', () => {
      const fail = createMockAssessment({
        discretionTier: DiscretionTier.TIER_1_BINARY,
        aiResult: AssessmentResult.FAIL,
        aiConfidence: ConfidenceLevel.HIGH,
        evidenceCoverage: 100,
      });

      const pass = createMockAssessment({
        discretionTier: DiscretionTier.TIER_1_BINARY,
        aiResult: AssessmentResult.PASS,
        aiConfidence: ConfidenceLevel.HIGH,
        evidenceCoverage: 100,
      });

      expect(calculateReviewPriority(fail)).toBeGreaterThan(
        calculateReviewPriority(pass)
      );
    });

    it('result scores: FAIL(40) > REQUIRES_JUDGMENT(30) > PARTIAL(20) > PASS(0)', () => {
      const score = (result: AssessmentResult) =>
        calculateReviewPriority(
          createMockAssessment({
            discretionTier: DiscretionTier.TIER_1_BINARY,
            aiResult: result,
            aiConfidence: ConfidenceLevel.HIGH,
            evidenceCoverage: 100,
          })
        );

      expect(score(AssessmentResult.FAIL)).toBeGreaterThan(
        score(AssessmentResult.REQUIRES_JUDGMENT)
      );
      expect(score(AssessmentResult.REQUIRES_JUDGMENT)).toBeGreaterThan(
        score(AssessmentResult.PARTIAL)
      );
      expect(score(AssessmentResult.PARTIAL)).toBeGreaterThan(
        score(AssessmentResult.PASS)
      );
    });
  });

  describe('confidence weighting (0-20, inverse)', () => {
    it('gives highest weight to LOW confidence', () => {
      const lowConfidence = createMockAssessment({
        discretionTier: DiscretionTier.TIER_1_BINARY,
        aiResult: AssessmentResult.PASS,
        aiConfidence: ConfidenceLevel.LOW,
        evidenceCoverage: 100,
      });

      const highConfidence = createMockAssessment({
        discretionTier: DiscretionTier.TIER_1_BINARY,
        aiResult: AssessmentResult.PASS,
        aiConfidence: ConfidenceLevel.HIGH,
        evidenceCoverage: 100,
      });

      expect(calculateReviewPriority(lowConfidence)).toBeGreaterThan(
        calculateReviewPriority(highConfidence)
      );
    });

    it('confidence scores: NONE(20) > LOW(15) > MEDIUM(5) > HIGH(0)', () => {
      const score = (confidence: ConfidenceLevel) =>
        calculateReviewPriority(
          createMockAssessment({
            discretionTier: DiscretionTier.TIER_1_BINARY,
            aiResult: AssessmentResult.PASS,
            aiConfidence: confidence,
            evidenceCoverage: 100,
          })
        );

      expect(score(ConfidenceLevel.NONE)).toBeGreaterThan(
        score(ConfidenceLevel.LOW)
      );
      expect(score(ConfidenceLevel.LOW)).toBeGreaterThan(
        score(ConfidenceLevel.MEDIUM)
      );
      expect(score(ConfidenceLevel.MEDIUM)).toBeGreaterThan(
        score(ConfidenceLevel.HIGH)
      );
    });
  });

  describe('evidence coverage weighting (0-10, inverse)', () => {
    it('gives higher weight to lower coverage', () => {
      const lowCoverage = createMockAssessment({
        discretionTier: DiscretionTier.TIER_1_BINARY,
        aiResult: AssessmentResult.PASS,
        aiConfidence: ConfidenceLevel.HIGH,
        evidenceCoverage: 10,
      });

      const highCoverage = createMockAssessment({
        discretionTier: DiscretionTier.TIER_1_BINARY,
        aiResult: AssessmentResult.PASS,
        aiConfidence: ConfidenceLevel.HIGH,
        evidenceCoverage: 100,
      });

      expect(calculateReviewPriority(lowCoverage)).toBeGreaterThan(
        calculateReviewPriority(highCoverage)
      );
    });

    it('handles edge cases: 0% coverage', () => {
      const zeroCoverage = createMockAssessment({
        discretionTier: DiscretionTier.TIER_1_BINARY,
        aiResult: AssessmentResult.PASS,
        aiConfidence: ConfidenceLevel.HIGH,
        evidenceCoverage: 0,
      });

      expect(calculateReviewPriority(zeroCoverage)).toBeGreaterThan(0);
    });

    it('handles edge cases: 100% coverage', () => {
      const fullCoverage = createMockAssessment({
        discretionTier: DiscretionTier.TIER_1_BINARY,
        aiResult: AssessmentResult.PASS,
        aiConfidence: ConfidenceLevel.HIGH,
        evidenceCoverage: 100,
      });

      expect(calculateReviewPriority(fullCoverage)).toBeLessThanOrEqual(10);
    });
  });

  describe('combined priority scenarios', () => {
    it('prioritizes TIER_3 FAIL over TIER_1 PASS', () => {
      const tier3Fail = createMockAssessment({
        discretionTier: DiscretionTier.TIER_3_STATUTORY,
        aiResult: AssessmentResult.FAIL,
        aiConfidence: ConfidenceLevel.HIGH,
        evidenceCoverage: 100,
      });

      const tier1Pass = createMockAssessment({
        discretionTier: DiscretionTier.TIER_1_BINARY,
        aiResult: AssessmentResult.PASS,
        aiConfidence: ConfidenceLevel.HIGH,
        evidenceCoverage: 100,
      });

      expect(calculateReviewPriority(tier3Fail)).toBeGreaterThan(
        calculateReviewPriority(tier1Pass)
      );
    });

    it('prioritizes TIER_1 FAIL over TIER_1 PASS', () => {
      const fail = createMockAssessment({
        discretionTier: DiscretionTier.TIER_1_BINARY,
        aiResult: AssessmentResult.FAIL,
        aiConfidence: ConfidenceLevel.HIGH,
        evidenceCoverage: 100,
      });

      const pass = createMockAssessment({
        discretionTier: DiscretionTier.TIER_1_BINARY,
        aiResult: AssessmentResult.PASS,
        aiConfidence: ConfidenceLevel.HIGH,
        evidenceCoverage: 100,
      });

      expect(calculateReviewPriority(fail)).toBeGreaterThan(
        calculateReviewPriority(pass)
      );
    });
  });
});

describe('sortByReviewPriority', () => {
  it('returns new array (does not mutate input)', () => {
    const assessments = [
      createMockAssessment({ discretionTier: DiscretionTier.TIER_1_BINARY }),
      createMockAssessment({ discretionTier: DiscretionTier.TIER_3_STATUTORY }),
    ];
    const original = [...assessments];
    const sorted = sortByReviewPriority(assessments);

    expect(assessments).toEqual(original);
    expect(sorted).not.toBe(assessments);
  });

  it('sorts by priority highest first', () => {
    const tier1Pass = createMockAssessment({
      discretionTier: DiscretionTier.TIER_1_BINARY,
      aiResult: AssessmentResult.PASS,
      aiConfidence: ConfidenceLevel.HIGH,
      evidenceCoverage: 100,
    });

    const tier3Fail = createMockAssessment({
      discretionTier: DiscretionTier.TIER_3_STATUTORY,
      aiResult: AssessmentResult.FAIL,
      aiConfidence: ConfidenceLevel.LOW,
      evidenceCoverage: 0,
    });

    const tier2Partial = createMockAssessment({
      discretionTier: DiscretionTier.TIER_2_PROFESSIONAL,
      aiResult: AssessmentResult.PARTIAL,
      aiConfidence: ConfidenceLevel.MEDIUM,
      evidenceCoverage: 50,
    });

    const sorted = sortByReviewPriority([tier1Pass, tier3Fail, tier2Partial]);

    // tier3Fail should be first (highest priority)
    expect(sorted[0]).toEqual(tier3Fail);
    // tier1Pass should be last (lowest priority)
    expect(sorted[sorted.length - 1]).toEqual(tier1Pass);
  });

  it('handles empty array', () => {
    const sorted = sortByReviewPriority([]);
    expect(sorted).toEqual([]);
  });

  it('handles single item', () => {
    const assessment = createMockAssessment();
    const sorted = sortByReviewPriority([assessment]);
    expect(sorted).toHaveLength(1);
    expect(sorted[0]).toEqual(assessment);
  });
});
