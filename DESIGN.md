# Design

<!-- impeccable:design-record 1 -->

The visual world and interaction model for SSTAC Dashboard, decided with the owner on 2026-08-14.
Product truth lives in `PRODUCT.md`; this file is how that product looks and behaves.

Scope note: this record was established during the Matrix Options redesign and is being applied
surface by surface, starting there. The landing page is separately slated for replacement and has
not been done yet.

## Visual world: Bathymetric

Chosen from three candidate directions. Layered depth drawn from the subject itself - sediment is
what settles, in strata, under water. The layering is structural, not decorative: bands mark real
transitions between zones, and contour motifs are drawn only where a boundary genuinely exists.

Character: calm, spacious, sectioned. Cool blue-green derived from estuary water and mineral
sediment, not generic product blue. Elevation is expressed as layered surfaces rather than drop
shadows.

Reference implementation of the token set and its two themes:
`.impeccable/reports/` companions and the direction mockups produced 2026-08-14.

### Tokens

All colour flows through custom properties. Never hardcode a colour on a component.

- Depth and surface: `--db-depth-0/1/2/3`, `--db-surface`, `--db-surface-raised`
- Text: `--db-text-primary`, `--db-text-secondary`, `--db-text-muted`, `--db-text-on-accent`
- Structure: `--db-border`, `--db-border-strong`, `--db-contour`, `--db-contour-strong`
- Accent, estuary teal: `--db-accent`, `--db-accent-strong`, `--db-accent-tint`,
  `--db-accent-tint-border`
- Secondary, mineral ochre: `--db-sediment`, `--db-sediment-tint`, `--db-sediment-tint-border`
- Status triads: `--db-pass`, `--db-fail`, `--db-review`, each with `-tint` and `-tint-border`
- `--db-focus-ring`, `--db-shadow-1/2`, `--db-font-body`, `--db-font-ui`, `--db-font-mono`

Verified 2026-08-14: this token set is not merely planned -- every token named above is already
defined in `src/app/globals.css` for both the light `:root` block and the dark-mode block
(lines ~308-395), and is already consumed in components (`BackgroundAdjustment.tsx`,
`MatrixDashboard.tsx`, `CalculatorStage.tsx`, `CalculatorSummaryBar.tsx`). (CODE-VERIFIED)

Light resolves to pale mineral sand and silt bands; dark resolves to deep water with the layering
still legible. Dark is not an inversion - the relationships are rebuilt so the accent still signals.

## Themes are not optional

Both themes are fully designed, always. The owner spent significant effort getting the existing
theme system working; it is treated as infrastructure to preserve, not to rebuild.

- The existing mechanism stays: `ThemeContext`, `ThemeToggle`, the persisted preference, and the
  `dark:` class convention. A new visual direction changes what tokens resolve to, never how theming
  works. Verified: both `src/contexts/ThemeContext.tsx` and `src/components/ThemeToggle.tsx`
  exist. (CODE-VERIFIED)
- `ThemeToggle.tsx` is the quality bar for controls in this codebase - computed `aria-label`, an icon
  communicating the target state rather than the current one, a real focus ring. Do not touch it.
  (DESIGN-DECISION -- the quality-bar judgment is this session's synthesis; the file itself is
  CODE-VERIFIED to exist)
- Known defect to fix separately: `ThemeContext.tsx` defaults to light and reads `localStorage` only
  after first client render, with no inline bootstrap script, so returning dark-mode visitors get a
  light flash on every load. Verified: `ThemeContext.tsx` initializes `useState<Theme>('light')`
  and only reads `localStorage.getItem('theme')` inside a `useEffect` (runs after first client
  render); no inline bootstrap `<script>` exists to set the class before hydration.
  (CODE-VERIFIED)

## Domain model, owner-corrected

These are product facts, not design preferences. Earlier design work got them wrong.

### The four pathways are four independent derivations

