import 'server-only';

import { guidedCompletionSchema, guidedEntrySchema } from './guided-r2-contract';
import type { GuidedAdminIdentity } from './guided-r2-admin';

const ENTRY_COLUMNS = 'user_id,document_version,guided_manifest_sha256,review_manifest_sha256,target_kind,target_id,revision,draft_choice_id,draft_rationale,draft_text,submitted_choice_id,submitted_rationale,submitted_text,submitted_revision,submitted_at,updated_at';
const COMPLETION_COLUMNS = 'user_id,document_version,guided_manifest_sha256,review_manifest_sha256,revision,submitted_set_digest,submitted_at';
const PAGE_SIZE = 1000;
const MAX_PAGES = 100;
interface QueryResult { data?: unknown; error?: unknown }
interface Query extends PromiseLike<QueryResult> {
  eq(column: string, value: string): Query;
  gt(column: string, value: string): Query;
  or(filters: string): Query;
  order(column: string, options?: { ascending?: boolean }): Query;
  limit(count: number): Query;
}
interface Client { from(table: string): { select(columns: string): Query } }

async function readTable(client: Client, table: 'matrix_guided_r2_entries' | 'matrix_guided_r2_completion', identity: GuidedAdminIdentity): Promise<unknown[]> {
  const values: unknown[] = [];
  let last: { user_id: string; target_kind?: string; target_id?: string } | null = null;
  for (let page = 0; page < MAX_PAGES; page += 1) {
    let query = client.from(table).select(table === 'matrix_guided_r2_entries' ? ENTRY_COLUMNS : COMPLETION_COLUMNS)
      .eq('document_version', identity.documentVersion)
      .eq('guided_manifest_sha256', identity.guidedManifestSha256)
      .eq('review_manifest_sha256', identity.reviewManifestSha256);
    if (last) {
      if (table === 'matrix_guided_r2_entries') {
        query = query.or(`user_id.gt.${last.user_id},and(user_id.eq.${last.user_id},target_kind.gt.${last.target_kind}),and(user_id.eq.${last.user_id},target_kind.eq.${last.target_kind},target_id.gt.${last.target_id})`);
      } else query = query.gt('user_id', last.user_id);
    }
    query = query.order('user_id', { ascending: true });
    if (table === 'matrix_guided_r2_entries') query = query.order('target_kind', { ascending: true }).order('target_id', { ascending: true });
    const result = await query.limit(PAGE_SIZE);
    if (result.error || !Array.isArray(result.data)) throw new Error('Guided admin query failed');
    if (result.data.length === 0) return values;
    for (const item of result.data) {
      const parsed = table === 'matrix_guided_r2_entries' ? guidedEntrySchema.safeParse(item) : guidedCompletionSchema.safeParse(item);
      if (!parsed.success) throw new Error('Guided admin row failed validation');
      const row = parsed.data;
      if (row.document_version !== identity.documentVersion || row.guided_manifest_sha256 !== identity.guidedManifestSha256 || row.review_manifest_sha256 !== identity.reviewManifestSha256) throw new Error('Guided admin release identity mismatch');
      values.push(item);
      last = table === 'matrix_guided_r2_entries'
        ? { user_id: row.user_id, target_kind: (row as { target_kind: string }).target_kind, target_id: (row as { target_id: string }).target_id }
        : { user_id: row.user_id };
    }
  }
  throw new Error('Guided admin query exceeded page limit');
}

export async function fetchGuidedAdminState(client: Client, identity: GuidedAdminIdentity): Promise<{ entries: unknown[]; completions: unknown[] }> {
  const entries = await readTable(client, 'matrix_guided_r2_entries', identity);
  const completions = await readTable(client, 'matrix_guided_r2_completion', identity);
  return { entries, completions };
}
