/*
 * Canonical URL state for the Matrix Options paper workspace (PLAN-R4 6.C).
 * Pure and isomorphic: safe for server components and client code.
 *
 *   ?mode=working-draft&q=<questionId>&section=<anchor>
 *   ?mode=my-review&cohort=<cohortId>&q=<questionId>&section=<anchor>
 */

export type PaperMode = 'working-draft' | 'my-review';

export interface PaperUrlState {
  readonly mode: PaperMode;
  readonly cohort: string | null;
  readonly q: string | null;
  readonly section: string | null;
}

export interface PaperUrlContext {
  readonly anchors: ReadonlySet<string>;
  readonly questionCohort: ReadonlyMap<string, string>;
  readonly cohortIds: ReadonlySet<string>;
}

export type PaperSearchParams = Readonly<Record<string, string | readonly string[] | undefined>>;

/** Values longer than this many UTF-16 code units are rejected as invalid. */
export const PAPER_URL_VALUE_MAX_LENGTH = 200;
export const PAPER_MODE_ALIASES: Readonly<Record<string, PaperMode>> = Object.freeze({
  'working-draft': 'working-draft',
  'my-review': 'my-review',
  publication: 'working-draft',
});
export const PAPER_WORKSPACE_BASE_PATH = '/matrix-options/paper/publication/v/';

function valuesOf(value: string | readonly string[] | undefined): readonly string[] {
  if (value === undefined) return [];
  if (typeof value === 'string') return [value];
  return value.filter((entry): entry is string => typeof entry === 'string');
}

function firstValid(value: string | readonly string[] | undefined, accept: (candidate: string) => boolean): string | null {
  for (const candidate of valuesOf(value)) {
    if (candidate.length > 0 && candidate.length <= PAPER_URL_VALUE_MAX_LENGTH && accept(candidate)) return candidate;
  }
  return null;
}

function ownValue(search: PaperSearchParams, key: string): string | readonly string[] | undefined {
  return Object.prototype.hasOwnProperty.call(search, key) ? search[key] : undefined;
}

function inputQueryString(search: PaperSearchParams): string {
  const params = new URLSearchParams();
  for (const key of Object.keys(search)) {
    for (const value of valuesOf(search[key])) params.append(key, value);
  }
  const serialized = params.toString();
  return serialized ? `?${serialized}` : '';
}

export function serializePaperUrlState(state: PaperUrlState): string {
  const params = new URLSearchParams();
  params.set('mode', state.mode);
  if (state.cohort !== null) params.set('cohort', state.cohort);
  if (state.q !== null) params.set('q', state.q);
  if (state.section !== null) params.set('section', state.section);
  return `?${params.toString()}`;
}

/**
 * Rules:
 * - mode defaults to working-draft; `publication` is an alias for
 *   working-draft; an unknown mode falls back to working-draft.
 * - repeated parameters take the first valid value.
 * - section must be a known heading anchor, else it is dropped.
 * - cohort must be a known cohort id and q a known question id (whose cohort
 *   is a known cohort), else each is dropped.
 * - a valid q forces cohort to the question's cohort.
 * - in working-draft mode cohort is always dropped; a valid q is kept (the
 *   review panel beside the Working Draft follows it), and a q whose cohort is
 *   unknown is dropped.
 * - values longer than PAPER_URL_VALUE_MAX_LENGTH (or empty) are invalid.
 * - unknown extra parameters are ignored.
 * canonical is true only when the input's query string (in input key order)
 * already equals serializePaperUrlState(state); every normalization above,
 * any alias, repeat, drop, extra parameter or different order makes it false.
 */
export function parsePaperUrlState(search: PaperSearchParams, ctx: PaperUrlContext): { readonly state: PaperUrlState; readonly canonical: boolean } {
  const modeValue = firstValid(ownValue(search, 'mode'), (candidate) => Object.prototype.hasOwnProperty.call(PAPER_MODE_ALIASES, candidate));
  const mode: PaperMode = modeValue === null ? 'working-draft' : PAPER_MODE_ALIASES[modeValue];
  const section = firstValid(ownValue(search, 'section'), (candidate) => ctx.anchors.has(candidate));
  let cohort: string | null = null;
  let q: string | null = null;
  q = firstValid(ownValue(search, 'q'), (candidate) => {
    const questionCohort = ctx.questionCohort.get(candidate);
    return questionCohort !== undefined && ctx.cohortIds.has(questionCohort);
  });
  if (mode === 'my-review') {
    cohort = firstValid(ownValue(search, 'cohort'), (candidate) => ctx.cohortIds.has(candidate));
    if (q !== null) {
      const questionCohort = ctx.questionCohort.get(q) ?? null;
      if (cohort !== questionCohort) cohort = questionCohort;
    }
  }
  const state: PaperUrlState = Object.freeze({ mode, cohort, q, section });
  return Object.freeze({ state, canonical: inputQueryString(search) === serializePaperUrlState(state) });
}

export function paperWorkspaceHref(documentVersion: string, state: PaperUrlState): string {
  return `${PAPER_WORKSPACE_BASE_PATH}${encodeURIComponent(documentVersion)}${serializePaperUrlState(state)}`;
}

/**
 * Relative in-page href for a Working Draft section: the canonical query with
 * exactly one section identity (M1-04). Used by outline entries and in-paper
 * references so a new tab, middle click or copied link never pairs a stale
 * `section=` with a different `#hash`.
 */
export function workingDraftSectionHref(anchor: string): string {
  return serializePaperUrlState({ mode: 'working-draft', cohort: null, q: null, section: anchor });
}
