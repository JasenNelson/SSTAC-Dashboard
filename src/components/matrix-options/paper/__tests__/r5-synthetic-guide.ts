import { R5_PAPER_VERSION } from '@/lib/matrix-options/paper/releases';
import { getReviewerGuideBinding, getReviewerGuideContract, validateReviewerGuideContract } from '@/lib/matrix-options/reviewer-guide';
import type { ReviewerGuideContract } from '@/lib/matrix-options/reviewer-guide';

/*
 * A reviewer guide WITH text for the private-storage draft, for tests that run
 * without that draft's bytes.
 *
 * The real guide text of that draft is in no file of the repository: the server
 * derives it from the verified paper. This stand-in takes everything that IS
 * bound (ids, numbers, source lines, section anchors, predecessor declarations)
 * from the stored binding, and supplies text that is not the draft's:
 * - a question declared identical to the predecessor's carries the predecessor's
 *   public text, which is what "identical" means;
 * - a question declared changed carries the synthetic text below.
 * So a test that shows "the workspace displays the guide it was given" can tell
 * the given text from anything the component might have looked up itself.
 */

export const SYNTHETIC_CHANGED_HEADING = 'Synthetic changed question (Section 4.4.2)';
export const SYNTHETIC_CHANGED_PROMPT = 'Synthetic prompt of a changed question. It stands in for text that is not in the repository.';

export function syntheticResolvedR5Guide(): ReviewerGuideContract {
  const binding = getReviewerGuideBinding(R5_PAPER_VERSION);
  const predecessor = getReviewerGuideContract();
  const questions = binding.questions.map((question) => {
    const earlier = predecessor.questions.find((candidate) => candidate.id === question.predecessorQuestionId);
    return {
      number: question.number,
      id: question.id,
      sourceLines: question.sourceLines,
      heading: earlier?.heading ?? SYNTHETIC_CHANGED_HEADING,
      prompt: earlier?.prompt ?? SYNTHETIC_CHANGED_PROMPT,
      sectionAnchors: question.sectionAnchors,
      predecessorEquivalence: question.predecessorEquivalence,
      predecessorQuestionId: question.predecessorQuestionId,
    };
  });
  // The same shape check the server applies to a guide it resolved.
  return validateReviewerGuideContract({
    schemaVersion: binding.schemaVersion,
    releaseIdentity: binding.releaseIdentity,
    sourcePath: binding.sourcePath,
    predecessorReleaseIdentity: binding.predecessorReleaseIdentity,
    questions,
  }, R5_PAPER_VERSION);
}
