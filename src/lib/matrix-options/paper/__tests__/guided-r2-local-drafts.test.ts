import { beforeEach, describe, expect, it } from 'vitest';

import {
  GUIDED_DRAFT_CLOSED_GRACE_MS,
  GUIDED_DRAFT_MAX_AGE_MS,
  GUIDED_DRAFT_PREFIX,
  GUIDED_DRAFT_STALE_MS,
  GUIDED_INSTANCE_PREFIX,
  GUIDED_V1_MIGRATED_PREFIX,
  clearGuidedDraftsForUser,
  createGuidedDraftSession,
} from '../guided-r2-local-drafts';

const release = { userKey: '11111111-1111-4111-8111-111111111111', documentVersion: 'release', guidedManifestSha256: 'a'.repeat(64), reviewManifestSha256: 'b'.repeat(64) };
const id = { ...release, targetKind: 'text-prompt' as const, targetId: 'site-assignment' };
const value = (text: string) => ({ choiceId: null, rationale: '', text });

/** A Storage double with enumeration, optional failure and an optional hook between reads (races). */
function memoryStorage() {
  const store = new Map<string, string>();
  const api = {
    failWrites: false,
    onGet: undefined as undefined | ((key: string) => void),
    getItem: (key: string) => { api.onGet?.(key); return store.has(key) ? store.get(key)! : null; },
    setItem: (key: string, val: string) => { if (api.failWrites) throw new Error('QuotaExceededError'); store.set(key, val); },
    removeItem: (key: string) => { store.delete(key); },
    key: (index: number) => Array.from(store.keys())[index] ?? null,
    get length() { return store.size; },
    keys: () => Array.from(store.keys()),
  };
  return api;
}
/** sessionStorage of one browser tab. */
const tabSession = () => { const s = new Map<string, string>(); return { getItem: (k: string) => s.get(k) ?? null, setItem: (k: string, v: string) => { s.set(k, v); } }; };
let clock = 1_000_000_000;
const now = () => clock;
let counter = 0;
const newId = () => (++counter).toString(16).padStart(16, '0');
const session = (local: ReturnType<typeof memoryStorage>, tab = tabSession()) => ({ tab, store: createGuidedDraftSession({ local, session: tab, now, newId }) });
const draftKeys = (local: ReturnType<typeof memoryStorage>) => local.keys().filter((key) => key.startsWith(`${GUIDED_DRAFT_PREFIX}:`));

beforeEach(() => { clock = 1_000_000_000; counter = 0; });

describe('per-instance recovery records', () => {
  it('two instances editing the same target never replace or delete each other\'s record', () => {
    const local = memoryStorage();
    const a = session(local).store;
    const b = session(local).store;
    a.write(id, value('Text from tab A'), 0);
    b.write(id, value('Text from tab B'), 0);
    expect(a.read(id)?.value.text).toBe('Text from tab A');
    expect(b.read(id)?.value.text).toBe('Text from tab B');
    // A saves: it clears only its own exact record.
    expect(a.clearIfMatches(id, value('Text from tab A'), 0)).toBe(true);
    expect(a.read(id)).toBeNull();
    expect(b.read(id)).toMatchObject({ baseRevision: 0, value: { text: 'Text from tab B' } });
    expect(draftKeys(local)).toHaveLength(1);
  });

  it('removes a record only for the exact saved draft and base revision', () => {
    const a = session(memoryStorage()).store;
    a.write(id, value('Newer text'), 3);
    expect(a.clearIfMatches(id, value('Older text'), 3)).toBe(false);
    expect(a.clearIfMatches(id, value('Newer text'), 2)).toBe(false);
    expect(a.read(id)?.value.text).toBe('Newer text');
    expect(a.clearIfMatches(id, value('Newer text'), 3)).toBe(true);
  });

  it('keeps the UTF-16 bound, the base revision and the exact release identity', () => {
    const a = session(memoryStorage()).store;
    expect(a.write(id, value('x'.repeat(20000) + 'y'), 4)).toBe(true);
    expect(a.read(id)).toMatchObject({ baseRevision: 4, value: { text: 'x'.repeat(20000) } });
    expect(a.read({ ...id, userKey: '22222222-2222-4222-8222-222222222222' })).toBeNull();
    expect(a.read({ ...id, reviewManifestSha256: 'c'.repeat(64) })).toBeNull();
    expect(a.write({ ...id, targetId: 'bad' }, value('x'), 0)).toBe(false);
  });

  it('a failing or missing localStorage only loses the copy and never throws', () => {
    const local = memoryStorage();
    const a = session(local).store;
    local.failWrites = true;
    expect(a.write(id, value('x'), 0)).toBe(false);
    expect(a.read(id)).toBeNull();
    const none = createGuidedDraftSession({ local: null, session: null, now, newId });
    expect(none.write(id, value('x'), 0)).toBe(false);
    expect(none.adopt(release)).toBe(0);
    expect(none.sweep()).toBe(0);
  });
});

