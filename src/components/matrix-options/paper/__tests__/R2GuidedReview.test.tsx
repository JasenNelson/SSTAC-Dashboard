import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';

import { R2GuidedReview } from '../R2GuidedReview';
import { getGuidedR2Manifest } from '@/lib/matrix-options/paper/guided-r2-manifest';

vi.mock('server-only', () => ({}));
const manifest = getGuidedR2Manifest();
const props = {
  documentVersion: manifest.documentVersion,
  guidedManifestSha256: manifest.guidedManifestSha256,
  reviewManifestSha256: manifest.reviewManifestSha256,
  outline: [{ anchor: 'sec-phase2-3', label: '3. Proposed framework' }],
  paper: <article><section id="sec-phase2-3"><h2>Proposed framework</h2></section></article>,
};
const userKey = '11111111-1111-4111-8111-111111111111';
const fetchMock = vi.fn();
const stateResponse = (entries: unknown[] = [], mode: 'read-only' | 'writable' = 'read-only') => ({
  documentVersion: manifest.documentVersion, guidedManifestSha256: manifest.guidedManifestSha256,
  reviewManifestSha256: manifest.reviewManifestSha256, mode, userKey, entries, completion: null,
});
const feedbackResponse = () => ({ guidedManifestSha256: manifest.guidedManifestSha256, reviewManifestSha256: manifest.reviewManifestSha256, items: [] });
const savedEntry = (kind: string, id: string, values: Record<string, unknown> = {}) => ({
  user_id: userKey, document_version: manifest.documentVersion,
  guided_manifest_sha256: manifest.guidedManifestSha256, review_manifest_sha256: manifest.reviewManifestSha256,
  target_kind: kind, target_id: id, revision: 1,
  draft_choice_id: null, draft_rationale: null, draft_text: null,
  submitted_choice_id: null, submitted_rationale: null, submitted_text: null,
  submitted_revision: null, submitted_at: null, updated_at: '2026-11-16T00:00:00Z', ...values,
});

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

it('keeps the exact paper readable when the state schema is unavailable', async () => {
  fetchMock.mockImplementation((url: string) => Promise.resolve(new Response(JSON.stringify(url.includes('/state?') ? { outcome: 'persistence_unavailable' } : feedbackResponse()), { status: url.includes('/state?') ? 503 : 200 })));
  render(<R2GuidedReview {...props} />);
  expect(await screen.findByRole('alert')).toHaveTextContent('Your review state is temporarily unavailable. The paper remains readable.');
  expect(screen.getByText('Proposed framework')).toBeInTheDocument();
  expect(fetchMock).toHaveBeenCalledTimes(2);
});

it('shows the account-data notice in the introduction and My Review', async () => {
  fetchMock.mockImplementation((url: string) => Promise.resolve(new Response(JSON.stringify(url.includes('/state?') ? stateResponse() : feedbackResponse()))));
  render(<R2GuidedReview {...props} initialMode="my-review" />);
  expect(await screen.findByText('Review responses are currently read-only. The paper remains available.')).toBeInTheDocument();
  expect(screen.getAllByText(/Feedback is optional, linked to your account/)).toHaveLength(2);
  expect(screen.getAllByText(/Soft deletion retains them until permanent deletion/)).toHaveLength(2);
});

