import { afterEach, describe, expect, it, vi } from 'vitest';

import { assertNativeCaptionBindings, loadLocalNativeFigureCandidate, NativeFigureCandidateUnavailableError } from '../native-figures-server';
import type { NativeFigureSet } from '../native-figures';

afterEach(() => vi.unstubAllEnvs());

describe('local native figure candidate boundary', () => {
  it.skipIf(!process.env.MATRIX_OPTIONS_PAPER_PRIVATE_ASSET_DIR)('loads the opted-in private corpus with all captions bound', async () => {
    vi.stubEnv('NODE_ENV', 'test');
    vi.stubEnv('MATRIX_OPTIONS_NATIVE_FIGURE_CANDIDATE', 'local');
    const directory = process.env.MATRIX_OPTIONS_PAPER_PRIVATE_ASSET_DIR;
    expect(directory).toBeTruthy();
    const set = await loadLocalNativeFigureCandidate('v0.9.91', directory!);
    expect(set.models).toHaveLength(17);
    expect(set.placements).toHaveLength(20);
  });

  it('accepts all bound captions and refuses one changed caption for the whole set', () => {
    const set = { placements: [
      { figureId: '1-1', caption: 'Figure 1-1. Synthetic first.' },
      { figureId: 'A-1', caption: 'Figure A-1. Synthetic second.' },
    ] } as unknown as NativeFigureSet;
    const captions = set.placements.map(({ figureId, caption }) => ({ figureId, caption }));
    expect(() => assertNativeCaptionBindings(set, captions)).not.toThrow();
    expect(() => assertNativeCaptionBindings(set, [captions[0], { ...captions[1], caption: 'Figure A-1. Changed.' }]))
      .toThrow(NativeFigureCandidateUnavailableError);
    expect(() => assertNativeCaptionBindings(set, captions.slice(0, 1))).toThrow(NativeFigureCandidateUnavailableError);
  });

  it('cannot activate in production even when the local flag and directory are supplied', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('MATRIX_OPTIONS_NATIVE_FIGURE_CANDIDATE', 'local');
    await expect(loadLocalNativeFigureCandidate('v0.9.91', 'C:\\synthetic-private-root')).rejects.toBeInstanceOf(NativeFigureCandidateUnavailableError);
  });

  it('fails closed when the private model flag is absent', async () => {
    vi.stubEnv('NODE_ENV', 'test');
    vi.stubEnv('MATRIX_OPTIONS_NATIVE_FIGURE_CANDIDATE', '');
    await expect(loadLocalNativeFigureCandidate('v0.9.91', 'C:\\synthetic-private-root')).rejects.toBeInstanceOf(NativeFigureCandidateUnavailableError);
  });

  it('fails closed when a flagged private model file is absent', async () => {
    vi.stubEnv('NODE_ENV', 'test');
    vi.stubEnv('MATRIX_OPTIONS_NATIVE_FIGURE_CANDIDATE', 'local');
    await expect(loadLocalNativeFigureCandidate('v0.9.91', 'C:\\synthetic-private-root')).rejects.toBeInstanceOf(NativeFigureCandidateUnavailableError);
  });

  it.each([
    ['absent', undefined],
    ['empty', ''],
    ['relative', 'relative/private-corpus'],
  ])('rejects an %s explicit directory even when the private fixture environment variable is set', async (_label, directory) => {
    vi.stubEnv('NODE_ENV', 'test');
    vi.stubEnv('MATRIX_OPTIONS_NATIVE_FIGURE_CANDIDATE', 'local');
    vi.stubEnv('MATRIX_OPTIONS_PAPER_PRIVATE_ASSET_DIR', 'C:\\synthetic-private-root');
    await expect(loadLocalNativeFigureCandidate('v0.9.91', directory as string))
      .rejects.toBeInstanceOf(NativeFigureCandidateUnavailableError);
  });
});
