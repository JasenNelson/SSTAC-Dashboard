import 'server-only';

import { createHash, timingSafeEqual } from 'node:crypto';

import type { DownloadPackageKind } from '@/lib/matrix-options/paper/download-manifest';
import type { PrivateCatalogDocument } from './print-packages-catalog-contract';

/**
 * Content authentication for the private print-package catalog.
 *
 * THREAT MODEL (bounded, stated honestly):
 *
 * What this DOES detect: NON-ADVERSARIAL drift in the catalog DATA values -
 * a bad regeneration, a partial or botched merge, a hand edit, a stale copy, or
 * a substitution of one cohort's storage path, byte length, content hash,
 * package identity or cohort identity for another's. Any such change to the
 * VALUES alters the canonical payload digest and fails closed here, BEFORE any
 * manifest or artifact route can expose the catalog. That is the realistic
 * failure mode for a generated data file, and it is what this is for.
 *
 * WHY THE CATALOG IS INERT JSON, AND WHY THAT IS THE LOAD-BEARING PART:
 * the catalog source is `contracts/print-packages-v1.json`, plain data imported
 * through the bundler. It was previously a `.ts` MODULE, and that was not
 * defensible: `download-manifest-server.ts` imported it BEFORE this
 * authenticator, so its top-level code ran first and could rewrite the realm
 * intrinsics this module is built out of - `Array.prototype.map`,
 * `Object.prototype.toJSON`, `Array.isArray`, `Number.isSafeInteger`,
 * `Object.freeze`, `Buffer.from`, even `timingSafeEqual` - feeding the honest
 * pinned values to the hash and different values to the consumer. Three
 * successive in-realm hardening attempts (consume-the-return-value,
 * copy-out-of-the-container, avoid-container-methods) were each broken that way
 * by review. The correctness argument for defending an untrusted MODULE from
 * inside its own realm cannot be completed, so the data was made inert instead.
 * JSON cannot express a getter, a Proxy, an overridden prototype method, or any
 * executable expression, so an edit to the catalog can only change VALUES - and
 * changed values are exactly what the pinned digest detects.
 *
 * DO NOT convert the catalog back to a `.ts` module, or to any format that can
 * carry code. A regression test asserts the source is inert JSON.
 *
 * Still not code-signing: someone who can edit THIS module, or the pinned
 * constant, or the tests, is inside the trust boundary by definition. The
 * read-once copy-out, strict type checks, ordering and freezing below are
 * retained as defence in depth, not as the primary control.
 *
 * WHY THE SELF-DECLARED FIELD IS NOT ENOUGH: the catalog document carries its
 * own `sourceCatalogSha256` field. Comparing that field to a pinned literal
 * authenticates nothing about the artifact list, because the same actor that
 * rewrites an artifact's `path`/`sha256`/`byteLength` also controls the
 * self-declared literal and can leave it untouched. `sourceCatalogSha256` is
 * therefore retained ONLY as a provenance label; it is deliberately EXCLUDED
 * from the bytes authenticated here, and it is not treated as content
 * authentication anywhere in this codebase.
 *
 * WHY THIS RETURNS A SNAPSHOT (read-once discipline, retained as defence in depth):
 * the catalog WAS an executable TypeScript module. A tampered module could
 * define a GETTER or a Proxy rather than a literal and return a different value
 * on each read, so if authentication hashed one read and the trust boundary
 * re-read the object, the pinned value could be served to the hash and a
 * substituted value to the consumer with the digest still matching. Option B
 * removed that capability at the source, so this is no longer the control that
 * stops it. It is kept because it costs nothing and would still hold if the data
 * source ever regained the ability to execute: every security-relevant field is
 * read EXACTLY ONCE here into frozen plain objects, and callers consume the
 * returned snapshot rather than the imported data.
 */

