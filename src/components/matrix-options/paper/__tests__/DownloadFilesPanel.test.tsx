import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
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
  it('renders content-only: h2 heading and one button per package labelled "<cohort> - <kind>"', () => {
    render(<DownloadFilesPanel groups={oneGroup()} />);
    expect(screen.getByRole('heading', { name: 'Download files', level: 2 })).toBeInTheDocument();
    // Controls are BUTTONS, not anchors: a bare <a download> saved error bodies
    // as .pdf files, which is the defect this panel was rewritten to remove.
    expect(screen.getByRole('button', { name: 'Cohort categories - PDF' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cohort categories - DOCX' })).toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('never displays file names, byte counts, SHA-256 or release-verification text', () => {
    render(<DownloadFilesPanel groups={oneGroup()} />);
    const panel = screen.getByTestId('download-files-panel');
    expect(panel.textContent).not.toContain('categories-review-package.pdf');
    expect(panel.textContent).not.toContain('84 bytes');
    expect(panel.textContent).not.toContain('c'.repeat(64));
    expect(panel.textContent).not.toMatch(/Verified review packages for release/i);
  });

  it('shows the pending text when no groups exist', () => {
    render(<DownloadFilesPanel groups={null} />);
    expect(screen.getByTestId('download-files-pending')).toHaveTextContent(
      'Download files are being prepared for this release and are not available yet.',
    );
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Cohort / })).not.toBeInTheDocument();
  });

  it('shows the pending text when the group list is present but empty', () => {
    render(<DownloadFilesPanel groups={[]} />);
    expect(screen.getByTestId('download-files-pending')).toHaveTextContent(
      'Download files are being prepared for this release and are not available yet.',
    );
  });

  it('accepts an explicit headingId so the popover can label itself by this heading', () => {
    render(<DownloadFilesPanel groups={oneGroup()} headingId="custom-heading-id" />);
    const heading = screen.getByRole('heading', { name: 'Download files', level: 2 });
    expect(heading).toHaveAttribute('id', 'custom-heading-id');
    expect(screen.getByTestId('download-files-panel')).toHaveAttribute('aria-labelledby', 'custom-heading-id');
  });
});

