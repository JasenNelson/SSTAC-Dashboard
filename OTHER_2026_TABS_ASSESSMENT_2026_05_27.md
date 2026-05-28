# Other 2026 Scope Tabs Assessment -- 2026-05-27

**Purpose:** This document addresses Open Question #1 from the approved multi-week plan at `C:\Users\jasen\.claude\plans\lively-stargazing-meadow.md` -- whether the three 2026-scope tabs that are NOT in any of the four owner-specified work streams (A/B/C/D) need refresh assessment beyond Stream A (The Guide).

**Scope group:** Phase 2 (2026) of the BC Sediment Standards Project.

**Tabs in this assessment:** Conceptual Model, Jurisdictional Frameworks, TWG Review.

**Methodology:** Read-only autonomous research conducted 2026-05-27 in the Stream A worktree on `main`. No code changes; no content edits. Findings + recommended-edit proposals only. Pending owner review on return.

---

## Tab 1: Conceptual Model

**Renderer:** `src/components/ConceptualMatrix.tsx` (76 lines, static React component with hardcoded copy).
**Content source:** Hardcoded in the component (NO markdown file backing this tab).
**Activation path:** `MatrixDashboard.tsx:565` calls `<ConceptualMatrix />`.

### Current content summary
- Heading: "Conceptual Model: 2x2 Matrix Framework"
- Intro: "A high-level visual architecture of the four primary sediment derivation pathways, establishing the foundation for structural policy review."
- 4 quadrant cards in a 2x2 grid:
  1. **Ecological: Direct Contact** -- benthic invertebrates, EqP + AVS methodologies.
  2. **Ecological: Food Web** -- higher trophic-level aquatic life and wildlife, BSAF + trophic transfer.
  3. **Human Health: Direct Contact** -- dermal absorption + incidental ingestion during recreational/occupational activities.
  4. **Human Health: Food Web** -- human populations reliant on aquatic environments; specialized modifiers for high-volume Indigenous traditional food consumption.

### Gaps observed
- **No scope label.** The tab does not indicate that it serves Phase 2 (2026) of the project. A new TWG member opening this tab does not see the same scope orientation they now see in The Guide (per Stream A).
- **No HITL workflow integration mention.** The conceptual model is purely descriptive; it does not point to how the pathway taxonomy maps to the Calculator pathways (`eco-direct-eqp`, `eco-food-bsaf`, `hh-direct-contact`, `hh-food-web`). A reader cannot navigate from quadrant to corresponding Calculator tab.
- **Wording drift risk for HH: Food Web.** Current text says "specialized modifiers for high-volume Indigenous traditional food consumption rates" -- this is technically accurate but uses procedural-tone phrasing ("modifiers") that could be tightened. The Framework_HumanHealth.md draft uses the same language; the two are consistent but both have a slight modeling-jargon tone.
- **No cross-tab links.** The Conceptual Model is the foundational tab; it could legitimately point readers at "see Jurisdictional Frameworks for methodology comparison" and "see Calculator for pathway-specific computations". The current quadrant text is self-contained but inert.

### Recommended edits (for owner review)
**Severity: P2-P3 (light-touch quality improvements; no blockers).**

1. **Scope label (P3):** Add a brief subtitle or footer line: "Phase 2 of the BC Sediment Standards Project (2026 scope)."
2. **Cross-references (P3):** Add a one-sentence "Where to go next" paragraph below the 2x2 grid: "Use Jurisdictional Frameworks to compare how other programs approach each pathway, then test specific values in the Calculator."
3. **Voice / accessibility (P3):** Add `aria-label` or section landmark to the 2x2 grid for screen-reader navigation. Per recent calculator commits, accessibility baseline was raised.
4. **No content changes** to the four quadrant descriptions themselves -- they are accurate and aligned with the corresponding Calculator pathway codes. Defer any wording overhaul until owner approves.

### Owner question
Does the Conceptual Model need a comprehensive overhaul (rewrite quadrant copy), or is the targeted P3 polish above sufficient for 2026 Phase 2 completion?

---

## Tab 2: Jurisdictional Frameworks

**Renderer:** `MatrixDashboard.tsx:543` -- renders 3 markdown drafts via `<MathRenderer />`, switchable via 3 side-tabs.
**Content source:** Three markdown files at `matrix_research/content_drafts/`:
- `CaseStudy_EqP_AVS.md` -- for side-tab "Ecological: EqP & AVS"
- `CaseStudy_BSAF.md` -- for side-tab "Ecological: Food Web (BSAF)"
- `Framework_HumanHealth.md` -- for side-tab "Human Health Pathways" (54 lines; technically dense; covers WQCIU + Health Canada wetted-sediment dermal mechanics)
**Activation path:** `MatrixDashboard.tsx:415-432` renders the side-tab list; `MatrixDashboard.tsx:543-558` renders the corresponding markdown.

### Current content summary
Each draft is a methodology reference document with mathematical formulations + citations. Not user-action content; pure read-only reference material.

