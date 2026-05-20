# v1 Seed Station Candidate List (R-3)

**Status:** AI-proposed candidate list per R-3. Owner reviews + edits
before PR-MAP-0 geocoding work begins.

**Source:** Query of `bnrrm_training.db` (16.2 MB, located at
`C:\Projects\Regulatory-Review\2026_Database_Development\data_acquisition\bnrrm_extraction\bnrrm_training.db`).

**Filter criteria applied:**
1. All 40 already-geocoded stations (mandatory)
2. Top sites by sediment_chemistry row count
3. Region coverage spread across BC
4. Mix of reference + impacted + unknown classifications for UI testing

---

## Tier A: Fully-geocoded sites (ship as-is; no geocoding work needed)

| Site | Region | Waterbody | n_stn | geocoded | ref | imp | chem rows |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 6 -- Toquaht Bay site | Vancouver Island | Toquaht Bay | 20 | 20 | 0 | 20 | 140 |
| 2 -- Kootenay Lake site | Kootenay | Kootenay Lake | 8 | 8 | 2 | 6 | 56 |
| 5 -- Burrard Inlet site | Lower Mainland | Burrard Inlet | 6 | 6 | 0 | 6 | 48 |
| 8 -- Brunette River site | Metro Vancouver | Brunette River | 6 | 6 | 2 | 4 | 48 |

Total: 40 geocoded stations across 4 fully-mapped sites. Covers 4 BC
regions. Provides 4 reference + 36 impacted classifications.

## Tier B: B-4 site-registry centroid candidates (PR-MAP-0 geocoding work)

High-value sites with substantial data but ZERO geocoded stations.
Pull lat/lon from BC Public Site Registry centroid for each.

| Site | Region | Waterbody | n_stn | ref | imp | chem rows | Priority |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 -- Howe Sound site | Sea-to-Sky | Howe Sound | 198 | 8 | 14 | **7233** | HIGHEST (largest dataset by 10x) |
| 4 -- Burrard Inlet (second) | Lower Mainland | Burrard Inlet | 24 | 1 | 23 | 110 | High |
| 3 -- Rupert Inlet site | Vancouver Island | Rupert Inlet | 15 | 1 | 14 | 105 | High |
| 9 -- Pinchi Lake site | Central BC | Pinchi Lake | 8 | 1 | 7 | 63 | High |
| 7 -- Kitimat Arm site | North Coast | Kitimat Arm | 5 | 0 | 5 | 44 | Medium |

Pulling centroids for these 5 sites adds ~250 mappable stations and
spreads coverage to 7 BC regions (vs 4 in Tier A alone). Adds 11
reference + 63 explicitly impacted classifications.

## Tier C: B-3 manual fill candidates (optional; owner-nominated)

Sites with substantial chem data but missing region/waterbody metadata
(site_id 20, 29, 24, plus 11, 12, 13, 16, 18, 40, 41, 42, 45). Site
metadata extraction may have failed for these; manual research +
geocoding would lift them but takes more steward time.

**My recommendation: defer Tier C to v1.x scale-up unless owner
identifies a high-priority site in this group.**

## v1 seed total (Tier A + Tier B)

| Metric | Count |
| --- | --- |
| Sites | 9 |
| Stations (mappable) | ~290 (40 surveyed + ~250 centroid) |
| Reference stations | 15 |
| Impacted stations | 99 |
| Unknown stations (sampling + null) | ~176 |
| Chemistry rows | ~7740 (out of 9594 total = 81% of available data) |
| BC regions covered | 7 (Sea-to-Sky, Vancouver Island, Kootenay, Lower Mainland, Metro Vancouver, Central BC, North Coast) |

This seed gives matrix-map v1:
- ALL 15 reference stations and ALL 99 impacted stations from the
  bnrrm_training extraction (the full defensibly-classified set)
- The full Howe Sound site (biggest single dataset; Britannia Mine
  legacy contamination -- regulatory exemplar)
- Three Vancouver Island contaminated marine sites for marine/estuarine
  validation
- Three Lower Mainland / Metro Vancouver sites for urban-industrial
  validation
- A Kootenay freshwater lake site
- A North Coast remote-marine site
- A Central BC freshwater site (Pinchi Lake -- historic Hg mine)

Plenty of geographic + media variety to validate the full UX + Calculator
bridge with real data. Province-wide scale-up is v1.x.

## Owner action

Review this list. Edit by:
- Removing any site you DON'T want in v1 (e.g., confidentiality concerns)
- Adding sites from Tier C if you want them in v1
- Adjusting Tier B priority order
- Confirming the Howe Sound + Burrard Inlet sites are public-record-OK
  (or marking them `public=false` per R-10 cascade policy)

Reply with edits or "approved as-is" and PR-MAP-0 geocoding work begins.