describe('reload recovery (adoption)', () => {
  it('each tab reloading recovers its own text and base revision, not the other tab\'s', () => {
    const local = memoryStorage();
    const tabA = session(local);
    const tabB = session(local);
    tabA.store.write(id, value('Text from tab A'), 1);
    tabB.store.write(id, value('Text from tab B'), 2);
    // Both tabs reload at the same moment.
    tabA.store.close();
    tabB.store.close();
    const reloadedB = createGuidedDraftSession({ local, session: tabB.tab, now, newId });
    const reloadedA = createGuidedDraftSession({ local, session: tabA.tab, now, newId });
    expect(reloadedB.predecessorId).toBe(tabB.store.instanceId);
    expect(reloadedB.adopt(release)).toBe(1);
    expect(reloadedA.adopt(release)).toBe(1);
    expect(reloadedA.read(id)).toMatchObject({ baseRevision: 1, value: { text: 'Text from tab A' } });
    expect(reloadedB.read(id)).toMatchObject({ baseRevision: 2, value: { text: 'Text from tab B' } });
    expect(draftKeys(local)).toHaveLength(2);
  });

  it('never adopts a live instance\'s draft (a duplicated tab shares the session but not the instance)', () => {
    const local = memoryStorage();
    const tab = session(local);
    tab.store.write(id, value('Live text'), 0);
    // A duplicated tab copies sessionStorage, so its predecessor is the still-open original.
    const duplicate = createGuidedDraftSession({ local, session: tab.tab, now, newId });
    expect(duplicate.predecessorId).toBe(tab.store.instanceId);
    expect(duplicate.adopt(release)).toBe(0);
    clock += GUIDED_DRAFT_STALE_MS - 1;
    tab.store.heartbeat();
    expect(createGuidedDraftSession({ local, session: tabSession(), now, newId }).adopt(release)).toBe(0);
    expect(tab.store.read(id)?.value.text).toBe('Live text');
  });

  it('other tabs adopt a closed tab\'s draft only after the grace period, so its own reload wins', () => {
    const local = memoryStorage();
    const closing = session(local);
    closing.store.write(id, value('Closed tab text'), 0);
    closing.store.close();
    const other = createGuidedDraftSession({ local, session: tabSession(), now, newId });
    expect(other.adopt(release)).toBe(0);
    clock += GUIDED_DRAFT_CLOSED_GRACE_MS + 1;
    const later = createGuidedDraftSession({ local, session: tabSession(), now, newId });
    expect(later.adopt(release)).toBe(1);
    expect(later.read(id)?.value.text).toBe('Closed tab text');
  });

  it('adopts a crashed instance (silent past the stale bound, never closed)', () => {
    const local = memoryStorage();
    const crashed = session(local);
    crashed.store.write(id, value('Crash text'), 5);
    clock += GUIDED_DRAFT_STALE_MS + 1;
    const next = createGuidedDraftSession({ local, session: tabSession(), now, newId });
    expect(next.adopt(release)).toBe(1);
    expect(next.read(id)).toMatchObject({ baseRevision: 5, value: { text: 'Crash text' } });
  });

  it('never overwrites the adopting instance\'s own draft', () => {
    const local = memoryStorage();
    const tab = session(local);
    tab.store.write(id, value('Old instance text'), 0);
    tab.store.close();
    const reloaded = createGuidedDraftSession({ local, session: tab.tab, now, newId });
    reloaded.write(id, value('Typed before adoption'), 0);
    expect(reloaded.adopt(release)).toBe(0);
    expect(reloaded.read(id)?.value.text).toBe('Typed before adoption');
    // The predecessor's copy is kept, not deleted.
    expect(draftKeys(local)).toHaveLength(2);
  });

  it('compare-and-delete: an original that changes during adoption is copied but never deleted', () => {
    const local = memoryStorage();
    const tab = session(local);
    tab.store.write(id, value('First'), 0);
    tab.store.close();
    const originalKey = draftKeys(local)[0];
    const reloaded = createGuidedDraftSession({ local, session: tab.tab, now, newId });
    let reads = 0;
    local.onGet = (key) => {
      // The original is rewritten between the copy and the delete check.
      if (key === originalKey && ++reads === 2) local.setItem(originalKey, JSON.stringify({ baseRevision: 0, choiceId: null, rationale: '', text: 'Rewritten', at: clock }));
    };
    expect(reloaded.adopt(release)).toBe(1);
    local.onGet = undefined;
    expect(reloaded.read(id)?.value.text).toBe('First');
    expect(local.getItem(originalKey)).toContain('Rewritten');
  });
});