- **CaseStudy_EqP_AVS.md** -- Equilibrium partitioning + AVS/SEM methodology comparison.
- **CaseStudy_BSAF.md** -- Biota-Sediment Accumulation Factor methodology + trophic transfer.
- **Framework_HumanHealth.md** -- WQCIU framework + Athabasca Chipewyan First Nation 388 g/day Indigenous traditional food consumption parameter + Health Canada wetted-sediment dermal adherence factor scaling.

### Gaps observed
- **No scope label.** None of the three drafts indicates Phase 2 (2026) framing. A reader cannot tell if these documents are stable reference material or in-flight.
- **No "purpose" intro orienting the reader.** Each draft jumps directly into methodology equations. A new TWG member reading cold has no guide to what they are about to read.
- **No cross-links to the Calculator.** Framework_HumanHealth.md describes the 388 g/day Indigenous fish ingestion rate parameter but does not link the reader to the corresponding Calculator surface (`hh-food-web` pathway).
- **The currently-active side-tab banner** (rendered above the markdown content per MatrixDashboard.tsx:551-554) is informational but vague: "Currently reviewing the [side-tab] methodology. Scroll to locate specific jurisdictional derivations within the document below." Could be tightened to indicate scope + reading time.
- **One side-tab labelled "Jurisdictional Quick Reference"** is rendered in the right panel (renderToolReference, lines 520-538) but contains only generic guidance ("Start with the selected pathway group", etc.) -- not jurisdiction-specific quick lookups.

### Recommended edits (for owner review)
**Severity: P2-P3 (content-only polish; no blockers).**

1. **Add a 2-3 sentence "Purpose" intro to each of the 3 drafts (P2).** Example for Framework_HumanHealth.md:
   > **Purpose:** This framework outlines the mathematical modifications required to adapt standard human health risk assessment equations to two specific contexts: (1) populations reliant on traditional subsistence foraging, and (2) wetted-sediment dermal contact in aquatic environments. Reference for the Phase 2 (2026) Matrix Sediment Standards Derivation Options Analysis.
2. **Add cross-link to Calculator at end of each draft (P3).** Example:
   > **See also:** Test specific values for this pathway in the Calculator tab (`eco-direct-eqp` / `eco-food-bsaf` / `hh-food-web`).
3. **Tighten the side-tab activation banner (P3):** "Reviewing [side-tab] methodology. Scroll for jurisdictional derivations." (drops the "Currently" lead-in and "Locate specific" verbosity).
4. **Verify Indigenous-content tone (P2).** Framework_HumanHealth.md treats the 388 g/day parameter as a technical mathematical modifier. Per `feedback_no_tier_judgment_for_ai.md`: Indigenous-uses content is pathway-relevant evidence with a UI badge. The Framework_HumanHealth.md tone is technical (not procedural / not consultation-framing), which is correct -- but a careful read by the owner is recommended to confirm voice.

### Owner question
Do the three Jurisdictional Frameworks drafts need new methodology content added (e.g., additional jurisdictions covered), or is targeted polish + cross-links the right scope for 2026 Phase 2 completion?

---

## Tab 3: TWG Review

**Renderer:** `src/components/TWGReviewPortal.tsx` (>600 lines; complex React component with Supabase write path).
**Content source:** The "BC Matrix Options Paper Final Draft" markdown at `matrix_research/options_paper/BC_Matrix_Options_Paper_FINAL_DRAFT.md` plus 8 supporting section files (`00_Master_Outline.md` through `07_Next_Steps.md`).
**Activation path:** `MatrixDashboard.tsx:571` calls `<TWGReviewPortal finalDraftContent={finalDraftContent} ... />`.

### Current content summary
- Workflow surface: TWG members read the rendered paper, leave per-heading comments via textareas (max 5000 chars per heading), drafts saved to localStorage with key `twg-matrix-review-draft-v3`.
- Submit flow writes to Supabase (component imports `createClient` from `@/lib/supabase/client`).
- Heading parser extracts `## ...` headings from the markdown; comments are keyed by heading index for stability across draft format changes.
- Storage key version `v3` because the paper expanded from 7 H2 sections (1.0-7.0) to 11 (adds Appendices A-D); v2 drafts intentionally discarded on first mount.

### Gaps observed
- **No tab-level scope label visible** in the rendered TWG Review portal. The paper itself is Phase 2 / 2026 content, but the wrapper does not say so explicitly.
- **No reviewer onboarding paragraph** in the portal. A new TWG member opens the tab and sees the paper rendered + comment boxes. There is no "How to give effective feedback" pointer in the portal itself (Stream A added a light "Where to record feedback" pointer in The Guide Section 7, but that is in The Guide, not in TWG Review).
- **Submission state behavior** -- the portal has `isSubmitted` + `isSubmitting` flags, but the user-visible feedback after submit is not visible from a 100-line read. Worth confirming the submit-confirmation message is clear and that the per-heading drafts are NOT discarded on submit (only on storage-key version bump).
- **Draft autosave granularity** -- localStorage save on every keystroke vs debounced is not visible from the 100-line read. Could be a UX concern for large reviews (many drafts, large chars).
- **The paper itself** (`BC_Matrix_Options_Paper_FINAL_DRAFT.md`) -- per the storage-key v3 comment, was rewritten with the Smart Stagger phasing in Section 7.0 and expanded with Appendices A-D. Last commits touched it; assumption is the paper is current and stable. No audit recommended unless owner has specific concerns.
- **No "review complete" or "pending review" indicator** visible at the tab level. TWG members might not know what their review status is across sessions.

