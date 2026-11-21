import { guidedR2Target, type GuidedTargetKind } from './guided-r2-contract';
import { clampReviewText } from './review-local-buffer';

/**
 * Browser recovery copies of unsaved Guided R2 drafts, one store per page INSTANCE.
 *
 * Every mounted review page is an instance with its own random id. Its recovery records are keyed
 * by that id, so two tabs (or two mounts) never replace or delete each other's copy, even when
 * both edit the same target. The server's revision check (CAS) still decides every save.
 *
 * Recovery across reloads: the tab's sessionStorage remembers the previous instance id of that
 * tab (its predecessor). When a page mounts, it adopts the records of its own predecessor once that
 * predecessor has closed (pagehide or unmount) or has gone silent. Records of other closed or
 * crashed instances are adopted only after a grace period, so a reloading tab always gets its own
 * text first. Adoption copies a record into the new instance and then deletes the original only if
 * it is still byte-identical (compare-and-delete); a record is never adopted from a live instance.
 *
 * Adoption may be retried at any time (the page retries it on every heartbeat), so records of other
 * instances are picked up once their grace period or crash expiry has passed. It never overwrites
 * this instance's own record, and never touches a target the caller protects (the page protects every
 * target with unsaved in-memory edits). The same pass migrates old version-1 drafts of the user and
 * release exactly once: the account, release, target and base revision are kept, a migration marker
 * prevents any replay, and the v1 original is then removed (compare-and-delete).
 *
 * Cleanup is bounded: only records of instances that are closed or silent AND older than
 * GUIDED_DRAFT_MAX_AGE_MS are removed. A live instance (fresh heartbeat, not closed) is never touched.
 * Every storage access is optional: a missing or failing localStorage only loses the recovery copy,
 * never the in-memory draft or its conflict state.
 */
export interface GuidedDraftValue { choiceId: string | null; rationale: string; text: string }
export interface GuidedDraftIdentity {
  userKey: string; documentVersion: string; guidedManifestSha256: string;
  reviewManifestSha256: string; targetKind: GuidedTargetKind; targetId: string;
}
export type GuidedDraftRelease = Omit<GuidedDraftIdentity, 'targetKind' | 'targetId'>;
export interface BufferedGuidedDraft { value: GuidedDraftValue; baseRevision: number }
type KeyValueStore = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> & { readonly length?: number; key?: (index: number) => string | null };

export const GUIDED_DRAFT_PREFIX = 'mtwg-guided-r2-draft-v2';
export const GUIDED_INSTANCE_PREFIX = 'mtwg-guided-r2-instance-v2';
export const GUIDED_PREDECESSOR_KEY = 'mtwg-guided-r2-predecessor-v2';
const LEGACY_PREFIX = 'mtwg-guided-r2-draft-v1';
/** Marker of a completed version-1 migration (the v1 key without its prefix): never migrated twice. */
export const GUIDED_V1_MIGRATED_PREFIX = 'mtwg-guided-r2-v1-migrated';
export const GUIDED_DRAFT_HEARTBEAT_MS = 15_000;
/** An instance silent this long is treated as crashed (hidden tabs still beat at least once a minute). */
export const GUIDED_DRAFT_STALE_MS = 10 * 60_000;
/** Other tabs wait this long after a close before adopting, so a reloading tab adopts its own text first. */
export const GUIDED_DRAFT_CLOSED_GRACE_MS = 15_000;
export const GUIDED_DRAFT_MAX_AGE_MS = 30 * 24 * 60 * 60_000;
const ID_PATTERN = /^[0-9a-f]{16}$/;

const draftKey = (id: GuidedDraftIdentity, instance: string) => [GUIDED_DRAFT_PREFIX, id.userKey, id.documentVersion,
  id.guidedManifestSha256, id.reviewManifestSha256, id.targetKind, id.targetId, instance].join(':');
const instanceKey = (instance: string) => `${GUIDED_INSTANCE_PREFIX}:${instance}`;

interface ParsedDraftKey { identity: GuidedDraftIdentity; instance: string }
function parseDraftKey(name: string): ParsedDraftKey | null {
  const parts = name.split(':');
  if (parts.length !== 8 || parts[0] !== GUIDED_DRAFT_PREFIX || !ID_PATTERN.test(parts[7])) return null;
  const [, userKey, documentVersion, guidedManifestSha256, reviewManifestSha256, targetKind, targetId, instance] = parts;
  if (!guidedR2Target(targetKind as GuidedTargetKind, targetId)) return null;
  return { identity: { userKey, documentVersion, guidedManifestSha256, reviewManifestSha256, targetKind: targetKind as GuidedTargetKind, targetId }, instance };
}