describe('bounded cleanup', () => {
  it('removes only long-dead instances and never a live draft', () => {
    const local = memoryStorage();
    const dead = session(local);
    dead.store.write(id, value('Abandoned'), 0);
    dead.store.close();
    const live = session(local);
    live.store.write({ ...id, targetId: 'work-sequence' }, value('Live'), 0);
    clock += GUIDED_DRAFT_MAX_AGE_MS + 1;
    live.store.heartbeat();
    const sweeper = createGuidedDraftSession({ local, session: tabSession(), now, newId });
    expect(sweeper.sweep()).toBe(2); // the dead draft and its instance record
    expect(live.store.read({ ...id, targetId: 'work-sequence' })?.value.text).toBe('Live');
    expect(local.keys().some((key) => key === `${GUIDED_INSTANCE_PREFIX}:${dead.store.instanceId}`)).toBe(false);
  });

  it('keeps a closed instance\'s draft younger than the bound, available for adoption', () => {
    const local = memoryStorage();
    const closed = session(local);
    closed.store.write(id, value('Recent'), 0);
    closed.store.close();
    clock += GUIDED_DRAFT_MAX_AGE_MS - 1000;
    expect(createGuidedDraftSession({ local, session: tabSession(), now, newId }).sweep()).toBe(0);
    expect(draftKeys(local)).toHaveLength(1);
  });

  it('a record rewritten during cleanup is not deleted (conditional cleanup race)', () => {
    const local = memoryStorage();
    const dead = session(local);
    dead.store.write(id, value('Abandoned'), 0);
    dead.store.close();
    const key = draftKeys(local)[0];
    clock += GUIDED_DRAFT_MAX_AGE_MS + 1;
    let reads = 0;
    local.onGet = (name) => { if (name === key && ++reads === 2) local.setItem(key, JSON.stringify({ baseRevision: 0, choiceId: null, rationale: '', text: 'Revived', at: clock })); };
    createGuidedDraftSession({ local, session: tabSession(), now, newId }).sweep();
    local.onGet = undefined;
    expect(local.getItem(key)).toContain('Revived');
  });
});

describe('sign-out', () => {
  it('clears every recovery record of only the signed-out user, in every instance', () => {
    const local = memoryStorage();
    const other = { ...id, userKey: '22222222-2222-4222-8222-222222222222' };
    const a = session(local).store;
    const b = session(local).store;
    a.write(id, value('A'), 0); b.write(id, value('B'), 0); b.write(other, value('Other user'), 0);
    clearGuidedDraftsForUser(id.userKey, local);
    expect(a.read(id)).toBeNull();
    expect(b.read(id)).toBeNull();
    expect(b.read(other)?.value.text).toBe('Other user');
  });
});

