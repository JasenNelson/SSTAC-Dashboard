import fs from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { notFoundMock, redirectMock } = vi.hoisted(() => ({
  notFoundMock: vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND');
  }),
  redirectMock: vi.fn(() => {
    throw new Error('NEXT_REDIRECT');
  }),
}));

vi.mock('next/navigation', () => ({
  notFound: notFoundMock,
  redirect: redirectMock,
}));

import PaperSectionPage from '../page';
import {
  REVISED_PAPER_ROUTE,
  REVISED_PAPER_VERSION,
} from '@/lib/matrix-options/revised-paper';
import { MATRIX_OPTIONS_LEGACY_TWG_REVIEW_PATH } from '@/lib/matrix-options/navigation';

const priorWorkspaceValue = process.env.MATRIX_OPTIONS_PAPER_WORKSPACE;

afterEach(() => {
  if (priorWorkspaceValue === undefined) {
    delete process.env.MATRIX_OPTIONS_PAPER_WORKSPACE;
  } else {
    process.env.MATRIX_OPTIONS_PAPER_WORKSPACE = priorWorkspaceValue;
  }
});

describe('/matrix-options/paper/v/[documentVersion]/[stableSectionId]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each([undefined, '', 'false', 'TRUE']) (
    'redirects exact V16 to the legacy real-paper review when the workspace flag is %s',
    async (workspaceValue) => {
      if (workspaceValue === undefined) {
        delete process.env.MATRIX_OPTIONS_PAPER_WORKSPACE;
      } else {
        process.env.MATRIX_OPTIONS_PAPER_WORKSPACE = workspaceValue;
      }

      await expect(
        PaperSectionPage({
          params: Promise.resolve({
            documentVersion: REVISED_PAPER_VERSION,
            stableSectionId: 'ignored-old-id',
          }),
        }),
      ).rejects.toThrow('NEXT_REDIRECT');
      expect(redirectMock).toHaveBeenCalledWith(
        MATRIX_OPTIONS_LEGACY_TWG_REVIEW_PATH,
      );
    },
  );

  it('redirects exact V16 to its version page when the workspace flag is exact-true', async () => {
    process.env.MATRIX_OPTIONS_PAPER_WORKSPACE = 'true';
    await expect(
      PaperSectionPage({
        params: Promise.resolve({
          documentVersion: REVISED_PAPER_VERSION,
          stableSectionId: 'ignored-old-id',
        }),
      }),
    ).rejects.toThrow('NEXT_REDIRECT');
    expect(redirectMock).toHaveBeenCalledWith(REVISED_PAPER_ROUTE);
  });

  it.each(['slice-1a-fixture-v1', 'unknown']) (
    'fails closed before the flag branch for non-V16 version %s',
    async (documentVersion) => {
      for (const workspaceValue of ['false', 'true']) {
        vi.clearAllMocks();
        process.env.MATRIX_OPTIONS_PAPER_WORKSPACE = workspaceValue;
        await expect(
          PaperSectionPage({
            params: Promise.resolve({
              documentVersion,
              stableSectionId: 'any-id',
            }),
          }),
        ).rejects.toThrow('NEXT_NOT_FOUND');
        expect(redirectMock).not.toHaveBeenCalled();
      }
    },
  );

  it('contains no synthetic reader, provider, fixture, or stable-section translation', () => {
    const source = fs.readFileSync(
      path.join(
        process.cwd(),
        'src/app/(dashboard)/matrix-options/paper/v/[documentVersion]/[stableSectionId]/page.tsx',
      ),
      'utf8',
    );
    expect(source).not.toMatch(/PaperSectionReader|paper\/provider|synthetic-fixture/);
    expect(source).not.toMatch(/stableSectionId\s*[),}]|stableSectionId\s*=/);
  });
});
