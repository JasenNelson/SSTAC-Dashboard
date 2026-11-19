'use client';

import Link from 'next/link';
import AdminFunctionsNav from '@/components/dashboard/AdminFunctionsNav';
import type { GuidedAdminIdentity, GuidedAdminRow } from '@/lib/matrix-options/paper/guided-r2-admin';

type State = 'ready' | 'empty' | 'query-error' | 'integrity-error';
const cell = (value: string | number | null) => value ?? '';

export default function GuidedAdminClient({ rows, identity, state, userId = '', status = '', preview = false }: {
  rows: readonly GuidedAdminRow[]; identity: GuidedAdminIdentity | null; state: State; userId?: string; status?: string; preview?: boolean;
}) {
  const query = new URLSearchParams();
  if (userId) query.set('userId', userId);
  if (status) query.set('status', status);
  return <main className="p-8">
    <h1 className="mb-2 text-3xl font-bold">Options Paper Reviews</h1>
    {!preview ? <AdminFunctionsNav /> : null}
    {!preview ? <nav aria-label="Review release" className="my-6 flex gap-5">
      <Link href="/admin/matrix-options-paper-reviews?view=guided" aria-current="page" className="font-semibold underline">Guided R2</Link>
      <Link href="/admin/matrix-options-paper-reviews?view=legacy" className="underline">Legacy v0.9.91</Link>
    </nav> : <Link href="/r2-guided-fixture" className="my-6 inline-block underline">Reviewer preview</Link>}
    <p>Current guided responses and completion, bound to the R2 release. Reviewer identity is the account user ID.</p>
    {identity ? <p className="mt-2 break-all text-xs">{identity.documentVersion} | {identity.guidedManifestSha256} | {identity.reviewManifestSha256}</p> : null}
    {state === 'query-error' || state === 'integrity-error' ? <p role="alert" className="mt-5">{state === 'query-error' ? 'Guided review query failed.' : 'Guided review integrity validation failed.'} No review data is available.</p> : <>
      <Link href={preview ? '/api/matrix-options/paper/preview-r2?admin=csv' : `/api/matrix-options/paper/guided-r2/export${query.size ? `?${query}` : ''}`} className="mt-5 inline-block underline">Export guided R2 CSV</Link>
      {!preview ? <form method="get" className="my-5 flex flex-wrap items-end gap-3"><input type="hidden" name="view" value="guided" /><label>Reviewer user ID<input name="userId" defaultValue={userId} className="ml-2 border p-2" /></label><label>Status<select name="status" defaultValue={status} className="ml-2 border p-2"><option value="">All</option><option value="saved-draft">Saved draft</option><option value="submitted">Submitted</option><option value="changed-since-submit">Changed since submit</option><option value="completion-only">Completion only</option></select></label><button type="submit" className="border px-4 py-2">Apply filters</button></form> : null}
      {state === 'empty' ? <p>No guided reviews match the selected filters.</p> : <div className="overflow-x-auto"><table className="border-collapse text-left text-sm"><caption className="text-left font-semibold">Guided R2 review responses</caption><thead><tr>{['Reviewer','Target','Draft choice','Draft rationale','Draft text','Submitted choice','Submitted rationale','Submitted text','Status','Revision','Submitted revision','Updated','Submitted','Completion revision','Completed'].map((heading) => <th key={heading} scope="col" className="border p-2">{heading}</th>)}</tr></thead><tbody>{rows.map((row) => <tr key={`${row.userId}:${row.targetKind}:${row.targetId}`}>
        <td className="border p-2 font-mono">{row.userId}</td><td className="border p-2"><strong>{row.targetLabel}</strong><br />{row.targetKind} {row.targetId}</td>
        <td className="border p-2">{cell(row.draftChoiceLabel)}{row.draftChoiceId ? ` (${row.draftChoiceId})` : ''}</td><td className="min-w-48 whitespace-pre-wrap border p-2">{cell(row.draftRationale)}</td><td className="min-w-48 whitespace-pre-wrap border p-2">{cell(row.draftText)}</td>
        <td className="border p-2">{cell(row.submittedChoiceLabel)}{row.submittedChoiceId ? ` (${row.submittedChoiceId})` : ''}</td><td className="min-w-48 whitespace-pre-wrap border p-2">{cell(row.submittedRationale)}</td><td className="min-w-48 whitespace-pre-wrap border p-2">{cell(row.submittedText)}</td>
        <td className="border p-2">{row.status}</td><td className="border p-2">{cell(row.revision)}</td><td className="border p-2">{cell(row.submittedRevision)}</td><td className="border p-2">{cell(row.updatedAt)}</td><td className="border p-2">{cell(row.submittedAt)}</td><td className="border p-2">{cell(row.completionRevision)}</td><td className="border p-2">{cell(row.completedAt)}</td>
      </tr>)}</tbody></table></div>}
    </>}
  </main>;
}
