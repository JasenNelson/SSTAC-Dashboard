'use client';

import { AlertTriangle } from 'lucide-react';

export default function MatrixOptionsPaperError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <div role="alert" className="rounded-xl border border-rose-300 bg-rose-50 p-6 text-rose-950 dark:border-rose-900 dark:bg-rose-950/50 dark:text-rose-100">
        <AlertTriangle className="h-7 w-7" aria-hidden="true" />
        <h1 className="mt-3 text-2xl font-bold">Options Paper unavailable</h1>
        <p className="mt-2">The selected version could not pass its provider or integrity checks. No unverified content was displayed.</p>
        <button type="button" onClick={reset} className="mt-5 min-h-[44px] rounded-md bg-rose-800 px-4 font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-700 focus-visible:ring-offset-2">Retry verified load</button>
      </div>
    </div>
  );
}