it('hides guided state for a noninvited reviewer while preserving paper access', async () => {
  fetchMock.mockImplementation((url: string) => Promise.resolve(new Response(JSON.stringify(url.includes('/state?') ? { outcome: 'reviewer_not_allowed' } : feedbackResponse()), { status: url.includes('/state?') ? 403 : 200 })));
  render(<R2GuidedReview {...props} />);
  expect(await screen.findByRole('alert')).toHaveTextContent('Guided responses are available only to invited reviewers. The paper remains readable.');
  expect(screen.getByText('Proposed framework')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();
});

it('shows inactive review as read-only and never offers an enabled Save button', async () => {
  fetchMock.mockImplementation((url: string) => Promise.resolve(new Response(JSON.stringify(url.includes('/state?') ? stateResponse() : feedbackResponse()), { status: 200 })));
  render(<R2GuidedReview {...props} />);
  expect(await screen.findByText('Review responses are currently read-only. The paper remains available.')).toBeInTheDocument();
  expect(screen.getAllByRole('button', { name: 'Save' }).every((button) => (button as HTMLButtonElement).disabled)).toBe(true);
  expect(fetchMock).toHaveBeenCalledTimes(2);
});

it('opens a bookmarked My Review URL in My Review mode', async () => {
  fetchMock.mockImplementation((url: string) => Promise.resolve(new Response(JSON.stringify(url.includes('/state?') ? stateResponse() : feedbackResponse()), { status: 200 })));
  render(<R2GuidedReview {...props} initialMode="my-review" />);
  expect(await screen.findByRole('heading', { name: 'My Review' })).toBeInTheDocument();
  expect(screen.queryByText('Proposed framework')).not.toBeInTheDocument();
});

it('shows all six persisted review areas with readable choices, unanswered prompts, and grouped comments', async () => {
  const entries = [
    savedEntry('choice-prompt', 'structure-approach', { draft_choice_id: 'sound', draft_rationale: 'Keep the pathways.' }),
    savedEntry('section-comment', 'sec-phase2-3', { draft_text: 'Clarify the placement rule.' }),
    savedEntry('whole-paper-comment', 'whole-paper', { draft_text: 'Please add a short summary.' }),
  ];
  fetchMock.mockImplementation((url: string) => Promise.resolve(new Response(JSON.stringify(url.includes('/state?') ? stateResponse(entries) : feedbackResponse()))));
  render(<R2GuidedReview {...props} initialMode="my-review" />);
  const checklist = await screen.findByRole('list', { name: 'Focus area checklist' });
  expect(within(checklist).getByText('Sound as proposed')).toBeInTheDocument();
  expect(checklist.querySelectorAll(':scope > li')).toHaveLength(6);
  expect(within(checklist).getByText('How well does the proposed overall structure work?')).toBeInTheDocument();
  expect(within(checklist).getAllByText('No answer').length).toBeGreaterThan(0);
  expect(within(checklist).getByText('Reason: Keep the pathways.')).toBeInTheDocument();
  expect(within(checklist).getByText('Section comments: 1')).toBeInTheDocument();
  expect(screen.getAllByText('Clarify the placement rule.').length).toBeGreaterThan(0);
  expect(screen.getAllByText('Please add a short summary.').length).toBeGreaterThan(0);
  expect(screen.queryByText('choice-prompt: structure-approach')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Edit whole-paper comment' }));
  expect(screen.getAllByRole('heading', { name: 'Whole-paper comments' }).length).toBeGreaterThan(0);
  fireEvent.change(screen.getByLabelText('Go to a focus area'), { target: { value: 'my-review' } });
  fireEvent.click(screen.getByRole('button', { name: 'Return to section' }));
  expect(screen.getByText('Proposed framework')).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Go to a focus area'), { target: { value: 'my-review' } });
  fireEvent.click(screen.getAllByRole('button', { name: 'Return to area' })[0]);
  expect(screen.getByText('Proposed framework')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Scientific deep dive (v0.9.91)' })).toHaveAttribute('href', '/matrix-options/paper/v/v0.9.91');
});

it('shows accessible progress and bounded next-area navigation while allowing direct area selection', async () => {
  fetchMock.mockImplementation((url: string) => Promise.resolve(new Response(JSON.stringify(url.includes('/state?') ? stateResponse() : feedbackResponse()))));
  render(<R2GuidedReview {...props} />);
  expect(await screen.findByText('Review responses are currently read-only. The paper remains available.')).toBeInTheDocument();
  expect(screen.getAllByRole('progressbar', { name: 'Focus areas reviewed on this page' })).toHaveLength(2);
  expect(screen.getAllByRole('progressbar', { name: 'Focus areas reviewed on this page' })[0]).toHaveAttribute('aria-valuenow', '0');
  fireEvent.click(screen.getAllByRole('button', { name: 'Mark area reviewed on this page' })[0]);
  expect(screen.getAllByRole('progressbar', { name: 'Focus areas reviewed on this page' })[0]).toHaveAttribute('aria-valuenow', '1');
  fireEvent.click(screen.getAllByRole('button', { name: 'Next focus area' })[0]);
  expect(screen.getAllByText('Where standards apply - sediment uses and waterbodies', { selector: 'h2' }).length).toBeGreaterThan(0);
  fireEvent.change(screen.getByLabelText('Go to a focus area'), { target: { value: 'common-rules-sequencing' } });
  expect(screen.getAllByText('Common rules, implementation and sequencing', { selector: 'h2' }).length).toBeGreaterThan(0);
  fireEvent.click(screen.getAllByRole('button', { name: 'Go to My Review' })[0]);
  expect(screen.getByRole('heading', { name: 'My Review' })).toBeInTheDocument();
  expect(fetchMock).toHaveBeenCalledTimes(2);
});

it('shows unsaved edits in My Review and blocks completion until they are saved', async () => {
  fetchMock.mockImplementation((url: string) => Promise.resolve(new Response(JSON.stringify(url.includes('/state?') ? stateResponse([], 'writable') : feedbackResponse()))));
  render(<R2GuidedReview {...props} />);
  const choice = await screen.findAllByRole('radio', { name: 'Needs refinement' });
  fireEvent.click(choice[0]);
  fireEvent.change(screen.getByLabelText('Go to a focus area'), { target: { value: 'my-review' } });
  expect(within(screen.getByRole('list', { name: 'Focus area checklist' })).getByText('Needs refinement')).toBeInTheDocument();
  expect(screen.getByText('Unsaved - return to this area to save')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Finish review' })).toBeDisabled();
  expect(screen.getByRole('alert')).toHaveTextContent('Save your changes before finishing.');
  expect(fetchMock).toHaveBeenCalledTimes(2);
});

it('saves a typed choice with the exact identity and current user', async () => {
  fetchMock.mockImplementation((url: string, init?: RequestInit) => {
    if (url.includes('/state?')) return Promise.resolve(new Response(JSON.stringify(stateResponse([], 'writable'))));
    if (url.includes('/feedback?')) return Promise.resolve(new Response(JSON.stringify(feedbackResponse())));
    const body = JSON.parse(String(init?.body));
    return Promise.resolve(new Response(JSON.stringify({ outcome: 'ok', guidedManifestSha256: manifest.guidedManifestSha256, reviewManifestSha256: manifest.reviewManifestSha256, row: { user_id: userKey, document_version: manifest.documentVersion, guided_manifest_sha256: manifest.guidedManifestSha256, review_manifest_sha256: manifest.reviewManifestSha256, target_kind: body.targetKind, target_id: 'structure-approach', revision: 1, draft_choice_id: body.draft.choiceId, draft_rationale: null, draft_text: null, submitted_choice_id: null, submitted_rationale: null, submitted_text: null, submitted_revision: null, submitted_at: null, updated_at: '2026-11-16T00:00:00Z' } })));
  });
  render(<R2GuidedReview {...props} />);
  const choice = await screen.findAllByRole('radio', { name: 'Sound as proposed' });
  fireEvent.click(choice[0]);
  const buttons = screen.getAllByRole('button', { name: 'Save' });
  fireEvent.click(buttons[0]);
  await waitFor(() => expect(screen.getByText('Saved.')).toBeInTheDocument());
  const call = fetchMock.mock.calls.find(([url]) => String(url).includes('/targets/'));
  expect(call).toBeDefined();
  expect(JSON.parse(String(call![1].body))).toMatchObject({ documentVersion: manifest.documentVersion, guidedManifestSha256: manifest.guidedManifestSha256, reviewManifestSha256: manifest.reviewManifestSha256, targetKind: 'choice-prompt', expectedRevision: 0, expectedUserId: userKey, draft: { choiceId: 'sound' } });
});