describe('P1-A: cohort grouping', () => {
  it('renders ALL TEN packages across the five cohorts, none omitted or duplicated', () => {
    render(<DownloadFilesPanel groups={groupsFor(ALL_COHORTS)} />);

    const buttons = screen.getAllByRole('button', { name: /^Cohort .* - (PDF|DOCX)$/ });
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
    // NOTE: this documents the single-group SHAPE. Both Working Draft and My
    // Review now list ALL topics' packages (spec item 2); the caller decides
    // how many groups to pass.
    render(<DownloadFilesPanel groups={oneGroup()} />);
    expect(screen.getAllByRole('button', { name: /^Cohort .* - (PDF|DOCX)$/ })).toHaveLength(2);
    expect(screen.getAllByTestId(/^download-cohort-/)).toHaveLength(1);
    for (const cohortId of ALL_COHORTS.filter((c) => c !== 'categories')) {
      expect(screen.queryByTestId(`download-cohort-${cohortId}`)).not.toBeInTheDocument();
    }
  });

  it('labels each package with its cohort name and kind so identity is unambiguous', () => {
    render(<DownloadFilesPanel groups={groupsFor(['categories', 'pathway-grid'])} />);
    expect(screen.getByRole('button', { name: 'Cohort categories - PDF' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cohort pathway-grid - PDF' })).toBeInTheDocument();
    expect(screen.getByTestId('download-cohort-categories')).toBeInTheDocument();
    expect(screen.getByTestId('download-cohort-pathway-grid')).toBeInTheDocument();
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

  function renderPanel(props: Partial<{ onAnnounce: (message: string) => void }> = {}) {
    render(<DownloadFilesPanel groups={oneGroup()} onAnnounce={props.onAnnounce} />);
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
    const onAnnounce = vi.fn();
    fireEvent.click(renderPanel({ onAnnounce }));

    await waitFor(() => expect(screen.getByTestId('download-status-categories-pdf')).toHaveTextContent(/Not published yet/i));
    expect(clickSpy).not.toHaveBeenCalled();
    expect(createObjectURL).not.toHaveBeenCalled();
    expect(screen.getByTestId('download-button-categories-pdf')).toHaveAttribute('aria-describedby', 'download-status-categories-pdf');
    // The per-package status span is no longer its own role=status region: the
    // failure is announced through onAnnounce, which the workspace surfaces as
    // a single sr-only role=status region outside the popover (spec item 2).
    expect(onAnnounce).toHaveBeenCalledWith('Cohort categories - PDF: Not published yet. Nothing was saved.');
    // A 503 is a RELEASE state, not a per-file fault: one panel-level notice
    // must say so, otherwise ten unprovisioned packages read as ten broken ones.
    const notice = await screen.findByTestId('download-not-published');
    expect(notice).toHaveTextContent('These files are not published yet, so downloads are unavailable for now. Nothing was saved.');
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
    await waitFor(() => expect(screen.getByTestId('download-button-categories-pdf')).not.toHaveAttribute('aria-disabled'));
  });

  it('announces success after a completed save', async () => {
    vi.stubGlobal('fetch', respond({ status: 200, type: PDF_TYPE }));
    fireEvent.click(renderPanel());
    await waitFor(() => expect(screen.getByTestId('download-status-categories-pdf')).toHaveTextContent('Downloaded'));
  });

  it('two activations before any re-render start exactly ONE fetch (synchronous in-flight guard)', async () => {
    const fetchMock = respond({ status: 200, type: PDF_TYPE });
    vi.stubGlobal('fetch', fetchMock);
    const button = renderPanel();
    // Both clicks land inside one act, so no re-render happens between them;
    // a guard that reads render state would let the second one through.
    act(() => { button.click(); button.click(); });
    await waitFor(() => expect(clickSpy).toHaveBeenCalledTimes(1));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    // Two-sided: once settled, a new activation downloads again.
    fireEvent.click(screen.getByTestId('download-button-categories-pdf'));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  });

  it('an unexpected throw while saving reports an error and never leaves the button stuck busy', async () => {
    const fetchMock = respond({ status: 200, type: PDF_TYPE });
    vi.stubGlobal('fetch', fetchMock);
    createObjectURL.mockImplementation(() => { throw new Error('blocked'); });
    const onAnnounce = vi.fn();
    fireEvent.click(renderPanel({ onAnnounce }));
    // Announced like every other failure (the status span is not a live region).
    await waitFor(() => expect(onAnnounce).toHaveBeenCalledWith('Cohort categories - PDF: Download failed. Nothing was saved.'));
    await waitFor(() => expect(screen.getByTestId('download-status-categories-pdf')).toHaveTextContent('Nothing was saved'));
    expect(screen.getByTestId('download-button-categories-pdf')).not.toHaveAttribute('aria-disabled');
    expect(clickSpy).not.toHaveBeenCalled();
    // The in-flight guard was released: a retry fetches again.
    fireEvent.click(screen.getByTestId('download-button-categories-pdf'));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  });

  it('a throwing save click still removes the anchor and revokes the blob URL', async () => {
    vi.stubGlobal('fetch', respond({ status: 200, type: PDF_TYPE }));
    clickSpy.mockImplementation(() => { throw new Error('save refused'); });
    fireEvent.click(renderPanel());
    await waitFor(() => expect(screen.getByTestId('download-status-categories-pdf')).toHaveTextContent('Nothing was saved'));
    expect(document.querySelectorAll('a[download]')).toHaveLength(0);
    await waitFor(() => expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock-url'));
  });

  it('a throw AFTER a completed save never reports "Nothing was saved"', async () => {
    vi.stubGlobal('fetch', respond({ status: 200, type: PDF_TYPE }));
    const onAnnounce = vi.fn((message: string) => { if (message.endsWith('downloaded.')) throw new Error('announcer broke'); });
    fireEvent.click(renderPanel({ onAnnounce }));
    await waitFor(() => expect(screen.getByTestId('download-status-categories-pdf')).toHaveTextContent('Downloaded'));
    expect(onAnnounce).not.toHaveBeenCalledWith(expect.stringContaining('Nothing was saved'));
    expect(screen.getByTestId('download-button-categories-pdf')).not.toHaveAttribute('aria-disabled');
  });

  // (e) Reverting the onAnnounce wiring on the success path would leave this
  // spy never called (or called with stale text); reverting it on the 503
  // path above would do the same for that message -- each direction can only
  // pass if its own call actually happened with the exact human-readable text.
  it('(e) calls onAnnounce with a human-readable success message', async () => {
    const onAnnounce = vi.fn();
    vi.stubGlobal('fetch', respond({ status: 200, type: PDF_TYPE }));
    fireEvent.click(renderPanel({ onAnnounce }));
    await waitFor(() => expect(onAnnounce).toHaveBeenCalledWith('Cohort categories - PDF downloaded.'));
  });

  it('does not revoke the blob URL in the same task as the click', async () => {
    // Revoking synchronously with the click aborts the save in Firefox/WebKit,
    // which would be a silent failure of exactly the class this panel removes.
    vi.stubGlobal('fetch', respond({ status: 200, type: PDF_TYPE }));
    let revokedAtClick: boolean | null = null;
    clickSpy.mockImplementation(() => { revokedAtClick = revokeObjectURL.mock.calls.length > 0; });

    render(<DownloadFilesPanel groups={oneGroup()} />);
    fireEvent.click(screen.getByTestId('download-button-categories-pdf'));

    await waitFor(() => expect(clickSpy).toHaveBeenCalledTimes(1));
    expect(revokedAtClick).toBe(false);
    // It is still revoked, just on a later task.
    await waitFor(() => expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock-url'));
  });

  it('a valid DOCX triggers exactly one download', async () => {
    vi.stubGlobal('fetch', respond({ status: 200, type: DOCX_TYPE }));
    render(<DownloadFilesPanel groups={oneGroup()} />);
    fireEvent.click(screen.getByTestId('download-button-categories-docx'));
    await waitFor(() => expect(clickSpy).toHaveBeenCalledTimes(1));
  });

  it('sets a busy (aria-disabled) state and ignores a duplicate concurrent click', async () => {
    let release: (value: Response) => void = () => {};
    const gated = new Promise<Response>((resolve) => { release = resolve; });
    const fetchMock = vi.fn(() => gated);
    vi.stubGlobal('fetch', fetchMock);

    const button = renderPanel();
    fireEvent.click(button);
    await waitFor(() => expect(button).toHaveAttribute('aria-disabled', 'true'));
    expect(screen.getByTestId('download-status-categories-pdf')).toHaveTextContent('Downloading');

    fireEvent.click(button);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    release(new Response(new Blob(['x']), { status: 200, headers: new Headers({ 'content-type': PDF_TYPE }) }));
    await waitFor(() => expect(button).not.toHaveAttribute('aria-disabled'));
  });

  it.each([
    ['PRIVATE_PACKAGE_INTEGRITY_MISMATCH'],
    ['INVALID_PRINT_PACKAGE_CATALOG'],
    ['DOWNLOAD_BOUNDARY_UNAVAILABLE'],
    [undefined],
    ['<html>'],
  ])('a 503 with code %s is reported as a FAILURE, never as "not published"', async (code) => {
    const body = code === '<html>' ? '<html>Service Unavailable</html>' : JSON.stringify(code ? { code } : {});
    vi.stubGlobal('fetch', vi.fn(async () => new Response(body, { status: 503, headers: new Headers({ 'content-type': code === '<html>' ? 'text/html' : 'application/json' }) })));
    fireEvent.click(renderPanel());
    await waitFor(() => expect(screen.getByTestId('download-status-categories-pdf')).toHaveTextContent('could not be verified'));
    expect(screen.queryByText(/Not published yet/i)).toBeNull();
    expect(createObjectURL).not.toHaveBeenCalled();
  });

  it.each([['PRINT_PACKAGE_ARTIFACTS_UNAVAILABLE'], ['PRINT_PACKAGE_ARTIFACTS_INCOMPLETE']])('a 503 with release-state code %s reads "Not published yet"', async (code) => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ code }), { status: 503, headers: new Headers({ 'content-type': 'application/json' }) })));
    fireEvent.click(renderPanel());
    await waitFor(() => expect(screen.getByTestId('download-status-categories-pdf')).toHaveTextContent(/Not published yet/i));
  });

  it('offers a way to retry after a failure and can then succeed on the same button', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ code: 'PRINT_PACKAGE_ARTIFACTS_UNAVAILABLE' }), { status: 503, headers: new Headers({ 'content-type': 'application/json' }) }))
      .mockResolvedValueOnce(new Response(new Blob(['x']), { status: 200, headers: new Headers({ 'content-type': PDF_TYPE }) }));
    vi.stubGlobal('fetch', fetchMock);

    const button = renderPanel();
    fireEvent.click(button);
    await waitFor(() => expect(screen.getByTestId('download-status-categories-pdf')).toHaveTextContent(/Not published yet/i));
    expect(clickSpy).not.toHaveBeenCalled();

    fireEvent.click(button);
    await waitFor(() => expect(clickSpy).toHaveBeenCalledTimes(1));
    // The panel-wide "not published" notice does not outlive a delivered package.
    await waitFor(() => expect(screen.queryByText(/not published yet/i)).toBeNull());
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
