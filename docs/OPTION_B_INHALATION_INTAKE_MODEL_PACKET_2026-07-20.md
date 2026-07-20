# Option B Inhalation Intake-Model Methodology Packet

## 1. PURPOSE + SCOPE
This packet outlines the design and implementation requirements for "Option B", which adds a Health Canada (HC) PQRA intake-based exposure model as a **second, selectable** method in the inhalation calculator.

**Explicit NON-goal:** This option does not replace or alter the existing EPA SSL concentration-based screening model (EPA/540/R-96/018). The SSL model remains intact and operational. This is strictly an addition of an alternative methodology lane.

## 2. THE INTAKE-BASED EQUATIONS
This methodology implements the classic HC PQRA intake form.

**Concentration/Dose Equation:**
`EC or Intake = (Cair * IR * ET * EF * ED) / (BW * AT)`

Where:
- `Cair`: Contaminant concentration in air
- `IR`: Inhalation rate (e.g., m³/day)
- `ET`: Exposure time (e.g., hours/day)
- `EF`: Exposure frequency (days/year)
- `ED`: Exposure duration (years)
- `BW`: Body weight (kg)
- `AT`: Averaging time (days)

**Non-Cancer Hazard:**
`HQ = Intake / RfD_or_RfC-equivalent`
- Screen vs target HI = 1 (BC CSR s.18).

**Cancer Risk:**
`ILCR = Intake * SF_or_IUR-equivalent`
- Screen vs target ILCR = 1e-5 (BC CSR s.18).

**Key Differences from the SSL Model:**
1. The intake model explicitly requires Inhalation Rate (IR) and Body Weight (BW), whereas the SSL model implicitly captures IR within the toxicity reference values (it cancels out).
2. The toxicity inputs in the intake model represent a dose-based reference dose (RfD) or slope factor (SF) equivalent, rather than the concentration-based RfC or IUR used in the SSL model.
3. Strict unit consistency is required to balance the dose equation compared to the simpler concentration-based derivations.

*Open Question:* A determination must be made on whether the toxicity inputs (RfD/SF equivalents vs. RfC/IUR) will differ between the two models and how they are sourced.

## 3. REQUIRED INPUTS
The intake model requires the following inputs that are not utilized by the current SSL model:

| Variable | Description | Source / Status |
| :--- | :--- | :--- |
| **IR_air (Adult)** | Adult Inhalation Rate (16.6 m³/day) | Exists: `pv-hc-pqra-v4-2024-ir-air-adult-ca` |
| **IR_air (Toddler)** | Toddler Inhalation Rate (8.3 m³/day) | Exists: `pv-hc-pqra-v4-2024-ir-air-toddler-ca` |
| **BW** | Body Weight by receptor | *New catalog row needed -- owner-gated* |
| **ET** | Exposure Time | *New catalog row needed -- owner-gated* |
| **EF / ED / AT** | Exposure Frequency, Duration, Averaging Time | Confirmed reuse from existing calculator |

## 4. VALIDATION EXAMPLES NEEDED
To validate the new intake branch, hand-worked regression examples must be authored prior to implementation. These must state the precise inputs and expected outputs, mirroring the existing `calculator.test.ts` structure. 

Required examples:
1. **Adult Non-Cancer Case:** Specified concentrations and exposure factors yielding a verifiable HQ.
2. **Toddler Non-Cancer Case:** Specified concentrations and exposure factors yielding a verifiable HQ (to validate the differing toddler IR/BW).
3. **Cancer Case:** Specified concentrations and lifetime exposure factors yielding a verifiable ILCR.

*(Note: Actual computation of these examples is deferred to the implementation phase. This is just a specification of WHAT examples are required.)*

## 5. UI + TEST SCOPE

**UI Updates:**
- Implement a model/mode selector (e.g., radio button or dropdown) to toggle between "EPA SSL Concentration-Based" and "HC PQRA Intake-Based" models.
- Dynamically render inputs based on the selected mode (e.g., reveal IR, BW, ET only when intake-based is selected).
- Wire the provenance panel for the new inputs, utilizing the established id-pin pattern (reference PR #697).

**Test Scope:**
- **Unit Tests:** New branch in the calculator tests for the intake equations.
- **Component Tests:** Verify the mode switch functionality and dynamic input rendering, including provenance wiring.

## 6. OWNER RULINGS REQUIRED
Implementation is blocked pending owner decisions on the following:

1. **Precedence:** Which model is the authoritative/default when both are applicable to a site?
2. **Toxicity Basis:** Determination on using RfD/SF (dose) versus RfC/IUR (concentration) for the intake model, and establishing their trusted data sources.
3. **Catalog Rows:** Approval to create new catalog rows for BW and ET.
4. **Screening Targets:** Confirmation that HI=1 and ILCR=1e-5 (BC CSR s.18) remain the screening targets for this model.
5. **Validation Scope:** Definition of the validation sign-off process and required level of rigor for the hand-worked examples.

## 7. EFFORT + RISK
**Effort Assessment:** Real feature level. Requires new equations, inputs, a selector UI, validation benchmarks, and comprehensive testing (unit + component), plus full codex/review loops.
**Risk:** The introduction of a parallel methodology increases the complexity. This feature must go through the full suite of shipment gates and explicit owner value-verification before merging.