Eco Direct Contact, Eco Food Web (BSAF), HH Direct Contact, and HH Food Web are NOT four ways of
computing one number. Each produces its OWN SEPARATE CONCENTRATION. Switching pathway is a context
change, not a parameter change.

Verified: `src/components/matrix-options/guide/content/types.ts` defines
`export type MatrixCategory = Exclude<Pathway, 'tier0'>` with exactly four members --
`'eco-direct'`, `'eco-food'`, `'hh-direct'`, `'hh-food'` -- matching these four pathways
one-to-one, with an exhaustiveness-checked tuple guarding against a fifth. (CODE-VERIFIED)

Note: two further calculator components exist alongside the four pathway calculators --
`HHInhalationCalculator.tsx` and `CumulativeEffectsCalculator.tsx` -- which are not among the
four `MatrixCategory` values above. Their relationship to the four-pathway model (a fifth
pathway not yet in `MatrixCategory`, versus a separate cross-pathway tool) was not resolved in
this sweep. (UNVERIFIED)

Consequences:
- The pathway switch is a primary control across the top, at navigation weight, not a filter buried
  in a form.
- The interface should state plainly that switching produces a different concentration.
- One pathway is worked at a time. The owner explicitly does not want a four-up comparison here.

### The calculator produces an adjusted standard, not a verdict

CORRECTED 2026-08-14 (adversarial UI QA audit): this section and the "Layout" section below
originally described a FIVE-stage model, with an explicit "Stage 5" that compared the derived
standard against a measured site concentration. The code now implements a FOUR-stage
derivation: Stage 1 (exposure factors) and Stage 2 (preliminary standard) in the active pathway
calculator, Stage 3 (background reference) and Stage 4 (adjusted standard) in
`BackgroundAdjustment.tsx`. What was "Stage 5" is now rendered as an unnumbered "Site
Comparison" block, explicitly marked in the code as NOT part of the derivation and its role
"under review," pending an owner decision on whether a measured site concentration belongs in
this tool at all (see PRODUCT.md, "What the Calculator compares against"). Every "Stage 5" and
"five-stage" reference below has been corrected to match. (CODE-VERIFIED, against
`BackgroundAdjustment.tsx`'s `TOTAL_STAGES = 4` constant and its Stage 3/Stage 4
`CalculatorStage` renders)

The user works through stages to compute a PRELIMINARY value; the last step compares it to
BACKGROUND levels and adjusts. Three numbers matter and their relationship is the point:

1. the preliminary TOXICITY-BASED standard, from the exposure derivation
2. the background UTL 95/95, `mean + K * sd`, from Provincial or Regional reference samples, with
   Regional taking precedence over Provincial
3. the final adjusted standard, `max(preliminary, UTL)`

Terminology correction 2026-08-14: an earlier draft of this file called item 1 the "preliminary
Tier 1 generic standard". That was wrong and potentially dangerous. In BC CSR, "Tier 1 generic
standard" conventionally means the PUBLISHED Schedule 3.x number, not a freshly derived candidate.
Welding the two terms together implied the UTL adjusts the published standard, which would have made
Stage 4 operate on the wrong operand.

Owner statement of what the adjustment actually does: the preliminary toxicity-based calculated
standard is adjusted UP to equal the provincial background concentration when the toxicity-based
value is LOWER than background. So the final standard is the toxicity-based value where that sits
above background, and the background value where background exceeds it. `max(preliminary, UTL)` is
therefore correct as implemented, with the preliminary being the value the user just derived.

The `max` exists so that naturally-elevated background concentrations are not forced into
remediation. A measured site concentration is then compared against the adjusted standard. The
implementation surfaces a screening-only caution when K is a table lookup rather than the exact
noncentral-t computation; that warning belongs in the normal state, not only in error states.

