# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Unfamiliar public visitors** arriving at `/`. They do not know what the Sediment Standards
  Project is. Their job is to understand what this project is, who is behind it, and whether it
  is credible. Owner-confirmed: the landing page serves this audience and returning members
  together ("mixed public + members").
- **SSTAC and TWG members** (`member` role, auto-assigned on signup). Returning users who need
  fast entry into the dashboard. Their jobs: respond to polls and surveys, complete the
  structured white paper review, read and discuss documents. Source: `README.md` lines 132,
  262-264, 372-378.
- **Administrators** (`admin` role, verified server-side against the `user_roles` table, never
  cached client-side). Manage users, content, polls, milestones, and catalog data. Source:
  `src/lib/admin-utils.ts` lines 3-7, 17-20, 45-59.
- **Matrix Map administrators** (`matrix_admin`), a second admin tier scoped to Matrix Map
  surfaces. `MATRIX_MAP_ADMIN_ROLES = ['admin', 'matrix_admin']`, `src/lib/admin-utils.ts` line 15.
  The exact permission delta versus full `admin` is not documented in-repo (open decision).
- **CEW conference attendees**, unauthenticated. They vote in conference polls via a shared
  access code, with no account, one vote per device, no vote changing. Source: `README.md`
  lines 142-153, 236-251, 586-590; `src/lib/auth/route-access.ts` lines 8-11, 27-32.

## Product Purpose

A working platform for the Science and Standards Technical Advisory Committee (SSTAC) and the
Technical Working Group (TWG) developing a scientific framework to modernize British Columbia's
Contaminated Sites Regulation sediment standards. Source: `README.md` line 3, `src/app/page.tsx`
lines 23-27 and 58-63, `docs/AGENTS.md` line 12.

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
lines 58-63, `CLAUDE.md` Project Identity.

## Operating Context

- Real-world stakeholders: SABCS, the BC Ministry of Environment and Parks, SSTAC, the TWG, and
  Canadian Ecotoxicity Workshop (CEW) attendees.
- The documented workflow: stakeholder polls and surveys -> a structured TWG white paper review
  (Parts I-V plus Appendices C and D, implemented as 12 form parts) -> synthesis and results
  pages -> administrator review and moderation. Source: `README.md` lines 76-80;
  `src/app/(dashboard)/twg/review/parts/*`.
- "Professional appearance suitable for government stakeholders" is an existing stated target.
  Source: `docs/AGENTS.md` line 529.
- Surface inventory (authenticated `(dashboard)` group unless noted): `/dashboard`,
  `/matrix-options`, `/matrix-map`, `/survey-results` (plus `/holistic-protection`,
  `/tiered-framework`, `/prioritization`), `/cew-2025`, `/cew-results`, `/twg/review`,
  `/twg/documents`, `/twg/discussions`, `/twg-results`, `/wiks`, `/bn-rrm`,
  `/regulatory-review`, `/hitl-packets`, `/demo-matrix-graph`, and `/admin` with sixteen
  subpages. Public: `/`, `/login`, `/signup`, and `/cew-polls/*`.

## Capabilities and Constraints

- Authentication gating is enforced by server middleware and is authoritative;
  `src/lib/auth/route-access.ts` holds `GATED_ROUTE_PREFIXES` and `PUBLIC_ROUTES`. A client-side
  guard in `Header.tsx` is a secondary safety net, not the gate.
- Since a 2025-01-31 simplification, authenticated dashboard pages require login only, with no
  further role check, except administrator surfaces. Source: `README.md` lines 69-74, 302-307.
- Data sources: Supabase for authentication, matrix-map data, polls, documents, discussions, and
  lane-2b judgments; plus a read-only SQLite regulatory policy database held outside this repo.
  Row Level Security is enforced on poll, document, and discussion tables.
- Human-in-the-loop-only actions, which automation must never perform: writing assessment
  verdicts, promoting or mutating the default-policy evidence library, and mutating the reference
  catalogs under `src/data/`. Source: `CLAUDE.md`.
- Light and dark themes are an existing product commitment across all pages, with the user's
  preference persisted. Source: `README.md` lines 122-127, 252-257.
- Volatile metrics (user counts, engagement numbers, poll totals) must be read from
  `docs/_meta/docs-manifest.json` facts, never estimated or invented. Source: `docs/INDEX.md`
  lines 9-11.

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
  requirement here rather than a conformance failure.
- `MatrixMapMobileFallback.tsx` deliberately replaces the Interactive Map with a "needs a wider
  viewport" notice below 768px. That is a design decision, not a defect, but it means a core
  Matrix Options surface is currently unusable on a phone. Whether that stays true is an OPEN
  product decision for the owner, not something a UI pass should change unilaterally.

## Exposure Scenarios

Owner-stated 2026-08-14. This is load-bearing product truth and earlier design work got the
terminology wrong (it invented a "receptor scenario" control that does not exist).

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

## Open Decisions

Recorded, not invented:

- Whether an external accessibility obligation legally applies (see above).
- The exact permission difference between `matrix_admin` and `admin`.
- Whether `/regulatory-review` and `/hitl-packets` are stakeholder-facing surfaces or internal
  engine tooling that should not appear in stakeholder navigation.
- Whether the "SSTAC & TWG Dashboard" wordmark is fixed or open to change.
