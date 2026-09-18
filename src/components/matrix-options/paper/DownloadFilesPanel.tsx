'use client';

import { useCallback, useEffect, useRef, type KeyboardEvent, type RefObject } from 'react';

import type { VerifiedDownloadManifest } from '../../../lib/matrix-options/paper/download-manifest';

export const PAPER_DOWNLOAD_FILES_PANEL_ID = 'paper-download-files-panel';
export const PAPER_DOWNLOAD_FILES_HEADING_ID = 'paper-download-files-heading';

export interface DownloadFilesPanelProps {
  readonly open: boolean;
  readonly manifest: VerifiedDownloadManifest | null;
  readonly onClose: () => void;
  readonly closeFocusRef?: RefObject<HTMLElement | null>;
  readonly panelId?: string;
  readonly headingId?: string;
}

export function DownloadFilesPanel({
  open,
  manifest,
  onClose,
  closeFocusRef,
  panelId = PAPER_DOWNLOAD_FILES_PANEL_ID,
  headingId = PAPER_DOWNLOAD_FILES_HEADING_ID,
}: DownloadFilesPanelProps) {
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (open) headingRef.current?.focus({ preventScroll: true });
  }, [open]);

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
      {manifest ? (
        <>
          <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
            Verified review packages for release {manifest.releaseIdentity} ({manifest.documentVersion}).
          </p>
          <ul aria-label="Available review packages" className="mt-4 space-y-2">
            {manifest.packages.map((packageEntry) => (
              <li key={packageEntry.packageId} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 p-3 dark:border-slate-700">
                <div className="min-w-0">
                  <p className="font-semibold">{packageEntry.label}</p>
                  <p className="break-words font-mono text-xs text-slate-500 dark:text-slate-400">{packageEntry.fileName} - {packageEntry.byteLength} bytes - SHA-256 {packageEntry.sha256}</p>
                </div>
                <a href={packageEntry.href} download={packageEntry.fileName} className="inline-flex min-h-[44px] items-center rounded-lg bg-sky-700 px-3 py-2 text-sm font-semibold text-white hover:bg-sky-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500">
                  Download {packageEntry.kind}
                </a>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p data-testid="reading-materials-content" className="mt-3 text-sm text-slate-600 dark:text-slate-300">
          <span data-testid="download-files-pending">Verified PDF and DOCX files will be downloaded when ready; review package files are pending server validation.</span>
        </p>
      )}
    </section>
  );
}
