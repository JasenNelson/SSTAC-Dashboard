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
  window.localStorage.clear();
});
afterEach(() => {
  vi.unstubAllGlobals();
  Reflect.deleteProperty(HTMLDialogElement.prototype, 'showModal');
  Reflect.deleteProperty(HTMLDialogElement.prototype, 'close');
});

it('keeps the exact paper readable when the state schema is unavailable', async () => {
  fetchMock.mockImplementation((url: string) => Promise.resolve(new Response(JSON.stringify(url.includes('/state?') ? { outcome: 'persistence_unavailable' } : feedbackResponse()), { status: url.includes('/state?') ? 503 : 200 })));
  render(<R2GuidedReview {...props} />);
  expect(await screen.findByRole('alert')).toHaveTextContent('Your review state is temporarily unavailable. The paper remains readable.');
  expect(screen.getByText('Proposed framework')).toBeInTheDocument();
  expect(fetchMock).toHaveBeenCalledTimes(2);
});

it('keeps the account-data notice in collapsed disclosures in the introduction and My Review', async () => {
  fetchMock.mockImplementation((url: string) => Promise.resolve(new Response(JSON.stringify(url.includes('/state?') ? stateResponse() : feedbackResponse()))));
  render(<R2GuidedReview {...props} initialMode="my-review" />);
  expect(await screen.findByText('Review responses are currently read-only. The paper remains available.')).toBeInTheDocument();
  expect(screen.getByText('Review the proposed approach and share feedback where you have a view. All questions are optional.')).toBeInTheDocument();
  expect(screen.getAllByText('How your feedback is used', { selector: 'summary' })).toHaveLength(2);
  expect(screen.getAllByText('How your feedback is used', { selector: 'summary' }).every((summary) => !summary.closest('details')?.open)).toBe(true);
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

it('restores desktop panel widths, keyboard resize, reset, collapse and focus return', async () => {
  window.localStorage.setItem('mtwg-paper-panel-widths-v1', JSON.stringify({ left: 300, right: 450 }));
  fetchMock.mockImplementation((url: string) => Promise.resolve(new Response(JSON.stringify(url.includes('/state?') ? stateResponse() : feedbackResponse()))));
  render(<R2GuidedReview {...props} />);
  await screen.findByText('Review responses are currently read-only. The paper remains available.');
  const layout = screen.getByTestId('r2-workspace-layout');
  expect(layout.style.getPropertyValue('--paper-left-width')).toBe('300px');
  expect(layout.style.getPropertyValue('--paper-right-width')).toBe('450px');
  const handle = screen.getByRole('separator', { name: 'Resize review panel' });
  fireEvent.keyDown(handle, { key: 'ArrowLeft' });
  expect(layout.style.getPropertyValue('--paper-right-width')).toBe('466px');
  expect(JSON.parse(window.localStorage.getItem('mtwg-paper-panel-widths-v1') ?? '{}')).toEqual({ left: 300, right: 466 });
  fireEvent.doubleClick(handle);
  expect(layout.style.getPropertyValue('--paper-right-width')).toBe('352px');
  const toggle = screen.getByTestId('r2-review-toggle');
  fireEvent.keyDown(screen.getByRole('complementary', { name: 'Review this section' }), { key: 'Escape' });
  expect(toggle).toHaveFocus();
  expect(toggle).toHaveAttribute('aria-expanded', 'false');
  expect(screen.getByRole('complementary', { name: 'Review this section' })).toHaveAttribute('inert');
  fireEvent.click(toggle);
  expect(toggle).toHaveAttribute('aria-expanded', 'true');
  fireEvent.click(screen.getByTestId('r2-navigation-toggle'));
  expect(screen.getByTestId('r2-navigation-toggle')).toHaveAttribute('aria-expanded', 'false');
  fireEvent.click(screen.getByRole('button', { name: 'Reset panel widths' }));
  expect(window.localStorage.getItem('mtwg-paper-panel-widths-v1')).toBeNull();
});

it('restores fluid Comfortable/Wide reader preference without enabling writes', async () => {
  fetchMock.mockImplementation((url: string) => Promise.resolve(new Response(JSON.stringify(url.includes('/state?') ? stateResponse() : feedbackResponse()))));
  render(<R2GuidedReview {...props} />);
  await screen.findByText('Review responses are currently read-only. The paper remains available.');
  const frame = screen.getByTestId('r2-reading-frame');
  expect(frame).toHaveAttribute('data-reader-width', 'comfortable');
  fireEvent.click(screen.getByRole('radio', { name: 'Wide' }));
  expect(frame).toHaveAttribute('data-reader-width', 'wide');
  expect(window.localStorage.getItem('mtwg-paper-reader-width-v1')).toBe('wide');
  expect(screen.getAllByRole('button', { name: 'Save' }).every((button) => (button as HTMLButtonElement).disabled)).toBe(true);
});

it('shows 20,000-character counts and expandable manual-height editors for all text targets', async () => {
  const entries = [
    savedEntry('choice-prompt', 'structure-approach', { draft_rationale: 'Keep it.' }),
    savedEntry('text-prompt', 'site-assignment', { draft_text: 'Site details.' }),
    savedEntry('section-comment', 'sec-phase2-3', { draft_text: 'x'.repeat(19000) }),
    savedEntry('whole-paper-comment', 'whole-paper', { draft_text: 'x'.repeat(18999) }),
  ];
  fetchMock.mockImplementation((url: string) => Promise.resolve(new Response(JSON.stringify(url.includes('/state?') ? stateResponse(entries) : feedbackResponse()))));
  render(<R2GuidedReview {...props} />);
  await screen.findByText('Review responses are currently read-only. The paper remains available.');
  const rationale = document.getElementById('desktop-structure-approach-rationale') as HTMLTextAreaElement;
  expect(rationale).toBeDisabled();
  expect(rationale).toHaveAttribute('maxLength', '20000');
  expect(rationale.className).toContain('resize-y');
  expect(rationale.className).toContain('h-56');
  expect(document.getElementById('desktop-structure-approach-rationale-count')).toHaveTextContent('8 / 20000');
  const expand = within(rationale.closest('section') as HTMLElement).getByRole('button', { name: 'Expand editor' });
  fireEvent.click(expand);
  expect(expand).toHaveAttribute('aria-pressed', 'true');
  expect(expand).toHaveAttribute('aria-controls', rationale.id);
  expect(rationale).toHaveAttribute('data-expanded', 'true');
  expect(rationale.className).toContain('h-[min(70vh,44rem)]');
  expect(document.getElementById('mobile-structure-approach-rationale')).toBeInTheDocument();
  expect(document.querySelectorAll('#desktop-structure-approach-rationale')).toHaveLength(1);
  expect(document.querySelectorAll('#mobile-structure-approach-rationale')).toHaveLength(1);
  expect(document.getElementById('desktop-sec-phase2-3-count')).toHaveTextContent('19000 / 20000');
  expect(document.getElementById('desktop-sec-phase2-3-count')).toHaveAttribute('aria-live', 'polite');
  fireEvent.change(screen.getByLabelText('Go to a focus area'), { target: { value: 'uses-waterbodies' } });
  expect(document.getElementById('desktop-site-assignment-count')).toHaveTextContent('13 / 20000');
  fireEvent.click(within(screen.getByRole('complementary', { name: 'Review navigation' })).getByRole('button', { name: 'Whole-paper comments' }));
  expect(document.getElementById('desktop-whole-paper-count')).toHaveTextContent('18999 / 20000');
  expect(document.getElementById('desktop-whole-paper-count')).not.toHaveAttribute('aria-live');
});

it('keeps the window fixed while focus-area selection scrolls only the desktop paper', async () => {
  vi.stubGlobal('innerWidth', 1440);
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { callback(0); return 1; });
  fetchMock.mockImplementation((url: string) => Promise.resolve(new Response(JSON.stringify(url.includes('/state?') ? stateResponse() : feedbackResponse()))));
  render(<R2GuidedReview {...props} />);
  await screen.findByText('Review responses are currently read-only. The paper remains available.');
  const paper = screen.getByTestId('r2-paper-scrollport');
  const target = document.getElementById('sec-phase2-3') as HTMLElement;
  paper.scrollTop = 50;
  vi.spyOn(paper, 'getBoundingClientRect').mockReturnValue({ top: 100 } as DOMRect);
  vi.spyOn(target, 'getBoundingClientRect').mockReturnValue({ top: 300 } as DOMRect);
  const before = window.scrollY;
  const button = within(screen.getByRole('complementary', { name: 'Review navigation' })).getByRole('button', { name: /Overall approach and paper structure/ });
  fireEvent.click(button);
  expect(paper.scrollTop).toBe(234);
  expect(window.scrollY).toBe(before);
  expect(button).toHaveAttribute('aria-current', 'step');
});

it('keeps the mobile picker and dialog without a document jump', async () => {
  vi.stubGlobal('innerWidth', 390);
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { callback(0); return 1; });
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { configurable: true, value(this: HTMLDialogElement) { this.setAttribute('open', ''); } });
  Object.defineProperty(HTMLDialogElement.prototype, 'close', { configurable: true, value(this: HTMLDialogElement) { this.removeAttribute('open'); this.dispatchEvent(new Event('close')); } });
  fetchMock.mockImplementation((url: string) => Promise.resolve(new Response(JSON.stringify(url.includes('/state?') ? stateResponse() : feedbackResponse()))));
  render(<R2GuidedReview {...props} />);
  await screen.findByText('Review responses are currently read-only. The paper remains available.');
  const before = window.scrollY;
  fireEvent.change(screen.getByLabelText('Go to a focus area'), { target: { value: 'uses-waterbodies' } });
  expect(window.scrollY).toBe(before);
  const action = screen.getByTestId('r2-mobile-review-action');
  fireEvent.click(action);
  expect(screen.getByTestId('r2-mobile-review-dialog')).toHaveAttribute('open');
  fireEvent.click(screen.getByRole('button', { name: 'Close review panel' }));
  expect(action).toHaveFocus();
  expect(window.scrollY).toBe(before);
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
  expect(screen.getAllByText('Unsaved - save before finishing').length).toBeGreaterThan(0);
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
