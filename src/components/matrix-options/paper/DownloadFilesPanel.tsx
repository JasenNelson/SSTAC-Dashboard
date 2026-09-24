'use client';

import { useEffect, useRef, useState } from 'react';
import { Download } from 'lucide-react';

import type { DownloadManifestPackage, VerifiedDownloadManifest } from '../../../lib/matrix-options/paper/download-manifest';

export const PAPER_DOWNLOAD_FILES_PANEL_ID = 'paper-download-files-panel';
export const PAPER_DOWNLOAD_FILES_HEADING_ID = 'paper-download-files-heading';

/**
 * One cohort's verified package pair, labelled so cohort identity is
 * unambiguous when several groups are shown at once.
 *
 * Working Draft passes all five groups (ten packages); My Review passes exactly
 * one group for the selected cohort. The panel renders one path for both, so
 * there is no mode-specific branch here and no second cohort selector.
 */
export interface DownloadCohortGroup {
  readonly cohortId: string;
  readonly cohortName: string;
  readonly manifest: VerifiedDownloadManifest;
}

export interface DownloadFilesPanelProps {
  readonly groups: readonly DownloadCohortGroup[] | null;
  readonly headingId?: string;
  /** Receives a short result message (saved or failed) to announce outside the popover. */
  readonly onAnnounce?: (message: string) => void;
}

/**
 * Download-boundary codes that mean the release has no verified package yet.
 * Known residual (server side, owner follow-up): the boundary also answers
 * PRINT_PACKAGE_ARTIFACTS_UNAVAILABLE for some storage faults (e.g. a denied
 * or failed storage read), which therefore still read as "not published".
 */
const NOT_PUBLISHED_CODES: ReadonlySet<string> = new Set(['PRINT_PACKAGE_ARTIFACTS_UNAVAILABLE', 'PRINT_PACKAGE_ARTIFACTS_INCOMPLETE']);
/** Exactly the two content types the catalog permits. */
const PDF_TYPE = 'application/pdf';
const DOCX_TYPE = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const EXPECTED_TYPE: Record<string, string> = { PDF: PDF_TYPE, DOCX: DOCX_TYPE };

/** A safe download filename: a bare basename with the right extension. */
const SAFE_FILE_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]*\.(pdf|docx)$/i;

/**
 * Extracts a filename from Content-Disposition ONLY if it is a bare, safe
 * basename. Anything path-bearing, encoded or otherwise unexpected is rejected
 * and the caller falls back to the catalog-bound filename, so a hostile or
 * buggy header can never steer where the browser writes.
 */
export function safeFileNameFromDisposition(header: string | null, kind?: 'PDF' | 'DOCX'): string | null {
  if (!header) return null;
  const match = /filename="([^"]*)"/i.exec(header) ?? /filename=([^;]+)/i.exec(header);
  const candidate = match?.[1]?.trim();
  if (!candidate) return null;
  if (candidate.includes('/') || candidate.includes('\\') || candidate.includes('..') || candidate.includes('%')) return null;
  if (!SAFE_FILE_NAME.test(candidate)) return null;
  // The extension must match the package KIND, not merely be one of the two
  // allowed suffixes: otherwise PDF bytes could be written under a .docx name.
  if (kind) {
    const required = kind === 'PDF' ? '.pdf' : '.docx';
    if (!candidate.toLowerCase().endsWith(required)) return null;
  }
  return candidate;
}

type PackageState =
  | { readonly status: 'idle' }
  | { readonly status: 'busy' }
  | { readonly status: 'saved'; readonly fileName: string }
  | { readonly status: 'error'; readonly message: string };

/**
 * Download Files content, shown inside the header popover (PaperPopover).
 *
 * The reader sees only what they are choosing: the review topic and the file
 * type ("Categories - PDF"). Package ids, file names, byte counts, hashes and
 * release identity stay internal -- they still bind every download through the
 * validated manifest and the controlled fetch below, they are just not
 * presentation.
 */
