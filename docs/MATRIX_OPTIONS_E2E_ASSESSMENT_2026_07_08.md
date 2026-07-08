# Matrix Options E2E Assessment - 2026-07-08

## Verdict

Do not add a new PR #545-specific e2e test right now.

The current e2e surface is auth-gated. Without an authenticated browser/session setup, a new assertion for the
DL-PCB TEQ card would either be skipped or brittle. The component and unit tests already verify the PR-specific
behavior more directly.

## Evidence

Existing PR #545 component/unit coverage:

- Total-PCB DL-PCB card renders:
  `src/components/matrix-options/__tests__/HHDirectContactCalculator.test.tsx:178-186`
- Provisional badge renders:
  `src/components/matrix-options/__tests__/HHDirectContactCalculator.test.tsx:185-186`
- Non-PCB substances do not render the card:
  `src/components/matrix-options/__tests__/HHDirectContactCalculator.test.tsx:198-202`
- Blocked mass calculation blocks the DL-PCB card:
  `src/components/matrix-options/__tests__/HHDirectContactCalculator.test.tsx:212`
- Resolver behavior lives in `src/lib/matrix-options/__tests__/dlPcbTeqTdi.unit.test.ts`.

## Future Authenticated Test

After authenticated preview/local browser setup is available, add one e2e assertion:

1. Open Matrix Options.
2. Select `Total PCBs (Aroclor 1254)`.
3. Open Human Health Direct Contact.
4. Assert both:
   - `hh-direct-preliminary-standard`
   - `hh-direct-dlpcb-teq-standard`
5. Select `benzo_a_pyrene`.
6. Assert `hh-direct-dlpcb-teq-standard` is absent.

This should be a real authenticated e2e, not a test that passes by skipping the core assertion.
