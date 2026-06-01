# Spec: lighting up the first frame-aware equation variant (Stream C)

Status: DRAFT for owner review (2026-06-01). No code shipped. OWNER MUST EYEBALL any
calculator-behavior change before implementation (like #199). Plain ASCII.

## 1. The mechanism already exists -- this is a data + owner-decision task, not a redesign

The frame-aware dispatch layer is BUILT and intentionally dormant:
- `src/lib/matrix-options/equationDispatch.ts` -- `getEquation<P>(frameId, pathway)`
  returns `{ variant, usedBaselineFallback, fallbackReason, run }`. `EquationVariantId`
  is currently the closed union `'baseline'` only.
- `src/lib/matrix-options/frameVariants.ts` -- `FRAME_VARIANTS` table STARTS EMPTY by
  design; each arm of the `FrameVariantOverrides` discriminated union already declares
  exactly which parameters a frame MAY override per pathway (and, by omission, which are
  site-measured and never frame-overridden).
- `src/components/matrix-options/FrameVariantFallbackNotice.tsx` already renders the
  "using BC Protocol 1 baseline" notice when no variant matches.
- Authority docs: `docs/STREAM_C_EQUATION_DISPATCH_DESIGN.md` and
  `docs/PHASE_4_FRAMEVARIANTS_SHAPE_SPEC.md`.

Today every (frameId, pathway) falls back to the BC Protocol 1 v5 DRA baseline -- so the
frame selector changes provenance/notice text but NOT the math. Lighting up a variant =
adding one `FRAME_VARIANTS` row + its `EquationVariantId` + a registered function + a
test, in one PR. The scaffold's own header encodes this 4-step rule.

## 2. Two kinds of "frame changes the math" (keep them distinct)

A frame can change a result two ways. The dispatch layer cleanly separates them:

A. PARAMETER OVERRIDE (data-only, common case): the frame supplies different parameter
   values (e.g. a frame-specific FCV, BSAF, or RfD) into the SAME equation. This is the
   `FrameVariantOverrides.*` partial in `frameVariants.ts`. No new equation function --
   just a `FRAME_VARIANTS` row whose overrides feed the baseline `run`. Most frames
   differ this way.

B. EQUATION FORM CHANGE (rare): the frame uses a structurally different equation (extra
   term, different combination rule). This needs a new `EquationVariantId` member + a new
   function in the `VARIANT_FUNCTIONS` registry in `equationDispatch.ts`.

Recommendation: ship parameter-override variants (A) first; reserve form-change variants
(B) for frames that genuinely need them, with owner sign-off on the new equation form.

## 3. Playbook to ship ONE variant (one variant per PR)

1. OWNER picks the (frame, pathway) pair and confirms the override values + their
   authoritative source (a verified `catalog_sources` row -- Stream D). AI does not
   choose regulatory parameter values.
2. Add the `FRAME_VARIANTS` row (overrides + source provenance) in `frameVariants.ts`.
3. If a form change (type B): add the `EquationVariantId` member + the function in the
   `VARIANT_FUNCTIONS` registry, same commit.
4. Add a test asserting the variant produces output DIFFERENT from baseline for a fixed
   input (the scaffold requires this), plus a test that the fallback notice disappears
   for that pair.
5. Wire nothing else -- the calculators already call `getEquation(frameId, pathway).run`.
6. codex iterate-to-GREEN + 4 gates GREEN + draft PR. OWNER EYEBALLS the rendered
   calculator behavior change before merge (the #199 pattern).

## 4. Candidate first variants (owner selects; do not implement without sign-off)

Ordered by likely value + data availability. Each needs owner-confirmed override values
from a verified source:
- `ccme-sediment-quality` x `eco-direct-eqp`: a CCME-specific FCV / black-carbon
  acknowledgment is the cleanest parameter-override demonstration (type A).
- `canada-fcsap-aquatic` x `eco-food-bsaf`: FCSAP-specific BSAF + eco TRV (type A).
- `us-epa-usace-sediment` x `human-health-*`: US EPA RfD/SF overrides -- note these
  toxicity values now exist as candidate options in the catalog (IRIS, this session), so
  the override values can be traced to a real `catalog_sources` row.
- `bc-csr-sediment-numerical`: likely reference_only/needs_review per
  `regulatoryFrames.ts` applicability -- confirm before treating as calculation_ready.

The frame's pathway applicability in `regulatoryFrames.ts`
(calculation_ready / needs_review / reference_only / unsupported) must say
calculation_ready for the pair before a variant is wired; otherwise fix the applicability
first (an owner decision).

## 5. Owner decisions required before any implementation

1. Which (frame, pathway) pair is the first variant, and what are its override values +
   the verified source row?
2. Is it a parameter override (A) or an equation-form change (B)? If B, owner approves
   the new equation form.
3. Confirm the frame's applicability status for that pathway in `regulatoryFrames.ts`.
4. Confirm the owner wants to eyeball the rendered calculator behavior (recommended:
   yes, per #199) before merge.

## 6. Recommendation

Do NOT implement autonomously. The mechanism is ready; the missing pieces are
regulatory parameter values (HITL-sourced) and a deliberate owner choice of which frame
to differentiate first. Ship the first variant as a single small PR with the
owner-confirmed values, a difference-from-baseline test, and an owner eyeball of the
calculator output before merge.
