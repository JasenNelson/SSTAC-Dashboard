import { describe, expect, it } from 'vitest';

import {
  isMatrixOptionsPaperReviewNavigationEnabled,
  isMatrixOptionsPaperWorkspaceEnabled,
  resolveMatrixOptionsPaperReviewNavigationGate,
} from './navigation';

describe('Matrix Options paper navigation defaults', () => {
  it('defaults absent deployment flags to the reviewed workspace', () => {
    expect(isMatrixOptionsPaperWorkspaceEnabled(undefined)).toBe(true);
    expect(isMatrixOptionsPaperReviewNavigationEnabled(undefined)).toBe(true);
    expect(resolveMatrixOptionsPaperReviewNavigationGate(undefined, undefined)).toBe('REVIEW_NAVIGATION');
  });

  it('keeps rollback behavior only for an explicit false flag', () => {
    expect(resolveMatrixOptionsPaperReviewNavigationGate('false', undefined)).toBe('LEGACY_TWG_REVIEW');
    expect(resolveMatrixOptionsPaperReviewNavigationGate('false', 'true')).toBe('LEGACY_TWG_REVIEW');
    expect(resolveMatrixOptionsPaperReviewNavigationGate(undefined, 'false')).toBe('PAPER_RESOLVER');
    expect(resolveMatrixOptionsPaperReviewNavigationGate('true', 'false')).toBe('PAPER_RESOLVER');
    expect(resolveMatrixOptionsPaperReviewNavigationGate('true', 'true')).toBe('REVIEW_NAVIGATION');
  });

  it.each(['', 'TRUE', 'True', '1', 'yes', 'on', ' true', 'true ', 'enabled'])(
    'keeps the malformed flag value %j fail-closed',
    (value) => {
      expect(isMatrixOptionsPaperWorkspaceEnabled(value)).toBe(false);
      expect(isMatrixOptionsPaperReviewNavigationEnabled(value)).toBe(false);
      expect(resolveMatrixOptionsPaperReviewNavigationGate(value, undefined)).toBe('LEGACY_TWG_REVIEW');
      expect(resolveMatrixOptionsPaperReviewNavigationGate(undefined, value)).toBe('PAPER_RESOLVER');
    },
  );
});
