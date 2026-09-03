import 'server-only';

import {
  paperFigureAssetSchema,
  paperFragmentSchema,
  sha256Object,
  validatePaperBundle,
  type PaperContentProvider,
  type PaperFigureAsset,
  type PaperFragment,
  type VerifiedPaperRelease,
} from './contracts';
import {
  createSyntheticPaperFixture,
  SYNTHETIC_PAPER_VERSION,
  type SyntheticPaperFixtureBundle,
} from './synthetic-fixture';

export class PaperContentNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PaperContentNotFoundError';
  }
}

export function createSyntheticPaperProvider(
  bundle: SyntheticPaperFixtureBundle = createSyntheticPaperFixture(),
): PaperContentProvider {
  let verifiedRelease: VerifiedPaperRelease | null = null;

  const verify = (): VerifiedPaperRelease => {
    if (!verifiedRelease) {
      verifiedRelease = validatePaperBundle(bundle);
    }
    return verifiedRelease;
  };

  const assertVersion = (documentVersion: string) => {
    if (documentVersion !== SYNTHETIC_PAPER_VERSION) {
      throw new PaperContentNotFoundError(`Unknown paper version: ${documentVersion}`);
    }
  };

  return {
    async getVerifiedRelease(documentVersion): Promise<VerifiedPaperRelease> {
      assertVersion(documentVersion);
      return verify();
    },

    async getFragment(documentVersion, stableSectionId): Promise<PaperFragment> {
      assertVersion(documentVersion);
      const release = verify();
      const section = release.manifest.sections.find(
        (candidate) => candidate.stableSectionId === stableSectionId,
      );
      const rawFragment = bundle.fragments.find(
        (candidate) => candidate.stableSectionId === stableSectionId,
      );
      if (!section || !rawFragment) {
        throw new PaperContentNotFoundError(`Unknown paper section: ${stableSectionId}`);
      }
      const fragment = paperFragmentSchema.parse(rawFragment);
      if (sha256Object(fragment) !== section.fragmentSha256) {
        throw new Error(`Paper fragment integrity failure: ${stableSectionId}`);
      }
      return fragment;
    },

    async getFigure(documentVersion, figureId): Promise<PaperFigureAsset> {
      assertVersion(documentVersion);
      const release = verify();
      const indexEntry = release.manifest.figures.find((candidate) => candidate.figureId === figureId);
      const rawFigure = bundle.figures.find((candidate) => candidate.figureId === figureId);
      if (!indexEntry || !rawFigure) {
        throw new PaperContentNotFoundError(`Unknown paper figure: ${figureId}`);
      }
      const figure = paperFigureAssetSchema.parse(rawFigure);
      if (sha256Object(figure) !== indexEntry.assetSha256) {
        throw new Error(`Paper figure integrity failure: ${figureId}`);
      }
      return figure;
    },
  };
}

export const syntheticPaperProvider = createSyntheticPaperProvider();
