import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

// Decision #8 routes `equation_latex` through KaTeX display math. That decision
// assumed the catalog contained valid LaTeX. It did not: three of the five entries
// used bare multi-character subscripts, which TeX binds to a SINGLE token, so
// `IR_sed` typeset as "IR" subscript-s followed by a literal "ed". The previous
// <pre> rendering displayed them correctly, so switching to KaTeX silently CORRUPTED
// regulatory variable names on the derivation equations -- visible to a reviewer,
// invisible to every gate.
//
// Corrupted before the fix: IR_sed, AF_sed (Human Health Direct Contact);
// C_tissue, IR_food, BSAF_effective (Human Health Food Web); plus a bare `log`
// operator typesetting as an italic l-o-g product (Eco-Direct EqP).
//
// This guards the DATA, because the defect lives in the data, not the renderer.

type EquationEntry = {
  equation_id: string;
  equation_latex: string;
  evidence_items: { value_text: string }[];
};

const CATALOG_PATH = path.join(
  process.cwd(),
  'matrix_research',
  'reference_catalog',
  'equations.json',
);

const catalog: EquationEntry[] = JSON.parse(fs.readFileSync(CATALOG_PATH, 'utf8'));

describe('equations.json -- LaTeX validity for KaTeX rendering (decision #8)', () => {
  it('has entries to check', () => {
    // Guards the guard: if the catalog ever fails to load or empties, every
    // assertion below would vacuously pass over an empty array.
    expect(catalog.length).toBeGreaterThan(0);
  });

  it('never uses a bare multi-character subscript', () => {
    // THE core assertion. `_` binds one token in TeX, so `X_abc` renders as X
    // subscript-a followed by literal "bc". Multi-character subscripts MUST be
    // braced: `X_{abc}`.
    //
    // Two-sided: this fails on the pre-fix catalog (5 violations) and passes now.
    // A test that merely asserted "equation_latex is a non-empty string" would have
    // passed throughout and caught nothing.
    const offenders: string[] = [];
    for (const entry of catalog) {
      const matches = entry.equation_latex.match(/_[A-Za-z0-9]{2,}/g);
      if (matches) offenders.push(`${entry.equation_id}: ${matches.join(', ')}`);
    }
    expect(offenders).toEqual([]);
  });

  it('uses the \\log operator rather than a bare "log"', () => {
    // A bare `log` in math mode typesets as the italic product l*o*g, which in an
    // equation full of single-letter variables reads as three more variables.
    for (const entry of catalog) {
      const bareLog = /(^|[^\\A-Za-z])log\b/.test(entry.equation_latex);
      expect(
        bareLog,
        `${entry.equation_id} contains a bare "log"; use \\log`,
      ).toBe(false);
    }
  });

  it('keeps equation_latex and its evidence value_text identical', () => {
    // The same string is stored twice per entry. They drifted apart would mean the
    // rendered equation and its own evidence record disagree -- exactly the kind of
    // silent provenance divergence this project guards elsewhere.
    for (const entry of catalog) {
      for (const ev of entry.evidence_items) {
        expect(
          ev.value_text,
          `${entry.equation_id}: value_text drifted from equation_latex`,
        ).toBe(entry.equation_latex);
      }
    }
  });

  it('keeps the test fixture in sync with the real catalog', () => {
    // DRIFT GUARD, added after this batch created exactly the divergence it prevents.
    //
    // `evidenceLibraryFixture.ts` states in its own header that it holds "trimmed
    // verbatim copies of real catalog rows". When the catalog's LaTeX was corrected,
    // the fixture kept the OLD corrupted strings -- so that verbatim claim silently
    // became false, and nothing in the suite could notice: the catalog test reads only
    // the catalog, and the fixture tests read only the fixture. Two copies of one
    // fact, no mechanism holding them together.
    //
    // This asserts every equation string the fixture carries also exists in the
    // catalog. It deliberately does NOT require the reverse (the fixture is a trimmed
    // subset by design, so the catalog may hold equations the fixture omits).
    //
    // Two-sided: reverting any fixture equation to its pre-fix form fails this by
    // name. A test that merely asserted the fixture parses, or that it is non-empty,
    // would have passed throughout the divergence.
    const fixtureSource = fs.readFileSync(
      path.join(
        process.cwd(),
        'src',
        'components',
        'matrix-options',
        '__tests__',
        'evidenceLibraryFixture.ts',
      ),
      'utf8',
    );

    const catalogEquations = new Set(catalog.map((e) => e.equation_latex));

    // Pull every "equation_latex": "..." literal out of the fixture source.
    const fixtureEquations = [
      ...fixtureSource.matchAll(/"equation_latex":\s*"((?:[^"\\]|\\.)*)"/g),
    ].map((m) => JSON.parse(`"${m[1]}"`) as string);

    expect(
      fixtureEquations.length,
      'fixture exposes no equation_latex values; the extraction regex likely broke',
    ).toBeGreaterThan(0);

    const orphans = fixtureEquations.filter((eq) => !catalogEquations.has(eq));
    expect(orphans, 'fixture equation strings not present in equations.json').toEqual([]);
  });

  it('has balanced braces in every equation', () => {
    // Unbalanced braces make KaTeX throw or silently swallow the remainder of the
    // expression -- another way to lose the tail of a regulatory equation.
    for (const entry of catalog) {
      const opens = (entry.equation_latex.match(/\{/g) ?? []).length;
      const closes = (entry.equation_latex.match(/\}/g) ?? []).length;
      expect(opens, `${entry.equation_id} brace mismatch`).toBe(closes);
    }
  });
});
