import { describe, expect, it, vi, afterEach } from 'vitest';
import {
  DownloadBoundaryError,
  contentDispositionForCatalog,
  loadAuthenticatedPrintPackageCatalog,
  loadDownloadManifestMapState,
  parseDownloadRequestBinding,
  selectOpaquePackageArtifact,
  streamAuthenticatedPrintPackageArtifact,
  validateOpaquePackageId,
  type PrintPackageArtifact,
  type TrustedDownloadContext,
} from '@/lib/matrix-options/paper/download-manifest-server';
import {
  EXPECTED_CATALOG_PAYLOAD_SHA256,
  canonicalizePrintPackageCatalogPayload,
  digestPrintPackageCatalogPayload,
} from '@/lib/matrix-options/paper/print-packages-catalog-authentication';
import type { PrivateCatalogDocument } from '@/lib/matrix-options/paper/print-packages-catalog-contract';
import type { SupabaseClient } from '@supabase/supabase-js';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

/** The inert JSON catalog contract, resolved from the repo root. */
const CATALOG_JSON_PATH = path.join(
  process.cwd(),
  'src/lib/matrix-options/paper/contracts/print-packages-v1.json',
);

const REAL_VERSION = '1.0.11-remediated-7-8-successor-20260918-D';
const REAL_PAPER_HASH = 'feb62bd63c46f9b799a705da9ccb6db41974512ca4c73d9582111eeb3ae47337';
const REAL_MANIFEST_HASH = '5d83a3c9ba78e4da234c70678fcf57db9abbefc189002303879ebc0c80ac926e';
const REAL_PROVENANCE_LABEL = '3dd253316b177dfe3f962070c24e95ad29e0abf4971eca33813b157f0876619f';
const ALL_COHORTS = [
  'categories',
  'exposure-assumptions',
  'inputs-evidence',
  'methods-water-type',
  'pathway-grid',
] as const;

/**
 * Catalog override harness.
 *
 * The REAL catalog module is always the base. A test may shallow-override
 * top-level fields to simulate drift or tampering. Nothing here ever supplies a
 * substitute expected digest: the pin under test is the production constant, so
 * a mutated payload has no way to talk its way past authentication.
 */
const catalogOverride = vi.hoisted(() => ({ current: null as Partial<PrivateCatalogDocument> | null }));

vi.mock('@/lib/matrix-options/paper/contracts/print-packages-v1.json', async () => {
  const actual = await vi.importActual<{ default: PrivateCatalogDocument }>(
    '@/lib/matrix-options/paper/contracts/print-packages-v1.json',
  );
  return {
    get default() {
      return catalogOverride.current
        ? { ...actual.default, ...catalogOverride.current }
        : actual.default;
    },
  };
});

afterEach(() => {
  catalogOverride.current = null;
});

async function realCatalog(): Promise<PrivateCatalogDocument> {
  const actual = await vi.importActual<{ default: PrivateCatalogDocument }>(
    '@/lib/matrix-options/paper/contracts/print-packages-v1.json',
  );
  return actual.default;
}

function realContext(overrides?: Partial<TrustedDownloadContext>): TrustedDownloadContext {
  return {
    documentVersion: REAL_VERSION,
    manifestSha256: REAL_MANIFEST_HASH,
    paperSha256: REAL_PAPER_HASH,
    releaseIdentity: 'release',
    paperReleaseIdentity: 'paper',
    cohortQuestionIds: Object.fromEntries(ALL_COHORTS.map((id) => [id, ['q1']])),
    reviewManifest: {} as TrustedDownloadContext['reviewManifest'],
    ...overrides,
  };
}

/**
 * Fabricated artifacts for the STREAMING boundary only.
 *
 * This is legitimate because `streamAuthenticatedPrintPackageArtifact` now
 * consumes an already-authenticated artifact and never re-reads the catalog.
 * The fixture is deliberately NOT given any capability the real artifact lacks:
 * its sha256 is the true digest of the bytes the storage double returns.
 */
const STREAM_BYTES = 110968;
const STREAM_SHA256 = '6b0c82cc9821bbf8483452bdf92439198857221090f4a862e4574ad4d992ee64';

