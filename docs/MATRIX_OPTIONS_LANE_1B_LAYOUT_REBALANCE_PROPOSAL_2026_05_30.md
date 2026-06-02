# Lane 1b: References & Values layout rebalance -- design proposal (2026-05-30)

Status: PROPOSAL for owner approval. Per the Lane 1b directive ("Run /plan-design-review
before coding"), this is the design-review artifact; no layout code has been written. Prepared
autonomously while owner was away; reviewed by cursor-agent (gpt-5.3-codex-xhigh) as the
design critic. Plain ASCII.

## Problem (owner feedback 2026-05-30)

The "References & Values" view (`src/components/matrix-options/EvidenceLibrary.tsx`, ~3829
lines, one monolithic component) uses a 3-column flex layout:

- LEFT (`w-80`, 320px, toggle `showLeftPanel`): a scrollable "Catalog Dashboard" stack of
  NINE blocks -- AuditStrip, DefaultPolicyAuditPanel, Protocol28ReviewPanel,
  CrossPathwayAuditPanel, ZoteroStatusBadge, HitlSourcesSection, Saved Review Views (quick
  filters), PromotedCandidatesSection (+ the overall counts).
- CENTER (`flex-1`): header (title + counts + 6 view-mode tabs), search + facet filter bar
  (4-col grid), then the main tables/cards per view mode.
- RIGHT (`w-96`, 384px, toggle `showRightPanel`, `max-md:hidden`): the "Detail" inspector --
  renders `ValueDetailPanel` / `SourceDetailPanel` when a row is selected
  (`selectedValueId` / `selectedSourceId`), else an empty "Click a value or source to inspect
  details" placeholder. On `max-md` the detail instead renders inline in CENTER.

Two problems: (1) the LEFT panel is overloaded -- it mixes three unrelated jobs (summary
dashboards, navigation/saved-views, admin tools) in 320px; (2) the RIGHT panel is underused --
empty most of the time and entirely hidden below `md`.

## Design-review outcome (cursor-agent gpt-5.3-codex-xhigh, 2026-05-30)

The design critic recommended changing the default from pure Option A to **Option B-lite**
(LEFT = Saved Views; CENTER = a slim always-visible audit strip; RIGHT = heavy dashboard at
rest + detail on selection). Findings folded into this doc:

1. (High) Pure Option A removes the audit dashboard exactly when a user inspects a row -- a
   context-switch penalty. Keep a slim, always-visible audit strip (3-4 headline metrics) so
   audit context survives inspection. -> adopt Option B-lite as the recommendation.
2. (High) Mobile: the parent forces BOTH panels off (`MatrixDashboard.tsx:862` --
   `showLeftPanel={!isMobile && showLeftPanel}`, same for right). So "the existing left toggle"
   is NOT available on mobile; moving Saved Views to a left-only home loses it on mobile unless
   it is explicitly remapped into CENTER content on `max-md`.
3. (Medium) Discoverability: a right panel that swaps content on selection needs an explicit
   mode header ("Dashboard" vs "Inspecting value/source") + a persistent "Back to dashboard"
   action + a subtle transition cue. The Close button alone is insufficient.
4. (Medium) Density is reduced only if lower-priority/admin sections (HITL sources, Promoted)
   are collapsed by default -- apply Option C accordion behavior INSIDE B-lite.
5. (Medium) Technical corrections: "relocation only" is mostly true BUT Saved Review Views is
   inline JSX (not a standalone component), and `HitlSourcesSection` + `PromotedCandidatesSection`
   do NOT accept a `compact` prop -- they need a compact variant or a wrapper before moving.

## Design principle

Separate the three columns BY FUNCTION:

- LEFT = navigation + filtering only (light).
- CENTER = the data tables (unchanged) + search/filter bar.
- RIGHT = a context inspector that is ALWAYS useful: the catalog dashboard "at rest", the
  row detail when a row is selected.

## Recommended approach -- Option A: right panel does double duty

Give the RIGHT panel a real resting job so the LEFT panel can shed its dashboards.

LEFT panel keeps ONLY:
- Saved Review Views (quick filters) -- this is navigation, belongs on the left.
- (optional) a one-line active-filter summary / clear-all.

RIGHT panel becomes a two-state inspector:
- AT REST (no row selected): the catalog dashboard summary -- AuditStrip +
  DefaultPolicyAuditPanel + CrossPathwayAuditPanel + Protocol28ReviewPanel + ZoteroStatusBadge
  + HitlSourcesSection + PromotedCandidatesSection (the blocks moved off the left), in their
  existing `compact` mode.
- ON SELECTION: the current `ValueDetailPanel` / `SourceDetailPanel` (unchanged), with a
  "back to dashboard" affordance (clear selection) so the at-rest dashboard returns.

CENTER is unchanged except it gains horizontal room once LEFT is lighter.

Net effect: LEFT goes from 9 blocks to ~1, RIGHT is never empty (dashboard at rest, detail on
demand), and the audit surfaces are still one glance away.

```
 BEFORE                                   AFTER (Option A)
 +--------+------------------+-------+     +-----+---------------------+-----------+
 | 9-card |   tables         | empty |     |saved|   tables (wider)    | dashboard |
 | audit  |                  | "click|     |views|                     |  AT REST  |
 | + nav  |                  |  a row|     |     |                     |  -- or -- |
 | + admin|                  |  ..." |     |     |                     |  detail   |
 +--------+------------------+-------+     +-----+---------------------+-----------+
   320px        flex          384px         ~14rem      flex             384px
```

### Responsive

`max-md` already hides the right panel and renders detail inline in CENTER. Extend that: on
`max-md`, render the at-rest dashboard as a collapsible `<details>` ABOVE the tables (so small
screens still reach the audit summary), and keep inline detail on selection. The left "saved
views" collapses into the existing `showLeftPanel` toggle.

## Alternatives considered

- Option B (slim center strip): move only a compact one-row audit summary into a collapsible
  strip ABOVE the CENTER tables; move the heavier audit panels to the RIGHT at-rest state;
  LEFT keeps saved views + filters. More always-visible audit, but reintroduces some CENTER
  vertical cost. Good if the owner wants the headline counts visible while inspecting a row.
- Option C (least invasive): keep the LEFT structure but make each block a collapsible
  accordion (collapsed by default except Saved Views), and give the RIGHT panel the at-rest
  dashboard job only for the lightest summary. Lowest effort/risk; does not fully solve "left
  overloaded" because the blocks still live there.

Recommendation (REVISED after design-review): **Option B-lite** -- LEFT = Saved Views;
CENTER gains a slim, always-visible audit strip (the 3-4 headline counts from AuditStrip) above
the tables; RIGHT = the heavier dashboard panels at rest + row detail on selection, with admin
sections (HITL sources, Promoted) collapsed by default. This keeps audit context visible during
inspection (the main objection to pure A), still empties the LEFT of its 9-block overload, and
gives the RIGHT a real job. Pure Option A and Option C remain documented above as the
considered alternatives.

## Implementation notes (once approved)

- Most blocks are internal components in `EvidenceLibrary.tsx` (`AuditStrip` 678,
  `DefaultPolicyAuditPanel` 800, `Protocol28ReviewPanel` 876, `CrossPathwayAuditPanel` 1019,
  `ZoteroStatusBadge` 1744, `HitlSourcesSection` 2700, `PromotedCandidatesSection` 2615)
  rendered in the LEFT JSX (~3084-3172). MOSTLY relocation, but note: Saved Review Views is
  inline JSX (extract it to a small component first), and `HitlSourcesSection` /
  `PromotedCandidatesSection` do NOT take a `compact` prop -- add a compact variant or wrap them
  before they go in the narrower right panel.
- CENTER audit strip (B-lite): render a slim always-visible strip (AuditStrip in its 1-col
  compact form, or just the 3-4 headline counts) above the tables (~after the filter bar).
- The RIGHT panel JSX (~3792-3826 / 3816-3847) gets a mode header + an at-rest branch: when
  `!selectedValue && !selectedSource`, render the relocated dashboard stack (admin sections
  collapsed by default) instead of the empty placeholder; on selection, show detail with a
  "Back to dashboard" action.
- Mobile (`max-md`): the parent (`MatrixDashboard.tsx:862`) forces both panels off via
  `!isMobile`, so re-home Saved Views + the audit strip into CENTER (collapsible `<details>`)
  on small screens; do NOT rely on the left toggle there.
- Selection state (`selectedValueId`/`selectedSourceId`, lines ~2798) is unchanged; add a
  "clear selection" control in the detail panel header (one already exists -- the Close
  button -- which returns to at-rest).
- Lane 1 (#196) already routes promoted rows into the main tables, so
  `PromotedCandidatesSection` on the right is now a quick-triage echo, not the only surface --
  consider whether it stays or is dropped here (owner call).
- Keep all `compact` props; the right panel is `w-96` like the old left `w-80` plus a bit.
- This is a presentation/relocation PR. No data, policy, or verdict logic changes. Full 4
  gates; the existing EvidenceLibrary component tests (detail-panel open/close, view switching)
  must stay green and likely need selector updates for the moved blocks.

## Verification

- Unit: existing EvidenceLibrary tests (open/close detail, switch views, empty states) updated
  for the new at-rest dashboard location; add a test that the at-rest right panel shows the
  audit summary and that selecting a row swaps it for the detail panel.
- Visual: run the app, screenshot References & Values at rest and with a row selected, at
  `lg` and `max-md`, for owner sign-off (this is the taste gate -- owner reviews screenshots
  on the draft PR before merge).

## Owner decision needed

1. Confirm Option B-lite (design-review recommendation) vs pure A vs C.
2. Whether `PromotedCandidatesSection` stays in the right at-rest dashboard now that Lane 1
   surfaces promoted rows in the main tables (#196), or is dropped here.
3. Which 3-4 metrics belong in the always-visible CENTER audit strip (the headline counts).
