/*
 * Review topic PRESENTATION labels (owner-approved). Display only: the cohort
 * ids, the cohort manifest, the authenticated contracts and every URL keep the
 * stable ids ("categories", "pathway-grid", ...). A cohort without an entry
 * here falls back to its manifest name, so a new cohort is never unlabelled.
 */
export const REVIEW_TOPIC_PRESENTATION_LABELS: Readonly<Record<string, string>> = Object.freeze({
  categories: 'Sediment Uses',
  'pathway-grid': 'Receptors and Pathways',
  'exposure-assumptions': 'Exposure Assumptions',
  'inputs-evidence': 'Inputs and Evidence',
  'methods-water-type': 'Methods and Water Types',
});

/** The topic's reader-facing name. */
export function reviewTopicLabel(cohortId: string, manifestName: string): string {
  return Object.prototype.hasOwnProperty.call(REVIEW_TOPIC_PRESENTATION_LABELS, cohortId) ? REVIEW_TOPIC_PRESENTATION_LABELS[cohortId] : manifestName;
}

/** "1. Sediment Uses": the topic's position (0-based, manifest order) plus its name. */
export function numberedReviewTopicLabel(cohortId: string, manifestName: string, position: number): string {
  return `${position + 1}. ${reviewTopicLabel(cohortId, manifestName)}`;
}