/** A version-1 key: prefix, user, release identity (three parts), target kind and id; no instance. */
function parseLegacyKey(name: string): GuidedDraftIdentity | null {
  const parts = name.split(':');
  if (parts.length !== 7 || parts[0] !== LEGACY_PREFIX) return null;
  const [, userKey, documentVersion, guidedManifestSha256, reviewManifestSha256, targetKind, targetId] = parts;
  if (!userKey || !guidedR2Target(targetKind as GuidedTargetKind, targetId)) return null;
  return { userKey, documentVersion, guidedManifestSha256, reviewManifestSha256, targetKind: targetKind as GuidedTargetKind, targetId };
}
const legacyMarkerKey = (legacyName: string) => `${GUIDED_V1_MIGRATED_PREFIX}:${legacyName.slice(LEGACY_PREFIX.length + 1)}`;

function parseDraft(id: GuidedDraftIdentity, raw: string | null): (BufferedGuidedDraft & { at: number }) | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Record<string, unknown>;
    if (!value || typeof value !== 'object') return null;
    if (!Number.isSafeInteger(value.baseRevision) || (value.baseRevision as number) < 0 ||
      typeof value.rationale !== 'string' || typeof value.text !== 'string' ||
      !(value.choiceId === null || typeof value.choiceId === 'string')) return null;
    const target = guidedR2Target(id.targetKind, id.targetId);
    if (!target || (value.choiceId !== null && !target.options.includes(value.choiceId as string))) return null;
    return {
      baseRevision: value.baseRevision as number, at: Number.isFinite(value.at) ? value.at as number : 0,
      value: { choiceId: value.choiceId as string | null, rationale: clampReviewText(value.rationale), text: clampReviewText(value.text) },
    };
  } catch { return null; }
}

function storageKeys(store: KeyValueStore): string[] {
  const names: string[] = [];
  if (typeof store.length !== 'number' || typeof store.key !== 'function') return names;
  for (let index = 0; index < store.length; index += 1) {
    const name = store.key(index);
    if (name) names.push(name);
  }
  return names;
}

function readInstance(store: KeyValueStore, instance: string): { at: number; closed: boolean } | null {
  try {
    const raw = store.getItem(instanceKey(instance));
    if (!raw) return null;
    const value = JSON.parse(raw) as Record<string, unknown>;
    return Number.isFinite(value.at) && typeof value.closed === 'boolean' ? { at: value.at as number, closed: value.closed } : null;
  } catch { return null; }
}

