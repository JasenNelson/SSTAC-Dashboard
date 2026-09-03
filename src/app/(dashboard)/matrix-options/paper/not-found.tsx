import Link from 'next/link';

export default function MatrixOptionsPaperNotFound() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <div className="rounded-xl border border-slate-300 bg-white p-6 dark:border-slate-700 dark:bg-slate-800">
        <h1 className="text-2xl font-bold">Paper version or section not found</h1>
        <p className="mt-2 text-slate-600 dark:text-slate-300">The requested stable identity is not present in the verified synthetic release.</p>
        <Link className="mt-5 inline-flex min-h-[44px] items-center rounded-md bg-sky-700 px-4 font-semibold text-white" href="/matrix-options/paper">Open the current fixture</Link>
      </div>
    </div>
  );
}
