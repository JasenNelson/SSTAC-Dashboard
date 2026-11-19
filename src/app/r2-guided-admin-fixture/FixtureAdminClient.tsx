'use client';

import { useEffect, useState } from 'react';
import GuidedAdminClient from '@/app/(dashboard)/admin/matrix-options-paper-reviews/GuidedAdminClient';
import type { GuidedAdminIdentity, GuidedAdminRow } from '@/lib/matrix-options/paper/guided-r2-admin';

export default function FixtureAdminClient() {
  const [data, setData] = useState<{ identity: GuidedAdminIdentity; rows: GuidedAdminRow[] } | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    let alive = true;
    void fetch('/api/matrix-options/paper/preview-r2?admin=1', { cache: 'no-store' })
      .then(async (response) => { if (!response.ok) throw new Error('Preview snapshot unavailable'); return response.json(); })
      .then((value) => { if (alive) setData(value); })
      .catch(() => { if (alive) setError(true); });
    return () => { alive = false; };
  }, []);
  if (!data && !error) return <p role="status">Loading local guided admin preview...</p>;
  return <GuidedAdminClient preview rows={data?.rows ?? []} identity={data?.identity ?? null} state={error ? 'query-error' : data?.rows.length ? 'ready' : 'empty'} />;
}
