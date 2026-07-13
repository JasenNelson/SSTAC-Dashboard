# DRA Coordinate Extraction & Publish Prep Packet (2026-07-13)

## 1. PUBLICATION: IOCO Shoreline (OWNER-GATED)
**Current Baseline**: 3 public / 571 private DRAs
**Candidate**: IOCO Shoreline (dra_id ea15e94a-b093-4cb4-bd4d-80ab9eae16d4)
**Status**: Coordinate-safe (all 6 samples surveyed/high-tier, 72 measurements). Source is a Draft ERA.

Publication is OWNER-GATED and requires an admin JWT against production. It is not auto-applied. 
The literal matrix_map.flip_dra_public call must pass an exact-operation /codex-review (GREEN) before execution.

**Action Required**: The owner must supply the following exact approval sentence:
> "I approve publishing DRA ea15e94a (IOCO Shoreline ERA, Golder 2017, all 6 samples surveyed/high-tier, 72 measurements) to the public map via flip_dra_public, accepting that the source is a DRAFT ERA; verify member-visible sample count increases by 6 afterward."

## 2. COORDINATE EXTRACTION (OWNER-GATED WRITE)
The following four high-volume DRAs are currently centroid-only and require coordinate extraction before publication. Their source documents have been located and verified present:

1. **Howe Sound** (dra_id: 052c6a9d)
   - **Station Count**: 198 stations (~6946 measurements)
   - **Source PDF**: G:\My Drive\Site_Remediation_Data\PDF_Archive\9930\Roster\Reports and supporting documents\Item 1h 11644 141110 FINAL HHERA Sediment.pdf
2. **r-0074** (dra_id: 90d54294)
   - **Station Count**: 24 stations (~1780 measurements)
   - **Source PDF**: G:\My Drive\Site_Remediation_Data\PDF_Archive\19661\2024 CoC DRisk App 15112\Supporting docs\r-0074-40-01-HHERA-FINAL-v2.pdf
3. **Lot C** (dra_id: 578bab5d)
   - **Station Count**: 114 stations (~898 measurements)
   - **Source PDF**: G:\My Drive\Site_Remediation_Data\PDF_Archive\0141 Nexen\2024 CoC-DRisk App 14849\2024-08-02 Addendum\Lot C_Addendum to DSI and HHERA_Flow Through_20240801.pdf
4. **Site 14764** (dra_id: e6c0df6d)
   - **Station Count**: 49 stations (~780 measurements)
   - **Source PDF**: G:\My Drive\Site_Remediation_Data\PDF_Archive\14764\2013-07-01 Site 14764 Supp Site Inv CoR and HHERA by Keystone.pdf

**Extraction Approach & Harness Spec**:
- **Role**: AGY will draft an OCR/table-extraction harness utilizing Docling/OCR.
- **Runner**: The orchestrator will RUN the drafted harness (as it is a long-running job and must be checkpoint-bound).
- **Inputs**: The 4 absolute PDF paths above, plus the target DRA's station list.
- **Outputs**: A mapping of parsed station table -> station_id -> lat/lon keyed exactly on stations.station_id.
- **Acceptance**: The harness correctly matches station IDs to extracted coordinates. Any coordinate write back to Supabase (coordinate_quality_tier / geometry) remains firmly OWNER-GATED and CODEX-GATED with rigorous pre/postflight checks.

## 3. EXPANSION POLICY
To inform the owner's publish-tier decision:
- **Publication-Ready As-Is (Coordinate-Safe)**: DRAs where all reported samples are already high-tier / surveyed. Currently, only **IOCO Shoreline** (dra_id ea15e94a) meets this bar for the immediate expansion candidates and can be published straight away.
- **Needs Extraction First**: High-volume, centroid-only DRAs (e.g., Howe Sound, r-0074, Lot C, Site 14764). These are NOT publication-ready as-is, because their BC CSR approximate site centroids lack the spatial precision required for the public map (and could mislead users). They must successfully pass the extraction harness and coordinate update steps before they can be evaluated for publication.
