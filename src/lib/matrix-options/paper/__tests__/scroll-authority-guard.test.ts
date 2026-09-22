/*
 * STATIC GUARD: no raw scroll API outside the scroll authority
 * (AMENDMENT-M1-SCROLL-AUTHORITY-001 section 3; writer brief section 4.3).
 *
 * Fails when `scrollIntoView`, `scrollIntoViewIfNeeded`, `scrollBy`, `scrollTo`,
 * `window.scroll(`, an assignment to `scrollTop` / `scrollLeft`, or a `.focus(`
 * call without `preventScroll: true` appears in paper-tree PRODUCT code outside
 * `src/lib/matrix-options/paper/scroll-authority.ts`.
 *
 * HOLISTIC_R2 F3 additions: the authority's own environment primitives
 * (`scrollPageBy`, `scrollElementIntoView`, `browserScrollEnvironment`) are
 * forbidden outside it too, the factory is no longer exported, and the scan is
 * checked for REACH - a file anywhere under `src/` that imports the authority
 * must be inside a scan root, so a new M2 directory cannot escape it.
 *
 * A guard that scans nothing, or scans the wrong tree, passes forever; so does a
 * detector that cannot see a violation. This file therefore proves it could
 * fail, four ways, each in its own test:
 *   1. SCOPE: every configured root contributes files, the scan names
 *      RevisedPaperWorkspace.tsx and the authority itself, and every file that
 *      reaches the authority is inside it.
 *   2. POSITIVE CONTROL: the detector reports every forbidden form in a known-bad
 *      source, including a violation on a line that also carries a comment
 *      naming a forbidden token, and reports nothing for a known-good source
 *      whose only forbidden tokens are inside comments -- the shape round 7's
 *      scanner was fooled by.
 *   3. REAL-BYTES CONTROL: run on the authority's own bytes, which legitimately
 *      call the raw APIs, the detector reports them.
 *
 * Comments are removed by the TypeScript printer, which parses TSX correctly
 * (an apostrophe in JSX text cannot desynchronise it the way a hand-written
 * quote tracker can). Test files are out of scope: they stub these APIs.
 */
import fs from 'node:fs';
import path from 'node:path';

import ts from 'typescript';
import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();
const SCAN_ROOTS = [
  'src/app/(dashboard)/matrix-options',
  'src/app/api/matrix-options',
  'src/components/matrix-options',
  'src/lib/matrix-options',
  'src/stores/matrix-options',
];
const EXCEPTIONS = [
  'src/components/matrix-options/CategorySelector.tsx',
  'src/components/matrix-options/EcoFoodBSAFCalculator.tsx',
  'src/components/matrix-options/EvidenceLibrary.tsx',
  'src/components/matrix-options/HHFoodWebCalculator.tsx',
  'src/components/matrix-options/MatrixOptionsPrimaryNavigation.tsx',
  'src/components/matrix-options/SedimentUseNavigator.tsx',
  'src/components/matrix-options/SubstanceCombobox.tsx',
];
const AUTHORITY = 'src/lib/matrix-options/paper/scroll-authority.ts';
/*
 * HOLISTIC_R2 F3/F8. A lexical scan of three fixed directories cannot see a new
 * one: an M2 surface placed in, say, `src/components/matrix-options/review/`
 * would scroll unguarded. So the scan scope is checked for REACH as well as
 * content - every product file anywhere under `src/` that imports the authority
 * (directly, or through the workspace's re-exports) must be inside a scan root.
 */
const REACH_ROOT = 'src';
const AUTHORITY_IMPORT = /matrix-options\/paper\/scroll-authority|from '\.{1,2}\/scroll-authority'|browserScrollEnvironment|PaperScrollAuthority/;

function isProductSource(relative: string): boolean {
  if (!/\.(ts|tsx)$/.test(relative)) return false;
  if (/\.d\.ts$/.test(relative)) return false;
  if (relative.split('/').includes('__tests__')) return false;
  return !/\.(test|spec)\.(ts|tsx)$/.test(relative);
}

