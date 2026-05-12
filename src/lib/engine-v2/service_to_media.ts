// engine_v2 frontend Lane 1 / Module L1-4: service -> media type mapping.
//
// Standalone literal copy of v1's SERVICE_TO_MEDIA at
// src/lib/regulatory-review/launch-evaluation.ts:19-42 (per plan v7.19, L1-4
// spec). v2 deliberately owns its own copy rather than re-exporting from v1 so
// the two product lanes can evolve their service-to-media mappings
// independently without cross-coupling.

export const SERVICE_TO_MEDIA: Record<string, readonly string[]> = {
  "psi-review": ["soil", "groundwater"],
  "dsi-review": ["soil", "groundwater"],
  "supplemental-investigation": ["soil", "groundwater"],
  "remediation-plan": ["soil", "groundwater"],
  "remediation-plan-risk": ["soil", "groundwater"],
  "hhra-review": ["soil", "groundwater", "vapour"],
  "era-review": ["soil", "sediment", "surface_water", "groundwater"],
  "via-review": ["vapour"],
  "cor-review": ["soil", "groundwater"],
  "aip-application": ["soil", "groundwater"],
  "coc-application": ["soil", "groundwater"],
  "ap-coc": ["soil", "groundwater"],
  "site-determination-s44": ["soil", "groundwater"],
  "independent-remediation-s49": ["soil", "groundwater"],
  "ap-s44-determination": ["soil", "groundwater"],
  "determination": ["soil", "groundwater"],
  "vra": ["soil", "groundwater"],
  "csra": ["soil"],
  "ira": ["soil", "groundwater"],
  "background-concentration": ["soil", "groundwater"],
  "site-specific-standards": ["soil", "groundwater"],
  "wide-area-designation": ["soil"],
};

// Derive the deduplicated, sorted set of media types implied by a list of
// service ids. Unknown service ids are silently skipped (no throw) so the
// wizard can render incrementally without forcing the caller to pre-filter.
export function deriveMediaTypesFromServices(
  selectedServiceIds: readonly string[],
): string[] {
  const mediaSet = new Set<string>();
  for (const rawId of selectedServiceIds) {
    if (typeof rawId !== "string") continue;
    const id = rawId.trim();
    if (!id) continue;
    const media = SERVICE_TO_MEDIA[id];
    if (!media) continue;
    for (const m of media) mediaSet.add(m);
  }
  return [...mediaSet].sort();
}
