import { fireEvent, render, screen, within } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

import type { PreviewEarlierFeedback, PreviewFeedbackContract } from '@/lib/matrix-options/paper/r2-review-preview';
import { R2ReviewPreview } from '../R2ReviewPreview';

const feedback: readonly PreviewEarlierFeedback[] = [{
  ownerIdentity: 'synthetic-reviewer', sessionIdentity: 'synthetic-session',
  areaId: 'uses-waterbodies', sectionAnchor: 'sec-phase2-5',
  sourceReleaseIdentity: 'phase2-review-2026-11-186bcf53', sourcePaperSha256: 'a'.repeat(64),
  sourceGuideSha256: 'b'.repeat(64), sourceManifestSha256: 'c'.repeat(64),
  originalQuestionId: 'rpq:phase2-review-2026-11-186bcf53:q02', relationType: 'exact-continuation',
  responseStatus: 'submitted', timestamp: '2026-10-01', displayLabel: 'Earlier concise draft - site assignment',
  text: 'Example only: I asked for a worked site example.', synthetic: true,
}];
const feedbackContract: PreviewFeedbackContract = {
  viewerIdentity: 'synthetic-reviewer', sessionIdentity: 'synthetic-session',
  sources: { [feedback[0].originalQuestionId]: {
    areaId: feedback[0].areaId, sectionAnchor: feedback[0].sectionAnchor,
    releaseIdentity: feedback[0].sourceReleaseIdentity, paperSha256: feedback[0].sourcePaperSha256,
    guideSha256: feedback[0].sourceGuideSha256, manifestSha256: feedback[0].sourceManifestSha256,
    relationType: feedback[0].relationType,
  } },
};

const outline = [
  { anchor: 'sec-phase2-3', label: '3. The proposed framework at a glance' },
  { anchor: 'sec-phase2-5', label: '5. Sediment uses and waterbody groups' },
  { anchor: 'sec-phase2-7', label: '7. Common rules' },
];

const paper = <article><section id="sec-phase2-3"><h2>Proposed framework</h2></section><section id="sec-phase2-5"><h2>Sediment uses</h2></section><section id="sec-phase2-7"><h2>Common rules</h2></section></article>;

function preview(props: Partial<ComponentProps<typeof R2ReviewPreview>> = {}) { return render(<R2ReviewPreview outline={outline} feedback={feedback} feedbackContract={feedbackContract} paper={paper} {...props} />); }

beforeEach(() => {
  Object.defineProperty(Element.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() });
  vi.stubGlobal('fetch', vi.fn(() => { throw new Error('Preview attempted a network request'); }));
});

