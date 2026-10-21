'use client';

import { useEffect, useState } from 'react';
import JermilovaBnrrmClient from '../forked/JermilovaBnrrmClient';
import { loadJermilovaPack } from '../lib/loadJermilovaPack';
import { createVerifiedFetch } from '../lib/verifiedFetch';
import { PackLoadState } from './PackLoadState';

// Integrity, then the original BN-RRM page.
// 1. A verifying fetch is installed for the page's lifetime: every /bn-rrm/ response
//    the original stores receive must match asset-manifest.json (bytes + sha256), and
//    any violation replaces the page with the fail-closed error state.
// 2. The pack is verified once up front (14 nodes, 15 edges, claims) before the
//    forked authenticated shell mounts.
export default function JermilovaViewerClient() {
  const [verified, setVerified] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    const originalFetch = globalThis.fetch;
    globalThis.fetch = createVerifiedFetch(originalFetch.bind(globalThis), (violation) => {
      if (live) setError(violation.message);
    });
    loadJermilovaPack()
      .then(() => {
        if (live) setVerified(true);
      })
      .catch((reason: unknown) => {
        if (!live) return;
        setError(reason instanceof Error ? reason.message : 'The approved pack could not be loaded.');
      });
    return () => {
      live = false;
      globalThis.fetch = originalFetch;
    };
  }, []);

  return (
    <PackLoadState error={error} loading={!verified}>
      {verified && <JermilovaBnrrmClient />}
    </PackLoadState>
  );
}
