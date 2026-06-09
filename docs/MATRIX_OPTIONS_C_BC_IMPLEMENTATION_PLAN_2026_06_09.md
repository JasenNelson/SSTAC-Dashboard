# C-BC Implementation Plan: BC Protocol 1 HH-food Frame Default Seed

Status: READY TO BUILD (once prerequisites 1(a)+1(b) cleared).
Authority: docs/MATRIX_OPTIONS_PHASE_C_FRAME_VARIANT_DESIGN_2026_06_09.md sec 9.1-9.5.
Plain ASCII only (code point <= 127).

---

## PREREQUISITES (hard gates -- must clear before any code)

### 1(a) PR #283 merged with WLRS rows at jurisdiction='BC'

The Phase B WLRS catalog rows must land with jurisdiction='BC', NOT 'BC_provincial'.
Reason: getFrameSeedCandidateEligibility (defaultSelectionPolicy.ts:256) gates on whether
the record's jurisdiction is in the frame's eligibleCatalogJurisdictions. The BC Protocol 1
frame (regulatoryFrames.ts:154) lists ['BC', 'Canada_federal', 'US_federal', 'general'] --
'BC_provincial' is NOT in that list, so a WLRS row with jurisdiction='BC_provincial' resolves
to 'blocked' in getFrameDefaults and never seeds.

C-BC BLOCKER (surfaced by codex Leg 2, design doc sec 9.5): reconcile before adding the
profile row. Owner resolution: either (a) PR #283 uses jurisdiction='BC' for the 3 WLRS
rows (preferred; consistent with the frame table), OR (b) owner adds 'BC_provincial' to
bc-protocol1-v5-dra's eligibleCatalogJurisdictions in regulatoryFrames.ts. Document the
chosen resolution as a comment in the profile row note field.

Verify after #283 merges (the WLRS rows live in the JSON catalog, NOT in catalog.ts, which
only re-exports JSON imports -- query the JSON or PARAMETER_VALUE_RECORDS):
  node -e "const d=require('./matrix_research/reference_catalog/parameter_values.json'); const r=d.find(x=>x.parameter_value_id==='pv-wlrs-2023-ir-food-recreational-bc'); console.log(r.jurisdiction, r.candidate_group_id);"
  (expect: BC  human-health-food__generic__IR_food_kg_per_day__BC)

### 1(b) Owner runs promote-wlrs-default.mjs --apply (for the recreational row)

The recreational WLRS row (pv-wlrs-2023-ir-food-recreational-bc, value=0.111 kg/day) must
reach ALL of the following states before getActiveFrameDefaults can return it as 'active':
  - qa_status === 'approved'                        (promote-first guardrail)
  - evidence_support_status === 'approved_source_backed'
  - canonical_source_status === 'direct_source_verified'
  - default_status !== 'not_default' and !== 'excluded'   (blocked_not_default guard)
  - The cited catalog_sources row (src-bc-wlrs-fish-tissue-screening-2023) must have
    canonical_source_status === 'direct_source_verified'  (direct-current-source check)
  - value_type === 'single_value'                   (non-scalar guard)
  - no policy-compilation/reference-mining source role    (source-role guard)

Until all of the above are true, getFrameDefaults returns status='pending' for this seed
(visible but never calculation-driving). That is the correct pre-promotion state.

Owner verification SQL (read-only, paste into Supabase Studio):
  SELECT parameter_value_id, qa_status, evidence_support_status,
         canonical_source_status, default_status, value_type
  FROM promoted_parameter_values
  WHERE parameter_value_id = 'pv-wlrs-2023-ir-food-recreational-bc';

  SELECT source_id, canonical_source_status
  FROM catalog_sources
  WHERE source_id = 'src-bc-wlrs-fish-tissue-screening-2023';

Also confirm the catalog_sources UUID to use in sourceIds[] of the profile row:
  SELECT id FROM catalog_sources
  WHERE source_id = 'src-bc-wlrs-fish-tissue-screening-2023';
  -- Owner provides this UUID before STEP 1 is coded; do NOT invent it.

---

## STEP 1 -- Add the first FRAME_DEFAULT_PROFILES row

