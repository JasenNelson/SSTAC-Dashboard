# MATRIX_OPTIONS_PCB_REKEY_DRYRUN_PLAN_2026_07_14

## The 3 alias rows (deprecated substance_key `polychlorinated_biphenyls_total_pcbs`)
| # | file | parameter_value_id | pathway / input_key | value | default_status | qa_status | source |
|---|------|--------------------|---------------------|-------|----------------|-----------|--------|
| 1 | matrix_research/reference_catalog/human_health_trv_values.json (lines ~14084-14146) | pv-p28-polychlorinated_biphenyls_total_pcbs-hh-direct-rfd | human-health-direct / rfd_oral_mg_per_kg_bw_day | 0.00013 mg/kg-bw/day | available_option | needs_review | BC Protocol 28 (Jan 2021) App 8A |
| 2 | human_health_trv_values.json (lines ~14147-14210) | pv-p28-polychlorinated_biphenyls_total_pcbs-hh-food-rfd | human-health-food / rfd_oral_mg_per_kg_bw_day | 0.00013 mg/kg-bw/day | available_option | needs_review | BC Protocol 28 (Jan 2021) App 8A |
| 3 | matrix_research/reference_catalog/eco_values.json (lines ~3082-3151) | pv-eco-polychlorinated_biphenyls_total_pcbs-direct-fcv-nrwqc | eco-direct-eqp / fcv_ug_per_L | 0.014 ug/L | available_option | approved | US EPA NRWQC Aquatic Life (chronic CCC) |

## The canonical target rows (`total_pcbs_aroclor_1254`)
- pv-pcb-fcv (parameter_values.json ~125-166): eco-direct-eqp / fcv_ug_per_L = 0.014 ug/L, default_status=current_default, approved_source_backed, same US EPA NRWQC source as alias row #3. => alias row #3's FCV is a DUPLICATE of this current_default, not a supplement.
- pv-iris-pcb-hh-direct-rfd-aroclor1254 (human_health_trv_values.json ~2055-2118) and the food twin (~2120-2185): rfd_oral_mg_per_kg_bw_day = 0.00002 mg/kg-bw/day, US EPA IRIS Aroclor 1254, default_status=available_option, qa_status=approved. This 2.0e-5 is the library-seeded used value.
- pv-pcb-hh-direct-rfd (parameter_values.json ~1208-1217): human-health-direct / rfd_oral_mg_per_kg_bw_day = 0.00002, default_status=CURRENT_DEFAULT (current_calculator_scaffold). IMPORTANT (codex P2 2026-07-14): this scaffold current_default -- NOT the IRIS available_option -- is what actually RESOLVES for the canonical direct-RfD tuple, because resolveTupleRecord prefers a single current_default before the approved fallback.
- pv-p28-pcb-hh-food-rfd (parameter_values.json ~3925-3984): human-health-food / rfd_oral_mg_per_kg_bw_day = 0.00013, BC Protocol 28, available_option / needs_review. This ALREADY EXISTS on the canonical side. NOTE: NO direct-pathway BC 0.00013 counterpart exists under canonical yet.
- pv-pcb-logkow (parameter_values.json ~84-124): logKow = 6.5, current_default.

## Proposed (non-applied) edits
| row # | parameter_value_id | proposed edit |
|---|---|---|
| 1 | pv-p28-polychlorinated_biphenyls_total_pcbs-hh-direct-rfd | `substance_key`: `polychlorinated_biphenyls_total_pcbs` -> `total_pcbs_aroclor_1254` |
| 2 | pv-p28-polychlorinated_biphenyls_total_pcbs-hh-food-rfd | `substance_key`: `polychlorinated_biphenyls_total_pcbs` -> `total_pcbs_aroclor_1254` |
| 3 | pv-eco-polychlorinated_biphenyls_total_pcbs-direct-fcv-nrwqc | `substance_key`: `polychlorinated_biphenyls_total_pcbs` -> `total_pcbs_aroclor_1254` |

## Decision-relevant findings the migration author MUST resolve first (do not resolve here)
1. RfD-FOOD DUPLICATE: re-keying alias row #2 (BC 0.00013 food) collides with the pre-existing canonical pv-p28-pcb-hh-food-rfd (same value 0.00013, same BC P28 source). => author must decide MERGE (drop one) vs COEXIST (keep both). Flag explicitly.
2. FCV DUPLICATE: re-keying alias row #3 (0.014 FCV) duplicates the canonical current_default pv-pcb-fcv (same value, same source). Resolver tie-break still picks the canonical current_default (no double-supply), but the alias row becomes redundant. Recommend NOT re-keying row #3 (drop/retire it instead), or re-key + demote.
3. RfD-DIRECT (corrected per codex P2 2026-07-14): the canonical direct-RfD tuple is ALREADY anchored by a current_default scaffold pv-pcb-hh-direct-rfd (2.0e-5); resolveTupleRecord picks that single current_default, so neither the IRIS available_option NOR the re-keyed alias wins. The re-keyed alias row #1 (0.00013) is a non-matching value and is filtered before tie-break. NET: re-keying the direct alias has NO effect on direct-RfD resolution. Low risk. (Earlier draft mistakenly said "IRIS resolves uniquely" -- IRIS does not win; the scaffold current_default does.)

## Owner-gated blocker (state clearly, do NOT resolve)
The actual re-key requires a site-specific congener-profile protectiveness QP judgment (shared 0.014 ug/L FCV + logKow 6.5 -> less-stringent sediment benchmark via EqP) + confirmation of no double-count vs the canonical IRIS RfD 2.0e-5. AI lacks site data. The re-key stays a NON-APPLIED PLAN until separate owner approval. Cross-ref: this supersedes nothing; it extends the #643 PCB value-migration evidence packet.
