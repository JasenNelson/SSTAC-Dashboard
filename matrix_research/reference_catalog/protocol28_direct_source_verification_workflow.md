# Protocol 28 Direct Source Verification Workflow

## Purpose

Use this workflow whenever a Matrix Options session verifies a Protocol 28
Appendix 8A or Appendix 8B value against current original or authoritative
source surfaces.

Protocol 28 is a BC policy compilation and source-mining workbench. It is not,
by itself, enough to approve a calculator value or change a calculation-driving
default. A completed substance packet records the comparison and preserves the
review boundary.

## Non-Authorizing Boundary

Every Protocol 28 verification packet must state that it does not:

- Copy source PDFs, spreadsheets, attachments, snapshots, or full text into
  `C:\Projects`.
- Change calculator defaults.
- Change JSON catalog values unless that mutation is the separately approved
  implementation slice.
- Mark a value as QA-approved.
- Mark a Protocol 28 value as source-backed solely because Protocol 28 lists it.
- Resolve BC policy intent when current sources differ from crystallized
  Protocol 28 values.

## Standard Inputs

For each substance or row, inspect:

1. The Protocol 28 source-lead record:
   - `matrix_research/reference_catalog/source_leads/bc_protocol28_trv_reference_leads_2026_05_23.json`
2. The candidate value records:
   - `matrix_research/reference_catalog/parameter_values.json`
3. Existing direct-source alternatives:
   - `matrix_research/reference_catalog/human_health_trv_values.json`
   - `matrix_research/reference_catalog/sources.json`
4. Relevant catalog tests:
   - `src/lib/matrix-options/provenance/__tests__/catalog.test.ts`
   - `src/lib/matrix-options/provenance/__tests__/library.test.ts`
5. Official source surfaces:
   - BC Protocol 28 PDF and current BC protocol index, when relevant.
   - The original/current source named by Protocol 28 or by its hierarchy.
   - Current Health Canada, US EPA IRIS, WHO/IPCS, CCME, Eco-SSL, or other
     authoritative surfaces, as applicable to the row.

Use Zotero only for metadata and locator support. Do not treat Zotero presence
as proof that a value is current or controlling.

## Required Packet Content

Each packet should include:

1. Scope:
   - substance;
   - Protocol 28 lead ID;
   - candidate value IDs;
   - pathway/input relevance.
2. Non-authorizing status:
   - no default change;
   - no QA approval;
   - no source-file storage;
   - no catalog mutation unless separately approved.
3. Source basis:
   - Protocol 28 locator and value text;
   - source hierarchy or cited-source basis;
   - crystallization date when relevant.
4. Current direct-source findings:
   - official source URL or locator;
   - current value;
   - currentness date, version, page date, or last-updated marker;
   - endpoint/unit mapping;
   - relationship to the Protocol 28 value.
5. Disposition:
   - result code;
   - whether values match, differ, are ambiguous, or are not found;
   - required catalog posture after the check.
6. Stop conditions:
   - unresolved source selection;
   - ambiguous endpoint or unit mapping;
   - missing exact locator;
   - unresolved BC policy intent;
   - missing QA or owner/delegated approval.

## Result Codes

Use one of these result codes, adding a short note when needed:

- `DIRECT_SOURCE_MATCH_NO_PROMOTION`: current direct source matches Protocol 28,
  but approval/default promotion is still separate.
- `DISCREPANCY_RECORDED_NO_PROMOTION`: current source differs from Protocol 28
  or does not cleanly verify it.
- `SOURCE_NOT_FOUND_NO_PROMOTION`: the original/current source could not be
  identified or reached.
- `AMBIGUOUS_MAPPING_NO_PROMOTION`: endpoint, receptor, pathway, mixture, unit,
  or notation mapping is unclear.
- `PATHWAY_REVIEW_REQUIRED_NO_PROMOTION`: a source value may be valid for a
  different receptor/pathway but is not directly mapped to the Matrix Options
  input.

All result codes are non-authorizing unless a later owner-approved catalog
promotion slice records QA and default-selection decisions.

## Mandatory Follow-Up

After each packet, do the follow-up as part of the same process unless a stop
condition blocks it:

1. Add or update a metadata-only `direct_source_review` field on the matching
   Protocol 28 source-lead record.
2. Include:
   - result code;
   - packet path;
   - reviewed date;
   - compared source IDs or source URLs;
   - value IDs covered;
   - required catalog posture.
3. Add or update catalog tests proving the Protocol 28 value remains blocked
   from calculator defaults unless explicit promotion criteria are met.
4. Keep direct-source alternatives as read-only values until owner-approved
   default-selection rules choose a calculation-driving value for a selected
   regulatory frame.

Do not treat these follow-ups as optional housekeeping. They are part of the
verification workflow because they make the research result discoverable in
future sessions and keep UI review state consistent with the packet.

## Arsenic Precedent

Use the arsenic packet as the first worked example:

- `matrix_research/reference_catalog/protocol28_arsenic_direct_source_verification_packet_2026_05_25.md`

That packet records `DISCREPANCY_RECORDED_NO_PROMOTION` because current US EPA
IRIS and Health Canada surfaces do not cleanly support promoting the Protocol
28 Appendix 8A arsenic RfD/SFO values. Future substances may need different
source surfaces or pathway-specific review, but should preserve the same depth
of locator, currentness, endpoint, unit, status, and stop-condition diligence.