describe('adoption retry, dirty-state protection and version-1 migration', () => {
  const legacyKey = (identity = id) => ['mtwg-guided-r2-draft-v1', identity.userKey, identity.documentVersion, identity.guidedManifestSha256, identity.reviewManifestSha256, identity.targetKind, identity.targetId].join(':');
  const legacyValue = (text: string, baseRevision = 4) => JSON.stringify({ baseRevision, choiceId: null, rationale: '', text });

  it('clean adoption on retry: the same live instance adopts a closed tab\'s copy once the grace period has passed', () => {
    const local = memoryStorage();
    const closing = session(local);
    closing.store.write(id, value('Closed tab text'), 2);
    closing.store.close();
    const live = session(local).store;
    expect(live.adoptTargets(release)).toEqual([]);
    clock += GUIDED_DRAFT_CLOSED_GRACE_MS + 1;
    expect(live.adoptTargets(release)).toEqual([id]);
    expect(live.read(id)).toMatchObject({ baseRevision: 2, value: { text: 'Closed tab text' } });
    expect(draftKeys(local)).toHaveLength(1);
    expect(live.adoptTargets(release)).toEqual([]);
  });

  it('crash expiry on retry: a silent, never-closed instance is adopted only after the stale bound', () => {
    const local = memoryStorage();
    const crashed = session(local);
    crashed.store.write(id, value('Crash text'), 1);
    const live = session(local).store;
    clock += GUIDED_DRAFT_STALE_MS - 1000;
    live.heartbeat();
    expect(live.adoptTargets(release)).toEqual([]);
    clock += 2000;
    expect(live.adoptTargets(release)).toEqual([id]);
    expect(live.read(id)?.value.text).toBe('Crash text');
  });

  it('dirty-state refusal: a protected target is neither overwritten nor taken, and is adoptable once unprotected', () => {
    const local = memoryStorage();
    const closing = session(local);
    closing.store.write(id, value('Other copy'), 0);
    closing.store.close();
    clock += GUIDED_DRAFT_CLOSED_GRACE_MS + 1;
    // The adopting page has unsaved in-memory text for this target but no recovery record (write failed).
    const live = session(local).store;
    expect(live.adoptTargets(release, (target) => target.targetId === id.targetId)).toEqual([]);
    expect(live.read(id)).toBeNull();
    expect(draftKeys(local)).toHaveLength(1);
    expect(local.getItem(draftKeys(local)[0])).toContain('Other copy');
    // A failing protect predicate fails closed (protected).
    expect(live.adoptTargets(release, () => { throw new Error('boom'); })).toEqual([]);
    expect(live.adoptTargets(release)).toEqual([id]);
  });

  it('migrates a version-1 draft exactly once, keeping account, release, target and base revision', () => {
    const local = memoryStorage();
    local.setItem(legacyKey(), legacyValue('Old v1 text', 4));
    const first = session(local).store;
    expect(first.adoptTargets(release)).toEqual([id]);
    expect(first.read(id)).toEqual({ baseRevision: 4, value: { choiceId: null, rationale: '', text: 'Old v1 text' } });
    const migrated = draftKeys(local);
    expect(migrated).toEqual([[GUIDED_DRAFT_PREFIX, id.userKey, id.documentVersion, id.guidedManifestSha256, id.reviewManifestSha256, id.targetKind, id.targetId, first.instanceId].join(':')]);
    expect(local.getItem(legacyKey())).toBeNull();
    expect(local.keys().some((key) => key.startsWith(`${GUIDED_V1_MIGRATED_PREFIX}:`))).toBe(true);
    // No replay: the same v1 record reappearing (e.g. a failed removal) is never migrated again.
    first.clearIfMatches(id, value('Old v1 text'), 4);
    local.setItem(legacyKey(), legacyValue('Old v1 text', 4));
    const second = session(local).store;
    expect(second.adoptTargets(release)).toEqual([]);
    expect(second.read(id)).toBeNull();
    expect(local.getItem(legacyKey())).toBeNull();
  });

  it('a version-1 draft never overwrites an existing draft, is kept for later, and ignores other users and releases', () => {
    const local = memoryStorage();
    local.setItem(legacyKey(), legacyValue('Old v1 text'));
    local.setItem(legacyKey({ ...id, userKey: '22222222-2222-4222-8222-222222222222' }), legacyValue('Other user'));
    local.setItem(legacyKey({ ...id, documentVersion: 'other-release' }), legacyValue('Other release'));
    const live = session(local).store;
    live.write(id, value('Typed now'), 0);
    expect(live.adoptTargets(release)).toEqual([]);
    expect(live.read(id)?.value.text).toBe('Typed now');
    expect(local.getItem(legacyKey())).toContain('Old v1 text');
    expect(live.adoptTargets(release, (target) => target.targetId === id.targetId)).toEqual([]);
    live.clearIfMatches(id, value('Typed now'), 0);
    expect(live.adoptTargets(release)).toEqual([id]);
    expect(local.getItem(legacyKey({ ...id, userKey: '22222222-2222-4222-8222-222222222222' }))).toContain('Other user');
    expect(local.getItem(legacyKey({ ...id, documentVersion: 'other-release' }))).toContain('Other release');
  });
});