Stage 3 is mathematically independent of Stages 1 and 2 - the UTL depends only on the reference
samples. When an exposure input is invalid, Stage 3 still computes; only Stage 4's `max` waits
(the unnumbered Site Comparison block, formerly called "Stage 5," is not part of the derivation
at all -- see the correction above -- so there is no "Stage 5" left to wait). Three independent
reviews of `BackgroundAdjustment.tsx` confirmed this. (CODE-VERIFIED: `stage3State` computes
independently of `preliminaryStandard`; `stage4State` is `'waiting'` until both
`preliminaryAvailable` and `utlAvailable`, per `BackgroundAdjustment.tsx`.)

### Exposure scenario is a first-class control, and it carries provenance

CORRECTED 2026-08-14 (adversarial UI QA audit): the sentence that used to appear here claiming a
"receptor scenario" control was invented and does not exist in the app was itself false. The
control exists and is real: `HHDirectContactCalculator.tsx` and `HHFoodWebCalculator.tsx` both
render a working receptor-scenario `<select>`
(`data-testid="hh-direct-receptor-scenario-select"` / `"hh-food-receptor-scenario-select"`),
backed by `getSelectableFrameScenarios`/`getDefaultSelectableScenarioId`/
`getReceptorScenarioFrame` and dedicated test suites, and it does switch real exposure-factor
defaults. (CODE-VERIFIED) The broader EXPOSURE SCENARIO concept (see PRODUCT.md) is the correct
frame for the design consequences below -- the receptor-scenario select is one existing piece of
that infrastructure, not the whole of it. Both calculators do render a `CalculatorProvenancePanel`
with `provenanceValues` (CODE-VERIFIED), but whether it already surfaces the specific
preset-vs-adapted-from-soil-vs-novel-to-this-project three-way tag per individual assumption, as
opposed to a general source/value listing, was not confirmed in this sweep (UNVERIFIED) -- so the
design consequences below still stand as work to verify or complete, not as invention from
nothing. The design consequences are:

- It belongs in the left rail with the other options, as a first-class control rather than a buried
  field. It determines what the exposure factors mean.
- It needs BOTH preset selection (Protocol 28 scenarios, which differ by receptor type and by media
  type) AND per-assumption customization. Choosing a preset must not lock the user out of adjusting
  individual assumptions.
- EVERY assumption must show where it came from: directly from Protocol 28, adapted from a soil
  scenario, or novel to this project. Protocol 28 does not cover sediment human-health work - the
  soil scenarios it does cover omit the food pathway - so a real derivation will mix all three
  sources. Without visible provenance the result is not defensible to a reviewer.
- A customized assumption must be visibly distinguishable from its preset default, and the preset it
  departed from should remain identifiable.
- Never invent a preset value. If a Protocol 28 value could not be sourced, the interface says so
  instead of showing a plausible number.

This is the same provenance discipline already applied to toxicity values, one level up.

## Layout: stages inside rails

Chosen from three options, then refined through a second round.

- Pathway switch across the top, primary weight, sub-labelled Ecological / Human health
- LEFT rail: options - what the user sets
- CENTRE: the numbered derivation stages, read top to bottom
- RIGHT rail: reference data - cited value, source, jurisdiction, QA status, provenance, audit link
- A compact sticky summary bar at the top of the centre column carries the preliminary, the UTL, and
  the adjusted standard, each with its state, and marks which term is governing

Stages are numbered because a derivation genuinely is sequential. Do not number anything that is not
a real sequence.

### The Site Comparison should become a standards comparison, not a site assessment

