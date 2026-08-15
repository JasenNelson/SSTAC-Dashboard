# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Unfamiliar public visitors** arriving at `/`. They do not know what the Sediment Standards
  Project is. Their job is to understand what this project is, who is behind it, and whether it
  is credible. Owner-confirmed: the landing page serves this audience and returning members
  together ("mixed public + members"). (OWNER-STATED)
- **SSTAC and TWG members** (`member` role, auto-assigned on signup). Returning users who need
  fast entry into the dashboard. Their jobs: respond to polls and surveys, complete the
  structured white paper review, read and discuss documents. Source: `README.md` (auto-assign
  `member` role and CEW-conference content confirmed present; exact line numbers drift because
  `README.md` contains duplicated sections). (CODE-VERIFIED, content confirmed; cited line
  numbers approximate)
- **Administrators** (`admin` role, verified server-side against the `user_roles` table, never
  cached client-side). Manage users, content, polls, milestones, and catalog data. Source:
  `src/lib/admin-utils.ts` lines 3-7, 17-20, 45-59 (verified: header comment lines 1-7, function
  doc/throttle lines 12-21, `user_roles` query lines 45-59). (CODE-VERIFIED)
- **Matrix Map administrators** (`matrix_admin`), a second admin tier scoped to Matrix Map
  surfaces. `MATRIX_MAP_ADMIN_ROLES = ['admin', 'matrix_admin']`, `src/lib/admin-utils.ts` line 15
  (exact match). The exact permission delta versus full `admin` is not documented in-repo (open
  decision). (CODE-VERIFIED)
- **CEW conference attendees**, unauthenticated. They vote in conference polls via a shared
  access code, with no account, one vote per device, no vote changing. Source: `README.md`
  (CEW conference polling, shared access code, and device-based one-vote-per-device content
  confirmed present); `src/lib/auth/route-access.ts` `PUBLIC_ROUTES` includes `/cew-polls`
  (verified, see route-access.ts below). (CODE-VERIFIED; README line numbers approximate)

## Product Purpose

