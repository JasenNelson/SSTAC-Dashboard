import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Print-cap class contract for TWO files: SsdWorkbench.tsx and EvidenceLibrary.tsx.
 *
 * The name is not a claim about the repository. Many other components render regulatory values
 * and are NOT covered here; see docs/PRINT_CLIPPING_BACKLOG_2026_08_16.md for the open set.
 *
 * A `max-h-*` container has a scrollbar on screen, so nothing is lost. On PAPER it has no
 * scrollbar, no fade and no ellipsis: the content simply stops, and a truncated list of
 * toxicity values or cross-pathway comparisons reads as a complete one. That is the failure
 * class this project has now shipped repeatedly -- the value is correct, the page just hides
 * part of it.
 *
 * There IS already a runtime print sweep in e2e/ssd-workbench.spec.ts, and it is stronger than
 * this one because it measures real layout. But it is deliberately scoped to elements
 * containing a <table>, since chrome and layout wrappers may legitimately stay capped on
 * paper. That list was missed for TWO independent reasons, either of which alone
 * would have sufficed: it renders `entry.value` / `entry.unit` in divs rather than a table,
 * AND that spec only ever drives the SSD Workbench, so it never reaches the Evidence Library
 * tab -- let alone clicks the `showDetails` toggle the list hides behind. A <table>-bearing
 * container in that panel would have been missed just as completely. A reviewer found it after
 * the "these three are the only clipping containers" fix had already been reviewed and gated.
 *
 * So this test covers the axis the runtime sweep cannot: EVERY vertical cap in these two files
 * must either reset for print, or appear in ALLOWED_CAPS with a stated reason. Adding a new
 * capped container without deciding which it is fails here.
 *
 * WHAT THIS TEST DOES NOT PROVE. It is a SOURCE-TEXT guard: it reads the file and runs regexes
 * over it. It never compiles, renders, or measures anything. So it will pass on a file that does
 * not typecheck, and it cannot tell you that a cap is actually lifted under print media -- only
 * that the class is written down. Compilation is covered by `tsc --noEmit` and the monitored
 * build; real print layout is covered by the runtime sweep in e2e/ssd-workbench.spec.ts. This
 * test is the cheap net UNDER those, not a substitute for either, and its falsification
 * exercises its own string matching rather than the rendered defect. Read it that way.
 *
 * It is also blind to any class list it cannot see as a plain attribute. CLASSNAME_PATTERN
 * matches `className="..."` only, so a cap composed through `cn(...)`, a template literal, or a
 * variable is invisible to it. That is not a live miss in these two files today -- all their
 * caps are plain attributes, checked -- but `cn(` is already used in both, so the blind spot is
 * one refactor away from being real, and it would fail OPEN.
 *
 * ALLOWED_CAPS matches on file basename plus cap string, NOT on location. So a future
 * `max-h-36` added anywhere else in SsdWorkbench.tsx would silently inherit the typeahead
 * exemption. That is a real blind spot, named here rather than discovered later.
 *
 * It is also blind to horizontal loss: `truncate`, `line-clamp-*`, `overflow-hidden` and fixed
 * `h-*` are not checked, and there are known un-reset value-bearing containers in OTHER files
 * (see docs/PRINT_CLIPPING_BACKLOG_2026_08_16.md). The scope is these two files and the
 * vertical axis. The name of this file is not a claim about the repository.
 *
 * Falsified two-sided: removing `print:max-h-none` from any covered container fails this test
 * and names the file and the offending class list; on the current tree it passes.
 */

const FILES = [
  path.join(process.cwd(), 'src', 'components', 'matrix-options', 'SsdWorkbench.tsx'),
  path.join(process.cwd(), 'src', 'components', 'matrix-options', 'EvidenceLibrary.tsx'),
];

/**
 * Caps that are deliberately KEPT on paper, with the reason. An entry here is a decision, not
 * a suppression -- each one is a container that holds no regulatory value.
 */
const ALLOWED_CAPS: { file: string; cap: string; reason: string }[] = [
  {
    file: 'SsdWorkbench.tsx',
    cap: 'max-h-36',
    reason:
      'Chemical-name typeahead suggestions. An input affordance rather than results: it holds ' +
      'no measured value, no unit and no statistical output. It DOES hold substance names, and ' +
      'its open/closed state is React state that a print does not reset, so this is a judgement ' +
      'that a truncated suggestion list costs the reader nothing -- not a proof that the list ' +
      'is absent from the page.',
  },
];

const CAP_PATTERN = /max-h-[a-z0-9.[\]/-]+/g;
const CLASSNAME_PATTERN = /className="([^"]*)"/g;

describe('print-cap class contract (SsdWorkbench, EvidenceLibrary)', () => {
  const offenders: string[] = [];
  let cappedCount = 0;
  let resetCount = 0;

  for (const file of FILES) {
    const base = path.basename(file);
    const source = fs.readFileSync(file, 'utf8');

    let match: RegExpExecArray | null;
    CLASSNAME_PATTERN.lastIndex = 0;
    while ((match = CLASSNAME_PATTERN.exec(source)) !== null) {
      const classList = match[1];
      const caps = classList.match(CAP_PATTERN) ?? [];
      // Filter out `max-h-none` explicitly. CAP_PATTERN DOES match it out of the
      // `print:max-h-none` utility, so without this line a container whose only hit was the
      // print reset would be counted as a capped container and could self-satisfy.
      const realCaps = caps.filter((cap) => cap !== 'max-h-none');
      if (realCaps.length === 0) continue;

      cappedCount += 1;

      if (classList.includes('print:max-h-none')) {
        resetCount += 1;
        continue;
      }

      // EVERY cap on this element must be independently allowed. `.some()` was wrong: it
      // exempted the whole class list as soon as ONE cap matched, so adding an un-reset
      // `max-h-96` beside the allowed `max-h-36` would have passed silently -- an exemption
      // that widens itself is worse than no exemption.
      const allowed = realCaps.every((cap) =>
        ALLOWED_CAPS.some((entry) => entry.file === base && entry.cap === cap),
      );
      if (allowed) continue;

      const line = source.slice(0, match.index).split('\n').length;
      offenders.push(`${base}:${line} caps ${realCaps.join(' ')} with no print:max-h-none`);
    }
  }

  it('found capped containers to check', () => {
    // Existence half. If the className or cap regex ever stops matching, an offenders-only
    // assertion would pass on an empty scan and certify the very drift it guards against.
    expect(cappedCount).toBeGreaterThan(0);
    expect(resetCount).toBeGreaterThan(0);
  });

  it('resets every vertical cap in these two files, or names it an allowed exception', () => {
    expect(offenders).toEqual([]);
  });
});
