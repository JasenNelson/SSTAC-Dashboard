import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  countReviewLocalDrafted,
  clampReviewText,
  hasReviewLocalDraftEntry,
  clearReviewLocalDraftsForVersion,
  isReviewDraftDrafted,
  migrateAnonymousReviewDraft,
  readReviewLocalDraft,
  readReviewLocalDraftEntry,
  REVIEW_LOCAL_BUFFER_ANONYMOUS_USER_KEY,
  REVIEW_LOCAL_BUFFER_TEXT_LIMIT,
  reviewLocalBufferKey,
  writeReviewLocalDraft,
  writeReviewLocalDraftEntry,
} from '../review-local-buffer';

const version = '1.0.11-remediated-7-8-successor-20260918-D';

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

  it('M3: migration removes anonymous data only after authenticated storage succeeds', () => {
    const anonymous = { documentVersion: version, questionId: 'rpq:x:q01' };
    writeReviewLocalDraft(anonymous, 'anonymous');
    expect(migrateAnonymousReviewDraft({ ...anonymous, userKey: 'user-a' })).toBe(true);
    expect(readReviewLocalDraft({ ...anonymous, userKey: 'user-a' })).toBe('anonymous');
    expect(readReviewLocalDraft(anonymous)).toBe('');

    writeReviewLocalDraft(anonymous, 'preserve-on-failure');
    const setItem = vi.spyOn(window.localStorage, 'setItem').mockImplementation(() => { throw new Error('quota exceeded'); });
    expect(migrateAnonymousReviewDraft({ ...anonymous, userKey: 'user-b' })).toBe(false);
    expect(readReviewLocalDraft(anonymous)).toBe('preserve-on-failure');
    setItem.mockRestore();
  });

  it('M3: release cleanup removes all user namespaces for the version', () => {
    writeReviewLocalDraft({ documentVersion: version, questionId: 'rpq:x:q01', userKey: 'user-a' }, 'a');
    writeReviewLocalDraft({ documentVersion: version, questionId: 'rpq:x:q02', userKey: 'user-b' }, 'b');
    writeReviewLocalDraft({ documentVersion: 'other', questionId: 'rpq:x:q01', userKey: 'user-a' }, 'keep');
    clearReviewLocalDraftsForVersion(version);
    expect(readReviewLocalDraft({ documentVersion: version, questionId: 'rpq:x:q01', userKey: 'user-a' })).toBe('');
    expect(readReviewLocalDraft({ documentVersion: version, questionId: 'rpq:x:q02', userKey: 'user-b' })).toBe('');
    expect(readReviewLocalDraft({ documentVersion: 'other', questionId: 'rpq:x:q01', userKey: 'user-a' })).toBe('keep');
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

describe('readReviewLocalDraftEntry / writeReviewLocalDraftEntry (versioned round trip)', () => {
  it('round trips text and a non-null base revision for the same identity', () => {
    const identity = { documentVersion: version, questionId: 'rpq:x:q01' };
    writeReviewLocalDraftEntry(identity, 'versioned text', 7);
    expect(readReviewLocalDraftEntry(identity)).toEqual({ text: 'versioned text', baseRevision: 7, writtenAt: expect.any(Number) });
  });

  it('round trips a null base revision (no server row existed when it was typed)', () => {
    const identity = { documentVersion: version, questionId: 'rpq:x:q01' };
    writeReviewLocalDraftEntry(identity, 'no row yet', null);
    expect(readReviewLocalDraftEntry(identity)).toEqual({ text: 'no row yet', baseRevision: null, writtenAt: expect.any(Number) });
  });

  it('a legacy plain-string entry (written by writeReviewLocalDraft) reads back with baseRevision undefined', () => {
    const identity = { documentVersion: version, questionId: 'rpq:x:q01' };
    writeReviewLocalDraft(identity, 'legacy text');
    expect(readReviewLocalDraftEntry(identity)).toEqual({ text: 'legacy text', baseRevision: undefined });
  });

  it('a corrupt versioned-prefixed entry is treated as legacy text rather than lost', () => {
    const identity = { documentVersion: version, questionId: 'rpq:x:q01' };
    const corrupt = 'mtwg-draft-v1:{not valid json';
    window.localStorage.setItem(reviewLocalBufferKey(identity), corrupt);
    expect(readReviewLocalDraftEntry(identity)).toEqual({ text: corrupt, baseRevision: undefined });
  });

  it('null removes the key; an EMPTY string is kept as an explicit empty draft (a cleared response survives reload)', () => {
    const identity = { documentVersion: version, questionId: 'rpq:x:q01' };
    writeReviewLocalDraftEntry(identity, 'something', 3);
    expect(hasReviewLocalDraftEntry(identity)).toBe(true);
    // Two-sided: the old contract removed the key here, losing the edit on reload.
    writeReviewLocalDraftEntry(identity, '', 3);
    expect(hasReviewLocalDraftEntry(identity)).toBe(true);
    expect(readReviewLocalDraftEntry(identity)).toEqual({ text: '', baseRevision: 3, writtenAt: expect.any(Number) });
    writeReviewLocalDraftEntry(identity, null, null);
    expect(window.localStorage.getItem(reviewLocalBufferKey(identity))).toBeNull();
    expect(hasReviewLocalDraftEntry(identity)).toBe(false);
  });

  it('readReviewLocalDraft returns just the text of a versioned entry', () => {
    const identity = { documentVersion: version, questionId: 'rpq:x:q01' };
    writeReviewLocalDraftEntry(identity, 'versioned text', 2);
    expect(readReviewLocalDraft(identity)).toBe('versioned text');
  });
});

describe('migrateAnonymousReviewDraft: base revision', () => {
  it('carries the anonymous entry\'s base revision into the authenticated namespace', () => {
    const anonymous = { documentVersion: version, questionId: 'rpq:x:q01' };
    writeReviewLocalDraftEntry(anonymous, 'anon versioned', 4);
    expect(migrateAnonymousReviewDraft({ ...anonymous, userKey: 'user-a' })).toBe(true);
    expect(readReviewLocalDraftEntry({ ...anonymous, userKey: 'user-a' })).toEqual({ text: 'anon versioned', baseRevision: 4, writtenAt: expect.any(Number) });
    expect(readReviewLocalDraft(anonymous)).toBe('');
  });

  it('keeps an existing authenticated draft that is NEWER than the anonymous one (the anonymous crash buffer is still cleared)', () => {
    const anonymous = { documentVersion: version, questionId: 'rpq:x:q01' };
    const now = vi.spyOn(Date, 'now');
    now.mockReturnValue(1000);
    writeReviewLocalDraftEntry(anonymous, 'anonymous crash draft', 9);
    now.mockReturnValue(2000);
    writeReviewLocalDraftEntry({ ...anonymous, userKey: 'user-a' }, 'authenticated newer', 9);
    now.mockRestore();
    expect(migrateAnonymousReviewDraft({ ...anonymous, userKey: 'user-a' })).toBe(true);
    expect(readReviewLocalDraft({ ...anonymous, userKey: 'user-a' })).toBe('authenticated newer');
    expect(readReviewLocalDraft(anonymous)).toBe('');
  });

  it('replaces an OLDER or undated authenticated draft with newer anonymous text (text typed while the user was unknown is not dropped)', () => {
    const anonymous = { documentVersion: version, questionId: 'rpq:x:q02' };
    writeReviewLocalDraft({ ...anonymous, userKey: 'user-a' }, 'legacy undated authenticated');
    writeReviewLocalDraftEntry(anonymous, 'typed while signed-out state unknown', 9);
    expect(migrateAnonymousReviewDraft({ ...anonymous, userKey: 'user-a' })).toBe(true);
    // Two-sided: the old rule kept the authenticated copy and silently dropped this text.
    expect(readReviewLocalDraft({ ...anonymous, userKey: 'user-a' })).toBe('typed while signed-out state unknown');
    expect(readReviewLocalDraft(anonymous)).toBe('');
  });
});

describe('clampReviewText', () => {
  it('never leaves an unpaired high surrogate at the limit, and keeps a whole pair that fits', () => {
    const emoji = String.fromCodePoint(0x1f600);
    const cut = clampReviewText('a'.repeat(19999) + emoji, 20000);
    // Two-sided: a plain slice keeps the lone high surrogate (length 20000).
    expect(cut).toBe('a'.repeat(19999));
    expect(clampReviewText('a'.repeat(19998) + emoji, 20000)).toBe('a'.repeat(19998) + emoji);
    expect(clampReviewText('short', 20000)).toBe('short');
  });
});
