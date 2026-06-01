# Matrix-Options program plan -- re-baselined 2026-05-31

Single current map for the Matrix-Options dashboard work. Supersedes the steering view in
`NEXT_SESSION_HANDOFF_2026_05_27_MULTIWEEK_PLAN.md` (still valid for scope + invariants;
this doc updates "what shipped since" and "what is next"). Read this first; the 15 dated
MATRIX_OPTIONS_*_HANDOFF docs are point-in-time records, not the plan.

Authoritative inputs: the 2026-05-27 multiweek plan (4 streams, 8 tabs, 2026-vs-2027 scope),
memory `project_sstac_dashboard_scope_2026_vs_2027.md`, the live PR history (verified via gh
2026-05-31), and `MATRIX_OPTIONS_REFS_VALUES_JSON_HANDOFF_2026_05_31.md`.

## The frame (unchanged from 2026-05-27)

8 tabs, split by deadline:
- 2026 scope (Phase 2, PRIORITY): The Guide, Conceptual Model, Jurisdictional Frameworks, TWG Review
- 2027 scope (Phase 3, secondary): Interactive Map, Calculator, SSD Workbench, References & Values

4 work streams:
- Stream A -- The Guide update (2026; owner-stated INITIAL priority)
- Stream B -- Interactive Map / BN-RRM data growth (2027)
- Stream C -- Calculator refinement, frame-aware equations (2027)
- Stream D -- References & Values catalog: tooling + population (2027)

Product invariants (never violate): References & Values read-only for non-admin; no default
promotion / no QA promotion / no catalog mutation without explicit HITL action; Protocol 28
is policy-compilation context only; AI never sets a calculator default; units always
normalized; validate regulatory values against the authoritative source, never AI memory.

## Where each stream actually stands (verified 2026-05-31)

main tip at last check: `a2b009b`. Stream D dominated the last several days.

### Stream A -- The Guide update -- NOT STARTED (the priority gap)
- Owner directive 2026-05-27 (verbatim): "We need to prioritize refinement and update of the
  2026 scope tasks, which is updating The Guide is initial priority."
- Content lives in `matrix_research/content_drafts/The_Guide.md` (117 lines, ~10 KB; last
  touched 2026-05-30), read server-side at `src/app/(dashboard)/matrix-options/page.tsx`.
- This is the single biggest divergence from the plan: the stated #1 priority has not been
  done while Stream D advanced. Mostly Markdown content work, minimal code.

