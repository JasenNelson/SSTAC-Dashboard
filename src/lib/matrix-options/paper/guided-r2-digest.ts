import type { GuidedEntry } from './guided-r2-contract';

function active(entry: GuidedEntry): boolean {
  return Boolean(entry.draft_choice_id || entry.draft_rationale?.trim() || entry.draft_text?.trim());
}

async function sha256(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/** The database uses the same ASCII record shape and UTF-8 field hashes. */
export async function guidedR2DraftSetDigest(entries: readonly GuidedEntry[]): Promise<string> {
  const sorted = entries.filter(active).toSorted((a, b) => {
    const left = `${a.target_kind}:${a.target_id}`;
    const right = `${b.target_kind}:${b.target_id}`;
    return left < right ? -1 : left > right ? 1 : 0;
  });
  const records = await Promise.all(sorted.map(async (entry) => {
    const values = await Promise.all([entry.draft_choice_id, entry.draft_rationale, entry.draft_text].map((value) => value === null ? Promise.resolve('-') : sha256(value)));
    return `${entry.target_kind}:${entry.target_id}:${entry.revision}:${values.join(':')}`;
  }));
  return sha256(records.join('\n'));
}