const pdfArtifact: PrintPackageArtifact = {
  packageId: 'categories-pdf',
  kind: 'PDF',
  label: 'categories PDF',
  fileName: 'matrix-options-categories-preview.pdf',
  sha256: STREAM_SHA256,
  byteLength: STREAM_BYTES,
  order: 0,
  cohortId: 'categories',
  documentVersion: REAL_VERSION,
  manifestSha256: REAL_MANIFEST_HASH,
  serverAssetLocator: 'private-print-package:categories-pdf',
  storagePath: 'categories/matrix-options-categories-preview.pdf',
};

const docxArtifact: PrintPackageArtifact = {
  ...pdfArtifact,
  packageId: 'categories-docx',
  kind: 'DOCX',
  label: 'categories DOCX',
  fileName: 'matrix-options-categories-preview.docx',
  order: 1,
  serverAssetLocator: 'private-print-package:categories-docx',
  storagePath: 'categories/matrix-options-categories-preview.docx',
};

function storageDouble(bytes: Buffer, size = bytes.length): SupabaseClient {
  return {
    storage: {
      from: vi.fn(() => ({
        download: vi.fn(async () => ({
          data: { size, arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.length) },
          error: null,
        })),
      })),
    },
  } as unknown as SupabaseClient;
}

describe('catalog payload authentication (P1 correction)', () => {
  it('pins an expected digest that is a fixed literal, not a value recomputed from the catalog', () => {
    // Guards against a circular pin. If someone replaces the constant with a
    // runtime recomputation, this literal stops matching and the suite fails.
    expect(EXPECTED_CATALOG_PAYLOAD_SHA256).toBe(
      '984f6a8031162c3d43dbf7bb2de77d36904d46a7bc674443ed78f7ddae2fa5da',
    );
    expect(EXPECTED_CATALOG_PAYLOAD_SHA256).toMatch(/^[a-f0-9]{64}$/);
  });

  it('BASELINE: the exact valid catalog authenticates and loads all five cohorts', async () => {
    // Mutation results below are only meaningful because this unmutated
    // baseline passes first.
    const catalog = await realCatalog();
    const actual = digestPrintPackageCatalogPayload(catalog);
    expect(
      actual,
      [
        'The private print-package catalog no longer matches its pinned payload digest.',
        'If this is an INTENTIONAL re-provisioning of the catalog, update',
        'EXPECTED_CATALOG_PAYLOAD_SHA256 in',
        'src/lib/matrix-options/paper/print-packages-catalog-authentication.ts to:',
        `  ${actual}`,
        'and re-review that constant together with the catalog data in the same change.',
        'If you did NOT intend to change the catalog, this is the drift the pin exists to catch:',
        'do not update the constant - find out what changed the data.',
      ].join(' '),
    ).toBe(EXPECTED_CATALOG_PAYLOAD_SHA256);

    const loaded = await loadAuthenticatedPrintPackageCatalog(realContext());
    expect(loaded).not.toBeNull();
    expect(loaded).toHaveLength(10);
    expect(new Set(loaded!.map((a) => a.cohortId))).toEqual(new Set(ALL_COHORTS));
  });

  it('excludes the self-declared digest from the bytes it claims to authenticate', async () => {
    const catalog = await realCatalog();
    const payload = canonicalizePrintPackageCatalogPayload(catalog);
    expect(payload).not.toContain('sourceCatalogSha256');
    expect(payload).not.toContain(REAL_PROVENANCE_LABEL);
    // Changing only the self-declared field leaves the authenticated bytes intact.
    expect(
      digestPrintPackageCatalogPayload({ ...catalog, sourceCatalogSha256: 'f'.repeat(64) }),
    ).toBe(EXPECTED_CATALOG_PAYLOAD_SHA256);
  });

  it('STRUCTURAL: the catalog source is inert JSON and cannot carry executable constructs', () => {
    // This is the PRIMARY control after Option B. The catalog is a .json contract,
    // not a .ts module, so its content cannot define getters, Proxies, overridden
    // prototype methods or any top-level code - and therefore cannot rewrite the
    // intrinsics the authenticator is built from. An edit to this file can only
    // change VALUES, which is exactly what the pinned digest detects.
    const raw = readFileSync(CATALOG_JSON_PATH, 'utf8');

    // It must genuinely be JSON. If someone converts it back to a module, this fails.
    const parsed = JSON.parse(raw) as PrivateCatalogDocument;
    expect(CATALOG_JSON_PATH.endsWith('.json')).toBe(true);
    expect(raw).not.toMatch(/\bfunction\b|=>|\bget\s+\w+\s*\(|\bProxy\b|\brequire\b|\beval\b/);

    // Nothing in a JSON parse result can be an accessor; assert it rather than assume.
    for (const key of Object.keys(parsed)) {
      expect(Object.getOwnPropertyDescriptor(parsed, key)?.get).toBeUndefined();
    }
    for (const artifact of parsed.artifacts) {
      for (const [key, value] of Object.entries(artifact)) {
        expect(Object.getOwnPropertyDescriptor(artifact, key)?.get).toBeUndefined();
        expect(['string', 'number']).toContain(typeof value);
      }
    }

    // Every artifact kind must be one of the two real enum members. The JSON
    // import is an unchecked cast at the boundary, so assert the enum here.
    for (const artifact of parsed.artifacts) {
      expect(['PDF', 'DOCX']).toContain(artifact.kind);
    }

    // The shipped trust boundary must actually import THIS file. Without this,
    // someone could add a sibling catalog module and switch the import, and the
    // inertness assertions above would still pass while guarding nothing.
    const boundary = readFileSync(
      path.join(process.cwd(), 'src/lib/matrix-options/paper/download-manifest-server.ts'),
      'utf8',
    );
    expect(boundary).toMatch(/from '\.\/contracts\/print-packages-v1\.json'/);
    // No catalog DATA module may sit beside it. These two are CODE (the
    // authenticator and its type contract) and are expected; anything else
    // matching the catalog name is a reintroduced executable data source.
    const CATALOG_CODE_MODULES = [
      'print-packages-catalog-authentication.ts',
      'print-packages-catalog-contract.ts',
    ];
    const catalogDir = path.join(process.cwd(), 'src/lib/matrix-options/paper');
    expect(
      readdirSync(catalogDir).filter(
        (f) => /^print-packages.*\.(ts|tsx|js|mjs|cjs)$/.test(f) && !CATALOG_CODE_MODULES.includes(f),
      ),
    ).toEqual([]);

    // And the inert data still authenticates against the independently pinned digest.
    expect(digestPrintPackageCatalogPayload(parsed)).toBe(EXPECTED_CATALOG_PAYLOAD_SHA256);
  });

  it('rejects an UNKNOWN key, so the pin really does cover every field that ships', async () => {
    // The canonical payload covers an allowlist. An unknown key would otherwise
    // sit outside the digest, making the module's own claim broader than what is
    // enforced. Rejecting unknown keys makes the claim literally true.
    const catalog = await realCatalog();
    expect(() =>
      digestPrintPackageCatalogPayload({ ...catalog, smuggled: 'x' } as unknown as PrivateCatalogDocument),
    ).toThrow(/unexpected key: smuggled/);

    const withArtifactKey = {
      ...catalog,
      artifacts: catalog.artifacts.map((a, i) => (i === 0 ? { ...a, smuggled: 'x' } : a)),
    } as unknown as PrivateCatalogDocument;
    expect(() => digestPrintPackageCatalogPayload(withArtifactKey)).toThrow(/unexpected key: smuggled/);

    // A `__proto__` own key is refused by the same rule, whichever way a bundler
    // chooses to emit it.
    expect(() =>
      digestPrintPackageCatalogPayload(
        JSON.parse('{"__proto__":{"polluted":true},"schema":"x"}') as PrivateCatalogDocument,
      ),
    ).toThrow(/unexpected key/);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it('CONTAINMENT: the inert JSON has exactly one importer, and that importer is server-only', () => {
    // A protection was LOST in the move to JSON and is restored here as an
    // enforced invariant. The deleted .ts catalog carried `import 'server-only'`,
    // which made a client import a build error. A .json file cannot carry that.
    // Without this test, someone could import the catalog directly into a client
    // component and ship private storage paths and content hashes to the browser
    // with no build, lint or test failure.
    const root = process.cwd();
    const scanned: string[] = [];
    const importers: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (entry.name === 'node_modules' || entry.name === '.next') continue;
          walk(full);
        } else if (/\.(ts|tsx|mjs|js|jsx)$/.test(entry.name)) {
          scanned.push(full);
          // Match real module references only - an `import`/`require`/dynamic
          // `import()` that resolves the file - not a mention in a comment.
          const source = readFileSync(full, 'utf8');
          if (/(?:from\s*|import\s*\(\s*|require\s*\(\s*)['"][^'"]*print-packages-v1\.json['"]/.test(source)) {
            importers.push(full);
          }
        }
      }
    };
    walk(path.join(root, 'src'));
    expect(scanned.length).toBeGreaterThan(50); // the scan must actually be looking at files

    const productionImporters = importers.filter((f) => !f.includes('__tests__'));
    expect(productionImporters.map((f) => path.relative(root, f).replace(/\\/g, '/'))).toEqual([
      'src/lib/matrix-options/paper/download-manifest-server.ts',
    ]);
    expect(readFileSync(productionImporters[0], 'utf8')).toMatch(/^import 'server-only';/m);
  });

  it('is deterministic and order-independent for a benign artifact reordering', async () => {
    const catalog = await realCatalog();
    const reversed = { ...catalog, artifacts: [...catalog.artifacts].reverse() };
    expect(digestPrintPackageCatalogPayload(reversed)).toBe(EXPECTED_CATALOG_PAYLOAD_SHA256);
    expect(canonicalizePrintPackageCatalogPayload(catalog)).toBe(
      canonicalizePrintPackageCatalogPayload(reversed),
    );
  });
});

describe('old-behavior falsification: mutations that the self-declared digest could not catch', () => {
  /**
   * Every case below leaves `sourceCatalogSha256` at its real literal, which is
   * exactly the scenario the old check passed. Each asserts the SPECIFIC
   * payload-authentication failure, not merely "it threw" - otherwise a
   * different, later guard could shadow the mutation and the test would claim
   * coverage it does not have.
   */
  const EXPECTED_CODE = 'PRIVATE_CATALOG_PAYLOAD_AUTHENTICATION_FAILED';

  async function mutateArtifacts(
    mutate: (artifacts: PrivateCatalogDocument['artifacts']) => PrivateCatalogDocument['artifacts'],
  ): Promise<void> {
    const catalog = await realCatalog();
    catalogOverride.current = { artifacts: mutate(catalog.artifacts) };
    // Sanity: the provenance label is untouched, so the OLD check would pass.
    const live = (await import('@/lib/matrix-options/paper/contracts/print-packages-v1.json')).default as PrivateCatalogDocument;
    expect(live.sourceCatalogSha256).toBe(REAL_PROVENANCE_LABEL);

    const error = await loadAuthenticatedPrintPackageCatalog(realContext()).then(
      () => null,
      (caught: unknown) => caught,
    );
    expect(error).toBeInstanceOf(DownloadBoundaryError);
    expect((error as DownloadBoundaryError).code).toBe(EXPECTED_CODE);
    expect((error as DownloadBoundaryError).status).toBe(503);
  }

  it('fails closed when an artifact PATH is substituted for another cohort path', async () => {
    await mutateArtifacts((artifacts) =>
      artifacts.map((a) =>
        a.packageId === 'categories-pdf'
          ? { ...a, path: 'private-packages/pathway-grid/matrix-options-pathway-grid-preview.pdf' }
          : a,
      ),
    );
  });

  it('fails closed when an artifact content HASH is substituted', async () => {
    await mutateArtifacts((artifacts) =>
      artifacts.map((a) => (a.packageId === 'categories-pdf' ? { ...a, sha256: 'a'.repeat(64) } : a)),
    );
  });

  it('fails closed when an artifact byte LENGTH is altered', async () => {
    await mutateArtifacts((artifacts) =>
      artifacts.map((a) => (a.packageId === 'categories-pdf' ? { ...a, byteLength: a.byteLength + 1 } : a)),
    );
  });

  it('fails closed when an artifact COHORT identity is reassigned', async () => {
    await mutateArtifacts((artifacts) =>
      artifacts.map((a) => (a.packageId === 'categories-pdf' ? { ...a, cohortId: 'pathway-grid' } : a)),
    );
  });

  it('fails closed when an artifact PACKAGE identity is reassigned', async () => {
    await mutateArtifacts((artifacts) =>
      artifacts.map((a) => (a.packageId === 'categories-pdf' ? { ...a, packageId: 'categories-pdf-2' } : a)),
    );
  });

  it('fails closed when an artifact LABEL is spoofed onto the wrong kind', async () => {
    await mutateArtifacts((artifacts) =>
      artifacts.map((a) => (a.packageId === 'categories-docx' ? { ...a, label: 'categories PDF' } : a)),
    );
  });

  it('fails closed when an artifact FILENAME is substituted', async () => {
    await mutateArtifacts((artifacts) =>
      artifacts.map((a) =>
        a.packageId === 'categories-pdf' ? { ...a, fileName: 'matrix-options-pathway-grid-preview.pdf' } : a,
      ),
    );
  });

  it('fails closed when an artifact is REMOVED', async () => {
    await mutateArtifacts((artifacts) => artifacts.filter((a) => a.packageId !== 'methods-water-type-pdf'));
  });

  it('fails closed when a whole extra artifact is ADDED', async () => {
    await mutateArtifacts((artifacts) => [
      ...artifacts,
      { ...artifacts[0], packageId: 'smuggled-pdf', path: 'private-packages/categories/smuggled.pdf' },
    ]);
  });

  it('fails closed when the artifact list is EMPTIED, rather than reporting a pending state', async () => {
    // Deliberate behaviour change, recorded here so it cannot regress silently:
    // an empty artifact list is no longer accepted as "not yet provisioned".
    // An unauthenticated empty catalog would otherwise be a free denial of
    // service and would defeat the point of pinning the payload.
    await mutateArtifacts(() => []);
  });

  it('fails closed when top-level release provenance drifts', async () => {
    const catalog = await realCatalog();
    for (const override of [
      { sourceRelease: '9.9.9' },
      { sourcePaperSha256: 'b'.repeat(64) },
      { sourceReviewManifestSha256: 'c'.repeat(64) },
      { schema: 'matrix-twg-private-preview-package-catalog-v2' },
      { status: 'CANONICAL' },
    ]) {
      expect(digestPrintPackageCatalogPayload({ ...catalog, ...override })).not.toBe(
        EXPECTED_CATALOG_PAYLOAD_SHA256,
      );
    }
  });

  it('DEFENCE IN DEPTH: a hostile GETTER cannot split the hash from the consumer', async () => {
    // RETAINED, with its premise restated. After Option B the catalog source is
    // inert JSON and can no longer define an accessor at all, so this is no
    // longer the primary control - the structural inertness test above is. It is
    // kept because the read-once copy-out logic is retained as defence in depth,
    // and this is the only case that exercises it against an accessor. It would
    // also catch a regression that reintroduced an executable catalog source.
    const catalog = await realCatalog();
    let pathReads = 0;
    let cohortReads = 0;
    const honestPath = 'private-packages/categories/matrix-options-categories-preview.pdf';
    const attackPath = 'private-packages/pathway-grid/matrix-options-pathway-grid-preview.pdf';

    const artifacts = catalog.artifacts.map((a) => {
      if (a.packageId !== 'categories-pdf') return a;
      return {
        ...a,
        get path() {
          pathReads += 1;
          return pathReads === 1 ? honestPath : attackPath;
        },
        get cohortId() {
          cohortReads += 1;
          return cohortReads === 1 ? 'categories' : 'pathway-grid';
        },
      };
    });
    catalogOverride.current = { artifacts };

    const loaded = await loadAuthenticatedPrintPackageCatalog(realContext());
    expect(loaded).not.toBeNull();

    // Authentication must have passed (the first read is the honest value), and
    // every consumed value must come from the snapshot, not a later read.
    const attacked = loaded!.find((entry) => entry.packageId === 'categories-pdf')!;
    expect(attacked.cohortId).toBe('categories');
    expect(attacked.storagePath).toBe('categories/matrix-options-categories-preview.pdf');
    expect(attacked.storagePath).not.toContain('pathway-grid');

    // Each security field was read exactly once out of the catalog module.
    expect(pathReads).toBe(1);
    expect(cohortReads).toBe(1);
  });

  it('DEFENCE IN DEPTH: a hostile CONTAINER overriding map/iterator cannot split hash from consumer', async () => {
    // RETAINED, premise restated for the same reason as the getter case above:
    // inert JSON cannot supply a Proxy or an Array subclass, so this no longer
    // describes a reachable production threat. It still guards the retained
    // copy-out logic and would catch a regression to an executable source.
    // Originally: the ARRAY itself is catalog-controlled. A
    // Proxy over a real array still passes Array.isArray, and can override
    // `map` and `Symbol.iterator` so the hashing pass sees the honest pinned
    // entries while the consumer iterates substituted ones. Object.freeze on the
    // container does not replace those methods. The snapshot must therefore
    // never call a method on the untrusted container: length once, index once,
    // copy into our own array.
    const catalog = await realCatalog();
    const honest = [...catalog.artifacts];
    const malicious = honest.map((a) =>
      a.packageId === 'categories-pdf'
        ? { ...a, path: 'private-packages/pathway-grid/matrix-options-pathway-grid-preview.pdf', cohortId: 'pathway-grid' }
        : a,
    );

    const hostile = new Proxy(honest, {
      get(target, prop, receiver) {
        // Hand the honest entries to anything that calls a method...
        if (prop === 'map') return Array.prototype.map.bind(honest);
        if (prop === Symbol.iterator) return honest[Symbol.iterator].bind(honest);
        // ...but serve substituted entries to plain indexed reads.
        if (typeof prop === 'string' && /^\d+$/.test(prop)) return malicious[Number(prop)];
        return Reflect.get(target, prop, receiver);
      },
    });

    catalogOverride.current = { artifacts: hostile as unknown as typeof catalog.artifacts };

    // Indexed reads are what the snapshot uses, so the substituted values are
    // what gets hashed - and they do not match the pin. Fail closed.
    const error = await loadAuthenticatedPrintPackageCatalog(realContext()).then(
      () => null,
      (caught: unknown) => caught,
    );
    expect(error).toBeInstanceOf(DownloadBoundaryError);
    expect((error as DownloadBoundaryError).code).toBe('PRIVATE_CATALOG_PAYLOAD_AUTHENTICATION_FAILED');
  });

  it('still rejects a tampered self-declared provenance label at the release-binding step', async () => {
    // The label is no longer load-bearing for content, but it is still checked.
    // Payload authentication passes here precisely because the label is excluded.
    catalogOverride.current = { sourceCatalogSha256: '1'.repeat(64) };
    await expect(loadAuthenticatedPrintPackageCatalog(realContext())).rejects.toThrow(
      /metadata does not match trusted context/,
    );
  });
});

describe('release binding against the authenticated catalog', () => {
  it('fails closed when the trusted context manifest hash does not match', async () => {
    await expect(
      loadAuthenticatedPrintPackageCatalog(realContext({ manifestSha256: 'deadbeef' })),
    ).rejects.toThrow(/metadata does not match trusted context/);
  });

  it('fails closed when the trusted context paper hash does not match', async () => {
    await expect(
      loadAuthenticatedPrintPackageCatalog(realContext({ paperSha256: 'deadbeef' })),
    ).rejects.toThrow(/metadata does not match trusted context/);
  });

  it('fails closed when the trusted context document version does not match', async () => {
    await expect(
      loadAuthenticatedPrintPackageCatalog(realContext({ documentVersion: '9.9.9' })),
    ).rejects.toThrow(/metadata does not match trusted context/);
  });

  it('validates the COMPLETE catalog before slicing a single requested cohort', async () => {
    // A caller asking only for 'categories' must still be refused when a
    // different cohort is incomplete, so slicing cannot hide a broken catalog.
    const catalog = await realCatalog();
    catalogOverride.current = {
      artifacts: catalog.artifacts.filter((a) => a.cohortId !== 'methods-water-type'),
    };
    await expect(loadAuthenticatedPrintPackageCatalog(realContext(), 'categories')).rejects.toThrow(
      DownloadBoundaryError,
    );
  });
});

describe('five-cohort manifest map', () => {
  it('builds a distinct, correctly bound manifest for all five cohorts', async () => {
    const mapState = await loadDownloadManifestMapState(REAL_VERSION, REAL_MANIFEST_HASH);
    expect(mapState.status).toBe('ready');
    const manifests = mapState.manifests!;
    expect(new Set(Object.keys(manifests))).toEqual(new Set(ALL_COHORTS));

    for (const cohortId of ALL_COHORTS) {
      const manifest = manifests[cohortId];
      expect(manifest.packages.map((p) => p.packageId)).toEqual([`${cohortId}-pdf`, `${cohortId}-docx`]);
      expect(manifest.packages.map((p) => p.kind)).toEqual(['PDF', 'DOCX']);
      expect(manifest.documentVersion).toBe(REAL_VERSION);
      expect(manifest.manifestSha256).toBe(REAL_MANIFEST_HASH);
      // No cross-cohort leakage: every package in this manifest belongs to it.
      for (const pkg of manifest.packages) {
        expect(pkg.fileName).toContain(cohortId);
        expect(pkg.path).toBe(`opaque/${pkg.packageId}`);
      }
    }
  });

  it('never projects the internal storage path into a public manifest', async () => {
    const mapState = await loadDownloadManifestMapState(REAL_VERSION, REAL_MANIFEST_HASH);
    const serialized = JSON.stringify(mapState.manifests);
    expect(serialized).not.toContain('private-packages/');
    expect(serialized).not.toContain('storagePath');
    expect(serialized).not.toContain('matrix-twg-packages');
  });

  it('fails closed when the requested release does not match the trusted release', async () => {
    await expect(loadDownloadManifestMapState('9.9.9', REAL_MANIFEST_HASH)).rejects.toThrow(
      DownloadBoundaryError,
    );
  });
});

describe('request binding and opaque ID validation', () => {
  it('accepts a trusted rpq and rejects raw, percent, double-encoded, and mixed separators', () => {
    const base = `https://example.test/?documentVersion=${REAL_VERSION}&manifestSha256=${REAL_MANIFEST_HASH}&cohortId=categories`;
    expect(parseDownloadRequestBinding(new URL(`${base}&questionId=rpq:${REAL_VERSION}:q01`)).questionId).toBe(
      `rpq:${REAL_VERSION}:q01`,
    );
    for (const value of [
      `rpq:${REAL_VERSION}:q01/child`,
      `rpq:${REAL_VERSION}:q01\\child`,
      `rpq:${REAL_VERSION}:q01%2F..`,
      `rpq:${REAL_VERSION}:q01%252F..`,
    ]) {
      expect(() => parseDownloadRequestBinding(new URL(`${base}&questionId=${value}`))).toThrow(
        DownloadBoundaryError,
      );
    }
  });

  it('rejects malformed or case-only opaque IDs before catalog selection', () => {
    expect(validateOpaquePackageId('full-paper-pdf')).toBe('full-paper-pdf');
    for (const id of ['', 'Full-Paper-PDF', 'full/paper', 'full\\paper', 'full%2Fpaper', 'full%252Fpaper', '..']) {
      expect(() => validateOpaquePackageId(id)).toThrow(DownloadBoundaryError);
    }
  });

  it('derives disposition solely from the catalog filename', () => {
    expect(contentDispositionForCatalog(pdfArtifact)).toBe(
      'attachment; filename="matrix-options-categories-preview.pdf"',
    );
  });
});

describe('opaque artifact selection', () => {
  const pair = [pdfArtifact, docxArtifact];

  /**
   * `selectOpaquePackageArtifact` re-validates the artifact list it is handed
   * against the trusted cohort set. These cases exercise the per-pair guards, so
   * the context must declare exactly the one cohort the fixture supplies -
   * otherwise the all-cohorts completeness guard fires first and shadows the
   * guard actually under test.
   */
  function singleCohortContext(): TrustedDownloadContext {
    return realContext({ cohortQuestionIds: { categories: ['q1'] } });
  }

  it('rejects an unavailable catalog, an incomplete pair, and an unknown ID', () => {
    expect(() => selectOpaquePackageArtifact(null, 'categories-pdf', singleCohortContext())).toThrow(/unavailable/);
    expect(() => selectOpaquePackageArtifact([pdfArtifact], 'categories-pdf', singleCohortContext())).toThrow(
      /must contain PDF and DOCX/,
    );
    expect(() => selectOpaquePackageArtifact(pair, 'missing', singleCohortContext())).toThrow(
      /not in the authenticated catalog/,
    );
  });

  it('rejects duplicate package kinds within a cohort', () => {
    const duplicateKind = [pdfArtifact, { ...pdfArtifact, packageId: 'other-pdf', fileName: 'other.pdf', order: 1, storagePath: 'categories/other.pdf' }];
    expect(() => selectOpaquePackageArtifact(duplicateKind, 'categories-pdf', singleCohortContext())).toThrow(
      /duplicate package kinds/,
    );
  });

  it('returns the requested artifact from a complete pair', () => {
    expect(selectOpaquePackageArtifact(pair, 'categories-docx', singleCohortContext()).packageId).toBe(
      'categories-docx',
    );
  });

  it('rejects an artifact whose storage path is not bound to its own cohort', () => {
    const crossCohort = [
      { ...pdfArtifact, storagePath: 'pathway-grid/matrix-options-categories-preview.pdf' },
      docxArtifact,
    ];
    expect(() => selectOpaquePackageArtifact(crossCohort, 'categories-pdf', singleCohortContext())).toThrow(
      DownloadBoundaryError,
    );
  });

  it('rejects an artifact whose filename extension contradicts its declared kind', () => {
    // The streaming path picks Content-Type from `kind` and never runs
    // validateDownloadManifest, so this binding has to hold here too, or a PDF
    // content type could be served for .docx bytes.
    const spoofed = [
      { ...pdfArtifact, fileName: 'matrix-options-categories-preview.docx', storagePath: 'categories/matrix-options-categories-preview.docx' },
      docxArtifact,
    ];
    expect(() => selectOpaquePackageArtifact(spoofed, 'categories-pdf', singleCohortContext())).toThrow(
      DownloadBoundaryError,
    );
  });

  it('rejects an artifact whose storage path attempts traversal', () => {
    const traversal = [{ ...pdfArtifact, storagePath: '../secrets/leak.pdf' }, docxArtifact];
    expect(() => selectOpaquePackageArtifact(traversal, 'categories-pdf', singleCohortContext())).toThrow(
      DownloadBoundaryError,
    );
  });
});

describe('authenticated artifact streaming', () => {
  it('streams only bytes whose digest and length match the authenticated artifact', async () => {
    const response = await streamAuthenticatedPrintPackageArtifact(
      docxArtifact,
      storageDouble(Buffer.alloc(STREAM_BYTES)),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe(
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    );
    expect(Number(response.headers.get('content-length'))).toBe(STREAM_BYTES);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
  });

  it('reads the storage object from the authenticated artifact path, not from the raw catalog', async () => {
    const from = vi.fn(() => ({
      download: vi.fn(async () => ({
        data: { size: STREAM_BYTES, arrayBuffer: async () => Buffer.alloc(STREAM_BYTES).buffer },
        error: null,
      })),
    }));
    const client = { storage: { from } } as unknown as SupabaseClient;
    await streamAuthenticatedPrintPackageArtifact(pdfArtifact, client);
    expect(from).toHaveBeenCalledWith('matrix-twg-packages');
    const download = from.mock.results[0].value.download as ReturnType<typeof vi.fn>;
    expect(download).toHaveBeenCalledWith('categories/matrix-options-categories-preview.pdf');
  });

  it('proves a length match with a byte mismatch (TOCTOU) fails before any 200 response', async () => {
    await expect(
      streamAuthenticatedPrintPackageArtifact(pdfArtifact, storageDouble(Buffer.alloc(STREAM_BYTES, 1))),
    ).rejects.toThrow(/Private package bytes do not match/);
  });

  it('rejects a length mismatch', async () => {
    await expect(
      streamAuthenticatedPrintPackageArtifact(pdfArtifact, storageDouble(Buffer.alloc(STREAM_BYTES - 1))),
    ).rejects.toThrow(/do not match the authenticated artifact length/);
  });

  it('rejects on the REPORTED size before the object is ever materialized', async () => {
    // A wrong reported size must fail closed without calling arrayBuffer(), so
    // an oversized or mis-sized object is never brought into memory.
    const arrayBuffer = vi.fn(async () => Buffer.alloc(STREAM_BYTES).buffer);
    const client = {
      storage: {
        from: vi.fn(() => ({
          download: vi.fn(async () => ({ data: { size: STREAM_BYTES + 1, arrayBuffer }, error: null })),
        })),
      },
    } as unknown as SupabaseClient;
    await expect(streamAuthenticatedPrintPackageArtifact(pdfArtifact, client)).rejects.toThrow(
      /do not match the authenticated artifact length/,
    );
    expect(arrayBuffer).not.toHaveBeenCalled();
  });

  it('rejects objects larger than the 5MB ceiling', async () => {
    const oversize = 5 * 1024 * 1024 + 1;
    await expect(
      streamAuthenticatedPrintPackageArtifact(pdfArtifact, storageDouble(Buffer.alloc(oversize), oversize)),
    ).rejects.toThrow(/maximum allowed size/);
  });

  it('fails closed when the storage object is absent', async () => {
    const client = {
      storage: {
        from: vi.fn(() => ({ download: vi.fn(async () => ({ data: null, error: new Error('not found') })) })),
      },
    } as unknown as SupabaseClient;
    await expect(streamAuthenticatedPrintPackageArtifact(pdfArtifact, client)).rejects.toThrow(
      /unavailable in storage/,
    );
  });

  it('rejects an artifact whose locator does not match its own package ID', async () => {
    const mismatched = { ...pdfArtifact, serverAssetLocator: 'private-print-package:categories-docx' };
    await expect(
      streamAuthenticatedPrintPackageArtifact(mismatched, storageDouble(Buffer.alloc(STREAM_BYTES))),
    ).rejects.toThrow(/locator does not match the package ID/);
  });
});
