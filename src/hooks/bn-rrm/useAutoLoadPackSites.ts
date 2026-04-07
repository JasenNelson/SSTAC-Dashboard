/**
 * useAutoLoadPackSites
 *
 * Auto-loads a pack's reference sites (from the `site_reports` artifact) into
 * the siteDataStore whenever the selected pack changes. Replaces the manual
 * "Import Training Sites" click for packs whose site_reports contain valid
 * station coordinates.
 *
 * Behavior contract (Agent D, Jermilova map overlays handoff):
 * 1. On selectedPackId change, increment a generation counter and synchronously
 *    clear prior 'training' and 'comparison' sites from the store. The store's
 *    clearSitesByTag is tag-scoped, so user-uploaded sites (sourceTag 'user')
 *    are preserved automatically.
 * 2. Asynchronously load the `site_reports` artifact via the pack store.
 * 3. If the artifact is null OR contains no station with valid lat/lon, log a
 *    debug message and skip the adapter. The Jermilova benchmark pack falls
 *    into this branch and relies on the new GeoJSON map overlays instead.
 * 4. Otherwise call adaptTrainingSites and addSites, but only if the captured
 *    generation still matches the current generation (race-safe against fast
 *    pack switches, mirrors networkStore.loadPackModel pattern).
 *
 * The hook takes no arguments and is intended to be called once from
 * BNRRMClient.tsx.
 */

'use client';

import { useEffect, useRef } from 'react';
import { usePackStore } from '@/stores/bn-rrm/packStore';
import { useSiteDataStore } from '@/stores/bn-rrm/siteDataStore';
import { adaptTrainingSites } from '@/lib/bn-rrm/transparency-adapters';
import type { SiteReportsJSON } from '@/lib/bn-rrm/transparency-adapters';

function hasAnyValidStationCoordinates(reports: SiteReportsJSON | null): boolean {
  if (!reports || !Array.isArray(reports.sites) || reports.sites.length === 0) {
    return false;
  }
  for (const site of reports.sites) {
    if (!Array.isArray(site.station_details)) continue;
    for (const stn of site.station_details) {
      if (stn && stn.latitude != null && stn.longitude != null) {
        return true;
      }
    }
  }
  return false;
}

export function useAutoLoadPackSites(): void {
  const selectedPackId = usePackStore((s) => s.selectedPackId);
  const packManifestId = usePackStore((s) => s.packManifest?.pack_id ?? null);
  const loadReviewArtifact = usePackStore((s) => s.loadReviewArtifact);

  const clearSitesByTag = useSiteDataStore((s) => s.clearSitesByTag);
  const addSites = useSiteDataStore((s) => s.addSites);

  // Race-safety generation counter. Mirrors networkStore.loadPackModel pattern:
  // each pack switch increments the counter, and the async loader only commits
  // results if the captured generation still matches at await-resume time.
  const generationRef = useRef<number>(0);

  // Manifest-lag guard: packManifest.pack_id may temporarily lag selectedPackId
  // during a pack switch. Wait until they agree before triggering a load, the
  // same way usePackArtifact does.
  const manifestReady = selectedPackId != null && packManifestId === selectedPackId;

  useEffect(() => {
    if (!selectedPackId) {
      return;
    }

    // Step 1: bump generation and clear prior reference sites synchronously.
    // clearSitesByTag is tag-scoped, so 'user' sites are preserved.
    generationRef.current += 1;
    const myGeneration = generationRef.current;
    clearSitesByTag('training');
    clearSitesByTag('comparison');

    if (!manifestReady) {
      // Manifest has not caught up to selectedPackId yet. The next render with
      // a matching manifest will re-run this effect. The generation bump above
      // protects any in-flight load from a previous pack from clobbering us.
      return;
    }

    // Step 2: async load.
    let cancelled = false;
    (async () => {
      const siteReports = await loadReviewArtifact<SiteReportsJSON>('site_reports');

      // Race guard: if another pack switch has happened, abandon results.
      if (cancelled || generationRef.current !== myGeneration) {
        return;
      }

      // Step 3: skip silently when no valid coordinates (Jermilova case).
      if (!hasAnyValidStationCoordinates(siteReports)) {
        console.debug('[useAutoLoadPackSites] no valid coordinates, skipping adapter');
        return;
      }

      // Step 4: adapt and commit, gated by the generation check above.
      const result = adaptTrainingSites(siteReports as SiteReportsJSON);
      if (cancelled || generationRef.current !== myGeneration) {
        return;
      }
      addSites(result.sites);
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedPackId, manifestReady, loadReviewArtifact, clearSitesByTag, addSites]);
}