A working platform for the Science and Standards Technical Advisory Committee (SSTAC) and the
Technical Working Group (TWG) developing a scientific framework to modernize British Columbia's
Contaminated Sites Regulation sediment standards. Source: `README.md` line 3 (verified: "A
comprehensive dashboard platform for the ... SSTAC ... and TWG"), `src/app/page.tsx` lines 23-27
and 58-63 (verified: "Sediment Standards Project" hero heading; SABCS/BC Ministry partnership
paragraph), `docs/AGENTS.md` line 12 (verified). (CODE-VERIFIED)

Success for a member is participating: a poll answered, a white paper review part completed, a
document found, a discussion joined. Success for an administrator is data and content that stay
trustworthy. Success for a first-time public visitor is understanding the project well enough to
trust it and, where relevant, to join it.

## Positioning

The mechanism a neighbouring product could not truthfully copy: this is the working surface of an
actual regulatory-science collaboration between the Science Advisory Board for Contaminated Sites
(SABCS) and the BC Ministry of Environment and Parks. The calculators, evidence library, and maps
operate on real regulatory provenance (Protocol 28 evidence compilation, cited toxicity reference
values, human-in-the-loop verdicts) rather than on illustrative data. Source: `src/app/page.tsx`
lines 58-63 (verified), `CLAUDE.md` Project Identity (verified). (CODE-VERIFIED)

## Operating Context

- Real-world stakeholders: SABCS, the BC Ministry of Environment and Parks, SSTAC, the TWG, and
  Canadian Ecotoxicity Workshop (CEW) attendees.
- The documented workflow: stakeholder polls and surveys -> a structured TWG white paper review
  (Parts I-V plus Appendices C and D, implemented as 12 form parts) -> synthesis and results
  pages -> administrator review and moderation. Source: `README.md` lines 76-80;
  `src/app/(dashboard)/twg/review/parts/*` (verified: exactly 12 files, `Part1...` through
  `Part12...`, confirmed by directory listing). (CODE-VERIFIED, part count confirmed exactly)
- "Professional appearance suitable for government stakeholders" is an existing stated target.
  Source: `docs/AGENTS.md` line 529 (verified exact text: "**Professional appearance** suitable
  for government stakeholders"). (CODE-VERIFIED)
- Surface inventory (authenticated `(dashboard)` group unless noted): `/dashboard`,
  `/matrix-options`, `/matrix-map`, `/survey-results` (plus `/holistic-protection`,
  `/tiered-framework`, `/prioritization`), `/cew-2025`, `/cew-results`, `/twg/review`,
  `/twg/documents`, `/twg/discussions`, `/twg-results`, `/wiks`, `/bn-rrm`,
  `/regulatory-review`, `/hitl-packets`, `/demo-matrix-graph`, and `/admin` with sixteen
  subpages. Public: `/`, `/login`, `/signup`, and `/cew-polls/*`. `/matrix-options` is
  confirmed GATED (authenticated) in `src/lib/auth/route-access.ts` `GATED_ROUTE_PREFIXES`,
  which also lists `/dashboard`, `/twg`, `/survey-results`, `/cew-2025`,
  `/regulatory-review`, `/bn-rrm`, `/demo-matrix-graph`; `PUBLIC_ROUTES` there confirms `/`,
  `/login`, `/signup`, `/cew-polls`. The "sixteen `/admin` subpages" and full route list were
  not individually recounted against the file tree. (CODE-VERIFIED for the routes named in
  `route-access.ts`; UNVERIFIED for the exact "sixteen" admin-subpage count and the remaining
  unlisted routes such as `/cew-results`, `/twg-results`, `/wiks`, `/hitl-packets`)

## Capabilities and Constraints

- Authentication gating is enforced by server middleware and is authoritative;
  `src/lib/auth/route-access.ts` holds `GATED_ROUTE_PREFIXES` and `PUBLIC_ROUTES` (both exist,
  verified, content listed above). A client-side guard in `Header.tsx` is a secondary safety
  net, not the gate. (CODE-VERIFIED)
- Since a 2025-01-31 simplification, authenticated dashboard pages require login only, with no
  further role check, except administrator surfaces. Source: `README.md` lines 69-74, 302-307
  (verified: README documents a 2025-01-31 "TWG Review Access & Authentication Improvements"
  entry stating "Simplified Access Control" / authentication-only for non-admin dashboard
  pages). (CODE-VERIFIED)
- Data sources: Supabase for authentication, matrix-map data, polls, documents, discussions, and
  lane-2b judgments; plus a read-only SQLite regulatory policy database held outside this repo.
  Row Level Security is enforced on poll, document, and discussion tables. CORRECTED
  2026-08-14: verified only in part. `document_reviews` has confirmed RLS
  (`supabase/migrations/20260517_document_reviews.sql` line 73,
  `ALTER TABLE public.document_reviews ENABLE ROW LEVEL SECURITY;`) (CODE-VERIFIED). The
  `polls`, `poll_votes`, `ranking_polls`, `ranking_votes` tables and any `discussions` table
  do NOT appear anywhere in `supabase/migrations/*.sql` (zero matches for "polls" or
  "discussions" across the migrations directory) -- these tables predate this repo's tracked
  migration history (the README dates the polling feature to well before the earliest tracked
  migration) and were evidently created directly in Supabase, so their RLS status cannot be
  confirmed from the codebase. Mark as UNVERIFIED for the poll and discussion tables
  specifically, not FALSE -- RLS may well be enabled in the live database; there is simply no
  in-repo evidence either way.
- Human-in-the-loop-only actions, which automation must never perform: writing assessment
  verdicts, promoting or mutating the default-policy evidence library, and mutating the reference
  catalogs under `src/data/`. Source: `CLAUDE.md` (verified, "What AI Must Never Do" section).
  Note: `src/data/` currently contains only a `bn-rrm/` subdirectory in this checkout; no
  Matrix Options catalog files were found directly under `src/data/` at audit time
  (UNVERIFIED where the Matrix Options reference catalogs physically live -- not contradicting
  the rule itself, which is a CLAUDE.md policy statement, but worth a follow-up if a reader
  goes looking for those files under `src/data/`). (CODE-VERIFIED for the rule; UNVERIFIED for
  file location)
- Light and dark themes are an existing product commitment across all pages, with the user's
  preference persisted. Source: `README.md` lines 122-127, 252-257 (verified: theme system and
  localStorage persistence documented; also independently confirmed in
  `src/contexts/ThemeContext.tsx`, which persists to `localStorage.setItem('theme', theme)`).
  (CODE-VERIFIED)
- Volatile metrics (user counts, engagement numbers, poll totals) must be read from
  `docs/_meta/docs-manifest.json` facts, never estimated or invented. Source: `docs/INDEX.md`
  lines 9-11 (verified: "Docs manifest (authoritative)" and the facts/facts_history policy
  paragraph). (CODE-VERIFIED)

## Brand Commitments

Owner-confirmed 2026-08-14: **none are binding**. There is no logo file, no mandated palette, no
typography standard, and no external style guide.

The incumbent slate-and-sky treatment is not accidental, but it is also not a chosen identity.
The owner reports it was selected as the least-bad option after prior AI sessions produced worse
alternatives: it survived by elimination, not by intent. The owner has explicitly cleared it for
replacement, starting with the landing page and the Matrix Options surfaces. Treat the current
palette as evidence of what has been tolerated, not as a commitment to preserve.

The one durable name in use is the wordmark text "SSTAC & TWG Dashboard"
(`src/components/Header.tsx` lines 118-121, `src/app/page.tsx` line 13). The owner did not mark it
as binding, so treat renaming as a question to ask rather than an assumption either way.
Verified: `src/app/page.tsx` line 13 renders the exact literal string
`SSTAC & TWG Dashboard`. `Header.tsx` lines 118-121 are the header's `authLoading && !session`
branch and render the same text split across two lines ("SSTAC & TWG" / "Dashboard"), not a
single-line literal -- the same wordmark content, different markup. (CODE-VERIFIED)

## Evidence on Hand

Real, in-repo, and usable without invention:

- Poll and ranking data model with result views (`polls`, `poll_votes`, `ranking_polls`,
  `ranking_votes`), `README.md` lines 228-234, 546-566.
- The twelve-part TWG white paper review form with real field definitions,
  `src/app/(dashboard)/twg/review/parts/`.
- BN-RRM pack and artifact contract, `docs/bn-rrm/README.md`.
- Matrix Options and Matrix Map status and provenance documentation,
  `docs/MATRIX_OPTIONS_STATUS.md`.

Absences that design work must NOT fabricate: named testimonials or endorsements, participant or
user counts, engagement statistics, completion percentages, timelines beyond what project docs
state, partner logos, and any claim of regulatory adoption or approval.

## Product Principles

1. **Real provenance over illustrative content.** Every number on screen traces to a cited source
   or a manifest fact. Placeholder data that looks authoritative is a defect, not a mockup.
2. **Judgment stays human.** The product surfaces evidence and lets qualified people decide; it
   never presents a machine-made verdict as a determination.
3. **Two audiences, one front door.** The landing page must explain the project to a stranger and
   get a member to work quickly, without either job degrading the other.
4. **Credibility is the currency.** This represents a government-partnered scientific
   collaboration; anything that reads as generic, decorative, or unserious costs trust.
5. **Nobody is locked out.** Usability for screen-reader, keyboard-only, and low-vision users is
   treated as a functional requirement, not a finishing touch.

## Accessibility & Inclusion

Owner decision 2026-08-14: accessibility problems are treated as **must-fix**, ranked alongside
functional defects rather than as cosmetic polish. This covers, at minimum: sufficient text
contrast against backgrounds, complete keyboard operability with visible focus, accessible names
on every control and form field, and status never signalled by color alone.

No formal conformance level has been adopted as a contractual obligation. The practical working
bar is WCAG 2.1 Level AA, chosen because it is the level public-sector accessibility rules
normally reference and because the project is partnered with the BC Ministry of Environment and
Parks. Whether BC accessibility legislation legally binds a SABCS/Ministry-partnered site is an
OPEN question the owner has not confirmed.

## Mobile

Owner requirement 2026-08-14: the site must be mobile friendly. This is a stated product
requirement, not a nice-to-have, and it applies to public and member-facing pages alike. The
landing page in particular is a public entry point that will be opened on phones.

Status as of the 2026-08-14 review: the responsive dimension scored 3/4 on the landing page and 2/4
on Matrix Options, but both scores were inferred from breakpoint classes in the SOURCE and were NOT
verified by rendering at real viewport widths. Treat them as unconfirmed until a viewport check is
run. Two known constraints are real regardless:

- Touch targets below the 44px working bar on the landing theme toggle and on the Matrix Options
  tab bar and panel toggles. These clear the WCAG 2.5.8 24px floor, so they are a usability
  requirement here rather than a conformance failure. (UNVERIFIED -- not independently
  re-measured this sweep; consistent with the "not verified by rendering at real viewport
  widths" caveat stated above)
- `MatrixMapMobileFallback.tsx` deliberately replaces the Interactive Map with a "needs a wider
  viewport" notice below 768px. That is a design decision, not a defect, but it means a core
  Matrix Options surface is currently unusable on a phone. Whether that stays true is an OPEN
  product decision for the owner, not something a UI pass should change unilaterally. Verified:
  `MatrixMapMobileFallback.tsx` checks `window.innerWidth < 768` and its copy reads "Use a
  desktop or tablet (768px or wider) for the full interactive map." (CODE-VERIFIED)

## Exposure Scenarios

Owner-stated 2026-08-14. This is load-bearing product truth. (OWNER-STATED)

CORRECTED 2026-08-14 (adversarial UI QA audit): the sentence that used to appear here, claiming
earlier design work "invented a receptor scenario control that does not exist," was itself
false and has been removed. The receptor-scenario control DOES exist and is wired up:
`HHDirectContactCalculator.tsx` renders a `<select data-testid="hh-direct-receptor-scenario-select">`
(verified at line 697) and `HHFoodWebCalculator.tsx` renders the equivalent
`hh-food-receptor-scenario-select`; both drive real exposure-factor defaults via
`getSelectableFrameScenarios`, `getDefaultSelectableScenarioId`, and `getReceptorScenarioFrame`
from `src/components/matrix-options/guide/content/jurisdictions.ts`, and both have dedicated test
suites. (CODE-VERIFIED) See DESIGN.md's "Exposure scenario is a first-class control" section,
similarly corrected. What remains true and load-bearing is the EXPOSURE SCENARIO terminology
below, which is a distinct, broader product concept from the specific receptor-scenario select
control -- an exposure scenario is not fully represented by that one dropdown; the dropdown is
one piece of exposure-scenario infrastructure that already exists in the app.

An EXPOSURE SCENARIO describes how receptors are exposed to contaminants through specific pathways.
It carries two kinds of content:

- **Media-use considerations.** For example, residential land assumes all age groups, 24 hours a
  day, 365 days a year, for an entire lifetime.
- **Exposure assumptions**, which are wide-ranging.

Scenarios must be available BOTH as presets aligned to the exposure scenarios described in
Protocol 28, AND as customizable inputs. Presets differ along two axes:

- receptor type: human versus ecological
- media type: soil, sediment, water, air and vapour

Protocol 28 (January 2021 revisions, signed):
https://www2.gov.bc.ca/assets/gov/environment/air-land-water/site-remediation/docs/protocols/p28__jan_2021_revisions_final_signed.pdf

### Why Protocol 28 is not sufficient on its own

This is the crux of the project and must not be lost:

1. The current CSR sediment standards **do not include human health protection at all**.
2. Human-health sediment standards therefore have to draw on **soil** exposure scenarios as the
   closest available basis.
3. But the soil scenarios **do not include the food pathway**, which sediment work needs.

So Protocol 28 does not contain everything required. The project is developing genuinely new
sediment standards for a framework that does not currently exist. That is the whole purpose of the
work.

### Consequence for the interface

Because scenario assumptions will come from three different kinds of source, every assumption needs
visible PROVENANCE: taken directly from Protocol 28, adapted from a soil scenario, or novel to this
project. A derivation whose assumptions came from several places with no way to tell which is not
defensible to a reviewer. This is the same standard already applied to toxicity-value citations,
applied one level up to the scenario itself.

Preset values must be sourced from Protocol 28 and verified. They must never be invented, and a
preset whose value could not be sourced must say so rather than showing a plausible number.

## What the Calculator compares against

Owner correction 2026-08-14. Earlier design work in this session assumed the final step was a site
assessment. It is not.

**There should be no measured site concentration in this tool at all.** This product DERIVES
standards; it does not assess whether a particular sample is contaminated. Putting a site
concentration in the derivation confuses two different jobs.

The comparison that belongs here is between **the standard being derived** and **the existing CSR
Schedule 3.4 sediment numerical standards**. That answers the question the project actually asks: is
the standard we are deriving more or less stringent than what is currently in force, and by how much.

### Consequences

- The existing measured-concentration input in `BackgroundAdjustment.tsx`, and its
  `csAtOrBelowBackground` comparison, are conceptually misplaced for this workflow. They have NOT
  been removed - removing a live comparison is an owner decision, not a UI cleanup - but they should
  not be treated as the model for the final stage. Verified: both the `csAtOrBelowBackground`
  boolean and the input still exist in `BackgroundAdjustment.tsx`, now rendered in an explicitly
  unnumbered "Site Comparison" section (`data-testid="bg-adjust-site-comparison"`) outside the
  numbered derivation stages, with in-code comments stating it is "NOT A DERIVATION STAGE" and
  its role is "under review" -- i.e. the code has already been updated to match this product
  correction. (CODE-VERIFIED)
- The correct final stage needs the CSR Schedule 3.4 sediment numerical standards as data. Those are
  NOT in this codebase. `src/lib/regulatory-review/schedule3.ts` is CSR Schedule 2 and 3 professional
  SERVICES, an unrelated dataset that shares part of the name. Verified: the file's own header
  comment reads "CSR Schedule 2 & 3 Services organized by lifecycle stage... Based on BC
  Contaminated Sites Regulation (CSR 375/96) Schedule 2 (Director services) and Schedule 3
  (Approved Professional services)" -- confirming it is a services/fee-tier catalog
  (`Schedule3Service` records with `feeTierSimple`/`feeTierComplex`/`lifecycleStage`), not a
  numerical sediment-standards table. The literal string "Schedule 3.4" does appear in a
  handful of other files (`src/components/matrix-options/phase2Tasks.ts` and several
  `survey-results` pages), but only as planning/roadmap text -- e.g. phase2Tasks.ts Task 7,
  "Generic Standards Adoption Procedure and Schedule 3.4 Expansion Concept," a future work
  item, not a data table of numerical values. No actual Schedule 3.4 numerical standards data
  was found anywhere in the codebase during this sweep. (CODE-VERIFIED, both halves of the
  claim)
- Sourcing Schedule 3.4 is therefore its own task with the same discipline as the Protocol 28 preset
  work: values recorded with citations, verified, never invented, and a gap stated as a gap rather
  than filled with a plausible number.

## Open Decisions

Recorded, not invented:

- Whether an external accessibility obligation legally applies (see above).
- The exact permission difference between `matrix_admin` and `admin`.
- Whether `/regulatory-review` and `/hitl-packets` are stakeholder-facing surfaces or internal
  engine tooling that should not appear in stakeholder navigation.
- Whether the "SSTAC & TWG Dashboard" wordmark is fixed or open to change.