afterEach(() => { Reflect.deleteProperty(Element.prototype, 'scrollIntoView'); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

it('keeps choice, rationale, section and whole-paper input only in memory', () => {
  const setItem = vi.spyOn(Storage.prototype, 'setItem');
  const view = preview();
  expect(screen.getByText('Preview only - nothing is saved or sent')).toBeInTheDocument();
  const desktop = screen.getByRole('complementary', { name: 'Review this section' });
  fireEvent.click(within(desktop).getByLabelText('Needs refinement'));
  fireEvent.change(within(desktop).getByLabelText(/What would you change or keep/), { target: { value: 'Keep the pathway map.' } });
  fireEvent.change(within(desktop).getByLabelText('3. The proposed framework at a glance'), { target: { value: 'Section-specific comment.' } });
  fireEvent.click(screen.getByRole('button', { name: 'Whole-paper comments' }));
  fireEvent.change(within(desktop).getByLabelText('General comments on the proposed paper'), { target: { value: 'Whole-paper comment.' } });
  fireEvent.click(screen.getByRole('button', { name: /My Review/ }));
  const summary = screen.getByTestId('preview-my-review');
  expect(within(summary).getByText(/Needs refinement/)).toBeInTheDocument();
  expect(within(summary).getByText('Section-specific comment.')).toBeInTheDocument();
  expect(within(summary).getByText('Whole-paper comment.')).toBeInTheDocument();
  fireEvent.click(within(summary).getByRole('button', { name: 'Finish this preview' }));
  expect(within(summary).getByRole('status')).toHaveTextContent('Nothing was saved or sent');
  expect(fetch).not.toHaveBeenCalled();
  expect(setItem).not.toHaveBeenCalled();
  view.unmount();
  preview();
  expect(screen.getByRole('complementary', { name: 'Review this section' })).not.toHaveTextContent('Section-specific comment.');
  expect(fetch).not.toHaveBeenCalled();
});

it('supports free-order navigation and labels synthetic earlier feedback without carrying it into a new answer', () => {
  preview();
  fireEvent.click(screen.getByRole('button', { name: /Where standards apply - sediment uses and waterbodies/ }));
  const desktop = screen.getByRole('complementary', { name: 'Review this section' });
  expect(within(desktop).getByText('Earlier concise draft - site assignment')).toBeInTheDocument();
  expect(within(desktop).getByText(/Synthetic example of your own earlier feedback/)).toBeInTheDocument();
  expect(within(desktop).getByLabelText(/Where might assigning a real site/)).toHaveValue('');
  expect(screen.getByText(/0 of 6 marked reviewed/)).toBeInTheDocument();
  expect(fetch).not.toHaveBeenCalled();
});

it.each([
  ['foreign owner', { ownerIdentity: 'other-reviewer' }],
  ['stale paper', { sourcePaperSha256: 'd'.repeat(64) }],
  ['stale guide', { sourceGuideSha256: 'd'.repeat(64) }],
  ['stale manifest', { sourceManifestSha256: 'd'.repeat(64) }],
  ['missing session', { sessionIdentity: '' }],
  ['missing source identity', { sourceReleaseIdentity: '' }],
  ['unmapped target', { areaId: 'human-health' as const }],
])('suppresses %s earlier feedback', (_name, patch) => {
  preview({ feedback: [{ ...feedback[0], ...patch }] });
  fireEvent.click(screen.getByRole('button', { name: /Where standards apply - sediment uses and waterbodies/ }));
  const desktop = screen.getByRole('complementary', { name: 'Review this section' });
  expect(within(desktop).queryByText('Earlier concise draft - site assignment')).not.toBeInTheDocument();
  expect(within(desktop).getByText(/Earlier feedback is unavailable/)).toBeInTheDocument();
  expect(fetch).not.toHaveBeenCalled();
});

it.each(['loading', 'signed-out', 'source-unavailable', 'transient-read-error'] as const)('renders network-free %s fixture state', (fixtureState) => {
  preview({ fixtureState, paper: null });
  expect(screen.getByTestId('r2-review-fixture-state')).toHaveTextContent(fixtureState);
  expect(screen.queryByText('Proposed framework')).not.toBeInTheDocument();
  expect(fetch).not.toHaveBeenCalled();
});

it('shows stale-lineage and no-earlier-feedback scenarios without carrying synthetic responses', () => {
  const view = preview({ fixtureState: 'stale-lineage' });
  fireEvent.click(screen.getByRole('button', { name: /Where standards apply - sediment uses and waterbodies/ }));
  expect(screen.getByRole('complementary', { name: 'Review this section' })).toHaveTextContent('Earlier feedback is unavailable');
  view.unmount();
  preview({ fixtureState: 'no-earlier-feedback' });
  fireEvent.click(screen.getByRole('button', { name: /Where standards apply - sediment uses and waterbodies/ }));
  expect(screen.getByRole('complementary', { name: 'Review this section' })).toHaveTextContent('No earlier feedback is shown');
  expect(fetch).not.toHaveBeenCalled();
});

it('shows the zero-prompt focus area as a deterministic fixture', () => {
  preview({ fixtureState: 'no-prompt' });
  const desktop = screen.getByRole('complementary', { name: 'Review this section' });
  expect(within(desktop).getByText('No key question is set for this area in the preview. You can still comment on any section.')).toBeInTheDocument();
  expect(fetch).not.toHaveBeenCalled();
});
