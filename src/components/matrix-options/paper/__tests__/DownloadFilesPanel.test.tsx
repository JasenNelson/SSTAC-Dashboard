import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useRef } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';

import { DownloadFilesPanel, safeFileNameFromDisposition, type DownloadCohortGroup } from '../DownloadFilesPanel';
import { validateDownloadManifest, type ServerDownloadManifest } from '../../../../lib/matrix-options/paper/download-manifest';

const hash = 'a'.repeat(64);
const expected = { documentVersion: '1.0.11-remediated-7-8-successor-20260918-D', manifestSha256: hash, releaseIdentity: 'release-20260913' };

const PDF_TYPE = 'application/pdf';
const DOCX_TYPE = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

function manifestFor(cohortId: string): ServerDownloadManifest {
  return {
    schemaVersion: 'matrix-paper-download-manifest-v1', validationState: 'SERVER_VALIDATED', status: 'REVIEW_READY_NOT_GREEN',
    releaseIdentity: expected.releaseIdentity, documentVersion: expected.documentVersion, manifestSha256: expected.manifestSha256,
    packages: [
      { packageId: `${cohortId}-pdf`, kind: 'PDF', label: `${cohortId} PDF`, fileName: `${cohortId}-review-package.pdf`, path: `opaque/${cohortId}-pdf`, href: `/api/matrix-options/paper/downloads/${cohortId}-pdf`, sha256: 'b'.repeat(64), byteLength: 42, documentVersion: expected.documentVersion, manifestSha256: hash, order: 1 },
      { packageId: `${cohortId}-docx`, kind: 'DOCX', label: `${cohortId} DOCX`, fileName: `${cohortId}-review-package.docx`, path: `opaque/${cohortId}-docx`, href: `/api/matrix-options/paper/downloads/${cohortId}-docx`, sha256: 'c'.repeat(64), byteLength: 84, documentVersion: expected.documentVersion, manifestSha256: hash, order: 2 },
    ],
  };
}

const ALL_COHORTS = ['categories', 'exposure-assumptions', 'inputs-evidence', 'methods-water-type', 'pathway-grid'] as const;

function groupsFor(cohortIds: readonly string[]): DownloadCohortGroup[] {
  return cohortIds.map((id) => ({ cohortId: id, cohortName: `Cohort ${id}`, manifest: validateDownloadManifest(manifestFor(id), expected) }));
}

const oneGroup = () => groupsFor(['categories']);

