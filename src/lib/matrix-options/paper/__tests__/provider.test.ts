import { describe, expect, it, vi } from 'vitest';

const routeMocks = vi.hoisted(() => ({
  versionLanding: vi.fn(),
  sectionReader: vi.fn(),
  redirect: vi.fn((destination: string) => {
    throw new Error(`REDIRECT:${destination}`);
  }),
}));

vi.mock('server-only', () => ({}));
vi.mock('next/navigation', () => ({
  notFound: vi.fn(() => { throw new Error('NOT_FOUND'); }),
  redirect: routeMocks.redirect,
}));
vi.mock('@/components/matrix-options/paper/PaperReader', () => ({
  PaperVersionLanding: routeMocks.versionLanding,
  PaperSectionReader: routeMocks.sectionReader,
}));

import { createSyntheticPaperProvider, PaperContentNotFoundError } from '../provider';
import { createSyntheticPaperFixture, SYNTHETIC_PAPER_VERSION } from '../synthetic-fixture';
import { sha256Object, withComputedReceiptHash } from '../contracts';

describe('synthetic paper provider', () => {
  it('returns only the requested fragment from the provider boundary', async () => {
    const provider = createSyntheticPaperProvider();
    const fragment = await provider.getFragment(SYNTHETIC_PAPER_VERSION, 'synthetic.framework.example');
    expect(fragment.stableSectionId).toBe('synthetic.framework.example');
    expect(fragment.blocks).toHaveLength(4);
    expect(JSON.stringify(fragment)).not.toContain('Synthetic framework');
  });

  it('fails closed for unknown versions and stable IDs', async () => {
    const provider = createSyntheticPaperProvider();
    await expect(provider.getVerifiedRelease('unknown')).rejects.toBeInstanceOf(PaperContentNotFoundError);
    await expect(provider.getFragment(SYNTHETIC_PAPER_VERSION, 'missing')).rejects.toBeInstanceOf(PaperContentNotFoundError);
  });

  it('does not serve content when the trusted manifest binding is corrupt', async () => {
    const bundle = createSyntheticPaperFixture();
    bundle.descriptor.manifestSha256 = '0'.repeat(64);
    const provider = createSyntheticPaperProvider(bundle);
    await expect(provider.getFragment(SYNTHETIC_PAPER_VERSION, 'synthetic.orientation')).rejects.toThrow('Manifest hash mismatch');
  });

  it('does not serve a structurally complete candidate with unresolved rejected coverage', async () => {
    const bundle = createSyntheticPaperFixture();
    const index = bundle.coverageReceipt.inventory.findIndex((item) => item.disposition === 'NO_STATUS_REQUIRED');
    const original = bundle.coverageReceipt.inventory[index];
    bundle.coverageReceipt.inventory[index] = {
      stableSectionId: original.stableSectionId,
      target: original.target,
      designatedHighRisk: original.designatedHighRisk,
      disposition: 'REJECTED_PENDING_RESOLUTION',
      reviewer: original.reviewer,
      reviewerRole: original.reviewerRole,
      rationale: 'Synthetic unresolved row for provider fail-closed testing.',
      validatedAt: original.validatedAt,
    };
    bundle.coverageReceipt.noStatusRequiredCount -= 1;
    bundle.coverageReceipt.rejectedPendingResolutionCount = 1;
    bundle.coverageReceipt.inventorySha256 = sha256Object(bundle.coverageReceipt.inventory);
    bundle.coverageReceipt.receiptSha256 = withComputedReceiptHash(bundle.coverageReceipt).receiptSha256;
    bundle.manifest.statusCoverageReceiptSha256 = bundle.coverageReceipt.receiptSha256;
    bundle.descriptor.statusCoverageReceiptSha256 = bundle.coverageReceipt.receiptSha256;
    bundle.descriptor.manifestSha256 = sha256Object(bundle.manifest);

    const provider = createSyntheticPaperProvider(bundle);
    await expect(provider.getVerifiedRelease(SYNTHETIC_PAPER_VERSION)).rejects.toThrow('cannot be served');
  });

  it('redirects disabled paper routes before params or provider-backed readers are touched', async () => {
    const previous = process.env.MATRIX_OPTIONS_PAPER_WORKSPACE;
    process.env.MATRIX_OPTIONS_PAPER_WORKSPACE = 'false';
    routeMocks.redirect.mockClear();
    routeMocks.versionLanding.mockClear();
    routeMocks.sectionReader.mockClear();
    try {
      const resolver = (await import('@/app/(dashboard)/matrix-options/paper/page')).default;
      const version = (await import('@/app/(dashboard)/matrix-options/paper/v/[documentVersion]/page')).default;
      const section = (await import('@/app/(dashboard)/matrix-options/paper/v/[documentVersion]/[stableSectionId]/page')).default;
      await expect(resolver()).rejects.toThrow('REDIRECT:/matrix-options?view=TWG%20Review');
      await expect(version({ params: Promise.resolve({ documentVersion: SYNTHETIC_PAPER_VERSION }) })).rejects.toThrow('REDIRECT:/matrix-options?view=TWG%20Review');
      await expect(section({ params: Promise.resolve({ documentVersion: SYNTHETIC_PAPER_VERSION, stableSectionId: 'synthetic.orientation' }) })).rejects.toThrow('REDIRECT:/matrix-options?view=TWG%20Review');
      expect(routeMocks.versionLanding).not.toHaveBeenCalled();
      expect(routeMocks.sectionReader).not.toHaveBeenCalled();
    } finally {
      if (previous === undefined) delete process.env.MATRIX_OPTIONS_PAPER_WORKSPACE;
      else process.env.MATRIX_OPTIONS_PAPER_WORKSPACE = previous;
    }
  });
});
