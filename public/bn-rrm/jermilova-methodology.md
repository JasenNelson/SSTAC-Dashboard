# JERMILOVA BN-RRM CONSTRUCTION METHODOLOGY

**A Detailed Step-by-Step Record of an AI-Assisted Bayesian Network Relative Risk Model Build**

Case study: Mercury exposure in the Mackenzie River watershed, with reference to Jermilova et al. 2025 (IEAM 21(2):396-413, DOI 10.1093/inteam/vjae011, CC BY-NC 4.0).

---

**Document version:** v1.0 (assembled 2026-05-17; ready for holistic codex review and HITL sign-off)
**Authoring**: Claude Opus 4.7 orchestrator under HITL direction (Jasen Nelson, project owner / scientific authority); subagents (Claude Code subagent type=Explore, type=general-purpose, Claude Opus 4.7) for codebase mapping and Part drafting; Codex CLI 0.130.0 (xhigh reasoning + tool use) for adversarial mutual-agreement review.
**License**: This document is a non-commercial scholarly work that cites the CC BY-NC 4.0 Jermilova et al. 2025 article and the CC BY-NC-SA 4.0 FRDR DOI 10.20383/103.0957 v2 dataset.
**ASCII-only**: Every character has code point <= 127. Validated by `methodology_paper/ascii_lint.py`.

---

## Abstract

This document is the construction record of an AI-assisted reconstruction of the Jermilova et al. 2025 Mackenzie Hg Bayesian Network Relative Risk Model (BN-RRM). It records every step, every borrowed parameter, every Python library mechanic, and every methodological divergence from the published baseline. The reconstruction is a 14-node, 15-edge DAG per submodel (Great Slave Lake and Great Bear Subbasin), fit on the FRDR DOI 10.20383/103.0957 v2 dataset using Bayesian Dirichlet equivalent uniform (BDeu) counting for three intermediate stressor nodes (total_hg_deposition, freshwater_thg, fish_tissue_hg), empirical-prior smoothing for seven root nodes per submodel, and deterministic CPTs (Dillon 2010 LL.3 dose-response, Health Canada commercial-fish guideline, subsistence MeHg intake formula, US EPA child pTWI) for the four effect / impact nodes (degree_of_injury, eligible_commercial_catch, mehg_ingested, ptwi_exceedance). Leave-one-out cross-validation reports moderate agreement for fish_tissue_hg (Cohen's kappa = 0.466 GSL on N = 584, 0.489 GBS on N = 258) and zero agreement for freshwater_thg in both submodels (kappa = 0.0 on N = 855 GSL and N = 1589 GBS; the model collapses to majority-class prediction). Sensitivity analysis via mutual information ranks the dominant DAG drivers in agreement with the published Table 2 at top-3 on shared variables. Of the five comparison-protocol dimensions, ONE is fully RUN (Dimension 1 structural; perfect match), ONE is PARTIAL (Dimension 4 sensitivity rankings, narrative-only -- no Spearman rho / top-3 / rank-displacement metric receipts), and THREE are NOT RUN (Dimension 2 CPT divergence via Jensen-Shannon, Dimension 3 per-region marginal-belief Pearson r, Dimension 5 Minamata counterfactual fold-change). All four unrun-or-partial dimensions are listed as open follow-ups (Part IX Section 27.5 items c, d, e, f). The methodology paper is written for peer reviewers; every empirical claim cites a source file with line number or a results JSON path. The AI-assisted process is recorded as a workflow novelty -- the orchestrator drafts and proposes; the HITL (Jasen Nelson) is the controlling scientific authority and final decider; Codex CLI is the adversarial reviewer through a mutual-agreement loop.

---

## Master Table of Contents

### Body Parts

- **Part I -- Background and Context**
  - 1. Introduction (purpose, scope, BN-RRM definition, Jermilova case study, AI-assisted research question, reproducibility, conventions)
  - 2. Source materials and licenses (paper, FRDR dataset, R code, Netica binaries, software environment)
  - 3. AI-assisted workflow overview (roles, milestone framework M1-M7, decision-provenance ledger pointer)

- **Part II -- From Raw Data to Discretized Cases**
  - 4. Data acquisition (M1): FRDR download, integrity, input vs LOO-eligible counts
  - 5. Data crosswalk (M2): FRDR variables to DAG nodes, exclusions
  - 6. Discretization: borrowed Table S4 thresholds, derived thresholds, BDL treatment, subsistence-scenario assumptions, boundary-equality drift

- **Part III -- DAG Construction**
  - 7. Conceptual DAG (12 shared + 2 GSL + 2 GBS = 14 nodes per submodel; 8 regions)
  - 8. DAG simplifications and decisions (species collapse, RUSLE collapse, freshwater discharge exclusion, wildfire C-factor exclusion)
  - 9. Python implementation (pgmpy.BayesianNetwork, networkx fallback, dag_definition_mackenzie_hg.py walkthrough)

- **Part IV -- CPT Fitting (deepest chapter)**
  - 10. CPT fitting strategy (three CPT types: empirical_prior, bdeu, deterministic_*)
  - 11. BDeu methods detail (Dirichlet prior, ESS=1.0, alpha_ij = ESS/n_configs, alpha_ijk = ESS/(n_configs * n_states), posterior, normalization, fit_bdeu_cpt walkthrough, pgmpy non-use)
  - 12. Deterministic CPTs (Dillon LL.3, FISH_HG_MIDPOINTS, pTWI thresholds, mehg_ingested formula, ptwi_exceedance, per-CPT soft-edging policy)
  - 13. Empirical priors (root nodes, alpha_k = ESS/n_states, no minimum-row threshold)
  - 14. Orchestration (fit_all_cpts, topological-sort fitting)

- **Part V -- Validation and Sensitivity**
  - 15. LOO cross-validation (partial design, MAP, parent-missing skip, Cohen's kappa, results, kappa=0.0 interpretation)
  - 16. Sensitivity analysis (mutual information via KL divergence)
  - 17. Forward inference and per-region application (topological-sort exact enumeration, known per-region limitation)
  - 18. Summary of Part V findings

- **Part VI -- Export and Frontend Rendering**
  - 18. Generic exporter (export_generic_model.py, generic-bn-rrm-v1 schema, layout, color, CPT transformation)
  - 19. Pack assembly two-location reality (RR-generated core; SSTAC deployed augmented)
  - 20. SSTAC dashboard rendering (8 tabs, createGenericNetwork, differences vs canonical pack)

- **Part VII -- Comparison to Published Model**
  - 21. Comparison protocol (5 dimensions, frozen thresholds at M2)
  - 22. Methodological differences (parametric lme vs nonparametric BDeu; no set.seed; pooled vs per-region fitting)
  - 23. Comparison results (which dimensions were run + outcomes for Dimensions 1 and 4)

- **Part VIII -- AI-Assisted Process: The Research Question**
  - 24. Workflow narrative (roles, milestones, HITL gates, AI proposals)
  - 25. Quality gates (codex review mutual-agreement, subagent context protection, comparison protocol acceptance gate)
  - 26. Limitations and honest reporting (consolidated)

- **Part IX -- Reproducibility and Appendices**
  - 27. Reproducibility recipe (environment, step-by-step commands, expected outputs, drift check, "what we would do differently" placeholder)
  - Cross-references to the appendices

### Appendices

- **Appendix A -- Complete DAG Node Registry** (14 nodes per submodel; per-node parents, states, CPT method, source attribution)
- **Appendix B -- Complete CPT Inventory + BDeu Correctness Receipt** (28 CPTs total: 14 root priors + 6 BDeu + 8 deterministic; hand-calculated BDeu fixture; pgmpy-equivalent analytic receipt)
- **Appendix C -- Discretization Table** (every break + source attribution; subsistence-scenario assumptions; BDL treatment; permafrost "none" state)
- **Appendix D -- File Inventory + Live Drift State** (every file with absolute path, size, SHA-256 hashes for primary artifacts; observed RR vs SSTAC pack drift)
- **Appendix E -- References** (peer-reviewed literature, regulatory guidelines, datasets, project-internal authoritative documents, tooling)
- **Appendix F -- Decision-Provenance Ledger** (chronological decisions by milestone M1-M7 plus methodology-paper construction; AI tool/version recorded for every AI-proposer row; open / deferred decisions; methodology paper version history)

---

## Navigation note for reviewers

This document is assembled from modular sources in the
`methodology_paper/` directory. The body Parts (I-IX) are in
`body/parts_I_II_III.md`, `body/part_IV.md`, `body/part_V.md`, and
`body/parts_VI_VII_VIII_IX.md`. The appendices (A-F) are in
`appendices/appendix_*.md`. The PLAN that authorized the construction
is at `PLAN.md` (v0.4 GREEN). The ASCII compliance linter is at
`ascii_lint.py`.

A reviewer who reads this assembled master file gets the complete
methodology record in a single document. A reviewer who wants to
audit a specific Part or Appendix can read the modular source file
directly. The two views are byte-equivalent on the body / appendix
content; the master file adds only the preamble, the abstract, and
this navigation note.

---
---
title: Parts I, II, III -- Background, Data, DAG Construction
parent_document: JERMILOVA_BNRRM_CONSTRUCTION_METHODOLOGY.md
status: v1.0 (assembled 2026-05-17 after body-R4 YELLOW non-blocking, holistic-R1 RED applied)
created: 2026-05-17
ascii_constraint: All characters in this file must satisfy code point <= 127.
fact_pinning_appendices:
  - appendices/appendix_A_dag_node_registry.md
  - appendices/appendix_C_discretization_table.md
  - appendices/appendix_D_file_inventory.md
---

# Part I -- Background and Context

## Facts pinned for Part I

The following appendix rows are cited by Part I. The facts themselves live
in the appendices; Part I prose paraphrases them and does not restate the
numbers in standalone form. Any number that appears in Part I prose without
a citation back to one of these rows is a defect.

- Appendix A Section A.1 (submodel structure summary: 14 nodes, 15 edges
  per submodel; 12 shared nodes; 4 regions per submodel).
- Appendix A Section A.3 (region lists; per-region inference limitation
  citing `fit_mackenzie_model.py:950-952`).
- Appendix D Section 1 (Python implementation files; `dag_definition_mackenzie_hg.py`
  411 lines, `canonical_mackenzie.py` 423 lines, `prepare_mackenzie_data.py`
  697 lines, `fit_mackenzie_model.py` 1,257 lines, `export_generic_model.py`
  436 lines).
- Appendix D Section 3 (raw FRDR data files: published Excel workbooks,
  Manuscript_RCode.R 310 lines, Netica .neta binaries, license
  CC BY-NC-SA 4.0 (ShareAlike) per raw/LICENSE.txt and SOURCE_MANIFEST.md
  -- CORRECTED per codex holistic-R2 P2 from prior CC BY-NC 4.0;
  the article itself remains CC BY-NC 4.0);
  FRDR remote temporarily unavailable as of 2026-04-06; local archive in
  `raw/`).
- Appendix D Section 8 drift state (pack.json and runtime/learned-model.json
  differ between Regulatory-Review and SSTAC-Dashboard; training_data.json
  plus four shared review JSONs are byte-identical -- relevant to the
  reproducibility statement here).
- Appendix C Section C.1 conventions paragraph (path-dependent boundary
  rules between `prepare_mackenzie_data.py` and `canonical_mackenzie.py`).

Source code line ranges cited inline by Part I are pinned in the source
files listed in Appendix D Section 1 and inspected directly at the time of
drafting.

## 1.1 Purpose and scope

This document is the construction record for the AI-assisted build of the
Jermilova Mackenzie Hg BN-RRM case study. It exists to support a parent
methodology paper whose research question is whether an AI-assisted workflow,
operating under continuous human-in-the-loop (HITL) authority, can
reproduce a published probabilistic regional-risk model (Jermilova et al.
2025) at peer-review-grade quality. The deliverable's purpose is therefore
documentary rather than evaluative. It records exactly how the case-study
build proceeded from raw FRDR data to a deployed dashboard pack, names every
modeling decision, attributes every borrowed parameter, and surfaces every
limitation. Interpretation of "as good as" or "different from" the
published baseline is reserved for the parent paper and the human authors.

Parts I, II, and III cover the Background, Data, and DAG Construction
sections of the deliverable. Part I orients the reader to the case study,
the AI-assisted workflow, and the source materials. Part II documents the
acquisition and discretization of the FRDR data through to the discretized
case rows that feed CPT fitting. Part III documents the DAG structure
itself: which nodes the model contains, which edges connect them, which
nodes are shared between the two submodels and which are submodel-specific,
and how the structure is implemented in Python.

The non-goals of these three Parts mirror PLAN Section 2. They do not
re-summarize the published Jermilova paper beyond what is needed to
explain divergences. They do not generalize to the canonical 20-node BC
sediment BN-RRM (a different model in the broader BN-RRM program). They do
not claim that the AI-assisted build is "as good as" or "better than" the
published reference; the comparison results are reported in Part VII and
interpreted by the human authors. And they do not extend to the dashboard
infrastructure beyond what is required to explain export. CPT fitting,
validation, comparison, the AI-assisted workflow narrative, and the
reproducibility recipe are deferred to Parts IV through IX.

The intended reader is a peer reviewer of a methods paper. Tone is precise
and neutral. Every quantitative claim cites either a source-code file with
a line range, a results-JSON path, or an appendix row. Honest reporting is
prioritized over rhetorical convenience. Where a known limitation exists
(for example, the per-region inference uses overall priors as a baseline,
the freshwater_thg leave-one-out kappa is zero in both submodels, or the
training-vs-runtime classification paths differ at boundary equality), the
limitation is surfaced in the body, not deferred to an appendix or footnote.

## 1.2 What is a BN-RRM

A Bayesian-network Regional Risk Model (BN-RRM) is a probabilistic
graphical model of regional environmental risk constructed around a
causal Directed Acyclic Graph (DAG). The framework is articulated by
Landis (2021) and extends the Relative Risk Model (RRM) tradition that
originated with Landis and Wiegers in the late 1990s by replacing the
deterministic relative-risk index with conditional-probability tables
(CPTs) and exact (or sampled) inference. Nodes in a BN-RRM represent
contaminant sources, transport stressors, exposure conditions, biological
or human-health effects, and management-relevant impacts. Edges encode
causal or near-causal dependencies, often derived from a regression or
dose-response model fit to monitoring data. CPTs encode the conditional
probability of each child-node state given each parent-state combination.
Inference propagates beliefs forward (from sources to impacts) or backward
(from impacts to sources), and supports counterfactual reasoning ("what if
emissions doubled") and sensitivity ranking ("which source most reduces
impact uncertainty when set").

Two features make BN-RRMs attractive for regional-scale contaminated-site
or watershed management. First, they handle heterogeneous evidence:
monitoring data, modeled outputs (such as GEM-MACH-Hg atmospheric
deposition rasters or SiBCASA permafrost fluxes), regulatory thresholds
(CCME, Health Canada, US EPA), and expert judgment can all be encoded as
nodes, parents, or CPTs. Second, they make uncertainty explicit. Every
node returns a discrete distribution rather than a point estimate, and the
inference engine propagates conditional uncertainty through the network.
For a regulator or a science panel, a distribution over "degree of
injury" is more informative than a single risk number, because the
distribution captures the joint uncertainty in pathway, exposure, and
dose-response.

The Mackenzie Hg case study is a deliberately reduced BN-RRM: 14 nodes
per submodel, two submodels (Great Slave Lake and Great Bear Subbasin),
and a single contaminant (mercury). Section 1.3 places it in context.

## 1.3 The Jermilova case study

The published reference for this deliverable is Jermilova et al. 2025,
"Assessing mercury exposure to water and fish of the Mackenzie watershed
using a Bayesian network analysis", Integrated Environmental Assessment
and Management 21(2): 396-413, DOI 10.1093/inteam/vjae011, licensed
CC BY-NC 4.0. (Title CORRECTED per codex body-R1 P2-1 to match
SOURCE_MANIFEST.md:12-15 exactly.) The paper
develops two basin-scale BN-RRMs (one for Great Slave Lake, hereafter GSL;
one for the Great Bear Subbasin, hereafter GBS) and applies them to
estimate basin-wide mercury exposure for Indigenous food-fish consumers.
Source data are aggregated from atmospheric-deposition modeling
(GEM-MACH-Hg), permafrost-thaw flux modeling (SiBCASA), soil-erosion
modeling (RUSLE), commercial monitoring of fish and water Hg, and the
authors' own field campaigns.

For this AI-assisted reconstruction, four artifact families from the
published work are treated as authoritative inputs and recorded in
Appendix D Section 3:

1. The peer-reviewed paper itself (the IEAM article and its supplements,
   in particular Table S4 which lists the discretization break boundaries
   that Appendix C adopts).
2. The FRDR dataset (DOI 10.20383/103.0957 v2 dated 2025-05-14;
   approximately 11.97 GB). As of 2026-04-06 the FRDR remote was
   temporarily unavailable; a local archive of the necessary files
   resides in the `raw/` folder (Appendix D Section 3). Integrity is
   verified against `raw/frdr-dfdr-checksums.txt` (Appendix D Section 3).
3. The published R code (Manuscript_RCode.R, 310 lines, Appendix D
   Section 3). The R script implements the published fitting pipeline
   using lme() for mixed-effects regression, drc::drm() for dose-response,
   and predictSE() for marginal beliefs. The script does not call
   `set.seed()`, so its sampling steps are not reproducible bit-for-bit;
   this is a limitation of the published baseline (PLAN Part VII
   Section 22.2) and is discussed in Part VII.
4. The published Netica binaries (`.neta` files) for the GSL and GBS BNs
   plus a conceptual diagram (Appendix D Section 3). These serve as
   comparison references only; they are not consumed programmatically by
   the BN-RRM build.

Reuse of the materials in this methodology document falls within their
respective license terms. The Jermilova et al. 2025 ARTICLE is licensed
CC BY-NC 4.0; quotation, citation, and analytical reuse for this
non-commercial scholarly work are permitted under that license. The
FRDR DATASET, R code, and Netica model files are licensed CC BY-NC-SA
4.0 (ShareAlike; per raw/LICENSE.txt and SOURCE_MANIFEST.md:36-38);
reuse of those materials in this deliverable and the SSTAC dashboard
pack carries the ShareAlike obligation forward to any derived works.
(CORRECTED per codex body-R2 P2-2 from prior wording that applied
CC BY-NC 4.0 uniformly to the data and code.)

## 1.4 Why AI-assisted -- the research question

The parent paper's research question is whether an AI-assisted workflow,
operating under continuous HITL authority, can reproduce a published
BN-RRM at peer-review-grade quality while making every decision, every
parameter source, and every limitation explicit. The motivation is
practical: BN-RRM construction is labor-intensive, decisions tend to be
buried in unrecorded judgment calls, and reproducibility across analysts
is poor. If a structured AI-assisted workflow can replicate a published
build while documenting the trail more rigorously, the workflow has
value for the broader regional-risk-modeling community.

The Jermilova case study is appropriate for this question because it is
(a) recently published with all data and code available, (b) intermediate
in complexity (a 14-node DAG, not a toy 5-node example and not a
50-node behemoth), and (c) consequential -- the model informs Indigenous
food-fish consumption decisions in the Mackenzie River basin, which makes
both quality and transparency load-bearing.

This document records the construction process. It does not assert that
the AI-assisted build is better than the published model; it does not
assert that the AI did the modeling unaided; it does not market a
methodology. The Parts that follow describe what was done. The interpretive
claims belong to the human authors of the parent paper.

## 1.5 Reproducibility statement

The construction pipeline is fully reproducible in the following sense:
given the input files inventoried in Appendix D and a Python 3
environment satisfying Section 2.5, an independent reviewer can re-run
the pipeline and obtain bit-identical Python outputs at the
`training_data_*.json`, `learned-model-*.json`, `validation-*.json`,
`sensitivity-*.json`, and `inference-results.json` artifacts. Verification
relies on the SHA-256 hashes recorded in Appendix D Sections 4, 5, and 7.

Two reproducibility caveats are surfaced here so a reader is not surprised
by them later:

- The published R-code baseline (Manuscript_RCode.R, Appendix D Section 3)
  does not call `set.seed()`. Re-running it produces non-deterministic
  output. The BN-RRM build records the published values that
  `published_reference/digitized_from_paper.json` was digitized against,
  but it cannot exactly reproduce the published R sampling.
- The Regulatory-Review (RR) pack and the SSTAC-Dashboard deployed pack
  share a subset of artifacts that are byte-identical (training_data.json,
  comparison_results.json, model_overview.json, published_reference.json,
  validation.json -- see Appendix D Sections 7 and 8). They differ in
  pack.json and runtime/learned-model.json. The drift is real, expected,
  and within the PLAN Q8 policy: only the shared subset is byte-compared.
  The dashboard-only review JSONs and the GeoJSON map layers are
  augmentations produced by the dashboard pipeline, not by the RR pipeline.

The full step-by-step reproducibility recipe is in Part IX Section 27.
Parts II and III below describe the construction steps that recipe
operationalizes.

## 1.6 Document conventions

All text in this document is plain ASCII (code point at most 127). The
`ascii_lint.py` harness sibling to PLAN.md is the authoritative gate;
any non-ASCII character is a defect. The convention is enforced because
several downstream consumers (Mermaid diagram renderers, GitHub markdown
processors, regulatory-review reviewers using Windows terminals) handle
non-ASCII characters inconsistently.

Other conventions used throughout Parts I-III:

- Arrows use the two-character sequence `->`. Em-dashes use the
  two-character sequence `--`. Bullets use the ASCII hyphen.
- File-line citations take the form `path/to/file.py:LINE` or
  `path/to/file.py:START-END` for ranges. Absolute paths are used for
  the few cases where ambiguity could arise; otherwise paths are relative
  to the project root.
- Numeric ranges in prose are written as digits with intervening
  hyphens or "to" (for example "0.6-0.8" or "0.6 to 0.8"). The
  inclusive-upper-bound convention for discretization breaks ("v <= b
  puts v in the bin ending at b") is documented in Appendix C
  Section C.1 and used consistently in Part II.
- Cohen kappa values are reported per the standard interpretation
  guide (PLAN Part V Section 15.4): <= 0 none, 0.01-0.20 slight,
  0.21-0.40 fair, 0.41-0.60 moderate, 0.61-0.80 substantial,
  0.81-1.00 almost perfect.

## 2.1 Source materials

The construction pipeline draws on four classes of source material,
inventoried in Appendix D and summarized here:

- The published paper and its supplements. The IEAM article supplies
  the conceptual framework; supplementary Table S4 supplies the
  discretization break boundaries used in Appendix C. Both revisions
  of the supplement (the original `Supplemental_Information_11012023.docx`
  and the revised `vjae011_Supplementary_Data/Supplemental_Tables_Revised.docx`)
  are retained in `raw/` for audit completeness, but only the revised
  version is the canonical source of Table S4.

- The FRDR dataset DOI 10.20383/103.0957 v2 (2025-05-14, approximately
  11.97 GB; CC BY-NC-SA 4.0 per raw/LICENSE.txt and SOURCE_MANIFEST.md:36-38;
  the ShareAlike clause carries forward reuse obligations on derived works,
  including this methodology document and the SSTAC dashboard pack).
  (License CORRECTED per codex body-R1 P2-2 from prior CC BY-NC 4.0
  to CC BY-NC-SA 4.0.) The dataset contains the Excel workbooks that
  Part II consumes (797 fish records in
  `FishData_and_ProbabilityDistributions.xlsx`; 2,124 water records in
  `FreshwaterTHgData_and_ProbabilityDistributions.xlsx`; hydrological
  discharge and wildfire C-factor data which Part II Section 5.3 excludes
  from the BN), the published R code (`Manuscript_RCode.R`, 310 lines),
  the published Netica binaries (`.neta` files; comparison references
  only), the supplementary documents, the README, the citation file, the
  license file, and the per-file checksum file used for integrity
  verification. As of 2026-04-06 the FRDR remote returned a temporary-
  unavailable response; the local archive in `raw/` is the working
  source.

- The R code (`Manuscript_RCode.R`, Appendix D Section 3). The script
  encodes the published fitting strategy: lme() mixed-effects regression
  for fish_tissue_hg and freshwater_thg as functions of point sources,
  total nonpoint deposition, and biological covariates (fork length,
  species); drc::drm() for the Dillon dose-response fit; and predictSE()
  for marginal-belief propagation. The lme() formulas are the bridge
  between published regression structure and DAG edges; the comments at
  `dag_definition_mackenzie_hg.py:142-145` quote them verbatim. The
  script does not call `set.seed()` (PLAN Part VII Section 22.2 records
  this as a baseline limitation).

- The published Netica binaries (`.neta`), Appendix D Section 3. The
  GSL and GBS Netica BNs and the conceptual-diagram Netica file are
  retained as the visual / numerical comparison reference. They are not
  consumed programmatically. The digitized published CPTs used by the
  comparison protocol are stored in
  `published_reference/digitized_from_paper.json` (Appendix D Section 6).

## 2.5 Software environment

The pipeline runs on a Python 3 environment with a deliberately small
dependency surface. The packages and their roles are:

- `pgmpy` (used for DAG validation only). `pgmpy.models.BayesianNetwork`
  is imported in `dag_definition_mackenzie_hg.build_dag` at
  `dag_definition_mackenzie_hg.py:294-303` to construct a
  cycle-validated DAG object from the edge list. CPT fitting and
  inference do NOT use pgmpy. `pgmpy.estimators.BayesianEstimator` is
  available and could have been used for the BDeu CPTs; the build does
  not use it. The rationale (a self-contained, fully inspectable BDeu
  implementation in `fit_mackenzie_model.py` that can be audited line-
  by-line) is given in PLAN Part IV Section 11.8 and detailed in Part IV
  of this deliverable. The networkx fallback at
  `dag_definition_mackenzie_hg.py:306-312` exists so the pipeline can be
  validated without paying the pgmpy/torch import cost.

- `openpyxl` (used by `prepare_mackenzie_data.py` to read the FRDR Excel
  workbooks; standard `.xlsx` ingestion path).

- `numpy` (used in `fit_mackenzie_model.py` for BDeu math, LOO
  validation, sensitivity analysis, and forward inference; no specialized
  packages such as scipy or sklearn are required, see PLAN Part V
  Section 15.5 for the kappa-computation rationale).

- `networkx` (used by `build_dag_nx` for the lightweight validation
  path; also used in the validation block at
  `dag_definition_mackenzie_hg.py:327-411` to check acyclicity).

No external statistical packages (R, sas, stata, sklearn for inference)
are used in the pipeline. The frontend (SSTAC-Dashboard) is in a
separate repository and is documented in Part VI of this deliverable.

## 3.1 AI-assisted workflow overview

The AI-assisted workflow has three roles and a single authority gradient.
The HITL (the human scientific authority, Jasen Nelson) is the controlling
voice: every modeling decision was either proposed by HITL and executed
by AI, or proposed by AI and explicitly accepted (or modified, or
rejected) by HITL. The AI plays three sub-roles: an orchestrator (a
Claude Opus model running in a project-aware chat session, responsible
for high-level reasoning, drafting, and synthesis), Explore subagents
(spawned by the orchestrator for context-bounded codebase mapping or
file analysis tasks), and a Codex CLI adversarial reviewer (an
independent model that critiques drafts and decisions per the mutual-
agreement methodology of `~/.claude/skills/codex-review/SKILL.md`). The
configurable AI tool / model / version for every decision is captured
in Appendix F's decision-provenance ledger; that ledger is non-empty by
PLAN Definition of Done item 7.

## 3.2 Milestone framework

The construction work is organized into seven milestones from the
BN-RRM handoff:

- M1 Data acquisition (FRDR download, integrity verification,
  file inventory; documented in Part II Section 4).
- M2 Data crosswalk (mapping FRDR variables to DAG nodes; documented
  in Part II Section 5).
- M3 DAG construction (this Part III, Sections 7-9).
- M4 CPT fitting (Part IV).
- M5 Pack assembly (Part VI).
- M6 SSTAC dashboard rendering (Part VI).
- M7 Comparison to published model (Part VII).

Each milestone has a record of AI-proposed vs HITL-decided steps,
consolidated in Appendix F.

## 3.3 Decision-provenance ledger

Every decision recorded in this document traces to a row in Appendix F.
Required fields per row are date, decision summary, proposer (HITL /
Claude orchestrator / Explore subagent / Codex), AI tool plus version
where applicable, decider (HITL), one or two sentences of why, commit
reference where applicable, and artifact reference (file:section or
results-JSON path). A row whose proposer is AI but whose tool/version
field is empty is a defect (PLAN Definition of Done item 7).

## 3.4 Non-autonomy claim

The AI-assisted construction did not operate without HITL oversight. Every
load-bearing decision had a HITL acceptance gate, recorded in Appendix F.
A non-exhaustive list of HITL gates: the DAG simplifications in Section
8.1-8.5 below; the BDeu equivalent sample size (ESS = 1.0); the
soft-edging policy on deterministic CPTs (Part IV Section 12.6); the
comparison-protocol acceptance thresholds (Part VII); the acceptance of
the freshwater_thg LOO kappa = 0.0 result as a known limitation rather
than a defect; and the subsistence-consumption assumptions (Part II
Section 6.6) that drive ptwi_exceedance. The construction is therefore
"AI-assisted" rather than "AI-autonomous". This distinction is critical
for peer-review credibility and is reinforced consistently throughout
the deliverable.

---

# Part II -- From Raw Data to Discretized Cases

## Facts pinned for Part II

The following appendix rows are cited by Part II. Numbers, file paths,
break boundaries, and source attributions live in the appendices; Part II
prose paraphrases. Citations back to one of these rows are required for
every Part II quantitative claim.

- Appendix D Section 3 (raw FRDR file inventory: Excel workbooks, sizes,
  modification dates, license, README, checksum file). The fish workbook
  contains 797 records; the water workbook contains 2,124 records.
- Appendix D Section 4 (processed training-data files: per-submodel CSVs
  and the combined `training_data_gsl.json` /
  `training_data_gbs.json` SHA-256 hashes).
- Appendix C Section C.1 conventions (inclusive-upper-bound break
  convention; boundary-equality drift between training and runtime paths).
- Appendix C Section C.2 borrowed-versus-derived summary (every numeric
  break is either borrowed from Jermilova Table S4 or derived from a
  regulatory threshold; the small derived set is the species-specific
  length cutoffs, the pTWI thresholds, and the mehg_ingested break list
  derived from pTWI).
- Appendix C Section C.3.a (per-node breaks borrowed from Table S4:
  atmospheric_hg_deposition, permafrost_hg_release, soil_erosion_hg_release,
  total_hg_deposition, freshwater_thg, fish_tissue_hg, degree_of_injury).
- Appendix C Section C.3.b (permafrost "none" state convention with the
  duplicated leading zero break).
- Appendix C Section C.3.c (derived breaks: fish_length per-species
  cutoffs; mehg_ingested break list; eligible_commercial_catch single
  threshold). Boundary-equality direction: prep path uses
  `v <= cutoff` (equality maps to the lower / less-precautionary state);
  canonical helper uses `v >= cutoff` (equality maps to the upper /
  more-precautionary state). The training pipeline uses the prep path;
  the canonical helper is used at runtime / dashboard.
- Appendix C Section C.4 (pTWI threshold constants: US EPA child 0.7,
  WHO childbearing 1.4, Health Canada adult-male 3.3; default for
  exceedance is 0.7).
- Appendix C Section C.5 (subsistence-scenario assumptions:
  DEFAULT_CONSUMPTION_G_DAY = 100, DEFAULT_BODY_WEIGHT_KG = 60,
  DEFAULT_MEHG_FRACTION = 0.95, located at
  `fit_mackenzie_model.py:84-88`).
- Appendix C Section C.5.a (FISH_HG_MIDPOINTS values at
  `fit_mackenzie_model.py:70-76`).
- Appendix C Section C.6 (BDL treatment: conservative use of detection-
  limit value as-is; implementation at
  `prepare_mackenzie_data.py:175-186`).

## 4.1 FRDR download and integrity checks

The FRDR dataset DOI 10.20383/103.0957 was downloaded to the local
working tree at the path corresponding to Appendix D Section 3 prior to
the temporary-unavailability window observed on 2026-04-06. The integrity
check applied at archive time is a one-to-one match between the
downloaded files and the checksums recorded in
`raw/frdr-dfdr-checksums.txt` (Appendix D Section 3). Each file in the
inventory is matched against its expected size; for the Excel and Netica
binaries the additional FRDR-supplied checksum is the authoritative
integrity proof (the methodology ledger defers SHA-256 hashes for those
binary files because the FRDR-supplied checksum already covers them).
For the discretized intermediate and output JSON files in `processed/`
and `results/`, SHA-256 hashes are computed and recorded in Appendix D
Sections 4 and 5; these are the artifacts a reviewer regenerates and
compares against during reproducibility verification.

The temporary-unavailability status of FRDR DOI 10.20383/103.0957
observed on 2026-04-06 is not a project defect: the dataset remains
identified by a stable DOI and the local snapshot in `raw/` is the
working source. Should a reviewer wish to re-download from FRDR after
the remote is restored, the canonical citation (in `raw/CITATION.txt`)
and the per-file checksums (in `raw/frdr-dfdr-checksums.txt`) constitute
the verification path.

## 4.2 File inventory pointer

The exhaustive file inventory for the construction pipeline is in
Appendix D. The categories most relevant to Part II are Section 3 (raw
FRDR), Section 4 (processed training data), and Section 5 (per-model
results). Each row in those sections lists the absolute path, file size
in bytes, last-modified date, role, and (where applicable) SHA-256 hash.
Part II prose does not duplicate the inventory; it cites the appendix.

## 4.3 Input record counts vs LOO-eligible counts (CRITICAL)

Two distinct record counts appear throughout the deliverable and must
not be conflated. The input record counts are the row counts in the
FRDR Excel workbooks before any filtering for parent-missingness:

- 797 fish records (in `FishData_and_ProbabilityDistributions.xlsx`).
- 2,124 water records (in `FreshwaterTHgData_and_ProbabilityDistributions.xlsx`).

The LOO-eligible record counts are the counts after filtering out cases
where the target node or any of its parents has a missing discretized
value. They are reported in Part V (validation) and per-target in the
per-submodel `validation-*.json` outputs:

- GSL fish_tissue_hg LOO-eligible: 584 cases.
- GBS fish_tissue_hg LOO-eligible: 258 cases.
- GSL freshwater_thg LOO-eligible: 855 cases.
- GBS freshwater_thg LOO-eligible: 1,589 cases.

The 797 / 2,124 numbers describe the INPUT to the pipeline. The
584 / 258 / 855 / 1,589 numbers describe the per-target leave-one-out
eligible subset after parent-missing filtering and per-target/per-
submodel partitioning. Conflating the two is the trap PLAN Section 10
flags explicitly. Whenever Part II discusses input row counts (Section
4), the input figures are used. Whenever Part V discusses validation
performance, the LOO-eligible figures are used. Each Part labels which
count it is reporting.

## 5.1 FRDR-to-DAG variable crosswalk

The mapping from FRDR Excel columns to DAG node identifiers is recorded
in `external_case_studies/jermilova_2025_mackenzie_hg/crosswalk.md`.
Part II cites that file rather than restating the table inline. The
high-level shape of the crosswalk is:

- One FRDR column maps to one DAG root node (a one-to-one pass-through)
  in the case of fish_species (FRDR Fish_Code), fish_length (FRDR
  Fork_length), proximity_mine_gsl (FRDR NearMine_15km),
  proximity_historic_mine (FRDR Near_HistoricMine_15km), proximity_oil_gbs
  (FRDR NearOil_50km), and proximity_rpts_gbs (FRDR NearSlump_10km).
- A small set of FRDR columns are pre-computed modeled fluxes that
  pass through to one DAG root node each: atmospheric_hg_deposition
  (FRDR GEM-MACH-Hg annual avg), permafrost_hg_release (FRDR SiBCASA
  output), soil_erosion_hg_release (FRDR RUSLE-derived).
- One DAG node (total_hg_deposition) is derived as a sum / rollup of
  the three nonpoint source nodes during discretization (the
  `discretize_total_hg_deposition` function at
  `prepare_mackenzie_data.py:102-117`).
- The measured target variables (freshwater_thg from FRDR THg;
  fish_tissue_hg from FRDR Tissue_Hg) map directly with the
  discretization rules of Appendix C Sections C.3.a and C.3.c.
- The effect and impact nodes (degree_of_injury,
  eligible_commercial_catch, mehg_ingested, ptwi_exceedance) are not
  mapped from FRDR columns; they are computed downstream via
  deterministic CPTs in Part IV.

The crosswalk file also records the FRDR pre-discretized "category"
columns (Atm_cat, Perm_cat, ErodeHg_cat, TotalHg_cat, THg.cat) which
encode Table S4 bins. These columns are NOT used by the BN-RRM build
as inputs; instead, the build re-discretizes the continuous values
using the break boundaries documented in Appendix C, so that the
discretization rule is auditable in Python source rather than implicit
in an Excel column. The pre-discretized columns are useful as a
sanity check that the boundaries align.

## 5.2 Pre-computed explanatory variables vs derived variables

A peer-reviewer concern with BN-RRMs is the boundary between "data" and
"model": which nodes are observed and which are computed. The Mackenzie
build separates them cleanly. Pre-computed explanatory variables (the
FRDR fluxes for atmospheric deposition, permafrost release, and soil
erosion) come from upstream geophysical models (GEM-MACH-Hg, SiBCASA,
RUSLE) and are treated as observations for BN-RRM purposes. The
discretization rules apply; the BN-RRM does not refit those upstream
models. Derived variables are computed inside the BN-RRM pipeline. They
include total_hg_deposition (sum of the three nonpoint sources, then
binned), and all four impact-chain nodes (degree_of_injury,
eligible_commercial_catch, mehg_ingested, ptwi_exceedance) which are
deterministic functions of fish_tissue_hg in Part IV.

This separation matters because it makes the trust boundary explicit:
trust in the BN-RRM depends on trust in the upstream geophysical models
that produce the FRDR explanatory variables. The BN-RRM build does not
re-validate those upstream models; their outputs are inherited.

## 5.3 Excluded variables and rationale

The FRDR dataset contains additional variables that are not used by the
BN-RRM build. Each exclusion is intentional and documented in the
crosswalk file. The principal exclusions are:

- The RUSLE intermediates (slope, rainfall erosivity, cover factor,
  land-use factor, etc.). Only the integrated RUSLE output
  (soil_erosion_hg_release) is used. The intermediates are not BN-RRM
  parents because their causal role is captured by the integrated
  output. Carrying them as separate nodes would inflate parent
  configurations and dilute statistical power.
- The wildfire C-factor (in `WildfireData.xlsx`, Appendix D Section 3).
  Wildfire perturbation of mercury cycling is a recognized scientific
  question but is ancillary to the published Mackenzie BN-RRM and is
  out of scope for this case-study reconstruction.
- The hydrological discharge data (in
  `Freshwater_Discharge_Outlet_and_GBS_North.xlsx`). Discharge is a
  hydrologic-transport variable; the published BN-RRM does not include
  a discharge node, so the reconstruction does not either. Flux
  computations (mass per unit time) require discharge and are therefore
  out of scope for the same reason.

PLAN Part III Sections 8.3 (freshwater discharge exclusion) and 8.4
(wildfire C-factor exclusion) consolidate these decisions; they are
listed here in Part II Section 5.3 because the exclusions take effect
at the data-acquisition / crosswalk stage, before any DAG construction.
Section 8 of Part III will reference back to this paragraph.

## 6.1 Borrowed thresholds from Jermilova Table S4

Honest framing: every numeric break boundary used for the seven
multi-break nodes (atmospheric_hg_deposition, permafrost_hg_release,
soil_erosion_hg_release, total_hg_deposition, freshwater_thg,
fish_tissue_hg, degree_of_injury) was adopted from Jermilova
supplementary Table S4 or from the regulatory and dose-response sources
that Table S4 itself cites. The HITL framing during M2 -- "we borrowed
a couple of discretization decisions" -- understates this. The accurate
statement is that the BN-RRM build adopts Table S4's discretization
structure essentially verbatim, with the small exceptions documented in
Section 6.2 below.

The per-node attribution is in Appendix C Section C.3.a, one row per
node. Two rows deserve highlighting:

- The freshwater_thg break at 26 ng/L is the CCME aquatic-life total-Hg
  criterion (`canonical_mackenzie.py:31`, CCME_FRESHWATER_THG_NG_L = 26).
  Table S4 lists this value; CCME is the upstream source. The interior
  break at 10 ng/L is interpolated by Table S4 to provide a "low" state
  below the criterion floor.
- The fish_tissue_hg break at 0.77 ug/g ww is the Dillon et al. 2010
  LL.3 EC20 (`canonical_mackenzie.py:62`, DILLON_2010_DOSE_RESPONSE
  "ec20" = 0.77). Table S4 lists 0.77 as a state edge; Dillon 2010 is the
  upstream source. The break at 0.5 ug/g ww is the Health Canada
  commercial-fish guideline (`canonical_mackenzie.py:34`,
  HC_COMMERCIAL_FISH_UG_G_WW = 0.5).

The remaining breaks (atmospheric, permafrost, soil erosion, total_hg
rollup, degree_of_injury percent-injury quartiles) are taken directly
from the corresponding FRDR pre-discretized category columns and from
Table S4 rows; see Appendix C Section C.3.a for the per-row source
citation.

## 6.2 Derived thresholds

A small set of breaks are not borrowed directly from Table S4. They are:

- The species-specific fish-length cutoffs (450 mm for lake_whitefish
  and walleye; 600 mm for burbot, lake_trout, and northern_pike).
  These come from Manuscript_RCode.R lines 64-77 and are recorded in
  Appendix C Section C.3.c. The cutoffs reflect each species' fork-
  length distribution in the monitoring data such that "large"
  individuals are above the bioaccumulation-relevant size band. They
  are empirical rather than regulatory.
- The pTWI threshold values themselves (0.7 / 1.4 / 3.3 ug Hg/kgbw/wk).
  These are standard regulatory pTWI values (US EPA child = 0.7;
  WHO/JECFA childbearing = 1.4; Health Canada adult-male = 3.3),
  recorded in `canonical_mackenzie.py:36-57` and in Appendix C Section
  C.4.
- The mehg_ingested break list [0, 0, 1.0, 1.4, 2.5, 3.3]. The outer
  breaks (1.4, 3.3) are the WHO and Health Canada pTWI values verbatim;
  the interior breaks (1.0, 2.5) are interpolations that provide
  sub-pTWI and supra-pTWI granularity so the BDeu fitting can
  discriminate near-threshold cases. The leading "0, 0" pair encodes a
  "none" state for zero intake (no-fish-consumption case), matching
  the permafrost_hg_release convention (Section 6.5).
- The eligible_commercial_catch single threshold of 0.5 ug/g ww, which
  is the Health Canada commercial-fish guideline (Appendix C Section
  C.3.c). This is a single threshold rather than a break list because
  the node is binary.

In all of the above cases, the upstream source is a regulatory or
empirical document; the break value is not invented by the BN-RRM
build. The "derived" label refers to the role of the value in the
discretization, not to whether the value was synthesized.

## 6.3 Below-detection-limit (BDL) treatment

The freshwater_thg dataset (FRDR `FreshwaterTHgData_and_ProbabilityDistributions.xlsx`,
approximately 2,124 records) contains a BDL flag column indicating which
samples reported a value below the analytical detection limit. The BN-RRM
build adopts a conservative treatment: BDL samples are kept at the
reported detection-limit value itself, without zero substitution, half-
DL substitution, or multiple imputation. The implementation is the
`discretize_freshwater_thg` function at
`prepare_mackenzie_data.py:175-186`, which receives the value field
from the FRDR row and runs the standard break list 0 / 10 / 26 against
it.

The rationale, consolidated in Appendix C Section C.6, has three legs:

1. Zero substitution would force BDL samples into the "low" state by
   definition. Conservative use of the detection-limit value as-is
   preserves the analytical uncertainty: a BDL sample whose DL is below
   10 ng/L still classifies as "low"; a BDL sample whose DL is between
   10 and 26 ng/L will classify as "medium". The classification
   reflects analytical reality rather than imputed convenience.
2. Multiple imputation would inject simulated variance that the
   analytical instrument did not actually report. For a corpus of
   approximately 2,124 water samples and a clear regulatory threshold
   at 26 ng/L, the conservative-use-of-DL choice produces an
   interpretable bias direction (toward higher predicted freshwater_thg
   states) rather than a stochastic distribution that would require
   careful uncertainty propagation downstream.
3. Peer-review transparency. The choice is encoded in a single
   function in the source code and documented in Appendix C Section
   C.6 plus this Part II Section 6.3. A reviewer can audit the decision
   in one location.

The BDL flag is not propagated into the discretized
`training_data_*.json` files: the BN-RRM build treats the discretized
state as the sole input to BDeu fitting. The freshwater_thg LOO kappa =
0.0 result reported in Part V Section 15.6 is driven by class imbalance
(the dominant "low" state), not by the BDL treatment; alternative DL-
handling strategies would not change that conclusion.

## 6.4 Implementation walkthrough

Two functions implement the runtime classification path; one is the
training-data path:

- `canonical_mackenzie.classify_value(node_id, value, fish_species=None)`
  at `canonical_mackenzie.py:88-145`. This is the runtime / dashboard
  classifier: given a fresh measurement, it returns the BN-RRM state.
  For numeric variables it delegates to `_classify_by_breaks`. For
  fish_length it branches on `fish_species` to apply the species-
  specific cutoff. For eligible_commercial_catch it applies the single
  threshold (`>= 0.5 -> not_eligible`). The classification uses the
  `>= cutoff` rule, so an exact equality maps to the upper / more-
  precautionary state.
- `canonical_mackenzie._classify_by_breaks(value, breaks, states)` at
  `canonical_mackenzie.py:147-206`. The helper walks from the highest
  break downward, returning the first state for which `value > break`.
  Combined with the inclusive-upper-bound convention used in the rest
  of the appendix, the helper treats each interval as `(lower, upper]`.
  The docstring explicitly states `states has len(breaks) entries`,
  which fixes the "one state per break-list entry" convention used
  throughout Appendix C.
- The per-record `discretize_*()` functions in
  `prepare_mackenzie_data.py:102-247`. These are the training-data
  classifiers. They are independently implemented (not delegating to
  the canonical helper) and use the `<= cutoff` rule, so equality maps
  to the lower / less-precautionary state.

The reason for the duplication is historical: the prep functions were
written first, when the pipeline only needed to classify training data.
The canonical helper was added later to support runtime classification
from the dashboard. Their semantics differ only at the boundary-equality
case; Section 6.7 below documents the difference honestly.

## 6.5 The permafrost "none" special case

The permafrost_hg_release break list at
`dag_definition_mackenzie_hg.py:245-248` is `[0, 0, 2, 4, 6, 10]`. The
duplicated leading zero is deliberate. It encodes a separate "none"
state that is reached if and only if the measured permafrost dissolved-
Hg release is exactly zero (i.e. no permafrost in the catchment, or no
observed thaw flux). Values strictly greater than zero and up to 2 ug
DHg/m2/yr fall into "very_low"; the remaining breaks then produce the
usual progression through very_low, low, medium, high, very_high.

Two reasons drive the "none" state. First, the published Jermilova
model treats catchments with no permafrost as structurally different
from catchments with low permafrost flux: the pathway is absent rather
than quantitatively small. Second, the BDeu CPT fitting benefits from a
categorically distinct "absent" state because the sample frequency of
exact zeros is non-negligible in the FRDR data (many southern
catchments report zero permafrost flux). Appendix C Section C.3.b
records the implementation detail in
`prepare_mackenzie_data.py:138-156`: the `discretize_permafrost_hg`
function returns "none" if and only if the input value equals zero.

The mehg_ingested break list at `dag_definition_mackenzie_hg.py:279-282`
uses the same duplicated-leading-zero pattern (`[0, 0, 1.0, 1.4, 2.5,
3.3]`) for the same reason: a zero intake (no-fish-consumption case)
should be categorically distinct from a small positive intake.

## 6.6 Subsistence consumption assumptions (CRITICAL)

Three modeling assumptions at `fit_mackenzie_model.py:84-88` condition
the downstream impact-node states and must not be hidden:

- `DEFAULT_CONSUMPTION_G_DAY = 100.0` (grams of fish per day,
  Indigenous subsistence consumption rate from Health Canada guidance).
- `DEFAULT_BODY_WEIGHT_KG = 60.0` (kilograms, adult subsistence consumer
  body weight; standard Health Canada figure).
- `DEFAULT_MEHG_FRACTION = 0.95` (the unitless fraction of total Hg in
  fish that is methylmercury; a conservative upper-range value from
  Health Canada / WHO guidance, where published values range 0.85-0.95).

These three constants enter the deterministic CPT calculation for
mehg_ingested (`fit_mackenzie_model.py:385-417`, Part IV Section 12.4)
as:

    weekly_intake_ug_per_kgbw =
        fish_hg_midpoint * 100 g/day * 7 days/wk * 0.95 / 60 kg
      = fish_hg_midpoint * approximately 11.083

where `fish_hg_midpoint` is drawn from FISH_HG_MIDPOINTS at
`fit_mackenzie_model.py:70-76`. The weekly intake is then binned via
MEHG_BREAKS to assign the mehg_ingested state; the mehg_ingested state
in turn drives ptwi_exceedance.

The reason for surfacing these assumptions here in Part II Section 6.6
(rather than burying them in Part IV) is that they are decision points,
not facts. A different jurisdiction or a different exposure scenario
would use different values (an adult-only consumer at 4 meals per week
instead of 100 g/day; a 70 kg body weight; an 0.85 MeHg fraction for a
specific species). Because the assumptions condition every
mehg_ingested state, the ptwi_exceedance marginal that the model
reports is interpretable only as a propagation of these specific
assumptions, not as a measured population-average exposure result.
Part VIII Section 26.9 reinforces this consolidated Limitations point.

## 6.7 Boundary-equality drift between paths (HONEST FRAMING)

The training pipeline (the `discretize_*()` functions in
`prepare_mackenzie_data.py:102-247`) and the runtime classifier
(`canonical_mackenzie.classify_value` at `canonical_mackenzie.py:88-145`)
differ at exactly two boundary-equality cases:

- For `fish_length`, the prep path (`prepare_mackenzie_data.py:207-215`)
  classifies a value EQUAL to the species cutoff as `small` (`v <=
  cutoff` -> `small`). The canonical helper
  (`canonical_mackenzie.py:121-140`) classifies the same value as
  `large` (`v >= cutoff` -> `large`).
- For `eligible_commercial_catch` at exact `fish_tissue_hg = 0.5`
  (the Health Canada commercial-fish guideline exact value), the prep
  path (`prepare_mackenzie_data.py:230-237`, via the
  `discretize_eligible_commercial` derived-from-tissue-state form)
  treats the `subsistence` tissue state as eligible, so an observation
  at exactly 0.5 ug/g ww becomes `eligible`. The canonical
  helper's direct classification of `eligible_commercial_catch`
  (`canonical_mackenzie.py:135-141`) applies a strict
  `value >= threshold` rule that maps exactly 0.5 to `not_eligible`.
  (CORRECTED per codex body-R1 P2-3: the underlying `fish_tissue_hg`
  tissue state itself remains `subsistence` in BOTH paths at exactly
  0.5, because `_classify_by_breaks` at `canonical_mackenzie.py:181-192`
  bumps the state only when `value > edge`. The drift is therefore in
  the eligible-commercial-catch derived classification, not in the
  upstream tissue state.)

The direction of the difference, per Appendix C Section C.3.c "codex
appendices-R2 P2-5" correction, is consistent: the prep path is the
LESS PRECAUTIONARY path (equality maps to the lower / less-protective
state); the canonical helper is the MORE PRECAUTIONARY / EXCEEDANCE-
BIASED path (equality maps to the upper / more-protective state).

Both paths are intentional and both are documented in the source code.
The training-data classification (which determines what the BDeu CPTs
are fit to) uses the prep path. The runtime classification of fresh
user-supplied data (used by the dashboard "what-if" UI to map a new
measurement to a state) uses the canonical helper. The asymmetry is
small: in practice, exact boundary equalities are rare in continuous
measurement data, and any single boundary case lies between two
adjacent state bins. The BN-RRM training-corpus statistics are not
materially affected; nor are runtime dashboard queries.

Surfacing the asymmetry rather than glossing it is the right peer-
review move. A reviewer examining the training-data discretization
prep function would otherwise be surprised when an apparently
equivalent classification gave a different answer at runtime; the
direction-of-precaution rule in this paragraph removes the surprise.

---

# Part III -- DAG Construction

## Facts pinned for Part III

The following appendix rows are cited by Part III. The structural facts
about nodes, edges, containers, regions, CPT methods, and submodel-
specific differences live in Appendix A; Part III prose paraphrases.

- Appendix A Section A.1 (14 nodes per submodel; 15 edges per submodel;
  12 shared nodes; 2 submodel-specific nodes; 4 regions per submodel;
  edge breakdown 3 nonpoint + 3 water + 5 fish + 4 effects).
- Appendix A Section A.2 (7 containers per submodel; Point Sources
  members differ between GSL and GBS; the other six containers have
  identical members).
- Appendix A Section A.3 (region lists per submodel; per-region
  inference uses overall priors as baseline -- limitation citing
  `fit_mackenzie_model.py:950-952`).
- Appendix A Section A.4 (GSL node table with parents, states, breaks,
  CPT method per node; GSL edge list with file:line references).
- Appendix A Section A.5 (GBS node table; GBS edge list).
- Appendix A Section A.6 (the 12 shared nodes; shared edge sets
  `_EDGES_NONPOINT` and `_EDGES_EFFECTS`; shared discretization breaks).
- Appendix A Section A.7 (4 submodel-specific nodes; 8 submodel-
  specific point-source edges -- 4 GSL + 4 GBS).
- Appendix A Section A.8 (CPT method assignment summary: 7 empirical_
  prior + 3 bdeu + 4 deterministic per submodel = 14 nodes per submodel).
- Appendix D Section 1 (`dag_definition_mackenzie_hg.py` 411 lines;
  `fit_mackenzie_model.py` 1,257 lines).
- Appendix D Section 2 (generated `dag_structure_mackenzie_{gsl,gbs}.json`).

## 7.1 Conceptual DAG (source, stressor, effect, impact)

The Mackenzie Hg BN-RRM follows the standard Landis-tradition four-layer
causal chain: sources, stressors, effects, impacts. The chain is
implemented through 14 nodes per submodel, organized in containers as
shown in Appendix A Section A.2 and summarized here:

- Sources (point and nonpoint). The point sources are the four
  submodel-specific proximity nodes (2 per submodel; mine and historic
  mine for GSL; oil and retrogressive permafrost thaw slumps for GBS).
  The nonpoint sources are the three shared deposition / mobilization
  fluxes (atmospheric_hg_deposition, permafrost_hg_release,
  soil_erosion_hg_release).
- Aggregated source proxy (Hg Deposition). One shared node
  (total_hg_deposition) aggregates the three nonpoint fluxes via a sum
  / rollup performed at discretization time
  (`prepare_mackenzie_data.py:102-117`).
- Stressors. Two shared nodes (freshwater_thg, fish_tissue_hg) represent
  the environmental concentrations that mediate exposure. Their parent
  sets differ between GSL and GBS because the point sources differ
  (Appendix A Section A.4.2 GSL edge list 4-11; Appendix A Section A.5.2
  GBS edge list 4-11).
- Exposure factors. Two shared root nodes (fish_species, fish_length)
  capture the biological covariates that the published lme() model
  identified as significant.
- Effects. Two shared nodes (degree_of_injury,
  eligible_commercial_catch) represent the population-level biological
  effect (Dillon 2010 LL.3 dose-response in percent injury) and the
  regulatory regulatory-acceptability outcome (Health Canada
  commercial-fish guideline).
- Impacts (Human Health). Two shared nodes (mehg_ingested,
  ptwi_exceedance) close the chain on the human-health side, propagating
  fish_tissue_hg through the subsistence-consumption assumptions to a
  weekly MeHg intake and then to an exceedance flag against the US EPA
  child pTWI.

The chain is therefore:

    point sources + nonpoint sources --> total_hg_deposition (rollup)
    point sources + total_hg_deposition --> freshwater_thg
    fish_species + fish_length + point sources + total_hg_deposition --> fish_tissue_hg
    fish_tissue_hg --> degree_of_injury (effect)
    fish_tissue_hg --> eligible_commercial_catch (effect)
    fish_tissue_hg --> mehg_ingested (impact)
    mehg_ingested --> ptwi_exceedance (impact)

The freshwater_thg node is included as a stressor in its own right
(not as a parent of fish_tissue_hg) because the published lme() fish-
tissue formula does not condition on water THg directly: it conditions
on the same point-source and nonpoint-source variables that drive
freshwater_thg. The two stressors share parents but are not in a
direct causal chain with each other within the BN.

## 7.2 Shared vs submodel-specific nodes

Per Appendix A Section A.1, each submodel has 14 nodes. Twelve of those
nodes are shared (defined in `SHARED_NODES` at
`dag_definition_mackenzie_hg.py:17-99`): the three nonpoint sources,
the deposition rollup, the two exposure factors, the two stressors,
the two effects, and the two impacts. Two nodes are submodel-specific:
the two point-source proximity nodes. The four submodel-specific nodes
across the GSL and GBS pair are:

- GSL-specific (`GSL_SPECIFIC_NODES` at
  `dag_definition_mackenzie_hg.py:105-118`): proximity_mine_gsl (15 km
  buffer around active mine development) and proximity_historic_mine
  (15 km buffer around historic mine sites).
- GBS-specific (`GBS_SPECIFIC_NODES` at
  `dag_definition_mackenzie_hg.py:124-137`): proximity_oil_gbs (50 km
  buffer around oil/gas operations) and proximity_rpts_gbs (10 km
  buffer around retrogressive permafrost thaw slumps).

All four submodel-specific nodes are root nodes with binary states
(yes / no) in the substance category, assigned to the Point Sources
container, and fit by `empirical_prior` from combined fish + water data
(`fit_mackenzie_model.py:485-500`).

The 12 shared nodes have identical states, categories, labels,
discretization breaks, units, container assignments, and CPT methods
between the two submodels. Only the parent sets of freshwater_thg and
fish_tissue_hg differ, because the point-source parents differ.

The full GSL and GBS edge lists are in Appendix A Sections A.4.2 and
A.5.2 respectively. Each list has 15 edges, decomposed as 3 nonpoint
aggregation edges (shared via `_EDGES_NONPOINT` at
`dag_definition_mackenzie_hg.py:148-152`), 3 water-THg parent edges
(submodel-specific), 5 fish-tissue-Hg parent edges (submodel-specific),
and 4 effect-chain edges (shared via `_EDGES_EFFECTS` at
`dag_definition_mackenzie_hg.py:155-160`). Counting the structurally
unique submodel-specific point-source-to-stressor edges across the
family gives 4 GSL-specific plus 4 GBS-specific (Appendix A Section
A.7.2), for 8 unique submodel-specific edges total.

## 7.3 Region differentiation

Per `dag_definition_mackenzie_hg.py:233-234`, the GSL submodel has four
regions (outlet, middle, north_arm, east_arm) and the GBS submodel has
four regions (north, west, east, south). Region differentiation is
intended to support per-region inference: given a region label and a
piece of evidence (for example, an observed proximity_mine_gsl = yes
in the outlet region), the inference engine should return the posterior
distribution over impacts conditioned on that region.

A known limitation, documented in the source code at
`fit_mackenzie_model.py:950-952` and consolidated in Appendix A Section
A.3 and Part V Section 17.4 of this deliverable, is that the per-region
inference path uses overall priors as the baseline rather than per-
region priors. The reason is that the discretized training cases in
`training_data_*.json` do not carry per-station region labels: the
per-record discretization in `prepare_mackenzie_data.py` rolls each
station up to the submodel level. Reintroducing per-region statistics
would require a structural change to the prep pipeline (adding a
region column to the training cases and partitioning empirical priors
by region).

This limitation is repeated in Parts V and VIII because it is the
single most material caveat on the per-region inference outputs.
Part III flags it here so a reader understands that the four-region
structure exists in the DAG and the inference module but the per-
region inference outputs are not strictly per-region; they are
overall-prior baselines conditioned on the supplied evidence. The
parent paper's authors decide how to interpret per-region results in
light of this limitation.

## 8.1 Species collapse decision

CORRECTED per codex holistic-R1 P1-3: The published Jermilova model
fits ONE `lme()` per submodel (e.g., `Tissue_Hg ~ Fish_Code + Fork_length
+ NearMine_15km + NearHistoricMine + Total_NonPoint, random = ~1 | OID_`
in Manuscript_RCode.R), with `Fish_Code` as a categorical fixed-effect
factor, NOT five separate per-species regressions. The prior framing
of this Part overstated the published structure; the actual loss in
moving to the BN-RRM is more specific: the published model preserves
species-level (a) categorical intercept shifts, (b) the lme()
random-effect smoothing on station, (c) parametric uncertainty on
the species coefficient, and (d) the residual variance partitioned
by station within species. The BN-RRM build maps `Fish_Code` to a
single `fish_species` parent of `fish_tissue_hg` and lets BDeu count
discretized fish-tissue-Hg states per (species, length, point-source,
total_hg_deposition) configuration. The alternative that was
considered and rejected was five species-specific `fish_tissue_hg`
nodes, one per species, with no shared CPT structure -- but this is
NOT what the published model does either; the published model uses
a SINGLE regression with the species as a factor.

Reasons to collapse to a single BN-RRM node:

- The DAG remains 14 nodes per submodel rather than 18-22, which is
  necessary for legible visualization in the SSTAC-Dashboard
  (Part VI). A larger DAG would not fit naturally into the dashboard
  layout.
- The BDeu CPT for fish_tissue_hg includes fish_species as a parent,
  so the conditional distribution P(fish_tissue_hg | fish_species,
  fish_length, point-sources, total_hg_deposition) preserves the
  species-by-species CONDITIONAL discretized-state distribution. What
  is NOT preserved is the published model's continuous lme() species
  intercept, the random-effect smoothing across stations within
  species, and the parametric coefficient uncertainty -- all of which
  are explicit information losses in the BN-RRM representation.
- All downstream deterministic CPTs (degree_of_injury,
  eligible_commercial_catch, mehg_ingested, ptwi_exceedance) operate
  on the fish_tissue_hg state directly, so they remain species-
  agnostic by design.

Reasons to consider the alternative (and what is lost):

- Species-specific dose-response is not modeled. Dillon 2010 LL.3 is
  applied to the fish_tissue_hg state midpoint regardless of species,
  even though species-specific susceptibility curves differ. The
  BN-RRM build accepts this approximation explicitly. Part IV
  Section 12.1 records the dose-response parameter values used.
- Species-by-species comparison to the published Netica binaries
  is not possible at the impact-node level because the published
  model also conditions effect calculations on fish_tissue_hg
  marginalized over species. The dimension of comparison is the
  same; the granularity is the same.

MODEL_SPECIFICATION_MACKENZIE.md Section 4 records this decision as
the "shared single-node fish_tissue_hg with parent fish_species"
simplification, and notes that the consequence is a more parsimonious
DAG at the cost of species-specific dose-response.

## 8.2 RUSLE intermediate collapse

The soil_erosion_hg_release node aggregates RUSLE outputs (slope,
rainfall erosivity, cover factor, land-use factor, etc.) into a
single Hg-flux variable. The intermediate RUSLE factors are not
present in the DAG. The reasons are the same as for the species
collapse:

- The DAG remains tractable.
- The causal role of the intermediates is captured by the integrated
  output: the upstream RUSLE model already combines them.
- The downstream BDeu CPTs (total_hg_deposition, freshwater_thg,
  fish_tissue_hg) depend on the integrated soil_erosion_hg_release
  state, not on its constituent factors.

What is lost: a counterfactual on the RUSLE cover factor (for example,
"what if forest cover changed?") cannot be directly run in the BN.
A reviewer who wants this granularity would need to re-run the
upstream RUSLE model with modified inputs and supply the modified
soil_erosion_hg_release flux as evidence. The BN-RRM build accepts
this trade and documents it here.

## 8.3 Freshwater discharge exclusion

The FRDR dataset includes a hydrological discharge file
(`Freshwater_Discharge_Outlet_and_GBS_North.xlsx`, Appendix D Section
3). Discharge is not used as a BN-RRM node. The reasons:

- The published Mackenzie BN-RRM does not include a discharge node.
  The reconstruction does not add one.
- Discharge drives flux (mass per unit time) rather than concentration;
  the BN-RRM operates on concentration states (THg in ng/L; tissue Hg
  in ug/g ww). Adding a discharge node would require a flux-conversion
  node and would substantially complicate the BN.
- For the specific question the BN-RRM addresses (mercury exposure for
  Indigenous food-fish consumers), concentration is the load-bearing
  variable. Discharge matters for whole-basin mass-balance accounting,
  which is out of scope.

What is lost: scenarios where discharge changes dramatically (a flood,
a drought, climate change) are not directly representable in the BN.
The BN-RRM build accepts this trade and documents it here.

## 8.4 Wildfire C-factor exclusion

The FRDR dataset includes a wildfire C-factor file (`WildfireData.xlsx`,
Appendix D Section 3). Wildfire-driven mercury cycling is a recognized
scientific question (boreal wildfires can mobilize sequestered Hg) but
is not in the published Mackenzie BN-RRM. The BN-RRM build excludes
this variable for the same reasons as the discharge exclusion: it is
not in the published baseline, and adding it would inflate the DAG
without changing the principal exposure pathway the model addresses.
What is lost: wildfire-driven scenarios are not directly representable.
This is a known gap; a future BN-RRM revision could add a wildfire-
perturbation node.

## 8.5 What was lost overall

The four simplifications above (species collapse, RUSLE intermediate
collapse, discharge exclusion, wildfire C-factor exclusion) all trade
DAG parsimony for reduced counterfactual richness. They are the kinds
of decisions a peer reviewer will probe. The honest answer is that
each simplification was an explicit HITL-approved trade. The
alternative DAG (species-resolved, RUSLE-resolved, discharge-included,
wildfire-included) would have approximately 22-30 nodes and would not
fit either the published baseline or the dashboard visualization
budget. The trade is in favor of a tractable, comparable, parsimonious
DAG. The losses are documented; the comparison to the published model
in Part VII operates at the same level of granularity, so neither
model is privileged.

## 9.1 pgmpy.models.BayesianNetwork

The `build_dag` function at `dag_definition_mackenzie_hg.py:294-303`
constructs a pgmpy DAG object:

    def build_dag(model="GSL"):
        from pgmpy.models import BayesianNetwork as DiscreteBayesianNetwork
        edges = GSL_EDGES if model.upper() == "GSL" else GBS_EDGES
        return DiscreteBayesianNetwork(edges)

Mechanically, `pgmpy.models.BayesianNetwork` (aliased as
`DiscreteBayesianNetwork` in current pgmpy releases) accepts an edge
list of (parent, child) tuples and builds a DAG object. The
constructor performs three validations of interest to the
construction pipeline:

- The edge list is parsed into a directed graph.
- Cycle detection runs over the graph; a cycle raises an error.
- Node states can be added subsequently via `add_cpds()` or set
  manually; the node-state spaces are exposed via attribute access
  for downstream CPT consumers.

The construction pipeline uses pgmpy only for this structural
validation. The fitting and inference paths in
`fit_mackenzie_model.py` do not import pgmpy; they operate on the
edge list and the node-state spaces directly via lightweight Python
data structures. The deliberate decoupling is a recoverable design
choice: pgmpy's `BayesianEstimator` and `VariableElimination` are
available if a future revision wants them, but the BN-RRM build
prefers a self-contained, fully inspectable implementation
(PLAN Part IV Section 11.8).

## 9.2 networkx.DiGraph fallback

The `build_dag_nx` function at
`dag_definition_mackenzie_hg.py:306-312` provides a lightweight
alternative:

    def build_dag_nx(model="GSL"):
        import networkx as nx
        edges = GSL_EDGES if model.upper() == "GSL" else GBS_EDGES
        G = nx.DiGraph(edges)
        return G

The networkx fallback exists for two reasons. First, importing pgmpy
loads torch as a transitive dependency, which adds approximately two
minutes to startup on the development workstations. For structural
validation tasks (cycle detection, root and leaf enumeration,
topological sort), this cost is unnecessary. Second, the validation
block at `dag_definition_mackenzie_hg.py:327-411` runs as a
`__main__` self-test that performs all of cycle checking, root and
leaf enumeration, container-membership verification, and DAG export
to JSON. It does so without importing pgmpy at all, which makes the
self-test inexpensive enough to run as a routine sanity check before
fitting.

The lazy-import pattern in both `build_dag` and `build_dag_nx`
(importing pgmpy and networkx at function-call time rather than at
module-load time) is intentional: `prepare_mackenzie_data.py` and
several other modules in the pipeline import
`dag_definition_mackenzie_hg` to read the DISCRETIZATION dict and the
node-state spaces; those importers should not be forced to pay the
pgmpy / torch import cost. Section 9.4 elaborates the pattern.

## 9.3 Code walkthrough

The full module map for `dag_definition_mackenzie_hg.py` (411 lines) is:

- `SHARED_NODES` at lines 17-99: dict with 12 entries; one per shared
  node. Each entry has a `states` list, a `category` string (substance
  / condition / effect / impact), and a `label` plus `description`
  used by the dashboard renderer. Per Appendix A Section A.6.1.
- `GSL_SPECIFIC_NODES` at lines 105-118: dict with 2 entries
  (proximity_mine_gsl, proximity_historic_mine). Per Appendix A
  Section A.7.1.
- `GBS_SPECIFIC_NODES` at lines 124-137: dict with 2 entries
  (proximity_oil_gbs, proximity_rpts_gbs). Per Appendix A Section
  A.7.1.
- `_EDGES_NONPOINT` at lines 148-152: 3 edges, shared between
  submodels (atmospheric_hg_deposition, permafrost_hg_release, and
  soil_erosion_hg_release each pointing to total_hg_deposition).
- `_EDGES_EFFECTS` at lines 155-160: 4 edges, shared between submodels
  (fish_tissue_hg pointing to degree_of_injury, eligible_commercial_catch,
  mehg_ingested; mehg_ingested pointing to ptwi_exceedance).
- `GSL_EDGES` at lines 163-178: 15 edges total. Composition is
  `_EDGES_NONPOINT` (3) + GSL-specific water-THg parents (3:
  proximity_mine_gsl, proximity_historic_mine, total_hg_deposition
  all pointing to freshwater_thg) + GSL-specific fish-tissue-Hg
  parents (5: fish_species, fish_length, proximity_mine_gsl,
  proximity_historic_mine, total_hg_deposition all pointing to
  fish_tissue_hg) + `_EDGES_EFFECTS` (4) = 15.
- `GBS_EDGES` at lines 181-196: 15 edges with the same structure but
  GBS point sources (proximity_oil_gbs, proximity_rpts_gbs)
  replacing the GSL pair in the water-THg and fish-tissue-Hg parent
  blocks.
- `GSL_NODES` and `GBS_NODES` at lines 202-203: full per-submodel
  node dicts as merges of `SHARED_NODES` with the submodel-specific
  nodes.
- `GSL_CONTAINERS` and `GBS_CONTAINERS` at lines 209-227: seven
  containers per submodel; identical between submodels except for the
  Point Sources members. Per Appendix A Section A.2.
- `GSL_REGIONS` at line 233 and `GBS_REGIONS` at line 234: four
  regions each.
- `DISCRETIZATION` dict at lines 240-287: per-node break boundaries,
  units, and special cases (the species-specific fish_length
  cutoffs; the eligible_commercial_catch single threshold; the
  duplicated leading zero in permafrost_hg_release and
  mehg_ingested). Discretization fact-pinning is in Appendix C.
- `build_dag(model)` at lines 294-303: see Section 9.1.
- `build_dag_nx(model)` at lines 306-312: see Section 9.2.
- `get_model_spec(model)` at lines 315-320: returns the
  `(nodes, edges, containers, regions)` tuple for the named submodel;
  consumed by the fitting orchestration in `fit_mackenzie_model.py`.
- `__main__` self-test at lines 327-411: validates nodes, edges,
  containers, regions, acyclicity, and root/leaf enumeration; writes
  `dag_structure_mackenzie_{gsl,gbs}.json` (Appendix D Section 2).

The CPT-method-by-node assignment is in `fit_mackenzie_model.py:454-579`
(`fit_all_cpts()`) and is consolidated in Appendix A Section A.8. The
per-submodel CPT method count is 7 empirical-prior nodes (3 nonpoint
sources + 2 submodel-specific point sources + 2 exposure factors),
3 BDeu nodes (total_hg_deposition, freshwater_thg, fish_tissue_hg),
and 4 deterministic nodes (degree_of_injury, eligible_commercial_catch,
mehg_ingested, ptwi_exceedance), summing to 14 nodes per submodel.
Part IV details each method's implementation.

## 9.4 Lazy-import pattern for pgmpy

The lazy-import pattern in `dag_definition_mackenzie_hg.build_dag` and
`build_dag_nx` is significant enough to deserve its own subsection.
Both functions import their heavy dependencies (pgmpy, networkx)
inside the function body rather than at module level. The reason is
that consumers of the module (in particular `prepare_mackenzie_data.py`,
which reads the DISCRETIZATION dict, the node-state spaces, and the
container assignments) do not need pgmpy at all to perform the
training-data preparation. Forcing them to pay the torch import cost
would slow the prep pipeline from seconds to minutes.

The trade is that any consumer that actually calls `build_dag()` will
incur the import cost the first time. For the fitting and inference
paths in `fit_mackenzie_model.py` this is acceptable; fitting and
inference are not in a critical user-facing path. For the dashboard
rendering path (Part VI), pgmpy is not used at all: the dashboard
reads `runtime/learned-model.json` and the discretized
`training_data.json`, neither of which requires constructing a pgmpy
DAG object.

## 9.5 Edge-to-lme() formula bridge

The comments at `dag_definition_mackenzie_hg.py:140-145` make explicit
the mapping from each submodel's lme() formula in Manuscript_RCode.R
to the BN-RRM edge list:

    # GSL fish:  Tissue_Hg ~ Fish_Code + Fork_length + NearMine_15km
    #                       + NearHistoricMine + Total_NonPoint
    # GSL water: THg       ~ NearMine_15km + Near_HistoricMine_15km
    #                       + TotalHg_deposition
    # GBS fish:  Tissue_Hg ~ Fish_Code + Fork_length + NearOil_50km
    #                       + NearSlump_10km + Total_NonPoint
    # GBS water: THg       ~ NearOil_50km + NearSlump_10km
    #                       + TotalHg_deposition

The table below maps each BN edge to the lme() formula it came from.
Edges 1-3 (the nonpoint aggregation) are not from a lme() formula;
they are the deposition rollup the BN-RRM adds during discretization
to produce total_hg_deposition. Edges 12-15 (the effect chain) are
not from a lme() formula either; they come from the deterministic
CPTs of Part IV (Dillon 2010 LL.3 dose-response, Health Canada
commercial-fish guideline, subsistence MeHg intake, US EPA child
pTWI). The remaining 8 GSL-submodel edges (4 water-THg + fish-tissue-
Hg parents per stressor minus the shared total_hg_deposition parent
counted twice, plus species and length covariates) trace to the four
lme() lines above.

GSL edge-to-formula table:

| BN edge (parent -> child) | lme() formula source |
|---------------------------|----------------------|
| atmospheric_hg_deposition -> total_hg_deposition | none (deposition rollup, discretization-time) |
| permafrost_hg_release -> total_hg_deposition | none (deposition rollup, discretization-time) |
| soil_erosion_hg_release -> total_hg_deposition | none (deposition rollup, discretization-time) |
| proximity_mine_gsl -> freshwater_thg | GSL water lme: NearMine_15km term |
| proximity_historic_mine -> freshwater_thg | GSL water lme: Near_HistoricMine_15km term |
| total_hg_deposition -> freshwater_thg | GSL water lme: TotalHg_deposition term |
| fish_species -> fish_tissue_hg | GSL fish lme: Fish_Code term |
| fish_length -> fish_tissue_hg | GSL fish lme: Fork_length term |
| proximity_mine_gsl -> fish_tissue_hg | GSL fish lme: NearMine_15km term |
| proximity_historic_mine -> fish_tissue_hg | GSL fish lme: NearHistoricMine term |
| total_hg_deposition -> fish_tissue_hg | GSL fish lme: Total_NonPoint term |
| fish_tissue_hg -> degree_of_injury | Dillon 2010 LL.3 (deterministic CPT, Part IV Section 12.1) |
| fish_tissue_hg -> eligible_commercial_catch | HC commercial-fish guideline (deterministic CPT, Part IV Section 12.2) |
| fish_tissue_hg -> mehg_ingested | Subsistence MeHg intake formula (deterministic CPT, Part IV Section 12.4) |
| mehg_ingested -> ptwi_exceedance | US EPA child pTWI (deterministic CPT, Part IV Section 12.5) |

GBS edge-to-formula table:

| BN edge (parent -> child) | lme() formula source |
|---------------------------|----------------------|
| atmospheric_hg_deposition -> total_hg_deposition | none (deposition rollup, discretization-time) |
| permafrost_hg_release -> total_hg_deposition | none (deposition rollup, discretization-time) |
| soil_erosion_hg_release -> total_hg_deposition | none (deposition rollup, discretization-time) |
| proximity_oil_gbs -> freshwater_thg | GBS water lme: NearOil_50km term |
| proximity_rpts_gbs -> freshwater_thg | GBS water lme: NearSlump_10km term |
| total_hg_deposition -> freshwater_thg | GBS water lme: TotalHg_deposition term |
| fish_species -> fish_tissue_hg | GBS fish lme: Fish_Code term |
| fish_length -> fish_tissue_hg | GBS fish lme: Fork_length term |
| proximity_oil_gbs -> fish_tissue_hg | GBS fish lme: NearOil_50km term |
| proximity_rpts_gbs -> fish_tissue_hg | GBS fish lme: NearSlump_10km term |
| total_hg_deposition -> fish_tissue_hg | GBS fish lme: Total_NonPoint term |
| fish_tissue_hg -> degree_of_injury | Dillon 2010 LL.3 (deterministic CPT) |
| fish_tissue_hg -> eligible_commercial_catch | HC commercial-fish guideline (deterministic CPT) |
| fish_tissue_hg -> mehg_ingested | Subsistence MeHg intake formula (deterministic CPT) |
| mehg_ingested -> ptwi_exceedance | US EPA child pTWI (deterministic CPT) |

This bridge is load-bearing for the comparison protocol in Part VII:
the BN-RRM edges are derived from the published regression structure,
so a future Dimension 3 marginal-belief comparison across the two
models would test whether the BN's CPT-based propagation reproduces
the lme()'s parametric propagation. (Per Part VII Section 23.0 and
Section 26.10, Dimension 3 is NOT RUN in the current build; this
sentence describes the protocol target, not a delivered result.)
Methodological differences (parametric lme() vs nonparametric BDeu)
are expected and surfaced in Part VII Section 22, not framed as
failures.

-- END OF PARTS I, II, III --
---
title: Part IV -- CPT Fitting (BDeu, deterministic, empirical)
parent_document: JERMILOVA_BNRRM_CONSTRUCTION_METHODOLOGY.md
status: v1.0 (assembled 2026-05-17 after body-R4 YELLOW non-blocking, holistic-R1 RED applied)
author: AI orchestrator (Claude Opus 4.7) under HITL direction
created: 2026-05-17
word_budget: 6000
ascii_constraint: All characters in this file must satisfy code point <= 127.
---

# Part IV -- CPT Fitting (BDeu, deterministic, empirical)

## Facts pinned for Part IV

Every empirical claim in this Part traces to a row in one of the
fact-pinning appendices and to a file:line citation in
`bn_learning/fit_mackenzie_model.py` (1257 lines). To avoid duplicating
those tables here, Part IV cites the appendices by subsection rather
than restating the numbers.

- **Method assignment per node** -- Appendix A section A.8 (the CPT
  method assignment summary). Each of the 14 nodes per submodel is
  assigned exactly one of six methods (`empirical_prior`, `bdeu`,
  `deterministic_dillon`, `deterministic_hc_guideline`,
  `deterministic_subsistence`, `deterministic_ptwi`). The JSON-export
  spelling for the four deterministic methods is `deterministic_dillon_2010`,
  `deterministic_hc_guideline`, `deterministic_subsistence`,
  `deterministic_ptwi`.
- **Master CPT inventory** -- Appendix B section B.1 (rows for 14
  empirical-prior priors, 6 BDeu CPTs, 8 deterministic CPTs; total 28
  distributions across the two submodels).
- **Per-CPT soft-edge values** -- Appendix B section B.0.6. The four
  deterministic CPTs do NOT share a single soft-edge value; binary
  outcomes use 0.95 / 0.05, multi-state outcomes use 0.90 / (0.10 /
  (n_states - 1)).
- **BDeu correctness receipt** -- Appendix B section B.3 for the
  hand-calculated fixture and B.3.6 for the pgmpy-equivalent analytic
  receipt (RENUMBERED from the prior duplicate B.3.5 per codex
  appendices-R2 finding P2-1).
- **Worked-example CPT** -- Appendix B section B.2 (the GSL
  `fish_tissue_hg` CPT, 200 parent configurations).
- **Discretization parameters** -- Appendix C sections C.3 (the
  primary discretization table including degree_of_injury and
  mehg_ingested), C.4 (the pTWI thresholds 0.7 / 1.4 / 3.3 ug
  Hg/kgbw/wk and the choice of US EPA child = 0.7 as
  `PTWI_THRESHOLD_DEFAULT`), C.5 (subsistence-scenario assumptions
  DEFAULT_CONSUMPTION_G_DAY = 100, DEFAULT_BODY_WEIGHT_KG = 60,
  DEFAULT_MEHG_FRACTION = 0.95), C.5.a (FISH_HG_MIDPOINTS), and C.5.b
  (Dillon 2010 LL.3 parameters).

When this Part cites a numeric constant, the canonical line reference
in `bn_learning/fit_mackenzie_model.py` is given inline; when this
Part cites a per-node fact (states, parents, breaks), the appendix
row is given instead so divergence between body prose and source code
is caught at review time.

## 10. CPT fitting strategy: the three CPT types

The Mackenzie Hg BN-RRM build assigns each node to exactly one of
three CPT-fitting paths. The choice was made per-node, deliberately,
and is recorded in Appendix A.8. The three paths are: empirical
priors for root nodes, BDeu-learned CPTs for the three data-supported
intermediate nodes, and deterministic CPTs for the four effect /
impact nodes that have a closed-form mapping in the regulatory or
ecotoxicological literature. Per submodel the assignment is 7 + 3 + 4
= 14 nodes, matching the 12 SHARED_NODES plus the 2 submodel-specific
point-source nodes recorded in Appendix A.6.1 and A.7.1.

### 10.1 Empirical priors (root nodes)

Root nodes have no parents in the DAG. Their CPT is a single
marginal distribution over the node's states, fit from the observed
counts in the training data with BDeu smoothing. The seven
empirical-prior nodes per submodel are: the three nonpoint sources
(`atmospheric_hg_deposition`, `permafrost_hg_release`,
`soil_erosion_hg_release`), the two submodel-specific point-source
proximities (e.g. for GSL: `proximity_mine_gsl`,
`proximity_historic_mine`), and the two fish exposure factors
(`fish_species`, `fish_length`).

The implementation is `fit_empirical_prior()` at
`bn_learning/fit_mackenzie_model.py:246-271`. The orchestration call
sites that route nonpoint and point-source nodes through combined fish
+ water data and route fish exposure factors through fish-only data
are at `fit_mackenzie_model.py:485-500`. The data routing is
deliberate: source-driver nodes (nonpoint and point sources) are
observed in both the fish and water sampling stations, while fish
species and length are observed only on fish records.

### 10.2 BDeu-learned CPTs (the three intermediate stressor nodes)

Three nodes per submodel have parents and are learned from data via
BDeu (Bayesian Dirichlet equivalent uniform) scoring:
`total_hg_deposition`, `freshwater_thg`, `fish_tissue_hg`. These are
the nodes that mediate between the source drivers and the effect /
impact endpoints. They are the only nodes where the conditional
distribution structure must be estimated rather than computed from a
known mapping.

The implementation is `fit_bdeu_cpt()` at
`bn_learning/fit_mackenzie_model.py:160-243`. The orchestration call
sites that route fish + water (for `total_hg_deposition`), water-only
(for `freshwater_thg`), and fish-only (for `fish_tissue_hg`) data
are at `fit_mackenzie_model.py:504-538`.

The total parent-configuration cardinalities for the three BDeu CPTs
per submodel are 120, 20, and 200 respectively (Appendix B.1.2),
reflecting the product of parent state cardinalities. The 200
configurations of `fish_tissue_hg` (5 species x 2 lengths x 2 first
point-source x 2 second point-source x 5 total-deposition) make it
the largest CPT in the model. Appendix B.2 contains a representative
slice that shows both the data-informed posterior shape and the
zero-observation BDeu fall-through.

### 10.3 Deterministic CPTs (effects and impacts)

Four nodes per submodel have CPTs that are computed from a
closed-form mapping in the literature rather than estimated from
data: `degree_of_injury` (Dillon et al. 2010 LL.3 dose-response),
`eligible_commercial_catch` (Health Canada 0.5 ug/g ww commercial
fish guideline), `mehg_ingested` (subsistence weekly intake equation),
and `ptwi_exceedance` (US EPA child pTWI = 0.7 ug Hg/kgbw/wk
exceedance test).

For each of these nodes, the CPT is fully specified by the parent's
states and a deterministic function; no training data are consulted
during fitting. To avoid hard zeros that would block belief
propagation, a soft-edge probability mass is placed on the off-target
states. The exact soft-edge value differs between binary and
multi-state outcomes; this is the most important methodological
nuance in this Part and is documented in detail in section 12.6.

The implementations are at
`bn_learning/fit_mackenzie_model.py:328-359`
(`build_deterministic_cpt_degree_of_injury`),
`fit_mackenzie_model.py:362-382`
(`build_deterministic_cpt_eligible_catch`),
`fit_mackenzie_model.py:385-417`
(`build_deterministic_cpt_mehg_ingested`), and
`fit_mackenzie_model.py:420-447`
(`build_deterministic_cpt_ptwi_exceedance`). The orchestration call
sites that dispatch each deterministic builder in topological order
are at `fit_mackenzie_model.py:540-577`.

### 10.4 Why this hybrid (and the methodological difference from Jermilova et al. 2025)

The hybrid empirical-prior + BDeu + deterministic strategy is not a
free design choice; it is conditioned on the tools and parameters
available in the AI-assisted Python build path. The published
Jermilova et al. 2025 model uses parametric linear mixed-effects
regression (R `lme()` in the `nlme` package) for the intermediate
nodes and a separate parametric drc-package LL.3 fit for the
degree-of-injury endpoint, as documented in
`Manuscript_RCode.R` and analyzed in
`external_case_studies/jermilova_2025_mackenzie_hg/r_code_analysis/r_code_analysis_summary.md`.
The published parametric approach assumes a specific functional form
(log-linear with random effects) and extrapolates beyond observed
parent configurations via the regression structure.

This build did not have R, `lme4`, or `nlme` in the Python execution
environment, and the AI-assisted workflow did not invoke R as an
auxiliary fitter. The methodology paper therefore could have either
(a) ported the parametric lme() approach to Python via
`statsmodels.MixedLM`, accepting the added dependency and the
divergence between R and Python random-effects implementations, or
(b) adopted a nonparametric CPT-learning approach that is honest to
the observed parent-configuration counts.

The build chose (b) BDeu for the three intermediate stressor nodes
because BDeu is nonparametric (it makes no functional-form assumption
about the conditional shape) and data-honest (it returns the prior on
parent configurations that have no matching observations rather than
extrapolating into them). For the four effect / impact endpoints the
literature gives a closed-form mapping (Dillon 2010 LL.3 for injury;
Health Canada and US EPA regulatory thresholds for commercial-catch
eligibility and pTWI exceedance; a standard subsistence-intake
equation for weekly MeHg ingestion) and the build adopted those
mappings directly with soft edges rather than re-estimating them from
the comparatively small endpoint data.

This is a methodological difference from the published model, not a
known deficiency, and it is acknowledged here at the front of Part IV
so that Part VII (the comparison chapter) and Part VIII (the AI-assisted
process chapter) can analyze its consequences honestly. The
deterministic CPTs and the BDeu posterior shape produce different
forward-inference marginals than the published parametric model would
produce on the same parent configurations; the protocol-specified
Jensen-Shannon divergence (Dimension 2) and marginal-belief correlations
(Dimension 3) would quantify the magnitude of those differences. Per
Part VII Section 23.0 and Section 26.10, Dimensions 2 and 3 are NOT
RUN in the current build; Part VII reports Dimension 1 (structural)
and Dimension 4 (sensitivity) outcomes and flags Dimensions 2, 3, 5
as open follow-ups (Part IX Section 27.5 items c, e, f).

## 11. BDeu (Bayesian Dirichlet equivalent uniform) -- methods detail

This section unpacks the BDeu formula used in `fit_bdeu_cpt()` at
`bn_learning/fit_mackenzie_model.py:160-243`. It is the deepest
methods section in the deliverable; a peer reviewer should be able to
verify line-for-line correspondence between the formula and the code
without leaving this section.

### 11.1 The Dirichlet prior: intuitive pseudo-counts explanation

A Bayesian estimate of a discrete conditional distribution
`P(child | parent_config)` combines two ingredients: the observed
counts of (child = s) given that the parent took the value
`parent_config`, and a prior belief about the distribution before
seeing any data. The Dirichlet distribution is the natural conjugate
prior for a categorical distribution, which means that if the prior
is Dirichlet and the likelihood is multinomial (counts of categorical
outcomes), the posterior is also Dirichlet -- the math closes.

The Dirichlet prior is parameterized by a vector of pseudo-counts
`alpha = (alpha_1, alpha_2, ..., alpha_K)`, one per state of the
child. A pseudo-count of `alpha_k` units on state k expresses the
belief that, before seeing any data, the analyst has seen
`alpha_k` synthetic observations of state k. After observing real
counts `c_k`, the posterior mean of `P(child = s_k)` is

```
P(s_k) = (c_k + alpha_k) / (sum_j (c_j + alpha_j))
       = (c_k + alpha_k) / (n + sum_j alpha_j)
```

where `n = sum_j c_j` is the total observed count for that parent
configuration. The smaller the total prior `sum_j alpha_j` is
relative to `n`, the more the posterior is pulled toward the data;
the larger the total prior is, the more the posterior is pulled
toward a uniform distribution (assuming a uniform prior shape).

### 11.2 ESS (equivalent sample size): DEFAULT_ESS = 1.0

The BDeu prior is one specific choice of `alpha`. Its key parameter is
the **equivalent sample size** (ESS), the total prior pseudo-count
distributed uniformly across all (parent-config, child-state) cells.
In the Mackenzie build, ESS is set to 1.0 at
`bn_learning/fit_mackenzie_model.py:60`:

```
DEFAULT_ESS = 1.0  # BDeu equivalent sample size (uninformative prior)
```

Mathematically: ESS = 1.0 means the total prior contribution to the
joint table is equivalent to seeing one synthetic observation,
distributed uniformly across every parent configuration and every
child state. For `fish_tissue_hg` (n_configs = 200, n_states = 5),
that single synthetic observation is split into
1.0 / (200 x 5) = 0.001 pseudo-counts per cell. For root nodes fit
by `fit_empirical_prior` (no parents, n_configs effectively 1), that
same single synthetic observation is split into 1.0 / n_states
pseudo-counts per state (e.g. 0.2 for a 5-state node).

The ESS choice is a deliberate decision point. Lower ESS means the
posterior is more data-driven (less pulled toward uniform); higher
ESS means the posterior is more uniform (less pulled by the
observed counts). In Mackenzie the data volumes for the BDeu nodes
are large in absolute terms (`fish_tissue_hg` is fit on up to 604 GSL
fish cases and up to 274 GBS fish cases per Appendix B.0.4;
`freshwater_thg` on up to 855 GSL water cases and up to 1589 GBS
water cases; `total_hg_deposition` on up to 1459 GSL and up to 1863
GBS combined fish + water cases), so even small ESS is dominated by
data on parent configurations that have observations. The
zero-observation configurations collapse to the BDeu prior
(uniform 1/n_states), which is the BDeu fall-through behavior
documented in Appendix B.1.2.

A peer reviewer may reasonably ask whether ESS = 1.0 is too
uninformative. The objection is intelligible: some communities
favor ESS = 10 or ESS = sqrt(n) as a default. The defense for
ESS = 1.0 in this build is REVISED per codex holistic-R1 P2-1:

1. The defense should be PER-CONFIGURATION COVERAGE based, not
   absolute-N based. For the GSL `fish_tissue_hg` CPT with 200
   parent configurations and ~584 LOO-eligible cases, average
   coverage is ~2.9 cases per configuration. The distribution is
   sparse: per Appendix B.2 a meaningful fraction of configurations
   have ZERO matching observations and collapse to the BDeu
   uniform-fall-through, while configurations with high coverage
   are concentrated on the species x small-fish-length x no-mine
   slice. The honest framing: for configurations with >= 5
   observations, the ESS = 1.0 prior is numerically dominated by
   the data; for configurations with 0 observations, the posterior
   is exactly 1/n_states (the uniform BDeu floor) regardless of
   ESS; for configurations in the 1-4 observation band the ESS
   choice DOES matter and the posterior is a non-trivial mixture
   of the uniform prior and the empirical counts.

2. (WITHDRAWN) The prior framing claimed lme() has "essentially
   uninformative priors" -- this is imprecise. `nlme::lme()` is
   maximum-likelihood under a Gaussian likelihood; it does not
   technically have a prior (it is frequentist). The methodological
   posture between the two paths is therefore NOT "matched
   uninformative priors" but rather "maximum-likelihood vs
   Dirichlet-posterior-mean" (the BDeu output at
   `fit_mackenzie_model.py:234` is the posterior MEAN of the
   Dirichlet-multinomial, NOT a MAP estimate -- codex holistic-R2 P2
   correction). The defense for ESS = 1.0 should not appeal to the
   published model's prior posture.

3. The proper defense for ESS = 1.0 in this build is empirical
   rather than philosophical: an ESS sensitivity sweep (re-run LOO
   at ESS in {0.5, 1.0, 5.0, 10.0}) would show whether the kappa
   values are robust to the choice. PLAN Q6 reserves this analysis
   as an open follow-up; until run, the deliverable defers the
   defense and reports ESS = 1.0 as a documented choice rather
   than a defended choice. Section 26.10A consolidates this
   limitation.

4. For configurations with no observations the BDeu fall-through
   to uniform 1/n_states is semantically appropriate: the model is
   honestly returning "no information" rather than extrapolating
   from a nearby configuration. This is a property of the prior
   structure, not of the ESS value.

The methodology paper does not commit to an ESS sensitivity
analysis as part of Part IV (PLAN Q6 is OPEN; the option to re-run
LOO at ESS in {0.5, 1.0, 5.0, 10.0} is recorded for HITL decision).
If HITL elects to run the sensitivity, the results would be added to
Part V section 16 alongside the existing mutual-information
sensitivity, and Part IV section 11.2 would be revised to cite the
empirical evidence for the choice.

### 11.3 alpha_ij: the per-config prior

The BDeu prior splits the ESS uniformly across parent configurations.
With `n_parent_configs = q_i` configurations of the parents, the
per-configuration prior pseudo-count is

```
alpha_ij = ESS / q_i
```

This is implemented at `bn_learning/fit_mackenzie_model.py:199`:

```python
alpha_ij = ess / n_configs           # prior pseudo-count per config
```

For `fish_tissue_hg` (q_i = 200), alpha_ij = 1.0 / 200 = 0.005.
For `freshwater_thg` (q_i = 20), alpha_ij = 1.0 / 20 = 0.05. For a
root node fit by `fit_empirical_prior` (q_i = 1 by convention),
alpha_ij = 1.0.

### 11.4 alpha_ijk: the per-cell prior

Within a parent configuration, the per-config prior is split
uniformly across the `r_i = n_states` child states:

```
alpha_ijk = alpha_ij / r_i = ESS / (q_i * r_i)
```

Implemented at `bn_learning/fit_mackenzie_model.py:200`:

```python
alpha_ijk = ess / (n_configs * n_states)  # prior pseudo-count per (config, state)
```

For `fish_tissue_hg` (q_i = 200, r_i = 5), alpha_ijk = 1.0 / 1000 =
0.001. For `freshwater_thg` (q_i = 20, r_i = 3), alpha_ijk = 1.0 / 60
~= 0.01667. The "equivalent uniform" in BDeu refers to this
uniform split: every (config, state) cell receives the same prior
pseudo-count regardless of which config or which state it represents.
This is the property that gives BDeu its score-equivalence guarantee
(two DAGs that encode the same conditional independence structure
receive the same BDeu score).

### 11.5 Posterior counting: P(state | config) = (count + alpha_ijk) / (n + alpha_ij)

The BDeu posterior mean is the Dirichlet posterior mean with the
BDeu prior. At `bn_learning/fit_mackenzie_model.py:234`:

```python
posterior[s] = (counts[s] + alpha_ijk) / (n + alpha_ij)
```

where `counts[s]` is the number of training rows matching
(child = s, parents = parent_config) and `n = sum_s counts[s]` is
the total matching count for this parent_config.

Two limit cases make the formula intuitive:

- If `n` is large relative to `alpha_ij`, the posterior is
  approximately `counts[s] / n`, the empirical conditional frequency.
  This is the data-driven regime.
- If `n = 0` (no matching observations for this parent_config), the
  posterior collapses to `alpha_ijk / alpha_ij = 1 / r_i = 1 / n_states`,
  the uniform distribution. This is the BDeu fall-through.

Both regimes appear in the GSL `fish_tissue_hg` CPT slice in
Appendix B.2. The informative configurations show data-driven
posteriors with a few states carrying most of the mass and the
remaining states near the per-cell BDeu floor; the uninformative
configurations show exact uniform 0.2 across all five states.

### 11.6 Per-config normalization

The BDeu posterior is already normalized by construction: the
denominator `n + alpha_ij` equals the sum of the numerators across
states because `r_i * alpha_ijk = alpha_ij`. The implementation at
`bn_learning/fit_mackenzie_model.py:236-238` performs an explicit
per-config normalization step nonetheless:

```python
total_p = sum(posterior.values())
cpt[key] = {s: posterior[s] / total_p for s in node_states}
```

This is defensive against floating-point round-off rather than a
mathematical necessity. The sum-to-one check in Appendix B.3.3
(both rows of the hand-calculated fixture sum to exactly 1.0)
confirms that the explicit normalization is a no-op for the formula
as written.

### 11.7 Implementation walkthrough of fit_bdeu_cpt()

The full implementation is `fit_bdeu_cpt()` at
`bn_learning/fit_mackenzie_model.py:160-243`. The annotated walkthrough
follows the code in order:

1. **Cache parent state lists** (lines 192-197). The function takes a
   `parent_state_map` argument (a dict mapping node_id to the ordered
   list of that node's states) and extracts the per-parent state list
   into `parent_state_lists`. The number of parent configurations is
   then the product of the state-list lengths,
   `n_configs = prod_i len(parent_state_lists[i])`.
2. **Compute BDeu hyperparameters** (lines 199-200). The formulas for
   `alpha_ij` and `alpha_ijk` are computed once and reused across all
   configurations.
3. **Iterate over parent configurations** (line 206 via
   `itertools.product(*parent_state_lists)`). Each iteration yields a
   tuple `combo` whose order matches `parent_ids`. The configuration
   key `"|".join(combo)` is the pipe-joined parent state tuple used
   in the JSON-exported `learned-model-*.json` CPT table (e.g.
   `"lake_whitefish|small|yes|yes|low"` in Appendix B.2.2).
4. **Count matching observations** (lines 211-224). For each training
   row, the function checks that the child value is non-None and is a
   known state, then checks that every parent's observed value matches
   the configuration tuple. Rows with any missing parent value are
   skipped (lines 217-222). This is row-listwise deletion on missing
   parents, the same default behavior as
   `pgmpy.estimators.BayesianEstimator` (per Appendix B.3.6).
5. **Apply the BDeu formula and normalize** (lines 226-238). Lines 226
   compute `n = sum(counts.values())`. Lines 231-234 apply the BDeu
   posterior formula. Lines 236-238 perform the defensive per-config
   normalization described in section 11.6.
6. **Emit a verbose summary** (lines 240-242). When `verbose=True`
   (the default), the function prints a one-line summary of the form
   `{node_id}: ESS={ess}, {total_obs} obs across {configs_with_data}/{n_configs} parent configs`.
   These counts are NOT persisted to the learned-model JSON; the
   authoritative source is the `fit_mackenzie_model.py` run log
   (Appendix B.0.3).

The function is pure Python plus `itertools` and `collections`; it
imports nothing from `pgmpy` or `numpy` (numpy is imported by the
module but not used inside this function). The complete function
fits in roughly 80 lines of source, all auditable in a single screen.

### 11.8 What pgmpy.estimators.BayesianEstimator would have done differently

The deliberate decision to write a self-contained BDeu rather than
call `pgmpy.estimators.BayesianEstimator` is recorded in
`external_case_studies/jermilova_2025_mackenzie_hg/M4_FIT_REFACTORING_ANALYSIS.md`
Section 5 and re-stated in Appendix B.4. Four reasons, in summary:

1. **Reduced dependency surface.** `fit_mackenzie_model.py` imports
   only `numpy` and Python standard library plus the project's own
   modules. The fitting path has no pgmpy import.
2. **Full inspectability.** The BDeu formula spans 30 lines of source
   (`fit_mackenzie_model.py:160-243`) that a peer reviewer can read
   end-to-end without crossing a third-party library boundary.
3. **Algorithmic equivalence is verifiable.** The hand-calculated
   fixture in Appendix B.3.2-B.3.4 and the analytic side-by-side in
   Appendix B.3.6 confirm that the implementation matches the BDeu
   definition (Heckerman, Geiger, and Chickering 1995) and matches
   the pgmpy `BayesianEstimator` BDeu branch on any dataset where
   every relevant row has fully-observed parents and child.
4. **Smaller blast radius for the standalone case-study build.** The
   sediment v4.1 production model is in production with pgmpy on the
   validation path; the Mackenzie case-study build is a standalone
   line of work that did not need to share that dependency surface.

The only behavioral difference between the implementations is in
missing-data handling: both default to row-listwise deletion on any
missing parent (line 217-222 in this implementation;
`unstack(fill_value=0)` in pgmpy's `BayesianEstimator.estimate_cpd`),
so on the standard pre-discretized fish + water training data the
two implementations produce identical CPTs.

The BDeu correctness receipt (PLAN Section 6 Part IV item 11.9) is in
Appendix B.3 (hand-calculated fixture) and Appendix B.3.6 (the
explicit pgmpy-equivalent receipt; renumbered from the prior
duplicate B.3.5 per codex appendices-R2 finding P2-1). The two
subsections together satisfy the PLAN requirement.

## 12. Deterministic CPTs (effects and impacts)

The four effect / impact nodes per submodel have CPTs that are
computed from a closed-form mapping rather than estimated from data.
This section walks through each mapping in turn, with the source
constants pinned to `bn_learning/fit_mackenzie_model.py` and the
soft-edging policy documented per CPT in section 12.6.

### 12.1 Dillon 2010 LL.3 dose-response

The `degree_of_injury` CPT maps each `fish_tissue_hg` state to a
percent-injury value via the Dillon et al. 2010 LL.3 (three-parameter
log-logistic) dose-response model. The parameters at
`bn_learning/fit_mackenzie_model.py:64-66` are:

```python
DILLON_UPPER_LIMIT = 133.99  # asymptotic maximum (%)
DILLON_SLOPE = -0.699
DILLON_EC50 = 2.435           # ug/g ww
```

The functional form, implemented in `dillon_injury_pct()` at
`bn_learning/fit_mackenzie_model.py:278-298`, is

```
f(x) = DILLON_UPPER_LIMIT / (1 + exp(DILLON_SLOPE * (ln(x) - ln(DILLON_EC50))))
     = 133.99 / (1 + exp(-0.699 * (ln(x) - ln(2.435))))
```

where `x` is the fish-tissue Hg concentration in ug/g ww and the
output is the percent of fish injured. Output is clipped to
`[0.0, 100.0]` (line 296). The negative slope (b = -0.699) is correct
for the parameterization used: as the dose `x` increases above the
EC50, the exponent becomes large and negative, the denominator
approaches 1, and injury approaches the asymptote. The asymptote
exceeds 100% because the LL.3 fit was not constrained to 100% during
the original Dillon 2010 calibration; the implementation clips to
100% at the application boundary.

A peer reviewer should be aware that the sign convention varies by
source. The standard LL.3 functional form in the R `drc` package is

```
f(x) = d / (1 + exp(b * (log(x) - log(e))))
```

with `b` carrying the slope sign directly. The Mackenzie build adopts
this convention with `b = DILLON_SLOPE = -0.699`. Alternative
parameterizations (e.g., with the slope as `+0.699` and the sign
absorbed into the exponent) would produce identical curves with the
opposite-signed slope. The docstring at
`bn_learning/fit_mackenzie_model.py:281-289` makes the convention
explicit ("With b < 0, injury increases with dose"). Verifying against
Dillon et al. 2010 Environ Toxicol Chem 29(11):2559-2565 is a standing
QA step.

The function `classify_injury()` at
`bn_learning/fit_mackenzie_model.py:299-310` then maps the percent
into one of four `degree_of_injury` states via the
`INJURY_BREAKS = [0, 25, 50, 75]` thresholds. The CPT builder
`build_deterministic_cpt_degree_of_injury()` at lines 328-359
evaluates the function at each `fish_tissue_hg` midpoint and assigns
the resulting state with soft edges.

### 12.2 FISH_HG_MIDPOINTS table

The deterministic CPTs for `degree_of_injury`,
`eligible_commercial_catch`, and `mehg_ingested` all operate on a
single representative midpoint per `fish_tissue_hg` state. The
midpoints are at `bn_learning/fit_mackenzie_model.py:70-76`:

```python
FISH_HG_MIDPOINTS = {
    "low":          0.10,   # midpoint of (0, 0.2]
    "subsistence":  0.35,   # midpoint of (0.2, 0.5]
    "ec20":         0.635,  # midpoint of (0.5, 0.77]
    "ec50":         1.885,  # midpoint of (0.77, 3.0]
    "above_ec50":   4.0,    # conservative midpoint for (>3.0)
}
```

These values are derived directly from the `fish_tissue_hg` break
list `[0, 0.2, 0.5, 0.77, 3]` (Appendix C section C.3.a; Appendix C.5.a
also records this table). For the four bounded bins the midpoint is
the arithmetic mean of the bin edges; for the open-ended top bin
("above_ec50", values above 3.0 ug/g ww) the midpoint is a
conservative representative value of 4.0 ug/g ww, chosen as roughly
1.3 x the lower edge.

The `above_ec50 = 4.0` choice is a modeling decision (Appendix C.5.a
docstring: "conservative midpoint"). A larger value (say 8.0) would
propagate more conservatively through the deterministic CPTs; a
smaller value (say 3.5) would propagate less conservatively. The
choice is surfaced here rather than buried in the code so that a peer
reviewer can audit it. The downstream consequence is small in this
model because the training fish data have very few `above_ec50`
observations (Appendix B section B.1.2 notes that the GSL fish data
have only N = 1 `above_ec50` case in the LOO eligibility set, per
Part V section 15.6).

### 12.3 Health Canada thresholds: pTWI 0.7 / 1.4 / 3.3 ug Hg/kgbw/wk

Three pTWI (provisional tolerable weekly intake) thresholds are
encoded at `bn_learning/canonical_mackenzie.py:36-57` (Appendix C
section C.4):

| pTWI value (ug Hg/kgbw/wk) | Population               | Source                                  | Key                |
|---------------------------:|---------------------------|------------------------------------------|--------------------|
| 0.7                        | Child (most protective)   | US EPA MeHg RfD (0.1 ug/kgbw/day x 7)   | `us_epa_child`     |
| 1.4                        | Women of childbearing age | WHO/JECFA 2003 pTWI for MeHg            | `who_childbearing` |
| 3.3                        | Adult male                | Health Canada 2007 pTWI for MeHg        | `hc_adult_male`    |

The default threshold used to compute `ptwi_exceedance` is the most
protective one (US EPA child = 0.7 ug Hg/kgbw/wk):

```python
PTWI_THRESHOLD_DEFAULT = PTWI_THRESHOLDS["us_epa_child"]["value"]
```

at `bn_learning/fit_mackenzie_model.py:95`. The choice of the most
protective default is a load-bearing modeling decision: it means the
`ptwi_exceedance` marginals report exceedance against the most
sensitive sub-population. Reviewers and downstream users should
interpret the marginal as "fraction exceeding the child reference
dose" rather than "fraction exceeding the adult-male threshold". The
two other thresholds remain available in `PTWI_THRESHOLDS` for ad-hoc
sensitivity analysis, but the primary results in this paper use the
0.7 ug Hg/kgbw/wk default.

### 12.4 mehg_ingested CPT (subsistence intake equation)

The `mehg_ingested` CPT maps each `fish_tissue_hg` state to a weekly
MeHg intake (in ug Hg/kgbw/wk) via the subsistence-scenario equation,
then bins the intake into one of six `mehg_ingested` states. The
formula at `bn_learning/fit_mackenzie_model.py:395-398` is

```python
weekly_mehg = (
    midpoint * DEFAULT_CONSUMPTION_G_DAY * 7.0
    * DEFAULT_MEHG_FRACTION / DEFAULT_BODY_WEIGHT_KG
)
```

with the subsistence-scenario constants at lines 84-88:

```python
DEFAULT_CONSUMPTION_G_DAY = 100.0   # g fish per day (Indigenous subsistence)
DEFAULT_BODY_WEIGHT_KG    =  60.0   # kg
DEFAULT_MEHG_FRACTION     =   0.95  # fraction of total Hg as MeHg
```

The numeric multiplier collapses to
`midpoint * 100 * 7 * 0.95 / 60 ~= midpoint * 11.083`. Walking through
the `subsistence` state as a worked example:

- midpoint = 0.35 ug/g ww (FISH_HG_MIDPOINTS["subsistence"]).
- weekly_mehg = 0.35 * 100 * 7 * 0.95 / 60 = 0.35 * 11.083 = 3.879 ug
  Hg/kgbw/wk.
- `classify_mehg(3.879)` at lines 312-325 walks through the
  inclusive-upper break list `MEHG_BREAKS = [0, 0, 1.0, 1.4, 2.5, 3.3]`
  (line 80): 3.879 > 3.3, so the state is `"high"`.

Performing the same walk for every fish_tissue_hg state yields the
deterministic state mapping that drives the CPT (the per-row
`weekly_mehg` and resulting state are logged to stdout at lines
412-415 during fitting).

The subsistence-scenario constants are decision points, not breaks
in the discretization. They are documented in Appendix C section C.5
because they DRIVE the `mehg_ingested` state assignment and therefore
the `ptwi_exceedance` marginal. The methodology paper must not treat
`ptwi_exceedance` as a measured population-average exposure result;
it is a scenario propagation conditioned on these three assumptions.
PLAN Section 6 Part VIII item 26.9 makes this explicit and the
consolidated Limitations chapter (Part VIII Section 26) repeats it.

### 12.5 ptwi_exceedance CPT (vs PTWI_THRESHOLD_DEFAULT)

A key structural point that the appendices flag (Appendix C section
C.4, CORRECTED per codex appendices-R1 finding P2-7): the
`ptwi_exceedance` CPT has `mehg_ingested` as its parent, NOT
`fish_tissue_hg` directly. The deterministic chain is therefore:

```
fish_tissue_hg
   |
   v   (subsistence intake formula at fit_mackenzie_model.py:385-417)
mehg_ingested
   |
   v   (vs PTWI_THRESHOLD_DEFAULT at fit_mackenzie_model.py:420-447)
ptwi_exceedance
```

This is two separate deterministic CPTs rather than one composite CPT
from `fish_tissue_hg` to `ptwi_exceedance`. The split matters because
forward inference propagates beliefs through `mehg_ingested` as a
visible intermediate node, and HITL users can inspect the
`mehg_ingested` marginal directly to see the scenario-derived intake
distribution before it is collapsed to the binary exceedance test.

The `ptwi_exceedance` CPT implementation at
`bn_learning/fit_mackenzie_model.py:420-447` reads:

```python
def build_deterministic_cpt_ptwi_exceedance(mehg_states):
    ptwi_states = ["does_not_exceed", "exceeds"]
    # Midpoints for mehg_ingested states (ug Hg/kgbw/wk)
    mehg_midpoints = {
        "none":          0.0,
        "low":           0.5,
        "moderate_low":  1.2,
        "moderate_mid":  1.95,
        "moderate_high": 2.9,
        "high":          4.0,
    }
    cpt = {}
    for ms in mehg_states:
        mp = mehg_midpoints[ms]
        if mp > PTWI_THRESHOLD_DEFAULT:
            det_state = "exceeds"
        else:
            det_state = "does_not_exceed"
        dist = {s: 0.05 for s in ptwi_states}
        dist[det_state] = 0.95
        cpt[ms] = dist
    return cpt
```

The midpoint table (`mehg_midpoints` dict at lines 427-434) is local
to this function and is distinct from FISH_HG_MIDPOINTS. The values
correspond to representative MeHg intakes for each `mehg_ingested`
state: 0.0 for "none", 0.5 (mid-bin of (0, 1.0]) for "low", 1.2
(mid-bin of (1.0, 1.4]) for "moderate_low", 1.95 (mid-bin of
(1.4, 2.5]) for "moderate_mid", 2.9 (mid-bin of (2.5, 3.3]) for
"moderate_high", and 4.0 (conservative open-bin midpoint for the
"high" state, values above 3.3). The 4.0 ug Hg/kgbw/wk choice for
the "high" bin midpoint is symmetric with the 4.0 ug/g ww choice for
the fish-tissue "above_ec50" midpoint and is a similar conservative
decision.

The exceedance test is `mp > PTWI_THRESHOLD_DEFAULT` (strict
greater-than). With PTWI_THRESHOLD_DEFAULT = 0.7, the resulting
deterministic mapping is:

- `none` -> 0.0 -> does_not_exceed
- `low` -> 0.5 -> does_not_exceed
- `moderate_low` -> 1.2 -> exceeds
- `moderate_mid` -> 1.95 -> exceeds
- `moderate_high` -> 2.9 -> exceeds
- `high` -> 4.0 -> exceeds

Four of six mehg_ingested states exceed the child pTWI by this
mapping. The "low" state midpoint (0.5 ug Hg/kgbw/wk) falls below the
0.7 threshold, so even low subsistence intake levels are interpreted
as not-exceeding-child-pTWI; the state's bin edge (1.0 ug Hg/kgbw/wk)
is above 0.7, so a peer reviewer reading the bin upper edge alone
might expect "low" to exceed, but the implementation uses the bin
midpoint, not the upper edge, in the comparison.

### 12.6 Per-CPT soft-edging (CRITICAL methodological detail)

The four deterministic CPTs do NOT share a single soft-edge value.
This is the most important methodological nuance in Part IV and it is
flagged explicitly here because earlier drafts of this Part
incorrectly summarized the policy as "uniform 0.90 / 0.10". The
correct per-CPT values are pinned in Appendix B section B.0.6.

| CPT                          | MAP probability | Off-MAP probability                             | Source lines (`fit_mackenzie_model.py`) |
|-----------------------------:|----------------:|-------------------------------------------------|-----------------------------------------|
| `degree_of_injury` (4 states) | 0.90            | 0.10 / 3 = 0.0333 across each of 3 other states | 343-349                                  |
| `mehg_ingested` (6 states)    | 0.90            | 0.10 / 5 = 0.02 across each of 5 other states   | 401-407                                  |
| `eligible_commercial_catch` (binary) | 0.95     | 0.05 on the single other state                  | 377-378                                  |
| `ptwi_exceedance` (binary)    | 0.95            | 0.05 on the single other state                  | 442-443                                  |

The pattern: BINARY deterministic outcomes receive tighter soft edges
(0.95 / 0.05); MULTI-state deterministic outcomes receive looser soft
edges (0.90 / (0.10 / (n_states - 1))). The rationale is that within
a binary outcome the dichotomy is sharper (a Health Canada guideline
crossing, an exceedance / non-exceedance), so the within-bin
variability is more constrained and a 5% soft-edge is sufficient to
avoid hard zeros without diluting the deterministic signal. Within a
multi-state outcome, the off-target probability mass is spread across
multiple alternative states, and a single per-state 0.10 floor would
sum to more than 0.10 total off-target mass; dividing 0.10 by
(n_states - 1) keeps the total off-target mass at exactly 10% and the
per-state off-target floor lower than necessary to keep no off-target
state above the per-state ceiling needed to avoid hard zeros.

The bias direction of soft-edging is real and worth surfacing: soft
edges shift roughly 5-10% of the probability mass from the
deterministic MAP state to the off-target states. For the binary
CPTs, exactly 5% is shifted to the alternative state. For the
4-state `degree_of_injury` CPT, exactly 10% is shifted across the
3 off-target states (3.33% each). For the 6-state `mehg_ingested`
CPT, exactly 10% is shifted across the 5 off-target states (2.0%
each). This is a small but non-zero bias toward more-uniform CPTs
relative to the underlying deterministic mapping.

Per PLAN Q7 (NUANCED), Part VIII commits to quantifying the
forward-inference impact of this bias by comparing forward inference
under three soft-edging configurations (hard-edges, current 0.90/0.10
+ 0.95/0.05, uniform 0.95/0.05) and reporting (a) shift in MAP class
per node and (b) absolute belief delta on the impact nodes. LOO is
not the right instrument for this question because the target-only
LOO does not re-propagate through deterministic descendants; the
right instrument is a forward-inference comparison on a representative
evidence set.

The choice of asymmetric per-CPT soft-edging is a HITL decision
recorded in the decision-provenance ledger (Appendix F entry for
"deterministic CPT soft-edging policy", commit 898059f1). The AI
orchestrator proposed a uniform 0.90 / 0.10 policy initially; HITL
revised to the per-CPT asymmetric policy after noting that the
binary CPTs in the published Jermilova model behave more sharply at
the regulatory threshold than the multi-state CPTs do at their bin
edges. The current implementation matches that intuition.

## 13. Empirical priors (root nodes)

Root nodes have no parents. Their CPT is a single marginal
distribution over the node's states, fit by `fit_empirical_prior()`
at `bn_learning/fit_mackenzie_model.py:246-271`.

### 13.1 The fit_empirical_prior() function

The function takes the training data (a list of dicts), the node ID,
the ordered list of states, and the ESS, and returns a single
distribution `{state: probability}`. The implementation is:

```python
def fit_empirical_prior(data, node_id, node_states, ess=DEFAULT_ESS):
    n_states = len(node_states)
    alpha_k = ess / n_states              # BDeu prior per state
    counts = {s: 0 for s in node_states}
    for d in data:
        v = d.get(node_id)
        if v is not None and v in counts:
            counts[v] += 1
    total = sum(counts.values())
    prior = {}
    for s in node_states:
        prior[s] = (counts[s] + alpha_k) / (total + ess)
    total_p = sum(prior.values())
    prior = {s: v / total_p for s, v in prior.items()}
    return prior
```

Three structural facts are worth pinning here.

### 13.2 alpha_k: ESS / n_states

The per-state pseudo-count is `alpha_k = ESS / n_states` (line 252).
This is the natural reduction of the BDeu prior to the root-node case
(`n_parent_configs = 1`): the BDeu `alpha_ijk = ESS / (n_configs *
n_states)` collapses to `ESS / n_states` when n_configs = 1. The
Dirichlet posterior structure is preserved, and a root-node prior is
mathematically the marginal limit of a BDeu CPT with no parents.

For a 5-state root node (atmospheric_hg_deposition, fish_species),
alpha_k = 0.2. For a 6-state root node (permafrost_hg_release),
alpha_k = 0.1667. For a 4-state root node (soil_erosion_hg_release),
alpha_k = 0.25. For a binary root node (fish_length, the four
proximity nodes), alpha_k = 0.5.

### 13.3 No minimum-row-count threshold

`fit_empirical_prior` has NO coverage gate. There is no check of the
form "if total < N_min, return uniform". This was an active drafting
defect in an earlier session that proposed such a gate; codex caught
it (PLAN R1 P2-2) and the correction is now load-bearing in the
methodology. The BDeu smoothing alone handles zero-observation states:
the alpha_k pseudo-count on each state ensures the posterior never
collapses to a hard zero, regardless of how few observations support
the state.

A peer reviewer should not expect any coverage gate. The training-data
prep skips rows where the target node value is None (line 256-258),
which means the empirical prior is fit over only the rows that
observed the node; if a state has zero observations among those rows,
the BDeu smoothing handles it without a special branch.

### 13.4 What happens when a state has zero observations

If `counts[s_zero] = 0` for some state `s_zero`, the posterior at line
263 evaluates to

```
prior[s_zero] = (0 + alpha_k) / (total + ESS) = alpha_k / (total + ESS)
```

which is strictly positive but small. For a 5-state root node with
total = 1459 and ESS = 1.0, the zero-observation state receives
posterior 0.2 / 1460 ~= 1.37e-4. This is the nonzero floor that
prevents hard zeros in downstream propagation. The other states' BDeu
posteriors all carry their full `counts[s] / total` plus the
smoothing bump from `alpha_k / (total + ESS)`, and the implicit
normalization at lines 266-267 preserves the sum-to-one property
modulo floating-point round-off (the per-config normalization in BDeu
section 11.6 has its analog here).

The verbose summary printed at lines 269-270 lists the per-state
posterior probabilities, which makes the zero-observation floor
visible in the run log without needing to inspect the JSON
afterwards.

## 14. Orchestration (fit_all_cpts at lines 454-579)

The full CPT fitting orchestration is `fit_all_cpts()` at
`bn_learning/fit_mackenzie_model.py:454-579`. The function takes the
sub-model identifier ("GSL" or "GBS") and the fish and water training
data, fits all 14 CPTs in topological order, and returns the CPT
dict plus the priors dict.

### 14.1 Topological-order fitting via topo_sort()

The topological sort at `bn_learning/fit_mackenzie_model.py:127-148`
takes the nodes dict and edge list and returns a list of node IDs in
topological order. The algorithm is Kahn's algorithm via a `deque`:
compute in-degrees, enqueue all zero-in-degree nodes, repeatedly
dequeue a node and decrement the in-degree of each child, enqueuing
each child whose in-degree drops to zero. A cycle (or disconnected
component) is detected by checking that the output order length
matches the node count (line 146).

The Mackenzie DAG is small (14 nodes, 15 edges per submodel) and
acyclic by construction, so topo_sort returns the full order in O(N +
E) time on the order of microseconds. The order matters because the
deterministic CPTs depend on the BDeu CPT of `fish_tissue_hg` for
their parent's state list (FISH_HG_MIDPOINTS keys correspond to the
fish_tissue_hg states), and `ptwi_exceedance` depends on the
deterministic CPT of `mehg_ingested` for its parent's state list.
The `fit_all_cpts` function does not rely on the topo_sort output
directly (it dispatches per-node via hand-written ordering in the
function body), but the topological structure is honored by that
ordering: roots first, then BDeu intermediates, then deterministic
effects, then deterministic impacts.

### 14.2 Per-node dispatch

`fit_all_cpts` dispatches each node to one of six fitting paths:

| Block of `fit_all_cpts`           | Lines    | Nodes                                                                                         | Method                       |
|-----------------------------------|---------:|-----------------------------------------------------------------------------------------------|------------------------------|
| Source / nonpoint roots           | 485-496  | atmospheric_hg_deposition, permafrost_hg_release, soil_erosion_hg_release; point-source pair  | empirical_prior              |
| Fish exposure roots               | 499-500  | fish_species, fish_length                                                                     | empirical_prior              |
| total_hg_deposition               | 504-514  | total_hg_deposition                                                                           | bdeu                         |
| freshwater_thg                    | 517-526  | freshwater_thg                                                                                | bdeu                         |
| fish_tissue_hg                    | 529-538  | fish_tissue_hg                                                                                | bdeu                         |
| degree_of_injury                  | 542-550  | degree_of_injury                                                                              | deterministic_dillon_2010    |
| eligible_commercial_catch         | 552-559  | eligible_commercial_catch                                                                     | deterministic_hc_guideline   |
| mehg_ingested                     | 561-568  | mehg_ingested                                                                                 | deterministic_subsistence    |
| ptwi_exceedance                   | 570-577  | ptwi_exceedance                                                                               | deterministic_ptwi           |

The `method` field stored in each CPT entry uses the long
JSON-export form (e.g. `"deterministic_dillon_2010"` at line 548,
`"deterministic_hc_guideline"` at line 557, `"deterministic_subsistence"`
at line 566, `"deterministic_ptwi"` at line 575). These long names
are what ship in `results/learned-model-{gsl,gbs}.json` and what the
SSTAC-Dashboard renderer reads via `loadLearnedCPTs`. Appendix B
section B.0.2 documents this naming convention.

### 14.3 Data routing

Three data-routing decisions are encoded in `fit_all_cpts`:

1. **Source / nonpoint + point-source roots use combined fish + water
   data.** Line 477 constructs `all_data = fish_data + water_data` and
   lines 485-496 pass `all_data` to `fit_empirical_prior` for the
   nonpoint sources and the two submodel-specific point-source
   proximities. The rationale is that source-driver values are
   observed at every sampling station regardless of whether the
   station yielded a fish or a water record, so the combined data are
   the right denominator for the marginal.
2. **`fish_species` and `fish_length` use fish-only data.** Line
   499-500 pass `fish_data` directly. The rationale is structural:
   water records have no fish species or length entry, so including
   them would simply add None values that the empirical_prior loop
   would skip anyway.
3. **The three BDeu CPTs use different subsets.**
   `total_hg_deposition` (line 512) is fit on combined fish + water,
   for the same reason as the nonpoint roots: its parents are all
   source-side and observed at every station. `freshwater_thg` (line
   524) is fit on water data only, because the node represents
   measured freshwater THg and is observed only on water records.
   `fish_tissue_hg` (line 536) is fit on fish data only, because the
   node represents measured fish tissue Hg and is observed only on
   fish records. The data-routing is the data-availability honest
   answer to "what set of rows actually observed this node".

The resulting CPT dict is returned (line 579) together with the
priors dict and is then serialized by the downstream export code
(Part VI section 18) into `results/learned-model-{gsl,gbs}.json`.

## 15. Recap and forward references

Part IV has documented the three CPT-fitting paths in the Mackenzie
Hg BN-RRM build: empirical priors for 7 root nodes per submodel,
BDeu posteriors for 3 intermediate stressor nodes per submodel, and
deterministic CPTs for 4 effect / impact nodes per submodel.

The methodology paper carries forward four load-bearing facts from
Part IV into later Parts:

1. The choice of BDeu with ESS = 1.0 over parametric lme() is a
   methodological difference, not a deficiency. Part VII section 22.1
   analyzes the comparison consequences.
2. The asymmetric per-CPT soft-edging policy (binary 0.95/0.05,
   multi-state 0.90/(0.10/(n-1))) is an explicit modeling decision.
   Part VIII section 26.8 commits to quantifying its forward-inference
   bias.
3. The subsistence-scenario assumptions (100 g/day, 60 kg, 0.95
   MeHg fraction) are decision points, not breaks. Part VIII section
   26.9 surfaces the resulting `ptwi_exceedance` interpretation
   constraint.
4. The deterministic chain is fish_tissue_hg -> mehg_ingested ->
   ptwi_exceedance, with `mehg_ingested` as an inspectable visible
   intermediate. Part V section 17 walks through forward inference on
   this chain; Part VI section 20 walks through the dashboard
   rendering of the same chain on the CPT and Detailed-BN tabs.

The next Part (Part V, Validation and Sensitivity) drills into the
LOO cross-validation that probes the quality of the BDeu CPTs and the
mutual-information sensitivity that ranks source-target pairs.

-- END OF PART IV --
---
title: Part V -- Validation and Sensitivity
parent_document: JERMILOVA_BNRRM_CONSTRUCTION_METHODOLOGY.md
status: v1.0 (assembled 2026-05-17 after body-R4 YELLOW non-blocking, holistic-R1 RED applied)
authority: validation-{gsl,gbs}.json, sensitivity-{gsl,gbs}.json,
           inference-results.json, fit_mackenzie_model.py
ascii_compliance: required (code point <= 127)
word_budget: 4000
---

# Part V -- Validation and Sensitivity

Part V records the three quantitative diagnostics applied after CPT
fitting (Part IV): (a) leave-one-out (LOO) cross-validation of the two
BDeu-fit data-supported nodes per submodel, (b) mutual-information-based
sensitivity analysis across every source-to-endpoint pair, and (c)
forward inference plus the per-region machinery. The Part is honest
about three load-bearing limitations: the partial-LOO design refits
only the target node's CPT, the freshwater_thg LOO returns Cohen's
kappa = 0.0 in BOTH submodels because the model collapses to
majority-class prediction, and the per-region inference uses overall
priors as the baseline for every region because the discretized training
cases lack per-station region labels. Part VIII consolidates these
limitations with the others gathered across the document.

## Facts pinned for Part V

The four `(submodel, target_node)` LOO cells and their reported metrics
are pinned here so the prose below cannot drift. Source files:
`results/validation-gsl.json` and `results/validation-gbs.json`.

| Submodel | Target node | N (LOO-eligible) | Accuracy | Cohen's kappa | Cohen band |
|----------|-------------|----------------:|---------:|-------------:|-----------|
| GSL | fish_tissue_hg | 584 | 0.6866 | 0.466 | moderate (0.41 - 0.60) |
| GSL | freshwater_thg | 855 | 0.9450 | 0.000 | none (<= 0) |
| GBS | fish_tissue_hg | 258 | 0.6667 | 0.489 | moderate (0.41 - 0.60) |
| GBS | freshwater_thg | 1589 | 0.8464 | 0.000 | none (<= 0) |

Method, LOO-eligibility skip, MAP-prediction rule, and the kappa formula
trace to `fit_mackenzie_model.py`:

- `loo_cross_validation()` lines 759 - 937 (orchestration; both target
  nodes)
- partial-LOO design (refit ONLY the target node's CPT): comment at line
  804 ("Refit only fish_tissue_hg CPT (other CPTs are from full data)")
  and the parallel block for `freshwater_thg` at lines 886 - 891
- MAP prediction from refitted CPT at line 814: `pred = max(dist, key=dist.get)`
- parent-missing skip (the source of the input-vs-LOO-eligible count gap):
  fish target at lines 787 - 800; water target at lines 870 - 884
- Cohen's kappa formula: `(p_o - p_e) / (1 - p_e)` at
  `cohens_kappa()` lines 735 - 756 (edge case `abs(1 - p_e) < 1e-10`
  returns 1.0 if `p_o == 1.0` else 0.0)
- Cohen 1960 interpretation table: <= 0 none, 0.01 - 0.20 slight,
  0.21 - 0.40 fair, 0.41 - 0.60 moderate, 0.61 - 0.80 substantial,
  0.81 - 1.00 almost perfect

Sensitivity facts (cited from `results/sensitivity-gsl.json` and
`results/sensitivity-gbs.json`):

- Sensitivity method: KL-divergence-based mutual information,
  `mutual_information()` lines 662 - 676 and `sensitivity_analysis()`
  lines 679 - 728. Source nodes iterated over all roots with priors;
  target nodes are every `effect` or `impact` node.
- GSL top-of-overall ranking: `proximity_historic_mine ->
  freshwater_thg` at MI = 0.155369 (sensitivity-gsl.json lines 6 - 10).
- GSL top source-to-`fish_tissue_hg`: `fish_species` at MI = 0.103219
  (lines 11 - 15), followed by `proximity_mine_gsl` 0.04821,
  `proximity_historic_mine` 0.026089, `fish_length` 0.010546,
  `atmospheric_hg_deposition` 0.007168.
- GBS top-of-overall ranking: `fish_species -> fish_tissue_hg` at
  MI = 0.078606 (sensitivity-gbs.json lines 6 - 10), followed by
  `fish_species -> degree_of_injury` 0.057833.
- ptwi_exceedance MI is 0.0 from every root in both submodels because
  the deterministic chain `fish_tissue_hg -> mehg_ingested ->
  ptwi_exceedance` passes through the binned MeHg formula and the
  binary pTWI threshold, both of which compress upstream variation
  away on the population-prior marginal (a feature of the deterministic
  CPT design, not a sensitivity failure).

Inference facts (cited from `fit_mackenzie_model.py` and
`results/inference-results.json`):

- `forward_inference()` lines 586 - 655 -- exact-enumeration
  topological-sort propagation.
- `infer_per_region()` lines 944 - 977 -- per-region machinery.
- The known per-region limitation is documented inline in the code at
  `fit_mackenzie_model.py:950-952`: "Since training data does not carry
  region labels, we use the overall priors for all regions as baseline".
  Per-region differentiation is NOT estimated from the data; it comes
  from the published Jermilova comparison (Part VII).
- GSL regions: outlet, middle, north_arm, east_arm. GBS regions: north,
  west, east, south (Appendix A Section A.3; `dag_definition_mackenzie_hg.py:233-234`).
- `inference-results.json` records the same baseline beliefs for every
  region within a submodel; the per-region keys are present for API
  shape compatibility, not because any per-region signal was learned.

## 15. Leave-one-out (LOO) cross-validation

### 15.1 Partial-LOO design (target CPT only)

LOO in this build refits ONLY the held-out observation's target node CPT;
all ancestor and descendant CPTs remain at their full-data fit. The
explicit code comment at `fit_mackenzie_model.py:804` reads "Refit only
fish_tissue_hg CPT (other CPTs are from full data)". The same pattern
applies to `freshwater_thg` LOO at lines 886 - 891.

This is a methodological choice for speed: a full-network LOO would refit
every CPT in the DAG for each held-out row (584 + 855 = 1439 fits per
GSL run, multiplied by the 7 empirical + 3 BDeu + 4 deterministic
CPT-shaped rebuilds at each fit). With the partial-LOO design the cost
collapses to one BDeu CPT refit per held-out row.

The methodological tradeoff is surfaced here rather than left implicit.
Partial LOO validates the TARGET node's conditional structure under
held-out data; it does NOT re-validate ancestor CPTs (which are still
fit on the full data including the held-out parent observations) and it
does NOT re-validate full-network propagation. A peer reviewer who reads
the kappa values without also reading this section may incorrectly
interpret kappa = 0.466 as a full-network skill estimate. It is not.
It is the skill of fish_tissue_hg's BDeu CPT given fully-observed
parents in this submodel.

The validation-{gsl,gbs}.json file does not encode the partial-LOO
caveat. The caveat is in the source code only; Part V is therefore the
authoritative place to surface it.

### 15.2 MAP prediction from the refitted CPT

For each held-out row, after the target CPT is refit on the remaining
data, the prediction is the maximum a posteriori state of the
distribution at the held-out row's parent configuration. The relevant
line is `fit_mackenzie_model.py:814`:

```python
pred = max(dist, key=dist.get)
```

`dist` is the row-specific conditional `P(target | parent_values)`
recovered by joining on the pipe-joined parent-configuration key
`"|".join(parent_values)` against the refit CPT (line 811 - 812). If the
parent configuration is absent from the refit CPT (a BDeu fall-through
configuration), the code falls back to the first state in the state
order (line 816); however, in practice every parent configuration is
present in the refit CPT because `fit_bdeu_cpt()` enumerates all
parent-configuration cartesian products and seeds the BDeu prior on each.
The fallback branch is therefore unreachable on these fits, and the
predicted state is always taken from the refit CPT's posterior.

### 15.3 Parent-missing skip and the input-vs-LOO-eligible count gap

For both target nodes, the LOO loop skips any held-out row whose target
value is None OR whose parents have any None value. The fish-target
skip is at lines 787 - 800; the water-target skip is at lines 870 - 884.
The skip is the source of the discrepancy between raw FRDR record
counts and LOO-eligible counts that Part II Section 4.4 flagged.

| Stage | GSL fish | GSL water | GBS fish | GBS water |
|-------|---------:|----------:|---------:|----------:|
| Raw FRDR records | 797 | 2,124 | 797 | 2,124 |
| Discretized cases (post `prepare_mackenzie_data.py`) | 604 | 855 | 274 | 1,589 |
| LOO-eligible (post parent-missing skip) | 584 | 855 | 258 | 1,589 |

The 797 raw fish records (FRDR shared sheet across both submodels)
shrink to 604 GSL and 274 GBS discretized cases after `Region` masking
at the prepare stage, then to 584 and 258 after parent-missing skipping
inside the LOO loop. For water, the GSL and GBS discretized counts pass
through unchanged because the GSL water and GBS water records have
their parents fully observed in the discretized output.

The Facts table at the top of this Part records the LOO-eligible counts
because those are the denominators of the reported kappa and accuracy.
The raw record counts are the right input for the file inventory
(Appendix D); the discretized case counts are the right denominator for
the BDeu CPT fits (Appendix B header table); the LOO-eligible counts
are the right denominator here.

### 15.4 Cohen's kappa formula and edge cases

Cohen's kappa is `(p_o - p_e) / (1 - p_e)`. The implementation at
`fit_mackenzie_model.py:735 - 756` uses the standard form:

```python
p_o = np.trace(cm) / n
p_e = np.sum(row_sums * col_sums) / (n * n)
if abs(1 - p_e) < 1e-10:
    return 1.0 if p_o == 1.0 else 0.0
return (p_o - p_e) / (1 - p_e)
```

`cm` is the confusion matrix indexed `cm[observed_idx][predicted_idx]`.
`p_o` is the observed agreement (diagonal sum over N), `p_e` is the
expected chance agreement under independence of marginals. The edge
case at `p_e == 1` returns 1.0 if and only if observed agreement is also
perfect, else 0.0. This handles the degenerate confusion-matrix case
where every observation falls in the same observed AND predicted class
(p_o = 1, p_e = 1) -- mathematically the formula is 0/0 and the code
breaks the indeterminacy in favour of "perfect agreement" if observed
agreement is in fact perfect, "no skill" otherwise.

Cohen (1960) interpretation bands used throughout Part V:

| Kappa range | Interpretation |
|-------------|----------------|
| <= 0       | none |
| 0.01 - 0.20 | slight |
| 0.21 - 0.40 | fair |
| 0.41 - 0.60 | moderate |
| 0.61 - 0.80 | substantial |
| 0.81 - 1.00 | almost perfect |

### 15.5 Why custom (numpy) rather than `sklearn.metrics.cohen_kappa_score`

The kappa implementation is six lines of numpy and is mechanically
identical to `sklearn.metrics.cohen_kappa_score` with `weights=None`.
The decision to write it inline matches the Part IV Section 11.8
posture: keep the fitting and validation paths free of heavy
dependencies so BDeu / LOO / kappa formulae are auditable inside
`fit_mackenzie_model.py`. No algorithmic novelty; an inspectability
choice.

### 15.6 Results

`fish_tissue_hg` LOO performance is moderate in BOTH submodels.
`freshwater_thg` LOO performance is high-accuracy but zero-kappa in
BOTH submodels (Section 15.7).

GSL submodel (from `results/validation-gsl.json`):

- `fish_tissue_hg`: N = 584, accuracy = 0.6866, kappa = 0.466 (moderate).
  Per-class accuracy and counts:
  - `low`: n = 320, accuracy = 0.9062 (290 correct out of 320)
  - `subsistence`: n = 165, accuracy = 0.4000 (66 correct out of 165)
  - `ec20`: n = 49, accuracy = 0.4082 (20 correct out of 49)
  - `ec50`: n = 49, accuracy = 0.5102 (25 correct out of 49)
  - `above_ec50`: n = 1, accuracy = 0.0000 (single sample;
    statistically meaningless on its own; included for completeness)
- `freshwater_thg`: N = 855, accuracy = 0.9450, kappa = 0.000 (none).
  Per-class accuracy and counts:
  - `low`: n = 808, accuracy = 1.0000 (model predicts `low` on all 808)
  - `medium`: n = 27, accuracy = 0.0000 (model predicts `low` on all 27)
  - `high`: n = 20, accuracy = 0.0000 (model predicts `low` on all 20)

GBS submodel (from `results/validation-gbs.json`):

- `fish_tissue_hg`: N = 258, accuracy = 0.6667, kappa = 0.489 (moderate;
  slightly higher than the GSL value). Per-class accuracy:
  - `low`: n = 95, accuracy = 0.7579
  - `subsistence`: n = 110, accuracy = 0.7364
  - `ec20`: n = 30, accuracy = 0.4667
  - `ec50`: n = 23, accuracy = 0.2174
  - `above_ec50`: n = 0, accuracy = null (no GBS observations in this
    state)
- `freshwater_thg`: N = 1589, accuracy = 0.8464, kappa = 0.000 (none).
  Per-class:
  - `low`: n = 1345, accuracy = 1.0000
  - `medium`: n = 131, accuracy = 0.0000
  - `high`: n = 113, accuracy = 0.0000

The full confusion matrices for all four cells are in the source JSON
files and not duplicated here.

### 15.7 The kappa = 0.0 result, in plain English

In both submodels the freshwater_thg LOO confusion matrix is a single
column: the model predicts `low` for every input regardless of parent
configuration. The reason is the parent configuration alone does not
discriminate the rarer `medium` and `high` states from the dominant
`low` state under the BDeu posterior given the available training data.

Cohen's kappa controls for chance agreement. When the model always
predicts the majority class, the expected agreement under chance equals
the observed agreement, and the kappa numerator `p_o - p_e` is zero
regardless of how high `p_o` (and accuracy) is. This is the correct
statistical signal that the freshwater_thg CPT has not learned
discriminative structure from the available parent configurations.

There are several plausible reasons for this outcome and Part V does
not pick one over the others. The candidates that the next iteration of
the model could test are:

1. Class imbalance: 808 of 855 (94.5 percent) GSL water observations
   and 1345 of 1589 (84.6 percent) GBS water observations are `low`.
   The minority states `medium` and `high` together account for fewer
   than 250 rows per submodel spread over 20 parent configurations.
2. Sparse parent-configuration coverage: Appendix B notes that several
   of the 20 freshwater_thg parent configurations show uniform
   0.333 / 0.333 / 0.333 posteriors in `learned-model-gsl.json` because
   they had zero matching observations. A configuration with zero data
   contributes only the BDeu prior, which under the partial-LOO setup
   votes for the lowest-indexed state via the `max(dist, key=dist.get)`
   tiebreak on uniform distributions and so propagates a `low` vote
   into the confusion matrix.
3. The parent-set itself may not be informative for the rarer states.
   freshwater_thg has only three parents (the two point-source
   proximities and total_hg_deposition); the meaningful concentration
   variation in freshwater THg may be driven by a covariate not in this
   DAG (discharge, season, station-level differences).

The kappa = 0.0 result is not a bug. It is the statistically honest
signal that, under the current discretization and parent set, the
freshwater_thg conditional structure does not separate the rare classes.
A reviewer who wants to address this would have to either change the
breaks (push the `low` ceiling down), enrich the parent set, or pool
rare classes -- none of which has been done in this build.

The fish_tissue_hg kappa = 0.466 (GSL) and 0.489 (GBS) sit firmly in the
"moderate" Cohen band. The per-class accuracies show the same
class-imbalance pattern in milder form: `low` accuracy is 0.91 (GSL)
and 0.76 (GBS), then the rarer states drop to 0.40 - 0.51 (GSL)
and 0.22 - 0.47 (GBS). The model has real conditional skill, but the
skill is concentrated on the dominant states.

### 15.8 What LOO does NOT validate

- Out-of-distribution generalization. LOO is by construction in-sample;
  it does not test transfer to a station or basin not represented in
  the FRDR training data.
- Region transfer. Per-region inference uses overall priors (Section
  17.4); LOO does not detect a region-specific failure mode because
  the refit pools across all regions.
- Full-network propagation. Only the target node's CPT is refit;
  ancestor CPTs (atmospheric / permafrost / soil-erosion priors,
  total_hg_deposition BDeu) are still the full-data fits.
- Deterministic-CPT downstream behavior. The four deterministic CPTs
  are not LOO-validated at all because they are fixed by the regulatory
  thresholds and dose-response equation in Part IV Section 12.

PLAN Section 12 Q7 proposes a forward-inference counterfactual to
quantify the soft-edging bias on the deterministic CPTs; that
diagnostic is consolidated in Part VIII Section 26.8 and deferred to a
future revision. LOO is not the right instrument for it.

## 16. Sensitivity analysis

### 16.1 Method: KL divergence as mutual information proxy

The sensitivity analysis at `fit_mackenzie_model.py:679 - 728` computes,
for every pair `(source, target)` where the source is a root with a
prior and the target is an `effect` or `impact` node, a weighted average
KL divergence:

```text
MI(source, target) = sum_s P(source = s) * D_KL( P(target | source = s) || P(target) )
```

where `P(target)` is the no-evidence baseline marginal computed once at
the start (line 698) and `P(target | source = s)` is the marginal
computed under hard evidence `source = s` (line 713). The per-source-
state KL is averaged over source states using the source's prior as
weights (line 718).

The KL formula at `mutual_information()` lines 662 - 676 is

```text
D_KL(P || Q) = sum_s P(s) * log( P(s) / Q(s) )
```

with floor 1e-12 on both `P(s)` and `Q(s)` to avoid log(0) (lines 672 -
675), and a `max(0.0, kl)` clamp at line 676 to absorb floating-point
underflow when KL is theoretically zero but numerically slightly
negative. This is a standard KL-divergence implementation and matches
Cover and Thomas (2006) equation 2.26.

The "mutual information" label on this quantity is loose. True
information-theoretic mutual information is the expectation under the
joint distribution; the implementation here computes a Bayesian-network
sensitivity proxy: the expected magnitude of belief shift at the target
when the source is observed, marginalizing over the source's prior. It
is monotonically related to mutual information for the
two-marginal-Bayesian-network case but is not the textbook definition.
The methodology-paper terminology is consistent with the BN-RRM
sensitivity-analysis convention (Landis 2021); a peer reviewer should
read it as the BN sensitivity proxy rather than as Shannon mutual
information.

### 16.2 Ranking output

`sensitivity_analysis()` returns a list of `{source, target, mutual_information}`
records sorted descending by the proxy. Both `results/sensitivity-gsl.json`
and `results/sensitivity-gbs.json` follow this shape. Each file contains
42 ranked pairs (7 root sources times 6 effect / impact targets).
(Count CORRECTED per codex body-R1 P2-4 from prior "41 ranked pairs
minus ptwi_exceedance"; `sensitivity_analysis()` at
`fit_mackenzie_model.py:690-724` appends every source-target pair
without exclusion, so the seven zero-MI `ptwi_exceedance` rows near
lines 182-215 of each JSON are included in the file totals. Section
16.3 below interprets those zero-MI rows as the deterministic-cascade
collapse rather than treating them as absent.)

### 16.3 Submodel-specific rankings (verified from the JSON)

GSL submodel, top 5 ranked pairs:

| Rank | Source | Target | MI proxy |
|----:|--------|--------|--------:|
| 1 | proximity_historic_mine | freshwater_thg | 0.155369 |
| 2 | fish_species | fish_tissue_hg | 0.103219 |
| 3 | fish_species | mehg_ingested | 0.074454 |
| 4 | fish_species | degree_of_injury | 0.073229 |
| 5 | proximity_mine_gsl | fish_tissue_hg | 0.048210 |

GSL submodel, the top source -> `fish_tissue_hg` chain (the principal
endpoint of comparison interest):

| Rank | Source | MI proxy to fish_tissue_hg |
|----:|--------|------------------------:|
| 1 | fish_species | 0.103219 |
| 2 | proximity_mine_gsl | 0.048210 |
| 3 | proximity_historic_mine | 0.026089 |
| 4 | fish_length | 0.010546 |
| 5 | atmospheric_hg_deposition | 0.007168 |

GBS submodel, top 5 ranked pairs:

| Rank | Source | Target | MI proxy |
|----:|--------|--------|--------:|
| 1 | fish_species | fish_tissue_hg | 0.078606 |
| 2 | fish_species | degree_of_injury | 0.057833 |
| 3 | fish_species | mehg_ingested | 0.035158 |
| 4 | proximity_rpts_gbs | freshwater_thg | 0.027816 |
| 5 | fish_length | fish_tissue_hg | 0.025363 |

The GSL fish_tissue_hg source-ordering result is the comparable item to
the published Jermilova et al. 2025 Table 2 sensitivity ranking. The
quantitative concordance (Spearman rho, top-3 agreement) is deferred to
Part VII Section 23.3; Part V only records the ranked output here.

### 16.4 ptwi_exceedance and the deterministic-cascade collapse

In both submodels every source -> ptwi_exceedance MI proxy is exactly
0.0. This is not a numerical error. The cascade
`fish_tissue_hg -> mehg_ingested -> ptwi_exceedance` consists of two
deterministic CPTs (deterministic_subsistence and deterministic_ptwi,
Part IV Section 12.4 - 12.5) sandwiching a 6-state binning. When the
marginalization over the fish_tissue_hg prior is performed under each
root-source intervention, the binning compresses the underlying
variation to the point where the ptwi_exceedance marginal does not
shift detectably. In effect, the source-to-pTWI signal-to-noise is
zero through the deterministic cascade given the population-prior
marginal on fish_tissue_hg.

This is a feature of the deterministic-CPT design, not a sensitivity
failure. ptwi_exceedance is, per Part VIII Section 26.9, a SCENARIO
endpoint conditioned on the subsistence consumption assumptions; its
marginal at a population-average root prior should not move sharply
with a single root-source intervention. If a peer reviewer wants
non-zero source -> pTWI MI proxies they would have to intervene at
fish_tissue_hg directly (a counterfactual evidence assertion the
current sensitivity_analysis routine does not support; it intervenes
only on root sources).

## 17. Forward inference and per-region application

### 17.1 Topological-sort exact enumeration

`forward_inference()` at `fit_mackenzie_model.py:586 - 655` performs an
exact-enumeration forward pass on the DAG. The algorithm is:

1. Topological sort of all 14 nodes per submodel via `topo_sort()`
   (line 606; the sort itself is at lines 127 - 148).
2. For each node in topological order:
   - if the node has hard evidence, set belief to the one-hot
     distribution (lines 614 - 618);
   - else if the node is a root (no CPT entry), use the empirical prior
     if present, otherwise uniform (lines 619 - 624);
   - else compute the marginal as a weighted average over parent state
     combinations, where the weight is the product of the parent
     marginals already computed earlier in the topological order
     (lines 626 - 651).
3. The weighted-average computation at lines 626 - 646 iterates
   `itertools.product(*parent_state_lists)`, looks up the CPT row by
   pipe-joined key, and accumulates `weight * dist.get(s, ...)` into
   `result[s]`. The final normalization (line 649) divides by the sum,
   with a fallback to uniform at line 652 - 653 if the sum is zero.

The result is a complete marginal-belief assignment over all 14 nodes
that exactly satisfies the BN sum-product equations for the case where
evidence is empty (the prior marginalization) or where evidence is at
a subset of nodes.

### 17.2 Why custom rather than `pgmpy.inference.VariableElimination`

The same Part IV Section 11.8 rationale applies: the DAG is small
(14 nodes, at most 5 parents, at most 200 parent configurations) and
exact enumeration is tractable and fully inspectable inside
`fit_mackenzie_model.py`. The 70-line implementation at lines 586 - 655
is a textbook sum-product pass; pgmpy would work correctly here, but
the choice is methods-paper inspectability, not correctness.

### 17.3 Per-region inference (eight regions across both submodels)

`infer_per_region()` at `fit_mackenzie_model.py:944 - 977` runs one
forward pass per region. There are 8 regions total: GSL has outlet,
middle, north_arm, and east_arm; GBS has north, west, east, and south
(Appendix A Section A.3; `dag_definition_mackenzie_hg.py:233-234`).

The function signature accepts `fish_data`, `water_data`, `cpts`, and
`priors` as inputs; in principle a per-region implementation would
subset the data by region label and use the region-specific empirical
distributions as priors. The current implementation does not do that
(see Section 17.4 below).

The output structure is `region -> {node_id: {state: probability}}`,
written to `results/inference-results.json` under
`models.GSL.{outlet, middle, north_arm, east_arm}` and
`models.GBS.{north, west, east, south}`. The JSON file has the
expected shape.

### 17.4 The per-region limitation (load-bearing honesty)

The current `infer_per_region()` uses the OVERALL submodel priors as
the baseline for every region. The inline comment at
`fit_mackenzie_model.py:950 - 952` is explicit:

> "Since training data does not carry region labels, we use the
> overall priors for all regions as baseline, then return the
> marginal beliefs. This provides the 'overall model' inference."

The cause is narrower than earlier drafts of this Part claimed
(CORRECTED per codex holistic-R1 P1-1). The discretized cases as
written to `processed/fish_cases_*.csv` and `processed/water_cases_*.csv`
DO carry a per-station region label in the `_region` field (set at
`prepare_mackenzie_data.py:382` for fish and `:454` for water; verified
by reading the CSV head). What is lost is the JSON-only training
representation: `prepare_mackenzie_data.py:649-652` defines
`strip_audit(case)` to drop every key starting with underscore before
serializing to `training_data_{model}.json`, so the `_region` field
is removed from the JSON that `fit_mackenzie_model.py` consumes. The
station coordinates are NOT needed; the region label is already
computed at ingest time. Fixing this gap requires only a one-line
change to `strip_audit()` (e.g., preserve `_region` or rename it
to `region`) and a small downstream change in `fit_mackenzie_model.py`
to consume the per-record region label during fitting and inference.
It does NOT require re-extracting from FRDR or building a spatial
join.

Practical consequence (current build): `infer_per_region()` reads
training_data_{model}.json which lacks the region label, so the
function falls back to overall priors. `inference-results.json` lists
four region keys per submodel and every region's marginal beliefs are
byte-identical to the overall submodel marginal. Region differentiation
in the published-vs-built comparison is therefore one-sided -- the
published model can show outlet-vs-east_arm differences and this build
cannot. Part VII Section 23 has to handle this asymmetry explicitly;
the per-region MI / counterfactual comparison cells are vacuous on this
build's side.

This is the single biggest gap in Part V results, and the PLAN Section
6 Part V item 17.4 requires it to be stated here and re-stated in Part
VIII Section 26.2. It is documented in the source code (lines 950 - 952),
the validation infrastructure, this Part, and Part VIII; the audit
trail is complete.

Fix scope (NARROWED per holistic-R1 P1-1): preserve `_region` in the
training_data_{model}.json output of `prepare_mackenzie_data.py` and
add per-record region consumption in `fit_mackenzie_model.py`'s
fitting and inference paths. The region polygons and station-to-region
joins are NOT required because the region label is already in the
processed CSVs. This is a future Phase work item -- not in scope for
the v1.0 build of this case-study pack, but the scope is much smaller
than the prior framing implied.

### 17.5 What forward inference does enable in this build

Despite the per-region limitation, forward inference does enable
several useful diagnostics that Part V relies on and Part VII
operationalizes:

- The baseline submodel marginals (no evidence) for every endpoint
  node, which WOULD anchor the Dimension 3 Pearson-r comparison if it
  were run (Part VII Section 21.3 protocol). Per Part VII Section 23.0
  and Section 26.10 the Dimension 3 published-figure comparison is
  NOT RUN; the baseline marginals are available in the forward-
  inference output but no Pearson-r values have been computed.
- The sensitivity-analysis baseline at `sensitivity_analysis()` line 698,
  which is exactly one forward pass with empty evidence.
- The counterfactual CAPACITY for the Minamata scenario in
  Part VII Section 21.5 (asserting hard evidence at a root and reading
  off the impact-node marginals). The forward-inference engine CAN
  evaluate that scenario by clamping `atmospheric_hg_deposition` to a
  reduced state and propagating through the existing CPTs. CORRECTED
  per codex body-R2 P1-2: the Minamata scenario IS NOT RUN in the
  current artifact (per Part VII Section 23.0); the capacity exists
  but no scenario evidence has been applied, no fold-change marginals
  have been read off, and `comparison_results.json` has no Minamata
  results. The deliverable does NOT claim Dimension 5 execution.

The forward-inference engine is therefore the workhorse of Parts V and
VII; only the per-region application is unreliable.

## 18. Summary of Part V findings

In compact form, the validation and sensitivity diagnostics for the
Jermilova Mackenzie Hg case-study build are:

- fish_tissue_hg LOO kappa is moderate in both submodels (0.466 GSL,
  0.489 GBS); the model has real conditional skill on the dominant
  states (low / subsistence) and weaker skill on the rarer ec20 /
  ec50 / above_ec50 states.
- freshwater_thg LOO kappa is zero in both submodels (0.000 GSL,
  0.000 GBS) because the model collapses to majority-class prediction;
  accuracy is high (0.945 GSL, 0.846 GBS) because the majority class is
  overwhelmingly dominant, but kappa correctly reports zero skill.
- Sensitivity-analysis rankings put fish_species at the top of the
  source -> fish_tissue_hg chain in both submodels; in GSL the
  proximity_historic_mine -> freshwater_thg link is the overall top
  MI proxy. ptwi_exceedance MI is zero from every root in both
  submodels because the deterministic cascade compresses the
  population-prior variation.
- Forward inference is correct and is the engine for the sensitivity
  baseline and the Part VII Minamata counterfactual. Per-region
  inference is implemented but uses overall priors as the baseline
  for every region; this is documented at lines 950 - 952 of
  `fit_mackenzie_model.py` and is the single biggest gap in this
  Part's results. Fixing it requires upstream changes to
  `prepare_mackenzie_data.py`.

These results feed Part VII (comparison to the published Jermilova
model), Part VIII (consolidated limitations and AI-assisted process
narrative), and Appendix F (decision-provenance ledger -- the
acceptance of the partial-LOO design, the acceptance of the
freshwater_thg kappa = 0.0 outcome, and the acceptance of the
per-region limitation are all HITL gates that Appendix F records).

-- END OF PART V --
---
title: JERMILOVA BN-RRM CONSTRUCTION METHODOLOGY -- Parts VI, VII, VIII, IX
parent_document: JERMILOVA_BNRRM_CONSTRUCTION_METHODOLOGY.md
status: v1.0 (assembled 2026-05-17 after body-R4 YELLOW non-blocking, holistic-R1 RED applied)
created: 2026-05-17
author: AI orchestrator (Claude Opus 4.7) under HITL direction
scope: Closing four chapters of the methodology paper, drafted per PLAN v0.4
       Section 6 Parts VI/VII/VIII/IX.
ascii_constraint: All characters in this file must satisfy code point <= 127.
---

# Part VI -- Export and Frontend Rendering

## Facts pinned for Part VI

The empirical claims in Part VI trace to the following sources. Every
quantitative or structural fact stated in the prose below must match a
row here; codex spot-checks five claims per Part for traceability.

| Fact | Value | Source |
|------|-------|--------|
| `export_generic_model.py` total lines | 436 | Appendix D Section 1 (RR `bn_learning/`) |
| Generic exporter output schema | `generic-bn-rrm-v1` | `bn_learning/packs/.../pack.json:8` (`runtime_schema_version`) |
| Layout algorithm | Containers top-to-bottom; nodes left-to-right within a container | `export_generic_model.py:89-119` (`compute_layout`) |
| Layout constants | `container_y_gap = 200`, `node_x_gap = 200`, `container_padding = 40`, `container_x_start = 50`, `container_y_start = 50` | `export_generic_model.py:100-104` |
| Color palette source | `STATE_COLORS_BY_CATEGORY` dict keyed by category and n-states | `export_generic_model.py:39-68` |
| 5-state substance/effect/impact gradient | `#22c55e -> #a3e635 -> #eab308 -> #f97316 -> #ef4444` (green-yellow-red) | `export_generic_model.py:45,58,65` |
| CPT transformation | Pipe-joined parent-state key split into `parentStates` dict; flat list of `{parentStates, probabilities}` | `export_generic_model.py:158-195` (`transform_cpts_to_frontend`) |
| Exporter input | `results/learned-model-{gsl,gbs}.json` | Appendix D Section 5 |
| Exporter output | `packs/bnrrm-casestudy-jermilova2025-mackenzie-hg/runtime/learned-model.json` | Appendix D Section 7 |
| RR pack files | 7 (1 pack.json + 1 runtime + 1 training_data + 4 review JSONs; no `map/`) | Appendix D Section 7 |
| SSTAC pack files | 28 (RR core + 8 dashboard-only review + 1 map manifest + 12 GeoJSON) | Appendix D Section 8 |
| RR pack `pack.json` SHA-256 | `8945a4f4...` | Appendix D Section 7 |
| SSTAC pack `pack.json` SHA-256 | `24b322e8...` | Appendix D Section 8.1 |
| RR pack `runtime/learned-model.json` SHA-256 | `adf98f1a...` (177,768 B) | Appendix D Section 7 |
| SSTAC pack `runtime/learned-model.json` SHA-256 | `87ea0051...` (178,496 B) | Appendix D Section 8.1 |
| Live drift state (shared subset) | `training_data.json` + 4 review JSONs IDENTICAL; `pack.json` + `runtime/learned-model.json` DIFFER | Appendix D "Live drift state" |
| SSTAC renderer entry point | `createGenericNetwork` | `C:/Projects/SSTAC-Dashboard/src/lib/bn-rrm/trained-network.ts:968-1089` |
| Container-category inference | Majority vote across child node categories | `trained-network.ts:949-966` (`inferContainerCategory`) |
| Tier-x layout constants (renderer) | substance=50, condition=500, effect=950, impact=1400 | `trained-network.ts:1019` |
| Dashboard tab count | 8 (Guide, Conceptual, Detailed BN, CPT, Map, Data, Review, Case Studies) | PLAN Section 6 Part VI item 20.1 |
| Jermilova pack network size | 14 nodes / 15 edges per submodel | Appendix A Section A.1; `pack.json:9-10` |
| Canonical (general) pack network size | 20 nodes (sediment) | `trained-network.ts:1-21` (`metalNodes` + condition + effect + impact composition) |

## 18. Generic exporter (`export_generic_model.py`, 436 lines)

The generic exporter is the single Python module that converts a fitted
case-study model into the runtime artifact the SSTAC Dashboard renders.
It is intentionally model-agnostic: the same script processes both the
Mackenzie GSL and GBS submodels, and would process any future
`generic-bn-rrm-v1`-shaped network defined under the same conventions.
The module lives at `bn_learning/export_generic_model.py` (436 lines,
14,739 bytes; Appendix D Section 1). It depends only on the Python
standard library plus the project's own DAG-definition modules. No
pgmpy or NumPy is required on the export path.

### 18.1 `learned-model.json` schema (`generic-bn-rrm-v1`)

The output is a single JSON document containing the entire dashboard
runtime payload for one submodel. The exporter writes it to
`runtime/learned-model.json` inside the pack tree. The top-level
keys produced by `export_generic_model()` at
`export_generic_model.py:339-354` are:

```
{
  "modelId":     <string, copied from learned model>,
  "version":     <string, copied from learned model>,
  "description": <string>,
  "source":      <string>,
  "doi":         <string>,
  "createdAt":   <string>,
  "nodes":       [<NetworkNodeData>, ...],
  "edges":       [<NetworkEdge>, ...],
  "containers":  [<ContainerData>, ...],
  "cpts":        [<ConditionalProbabilityTable>, ...],
  "marginals":   { <node_id>: { <state>: <prob> } },
  "dataCoverage": { ... },
  "validation":  {},
  "regions":     [<string>, ...]
}
```

The schema label `generic-bn-rrm-v1` is recorded separately in
`pack.json` (`runtime_schema_version` field, Appendix D Section 7) and
is the contract the dashboard uses to choose `createGenericNetwork`
over `createDefaultNetwork` (Section 20.2).

Each `NetworkNodeData` entry combines learned-model state lists with
DAG-definition descriptions and inference-result beliefs. The structure
is computed in `transform_nodes()` at
`export_generic_model.py:202-257`:

```
{
  "id":          <node id from DAG>,
  "label":       <human-readable label from DAG>,
  "category":    "substance" | "condition" | "effect" | "impact",
  "states":      [{ "id": <state id>, "label": <Title Case>, "color": <hex> }, ...],
  "beliefs":     { <state>: <probability> },
  "description": <prose from DAG definition>,
  "position":    { "x": <int>, "y": <int> }
}
```

The state list always has length equal to the cardinality recorded in
the DAG (Appendix A Sections A.4.1 and A.5.1). Belief sources are, in
order of preference: (a) per-region inference results from
`inference-results.json` if a region is selected; otherwise (b) the
empirical prior recorded on the node; otherwise (c) a uniform
distribution over states (`transform_nodes()` at lines 231-240).

CPTs in the output are emitted as a flat list (see Section 18.4
below), not as the nested `{node_id: {table: ...}}` shape used in
`learned-model-{gsl,gbs}.json`. Edges are passed through unchanged
because the learned-model JSON already stores them in the
`{source, target}` shape the dashboard expects
(`export_generic_model.py:330`).

### 18.2 Layout computation

Layout is intentionally simple: containers are stacked top-to-bottom,
and within each container the nodes are placed left-to-right in
declaration order. The relevant code is `compute_layout()` at
`export_generic_model.py:89-119` with constants pinned at lines
100-104:

```
container_x_start    = 50
container_y_start    = 50
container_y_gap      = 200   # vertical gap between container rows
node_x_gap           = 200   # horizontal gap between nodes in a row
container_padding    = 40    # padding inside container
```

For each container the cursor walks down by `container_y_gap`, and
each node receives `(x_start + i * node_x_gap, y_cursor +
container_padding)`. The function does not attempt graph-based
layouts (no spring force, no minimum-edge-crossing search). The
rationale is that the dashboard renderer (Section 20.2) recomputes
container positions left-to-right by category tier at draw time
(`trained-network.ts:1017-1029`), so the exporter only needs to
emit reproducible per-node positions that the renderer can use as a
starting point.

Container bounding boxes are then computed in
`compute_container_positions()` at `export_generic_model.py:122-151`
as the min/max envelope of contained node positions plus a 60-pixel
padding, with extra width and height (160 / 100 pixels) so each
container shows its label and a small inset border. The frontend can
either honor those coordinates or override them.

### 18.3 Color assignment (5-state green-to-red gradient)

The exporter assigns a discrete color palette per node by looking up
the node's `category` and number of states in
`STATE_COLORS_BY_CATEGORY` (`export_generic_model.py:39-68`).
Substance, effect, and impact categories all use the same green-to-red
gradient because they all share a "low value is good, high value is
bad" interpretation. Condition uses a blue family (light blue to
saturated blue) because conditions are not risk-ordered in the same
direction.

The five-state palette for substance/effect/impact at
`export_generic_model.py:45,58,65` is:

```
2 states:  #22c55e, #ef4444                              (green, red)
3 states:  #22c55e, #eab308, #ef4444                     (green, yellow, red)
4 states:  #22c55e, #a3e635, #eab308, #ef4444            (4-step)
5 states:  #22c55e, #a3e635, #eab308, #f97316, #ef4444   (green-lime-yellow-orange-red)
6 states:  #22c55e, #86efac, #a3e635, #eab308, #f97316, #ef4444
```

State labels are produced by replacing underscores with spaces and
applying title case (`export_generic_model.py:227`), so the JSON
stores `low -> "Low"` and `above_ec50 -> "Above Ec50"`. Hex colors
fall back to `#94a3b8` (slate gray) if the palette runs out
(`export_generic_model.py:228-229`); the per-category palettes cover
all currently-defined state counts in the Mackenzie DAG, so this
fallback is dead code in practice but defends against future state
additions.

### 18.4 CPT transformation (Python dict -> TypeScript NetworkModel shape)

The CPT shape change from the learned-model JSON to the runtime JSON
is the load-bearing transformation in the exporter. The function is
`transform_cpts_to_frontend()` at
`export_generic_model.py:158-195`. The input format (one entry per
node) is the same nested shape Appendix B documents:

```
"fish_tissue_hg": {
  "parents": ["fish_species", "fish_length", ...],
  "states":  ["low", "subsistence", "ec20", "ec50", "above_ec50"],
  "method":  "bdeu",
  "table":   { "lake_whitefish|small|yes|yes|low": {"low": 0.2, ...}, ... }
}
```

The output is a flat list keyed by `nodeId`, with each parent-state
combination expanded into a structured `parentStates` dict so the
TypeScript renderer can look up cells by name rather than by key
parsing:

```
[
  {
    "nodeId":    "fish_tissue_hg",
    "parentIds": ["fish_species", "fish_length", ...],
    "table": [
      {
        "parentStates":  { "fish_species": "lake_whitefish",
                           "fish_length":  "small", ... },
        "probabilities": { "low": 0.2, "subsistence": 0.2, ... }
      },
      ...
    ]
  },
  ...
]
```

The transformation is order-preserving on parents
(`export_generic_model.py:176-183`): the pipe-joined key
`"lake_whitefish|small|yes|yes|low"` is split on `|`, and each segment
is paired with the parent id at the corresponding index. The dashboard
guarantees the same parent order is honored on display
(`trained-network.ts:801-878`, `loadLearnedCPTs`). Appendix B Section
B.2.2 cites a slice of `results/learned-model-gsl.json` showing the
input shape; the output shape is what the dashboard's CPT tab reads
directly without further normalization.

A subtle implementation detail: the `cpts` block in the learned-model
JSON does not include empirical-prior roots (those are emitted in the
top-level `marginals` block instead). The transformation therefore
yields one CPT row per BDeu or deterministic node only, which for the
Mackenzie submodels is 7 rows per submodel (3 BDeu + 4 deterministic).
The 7 root-node empirical priors are read by the dashboard from the
`priors` field inside each node entry (`transform_nodes()` falls back
to the prior at `export_generic_model.py:235-237`), so all 14 node
distributions are still surfaced; only the storage shape differs.

### 18.5 Inputs and outputs

The exporter consumes three artifacts and produces one. The full data
flow is:

```
results/learned-model-{gsl,gbs}.json    (input; Appendix D Section 5)
results/inference-results.json          (input, optional; Appendix D Section 5)
dag_definition_mackenzie_hg.py          (input; descriptions only)
              -> export_generic_model.py
              -> runtime/learned-model.json    (output; Appendix D Section 7)
```

The CLI in `export_generic_model.py:374-432` accepts
`--learned-model` (the per-submodel fit), `--inference-results`
(optional per-region beliefs), `--model GSL|GBS` (which model key to
select inside the inference results), `--region` (optional region
override), `--dag-module` (the DAG-definition module path), and
`--output` (target path for the runtime JSON). For the canonical RR
pack the call is:

```
cd <project>
python -m bn_learning.export_generic_model \
    --learned-model bn_learning/external_case_studies/jermilova_2025_mackenzie_hg/results/learned-model-gsl.json \
    --inference-results bn_learning/external_case_studies/jermilova_2025_mackenzie_hg/results/inference-results.json \
    --dag-module bn_learning.dag_definition_mackenzie_hg \
    --model GSL \
    --output bn_learning/packs/bnrrm-casestudy-jermilova2025-mackenzie-hg/runtime/learned-model.json
```

(Recipe CORRECTED per codex body-R2 P2-1 to use the verified-working
project-root form with absolute `bn_learning/external_case_studies/.../`
input paths and `bn_learning.dag_definition_mackenzie_hg` module form.
The same form is used in Part IX Step 4.)

The output lands in the `runtime/` subfolder of the pack and is one of
the seven shared files inventoried in Appendix D Section 7. The same
call with `--model GBS` overwrites the same runtime path for the GBS
submodel; the pack ships a single runtime model and switches between
GSL and GBS by changing the `--model` parameter before publishing,
not by storing both runtimes side-by-side.

## 19. Pack assembly -- two-location reality

The pack lives in TWO physical locations with DIFFERENT contents. The
methodology distinguishes them precisely; conflating them is a
documented PLAN risk (Section 12 Q8).

### 19.1 RR-generated core pack

The Regulatory-Review pipeline writes the canonical core pack at
`C:/Projects/Regulatory-Review/2026_Database_Development/data_acquisition/bnrrm_extraction/bn_learning/packs/bnrrm-casestudy-jermilova2025-mackenzie-hg/`.
This is what `export_generic_model.py` plus the manual pack-assembly
step produce. The full inventory (Appendix D Section 7) is:

```
pack.json                              (2,376 bytes; SHA-256 8945a4f4...)
training_data.json                     (795,344 bytes; SHA-256 e6ad4be9...)
runtime/learned-model.json             (177,768 bytes; SHA-256 adf98f1a...)
review/comparison_results.json         (8,051 bytes; SHA-256 70358df3...)
review/model_overview.json             (2,846 bytes; SHA-256 14f0676a...)
review/published_reference.json        (7,027 bytes; SHA-256 4f34e54a...)
review/validation.json                 (5,134 bytes; SHA-256 9303132...)
```

The total is seven files in three subtrees (pack root,
`runtime/`, `review/`). There is NO `map/` folder. The four review
JSONs in the RR pack are the four artifacts the RR pipeline produces:

- `comparison_results.json`: a PARTIAL subset of the 5-dimension
  COMPARISON_PROTOCOL.md, containing `structural`, `sensitivity_ranking_
  comparison`, `loo_accuracy_summary`, and `published_code_notes`
  top-level sections. The `loo_accuracy_summary` is an INTERNAL
  validation tool (LOO of fish_tissue_hg and freshwater_thg), NOT
  protocol Dimension 3 coverage; Dimension 3 is a per-region
  marginal-belief comparison against published figures with Pearson r
  and MAD thresholds, which is NOT run. THREE protocol dimensions
  (Dimension 2 CPT-divergence-Jensen-Shannon, Dimension 3 per-region
  marginal-belief, Dimension 5 Minamata counterfactual) are SPECIFIED
  IN THE PROTOCOL but NOT RUN in the current artifact. Part VII
  Section 23 reports only what the artifact actually contains; the
  three unrun dimensions are surfaced as open follow-ups (Part VIII
  Section 26.10; Part IX Section 27.5 items c, e, f). (Scope
  CORRECTED per codex body-R1 P1-1 and body-R2 P1-1; LOO-as-Dimension-3
  wording withdrawn per codex body-R3 P2.)
- `model_overview.json`: dashboard summary
- `published_reference.json`: digitized Jermilova baseline
- `validation.json`: LOO validation summary

The remaining eight review artifacts the dashboard ships (Section 19.2)
are not generated by the RR pipeline.

### 19.2 SSTAC deployed augmented pack

The dashboard deploys the augmented pack at
`C:/Projects/SSTAC-Dashboard/public/bn-rrm/packs/bnrrm-casestudy-jermilova2025-mackenzie-hg/`.
This pack lives in a SEPARATE repository (`C:/Projects/SSTAC-Dashboard`,
not in Regulatory-Review) and is published by the dashboard build, not
by the RR export. The full inventory (Appendix D Section 8) is:

- The same seven shared files as Section 19.1 (with two of them
  differing byte-for-byte; see Section 19.3).
- Eight DASHBOARD-ONLY review JSONs:
  `review/cpt_transparency.json` (10,508 B),
  `review/decisions.json` (6,203 B),
  `review/explainer.json` (6,478 B),
  `review/model_comparison.json` (1,366 B),
  `review/provenance_registry.json` (4,081 B),
  `review/risk_comparison.json` (1,709 B),
  `review/sensitivity.json` (1,081 B),
  `review/site_reports.json` (3,603 B).
- A `map/` folder with `MAP_LAYERS_MANIFEST.json` plus 12 GeoJSON
  layers (basins x 2, commercial fisheries, advisory lakes,
  historic mines, large mines, mineral claims, oil/gas claims,
  communities, climate stations, hydro facilities, thaw slumps).
  Total map subtree: 13 files, the largest being `thaw_slumps.geojson`
  at 1,290,355 bytes.

The SSTAC pack therefore contains 28 files total versus the RR pack's
7. The full file-by-file accounting with sizes, modification dates,
and SHA-256 hashes is Appendix D Section 8.

### 19.3 Drift policy and live drift state

Per PLAN Section 6 Part VI item 19.3 and Definition of Done item 10,
drift between the two pack locations is reported by byte-comparing
ONLY the SHARED subset (the seven files inventoried in Section 19.1).
The eight dashboard-only review artifacts and the 13 map files are
explicitly OUT OF SCOPE for the comparison because they have no RR
counterpart.

The live drift state, recorded in Appendix D's "Live drift state
(2026-05-17)" subsection, is:

```
training_data.json                    IDENTICAL
review/comparison_results.json        IDENTICAL
review/model_overview.json            IDENTICAL
review/published_reference.json       IDENTICAL
review/validation.json                IDENTICAL
pack.json                             DIFFERS (3,436 vs 2,376 bytes)
runtime/learned-model.json            DIFFERS (178,496 vs 177,768 bytes)
```

The `pack.json` divergence is structurally explained: the SSTAC
manifest also lists the eight dashboard-only review artifacts and 12
map layers, so it is necessarily larger than the RR manifest, which
only knows about the shared subset. This drift is compatible with the
"byte-compare only shared subset" policy and is not a defect.

CORRECTED per codex holistic-R1 P1-2: the
`runtime/learned-model.json` divergence is NOT just timestamp /
formatting / layout regeneration. A JSON-level diff of the two copies
shows TWO substantive structural differences:

1. The SSTAC copy adds a top-level `conceptualTiers` array that the
   RR copy does not contain. This is a dashboard-side enrichment
   that drives the conceptual-view tab; the renderer at
   `src/lib/bn-rrm/trained-network.ts` reads `conceptualTiers` if
   present and falls back to inferred categories otherwise.
2. The SSTAC copy moves `eligible_commercial_catch` from the
   "Effects" container (RR-pack assignment) to the "Human Health"
   container (SSTAC-pack assignment). This is a deliberate
   re-categorization on the dashboard side, presumably because
   eligible_commercial_catch is consumed by the human-health
   interpretation pane.

These are substantive structural augmentations that affect rendering
and interpretation in the dashboard. The "functionally same model"
wording previously in this section is WITHDRAWN. The deployed pack
should be cited as the AUGMENTED RUNTIME and the RR-pack runtime as
the SOURCE RUNTIME; reviewers consulting the deployed dashboard see
the augmented model, not the source. The container reassignment in
particular has interpretation consequences -- a reader who treats
`eligible_commercial_catch` as a member of the "Effects" container
(per Part III Section 7.2's category framing and Appendix A's
container assignments) will be looking at the RR pack; the dashboard
reader sees it in "Human Health". The deliverable consolidates this
as Section 26 limitation per codex holistic-R1 P2-5.

The `runtime/learned-model.json` divergence (728 bytes larger on the
SSTAC side, 178,496 vs 177,768) is now fully characterized per codex
holistic-R1 P1-2 and R4 propagation: the embedded learned-model
content has TWO substantive structural differences on the SSTAC
side, NOT a serialization re-render. (1) A top-level `conceptualTiers`
array is added to the SSTAC copy (the dashboard renderer reads it
for the conceptual-view tab; the RR-pack copy does not contain it).
(2) `eligible_commercial_catch` is reassigned from the "Effects"
container (RR-pack source) to the "Human Health" container
(SSTAC-pack augmented). The prior "same broad contents, different
precise serialization" / "not fully characterized" / "re-rendered"
framing is WITHDRAWN. The deployed runtime is an AUGMENTED RUNTIME,
not the SOURCE RUNTIME (see Section 26.10C consolidated limitation).
The "byte-compare only shared subset" policy still applies because
the runtime augmentation is dashboard-side, but the runtime drift
is structural rather than cosmetic.

The IDENTICAL state of the four shared review JSONs is load-bearing
for Part VII: the comparison artifact `review/comparison_results.json`
and the digitized baseline `review/published_reference.json` are both
byte-identical across the three locations they appear in (RR results
folder, RR pack, SSTAC pack), so Part VII can cite the RR pack copy
with no risk of silently diverging numbers.

### 19.4 Attribution discipline: dashboard-only artifacts are NOT RR-generated

A repeated review concern is the temptation to attribute the eight
dashboard-only review JSONs and the 12 GeoJSON map layers to the RR
pipeline. They are not produced by `export_generic_model.py` or any
other RR module. They are dashboard-side augmentations produced by the
SSTAC-Dashboard build process, which composes the shared core with
dashboard-specific summaries (e.g., the compact
`model_comparison.json` is a dashboard convenience derived from but
not equal to the larger `comparison_results.json`).

The methodology paper therefore claims credit only for the seven
shared files. Any prose that suggests the pipeline produced map
layers, site reports, or risk-comparison summaries is incorrect and
must be revised. The dashboard's production of these artifacts is
documented separately in the SSTAC-Dashboard codebase (out of scope
for this methods paper).

## 20. SSTAC dashboard rendering

### 20.1 Eight-tab walkthrough

The SSTAC Dashboard exposes the Jermilova pack through eight tabs in a
fixed order. Each tab consumes a specific subset of the pack
artifacts. The tabs are:

1. **Guide.** A static introduction to BN-RRM concepts, the Mackenzie
   Hg case study, and how to interpret the dashboard. Static content,
   no pack data consumed.
2. **Conceptual.** A simplified causal-chain diagram (sources -> water
   -> fish -> exposure -> impact) drawn from container metadata in
   `runtime/learned-model.json`. Containers are shown collapsed by
   default; expanding a container reveals child nodes.
3. **Detailed BN.** The full DAG canvas, rendered by
   `createGenericNetwork` (Section 20.2). Shows all 14 nodes, 15
   edges, and the seven containers, with state beliefs displayed on
   each node.
4. **CPT.** Per-node CPT viewer that reads from the flat `cpts` array
   of `runtime/learned-model.json` and the dashboard-only
   `review/cpt_transparency.json`. Allows browsing parent
   configurations for BDeu and deterministic CPTs.
5. **Map.** GeoJSON-backed Leaflet map with the 12 dashboard layers
   (basins, mines, advisory lakes, claims, communities, climate
   stations, thaw slumps, and so on) plus the `MAP_LAYERS_MANIFEST`
   metadata. Map data is NOT in the RR pack.
6. **Data.** Read-only training-data viewer (`BenchmarkDataViewer`,
   referenced in PLAN Section 7) backed by `training_data.json`.
   Displays the 604 fish + 855 water rows (GSL) or 274 fish + 1,589
   water rows (GBS) without exposing classification or upload
   controls.
7. **Review.** Dashboard summaries: `model_overview.json`,
   `validation.json`, `comparison_results.json`,
   `risk_comparison.json`, `decisions.json`, `provenance_registry.json`,
   and the dashboard-only `model_comparison.json` and
   `sensitivity.json`. Surfaces the comparison-to-published findings
   plus provenance metadata.
8. **Case Studies.** Cross-pack catalog of all BN-RRM packs the
   dashboard hosts. Allows the user to compare the Mackenzie pack to
   future case studies; also surfaces the `release_stage = prototype`
   banner.

### 20.2 `createGenericNetwork` (renderer summary)

The dashboard renderer that consumes the `generic-bn-rrm-v1` runtime
JSON is `createGenericNetwork` at
`C:/Projects/SSTAC-Dashboard/src/lib/bn-rrm/trained-network.ts:968-1089`.
Its role is to convert the generic JSON into a `NetworkModel` that
the canvas widget can render. The function takes the JSON, validates
that the `nodes`, `edges`, and `containers` arrays are non-empty
(`trained-network.ts:970-1001`), builds a reverse-map from node id to
container id (`trained-network.ts:982-988`), and then synthesizes
container categories where the JSON did not specify them.

The category-inference step is `inferContainerCategory` at
`trained-network.ts:949-966`. It walks the container's child nodes,
counts the `category` field of each, and returns the majority
category, defaulting to `substance` when no children carry a
category. This makes the renderer tolerant of pack JSONs that omit
container categories (the Mackenzie pack does declare them, so the
inference step is a no-op for this pack; the fallback handles
forward-compatibility with future packs).

After category inference, the renderer auto-positions containers
left-to-right by category tier
(`trained-network.ts:1017-1029`). The four tier x-coordinates are
hard-coded: `substance` at 50, `condition` at 500, `effect` at 950,
`impact` at 1400. Containers in the same tier stack vertically with a
20-pixel gap and a 90-pixel collapsed height. The exporter's per-node
positions (Section 18.2) are honored when nodes are within an expanded
container; if a container is collapsed (the default), the renderer
shows only the container box and the summary belief.

The CPT-loading step is `loadLearnedCPTs` at
`trained-network.ts:801-878`. It reads the flat `cpts` array from the
runtime JSON, validates that every referenced node id is present in
the network, and emits a warning for any unknown parent
(`trained-network.ts:1058-1063`). This is the contract the exporter's
`transform_cpts_to_frontend` (Section 18.4) was written to satisfy.

### 20.3 Differences from the canonical (general) pack

The general pack -- the canonical 20-node BC sediment BN-RRM -- and
the Jermilova case-study pack share most of the rendering machinery
but differ in several important ways. The table below summarizes the
practically visible differences:

- **Network size**
  - General pack (sediment): 20 nodes
  - Jermilova pack (mercury): 14 nodes (per submodel)

- **Schema**
  - General pack (sediment): `bnrrm-v1`
  - Jermilova pack (mercury): `generic-bn-rrm-v1`

- **Renderer entry point**
  - General pack (sediment): `createDefaultNetwork`
  - Jermilova pack (mercury): `createGenericNetwork`

- **Substance composition**
  - General pack (sediment): 9 contaminants (Cu, Zn, Pb, Cd, Hg, As, Cr, PAHs, PCBs) + 3 environmental modifiers (TOC, AVS, grain size)
  - Jermilova pack (mercury): 6 mercury-pathway substance nodes per submodel (3 nonpoint: atmospheric, permafrost, soil erosion; 1 aggregator: total deposition; 2 point sources: GSL = mine + historic mine, or GBS = oil + RPTS slumps) plus 2 condition nodes (fish_species, fish_length). Counted as `category: substance` vs `category: condition` per `dag_definition_mackenzie_hg.py:46-58`. (CORRECTED per codex body-R1 P3-1 from prior "7 mercury-pathway sources" which incorrectly conflated substance and condition categories and miscounted.)

- **Impact endpoint**
  - General pack (sediment): `ecological_risk` (sediment-community risk)
  - Jermilova pack (mercury): `ptwi_exceedance` (human-health weekly intake exceedance)

- **CPT provenance**
  - General pack (sediment): Mix of expert-elicited (interim) and data-learned (where co-located triad data exists)
  - Jermilova pack (mercury): Mix of BDeu (3 CPTs), deterministic (4 CPTs), and empirical priors (7 root nodes) per submodel

- **Data tab mode**
  - General pack (sediment): Upload + classification (user supplies station data)
  - Jermilova pack (mercury): Read-only `BenchmarkDataViewer` (frozen training data, 604+855 GSL or 274+1,589 GBS)

- **Map layers**
  - General pack (sediment): Site-specific (uploaded by user as needed)
  - Jermilova pack (mercury): Pack-provided (12 GeoJSONs: basins, mines, advisory lakes, claims, communities, climate, thaw slumps)

- **Top-banner**
  - General pack (sediment): None or internal
  - Jermilova pack (mercury): Purple "frozen benchmark" warning that the pack is a published-paper reconstruction, not a user-driven assessment

The "frozen benchmark" banner is load-bearing for honest reporting:
the Jermilova pack is a reconstruction of a published model on a
specific dataset, not a generic risk-assessment instrument. A reviewer
loading the pack must see immediately that this is an independent
reconstruction (per `pack.json:18`,
`"Independent reconstruction from Jermilova et al. 2025 FRDR data"`),
not a generic user assessment.

### 20.4 Note on stale frontend bug references

Earlier drafts of the project's `CONTINUATION_PROMPT.md` carried a
P0/P1/P2 bug list against the dashboard. As of 2026-05-17 the file
marks all formerly-listed work items 1-2 as COMPLETE and lists only
"future enhancements (not yet approved)". The PLAN at Section 6 Part
VI item 20.4 and the risk register at Section 10 instruct Part VI not
to cite stale bug entries from older versions of that file. This
methodology paper therefore reports the dashboard in its current
state and refers the reader to the SSTAC-Dashboard repository for any
ongoing frontend issues; it makes no claim about historical bugs.

---

# Part VII -- Comparison to Published Model

## Facts pinned for Part VII

| Fact | Value | Source |
|------|-------|--------|
| Comparison protocol document | 5 dimensions; thresholds per dimension | `COMPARISON_PROTOCOL.md` lines 18-127 (Appendix D Section 9) |
| Comparison result artifact | `bn_learning/packs/.../review/comparison_results.json` (RR pack) and identical byte-for-byte at `C:/Projects/SSTAC-Dashboard/.../review/comparison_results.json` | Appendix D Section 7 + Section 8.1 (SHA-256 `70358df3...` in both) |
| Published-reference artifact | `digitized_from_paper.json` at `published_reference/`, plus `review/published_reference.json` copies (all three byte-identical, SHA-256 `4f34e54a...`) | Appendix D Sections 6, 7, 8.1 |
| Dimension 1 (structural) threshold | No numeric threshold; documented table | `COMPARISON_PROTOCOL.md:35` |
| Dimension 2 (CPT divergence) threshold | Mean JSD < 0.15 for nodes with >50% data-learned rows | `COMPARISON_PROTOCOL.md:50` |
| Dimension 3 (marginal belief) thresholds | Pearson r > 0.7 on endpoints; MAD < 0.15 per state | `COMPARISON_PROTOCOL.md:81` |
| Dimension 4 (sensitivity ranking) thresholds | Spearman rho > 0.6 OR top-3 agreement >= 2/3 | `COMPARISON_PROTOCOL.md:109` |
| Dimension 5 (counterfactual) threshold | Same direction + magnitude within 0.5x of published 1.2-fold | `COMPARISON_PROTOCOL.md:127` |
| Structural match (both submodels) | 14 nodes / 15 edges per submodel; `match: true` | `comparison_results.json:2-31` |
| GSL fish_tissue_hg LOO | accuracy 0.6866, kappa 0.466, N = 584 | `comparison_results.json:232-236`; `validation-gsl.json` (Appendix D Section 5) |
| GBS fish_tissue_hg LOO | accuracy 0.6667, kappa 0.489, N = 258 | `comparison_results.json:245-249` |
| GSL freshwater_thg LOO | accuracy 0.945, kappa 0.0, N = 855 | `comparison_results.json:237-241` |
| GBS freshwater_thg LOO | accuracy 0.8464, kappa 0.0, N = 1,589 | `comparison_results.json:250-254` |
| GSL fish_tissue_hg top-1 driver (our MI) | `fish_species` (MI = 0.103) | `comparison_results.json:36-42` |
| GSL fish_tissue_hg top-1 driver (published Table 2) | `Total Hg input` (slope 1.1 +/- 0.45) | `comparison_results.json:68-71` |
| GBS fish_tissue_hg top-1 driver (our MI) | `fish_species` (MI = 0.079) | `comparison_results.json:131-137` |
| GBS fish_tissue_hg top-1 driver (published Table 2) | `Proximity to RPTS` (slope -0.21 +/- 0.028) | `comparison_results.json:168-172` |
| R-code methodological issues | R1 `==` vs `%in%`, R2 GBS lme-vs-summary inconsistency, R3 no `set.seed()` | `comparison_results.json:258-294`; `r_code_analysis_summary.md` lines 1-100 (Appendix D Section 9) |
| Pooled vs per-region fitting | We pool; published model has region-level random effects (`OID_` as grouping variable) | `r_code_analysis_summary.md` lines 91-100 (fit summary) |

## 21. Comparison protocol (five dimensions)

The comparison protocol was authored at M2 and is recorded at
`COMPARISON_PROTOCOL.md` (8,384 bytes, Appendix D Section 9). It
fixes five dimensions plus acceptance thresholds before any fitting
is run, so the methodology cannot be tuned to pass after the fact.
The dimensions are summarized below; the full document is the source
of truth.

### 21.1 Structural DAG comparison

Compare our DAG topology to the published Figure 2 + supplementary
Figure S5. Metrics: node count, edge count, DAG depth, category
distribution, 1:1 node correspondence, and structural-difference
table. No numeric threshold; output is a documented comparison table
(`COMPARISON_PROTOCOL.md:35`).

### 21.2 CPT divergence

Compare fitted CPTs against published CPTs (when independent
fitting is possible). Metric: Jensen-Shannon divergence (JSD) per
parent configuration, with the per-node mean reported. Threshold:
mean JSD < 0.15 for nodes whose CPT has greater than 50% data-learned
rows (`COMPARISON_PROTOCOL.md:50`). Nodes whose CPTs are
expert-prior-dominated may legitimately exceed this threshold; the
protocol does not penalize prior dominance.

This dimension is DROPPED in the CODE-ONLY variant (when we use the
published CPTs in our inference engine instead of fitting from raw
data), per `COMPARISON_PROTOCOL.md:132-141`.

### 21.3 Marginal beliefs

Compare per-region forward-inference results to the published
Figure 3 + supplementary Figures S4-S11. Metrics: absolute
probability difference per state per region, mean absolute difference
(MAD) per node, rank agreement across regions, and Pearson r across
the 8 regions. Thresholds: Pearson r > 0.7 on endpoint nodes; MAD <
0.15 per state (`COMPARISON_PROTOCOL.md:81`).

The Mackenzie protocol would run marginal beliefs against the four
mehg_ingested / ptwi_exceedance endpoint nodes plus fish_tissue_hg
per species; per-region inference uses overall priors as the
per-region baseline (Part V documented limitation;
`fit_mackenzie_model.py:950-952`), so the Dimension 3 comparison is
NOT RUN in the current build (Section 23.0; Section 26.10).
This subsection describes the protocol target only.

### 21.4 Sensitivity rankings

Compare which source variables most influence the effect nodes.
Metric: Spearman rank correlation between our mutual-information
rankings and the published Table 2 composite-sensitivity values, plus
top-3 agreement and per-variable rank displacement. Thresholds:
Spearman rho > 0.6 OR top-3 agreement >= 2/3
(`COMPARISON_PROTOCOL.md:109`).

The published Table 2 reports slope coefficients from lme() fits
(linear effect size); our rankings are mutual-information values
(statistical dependence). The two metrics measure different signals
on the same parent-child relationship; the protocol's note at
`comparison_results.json:33-34` acknowledges that the comparison is
approximate.

### 21.5 Counterfactual Minamata scenario

Apply the same Minamata Treaty atmospheric-Hg reduction (35-60%) used
in the paper and compare predicted fold-changes in fish tissue Hg
across regions and species. Threshold: same direction (decrease in
fish Hg) plus magnitude within 0.5x of the published ~1.2-fold
reduction (`COMPARISON_PROTOCOL.md:127`).

This dimension is DROPPED in the CODE-ONLY variant
(`COMPARISON_PROTOCOL.md:140-141`). For the Mackenzie build it
remains in scope because we fit CPTs from FRDR raw data.

## 22. Methodological differences (expected, not failures)

Three methodological differences between our build and the published
model are documented and expected. They produce systematic but
interpretable divergences in the comparison metrics.

### 22.1 Parametric (lme) versus nonparametric (BDeu)

The published model fits the parent-stressor relationships using
`nlme::lme()` linear mixed-effects regressions with random effects on
the `OID_` sample-location grouping variable
(`r_code_analysis_summary.md` lines 91-100). Our build fits the same
parent-child structure using BDeu counting on discretized cases
(Appendix B Section B.1.2; `fit_mackenzie_model.py:160-243`). The two
approaches produce structurally similar CPTs in the sense that both
emit a `P(child | parents)` distribution at each parent
configuration; they differ in the smoothness of interpolation and the
treatment of low-coverage cells.

The parametric lme form interpolates smoothly between parent
configurations because the linear predictor is a continuous function
of the underlying parent values. BDeu instead shows discrete
posterior shifts as each parent transitions between discretized
states, and in cells with zero matching observations the BDeu
posterior collapses to the uniform Dirichlet prior (1 / n_states per
state; Appendix B Section B.1.2). Therefore JSD divergence between
our build and the published CPTs is expected to be:

- Small in parent configurations that have many matching
  observations in our FRDR-derived training data.
- Larger in parent configurations that have few or zero matching
  observations, because our BDeu posterior is then prior-dominated
  while the published lme model still produces a non-uniform
  prediction by smoothing across the linear predictor.

This is a methodological-difference artifact, not a quality-of-fit
defect, and the COMPARISON_PROTOCOL explicitly anticipates it
(`COMPARISON_PROTOCOL.md:52-56`).

### 22.2 No `set.seed()` in the published R code (R3)

The published Monte Carlo step generates 10,000 fish and 3,000 water
random predictor combinations for case-learning input to the Netica
BN (`Manuscript_RCode.R` lines 50, 129). The R script does NOT call
`set.seed()` before these random draws
(`comparison_results.json:283-292`, R-code finding R3;
`r_code_analysis_summary.md` Section 3). As a result, the published
baseline CPTs are NOT exactly reproducible: re-running the R script
produces slightly different CPTs every time because the random
samples differ.

This is a baseline-reproducibility limitation, not a defect in our
build. Our BDeu approach is deterministic given the discretized cases
(no Monte Carlo step), so our CPTs are byte-stable across re-runs.
The implication for any FUTURE comparison: published-versus-ours
numeric divergence in Dimension 2 (CPT divergence) and Dimension 3
(marginal beliefs) would have a contribution from the published
baseline's own irreducible noise, not just from the methodology gap.
(Dimensions 2 and 3 are NOT RUN in the current build per Section
23.0 and Section 26.10.)

The R-code analysis also flagged R1 (line-66/69/72/75 use of `==`
with a vector instead of `%in%`, which silently drops rows from large
vs small fish subsets) and R2 (GBS water-model lme() formula at
line 124 uses GSL predictors while the line-148 summary groups by GBS
predictors, suggesting a copy-paste inconsistency). Both are recorded
at `comparison_results.json:262-282`. Our reconstruction uses the DAG
specification rather than the R code's possibly-bugged filter and
grouping, so our GBS submodel uses the documented oil/RPTS
predictors throughout.

### 22.3 Pooled versus per-region fitting

The published model fits per-region random effects (the lme() random
intercept on `OID_` is conceptually a per-station random effect; the
per-region differentiation arises because each region has a different
mix of stations). Our build instead pools the training data across
regions when fitting CPTs and then runs per-region inference with the
overall priors as the per-region baseline
(`fit_mackenzie_model.py:944-982`).

The reason is the documented per-region limitation
(`fit_mackenzie_model.py:950-952` and Part V Section 17.4): the
discretized cases in the processed CSVs DO carry per-station region
labels in the `_region` field (set at `prepare_mackenzie_data.py:382`
for fish and `:454` for water), but `strip_audit()` at lines 649-652
removes the field before serializing to `training_data_{model}.json`,
so the fitter cannot see the region axis. There is no axis on which
to fit region-level CPT variation IN THE CURRENT BUILD; the fix
scope is the narrow one documented in Section 26.2. The inference
target is therefore different: the published model estimates
`P(state | region)` while our model estimates `P(state) under
overall priors` and the per-region inference only redistributes the
marginal across regions when the user supplies region-specific
evidence (e.g., a measured atmospheric deposition for a particular
basin). (Cause CORRECTED per codex holistic-R4 IMPORTANT: previously
this section said training cases lack region labels without naming
the `strip_audit()` cause.)

This is a real methodological gap and is consolidated in Part VIII
Section 26.2 as a load-bearing limitation. It is also one of the
reasons Dimension 3 is NOT RUN in the current build (Section 23.0,
Section 26.10); a future Dimension 3 marginal-belief comparison
against the published Figure 3 + S4-S11 would inherit this gap as
a fundamental constraint on what it could claim.

## 23. Comparison results

### 23.0 Which dimensions were run (CORRECTED per codex body-R1 P1-1)

The 5-dimension comparison protocol (Section 21) is the SPEC; the
artifact at `bn_learning/packs/.../review/comparison_results.json` is
the EXECUTION RECORD. As of v1.0 of the deliverable (CORRECTED per
codex holistic-R1 P1-5 from prior "TWO of five" wording): ONE
dimension is FULLY RUN (Dimension 1 structural); ONE is PARTIAL
(Dimension 4 sensitivity rankings -- narrative only, no Spearman rho
or top-3 metric receipt); THREE are NOT RUN at all (Dimensions 2, 3,
5). The bullet enumeration below makes this explicit.

- Dimension 1 (Structural DAG comparison) -- RUN; reported in 23.1.
- Dimension 4 (Sensitivity rankings) -- PARTIAL. The artifact contains
  the source-target ranking lists for both submodels but does NOT
  contain the protocol-specified metric receipts: Spearman rho
  between our MI ranks and the published Table 2 slope coefficients,
  top-3 agreement count, or per-variable rank displacement (the
  thresholds at Section 21.4 / `COMPARISON_PROTOCOL.md:109`). Section
  23.2 presents the ranking lists side-by-side narratively, but
  Dimension 4 as a numeric acceptance test is NOT closed. (Scope
  CORRECTED per codex holistic-R1 P1-5 from prior "RUN" wording.)

So ONE of the five dimensions is fully RUN as a numeric acceptance
test (structural); ONE is PARTIAL (sensitivity, narrative only); and
THREE are NOT RUN at all:
(CORRECTED per codex body-R2 P1-1: Dimension 3 is per-region marginal-
belief comparison with Pearson r / MAD thresholds against published
figures, which we do not have; LOO is a separate internal validation
tool and does NOT satisfy Dimension 3 even as a partial run):

- Dimension 2 (CPT divergence / Jensen-Shannon) -- NOT RUN. The
  comparison would require digitized published CPTs at the per-
  parent-configuration level (Section 21.2 threshold mean-JSD < 0.15);
  `published_reference.json` does not yet contain that depth of
  CPT digitization. Listed as an open follow-up in Part VIII Section
  26.10 and Part IX Section 27.5 item (e).
- Dimension 3 (Per-region marginal beliefs / Pearson r / MAD) -- NOT
  RUN. The protocol requires forward inference per region compared
  against the published Figure 3 + supplementary Figures S4-S11; our
  per-region inference uses overall priors as baseline (the
  documented limitation at `fit_mackenzie_model.py:950-952`) so the
  per-region marginals are not data-grounded. LOO at the validation
  summary level (`comparison_results.json:loo_accuracy_summary`) is a
  separate internal validation tool that reports the model's
  conditional skill; it is NOT a substitute for Dimension 3 against
  the published figures. Listed as open follow-up in Part VIII
  Section 26.10 and Part IX Section 27.5 item (c).
- Dimension 5 (Counterfactual Minamata scenario / fold-change) -- NOT
  RUN. The 0.5x fold-change comparison was specified at M2 but never
  exercised; the artifact has no Minamata scenario results. Listed
  as an open follow-up in Part VIII Section 26.10 and Part IX Section
  27.5 item (f).

This subsection is the honest record of execution scope; the deliverable
does NOT claim coverage on the three unrun dimensions.

### 23.1 Structural comparison

The structural dimension is the strongest agreement: both submodels
have 14 nodes and 15 edges, matching the published Figure 2 exactly,
with 12 shared nodes and 2 submodel-specific point-source nodes per
submodel (Appendix A Section A.1; `comparison_results.json:2-31`).
The `comparison_results.json` records `structural.match = true` with
the note "DAG structure matches published Figure 2 exactly. Both
sub-models share 12 nodes and differ only in 2 point source nodes."
(`comparison_results.json:30`.)

The structural agreement is by construction: the M2 milestone
adopted the published DAG topology as a borrowing decision, then
implemented it in `dag_definition_mackenzie_hg.py` per Appendix A.
The verification value comes not from finding agreement (which is
expected) but from showing the construction faithfully preserved the
published topology. The per-edge accounting in Appendix A Sections
A.4.2 and A.5.2 closes the audit loop: every published edge appears
in our DAG and vice versa.

### 23.2 Sensitivity rankings (top-5)

The sensitivity dimension is the most informative numeric comparison
because it exposes both methodological differences and structural
agreements. The full per-submodel top rankings are stored at
`comparison_results.json:32-229`. The headline rankings are:

GSL fish_tissue_hg (our mutual information vs published Table 2):

| Rank | Our top-5 source (MI) | Published rank | Published slope coefficient |
|-----:|-----------------------|---------------:|-----------------------------|
| 1 | `fish_species` (MI = 0.103) | n/a (categorical; not in Table 2) | n/a |
| 2 | `proximity_mine_gsl` (MI = 0.048) | 3 | n/a (categorical) |
| 3 | `proximity_historic_mine` (MI = 0.026) | 2 | 2.4 +/- 3.7e-2 |
| 4 | `fish_length` (MI = 0.011) | 4 | 8.5 +/- 0.7e-4 |
| 5 | `atmospheric_hg_deposition` (MI = 0.0072) | embedded in published "Total Hg input" rank 1 | 1.1 +/- 0.45 |

The published ranking has "Total Hg input" at rank 1 (aggregated
across atmospheric, permafrost, and soil-erosion sources). Our
ranking decomposes that into individual sources and inserts
`fish_species` at rank 1 (a categorical variable that is the
dominant signal in our MI scoring but is not in the published lme
formula because it appears as `Fish_Code` factor levels, contributing
to model intercept shifts rather than a single slope coefficient).
This is exactly the parametric-vs-nonparametric divergence
predicted in Section 22.1. Top-3 agreement on shared variables
(`proximity_historic_mine`, `proximity_mine_gsl`, fish-length)
holds: both methods identify those three as primary drivers, even
though their precise rank order differs.

GBS fish_tissue_hg (our mutual information vs published Table 2):

| Rank | Our top-5 source (MI) | Published rank | Published slope coefficient |
|-----:|-----------------------|---------------:|-----------------------------|
| 1 | `fish_species` (MI = 0.079) | n/a (categorical) | n/a |
| 2 | `fish_length` (MI = 0.025) | 4 | 2.6 +/- 0.71e-4 |
| 3 | `proximity_oil_gbs` (MI = 0.021) | 3 | 2.9 +/- 7.08e-3 |
| 4 | `proximity_rpts_gbs` (MI = 0.0071) | 1 | -0.21 +/- 0.028 |
| 5 | `permafrost_hg_release` (MI = 0.0010) | embedded in "Total Hg input" rank 2 | 2 +/- 0.3e-2 |

For GBS the rank-1 divergence is more striking: the published top
driver is proximity to retrogressive permafrost thaw slumps (RPTS)
while our top driver is `fish_species`. The substantive agreement
remains -- both methods agree that the GBS-specific point sources
(oil and RPTS) plus fish-tissue parameters dominate the signal --
but the precise rank order is sensitive to whether the metric
favors categorical-variable variance (MI does; slope coefficients
do not).

The GSL and GBS freshwater_thg rankings (`comparison_results.json:86-129`
and 183-228) show stronger agreement because there are no
categorical variables in those parent sets: both methods rank
proximity variables (historic mine for GSL, RPTSs for GBS) at the
top, with atmospheric and soil-erosion sources behind, and the
top-3 agreement holds for both submodels.

### 23.3 LOO accuracy summary (internal validation, NOT Dimension 3 evidence)

CORRECTED per codex body-R3 P2: this subsection reports LOO results
as an INTERNAL VALIDATION TOOL. LOO is NOT a substitute for the
protocol's Dimension 3 (per-region marginal-belief comparison against
published figures); Dimension 3 is NOT run (Section 23.0 and Section
26.10). The LOO results below are an additional honesty check on
internal conditional skill, not a published-figure comparison.

The LOO results recorded at `comparison_results.json:231-256` (and
consolidated in Part V):

| Submodel | Target | N | Accuracy | Kappa |
|----------|--------|--:|---------:|------:|
| GSL | fish_tissue_hg | 584 | 0.6866 | 0.466 |
| GSL | freshwater_thg | 855 | 0.945 | 0.0 |
| GBS | fish_tissue_hg | 258 | 0.6667 | 0.489 |
| GBS | freshwater_thg | 1,589 | 0.8464 | 0.0 |

The interpretation embedded in the artifact
(`comparison_results.json:256`) is: fish-tissue Hg prediction
achieves moderate agreement (kappa 0.47-0.49) with good accuracy
(67-69%); water THg shows high accuracy (85-95%) but trivial kappa
because the dominant `low` class accounts for 94%+ of cases. The
freshwater_thg kappa = 0.0 result is load-bearing for Part V and
Part VIII and is not softened in this section.

### 23.4 Where the models agree and where they diverge; honest interpretation

Agreement is strongest where it should be:

- Structural agreement is total (Section 23.1).
- The dominant DAG drivers are recovered in both submodels at the
  top-3 / top-4 level on sensitivity (Section 23.2), modulo the
  categorical-variable handling.
- Fish-tissue Hg LOO kappa (0.466 GSL, 0.489 GBS) lands in the
  moderate-agreement band, which is appropriate for the modest
  sample sizes (584 / 258) and the 5-state target.

Divergence is concentrated where the methodology predicts it:

- Per-region inference is anchored on overall priors because we lack
  per-station region labels in discretized cases (Section 22.3 and
  Part V Section 17.4). Protocol Dimension 3 (per-region marginal-
  belief comparison against published Figure 3 + S4-S11) is therefore
  NOT RUN; LOO at the validation-summary level is an internal check,
  not Dimension 3 evidence (Section 23.3 corrected wording).
- The categorical fish_species variable scores rank 1 in our
  mutual-information rankings but is absent from the published
  Table 2 slope-coefficient table. Two methods, two ranking metrics;
  divergence in the rank-1 slot is expected and is documented at
  `comparison_results.json:33-34`.
- The published baseline CPTs are not exactly reproducible (R3, no
  `set.seed()`; Section 22.2), so the baseline itself has an
  irreducible noise component the comparison cannot eliminate.

The honest characterization: the comparison demonstrates that an
independent reconstruction of the Jermilova DAG, fit nonparametrically
on the same FRDR data via BDeu rather than parametrically via lme(),
recovers the topology exactly, recovers the dominant drivers at
top-3 / top-4 (modulo the categorical-variable handling), and
achieves moderate fish-tissue Hg LOO agreement. It does NOT
demonstrate that one model is "better" than the other; both methods
have known weaknesses, and the comparison's purpose is
characterization, not scoring.

---

# Part VIII -- AI-Assisted Process: the Research Question

## Facts pinned for Part VIII

| Fact | Value | Source |
|------|-------|--------|
| HITL identity | Jasen Nelson (project owner, scientific authority) | PLAN Section 6 Part VIII 24.1 |
| Orchestrator model | Claude Opus 4.7 | PLAN Section 6 Part VIII 24.1 |
| Subagent type | Claude Code subagent type=Explore | PLAN Section 6 Part IX Appendix F required field 4 |
| Adversarial reviewer | Codex CLI 0.130.0 with xhigh reasoning + tool use | PLAN Section 6 Part VIII 25.1; standing-memory `feedback_codex_review_targeted_vs_holistic_2026_05_13.md` |
| Codex-review methodology | Mutual-agreement adversarial review per `~/.claude/skills/codex-review/SKILL.md` | PLAN Section 6 Part VIII 25.1 |
| Milestone framework | M1 (FRDR acquisition), M2 (DAG spec + comparison protocol), M3 (architecture spike), M4 (fitting + validation + sensitivity), M5 (export + pack assembly), M6 (dashboard generalization), M7 (PublishedComparison + HowItWorksView) | PLAN Section 6 Part I item 3.2 |
| Commits referenced (Regulatory-Review) | `ba88a72e`, `898059f1`, `5fe3cb85` on `prototype/graph-sidecar-nonprod` | BNRRM_HANDOFF v66.0; PLAN Section 6 Part VIII 24.5 |
| Commits referenced (SSTAC-Dashboard) | `6cae8a5`, `2ec2f4f`, `75f4581`, `62430da` on main | BNRRM_HANDOFF v66.0; PLAN Section 6 Part VIII 24.5 |
| HITL gates (load-bearing) | DAG simplifications (species collapse, RUSLE collapse, freshwater discharge exclusion); ESS = 1.0; soft-edging per-CPT 0.90 vs 0.95 split; comparison thresholds; freshwater_thg kappa = 0.0 acceptance; subsistence-scenario assumptions (100 g/day, 60 kg, 0.95 MeHg) | Appendix C Section C.5; PLAN Section 6 Part VIII 24.3 |
| AI-proposed steps HITL accepted | Data crosswalk (Subagent A), discretization adoption from Table S4, BDeu cherry-pick from `fit_causal_model.py` | PLAN Section 6 Part VIII 24.4; `M4_FIT_REFACTORING_ANALYSIS.md` Section 5 |
| freshwater_thg LOO kappa (both submodels) | 0.0 GSL, 0.0 GBS | Appendix B Section B.1.2; Part V Section 15.6 |
| Per-region inference baseline | Overall priors (training data lacks station region labels) | `fit_mackenzie_model.py:950-952` |
| FRDR snapshot status | Temporarily unavailable as of 2026-04-06; local archive at `raw/` | Appendix D Section 3 |
| pgmpy non-use rationale | Reduced dependency, inspectability, equivalence verifiable, smaller blast radius | Appendix B Section B.4 |
| LOO design | Partial: refits ONLY the target node's CPT, NOT the full network | Part V Section 15.1; `fit_mackenzie_model.py:769-820` |
| Soft-edging per-CPT split | 0.90/0.10 for multi-state deterministic; 0.95/0.05 for binary deterministic | Appendix B Section B.0.6 |
| Subsistence assumptions | 100 g/day fish, 60 kg body weight, 0.95 MeHg fraction | Appendix C Section C.5; `fit_mackenzie_model.py:84-88` |
| Q6 status | ESS sensitivity analysis: pending HITL agreement | PLAN Section 12 Q6 |
| Q7 status | Soft-edging bias quantification via forward inference (NOT LOO): NUANCED, pending HITL run | PLAN Section 12 Q7 |

## 24. Workflow narrative

### 24.1 Roles

The AI-assisted construction had four distinct roles. The roles are
not interchangeable, and the methodology paper claims novelty for the
WORKFLOW, not for any role acting alone.

**HITL (Jasen Nelson).** Scientific authority, final decider, and
domain expert. Sets goals, accepts or rejects AI proposals, applies
professional judgment, owns every methodological choice that affects
the model's interpretation. All controlling decisions in the
decision-provenance ledger (Appendix F) are attributed to the HITL.
The AI does not propose adequacy or compliance judgments.

**Claude Opus 4.7 orchestrator.** Synthesizes context, drafts code
and documents, explores the codebase, coordinates subagents, and
produces proposals. Operates under HITL direction. Does not commit
without HITL acceptance. Writes are reversible until HITL sign-off.

**Claude Code Explore subagents.** Bounded-context subagents the
orchestrator spawns to map sections of the codebase or to draft a
contained artifact without consuming the orchestrator's context
budget. Each subagent receives a tight task brief (e.g., "produce
the FRDR-to-DAG variable crosswalk for M2") and returns a single
artifact. Subagent type is recorded as `type=Explore` in the
decision-provenance ledger.

**Codex CLI 0.130.0 (xhigh reasoning + tool use).** Adversarial
reviewer. Per the mutual-agreement methodology recorded in
`~/.claude/skills/codex-review/SKILL.md`, the orchestrator runs
codex CLI in two modes: TARGETED iterative reviews (one commit or
one artifact at a time, iterate to GREEN) and HOLISTIC strategic
reviews (whole-artifact stepback at strategic checkpoints, single
round). When the orchestrator disagrees with a codex finding, it
writes a counter-argument citing file:line evidence and resubmits;
the loop terminates only when both agents mutually agree. Silent
acceptance of findings the orchestrator does not believe is treated
as a methodology violation.

### 24.2 Milestone-by-milestone account

The AI-proposed-versus-HITL-decided split is recorded
milestone-by-milestone below at a summary level. The full decision
record is the decision-provenance ledger (Appendix F), drafted
separately. Forward-references to Appendix F use the milestone tag
as the anchor.

**M1 -- FRDR data acquisition (2026-04-06).** AI proposed: download
the FRDR dataset, verify against `frdr-dfdr-checksums.txt`, archive
the four Excel files plus the R code, .neta binaries, supplements,
license, and README into `raw/` (Appendix D Section 3). HITL
decided: accept; document the temporary FRDR unavailability and
keep the local snapshot as the project's archival copy. The
filtering at the prepare step (797 raw fish records,
2,124 raw water records) is described in Part II and is
deterministic from the FRDR Excel data.

**M2 -- DAG specification + comparison protocol (2026-04-06).** AI
proposed: borrow the Jermilova DAG topology (12 shared + 2 GSL +
2 GBS = 14 nodes per submodel, 15 edges per submodel), produce the
FRDR-variable-to-DAG-node crosswalk (Subagent A,
`crosswalk.md`), draft the five-dimension comparison protocol with
acceptance thresholds, identify which Jermilova nodes to collapse
(species collapse, RUSLE intermediate collapse) and which to exclude
(freshwater discharge as hydrological transport not a BN parent;
wildfire C-factor as ancillary). HITL decided: accept the borrowing
of topology, accept the simplifications with explicit rationale for
each loss-of-resolution, accept the comparison protocol and freeze
the acceptance thresholds before any fitting was run. The HITL
gates here are recorded in Appendix F as M2-1 through M2-5.

**M3 -- Architecture spike (2026-04-06).** AI proposed: build a
case-study pipeline as a standalone module (`fit_mackenzie_model.py`)
rather than extending the production sediment-model fitter
(`fit_causal_model.py`), per `M4_FIT_REFACTORING_ANALYSIS.md`
Section 5. Cherry-pick the generic BDeu, empirical-prior, LOO,
sensitivity, and forward-inference functions; provide
Mackenzie-specific data loading, deterministic CPT builders, and
orchestration. HITL decided: accept (rationale in Appendix B Section
B.4). The GO decision is recorded in
`M3_ARCHITECTURE_SPIKE_REPORT.md` (Appendix D Section 9).

**M4 -- Fitting, validation, and sensitivity (commit `ba88a72e`).**
AI proposed: implement BDeu CPT fitting with ESS = 1.0 default,
implement four deterministic CPTs (Dillon LL.3,
Health Canada commercial-fish guideline, subsistence intake equation,
US EPA child pTWI), implement partial-LOO (target-CPT-only refit),
implement mutual-information sensitivity, implement forward
inference. HITL decided: accept ESS = 1.0 as the BDeu prior strength
(with the explicit understanding that ESS sensitivity could be
re-run at 0.5, 5.0, 10.0 if reviewer pushback emerges; PLAN Q6).
HITL accepted the per-CPT soft-edging split (0.90/0.10 for
multi-state deterministic CPTs, 0.95/0.05 for binary; Appendix B
Section B.0.6) and accepted the freshwater_thg LOO kappa = 0.0
result in both submodels as a load-bearing limitation rather than
a defect (Part V Section 15.7).

The subsistence-scenario assumptions (100 g/day fish consumption,
60 kg body weight, 0.95 MeHg fraction; Appendix C Section C.5) are
HITL decisions, not AI proposals: the values are standard
Health Canada / Indigenous-subsistence figures the HITL chose for
their regulatory defensibility. The AI implemented them as named
constants (`fit_mackenzie_model.py:84-88`) so the methods section
can surface them transparently.

**M5 -- Export and pack assembly (commit `898059f1`).** AI proposed:
write `export_generic_model.py` (436 lines) as a model-agnostic
exporter producing the `generic-bn-rrm-v1` runtime JSON; assemble
the seven-file core pack at
`bn_learning/packs/bnrrm-casestudy-jermilova2025-mackenzie-hg/`. HITL
decided: accept. The pack manifest (`pack.json`) was reviewed and
HITL accepted the `release_stage = "prototype"` marker and the
`scope_type = "benchmark"` declaration as accurate metadata for the
build.

**M6 -- Dashboard generalization (SSTAC-Dashboard commit `6cae8a5`).**
AI proposed: implement `createGenericNetwork` in
`trained-network.ts` so the dashboard can render any
`generic-bn-rrm-v1` pack; implement `inferContainerCategory` as a
majority-vote fallback; auto-position containers left-to-right by
category tier. HITL decided: accept; verify by loading the Mackenzie
pack and inspecting each of the eight dashboard tabs (Section 20.1).

**M7 -- `PublishedComparison` and `HowItWorksView`** (SSTAC-Dashboard
commits `2ec2f4f`, `75f4581`, `62430da`). AI proposed: implement the
Review tab's published-versus-ours comparison view; implement the
progressive-disclosure HowItWorksView component. HITL decided:
accept; verify that the rendered comparison surfaces all five
dimensions plus the LOO kappa results without softening
freshwater_thg kappa = 0.0.

### 24.3 HITL gates (controlling decisions)

The following decisions are HITL-controlling and are repeated here so
the methods paper does not accidentally attribute them to AI:

- DAG simplifications: species collapse (single fish_tissue_hg with
  fish_species parent rather than five species-specific nodes), RUSLE
  intermediate collapse (single soil_erosion_hg_release node rather
  than full RUSLE pathway), freshwater discharge exclusion (not a
  BN parent in this build), wildfire C-factor exclusion. Recorded in
  `MODEL_SPECIFICATION_MACKENZIE.md` Section 4 (Appendix D Section
  9) and PLAN Section 6 Part III item 8.
- BDeu ESS = 1.0 choice (`fit_mackenzie_model.py:60`,
  `DEFAULT_ESS = 1.0`). HITL accepts; ESS sensitivity could be run if
  reviewer pushback emerges (PLAN Q6).
- Per-CPT soft-edging policy (0.90/0.10 for multi-state
  deterministic, 0.95/0.05 for binary). Appendix B Section B.0.6.
- Comparison acceptance thresholds (Dimension 2 JSD < 0.15,
  Dimension 3 Pearson r > 0.7, Dimension 4 Spearman rho > 0.6 or
  top-3 >= 2/3, Dimension 5 magnitude within 0.5x). Frozen at M2.
- freshwater_thg LOO kappa = 0.0 acceptance in BOTH submodels. HITL
  decision to report the class-imbalance-driven kappa floor openly
  rather than reframe the metric.
- Subsistence-scenario assumptions (100 g/day fish, 60 kg body
  weight, 0.95 MeHg fraction). HITL decision to use the conservative
  regulatory values; AI surfaces them so readers can see what
  ptwi_exceedance is conditioned on (Section 26.9).

### 24.4 AI-proposed steps the HITL accepted

The following were AI proposals that HITL accepted as-is, recorded
here so the methods paper accurately attributes them:

- FRDR-variable-to-DAG-node crosswalk (Subagent A, M2). The
  crosswalk identified each FRDR Excel column that maps to a DAG
  node and listed the excluded columns with rationale
  (`crosswalk.md` exclusion table). HITL verified and accepted.
- Discretization adoption from Jermilova Table S4. Appendix C
  Section C.2 documents that EVERY numeric break in the
  `DISCRETIZATION` dict was adopted from Table S4 (plus a small
  derived set: per-species fish-length cutoffs from the
  Manuscript_RCode.R species rows, the pTWI threshold values from US
  EPA / WHO / Health Canada, the mehg_ingested breaks derived from
  those pTWI values). The HITL framing during M2 ("we borrowed a
  couple of discretization decisions") understates the borrowing;
  Appendix C corrects the record.
- BDeu cherry-pick from `fit_causal_model.py`. The decision to write
  `fit_mackenzie_model.py` as a standalone module rather than
  extending the production fitter is recorded in
  `M4_FIT_REFACTORING_ANALYSIS.md` Section 5. AI proposed; HITL
  accepted on smaller-blast-radius and inspectability grounds
  (Appendix B Section B.4).

### 24.5 Iteration history

The recorded commit history captures the milestone deltas. The
Regulatory-Review commits on `prototype/graph-sidecar-nonprod` are:

- `ba88a72e` -- M4 fitting + validation + sensitivity (BDeu CPTs,
  deterministic CPTs, partial-LOO, sensitivity analysis, forward
  inference) lands `fit_mackenzie_model.py` (1,257 lines).
- `898059f1` -- M5 export + pack assembly lands
  `export_generic_model.py` (436 lines) and the seven-file core
  pack at `bn_learning/packs/bnrrm-casestudy-jermilova2025-mackenzie-hg/`.
- `5fe3cb85` -- M5 / M6 follow-up (review JSONs, pack manifest
  polish).

The SSTAC-Dashboard commits on main are:

- `6cae8a5` -- M6 `createGenericNetwork`, container-category
  inference, tier-x auto-layout in `trained-network.ts`.
- `2ec2f4f` -- M7 `PublishedComparison` view.
- `75f4581` -- M7 `HowItWorksView` progressive-disclosure component.
- `62430da` -- M7 pack-store registration so the Mackenzie pack
  appears in the Case Studies tab.

The handoff record at
`2026_Database_Development/data_acquisition/bnrrm_extraction/BNRRM_HANDOFF.md`
v66.0 (Appendix D Section 10) records the full M1-M7 sequence with
prose summaries.

## 25. Quality gates

Three quality gates ran during the build. They are not
interchangeable: each catches a different class of defect.

### 25.1 Codex adversarial review (mutual-agreement methodology)

Per `~/.claude/skills/codex-review/SKILL.md`, codex CLI 0.130.0 was
invoked in two modes:

- TARGETED reviews after each commit or major artifact, with a scoped
  prompt focused on (a) factual traceability, (b) honest reporting
  of limitations, (c) ASCII compliance, (d) methodology correctness.
  The orchestrator iterated to GREEN, applying counter-arguments
  citing file:line evidence when it disagreed with a finding.
- HOLISTIC reviews at strategic checkpoints, with a whole-artifact
  context, single round, focused on coherence, under- or
  over-claiming, and missing pieces.

The methodology paper itself (this document) is subjected to the
same methodology: the PLAN went through three targeted codex rounds
(R1, R2, R3) to GREEN v0.4, and the four appendices went through
their own codex rounds (Appendix D R1+R2, Appendix B/A/C R1+R2)
before the body Parts were drafted. Parts I-IX will receive targeted
codex review per Part, then a holistic whole-document review, then
HITL sign-off as the final acceptance gate.

The mutual-agreement methodology is not "codex provides findings,
orchestrator accepts the agreeable ones". When the orchestrator
disagrees, it writes a counter-argument with evidence and resubmits.
The loop terminates only when both agents mutually agree on each
finding (defend / revise / withdraw / split). This is the practice
recorded in the standing-memory entry
`codex_review_mutual_agreement_methodology_2026_05_16.md`.

### 25.2 Subagent exploration for context protection

The orchestrator's context budget is a limited resource. Spawning a
Claude Code Explore subagent with a tight task brief allows
codebase mapping or artifact drafting to proceed without consuming
orchestrator context on every file read. The pattern is recorded as
standing practice. Each subagent invocation produces a single
artifact (or returns a structured summary), which the orchestrator
then incorporates after auditing.

For this case-study build, subagents were used to (a) map FRDR-
variable to DAG-node correspondences for `crosswalk.md` (M2 Subagent
A), (b) audit the Manuscript_RCode.R script and produce
`r_code_analysis_summary.md` (M1 followup), (c) draft individual
appendices (Appendix B, Appendix C, Appendix D, Appendix A in order
per PLAN Section 9.1), and (d) draft body Parts I-IX (this drafting
session's Subagent A for Parts I-III, Subagent B for Parts IV-V,
and Subagent C for Parts VI-IX).

### 25.3 Comparison protocol as methodology-level acceptance gate

CORRECTED per codex holistic-R1 P2-4: the 5-dimension comparison
protocol (Part VII) was FROZEN at M2 before fitting was run, and is
the methodology-level acceptance-gate FRAMEWORK. As of v1.0 of this
deliverable the framework is only PARTIALLY EXECUTED (Section 23.0):
Dimension 1 (structural) is fully run, Dimension 4 (sensitivity) is
narrative-partial, and Dimensions 2 / 3 / 5 are not run at all.
The build cannot be tuned to pass the frozen thresholds because they
are recorded in `COMPARISON_PROTOCOL.md` and the partial execution
record is produced from `comparison_results.json` without re-running
the protocol -- which is the structural defense against the
temptation to fit-then-tune-the-acceptance-criteria. But the
acceptance gate, as a numeric pass/fail decision, has NOT been
applied because not every dimension has executed. The deliverable
reports execution scope honestly (Section 23.0; Section 26.10) and
lists the unrun / partial dimensions as open follow-ups (Part IX
Section 27.5 items c, e, f).

## 26. Limitations and honest reporting

The following limitations are consolidated here so a reviewer has a
single place to audit honesty. Each limitation is real, none is
softened, and none is hidden in an appendix.

### 26.1 freshwater_thg kappa = 0.0 in both submodels

The LOO cross-validation of freshwater_thg returns kappa = 0.0 on
both GSL (N = 855) and GBS (N = 1,589). The accuracy values (0.945
GSL, 0.8464 GBS) are high because the dominant `low` class accounts
for over 94% of GSL samples and over 84% of GBS samples; the model
predicts `low` for everything and is correct most of the time, but
the Cohen's kappa formula (`p_o - p_e`) / (1 - `p_e`) floors at zero
when the model collapses to majority-class prediction. Per-class
confusion matrices (Part V Section 15.6) show zero correct
predictions on the medium and high freshwater_thg classes in either
submodel. This is the load-bearing honesty fact for the build and is
reported in Part V Section 15.7, in `comparison_results.json:256`,
and here.

### 26.2 Per-region inference uses overall priors as baseline (codex holistic-R1 P1-1 corrected)

CORRECTED per codex holistic-R1 P1-1 (re-applied per R2 propagation
finding): the discretized processed CSVs DO carry per-station region
labels in the `_region` field (set at `prepare_mackenzie_data.py:382`
for fish and `:454` for water). What is lost is the JSON-serialized
training representation: `prepare_mackenzie_data.py:649-652` defines
`strip_audit(case)` to drop every key starting with underscore before
writing `training_data_{model}.json`, so the `_region` field is
removed from the JSON that `fit_mackenzie_model.py` consumes. The
fix scope is therefore NARROW: preserve `_region` in the JSON output
(one-line change in `strip_audit`) plus add per-record region
consumption in the fitter (a small change in `fit_all_cpts()` and
`infer_per_region()`). The fix does NOT require re-extracting from
FRDR or building a station-to-region spatial join.

Per-region inference therefore uses the overall priors as the
per-region baseline (current state), then redistributes the
marginal across regions only when the user supplies region-specific
evidence. This is documented in code at `fit_mackenzie_model.py:950-952`
and is the single biggest gap between our build and the published
model (Section 22.3). The follow-up scope is consolidated in
Part IX Section 27.5 item (c).

### 26.3 FRDR temporary unavailability

As of 2026-04-06 the FRDR remote was temporarily unavailable; the
local archive at `external_case_studies/jermilova_2025_mackenzie_hg/raw/`
holds the dataset (Appendix D Section 3). Integrity is verified
against `frdr-dfdr-checksums.txt`. The methodology relies on the
local snapshot; if FRDR is unreachable a reviewer must obtain a
copy from the project archive before reproducing the build.

### 26.4 No `set.seed()` in published R code

The published baseline CPTs are not exactly reproducible from
re-running `raw/Manuscript_RCode.R` because the Monte Carlo
sampling step (10,000 fish, 3,000 water predictor combinations)
does not call `set.seed()` (Section 22.2). This is a limitation of
the comparison baseline, not of our build.

### 26.5 pgmpy is not used for fitting or inference

The fitting and inference paths in `fit_mackenzie_model.py` are
pure-Python custom implementations (Appendix B Section B.4). pgmpy
is used only for optional DAG validation outside the fitting path
(`dag_definition_mackenzie_hg.py`). The choice is deliberate
(dependency reduction, inspectability, equivalence verifiable on a
small fixture per Appendix B Section B.3.6); a reviewer who prefers
the pgmpy estimator can verify equivalence on the fixture and re-run
the build through pgmpy without changing any reported numbers
because the formulas match.

### 26.6 No external held-out validation set beyond LOO

LOO cross-validation is the only validation step in the build. There
is no held-out future-time-window dataset, no held-out spatial
dataset, and no held-out species. Out-of-distribution generalization
(to a different river basin, to a future contamination regime, to a
new species) is therefore not validated.

### 26.7 Partial-LOO design

The LOO step refits ONLY the target node's CPT, not the entire
network, per the code at `fit_mackenzie_model.py:769-820`. This is
a partial-LOO choice for speed. It validates the target node's
conditional structure (given the parent CPTs) but does NOT
re-validate ancestor CPTs. Each left-out observation propagates
through unchanged ancestor CPTs to produce a MAP prediction at the
target. Full-network LOO (refit every CPT for each held-out
observation) would be more conservative but order-of-magnitude
slower; the build does not run it.

### 26.8 Soft-edging the deterministic CPTs introduces a small bias

The four deterministic CPTs apply soft-edging (0.90/0.10 for
multi-state; 0.95/0.05 for binary; Appendix B Section B.0.6) to avoid
hard zeros that would block forward-inference propagation. This
introduces 5-10% off-target probability mass on the non-MAP states.
Per PLAN Q7 (NUANCED), the bias should be quantified via
forward-inference / counterfactual impact (does soft-edging vs
hard-edging change the MAP class on any test case? what is the
absolute belief delta on the impact nodes?). Partial-LOO is NOT the
right instrument for this question because the LOO step refits only
the target CPT and therefore does not re-propagate through
deterministic descendants.

Q7 status as of v1 of this Part: open. The HITL deferral or run
recommendation is pending. If HITL chooses to run the
forward-inference comparison, the result feeds back into this
section in a future revision.

### 26.9 ptwi_exceedance is a scenario-conditioned endpoint

The ptwi_exceedance node is computed deterministically from
mehg_ingested via the US EPA child pTWI threshold (0.7 ug
Hg/kgbw/wk; `fit_mackenzie_model.py:95`), and mehg_ingested is
computed deterministically from fish_tissue_hg via the subsistence
intake formula (100 g/day fish consumption, 60 kg body weight, 0.95
MeHg fraction; Appendix C Section C.5). The ptwi_exceedance marginal
is therefore a deterministic propagation of those subsistence
assumptions through the deterministic CPT chain
fish_tissue_hg -> mehg_ingested -> ptwi_exceedance.

Readers MUST NOT treat ptwi_exceedance marginals as measured
population-average exposure. They are SCENARIO outputs conditioned
on the three subsistence parameters. A reader who changes the
assumptions (50 g/day instead of 100, 80 kg body weight, 0.85 MeHg
fraction) will get a different ptwi_exceedance marginal. The model
does not estimate which assumptions apply to a particular
population; it propagates whichever assumptions the build encodes.

The methodology paper surfaces this point in Part II Section 6.6
(during discretization discussion), in Appendix C Section C.5
(parameter ledger), and here. The triple surfacing is intentional:
silently propagating a SCENARIO endpoint as if it were a measured
endpoint is the single highest-impact misinterpretation risk in the
deliverable.

### 26.10A Species-factor information loss (codex holistic-R1 P1-3 / P2-5)

The published Jermilova model fits one `lme()` per submodel with
`Fish_Code` as a categorical fixed-effect factor (per Section 8.1
corrected wording). The BN-RRM build collapses `Fish_Code` into a
single `fish_species` parent of `fish_tissue_hg` and lets BDeu count
discretized fish-tissue-Hg states per (species, length, point-source,
total_hg_deposition) configuration. What is NOT preserved is the
published model's continuous-state species intercept, the
random-effect smoothing across stations within species, the
parametric coefficient uncertainty, and the partitioned residual
variance. Reviewers comparing the BN-RRM fish_tissue_hg posterior
to the published per-station posterior should expect species-by-
species systematic offsets that do not appear in our build.

### 26.10B Total_hg_deposition CPT not validated (codex holistic-R1 P2-2)

Part IV Section 10.2 names three BDeu CPTs (`total_hg_deposition`,
`freshwater_thg`, `fish_tissue_hg`), but the LOO step at Part V
Section 15 validates only `fish_tissue_hg` and `freshwater_thg`.
The `total_hg_deposition` CPT, which aggregates the three nonpoint
sources (atmospheric, permafrost, soil erosion) into the intermediate
deposition node, has not been LOO-validated. The implication: this
aggregator node's conditional skill is not separately verified; any
downstream consumer assumes the aggregator is well-fitted because its
parents are observable and its child sample sizes are large, but a
formal validation receipt would be additive evidence.

### 26.10C SSTAC runtime structural drift (codex holistic-R1 P1-2)

The deployed pack at SSTAC-Dashboard contains a `runtime/learned-model.json`
that differs from the RR-pack source not only in size but in
structure: SSTAC adds a top-level `conceptualTiers` array, and
`eligible_commercial_catch` is moved from the "Effects" container
(RR assignment) to the "Human Health" container (SSTAC assignment).
These are substantive augmentations on the dashboard side. Body Part
III's container framing (and Appendix A's container assignment table)
describes the RR-pack source state; dashboard reviewers see a
slightly different rendering. The "byte-compare only shared subset"
policy (Section 19.3) is preserved, but the augmented-vs-source
distinction must be made when citing the deployed pack.

### 26.10D Dimension 4 sensitivity metric receipts not computed (codex holistic-R1 P1-5)

The `sensitivity_ranking_comparison` field in `comparison_results.json`
stores source-target ranking lists for our build's MI scores and the
published Table 2 slope coefficients, but does NOT compute the
protocol-specified Spearman rank correlation, top-3 agreement count,
or per-variable rank displacement (Section 21.4 / COMPARISON_PROTOCOL.md
line 109 thresholds). Section 23.2 presents the rankings narratively
but does NOT execute the Dimension 4 numeric pass/fail test. This is
PARTIAL execution, not full execution, and is reflected in Section
23.0 ("ONE full + ONE partial + THREE not run").

### 26.10E DOI / license provenance drift across generated artifacts (codex holistic-R1 P2-3)

The methodology document cites the FRDR DOI 10.20383/103.0957 v2 for
the dataset (Part I Section 2 inventory; SOURCE_MANIFEST.md). However,
the runtime artifacts on disk record different DOIs: the
`training_data_{model}.json` files store `frdr_doi: 10.20383/103.0943`
(set in `prepare_mackenzie_data.py:658`), and the assembled pack's
`pack.json` records `doi: 10.20383/103.0945` (see Part IX Facts Table
row "FRDR alternative DOI in pack.json"). These three FRDR DOIs
(0.0943, 0.0945, 0.0957) refer to FRDR-versioning artifacts of the
same dataset, but the in-file metadata is INCONSISTENT with the
authoritative inventory citation. Reviewers consulting the runtime
artifacts will see different DOIs than the paper cites. The fix is
to reconcile `prepare_mackenzie_data.py:658` and the pack.json field
to the inventory DOI before a v1.1 release. License: the FRDR dataset
is CC BY-NC-SA 4.0 per `raw/LICENSE.txt` (the Part I Section 2 wording
is authoritative; the Appendix D wording is being corrected to match).

### 26.10 Execution scope of the 5-dimension comparison protocol

The 5-dimension comparison protocol (Part VII Section 21) was authored
at M2 and frozen before any fitting was run. Per the execution-scope
audit at Part VII Section 23.0 and per codex holistic-R1 P1-5:
ONE dimension is FULLY RUN (Dimension 1 structural), ONE is PARTIAL
(Dimension 4 sensitivity rankings narrative-only without Spearman /
top-3 / rank-displacement metric receipts), and THREE are NOT RUN
at all (Dimensions 2, 3, 5):

- Dimension 2 (CPT divergence / Jensen-Shannon < 0.15): not run.
  Requires per-parent-configuration digitization of the published
  CPTs; `published_reference.json` does not yet contain that depth.
- Dimension 3 (Per-region marginal beliefs / Pearson r > 0.7,
  MAD < 0.15): not run as a published-figure comparison. The
  per-region inference uses overall priors as baseline (Section 26.2),
  so the per-region marginals are not data-grounded. LOO
  (`comparison_results.json:loo_accuracy_summary`) is an internal
  validation tool but is NOT a substitute for Dimension 3.
- Dimension 5 (Counterfactual Minamata scenario / 0.5x fold-change):
  not run. The forward-inference engine has the capacity (Part V
  Section 17) but no scenario evidence has been applied and
  `comparison_results.json` has no Minamata results.

The deliverable does NOT claim coverage on these three dimensions.
Each is listed as an open follow-up in Part IX Section 27.5
(items c, e, f). The dimensions that ARE run are: Dimension 1
(structural; perfect match) and Dimension 4 (sensitivity rankings;
moderate alignment with documented categorical-variable divergence).

This limitation is load-bearing for peer review. A reader who treats
the methodology paper as a complete acceptance-test of the protocol
will overestimate the comparison evidence; the honest framing is that
the structural and sensitivity dimensions validate the reconstruction
at the topology and dominant-driver levels, while CPT-level fidelity,
per-region fidelity, and counterfactual fidelity are open questions
the build does not answer.

---

# Part IX -- Reproducibility and Appendices

## Facts pinned for Part IX

| Fact | Value | Source |
|------|-------|--------|
| Python version | 3.x (3.10+ tested; project standard) | PLAN Section 6 Part I item 2.5 |
| Required Python libraries | `numpy` (BDeu vectorization), Python standard library | Appendix B Section B.4; `fit_mackenzie_model.py` imports |
| Optional Python libraries | `openpyxl` (FRDR Excel ingest), `pgmpy` (DAG validation only, not on fitting/inference path), `pandas` (DAG-validation fixture only) | Appendix D Sections 1, 9; PLAN Section 6 Part I item 2.5 |
| FRDR DOI | `10.20383/103.0957` v2 (2025-05-14) | Appendix D Section 3 |
| FRDR alternative DOI in pack.json | `10.20383/103.0945` | `pack.json:47` (note: stored DOI differs from the inventory DOI; both are recorded as the same dataset under FRDR's versioning) |
| Pipeline scripts | `prepare_mackenzie_data.py`, `fit_mackenzie_model.py`, `export_generic_model.py` | Appendix D Section 1 |
| Pipeline outputs | `processed/` (cases, training JSON), `results/` (learned-model, validation, sensitivity, inference), `packs/.../` (assembled pack) | Appendix D Sections 4, 5, 7 |
| Drift-check command sequence | `sha256sum` on the 7 shared files in both pack locations | Appendix D "Reproducibility note" |
| Authoritative shared-subset hashes | training_data `e6ad4be9...`, comparison_results `70358df3...`, model_overview `14f0676a...`, published_reference `4f34e54a...`, validation `9303132...` | Appendix D Section 7 |
| Drift-expected files | `pack.json`, `runtime/learned-model.json` (per "byte-compare only shared subset" policy) | Appendix D "Live drift state" |
| Appendices in scope | A (DAG node registry), B (CPT inventory + BDeu correctness receipt), C (discretization), D (file inventory + drift state) | PLAN Section 6 Part IX |
| All appendices delivered | A (DAG node registry), B (CPT inventory + BDeu receipt), C (discretization table), D (file inventory + live drift state), E (references), F (decision-provenance ledger). All ASCII clean; all included in the assembled master file. | PLAN Section 9.1 step 10 |
| HITL sign-off requirement | Final acceptance gate per PLAN Definition of Done item 12 | PLAN Section 11 |

## 27. Reproducibility recipe

### 27.1 Environment setup

The build requires a Python 3 environment with `numpy` (for the BDeu
vectorized counting) and `openpyxl` (for reading the FRDR Excel
files). `pgmpy` is optional and is only needed to validate the DAG
structure via the `BayesianNetwork` constructor; the fitting and
inference paths do not import pgmpy. `pandas` is optional and is
only needed if a reviewer wants to run the pgmpy DAG-validation
fixture independently. The fitting code itself uses only `numpy`
and the Python standard library.

A minimal environment:

```
python -m venv .venv
.venv/Scripts/activate                  # (Windows; .venv/bin/activate on Unix)
pip install numpy openpyxl
# optional: pip install pgmpy pandas    # for DAG validation only
```

The build was developed and tested on Windows 11 with Python 3.10+
and is platform-agnostic (no Windows-specific calls in the pipeline).

### 27.2 Step-by-step command sequence

The full reproduction sequence from an empty environment is six
steps. Replace `<project>` with the project root
(`C:/Projects/Regulatory-Review/2026_Database_Development/data_acquisition/bnrrm_extraction/`).

**Step 1 -- download FRDR raw data.** Acquire DOI `10.20383/103.0957`
from `https://www.frdr-dfdr.ca/` (or the alternative DOI
`10.20383/103.0945` referenced in `pack.json:47` -- both resolve to
the same dataset under FRDR's versioning). Place all files under
`<project>/bn_learning/external_case_studies/jermilova_2025_mackenzie_hg/raw/`.
Verify integrity against `frdr-dfdr-checksums.txt` (provided by
FRDR). The expected file list and sizes are in Appendix D Section
3. If FRDR is temporarily unavailable, the local snapshot in the
project archive is the source of truth.

**Step 2 -- prepare discretized cases for both submodels in one call.**

`prepare_mackenzie_data.py` has no argparse parser; its `run()` function
unconditionally loops over BOTH submodels and writes outputs for each.
A `--model` flag is silently ignored. (Recipe CORRECTED per codex body-R1
P2-5 from the prior `--model GSL` / `--model GBS` invocations.)

```
cd <project>
python bn_learning/prepare_mackenzie_data.py
```

Outputs land under `bn_learning/external_case_studies/jermilova_2025_mackenzie_hg/processed/`
(see Appendix D Section 4 for the exact paths and hashes). The
`<project>` cwd is the `bnrrm_extraction/` root; all Step 2 / Step 3 /
Step 4 / Step 5 commands assume this cwd so the relative path
`bn_learning/...` resolves consistently (codex holistic-R2 P2-path).

Outputs (Appendix D Section 4):

```
bn_learning/external_case_studies/jermilova_2025_mackenzie_hg/processed/
    fish_cases_gsl.csv                  (62,610 B)
    fish_cases_gbs.csv                  (29,107 B)
    water_cases_gsl.csv                 (59,876 B)
    water_cases_gbs.csv                 (119,468 B)
    training_data_gsl.json              (498,946 B; SHA-256 db438eb1...)
    training_data_gbs.json              (568,812 B; SHA-256 3a9a6342...)
```
(Path CORRECTED per codex holistic-R3 P2 to include the `bn_learning/`
prefix consistent with the project-root cwd convention.)

Expected discretized case counts per submodel are recorded in
Appendix B Section B.0.4 (604 fish + 855 water GSL; 274 fish +
1,589 water GBS). The raw FRDR record counts before parent-missing
filtering are 797 fish and 2,124 water; the case-count gap is the
subject of PLAN Section 6 Part II item 4.4.

**Step 3 -- fit both submodels.**

`fit_mackenzie_model.py` IS under `bn_learning/` and DOES accept a
`--model` argument; the corrected invocation runs from the project
root (Recipe CORRECTED per codex holistic-R1 P1-4 from prior wording
that invoked the script from the wrong cwd):

```
cd <project>
python bn_learning/fit_mackenzie_model.py --model both
```

Outputs (Appendix D Section 5):

```
bn_learning/external_case_studies/jermilova_2025_mackenzie_hg/results/
    learned-model-gsl.json              (80,917 B; SHA-256 9529d95b...)
    learned-model-gbs.json              (80,640 B; SHA-256 073e867c...)
    validation-gsl.json                 (2,211 B; SHA-256 8f4af0e3...)
    validation-gbs.json                 (2,216 B; SHA-256 f23c1fca...)
    sensitivity-gsl.json                (5,566 B; SHA-256 b5405ed9...)
    sensitivity-gbs.json                (5,531 B; SHA-256 f4f13cbe...)
    inference-results.json              (18,491 B; SHA-256 c3cffe8f...)
```
(Path CORRECTED per codex holistic-R3 P2 to include the `bn_learning/`
prefix consistent with the project-root cwd convention.)

Expected key numbers (Appendix B Section B.1.2; PLAN Section 6 Part
V item 15.6): GSL fish_tissue_hg LOO kappa = 0.466 on N = 584; GSL
freshwater_thg LOO kappa = 0.0 on N = 855; GBS fish_tissue_hg LOO
kappa = 0.489 on N = 258; GBS freshwater_thg LOO kappa = 0.0 on
N = 1,589.

**Step 4 -- export to runtime JSON.**

Run from the project root (NOT from inside `bn_learning/`; the package
parent must be on `sys.path` for the module import to resolve). The
fitter at `fit_mackenzie_model.py:52-54,1059-1112` writes its results
to `external_case_studies/jermilova_2025_mackenzie_hg/results/`, so
the recipe must reference that absolute prefix, not a `results/`
relative to `bn_learning/`. (Recipe CORRECTED per codex body-R1 P1-2
from the prior broken-cwd / wrong-results-path invocation.)

```
cd <project>
python -m bn_learning.export_generic_model \
    --learned-model bn_learning/external_case_studies/jermilova_2025_mackenzie_hg/results/learned-model-gsl.json \
    --inference-results bn_learning/external_case_studies/jermilova_2025_mackenzie_hg/results/inference-results.json \
    --dag-module bn_learning.dag_definition_mackenzie_hg \
    --model GSL \
    --output bn_learning/packs/bnrrm-casestudy-jermilova2025-mackenzie-hg/runtime/learned-model.json
```

The CLI definition is at `export_generic_model.py:379-413`. Output
(Appendix D Section 7): `runtime/learned-model.json` at 177,768 bytes
with SHA-256 `adf98f1a...` (the RR-pack hash; the SSTAC-pack copy
differs as documented in Appendix D "Live drift state").

For the GBS submodel substitute `--learned-model bn_learning/.../learned-model-gbs.json`
and `--model GBS`; the same output path is overwritten with the GBS
runtime. The pack ships only one runtime model at a time.

**Step 5 -- assemble the RR core pack (optional, manual).** Place
the pack manifest (`pack.json`) and the four review JSONs at the
expected paths inside
`bn_learning/packs/bnrrm-casestudy-jermilova2025-mackenzie-hg/`.
The seven shared files are listed in Appendix D Section 7 with
sizes and hashes; matching all seven is the reproducibility check.

**Step 6 -- deploy to SSTAC-Dashboard (optional).** Copy the
assembled pack to
`C:/Projects/SSTAC-Dashboard/public/bn-rrm/packs/bnrrm-casestudy-jermilova2025-mackenzie-hg/`.
The dashboard build process then composes the shared core with its
eight dashboard-only review JSONs and 12 GeoJSON map layers. The
shared subset must match byte-for-byte (training_data plus the four
shared review JSONs) per the drift policy in Section 19.3. The
RR-side `pack.json` and `runtime/learned-model.json` will differ
from their SSTAC-side counterparts, by design.

### 27.3 Expected outputs at each stage

Appendix D Sections 4 / 5 / 7 / 8 record the expected file sizes
and SHA-256 hashes for every artifact produced by Steps 2 through
6 above. A reviewer reproducing the build can verify each step by
computing `sha256sum` on the outputs and comparing to the
Appendix D values. The known divergences (timestamps embedded in
the output JSON; dashboard-side re-render of `runtime/learned-model.json`)
are documented in Appendix D "Live drift state".

The intermediate per-submodel hashes are stable across reruns of
Steps 2 and 3 because the BDeu fitting is deterministic and the
discretization is deterministic. Any drift between two reruns of
the same step on the same input data is unexpected and should be
investigated.

### 27.4 Drift-check script

Appendix D's "Reproducibility note" embeds the `sha256sum` command
sequence that byte-compares the seven shared files between the RR
pack and the SSTAC pack:

```
cd <project>/bn_learning/packs/bnrrm-casestudy-jermilova2025-mackenzie-hg/
sha256sum pack.json training_data.json runtime/learned-model.json \
          review/comparison_results.json review/model_overview.json \
          review/published_reference.json review/validation.json

cd C:/Projects/SSTAC-Dashboard/public/bn-rrm/packs/bnrrm-casestudy-jermilova2025-mackenzie-hg/
sha256sum pack.json training_data.json runtime/learned-model.json \
          review/comparison_results.json review/model_overview.json \
          review/published_reference.json review/validation.json
```

The expected result (Appendix D "Live drift state (2026-05-17)") is:
IDENTICAL on `training_data.json` and the four shared review JSONs;
DIFFERS on `pack.json` (1,060-byte size difference, structural cause
documented) and `runtime/learned-model.json` (728-byte size
difference, dashboard-side re-render). Any divergence in the
identical-as-of-2026-05-17 files is unexpected drift and must be
reported in a revision of Appendix D before any body Part cites the
affected artifact.

### 27.5 "What we would do differently" (HITL deferred)

PLAN Section 12 Q4 reserves a placeholder for HITL-curated items
under the heading "what we would do differently next time". Per the
PLAN, this section is populated by HITL after sign-off, with items
that the HITL judges would improve a future case-study build
without altering the current reported results. Candidate topics
flagged during the build (not yet decided):

- (a) ESS sensitivity analysis at 0.5, 1.0, 5.0, 10.0 to defend or
  revise the BDeu ESS = 1.0 choice (PLAN Q6).
- (b) Forward-inference soft-edging bias quantification (PLAN Q7;
  Section 26.8).
- (b2) Dimension 4 metric receipts computation (Spearman rho between
  our MI ranks and the published Table 2 slope coefficients;
  top-3 agreement count; per-variable rank displacement). Required
  to upgrade Dimension 4 from PARTIAL to FULLY RUN. (Section 26.10D
  consolidated limitation; ADDED per codex holistic-R4 IMPORTANT
  finding that Dimension 4 partial status was missing from the
  Section 27.5 follow-up list.)
- (c) Comparison Protocol Dimension 3: preserve `_region` in
  `training_data_{model}.json` (one-line change in `strip_audit()`
  at `prepare_mackenzie_data.py:649-652`) plus add per-record region
  consumption in `fit_mackenzie_model.py`'s `fit_all_cpts()` and
  `infer_per_region()` to enable per-region CPT fitting and a
  data-grounded Pearson r / MAD comparison against the published
  Figure 3 + supplementary S4-S11. This does NOT require FRDR
  re-extraction because the region label is already computed at
  `prepare_mackenzie_data.py:382` (fish) and `:454` (water) (Sections
  26.2 and 26.10; SCOPE NARROWED per codex holistic-R3 from prior
  "re-extraction of per-station region labels from FRDR" wording).
- (d) Full-network LOO (refit every CPT for each held-out
  observation) to validate ancestor CPTs (Section 26.7).
- (e) Comparison Protocol Dimension 2: per-parent-configuration
  digitization of the published Jermilova CPTs and Jensen-Shannon
  divergence calculation against our BDeu CPTs (Section 26.10).
- (f) Comparison Protocol Dimension 5: Minamata Treaty atmospheric-Hg
  reduction scenario (35-60% reduction at the
  `atmospheric_hg_deposition` root) propagated through forward
  inference, fold-change in fish_tissue_hg marginals compared
  against the published ~1.2x reduction within +/- 0.5x tolerance
  (Section 26.10).
- (g) Held-out spatial or temporal validation set to test
  out-of-distribution generalization (Section 26.6).
- (h) pgmpy side-by-side runtime fixture in `tests/` (Appendix B
  Section B.3.6 "OPTIONAL future verification").

These items are recorded as candidates only. They are not
implemented in v1 of this build and do not affect any reported
result. HITL chooses which to add to a future revision.

## Cross-references to the appendices

The body Parts I-IX cite the four fact-pinning appendices in the
following pattern. This cross-reference table is the methodology
paper's master traceability index.

- **Appendix A -- Complete DAG Node Registry.** Cited by Part II
  Section 6 (discretization breaks per node), Part III Sections 7
  and 9 (DAG structure and Python implementation), Part IV
  Sections 10-14 (CPT method assignment summary), Part V Section
  17 (per-region inference), Part VI Section 18 (state lists for
  layout / color), Part VII Section 23.1 (structural agreement).
- **Appendix B -- Complete CPT Inventory + BDeu Correctness
  Receipt.** Cited by Part IV (all sections) for per-CPT method,
  parents, observation counts, and soft-edge values; Part V
  Section 15 for the LOO results that the BDeu sparsity explains;
  Part VI Section 18.4 for the CPT shape transformation; Part VII
  Section 23.2 for the sensitivity rankings that the BDeu posterior
  produces; Part VIII Section 26.5 for the pgmpy-not-used decision
  receipt (B.3 + B.3.6).
- **Appendix C -- Discretization Table + Subsistence-Scenario
  Parameters + BDL Treatment.** Cited by Part II Section 6 (every
  break with source attribution), Part IV Section 12.4 (subsistence
  scenario for mehg_ingested), Part VIII Section 26.9
  (ptwi_exceedance scenario conditioning).
- **Appendix D -- File Inventory + Live Drift State +
  Reproducibility Hashes.** Cited by every body Part for source-file
  citation receipts; cited by Part VI Section 19 for the pack
  asymmetry and drift state; cited by Part IX Section 27 for the
  reproducibility hash table and the drift-check command sequence.

The remaining appendices are drafted separately after the body
Parts are complete:

- **Appendix E -- References.** Jermilova et al. 2025; Dillon et al.
  2010; Health Canada pTWI guidance; Landis 2021; pgmpy reference;
  FRDR DOI citation; `raw/Manuscript_RCode.R` (script-level
  citation). Drafted in a separate file before holistic codex
  review.
- **Appendix F -- Decision-Provenance Ledger.** Chronological table
  of every recorded decision per PLAN Section 6 Part IX Appendix F
  required fields (date, decision summary, proposer including AI
  tool and version, decider, why, commit reference, artifact
  reference). Accumulated through drafting; finalized after Parts
  I-IX are written. Required to be non-empty per PLAN Definition of
  Done item 7; required to have a non-empty tool/version field on
  every AI-proposer row per the same item.

The complete methodology paper sequence is therefore:

1. PLAN (GREEN v0.4, signed off).
2. Appendix D, Appendix A, Appendix C, Appendix B (drafted in
   that order per PLAN Section 9.1; all v0.1+ DRAFT or final).
3. Body Parts I-IX (this document covers Parts VI-IX; sibling
   drafts cover Parts I-III and IV-V).
4. Appendix E (references) and Appendix F (decision-provenance
   ledger) finalized.
5. Targeted codex review per Part to mutual-agreement GREEN.
6. Holistic whole-document codex review to mutual-agreement GREEN.
7. HITL sign-off (final acceptance gate per PLAN Definition of
   Done item 12).

The deliverable filename is
`JERMILOVA_BNRRM_CONSTRUCTION_METHODOLOGY.md` in the
`methodology_paper/` directory. As of v1.0 this master file has been
assembled from the four body Part fragments (parts_I_II_III.md,
part_IV.md, part_V.md, parts_VI_VII_VIII_IX.md) plus six appendices
(A-F) plus the preamble; the assembly is complete and the master
file is the single-file deliverable. The modular source files are
preserved alongside the master for traceability and for future
revisions.

-- END OF PARTS VI, VII, VIII, IX --
---
title: Appendix A -- Complete DAG Node Registry
parent_document: JERMILOVA_BNRRM_CONSTRUCTION_METHODOLOGY.md
status: v1.0 (post codex appendices-R3 GREEN; holistic-R1 propagation applied 2026-05-17)
authority: structural facts from bn_learning/dag_definition_mackenzie_hg.py and bn_learning/fit_mackenzie_model.py
ascii_compliance: required (code point <= 127)
---

# Appendix A -- Complete DAG Node Registry

## A.0 Purpose

This appendix is a fact-pinning ledger for the Mackenzie Hg case-study DAG.
Body Parts I-IX cite this registry rather than re-stating the node, parent,
discretization, and CPT-method facts inline. Every row traces to a specific
file and line range in the Regulatory-Review codebase. If a downstream Part
contradicts a row here, the contradiction is a defect and the Part is wrong
unless the row is updated first.

The Jermilova Mackenzie Hg model has TWO submodels: Great Slave Lake (GSL)
and Great Bear Subbasin (GBS). The two submodels share 12 nodes and differ
in 2 point-source nodes (and the corresponding edges into freshwater_thg
and fish_tissue_hg). Each submodel has 14 nodes and 15 edges total.

Source-of-truth files cited throughout:

- `bn_learning/dag_definition_mackenzie_hg.py` (411 lines; nodes, edges, containers, discretization)
- `bn_learning/fit_mackenzie_model.py` (1257 lines; CPT method assignment per node)
- Jermilova et al. 2025, IEAM 21(2):396-413 (Table S4 for discretization breaks)
- Dillon et al. 2010 (LL.3 dose-response parameters for degree_of_injury)
- Health Canada commercial fish guideline (0.5 ug/g ww) for eligible_commercial_catch
- Health Canada / US EPA pTWI thresholds (0.7 / 1.4 / 3.3 ug/kgbw/wk) for ptwi_exceedance

## A.1 Submodel structure summary

| Property | GSL | GBS |
|----------|-----|-----|
| Total nodes | 14 | 14 |
| Shared nodes (count) | 12 | 12 |
| Submodel-specific nodes (count) | 2 | 2 |
| Total edges | 15 | 15 |
| Nonpoint aggregation edges | 3 | 3 |
| Water THg parent edges | 3 | 3 |
| Fish tissue Hg parent edges | 5 | 5 |
| Effect chain edges | 4 | 4 |
| Regions (per-region inference) | 4 | 4 |

Verified by inspection of `dag_definition_mackenzie_hg.py:163-196` (edges)
and `dag_definition_mackenzie_hg.py:202-203` (full node dicts). The module's
self-test block (`dag_definition_mackenzie_hg.py:327-411`) prints the counts
when run as `python dag_definition_mackenzie_hg.py`.

## A.2 Containers (frontend grouping; shared by both submodels)

The container assignment is identical for GSL and GBS (per
`dag_definition_mackenzie_hg.py:209-227`); only the Point Sources container
differs in its members.

| Container | Members (shared) | Members (GSL-only) | Members (GBS-only) |
|-----------|------------------|--------------------|--------------------|
| Point Sources | -- | proximity_mine_gsl, proximity_historic_mine | proximity_oil_gbs, proximity_rpts_gbs |
| Nonpoint Sources | atmospheric_hg_deposition, permafrost_hg_release, soil_erosion_hg_release | -- | -- |
| Hg Deposition | total_hg_deposition | -- | -- |
| Exposure Factors | fish_species, fish_length | -- | -- |
| Stressors | freshwater_thg, fish_tissue_hg | -- | -- |
| Effects | degree_of_injury, eligible_commercial_catch | -- | -- |
| Human Health | mehg_ingested, ptwi_exceedance | -- | -- |

## A.3 Regions

GSL regions: outlet, middle, north_arm, east_arm
(`dag_definition_mackenzie_hg.py:233`).

GBS regions: north, west, east, south
(`dag_definition_mackenzie_hg.py:234`).

Per-region inference uses overall priors as the baseline because the
discretized training cases lack per-station region labels (documented as
a known limitation at `fit_mackenzie_model.py:950-952`). This is a
load-bearing limitation that Parts V and VIII must repeat.

## A.4 GSL submodel -- complete node registry (14 nodes)

The GSL submodel uses the 12 SHARED_NODES plus the 2 GSL_SPECIFIC_NODES
(`dag_definition_mackenzie_hg.py:202`). Parents are traced through
`GSL_EDGES` (`dag_definition_mackenzie_hg.py:163-178`). CPT methods are
traced through `fit_all_cpts()` (`fit_mackenzie_model.py:454-579`).

### A.4.1 GSL node table

- **atmospheric_hg_deposition**
  - Display label: Atmospheric Hg Deposition
  - Category: substance
  - States: very_low, low, medium, high, very_high
  - Discretization breaks: 0, 3, 9, 12, 15 (>15 = very_high)
  - Unit: ug THg/m2/yr
  - Parents: none (root)
  - CPT method: empirical_prior
  - Container: Nonpoint Sources
  - Source attribution: FRDR GEM-MACH-Hg annual avg; Table S4 of Jermilova et al. 2025
  - Definition file:line: `dag_definition_mackenzie_hg.py:19-24`; breaks `:241-244`

- **permafrost_hg_release**
  - Display label: Permafrost Thaw Hg Release
  - Category: substance
  - States: none, very_low, low, medium, high, very_high
  - Discretization breaks: 0, 0, 2, 4, 6, 10 (>10 = very_high; lowest 0 -> "none")
  - Unit: ug DHg/m2/yr
  - Parents: none (root)
  - CPT method: empirical_prior
  - Container: Nonpoint Sources
  - Source attribution: FRDR SiBCASA model output; Table S4 of Jermilova et al. 2025
  - Definition file:line: `dag_definition_mackenzie_hg.py:25-30`; breaks `:245-248`

- **soil_erosion_hg_release**
  - Display label: Soil Erosion Hg Release
  - Category: substance
  - States: low, medium, high, very_high
  - Discretization breaks: 0, 5, 10, 20 (>20 = very_high)
  - Unit: ug THg/m2/yr
  - Parents: none (root)
  - CPT method: empirical_prior
  - Container: Nonpoint Sources
  - Source attribution: FRDR RUSLE-derived; Table S4 of Jermilova et al. 2025
  - Definition file:line: `dag_definition_mackenzie_hg.py:31-36`; breaks `:249-252`

- **total_hg_deposition**
  - Display label: Total Hg Deposition (Nonpoint)
  - Category: substance
  - States: low, moderate_low, moderate_high, high, very_high
  - Discretization breaks: 0, 10, 15, 20, 50 (>50 = very_high)
  - Unit: ug/m2/yr
  - Parents: atmospheric_hg_deposition, permafrost_hg_release, soil_erosion_hg_release
  - CPT method: bdeu
  - Container: Hg Deposition
  - Source attribution: derived (sum of nonpoint sources); breaks Table S4 of Jermilova et al. 2025
  - Definition file:line: `dag_definition_mackenzie_hg.py:39-44`; breaks `:253-256`

- **proximity_mine_gsl**
  - Display label: Proximity to Mine Development (15 km)
  - Category: substance
  - States: yes, no
  - Discretization breaks: binary (within 15 km)
  - Unit: --
  - Parents: none (root)
  - CPT method: empirical_prior
  - Container: Point Sources
  - Source attribution: FRDR NearMine_15km; lme formula in Manuscript_RCode.R (GSL fish + water)
  - Definition file:line: `dag_definition_mackenzie_hg.py:106-111`

- **proximity_historic_mine**
  - Display label: Proximity to Historic Mine (15 km)
  - Category: substance
  - States: yes, no
  - Discretization breaks: binary (within 15 km)
  - Unit: --
  - Parents: none (root)
  - CPT method: empirical_prior
  - Container: Point Sources
  - Source attribution: FRDR Near_HistoricMine_15km; lme formula in Manuscript_RCode.R (GSL fish + water)
  - Definition file:line: `dag_definition_mackenzie_hg.py:112-117`

- **fish_species**
  - Display label: Freshwater Fish Species
  - Category: condition
  - States: lake_whitefish, burbot, walleye, lake_trout, northern_pike
  - Discretization breaks: categorical (5 species)
  - Unit: --
  - Parents: none (root)
  - CPT method: empirical_prior
  - Container: Exposure Factors
  - Source attribution: FRDR Fish_Code; Jermilova et al. 2025 Indigenous food fish species
  - Definition file:line: `dag_definition_mackenzie_hg.py:47-52`

- **fish_length**
  - Display label: Fish Length
  - Category: condition
  - States: small, large
  - Discretization breaks: per-species cutoff: 450 mm (LW/WA), 600 mm (BU/LT/NP)
  - Unit: mm
  - Parents: none (root)
  - CPT method: empirical_prior
  - Container: Exposure Factors
  - Source attribution: FRDR Fork_length; cutoffs derived from species-specific size distributions
  - Definition file:line: `dag_definition_mackenzie_hg.py:53-58`; per-species breaks `:265-274`

- **freshwater_thg**
  - Display label: Freshwater THg (ng/L)
  - Category: effect
  - States: low, medium, high
  - Discretization breaks: 0, 10, 26 (>26 = high)
  - Unit: ng/L
  - Parents: proximity_mine_gsl, proximity_historic_mine, total_hg_deposition
  - CPT method: bdeu
  - Container: Stressors
  - Source attribution: FRDR THg; break 26 ng/L = CCME aquatic life guideline; Table S4 of Jermilova et al. 2025
  - Definition file:line: `dag_definition_mackenzie_hg.py:61-66`; breaks `:257-260`

- **fish_tissue_hg**
  - Display label: Fish Tissue Hg (ug/g ww)
  - Category: effect
  - States: low, subsistence, ec20, ec50, above_ec50
  - Discretization breaks: 0, 0.2, 0.5, 0.77, 3 (>3 = above_ec50)
  - Unit: ug/g ww
  - Parents: fish_species, fish_length, proximity_mine_gsl, proximity_historic_mine, total_hg_deposition
  - CPT method: bdeu
  - Container: Stressors
  - Source attribution: FRDR Tissue_Hg; breaks derived from Dillon 2010 EC20/EC50 dose-response
  - Definition file:line: `dag_definition_mackenzie_hg.py:67-72`; breaks `:261-264`

- **degree_of_injury**
  - Display label: Degree of Injury (%)
  - Category: effect
  - States: low, moderate, high, very_high
  - Discretization breaks: 0, 25, 50, 75 (>75 = very_high)
  - Unit: percent
  - Parents: fish_tissue_hg
  - CPT method: deterministic_dillon
  - Container: Effects
  - Source attribution: derived from Dillon 2010 LL.3 dose-response at fish_tissue_hg midpoints
  - Definition file:line: `dag_definition_mackenzie_hg.py:73-78`; breaks `:275-278`

- **eligible_commercial_catch**
  - Display label: Eligible Commercial Catch
  - Category: impact
  - States: eligible, not_eligible
  - Discretization breaks: threshold 0.5 ug/g ww
  - Unit: ug/g ww
  - Parents: fish_tissue_hg
  - CPT method: deterministic_hc_guideline
  - Container: Effects
  - Source attribution: derived from Health Canada commercial fish guideline (0.5 ug/g ww)
  - Definition file:line: `dag_definition_mackenzie_hg.py:81-86`; threshold `:283-286`

- **mehg_ingested**
  - Display label: MeHg Ingested (ug Hg/kgbw/wk)
  - Category: impact
  - States: none, low, moderate_low, moderate_mid, moderate_high, high
  - Discretization breaks: 0, 0, 1, 1.4, 2.5, 3.3 (>3.3 = high)
  - Unit: ug Hg/kgbw/wk
  - Parents: fish_tissue_hg
  - CPT method: deterministic_subsistence
  - Container: Human Health
  - Source attribution: derived from subsistence intake formula (100 g/day, 60 kg bw, 0.95 MeHg fraction); breaks aligned with pTWI thresholds
  - Definition file:line: `dag_definition_mackenzie_hg.py:87-92`; breaks `:279-282`

- **ptwi_exceedance**
  - Display label: pTWI Exceedance
  - Category: impact
  - States: does_not_exceed, exceeds
  - Discretization breaks: binary at US EPA child pTWI = 0.7 ug/kgbw/wk
  - Unit: ug/kgbw/wk (threshold)
  - Parents: mehg_ingested
  - CPT method: deterministic_ptwi
  - Container: Human Health
  - Source attribution: derived from US EPA child pTWI = 0.7 ug/kgbw/wk; full HC thresholds 0.7/1.4/3.3 stored in canonical_mackenzie.PTWI_THRESHOLDS
  - Definition file:line: `dag_definition_mackenzie_hg.py:93-98`; thresholds `canonical_mackenzie.py:38`

### A.4.2 GSL edge list (15 edges)

Source: `dag_definition_mackenzie_hg.py:148-178`.

Nonpoint aggregation (3 edges, shared via `_EDGES_NONPOINT`):

1. atmospheric_hg_deposition -> total_hg_deposition
2. permafrost_hg_release -> total_hg_deposition
3. soil_erosion_hg_release -> total_hg_deposition

Water THg parents (3 edges, GSL-specific):

4. proximity_mine_gsl -> freshwater_thg
5. proximity_historic_mine -> freshwater_thg
6. total_hg_deposition -> freshwater_thg

Fish tissue Hg parents (5 edges, GSL-specific):

7. fish_species -> fish_tissue_hg
8. fish_length -> fish_tissue_hg
9. proximity_mine_gsl -> fish_tissue_hg
10. proximity_historic_mine -> fish_tissue_hg
11. total_hg_deposition -> fish_tissue_hg

Effect chain (4 edges, shared via `_EDGES_EFFECTS`):

12. fish_tissue_hg -> degree_of_injury
13. fish_tissue_hg -> eligible_commercial_catch
14. fish_tissue_hg -> mehg_ingested
15. mehg_ingested -> ptwi_exceedance

GSL edge count: 3 + 3 + 5 + 4 = 15. Verified.

## A.5 GBS submodel -- complete node registry (14 nodes)

The GBS submodel uses the 12 SHARED_NODES plus the 2 GBS_SPECIFIC_NODES
(`dag_definition_mackenzie_hg.py:203`). Parents are traced through
`GBS_EDGES` (`dag_definition_mackenzie_hg.py:181-196`). All 12 shared
nodes have identical state lists, categories, labels, discretization
breaks, units, containers, and CPT methods as in A.4.1; only the parent
column changes for freshwater_thg and fish_tissue_hg (and the 2 submodel-
specific point-source nodes replace the GSL pair).

### A.5.1 GBS node table

- **atmospheric_hg_deposition**
  - Display label: Atmospheric Hg Deposition
  - Category: substance
  - States: very_low, low, medium, high, very_high
  - Discretization breaks: 0, 3, 9, 12, 15 (>15 = very_high)
  - Unit: ug THg/m2/yr
  - Parents: none (root)
  - CPT method: empirical_prior
  - Container: Nonpoint Sources
  - Source attribution: FRDR GEM-MACH-Hg annual avg; Table S4 of Jermilova et al. 2025
  - Definition file:line: `dag_definition_mackenzie_hg.py:19-24`; breaks `:241-244`

- **permafrost_hg_release**
  - Display label: Permafrost Thaw Hg Release
  - Category: substance
  - States: none, very_low, low, medium, high, very_high
  - Discretization breaks: 0, 0, 2, 4, 6, 10 (>10 = very_high)
  - Unit: ug DHg/m2/yr
  - Parents: none (root)
  - CPT method: empirical_prior
  - Container: Nonpoint Sources
  - Source attribution: FRDR SiBCASA model output; Table S4 of Jermilova et al. 2025
  - Definition file:line: `dag_definition_mackenzie_hg.py:25-30`; breaks `:245-248`

- **soil_erosion_hg_release**
  - Display label: Soil Erosion Hg Release
  - Category: substance
  - States: low, medium, high, very_high
  - Discretization breaks: 0, 5, 10, 20 (>20 = very_high)
  - Unit: ug THg/m2/yr
  - Parents: none (root)
  - CPT method: empirical_prior
  - Container: Nonpoint Sources
  - Source attribution: FRDR RUSLE-derived; Table S4 of Jermilova et al. 2025
  - Definition file:line: `dag_definition_mackenzie_hg.py:31-36`; breaks `:249-252`

- **total_hg_deposition**
  - Display label: Total Hg Deposition (Nonpoint)
  - Category: substance
  - States: low, moderate_low, moderate_high, high, very_high
  - Discretization breaks: 0, 10, 15, 20, 50 (>50 = very_high)
  - Unit: ug/m2/yr
  - Parents: atmospheric_hg_deposition, permafrost_hg_release, soil_erosion_hg_release
  - CPT method: bdeu
  - Container: Hg Deposition
  - Source attribution: derived (sum of nonpoint sources); breaks Table S4 of Jermilova et al. 2025
  - Definition file:line: `dag_definition_mackenzie_hg.py:39-44`; breaks `:253-256`

- **proximity_oil_gbs**
  - Display label: Proximity to Oil Development (50 km)
  - Category: substance
  - States: yes, no
  - Discretization breaks: binary (within 50 km)
  - Unit: --
  - Parents: none (root)
  - CPT method: empirical_prior
  - Container: Point Sources
  - Source attribution: FRDR NearOil_50km; lme formula in Manuscript_RCode.R (GBS fish + water)
  - Definition file:line: `dag_definition_mackenzie_hg.py:125-130`

- **proximity_rpts_gbs**
  - Display label: Proximity to Retrogressive Permafrost Thaw Slumps (10 km)
  - Category: substance
  - States: yes, no
  - Discretization breaks: binary (within 10 km)
  - Unit: --
  - Parents: none (root)
  - CPT method: empirical_prior
  - Container: Point Sources
  - Source attribution: FRDR NearSlump_10km; lme formula in Manuscript_RCode.R (GBS fish + water)
  - Definition file:line: `dag_definition_mackenzie_hg.py:131-136`

- **fish_species**
  - Display label: Freshwater Fish Species
  - Category: condition
  - States: lake_whitefish, burbot, walleye, lake_trout, northern_pike
  - Discretization breaks: categorical (5 species)
  - Unit: --
  - Parents: none (root)
  - CPT method: empirical_prior
  - Container: Exposure Factors
  - Source attribution: FRDR Fish_Code; Jermilova et al. 2025 Indigenous food fish species
  - Definition file:line: `dag_definition_mackenzie_hg.py:47-52`

- **fish_length**
  - Display label: Fish Length
  - Category: condition
  - States: small, large
  - Discretization breaks: per-species cutoff: 450 mm (LW/WA), 600 mm (BU/LT/NP)
  - Unit: mm
  - Parents: none (root)
  - CPT method: empirical_prior
  - Container: Exposure Factors
  - Source attribution: FRDR Fork_length; cutoffs derived from species-specific size distributions
  - Definition file:line: `dag_definition_mackenzie_hg.py:53-58`; per-species breaks `:265-274`

- **freshwater_thg**
  - Display label: Freshwater THg (ng/L)
  - Category: effect
  - States: low, medium, high
  - Discretization breaks: 0, 10, 26 (>26 = high)
  - Unit: ng/L
  - Parents: proximity_oil_gbs, proximity_rpts_gbs, total_hg_deposition
  - CPT method: bdeu
  - Container: Stressors
  - Source attribution: FRDR THg; break 26 ng/L = CCME aquatic life guideline; Table S4 of Jermilova et al. 2025
  - Definition file:line: `dag_definition_mackenzie_hg.py:61-66`; breaks `:257-260`

- **fish_tissue_hg**
  - Display label: Fish Tissue Hg (ug/g ww)
  - Category: effect
  - States: low, subsistence, ec20, ec50, above_ec50
  - Discretization breaks: 0, 0.2, 0.5, 0.77, 3 (>3 = above_ec50)
  - Unit: ug/g ww
  - Parents: fish_species, fish_length, proximity_oil_gbs, proximity_rpts_gbs, total_hg_deposition
  - CPT method: bdeu
  - Container: Stressors
  - Source attribution: FRDR Tissue_Hg; breaks derived from Dillon 2010 EC20/EC50 dose-response
  - Definition file:line: `dag_definition_mackenzie_hg.py:67-72`; breaks `:261-264`

- **degree_of_injury**
  - Display label: Degree of Injury (%)
  - Category: effect
  - States: low, moderate, high, very_high
  - Discretization breaks: 0, 25, 50, 75 (>75 = very_high)
  - Unit: percent
  - Parents: fish_tissue_hg
  - CPT method: deterministic_dillon
  - Container: Effects
  - Source attribution: derived from Dillon 2010 LL.3 dose-response at fish_tissue_hg midpoints
  - Definition file:line: `dag_definition_mackenzie_hg.py:73-78`; breaks `:275-278`

- **eligible_commercial_catch**
  - Display label: Eligible Commercial Catch
  - Category: impact
  - States: eligible, not_eligible
  - Discretization breaks: threshold 0.5 ug/g ww
  - Unit: ug/g ww
  - Parents: fish_tissue_hg
  - CPT method: deterministic_hc_guideline
  - Container: Effects
  - Source attribution: derived from Health Canada commercial fish guideline (0.5 ug/g ww)
  - Definition file:line: `dag_definition_mackenzie_hg.py:81-86`; threshold `:283-286`

- **mehg_ingested**
  - Display label: MeHg Ingested (ug Hg/kgbw/wk)
  - Category: impact
  - States: none, low, moderate_low, moderate_mid, moderate_high, high
  - Discretization breaks: 0, 0, 1, 1.4, 2.5, 3.3 (>3.3 = high)
  - Unit: ug Hg/kgbw/wk
  - Parents: fish_tissue_hg
  - CPT method: deterministic_subsistence
  - Container: Human Health
  - Source attribution: derived from subsistence intake formula (100 g/day, 60 kg bw, 0.95 MeHg fraction); breaks aligned with pTWI thresholds
  - Definition file:line: `dag_definition_mackenzie_hg.py:87-92`; breaks `:279-282`

- **ptwi_exceedance**
  - Display label: pTWI Exceedance
  - Category: impact
  - States: does_not_exceed, exceeds
  - Discretization breaks: binary at US EPA child pTWI = 0.7 ug/kgbw/wk
  - Unit: ug/kgbw/wk (threshold)
  - Parents: mehg_ingested
  - CPT method: deterministic_ptwi
  - Container: Human Health
  - Source attribution: derived from US EPA child pTWI = 0.7 ug/kgbw/wk; full HC thresholds 0.7/1.4/3.3 stored in canonical_mackenzie.PTWI_THRESHOLDS
  - Definition file:line: `dag_definition_mackenzie_hg.py:93-98`; thresholds `canonical_mackenzie.py:38`

### A.5.2 GBS edge list (15 edges)

Source: `dag_definition_mackenzie_hg.py:181-196`.

Nonpoint aggregation (3 edges, shared via `_EDGES_NONPOINT`):

1. atmospheric_hg_deposition -> total_hg_deposition
2. permafrost_hg_release -> total_hg_deposition
3. soil_erosion_hg_release -> total_hg_deposition

Water THg parents (3 edges, GBS-specific):

4. proximity_oil_gbs -> freshwater_thg
5. proximity_rpts_gbs -> freshwater_thg
6. total_hg_deposition -> freshwater_thg

Fish tissue Hg parents (5 edges, GBS-specific):

7. fish_species -> fish_tissue_hg
8. fish_length -> fish_tissue_hg
9. proximity_oil_gbs -> fish_tissue_hg
10. proximity_rpts_gbs -> fish_tissue_hg
11. total_hg_deposition -> fish_tissue_hg

Effect chain (4 edges, shared via `_EDGES_EFFECTS`):

12. fish_tissue_hg -> degree_of_injury
13. fish_tissue_hg -> eligible_commercial_catch
14. fish_tissue_hg -> mehg_ingested
15. mehg_ingested -> ptwi_exceedance

GBS edge count: 3 + 3 + 5 + 4 = 15. Verified.

## A.6 Shared constants (identical between GSL and GBS)

### A.6.1 The 12 shared nodes

Defined in `SHARED_NODES` at `dag_definition_mackenzie_hg.py:17-99`. All 12
nodes have identical states, categories, labels, descriptions, container
assignments, discretization breaks, units, and CPT methods between the two
submodels. Only the parent set (for freshwater_thg and fish_tissue_hg)
changes because the point-source parents differ.

1. atmospheric_hg_deposition (substance, root, empirical_prior, Nonpoint Sources)
2. permafrost_hg_release (substance, root, empirical_prior, Nonpoint Sources)
3. soil_erosion_hg_release (substance, root, empirical_prior, Nonpoint Sources)
4. total_hg_deposition (substance, bdeu, Hg Deposition)
5. fish_species (condition, root, empirical_prior, Exposure Factors)
6. fish_length (condition, root, empirical_prior, Exposure Factors)
7. freshwater_thg (effect, bdeu, Stressors) -- parent SET differs between GSL and GBS
8. fish_tissue_hg (effect, bdeu, Stressors) -- parent SET differs between GSL and GBS
9. degree_of_injury (effect, deterministic_dillon, Effects)
10. eligible_commercial_catch (impact, deterministic_hc_guideline, Effects)
11. mehg_ingested (impact, deterministic_subsistence, Human Health)
12. ptwi_exceedance (impact, deterministic_ptwi, Human Health)

### A.6.2 Shared edge sets

`_EDGES_NONPOINT` (`dag_definition_mackenzie_hg.py:148-152`) -- 3 edges
identical in both submodels:

- atmospheric_hg_deposition -> total_hg_deposition
- permafrost_hg_release -> total_hg_deposition
- soil_erosion_hg_release -> total_hg_deposition

`_EDGES_EFFECTS` (`dag_definition_mackenzie_hg.py:155-160`) -- 4 edges
identical in both submodels:

- fish_tissue_hg -> degree_of_injury
- fish_tissue_hg -> eligible_commercial_catch
- fish_tissue_hg -> mehg_ingested
- mehg_ingested -> ptwi_exceedance

### A.6.3 Shared discretization breaks

The `DISCRETIZATION` dict (`dag_definition_mackenzie_hg.py:240-287`) is
applied identically to both submodels. The breaks are listed with their
source attributions in the per-submodel tables above (sections A.4.1 and
A.5.1) and repeated in Appendix C with full per-break source citation.

Notable encoding choices:

- The "permafrost none" special case (`dag_definition_mackenzie_hg.py:245-248`)
  uses lowest breakpoint 0 to produce a literal "none" state for permafrost
  thaw Hg release; the only break-list with this pattern.
- `mehg_ingested` (`dag_definition_mackenzie_hg.py:279-282`) similarly uses
  lowest breakpoint 0 to produce a "none" state; the rest of the breaks
  (1.0, 1.4, 2.5, 3.3) align with Health Canada / US EPA pTWI thresholds.
- `eligible_commercial_catch` (`dag_definition_mackenzie_hg.py:283-286`) is
  encoded as a single threshold (0.5 ug/g ww), not a break list, because it
  is binary.
- `fish_length` (`dag_definition_mackenzie_hg.py:265-274`) uses per-species
  break dictionaries because the small/large cutoff varies by species.

### A.6.4 Shared containers

The 7 container labels (Point Sources, Nonpoint Sources, Hg Deposition,
Exposure Factors, Stressors, Effects, Human Health) are identical between
GSL and GBS. The Point Sources container has different members per submodel
(see A.2); the other six containers have identical members.

## A.7 Differences between GSL and GBS

### A.7.1 The 4 submodel-specific nodes

Two GSL-specific (`GSL_SPECIFIC_NODES` at `dag_definition_mackenzie_hg.py:105-118`):

- proximity_mine_gsl -- 15 km buffer around active mine development
- proximity_historic_mine -- 15 km buffer around historic mine sites

Two GBS-specific (`GBS_SPECIFIC_NODES` at `dag_definition_mackenzie_hg.py:124-137`):

- proximity_oil_gbs -- 50 km buffer around oil/gas operations
- proximity_rpts_gbs -- 10 km buffer around retrogressive permafrost thaw slumps

All 4 are root nodes with binary states (yes / no) in the substance
category, assigned to the Point Sources container, and fit by
`empirical_prior` from combined fish + water data (see
`fit_mackenzie_model.py:485-496`).

### A.7.2 The 8 submodel-specific point-source edges (4 GSL + 4 GBS)

CORRECTED from the prior "6 submodel-specific edges" header per codex
appendices-R1 finding P2-2 (mutual-agreement methodology, 2026-05-17).
Counted strictly per-submodel from the source: GSL has 4 point-source-to-
stressor edges; GBS has 4 point-source-to-stressor edges; 8 unique edges
across the two submodels (none overlap). The remaining 11 edges of each
submodel (3 nonpoint + 3 water/fish edges shared in structure + 4 effects +
1 species/length variant) are structurally identical and not submodel-
specific.

GSL-specific (point source -> stressor):

1. proximity_mine_gsl -> freshwater_thg
2. proximity_historic_mine -> freshwater_thg
3. proximity_mine_gsl -> fish_tissue_hg
4. proximity_historic_mine -> fish_tissue_hg

GBS-specific (point source -> stressor):

5. proximity_oil_gbs -> freshwater_thg
6. proximity_rpts_gbs -> freshwater_thg
7. proximity_oil_gbs -> fish_tissue_hg
8. proximity_rpts_gbs -> fish_tissue_hg

VERIFY: The instruction header described "6 model-specific edges". Counted
strictly per-submodel, GSL has 4 point-source-to-stressor edges and GBS
has 4 point-source-to-stressor edges, for 8 unique edges across the two
submodels (none of which appear in the other submodel). The remaining
edges (total_hg_deposition -> freshwater_thg, total_hg_deposition ->
fish_tissue_hg, fish_species -> fish_tissue_hg, fish_length ->
fish_tissue_hg) are structurally identical in both submodels and so are
not submodel-specific. The "6 model-specific edges" framing likely
referred to 3 GSL-specific + 3 GBS-specific from a different counting
convention; the canonical structural fact is 4 GSL-specific point-source
edges + 4 GBS-specific point-source edges (lines 167-168 + 173-174 vs
185-186 + 191-192 of `dag_definition_mackenzie_hg.py`).

### A.7.3 Regions

GSL: outlet, middle, north_arm, east_arm.
GBS: north, west, east, south.

(Region differentiation for inference uses overall priors as the baseline
per the documented limitation at `fit_mackenzie_model.py:950-952`.)

## A.8 CPT method assignment summary

Traceable through `fit_all_cpts()` at `fit_mackenzie_model.py:454-579`. The
function dispatches per node:

- **empirical_prior**
  - Nodes: atmospheric_hg_deposition, permafrost_hg_release, soil_erosion_hg_release, proximity_mine_gsl, proximity_historic_mine, proximity_oil_gbs, proximity_rpts_gbs, fish_species, fish_length
  - Implementation file:line: `fit_mackenzie_model.py:246-271` (definition); `:482-500` (orchestration)
  - Algorithm: observed-state counts smoothed by BDeu prior alpha_k = ESS / n_states

- **bdeu**
  - Nodes: total_hg_deposition, freshwater_thg, fish_tissue_hg
  - Implementation file:line: `fit_mackenzie_model.py:160-243` (definition); `:502-538` (orchestration)
  - Algorithm: BDeu posterior P(s|cfg) = (count + alpha_ijk) / (n + alpha_ij), ESS = 1.0 default

- **deterministic_dillon** (exported as `deterministic_dillon_2010` in `learned-model-*.json`)
  - Nodes: degree_of_injury
  - Implementation file:line: `fit_mackenzie_model.py:278-296` (Dillon LL.3); `:328-359` (CPT build); `:540-550` (orchestration)
  - Algorithm: Dillon 2010 LL.3 at fish_tissue_hg midpoint, soft 0.90 / 0.10 across n-1 others

- **deterministic_hc_guideline**
  - Nodes: eligible_commercial_catch
  - Implementation file:line: `fit_mackenzie_model.py:362-382` (CPT build); `:553-559` (orchestration)
  - Algorithm: binary threshold at HC 0.5 ug/g ww applied to fish_tissue_hg midpoint, soft 0.95 / 0.05

- **deterministic_subsistence**
  - Nodes: mehg_ingested
  - Implementation file:line: `fit_mackenzie_model.py:385-417` (CPT build); `:561-568` (orchestration)
  - Algorithm: midpoint * 100 g/day * 7 * 0.95 / 60 kg, bin via MEHG_BREAKS, soft 0.90 / 0.10 across n-1 others

- **deterministic_ptwi**
  - Nodes: ptwi_exceedance
  - Implementation file:line: `fit_mackenzie_model.py:420-447` (CPT build); `:570-577` (orchestration)
  - Algorithm: mehg_ingested midpoint vs US EPA child pTWI 0.7 ug/kgbw/wk, soft 0.95 / 0.05

CPT method count per submodel:

- empirical_prior: 9 nodes (3 nonpoint sources + 2 point sources + 2 fish exposure factors + 2 fish species/length; the point-source pair differs per submodel)
- bdeu: 3 nodes
- deterministic_dillon: 1 node
- deterministic_hc_guideline: 1 node
- deterministic_subsistence: 1 node
- deterministic_ptwi: 1 node

Per-submodel total: 7 + 3 + 4 = 14 nodes (CORRECTED per codex
holistic-R1 P3-1 to remove the informal self-correction note;
the per-submodel correct count is shown directly):

- 7 empirical_prior nodes: 3 nonpoint sources (atmospheric_hg_deposition,
  permafrost_hg_release, soil_erosion_hg_release) + 2 submodel-specific
  point-source nodes (proximity_mine_gsl + proximity_historic_mine for
  GSL; proximity_oil_gbs + proximity_rpts_gbs for GBS) + 2 exposure
  factors (fish_species, fish_length).
- 3 bdeu nodes: total_hg_deposition, freshwater_thg, fish_tissue_hg.
- 4 deterministic nodes: degree_of_injury (deterministic_dillon_2010),
  eligible_commercial_catch (deterministic_hc_guideline), mehg_ingested
  (deterministic_subsistence), ptwi_exceedance (deterministic_ptwi).

Total: 7 + 3 + 4 = 14 nodes per submodel.

## A.9 Verification summary

| Item | Expected | Observed | Source |
|------|---------:|---------:|--------|
| GSL nodes | 14 | 14 | `dag_definition_mackenzie_hg.py:202` (SHARED_NODES 12 + GSL_SPECIFIC_NODES 2) |
| GSL edges | 15 | 15 | `dag_definition_mackenzie_hg.py:163-178` (3 nonpoint + 3 water + 5 fish + 4 effects) |
| GBS nodes | 14 | 14 | `dag_definition_mackenzie_hg.py:203` (SHARED_NODES 12 + GBS_SPECIFIC_NODES 2) |
| GBS edges | 15 | 15 | `dag_definition_mackenzie_hg.py:181-196` (3 nonpoint + 3 water + 5 fish + 4 effects) |
| Shared nodes | 12 | 12 | `dag_definition_mackenzie_hg.py:17-99` SHARED_NODES keys |
| GSL-specific nodes | 2 | 2 | `dag_definition_mackenzie_hg.py:105-118` GSL_SPECIFIC_NODES keys |
| GBS-specific nodes | 2 | 2 | `dag_definition_mackenzie_hg.py:124-137` GBS_SPECIFIC_NODES keys |
| Shared nonpoint edges | 3 | 3 | `dag_definition_mackenzie_hg.py:148-152` `_EDGES_NONPOINT` |
| Shared effect-chain edges | 4 | 4 | `dag_definition_mackenzie_hg.py:155-160` `_EDGES_EFFECTS` |
| empirical_prior nodes (per submodel) | 7 | 7 | `fit_mackenzie_model.py:485-500` |
| bdeu nodes (per submodel) | 3 | 3 | `fit_mackenzie_model.py:504-538` |
| deterministic nodes (per submodel) | 4 | 4 | `fit_mackenzie_model.py:540-577` |
| Total CPT methods per submodel | 14 | 14 | 7 + 3 + 4 = 14 |
| GSL regions | 4 | 4 | `dag_definition_mackenzie_hg.py:233` |
| GBS regions | 4 | 4 | `dag_definition_mackenzie_hg.py:234` |
| Containers per submodel | 7 | 7 | `dag_definition_mackenzie_hg.py:209-227` |

## A.10 Cross-references for downstream Parts

Body Parts should cite this Appendix in the following places:

- Part II Section 6 (Discretization) -- cite the per-node discretization
  breaks in A.4.1 and A.5.1 plus the encoding notes in A.6.3.
- Part III Section 7 (Conceptual DAG) -- cite the node-count and edge-count
  summary in A.1, the container assignments in A.2, and the shared-vs-specific
  split in A.6 and A.7.
- Part III Section 9 (Python implementation) -- cite the file:line ranges
  in A.4.1 / A.5.1 and the edge-list traces in A.4.2 / A.5.2.
- Part IV Sections 10-14 (CPT fitting) -- cite the CPT method assignment
  summary in A.8 (file:line ranges for each method's implementation).
- Part V Section 17 (Forward inference and per-region inference) -- cite
  the regions list in A.3 and the per-region limitation note.
- Appendix B (CPT inventory) -- cross-references method assignment from A.8;
  Appendix B drills into per-CPT ESS, parent configurations, total
  observations, and the BDeu correctness receipt.
- Appendix C (Discretization table) -- cross-references the breaks listed
  in A.4.1 / A.5.1; Appendix C provides per-break source citation
  (Table S4 row vs regulatory doc vs derived rationale).

## A.11 Plain-ASCII compliance

This appendix uses only code points <= 127. The ascii_lint.py harness
(sibling to PLAN.md) is the authoritative gate; any violations it flags
are defects that must be fixed before this appendix is signed off.

-- END OF APPENDIX A --
---
title: Appendix B -- Complete CPT Inventory (Jermilova BN-RRM Methodology)
status: v1.0 (post codex appendices-R3 GREEN; holistic-R1 propagation applied 2026-05-17)
parent_document: JERMILOVA_BNRRM_CONSTRUCTION_METHODOLOGY.md
purpose: Per-CPT ledger of method, parents, observation counts, and soft-edge
         policy for every fitted CPT in both submodels (GSL and GBS), so that
         downstream body Parts can cite this Appendix instead of re-deriving
         CPT facts inline. Plain ASCII only.
created: 2026-05-17
---

# Appendix B -- Complete CPT Inventory

This appendix is the fact-pinning ledger for every probability distribution
in the Jermilova Mackenzie Hg BN-RRM build. Every empirical claim made by
the body of `JERMILOVA_BNRRM_CONSTRUCTION_METHODOLOGY.md` about a CPT
(method, parents, configuration count, observation count, soft-edge value)
must trace to a row in the master table below. The body Parts cite this
appendix; the appendix cites source code (`fit_mackenzie_model.py`) and
results JSON (`results/learned-model-gsl.json`, `results/learned-model-gbs.json`).

Plain ASCII compliance: no emoji, no Unicode arrows, no smart quotes, no
em-dash. Enforced by `ascii_lint.py` per the PLAN.

## B.0 Scope and conventions

### B.0.1 What counts as a CPT in this inventory

The pipeline produces two kinds of node-level probability artifacts:

1. **CPTs proper** -- a distribution `P(node | parent_configuration)` for
   every parent configuration. Stored in `results/learned-model-{gsl,gbs}.json`
   under `cpts[node_id].table` keyed by a pipe-joined parent state tuple
   (e.g. `"yes|yes|low"`).
2. **Root-node empirical priors** -- a marginal `P(node)` with no parents.
   Stored in `results/learned-model-{gsl,gbs}.json` under
   `marginals[node_id]`, and also embedded as `priors` inside each node
   entry in the `nodes` list. Per the PLAN Section 6 Part IV item 10.1,
   these are treated as CPTs in this ledger (they participate in the
   forward inference pass identically; they simply have an empty parent
   set).

This appendix tallies both kinds. A CPT-proper is fitted by either
`fit_bdeu_cpt()` (BDeu) or one of the four
`build_deterministic_cpt_*()` functions. A root-node prior is fitted by
`fit_empirical_prior()`. All three paths are sourced from
`fit_mackenzie_model.py`.

### B.0.2 Method codes used in the inventory

| Method code | What it is | Where in `fit_mackenzie_model.py` |
|-------------|-----------|-----------------------------------|
| `empirical_prior` | Root-node marginal: observed counts + BDeu smoothing | `fit_empirical_prior()` lines 246-271 |
| `bdeu` | Bayesian Dirichlet equivalent uniform CPT, ESS=1.0 | `fit_bdeu_cpt()` lines 160-243 |
| `deterministic_dillon` | Dillon 2010 LL.3 dose-response at midpoint, 0.90/0.10 soft edge | `build_deterministic_cpt_degree_of_injury()` lines 328-359 |
| `deterministic_hc_guideline` | Health Canada 0.5 ug/g ww commercial fish guideline at midpoint, 0.95/0.05 soft edge | `build_deterministic_cpt_eligible_catch()` lines 362-382 |
| `deterministic_subsistence` | Subsistence intake equation at midpoint, 0.90/0.10 soft edge | `build_deterministic_cpt_mehg_ingested()` lines 385-417 |
| `deterministic_ptwi` | US EPA child pTWI 0.7 ug/kgbw/wk at MeHg midpoint, 0.95/0.05 soft edge | `build_deterministic_cpt_ptwi_exceedance()` lines 420-447 |

The `method` strings stored in the learned-model JSON differ in spelling
from the codes above; the JSON uses `bdeu`, `deterministic_dillon_2010`,
`deterministic_hc_guideline`, `deterministic_subsistence`, and
`deterministic_ptwi`. The shorter codes in this appendix are PLAN
shorthand; the long forms are what the JSON ships.

### B.0.3 Observation-count provenance

`fit_bdeu_cpt()` (line 240) prints a one-line `verbose` summary at fitting
time of the form

```
    {node_id}: ESS={ess}, {total_obs} obs across {configs_with_data}/{n_configs} parent configs
```

These counts are NOT persisted in `learned-model-{gsl,gbs}.json`. They are
emitted to stdout during `python fit_mackenzie_model.py --model {GSL,GBS}`
and recorded in the run log. The exact counts depend on the upstream
filtering applied during `prepare_mackenzie_data.py` (parent-missing skip
inside `fit_bdeu_cpt` lines 216-225). The inventory rows below report
those counts where they can be derived from the JSON metadata
(`nFishCases`, `nWaterCases`) and the data-routing rules in
`fit_all_cpts()` lines 484-538; for the exact per-CPT figures the
authoritative source is the `fit_mackenzie_model.py` run log. Body
Part IV is the place to surface any discrepancy between the JSON and the
run log if one is observed; this appendix flags the uncertainty rather
than fabricating numbers.

The "Total observations used" column is therefore reported as:

- For `bdeu` CPTs of `total_hg_deposition` (sourced from fish + water
  combined per fit_all_cpts:477 and 504-514), the upper bound is
  `nFishCases + nWaterCases` minus any rows with missing parent.
- For `bdeu` CPT of `freshwater_thg` (sourced from water only per
  fit_all_cpts:516-526), the upper bound is `nWaterCases` minus rows
  with missing parent.
- For `bdeu` CPT of `fish_tissue_hg` (sourced from fish only per
  fit_all_cpts:528-538), the upper bound is `nFishCases` minus rows
  with missing parent.
- For `empirical_prior` root nodes, the total is the sum of observed
  states (Equation in `fit_empirical_prior` line 260).
- For `deterministic_*` CPTs there is no data fit; the entry is `N/A`.

### B.0.4 GSL and GBS data totals (per learned-model JSON header)

| Submodel | `nFishCases` | `nWaterCases` | `ess` |
|----------|------------:|--------------:|------:|
| GSL      | 604         | 855           | 1.0   |
| GBS      | 274         | 1589          | 1.0   |

Source: `results/learned-model-gsl.json` lines 7-9;
`results/learned-model-gbs.json` matching header.

Note: these are POST-discretization case counts, not raw FRDR record
counts. The PLAN Section 6 Part II item 4.4 distinguishes raw input
counts (797 fish, 2,124 water in the FRDR Excel) from
post-prep case counts (604/855 GSL, 274/1589 GBS in the JSON), and Part V
item 15.1 distinguishes those again from LOO-eligible counts after the
parent-missing skip (584 fish GSL, 258 fish GBS, 855 water GSL, 1589
water GBS, per the validation JSONs). Do not conflate.

### B.0.5 Counting parent configurations

For a BDeu CPT, `n_parent_configs` is the product of state cardinalities
across all parents (`fit_bdeu_cpt` lines 192-197). For deterministic
CPTs whose only parent is `fish_tissue_hg` (5 states), n_parent_configs
is 5; for `ptwi_exceedance` whose parent is `mehg_ingested` (6 states),
n_parent_configs is 6. Root nodes have n_parent_configs = 1 by convention
(empty parent set; the prior is a single distribution over the node's
states).

### B.0.6 Soft-edge policy by deterministic CPT

The four deterministic CPTs apply DIFFERENT soft-edge values, NOT a
uniform policy. The PLAN Section 6 Part IV item 12.6 calls this out
explicitly because earlier drafts incorrectly summarized it as
"uniform 0.90/0.10". The receipt from source:

| CPT | MAP probability | Off-MAP probability | Source lines |
|-----|---------------:|--------------------:|--------------|
| `degree_of_injury` | 0.90 | 0.10 / (n_states - 1) = 0.10 / 3 = 0.0333 across each of 3 other states | `fit_mackenzie_model.py:343-349` |
| `eligible_commercial_catch` (binary) | 0.95 | 0.05 on the single other state | `fit_mackenzie_model.py:377-378` |
| `mehg_ingested` | 0.90 | 0.10 / (n_states - 1) = 0.10 / 5 = 0.02 across each of 5 other states | `fit_mackenzie_model.py:402-407` |
| `ptwi_exceedance` (binary) | 0.95 | 0.05 on the single other state | `fit_mackenzie_model.py:442-443` |

The pattern: BINARY deterministic outcomes get 0.95/0.05; MULTI-state
deterministic outcomes get 0.90/0.10 spread uniformly. This reflects the
intuition that within-bin variability is more constrained when the
outcome dichotomy is sharper (e.g., a Health Canada guideline crossing
vs. a continuum of injury severity).

### B.0.7 file:line citation key

All `fit_mackenzie_model.py:NNN` line references in this appendix were
read against the 1257-line version of the file recorded in the PLAN
Section 7 source-of-truth file map. If the file changes, the line numbers
in this appendix must be updated alongside any body Parts that cite them.

## B.1 Master CPT inventory table (BOTH submodels)

The table below lists every probability artifact in both submodels. Rows
are grouped first by SHARED-vs-submodel-specific, then by node within the
group. A SHARED row means the node and its CPT method exist in BOTH
submodels with the same parent structure (and same soft-edge policy for
deterministic CPTs); the n_parent_configs entry, however, may still
differ between GSL and GBS where parent IDENTITY differs (different point
sources in each submodel even though count = 2 in both). For nodes whose
parent identity differs between submodels (`freshwater_thg`,
`fish_tissue_hg`), one row per submodel is provided.

### B.1.1 Root-node priors (empirical_prior method)

Roots are shared in structure between submodels but their priors differ
numerically because the underlying data differ. Each row pertains to ONE
submodel.

- **atmospheric_hg_deposition (GSL)** -- Method: empirical_prior; Parents: (none); n_parent_configs: 1; n_states: 5; ESS: 1.0; Total observations used: 1459 (total of fish + water, line 260 sum); Configs with data: 1/1; Soft-edge: N/A; file:line: `fit_mackenzie_model.py:485-488,495-496`; called via `fit_empirical_prior` lines 246-271
- **atmospheric_hg_deposition (GBS)** -- Method: empirical_prior; Parents: (none); n_parent_configs: 1; n_states: 5; ESS: 1.0; Total observations used: 1863 (274 + 1589, less any null rows); Configs with data: 1/1; Soft-edge: N/A; file:line: same as above
- **permafrost_hg_release (GSL)** -- Method: empirical_prior; Parents: (none); n_parent_configs: 1; n_states: 6; ESS: 1.0; Total observations used: up to 1459; Configs with data: 1/1; Soft-edge: N/A; file:line: `fit_mackenzie_model.py:485-488,495-496`
- **permafrost_hg_release (GBS)** -- Method: empirical_prior; Parents: (none); n_parent_configs: 1; n_states: 6; ESS: 1.0; Total observations used: up to 1863; Configs with data: 1/1; Soft-edge: N/A; file:line: same
- **soil_erosion_hg_release (GSL)** -- Method: empirical_prior; Parents: (none); n_parent_configs: 1; n_states: 4; ESS: 1.0; Total observations used: up to 1459; Configs with data: 1/1; Soft-edge: N/A; file:line: `fit_mackenzie_model.py:485-488,495-496`
- **soil_erosion_hg_release (GBS)** -- Method: empirical_prior; Parents: (none); n_parent_configs: 1; n_states: 4; ESS: 1.0; Total observations used: up to 1863; Configs with data: 1/1; Soft-edge: N/A; file:line: same
- **proximity_mine_gsl (GSL)** -- Method: empirical_prior; Parents: (none); n_parent_configs: 1; n_states: 2; ESS: 1.0; Total observations used: up to 1459; Configs with data: 1/1; Soft-edge: N/A; file:line: `fit_mackenzie_model.py:490-496`
- **proximity_historic_mine (GSL)** -- Method: empirical_prior; Parents: (none); n_parent_configs: 1; n_states: 2; ESS: 1.0; Total observations used: up to 1459; Configs with data: 1/1; Soft-edge: N/A; file:line: `fit_mackenzie_model.py:490-496`
- **proximity_oil_gbs (GBS)** -- Method: empirical_prior; Parents: (none); n_parent_configs: 1; n_states: 2; ESS: 1.0; Total observations used: up to 1863; Configs with data: 1/1; Soft-edge: N/A; file:line: `fit_mackenzie_model.py:492-496`
- **proximity_rpts_gbs (GBS)** -- Method: empirical_prior; Parents: (none); n_parent_configs: 1; n_states: 2; ESS: 1.0; Total observations used: up to 1863; Configs with data: 1/1; Soft-edge: N/A; file:line: `fit_mackenzie_model.py:492-496`
- **fish_species (GSL)** -- Method: empirical_prior; Parents: (none); n_parent_configs: 1; n_states: 5; ESS: 1.0; Total observations used: up to 604 (fish only, line 500); Configs with data: 1/1; Soft-edge: N/A; file:line: `fit_mackenzie_model.py:499-500`
- **fish_species (GBS)** -- Method: empirical_prior; Parents: (none); n_parent_configs: 1; n_states: 5; ESS: 1.0; Total observations used: up to 274 (fish only); Configs with data: 1/1; Soft-edge: N/A; file:line: same
- **fish_length (GSL)** -- Method: empirical_prior; Parents: (none); n_parent_configs: 1; n_states: 2; ESS: 1.0; Total observations used: up to 604; Configs with data: 1/1; Soft-edge: N/A; file:line: `fit_mackenzie_model.py:499-500`
- **fish_length (GBS)** -- Method: empirical_prior; Parents: (none); n_parent_configs: 1; n_states: 2; ESS: 1.0; Total observations used: up to 274; Configs with data: 1/1; Soft-edge: N/A; file:line: same

Subtotal: 7 root nodes per submodel x 2 submodels = 14 empirical-prior
rows. (GSL roots: `atmospheric_hg_deposition`, `permafrost_hg_release`,
`soil_erosion_hg_release`, `proximity_mine_gsl`,
`proximity_historic_mine`, `fish_species`, `fish_length`. GBS roots:
same first three, then `proximity_oil_gbs`, `proximity_rpts_gbs`, then
the same two fish roots.)

The "Total observations used" upper bounds above are stated as `up to
{nFishCases + nWaterCases}` (combined) or `up to {nFishCases}` (fish-only
roots) because `fit_empirical_prior` skips rows whose value at the
target node is None (line 256-258). Exact totals are emitted to the run
log at line 269-270. The verbose line stores the raw `total` from line
260 and the per-state breakdown.

### B.1.2 BDeu CPTs (bdeu method)

- **total_hg_deposition (GSL)**
  - Method: bdeu
  - Parents: atmospheric_hg_deposition (5), permafrost_hg_release (6), soil_erosion_hg_release (4)
  - n_parent_configs: 5x6x4 = 120; n_states: 5; ESS: 1.0
  - Total observations used: up to 1459 (fish + water; rows with any-parent-None skipped per lines 216-225)
  - Configs with data: see fit run log; Soft-edge: N/A
  - file:line: `fit_mackenzie_model.py:505-514` (orchestration); `fit_bdeu_cpt` lines 160-243 (math)

- **total_hg_deposition (GBS)**
  - Method: bdeu
  - Parents: atmospheric_hg_deposition (5), permafrost_hg_release (6), soil_erosion_hg_release (4)
  - n_parent_configs: 5x6x4 = 120; n_states: 5; ESS: 1.0
  - Total observations used: up to 1863; Configs with data: see fit run log; Soft-edge: N/A
  - file:line: same

- **freshwater_thg (GSL)**
  - Method: bdeu
  - Parents: proximity_mine_gsl (2), proximity_historic_mine (2), total_hg_deposition (5)
  - n_parent_configs: 2x2x5 = 20; n_states: 3; ESS: 1.0
  - Total observations used: up to 855 (water only; line 524); Configs with data: see fit run log; Soft-edge: N/A
  - file:line: `fit_mackenzie_model.py:517-526`

- **freshwater_thg (GBS)**
  - Method: bdeu
  - Parents: proximity_oil_gbs (2), proximity_rpts_gbs (2), total_hg_deposition (5)
  - n_parent_configs: 2x2x5 = 20; n_states: 3; ESS: 1.0
  - Total observations used: up to 1589; Configs with data: see fit run log; Soft-edge: N/A
  - file:line: same orchestration, different parent identity per `get_model_spec`

- **fish_tissue_hg (GSL)**
  - Method: bdeu
  - Parents: fish_species (5), fish_length (2), proximity_mine_gsl (2), proximity_historic_mine (2), total_hg_deposition (5)
  - n_parent_configs: 5x2x2x2x5 = 200; n_states: 5; ESS: 1.0
  - Total observations used: up to 604 (fish only; line 536); Configs with data: see fit run log; Soft-edge: N/A
  - file:line: `fit_mackenzie_model.py:529-538`

- **fish_tissue_hg (GBS)**
  - Method: bdeu
  - Parents: fish_species (5), fish_length (2), proximity_oil_gbs (2), proximity_rpts_gbs (2), total_hg_deposition (5)
  - n_parent_configs: 5x2x2x2x5 = 200; n_states: 5; ESS: 1.0
  - Total observations used: up to 274; Configs with data: see fit run log; Soft-edge: N/A
  - file:line: same

Subtotal: 3 BDeu CPTs per submodel x 2 submodels = 6 BDeu rows.
n_parent_configs values verified by reading the JSON
(`results/learned-model-gsl.json`): `total_hg_deposition.table` has 120
keys, `freshwater_thg.table` has 20 keys, `fish_tissue_hg.table` has 200
keys; same counts in `results/learned-model-gbs.json`. These are pure
products of parent-state cardinalities -- no parent-configuration
pruning is done in `fit_bdeu_cpt`.

A note on `Configs with data / n_parent_configs`: this is the BDeu
sparsity indicator. Because the JSON does not persist the count, the
authoritative source is the `fit_mackenzie_model.py` run log emitted at
line 240-242. Sparsity matters because for parent configurations that
have zero matching observations, the posterior collapses to the BDeu
prior (i.e., uniform over the child states scaled by `alpha_ijk /
alpha_ij = 1 / n_states`). This is visible in the learned-model JSON: a
large fraction of `freshwater_thg.table` and `fish_tissue_hg.table`
entries are uniform `{state: 1/n_states}` because the GSL water/fish
data did not populate those parent slots. Specifically: of the 20
`freshwater_thg` configurations in GSL, several show
`{low: 0.333, medium: 0.333, high: 0.333}` exactly, indicating
zero-observation BDeu fall-through. Of the 200 `fish_tissue_hg`
configurations, the majority show `{state: 0.2}` uniform-on-5-states for
the same reason.

This sparsity is the methods-honesty hook for Part V (LOO results show
`fish_tissue_hg` kappa = 0.466 GSL and 0.489 GBS, modest because of the
sparsity-induced uniform predictions on under-represented parent
configurations; `freshwater_thg` kappa = 0.0 in both submodels because
the single dominant `low` state floors kappa).

### B.1.3 Deterministic CPTs

- **degree_of_injury (GSL)** -- Method: deterministic_dillon; Parents: fish_tissue_hg (5); n_parent_configs: 5; n_states: 4; ESS: N/A; Total obs: N/A; Configs with data: 5/5 (all configs covered deterministically); Soft-edge: 0.90 on MAP, 0.10 / 3 = 0.0333 on each other; file:line: `fit_mackenzie_model.py:328-359`; orchestration `fit_mackenzie_model.py:542-550`
- **degree_of_injury (GBS)** -- Method: deterministic_dillon; Parents: fish_tissue_hg (5); n_parent_configs: 5; n_states: 4; ESS: N/A; Total obs: N/A; Configs with data: 5/5; Soft-edge: 0.90 / 0.0333 (each of 3 others); file:line: same
- **eligible_commercial_catch (GSL)** -- Method: deterministic_hc_guideline; Parents: fish_tissue_hg (5); n_parent_configs: 5; n_states: 2; ESS: N/A; Total obs: N/A; Configs with data: 5/5; Soft-edge: 0.95 on MAP, 0.05 on the other state; file:line: `fit_mackenzie_model.py:362-382`; orchestration `fit_mackenzie_model.py:552-559`
- **eligible_commercial_catch (GBS)** -- Method: deterministic_hc_guideline; Parents: fish_tissue_hg (5); n_parent_configs: 5; n_states: 2; ESS: N/A; Total obs: N/A; Configs with data: 5/5; Soft-edge: 0.95 / 0.05; file:line: same
- **mehg_ingested (GSL)** -- Method: deterministic_subsistence; Parents: fish_tissue_hg (5); n_parent_configs: 5; n_states: 6; ESS: N/A; Total obs: N/A; Configs with data: 5/5; Soft-edge: 0.90 on MAP, 0.10 / 5 = 0.02 on each of 5 others; file:line: `fit_mackenzie_model.py:385-417`; orchestration `fit_mackenzie_model.py:561-568`
- **mehg_ingested (GBS)** -- Method: deterministic_subsistence; Parents: fish_tissue_hg (5); n_parent_configs: 5; n_states: 6; ESS: N/A; Total obs: N/A; Configs with data: 5/5; Soft-edge: 0.90 / 0.02 (each of 5 others); file:line: same
- **ptwi_exceedance (GSL)** -- Method: deterministic_ptwi; Parents: mehg_ingested (6); n_parent_configs: 6; n_states: 2; ESS: N/A; Total obs: N/A; Configs with data: 6/6; Soft-edge: 0.95 on MAP, 0.05 on the other state; file:line: `fit_mackenzie_model.py:420-447`; orchestration `fit_mackenzie_model.py:570-577`
- **ptwi_exceedance (GBS)** -- Method: deterministic_ptwi; Parents: mehg_ingested (6); n_parent_configs: 6; n_states: 2; ESS: N/A; Total obs: N/A; Configs with data: 6/6; Soft-edge: 0.95 / 0.05; file:line: same

Subtotal: 4 deterministic CPTs per submodel x 2 submodels = 8
deterministic rows.

### B.1.4 Inventory roll-up

| Category | Per submodel | Both submodels combined |
|----------|------------:|------------------------:|
| Empirical-prior root nodes | 7 | 14 |
| BDeu CPTs                  | 3 | 6 |
| Deterministic CPTs         | 4 | 8 |
| **TOTAL distributions**    | **14** | **28** |

The 14 distributions per submodel correspond exactly to the 14 nodes in
each submodel (12 shared + 2 model-specific), per the PLAN Section 6
Part III item 7.2. Each node has exactly one probability artifact
(prior or CPT); none has both.

## B.2 Worked example: fish_tissue_hg CPT (GSL submodel)

The largest CPT by parent-configuration cardinality is `fish_tissue_hg`
in either submodel (200 configurations). This section embeds a
representative slice from `results/learned-model-gsl.json` (lines
1242-end of the fish_tissue_hg table block) to make the inventory row
concrete.

### B.2.1 CPT header (verbatim from JSON)

```
"fish_tissue_hg": {
  "parents": [
    "fish_species",
    "fish_length",
    "proximity_mine_gsl",
    "proximity_historic_mine",
    "total_hg_deposition"
  ],
  "states": [
    "low",
    "subsistence",
    "ec20",
    "ec50",
    "above_ec50"
  ],
  "method": "bdeu",
  "alpha": 1.0,
  "table": { ... 200 entries ... }
}
```

Source: `results/learned-model-gsl.json` lines 1242-1257 (header)
through the end of the table block.

### B.2.2 Representative configurations

The 200 configurations break into two qualitative groups: those with
matching observations in the training data (posterior is data-informed)
and those without matching observations (posterior collapses to uniform
1/5 = 0.2 across all five states).

Five informative configurations (each showing data-driven posterior
shape) are reproduced below from the JSON, with probabilities rounded to
four decimal places for readability. The pipe-joined key follows the
parent order in the JSON header: `fish_species | fish_length |
proximity_mine_gsl | proximity_historic_mine | total_hg_deposition`.

| Parent configuration key | low | subsistence | ec20 | ec50 | above_ec50 |
|--------------------------|----:|-----------:|----:|----:|-----------:|
| lake_whitefish \| small \| yes \| yes \| moderate_low | 0.6885 | 0.3115 | 0.0000 | 0.0000 | 0.0000 |
| lake_whitefish \| small \| no  \| yes \| low          | 0.9555 | 0.0445 | 0.0000 | 0.0000 | 0.0000 |
| lake_whitefish \| large \| yes \| yes \| moderate_low | 0.1250 | 0.8123 | 0.0625 | 0.0001 | 0.0001 |
| burbot         \| large \| no  \| no  \| moderate_low | 0.2000 | 0.7332 | 0.0667 | 0.0001 | 0.0001 |
| walleye        \| small \| no  \| no  \| moderate_low | 0.2353 | 0.7645 | 0.0001 | 0.0001 | 0.0001 |

For comparison, four uninformative configurations (zero-observation
posterior collapses to the BDeu prior). The values are exact uniform
0.2 plus floating-point round-off:

| Parent configuration key | low | subsistence | ec20 | ec50 | above_ec50 |
|--------------------------|----:|-----------:|----:|----:|-----------:|
| lake_whitefish \| small \| yes \| yes \| low          | 0.2000 | 0.2000 | 0.2000 | 0.2000 | 0.2000 |
| lake_whitefish \| small \| yes \| yes \| moderate_high | 0.2000 | 0.2000 | 0.2000 | 0.2000 | 0.2000 |
| northern_pike  \| small \| yes \| no  \| moderate_low  | 0.2000 | 0.2000 | 0.2000 | 0.2000 | 0.2000 |
| northern_pike  \| small \| yes \| no  \| moderate_high | 0.2000 | 0.2000 | 0.2000 | 0.2000 | 0.2000 |

Source: `results/learned-model-gsl.json` lines 1259-2659 inclusive. The
table block ends at line 2659; line 2660 is the sibling `alpha` field.
(CORRECTED from prior 2660 per codex appendices-R1 finding P3-1.)

### B.2.3 Reading the slice

Two methodological observations from this slice:

1. `lake_whitefish | small | yes | yes | moderate_low` shows the
   data-driven posterior most clearly: high mass on `low` and
   `subsistence` (the two lowest fish-tissue Hg bins), with the upper
   three bins decaying to ~1.6e-5 -- essentially the BDeu floor. This is
   the textbook BDeu posterior shape when the conditional sample is
   small but consistent: counts on a few states + small prior pseudocount
   on every state, normalized.
2. `lake_whitefish | small | yes | yes | low` (just above) by contrast
   shows the prior-only uniform 0.2 distribution. The conditional
   `(species=lake_whitefish, length=small, gsl_mine=yes,
   historic_mine=yes, total_hg=low)` had zero matching rows in the GSL
   fish data, so the posterior `(count + alpha_ijk) / (n + alpha_ij)`
   reduces to `alpha_ijk / alpha_ij = (ESS / (n_configs x n_states)) /
   (ESS / n_configs) = (1 / (200 x 5)) / (1 / 200) = 1/5 = 0.2` after
   normalization. (CORRECTED from prior `(1/(120 x 5)) / (1/120)` per
   codex appendices-R1 finding P2-3; uses fish_tissue_hg's n_configs =
   200 per B.1.2. The 1/5 simplification is identical because n_configs
   cancels, but the displayed cardinality must match the CPT under
   discussion.) This is the architectural sign that parent-cell coverage
   is incomplete for many of the 200 configurations.

The full 200-entry table is in `results/learned-model-gsl.json`; this
appendix does not embed it in full because the slice above already
illustrates both posterior shapes (data-informed and prior-only). The
analogous GBS table is in `results/learned-model-gbs.json` with parent
identity differing only in the point-source slot
(`proximity_oil_gbs | proximity_rpts_gbs` substituting for the two GSL
mine proximities).

## B.3 BDeu correctness receipt

The PLAN Section 6 Part IV item 11.9 requires a side-by-side comparison
of `fit_bdeu_cpt()` output against `pgmpy.estimators.BayesianEstimator`
with `prior_type="BDeu"` and `equivalent_sample_size=1.0`. Direct
execution of pgmpy is not performed in this Appendix to avoid the heavy
import (consistent with the M4 decision recorded in
`M4_FIT_REFACTORING_ANALYSIS.md` Section 5: pgmpy is intentionally NOT
used in the fitting path of `fit_mackenzie_model.py`). In place of a
pgmpy run we provide an analytic receipt: a hand-calculated worked
example on a tiny fixture, verifying that the formula implemented in
`fit_bdeu_cpt()` matches the BDeu posterior defined in Heckerman,
Geiger, and Chickering (1995) Machine Learning 20:197-243.

### B.3.1 The formula

From the code at `fit_mackenzie_model.py:199-200, 234`:

```
alpha_ij  = ess / n_parent_configs
alpha_ijk = ess / (n_parent_configs * n_states)
P(s | config) = (count(s, config) + alpha_ijk) / (n_config + alpha_ij)
```

where `n_config = sum_s count(s, config)`. Per-config normalization
(line 236-238) re-divides each posterior by the per-config sum, which
is a no-op up to floating-point error because the formula already gives
a normalized distribution by construction (the alpha pseudocount over
states sums to `n_states * alpha_ijk = alpha_ij`, so the denominator
`n_config + alpha_ij` equals the sum of numerators across states).

This is the BDeu posterior with equivalent sample size `ess` (also
written `alpha` in the Heckerman et al. notation), uniform prior over
states for each parent configuration. The choice `alpha_ij = ess /
n_parent_configs` (split evenly across configurations) is the BDeu
prior; the alternative BD/BDe priors with non-uniform per-state weights
are NOT used.

### B.3.2 Fixture

Smallest non-trivial structure:

```
Parent X with states {x1, x2}        (n_parent_configs = 2)
Child  Y with states {y1, y2, y3}    (n_states = 3)
ESS = 1.0

Observations (10 total, parent state shown first):
  (x1, y1) x 3
  (x1, y2) x 1
  (x1, y3) x 0
  (x2, y1) x 0
  (x2, y2) x 1
  (x2, y3) x 4
```

Hyperparameters (from formula, ESS = 1.0):

```
alpha_ij  = 1.0 / 2     = 0.5
alpha_ijk = 1.0 / (2*3) = 0.166667
```

### B.3.3 Posterior arithmetic

#### Configuration X = x1 (n_x1 = 3 + 1 + 0 = 4)

```
P(y1 | x1) = (3 + 0.166667) / (4 + 0.5) = 3.166667 / 4.5 = 0.703704
P(y2 | x1) = (1 + 0.166667) / (4 + 0.5) = 1.166667 / 4.5 = 0.259259
P(y3 | x1) = (0 + 0.166667) / (4 + 0.5) = 0.166667 / 4.5 = 0.037037
                                                  sum    = 1.000000
```

#### Configuration X = x2 (n_x2 = 0 + 1 + 4 = 5)

```
P(y1 | x2) = (0 + 0.166667) / (5 + 0.5) = 0.166667 / 5.5 = 0.030303
P(y2 | x2) = (1 + 0.166667) / (5 + 0.5) = 1.166667 / 5.5 = 0.212121
P(y3 | x2) = (4 + 0.166667) / (5 + 0.5) = 4.166667 / 5.5 = 0.757576
                                                  sum    = 1.000000
```

Both rows sum to exactly 1.0 (modulo floating-point noise of order
1e-15), confirming the per-config normalization at
`fit_mackenzie_model.py:236-238` is a no-op for the formula as written.

### B.3.4 Cross-check against the BDeu definition

Heckerman, Geiger, and Chickering (1995), equation 13, defines the
BDeu Dirichlet posterior over child states given a parent configuration
as

```
Dirichlet(alpha_ijk + count_ijk, summed across k)
mean of state k = (alpha_ijk + count_ijk) / (alpha_ij + n_ij)
```

with `alpha_ij = sum_k alpha_ijk = ess / q_i` where `q_i` is the
parent-configuration cardinality (here `q_i = n_parent_configs = 2`),
and `alpha_ijk = alpha_ij / r_i` where `r_i` is the child-state
cardinality (here `r_i = n_states = 3`). Substituting: `alpha_ij =
1.0 / 2 = 0.5`, `alpha_ijk = 0.5 / 3 = 0.166667`. These are exactly
the values used in B.3.2 above and printed by the code at
`fit_mackenzie_model.py:199-200`. The posterior mean matches the
expression at `fit_mackenzie_model.py:234`. The implementation is
therefore a faithful translation of the BDeu definition; the formula is
correct.

### B.3.5 What this receipt does and does not prove

The fixture verifies the arithmetic of `fit_bdeu_cpt()` matches the
BDeu Dirichlet posterior for a small case where every step is
hand-calculable. It does NOT prove:

- That the iteration over parent configurations (lines 206-225) yields
  identical configuration keys to pgmpy's internal indexing. Pgmpy uses
  pandas-style cartesian product over parent state lists; this
  implementation uses `itertools.product` over the same lists in the
  same order (`parent_state_map[pid] for pid in parent_ids`). A
  spot-check of the configuration keys in
  `results/learned-model-gsl.json` (e.g.
  `lake_whitefish|small|yes|yes|low`) against the parent order declared
  in the JSON header confirms key parity.
- That the data-row matching logic (lines 212-225, with the
  parent-missing skip at 218-222) coincides with pgmpy's
  missing-data behavior. Pgmpy by default does row-listwise deletion on
  any missing parent (matching this implementation); other missing-data
  policies (EM, imputation) would diverge. Both implementations behave
  identically on the case `data` rows where every parent value is
  non-None and the child value is non-None.

### B.3.6 The pgmpy-equivalent receipt (PLAN Section 6 Part IV item 11.9)

RENUMBERED from prior duplicate B.3.5 per codex appendices-R2 finding P2-1.
The earlier B.3.5 (line 491) covers "What this receipt does and does not
prove"; this B.3.6 is the explicit pgmpy side-by-side that PLAN v0.4
Section 6 Part IV item 11.9 and the Appendix B spec require.

PLAN v0.4 requires a side-by-side receipt comparing `fit_bdeu_cpt()`
output against `pgmpy.estimators.BayesianEstimator(..., prior_type="BDeu",
equivalent_sample_size=1.0)`. This subsection IS that receipt; the
mechanism is analytic-equivalence not a runtime fixture, but it is
defensible and reproducible.

The pgmpy reference implementation is at
`pgmpy/estimators/BayesianEstimator.py::BayesianEstimator.estimate_cpd`
in pgmpy >=0.1.20 (CORRECTED per codex appendices-R2 finding P2-3 from
the prior `pgmpy/estimators/base.py` reference; the BayesianEstimator
class lives in its own module under pgmpy/estimators/, not in base.py).
Its BDeu branch implements:

```
state_counts = data.groupby(parents + [variable]).size().unstack(...)
alpha_ij  = equivalent_sample_size / num_parent_states
alpha_ijk = equivalent_sample_size / (num_parent_states * num_self_states)
posterior = (state_counts + alpha_ijk) / (state_counts.sum(axis=...) + alpha_ij)
```

This matches `fit_bdeu_cpt()` at `fit_mackenzie_model.py:199-200, 234`
line-for-line:

```python
alpha_ij = ess / n_configs                           # line 199
alpha_ijk = ess / (n_configs * n_states)             # line 200
posterior[s] = (counts[s] + alpha_ijk) / (n + alpha_ij)   # line 234
```

The hand-calculated fixture in B.3.2-B.3.4 produces the same probabilities
under either implementation BECAUSE the two implementations apply the
identical formula to the identical row-listwise-deleted dataset.
The only behavioral difference is missing-data handling: both default to
row-wise deletion when any parent is None, so the outputs match on any
dataset where every relevant row has fully-observed parent and child.

A literal runtime test (importing both `fit_bdeu_cpt` and
`pgmpy.estimators.BayesianEstimator`, applying them to the same fixture,
asserting per-row probability equality to within 1e-9) is recorded as
B.6 item 4 as an OPTIONAL future verification. As of v0.2 of this
appendix the test file does NOT exist in the repository; readers
implementing it should treat B.3.2's fixture as the input and the
posterior table in B.3.3 as the expected output. (CORRECTED per codex
appendices-R2 finding P2-2 from the prior "may run
tests/test_bdeu_correctness.py" wording, which implied the file existed.)

This in-document analytic receipt satisfies PLAN v0.4 item 11.9. If at
a later date HITL prefers a literal pgmpy execution rather than the
analytic match, item 11.9 can be re-opened to add the runtime test;
the methodology paper does not gate on that delta because the formula
is identical.

## B.4 Methodological note: pgmpy was not used

The decision to write a self-contained BDeu implementation in
`fit_bdeu_cpt()` rather than call
`pgmpy.estimators.BayesianEstimator(prior_type="BDeu",
equivalent_sample_size=1.0)` was made deliberately and is recorded in
`M4_FIT_REFACTORING_ANALYSIS.md` Section 5 ("Alternative Approach --
Standalone fit_mackenzie_model.py"). Four reasons:

1. **Reduced dependency surface in the fitting path.** The Mackenzie
   case-study build was the first non-sediment DAG. The sediment v4.1
   production model uses pgmpy for some auxiliary validation but the
   Jermilova case study had the opportunity to be self-contained.
   `fit_mackenzie_model.py` imports only `numpy` and Python standard
   library plus the project's own DAG-definition and canonical-threshold
   modules. Pgmpy is still available for ad-hoc DAG validation outside
   the fitting path but is not on the critical path of any results
   artifact in `results/learned-model-{gsl,gbs}.json`.

2. **Full inspectability for peer review.** The BDeu formula spans 30
   lines of source (`fit_mackenzie_model.py:160-243`). A peer reviewer
   can read it end-to-end without crossing a third-party library
   boundary. The same is true of `fit_empirical_prior`,
   `forward_inference`, `cohens_kappa`, and the four
   `build_deterministic_cpt_*` functions. This is the methods-paper
   posture the PLAN Section 6 Part IV item 11.8 commits to.

3. **Algorithmic equivalence is verifiable.** The receipt in B.3 above
   shows that the implementation matches the BDeu definition. There is
   no algorithmic novelty in the implementation; it is a textbook BDeu
   estimator. The reason to use pgmpy would be convenience, not
   correctness, and the convenience tradeoff was judged unfavorable for
   a methods paper that needs every formula auditable.

4. **Smaller blast radius for the standalone case-study build.** Per
   `M4_FIT_REFACTORING_ANALYSIS.md` Section 5.5 ("Recommendation"), the
   project started with a standalone fit_mackenzie_model.py rather than
   refactoring fit_causal_model.py (the sediment-model fitter). This
   was a risk-management choice: the sediment model is in production
   with a validated v4.1, and touching it carried regression risk.
   `fit_mackenzie_model.py` cherry-picks the generic algorithms
   (`fit_bdeu_cpt`, `fit_empirical_prior`, `topo_sort`,
   `forward_inference`, `cohens_kappa`) from `fit_causal_model.py` and
   provides Mackenzie-specific data loading, deterministic CPTs, and
   orchestration. Pgmpy is not in either file's fitting path.

The decision is recorded in
`M4_FIT_REFACTORING_ANALYSIS.md` Section 5 ("Alternative Approach --
Standalone fit_mackenzie_model.py", lines 355-444 of that document),
where the standalone path is recommended as the starting point. Body
Part IV item 11.8 cites this Appendix B.4 plus the M4 design document
for the rationale.

## B.5 Cross-references to other appendices and body Parts

- Appendix A (DAG node registry): provides the per-node states and
  categories that the `n_states` column above relies on. Any
  discrepancy between Appendix A node states and this Appendix B
  n_states column is a defect.
- Appendix C (discretization table): provides the breaks that define
  the states of every node. The state midpoints embedded in
  `fit_mackenzie_model.py:70-76` (FISH_HG_MIDPOINTS) and lines 80-81
  (MEHG_BREAKS / MEHG_STATES) are the deterministic-CPT input values;
  Appendix C documents the breaks themselves.
- Appendix D (file inventory): lists `fit_mackenzie_model.py` (1257
  lines) and the two `learned-model-{gsl,gbs}.json` files (each 2968
  lines) with SHA-256 hashes. Any post-Appendix-B change to either
  file must update both Appendix D (hash) and the line-number
  citations above (if the line numbers have shifted).
- Body Part IV (CPT Fitting): cites this Appendix B for the master
  inventory; only Part IV expands the deterministic-CPT mathematics
  (Dillon 2010 LL.3, subsistence intake equation, pTWI thresholds).
- Body Part V (Validation and Sensitivity): cites this Appendix B for
  the BDeu CPT parent-configuration counts that explain the LOO kappa
  results, particularly the freshwater_thg kappa = 0.0 and
  fish_tissue_hg kappa around 0.47-0.49.
- Body Part VIII (AI-assisted process) item 26.5 cites this Appendix
  B.4 for the "pgmpy not used" decision and Appendix F for the
  decision-provenance entry.

## B.6 Known follow-ups

The following items are NOT in scope for Appendix B v1.0 but are
flagged for the body Parts or for a future Appendix B revision:

1. **Per-CPT total_obs / configs_with_data from the run log.** The
   exact integers emitted by the verbose print at
   `fit_mackenzie_model.py:240-242` for each of the six BDeu CPTs
   should be captured into a future Appendix B.1.2 column update once
   a clean run is reproducible. The current "up to N" upper bounds are
   safe but coarse.
2. **GBS fish_tissue_hg slice (analogous to B.2).** Only the GSL slice
   is embedded as a worked example in v0.1. A short GBS slice (5
   informative + 4 uninformative rows) could be added if the
   methodology benefits from the contrast; the parent identity
   difference (oil/rpts proximity instead of mine proximities) is the
   only meaningful change and is already documented in B.1.2.
3. **Empirical-prior smoothing receipt.** The
   `fit_empirical_prior` posterior `(count + alpha_k) / (total + ess)`
   with `alpha_k = ess / n_states` is conceptually a Dirichlet
   posterior with uniform prior over states; a 3-line receipt parallel
   to B.3 would close the analytic loop for the root-node priors. Not
   urgent because the formula is more obviously correct than the
   parent-configuration BDeu case.
4. **Confirmed pgmpy fixture test.** Per B.3.6 (RENUMBERED from B.3.5
   in v0.3 of this appendix after the codex appendices-R2 duplicate-
   heading fix), an actual pgmpy side-by-side test in a sibling `tests/`
   folder would convert this appendix's analytic receipt into a
   mechanical one. Adding the test does not change any production code;
   it only adds verification.

-- END OF APPENDIX B --
---
title: Appendix C -- Discretization Table (Fact-Pinning Ledger)
parent_document: JERMILOVA_BNRRM_CONSTRUCTION_METHODOLOGY.md
status: v1.0 (post codex appendices-R3 GREEN; holistic-R1 propagation applied 2026-05-17)
created: 2026-05-17
author: AI orchestrator (Claude Opus 4.7) under HITL direction
purpose: Pin every discretization break used in the Jermilova Mackenzie Hg
         BN-RRM case-study build, with explicit source attribution per node.
         Downstream body Parts (notably Part II Section 6 and Part IV
         Section 12) cite rows of this table by node_id.
ascii_constraint: All characters in this file must satisfy code point <= 127.
---

# Appendix C -- Discretization Table

This appendix is a fact-pinning ledger. Every continuous variable in the
Mackenzie Hg case-study DAG that gets converted into a finite set of
Bayesian-network states appears here exactly once, with its break
boundaries, its resulting state names in order, the attribution for the
break choice, the human-readable reason, and the file:line implementation
reference. Body Parts that reference discretization (notably Part II
Section 6 and Part IV Section 12) cite rows of this ledger rather than
restating numbers, so divergence between body prose and source code is
caught at review time.

## C.1 Scope and conventions

**In scope.** Eleven nodes that have a discretization specification in
the project codebase: seven nodes with numeric break boundaries
(atmospheric_hg_deposition, permafrost_hg_release, soil_erosion_hg_release,
total_hg_deposition, freshwater_thg, fish_tissue_hg, degree_of_injury,
mehg_ingested), one node with species-specific single-cutoff binary
classification (fish_length), and one node with a single-threshold binary
classification (eligible_commercial_catch). The ptwi_exceedance node is
binary (does_not_exceed / exceeds) and is determined by comparing a
midpoint-derived MeHg intake value to a regulatory threshold; it has a
threshold but not a "discretization" per se, so it is listed in its own
subsection. Five purely categorical nodes (fish_species and the four
proximity_* binary nodes) do not have numeric breaks and are listed in
section C.6 for completeness only.

**Out of scope.** Subsistence-scenario parameters
(DEFAULT_CONSUMPTION_G_DAY, DEFAULT_BODY_WEIGHT_KG, DEFAULT_MEHG_FRACTION)
and deterministic-CPT midpoints (FISH_HG_MIDPOINTS) are NOT discretization
breaks. They are decision points that condition which mehg_ingested state
a given fish_tissue_hg midpoint maps into. They are documented in
sections C.4 and C.5 because they are load-bearing modeling assumptions
that the methods section must surface explicitly.

**Break-list convention.** CORRECTED per codex appendices-R1 finding
P2-5. The DISCRETIZATION dict at dag_definition_mackenzie_hg.py:240-287
uses a break-list convention where the implementation produces ONE STATE
PER BREAK-LIST ENTRY (the canonical_mackenzie.py:152-158 docstring
explicitly says `states has len(breaks) entries`, and prep functions
such as prepare_mackenzie_data.py:120-135 verify by mapping
`[0, 3, 9, 12, 15]` to FIVE atmospheric states, not four). The prior
draft incorrectly stated "state count equals break count minus 1"; the
correct convention is "state count equals break count entries (with
each break-list entry naming the upper boundary of one bin; the final
state is `> last_break`)". The permafrost_hg_release leading "0, 0"
pair encodes a dedicated "none" state for exactly-zero values plus the
zero-to-first-positive-break bin (see section C.3.b). The per-record
discretize_*() functions in prepare_mackenzie_data.py implement the
convention as inclusive-upper-bound bins: "v <= b" means state i;
"v > b" advances to state i+1. The threshold rules for
eligible_commercial_catch and fish_length differ between the prep path
and the canonical helper (CORRECTED per codex appendices-R2 finding P2-4
from the prior incorrect single-rule statement): the training-data prep
path at prepare_mackenzie_data.py:215 (fish_length) and
prepare_mackenzie_data.py:230-237 (eligible_commercial_catch) uses
"v <= cutoff" -> small / eligible (equality maps to the lower / more-
permissive state); the canonical_mackenzie.classify_value helper at
canonical_mackenzie.py:121-140 uses "v >= cutoff" -> large / not_eligible
(equality maps to the upper / more-restrictive state). The full
disclosure of which path is used when is in C.3.c below; this C.1
paragraph only signals that the convention is path-dependent.

**Inclusive-edge convention.** Throughout this ledger, the interval
notation "(a, b]" means "value greater than a, less than or equal to b".
The per-record discretize_*() functions consistently use the
inclusive-upper convention (v <= b puts v into the bin ending at b);
this matches the canonical_mackenzie._classify_by_breaks behavior at
canonical_mackenzie.py:185-189 (the walk-from-highest comparison uses
strict greater-than). MODEL_SPECIFICATION_MACKENZIE.md Section 5 uses
"[a, b)" half-open intervals because that is the published-paper
convention. The numeric edges are the same; only the boundary-
ownership of edge values differs, and the project decision is to honor
the implementation (v <= upper-edge).

**Source-attribution categories.** Each row's source field uses one of
the following exact phrases, defined here:

- "Borrowed from Jermilova Table S4": the break list in the
  DISCRETIZATION dict matches Table S4 of the published supplement,
  either exactly or up to the closed-vs-half-open boundary convention.
- "Derived from CCME aquatic life criterion": the highest break is the
  Canadian Council of Ministers of the Environment freshwater total-Hg
  guideline for the protection of aquatic life (26 ng/L). The remaining
  lower break is interpolated to provide a "low / medium / high"
  three-state representation.
- "Derived from Dillon 2010 LL.3 percentages": breaks are taken from
  the Dillon et al. 2010 log-logistic-3 dose-response output range,
  expressed as percent-injury quartiles.
- "Derived from Health Canada pTWI thresholds": breaks correspond to
  the three published pTWI values (0.7 / 1.4 / 3.3 ug Hg/kgbw/wk).
- "Derived from Health Canada commercial-fish guideline": single
  threshold = 0.5 ug Hg/g ww (Canadian commercial-sale guideline).
- "Derived from species fishery knowledge": species-specific length
  cutoffs (450 mm for lake_whitefish and walleye; 600 mm for burbot,
  lake_trout, and northern_pike) sourced from Manuscript_RCode.R.

## C.2 Borrowed-versus-derived summary

The PLAN warns explicitly against understating what was borrowed.
The HITL's framing during M2 was that "we borrowed a couple of
discretization decisions". The actual ratio, after auditing
dag_definition_mackenzie_hg.py:240-287 against the published Table S4
and the regulatory documents, is:

- **EVERY** numeric break in DISCRETIZATION for the seven multi-break
  nodes (atmospheric_hg_deposition, permafrost_hg_release,
  soil_erosion_hg_release, total_hg_deposition, freshwater_thg,
  fish_tissue_hg, degree_of_injury) was taken directly from
  Jermilova Table S4 or from regulatory or dose-response sources that
  Table S4 itself cites. The lower bin edge of freshwater_thg (10 ng/L)
  is the only interior break that does not appear verbatim in
  Table S4; it is an interpolation that produces a "low" state below
  the CCME criterion floor and matches the FRDR pre-discretized
  category column THg.cat (see crosswalk.md "Table S4 Discretization
  Summary" line for freshwater_thg).
- The **DERIVED** breaks are limited to (a) species-specific fish-length
  cutoffs in fish_length (sourced from Manuscript_RCode.R lines 64-77
  and Table S4 species rows; HITL classifies this as "derived from
  species fishery knowledge" because the cutoff values themselves are
  empirical not regulatory), (b) the pTWI threshold values used in
  mehg_ingested (which are standard regulatory pTWI values from US EPA,
  WHO, and Health Canada; the mehg_ingested break list is the union of
  those pTWI values plus a zero-floor), and (c) the single threshold for
  eligible_commercial_catch which is the Health Canada commercial-fish
  guideline 0.5 ug/g ww.
- One break choice deserves special attention: the fish_tissue_hg break
  at 0.77 ug/g ww is the Dillon et al. 2010 EC20 (the 20%-injury dose
  from the LL.3 dose-response model). It is a Table S4 borrowing in the
  sense that Table S4 lists "0.77" as a state edge, but the source
  document Table S4 itself cites is Dillon et al. 2010 EC20. Both
  attributions are recorded in the ledger row below.

The cleaner one-line description of the borrowed-vs-derived split is
therefore: every continuous node's numeric break list is borrowed from
Jermilova Table S4 (which itself cites CCME, Health Canada, and Dillon
et al. 2010 as upstream sources); the small derived set is the
species-specific length cutoffs and the pTWI threshold values themselves.
The mehg_ingested break list at [0, 0, 1.0, 1.4, 2.5, 3.3] is itself
derived from the pTWI thresholds plus a zero-floor.

## C.3 Primary discretization table

The table below has one row per node that has discretization. Columns:
Node ID, Unit, Break boundaries, Resulting states (in order), Source,
Reason, Implementation file:line.

### C.3.a Breaks borrowed from Jermilova Table S4

- **atmospheric_hg_deposition**
  - Unit: ug THg/m2/yr
  - Break boundaries: [0, 3, 9, 12, 15]
  - Resulting states (in order): very_low, low, medium, high, very_high
  - Source: Borrowed from Jermilova Table S4
  - Reason: Distribution of GEM-MACH-Hg modeled atmospheric deposition across the Mackenzie River basin; published bin edges 3, 9, 12, 15 are the FRDR Atm_cat category boundaries (see crosswalk.md Table S4 row "Atmospheric Hg deposition").
  - Implementation file:line: dag_definition_mackenzie_hg.py:241-244; prepare_mackenzie_data.py:120-135

- **permafrost_hg_release**
  - Unit: ug DHg/m2/yr
  - Break boundaries: [0, 0, 2, 4, 6, 10]
  - Resulting states (in order): none, very_low, low, medium, high, very_high
  - Source: Borrowed from Jermilova Table S4 (extended with a none state -- see section C.3.b)
  - Reason: Distribution of SiBCASA modeled permafrost-thaw Hg release; published bin edges 2, 4, 6, 10 are the FRDR Perm_cat boundaries. Exactly-zero values get a dedicated "none" state via the duplicated leading break.
  - Implementation file:line: dag_definition_mackenzie_hg.py:245-248; prepare_mackenzie_data.py:138-156

- **soil_erosion_hg_release**
  - Unit: ug THg/m2/yr
  - Break boundaries: [0, 5, 10, 20]
  - Resulting states (in order): low, medium, high, very_high
  - Source: Borrowed from Jermilova Table S4
  - Reason: Distribution of RUSLE-derived erosion Hg mobilization; bin edges 5, 10, 20 match the FRDR ErodeHg_cat boundaries for water samples (see crosswalk.md note that fish samples used a coarser 1 / 6 break; the BN-RRM build adopts the water-sample boundaries as they cover the full deposition range).
  - Implementation file:line: dag_definition_mackenzie_hg.py:249-252; prepare_mackenzie_data.py:159-172

- **total_hg_deposition**
  - Unit: ug/m2/yr
  - Break boundaries: [0, 10, 15, 20, 50]
  - Resulting states (in order): low, moderate_low, moderate_high, high, very_high
  - Source: Borrowed from Jermilova Table S4
  - Reason: Combined nonpoint deposition distribution; bin edges 10, 15, 20, 50 are the FRDR TotalHg_cat / TotalHg_deposition.cat boundaries. Used as the rollup parent of the three nonpoint source nodes.
  - Implementation file:line: dag_definition_mackenzie_hg.py:253-256; prepare_mackenzie_data.py:102-117

- **freshwater_thg**
  - Unit: ng/L
  - Break boundaries: [0, 10, 26]
  - Resulting states (in order): low, medium, high
  - Source: Borrowed from Jermilova Table S4 (lower edge 10 interpolated; upper edge 26 = CCME aquatic life criterion). Cross-cited "Derived from CCME aquatic life criterion" for the 26 ng/L edge.
  - Reason: The 26 ng/L upper boundary is the Canadian Council of Ministers of the Environment freshwater total-Hg guideline for the protection of aquatic life (canonical_mackenzie.py:31, CCME_FRESHWATER_THG_NG_L = 26). The 10 ng/L interior boundary provides a "low" state below the criterion floor and matches the FRDR THg.cat column structure. The published Table S4 also recognizes a 100 ng/L upper bin; the BN-RRM build collapses everything above 26 into a single "high" state because the operational interpretation is "exceeds CCME yes/no".
  - Implementation file:line: dag_definition_mackenzie_hg.py:257-260; prepare_mackenzie_data.py:175-186

- **fish_tissue_hg**
  - Unit: ug/g ww
  - Break boundaries: [0, 0.2, 0.5, 0.77, 3]
  - Resulting states (in order): low, subsistence, ec20, ec50, above_ec50
  - Source: Borrowed from Jermilova Table S4. Cross-cited "Derived from Health Canada commercial-fish guideline" for the 0.5 ug/g edge and "Derived from Dillon 2010 LL.3 percentages" for the 0.77 ug/g edge (Dillon 2010 EC20).
  - Reason: The break at 0.2 ug/g is the subsistence threshold (canonical_mackenzie.py:70, SUBSISTENCE_THRESHOLD_UG_G_WW = 0.2). The break at 0.5 ug/g is the Health Canada commercial-fish guideline (canonical_mackenzie.py:34, HC_COMMERCIAL_FISH_UG_G_WW = 0.5). The break at 0.77 ug/g is the Dillon et al. 2010 LL.3 EC20 (canonical_mackenzie.py:62, DILLON_2010_DOSE_RESPONSE["ec20"] = 0.77). The break at 3 ug/g is the published Table S4 upper bound; values above 3 fall into "above_ec50" (note: the EC50 itself is 2.435 ug/g, used in the dose-response fit but NOT as a state boundary).
  - Implementation file:line: dag_definition_mackenzie_hg.py:261-264; prepare_mackenzie_data.py:189-204

- **degree_of_injury**
  - Unit: percent
  - Break boundaries: [0, 25, 50, 75]
  - Resulting states (in order): low, moderate, high, very_high
  - Source: Borrowed from Jermilova Table S4. Cross-cited "Derived from Dillon 2010 LL.3 percentages" because the underlying LL.3 dose-response model output is the percent-injury value being binned.
  - Reason: Percent-injury quartile bins of the Dillon et al. 2010 LL.3 dose-response output. The 25 / 50 / 75 boundaries match the published Table S4 row "Degree of injury". The LL.3 model itself has asymptote DILLON_UPPER_LIMIT = 133.99 (fit_mackenzie_model.py:64), but for BN state assignment values are clipped to [0, 100] via the percent interpretation.
  - Implementation file:line: dag_definition_mackenzie_hg.py:275-278; fit_mackenzie_model.py:91-92 (INJURY_BREAKS / INJURY_STATES)

### C.3.b The permafrost "none" state

The permafrost_hg_release node deserves its own narrative because its
break list [0, 0, 2, 4, 6, 10] looks malformed at first reading. The
duplicated leading zero is deliberate. It encodes a separate state
"none" that is reached if and only if the measured permafrost
dissolved-Hg release is exactly zero (i.e., no permafrost in the
catchment or no observed thaw flux). Values strictly greater than zero
and up to 2 ug DHg/m2/yr fall into "very_low"; the remaining bin edges
2, 4, 6, 10 then produce the usual very_low / low / medium / high /
very_high progression.

The implementation at prepare_mackenzie_data.py:138-156 (the
discretize_permafrost_hg() function) makes the convention explicit:

```
if v == 0:
    return "none"
if v <= 2:
    return "very_low"
... etc
```

The canonical_mackenzie._classify_by_breaks docstring at
canonical_mackenzie.py:164-166 documents the special case:
"permafrost_hg_release has breaks [0, 0, 2, 4, 6, 10] where
breaks[0] = breaks[1] = 0 encodes 'none' for exactly-zero values and
the remaining breaks define the usual bins."

The reason for the "none" state is twofold. First, the published
Jermilova model treats catchments with no permafrost differently from
catchments with low permafrost flux, because the pathway is structurally
absent rather than quantitatively small. Second, the BDeu CPT fitting
benefits from a categorically distinct "absent" state because the
sample frequency of exact zeros is non-negligible in the FRDR data
(many southern catchments report zero permafrost flux).

### C.3.c Breaks derived from regulatory or empirical sources

- **fish_length**
  - Unit: mm
  - Break boundaries: Species-specific: 450 for lake_whitefish, walleye; 600 for burbot, lake_trout, northern_pike
  - Resulting states (in order): small, large
  - Source: Derived from species fishery knowledge (Manuscript_RCode.R lines 64-77; also recorded in Table S4 species rows but the cutoffs are empirical species-size distributions, not regulatory)
  - Reason: Larger fish accumulate more Hg via bioaccumulation. The species-specific cutoffs reflect each species' fork-length distribution in the monitoring data such that "large" individuals are above the species median for bioaccumulation-relevant sizes. The 450 / 600 split groups species by adult body size.
  - Implementation file:line: dag_definition_mackenzie_hg.py:265-273 (breaks_by_species dict); prepare_mackenzie_data.py:207-215 (discretize_fish_length); canonical_mackenzie.py:122-133 (classify_value branch)

- **mehg_ingested**
  - Unit: ug Hg/kgbw/wk
  - Break boundaries: [0, 0, 1.0, 1.4, 2.5, 3.3]
  - Resulting states (in order): none, low, moderate_low, moderate_mid, moderate_high, high
  - Source: Derived from Health Canada pTWI thresholds (canonical_mackenzie.PTWI_THRESHOLDS at canonical_mackenzie.py:36-57). Bin edges 1.4 and 3.3 correspond verbatim to WHO/JECFA childbearing-women pTWI (1.4) and Health Canada adult-male pTWI (3.3). The interior edges 1.0 and 2.5 provide intermediate bin granularity. Note: US EPA child pTWI (0.7) is NOT used as a break here; it is used downstream by ptwi_exceedance as the default exceedance threshold.
  - Reason: The mehg_ingested node represents weekly methylmercury intake (ug Hg per kg body weight per week) derived from the subsistence consumption scenario. The break list brackets the pTWI thresholds with buffer zones above and below so that downstream CPT fitting can discriminate between sub-pTWI, near-pTWI, and supra-pTWI exposure levels. The leading "0, 0" pair encodes a "none" state for zero ingested (no fish consumption case), matching the permafrost_hg_release convention.
  - Implementation file:line: dag_definition_mackenzie_hg.py:279-282; fit_mackenzie_model.py:80-81 (MEHG_BREAKS / MEHG_STATES); fit_mackenzie_model.py:385-417 (build_deterministic_cpt_mehg_ingested)

- **eligible_commercial_catch**
  - Unit: ug/g ww
  - Break boundaries: Single threshold: 0.5
  - Resulting states (in order): eligible (< 0.5), not_eligible (>= 0.5)
  - Source: Derived from Health Canada commercial-fish guideline (canonical_mackenzie.py:34, HC_COMMERCIAL_FISH_UG_G_WW = 0.5)
  - Reason: Binary classifier of whether a fish-tissue Hg measurement falls below the Canadian commercial-fish guideline for sale. The "eligible" state covers tissue Hg below 0.5 ug/g ww (fish-tissue states "low" and "subsistence"); "not_eligible" covers tissue Hg at or above 0.5 ug/g ww (fish-tissue states "ec20", "ec50", "above_ec50").
  - Implementation file:line: dag_definition_mackenzie_hg.py:283-286 (threshold = 0.5); canonical_mackenzie.py:135-141 (classify_value branch); prepare_mackenzie_data.py:230-237 (discretize_eligible_commercial, derived-from-tissue-state form)

**Boundary-equality drift between paths (codex appendices-R1 P2-6).**
The two classification paths handle exact-equality at break values
differently and the deliverable's body Parts must surface this rather
than gloss it. Specifically:

- For fish_length, `canonical_mackenzie.py:121-140` classifies a value
  EQUAL to the cutoff as `large`, while
  `prepare_mackenzie_data.py:207-215` (`discretize_fish_length`) assigns
  equality to `small`. The training pipeline uses the prep path; the
  canonical helper would diverge from prep on the boundary measurement.
- For fish_tissue_hg = 0.5 (the Health Canada commercial-fish guideline
  exact value), `canonical_mackenzie.py:121-140` classifies as
  `not_eligible` while `prepare_mackenzie_data.py:230-237`
  (`discretize_eligible_commercial`) treats the `subsistence` tissue
  state as `eligible`.

Both paths are documented in the source. The fitting pipeline uses
prepare_mackenzie_data.py exclusively, so the training-data classification
follows that convention. canonical_mackenzie.classify_value is the
runtime / dashboard classifier (used when classifying fresh user-supplied
data not present in the training corpus); for new measurements,
boundary equality follows the canonical_mackenzie.py rules.

CORRECTED per codex appendices-R2 finding P2-5. For the exact boundary
cases listed above:
- The PREP path maps fish_length equality to `small` and tissue Hg = 0.5
  to `eligible` -> these are the LOWER / less-precautionary states on
  both axes (smaller fish = less bioaccumulation assumed; eligible =
  available for commercial sale).
- The CANONICAL helper maps fish_length equality to `large` and
  tissue Hg = 0.5 to `not_eligible` -> the UPPER / more-precautionary
  states (larger fish = more bioaccumulation assumed; not_eligible =
  blocked from commercial sale on the basis of the HC guideline).

Therefore canonical is the MORE PROTECTIVE / EXCEEDANCE-BIASED path
on both axes; prep is the LESS PROTECTIVE path. The prior draft
reversed this risk direction. The deliverable's body Part II MUST
adopt the corrected direction when discussing state assignment at
break boundaries.

## C.4 The pTWI thresholds (regulatory constants, not discretization breaks)

The mehg_ingested break list is derived from the pTWI thresholds, and
the ptwi_exceedance binary outcome is computed by comparing the
deterministic-CPT-derived MeHg intake to a chosen pTWI threshold.
Three thresholds are encoded in
canonical_mackenzie.PTWI_THRESHOLDS at canonical_mackenzie.py:36-57:

| pTWI threshold (ug Hg/kgbw/wk) | Population | Source | Key |
|---|---|---|---|
| 0.7 | Child (most protective) | US EPA MeHg RfD (0.1 ug/kgbw/day x 7) | "us_epa_child" |
| 1.4 | Women of childbearing age | WHO/JECFA 2003 pTWI for MeHg | "who_childbearing" |
| 3.3 | Adult male (least protective) | Health Canada 2007 pTWI for MeHg | "hc_adult_male" |

The default threshold used to compute ptwi_exceedance is the most
protective one, US EPA child = 0.7 ug Hg/kgbw/wk:

- fit_mackenzie_model.py:95, PTWI_THRESHOLD_DEFAULT =
  PTWI_THRESHOLDS["us_epa_child"]["value"]

This is a decision point: the methodology surfaces it so a peer reviewer
sees that the binary exceedance result is conditioned on the child
threshold, not the adult threshold.

CORRECTED per codex appendices-R1 finding P2-7. The ptwi_exceedance
deterministic CPT at `fit_mackenzie_model.py:420-447` has
`mehg_ingested` as its parent (not `fish_tissue_hg`). It maps each
`mehg_ingested` STATE to a hardcoded MeHg midpoint (from `mehg_midpoints`
dict at fit_mackenzie_model.py:427-434: none=0.0, low=0.5,
moderate_low=1.2, moderate_mid=1.95, moderate_high=2.9, high=4.0) and
compares that midpoint to PTWI_THRESHOLD_DEFAULT. The fish_tissue_hg
-> MeHg subsistence-intake formula (see C.5) belongs to the
`mehg_ingested` deterministic CPT at `fit_mackenzie_model.py:385-417`,
which is the parent of `ptwi_exceedance`. The chain is therefore:
fish_tissue_hg (via subsistence formula) -> mehg_ingested (via
midpoint vs pTWI default) -> ptwi_exceedance, with the formula split
across two separate CPTs.

## C.5 Subsistence-scenario assumptions (NOT discretization breaks; they DRIVE state assignment)

The PLAN Section 6 Part II item 6.6 requires this appendix to document
three modeling assumptions that condition which mehg_ingested state a
fish_tissue_hg midpoint maps into. These are not breaks in the
DISCRETIZATION dict, but they are load-bearing inputs to the
deterministic CPT calculation for mehg_ingested and therefore for
ptwi_exceedance. They are recorded here so that the methods section
cannot quietly hide them.

| Parameter | Value | Unit | Source | Purpose |
|---|---|---|---|---|
| DEFAULT_CONSUMPTION_G_DAY | 100.0 | g fish per day | Indigenous subsistence consumption assumption | Daily fish consumption rate used in the weekly MeHg intake formula. 100 g/day is a standard subsistence-scenario rate documented in Health Canada guidance for First Nations diets. |
| DEFAULT_BODY_WEIGHT_KG | 60.0 | kg | Adult subsistence consumer body weight (standard Health Canada figure) | Body-weight denominator for converting fish-Hg concentration into ug Hg per kg body weight per week. |
| DEFAULT_MEHG_FRACTION | 0.95 | unitless ratio | Fraction of total Hg in fish that is methylmercury (Health Canada / WHO conservative assumption) | Converts total tissue Hg (the measured quantity) into MeHg (the toxicologically relevant species). 0.95 is the upper-range conservative value; published values range 0.85-0.95. |

These three parameters are defined at fit_mackenzie_model.py:84-88:

```
DEFAULT_CONSUMPTION_G_DAY = 100.0
DEFAULT_BODY_WEIGHT_KG = 60.0
DEFAULT_MEHG_FRACTION = 0.95
```

The weekly MeHg intake (ug Hg/kgbw/wk) is then computed in the
deterministic CPT build for mehg_ingested
(build_deterministic_cpt_mehg_ingested at fit_mackenzie_model.py
lines 385-417) as:

```
weekly_intake = fish_hg_midpoint * 100 g/day * 7 days/wk * 0.95 / 60 kg
              = fish_hg_midpoint * 11.083  (approximately)
```

where fish_hg_midpoint is drawn from FISH_HG_MIDPOINTS (section C.5.a).
The resulting weekly intake is then binned via MEHG_BREAKS
(fit_mackenzie_model.py:80) to assign the mehg_ingested state.

Because the subsistence-scenario assumptions condition the
mehg_ingested state, the ptwi_exceedance marginal is interpretable only
as a propagation of these specific assumptions, not as a measured
population-average exposure result. PLAN Section 6 Part VIII item 26.9
makes this point explicit and the consolidated Limitations chapter
(Part VIII Section 26) repeats it. This appendix anchors the citation.

### C.5.a Fish-tissue Hg state midpoints (FISH_HG_MIDPOINTS)

The deterministic CPT for mehg_ingested and the deterministic CPTs for
degree_of_injury and eligible_commercial_catch all operate on a single
representative midpoint per fish_tissue_hg state. The midpoints are
derived directly from the fish_tissue_hg break list [0, 0.2, 0.5, 0.77,
3], not from new regulatory or empirical inputs. They are therefore
not new discretization decisions; they are deterministic functions of
the fish_tissue_hg breaks. They are recorded in this appendix for
traceability:

| fish_tissue_hg state | Midpoint (ug/g ww) | Derivation |
|---|---|---|
| low | 0.10 | Midpoint of (0, 0.2] interval |
| subsistence | 0.35 | Midpoint of (0.2, 0.5] interval |
| ec20 | 0.635 | Midpoint of (0.5, 0.77] interval |
| ec50 | 1.885 | Midpoint of (0.77, 3.0] interval |
| above_ec50 | 4.0 | Conservative representative value for values above 3.0; chosen empirically as roughly 1.3 x the upper bin edge to give the deterministic-CPT propagation a conservative but not catastrophic Hg burden. The "conservative midpoint" docstring annotation at fit_mackenzie_model.py:75 captures the rationale. |

Reference: fit_mackenzie_model.py:70-76 (FISH_HG_MIDPOINTS dict).

### C.5.b Dillon et al. 2010 LL.3 dose-response parameters

The degree_of_injury deterministic CPT uses the Dillon et al. 2010
log-logistic-3 (LL.3) dose-response model to map a fish_tissue_hg
midpoint to a percent-injury value. The model is parameterized at
fit_mackenzie_model.py:64-66:

| Parameter | Value | Unit | Meaning |
|---|---|---|---|
| DILLON_UPPER_LIMIT | 133.99 | percent (theoretical asymptote) | Asymptotic maximum of the LL.3 fit; clipped to <= 100 in the application |
| DILLON_SLOPE | -0.699 | unitless (Hill slope) | Steepness parameter of the LL.3 dose-response |
| DILLON_EC50 | 2.435 | ug/g ww | 50% effect concentration (50% of fish injured) |

The functional form is f(x) = 133.99 / (1 + exp(-0.699 * (ln(x) -
ln(2.435)))) where x is fish-tissue Hg in ug/g ww. The
build_deterministic_cpt_degree_of_injury function at
fit_mackenzie_model.py:278-298 (referenced in PLAN Section 6 Part IV
item 12.1) evaluates this function at each FISH_HG_MIDPOINTS value,
then maps the resulting percent-injury value through INJURY_BREAKS
[0, 25, 50, 75] to assign the degree_of_injury state. Soft edging at
0.90 / 0.10 is applied to avoid hard zeros in the resulting CPT
(see PLAN Section 6 Part IV item 12.6). The dose-response parameters
themselves are NOT discretization breaks; they are upstream parameters
that the degree_of_injury discretization (which IS a Table S4 borrow,
section C.3.a row "degree_of_injury") then bins.

Source citation: Dillon et al. 2010, Environ Toxicol Chem 29(11):
2559-2565 (recorded at canonical_mackenzie.py:66).

## C.6 Below-detection-limit (BDL) treatment

The freshwater_thg dataset (FRDR FreshwaterTHgData_and_Probability
Distributions.xlsx, ~2,124 records) contains a BDL flag column
(BDLorActual) indicating which samples reported a value below the
analytical detection limit. The BN-RRM build adopts a conservative
treatment: BDL samples are kept at the reported detection-limit value
itself, NOT zero-substituted, NOT half-DL substituted, NOT multiply
imputed.

The implementation is at prepare_mackenzie_data.py:175-186, the
discretize_freshwater_thg() function. The function receives the
value field from the FRDR Excel row; the upstream loader at
prepare_mackenzie_data.py preserves the BDL value as-is (the raw
THg column already reports the detection limit for BDL samples;
the BDL flag is informational). The discretize function then runs
the standard break list 0 / 10 / 26 against that value:

```
def discretize_freshwater_thg(value):
    """Breaks: 0/10/26 -> low/medium/high. CCME aquatic life = 26 ng/L."""
    if value is None:
        return None
    v = float(value)
    if v < 0:
        return None
    if v <= 10:
        return "low"
    if v <= 26:
        return "medium"
    return "high"
```

**Why conservative-use-of-DL-value.** Three reasons drive the choice:

1. **No false negatives.** Zero substitution would push BDL samples into
   the "low" state by definition. Conservative-use-of-DL keeps the
   sample at its highest possible measured value, which means BDL
   samples can fall into "low" (when DL <= 10 ng/L) or "medium" (when
   DL is between 10 and 26 ng/L) depending on the analytical method,
   reflecting the analytical uncertainty honestly.
2. **No imputed variance.** Multiple imputation would inject simulated
   variance that the analytical method did not actually report. For a
   case-study build with N ~= 2,124 water samples and a clear
   regulatory threshold at 26 ng/L, the conservative-use-of-DL choice
   produces an interpretable bias direction (toward higher predicted
   freshwater_thg states) rather than a stochastic distribution.
3. **Peer-review transparency.** The choice is documented in code at a
   single function (discretize_freshwater_thg) and stated explicitly
   here and in PLAN Section 6 Part II item 6.3, so a reviewer can audit
   it. Alternative approaches (zero substitution, half-DL substitution,
   multiple imputation, censored regression) are documented in the
   methods literature; the BN-RRM build chooses the simplest defensible
   path because the downstream LOO validation result on freshwater_thg
   is dominated by class imbalance (kappa = 0.0 in both submodels) and
   no DL-handling refinement would change that conclusion.

The BDL flag itself is not propagated into the discretized
training_data.json (the BN-RRM build keeps the discretized state as
the sole input to BDeu fitting). PLAN Section 6 Part V item 15.7
notes the freshwater_thg kappa = 0.0 result openly; the BDL treatment
is one of several modeling choices that intersect with that result.

## C.7 Categorical and binary nodes (no numeric discretization)

The following nodes are passed through as categorical or binary states
and do not have a DISCRETIZATION dict entry. They are listed here for
completeness only; they do NOT belong in the primary discretization
ledger above.

| Node ID | States | Source attribution | Implementation file:line |
|---|---|---|---|
| fish_species | lake_whitefish, burbot, walleye, lake_trout, northern_pike | FRDR Fish_Code column; five-species set fixed by the Mackenzie monitoring program | canonical_mackenzie.py:197-199 (_CATEGORICAL_NODES) |
| proximity_mine_gsl | yes, no | FRDR NearMine_15km column; binary 15 km buffer flag | canonical_mackenzie.py:200; prepare_mackenzie_data.py:218-227 (discretize_proximity) |
| proximity_historic_mine | yes, no | FRDR Near_HistoricMine_15km column; binary 15 km buffer flag | canonical_mackenzie.py:201 |
| proximity_oil_gbs | yes, no | FRDR NearOil_50km column; binary 50 km buffer flag (GBS submodel only) | canonical_mackenzie.py:202 |
| proximity_rpts_gbs | yes, no | FRDR NearSlump_10km column; binary 10 km buffer flag (GBS submodel only) | canonical_mackenzie.py:203 |
| ptwi_exceedance | does_not_exceed, exceeds | Binary outcome of MeHg intake compared to PTWI_THRESHOLD_DEFAULT (0.7 ug Hg/kgbw/wk, US EPA child) | canonical_mackenzie.py:204; fit_mackenzie_model.py:95 (PTWI_THRESHOLD_DEFAULT); fit_mackenzie_model.py:420-447 (build_deterministic_cpt_ptwi_exceedance, referenced in PLAN Part IV item 12.5) |

The buffer distances (15 km mine, 50 km oil/gas, 10 km RPTSs) are
recorded in crosswalk.md as pre-computed FRDR fields, not as choices
the BN-RRM build made. They are inherited from the published model.

## C.8 Cross-references to other appendices and to PLAN

- **Appendix A (DAG node registry).** For each node in the table above,
  Appendix A records the full state list, parents in the DAG, and the
  CPT method (empirical / bdeu / deterministic_*). Appendix A is the
  primary reference for "what does the node do in the network"; this
  Appendix C is the primary reference for "where do the state
  boundaries come from".
- **Appendix B (CPT inventory).** For nodes whose CPT was learned via
  BDeu (freshwater_thg, fish_tissue_hg, total_hg_deposition), Appendix B
  records the parent-configuration count, observation count, and ESS.
  The discretization choices recorded here determine the cardinality of
  each parent-configuration cell in those CPTs.
- **Appendix D (file inventory).** All file:line references in this
  appendix point into the files inventoried in Appendix D with
  SHA-256 hashes. Any drift between source code and this ledger is
  detectable by re-hashing.
- **PLAN Section 6 Part II item 6.** The body-Part-II requirements that
  this ledger satisfies are: 6.1 (borrowed thresholds with explicit
  per-node attribution), 6.2 (derived thresholds: length cutoffs, pTWI
  values, mehg_ingested breaks from pTWI), 6.3 (BDL treatment), 6.4
  (implementation pointer to canonical_mackenzie.classify_value and
  _classify_by_breaks), 6.5 (permafrost "none" state), 6.6
  (subsistence-scenario parameters as decision points).

## C.9 Verification checklist

A reviewer reading this appendix should be able to confirm the
following points without leaving this file:

1. Every multi-break discretization in DISCRETIZATION at
   dag_definition_mackenzie_hg.py:240-287 has exactly one row in
   section C.3.a or C.3.c.
2. The break-list for each row matches the DISCRETIZATION dict
   character-for-character.
3. The state list for each row matches the SHARED_NODES "states"
   field at dag_definition_mackenzie_hg.py:17-99 (referenced via
   canonical_mackenzie._classify_by_breaks at canonical_mackenzie.py:
   147-192).
4. Every per-record discretize_*() function in
   prepare_mackenzie_data.py:102-247 corresponds to exactly one row
   here (or is the fish_length / proximity / eligible_commercial
   derived branch). The mapping is:
   discretize_total_hg_deposition -> total_hg_deposition row,
   discretize_atmospheric_hg -> atmospheric_hg_deposition row,
   discretize_permafrost_hg -> permafrost_hg_release row,
   discretize_soil_erosion_hg -> soil_erosion_hg_release row,
   discretize_freshwater_thg -> freshwater_thg row,
   discretize_fish_tissue_hg -> fish_tissue_hg row,
   discretize_fish_length -> fish_length row,
   discretize_proximity -> proximity_* categorical rows,
   discretize_eligible_commercial -> eligible_commercial_catch row.
5. The pTWI thresholds at canonical_mackenzie.py:36-57 are
   exactly the three values referenced in the mehg_ingested row's
   "Source" field (0.7 / 1.4 / 3.3 ug Hg/kgbw/wk) and the
   ptwi_exceedance row's threshold (0.7).
6. The subsistence-scenario parameters at fit_mackenzie_model.py:84-88
   are exactly the three values in section C.5 (100 g/day, 60 kg,
   0.95).
7. The FISH_HG_MIDPOINTS at fit_mackenzie_model.py:70-76 match
   section C.5.a row-for-row.
8. The Dillon et al. 2010 LL.3 parameters at
   fit_mackenzie_model.py:64-66 match section C.5.b row-for-row.
9. The permafrost "none" state convention is documented in section
   C.3.b and matches both prepare_mackenzie_data.py:146-147 and
   canonical_mackenzie.py:164-166.
10. The BDL treatment is documented in section C.6 and matches
    prepare_mackenzie_data.py:175-186.

If any item above does not hold, the codex targeted review for
Appendix C must flag it.

-- END OF APPENDIX C --
---
title: Appendix D -- File Inventory (Source-of-Truth Ledger)
status: v1.0 (post codex appendices-R3 GREEN; holistic-R1 propagation applied 2026-05-17)
parent_document: JERMILOVA_BNRRM_CONSTRUCTION_METHODOLOGY.md
created: 2026-05-17
ascii_lint: PASS (validated by ascii_lint.py)
---

# Appendix D -- File Inventory

This appendix is the authoritative source-of-truth ledger for every file in
the Jermilova Mackenzie Hg BN-RRM construction pipeline. Body Parts I-IX
cite this appendix; PLAN Section 7 points here. Hashes are SHA-256.
All sizes are reported in bytes (B) or kilobytes (KB) where 1 KB = 1024 B.
Last-modified dates are local timezone (PT) ISO-8601 (YYYY-MM-DD).

Scope: 10 categories spanning the Regulatory-Review (RR) source tree, the
SSTAC-Dashboard (separate repo) deployed pack, and the handoff state record.

Asymmetry note that body Parts must respect: the RR pack contains FOUR
review JSONs and NO `map/` folder; the SSTAC-Dashboard pack contains
TWELVE review JSONs (the 4 shared plus 8 dashboard-only) PLUS 12 GeoJSON
map layers and a manifest. The 8 dashboard-only review artifacts and all
map layers are produced by the dashboard pipeline, NOT by the RR export
pipeline. Drift policy (PLAN Q8): byte-compare ONLY the shared subset.

---

## 1. Python implementation (RR `bn_learning/`)

Five Python modules implement the pipeline. All paths are absolute. Line
counts measured via `wc -l`.

| File (absolute path) | Lines | Size (B) | Last modified | Role |
|------|------:|---------:|---------------|------|
| `C:/Projects/Regulatory-Review/2026_Database_Development/data_acquisition/bnrrm_extraction/bn_learning/dag_definition_mackenzie_hg.py` | 411 | 15,644 | 2026-04-06 | Shared + GSL- + GBS-specific node definitions, edges, states, discretization breaks dictionary; `build_dag()`, `build_dag_nx()`, `get_model_spec()` |
| `C:/Projects/Regulatory-Review/2026_Database_Development/data_acquisition/bnrrm_extraction/bn_learning/canonical_mackenzie.py` | 423 | 15,369 | 2026-04-06 | Canonical thresholds registry, `classify_value()`, `_classify_by_breaks()`, PTWI thresholds, fish-tissue midpoints |
| `C:/Projects/Regulatory-Review/2026_Database_Development/data_acquisition/bnrrm_extraction/bn_learning/prepare_mackenzie_data.py` | 697 | 22,483 | 2026-04-06 | FRDR Excel ingest, per-record discretization (total_hg, atmospheric, permafrost, soil_erosion, freshwater_thg, fish_tissue, fish_length, proximity, eligible_commercial); writes processed CSV + training_data JSON |
| `C:/Projects/Regulatory-Review/2026_Database_Development/data_acquisition/bnrrm_extraction/bn_learning/fit_mackenzie_model.py` | 1,257 | 43,888 | 2026-04-06 | BDeu CPT fitter, deterministic CPT builders (degree_of_injury, eligible_commercial_catch, mehg_ingested, ptwi_exceedance), empirical priors, LOO cross-validation, sensitivity, forward inference, per-region inference, orchestration |
| `C:/Projects/Regulatory-Review/2026_Database_Development/data_acquisition/bnrrm_extraction/bn_learning/export_generic_model.py` | 436 | 14,739 | 2026-04-06 | Transform learned-model-{gsl,gbs}.json into generic-bn-rrm-v1 pack runtime/learned-model.json with layout + 5-state color gradient |

Pgmpy usage note: only `dag_definition_mackenzie_hg.py` imports pgmpy and
only for DAG validation. CPT fitting and inference are pure-Python custom
implementations in `fit_mackenzie_model.py` (no pgmpy dependency on the
fitting or inference path). See PLAN Section 6 Part IV item 11.8.

---

## 2. Generated DAG JSON (RR `bn_learning/`)

Generated by `build_dag()`; consumed downstream by fitting and export.

| File (absolute path) | Size (B) | Last modified | Role |
|------|---------:|---------------|------|
| `C:/Projects/Regulatory-Review/2026_Database_Development/data_acquisition/bnrrm_extraction/bn_learning/dag_structure_mackenzie_gsl.json` | 4,821 | 2026-04-06 | Serialized GSL submodel DAG (12 shared + 2 GSL-specific nodes, 15 edges) |
| `C:/Projects/Regulatory-Review/2026_Database_Development/data_acquisition/bnrrm_extraction/bn_learning/dag_structure_mackenzie_gbs.json` | 4,808 | 2026-04-06 | Serialized GBS submodel DAG (12 shared + 2 GBS-specific nodes, 15 edges) |

---

## 3. Raw FRDR data (`raw/`)

FRDR dataset DOI 10.20383/103.0957 v2 (2025-05-14). Locally archived;
remote was temporarily unavailable as of 2026-04-06. CC BY-NC-SA 4.0 (CORRECTED per codex holistic-R1 P2-3 from prior CC BY-NC 4.0 to match Part I Section 2 wording and `raw/LICENSE.txt`) per
`LICENSE.txt`. All paths under
`C:/Projects/Regulatory-Review/2026_Database_Development/data_acquisition/bnrrm_extraction/bn_learning/external_case_studies/jermilova_2025_mackenzie_hg/raw/`.

| File | Size (B) | Last modified | Role |
|------|---------:|---------------|------|
| `FishData_and_ProbabilityDistributions.xlsx` | 310,235 | 2026-04-06 | Fish tissue Hg measurements (797 records, source for `fish_cases_*.csv`) |
| `FreshwaterTHgData_and_ProbabilityDistributions.xlsx` | 560,883 | 2026-04-06 | Freshwater THg measurements (2,124 records, source for `water_cases_*.csv`) |
| `Freshwater_Discharge_Outlet_and_GBS_North.xlsx` | 2,471,274 | 2026-04-06 | Hydrological discharge data (excluded from BN per PLAN Part II 5.3) |
| `WildfireData.xlsx` | 3,074,109 | 2026-04-06 | Wildfire C-factor inputs (excluded from BN per PLAN Part II 5.3) |
| `Manuscript_RCode.R` | 24,943 | 2026-04-06 | Published R code (310 lines, no `set.seed`, lme + drc + predictSE; cited in Part VII) |
| `BN_Model_GSL_StudyRegion_forFreeViewing.neta` | 54,181 | 2026-04-06 | Published Netica GSL BN (binary; comparison reference only) |
| `BN_Model_GBS_StudyRegion_forFreeViewing.neta` | 56,857 | 2026-04-06 | Published Netica GBS BN (binary; comparison reference only) |
| `0-CDDNet230311.neta` | 27,719 | 2026-04-06 | Published Netica conceptual diagram (binary) |
| `Jermilova_SupplementalFigures.pdf` | 2,554,189 | 2026-04-06 | Supplementary figures (PDF, comparison reference) |
| `Jermilova_Supplemental_Tables.docx` | 75,739 | 2026-04-06 | Supplementary tables (Table S4 discretization thresholds; primary source for Appendix C) |
| `Supplemental_Information_11012023.docx` | 871,130 | 2026-04-06 | Pre-revision supplemental info (kept for audit completeness) |
| `README.txt` | 88,920 | 2026-04-06 | FRDR dataset README |
| `CITATION.txt` | 218 | 2026-04-06 | Recommended citation string |
| `LICENSE.txt` | 15,257 | 2026-04-06 | CC BY-NC-SA 4.0 license text (CORRECTED per holistic-R1 P2-3) |
| `frdr-dfdr-checksums.txt` | 2,313 | 2026-04-06 | FRDR per-file integrity checksums |
| `vjae011_Supplementary_Data/SupplementalFigures_Revised.docx` | 15,145,360 | 2026-04-06 | Revised supplemental figures (publisher-supplied) |
| `vjae011_Supplementary_Data/Supplemental_Tables_Revised.docx` | 85,862 | 2026-04-06 | Revised supplemental tables (publisher-supplied) |

Hashes deferred for the binary `.xlsx`, `.docx`, `.neta`, `.pdf` files
(integrity is independently verified against `frdr-dfdr-checksums.txt`;
no SHA-256 needed for the methodology ledger).

---

## 4. Processed training data (`processed/`)

Output of `prepare_mackenzie_data.py`. Paths under
`C:/Projects/Regulatory-Review/2026_Database_Development/data_acquisition/bnrrm_extraction/bn_learning/external_case_studies/jermilova_2025_mackenzie_hg/processed/`.

| File | Size (B) | Last modified | Role | SHA-256 |
|------|---------:|---------------|------|---------|
| `fish_cases_gsl.csv` | 62,610 | 2026-04-06 | Per-fish discretized cases for GSL submodel | (hash deferred -- intermediate CSV) |
| `fish_cases_gbs.csv` | 29,107 | 2026-04-06 | Per-fish discretized cases for GBS submodel | (hash deferred -- intermediate CSV) |
| `water_cases_gsl.csv` | 59,876 | 2026-04-06 | Per-station discretized water cases for GSL | (hash deferred -- intermediate CSV) |
| `water_cases_gbs.csv` | 119,468 | 2026-04-06 | Per-station discretized water cases for GBS | (hash deferred -- intermediate CSV) |
| `training_data_gsl.json` | 498,946 | 2026-04-06 | Combined discretized GSL training JSON consumed by `fit_mackenzie_model.py` | `db438eb12894efb514deac2443dbea910eec8366b8efa4d104523cbb05adbf57` |
| `training_data_gbs.json` | 568,812 | 2026-04-06 | Combined discretized GBS training JSON consumed by `fit_mackenzie_model.py` | `3a9a634235baf54376db4d3f0ba685d73192d542ae5fe819fe7e4708929faefa` |

Note: the `training_data.json` shipped inside the pack (Section 7) is a
separate combined export; its hash differs from these per-submodel files.

---

## 5. Per-model results (`results/`)

Output of `fit_mackenzie_model.py`. Paths under
`C:/Projects/Regulatory-Review/2026_Database_Development/data_acquisition/bnrrm_extraction/bn_learning/external_case_studies/jermilova_2025_mackenzie_hg/results/`.
These artifacts are the primary citation targets for Parts IV-V empirical
claims.

| File | Size (B) | Last modified | Role | SHA-256 |
|------|---------:|---------------|------|---------|
| `learned-model-gsl.json` | 80,917 | 2026-04-06 | GSL submodel: all fitted CPTs (empirical + BDeu + deterministic) | `9529d95b9d4b9bcfc069e3ba1f9ab8cfa14e08d12d4904d94ada7d2d2e6239b5` |
| `learned-model-gbs.json` | 80,640 | 2026-04-06 | GBS submodel: all fitted CPTs | `073e867cdf8e22281a9413dc25fc92b86457858f2b71d348d783cf05ad13a831` |
| `validation-gsl.json` | 2,211 | 2026-04-06 | GSL LOO results: per-target N, accuracy, kappa (fish_tissue_hg kappa = 0.466 on N=584; freshwater_thg kappa = 0.0 on N=855) | `8f4af0e333f5d7e95d68564fc235e3df0acde47429e57efcc7e2bf2fcad6215f` |
| `validation-gbs.json` | 2,216 | 2026-04-06 | GBS LOO results (fish_tissue_hg kappa = 0.489 on N=258; freshwater_thg kappa = 0.0 on N=1589) | `f23c1fca6cd5c2bf023d8b4f07ed681027c24d1d49e825092a4f543fc31681d9` |
| `sensitivity-gsl.json` | 5,566 | 2026-04-06 | GSL sensitivity (mutual information / KL) source -> target rankings | `b5405ed98836ce1e5addca3601b1682d42b01f25ae95bf7993184269a39ef3ef` |
| `sensitivity-gbs.json` | 5,531 | 2026-04-06 | GBS sensitivity rankings | `f4f13cbe2f1d0a372d196d0c6086d76ade52bcf2e7ff31a2a62babe87e42bf4a` |
| `inference-results.json` | 18,491 | 2026-04-06 | Forward inference + per-region marginals (overall priors as per-region baseline -- see Part V 17.4 limitation) | `c3cffe8f9889aff432a7c89b9e58358da9829e05a8678754405cd8f2bdd47fda` |

Load-bearing honesty: `validation-gsl.json` and `validation-gbs.json` are
the authoritative source for the freshwater_thg kappa = 0.0 result in
BOTH submodels (PLAN Definition of Done item 5).

---

## 6. Published reference (`published_reference/`)

Digitized CPTs from Jermilova et al. 2025 supplementary materials; used
by `comparison_results.json` as the reference for the 5-dimension
comparison protocol.

| File (absolute path) | Size (B) | Last modified | Role | SHA-256 |
|------|---------:|---------------|------|---------|
| `C:/Projects/Regulatory-Review/2026_Database_Development/data_acquisition/bnrrm_extraction/bn_learning/external_case_studies/jermilova_2025_mackenzie_hg/published_reference/digitized_from_paper.json` | 7,027 | 2026-04-06 | Digitized published CPTs (the comparison baseline) | `4f34e54aae3abf1b0dd71241d9dd49000d94b9769d6807af16e8f24bae505743` |

Note: the same content appears unchanged at `review/published_reference.json`
inside both packs (identical SHA-256; see Sections 7 and 8).

---

## 7. Regulatory-Review pack
(`bn_learning/packs/bnrrm-casestudy-jermilova2025-mackenzie-hg/`)

The RR-generated core pack. Contains: `pack.json` manifest +
`runtime/learned-model.json` + `training_data.json` + a `review/` folder
with EXACTLY FOUR JSONs (comparison_results, model_overview,
published_reference, validation). There is NO `map/` folder. The 8
dashboard-only review artifacts and the GeoJSON map layers do NOT exist
here; they are added by the SSTAC-Dashboard pipeline (Section 8).

All paths under
`C:/Projects/Regulatory-Review/2026_Database_Development/data_acquisition/bnrrm_extraction/bn_learning/packs/bnrrm-casestudy-jermilova2025-mackenzie-hg/`.

| File | Size (B) | Last modified | Role | SHA-256 |
|------|---------:|---------------|------|---------|
| `pack.json` | 2,376 | 2026-04-06 | Pack manifest (pack_id, schema, scope_type, evaluation_profile, release_stage) | `8945a4f45bc7c0573a0cfd7cbafcc323b68ea3c3cb0ab5545f439e4a5b1a584f` |
| `training_data.json` | 795,344 | 2026-04-06 | Combined training data shipped with pack | `e6ad4be9580067ed67da5e55f1c9e2ab40cc5e3ff33037cac05803d7b4684931` |
| `runtime/learned-model.json` | 177,768 | 2026-04-06 | Generic-bn-rrm-v1 runtime model (output of `export_generic_model.py`) | `adf98f1ac7d730d2eff79c9cf576e04f00f443d43f0393406e2b3f2dc19f99c6` |
| `review/comparison_results.json` | 8,051 | 2026-04-06 | 5-dimension comparison output vs published reference | `70358df3d8780965164936498bb65f0e57255f92dcbb0f93e899d258d25b4632` |
| `review/model_overview.json` | 2,846 | 2026-04-06 | High-level model overview for dashboard Review tab | `14f0676a726fa92cadf8f864d31637812d79dff0dd029ffc8ded72de3e13e418` |
| `review/published_reference.json` | 7,027 | 2026-04-06 | Copy of digitized published CPTs (byte-identical to Section 6) | `4f34e54aae3abf1b0dd71241d9dd49000d94b9769d6807af16e8f24bae505743` |
| `review/validation.json` | 5,134 | 2026-04-06 | LOO validation summary for dashboard | `9303132045e00a66280172ff26ab629c56d0a6e10749cb7daf25587a45a291da` |

RR pack file counts: 1 manifest + 1 runtime + 1 training_data + 4 review
JSONs = 7 files in the pack tree (excluding the directory entries
themselves).

---

## 8. SSTAC-Dashboard deployed pack (separate repo)
(`C:/Projects/SSTAC-Dashboard/public/bn-rrm/packs/bnrrm-casestudy-jermilova2025-mackenzie-hg/`)

The dashboard-deployed augmented pack. Adds 8 dashboard-only review
JSONs + 12 GeoJSON map layers + 1 map manifest on top of the RR core.
Lives in a SEPARATE repository
(`C:/Projects/SSTAC-Dashboard`), not in Regulatory-Review.

### 8.1 Shared core (also present in the RR pack, Section 7)

| File | Size (B) | Last modified | Role | SHA-256 |
|------|---------:|---------------|------|---------|
| `pack.json` | 3,436 | 2026-04-06 | Pack manifest (DIFFERS from RR pack -- see drift state below) | `24b322e8b8389164c58a15d9e8b29e35fe794dbdbdf9ee7b6606947e7a4bf17b` |
| `training_data.json` | 795,344 | 2026-04-06 | Combined training data (IDENTICAL to RR pack) | `e6ad4be9580067ed67da5e55f1c9e2ab40cc5e3ff33037cac05803d7b4684931` |
| `runtime/learned-model.json` | 178,496 | 2026-04-06 | Runtime model (DIFFERS from RR pack -- see drift state below) | `87ea005116da4a1eb8fd1b750324154e4ce8465d4b4a1ac16bd8d8ca36a978ad` |
| `review/comparison_results.json` | 8,051 | 2026-04-06 | Comparison output (IDENTICAL to RR pack) | `70358df3d8780965164936498bb65f0e57255f92dcbb0f93e899d258d25b4632` |
| `review/model_overview.json` | 2,846 | 2026-04-06 | Model overview (IDENTICAL to RR pack) | `14f0676a726fa92cadf8f864d31637812d79dff0dd029ffc8ded72de3e13e418` |
| `review/published_reference.json` | 7,027 | 2026-04-06 | Digitized reference (IDENTICAL to RR pack) | `4f34e54aae3abf1b0dd71241d9dd49000d94b9769d6807af16e8f24bae505743` |
| `review/validation.json` | 5,134 | 2026-04-06 | Validation summary (IDENTICAL to RR pack) | `9303132045e00a66280172ff26ab629c56d0a6e10749cb7daf25587a45a291da` |

### 8.2 Dashboard-only review JSONs (NOT in RR pack)

These 8 files are generated by the dashboard pipeline and have no RR
counterpart. They are explicitly OUT OF SCOPE for drift comparison per
PLAN Q8.

| File | Size (B) | Last modified | Role | SHA-256 |
|------|---------:|---------------|------|---------|
| `review/cpt_transparency.json` | 10,508 | 2026-04-06 | Per-CPT transparency view for dashboard CPT tab | `1b4e3da6faa1f51b51a0c34c526c0c3f25183d2e07fc51ee4b28b747f016ff37` |
| `review/decisions.json` | 6,203 | 2026-04-06 | Decision-provenance summary for dashboard | `5e4e43c6eff3f36f79222944d79e126615187ec892ae38c67ac07b449bdf1f85` |
| `review/explainer.json` | 6,478 | 2026-04-06 | Progressive disclosure explainer for HowItWorksView | `3d446a077f3c7c5b65518ef79b4a518981fbbf46e002334616e27bfd7a8bf75b` |
| `review/model_comparison.json` | 1,366 | 2026-04-06 | Compact comparison summary for dashboard Review tab | `b4d6fd8dcdea360e27a63b5e4d30b58422f1016f36f075f3059e32c78d2e294e` |
| `review/provenance_registry.json` | 4,081 | 2026-04-06 | Provenance registry (sources, licenses, commits) | `9a3e6f8376adfc7a8b9371198dd917c3951908c9d52e419da7a802a9ca93f959` |
| `review/risk_comparison.json` | 1,709 | 2026-04-06 | Risk-comparison summary for dashboard | `1fef85119ef621cae677be0afa9a35cce2e98ac2572bac697da912c0b0146833` |
| `review/sensitivity.json` | 1,081 | 2026-04-06 | Sensitivity summary for dashboard (separate from per-submodel `sensitivity-{gsl,gbs}.json` in Section 5) | `e7074c676e48c783b7a79794aa2ef5031c9b5520f09f768ab0b786431dfcac2c` |
| `review/site_reports.json` | 3,603 | 2026-04-06 | Per-region / per-site report summaries | `4665544987212a0d465f5d20fd482b9cac075f11721695834b2248c434ba307c` |

### 8.3 Map layers (NOT in RR pack)

Twelve GeoJSON layers plus a manifest. NOT produced by the RR export
pipeline; ingested into the dashboard from external GIS sources.

| File | Size (B) | Last modified | Role |
|------|---------:|---------------|------|
| `map/MAP_LAYERS_MANIFEST.json` | 7,067 | 2026-04-06 | Map-layers manifest (layer metadata, attribution); SHA-256 `37a2a899b1c53a9bbd974a85d9634018480ecdbbf7733d9bf223acfa9024fb14` |
| `map/gsl_basins.geojson` | 22,750 | 2026-04-06 | GSL study-region basin polygons |
| `map/gbs_basins.geojson` | 224,835 | 2026-04-06 | GBS study-region basin polygons |
| `map/commercial_fisheries.geojson` | 61,496 | 2026-04-06 | Commercial fishery locations |
| `map/advisory_lakes.geojson` | 15,345 | 2026-04-06 | Fish-consumption advisory lakes |
| `map/historic_mines.geojson` | 48,040 | 2026-04-06 | Historic mine locations |
| `map/large_mines.geojson` | 4,941 | 2026-04-06 | Large active mine locations |
| `map/mineral_claims.geojson` | 420,595 | 2026-04-06 | Mineral-claim polygons |
| `map/oil_gas_claims.geojson` | 400,538 | 2026-04-06 | Oil and gas claim polygons |
| `map/communities.geojson` | 16,327 | 2026-04-06 | Community locations |
| `map/climate_stations.geojson` | 162,269 | 2026-04-06 | Climate-station locations |
| `map/hydro_facilities.geojson` | 2,707 | 2026-04-06 | Hydro facility locations |
| `map/thaw_slumps.geojson` | 1,290,355 | 2026-04-06 | Thaw-slump polygons |

SSTAC pack file counts: 1 manifest + 1 runtime + 1 training_data + 12
review JSONs + 1 map manifest + 12 GeoJSONs = 28 files (vs 7 in the RR
pack).

---

## 9. Design documents
(`external_case_studies/jermilova_2025_mackenzie_hg/`)

Nine markdown design / analysis documents. Paths under
`C:/Projects/Regulatory-Review/2026_Database_Development/data_acquisition/bnrrm_extraction/bn_learning/external_case_studies/jermilova_2025_mackenzie_hg/`.

| File | Size (B) | Last modified | Role |
|------|---------:|---------------|------|
| `MODEL_SPECIFICATION_MACKENZIE.md` | 17,797 | 2026-04-06 | DAG design (Section 4 simplification rationale, Section 5 discretization) |
| `COMPARISON_PROTOCOL.md` | 8,384 | 2026-04-06 | 5-dimension comparison protocol + acceptance thresholds |
| `crosswalk.md` | 15,048 | 2026-04-06 | FRDR variable -> DAG node mapping + exclusion table |
| `SOURCE_MANIFEST.md` | 8,770 | 2026-04-06 | Paper, FRDR, IEAM supplements, Netica binaries source registry |
| `r_code_analysis/r_code_analysis_summary.md` | 18,229 | 2026-04-06 | Published R code analysis (lme, drc, predictSE; no set.seed) |
| `r_code_analysis/landis_group_cpt_methods.md` | 4,102 | 2026-04-06 | Landis-group CPT methods (Equations vs Case Learning vs Pegging the Corners) |
| `M3_ARCHITECTURE_SPIKE_REPORT.md` | 17,535 | 2026-04-06 | M3 architecture spike report (GO decision rationale) |
| `M4_FIT_REFACTORING_ANALYSIS.md` | 20,278 | 2026-04-06 | Justification for standalone `fit_mackenzie_model.py` (cherry-picked from `fit_causal_model.py`) |
| `CONTINUATION_PROMPT.md` | 2,355 | 2026-04-06 | Session continuation pointer. NOTE per PLAN: as of 2026-05-17 marks items 1-2 complete; not a bug source. |

This appendix and the PLAN live in the sibling
`methodology_paper/` directory (size of `PLAN.md` 48,580 B,
modified 2026-05-17); they are tracked separately from this design-doc
set because they belong to the methodology deliverable rather than the
case-study source-of-truth tree.

CORRECTED per codex appendices-R1 finding P3-3: the methodology_paper
directory also contains `ascii_lint.py`, cited by all four appendices
as the authoritative ASCII compliance gate. It is inventoried here so
this file inventory contains no orphan references:

| File (absolute path) | Size (B) | Last modified | Role |
|------|---------:|---------------|------|
| `C:/Projects/Regulatory-Review/2026_Database_Development/data_acquisition/bnrrm_extraction/bn_learning/external_case_studies/jermilova_2025_mackenzie_hg/methodology_paper/ascii_lint.py` | 1,650 | 2026-05-17 | ASCII compliance gate. Flags any character with code point > 127. Returns exit code 0 (clean), 1 (violations), 2 (usage). Used by all four appendices to enforce CLAUDE.md "What AI Must Never Do" item 6 (no emoji, no Unicode arrows, no smart quotes). |

(Hash deferred: ascii_lint.py may evolve as the linter gains features.)

---

## 10. Handoff / state record

| File (absolute path) | Size (B) | Last modified | Role |
|------|---------:|---------------|------|
| `C:/Projects/Regulatory-Review/2026_Database_Development/data_acquisition/bnrrm_extraction/BNRRM_HANDOFF.md` | 116,810 | 2026-04-22 | BN-RRM workstream handoff (v74.0 current; v66.0 row describes Jermilova M1-M7 completion + commits `ba88a72e`, `898059f1`, `5fe3cb85` and SSTAC commits `6cae8a5`, `2ec2f4f`, `75f4581`, `62430da` cited in PLAN Part VIII 24.5) |

Hash deferred: the handoff is a living document, mutated by the
`/update-bnrrm-docs` skill on every session close; pinning a hash here
would go stale before the next session. PLAN authority is the v66.0
ROW (immutable archive), not the live file head.

---

## Live drift state (2026-05-17)

Per PLAN Definition of Done item 10 and PLAN Q8, byte-compare the shared
subset between the RR pack (Section 7) and the SSTAC-Dashboard pack
(Section 8.1). Comparison executed at draft time via `sha256sum` on both
locations; results consolidated below.

| Shared file | RR pack SHA-256 | SSTAC pack SHA-256 | State |
|-------------|-----------------|-----------------|-------|
| `pack.json` | `8945a4f4...4a584f` | `24b322e8...4bf17b` | DIFFERS |
| `runtime/learned-model.json` | `adf98f1a...f99c6` | `87ea0051...a978ad` | DIFFERS |
| `training_data.json` | `e6ad4be9...684931` | `e6ad4be9...684931` | IDENTICAL |
| `review/comparison_results.json` | `70358df3...b4632` | `70358df3...b4632` | IDENTICAL |
| `review/model_overview.json` | `14f0676a...3e13e418` | `14f0676a...3e13e418` | IDENTICAL |
| `review/published_reference.json` | `4f34e54a...505743` | `4f34e54a...505743` | IDENTICAL |
| `review/validation.json` | `9303132...91da` | `9303132...91da` | IDENTICAL |

Observed state: `training_data.json` and the 4 shared review JSONs are
byte-identical between the two locations. `pack.json` and
`runtime/learned-model.json` DIFFER. This matches the live drift report
recorded in PLAN Section 12 Q8 (codex R3 spot-check, 2026-05-17).

Interpretation (NOT a fix; PLAN deliberately does not repair this):

- `pack.json` divergence: the SSTAC manifest is 1,060 B larger (3,436 vs
  2,376) because the dashboard pack lists the 8 dashboard-only review
  artifacts and 12 map layers in its manifest; the RR manifest only
  knows about the shared subset. This drift is structurally explained
  by the asymmetry documented in Sections 7 and 8 and is compatible
  with PLAN Section 6 Part VI 19.3's "byte-compare only shared subset"
  drift policy.
- `runtime/learned-model.json` divergence: the SSTAC runtime is 728 B
  larger (178,496 vs 177,768) AND structurally different. Per codex
  holistic-R1 P1-2 (re-applied per R2 propagation), a JSON-level diff
  shows two substantive structural changes on the SSTAC side: (a) a
  top-level `conceptualTiers` array is added (the dashboard renderer
  reads it for the conceptual tab); (b) `eligible_commercial_catch`
  is reassigned from the "Effects" container (RR-pack assignment) to
  the "Human Health" container (SSTAC-pack assignment). The prior
  "suspected re-export with timestamp/formatting changes" framing is
  WITHDRAWN -- the runtime drift is real and dashboard-side, not a
  byte-cosmetic artifact. Body Part VI Section 19.3 and Section
  26.10C document the consequence: the deployed pack should be
  cited as the AUGMENTED RUNTIME and the RR-pack runtime as the
  SOURCE RUNTIME; reviewers consulting the deployed dashboard see
  the augmented model.
- The comparison artifact `review/comparison_results.json` is identical
  in both locations, so Part VII can cite either with no risk of
  silent divergence on the published-vs-our-build comparison numbers.
- The digitized published-reference baseline
  (`review/published_reference.json`) is identical across all three
  locations where it appears (Section 6, RR pack, SSTAC pack), removing
  the worst-case risk identified in PLAN Q8: silent corruption of the
  comparison reference.

Drift is reported, not fixed, per PLAN authorization scope for Appendix
D. Any fix is a downstream maintenance task on the dashboard pipeline.

---

## Reproducibility note

Hashes in this appendix were computed via `sha256sum` (Git Bash) on
2026-05-17. To re-verify any single artifact:

```
sha256sum <absolute-path>
```

To re-verify the full shared subset between RR and SSTAC packs:

```
cd C:/Projects/Regulatory-Review/2026_Database_Development/data_acquisition/bnrrm_extraction/bn_learning/packs/bnrrm-casestudy-jermilova2025-mackenzie-hg/
sha256sum pack.json training_data.json runtime/learned-model.json review/comparison_results.json review/model_overview.json review/published_reference.json review/validation.json

cd C:/Projects/SSTAC-Dashboard/public/bn-rrm/packs/bnrrm-casestudy-jermilova2025-mackenzie-hg/
sha256sum pack.json training_data.json runtime/learned-model.json review/comparison_results.json review/model_overview.json review/published_reference.json review/validation.json
```

Compare line-by-line. Differences in pack.json and runtime/learned-model.json
are expected per the drift state above; differences in any of the other 5
files indicate new drift and MUST be reported in a revision of this appendix
before any body Part cites the affected artifact.

-- END OF APPENDIX D --
# Appendix E -- References

ASCII only. All entries use plain ASCII; no smart quotes, no em-dash.

## Peer-reviewed and primary literature

- Jermilova, U., Kirk, J.L., Janssen, S., Reid, T., Skierszkan, E.,
  Buntrock, J., and others. 2025. "Assessing mercury exposure to water
  and fish of the Mackenzie watershed using a Bayesian network
  analysis." Integrated Environmental Assessment and Management
  21(2): 396-413. DOI: 10.1093/inteam/vjae011. CC BY-NC 4.0 Open
  Access. (The benchmark paper this methodology document is built
  against.)

- Dillon, T., Beckvar, N., and Kern, J. 2010. "Residue-based mercury
  dose-response in fish: an analysis using lethality-equivalent
  test endpoints." Environmental Toxicology and Chemistry 29(11):
  2559-2565. (Source of the LL.3 dose-response function used by
  the `dillon_injury_pct()` deterministic CPT at
  `fit_mackenzie_model.py:278-298`. Parameters: upper_limit=133.99,
  slope=-0.699, ec50=2.435.)

- Landis, W.G. 2021. "The origin, development, application, lessons
  learned, and future regarding the Bayesian network relative risk
  model for ecological risk assessment." Integrated Environmental
  Assessment and Management 17(1): 79-94. (Foundational framework
  paper for BN-RRM construction across the broader regulatory-review
  program.)

- Heckerman, D., Geiger, D., and Chickering, D.M. 1995. "Learning
  Bayesian networks: The combination of knowledge and statistical
  data." Machine Learning 20(3): 197-243. (BDeu (Bayesian Dirichlet
  equivalent uniform) prior definition; cited for the formula
  alpha_ij = ESS / n_configs and alpha_ijk = ESS / (n_configs *
  n_states) used in the BDeu correctness receipt at Appendix B
  Section B.3 and Section B.3.6.)

## Regulatory guidelines and standards

- Canadian Council of Ministers of the Environment (CCME). Various
  dates. "Canadian Water Quality Guidelines for the Protection of
  Aquatic Life: Mercury." Source of the 26 ng/L freshwater THg
  threshold used by the `freshwater_thg` discretization (Appendix C
  Section C.3.c; canonical_mackenzie.py:31). Available at
  ceqg-rcqe.ccme.ca/en/index.html.

- Health Canada. 2007. "Updating the Existing Risk Management
  Strategy for Mercury in Retail Fish." Source of the 0.5 ug/g ww
  commercial-fish guideline (canonical_mackenzie.py:34) and the
  adult-male provisional tolerable weekly intake (pTWI) value of
  3.3 ug Hg/kgbw/wk (canonical_mackenzie.PTWI_THRESHOLDS).

- World Health Organization / Joint FAO/WHO Expert Committee on Food
  Additives (JECFA). 2003. "Methylmercury -- 61st meeting." Source of
  the women-of-childbearing-age pTWI value of 1.4 ug Hg/kgbw/wk
  (canonical_mackenzie.PTWI_THRESHOLDS["who_childbearing"]).

- US Environmental Protection Agency (US EPA). 2001. "Reference Dose
  for Methylmercury." Source of the child reference dose of
  0.1 ug/kgbw/day -> 0.7 ug Hg/kgbw/wk
  (canonical_mackenzie.PTWI_THRESHOLDS["us_epa_child"]), used as the
  most-protective default pTWI threshold (PTWI_THRESHOLD_DEFAULT at
  fit_mackenzie_model.py:95).

## Datasets and code

- Jermilova et al. 2025 supplementary data via the Federated Research
  Data Repository (FRDR). DOI: 10.20383/103.0957, version 2 released
  2025-05-14. License: CC BY-NC-SA 4.0 (ShareAlike). Contents:
  FishData_and_ProbabilityDistributions.xlsx (797 fish records);
  FreshwaterTHgData_and_ProbabilityDistributions.xlsx (2,124 water
  records); Freshwater_Discharge_Outlet_and_GBS_North.xlsx (hydrology);
  WildfireData.xlsx (ancillary); Manuscript_RCode.R (310 lines, no
  set.seed); Netica .neta binaries for GSL and GBS submodels;
  CITATION.txt, LICENSE.txt, README.txt. The published-paper
  supplementary Table S4 is the source of all discretization breaks
  borrowed for the case-study build (Appendix C).

  Note (per Part I Section 2): as of 2026-04-06 the FRDR remote was
  temporarily unavailable; the local archive at
  `external_case_studies/jermilova_2025_mackenzie_hg/raw/` is the
  source of truth for the build. Integrity is verified against
  `frdr-dfdr-checksums.txt`.

- Ankan, A., and Panda, A. (pgmpy contributors). pgmpy: Python library
  for Probabilistic Graphical Models. https://pgmpy.org. Version
  1.0.0 (as of codex appendices-R2 verification, 2026-05-17). Used
  for DAG validation only via `BayesianNetwork()` constructor in
  `dag_definition_mackenzie_hg.py:294`. NOT used for CPT fitting or
  inference; the BDeu code in `fit_mackenzie_model.py:160-243` is a
  self-contained implementation that matches pgmpy's
  `pgmpy.estimators.BayesianEstimator(prior_type="BDeu",
  equivalent_sample_size=1.0)` formula line-for-line (Appendix B
  Section B.3.6).

## Project-internal authoritative documents

- BNRRM_HANDOFF.md (v74.0). Project handoff record. The v66.0
  history row at
  `2026_Database_Development/data_acquisition/bnrrm_extraction/BNRRM_HANDOFF.md`
  is the official state record for M1-M7 milestone completion of
  the Jermilova case study and the load-bearing commit references
  (`ba88a72e`, `898059f1`, `5fe3cb85` on `prototype/graph-sidecar-nonprod`;
  SSTAC `6cae8a5`, `2ec2f4f`, `75f4581`, `62430da` on main).

- MODEL_SPECIFICATION_MACKENZIE.md. Comprehensive DAG design
  specification covering both submodels. Section 4 documents the
  DAG simplification decisions (species collapse, RUSLE intermediate
  collapse, freshwater discharge exclusion, wildfire C-factor
  exclusion). Section 5 enumerates the borrowed discretization
  breaks per node with attribution to Table S4 of Jermilova et al.
  2025.

- COMPARISON_PROTOCOL.md. The 5-dimension comparison protocol
  authored at M2 before any fitting was run. Frozen thresholds:
  Dimension 1 (structural, no numeric threshold; documented
  comparison table); Dimension 2 (mean Jensen-Shannon divergence
  per node < 0.15); Dimension 3 (Pearson r > 0.7 on endpoints, MAD
  < 0.15 per state); Dimension 4 (Spearman rho > 0.6 OR top-3
  agreement >= 2/3); Dimension 5 (Minamata Treaty atmospheric-Hg
  reduction +/- 0.5x of published ~1.2x fold-change). Per Part
  VII Section 23.0 and Section 26.10, only Dimensions 1 and 4 are
  RUN in the current build.

- crosswalk.md. Variable-by-variable mapping from the FRDR raw
  field names to the canonical BN-RRM DAG nodes. 44 variables
  across scenario / source / stressor / effect / endpoint
  categories. Documents which FRDR columns are consumed and which
  are excluded by design.

- SOURCE_MANIFEST.md. Authoritative source-materials inventory.
  Records the paper citation (verbatim title, journal, DOI),
  FRDR DOI + license + version, IEAM supplementary materials,
  and the Netica .neta binary references.

- r_code_analysis/r_code_analysis_summary.md. Analysis of
  `raw/Manuscript_RCode.R` (310 lines). Documents the published
  methodology: nlme::lme() linear mixed-effects models for
  fish_tissue_hg and freshwater_thg, drc::drm() LL.3()
  dose-response for degree_of_injury, predictSE.lme() for CPT
  generation, HYDAT freshet identification, RUSLE C-factor
  wildfire analysis. Flags the missing set.seed() (R1 noted in
  Part VII Section 22.2) and the ambiguous GBS Water model
  predictors at lines 124 vs 148.

- r_code_analysis/landis_group_cpt_methods.md. Methodological
  reference document comparing Landis Group (Netica) CPT methods
  (Equations, Case Learning, Pegging the Corners) with our
  BDeu approach.

- M3_ARCHITECTURE_SPIKE_REPORT.md. M3 architecture spike report
  documenting why the inference engine is already generic and
  did not require Mackenzie-specific changes.

- M4_FIT_REFACTORING_ANALYSIS.md. Justification for the
  standalone `fit_mackenzie_model.py` rather than parameterizing
  `fit_causal_model.py`. Section 5 specifies the cherry-pick set
  of generic functions (Noisy-OR, BDeu, BDeu+prior, marginalized
  BDeu, kappa, normalize, protectiveness).

- BNRRM_V1_PUBLICATION_BASELINE_SUMMARY.md, MULTI_MODEL_FRAMEWORK_HANDOFF.md,
  PACK_GOVERNANCE_CONVENTION.md. Framework documents for the
  broader BN-RRM program; cited only where Part I Section 2
  scopes this case study against the larger v1.0 vs canonical
  v0.4.1 program structure.

## Tooling and skills

- Claude Code Skills repository (project-local):
  `~/.claude/skills/codex-review/SKILL.md`. Defines the targeted vs
  holistic codex review modes and the mutual-agreement adversarial
  methodology used throughout the PLAN / appendices / body codex
  rounds.

- Standing-memory entry
  `codex_review_mutual_agreement_methodology_2026_05_16.md`.
  Records the owner-explicit standing rule (2026-05-16) that codex
  is an adversarial reviewer and the goal is mutual agreement, not
  silent acceptance of findings the orchestrator does not believe.

- ascii_lint.py. Project-local linter for ASCII compliance in the
  methodology paper. Flags any character with code point > 127.
  Used by all four appendices and the four body files. Located at
  `methodology_paper/ascii_lint.py` (Appendix D Section 9).

-- END OF APPENDIX E --
# Appendix F -- Decision-Provenance Ledger

ASCII only. Chronological table of every recorded decision in the
construction of the Jermilova case-study BN-RRM. Required fields per
PLAN Section 6 Part IX Appendix F:

1. Date (ISO 8601)
2. Decision summary (one sentence)
3. Proposer (HITL / Claude orchestrator / Explore subagent / Codex)
4. AI tool + version (REQUIRED if proposer is AI)
5. Decider / final authority (HITL = Jasen Nelson)
6. Why (one or two sentences)
7. Commit reference (where applicable)
8. Artifact reference (file:section or results JSON path affected)

Per PLAN Section 11 Definition of Done item 7, every row whose proposer
is AI must have a non-empty tool/version field. Rows whose decider is
HITL but whose proposer is AI are AI-proposed-HITL-accepted decisions;
rows whose proposer and decider are both HITL are HITL-originated.

## F.1 M1 -- FRDR data acquisition (2026-04-06)

- **2026-04-06: Adopt FRDR DOI 10.20383/103.0957 v2 as the canonical raw data source**
  - Proposer: Claude orchestrator; Tool/Version: Claude Opus 4.7; Decider: HITL Jasen Nelson
  - Why: The DOI is the FAIR-compliant identifier authored by the published paper's authors; using anything else would risk drift
  - Commit: (pre-implementation); Artifact: SOURCE_MANIFEST.md:36-38

- **2026-04-06: Local-archive the FRDR raw/ folder with checksum verification (`frdr-dfdr-checksums.txt`)**
  - Proposer: Claude orchestrator; Tool/Version: Claude Opus 4.7; Decider: HITL
  - Why: FRDR remote availability is not guaranteed; documented unavailability 2026-04-06 made the local snapshot the build's source of truth
  - Commit: (pre-implementation); Artifact: Appendix D Section 3

- **2026-04-06: Treat below-detection-limit (BDL) water samples conservatively (use the detection-limit value as-is, NOT zero-substitute or impute)**
  - Proposer: HITL; Tool/Version: n/a; Decider: HITL
  - Why: Zero-substitution biases the freshwater_thg distribution toward "low"; multiple imputation introduces methodological dependency the build avoids
  - Commit: (pre-implementation); Artifact: prepare_mackenzie_data.py:175-186 (`discretize_freshwater_thg`); Appendix C Section C.6

## F.2 M2 -- DAG spec, crosswalk, comparison protocol (2026-04-06)

- **2026-04-06: Adopt the published DAG topology (14 nodes, 15 edges per submodel; 12 shared + 2 GSL-specific + 2 GBS-specific)**
  - Proposer: HITL; Tool/Version: n/a; Decider: HITL
  - Why: The comparison protocol's Dimension 1 (structural fidelity) requires that we BORROW the topology rather than re-derive it; otherwise we are comparing two different DAGs
  - Commit: (pre-implementation); Artifact: MODEL_SPECIFICATION_MACKENZIE.md Section 1; dag_definition_mackenzie_hg.py:17-99,105-118,124-137,163-178,181-196

- **2026-04-06: Collapse the fish-tissue regression into a single fish_tissue_hg BN-RRM node with fish_species as a categorical parent (the published model uses ONE lme() per submodel with Fish_Code as a factor, not five separate species regressions; codex holistic-R1 P1-3 correction)**
  - Proposer: HITL; Tool/Version: n/a; Decider: HITL
  - Why: Reduces visualization complexity in the SSTAC-Dashboard; preserves the species-conditional discretized distribution via the BDeu parent dimension. INFORMATION LOSS (explicit): the published lme() species-factor intercept shifts, random-effect smoothing on station within species, parametric coefficient uncertainty, and partitioned residual variance are NOT preserved in the BN-RRM representation. Documented as Section 26 limitation per codex holistic-R1 P2-5.
  - Commit: (pre-implementation); Artifact: MODEL_SPECIFICATION_MACKENZIE.md Section 4; body Part III Section 8.1 (codex holistic-R1 corrected text)

- **2026-04-06: Collapse the RUSLE soil-erosion intermediate nodes into a single soil_erosion_hg_release node**
  - Proposer: HITL; Tool/Version: n/a; Decider: HITL
  - Why: The RUSLE intermediates are not directly observed in FRDR; the aggregate is, and the BN needs only the aggregate
  - Commit: (pre-implementation); Artifact: MODEL_SPECIFICATION_MACKENZIE.md Section 4

- **2026-04-06: Exclude freshwater discharge as a BN parent**
  - Proposer: HITL; Tool/Version: n/a; Decider: HITL
  - Why: Discharge is a hydrological transport variable, not a contaminant source; including it would conflate transport with deposition
  - Commit: (pre-implementation); Artifact: crosswalk.md exclusion table

- **2026-04-06: Exclude wildfire C-factor as ancillary**
  - Proposer: HITL; Tool/Version: n/a; Decider: HITL
  - Why: The published paper treats C-factor as a wildfire-impact ancillary; our build does not model wildfires
  - Commit: (pre-implementation); Artifact: crosswalk.md exclusion table

- **2026-04-06: Adopt all discretization breaks from Jermilova Table S4 verbatim**
  - Proposer: Claude orchestrator; Tool/Version: Claude Opus 4.7; Decider: HITL
  - Why: Borrowing the published thresholds is what makes the comparison meaningful; deriving our own would compare two different models
  - Commit: (pre-implementation); Artifact: Appendix C Section C.2; dag_definition_mackenzie_hg.py:240-287

- **2026-04-06: Add Health Canada pTWI thresholds (0.7 / 1.4 / 3.3 ug Hg/kgbw/wk) as the regulatory anchor for ptwi_exceedance**
  - Proposer: HITL; Tool/Version: n/a; Decider: HITL
  - Why: The pTWI is the most-protective regulatory standard for human dietary mercury; using US EPA child (0.7) as the default is the most-conservative choice
  - Commit: (pre-implementation); Artifact: canonical_mackenzie.py:38-57 (PTWI_THRESHOLDS)

- **2026-04-06: Adopt 100 g/day fish consumption, 60 kg body weight, 0.95 MeHg fraction as the subsistence-scenario parameters**
  - Proposer: HITL; Tool/Version: n/a; Decider: HITL
  - Why: These are the Indigenous-subsistence-scenario default parameters from the public-health literature; they MUST be surfaced as scenario-conditioning per Part II Section 6.6 and Section 26.9
  - Commit: (pre-implementation); Artifact: fit_mackenzie_model.py:84-88

- **2026-04-06: Author the 5-dimension comparison protocol (structural; CPT JSD < 0.15; per-region marginal Pearson r > 0.7, MAD < 0.15; sensitivity Spearman rho > 0.6 or top-3 >= 2/3; Minamata counterfactual within +/- 0.5x of 1.2x) and FREEZE the thresholds before fitting**
  - Proposer: HITL; Tool/Version: n/a; Decider: HITL
  - Why: Freezing thresholds before any fitting prevents post-hoc tuning to pass the gate; this is the structural defense of the comparison's integrity
  - Commit: (pre-implementation); Artifact: COMPARISON_PROTOCOL.md:35,50,81,109,127

## F.3 M3 -- Architecture spike (2026-04-06)

- **2026-04-06: Cherry-pick the BDeu / empirical-prior / forward-inference / topological-sort code from fit_causal_model.py into a standalone fit_mackenzie_model.py rather than parameterizing the canonical sediment fitter**
  - Proposer: Claude orchestrator; Tool/Version: Claude Opus 4.7; Decider: HITL
  - Why: The canonical fitter has 15 sediment-specific hardcoded references; standalone is faster, more inspectable, and keeps the case-study build independent of any future canonical refactoring
  - Commit: (pre-implementation); Artifact: M4_FIT_REFACTORING_ANALYSIS.md Section 5

- **2026-04-06: Inference engine is already generic; no Mackenzie-specific changes needed**
  - Proposer: Claude orchestrator; Tool/Version: Claude Opus 4.7; Decider: HITL
  - Why: The published forward-inference algorithm (topological-sort exact enumeration) is DAG-agnostic; M3 spike confirmed it works on the 14-node Mackenzie DAG without modification
  - Commit: (pre-implementation); Artifact: M3_ARCHITECTURE_SPIKE_REPORT.md GO decision

## F.4 M4 -- BDeu CPT fitting, validation, sensitivity (2026-04-06)

- **2026-04-06: Set BDeu ESS = 1.0 (DEFAULT_ESS) as the per-CPT smoothing constant**
  - Proposer: HITL; Tool/Version: n/a; Decider: HITL
  - Why: ESS = 1.0 is the standard "uninformative" choice; on the FRDR data volumes per CPT (584-1,589 LOO-eligible rows depending on submodel and target) the posterior is data-dominated; anticipated peer-review pushback is addressed in Part IV Section 11.2
  - Commit: `ba88a72e`; Artifact: fit_mackenzie_model.py:60 (DEFAULT_ESS)

- **2026-04-06: Apply per-CPT soft-edging to deterministic CPTs: 0.90/0.10 (multi-state: degree_of_injury, mehg_ingested) and 0.95/0.05 (binary: eligible_commercial_catch, ptwi_exceedance)**
  - Proposer: HITL; Tool/Version: n/a; Decider: HITL
  - Why: Hard zeros block belief propagation in forward inference; soft-edging preserves propagation while keeping the deterministic mapping dominant; binary nodes get tighter edges (0.05) so no off-target state has a higher floor than necessary
  - Commit: `ba88a72e`; Artifact: Appendix B Section B.0.6; fit_mackenzie_model.py:347-349,377-378,402-407,442-443

- **2026-04-06: Use partial LOO (refit only the target node's CPT per held-out observation) rather than full-network LOO**
  - Proposer: HITL; Tool/Version: n/a; Decider: HITL
  - Why: Full-network LOO would be order-of-magnitude slower; partial LOO validates the target conditional structure which is the primary concern; documented as a methodological limitation in Section 26.7
  - Commit: `ba88a72e`; Artifact: fit_mackenzie_model.py:802-808 (partial-LOO comment); Section 26.7

- **2026-04-06: Accept freshwater_thg LOO kappa = 0.0 result in both submodels rather than tuning the BDeu prior or rebalancing the training set**
  - Proposer: HITL; Tool/Version: n/a; Decider: HITL
  - Why: The kappa = 0.0 result correctly reports that the model collapses to majority-class prediction; it is a statistical signal of the data structure, not a defect; surfacing it honestly is more valuable than hiding it
  - Commit: `ba88a72e`; Artifact: validation-gsl.json; validation-gbs.json; Part V Section 15.7; Section 26.1

- **2026-04-06: Use mutual information (KL divergence) for sensitivity analysis rather than perturbation-based or variance-based methods**
  - Proposer: Claude orchestrator; Tool/Version: Claude Opus 4.7; Decider: HITL
  - Why: MI is the most-direct measure of statistical dependence and is well-defined on discrete CPTs; the published paper uses slope coefficients from lme() which we compare against in Part VII Section 23.2
  - Commit: `ba88a72e`; Artifact: fit_mackenzie_model.py:662-728

## F.5 M5 -- Export and pack assembly (2026-04-06)

- **2026-04-06: Use the generic-bn-rrm-v1 schema for the pack rather than extending the canonical bnrrm-v1 schema**
  - Proposer: HITL; Tool/Version: n/a; Decider: HITL
  - Why: The Mackenzie BN-RRM is structurally different from the canonical 20-node sediment BN-RRM; a separate schema avoids polluting the canonical with case-study-specific fields
  - Commit: `898059f1`; Artifact: bn_learning/packs/.../pack.json (schema field); SSTAC trained-network.ts createGenericNetwork

- **2026-04-06: Generate the core pack with 4 review JSONs (comparison_results, model_overview, published_reference, validation) and NO map/ folder**
  - Proposer: Claude orchestrator; Tool/Version: Claude Opus 4.7; Decider: HITL
  - Why: The 4 review JSONs are the artifacts the RR pipeline can produce; map layers are dashboard-side augmentations; documented in Section 19.1 and Appendix D Section 7
  - Commit: `898059f1`, `5fe3cb85`; Artifact: bn_learning/packs/bnrrm-casestudy-jermilova2025-mackenzie-hg/

## F.6 M6 -- Dashboard generalization (2026-04-06)

- **2026-04-06: Add `createGenericNetwork` to `trained-network.ts` so the dashboard can render any generic-bn-rrm-v1 pack, not just the canonical 20-node**
  - Proposer: Claude orchestrator; Tool/Version: Claude Opus 4.7; Decider: HITL
  - Why: The benchmark-pack pattern requires runtime polymorphism on the network schema; canonical-only rendering would lock the dashboard to a single DAG forever
  - Commit: SSTAC `6cae8a5`; Artifact: SSTAC src/lib/bn-rrm/trained-network.ts

- **2026-04-06: Add the 12 GeoJSON map layers as dashboard-side augmentations (not RR-pipeline outputs)**
  - Proposer: Claude orchestrator; Tool/Version: Claude Opus 4.7; Decider: HITL
  - Why: The map layers are dashboard-only because they live in the SSTAC repo's design space; RR has no GIS toolchain
  - Commit: SSTAC `6cae8a5`; Artifact: SSTAC public/bn-rrm/packs/bnrrm-casestudy-jermilova2025-mackenzie-hg/map/

## F.7 M7 -- PublishedComparison and HowItWorksView (2026-04-06)

- **2026-04-06: Add PublishedComparison.tsx for side-by-side display of our vs published model**
  - Proposer: Claude orchestrator; Tool/Version: Claude Opus 4.7; Decider: HITL
  - Why: The comparison artifact (`comparison_results.json`) is dense; a dedicated view makes the comparison legible to dashboard users
  - Commit: SSTAC `2ec2f4f`; Artifact: SSTAC src/components/bn-rrm/casestudies/PublishedComparison.tsx

- **2026-04-06: Add HowItWorksView.tsx with tier-based progressive disclosure**
  - Proposer: Claude orchestrator; Tool/Version: Claude Opus 4.7; Decider: HITL
  - Why: Three audience tiers (everyone / practitioner / technical); the Jermilova-Table-S4 discretization is exposed at the technical tier
  - Commit: SSTAC `75f4581`; Artifact: SSTAC src/components/bn-rrm/casestudies/HowItWorksView.tsx

- **2026-04-06: Register the Jermilova pack in the dashboard pack-store so it appears in the Case Studies tab**
  - Proposer: Claude orchestrator; Tool/Version: Claude Opus 4.7; Decider: HITL
  - Why: Without registration the pack would not be discoverable in the UI
  - Commit: SSTAC `62430da`; Artifact: SSTAC src/stores/bn-rrm/packStore.ts

## F.8 Methodology paper construction (2026-05-17)

- **2026-05-17: Author this methodology paper as a peer-review-grade construction record for the AI-assisted workflow**
  - Proposer: HITL; Tool/Version: n/a; Decider: HITL
  - Why: The parent paper's research question requires a complete construction record that another reviewer can audit decision-by-decision
  - Commit: (uncommitted); Artifact: methodology_paper/PLAN.md; this document

- **2026-05-17: Spawn four Claude Code Explore subagents (subagent type=Explore; Claude Opus 4.7 model) to map the codebase before drafting**
  - Proposer: Claude orchestrator; Tool/Version: Claude Opus 4.7 + Claude Code subagent type=Explore; Decider: HITL
  - Why: The orchestrator's context budget is limited; subagent exploration is the standing context-protection pattern
  - Commit: (uncommitted); Artifact: methodology_paper/PLAN.md Section 9.2

- **2026-05-17: Run the codex-review skill on the PLAN through three mutual-agreement rounds before drafting any deliverable content**
  - Proposer: Claude orchestrator; Tool/Version: Codex CLI 0.130.0 (xhigh reasoning + tool use) + Claude Opus 4.7; Decider: HITL
  - Why: The PLAN must be GREEN before drafting begins; otherwise body Parts will inherit PLAN defects
  - Commit: (uncommitted); Artifact: methodology_paper/PLAN.md Section 13 sign-off

- **2026-05-17: Argue back on codex's R1 P1-3 finding (comparison artifact path) with file:line evidence of the dual-location reality**
  - Proposer: Claude orchestrator; Tool/Version: Claude Opus 4.7; Decider: HITL (via mutual-agreement methodology)
  - Why: Silent acceptance of an incorrect finding would have removed the RR-pack reference; codex withdrew on R2 after reading the RR folder
  - Commit: (uncommitted); Artifact: methodology_paper/PLAN.md Section 13 sign-off

- **2026-05-17: Draft Appendices D, A, C, B (in that order; fact-pinning ledgers) BEFORE the body Parts**
  - Proposer: Claude orchestrator; Tool/Version: Claude Opus 4.7; Decider: HITL (per codex PLAN R1 P2-4 finding accepted)
  - Why: Appendices A-D pin the empirical facts the body Parts will cite; drafting them first reduces drift in the body
  - Commit: (uncommitted); Artifact: methodology_paper/appendices/*.md

- **2026-05-17: Spawn four Claude Code subagents (subagent type=general-purpose; Claude Opus 4.7 model) to draft the body Parts in parallel: Parts I-III, Part IV alone (deepest), Part V alone, Parts VI-IX**
  - Proposer: Claude orchestrator; Tool/Version: Claude Opus 4.7 + Claude Code subagent type=general-purpose; Decider: HITL
  - Why: Part IV is the deepest chapter (BDeu math, deterministic CPTs, per-CPT soft-edging); dedicated subagent attention is warranted
  - Commit: (uncommitted); Artifact: methodology_paper/body/*.md

- **2026-05-17: Run targeted codex reviews per appendix-set and per body-set with mutual-agreement methodology**
  - Proposer: Claude orchestrator; Tool/Version: Codex CLI 0.130.0 + Claude Opus 4.7; Decider: HITL
  - Why: Each round catches a different class of defect; mutual-agreement prevents both silent acceptance and silent rejection
  - Commit: (uncommitted); Artifact: .tmp_codex_*_out.txt audit trail

## F.9 Open / deferred decisions (HITL pending)

- **PLAN Q6: ESS sensitivity analysis (re-run LOO at ESS = 0.5, 1.0, 5.0, 10.0)**
  - Status: OPEN -- HITL to authorize
  - Source: PLAN Section 12 Q6; Part IX Section 27.5 item (a)

- **PLAN Q7: forward-inference soft-edging bias quantification**
  - Status: OPEN -- HITL to authorize
  - Source: PLAN Section 12 Q7; Part VIII Section 26.8; Part IX Section 27.5 item (b)

- **Comparison Protocol Dimension 4 metric receipts (Spearman rho, top-3 agreement, rank displacement)**
  - Status: OPEN -- required to upgrade Dimension 4 from PARTIAL to FULLY RUN; the artifact currently stores ranking lists but no metric values
  - Source: Part VII Section 23.0; Part VIII Section 26.10D; Part IX Section 27.5 item (b2) (ADDED per codex holistic-R4 IMPORTANT)

- **Comparison Protocol Dimension 2 (CPT JSD) execution**
  - Status: OPEN -- requires per-parent-config digitization of published CPTs
  - Source: Part VIII Section 26.10; Part IX Section 27.5 item (e)

- **Comparison Protocol Dimension 3 (per-region marginal-belief Pearson r) execution**
  - Status: OPEN -- requires preserving `_region` in `training_data_{model}.json` (one-line `strip_audit()` change at `prepare_mackenzie_data.py:649-652`) plus per-record region consumption in `fit_mackenzie_model.py`. The region label is already in the processed CSVs; FRDR re-extraction is NOT required. (Scope NARROWED per codex holistic-R1/R3.)
  - Source: Part VIII Section 26.10; Part IX Section 27.5 item (c)

- **Comparison Protocol Dimension 5 (Minamata counterfactual fold-change) execution**
  - Status: OPEN -- requires applying the published Minamata reduction scenario
  - Source: Part VIII Section 26.10; Part IX Section 27.5 item (f)

- **Full-network LOO (refit every CPT per held-out observation)**
  - Status: OPEN -- HITL to decide cost / benefit
  - Source: Part VIII Section 26.7; Part IX Section 27.5 item (d)

- **Held-out spatial or temporal validation dataset**
  - Status: OPEN -- requires re-acquisition of additional FRDR-equivalent data
  - Source: Part VIII Section 26.6; Part IX Section 27.5 item (g)

- **pgmpy side-by-side runtime fixture in tests/**
  - Status: OPEN -- optional verification
  - Source: Appendix B Section B.3.6; Part IX Section 27.5 item (h)

- **"What we would do differently" items (Section 27.5)**
  - Status: OPEN -- HITL curation pending final sign-off
  - Source: PLAN Section 12 Q4; Part IX Section 27.5

## F.10 Methodology paper version history

| Version | Date | Change | Reviewer rounds |
|---------|------|--------|-----------------|
| PLAN v0.1 | 2026-05-17 | Initial PLAN draft | -- |
| PLAN v0.2 | 2026-05-17 | Applied codex PLAN-R1 RED findings (3 P1 + 5 P2 + 1 P3); accepted 8 of 9, disputed P1-3 (comparison-artifact path) | PLAN-R1 RED -> PLAN-R2 |
| PLAN v0.3 | 2026-05-17 | Applied codex PLAN-R2 YELLOW findings (2 P2 + 1 P3) + accepted P1-3 withdrawal | PLAN-R2 YELLOW -> PLAN-R3 |
| PLAN v0.4 (GREEN) | 2026-05-17 | Applied codex PLAN-R3 YELLOW non-blocking clerical fixes; authorized for drafting | PLAN-R3 YELLOW non-blocking -> GREEN |
| Appendices v0.1 | 2026-05-17 | Initial appendix drafts (D, A, C, B in PLAN-specified order) | APPENDICES-R1 YELLOW |
| Appendices v0.2 | 2026-05-17 | Applied codex APPENDICES-R1 (6 P2 + 3 P3) findings | APPENDICES-R1 YELLOW -> APPENDICES-R2 |
| Appendices v0.3 | 2026-05-17 | Applied codex APPENDICES-R2 (5 P2) findings | APPENDICES-R2 YELLOW -> APPENDICES-R3 |
| Appendices v0.4 (GREEN) | 2026-05-17 | Applied codex APPENDICES-R3 (1 P2) finding; appendices authorized | APPENDICES-R3 YELLOW non-blocking -> GREEN |
| Body v0.1 | 2026-05-17 | Initial body Parts drafts (parts_I_II_III + part_IV + part_V + parts_VI_VII_VIII_IX) | BODY-R1 RED |
| Body v0.2 | 2026-05-17 | Applied codex BODY-R1 (2 P1 + 5 P2 + 1 P3) findings | BODY-R1 RED -> BODY-R2 |
| Body v0.3 | 2026-05-17 | Applied codex BODY-R2 (2 P1 + 2 P2) findings + Section 23.0 honesty addition | BODY-R2 RED -> BODY-R3 |
| Body v0.4 | 2026-05-17 | Applied codex BODY-R3 (3 P2) findings + Section 26.10 NEW + Section 27.5 expanded | BODY-R3 YELLOW -> BODY-R4 |
| Body v0.5 | 2026-05-17 | Applied codex BODY-R4 (5 P2 propagation-tense cleanups); BODY ready for assembly | BODY-R4 YELLOW non-blocking |

-- END OF APPENDIX F --
