import type { DownloadPackageKind } from '@/lib/matrix-options/paper/download-manifest';

/**
 * Shape of the private print-package catalog DATA document.
 *
 * This contract lives in its own module so that the catalog data, the catalog
 * payload authentication, and the download trust boundary can all refer to one
 * definition without forming an import cycle. It is a type-only contract: it
 * carries no runtime behaviour and grants no trust by itself. Content trust in
 * the catalog comes solely from
 * `authenticatePrintPackageCatalogPayload` in `print-packages-catalog-authentication`.
 */
export interface PrivateCatalogEntry {
  readonly packageId: string;
  readonly kind: DownloadPackageKind;
  readonly label: string;
  readonly fileName: string;
  readonly cohortId: string;
  readonly order: number;
  readonly byteLength: number;
  readonly sha256: string;
  readonly path: string;
}

export interface PrivateCatalogDocument {
  readonly schema: string;
  readonly status: string;
  readonly sourceRelease: string;
  readonly sourcePaperSha256: string;
  /**
   * Self-declared provenance LABEL recording which upstream catalog build this
   * data claims to originate from.
   *
   * It is NOT content authentication: it is supplied by the same document it
   * would be describing, so an actor able to rewrite an artifact entry can
   * leave this literal untouched. It is deliberately excluded from the bytes
   * covered by the pinned payload digest. Do not treat a match on this field as
   * evidence that the artifact list is intact.
   */
  readonly sourceCatalogSha256: string;
  readonly sourceReviewManifestSha256: string;
  readonly artifacts: readonly PrivateCatalogEntry[];
}