export function DownloadFilesPanel({ groups, headingId = PAPER_DOWNLOAD_FILES_HEADING_ID, onAnnounce }: DownloadFilesPanelProps) {
  const labelFor = (packageEntry: DownloadManifestPackage) => {
    const group = groups?.find((candidate) => candidate.manifest.packages.some((entry) => entry.packageId === packageEntry.packageId));
    return group ? `${group.cohortName} - ${packageEntry.kind}` : packageEntry.kind;
  };
  const [states, setStates] = useState<Readonly<Record<string, PackageState>>>({});
  /** True once any package reports the release-level "not published yet" state. */
  const [notPublished, setNotPublished] = useState(false);
  /** Packages with a download in flight (synchronous guard against double activation). */
  const inFlightRef = useRef(new Set<string>());
  /** Packages whose save completed in the current attempt (a later throw must not report "Nothing was saved"). */
  const savedRef = useRef(new Set<string>());
  /** Blob URLs created by this panel, revoked on unmount so nothing leaks. */
  const objectUrls = useRef<string[]>([]);

  useEffect(() => () => {
    // Read the ref AT CLEANUP TIME. Capturing the array once made this safety
    // net inert as soon as the success path replaced the array.
    for (const url of objectUrls.current) URL.revokeObjectURL(url);
    objectUrls.current = [];
  }, []);

  /**
   * Controlled download.
   *
   * The previous implementation was a bare `<a href download>`. Because the
   * artifact route answers failures with JSON, the browser happily saved a 503
   * error body under a `.pdf` name - a file that looks corrupt, with no error
   * shown anywhere. Nothing is written to disk here until the response is known
   * to be a successful package of the expected type.
   */
  const startDownload = async (packageEntry: DownloadManifestPackage) => {
    const id = packageEntry.packageId;
    // One in-flight download per package; a second click is ignored while busy.
    // A ref, not render state: two clicks before a re-render must not both start.
    if (inFlightRef.current.has(id)) return;
    inFlightRef.current.add(id);
    try {
      await runDownload(packageEntry);
    } catch {
      // Anything unexpected (e.g. the browser refusing the save) must not leave
      // the button stuck busy: report it -- visibly AND to the live region,
      // like every other failure -- unless the save had already completed.
      setStates((prev) => {
        if (prev[id]?.status === 'saved') return prev;
        return { ...prev, [id]: { status: 'error', message: 'Download failed. Nothing was saved.' } };
      });
      if (!savedRef.current.has(id)) {
        try { onAnnounce?.(`${labelFor(packageEntry)}: Download failed. Nothing was saved.`); } catch { /* announcer is best-effort */ }
      }
    } finally {
      savedRef.current.delete(id);
      inFlightRef.current.delete(id);
    }
  };

  const runDownload = async (packageEntry: DownloadManifestPackage) => {
    const id = packageEntry.packageId;
    setStates((prev) => ({ ...prev, [id]: { status: 'busy' } }));

    const failWith = (message: string) => {
      setStates((prev) => ({ ...prev, [id]: { status: 'error', message } }));
      try { onAnnounce?.(`${labelFor(packageEntry)}: ${message}`); } catch { /* announcer is best-effort */ }
    };

    let response: Response;
    try {
      response = await fetch(packageEntry.href, {
        credentials: 'same-origin',
        headers: { Accept: EXPECTED_TYPE[packageEntry.kind] ?? PDF_TYPE },
      });
    } catch {
      // Network failure or abort. Nothing was written.
      failWith('Download failed: the request could not be completed. Nothing was saved.');
      return;
    }

    if (!response.ok) {
      if (response.status === 503) {
        const code = await response.json().then((body: unknown) => (body && typeof body === 'object' ? (body as { code?: unknown }).code : undefined)).catch(() => undefined);
        if (typeof code === 'string' && NOT_PUBLISHED_CODES.has(code)) {
          // The verified package is not published yet - a release state, not a
          // fault with this one file. Surfacing it per-package made ten
          // unprovisioned packages read as ten broken ones, so it also raises a
          // single panel-level notice.
          setNotPublished(true);
          failWith('Not published yet. Nothing was saved.');
          return;
        }
        // Any other 503 (integrity mismatch, invalid catalog, boundary failure,
        // unreadable body) is a real failure and must not pass as a release state.
        failWith('Download failed: the package could not be verified right now. Nothing was saved.');
        return;
      }
      const detail = response.status === 401 || response.status === 403
        ? 'you are not signed in with access to this package'
        : `the server returned ${response.status}`;
      failWith(`Download failed: ${detail}. Nothing was saved.`);
      return;
    }

    // A success status is not enough: the failure mode being fixed is a JSON
    // body arriving where package bytes were expected.
    const contentType = (response.headers.get('content-type') ?? '').split(';')[0]?.trim().toLowerCase();
    if (contentType !== EXPECTED_TYPE[packageEntry.kind]) {
      failWith('Download failed: the server did not return a verified package file. Nothing was saved.');
      return;
    }

    let blob: Blob;
    try {
      blob = await response.blob();
    } catch {
      failWith('Download failed: the package could not be read. Nothing was saved.');
      return;
    }

    const fileName = safeFileNameFromDisposition(response.headers.get('content-disposition'), packageEntry.kind) ?? packageEntry.fileName;
    const url = URL.createObjectURL(blob);
    objectUrls.current.push(url);
    const anchor = document.createElement('a');
    try {
      anchor.href = url;
      anchor.download = fileName;
      anchor.rel = 'noopener';
      anchor.style.display = 'none';
      document.body.appendChild(anchor);
      anchor.click();
    } finally {
      // finally, so a throwing click can leave neither the hidden anchor in the
      // DOM nor the blob URL allocated.
      anchor.remove();
      // Revoke on a LATER task. Firefox and WebKit can abort the save if the blob
      // URL is revoked in the same task as the click, and this panel exists to
      // stop silent save failures, not introduce a new one. The unmount cleanup
      // above still revokes anything outstanding.
      setTimeout(() => {
        URL.revokeObjectURL(url);
        objectUrls.current = objectUrls.current.filter((candidate) => candidate !== url);
      }, 0);
    }
    savedRef.current.add(id);
    setStates((prev) => ({ ...prev, [id]: { status: 'saved', fileName } }));
    // A package was just delivered, so the panel-wide "not published" notice is no longer true.
    setNotPublished(false);
    onAnnounce?.(`${labelFor(packageEntry)} downloaded.`);
  };

  const hasPackages = Boolean(groups && groups.length > 0);

  return (
    <section data-testid="download-files-panel" aria-labelledby={headingId} className="min-w-0">
      <h2 id={headingId} className="px-2 pb-1 pt-1 text-sm font-semibold text-[var(--db-text-primary)]">Download files</h2>
      {hasPackages ? (
        <>
          {notPublished ? (
            <p data-testid="download-not-published" role="status" aria-live="polite" className="mx-2 mb-2 rounded-md border border-[var(--db-review-tint-border)] bg-[var(--db-review-tint)] p-2 text-sm text-[var(--db-text-primary)]">
              These files are not published yet, so downloads are unavailable for now. Nothing was saved.
            </p>
          ) : null}
          {groups!.map((group) => (
            <ul key={group.cohortId} data-testid={`download-cohort-${group.cohortId}`} aria-label={`${group.cohortName} files`} className="border-t border-[var(--db-border)] py-1 first-of-type:border-t-0">
              {group.manifest.packages.map((packageEntry) => {
                const state = states[packageEntry.packageId] ?? { status: 'idle' };
                const busy = state.status === 'busy';
                const name = `${group.cohortName} - ${packageEntry.kind}`;
                const statusText = state.status === 'error' ? state.message : state.status === 'saved' ? 'Downloaded' : busy ? 'Downloading' : '';
                return (
                  <li key={packageEntry.packageId} className="flex min-w-0 flex-col">
                    <button
                      type="button"
                      data-testid={`download-button-${packageEntry.packageId}`}
                      onClick={() => { void startDownload(packageEntry); }}
                      aria-disabled={busy || undefined}
                      aria-describedby={`download-status-${packageEntry.packageId}`}
                      className="flex min-h-[44px] w-full items-center gap-3 rounded-md px-2 py-2 text-left text-sm text-[var(--db-text-primary)] hover:bg-[var(--db-depth-1)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--db-focus-ring)] aria-disabled:cursor-progress"
                    >
                      <Download aria-hidden="true" className="h-4 w-4 shrink-0 text-[var(--db-text-secondary)]" />
                      <span className="min-w-0 flex-1">{name}</span>
                    </button>
                    {/* Outside the button, so the button's name stays "<Topic> - <kind>" and the status is read once. */}
                    <span
                      id={`download-status-${packageEntry.packageId}`}
                      data-testid={`download-status-${packageEntry.packageId}`}
                      className={statusText ? (state.status === 'error' ? 'px-9 pb-1 text-xs font-semibold text-[var(--db-fail)]' : 'px-9 pb-1 text-xs text-[var(--db-text-secondary)]') : 'sr-only'}
                    >
                      {statusText}
                    </span>
                  </li>
                );
              })}
            </ul>
          ))}
        </>
      ) : (
        <p data-testid="reading-materials-content" className="px-2 pb-2 text-sm text-[var(--db-text-secondary)]">
          <span data-testid="download-files-pending">Download files are being prepared for this release and are not available yet.</span>
        </p>
      )}
    </section>
  );
}
