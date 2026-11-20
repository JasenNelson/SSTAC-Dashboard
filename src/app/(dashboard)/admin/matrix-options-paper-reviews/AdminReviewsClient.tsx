'use client';
import Link from 'next/link';
import type { ReviewRow } from '@/lib/matrix-options/paper/review-csv';
import AdminFunctionsNav from '@/components/dashboard/AdminFunctionsNav';
type ReviewState = { kind: 'ready' | 'empty' | 'query-error' | 'integrity-error' };
const FILTERS = ['documentVersion', 'manifestSha256', 'cohortId', 'questionId', 'userId', 'status'] as const;
export default function AdminReviewsClient({ rows, state, initialFilters }: { rows: ReviewRow[]; state: ReviewState; initialFilters: Record<string, string> }) {
  const query = new URLSearchParams(Object.entries(initialFilters).filter(([, value]) => value)).toString();
  const exportHref = `/api/matrix-options/paper/reviews/export${query ? `?${query}` : ''}`;
  let body: React.ReactNode;
  if (state.kind === 'query-error') {
    body = <p role="alert">Review query failed. No review data is available.</p>;
  } else if (state.kind === 'integrity-error') {
    body = <p role="alert">Review integrity validation failed. No review data is available.</p>;
  } else {
    body = <><div><p>Authenticated administrative review visibility for legacy v0.9.91.</p><Link href={exportHref}>Export CSV</Link></div><form method="get"><input type="hidden" name="view" value="legacy" />{FILTERS.map((key) => <label key={key}>{key.replace(/([A-Z])/g, ' $1').replace(/^./, (str) => str.toUpperCase())}<input name={key} defaultValue={initialFilters[key] || ''} /></label>)}<button type="submit">Apply filters</button></form>{state.kind === 'empty' ? <p>No reviews match the selected filters.</p> : <div className="overflow-x-auto"><table><caption>Review responses</caption><thead><tr><th>Document version</th><th>Manifest identity</th><th>Cohort</th><th>Question</th><th>Reviewer</th><th>Draft text</th><th>Submitted text</th><th>Current revision</th><th>Submitted revision</th><th>Status</th><th>Updated at</th><th>Submitted at</th></tr></thead><tbody>{rows.map((row, index) => <tr key={`${row.questionId}:${row.userId}:${index}`}><td>{row.documentVersion}</td><td>{row.manifestSha256}</td><td>{row.cohortId}</td><td>{row.questionId}</td><td>{row.userId}</td><td className="max-w-xs truncate" title={row.draftText ?? undefined}>{row.draftText}</td><td className="max-w-xs truncate" title={row.submittedText ?? undefined}>{row.submittedText}</td><td>{row.currentRevision}</td><td>{row.submittedRevision ?? ''}</td><td>{row.status}</td><td>{row.updatedAt ?? ''}</td><td>{row.submittedAt ?? ''}</td></tr>)}</tbody></table></div>}</>;
  }
  return (
    <main className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">Options Paper Reviews</h1>
      </div>
      <AdminFunctionsNav />
      <nav aria-label="Review release" className="my-6 flex gap-5"><Link href="/admin/matrix-options-paper-reviews?view=guided" className="underline">Guided R2</Link><Link href="/admin/matrix-options-paper-reviews?view=legacy" aria-current="page" className="font-semibold underline">Legacy v0.9.91</Link></nav>
      {body}
    </main>
  );
}
