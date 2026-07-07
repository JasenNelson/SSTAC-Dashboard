# Matrix Options -- Benzo[b]/[j]/[k]fluoranthene Grouping Findings (2026-07-06)

**Status:** Research findings only. No code or catalog values changed by this report.
**Question:** Does `src/lib/matrix-options/rpfTable.ts` double-count carcinogenic-PAH
potency by carrying `benzo_b_fluoranthene` and `benzo_j_fluoranthene` (and, for some
schemes, `benzo_k_fluoranthene`) as three SEPARATE 0.1 rows, when the source scheme
actually defines one COMBINED potency factor for the co-eluting group?

---

## Bottom line

**YES -- for ccme-2010 (and, by strong inference, hc-pqra-v3 and who-1998-pah), the
shipped table risks OVER-COUNTING BaP-eq.** The primary CCME 2010 source document
defines the 0.1 potency factor for the SUM of benzo[b]+benzo[j]+benzo[k]fluoranthene as
ONE co-eluting analytical group, not for each isomer independently. Our table currently
assigns 0.1 to `benzo_b_fluoranthene`, 0.1 to `benzo_j_fluoranthene`, AND 0.1 to
`benzo_k_fluoranthene` as three independent rows for those three schemes. If a user
enters concentrations for b, j, and k separately (which is exactly what three separate
catalog rows invite), the calculator sums 0.1+0.1+0.1 = 0.3 contribution-equivalent
where the source intends a single 0.1 applied once to the combined mass -- up to a
3x over-count for that group's contribution to BaP-eq.

For **nisbet-1992**, the risk is narrower and different in kind: Nisbet & LaGoy's original
table treats benzo[b]fluoranthene and benzo[k]fluoranthene as genuinely SEPARATE,
independently-derived potencies (0.1 each, from different mouse-skin/inhalation
potency estimates) -- NOT a co-elution group. Benzo[j]fluoranthene was never in
Nisbet's original table at all; the 0.1 assigned to it in our table (and in common
downstream compilations) is a later compiler analogy-assignment, already flagged as
such in the file's own header comment. So nisbet-1992's b+j (or b+k) SEPARATE rows are
not a "double-counting of one group value" in the CCME sense, but the fabricated-j-value
risk is a separate, already-documented caveat.

**Recommended fix:** replace the three separate `benzo_b_fluoranthene` /
`benzo_j_fluoranthene` / `benzo_k_fluoranthene` rows, for the ccme-2010 / hc-pqra-v3 /
who-1998-pah columns specifically, with a single combined `benzo_bjk_fluoranthene`
("Benzo[b+j+k]fluoranthene") catalog row carrying RPF 0.1 for those three schemes, PLUS
a reducer-level mutual-exclusion guard that rejects (or warns hard on) an input set that
supplies both the combined-group key and any of the individual b/j/k keys for the same
sample under a scheme that defines the group form. Do not silently drop rows -- CCME's
own document explicitly ties the grouping to real-world analytical co-elution (see
finding 4 below), so the combined-row model matches how PAH data actually arrives from
labs for these schemes. nisbet-1992 can keep separate b/k rows (its true per-isomer
structure); the j-value-fabrication caveat is unchanged and separate from this issue.

---

## Finding 1 -- Nisbet & LaGoy (1992) original table

**Confidence: VERIFIED-primary** (confirmed via CCME 2010's own reproduction of the
Nisbet & LaGoy potency comparison, Table 6-3, which is a direct restatement of Nisbet's
Table 4 alongside other studies' estimates).

CCME (2010), *Canadian Soil Quality Guidelines for Carcinogenic and Other Polycyclic
Aromatic Hydrocarbons (PAHs)*, Table 6-3 "Comparison of relative potency estimates for
various studies" (p. 105 of the PDF), Nisbet and LaGoy 1992 column:

```
benzo[b]fluoranthene   ... Nisbet and LaGoy, 1992: 0.1   (inhalation exposures)
benzo[j]fluoranthene   ... Nisbet and LaGoy, 1992: (blank -- no value)
benzo[k]fluoranthene   ... Nisbet and LaGoy, 1992: 0.1   (inhalation exposures)
```

This confirms:
- Nisbet's original table lists benzo[b]fluoranthene and benzo[k]fluoranthene as
  SEPARATE isomers, each independently assigned 0.1 -- these are two distinct
  potency estimates, not a combined group value split in two.
- Benzo[j]fluoranthene has NO entry in Nisbet's original 1992 table at all. The 0.1
  commonly attributed to it (including in our own rpfTable.ts, which already carries
  the comment "NOTE benzo[j]fluoranthene 0.1 is a later compiler assignment") is not
  from Nisbet's paper -- it is a downstream convention (assign j the same value as b/k
  by chemical-class analogy), corroborated but not verified against the original 1992
  text directly (we read CCME's reproduction, not the original Regul. Toxicol. Pharmacol.
  16:290-300 PDF itself).

