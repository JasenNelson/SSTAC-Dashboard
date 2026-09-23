import type { CohortManifest } from '../cohort-contract';
import type { ReviewerGuideContract } from '../reviewer-guide';
import { sectionNumbersFromLocator } from './cohort-portions';
import { APPENDIX_BOUNDARY_LABEL, outlineSectionNumber } from './outline-hierarchy';

/*
 * The ONE navigation model shared by the paper outline, the review topics, the
 * cohort paper portions and the review questions (Working Draft and My Review).
 *
 * - A TOPIC is a review cohort (cohorts-v1.json), in cohort order. Its
 *   questions are the cohort's questionNumbers joined to the Reviewer's Guide.
 * - A question CITES paper sections: the "(Section 7.8)" / "(Sections 4.1 and
 *   6.0)" reference in its Reviewer's Guide heading. A question whose heading
 *   cites none (Q11 "On water type") inherits the sections its cohort locates
 *   that no sibling question already cites (4.4.2 for Q11), else all of them.
 * - A paper section RELATES to a question when one of the question's cited
 *   numbers is equal to, or a prefix of, the section's number (7.8 relates to
 *   7.8, 7.8.1 and 7.8.2; 6.0 relates to all of chapter 6). An unnumbered
 *   heading takes the number of its nearest numbered reader ancestor. Only
 *   the paper body is numbered: headings from the Technical Appendices
 *   Compendium on (whose own "7.5 ..." headings are appendix-local) relate
 *   to no question.
 * - The PRIMARY question for a section is the most specific match: longest
 *   matching citation first, then the question citing the fewest sections,
 *   then question number. Section 7.8 is cited by Q6, Q7 (7.5 and 7.8), Q8, Q9
 *   (7.8 only) and Q12 (7.7 and 7.8), so its primary question is Q8 and its
 *   topic Inputs and evidence -- derived, never special-cased.
 * A section no question cites has no primary question; callers keep the
 * current question rather than guessing, so the two panels never disagree.
 */

export type SectionNumber = readonly number[];

export interface ReviewNavQuestion {
  readonly number: number;
  readonly id: string;
  readonly heading: string;
  /** Short heading without the "(Section ...)" citation. */
  readonly title: string;
  readonly topicId: string;
  readonly citedSections: readonly SectionNumber[];
}

export interface ReviewNavTopic {
  readonly id: string;
  readonly name: string;
  readonly questions: readonly ReviewNavQuestion[];
}

export interface ReviewNavOutlineEntry {
  readonly id: string;
  readonly anchor: string;
  readonly label: string;
  readonly parentId: string | null;
}

export interface ReviewNavigationModel {
  readonly topics: readonly ReviewNavTopic[];
  /** All questions in topic order: the one sequence Prev/Next and progress walk. */
  readonly questions: readonly ReviewNavQuestion[];
  topicForQuestion(number: number): ReviewNavTopic | undefined;
  /** Primary question for a paper anchor, or undefined when no question relates to it. */
  questionForAnchor(anchor: string): ReviewNavQuestion | undefined;
  /** Every question related to a paper anchor, most specific first. */
  questionsForAnchor(anchor: string): readonly ReviewNavQuestion[];
  /** The paper anchor a question opens: its most specific cited section that exists. */
  anchorForQuestion(number: number): string | undefined;
  /** Every question related to a section number ("7.8"), most specific first (no outline needed). */
  questionsForSection(sectionNumber: string): readonly ReviewNavQuestion[];
}

const HEADING_CITATION = /\((Sections?\s[^)]*)\)\s*$/;

function normalize(parts: SectionNumber): SectionNumber {
  return parts.length === 2 && parts[1] === 0 ? parts.slice(0, 1) : parts;
}

function parseLocatorNumbers(locator: string): readonly SectionNumber[] {
  return sectionNumbersFromLocator(locator).map((value) => normalize(value.split('.').map(Number)));
}

function isPrefix(prefix: SectionNumber, of: SectionNumber): boolean {
  return prefix.length <= of.length && prefix.every((part, index) => of[index] === part);
}

function sameNumber(a: SectionNumber, b: SectionNumber): boolean {
  return a.length === b.length && isPrefix(a, b);
}

export function questionCitations(heading: string): readonly SectionNumber[] {
  const match = HEADING_CITATION.exec(heading);
  return match ? parseLocatorNumbers(match[1]) : [];
}

export function questionTitle(heading: string): string {
  return heading.replace(HEADING_CITATION, '').trim();
}

