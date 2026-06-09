# Reference-library inventory + HH-food consumption-rate sourcing -- 2026-06-09

Plain ASCII. Produced by 3 inventory subagents over the priority Google Drive (G:)
reference folders, plus targeted Zotero + PDF lookups for the HH-food fish/tissue
consumption rate (`IR_food_kg_per_day`). Full per-file manifests live alongside this
summary in `library_inventory_2026_06_09/` (references.md, twg-preliminary-research.md,
white-paper-scoping.md, raw_file_list.json).

## 1. Inventory summary (priority folders; 786 files)

| Folder | Files | Nature | Catalogable refs |
|---|---|---|---|
| References | 560 (539 pdf; + IRIS/ 146, EcoSSL/ 22 subfolders) | the reference library | ~262 canonical regulatory sources flagged |
| TWG - Preliminary Research | 140 | mostly project drafts + 22 journal articles | few (refs cited not filed); 20 macOS `._` stub PDFs (junk), 89 `.gdoc` stubs |
| White Paper & Scoping | 86 | project-produced drafts (white-paper version series) | ~0 third-party refs (71 `.gdoc` pointer stubs) |

Canonical-source highlights (References): HC DQRAchem (Part V) + HC 2017 sediment-HHRA
supplements (H144-41 Direct Contact, H144-46 Oral Bioavailability) + HC Site-Char
Manuals V1-3; US EPA RAGS A 1989 + ESB sediment-benchmark suite; **IRIS/ 146 substance
toxicity files; EcoSSL/ 22**; CCME sediment/soil derivation protocols; NOAA SQuiRTs;
FCSAP DMF + TRV/Toxicity modules; Atlantic RBCA suite; Ontario sediment; Disposal-at-Sea.

Duplicate clusters: ~9 byte-identical pairs in References (e.g. DiToro-2013 sedQC,
EPA tm96r2, NOAA ECO_BENCH, Ontario 93) + Win 8.3 short-name aliases; Kaikkonen-2021 dup
+ a CARE-package `.zip` whose 19 PDFs are already extracted (TWG); white-paper version
families (White Paper).

Workflow caveats (for the Drive-wide sweep): `.gdoc`/`.gsheet`/`.gform` are pointer
stubs unreadable from the filesystem -- route through the Google Drive API/MCP, not file
reads. macOS `._` resource-fork files are junk -- filter by name/size (often <4 KB).

## 2. HH-food fish/tissue consumption rate -- the 3-frame gradient (for the variant)

ALL values below are currently SECONDARY citations or dated; each needs owner
verification against the cited PRIMARY before catalog entry (per the validate-against-
authoritative-source rule). Do NOT compute or recall -- read the primary.

| Frame | Rate (kg/day) | Population | PRIMARY source | Where the primary is |
|---|---|---|---|---|
| US EPA (general) | 0.0065 | per-capita general pop | US EPA RAGS A 1989, Exhibit 6-17, p.6-45 | In References (`US EPA RAGS A (1989).pdf`) -- extracted/verbatim |
| Health Canada (DQRA) -- THE MEANTIME DEFAULT | ~0.100 (also "150 g/portion", bw 60 kg) | Indigenous subsistence adult | HC Part V DQRAchem (and HC 2007 Hg RA) | In References (`DQRA HC final draft Feb 2009.pdf`), rate at **Sec 4.5.1 Receptor Characterization, doc-p.39 (~PDF p.48)**; exact value to be confirmed at catalog/variant build (cheap targeted read) |
| Community-specific (ALTERNATIVE catalog option, NOT a general default) | 0.388 | ONE Alberta First Nation (Athabasca Chipewyan); deliberately CONSERVATIVE, protective of that specific community -- NOT representative of the general public | WQCIU report (Olsgard et al. 2023) | IN local files (owner: multiple copies; inventory will surface them). Cited 3x in `Modernizing BC Sediment Quality Standards v2.5.pdf` pp.18,27,34; tracked lead `wqciu_reference_leads_2026_05_23.json` |

DIRECTION (owner 2026-06-09): use the Health Canada DQRA value as the meantime DEFAULT
for the HH-food frame. Add alternative values (e.g. the community-specific 388 g/day) as
separate catalog OPTIONS later. The 388 g/day is a deliberately conservative value
specific to one Alberta First Nation and is NOT a general-public default.

### CANONICAL BC SOURCE FOUND (2026-06-09) -- verbatim, primary

**BC Ministry of Water, Land & Resource Stewardship (WLRS), 2023. "Derivation of
Screening Values for Contaminants in Fish Tissue."** ISBN 978-1-0399-0019-6; Victoria BC;
**endorsed by the BC Ministry of Health** as the recommended method for fish-consumption
human-health benchmarks. DURABLE LOCATOR: ISBN 978-1-0399-0019-6 + the verbatim title
above; obtain from the BC government publications site (gov.bc.ca, search by ISBN/title).
The PDF was fetched this session, but a session tool-results path is NOT a durable locator
-- owner to file the PDF in the reference library + Zotero (catalog_sources external-file
hint) before it backs any catalog value.
This is the AUTHORITATIVE BC source for the HH-food variant -- it gives BC's receptor
ingestion rates + body weights + the dose equation (which IS the SedS-foodHH pathway).
Rates trace to Richardson 1997 (the compendium the BC HHRA guidance points to).

