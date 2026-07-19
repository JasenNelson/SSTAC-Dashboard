# SVI inhalation params -- 4 needs_review rows EXTRACTED from HC PQRA v4.0 (2026-07-18)

Source (owner-verified catalog source): `src-health-canada-pqra-v4-2024`
Primary doc read this session (vision-first): `References/Guidance/HHRA/Health Canada/HC 2024 - PQRA V 4.pdf`
(Federal Contaminated Site Risk Assessment in Canada: Guidance on Human Health PQRA, Version 4.0,
Health Canada, March 2024, Cat. H129-114/2023E-PDF). Pathway `human-health-inhalation` (PR #678).

DRAFT / needs_review ONLY -- NO catalog apply, NO current_default. Values transcribed verbatim from the
PDF with exact locators; owner reviews before any apply.

| # | input_key | value | unit | locator (HC PQRA v4.0) | verbatim source_text |
|---|---|---|---|---|---|
| 1 | hc_pqra_inhalation_rate_adult | 16.6 | m3/day | Appendix E, p.69, "Recommended Receptor Characteristics for HHRAs -- Canadian General Population", row Inhalation rate, column Adult (>=20 yrs) | "Inhalation rate (m3/day) ... Adult 16.6" (source: Allan et al. 2008) |
| 2 | hc_pqra_inhalation_rate_child_or_toddler | 8.3 | m3/day | Appendix E, p.69, same table, column Toddler (6 mo to <5 yrs) | "Inhalation rate (m3/day) ... Toddler 8.3" (source: Allan et al. 2008) |
| 3 | hc_pqra_target_hazard_quotient | 0.2 | unitless | Section 2.7.1 / Box 3, p.35 | "exposures arising from the site (excluding background exposures) associated with an HQ <= 0.2 will be deemed negligible. This is consistent with CCME (2006). For some substances, such as PHCs, a target other than 0.2 may be used (CCME, 2008a), with rationale." (combined-exposure: HQ <= 0.2, or <= 1.0 when background included -- s2.7.3 p.37) |
| 4 | hc_pqra_target_cancer_risk | 1e-5 | unitless (ILCR) | Section 2.7.2-2.7.3, p.37 (rationale App C, p.56) | "Cancer risks will be deemed to be 'essentially negligible' (de minimis) at federal contaminated sites when the estimated ILCR is <= 1 in 100 000 (<= 1 x 10^-5)." (note: "P/T guidance should be consulted where a target of 1 in 1 000 000 (1 x 10^-6) may apply") |

## Full receptor inhalation-rate table (App E, p.69) -- context for reviewers
Infant (0-<6mo) 2.2 | Toddler (6mo-<5yr) 8.3 | Child (5-<12yr) 14.5 | Teen (12-<20yr) 15.6 | Adult (>=20yr) 16.6 | Construction/Utility Worker 1.4 m3/hr. Source: Allan et al. (2008, 2009).
Body weights (same table, MATCH the 22 existing catalog rows -- confirms source+version): infant 8.2, toddler 16.5, child 32.9, teen 59.7, adult 70.7 kg.

## catalog-row JSON (per row; owner applies later, gated)
```
{
  "parameter_value_id": "pv-hc-pqra-v4-2024-inhalation-rate-adult",   // etc per slot
  "substance_key": null, "pathway": "human-health-inhalation",
  "input_key": "hc_pqra_inhalation_rate_adult", "value": 16.6, "unit": "m3/day", "value_type": "point",
  "default_status": "not_default", "evidence_support_status": "needs_review",
  "extraction_status": "extracted", "qa_status": "needs_review",
  "source_ids": ["src-health-canada-pqra-v4-2024"], "jurisdiction": "federal-canada",
  "evidence_items": [{ "source_id": "src-health-canada-pqra-v4-2024",
     "locator": "Appendix E, p.69, Recommended Receptor Characteristics, Adult column",
     "value_text": "Inhalation rate 16.6 m3/day (Allan et al. 2008)",
     "extraction_method": "vision_first_read_pages", "extracted_by": "claude-opus" }]
}
```

## Provenance note (resolves the earlier confusion)
The HC PQRA is NOT a standalone file that existed in `References/` earlier -- it arrived 2026-07-18 in
`References/Guidance/HHRA/Health Canada/`. The 22 exposure-factor rows already in the catalog
(body weights, exposure duration, skin areas) were extracted by a prior session (claude-fable-5) from
this same v4.0 doc; these 4 inhalation/target rows complete the receptor-characteristics set that
session did not capture. All 4 verified against the primary PDF this session.