export function buildReviewNavigation(
  cohortManifest: Pick<CohortManifest, 'cohorts'>,
  reviewerGuide: Pick<ReviewerGuideContract, 'questions'>,
  outline: readonly ReviewNavOutlineEntry[] = [],
): ReviewNavigationModel {
  const topics: ReviewNavTopic[] = cohortManifest.cohorts.map((cohort) => {
    const guideQuestions = cohort.questionNumbers
      .map((number) => reviewerGuide.questions.find((question) => question.number === number))
      .filter((question): question is ReviewerGuideContract['questions'][number] => question !== undefined);
    const explicit = guideQuestions.map((question) => questionCitations(question.heading));
    const cited = explicit.flat();
    const cohortSections = cohort.sourceLocators.flatMap(parseLocatorNumbers);
    const uncited = cohortSections.filter((section) => !cited.some((other) => sameNumber(other, section)));
    const fallback = uncited.length > 0 ? uncited : cohortSections;
    const questions = guideQuestions.map((question, index): ReviewNavQuestion => Object.freeze({
      number: question.number,
      id: question.id,
      heading: question.heading,
      title: questionTitle(question.heading),
      topicId: cohort.id,
      citedSections: Object.freeze(explicit[index].length > 0 ? explicit[index] : fallback),
    }));
    return Object.freeze({ id: cohort.id, name: cohort.name, questions: Object.freeze(questions) });
  });
  const questions = Object.freeze(topics.flatMap((topic) => topic.questions));

  const boundary = outline.findIndex((entry) => entry.label === APPENDIX_BOUNDARY_LABEL);
  const body = boundary < 0 ? outline : outline.slice(0, boundary);
  const entryById = new Map(body.map((entry) => [entry.id, entry]));
  const numberCache = new Map<string, SectionNumber | null>();
  const numberOf = (entry: ReviewNavOutlineEntry | undefined): SectionNumber | null => {
    if (!entry) return null;
    const cached = numberCache.get(entry.id);
    if (cached !== undefined) return cached;
    const own = outlineSectionNumber(entry.label);
    const value = own ? normalize(own) : numberOf(entry.parentId ? entryById.get(entry.parentId) : undefined);
    numberCache.set(entry.id, value);
    return value;
  };
  const entryByAnchor = new Map(body.map((entry) => [entry.anchor, entry]));

  const rank = (section: SectionNumber) => questions
    .flatMap((question) => {
      const best = question.citedSections.filter((cite) => isPrefix(cite, section)).reduce((length, cite) => Math.max(length, cite.length), 0);
      return best > 0 ? [{ question, best }] : [];
    })
    .sort((a, b) => b.best - a.best || a.question.citedSections.length - b.question.citedSections.length || a.question.number - b.question.number)
    .map((match) => match.question);

  const questionsForAnchor = (anchor: string): readonly ReviewNavQuestion[] => {
    const section = numberOf(entryByAnchor.get(anchor));
    return section ? rank(section) : [];
  };

  const anchorForQuestion = (number: number): string | undefined => {
    const question = questions.find((candidate) => candidate.number === number);
    if (!question) return undefined;
    const ordered = [...question.citedSections].sort((a, b) => b.length - a.length);
    for (const cite of ordered) {
      const exact = body.find((entry) => {
        const own = outlineSectionNumber(entry.label);
        return own !== null && sameNumber(normalize(own), cite);
      });
      if (exact) return exact.anchor;
      const descendant = body.find((entry) => {
        const own = outlineSectionNumber(entry.label);
        return own !== null && isPrefix(cite, normalize(own));
      });
      if (descendant) return descendant.anchor;
    }
    return undefined;
  };

  return Object.freeze({
    topics: Object.freeze(topics),
    questions,
    topicForQuestion: (number: number) => topics.find((topic) => topic.questions.some((question) => question.number === number)),
    questionForAnchor: (anchor: string) => questionsForAnchor(anchor)[0],
    questionsForAnchor,
    anchorForQuestion,
    questionsForSection: (sectionNumber: string) => {
      const parts = sectionNumber.split('.').map(Number);
      return parts.length > 0 && parts.every((part) => Number.isInteger(part)) ? rank(normalize(parts)) : [];
    },
  });
}

/** Whether a cohort portion (by its section number) belongs to a question's citations. */
export function portionMatchesQuestion(portionSectionNumber: string, question: Pick<ReviewNavQuestion, 'citedSections'>): boolean {
  const portion = normalize(portionSectionNumber.split('.').map(Number));
  return question.citedSections.some((cite) => isPrefix(cite, portion) || isPrefix(portion, cite));
}
