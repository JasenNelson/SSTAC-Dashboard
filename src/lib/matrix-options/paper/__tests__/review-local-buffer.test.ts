import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  countReviewLocalDrafted,
  isReviewDraftDrafted,
  readReviewLocalDraft,
  REVIEW_LOCAL_BUFFER_ANONYMOUS_USER_KEY,
  REVIEW_LOCAL_BUFFER_TEXT_LIMIT,
  reviewLocalBufferKey,
  writeReviewLocalDraft,
} from '../review-local-buffer';

const version = '1.0.11-remediated-20260913';

afterEach(() => {
  window.localStorage.clear();
  vi.restoreAllMocks();
});

describe('reviewLocalBufferKey', () => {
  it('M2: uses the literal "local" user key when none is supplied', () => {
    expect(reviewLocalBufferKey({ documentVersion: version, questionId: 'rpq:x:q01' }))
      .toBe(`mtwg-paper-review:${REVIEW_LOCAL_BUFFER_ANONYMOUS_USER_KEY}:${version}:rpq:x:q01`);
  });

  it('M2: uses a supplied user key over the anonymous default', () => {
    expect(reviewLocalBufferKey({ documentVersion: version, questionId: 'rpq:x:q01', userKey: 'user-42' }))
      .toBe(`mtwg-paper-review:user-42:${version}:rpq:x:q01`);
  });

  it('M2: an empty-string user key falls back to the anonymous default (never an empty segment)', () => {
    expect(reviewLocalBufferKey({ documentVersion: version, questionId: 'rpq:x:q01', userKey: '' }))
      .toBe(`mtwg-paper-review:${REVIEW_LOCAL_BUFFER_ANONYMOUS_USER_KEY}:${version}:rpq:x:q01`);
  });

  it('M2: version is a real key segment; changing it changes the key', () => {
    const a = reviewLocalBufferKey({ documentVersion: version, questionId: 'rpq:x:q01' });
    const b = reviewLocalBufferKey({ documentVersion: '9.9.9', questionId: 'rpq:x:q01' });
    expect(a).not.toBe(b);
  });
});

describe('readReviewLocalDraft / writeReviewLocalDraft round trip', () => {
  it('M2: writes and reads back the same text for the same identity', () => {
    const identity = { documentVersion: version, questionId: 'rpq:x:q01' };
    writeReviewLocalDraft(identity, 'draft text');
    expect(readReviewLocalDraft(identity)).toBe('draft text');
  });

  it('M2: reading an identity that was never written returns an empty string', () => {
    expect(readReviewLocalDraft({ documentVersion: version, questionId: 'rpq:x:q02' })).toBe('');
  });

  it('M2: writing an empty string removes the key rather than storing an empty value', () => {
    const identity = { documentVersion: version, questionId: 'rpq:x:q03' };
    writeReviewLocalDraft(identity, 'something');
    expect(window.localStorage.getItem(reviewLocalBufferKey(identity))).not.toBeNull();
    writeReviewLocalDraft(identity, '');
    expect(window.localStorage.getItem(reviewLocalBufferKey(identity))).toBeNull();
    expect(readReviewLocalDraft(identity)).toBe('');
  });

  it('M2: different question ids under the same version and user key are isolated', () => {
    writeReviewLocalDraft({ documentVersion: version, questionId: 'rpq:x:q01' }, 'q1 text');
    writeReviewLocalDraft({ documentVersion: version, questionId: 'rpq:x:q02' }, 'q2 text');
    expect(readReviewLocalDraft({ documentVersion: version, questionId: 'rpq:x:q01' })).toBe('q1 text');
    expect(readReviewLocalDraft({ documentVersion: version, questionId: 'rpq:x:q02' })).toBe('q2 text');
  });

  it('M2: FIX CYCLE 1 / F2 -- a buffered value longer than the 20000-char limit is clamped on read', () => {
    const identity = { documentVersion: version, questionId: 'rpq:x:q01' };
    // Written directly (bypassing writeReviewLocalDraft's own caller-side
    // slicing) to simulate a value that predates the limit, or a future
    // writer that does not clamp -- the READ boundary must still enforce it.
    window.localStorage.setItem(reviewLocalBufferKey(identity), 'x'.repeat(REVIEW_LOCAL_BUFFER_TEXT_LIMIT + 5));
    const restored = readReviewLocalDraft(identity);
    expect(restored).toHaveLength(REVIEW_LOCAL_BUFFER_TEXT_LIMIT);
  });

  it('M2: a buffered value at or under the limit is returned unclamped', () => {
    const identity = { documentVersion: version, questionId: 'rpq:x:q01' };
    window.localStorage.setItem(reviewLocalBufferKey(identity), 'x'.repeat(REVIEW_LOCAL_BUFFER_TEXT_LIMIT));
    expect(readReviewLocalDraft(identity)).toHaveLength(REVIEW_LOCAL_BUFFER_TEXT_LIMIT);
  });

  it('M2: every access is wrapped in try/catch -- an unavailable localStorage.getItem does not throw and reads as empty', () => {
    // This repo's test setup (src/test/setup.ts) replaces window.localStorage
    // with a plain object, not a real Storage instance, so the throwing stub
    // is installed directly on that object (spying on Storage.prototype would
    // silently no-op here and prove nothing).
    const getItem = vi.spyOn(window.localStorage, 'getItem').mockImplementation(() => {
      throw new Error('storage unavailable');
    });
    expect(() => readReviewLocalDraft({ documentVersion: version, questionId: 'rpq:x:q01' })).not.toThrow();
    expect(readReviewLocalDraft({ documentVersion: version, questionId: 'rpq:x:q01' })).toBe('');
    getItem.mockRestore();
  });

  it('M2: every access is wrapped in try/catch -- an unavailable localStorage.setItem does not throw', () => {
    const setItem = vi.spyOn(window.localStorage, 'setItem').mockImplementation(() => {
      throw new Error('quota exceeded');
    });
    expect(() => writeReviewLocalDraft({ documentVersion: version, questionId: 'rpq:x:q01' }, 'text')).not.toThrow();
    setItem.mockRestore();
  });
});

describe('isReviewDraftDrafted', () => {
  it('M2: empty and whitespace-only text is not drafted', () => {
    expect(isReviewDraftDrafted('')).toBe(false);
    expect(isReviewDraftDrafted('   \n\t ')).toBe(false);
  });

  it('M2: any non-whitespace text is drafted', () => {
    expect(isReviewDraftDrafted('a')).toBe(true);
    expect(isReviewDraftDrafted('  a  ')).toBe(true);
  });
});

describe('countReviewLocalDrafted', () => {
  it('M2: counts only the ids with non-empty buffered text', () => {
    writeReviewLocalDraft({ documentVersion: version, questionId: 'rpq:x:q01' }, 'text');
    writeReviewLocalDraft({ documentVersion: version, questionId: 'rpq:x:q02' }, '   ');
    // q03 never written.
    expect(countReviewLocalDrafted(version, ['rpq:x:q01', 'rpq:x:q02', 'rpq:x:q03'])).toBe(1);
  });

  it('M2: an empty id list counts 0', () => {
    expect(countReviewLocalDrafted(version, [])).toBe(0);
  });
});