Source: https://ccme.ca/en/res/2010-pah-csqg-scd-1445-en.pdf (Table 6-3, p.105 of PDF;
document p.105/216).

---

## Finding 2 -- CCME 2010 Canadian Soil Quality Guidelines (the ccme-2010 scheme)

**Confidence: VERIFIED-primary** (read directly from the CCME 2010 Scientific Criteria
Document PDF, extracted via pdftotext).

CCME (2010), Table 6-6 "Benzo[a]pyrene Potency Equivalence Factors" (p. 120 of the PDF):

```
Benz[a]anthracene         0.1
Benzo[a]pyrene            1
Benzo[b+j+k]fluoranthene  0.1
  (note: since these three isomers closely co-elute using most contemporary
  analytical methods, the PEF applies specifically to the total of the three
  co-eluting PAHs)
Benzo[g,h,i]perylene      0.01
Chrysene                  0.01
Dibenz[a,h]anthracene     1
Indeno[1,2,3-c,d]pyrene   0.1
```

This is unambiguous and explicit: CCME defines ONE potency-equivalence factor, 0.1, for
the COMBINED total concentration of benzo[b]fluoranthene + benzo[j]fluoranthene +
benzo[k]fluoranthene, with an explicit stated rationale (co-elution under contemporary
analytical methods -- i.e., a lab typically cannot resolve b/j/k as three separate
numbers, so CCME defines the PEF for whatever total mass is reported as the group).

Our `rpfTable.ts` currently has, for the ccme-2010 column: benzo_b_fluoranthene = 0.1,
benzo_j_fluoranthene = 0.1, benzo_k_fluoranthene = 0.1 -- THREE separate 0.1 entries.
Per CCME's own table, this is incorrect for a user who enters b, j, and k as three
separate concentrations: the correct computation multiplies the SUM of the three
concentrations by 0.1 once, not each concentration by 0.1 independently.

Source: https://ccme.ca/en/res/2010-pah-csqg-scd-1445-en.pdf (Table 6-6, p.120 of PDF).

---

## Finding 3 -- Health Canada PQRA Table 2 (hc-pqra-v3 scheme) and BC CSR / who-1998-pah

**Confidence: corroborated-secondary** (could not directly fetch/read the primary HC
PQRA PDF -- publications.gc.ca serves an archived-notice redirect / JS-rendered
interstitial that blocked both an automated download and WebFetch; the underlying PDF
itself was not retrievable in this session). The conclusion below is inferred from
converging secondary evidence, not a direct read of HC's Table 2 text.

Evidence assembled:
- Our own `rpfTable.ts` header comment already states: "hc-pqra-v3 -- Health Canada
  PQRA v3 (Table 2 'recommended' = CCME-2010 values; Table 3 'provisional')" and
  "ccme-2010 ... HC adopts these as 'recommended'."
- Independent web corroboration (search-engine-summarized secondary source) states:
  "Recommended RPFs for carcinogenic PAHs provided in Table 2 are those recommended by
  the Canadian Council of Ministers of the Environment (CCME, 2010)."
