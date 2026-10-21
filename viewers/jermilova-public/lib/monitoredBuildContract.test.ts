import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';

type Identity = { pid: number; parent: number; created: number; executable: string };
type Sample = { rootAlive: boolean; stdout: 'line' | 'eof' | 'pending'; stderr: 'line' | 'eof' | 'pending'; elapsed: number; sinceProgress: number; descendants: Identity[] };

const identityKey = (value: Identity) => `${value.pid}|${value.parent}|${value.created}|${value.executable.toLowerCase()}`;
const sameIdentity = (a: Identity, b: Identity) => identityKey(a) === identityKey(b);

function mergeDescendants(owned: Map<string, Identity>, observed: Identity[]) {
  for (const item of observed) owned.set(identityKey(item), item);
  return [...owned.values()];
}

function decide(sample: Sample) {
  if (sample.elapsed >= 360) return 'TIMED_OUT';
  if (sample.sinceProgress >= 240) return 'STALLED';
  if (!sample.rootAlive && sample.descendants.length) return 'CHILD_SURVIVOR';
  if (!sample.rootAlive && sample.stdout === 'eof' && sample.stderr === 'eof') return 'COMPLETED_GREEN';
  if (!sample.rootAlive && (sample.stdout !== 'eof' || sample.stderr !== 'eof')) return 'DRAINING';
  return 'IN_PROGRESS';
}

function verifyCandidate(actual: Uint8Array, expectedBytes: number, expectedHash: string) {
  const hash = createHash('sha256').update(actual).digest('hex');
  return actual.byteLength === expectedBytes && hash === expectedHash.toLowerCase();
}

function canClaim(existing: Set<string>, claim: string) {
  if (existing.has(claim)) return false;
  existing.add(claim);
  return true;
}

function isZeroByteConfig(bytes: Uint8Array) {
  return bytes.byteLength === 0 && createHash('sha256').update(bytes).digest('hex') === 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
}

function isGovernedPermitPath(path: string, reviewsRoot: string) {
  const normalizedRoot = reviewsRoot.replace(/[\\/]+$/, '').toLowerCase();
  const normalizedPath = path.toLowerCase();
  return normalizedPath.startsWith(`${normalizedRoot}\\`) && !normalizedPath.includes('__governance_supplied_exact_receipt_path_required__') && !normalizedPath.includes('validation-offline-r1');
}

describe('monitored build safety behavior fixtures', () => {
  it('accepts a completed build only after both streams reach EOF and no descendants remain', () => {
    expect(decide({ rootAlive: false, stdout: 'eof', stderr: 'eof', elapsed: 20, sinceProgress: 0, descendants: [] })).toBe('COMPLETED_GREEN');
    expect(decide({ rootAlive: false, stdout: 'eof', stderr: 'pending', elapsed: 20, sinceProgress: 0, descendants: [] })).toBe('DRAINING');
  });

  it('bounds timeout and stall states independently', () => {
    expect(decide({ rootAlive: true, stdout: 'pending', stderr: 'pending', elapsed: 360, sinceProgress: 2, descendants: [] })).toBe('TIMED_OUT');
    expect(decide({ rootAlive: true, stdout: 'pending', stderr: 'pending', elapsed: 20, sinceProgress: 240, descendants: [] })).toBe('STALLED');
  });

  it('drains late output until explicit stdout and stderr EOF', () => {
    const first = decide({ rootAlive: false, stdout: 'line', stderr: 'pending', elapsed: 5, sinceProgress: 0, descendants: [] });
    const final = decide({ rootAlive: false, stdout: 'eof', stderr: 'eof', elapsed: 6, sinceProgress: 0, descendants: [] });
    expect(first).toBe('DRAINING');
    expect(final).toBe('COMPLETED_GREEN');
  });

  it('retains a grandchild identity after its intermediate parent exits', () => {
    const owned = new Map<string, Identity>();
    const parent = { pid: 22, parent: 11, created: 100, executable: 'C:\\node.exe' };
    const grandchild = { pid: 33, parent: 22, created: 200, executable: 'C:\\worker.exe' };
    mergeDescendants(owned, [parent, grandchild]);
    const later = mergeDescendants(owned, [grandchild]);
    expect(later).toHaveLength(2);
    expect(decide({ rootAlive: false, stdout: 'eof', stderr: 'eof', elapsed: 20, sinceProgress: 0, descendants: [later[1]] })).toBe('CHILD_SURVIVOR');
  });

  it('rejects PID reuse when creation identity or executable changes', () => {
    const saved = { pid: 33, parent: 22, created: 200, executable: 'C:\\worker.exe' };
    expect(sameIdentity(saved, { ...saved, created: 201 })).toBe(false);
    expect(sameIdentity(saved, { ...saved, executable: 'C:\\unrelated.exe' })).toBe(false);
  });

  it('rejects a second one-shot claim without changing the consumed namespace', () => {
    const claims = new Set(['MONITORED_BUILD_R1/ONE_SHOT_CLAIM']);
    const before = [...claims];
    expect(canClaim(claims, 'MONITORED_BUILD_R1/ONE_SHOT_CLAIM')).toBe(false);
    expect([...claims]).toEqual(before);
  });

  it('detects candidate byte drift by both size and SHA-256', () => {
    const original = new TextEncoder().encode('candidate');
    const digest = createHash('sha256').update(original).digest('hex');
    expect(verifyCandidate(original, original.byteLength, digest)).toBe(true);
    expect(verifyCandidate(new TextEncoder().encode('changed!'), original.byteLength, digest)).toBe(false);
  });

  it('accepts only an exact zero-byte npm config payload', () => {
    expect(isZeroByteConfig(new Uint8Array())).toBe(true);
    expect(isZeroByteConfig(new TextEncoder().encode('\n'))).toBe(false);
  });

  it('requires the joint permit beneath the MC-owned reviews root', () => {
    expect(isGovernedPermitPath('C:\\Projects\\MC\\bn-rrm\\reviews\\joint.json', 'C:\\Projects\\MC\\bn-rrm\\reviews')).toBe(true);
    expect(isGovernedPermitPath('C:\\Users\\executor\\.tmp\\permit.json', 'C:\\Projects\\MC\\bn-rrm\\reviews')).toBe(false);
    expect(isGovernedPermitPath('C:\\Projects\\MC\\bn-rrm\\reviews\\__GOVERNANCE_SUPPLIED_EXACT_RECEIPT_PATH_REQUIRED__', 'C:\\Projects\\MC\\bn-rrm\\reviews')).toBe(false);
  });
});