CORRECTED 2026-08-14 (adversarial UI QA audit): this section previously called this "Stage 5,"
which is wrong twice over. First, per the four-stage correction above, this block is not
numbered and is not part of the derivation at all -- it is the unnumbered "Site Comparison"
block in `BackgroundAdjustment.tsx`. Second, and separately: the description below (comparing
the derived standard against CSR Schedule 3.4) is OWNER-STATED intended future behaviour, not
what the code currently does. As of this sweep, the Site Comparison block still compares the
measured site concentration `Cs` against the background UTL only
(`csAtOrBelowBackground = csParsed <= utlResult.utl`), exactly as before -- it has NOT been
rewired to compare against Schedule 3.4, and the code's own header comment explains why:
rewiring it would silently change which comparisons show "exceeds" vs "within standard," which
is a behavioural change to a regulatory comparison requiring owner sign-off, not a UI cleanup.
(CODE-VERIFIED: current behaviour; OWNER-STATED: the target behaviour described below) See
PRODUCT.md, "What the Calculator compares against," for the full statement. This unnumbered
block does NOT take -- and per the current code, does not yet act on -- a measured site
concentration as the intended final comparison. The intent is that it will instead compare the
DERIVED standard against the existing CSR Schedule 3.4 sediment numerical standards, so the user
can see whether what they have derived is more or less stringent than what is currently in
force.

Design consequences (still open work, not yet built):

- The block needs the substance's existing Schedule 3.4 value, which the codebase does not yet have
  (CODE-VERIFIED absent; see PRODUCT.md). Until it does, the block should say the reference value is
  unavailable rather than comparing against a substitute or showing nothing.
- The comparison should express DIRECTION and MAGNITUDE, not a pass or fail. "More stringent than the
  current standard by a factor of N" is the useful statement; "PASS" is not, because there is nothing
  being passed or failed.
- A substance with no Schedule 3.4 entry is a real and important case - this project exists partly
  because sediment standards are incomplete. Absence must read as a stated finding, not as an error
  or an empty cell.
- The measured-concentration input currently in BackgroundAdjustment stays untouched until the owner
  decides its fate. It is not the model for this block, and the code has not been changed to make it
  so.

## Standing principles

### Fail loudly and specifically

Owner-stated: showing that something does not work is better than silent failure, blank states, or
accepting nonsense. Name what is wrong, where it is wrong, and how to fix it. Offer a route back to
the offending input. Never display a number derived from invalid input, and never present a stale
value as current without labelling it stale.

This is the opposite of the incumbent behaviour, which accepted a negative body weight and computed
with it, and which silently discarded failed writes.

### Four states, not two

Distinguish, visibly and in the accessibility tree:

- COMPUTED - a real value
- PENDING - not entered yet, no error
- WAITING - blocked by something upstream, not by this field
- BLOCKED - the error is here

Verified: `CalculatorStage.tsx` defines exactly this set,
`export type StageState = 'computed' | 'pending' | 'waiting' | 'blocked'`, with matching
`STAGE_STATE_LABELS`. (CODE-VERIFIED)

### Non-negotiables

- Every text and background pair clears 4.5:1 in BOTH themes. Measured, not assumed.
- Status is never encoded by colour alone; every chip carries a text label.
- Touch targets at least 44px on every control.
- Real semantic elements: `button`, `table`, `th`, `label`. Not divs with handlers.
- Visible focus states everywhere.
- Result and error regions announce through live regions; a value that changes silently is a defect.
- Responsive behaviour uses container queries where a component can appear at different widths.
- Plain ASCII in all source and copy, code point <= 127.

### Never fabricate

Illustrative values must be labelled illustrative. Do not invent regulatory bounds, toxicity values,
participant counts, endorsements, or adoption claims. Input ranges for exposure factors are an OPEN
DECISION requiring a domain-qualified source; until then they are shown as affordances and marked
illustrative.

### Anti-patterns, explicitly rejected

The owner rejected earlier AI-generated work as generic. Avoid: emoji as interface icons, gradient
text, purple-to-blue gradients, glassmorphism and backdrop blur, cards that lift on hover, uniform
oversized corner radii, centred hero pills, Inter or Space Grotesk as the face, decorative circular
icon tiles. Every structural device must encode something true - if a rule or contour does not mark a
real boundary, do not draw it.