### Stream B -- Interactive Map / BN-RRM data growth -- NOT STARTED this lane
- Tabs/embeds wired earlier (#141, #148). No data-growth work since. Open question from the
  plan still open: new BN-RRM sources to ingest, or expand existing sites/parameters?
- ETL scaffolding exists under `scripts/matrix-map/etl_*`.

### Stream C -- Calculator refinement -- PARTIAL
- Done: equations now render in the Jurisdictional Frameworks right-drawer (#210, merged).
- NOT done: the core ask -- frame-aware equations (toggling BC Protocol 1 / CSR / FCSAP /
  CCME / US EPA / site-specific should change the underlying calculation; currently the same
  math runs regardless of frame). Calculator components:
  `src/components/matrix-options/{EcoDirectEqP,EcoFoodBSAF,HHDirectContact,HHFoodWeb}Calculator.tsx`;
  frames in `src/lib/matrix-options/regulatoryFrames.ts`.

### Stream D -- References & Values -- LARGE PROGRESS; long tail remains
TOOLING (merged, the 9-phase Evidence Library workplan + UX): #191-#212 -- A1 unit guard,
pathway split, jurisdiction collection, fidelity badge, live-merge, IA redesign, panel
rebalance, UX overhaul, draggable panel, saved-views to Supabase, unit-incommensurability
gate, retrieval status, saved-views sync fix, equations-in-JF, EPA IRIS guardrail. 5 Supabase
tables in production (promoted_parameter_values, parameter_value_reviews, catalog_evidence_items,
catalog_sources, source_lead_triage).

POPULATION (this session, JSON-first, DRAFT PRs awaiting owner merge): the generator
`scripts/matrix-options/generate-catalog-records.mjs` + 478 new TRV candidate values
(human_health_trv_values.json 84 -> 586). PRs #214 (213 P28 HH-soil), #217 (34 validated
IRIS), #215 (107 Health Canada), #216 (124 P28 water/vapour), and the integrated single-merge
#218. All gates GREEN; per-PR codex GREEN; holistic codex on #218 queued
(`CODEX_DESKTOP_PROMPT_PR218_REFS_VALUES_2026_05_31.md`). #213 (expanded IRIS snapshot) is now
redundant -- #218 absorbed it.

OPEN non-catalog Stream-D PRs: #198 (Lane 1b layout-rebalance design proposal, draft) and
#199 (Lane 1b layout rebalance Option B-lite, draft) -- both HELD for owner to eyeball the
rendered layout.

## What is genuinely outstanding (the bounded backlog)

### Immediate decision queue (this/next session)
1. Run the codex desktop holistic review on #218; then MERGE the catalog expansion (either
   #218 alone, or #214 first + union-resolve #215/#216/#217). Close redundant #213.
2. Owner eyeball #199 (Lane 1b layout) -> merge or discard #198/#199.
3. PIVOT to Stream A (The Guide) -- the 2026 priority.

### Stream D long tail (owner-gated; detail in REFS_VALUES_JSON_HANDOFF)
- IRIS orphan substances not in the EPA snapshot -> extend snapshot from the EPA Excel, re-run
  the generator with them in the allow-list.
- d0c00013 data-integrity fix: BaP / Cr(VI) / carbon_tetrachloride values inconsistent with EPA
  (excluded from #217; the extraction lane should investigate the source SQL).
- d0c00012 TEQ-unit RfDs (PCBs / PCDD-PCDF): TEF-workflow decision.
- Eco passes: d0c00005 eco-soil (2305 rows), d0c00010 EcoSSL (60) -- own lane; need eco
  source-pathway -> eco calculator-pathway mapping + review.
- CCME eco-soil Protocol 1 s4.4.2 rank-1 gap -- not extracted; may need owner to provide source.
- Later Supabase migration: paste `.tmp/catalog-paste/json-migration/promoted_*.sql` (owner action).
- Autonomous overnight catalog-enrichment agent (owner-requested feature): extraction ->
  STAGING table only -> HITL approval; never auto-promote / auto-approve / mutate static JSON.
  Design not started.

### Stream C backlog
- Frame-aware equations (the core refinement). TBD other calculator improvements.

### Stream B backlog
- BN-RRM data growth -- needs an owner answer on sources before scoping.

## Recommended sequencing (next few sessions)

1. NOW: codex-desktop review #218 -> merge catalog expansion -> close #213. Decide #198/#199.
2. THEN (Stream A): update The Guide -- reflect shipped References & Values + scope labels
   (2026 vs 2027) + HITL workflow + TWG onboarding. Owner reviews content before it lands.
   This closes the biggest plan-divergence.
3. THEN re-assess 2026 scope: Conceptual Model, Jurisdictional Frameworks, TWG Review -- define
   "done for Phase 2" with the owner.
4. Stream D long tail + autonomous agent design: schedule as its own lane AFTER 2026 scope is
   on track (the plan's stop-condition: do not advance 2027 scope while 2026 scope is off-track).
5. Streams B and C: defer unless owner directs; C's frame-aware equations is the highest-value
   2027 item when it comes up.

## Working method (unchanged, working well)
- Sonnet subagents for implementation + verification (token conservation); Opus orchestrates +
  synthesizes. Always surface the consolidated 4-gate block + commit/push state to the owner.
- codex iterate-to-GREEN before commit + 4 gates before push. Fallback ladder: codex CLI ->
  cursor-agent -> Opus adversarial + queue for codex desktop.
- JSON-first for catalog data (no Supabase paste bottleneck); migrate to Supabase in a later batch.
- One subagent (or one uncertain call) per message -- avoid the parallel-batch cancel cascade
  (L0 rule 1.16).

## Definition of "done feels real" (answer to: is there a plan?)
Yes. The plan is: finish + merge the catalog population (Stream D, in flight) -> pivot to The
Guide (Stream A, the 2026 priority) -> baseline the rest of 2026 scope -> then 2027 streams
(D long tail + autonomous agent, C frame-aware equations, B data growth). The backlog is large
but BOUNDED and ordered; it is not open-ended.
