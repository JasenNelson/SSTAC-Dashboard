# Matrix-Options -- product context and direction (owner-stated, 2026-08-16)

Written because two sessions of defect remediation ran without this context, and the priorities
that follow from it are materially different from the ones a defect list implies.

## Who this is for, in the owner's words

- The page serves the **Technical Working Group**: scientists and experts collaborating on
  developing sediment standards.
- **There is no sign-off.** Nobody signs their name to what leaves this page. It is a
  collaborative tool for information sharing and working together.
- Ownership: this is the OWNER'S PERSONAL WEBSITE, with subscriptions covered by SABCS (Science
  Advisory Board for Contaminated Sites) for the purpose of the project SABCS leads and owns.
  The owner is an SABCS volunteer AND the government sediment standards lead, leading the
  collaboration. **It is NOT an official government website.**

### What follows from that, and what it corrects

An earlier framing in session 2 recommended prioritising export/print fidelity on the grounds of
"QP producing defensible output". **That framing was WRONG and the owner corrected it.** With no
sign-off, print fidelity and provenance-for-signature are NOT the product. What matters is what
helps a group of experts work together:

- **Deep-linking / shareability moves UP.** In a working group, "look at this record" is a core
  interaction. Today NOTHING on References & Values, SSD Workbench or Phase 2 is URL-addressable
  (no `useSearchParams` in any of them), so no finding can be pointed at.
- **Export moves UP, but as SHARING, not as evidence.** The artifact needs to leave the page and
  reach a colleague.
- **Print fidelity moves DOWN** relative to how session 2 treated it. The print-clipping work was
  still worth doing -- a clipped table silently misrepresents data -- but it is not the frontier.

## The deliverables this page serves

Named in The Guide's Gantt chart:

1. **Matrix Options Paper**
2. **An aquatic/sediment database**
3. **An input parameter catalogue**

### The consequence nobody has acted on

**References & Values IS deliverable 3.** That surface holds 1,783 parameter values and 43
sources -- it is the input parameter catalogue. And:

- It has **NO export of any kind** (verified: zero hits for csv/download/clipboard across
  `EvidenceLibrary.tsx`), while SSD Workbench next door has working CSV **and** JSON export.
- The owner's own assessment: previous sessions "really seemed to miss the References and Values
  section." Session 2 fixed print-clipping INSIDE it without ever asking what it is for.

For a catalogue whose entire purpose is to be a shared artifact among a working group, having no
way to export it is the most consequential gap on the page.

**The Interactive Map serves deliverable 2** (aquatic/sediment database). The owner reports it is
VERY SLOW and suspects inefficient SQL loading. A diagnosis was commissioned in session 2 --
check for its findings before assuming the cause.

## The structural finding from the surface inventory

Each of the 8 tabs was built to a DIFFERENT standard. No surface contract was ever set, so each
got whatever its PR happened to include:

| Surface | Export | Persistence | Deep-link |
|---|---|---|---|
| SSD Workbench | CSV + JSON | NONE -- a configured run dies on reload | no |
| References & Values (1,783 records) | NONE | Supabase Saved Views | no |
| 6 Calculators | NONE | NONE | no |
| Interactive Map | CSV, ADMIN-ONLY | -- | no |

A user learns "I can save my work here" on one tab and loses it on the next. That inconsistency,
not any single missing feature, is what a TWG member actually runs into.

## Owner's chosen sequence (2026-08-16)

1. **This session**: a bit of audit remediation, then hand off.
2. **Fresh session**: finish audit remediation (7 P1 + 19 P3 remain from the round-2 audit, plus
   the print-clipping backlog), THEN start work on a **surface-contract plan** -- decide what
   every analytical surface must support (export, persist, deep-link) and level the tabs to it.

## Three items that are defects, not options

Found by the surface inventory, none previously triaged:

1. `src/components/matrix-options/PartialVisibilityBanner.tsx:13` -- the "contact admin" path is a
   `mailto:` to a HARDCODED personal address, with a comment admitting no admin-contact convention
   exists. Lower severity than it first appears (it is the owner's own personal site), but it
   should be configuration, not a literal.
2. `src/components/matrix-options/SsdWorkbench.tsx:56` -- `OWNER_REPORTED_ECOTOX_ROWS = 582125` is
   a baked-in constant rendered beside the genuinely LIVE mirror row count (`:1568-1571`). It is
   caveated in code but trivially mistaken for live data.
3. `MatrixMapLeftPanel` -- CSV export is admin-gated, so an ordinary TWG member cannot export
   their own map selection. For a collaboration tool this is arguably backwards.

## One functional cliff

`MatrixMapMobileFallback.tsx` -- below 768px the entire Interactive Map (Supabase RPC, Leaflet,
selection stats, measurement workbench, export) is replaced by a static "needs a wider viewport"
card. Not a degraded view; zero data. The spec'd read-only mobile summary was deferred to a
never-built PR. Worth weighing against how TWG members actually read this material.