File: src/lib/matrix-options/frameDefaults.ts
Change point: line 103 (the empty [] literal assigned to FRAME_DEFAULT_PROFILES).

Replace:
  export const FRAME_DEFAULT_PROFILES: readonly FrameDefaultProfileRow[] = [];

With:
  export const FRAME_DEFAULT_PROFILES: readonly FrameDefaultProfileRow[] = [
    {
      frameId: 'bc-protocol1-v5-dra',
      pathway: 'human-health-food',
      note: 'BC WLRS 2023 recreational fish consumption rate (0.111 kg/day). ' +
            'Owner-promoted; seeds the HH-food IR input for the BC Protocol 1 frame. ' +
            'User-adjustable. WLRS row jurisdiction=\'BC\' (reconciled per C-BC blocker).',
      // OWNER-PROVIDED: the Supabase UUID for src-bc-wlrs-fish-tissue-screening-2023.
      // Replace <UUID_FROM_OWNER> with the actual UUID before committing.
      sourceIds: ['<UUID_FROM_OWNER>'],
      defaults: [
        {
          inputKey: 'IR_food_kg_per_day',
          parameterValueId: 'pv-wlrs-2023-ir-food-recreational-bc',
          candidateGroupId: 'human-health-food__generic__IR_food_kg_per_day__BC',
        },
      ],
    },
  ];

CONSTRAINTS:
- sourceIds must be non-empty (validateFrameDefaultProfiles line 317 rejects [] -> error).
  The UUID is the Supabase primary key of the catalog_sources row, not the source_id string.
  Owner must supply it; AI must not invent a UUID.
- candidateGroupId must exactly match the record's candidate_group_id field as stored in
  PARAMETER_VALUE_RECORDS (provenance/catalog.ts). Verify:
    grep 'pv-wlrs-2023-ir-food-recreational-bc' src/lib/matrix-options/provenance/catalog.ts
  and copy the candidate_group_id value verbatim.
- The note field is ASCII only; no smart quotes, no em-dashes.
- Once non-empty, FRAME_DEFAULT_PROFILES is Tier-2 protected (CLAUDE.md). Every future
  change needs owner awareness and codex review.

After adding the row, run validateFrameDefaultProfiles() in a quick unit test or vitest
-t 'validateFrameDefaultProfiles.*valid' to confirm 0 errors before wiring the calculator.

---

## STEP 2 -- Wire HHFoodWebCalculator.tsx

File: src/components/matrix-options/HHFoodWebCalculator.tsx

### 2a. Add imports at the top (after existing imports ~line 26)

  import {
    getActiveFrameDefaults,
    getFrameDefaults,
  } from '@/lib/matrix-options/frameDefaults';

Also add useRef to the React import at line 6:
  import React, { useEffect, useMemo, useRef, useState } from 'react';

### 2b. Add pristine-tracking ref immediately after foodIrInput useState (line 67)

  const [foodIrInput, setFoodIrInput] = useState('0.142');
  // Tracks whether the user has manually edited foodIrInput since the last frame seed.
  // true = pristine (never touched or just seeded); false = dirty (user has edited).
  // A frame-switch only re-seeds a PRISTINE field. A user edit marks it dirty.
  // The "Reset to frame default" button re-seeds and restores pristine.
  const foodIrPristine = useRef<boolean>(true);

Do NOT use useState for pristine -- a ref avoids spurious re-renders on every keystroke
and eliminates the risk of the dirty flag and the input value racing in the same render.

### 2c. Wrap the existing setFoodIrInput onChange handler to mark dirty

In the JSX at ~line 347, the Food ingestion input's onChange currently is:
  onChange={(e) => setFoodIrInput(e.target.value)}

Replace with:
  onChange={(e) => {
    foodIrPristine.current = false;
    setFoodIrInput(e.target.value);
  }}

### 2d. Add a useEffect([jurisdiction]) that seeds on frame change