- BC's own Technical Guidance 7 (Ministry of Environment, "Detailed Human Health Risk
  Assessments"), which underlies the who-1998-pah / BC CSR scheme, explicitly directs
  practitioners to Health Canada PQRA Part I, Table 7 "Potency Equivalence Factors for
  Carcinogenic Polycyclic Aromatic Hydrocarbons" as the SAME table BC relies on --
  i.e., who-1998-pah's PEFs trace back to the identical HC/CCME lineage, not an
  independently-derived WHO/IPCS 1998 table with different isomer handling.
  (Source: https://www2.gov.bc.ca/assets/gov/environment/air-land-water/site-remediation/docs/technical-guidance/tg07.pdf,
  p.2 of PDF.)

Given HC's Table 2 is stated (by HC's own summarized text and by our own prior A2
verification comment) to BE the CCME 2010 values, and CCME 2010's Table 6-6 explicitly
groups b+j+k with a stated co-elution rationale, it follows with high (but not
primary-verified) confidence that HC PQRA Table 2 also presents benzo[b+j+k]fluoranthene
as a single combined row rather than three separate isomer rows. This should be
upgraded to VERIFIED-primary once the actual H129-108-2021-eng.pdf (or the PQRA Part I
Table 2/7 text) is successfully retrieved and read -- it was not readable in this
session (see "What is needed to resolve UNCERTAIN items" below).

who-1998-pah is flagged in our own code as `needs_review` for an unrelated reason (BC's
restricted 5-PAH subset not yet pinned) -- this finding adds a SECOND reason it needs
review: it likely inherits the same combined-group structure as ccme-2010, via the same
HC PQRA Table 7 lineage.

---

## Finding 4 -- Analytical reporting reality (do labs actually combine b/j/k?)