/**
 * SHA-256 over `canonicalizePrintPackageCatalogPayload(PRINT_PACKAGES_CATALOG)`.
 *
 * Derived ONCE, out of band, from the reviewed catalog at correction time and
 * pinned here as an independent release constant. It is deliberately NOT
 * recomputed from the catalog at runtime -- a digest read from, or recomputed
 * over, the object it claims to authenticate proves nothing. When the catalog
 * is intentionally re-provisioned, this constant must be updated in the same
 * reviewed change as the data, which is the point: the update becomes visible.
 *
 * HOW TO RECOMPUTE after an intentional catalog re-provisioning:
 *   npx vitest run src/lib/matrix-options/paper/__tests__/download-manifest-server.test.ts
 * The BASELINE test fails with the newly computed digest printed in its message,
 * plus instructions. Paste that value here and re-review this constant together
 * with the catalog data in the SAME change. Never update this constant on its own
 * just to make a failing test pass: an unexplained mismatch is exactly the drift
 * the pin exists to catch.
 */
export const EXPECTED_CATALOG_PAYLOAD_SHA256 =
  '984f6a8031162c3d43dbf7bb2de77d36904d46a7bc674443ed78f7ddae2fa5da';

/**
 * Upper bound on how many artifact entries will even be examined. The pinned
 * catalog has ten. This only exists so a hostile `length` cannot turn the
 * read-once copy loop into an unbounded one before any digest comparison runs.
 */
const MAX_CATALOG_ARTIFACTS = 1000;

/**
 * The catalog's self-declared provenance LABEL, pinned here beside the payload
 * digest so the two release constants are updated and reviewed together.
 *
 * It records which upstream catalog build the data claims to come from. It is
 * NOT content authentication - the data supplies it about itself - and it is
 * deliberately excluded from the authenticated payload. It previously lived as a
 * bare 64-hex literal inside the trust boundary, a third copy that an intentional
 * re-provisioning could easily miss.
 */
export const EXPECTED_CATALOG_PROVENANCE_LABEL =
  '3dd253316b177dfe3f962070c24e95ad29e0abf4971eca33813b157f0876619f';

/** Own keys permitted on the catalog document and on each artifact. */
const ALLOWED_DOCUMENT_KEYS: readonly string[] = [
  'schema',
  'status',
  'sourceRelease',
  'sourcePaperSha256',
  'sourceCatalogSha256',
  'sourceReviewManifestSha256',
  'artifacts',
];
const ALLOWED_ARTIFACT_KEYS: readonly string[] = [
  'byteLength',
  'cohortId',
  'fileName',
  'kind',
  'label',
  'order',
  'packageId',
  'path',
  'sha256',
];

/** One artifact, read exactly once out of the catalog module and frozen. */
export interface AuthenticatedCatalogArtifact {
  readonly byteLength: number;
  readonly cohortId: string;
  readonly fileName: string;
  readonly kind: DownloadPackageKind;
  readonly label: string;
  readonly order: number;
  readonly packageId: string;
  readonly path: string;
  readonly sha256: string;
}

/**
 * The authenticated, immutable view of the catalog. This - not the imported
 * module object - is what the trust boundary consumes.
 */
export interface AuthenticatedCatalogSnapshot {
  readonly schema: string;
  readonly status: string;
  readonly sourceRelease: string;
  readonly sourcePaperSha256: string;
  readonly sourceReviewManifestSha256: string;
  /** Provenance LABEL only. Excluded from the authenticated bytes by design. */
  readonly sourceCatalogSha256: string;
  readonly artifacts: readonly AuthenticatedCatalogArtifact[];
}

export class CatalogAuthenticationError extends Error {
  readonly code = 'PRIVATE_CATALOG_PAYLOAD_AUTHENTICATION_FAILED' as const;

  constructor(message: string) {
    super(message);
    this.name = 'CatalogAuthenticationError';
  }
}

function fail(message: string): never {
  throw new CatalogAuthenticationError(message);
}

function requireString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    fail(`Private package catalog field ${field} is not a non-empty string.`);
  }
  return value;
}

function requireSafeInteger(value: unknown, field: string): number {
  // `Object.is(value, -0)` is rejected explicitly: -0 satisfies
  // Number.isSafeInteger but JSON.stringify emits it as "0", so -0 and 0 would
  // share a digest. Excluding it keeps the canonical form faithful to the value.
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || Object.is(value, -0)) {
    fail(`Private package catalog field ${field} is not a safe integer.`);
  }
  return value;
}