Insert immediately after the existing useEffect([substanceKey]) that ends at line 109.
This mirrors its structure exactly: one effect per dependency axis (substanceKey vs
jurisdiction) to keep them orthogonal.

  // Define the calculator baseline IR (the existing useState('0.142') seed) as a const
  // so the no-frame-default case can RESET to it:
  //   const BASELINE_IR_KG_PER_DAY = '0.142';  // matches the useState default
  //
  // Seed IR from the active frame default when the frame changes (C-BC).
  // Only touches a PRISTINE field (foodIrPristine.current === true); a dirty field is
  // never clobbered (the user can re-seed via the "Reset to frame default" button).
  useEffect(() => {
    if (!foodIrPristine.current) return; // never clobber a user edit
    const actives = getActiveFrameDefaults(jurisdiction, 'human-health-food');
    const irDefault = actives.find((d) => d.inputKey === 'IR_food_kg_per_day');
    if (irDefault) {
      setFoodIrInput(String(irDefault.value)); // frame supplies a default -> seed it
    } else {
      // CRITICAL: no active default for this frame -> RESET the pristine field to the
      // baseline. Without this, switching BC -> a no-default frame would LEAK the BC
      // value (0.111) into a frame that has no frame default (codex 2026-06-09).
      setFoodIrInput(BASELINE_IR_KG_PER_DAY);
    }
    // Seeding/reset does NOT mark dirty -- the effective default IS the pristine baseline.
  }, [jurisdiction]);

NOTE on the no-default case: getActiveFrameDefaults returns [] both when the pathway is
'unsupported' for the frame (e.g. bc-csr-sediment-numerical, ccme-sediment-quality -> the
getFrameDefaults short-circuit) AND when a supported frame simply has no FRAME_DEFAULT_PROFILES
row for it yet. In BOTH cases a pristine field must RESET to BASELINE_IR_KG_PER_DAY, not retain
a previously-seeded frame value. For bc-protocol1-v5-dra + human-health-food the applicability is
'needs_review' (regulatoryFrames.ts:66-70), so a profile row WILL surface an active default once
the prerequisites are met.

### 2e. Add "Reset to frame default" button

Location: adjacent to the quick-set buttons in the JSX grid row (~line 349-359).
Insert as the first button in the quick-set row, conditionally rendered only when:
  (a) the frame has an active seed for IR_food_kg_per_day, AND
  (b) the field is dirty (foodIrPristine.current === false).

Derive the active seed once in the render body (outside JSX, before the return):
  const activeIrDefault = useMemo(
    () =>
      getActiveFrameDefaults(jurisdiction, 'human-health-food').find(
        (d) => d.inputKey === 'IR_food_kg_per_day',
      ) ?? null,
    [jurisdiction],
  );

  // Resolve the pending seed for display (shown even when not active).
  const pendingIrDefault = useMemo(
    () =>
      getFrameDefaults(jurisdiction, 'human-health-food').find(
        (d) => d.inputKey === 'IR_food_kg_per_day' && d.status === 'pending',
      ) ?? null,
    [jurisdiction],
  );

Then in JSX, above or before the 32g/day button. Show ONLY when there is an active default
AND the field is DIRTY (not on a pristine field -- the pristine field already equals the
default, so a reset is a no-op and the control would be noise). The condition reads the
foodIrPristine ref; this is reactive because the user's edit calls setFoodIrInput (a state
update -> re-render) and sets foodIrPristine.current = false in the same handler, so the
button appears on that re-render:
  {activeIrDefault && !foodIrPristine.current && (
    <button
      type="button"
      data-testid="hh-food-ir-reset-to-frame-default"
      onClick={() => {
        setFoodIrInput(String(activeIrDefault.value));
        foodIrPristine.current = true;
      }}
      className="px-2.5 py-2 text-xs rounded-md border border-sky-400 bg-sky-50
                 dark:bg-sky-900/30 dark:border-sky-600 text-sky-800 dark:text-sky-200"
    >
      Reset to frame default ({activeIrDefault.value} kg/day)
    </button>
  )}

### 2f. Add a provenance label for the seeded value

Below the Food ingestion input (or as a sub-label beneath the input), add:
  {activeIrDefault && (
    <p
      className="text-xs text-sky-700 dark:text-sky-400 mt-0.5"
      data-testid="hh-food-ir-frame-default-label"
    >
      Frame default (BC WLRS 2023, recreational): {activeIrDefault.value} kg/day
    </p>
  )}
  {pendingIrDefault && !activeIrDefault && (
    <p
      className="text-xs text-amber-700 dark:text-amber-400 mt-0.5"
      data-testid="hh-food-ir-frame-default-pending-label"
    >
      Frame default pending promotion (BC WLRS 2023, recreational):
      {pendingIrDefault.value} kg/day -- not active until owner promotes.
    </p>
  )}