function listFiles(relativeDir: string): string[] {
  const absolute = path.join(ROOT, relativeDir);
  if (!fs.existsSync(absolute)) return [];
  const out: string[] = [];
  for (const entry of fs.readdirSync(absolute, { withFileTypes: true })) {
    const relative = `${relativeDir}/${entry.name}`;
    if (entry.isDirectory()) out.push(...listFiles(relative));
    else if (isProductSource(relative)) out.push(relative);
  }
  return out;
}

/** Every paper-tree product source, the authority included (it is excluded from the VERDICT, not the scan). */
function scanScope(): string[] {
  return SCAN_ROOTS.flatMap(listFiles).sort();
}

/**
 * Every product file in `files` that reaches the authority, by `read`. Taking
 * both as parameters is what lets the control below drive the SAME function
 * over synthetic files and see it separate a reaching file from a plain one.
 */
function filesReachingAuthority(files: readonly string[], read: (file: string) => string): string[] {
  return files.filter((file) => AUTHORITY_IMPORT.test(read(file))).sort();
}

function stripComments(source: string, fileName = 'source.tsx'): string {
  const kind = fileName.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const file = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, false, kind);
  return ts.createPrinter({ removeComments: true }).printFile(file);
}

const FORBIDDEN: readonly (readonly [string, RegExp])[] = [
  // HOLISTIC_R2 F3: the authority's own environment primitives are raw scrolls
  // with no arbitration, so naming them anywhere else is a violation too.
  ['scrollPageBy', /\bscrollPageBy\b/],
  ['scrollElementIntoView', /\bscrollElementIntoView\b/],
  ['browserScrollEnvironment', /\bbrowserScrollEnvironment\b/],
  ['scrollIntoView', /\bscrollIntoView\b/],
  ['scrollIntoViewIfNeeded', /\bscrollIntoViewIfNeeded\b/],
  ['scrollBy', /\bscrollBy\b/],
  ['scrollTo', /\bscrollTo\b/],
  ['window.scroll(', /\.scroll\s*\(/],
  ['scrollTop assignment', /\bscrollTop\s*(?:[-+*/%]|\*\*|<<|>>>?|&&|\|\||\?\?|[&|^])?=(?!=)/],
  ['scrollLeft assignment', /\bscrollLeft\s*(?:[-+*/%]|\*\*|<<|>>>?|&&|\|\||\?\?|[&|^])?=(?!=)/],
];

/** Reports every raw scroll API use in `source`, after removing comments. */
function detectRawScroll(source: string, fileName = 'source.tsx'): string[] {
  const code = stripComments(source, fileName);
  const found: string[] = [];
  for (const [name, pattern] of FORBIDDEN) if (pattern.test(code)) found.push(name);
  const focusCall = /\.focus\s*\(/g;
  let match: RegExpExecArray | null;
  while ((match = focusCall.exec(code)) !== null) {
    let depth = 0;
    let end = match.index + match[0].length - 1;
    for (; end < code.length; end += 1) {
      if (code[end] === '(') depth += 1;
      else if (code[end] === ')') {
        depth -= 1;
        if (depth === 0) break;
      }
    }
    const args = code.slice(match.index + match[0].length, end);
    if (!/\bpreventScroll\s*:\s*true\b/.test(args)) {
      found.push('focus without preventScroll');
      break;
    }
  }
  return found;
}

describe('scroll authority static guard', () => {
  it('SCOPE: every configured root contributes files, and the scan includes RevisedPaperWorkspace.tsx and the authority itself', () => {
    // Per-root, so a renamed or emptied root cannot hide behind the others.
    for (const root of SCAN_ROOTS) expect({ root, files: listFiles(root).length > 0 }).toEqual({ root, files: true });
    const scope = scanScope();
    expect(scope.length).toBeGreaterThan(5);
    expect(scope).toContain('src/components/matrix-options/paper/RevisedPaperWorkspace.tsx');
    expect(scope).toContain(AUTHORITY);
    for (const file of EXCEPTIONS) expect(scope).toContain(file);
    // And every scanned file is really read (a path that does not resolve would read as clean).
    for (const file of scope) expect(fs.statSync(path.join(ROOT, file)).size).toBeGreaterThan(0);
  });

  it('SCOPE REACH: every product file under src that reaches the authority is inside a scan root (HOLISTIC_R2 F3/F8)', () => {
    // POSITIVE CONTROL first, over the same function: it must separate a file
    // that reaches the authority from one that does not, or "all reached files
    // are in scope" would be a statement about an empty set.
    const synthetic = {
      'src/components/matrix-options/review/ReviewScroller.tsx': "import { PaperScrollAuthority } from '@/lib/matrix-options/paper/scroll-authority';",
      'src/components/matrix-options/review/Plain.tsx': "import { useState } from 'react';",
    } as Record<string, string>;
    expect(filesReachingAuthority(Object.keys(synthetic), (file) => synthetic[file])).toEqual([
      'src/components/matrix-options/review/ReviewScroller.tsx',
    ]);

    const everyProductSource = listFiles(REACH_ROOT);
    expect(everyProductSource.length).toBeGreaterThan(50);
    const reaching = filesReachingAuthority(everyProductSource, (file) => fs.readFileSync(path.join(ROOT, file), 'utf8'));
    // The known reachers, so this cannot pass by finding nothing at all.
    expect(reaching).toContain('src/components/matrix-options/paper/RevisedPaperWorkspace.tsx');
    expect(reaching).toContain(AUTHORITY);
    const scope = new Set(scanScope());
    expect(reaching.filter((file) => !scope.has(file))).toEqual([]);
  });

  it('POSITIVE CONTROL: the detector reports every forbidden form, even beside a comment naming a forbidden token, and ignores tokens that exist only in comments', () => {
    const bad = [
      "// scrollIntoView is only allowed in the authority",
      "export function a(el: HTMLElement) { el.scrollIntoView({ block: 'start' }); /* scrollBy */ }",
      "export function b() { window.scrollBy(0, 10); }",
      // An apostrophe in JSX text right before real code: a quote-tracking stripper desynchronises here.
      "export const J = () => <p>A reader's note, then code the scanner must still see</p>;",
      "export function c() { window.scrollTo(0, 0); }",
      "export function d() { window.scroll(0, 0); }",
      "export function e(el: HTMLElement) { el.scrollTop = 5; el.scrollLeft += 1; }",
      "export function f(el: HTMLElement) { el.focus(); }",
      "export function g(el: HTMLElement) { (el as unknown as { scrollIntoViewIfNeeded: () => void }).scrollIntoViewIfNeeded(); }",
      // HOLISTIC_R2 F3: the authority's own primitives, reached around the front door.
      "export function h(el: HTMLElement) { browserScrollEnvironment().scrollPageBy(10); }",
      "export function i(el: HTMLElement) { browserScrollEnvironment().scrollElementIntoView(el); }",
    ].join('\n');
    expect(detectRawScroll(bad)).toEqual([
      'scrollPageBy',
      'scrollElementIntoView',
      'browserScrollEnvironment',
      'scrollIntoView',
      'scrollIntoViewIfNeeded',
      'scrollBy',
      'scrollTo',
      'window.scroll(',
      'scrollTop assignment',
      'scrollLeft assignment',
      'focus without preventScroll',
    ]);
    // Each form alone, so no form is only ever detected alongside another.
    expect(detectRawScroll('export const x = (el: HTMLElement) => el.scrollIntoView?.({ block: "start" });')).toEqual(['scrollIntoView']);
    expect(detectRawScroll('export const x = (el: HTMLElement) => { el.scrollTop = 1; };')).toEqual(['scrollTop assignment']);
    expect(detectRawScroll('export const x = (el: HTMLElement) => el.focus({ preventScroll: false });')).toEqual(['focus without preventScroll']);
    expect(detectRawScroll('export const x = () => browserScrollEnvironment().scrollPageBy(1);')).toEqual(['scrollPageBy', 'browserScrollEnvironment']);

    const good = [
      "// el.scrollIntoView({ block: 'start' }) and window.scrollBy(0, 1) are the authority's job.",
      '/* el.scrollTop = 0; el.focus(); window.scrollTo(0, 0); */',
      "export function a(el: HTMLElement, reader: { scrollTop: number }) {",
      '  el.focus({ preventScroll: true });',
      '  const atEnd = reader.scrollTop + 1 >= 10 && reader.scrollTop === 3;',
      "  document.addEventListener('scroll', () => {}, { passive: true });",
      "  return <p>The reader's place: {String(atEnd)}</p>; // a trailing scrollBy comment",
      '}',
    ].join('\n');
    expect(detectRawScroll(good)).toEqual([]);
  });

  it('REAL-BYTES CONTROL: the authority itself, which legitimately scrolls, is reported by the detector, and it does not export its raw-scroll environment', () => {
    const authority = fs.readFileSync(path.join(ROOT, AUTHORITY), 'utf8');
    const found = detectRawScroll(authority, AUTHORITY);
    expect(found).toContain('scrollIntoView');
    expect(found).toContain('scrollBy');
    // HOLISTIC_R2 F3: an exported environment factory is a front door around the
    // authority. POSITIVE CONTROL first, so this cannot pass by matching nothing.
    const exportsEnvironment = (source: string) => /export\s+(?:function|const|\{[^}]*)\s*browserScrollEnvironment/.test(source);
    expect(exportsEnvironment('export function browserScrollEnvironment(): PaperScrollEnvironment {')).toBe(true);
    expect(exportsEnvironment('export { browserScrollEnvironment };')).toBe(true);
    expect(exportsEnvironment('function browserScrollEnvironment(): PaperScrollEnvironment {')).toBe(false);
    expect(exportsEnvironment(authority)).toBe(false);
  });

  const EXCEPTION_DETAILS: Record<string, { forms: string[]; reason: string }> = {
    'src/components/matrix-options/CategorySelector.tsx': {
      forms: ['focus without preventScroll'],
      reason: 'Roving tabindex focus follow-up on category change.'
    },
    'src/components/matrix-options/EcoFoodBSAFCalculator.tsx': {
      forms: ['focus without preventScroll'],
      reason: 'Roving tabindex focus follow-up on calculator input.'
    },
    'src/components/matrix-options/EvidenceLibrary.tsx': {
      forms: ['scrollTo', 'scrollTop assignment'],
      reason: 'Manual scroll reset on evidence panel content change.'
    },
    'src/components/matrix-options/HHFoodWebCalculator.tsx': {
      forms: ['focus without preventScroll'],
      reason: 'Roving tabindex focus follow-up on calculator input.'
    },
    'src/components/matrix-options/MatrixOptionsPrimaryNavigation.tsx': {
      forms: ['focus without preventScroll'],
      reason: 'Roving tabindex focus follow-up on navigation.'
    },
    'src/components/matrix-options/SedimentUseNavigator.tsx': {
      forms: ['focus without preventScroll'],
      reason: 'Roving tabindex focus follow-up on scenario selection.'
    },
    'src/components/matrix-options/SubstanceCombobox.tsx': {
      forms: ['focus without preventScroll'],
      reason: 'Focus management for combobox input.'
    }
  };

  function guardVerdict(files: string[], read: (file: string) => string): string[] {
    const violations: string[] = [];
    const seenExceptions = new Set<string>();

    for (const file of files) {
      if (file === AUTHORITY) continue;
      
      const source = read(file);
      const found = detectRawScroll(source, file);
      const exception = EXCEPTION_DETAILS[file];

      if (exception) {
        seenExceptions.add(file);
        // Stale exception or over-wide exception or unlisted form
        const expected = exception.forms.slice().sort();
        const actual = found.slice().sort();
        if (expected.join(',') !== actual.join(',')) {
          violations.push(`${file}: expected forms [${expected.join(', ')}], found [${actual.join(', ')}]`);
        }
      } else if (found.length > 0) {
        violations.push(`${file}: ${found.join(', ')}`);
      }
    }

    // Check for stale exceptions (file no longer exists)
    for (const file of Object.keys(EXCEPTION_DETAILS)) {
      if (!seenExceptions.has(file)) {
        violations.push(`${file}: exception listed but file not in scan scope or not provided`);
      }
    }

    return violations;
  }

  it('POSITIVE CONTROLS: guard detects a bypass that never imports the authority, and checks exception exactness', () => {
    const synthetic = {
      'src/components/matrix-options/review/Bypass.tsx': "export function bypass(el: HTMLElement) { el.scrollIntoView(); }",
      'src/components/matrix-options/review/FocusBypass.tsx': "export function focus(el: HTMLElement) { el.focus(); }",
      'src/components/matrix-options/CategorySelector.tsx': "export function c(el: HTMLElement) { el.focus(); el.scrollIntoView(); }", // Extra form
      'src/components/matrix-options/EvidenceLibrary.tsx': "export function e(el: HTMLElement) { el.scrollTo({top: 0}); }", // Missing form
      'src/components/matrix-options/review/Clean.tsx': "export function clean() {}",
      ...Object.fromEntries(Object.entries(EXCEPTION_DETAILS).filter(([k]) => k !== 'src/components/matrix-options/CategorySelector.tsx' && k !== 'src/components/matrix-options/EvidenceLibrary.tsx').map(([k, v]) => [k, `// dummy\n${v.forms.map(f => f === 'focus without preventScroll' ? 'el.focus();' : f === 'scrollTo' ? 'el.scrollTo();' : 'el.scrollTop = 0;').join('\n')}`]))
    };

    const violations = guardVerdict(Object.keys(synthetic), (file) => synthetic[file as keyof typeof synthetic]);
    
    expect(violations).toContain('src/components/matrix-options/review/Bypass.tsx: scrollIntoView');
    expect(violations).toContain('src/components/matrix-options/review/FocusBypass.tsx: focus without preventScroll');
    expect(violations).toContain('src/components/matrix-options/CategorySelector.tsx: expected forms [focus without preventScroll], found [focus without preventScroll, scrollIntoView]');
    expect(violations).toContain('src/components/matrix-options/EvidenceLibrary.tsx: expected forms [scrollTo, scrollTop assignment], found [scrollTo]');
    expect(violations.find(v => v.includes('Clean.tsx'))).toBeUndefined();
  });

  it('POSITIVE CONTROLS: guard reports a synthetic exception entry that does not exist and one that does not exhibit its forms as stale', () => {
    try {
      EXCEPTION_DETAILS['src/components/matrix-options/DoesNotExist.tsx'] = { forms: ['scrollIntoView'], reason: 'Synthetic' };
      EXCEPTION_DETAILS['src/components/matrix-options/DoesNotExhibit.tsx'] = { forms: ['scrollBy'], reason: 'Synthetic' };
      
      const synthetic = {
        'src/components/matrix-options/DoesNotExhibit.tsx': "export function c() { /* no scrollBy here */ }",
      };

      const violations = guardVerdict(Object.keys(synthetic), (file) => synthetic[file as keyof typeof synthetic]);
      
      expect(violations).toContain('src/components/matrix-options/DoesNotExist.tsx: exception listed but file not in scan scope or not provided');
      expect(violations).toContain('src/components/matrix-options/DoesNotExhibit.tsx: expected forms [scrollBy], found []');
    } finally {
      delete EXCEPTION_DETAILS['src/components/matrix-options/DoesNotExist.tsx'];
      delete EXCEPTION_DETAILS['src/components/matrix-options/DoesNotExhibit.tsx'];
    }
  });

  it('no raw scroll API is reachable in matrix-options product code outside scroll-authority.ts', () => {
    const scope = scanScope();
    const violations = guardVerdict(scope, (file) => fs.readFileSync(path.join(ROOT, file), 'utf8'));
    expect(violations).toEqual([]);
  });
});
