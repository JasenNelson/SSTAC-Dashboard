# Exposure-factor input bounds -- implementation spec (owner-decided 2026-08-15)

> # STOP -- RESCOPE BEFORE IMPLEMENTING. THIS SPEC WAS WRITTEN ON A FALSE PREMISE.
>
> The premise was that exposure-factor inputs "accept any value at all, including a
> negative body weight". **That is wrong.** Every numeric field in all three human-health
> calculators already routes through `positiveInput()` / `optionalPositiveInput()`
> (`HHDirectContactCalculator.tsx:330-342`, `HHFoodWebCalculator.tsx:326-333`,
> `HHInhalationCalculator.tsx:163-174`), and `parseDecimal.ts:59-65` rejects `<= 0` and
> non-numeric with a named error. A typed `-70` does NOT compute today, and there is an
> existing test covering that.
>
> **Everything below marked "IMPLEMENT" in the definitional table is ALREADY DONE**, and
> the statements that "a typed `-70` still computes" / "it passes while a typed `-70` still
> computes" are FALSE as of 2026-08-15.
>
> **What is genuinely missing:**
> - Upper bounds of any kind (`1e9` really does pass -- `positiveInput` has no ceiling).
>   These are the OWNER-GATED plausibility ranges; still awaiting owner values.
> - `EF <= 365` and `ED <= AT` -- relational bounds, genuinely absent.
> - `abs_dermal <= 1`, `ba_oral <= 1`, `targetRisk <= 1` -- fraction/probability ceilings.
> - `type="number"` / `inputMode="decimal"` for mobile keyboards.
>
> **Field count is 30, not 23.** The list below enumerates only the fields carrying a
> `data-testid`. Un-testid'd numeric inputs also needing bounds:
> `HHDirectContactCalculator.tsx:865` (target risk), `:869` (hazard quotient), `:873`
> (abs_dermal), `:877` (ba_oral); `HHFoodWebCalculator.tsx:737` (ba_oral), `:741` (target
> risk), `:745` (hazard quotient). Actual totals: 13 direct + 8 food + 9 inhalation.
>
> The one claim below that HOLDS and is important: `min`/`max` attributes would not close
> anything -- there are ZERO `<form>` elements in these calculators, so native validation
> never fires. Verified.

Audit 2026-08-14 Section D. Owner decision: **definitional bounds + refuse-to-compute.**
Plausibility RANGES stay with the owner and are NOT implemented here.

**Its own batch.** 23 fields across three calculators plus validation logic, on the input
path of a regulatory calculation. Do not fold into a UI-polish batch.

## The split that made this decidable

The audit framed this as needing domain ranges. Only HALF of it does.

**Definitional -- follows from what the quantity IS. No domain judgment. IMPLEMENT.**

| Quantity | Bound | Why it is not a policy call |
|---|---|---|
| Body weight | `> 0` | Zero divides by zero; negative yields a negative dose |
| Exposure frequency (days/yr) | `0-365` | More than 365 days in a year is impossible |
| Exposure duration (yr) | `>= 0` and `<= averaging time` | Cannot be exposed for negative years, or longer than the averaging period |
| Absorption / bioavailability | `0-1` | It is a fraction, by definition |
| Ingestion rate, surface area, adherence factor, PEF, VF, BSAF | `>= 0` | A negative rate or area is meaningless |
| RfD, slope factor, RfC, IUR | `> 0` | Zero or negative makes the screening value undefined or sign-flipped |
| Target risk | `> 0` and `<= 1` | A probability cannot exceed 1 |
| Hazard quotient | `> 0` | Same |

**Plausibility -- OWNER-GATED, do NOT implement.** Upper bounds on body weight, ingestion
rate, surface area, etc. "Is 200 kg a valid screening body weight" is a domain call.

## Fields (23, verified by data-testid)

`HHDirectContactCalculator.tsx` (9): hh-direct-bw, -ed, -ef, -ir-sed, -sa, -af,
-at-cancer, -rfd, -slope
`HHFoodWebCalculator.tsx` (5): hh-food-bw, -ir, -bsaf, -rfd, -slope
`HHInhalationCalculator.tsx` (9): hh-inhalation-ed, -ef, -at-cancer, -rfc, -iur, -pef,
-vf, -target-risk, -hazard-quotient

Current state: bare `<input value=... onChange=...>` with NO `type`, `min`, `max`, or
`step` (2 incidental matches repo-wide, none of them these). Values are controlled React
state fed straight into the derivation.

## THE CRITICAL POINT -- attributes alone do not close the hole

`min`/`max`/`type="number"` gate NATIVE FORM VALIDATION. These are controlled inputs with
no form submit; a user can still type `-70` and the value still reaches the calculation.
This is precisely the class of "looks constrained, isn't" defect this project keeps hitting.

So the deliverable is TWO parts, and part 2 is the one that matters:
1. `type="number"`, `inputMode="decimal"`, `min`/`max`/`step` -- better keyboard/mobile
   entry and a native affordance. Cheap. Not protection.
2. **A validation branch that REFUSES TO COMPUTE** and renders an inline error naming the
   offending field and the violated bound. This is the actual fix.

Reuse the existing error surface rather than inventing one: these calculators already have
`role="alert"` error boxes (22 across matrix-options) and `role="status"` result regions
(19) from audit item A5, so the announcement path already exists.

## Tests -- what they must NOT be

- MUST NOT assert only that `min="0"` is present. That is the vacuous form: it passes while
  a typed `-70` still computes. This is the exact trap the attribute-only option would have
  shipped.
- MUST drive the input to an invalid value, then assert (a) NO screening value is rendered,
  and (b) an error naming that field IS rendered.
- Two-sided: the same field at a VALID value must compute normally. A test that only checks
  the rejection path would pass against an input that rejects everything.
- One case per definitional class, not per field: negative (bw), out-of-range fraction
  (abs > 1), over-365 (ef), zero divisor (bw = 0), non-numeric text.

## Do NOT

- Do not clamp silently. Silently correcting a regulatory input to a bound is worse than
  refusing: it produces a plausible number the user did not enter. Refuse and say why.
- Do not change any default, unit, or rounding.
- Do not add upper plausibility bounds. Owner-gated.