Table 2 -- Fish Ingestion Rates (g/day), adults >=20 (Richardson 1997), VERBATIM.
NOTE: the rows below are RECEPTOR CATEGORIES (which population), NOT default-selection
status (which value the calculator uses). This inventory does NOT set a calculator default
-- that is a Phase B/C decision encoded via default_status + qa_status (AI never sets a
default). See the selection direction at the end of this section.
- Subsistence fisher: 220 g/day (= HC consumption rate for Indigenous Groups in Canada)
- Recreational fisher: 111 g/day (= general Canadian population; BC's general-public RECEPTOR)
- Low-level (general BC) fisher: 21 g/day (= HC 2011 two servings/week)
- Pregnant/breastfeeding woman: 111 g/day
- Teen 12-19: 104 (general) / 200 (Indigenous fish consumer)
- Child 5-11: 90 (general) / 170 (Indigenous)
- Toddler 7mo-4: 56 (general) / 95 (Indigenous)

Table 1 -- Body weights (kg) (Health Canada 2021a), VERBATIM: Adult >=20 = 70.7;
Teen 12-20 = 59.7; Child 5-12 = 32.9; Toddler 6mo-5 = 16.5.

Equation 1 (HC 2021a) -- ingested dose via contaminated food (matches HH-food):
Dose = [SUM(C_Foodi * IR_Foodi * RAF_Orali * D_i)] * D_2 / (BW * 365 * LE);
defaults RAF_Orali=1 (100% oral absorption), D_i=365 (fish daily), D_2=LE=80 yr
(carcinogens), cancer RL = 1 in 100,000.

So the HH-food variant can use BC's own receptor set, all PRIMARY-sourced:
recreational/general 111, subsistence 220, low-level 21 g/day (adult; + age breakdown).
388 g/day (WQCIU) sits ABOVE even the 220 subsistence -> confirms it is an extreme
community-specific OPTION, not a default. US EPA 6.5 g/day (RAGS A) is per-capita general
(much lower). DQRA ~100 g/day remains the interim default until this WLRS set is adopted.

Secondary-citation provenance found in TWG: `Draft BN-RRM Methodology Paper.pdf` Sec 6.6
("DEFAULT_CONSUMPTION_G_DAY = 100.0 ... Health Canada guidance"; bw 60 kg; MeHg 0.95);
`Jermilova et al 2025` (IEAM) Table 3 / p.402 ("portion = 150 g (Health Canada, 2007)";
bw 60 kg).

## 3. Next steps (deferred; owner-gated values + larger sweeps)

1. **Verify the primaries** (owner or a cheap targeted read): HC DQRAchem Sec 4.5.1
   exact fish/country-foods rate (the meantime default); WQCIU report 388 g/day
   (community-specific option; copies are in local files); US EPA EFH 2011 if a current
   US value is wanted (NOT in the library -- download EPA/600/R-09/052F Ch.10).
2. **BC HHRA guidance -- OBTAINED + read (2026-06-09).** "BC Guidance for Prospective
   Human Health Risk Assessment v2.0, April 2022, BC Ministry of Health" (downloaded from
   gov.bc.ca; saved under the session tool-results dir). KEY: it does NOT tabulate a fish
   consumption rate. Sec 3.5.4 Country foods (doc-p.53) directs: use community-specific
   data first; if unavailable, use standard wildlife/fish rates from **Compendium of
   Canadian Human Exposure Factors (Richardson 1997)**, **Canadian Exposure Factors
   Handbook (Richardson & Stantec 2013)**, and **Inventory and Analysis of Exposure
   Factors for Alberta (Alberta Health 2018)**. "Adjustment of default consumption rates
   without serious consideration of community-specific data is not recommended." It also
   cites the First Nations Food, Nutrition & Environment Study (Chan et al. 2011) for
   community/regional rates (use with caution; consumers-only, not averaged with
   non-consumers). So BC's framework == community-specific first, else the compendia ==
   exactly the owner's framing (DQRA default; 388 = community-specific option).
   - So the actual BC/Canadian standard fish NUMBER lives in: Richardson 1997 Compendium;
     Canadian EFH 2013 **food volume** (the Vol-1 in References has NO food module --
     need the food/diet volume); Alberta Health 2018 exposure factors. -> LOCATE these in
     the Drive/OneDrive sweep; they give the default rate BC + HC DQRA both draw on.
   - Also owner-named, still to LOCATE: BC risk-based guidance for estimating fish-tissue
     concentrations (feeds the fish-tissue side of HH-food + eco-food BSAF).
2. **Catalog + variant** (owner-gated): once the 3 rates are primary-verified with
   catalog_sources, add them + build the HH-food frame variant (per
   PHASE_4_FRAMEVARIANTS_SHAPE_SPEC.md sec 8: EquationVariantId + function + rows +
   calculator wiring + tests).
3. **Full Google-Drive inventory workflow** (set up, run in a fresh session -- token
   budget): a Workflow fanning over all SABCS subfolders + other top-level Drive folders
   (Protocol 19, Site_Remediation_Data, RAO collab, Cabana-Nelson Indigenous Research,
   Work Stuff, etc.). Design: per-folder agents (standard context, filename-first,
   capped PDF reads); route `.gdoc`/`.gsheet` via the gdrive MCP (`gdrive_read_doc` /
   `gdrive_export`); filter `._` stubs; dedup against existing Zotero (local API export);
   emit one consolidated manifest. EXCLUDE the Envirotox database (~8,780 data files).
4. **OneDrive sweep** (parked -- owner cannot log in yet): same approach once authenticated.
5. **Zotero import** (owner chose "inventory only" for now): when ready, bulk via Zotero
   native (Add Files linked + Retrieve Metadata) is cleaner than the API; `zotero-write-
   queue.mjs` (web API + write key, metadata-only, dedup, dry-run) for targeted adds.

Memory anchor: [[dashboard-hh-food-consumption-rate-sources-2026-06-09]].