### Recommended edits (for owner review)
**Severity: P2-P3 (UX polish + onboarding; no blockers).**

1. **Reviewer onboarding section (P3):** Add a collapsible "How this works" panel at the top of the portal (default collapsed):
   > **How TWG Review works:** Read each section of the paper below. Use the comment textarea after each heading to record technical input. Your drafts auto-save locally; click Submit at the bottom to send all comments to the project record. You can return and edit drafts before submitting.
2. **Scope label (P3):** Add "Phase 2 (2026) Options Paper" near the top of the portal.
3. **Submit-confirmation review (P2):** Confirm in the TWGReviewPortal that submit triggers a clear "Submitted" state visible to the user, and that drafts are preserved post-submit (for re-editing if owner permits). The 100-line read did not reach the submit flow; a deeper read is recommended.
4. **Audit autosave cadence (P3):** Confirm autosave does not fire on every keystroke (would burn localStorage writes); recommend debouncing 500ms.
5. **Paper currency check (P2):** Confirm with the owner that `BC_Matrix_Options_Paper_FINAL_DRAFT.md` is the current intended state, given the v3 storage-key bump and Smart Stagger refactor mentioned in the comment header.

### Owner question
Does the TWG Review portal need a comprehensive UX redesign (e.g., per-section commitment tracker, draft sharing, submit-then-edit flow), or is targeted onboarding + scope label sufficient for 2026 Phase 2 completion?

---

## Cross-cutting observations

### Pattern: missing scope labels across all three tabs
The Guide (Stream A) added explicit `(2026 scope)` / `(2027 scope)` labels to the tab list. The other three 2026 tabs do NOT carry this scope orientation. Owner could add a header banner at the dashboard level (`MatrixDashboard.tsx` near line 230 where TABS is defined) that surfaces scope labels everywhere a tab is referenced, OR add scope labels inline in each tab's content surface.

### Pattern: HITL workflow handoff
The Guide now covers HITL workflow with the Evidence Library (Stream A Section 6). The other 2026 tabs do not currently point readers toward the Evidence Library when they encounter parameter values or source citations. If 2026 scope completion includes evidence-library integration across all 2026 tabs, that is a substantial new feature (likely warranting its own work stream, not a P3 polish). (Note: 3 of the 6 Evidence Library workflows described in Section 6 are UI-complete but not yet persisted -- `catalog_sources`, `catalog_evidence_items`, and `source_lead_triage` migrations are pending; see The Guide Section 6 persistence-status caveat added 2026-05-28.)

### Pattern: cross-tab navigation
None of the 2026 tabs explicitly link to other tabs. A new TWG member reading The Guide -> Conceptual Model -> Jurisdictional Frameworks -> Calculator -> TWG Review flow has no in-content guidance for that order. Stream A added a "typical 2026 review flow" sentence to The Guide; the other 2026 tabs could echo it or provide tab-specific next-step guidance.

---

## Recommended Phase 2 next steps (post-Stream A)

Per the multi-week plan Phase 2 (Weeks 2-3), the work is:

**Definition of Done for Phase 2 (proposed):**
- Stream A complete (The Guide gap-fill landed + reviewed). [In flight as of 2026-05-27.]
- This assessment doc reviewed by owner.
- Owner decides scope of refresh for each of the three other 2026 tabs: NONE (defer to 2027) / P3 polish only / substantive content update.
- Any in-scope edits applied via the same Stream-A-style targeted gap-fill methodology: sonnet subagents for implementation, Opus adversarial subagent for review (codex CLI fallback), 4 gates GREEN before push, path-scoped staging.
- A single follow-up commit (or small commit series) per tab, on `main` (or feature branches if owner prefers).

**If owner chooses NONE for all three (defer to 2027):**
- Phase 2 is complete with Stream A alone.
- The multi-week plan can proceed to Phase 3 (Stream D autonomous catalog agent).

**If owner chooses P3 polish for all three:**
- Estimated 1-2 sessions of work (per tab); content-only changes, no code refactors.
- Each tab refresh would follow the Stream A pattern (subagent edit, Opus review, gates, push).

**If owner chooses substantive update for any:**
- Out of scope for the current plan; surface as a new work stream and re-plan.

---

## Stop conditions respected
- No code changes made during this assessment.
- No content edits made to the three other 2026 tabs.
- No HITL gates violated.
- Path-scoped: only this one new file authored at repo root.

---

*Authored autonomously by Opus 4.7 main session on 2026-05-27, after Stream A The_Guide.md edits landed and round-2 Opus adversarial review reached mutual-agreement GREEN. Pending owner review on return.*