function randomInstanceId(): string {
  const bytes = new Uint8Array(8);
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') crypto.getRandomValues(bytes);
  else for (let index = 0; index < bytes.length; index += 1) bytes[index] = Math.floor(Math.random() * 256);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export interface GuidedDraftSession {
  readonly instanceId: string;
  readonly predecessorId: string | null;
  /** This instance's own recovery record for a target. */
  read(id: GuidedDraftIdentity): BufferedGuidedDraft | null;
  write(id: GuidedDraftIdentity, value: GuidedDraftValue, baseRevision: number): boolean;
  /** Removes this instance's record only when it is exactly this draft on this base. */
  clearIfMatches(id: GuidedDraftIdentity, value: GuidedDraftValue, baseRevision: number): boolean;
  /** Adopts eligible records of closed or silent instances for one user and release; returns the count. */
  adopt(release: GuidedDraftRelease, protect?: (id: GuidedDraftIdentity) => boolean): number;
  /**
   * Same as adopt, returning the adopted (and v1-migrated) target identities. `protect` names targets
   * that must not be touched (unsaved in-memory edits): their records are neither copied nor removed.
   */
  adoptTargets(release: GuidedDraftRelease, protect?: (id: GuidedDraftIdentity) => boolean): GuidedDraftIdentity[];
  heartbeat(): void;
  /** Marks this instance open (again): used when the page effect (re)starts, e.g. under React Strict Mode. */
  open(): void;
  /** Marks this instance closed so its successor (the same tab after a reload) can adopt its records. */
  close(): void;
  /** Bounded cleanup of long-dead instances; returns the number of removed keys. */
  sweep(): number;
}

export interface GuidedDraftSessionOptions {
  readonly local?: KeyValueStore | null;
  readonly session?: Pick<Storage, 'getItem' | 'setItem'> | null;
  readonly now?: () => number;
  readonly newId?: () => string;
}

function defaultStore<T>(pick: () => T): T | null { try { return pick(); } catch { return null; } }

export function createGuidedDraftSession(options: GuidedDraftSessionOptions = {}): GuidedDraftSession {
  const local = options.local !== undefined ? options.local : defaultStore(() => (typeof window === 'undefined' ? null : window.localStorage));
  const session = options.session !== undefined ? options.session : defaultStore(() => (typeof window === 'undefined' ? null : window.sessionStorage));
  const now = options.now ?? Date.now;
  const instanceId = (options.newId ?? randomInstanceId)();
  let predecessorId: string | null = null;
  try {
    const previous = session?.getItem(GUIDED_PREDECESSOR_KEY) ?? null;
    predecessorId = previous && ID_PATTERN.test(previous) && previous !== instanceId ? previous : null;
    session?.setItem(GUIDED_PREDECESSOR_KEY, instanceId);
  } catch { predecessorId = null; }
  let closed = false;
  const beat = () => { try { local?.setItem(instanceKey(instanceId), JSON.stringify({ at: now(), closed })); } catch { /* optional */ } };
  beat();

  /** Eligibility of another instance's records for adoption by this one. */
  const adoptable = (other: string, draftAt: number): boolean => {
    if (!local || other === instanceId) return false;
    const record = readInstance(local, other);
    const age = (at: number) => now() - at;
    // The tab's own previous instance: adoptable once closed, silent, or without a liveness record.
    if (other === predecessorId) return record === null || record.closed || age(record.at) > GUIDED_DRAFT_STALE_MS;
    if (record === null) return age(draftAt) > GUIDED_DRAFT_STALE_MS;
    return (record.closed && age(record.at) > GUIDED_DRAFT_CLOSED_GRACE_MS) || age(record.at) > GUIDED_DRAFT_STALE_MS;
  };

  const api: GuidedDraftSession = {
    instanceId,
    predecessorId,
    read(id) {
      if (!local || !guidedR2Target(id.targetKind, id.targetId)) return null;
      try {
        const parsed = parseDraft(id, local.getItem(draftKey(id, instanceId)));
        return parsed ? { baseRevision: parsed.baseRevision, value: parsed.value } : null;
      } catch { return null; }
    },
    write(id, value, baseRevision) {
      if (!local || !guidedR2Target(id.targetKind, id.targetId) || !Number.isSafeInteger(baseRevision) || baseRevision < 0) return false;
      try {
        local.setItem(draftKey(id, instanceId), JSON.stringify({
          baseRevision, choiceId: value.choiceId, rationale: clampReviewText(value.rationale), text: clampReviewText(value.text), at: now(),
        }));
        beat();
        return true;
      } catch { return false; }
    },
    clearIfMatches(id, value, baseRevision) {
      if (!local) return false;
      try {
        const name = draftKey(id, instanceId);
        const stored = parseDraft(id, local.getItem(name));
        if (!stored || stored.baseRevision !== baseRevision || stored.value.choiceId !== value.choiceId
          || stored.value.rationale !== clampReviewText(value.rationale) || stored.value.text !== clampReviewText(value.text)) return false;
        local.removeItem(name);
        return true;
      } catch { return false; }
    },
    adopt(release, protect) { return api.adoptTargets(release, protect).length; },
    adoptTargets(release, protect = () => false) {
      if (!local) return [];
      const adopted: GuidedDraftIdentity[] = [];
      const sameRelease = (identity: GuidedDraftIdentity) => identity.userKey === release.userKey && identity.documentVersion === release.documentVersion
        && identity.guidedManifestSha256 === release.guidedManifestSha256 && identity.reviewManifestSha256 === release.reviewManifestSha256;
      const isProtected = (identity: GuidedDraftIdentity) => { try { return Boolean(protect(identity)); } catch { return true; } };
      try {
        const names = storageKeys(local);
        const candidates = names.map((name) => ({ name, parsed: parseDraftKey(name) }))
          .filter((entry): entry is { name: string; parsed: ParsedDraftKey } => entry.parsed !== null
            && entry.parsed.instance !== instanceId && sameRelease(entry.parsed.identity))
          // The tab's own predecessor first: a reloading tab gets its own text.
          .sort((a, b) => Number(b.parsed.instance === predecessorId) - Number(a.parsed.instance === predecessorId));
        for (const { name, parsed } of candidates) {
          if (isProtected(parsed.identity)) continue; // unsaved in-memory edits: never replaced, original kept
          const raw = local.getItem(name);
          const draft = parseDraft(parsed.identity, raw);
          if (!draft || !adoptable(parsed.instance, draft.at)) continue;
          const own = draftKey(parsed.identity, instanceId);
          if (local.getItem(own) !== null) continue; // never overwrite this instance's own draft
          local.setItem(own, raw!);
          // Compare-and-delete: only the exact record that was copied.
          if (local.getItem(name) === raw) local.removeItem(name);
          adopted.push(parsed.identity);
        }
        // Version-1 drafts (one per user, release and target, no instance): migrated exactly once.
        for (const name of names) {
          const identity = parseLegacyKey(name);
          if (!identity || !sameRelease(identity)) continue;
          const raw = local.getItem(name);
          if (raw === null) continue;
          const marker = legacyMarkerKey(name);
          if (local.getItem(marker) !== null) {
            // Already migrated: only the leftover original is removed, never migrated again.
            if (local.getItem(name) === raw) local.removeItem(name);
            continue;
          }
          if (isProtected(identity)) continue;
          const own = draftKey(identity, instanceId);
          if (local.getItem(own) !== null) continue; // this instance's own draft wins; v1 is kept for later
          const draft = parseDraft(identity, raw);
          if (!draft) continue;
          local.setItem(own, JSON.stringify({
            baseRevision: draft.baseRevision, choiceId: draft.value.choiceId, rationale: draft.value.rationale, text: draft.value.text, at: now(), migratedFrom: 'v1',
          }));
          try { local.setItem(marker, JSON.stringify({ at: now(), instance: instanceId })); } catch { /* the removal below still prevents a replay */ }
          if (local.getItem(name) === raw) local.removeItem(name);
          adopted.push(identity);
        }
      } catch { /* adoption is optional */ }
      if (adopted.length) beat();
      return adopted;
    },
    heartbeat: beat,
    open() { closed = false; beat(); },
    close() { closed = true; beat(); },
    sweep() {
      if (!local) return 0;
      let removed = 0;
      try {
        const names = storageKeys(local);
        const dead = (instance: string, fallbackAt: number) => {
          if (instance === instanceId) return false;
          const record = readInstance(local, instance);
          const at = record ? record.at : fallbackAt;
          const silentOrClosed = record === null || record.closed || now() - record.at > GUIDED_DRAFT_STALE_MS;
          return silentOrClosed && now() - at > GUIDED_DRAFT_MAX_AGE_MS;
        };
        for (const name of names) {
          const parsed = parseDraftKey(name);
          if (!parsed) continue;
          const raw = local.getItem(name);
          const draft = parseDraft(parsed.identity, raw);
          if (dead(parsed.instance, draft?.at ?? 0) && local.getItem(name) === raw) { local.removeItem(name); removed += 1; }
        }
        for (const name of names) {
          if (!name.startsWith(`${GUIDED_INSTANCE_PREFIX}:`)) continue;
          const instance = name.slice(GUIDED_INSTANCE_PREFIX.length + 1);
          if (!ID_PATTERN.test(instance) || !dead(instance, 0)) continue;
          const stillUsed = storageKeys(local).some((other) => parseDraftKey(other)?.instance === instance);
          if (!stillUsed) { local.removeItem(name); removed += 1; }
        }
      } catch { /* cleanup is optional */ }
      return removed;
    },
  };
  return api;
}

/** Sign-out: removes every recovery record of that user, in every instance (and the old v1 format). */
export function clearGuidedDraftsForUser(userKey: string, store?: KeyValueStore | null): void {
  if (!userKey) return;
  const local = store !== undefined ? store : defaultStore(() => window.localStorage);
  if (!local) return;
  try {
    for (const name of storageKeys(local)) {
      if (name.startsWith(`${GUIDED_DRAFT_PREFIX}:${userKey}:`) || name.startsWith(`${LEGACY_PREFIX}:${userKey}:`)) local.removeItem(name);
    }
  } catch { /* Storage is optional. */ }
}
