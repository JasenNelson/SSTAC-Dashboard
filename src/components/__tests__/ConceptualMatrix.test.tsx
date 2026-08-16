import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import ConceptualMatrix, { MissingPathwayCell } from '../ConceptualMatrix';

// These tests pin the DECISION, not the implementation that happens to exist.
//
// History worth keeping: the previous version of this view shipped a 2x2 legend
// whose axis labels lived only in an `aria-label`, and the test of the day
// asserted merely that the digits 1-4 appeared. It passed while the spec was
// violated, because it described what it received rather than what was asked
// for. The owner caught it by eye. Assertions below therefore target the things
// a reader would actually lose if the page regressed: the axis labels as real
// text, the presence of content inside each quadrant, and the source-of-truth
// facts drawn from the project plan.

describe('ConceptualMatrix -- Vision for Modernizing Schedule 3.4', () => {
  it('leads with all three parts of Schedule 3.4 as peer cards', () => {
    // Structure decision (owner, 2026-08-15): the page introduces the WHOLE
    // three-part structure first, as three sibling containers, and only then
    // drills into Part 1. Asserting all three exist as peers inside one
    // container is what distinguishes that from the earlier shape, where Part 1
    // was expanded immediately and Parts 2/3 trailed underneath as an
    // afterthought.
    render(<ConceptualMatrix />);

    expect(
      screen.getByRole('heading', { name: /Vision for Modernizing Schedule 3\.4/i }),
    ).toBeInTheDocument();

    const overview = screen.getByTestId('schedule-34-parts');

    // All three parts are peers in the SAME container.
    expect(within(overview).getByTestId('schedule-part-part-1')).toBeInTheDocument();
    expect(within(overview).getByTestId('schedule-part-part-2')).toBeInTheDocument();
    expect(within(overview).getByTestId('schedule-part-part-3')).toBeInTheDocument();

    expect(within(overview).getByText(/Matrix Numerical Sediment Standards/i)).toBeInTheDocument();
    expect(within(overview).getByText(/Generic Standards: Human Health/i)).toBeInTheDocument();
    expect(within(overview).getByText(/Generic Standards: Ecological Health/i)).toBeInTheDocument();

    // Negative half: the overview must stay an OVERVIEW. If the four-quadrant
    // matrix were nested inside it, the "structure first, detail second"
    // decision would be silently undone while every positive assertion above
    // still passed.
    expect(within(overview).queryByTestId('schedule-34-matrix')).not.toBeInTheDocument();
  });

  it('puts the Part 1 detail AFTER the three-part overview, not inside it', () => {
    // Order is the whole point of the restructure, so it is asserted directly
    // rather than inferred. compareDocumentPosition is the discriminating check:
    // a version that rendered the matrix above the overview would still satisfy
    // every "is it present" assertion.
    render(<ConceptualMatrix />);

    const overview = screen.getByTestId('schedule-34-parts');
    const matrix = screen.getByTestId('schedule-34-matrix');

    const overviewComesFirst = Boolean(
      overview.compareDocumentPosition(matrix) & Node.DOCUMENT_POSITION_FOLLOWING,
    );
    expect(overviewComesFirst).toBe(true);
  });

  it('states the purpose and the four non-structural Phase 2 objectives', () => {
    // Plan sections 1.2 (Purpose) and 1.4 (Objectives). 1.4's first three
    // objectives restate Parts 1/2/3, which the overview cards already carry, so
    // only the four NON-duplicated objectives belong here.
    //
    // Two-sided: the negative half asserts the duplicated Part 1/2/3 objective
    // bullets did NOT get pasted in alongside the cards. Without it, someone
    // "completing" the page from the source document would reintroduce the
    // duplication and every positive assertion would still pass.
    render(<ConceptualMatrix />);

    expect(screen.getByText(/Purpose\./)).toBeInTheDocument();

    const objectives = screen.getByTestId('phase-2-objectives');
    expect(within(objectives).getByText(/Substance prioritization framework/i)).toBeInTheDocument();
    expect(within(objectives).getByText(/BC Aquatic Database/i)).toBeInTheDocument();
    expect(within(objectives).getByText(/Policy-ready input parameters/i)).toBeInTheDocument();
    expect(within(objectives).getByText(/Matrix Options Paper/i)).toBeInTheDocument();

    // Exactly four; a fifth would mean the duplicated structural bullets crept back.
    expect(objectives.querySelectorAll('li')).toHaveLength(4);

    // Negative half: no Part 1/2/3 restatement inside the objectives list.
    expect(objectives.textContent ?? '').not.toMatch(/Part [123]/);
  });

  it('points objectives at their home tab only where one genuinely exists', () => {
    // The cross-references are plain text, not navigation, so the meaningful
    // assertions are that the three real homes are named and that the
    // prioritization framework -- which no tab owns -- is NOT given a
    // fabricated one. Inventing a plausible tab there would be a content
    // defect that looks completely fine on screen.
    render(<ConceptualMatrix />);

    const objectives = screen.getByTestId('phase-2-objectives');
    expect(within(objectives).getByText(/See Interactive Map/i)).toBeInTheDocument();
    expect(within(objectives).getByText(/See References & Values/i)).toBeInTheDocument();
    expect(within(objectives).getByText(/See TWG Review/i)).toBeInTheDocument();

    // Negative half: exactly three cross-references, and the prioritization
    // objective carries none.
    expect(within(objectives).getAllByText(/^See /i)).toHaveLength(3);
    const prioritization = screen.getByTestId('objective-substance-prioritization-framework');
    expect(within(prioritization).queryByText(/^See /i)).not.toBeInTheDocument();
  });

  it('renders all four receptor-pathways with no missing-content placeholder', () => {
    // Owner-decided 2026-08-15: a missing receptor-pathway now degrades ONE cell to a
    // visible placeholder instead of throwing during render. There is no error
    // boundary above this component, so the previous throw would have white-screened
    // the entire Vision tab over a single absent entry.
    //
    // This assertion is the practical guard for BOTH halves at once:
    //  - Positive: exactly four real quadrants render, and zero placeholders, so the
    //    data is complete today.
    //  - Negative/falsification: removing a PATHWAYS entry makes this fail by COUNT
    //    (3 cells + 1 placeholder). Crucially it fails as an assertion, not as a
    //    thrown error -- which is itself the proof that the placeholder path works and
    //    the tab survives. Under the old `throw`, the same edit would have crashed the
    //    render and taken every other assertion in this file down with it.
    render(<ConceptualMatrix />);

    const matrix = screen.getByTestId('schedule-34-matrix');
    const cells = [
      'pathway-ecological-direct',
      'pathway-ecological-food',
      'pathway-human-health-direct',
      'pathway-human-health-food',
    ];
    for (const id of cells) {
      expect(within(matrix).getByTestId(id)).toBeInTheDocument();
    }

    // NOTE: this line is a WEAK companion, not the real guard. If a placeholder ever
    // rendered, one of the getByTestId calls above would already have thrown and
    // aborted this test before reaching here -- so it can never actually observe a
    // placeholder. It is kept only to state the expectation; the REAL coverage of the
    // placeholder path is the dedicated test below, which renders the component
    // directly. (Caught in review round 4: without that test, `MissingPathwayCell`
    // had zero coverage anywhere in the repo, and the component's own comment
    // claiming it is "directly assertable" was never discharged.)
    expect(within(matrix).queryAllByTestId('pathway-missing')).toHaveLength(0);
  });

  it('renders a visible, coordinate-naming placeholder when a pathway is missing', () => {
    // The placeholder replaced a render-time throw. Its whole justification is that a
    // missing entry degrades ONE cell instead of white-screening the Vision tab -- so
    // the placeholder itself must be proven to render, name the coordinate, and carry
    // the directional border form (the all-sides form silently loses to CARD's
    // border-slate-200, which is the exact bug fixed in this batch).
    //
    // MissingPathwayCell is unreachable through <ConceptualMatrix /> with the current
    // static data (AXIS_ROWS x EXPOSURE_COLUMNS is exactly PATHWAYS), so it is
    // rendered directly. That is the only way to cover it without mutating module
    // state.
    //
    // Two-sided falsification:
    //  - Positive: the testid, the coordinate text, and the rose directional border.
    //  - Negative: it must NOT use the all-sides `border-rose-600` form, which would
    //    render as slate and make the "missing" state visually indistinguishable from
    //    a normal quadrant -- reintroducing the very defect this batch fixed.
    render(<MissingPathwayCell rowLabel="Ecological Health" columnLabel="Direct Exposure" />);

    const cell = screen.getByTestId('pathway-missing');
    expect(cell).toBeInTheDocument();
    expect(cell.textContent).toMatch(/Ecological Health/);
    expect(cell.textContent).toMatch(/Direct Exposure/);

    expect(cell.className).toMatch(/\bborder-t-rose-600\b/);
    expect(cell.className).not.toMatch(/\bborder-rose-\d{3}\b/);
  });

  it('renders the matrix axis labels as real text on both axes', () => {
    // The regression that shipped last time: axis names present only as an
    // `aria-label`, invisible to sighted readers. `getByText` reads text content
    // and cannot be satisfied by an ARIA attribute, so reverting to that
    // approach fails here rather than passing quietly.
    render(<ConceptualMatrix />);
    const matrix = screen.getByTestId('schedule-34-matrix');

    expect(within(matrix).getByText('Direct Exposure')).toBeInTheDocument();
    expect(within(matrix).getByText('Exposure through Food')).toBeInTheDocument();
    expect(within(matrix).getByText('Ecological Health')).toBeInTheDocument();
    expect(within(matrix).getByText('Human Health')).toBeInTheDocument();

    expect(matrix.textContent).toContain('Direct Exposure');
    expect(matrix.textContent).toContain('Human Health');
  });

  it('puts real content inside all four quadrants, not just a number', () => {
    // The owner's objection to the superseded design was that each quadrant held
    // a single meaningless digit on a mostly-empty page. Each quadrant must now
    // carry its plain-language lead AND its official receptor-pathway name.
    //
    // Two-sided: the negative half asserts the discarded 1-4 numbering is gone,
    // so a revert to the numbered-square legend fails.
    render(<ConceptualMatrix />);

    const cells = [
      {
        testId: 'pathway-ecological-direct',
        lead: /Protects the small animals that live in the mud itself\./i,
        official: /Protect Ecological Health - Direct Exposure/i,
      },
      {
        testId: 'pathway-ecological-food',
        lead: /Protects fish, birds, and other wildlife that eat contaminated prey\./i,
        official: /Protect Ecological Health - Exposure to Sediment Contaminants in Food/i,
      },
      {
        testId: 'pathway-human-health-direct',
        lead: /Protects people who touch or accidentally swallow contaminated sediment\./i,
        official: /Protect Human Health - Direct Exposure/i,
      },
      {
        testId: 'pathway-human-health-food',
        lead: /Protects people who rely on fish and shellfish from these waters as food\./i,
        official: /Protect Human Health - Exposure to Sediment Contaminants in Food/i,
      },
    ];

    for (const cell of cells) {
      const el = screen.getByTestId(cell.testId);
      expect(within(el).getByText(cell.lead)).toBeInTheDocument();
      expect(within(el).getByText(cell.official)).toBeInTheDocument();
    }

    // Negative half: the meaningless quadrant numbering must not come back.
    //
    // This assertion was STRENGTHENED after falsification exposed the first
    // version as near-vacuous. It originally read
    // `within(matrix).queryByText(n)` for n in 1-4, which matches only an
    // element whose ENTIRE normalized text is that digit. Re-adding a numeral
    // next to other text in the same node -- the likeliest way numbering would
    // actually creep back -- passed it clean.
    //
    // No digit belongs anywhere in this matrix: not in the four leads, the four
    // official pathway names, the four detail strings, or the axis labels
    // (verified against the component's data). So the strict form both states
    // the real intent and cannot be satisfied by a stray digit hiding inside a
    // larger text node.
    const matrix = screen.getByTestId('schedule-34-matrix');
    expect(matrix.textContent ?? '').not.toMatch(/\d/);
  });

  it('keeps each quadrant technical detail collapsed behind a 44px disclosure', () => {
    // Owner spec: the plain-language lead shows always, the technical detail is
    // expandable. `<details>` without `open` is collapsed, and the detail text
    // still exists in the DOM (jsdom renders closed <details> children), so the
    // meaningful assertion is on the OPEN STATE, not on text presence.
    //
    // Two-sided: positive asserts a disclosure exists per quadrant and starts
    // closed; negative asserts none is `open`, so shipping them all expanded --
    // which would reproduce the wall-of-text the collapse exists to avoid --
    // fails.
    render(<ConceptualMatrix />);

    const matrix = screen.getByTestId('schedule-34-matrix');
    const disclosures = matrix.querySelectorAll('details');
    expect(disclosures).toHaveLength(4);

    disclosures.forEach((d) => {
      expect(d.hasAttribute('open')).toBe(false);
      const summary = d.querySelector('summary');
      expect(summary).not.toBeNull();
      // Decision #1's 44px touch floor applies to this control too.
      expect(summary?.className).toMatch(/min-h-\[44px\]/);
    });

    // The detail text is present but collapsed; assert one to prove the content
    // was moved into the disclosure rather than deleted.
    expect(
      within(matrix).getByText(/Equilibrium Partitioning \(EqP\)/i),
    ).toBeInTheDocument();
  });

  it('keeps the substantive terminology the copy pass has dropped before', () => {
    // Round 1 restored "Indigenous" after a copy rewrite silently deleted it;
    // round 2 found the same pass had dropped terms from three other cards. This
    // page was rewritten again for the Vision redesign, so the guard is
    // re-asserted against the new markup rather than assumed to still hold.
    render(<ConceptualMatrix />);

    for (const term of [
      'Indigenous',
      'benthic invertebrates',
      'Equilibrium Partitioning',
      'Acid Volatile Sulfide',
      'Biota-Sediment Accumulation Factors',
      'dermal absorption',
      'biomagnification',
      'persistence',
    ]) {
      expect(screen.getByText(new RegExp(term, 'i'))).toBeInTheDocument();
    }
  });

  it('uses exactly two semantic hues, one per receptor axis (#3)', () => {
    // Decision #3: colour encodes a real axis and nothing else. Ecological and
    // Human Health quadrants must differ from each other and match within pairs.
    render(<ConceptualMatrix />);

    const ecoDirect = screen.getByTestId('pathway-ecological-direct');
    const ecoFood = screen.getByTestId('pathway-ecological-food');
    const hhDirect = screen.getByTestId('pathway-human-health-direct');
    const hhFood = screen.getByTestId('pathway-human-health-food');

    // THIS ASSERTION WAS REWRITTEN AFTER IT CERTIFIED THE DEFECT IT GUARDED.
    //
    // The first version asserted `/border-emerald-600/` and passed -- while the
    // colour did not render AT ALL. `PathwayCell` composes AXIS_STYLES with CARD via
    // a plain template literal (no twMerge), and CARD's all-sides
    // `border-slate-200` is emitted later in the compiled CSS than the all-sides
    // `border-emerald-600`, so slate won. Browser-verified: both axes computed
    // `oklch(0.929 0.013 255.508)` -- identical slate on all four quadrants.
    //
    // jsdom cannot compute a colour from an external stylesheet, so the enforceable
    // contract is the DIRECTIONAL utility form: `border-t-<colour>`, which sits
    // later in the cascade than the all-sides `border-<colour>` and therefore wins
    // regardless of composition order.
    //
    // Two-sided falsification:
    //  - Positive: each axis carries its `border-t-<hue>` directional utility.
    //  - Negative: the all-sides form must be ABSENT. Reverting to
    //    `border-emerald-600` fails here, whereas the old assertion passed. That
    //    absence check is the entire point -- it is what distinguishes a colour that
    //    renders from a class that is merely present.
    expect(ecoDirect.className).toMatch(/\bborder-t-emerald-600\b/);
    expect(ecoFood.className).toMatch(/\bborder-t-emerald-600\b/);
    expect(hhDirect.className).toMatch(/\bborder-t-sky-600\b/);
    expect(hhFood.className).toMatch(/\bborder-t-sky-600\b/);

    // Negative half 1: no all-sides colour utility, which loses to CARD's slate.
    for (const q of [ecoDirect, ecoFood, hhDirect, hhFood]) {
      expect(q.className).not.toMatch(/\bborder-(emerald|sky)-\d{3}\b/);
    }

    // Negative half 2: the axes must not share a hue, or the encoding says nothing.
    expect(ecoDirect.className).not.toMatch(/border-t-sky-/);
    expect(hhDirect.className).not.toMatch(/border-t-emerald-/);
  });
});
