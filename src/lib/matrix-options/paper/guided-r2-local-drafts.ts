import { guidedR2Target, type GuidedTargetKind } from './guided-r2-contract';
import { clampReviewText } from './review-local-buffer';

export interface GuidedDraftValue { choiceId: string | null; rationale: string; text: string }
export interface GuidedDraftIdentity {
  userKey: string; documentVersion: string; guidedManifestSha256: string;
  reviewManifestSha256: string; targetKind: GuidedTargetKind; targetId: string;
}
export interface BufferedGuidedDraft { value: GuidedDraftValue; baseRevision: number }

const prefix = 'mtwg-guided-r2-draft-v1';
const knownKeys = new Set<string>();
const key = (id: GuidedDraftIdentity) => [prefix, id.userKey, id.documentVersion,
  id.guidedManifestSha256, id.reviewManifestSha256, id.targetKind, id.targetId].join(':');

export function readGuidedDraft(id: GuidedDraftIdentity): BufferedGuidedDraft | null {
  if (!guidedR2Target(id.targetKind, id.targetId)) return null;
  try {
    const raw = window.localStorage.getItem(key(id));
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    const value = parsed as Record<string, unknown>;
    if (!Number.isSafeInteger(value.baseRevision) || (value.baseRevision as number) < 0 ||
      typeof value.rationale !== 'string' || typeof value.text !== 'string' ||
      !(value.choiceId === null || typeof value.choiceId === 'string')) return null;
    const target = guidedR2Target(id.targetKind, id.targetId)!;
    if (value.choiceId !== null && !target.options.includes(value.choiceId as string)) return null;
    return { baseRevision: value.baseRevision as number, value: {
      choiceId: value.choiceId as string | null,
      rationale: clampReviewText(value.rationale), text: clampReviewText(value.text),
    } };
  } catch { return null; }
}

export function writeGuidedDraft(id: GuidedDraftIdentity, value: GuidedDraftValue, baseRevision: number): boolean {
  if (!guidedR2Target(id.targetKind, id.targetId) || !Number.isSafeInteger(baseRevision) || baseRevision < 0) return false;
  try {
    const name = key(id);
    window.localStorage.setItem(name, JSON.stringify({
      baseRevision, choiceId: value.choiceId,
      rationale: clampReviewText(value.rationale), text: clampReviewText(value.text),
    }));
    knownKeys.add(name);
    return true;
  } catch { return false; }
}

export function clearGuidedDraft(id: GuidedDraftIdentity): void {
  try { const name = key(id); window.localStorage.removeItem(name); knownKeys.delete(name); } catch { /* Storage is optional. */ }
}

export function clearGuidedDraftsForUser(userKey: string): void {
  if (!userKey) return;
  try {
    const storage = window.localStorage;
    const names = new Set(knownKeys);
    if (typeof storage.length === 'number' && typeof storage.key === 'function') {
      for (let index = 0; index < storage.length; index += 1) {
        const name = storage.key(index);
        if (name) names.add(name);
      }
    }
    for (const item of names) if (item.startsWith(`${prefix}:${userKey}:`)) { storage.removeItem(item); knownKeys.delete(item); }
  } catch { /* Storage is optional. */ }
}
