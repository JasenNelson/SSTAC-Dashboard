export const DOWNLOAD_MANIFEST_SCHEMA = 'matrix-paper-download-manifest-v1' as const;
export const DOWNLOAD_MANIFEST_STATUS = 'REVIEW_READY_NOT_GREEN' as const;
export const DOWNLOAD_VALIDATION_STATE = 'SERVER_VALIDATED' as const;
export const DOWNLOAD_PACKAGE_KINDS = ['PDF', 'DOCX'] as const;
const DOWNLOAD_ROUTE_PREFIX = '/api/matrix-options/paper/downloads/';
const PACKAGE_ID_PATTERN = /^[a-z0-9][a-z0-9._-]*$/;
const RELEASE_IDENTITY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
const FILE_NAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*\.(pdf|docx)$/;

export type DownloadPackageKind = typeof DOWNLOAD_PACKAGE_KINDS[number];
export interface DownloadManifestPackage {
  readonly packageId: string; readonly kind: DownloadPackageKind; readonly label: string; readonly fileName: string;
  readonly path: string; readonly href: string; readonly sha256: string; readonly byteLength: number;
  readonly documentVersion: string; readonly manifestSha256: string; readonly order: number;
}
export interface ServerDownloadManifest {
  readonly schemaVersion: typeof DOWNLOAD_MANIFEST_SCHEMA; readonly validationState: typeof DOWNLOAD_VALIDATION_STATE;
  readonly status: typeof DOWNLOAD_MANIFEST_STATUS; readonly releaseIdentity: string; readonly documentVersion: string;
  readonly manifestSha256: string; readonly packages: readonly DownloadManifestPackage[];
}
export type VerifiedDownloadManifest = ServerDownloadManifest;
export interface DownloadManifestExpectation { readonly documentVersion: string; readonly manifestSha256: string; readonly releaseIdentity?: string; }
export class DownloadManifestError extends Error { constructor(message: string) { super(`Invalid download manifest: ${message}`); this.name = 'DownloadManifestError'; } }
function fail(message: string): never { throw new DownloadManifestError(message); }
function isSha256(value: unknown): value is string { return typeof value === 'string' && /^[a-f0-9]{64}$/.test(value); }
function isStableId(value: unknown): value is string { return typeof value === 'string' && PACKAGE_ID_PATTERN.test(value); }
function isReleaseIdentity(value: unknown): value is string { return typeof value === 'string' && RELEASE_IDENTITY_PATTERN.test(value); }
function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === 'object' && value !== null && !Array.isArray(value); }

function validatePackage(raw: unknown, expected: DownloadManifestExpectation): DownloadManifestPackage {
  if (!isRecord(raw)) fail('package entry object');
  const entry = raw as Partial<DownloadManifestPackage>;
  if (!isStableId(entry.packageId) || entry.packageId !== entry.packageId.toLowerCase()) fail('opaque package ID');
  if (!DOWNLOAD_PACKAGE_KINDS.includes(entry.kind as DownloadPackageKind)) fail('package kind');
  if (typeof entry.label !== 'string' || !entry.label.trim() || /[\r\n\u0000-\u001f\u007f]/.test(entry.label)) fail('package label');
  if (typeof entry.fileName !== 'string' || !FILE_NAME_PATTERN.test(entry.fileName)) fail('package filename');
  const extension = entry.kind === 'PDF' ? '.pdf' : '.docx';
  if (!entry.fileName.toLowerCase().endsWith(extension)) fail('package filename extension');
  if (!isSha256(entry.sha256) || !isSha256(entry.manifestSha256) || entry.manifestSha256 !== expected.manifestSha256) fail('package integrity binding');
  if (typeof entry.documentVersion !== 'string' || entry.documentVersion !== expected.documentVersion) fail('package release binding');
  if (typeof entry.byteLength !== 'number' || !Number.isSafeInteger(entry.byteLength) || entry.byteLength <= 0) fail('package byte length');
  if (typeof entry.order !== 'number' || !Number.isSafeInteger(entry.order) || entry.order < 0) fail('package order');
  if (entry.path !== `opaque/${entry.packageId}` || entry.href !== `${DOWNLOAD_ROUTE_PREFIX}${entry.packageId}`) fail('opaque package route binding');
  return Object.freeze({ packageId: entry.packageId, kind: entry.kind as DownloadPackageKind, label: entry.label.trim(), fileName: entry.fileName, path: entry.path, href: entry.href, sha256: entry.sha256, byteLength: entry.byteLength, documentVersion: entry.documentVersion, manifestSha256: entry.manifestSha256, order: entry.order });
}

export function validateDownloadManifest(candidate: unknown, expected: DownloadManifestExpectation): VerifiedDownloadManifest {
  if (!isSha256(expected.manifestSha256) || typeof expected.documentVersion !== 'string' || !expected.documentVersion.trim()) fail('expected release binding');
  if (expected.releaseIdentity !== undefined && !isReleaseIdentity(expected.releaseIdentity)) fail('expected release identity');
  if (!isRecord(candidate) || candidate.schemaVersion !== DOWNLOAD_MANIFEST_SCHEMA || candidate.validationState !== DOWNLOAD_VALIDATION_STATE || candidate.status !== DOWNLOAD_MANIFEST_STATUS || !isReleaseIdentity(candidate.releaseIdentity) || candidate.documentVersion !== expected.documentVersion || !isSha256(candidate.manifestSha256) || candidate.manifestSha256 !== expected.manifestSha256 || (expected.releaseIdentity !== undefined && candidate.releaseIdentity !== expected.releaseIdentity) || !Array.isArray(candidate.packages) || candidate.packages.length !== 2) fail('release binding or packages');
  const packages = candidate.packages.map((entry) => validatePackage(entry, expected));
  const ids = new Set<string>(); const orders = new Set<number>(); const kinds = new Set<DownloadPackageKind>();
  for (const entry of packages) { if (ids.has(entry.packageId)) fail('duplicate package ID'); if (orders.has(entry.order)) fail('duplicate package order'); if (kinds.has(entry.kind)) fail('duplicate package kind'); ids.add(entry.packageId); orders.add(entry.order); kinds.add(entry.kind); }
  if (kinds.size !== 2 || !kinds.has('PDF') || !kinds.has('DOCX')) fail('complete PDF and DOCX catalog required');
  const releaseIdentity = candidate.releaseIdentity as string;
  const documentVersion = candidate.documentVersion as string;
  const manifestSha256 = candidate.manifestSha256 as string;
  return Object.freeze({ schemaVersion: DOWNLOAD_MANIFEST_SCHEMA, validationState: DOWNLOAD_VALIDATION_STATE, status: DOWNLOAD_MANIFEST_STATUS, releaseIdentity, documentVersion, manifestSha256, packages: Object.freeze([...packages].sort((left, right) => left.order - right.order || left.packageId.localeCompare(right.packageId))) });
}

export function selectDownloadPackages(manifest: VerifiedDownloadManifest, packageIds?: readonly string[]): readonly DownloadManifestPackage[] {
  if (packageIds === undefined) return manifest.packages;
  const requested = new Set(packageIds); if (requested.size !== packageIds.length) fail('duplicate requested package ID');
  const selected = manifest.packages.filter((entry) => requested.has(entry.packageId)); if (selected.length !== requested.size) fail('requested package absent'); return selected;
}
