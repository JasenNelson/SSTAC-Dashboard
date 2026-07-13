# D1 dioxin-TEQ promotion -- exact apply plan (owner-gated; PREP ONLY, 2026-07-13)

Everything needed to execute D1 in one step after the owner attests. NOTHING here has been applied.
The catalog write and the coupled tripwire edit MUST land in the SAME commit, AFTER owner attestation.

## What D1 does
Promotes ONE human-health TRV row from `needs_review` to `approved`:
- id: `pv-hc-dioxin-like-teq-hh-direct-oral-tdi`
- value: 2.3e-9 mg TEQ/kg-bw/day (dioxin-like TEQ oral TDI, provisional)
- source: `src-health-canada-trv-v4-2025`

## Verification status (done this session)
VALUE INDEPENDENTLY CONFIRMED against the primary PDF (re-extracted, not the catalog claim):
HC TRV v4.0 (2025), PDF page 42, PCDDs/PCDFs row, "Oral TDI (provisional) 2.3E-09 mg TEQ/kgBW-day"
(study basis Faqi and Chahoud 1998; TEQ via DeVito et al. 2024 TEFs). File:
`G:\My Drive\SABCS - Sediment Project\References\HC 2025 - Toxicological Reference Values TRV.pdf`.
Dry-run (`node scripts/matrix-options/promote-hc-dioxin-teq.mjs --reviewer "J. Nelson" --date <d>`)
= 1 row PROMOTE, source row already in target state (no-op). Working tree stayed clean.

## OWNER GATE
Per the promote script's rule 1 + the AI-never-do list, the owner attests the value matches the
primary source. Running `--apply` IS that attestation. Do not execute without the owner's explicit
approval of THIS exact operation.

## Step 1 -- the apply command (run only on owner attestation)
```
cd <worktree off origin/main>
node scripts/matrix-options/promote-hc-dioxin-teq.mjs --reviewer "J. Nelson" --date 2026-07-13 --apply
```
This edits `matrix_research/reference_catalog/human_health_trv_values.json` (flips the one row's
qa_status to approved + stamps evidence reviewed_by/reviewed_at).

## Step 2 -- the COUPLED tripwire edit (SAME commit) -- TWO changes, not one
File: `src/lib/matrix-options/provenance/__tests__/catalog.test.ts`

The mass-promotion tripwire (the first `it` in the human_health_trv block) does BOTH a set-equality
check and a per-row source check. The dioxin row needs BOTH or the suite fails:

**2a. Set-equality (line ~684-704):** add the id to `sanctionedPromotionIds`, mirroring the
chlorobenzene precedent (explicit id + comment), because promote-hc-dioxin-teq.mjs is a SEPARATE tool
whose id is not in any of the spread `*_PROMOTION_VALUE_IDS` arrays:
```
      // 2026-07-13: HC TRV v4.0 (2025) dioxin-like TEQ oral TDI, promoted via the dedicated
      // promote-hc-dioxin-teq.mjs tool (not the bulk promote-hc-trv-v4-2025.mjs). Value 2.3e-9
      // mg TEQ/kg-bw/day CONFIRMED at HC v4.0 (2025) PDF p.42. See
      // docs/MATRIX_OPTIONS_D1_DIOXIN_APPLY_PLAN_2026_07_13.md.
      'pv-hc-dioxin-like-teq-hh-direct-oral-tdi',
```

**2b. Per-row SOURCE check (line ~736) -- the easy-to-miss part.** The source-check branch is:
```
} else if (hcTrvPromotionIds.has(id) || chlorobenzeneCorrectionIds.has(id)) {
  expect(record.source_ids).toEqual(['src-health-canada-trv-v4-2025']);
} else {
  expect(record.source_ids.join(' ')).toMatch(/iris/i);   // <-- dioxin would WRONGLY fall here and FAIL
}
```
The dioxin id is NOT in `hcTrvPromotionIds` (bulk tool) nor `chlorobenzeneCorrectionIds`, so without a
fix it hits the `else` branch and fails (its source is HC, not IRIS). Mirror the chlorobenzene pattern:
add a dedicated set and include it in the HC-source branch:
```
    const dioxinTeqCorrectionIds = new Set(['pv-hc-dioxin-like-teq-hh-direct-oral-tdi']);
    // ...
    } else if (
      hcTrvPromotionIds.has(record.parameter_value_id) ||
      chlorobenzeneCorrectionIds.has(record.parameter_value_id) ||
      dioxinTeqCorrectionIds.has(record.parameter_value_id)
    ) {
      expect(record.source_ids).toEqual(['src-health-canada-trv-v4-2025']);
    }
```
(The row must also satisfy the other per-row asserts: default_status in {available_option,
current_default}; source_authority_tier tier_1; canonical_source_status in {direct_source_verified,
needs_direct_source_check}; each evidence item approved with reviewed_by/reviewed_at set and no
C:\ / Downloads / Chemicals_Details.xlsx path in notes. The promote script stamps reviewed_by/at from
--reviewer/--date; confirm canonical_source_status is one of the two allowed values post-apply.)

## Step 3 -- gates + ship
- `npx vitest run src/lib/matrix-options/provenance/__tests__/catalog.test.ts` -> the set-equality +
  source-check pass with the dioxin row promoted.
- Full push gate (lint -> test:ci -> monitored build -> e2e) on the final tip.
- FULL codex pipeline (this is a production catalog write): Leg 1 Opus subagent loop -> Leg 2 codex
  (Spark grind -> gpt-5.5 xhigh) to mutual-agreement GREEN on the exact diff. codex on Windows
  test-heavy diffs = static review; supply the vitest transcript.
- Path-scoped commit (the catalog json + catalog.test.ts only) -> PR. Owner merges.

## Rollback
`git revert` the single commit (catalog row flip + tripwire edit); it is self-contained. No Supabase
or production-DB write is involved (the catalog is an in-repo JSON).
