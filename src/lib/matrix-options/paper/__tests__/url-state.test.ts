import { describe, expect, it } from 'vitest';

import {
  PAPER_URL_VALUE_MAX_LENGTH,
  paperWorkspaceHref,
  parsePaperUrlState,
  serializePaperUrlState,
  workingDraftSectionHref,
  type PaperSearchParams,
  type PaperUrlState,
} from '../url-state';

const LONG_OK = 'a'.repeat(PAPER_URL_VALUE_MAX_LENGTH);
const LONG_BAD = 'b'.repeat(PAPER_URL_VALUE_MAX_LENGTH + 1);

const ctx = {
  anchors: new Set(['intro', 'methods', LONG_OK, LONG_BAD]),
  questionCohort: new Map([
    ['rpq:1.0.11-remediated-7-8-successor-20260918-D:q01', 'categories'],
    ['q2', 'pathway-grid'],
    ['q-ghost', 'ghost-cohort'],
  ]),
  cohortIds: new Set(['categories', 'pathway-grid', LONG_BAD]),
};
const Q1 = 'rpq:1.0.11-remediated-7-8-successor-20260918-D:q01';

describe('workingDraftSectionHref (M1-04)', () => {
  it('serializes exactly one encoded section identity as a canonical Working Draft query', () => {
    expect(workingDraftSectionHref('methods')).toBe('?mode=working-draft&section=methods');
    expect(workingDraftSectionHref('a b&c=d#e')).toBe('?mode=working-draft&section=a+b%26c%3Dd%23e');
    expect(new URLSearchParams(workingDraftSectionHref('a b&c=d#e').slice(1)).getAll('section')).toEqual(['a b&c=d#e']);
    const search = Object.fromEntries(new URLSearchParams(workingDraftSectionHref('methods').slice(1)));
    expect(parsePaperUrlState(search, ctx)).toEqual({ state: { mode: 'working-draft', cohort: null, q: null, section: 'methods' }, canonical: true });
  });
});

const wd = (section: string | null = null, q: string | null = null): PaperUrlState => ({ mode: 'working-draft', cohort: null, q, section });
const mr = (cohort: string | null, q: string | null = null, section: string | null = null): PaperUrlState => ({ mode: 'my-review', cohort, q, section });

const cases: ReadonlyArray<readonly [string, PaperSearchParams, PaperUrlState, boolean]> = [
  ['no params defaults to working-draft (non-canonical)', {}, wd(), false],
  ['explicit working-draft is canonical', { mode: 'working-draft' }, wd(), true],
  ['publication alias maps to working-draft (non-canonical)', { mode: 'publication' }, wd(), false],
  ['unknown mode falls back to working-draft', { mode: 'bogus' }, wd(), false],
  ['prototype-key mode is not a mode', { mode: 'constructor' }, wd(), false],
  ['empty mode is invalid', { mode: '' }, wd(), false],
  ['repeated mode takes first valid value', { mode: ['bogus', 'my-review'] }, mr(null), false],
  ['repeated mode with two valid values takes the first', { mode: ['my-review', 'working-draft'] }, mr(null), false],
  ['repeated alias first valid wins', { mode: ['publication', 'my-review'] }, wd(), false],
  ['working-draft with valid section is canonical', { mode: 'working-draft', section: 'intro' }, wd('intro'), true],
  ['unknown section is dropped', { mode: 'working-draft', section: 'nope' }, wd(), false],
  ['repeated section takes first valid', { mode: 'working-draft', section: ['nope', 'methods', 'intro'] }, wd('methods'), false],
  ['section at the length limit is kept', { mode: 'working-draft', section: LONG_OK }, wd(LONG_OK), true],
  ['section over the length limit is rejected even if known', { mode: 'working-draft', section: LONG_BAD }, wd(), false],
  ['my-review with valid cohort is canonical', { mode: 'my-review', cohort: 'categories' }, mr('categories'), true],
  ['my-review without cohort or q is canonical', { mode: 'my-review' }, mr(null), true],
  ['unknown cohort is dropped', { mode: 'my-review', cohort: 'nope' }, mr(null), false],
  ['cohort over the length limit is rejected', { mode: 'my-review', cohort: LONG_BAD }, mr(null), false],
  ['repeated cohort takes first valid', { mode: 'my-review', cohort: ['nope', 'pathway-grid'] }, mr('pathway-grid'), false],
  ['q without cohort sets the question cohort', { mode: 'my-review', q: Q1 }, mr('categories', Q1), false],
  ['q with a different cohort is corrected to the question cohort', { mode: 'my-review', cohort: 'pathway-grid', q: Q1 }, mr('categories', Q1), false],
  ['q with an invalid cohort sets the question cohort', { mode: 'my-review', cohort: 'nope', q: 'q2' }, mr('pathway-grid', 'q2'), false],
  ['unknown q is dropped and cohort kept', { mode: 'my-review', cohort: 'categories', q: 'q-nope' }, mr('categories'), false],
  ['q whose cohort is unknown is dropped', { mode: 'my-review', q: 'q-ghost' }, mr(null), false],
  ['repeated q takes first valid', { mode: 'my-review', cohort: 'pathway-grid', q: ['q-nope', 'q2', Q1] }, mr('pathway-grid', 'q2'), false],
  ['full my-review state is canonical', { mode: 'my-review', cohort: 'categories', q: Q1, section: 'intro' }, mr('categories', Q1, 'intro'), true],
  ['working-draft drops cohort but keeps a valid q', { mode: 'working-draft', cohort: 'categories', q: Q1 }, wd(null, Q1), false],
  ['missing mode drops cohort and keeps q (working-draft default)', { cohort: 'categories', q: Q1, section: 'intro' }, wd('intro', Q1), false],
  ['working-draft with q and section is canonical', { mode: 'working-draft', q: Q1, section: 'intro' }, wd('intro', Q1), true],
  ['working-draft drops an unknown q', { mode: 'working-draft', q: 'q-nope' }, wd(), false],
  ['unknown extra params are ignored but non-canonical', { mode: 'working-draft', lens: 'all' }, wd(), false],
  ['parameter order other than canonical is non-canonical', { section: 'intro', mode: 'working-draft' }, wd('intro'), false],
  ['my-review q before cohort is non-canonical', { mode: 'my-review', q: Q1, cohort: 'categories' }, mr('categories', Q1), false],
  ['undefined values are ignored', { mode: 'working-draft', section: undefined, cohort: undefined }, wd(), true],
  ['single-element arrays equal the scalar form', { mode: ['working-draft'] }, wd(), true],
];