describe('DownloadFilesPanel', () => {
  it('renders verified package identity and a download control per package', () => {
    render(<DownloadFilesPanel open groups={oneGroup()} onClose={vi.fn()} />);
    expect(screen.getByRole('heading', { name: 'Download Files' })).toHaveFocus();
    // Controls are BUTTONS, not anchors: a bare <a download> saved error bodies
    // as .pdf files, which is the defect this panel was rewritten to remove.
    expect(screen.getByRole('button', { name: 'Download PDF' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Download DOCX' })).toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.getByText('categories-review-package.docx - 84 bytes - SHA-256 ' + 'c'.repeat(64))).toBeInTheDocument();
  });

  it('fails closed with pending text when no validated manifest exists', () => {
    render(<DownloadFilesPanel open groups={null} onClose={vi.fn()} />);
    expect(screen.getByTestId('download-files-pending')).toHaveTextContent('pending server validation');
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Download / })).not.toBeInTheDocument();
  });

  it('fails closed when the group list is present but empty', () => {
    render(<DownloadFilesPanel open groups={[]} onClose={vi.fn()} />);
    expect(screen.getByTestId('download-files-pending')).toHaveTextContent('pending server validation');
  });

  it('supports Escape close and restores focus', async () => {
    const onClose = vi.fn();
    const DummyParent = () => {
      const ref = useRef<HTMLButtonElement>(null);
      return <><button data-testid="return-focus" ref={ref}>Open downloads</button><DownloadFilesPanel open groups={null} onClose={onClose} closeFocusRef={ref} /></>;
    };
    render(<DummyParent />);
    fireEvent.keyDown(screen.getByTestId('download-files-panel'), { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
    await new Promise<void>((resolve) => queueMicrotask(() => resolve()));
    expect(screen.getByTestId('return-focus')).toHaveFocus();
  });

  it('is hidden, inert, and print-hidden when closed', () => {
    render(<DownloadFilesPanel open={false} groups={null} onClose={vi.fn()} />);
    const panel = screen.getByTestId('download-files-panel');
    expect(panel).toHaveAttribute('hidden');
    expect(panel).toHaveAttribute('inert');
    expect(panel).toHaveClass('print:hidden');
  });
});

describe('P1-A: cohort grouping', () => {
  it('renders ALL TEN packages across the five cohorts, none omitted or duplicated', () => {
    render(<DownloadFilesPanel open groups={groupsFor(ALL_COHORTS)} onClose={vi.fn()} />);

    const buttons = screen.getAllByRole('button', { name: /^Download (PDF|DOCX)$/ });
    expect(buttons).toHaveLength(10);

    for (const cohortId of ALL_COHORTS) {
      expect(screen.getByTestId(`download-cohort-${cohortId}`)).toBeInTheDocument();
      expect(screen.getByTestId(`download-button-${cohortId}-pdf`)).toBeInTheDocument();
      expect(screen.getByTestId(`download-button-${cohortId}-docx`)).toBeInTheDocument();
    }

    // No duplicates IN THE DOM: query the rendered controls, not a set the test
    // built for itself.
    const renderedIds = screen.getAllByTestId(/^download-button-/).map((el) => el.getAttribute('data-testid'));
    expect(renderedIds).toHaveLength(10);
    expect(new Set(renderedIds).size).toBe(10);
    expect(screen.getAllByTestId(/^download-cohort-/)).toHaveLength(5);
  });

  it('renders exactly one pair when given a single group (the My Review shape)', () => {
    // NOTE: this documents the single-group SHAPE. It does NOT falsify P1-A -
    // that defect lived in the workspace selector, and its falsifying guard is
    // "Working Draft exposes every cohort package pair" in RevisedPaperWorkspace.test.tsx.
    render(<DownloadFilesPanel open groups={oneGroup()} onClose={vi.fn()} />);
    expect(screen.getAllByRole('button', { name: /^Download (PDF|DOCX)$/ })).toHaveLength(2);
    expect(screen.getAllByTestId(/^download-cohort-/)).toHaveLength(1);
    for (const cohortId of ALL_COHORTS.filter((c) => c !== 'categories')) {
      expect(screen.queryByTestId(`download-cohort-${cohortId}`)).not.toBeInTheDocument();
    }
  });

  it('labels each group so cohort identity is unambiguous', () => {
    render(<DownloadFilesPanel open groups={groupsFor(['categories', 'pathway-grid'])} onClose={vi.fn()} />);
    expect(screen.getByRole('heading', { name: 'Cohort categories' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Cohort pathway-grid' })).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Available review packages for Cohort categories' })).toBeInTheDocument();
  });
});

describe('P1-B: controlled download never saves an error response', () => {
  let clickSpy: MockInstance<() => void>;
  let createObjectURL: ReturnType<typeof vi.fn<(blob: Blob) => string>>;
  let revokeObjectURL: ReturnType<typeof vi.fn<(url: string) => void>>;

  beforeEach(() => {
    clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    createObjectURL = vi.fn<(blob: Blob) => string>(() => 'blob:mock-url');
    revokeObjectURL = vi.fn<(url: string) => void>();
    Object.defineProperty(URL, 'createObjectURL', { value: createObjectURL, configurable: true, writable: true });
    Object.defineProperty(URL, 'revokeObjectURL', { value: revokeObjectURL, configurable: true, writable: true });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  function renderPanel() {
    render(<DownloadFilesPanel open groups={oneGroup()} onClose={vi.fn()} />);
    return screen.getByTestId('download-button-categories-pdf');
  }

  function respond(init: { status?: number; type?: string | null; body?: BodyInit; disposition?: string }) {
    const headers = new Headers();
    if (init.type) headers.set('content-type', init.type);
    if (init.disposition) headers.set('content-disposition', init.disposition);
    return vi.fn(async () => new Response(init.body ?? new Blob(['x']), { status: init.status ?? 200, headers }));
  }

  it('a 503 JSON response saves nothing and shows an accessible error', async () => {
    // This is today's real state: the storage bucket does not exist, so the
    // route answers 503 with a JSON body. The old <a download> wrote that body
    // to disk named .pdf.
    vi.stubGlobal('fetch', respond({ status: 503, type: 'application/json', body: JSON.stringify({ error: 'unavailable', code: 'PRINT_PACKAGE_ARTIFACTS_UNAVAILABLE' }) }));
    fireEvent.click(renderPanel());

    await waitFor(() => expect(screen.getByTestId('download-status-categories-pdf')).toHaveTextContent(/Not published yet/i));
    expect(clickSpy).not.toHaveBeenCalled();
    expect(createObjectURL).not.toHaveBeenCalled();
    expect(screen.getByTestId('download-status-categories-pdf')).toHaveAttribute('role', 'status');
    expect(screen.getByTestId('download-button-categories-pdf')).toHaveAttribute('aria-describedby', 'download-status-categories-pdf');
    // A 503 is a RELEASE state, not a per-file fault: one panel-level notice
    // must say so, otherwise ten unprovisioned packages read as ten broken ones.
    const notice = await screen.findByTestId('download-not-published');
    expect(notice).toHaveTextContent(/every package in this release/i);
    expect(notice).toHaveAttribute('role', 'status');
  });

  it.each([
    ['401', 401, 'application/json'],
    ['403', 403, 'application/json'],
    ['500', 500, 'text/html'],
  ])('a %s response saves nothing', async (_label, status, type) => {
    vi.stubGlobal('fetch', respond({ status, type }));
    fireEvent.click(renderPanel());
    await waitFor(() => expect(screen.getByTestId('download-status-categories-pdf')).toHaveTextContent(/Download failed/i));
    expect(clickSpy).not.toHaveBeenCalled();
    expect(createObjectURL).not.toHaveBeenCalled();
    // Only a 503 means "not published"; other failures must not claim that.
    expect(screen.queryByTestId('download-not-published')).not.toBeInTheDocument();
  });

  it('a 200 with the WRONG content type saves nothing', async () => {
    // A success status is not sufficient; JSON arriving where a PDF was
    // expected must still be refused.
    vi.stubGlobal('fetch', respond({ status: 200, type: 'application/json', body: '{"error":"nope"}' }));
    fireEvent.click(renderPanel());
    await waitFor(() => expect(screen.getByTestId('download-status-categories-pdf')).toHaveTextContent(/did not return a verified package/i));
    expect(clickSpy).not.toHaveBeenCalled();
    expect(createObjectURL).not.toHaveBeenCalled();
  });

  it('a network rejection saves nothing', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('network down'); }));
    fireEvent.click(renderPanel());
    await waitFor(() => expect(screen.getByTestId('download-status-categories-pdf')).toHaveTextContent(/could not be completed/i));
    expect(clickSpy).not.toHaveBeenCalled();
    expect(createObjectURL).not.toHaveBeenCalled();
  });

  it('a valid PDF triggers exactly one download with the catalog filename, and cleans up', async () => {
    vi.stubGlobal('fetch', respond({ status: 200, type: PDF_TYPE }));
    // Install the capture BEFORE the click so this cannot depend on fetch timing.
    let downloadAttr: string | null = null;
    clickSpy.mockImplementation(function capture(this: HTMLAnchorElement) { downloadAttr = this.download; });
    fireEvent.click(renderPanel());
    await waitFor(() => expect(clickSpy).toHaveBeenCalledTimes(1));
    // The title claims "with the catalog filename" - assert it.
    expect(downloadAttr).toBe('categories-review-package.pdf');
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock-url'));
    expect(document.querySelectorAll('a[download]')).toHaveLength(0);
    await waitFor(() => expect(screen.getByTestId('download-button-categories-pdf')).not.toBeDisabled());
  });

  it('announces success after a completed save', async () => {
    vi.stubGlobal('fetch', respond({ status: 200, type: PDF_TYPE }));
    fireEvent.click(renderPanel());
    await waitFor(() => expect(screen.getByTestId('download-status-categories-pdf')).toHaveTextContent(/Downloaded categories-review-package\.pdf/));
  });

  it('does not revoke the blob URL in the same task as the click', async () => {
    // Revoking synchronously with the click aborts the save in Firefox/WebKit,
    // which would be a silent failure of exactly the class this panel removes.
    vi.stubGlobal('fetch', respond({ status: 200, type: PDF_TYPE }));
    let revokedAtClick: boolean | null = null;
    clickSpy.mockImplementation(() => { revokedAtClick = revokeObjectURL.mock.calls.length > 0; });

    render(<DownloadFilesPanel open groups={oneGroup()} onClose={vi.fn()} />);
    fireEvent.click(screen.getByTestId('download-button-categories-pdf'));

    await waitFor(() => expect(clickSpy).toHaveBeenCalledTimes(1));
    expect(revokedAtClick).toBe(false);
    // It is still revoked, just on a later task.
    await waitFor(() => expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock-url'));
  });

  it('a valid DOCX triggers exactly one download', async () => {
    vi.stubGlobal('fetch', respond({ status: 200, type: DOCX_TYPE }));
    render(<DownloadFilesPanel open groups={oneGroup()} onClose={vi.fn()} />);
    fireEvent.click(screen.getByTestId('download-button-categories-docx'));
    await waitFor(() => expect(clickSpy).toHaveBeenCalledTimes(1));
  });

  it('sets a busy state and ignores a duplicate concurrent click', async () => {
    let release: (value: Response) => void = () => {};
    const gated = new Promise<Response>((resolve) => { release = resolve; });
    const fetchMock = vi.fn(() => gated);
    vi.stubGlobal('fetch', fetchMock);

    const button = renderPanel();
    fireEvent.click(button);
    await waitFor(() => expect(button).toBeDisabled());
    expect(button).toHaveAttribute('aria-busy', 'true');

    fireEvent.click(button);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    release(new Response(new Blob(['x']), { status: 200, headers: new Headers({ 'content-type': PDF_TYPE }) }));
    await waitFor(() => expect(button).not.toBeDisabled());
  });

  it('offers retry after a failure and can then succeed', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response('{}', { status: 503, headers: new Headers({ 'content-type': 'application/json' }) }))
      .mockResolvedValueOnce(new Response(new Blob(['x']), { status: 200, headers: new Headers({ 'content-type': PDF_TYPE }) }));
    vi.stubGlobal('fetch', fetchMock);

    const button = renderPanel();
    fireEvent.click(button);
    await waitFor(() => expect(button).toHaveTextContent('Retry PDF'));
    expect(clickSpy).not.toHaveBeenCalled();

    fireEvent.click(button);
    await waitFor(() => expect(clickSpy).toHaveBeenCalledTimes(1));
  });

  it('sends same-origin credentials so the authenticated route is reached', async () => {
    const fetchMock = respond({ status: 200, type: PDF_TYPE });
    vi.stubGlobal('fetch', fetchMock);
    fireEvent.click(renderPanel());
    await waitFor(() => expect(clickSpy).toHaveBeenCalled());
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/matrix-options/paper/downloads/categories-pdf',
      expect.objectContaining({ credentials: 'same-origin' }),
    );
  });
});

