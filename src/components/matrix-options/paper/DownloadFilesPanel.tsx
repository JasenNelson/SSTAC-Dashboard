'use client';

import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type RefObject } from 'react';

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
  readonly open: boolean;
  readonly groups: readonly DownloadCohortGroup[] | null;
  readonly onClose: () => void;
  readonly closeFocusRef?: RefObject<HTMLElement | null>;
  readonly panelId?: string;
  readonly headingId?: string;
}

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

export function DownloadFilesPanel({
  open,
  groups,
  onClose,
  closeFocusRef,
  panelId = PAPER_DOWNLOAD_FILES_PANEL_ID,
  headingId = PAPER_DOWNLOAD_FILES_HEADING_ID,
}: DownloadFilesPanelProps) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [states, setStates] = useState<Readonly<Record<string, PackageState>>>({});
  /** True once any package reports the release-level "not published yet" state. */
  const [notPublished, setNotPublished] = useState(false);
  /** Blob URLs created by this panel, revoked on unmount so nothing leaks. */
  const objectUrls = useRef<string[]>([]);

  useEffect(() => {
    if (open) headingRef.current?.focus({ preventScroll: true });
  }, [open]);

  useEffect(() => () => {
    // Read the ref AT CLEANUP TIME. Capturing the array once made this safety
    // net inert as soon as the success path replaced the array.
    for (const url of objectUrls.current) URL.revokeObjectURL(url);
    objectUrls.current = [];
  }, []);

  const close = useCallback(() => {
    onClose();
    queueMicrotask(() => closeFocusRef?.current?.focus({ preventScroll: true }));
  }, [closeFocusRef, onClose]);

  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key !== 'Escape' || event.defaultPrevented) return;
    const target = event.target as Element | null;
    if (target?.closest('select')) return;
    event.preventDefault();
    close();
  };

  /**
   * Controlled download.
   *
   * The previous implementation was a bare `<a href download>`. Because the
   * artifact route answers failures with JSON, the browser happily saved a 503
   * error body under a `.pdf` name - a file that looks corrupt, with no error
   * shown anywhere. Nothing is written to disk here until the response is known
   * to be a successful package of the expected type.
   */
  const startDownload = useCallback(async (packageEntry: DownloadManifestPackage) => {
    const id = packageEntry.packageId;
    // One in-flight download per package; a second click is ignored while busy.
    if (states[id]?.status === 'busy') return;
    setStates((prev) => ({ ...prev, [id]: { status: 'busy' } }));

    const failWith = (message: string) => setStates((prev) => ({ ...prev, [id]: { status: 'error', message } }));

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
        // 503 from this boundary means the verified package is not published
        // yet - a release state, not a fault with this one file. Surfacing it
        // per-package made ten unprovisioned packages read as ten broken ones,
        // so it also raises a single panel-level notice.
        setNotPublished(true);
        failWith('Not published yet. Nothing was saved.');
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
      // finally, so a throwing click cannot leave the hidden anchor in the DOM.
      anchor.remove();
    }
    // Revoke on a LATER task. Firefox and WebKit can abort the save if the blob
    // URL is revoked in the same task as the click, and this panel exists to
    // stop silent save failures, not introduce a new one. The unmount cleanup
    // above still revokes anything outstanding.
    setTimeout(() => {
      URL.revokeObjectURL(url);
      objectUrls.current = objectUrls.current.filter((candidate) => candidate !== url);
    }, 0);
    setStates((prev) => ({ ...prev, [id]: { status: 'saved', fileName } }));
  }, [states]);

  const hasPackages = Boolean(groups && groups.length > 0);

  return (
    <section
      id={panelId}
      data-testid="download-files-panel"
      hidden={!open}
      inert={!open ? true : undefined}
      aria-labelledby={headingId}
      onKeyDown={onKeyDown}
      className="min-w-0 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900 print:hidden"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h2 ref={headingRef} tabIndex={-1} id={headingId} className="scroll-mt-[calc(var(--paper-sticky-header-height,6rem)+0.5rem)] text-base font-bold focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-600">
          Download Files
        </h2>
        <button type="button" onClick={close} className="inline-flex min-h-[44px] items-center rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700">
          Hide Download Files
        </button>
      </div>
      {hasPackages ? (
        <>
          <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
            Verified review packages for release {groups![0].manifest.releaseIdentity} ({groups![0].manifest.documentVersion}).
          </p>
          {notPublished ? (
            <p
              data-testid="download-not-published"
              role="status"
              aria-live="polite"
              className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm font-semibold text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200"
            >
              These review packages are listed but not published yet, so downloads are unavailable for now.
              Nothing has been saved to your computer. This affects every package in this release, not just one.
            </p>
          ) : null}
          {groups!.map((group) => (
            <section key={group.cohortId} data-testid={`download-cohort-${group.cohortId}`} aria-label={`${group.cohortName} packages`} className="mt-4">
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">{group.cohortName}</h3>
              <ul aria-label={`Available review packages for ${group.cohortName}`} className="mt-2 space-y-2">
                {group.manifest.packages.map((packageEntry) => {
                  const state = states[packageEntry.packageId] ?? { status: 'idle' };
                  const busy = state.status === 'busy';
                  return (
                    <li key={packageEntry.packageId} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 p-3 dark:border-slate-700">
                      <div className="min-w-0">
                        <p className="font-semibold">{packageEntry.label}</p>
                        <p className="break-words font-mono text-xs text-slate-500 dark:text-slate-400">{packageEntry.fileName} - {packageEntry.byteLength} bytes - SHA-256 {packageEntry.sha256}</p>
                        <p
                          data-testid={`download-status-${packageEntry.packageId}`}
                          role="status"
                          aria-live="polite"
                          className={
                            state.status === 'error'
                              ? 'mt-1 text-xs font-semibold text-red-700 dark:text-red-400'
                              : state.status === 'saved'
                                ? 'mt-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400'
                                : 'sr-only'
                          }
                        >
                          {state.status === 'error'
                            ? state.message
                            : state.status === 'saved'
                              ? `Downloaded ${state.fileName}`
                              : busy
                                ? 'Downloading'
                                : ''}
                        </p>
                      </div>
                      <button
                        type="button"
                        data-testid={`download-button-${packageEntry.packageId}`}
                        onClick={() => { void startDownload(packageEntry); }}
                        disabled={busy}
                        aria-busy={busy}
                        aria-describedby={`download-status-${packageEntry.packageId}`}
                        className="inline-flex min-h-[44px] items-center rounded-lg bg-sky-700 px-3 py-2 text-sm font-semibold text-white hover:bg-sky-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {busy ? 'Downloading...' : state.status === 'error' ? `Retry ${packageEntry.kind}` : `Download ${packageEntry.kind}`}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </>
      ) : (
        <p data-testid="reading-materials-content" className="mt-3 text-sm text-slate-600 dark:text-slate-300">
          <span data-testid="download-files-pending">Verified PDF and DOCX files will be downloaded when ready; review package files are pending server validation.</span>
        </p>
      )}
    </section>
  );
}
