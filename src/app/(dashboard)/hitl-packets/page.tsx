/**
 * HITL Packets — Session List Page
 *
 * Server component that discovers available packet sessions
 * and renders them as navigable cards.
 */

import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import Link from 'next/link';
import ErrorBoundary from '@/components/ErrorBoundary';
import { discoverPacketSessions } from '@/lib/hitl-packets/discovery';
import { FileText, Download, ShieldCheck, Clock } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function HitlPacketsPage() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value, ...options });
          } catch (_error) {
            // Server Component cookie handling
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value: '', ...options });
          } catch (_error) {
            // Server Component cookie handling
          }
        },
      },
    }
  );

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    redirect('/login?redirect=/hitl-packets');
  }

  let sessions: ReturnType<typeof discoverPacketSessions> = [];
  try {
    sessions = discoverPacketSessions();
  } catch (error) {
    console.error('Error discovering packets:', error);
  }

  return (
    <ErrorBoundary>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">HITL Packet Review</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Review evaluation packets produced by the RRAA engine.
            {sessions.length > 0
              ? ` ${sessions.length} session${sessions.length !== 1 ? 's' : ''} available.`
              : ''}
          </p>
        </div>

        {sessions.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {sessions.map((session) => (
              <Link
                key={session.sessionId}
                href={`/hitl-packets/${session.sessionId}`}
                className="block border border-slate-200 dark:border-slate-700 rounded-lg p-5 hover:shadow-md transition-shadow bg-white dark:bg-slate-800"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-sky-500" />
                    <h3 className="font-mono text-sm font-medium text-slate-900 dark:text-white truncate max-w-[200px]">
                      {session.sessionId}
                    </h3>
                  </div>
                  <ShieldCheck className="h-4 w-4 text-green-500" />
                </div>

                {session.metadata && (
                  <dl className="space-y-1 text-sm text-slate-500 dark:text-slate-400">
                    <div className="flex justify-between">
                      <dt>Records</dt>
                      <dd className="font-medium">{session.metadata.record_count}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt>Evaluated</dt>
                      <dd className="font-medium">{session.metadata.policies_evaluated ?? '-'}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt>Schema</dt>
                      <dd className="font-mono text-xs">{session.metadata.schema_version}</dd>
                    </div>
                  </dl>
                )}

                <div className="mt-3 flex items-center justify-between text-xs text-slate-400 dark:text-slate-500">
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {new Date(session.modifiedAt).toLocaleDateString()}
                  </span>
                  <span className="flex items-center gap-1">
                    {session.csvPath && <Download className="h-3 w-3" />}
                    {session.mdPath && <FileText className="h-3 w-3" />}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700">
            <FileText className="mx-auto h-12 w-12 text-slate-400 dark:text-slate-500" />
            <h3 className="mt-4 text-lg font-medium text-slate-900 dark:text-white">No packets found</h3>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              Run the evaluation engine with <code className="bg-slate-100 dark:bg-slate-700 px-1 rounded">--packet</code> to
              generate HITL packets.
            </p>
            <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
              Looking in: <code>{process.env.HITL_PACKET_DIR || '(default path)'}</code>
            </p>
          </div>
        )}
      </div>
    </ErrorBoundary>
  );
}