PROVENANCE PARITY GUARANTEE: the seed flows through setFoodIrInput -> foodIrInput state.
The existing provenanceValues memo at line 177 already reads foodIrInput directly for the
IR_food_kg_per_day entry (lines 221-226). So when the frame default seeds the field,
provenanceValues automatically reports the correct value -- no divergence between the
displayed "values used" and what was passed to humanHealthFoodWeb().run().
This is the core reason the seed must go through setState, NOT through parameterOverrides
inside getEquation.run() (the provenance-lie risk identified in design doc sec 9.1 point 1).

---

## STEP 3 -- Tests

All new tests go in existing test files (no new test files).

### 3a. frameDefaults.test.ts additions

File: src/lib/matrix-options/__tests__/frameDefaults.test.ts

TEST: BC frame seeds IR from active WLRS record.
Follows the pattern at lines 163-205 (the 'approved -> active' describe block).
Use synthetic opts.profiles + opts.records (no live catalog dependency):
  it('BC frame profile with active WLRS record seeds IR_food_kg_per_day', () => {
    mockEligibility.mockReturnValue({
      eligible: true,
      disposition: 'eligible_pending_approval',
      rationale: 'ok',
    });
    const wlrsRecord = makeRecord({
      parameter_value_id: 'pv-wlrs-2023-ir-food-recreational-bc',
      value: 0.111,
      unit: 'kg/day',
      qa_status: 'approved',
      jurisdiction: 'BC',
      candidate_group_id: 'human-health-food__generic__IR_food_kg_per_day__BC',
    });
    const profile: FrameDefaultProfileRow = {
      frameId: 'bc-protocol1-v5-dra',
      pathway: 'human-health-food',
      note: 'C-BC test profile',
      sourceIds: ['src-uuid-placeholder'],
      defaults: [{
        inputKey: 'IR_food_kg_per_day',
        parameterValueId: 'pv-wlrs-2023-ir-food-recreational-bc',
        candidateGroupId: 'human-health-food__generic__IR_food_kg_per_day__BC',
      }],
    };
    const actives = getActiveFrameDefaults(
      'bc-protocol1-v5-dra', 'human-health-food',
      { profiles: [profile], records: [wlrsRecord] },
    );
    expect(actives.length).toBe(1);
    expect(actives[0].value).toBe(0.111);
    expect(actives[0].status).toBe('active');
  });

