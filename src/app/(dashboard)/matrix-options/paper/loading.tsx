export default function MatrixOptionsPaperLoading() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-10" aria-busy="true" aria-live="polite">
      <div className="animate-pulse space-y-4 motion-reduce:animate-none">
        <div className="h-5 w-44 rounded bg-slate-300 dark:bg-slate-700" />
        <div className="h-10 w-3/4 rounded bg-slate-300 dark:bg-slate-700" />
        <div className="h-40 rounded bg-slate-200 dark:bg-slate-800" />
      </div>
      <p className="sr-only">Loading Options Paper section</p>
    </div>
  );
}