describe('paper URL state parse', () => {
  it.each(cases)('%s', (_name, search, state, canonical) => {
    const parsed = parsePaperUrlState(search, ctx);
    expect(parsed.state).toEqual(state);
    expect(parsed.canonical).toBe(canonical);
  });

  it('canonicalizes every non-canonical case to a fixed point', () => {
    for (const [, search] of cases) {
      const { state } = parsePaperUrlState(search, ctx);
      const reparsed = parsePaperUrlState(Object.fromEntries(new URLSearchParams(serializePaperUrlState(state))), ctx);
      expect(reparsed).toEqual({ state, canonical: true });
    }
  });
});

describe('paper URL state serialize and href', () => {
  it('serializes mode, cohort, q, section in fixed order and omits nulls', () => {
    expect(serializePaperUrlState(wd())).toBe('?mode=working-draft');
    expect(serializePaperUrlState(wd('intro'))).toBe('?mode=working-draft&section=intro');
    expect(serializePaperUrlState({ section: 'intro', q: Q1, cohort: 'categories', mode: 'my-review' })).toBe(
      '?mode=my-review&cohort=categories&q=rpq%3A1.0.11-remediated-7-8-successor-20260918-D%3Aq01&section=intro',
    );
    expect(serializePaperUrlState(mr(null, null, 'a b&c=d'))).toBe('?mode=my-review&section=a+b%26c%3Dd');
  });

  it('round-trips through URLSearchParams decoding', () => {
    const states = [wd(), wd('methods'), mr('categories'), mr('categories', Q1, 'intro'), mr('pathway-grid', 'q2')];
    for (const state of states) {
      const search = Object.fromEntries(new URLSearchParams(serializePaperUrlState(state)));
      expect(parsePaperUrlState(search, ctx)).toEqual({ state, canonical: true });
    }
  });

  it('builds the workspace href with an encoded document version', () => {
    expect(paperWorkspaceHref('1.0.11-remediated-7-8-successor-20260918-D', wd('intro'))).toBe(
      '/matrix-options/paper/publication/v/1.0.11-remediated-7-8-successor-20260918-D?mode=working-draft&section=intro',
    );
    expect(paperWorkspaceHref('a b/c?d', mr('categories'))).toBe(
      '/matrix-options/paper/publication/v/a%20b%2Fc%3Fd?mode=my-review&cohort=categories',
    );
  });
});