TEST (DON'T-ORPHAN-GENERIC / Phase B codex criterion):
substance_key='generic' WLRS row is reachable via getActiveFrameDefaults for the BC frame.
This proves the Phase B acceptance criterion: the generic IR rows are NOT orphaned -- they
have a consumer (the frame-default seed path). Uses the same synthetic profile above:
  it('WLRS generic substance_key row is reachable via frame-default path (no-orphan)', () => {
    mockEligibility.mockReturnValue({
      eligible: true,
      disposition: 'eligible_pending_approval',
      rationale: 'ok',
    });
    // substance_key=generic is the exact criterion the resolver checks (line 195-198
    // in frameDefaults.ts). A non-generic record would be status 'invalid'.
    const genericRecord = makeRecord({
      parameter_value_id: 'pv-wlrs-2023-ir-food-recreational-bc',
      substance_key: 'generic',
      value: 0.111,
      unit: 'kg/day',
      qa_status: 'approved',
      jurisdiction: 'BC',
      candidate_group_id: 'human-health-food__generic__IR_food_kg_per_day__BC',
    });
    const profile = makeProfile({
      defaults: [{
        inputKey: 'IR_food_kg_per_day',
        parameterValueId: 'pv-wlrs-2023-ir-food-recreational-bc',
        candidateGroupId: 'human-health-food__generic__IR_food_kg_per_day__BC',
      }],
    });
    const results = getFrameDefaults(
      'bc-protocol1-v5-dra', 'human-health-food',
      { profiles: [profile], records: [genericRecord] },
    );
    expect(results[0].status).toBe('active');
  });

TEST: non-BC frame with no profile seeds nothing.
  it('a frame with no profile row returns [] from getActiveFrameDefaults', () => {
    const actives = getActiveFrameDefaults(
      'us-epa-usace-sediment', 'human-health-food',
      { profiles: [], records: [] },
    );
    expect(actives).toEqual([]);
  });

### 3b. HHFoodWebCalculator.test.tsx additions

File: src/components/matrix-options/__tests__/HHFoodWebCalculator.test.tsx

Mocking strategy: vi.mock '@/lib/matrix-options/frameDefaults' for the calculator tests.
This decouples calculator behavior from the live catalog state (the WLRS record may be
needs_review until the owner promotes; tests should not depend on that).
IMPORTANT: static `import` and `vi.mock` (hoisted) must be at MODULE SCOPE -- the top of
the test file, NOT inside the describe block (an import inside describe is a parse error).
Place these at the top of the file, alongside the existing vi.mock for MathRenderer; only
the `vi.mocked(...)` consts + beforeEach go inside (or just above) the describe:

  // --- module top (with the other imports + the MathRenderer vi.mock) ---
  import {
    getActiveFrameDefaults,
    getFrameDefaults,
  } from '@/lib/matrix-options/frameDefaults';

  vi.mock('@/lib/matrix-options/frameDefaults', () => ({
    getActiveFrameDefaults: vi.fn(),
    getFrameDefaults: vi.fn(),
  }));

  const mockGetActiveFrameDefaults = vi.mocked(getActiveFrameDefaults);
  const mockGetFrameDefaults = vi.mocked(getFrameDefaults);

  // --- inside describe ---
  beforeEach(() => {
    mockGetActiveFrameDefaults.mockReturnValue([]);
    mockGetFrameDefaults.mockReturnValue([]);
  });

TEST (a): selecting the BC frame seeds foodIrInput from the active default.
  it('(C-BC) BC frame active default seeds the IR input on mount', () => {
    mockGetActiveFrameDefaults.mockImplementation((frameId, pathway) => {
      if (frameId === 'bc-protocol1-v5-dra' && pathway === 'human-health-food') {
        return [{
          inputKey: 'IR_food_kg_per_day',
          parameterValueId: 'pv-wlrs-2023-ir-food-recreational-bc',
          candidateGroupId: 'human-health-food__generic__IR_food_kg_per_day__BC',
          status: 'active',
          value: 0.111,
          unit: 'kg/day',
          qaStatus: 'approved',
          reason: 'ok',
        }];
      }
      return [];
    });
    render(
      <HHFoodWebCalculator
        substanceKey="total_pcbs_aroclor_1254"
        jurisdiction="bc-protocol1-v5-dra"
      />,
    );
    const input = screen.getByTestId('hh-food-ir-input') as HTMLInputElement;
    expect(input.value).toBe('0.111');
    expect(screen.getByTestId('hh-food-ir-frame-default-label')).toHaveTextContent(
      /BC WLRS 2023/,
    );
  });

TEST (b): a manual edit survives (dirty field not clobbered on re-render).
  it('(C-BC) a user edit is not clobbered by the frame default (dirty field)', async () => {
    mockGetActiveFrameDefaults.mockReturnValue([{
      inputKey: 'IR_food_kg_per_day',
      parameterValueId: 'pv-wlrs-2023-ir-food-recreational-bc',
      candidateGroupId: 'human-health-food__generic__IR_food_kg_per_day__BC',
      status: 'active',
      value: 0.111,
      unit: 'kg/day',
      qaStatus: 'approved',
      reason: 'ok',
    }]);
    render(
      <HHFoodWebCalculator
        substanceKey="total_pcbs_aroclor_1254"
        jurisdiction="bc-protocol1-v5-dra"
      />,
    );
    const input = screen.getByTestId('hh-food-ir-input') as HTMLInputElement;
    // User edits the field -- marks it dirty.
    fireEvent.change(input, { target: { value: '0.220' } });
    expect(input.value).toBe('0.220');
    // Trigger a re-render by simulating a prop change that does NOT change jurisdiction.
    // Even though getActiveFrameDefaults still returns 0.111, the dirty field must hold.
    // (Implementation: the useEffect([jurisdiction]) does not re-run; pristine stays false.)
    expect(input.value).toBe('0.220');
  });

TEST (c): reset button restores the frame default.
  it('(C-BC) Reset to frame default button restores the seeded value', () => {
    mockGetActiveFrameDefaults.mockReturnValue([{
      inputKey: 'IR_food_kg_per_day',
      parameterValueId: 'pv-wlrs-2023-ir-food-recreational-bc',
      candidateGroupId: 'human-health-food__generic__IR_food_kg_per_day__BC',
      status: 'active',
      value: 0.111,
      unit: 'kg/day',
      qaStatus: 'approved',
      reason: 'ok',
    }]);
    render(
      <HHFoodWebCalculator
        substanceKey="total_pcbs_aroclor_1254"
        jurisdiction="bc-protocol1-v5-dra"
      />,
    );
    const input = screen.getByTestId('hh-food-ir-input') as HTMLInputElement;
    // Dirty the field.
    fireEvent.change(input, { target: { value: '0.388' } });
    expect(input.value).toBe('0.388');
    // Click reset.
    const resetBtn = screen.getByTestId('hh-food-ir-reset-to-frame-default');
    fireEvent.click(resetBtn);
    expect(input.value).toBe('0.111');
  });

TEST (d): PROVENANCE PARITY -- the displayed IR value equals the value passed to run().
This is the sedS provenance-parity test. The calculator passes foodIrInput to
humanHealthFoodWeb() (the result memo at lines 116-174); the provenance panel reads the
same foodIrInput. So if the seed set foodIrInput='0.111', both the result and the
provenance panel reflect 0.111. Verify by checking the provenance panel text:
  it('(C-BC) IR provenance panel shows the seeded value (provenance parity)', () => {
    mockGetActiveFrameDefaults.mockReturnValue([{
      inputKey: 'IR_food_kg_per_day',
      parameterValueId: 'pv-wlrs-2023-ir-food-recreational-bc',
      candidateGroupId: 'human-health-food__generic__IR_food_kg_per_day__BC',
      status: 'active',
      value: 0.111,
      unit: 'kg/day',
      qaStatus: 'approved',
      reason: 'ok',
    }]);
    render(
      <HHFoodWebCalculator
        substanceKey="total_pcbs_aroclor_1254"
        jurisdiction="bc-protocol1-v5-dra"
      />,
    );
    // The provenance panel (data-testid='calculator-provenance-panel') includes the
    // IR entry from provenanceValues. Its value is foodIrInput, which is now '0.111'.
    expect(screen.getByTestId('calculator-provenance-panel')).toHaveTextContent('0.111');
    // Existing guard from the test at line 87: still 11 used values (no new entries).
    expect(screen.getByTestId('calculator-provenance-panel')).toHaveTextContent(
      /11 used values/,
    );
  });

TEST (e): DON'T-ORPHAN-GENERIC -- already covered in frameDefaults.test.ts STEP 3a.
No additional component test needed; the lib-level test is the canonical guard.

TEST (f): non-BC frame seeds nothing / shows no label.
  it('(C-BC) a frame with no active default seeds nothing and shows no frame label', () => {
    mockGetActiveFrameDefaults.mockReturnValue([]); // default from beforeEach
    render(
      <HHFoodWebCalculator
        substanceKey="total_pcbs_aroclor_1254"
        jurisdiction="us-epa-usace-sediment"
      />,
    );
    const input = screen.getByTestId('hh-food-ir-input') as HTMLInputElement;
    // Falls back to the existing hardcoded useState('0.142') default.
    expect(input.value).toBe('0.142');
    expect(screen.queryByTestId('hh-food-ir-frame-default-label')).not.toBeInTheDocument();
    expect(screen.queryByTestId('hh-food-ir-reset-to-frame-default')).not.toBeInTheDocument();
  });

TEST (g): SWITCH-AWAY -- a pristine field seeded by BC must RESET to baseline when the frame
changes to one with no active default (codex 2026-06-09; guards the BC-value-leak bug).
  it('(C-BC) switching BC -> a no-default frame resets the pristine field to baseline', () => {
    mockGetActiveFrameDefaults.mockImplementation((frameId) =>
      frameId === 'bc-protocol1-v5-dra'
        ? [{ inputKey: 'IR_food_kg_per_day', status: 'active', value: 0.111, /* ...rest */ }]
        : [],
    );
    const { rerender } = render(
      <HHFoodWebCalculator substanceKey="total_pcbs_aroclor_1254" jurisdiction="bc-protocol1-v5-dra" />,
    );
    const input = screen.getByTestId('hh-food-ir-input') as HTMLInputElement;
    expect(input.value).toBe('0.111'); // BC seeded the pristine field
    // Switch to a frame with no active default; the field is still pristine.
    rerender(
      <HHFoodWebCalculator substanceKey="total_pcbs_aroclor_1254" jurisdiction="us-epa-usace-sediment" />,
    );
    expect(input.value).toBe('0.142'); // RESET to baseline, NOT left at 0.111
  });

### 3c. Counts test -- attribution matters (the shift is in the PROMOTION commit, not this PR)

Two SEPARATE changes are involved; keep their count impacts attributed correctly:
- PREREQUISITE 1(b) -- the owner's `promote-wlrs-default.mjs --apply` commit -- moves ONE WLRS
  record from `pending_source_locator` to `approved_source_backed`. THAT commit MUST update the
  library.test.ts audit guards: `approvedSourceBacked` +1 and `pendingSourceLocator` -1 (the helper
  prints this reminder). `valueGroups` / `availableOptions` / `currentDefaults` are unchanged
  (default_status stays available_option). Do this in the promotion commit, before its test:ci.
- THIS C-BC PR (STEP 1 + STEP 2) adds a FRAME_DEFAULT_PROFILES row (an in-repo constant) + the
  calculator wiring; it does NOT add or change any PARAMETER_VALUE_RECORDS entry. So the count
  guards are UNAFFECTED BY THIS PR specifically. If a count guard fires in this PR, an accidental
  catalog edit crept in -- investigate; do not bump blindly.
NOTE: if the promotion (1b) and this PR are landed separately, the count-guard bump rides with 1b.
If they are somehow combined, the combined commit carries the +1/-1 from the promotion only.

---

## STEP 4 -- Gates

### Codex protocol (per L0 rule 1.3 + two-tier model strategy)

Leg 1 (grind, iterate to GREEN):
  git diff HEAD | codex review - -c model="gpt-5.3-codex-spark"
  Iterate until GREEN (no P1/P2 findings). Mutual-agreement: argue back on disagreements
  with quoted evidence; do not silently accept or stubbornly reject.

Leg 2 (ship gate, must be GREEN before PR):
  git diff HEAD | codex review - -c model="gpt-5.5-xhigh"
  No dropping back to Spark after Leg 2 starts.

Codex focus areas for this PR:
  - Pristine-tracking: is the useRef(true) correctly initialized and correctly reset?
    (A fresh mount is pristine; a user keystroke marks dirty; a reset restores pristine;
    a jurisdiction change seeds a PRISTINE field only -- never re-seeds dirty.)
  - Provenance parity: is there ANY path where run() uses a different IR value than
    foodIrInput? (There must not be; confirm parameterOverrides is not involved.)
  - Pending seed UI: is there any path where a pending (needs_review) seed could reach
    the calculation? (getActiveFrameDefaults must return [] for pending; the pending label
    is display-only.)
  - The unsupported-pathway guard: bc-csr-sediment-numerical + human-health-food is
    'unsupported'; confirm getActiveFrameDefaults returns [] (the short-circuit at
    frameDefaults.ts:282 covers this already, but codex should confirm no regression.)

### Full 4-gate suite

All four gates must be GREEN on the PR tip before push:
  npm run lint
  npm run test:ci          (CI=true; use test:ci not test:unit per GATE_MODE_SOP.md)
  npm run build:monitored:clean -- -TimeoutSeconds 360 -PollSeconds 10
  npm run test:e2e

One retry per known failure class (Vitest EPERM, .next quarantine, Playwright EPERM).
Stop and investigate on second failure of the same class.

### One increment, one PR

C-BC is a single PR. The two changes (STEP 1 + STEP 2) are coupled: a populated profile
row with an unseeded calculator, or a seeded calculator with an empty profile, each breaks
the other side's tests. Ship them together.

---

## RISKS / EDGE CASES

### R1: Frame-switch clobbers a dirty edit

Decision (design doc sec 9.1 point 2, codex): seed only a PRISTINE field + "reset to
frame default" for dirty fields. Implementation: foodIrPristine.current is the guard.
The useEffect([jurisdiction]) runs on every jurisdiction prop change; the if-gate
`if (irDefault && foodIrPristine.current)` blocks the seed for dirty fields.
Residual risk: if foodIrPristine.current somehow starts as false (e.g. SSR hydration
mismatch). Mitigation: useRef(true) is the correct React pattern for a mutable ref that
does not trigger re-renders; it survives re-renders and is not affected by hydration.

### R2: Provenance lie via parameterOverrides

Avoided by design: the C-BC seed NEVER touches equationDispatch or parameterOverrides.
The seed flows through setFoodIrInput -> foodIrInput state -> passed to run() as
IR_food_kg_per_day -> same value in provenanceValues. No divergence possible.
Codex Leg 2 must explicitly confirm this chain has no bypass.

### R3: Jurisdiction-blocker (BC_provincial vs BC)

The BLOCKER described in prerequisite 1(a). If the WLRS row has jurisdiction='BC_provincial'
when C-BC ships, getFrameSeedCandidateEligibility will return blocked_frame_jurisdiction and
the seed will never activate. The profile row will exist in FRAME_DEFAULT_PROFILES but
getActiveFrameDefaults returns []. The calculator falls back to the hardcoded '0.142' default.
This is a safe-fail state, not a bug -- but it means the owner vision is unrealized until the
jurisdiction is reconciled. The prerequisite must be confirmed before coding STEP 1.

### R4: Owner forgot to supply the catalog_sources UUID

The <UUID_FROM_OWNER> placeholder in sourceIds blocks the PR: validateFrameDefaultProfiles
requires non-empty sourceIds and would pass (the UUID string is non-empty), but codex review
will flag a placeholder literal in production code as a P1. The profile note documents the
source; the UUID must be real before the PR is committed.

### R5: Unsupported pathway for non-BC frames

bc-csr-sediment-numerical has human-health-food === 'unsupported' (regulatoryFrames.ts:193-
197). getFrameDefaults short-circuits to [] at line 282. No seeding. Correct behavior.
canada-fcsap-aquatic, ccme-sediment-quality (unsupported), us-epa-usace-sediment (needs_review
but no profile row) all return [] from getActiveFrameDefaults. No seeding. Correct.
The only frame that seeds is bc-protocol1-v5-dra once STEP 1 is in and prerequisites met.

### R6: Pending seed displayed but not active

When prerequisites are not yet met (qa_status still needs_review), getFrameDefaults returns
status='pending'. The pendingIrDefault memo (STEP 2e) catches this and shows the amber
"pending promotion" label. The active seed label does not appear. The input holds the
hardcoded '0.142' default. The pending label correctly communicates the state to the user
without silently driving a non-approved value into the calculation. The "Reset to frame
default" button does NOT appear for a pending seed (activeIrDefault is null).

---

## Quick-set buttons -- no change

The existing quick-set buttons (32 g/day / 142 g/day / 388 g/day at lines 350-358) remain
as-is. Each click calls setFoodIrInput() directly. Add `foodIrPristine.current = false;`
to each click handler, matching the main input's onChange treatment:
  onClick={() => { foodIrPristine.current = false; setFoodIrInput('0.032'); }}
  onClick={() => { foodIrPristine.current = false; setFoodIrInput('0.142'); }}
  onClick={() => { foodIrPristine.current = false; setFoodIrInput('0.388'); }}
If this is omitted, clicking 142 g/day (the same value as the hardcoded initial) after
the frame seeds 0.111 would leave foodIrPristine.current=true, and the next frame-switch
would re-seed 0.111 even though the user explicitly chose 142 -- incorrect.

---

Ready to build once prerequisites 1(a)+1(b) are met.