describe('P1-B: filename safety', () => {
  it('accepts only a bare, correctly-suffixed basename from Content-Disposition', () => {
    expect(safeFileNameFromDisposition('attachment; filename="ok-file.pdf"')).toBe('ok-file.pdf');
    expect(safeFileNameFromDisposition('attachment; filename=ok-file.docx')).toBe('ok-file.docx');
    for (const hostile of [
      'attachment; filename="../../etc/passwd.pdf"',
      'attachment; filename="/abs/path.pdf"',
      'attachment; filename="a\\b.pdf"',
      'attachment; filename="enc%2Foded.pdf"',
      'attachment; filename="script.exe"',
      'attachment; filename=""',
      'attachment',
    ]) {
      expect(safeFileNameFromDisposition(hostile)).toBeNull();
    }
    expect(safeFileNameFromDisposition(null)).toBeNull();
  });

  it('binds the extension to the package KIND, not merely to an allowed suffix', () => {
    expect(safeFileNameFromDisposition('attachment; filename="ok.pdf"', 'PDF')).toBe('ok.pdf');
    expect(safeFileNameFromDisposition('attachment; filename="ok.docx"', 'DOCX')).toBe('ok.docx');
    // Cross-kind names are refused, so PDF bytes cannot be saved as .docx.
    expect(safeFileNameFromDisposition('attachment; filename="ok.docx"', 'PDF')).toBeNull();
    expect(safeFileNameFromDisposition('attachment; filename="ok.pdf"', 'DOCX')).toBeNull();
  });
});