/**
 * Reads every security-relevant field EXACTLY ONCE and returns frozen plain
 * objects. Each field is pulled into a local before use, so a getter or Proxy on
 * the source module cannot return one value to the hash and another to the
 * consumer: there is only ever one read.
 *
 * Determinism rules for the snapshot's ordering, all explicit:
 *  - Artifact order is fixed by sorting on (cohortId, packageId), both
 *    constrained stable IDs, so a benign reordering of the source array does not
 *    change the digest while any change to artifact identity does.
 *  - Every value is type-checked. This matters because `JSON.stringify` silently
 *    omits `undefined` members, which would otherwise let two materially
 *    different payloads serialize to the same bytes.
 *  - Duplicate (cohortId, packageId) pairs are rejected.
 */
/**
 * Rejects any own key outside the allowlist.
 *
 * Without this, an unknown extra key would sit OUTSIDE the authenticated
 * payload, which made this module's own claim - that an edit to the catalog can
 * only change values the pin detects - broader than what was actually enforced.
 * Rejecting unknown keys makes that claim literally true, and incidentally
 * settles any question about how a `__proto__` key would be emitted by the
 * bundler, because such a key is simply refused.
 */
function rejectUnknownKeys(value: object, allowed: readonly string[], where: string): void {
  for (const key of Object.getOwnPropertyNames(value)) {
    if (!allowed.includes(key)) {
      fail(`Private package catalog ${where} carries an unexpected key: ${key}.`);
    }
  }
}

function snapshotCatalog(catalog: PrivateCatalogDocument): AuthenticatedCatalogSnapshot {
  if (!catalog || typeof catalog !== 'object') fail('Private package catalog is not an object.');
  rejectUnknownKeys(catalog, ALLOWED_DOCUMENT_KEYS, 'document');

  // Single read of the array reference; everything below works off this local.
  const rawArtifacts = catalog.artifacts;
  if (!Array.isArray(rawArtifacts)) fail('Private package catalog artifacts is not an array.');

  // NEVER call a method on the untrusted container. `Array.isArray` is true for
  // an Array SUBCLASS and for a Proxy wrapping an array, and such an object can
  // override `map`, `sort`, `filter` or `Symbol.iterator`. If we used those, the
  // container could hand the honest pinned entries to the hash and different
  // entries to the consumer, which is exactly the desynchronization the snapshot
  // exists to prevent - freezing the container does not replace its methods.
  // So: read `length` once, read each index once, and copy every value into an
  // array WE created. From here on only genuine Array.prototype methods run.
  const rawLength = (rawArtifacts as readonly unknown[]).length;
  if (!Number.isSafeInteger(rawLength) || rawLength < 0 || rawLength > MAX_CATALOG_ARTIFACTS) {
    fail('Private package catalog artifacts length is not a plausible safe integer.');
  }

  const artifacts: AuthenticatedCatalogArtifact[] = [];
  for (let index = 0; index < rawLength; index += 1) {
    const rawArtifact = (rawArtifacts as readonly unknown[])[index] as PrivateCatalogDocument['artifacts'][number];
    if (!rawArtifact || typeof rawArtifact !== 'object') {
      fail(`Private package catalog artifact at index ${index} is not an object.`);
    }
    rejectUnknownKeys(rawArtifact, ALLOWED_ARTIFACT_KEYS, `artifacts[${index}]`);
    const kind = requireString(rawArtifact.kind, `artifacts[${index}].kind`);
    if (kind !== 'PDF' && kind !== 'DOCX') {
      fail(`Private package catalog artifact at index ${index} has an unknown kind.`);
    }
    artifacts.push(Object.freeze({
      byteLength: requireSafeInteger(rawArtifact.byteLength, `artifacts[${index}].byteLength`),
      cohortId: requireString(rawArtifact.cohortId, `artifacts[${index}].cohortId`),
      fileName: requireString(rawArtifact.fileName, `artifacts[${index}].fileName`),
      kind: kind as DownloadPackageKind,
      label: requireString(rawArtifact.label, `artifacts[${index}].label`),
      order: requireSafeInteger(rawArtifact.order, `artifacts[${index}].order`),
      packageId: requireString(rawArtifact.packageId, `artifacts[${index}].packageId`),
      path: requireString(rawArtifact.path, `artifacts[${index}].path`),
      sha256: requireString(rawArtifact.sha256, `artifacts[${index}].sha256`),
    }));
  }

  artifacts.sort((left, right) => {
    if (left.cohortId !== right.cohortId) return left.cohortId < right.cohortId ? -1 : 1;
    if (left.packageId !== right.packageId) return left.packageId < right.packageId ? -1 : 1;
    return 0;
  });

  for (let index = 1; index < artifacts.length; index += 1) {
    const previous = artifacts[index - 1];
    const current = artifacts[index];
    if (previous.cohortId === current.cohortId && previous.packageId === current.packageId) {
      fail('Private package catalog contains a duplicate (cohortId, packageId) pair.');
    }
  }

  return Object.freeze({
    schema: requireString(catalog.schema, 'schema'),
    status: requireString(catalog.status, 'status'),
    sourceRelease: requireString(catalog.sourceRelease, 'sourceRelease'),
    sourcePaperSha256: requireString(catalog.sourcePaperSha256, 'sourcePaperSha256'),
    sourceReviewManifestSha256: requireString(
      catalog.sourceReviewManifestSha256,
      'sourceReviewManifestSha256',
    ),
    sourceCatalogSha256: requireString(catalog.sourceCatalogSha256, 'sourceCatalogSha256'),
    artifacts: Object.freeze(artifacts),
  });
}

