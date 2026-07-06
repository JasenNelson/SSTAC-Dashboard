# Fresh-session handoff (2026-07-05) -- MO current_defaults + catalog integrity

Continues `FRESH_SESSION_HANDOFF_2026_07_04e_MO_CLEAN_BACKFILLS.md`. This session set the calculator
default (`current_default`) on the multi-option substances, fixed a catalog mis-attribution, and added
provenance guards. main tip after this work: `c057062` (+ this handoff PR).

## Shipped this session (all codex-gated to round-2 GREEN; full 6-gate push suite each) -- PRs #512, #513, #514
(Earlier in the same session, before this handoff's arc: PRs #491/#493/#494/#496/#497 -- clean backfills
+ zineb + 17-substance oral RfD backfill + manifest syncs; and the AGY autonomous 15h run PRs #502/#504-#511
-- Stream A provenance audit, Stream B coverage, Stream C jurisdiction-conflict decision doc.)

- **#512** -- set `default_status=current_default` on 18 (substance,input,pathway) tuples (36 rows) +
  5 library reseeds, per the owner default rule below. Fixed the systemic current_default provenance gap.
- **#513** -- fixed the chlorobenzene HC mis-attribution: catalog HC oral RfD 0.43 was the 1,2-DCB value
  (HC PSL1 1993). Quarantined the 2 HC rows (qa_status superseded, default_status not_default, review_notes
  annotated; value 0.43 KEPT for audit, not deleted); set EPA IRIS 0.02 as current_default; reseeded library
  0.43->0.02; removed the 2 rows from promote-hc-trv-v4-2025.mjs. EPA 0.02 corroborated by EPA + BC P28.
- **#514** -- two low-noise provenance guards: (1) cross-source value-divergence `info` finding in
  scripts/matrix-options/audit-library-provenance.mjs (approved hh-direct rfd/sf spanning >=10x across
  sources -> review list; currently 4: arsenic 18x, TCE 64x, dichloroethylene_1_1 17x, xylenes 15x);
  (2) src/lib/matrix-options/__tests__/librarySeedCurrentDefault.test.ts asserting library seed ==
  catalog current_default for all such rows (24 rows, 0 exceptions, checkedRows>=20 guard).

vitest ~5080. No calculator/catalog VALUES changed in #514; #512/#513 changed only the owner-approved
defaults + the 5 reseeds + the chlorobenzene correction.

## The owner DEFAULT-SELECTION RULE (load-bearing; also in memory feedback_protocol1_hierarchy_hc_default_epa_when_newer_defensible)
Protocol 1 = Health Canada top of hierarchy / preferred; a NEWER, more scientifically defensible value
(incl. US EPA, incl. more-protective) may be the default. Default = the most-protective value UNLESS it is
OUTDATED (assessment > ~10 years older than the competing HC/EPA value -> the newer value wins). Compare
ACTUAL assessment vintages on both sides (HC TRV v4.0 is a 2025 compilation of older HC assessments; get
the real derivation year). The catalog intentionally holds MULTIPLE candidates per substance so users can
choose; a "jurisdiction_conflict" is NOT a backlog of decisions, it is the multi-option feature. NEVER
collapse the catalog to one value or ask a binary "which principle wins".

## Owner-gated remaining (small lookups that unblock wiring -- need the owner, not delegatable)
1. **chlorobenzene real HC value** -- open FCSAP TRV v4.0 (H129-108-2021-eng.pdf), read the chlorobenzene
   row; a genuine HC value (~0.0081-0.0089) supersedes the interim EPA 0.02 default. (canada.ca 403'd the
   research subagent; the PDF is the one source it could not open.)
2. **benzo_a_pyrene** -- HELD on HC-2016a (Chen 2012) 6.67e-5; needs the owner-assisted PDF.
3. **total_pcbs_aroclor_1254** default + **phenylmercuric_acetate** + **pcbs_non_coplanar** -- PCB /
   organomercury policy calls.

## Delegatable technical follow-ups (AGY authors + codex gates; minimal Claude budget)
- Evidence-vs-substance CAS/name guard (catches the WRONG-SUBSTANCE mis-attribution mode; #514 caught the
  wrong-VALUE mode). Extend the divergence check to inhalation (rfc/iur) + eco values.
- Clean rfd/sf backfill backlog is EXHAUSTED (0 clean-null remaining); new clean candidates only appear if
  the approved catalog gains new single-value rows -> re-run `node scripts/matrix-options/wire-recon.mjs`.

## The 4 divergence review items (informational; already adjudicated -- no action)
arsenic_inorganic (HC 1.8 / EPA 32), trichloroethylene (HC 0.000811 / EPA 0.052 sf),
dichloroethylene_1_1 (HC 0.003 / EPA 0.05), xylenes (HC 0.013 / EPA 0.2) -- all legitimate HC/EPA
alternatives; the audit surfaces them for periodic confirmation.

## Fleet/delegation posture that worked this session (budget was the constraint)
AGY authored every catalog/library/test diff from precise briefs; Sonnet subagents did the web research
(IRIS + HC assessment vintages) + test-fallout/P2 fixes; codex 5.5-xhigh gated to round-2 GREEN each PR;
Opus only orchestrated + adjudicated the owner rule. Research must stay in-lane (Sonnet) -- cursor is the
engine-v2 session's, opencode/ollama-cloud is the OpenHarness session's. See memory
feedback_token_efficient_means_delegate_claude_budget.

## Working-tree note (unchanged)
`.agents/skills/**`, `.mcp.json`, `opencode.json` are tracked on main but untracked in the primary local
checkout (a parallel session's work) -> blocks `git checkout main`. All work used a git worktree off
freshly-fetched origin/main. Do NOT delete those files. MEMORY.md is over its size limit -- compaction
in progress this close-out.
