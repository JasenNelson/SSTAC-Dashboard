import { fireEvent, render, screen } from '@testing-library/react';
import { useRef } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { DownloadFilesPanel } from '../DownloadFilesPanel';
import { validateDownloadManifest, type ServerDownloadManifest } from '../../../../lib/matrix-options/paper/download-manifest';

const hash = 'a'.repeat(64);
const expected = { documentVersion: '1.0.11-remediated-7-8-successor-20260918-D', manifestSha256: hash, releaseIdentity: 'release-20260913' };
const manifest: ServerDownloadManifest = {
  schemaVersion: 'matrix-paper-download-manifest-v1', validationState: 'SERVER_VALIDATED', status: 'REVIEW_READY_NOT_GREEN',
  releaseIdentity: expected.releaseIdentity, documentVersion: expected.documentVersion, manifestSha256: expected.manifestSha256,
  packages: [
    { packageId: 'categories-pdf', kind: 'PDF', label: 'Categories PDF', fileName: 'review-package.pdf', path: 'opaque/categories-pdf', href: '/api/matrix-options/paper/downloads/categories-pdf', sha256: 'b'.repeat(64), byteLength: 42, documentVersion: expected.documentVersion, manifestSha256: hash, order: 1 },
    { packageId: 'categories-docx', kind: 'DOCX', label: 'Categories DOCX', fileName: 'review-package.docx', path: 'opaque/categories-docx', href: '/api/matrix-options/paper/downloads/categories-docx', sha256: 'c'.repeat(64), byteLength: 84, documentVersion: expected.documentVersion, manifestSha256: hash, order: 2 },
  ],
};

describe('DownloadFilesPanel', () => {
  it('renders verified package identity and links', () => {
    render(<DownloadFilesPanel open manifest={validateDownloadManifest(manifest, expected)} onClose={vi.fn()} />);
    expect(screen.getByRole('heading', { name: 'Download Files' })).toHaveFocus();
    expect(screen.getByRole('link', { name: 'Download PDF' })).toHaveAttribute('href', manifest.packages[0].href);
    expect(screen.getByRole('link', { name: 'Download DOCX' })).toHaveAttribute('download', 'review-package.docx');
  });

  it('fails closed with pending text when no validated manifest exists', () => {
    render(<DownloadFilesPanel open manifest={null} onClose={vi.fn()} />);
    expect(screen.getByTestId('download-files-pending')).toHaveTextContent('pending server validation');
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('supports Escape close and restores focus', async () => {
    const onClose = vi.fn();
    const DummyParent = () => {
      const ref = useRef<HTMLButtonElement>(null);
      return <><button data-testid="return-focus" ref={ref}>Open downloads</button><DownloadFilesPanel open manifest={null} onClose={onClose} closeFocusRef={ref} /></>;
    };
    render(<DummyParent />);
    fireEvent.keyDown(screen.getByTestId('download-files-panel'), { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
    await new Promise<void>((resolve) => queueMicrotask(() => resolve()));
    expect(screen.getByTestId('return-focus')).toHaveFocus();
  });

  it('is hidden, inert, and print-hidden when closed', () => {
    render(<DownloadFilesPanel open={false} manifest={null} onClose={vi.fn()} />);
    const panel = screen.getByTestId('download-files-panel');
    expect(panel).toHaveAttribute('hidden');
    expect(panel).toHaveAttribute('inert');
    expect(panel).toHaveClass('print:hidden');
  });
});