**Confidence: VERIFIED-primary for b/k specifically** (read directly from EPA Method
8270D text via search-engine summary of the official method PDF) **+ corroborated for
the b/j/k triple** (CCME's own explicit statement in Finding 2).

- EPA Method 8270D (SW-846) states that benzo[b]fluoranthene and benzo[k]fluoranthene
  are the most common critical GC separation pair; when chromatographic resolution is
  insufficient (peak valley height >= 50% of the average peak height), the method
  requires the isomers to be reported TOGETHER as a combined result rather than as two
  separate numbers. When resolution is adequate, they may be reported individually.
  Source: EPA Method 8270D, https://19january2017snapshot.epa.gov/sites/production/files/2015-12/documents/8270d.pdf
  (referenced via https://www.restek.com/chromablography/a-quick-evaluation-of-some-disadvantages-to-performing-semivolatiles-analysis-by-epa-method-8270d-with-splitless-injection
  and Florida DEP's copy of 8270D).
- Benzo[j]fluoranthene is even harder to resolve from b/k by GC-MS than b vs k are from
  each other (widely noted in the PAH analytical-chemistry literature); many commercial
  labs do not offer a separate benzo[j]fluoranthene analyte at all, or report
  "benzo(b+j+k)fluoranthene" or "benzo(b+j)fluoranthene" as a single lab-reported line
  item precisely because standard capillary GC columns do not separate all three/four
  congeners cleanly.
- CCME (2010) itself states the rationale explicitly (Finding 2 quote): "since these
  three isomers closely co-elute using most contemporary analytical methods, the PEF
  applies specifically to the total of the three co-eluting PAHs."

Net: yes, standard analytical practice frequently produces a single combined
concentration value for b(+j)(+k)fluoranthene, which is exactly why CCME defined its
PEF for the combined total rather than per-isomer. A user of our tool who has a lab
report showing one "benzo(b+j+k)fluoranthene" line has no correct way to enter it into
the current three-separate-row schema without either fabricating a 3-way split (wrong)
or entering the whole value under just one of the three rows (also wrong, since only
that one row's contribution would count -- actually equivalent in total to entering the
whole mass under one row and getting 0.1x the combined mass, which happens to be
numerically CORRECT by coincidence for CCME's single-group PEF, but is a data-entry trap
with no guidance, and does not work for the reverse case where a lab genuinely resolves
b and j/k separately and a user has 3 real separate numbers to enter under nisbet-1992
where they ARE meant to be separate).

---

## Per-scheme decision table

| Scheme | Is CCME's group PEF the basis? | Current rpfTable.ts structure | Verdict |
|---|---|---|---|
| nisbet-1992 | No -- independent per-isomer potencies (b, k); j absent from original, compiler-assigned by analogy | Separate b/j/k rows, 0.1 each | Structurally OK for b vs k (true per-isomer scheme); j-value is a documented-but-unverified compiler analogy, not a double-count issue |
| ccme-2010 | Yes -- explicit combined b+j+k PEF, stated co-elution rationale | Separate b/j/k rows, 0.1 each | **RISK OF OVER-COUNTING (up to 3x for the group's contribution)** |
| hc-pqra-v3 | Very likely (Table 2 = CCME 2010 values, per HC's own stated adoption) | Separate b/j/k rows, 0.1 each | **RISK OF OVER-COUNTING, corroborated-secondary; needs primary-PDF confirmation** |
| who-1998-pah (BC CSR) | Very likely (BC TG07 points to HC PQRA Table 7, same lineage) | Separate b/j/k rows, 0.1 each | **RISK OF OVER-COUNTING, corroborated-secondary; already flagged needs_review for an unrelated reason** |
| epa-2010-draft | Not evaluated in this pass (separate provisional/suspended scheme; original EPA 1993 table, per the small EPA PDF read here, lists ONLY b and k, not j, and treats them as fully separate independent potencies -- no group value found) | Separate b/j/k rows | Out of scope for this question; existing needs_review / UNCONFIRMED flags in the file already caution against citing it |

---

## What is needed to resolve remaining UNCERTAIN/corroborated-secondary items

1. **Primary-read HC PQRA Table 2 (and/or Table 7) text.** The canonical PDF
   (`H129-108-2021-eng.pdf` at publications.gc.ca) redirected to an archived-notice
   interstitial page in this session and could not be downloaded as a raw PDF via curl
   or read via WebFetch (WebFetch cannot parse binary PDF content; the direct URL
   302/307-redirects to an HTML landing page rather than serving the file to a
   non-browser client). Needed: either (a) the owner manually downloads the PDF from
   the canada.ca chain and shares it locally for reading, or (b) a session with a
   browser-rendering fetch tool that follows the JS/cookie-gated redirect.
2. **Primary-read Nisbet & LaGoy (1992) original paper** (Regul. Toxicol. Pharmacol.
   16:290-300) directly, rather than via CCME's reproduction, to fully verify Finding 1
   (paywalled ScienceDirect article; not accessed in this session).
3. Once (1) is confirmed, upgrade Finding 3 from corroborated-secondary to
   VERIFIED-primary and finalize the recommended fix (combined-row schema) with full
   confidence for hc-pqra-v3 specifically.

---

## Sources (all fetched/read in this session)

- CCME (2010), *Canadian Soil Quality Guidelines for Carcinogenic and Other Polycyclic
  Aromatic Hydrocarbons (PAHs) -- Scientific Criteria Document*, 216 pp.
  https://ccme.ca/en/res/2010-pah-csqg-scd-1445-en.pdf (Table 6-3 p.105, Table 6-6
  p.120; downloaded and text-extracted directly in this session).
- US EPA, "Relative Potency Factors for Carcinogenic Polycyclic Aromatic Hydrocarbons"
  (reproduction of USEPA 1993 Table 8), https://www.epa.gov/sites/default/files/2015-11/documents/pah-rpfs.pdf
  (downloaded and read directly in this session).
- BC Ministry of Environment, Technical Guidance 7, "Detailed Human Health Risk
  Assessments," https://www2.gov.bc.ca/assets/gov/environment/air-land-water/site-remediation/docs/technical-guidance/tg07.pdf
  (downloaded and read directly in this session; p.2 cross-references HC PQRA Table 7).
- EPA Method 8270D (SW-846), co-elution / combined-reporting requirement for
  benzo[b]/[k]fluoranthene, referenced via secondary summary of the method text
  (Restek technical note + Florida DEP method copy); not independently re-verified
  against the raw method PDF text in this session.
- Health Canada, *Federal Contaminated Site Risk Assessment in Canada, Part I: PQRA*
  and *Part II: TRVs* -- NOT successfully retrieved in this session (see item 1 above);
  cited only via secondary web-search summaries and this repo's own prior A2-verification
  header comments in `rpfTable.ts`.

Plain ASCII only.