/**
 * Deterministic canonical serialization of the security-relevant payload of an
 * already-snapshotted catalog.
 *
 * JSON is used (rather than concatenation) so field boundaries are unambiguous
 * and no value can be crafted to impersonate a delimiter. Field order is fixed
 * by the literals written here, not by key order in the source data.
 * `sourceCatalogSha256` is EXCLUDED: a document must not contribute its own
 * self-declared digest to the bytes that digest claims to authenticate.
 */
function serializeSnapshot(snapshot: AuthenticatedCatalogSnapshot): string {
  return JSON.stringify({
    schema: snapshot.schema,
    status: snapshot.status,
    sourceRelease: snapshot.sourceRelease,
    sourcePaperSha256: snapshot.sourcePaperSha256,
    sourceReviewManifestSha256: snapshot.sourceReviewManifestSha256,
    artifacts: snapshot.artifacts.map((artifact) => ({
      byteLength: artifact.byteLength,
      cohortId: artifact.cohortId,
      fileName: artifact.fileName,
      kind: artifact.kind,
      label: artifact.label,
      order: artifact.order,
      packageId: artifact.packageId,
      path: artifact.path,
      sha256: artifact.sha256,
    })),
  });
}

/** Canonical payload string for the supplied catalog. */
export function canonicalizePrintPackageCatalogPayload(catalog: PrivateCatalogDocument): string {
  return serializeSnapshot(snapshotCatalog(catalog));
}

/** SHA-256 hex digest of the canonical payload of the supplied catalog. */
export function digestPrintPackageCatalogPayload(catalog: PrivateCatalogDocument): string {
  return createHash('sha256')
    .update(canonicalizePrintPackageCatalogPayload(catalog), 'utf8')
    .digest('hex');
}

/**
 * Authenticates the ACTUAL imported catalog payload against the independently
 * pinned release constant and returns the frozen snapshot that was hashed.
 *
 * Callers MUST consume the returned snapshot and MUST NOT read the raw catalog
 * module afterwards; re-reading it would reintroduce the getter/Proxy
 * time-of-check-to-time-of-use gap this function exists to close.
 *
 * Throws `CatalogAuthenticationError` on any mismatch.
 */
export function authenticatePrintPackageCatalogPayload(
  catalog: PrivateCatalogDocument,
): AuthenticatedCatalogSnapshot {
  const snapshot = snapshotCatalog(catalog);
  const actual = createHash('sha256').update(serializeSnapshot(snapshot), 'utf8').digest('hex');
  const actualBytes = Buffer.from(actual, 'hex');
  const expectedBytes = Buffer.from(EXPECTED_CATALOG_PAYLOAD_SHA256, 'hex');
  if (
    actualBytes.length !== expectedBytes.length ||
    !timingSafeEqual(actualBytes, expectedBytes)
  ) {
    fail('Private package catalog payload does not match the pinned release digest.');
  }
  return snapshot;
}
