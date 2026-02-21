import { describe, it, expect } from 'vitest';
import {
  detectIndigenousContent,
  INDIGENOUS_HARD_STOP,
  buildSystemPrompt,
  buildContextPrompt,
} from '../prompts';

describe('detectIndigenousContent', () => {
  it('returns matched keyword for Indigenous content', () => {
    expect(detectIndigenousContent('What about indigenous rights?')).toBe(
      'indigenous'
    );
  });

  it('is case-insensitive', () => {
    expect(detectIndigenousContent('FIRST NATION lands')).toBe('first nation');
  });

  it('returns null for non-Indigenous content', () => {
    expect(detectIndigenousContent('soil contamination levels')).toBeNull();
  });

  it.each([
    ['section 35 constitutional rights', 'section 35'],
    ['DRIPA requirements apply', 'dripa'],
    ['honour of the crown', 'honour of the crown'],
    ['duty to consult triggered', 'duty to consult'],
    ['traditional territory mapping', 'traditional territory'],
    ['metis community input', 'metis'],
  ])('detects "%s" as keyword "%s"', (text, expected) => {
    expect(detectIndigenousContent(text)).toBe(expected);
  });

  it('returns the first matched keyword', () => {
    expect(detectIndigenousContent('indigenous treaty reconciliation')).toBe(
      'indigenous'
    );
  });
});

describe('INDIGENOUS_HARD_STOP', () => {
  it('mentions TIER_3_STATUTORY', () => {
    expect(INDIGENOUS_HARD_STOP).toContain('TIER_3_STATUTORY');
  });

  it('mentions Statutory Decision Maker', () => {
    expect(INDIGENOUS_HARD_STOP).toContain('Statutory Decision Maker');
  });
});

describe('buildSystemPrompt', () => {
  const prompt = buildSystemPrompt();

  it('defines the assistant role', () => {
    expect(prompt).toContain('regulatory research assistant');
  });

  it('includes critical constraints', () => {
    expect(prompt).toContain('CRITICAL CONSTRAINTS');
    expect(prompt).toContain('MUST NOT provide adequacy determinations');
  });

  it('includes tier guidance', () => {
    expect(prompt).toContain('TIER_2_PROFESSIONAL');
    expect(prompt).toContain('TIER_3_STATUTORY');
  });

  it('includes citation instructions', () => {
    expect(prompt).toContain('cite your sources');
  });
});

describe('buildContextPrompt', () => {
  it('includes policy context when provided', () => {
    const result = buildContextPrompt(
      { policies: 'Policy A text', submissions: '' },
      'query'
    );
    expect(result).toContain('RETRIEVED POLICY CONTEXT');
    expect(result).toContain('Policy A text');
  });

  it('includes submission context when provided', () => {
    const result = buildContextPrompt(
      { policies: '', submissions: 'Evidence B' },
      'query'
    );
    expect(result).toContain('RETRIEVED SUBMISSION EVIDENCE');
    expect(result).toContain('Evidence B');
  });

  it('shows no-context message when both empty', () => {
    const result = buildContextPrompt({ policies: '', submissions: '' }, 'q');
    expect(result).toContain('NO CONTEXT RETRIEVED');
  });

  it('always includes the user question', () => {
    const result = buildContextPrompt(
      { policies: '', submissions: '' },
      'What are the standards?'
    );
    expect(result).toContain('USER QUESTION');
    expect(result).toContain('What are the standards?');
  });

  it('includes both contexts when both provided', () => {
    const result = buildContextPrompt(
      { policies: 'P', submissions: 'S' },
      'q'
    );
    expect(result).toContain('RETRIEVED POLICY CONTEXT');
    expect(result).toContain('RETRIEVED SUBMISSION EVIDENCE');
    expect(result).not.toContain('NO CONTEXT RETRIEVED');
  });
});
