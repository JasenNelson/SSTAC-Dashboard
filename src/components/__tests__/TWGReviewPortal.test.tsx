import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import TWGReviewPortal from '../TWGReviewPortal'
import { createClient } from '@/lib/supabase/client'

// Mock Supabase client
vi.mock('@/lib/supabase/client', () => ({
  createClient: vi.fn(),
}))

// Mock MathRenderer to avoid CSS import issues
vi.mock('../MathRenderer', () => ({
  default: () => <div data-testid="math-renderer-mock">MathRenderer Mock</div>
}))

describe('TWGReviewPortal', () => {
  const mockInsert = vi.fn()
  const mockUpdate = vi.fn()
  const mockFrom = vi.fn()
  const mockGetUser = vi.fn()

  // Lookup-builder chain: .select().eq().order().limit().maybeSingle()
  const buildLookup = (result: { data: unknown; error: unknown }) => {
    const maybeSingle = vi.fn().mockResolvedValue(result)
    const limit = vi.fn(() => ({ maybeSingle }))
    const order = vi.fn(() => ({ limit }))
    const eq = vi.fn(() => ({ order }))
    const select = vi.fn(() => ({ eq }))
    return { select, eq, order, limit, maybeSingle }
  }

  // Update chain: .update().eq()
  const buildUpdateChain = (result: { error: unknown }) => {
    const eq = vi.fn().mockResolvedValue(result)
    mockUpdate.mockReturnValue({ eq })
    return { eq }
  }

  beforeEach(() => {
    vi.clearAllMocks()
    window.localStorage.clear()

    mockInsert.mockResolvedValue({ error: null })
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'test-user-123' } },
      error: null,
    })

    // Typecast since it's mocked
    ;(createClient as unknown as Mock).mockReturnValue({
      auth: { getUser: mockGetUser },
      from: mockFrom,
    })

    // Mock alert to prevent test output noise
    vi.spyOn(window, 'alert').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('inserts a new review when none exists', async () => {
    const lookup = buildLookup({ data: null, error: null })
    mockFrom.mockReturnValue({
      select: lookup.select,
      insert: mockInsert,
      update: mockUpdate,
    })

    const finalDraftContent = `
## Executive Summary
This is the summary.
## Technical Methodology
Here is the methodology.
    `

    render(<TWGReviewPortal finalDraftContent={finalDraftContent} />)

    const generalTextarea = screen.getByPlaceholderText(/Overall thoughts on the methodology\.\.\./i)
    fireEvent.change(generalTextarea, { target: { value: 'Looks great overall.' } })

    const execTextarea = screen.getByPlaceholderText(/Specific feedback for Executive Summary\.\.\./i)
    fireEvent.change(execTextarea, { target: { value: 'Summary is clear.' } })

    const submitButton = screen.getByRole('button', { name: /Submit Review/i })
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(mockGetUser).toHaveBeenCalled()
      expect(mockFrom).toHaveBeenCalledWith('matrix_reviews')
      expect(mockInsert).toHaveBeenCalledTimes(1)
    })

    // SELECT must filter on the authenticated user_id, never spoofable client-side
    expect(lookup.eq).toHaveBeenCalledWith('user_id', 'test-user-123')

    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'test-user-123',
        status: 'SUBMITTED',
        comments_data: {
          General: 'Looks great overall.',
          'Executive Summary': 'Summary is clear.',
        },
      })
    )
    expect(mockUpdate).not.toHaveBeenCalled()

    expect(await screen.findByText('Review Submitted')).toBeInTheDocument()
  })

  it('updates the existing review when one is found, never spoofing user_id', async () => {
    const lookup = buildLookup({ data: { id: 'existing-row-abc' }, error: null })
    const updateChain = buildUpdateChain({ error: null })
    mockFrom.mockReturnValue({
      select: lookup.select,
      insert: mockInsert,
      update: mockUpdate,
    })

    render(<TWGReviewPortal finalDraftContent={'## Section A\nbody'} />)

    fireEvent.change(screen.getByPlaceholderText(/Overall thoughts/i), {
      target: { value: 'Updated overall.' },
    })

    fireEvent.click(screen.getByRole('button', { name: /Submit Review/i }))

    await waitFor(() => {
      expect(mockUpdate).toHaveBeenCalledTimes(1)
    })

    // SELECT scoped to current user_id
    expect(lookup.eq).toHaveBeenCalledWith('user_id', 'test-user-123')
    expect(mockInsert).not.toHaveBeenCalled()
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'SUBMITTED' })
    )
    // update path must NOT carry user_id in payload (RLS enforces ownership; we
    // don't want a client-controlled column rewrite even on hardened RLS)
    expect(mockUpdate.mock.calls[0][0]).not.toHaveProperty('user_id')
    expect(updateChain.eq).toHaveBeenCalledWith('id', 'existing-row-abc')
  })

  it('disambiguates duplicate H2 headings in the payload and rejects prototype-pollution keys', async () => {
    const lookup = buildLookup({ data: null, error: null })
    mockFrom.mockReturnValue({
      select: lookup.select,
      insert: mockInsert,
      update: mockUpdate,
    })

    // Two identical "Conclusions" sections plus a "__proto__"-named section that
    // must not become a payload key.
    const draft = `
## Conclusions
first body
## __proto__
hostile body
## Conclusions
second body
    `

    render(<TWGReviewPortal finalDraftContent={draft} />)

    // The duplicate "Conclusions" must produce two independent inputs whose
    // placeholders use the disambiguated displayLabels.
    const firstConclusions = screen.getByPlaceholderText('Specific feedback for Conclusions (#1)...')
    const secondConclusions = screen.getByPlaceholderText('Specific feedback for Conclusions (#2)...')
    fireEvent.change(firstConclusions, { target: { value: 'first comment' } })
    fireEvent.change(secondConclusions, { target: { value: 'second comment' } })

    // A heading named "__proto__" must still render an input (we don't crash),
    // but its content must NEVER land in the payload.
    const protoTextarea = screen.queryByPlaceholderText('Specific feedback for __proto__...')
    if (protoTextarea) {
      fireEvent.change(protoTextarea, { target: { value: 'pollution attempt' } })
    }

    fireEvent.click(screen.getByRole('button', { name: /Submit Review/i }))

    await waitFor(() => expect(mockInsert).toHaveBeenCalledTimes(1))

    const payload = mockInsert.mock.calls[0][0].comments_data as Record<string, string>
    expect(payload).toEqual(
      expect.objectContaining({
        'Conclusions (#1)': 'first comment',
        'Conclusions (#2)': 'second comment',
      })
    )
    // __proto__ MUST NOT appear as a payload key, even though the user typed there
    expect(Object.keys(payload)).not.toContain('__proto__')
    // and Object.prototype must not have been mutated
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(({} as any).polluted).toBeUndefined()
  })

  it('refuses to submit when getUser returns no user', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null })
    mockFrom.mockReturnValue({ select: vi.fn(), insert: mockInsert, update: mockUpdate })

    render(<TWGReviewPortal finalDraftContent={'## A\nx'} />)
    fireEvent.click(screen.getByRole('button', { name: /Submit Review/i }))

    await waitFor(() => {
      expect(mockGetUser).toHaveBeenCalled()
    })
    expect(mockInsert).not.toHaveBeenCalled()
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('invokes window.print() exactly once when Download (PDF) is clicked', () => {
    // Regression guard: prior to this fix the "Download Draft (PDF)" button
    // had no onClick handler and silently did nothing on click. Owner
    // reported the breakage on the live production deploy of PR #124.
    const printSpy = vi.spyOn(window, 'print').mockImplementation(() => {})
    render(<TWGReviewPortal finalDraftContent={'## Section A\nbody'} />)
    fireEvent.click(
      screen.getByRole('button', { name: /Download.*PDF/i }),
    )
    expect(printSpy).toHaveBeenCalledTimes(1)
    printSpy.mockRestore()
  })

  it('includes print:max-w-none on the inner wrapper div to allow full-width printing', () => {
    const { container } = render(<TWGReviewPortal finalDraftContent={'## Section A\nbody'} />)
    const innerWrapper = container.querySelector('.print\\:max-w-none')
    expect(innerWrapper).toBeInTheDocument()
  })

  // Regression set for silent comment truncation. Comments were clipped at MAX_CHARS =
  // 5000 with no notice. `maxLength` used to be on the textarea, which made the BROWSER
  // truncate a paste before onChange ever fired -- so handleCommentChange's overBy logic
  // could never run. maxLength is now removed and truncation is announced via role="alert".
  it('announces truncation and stores exactly 5000 chars when a comment exceeds MAX_CHARS', async () => {
    const lookup = buildLookup({ data: null, error: null })
    mockFrom.mockReturnValue({
      select: lookup.select,
      insert: mockInsert,
      update: mockUpdate,
    })

    render(<TWGReviewPortal finalDraftContent={'## Section A\nbody'} />)

    const generalTextarea = screen.getByPlaceholderText(
      /Overall thoughts on the methodology\.\.\./i
    ) as HTMLTextAreaElement
    const tooLong = 'a'.repeat(5010)
    fireEvent.change(generalTextarea, { target: { value: tooLong } })

    const alert = await screen.findByRole('alert')
    // Pin the exact dropped-character count (5010 - MAX_CHARS 5000 = 10). A bare
    // `.toContain('10')` also passes on '5,010' or '100', so it does not actually
    // prove the count is right. The word-boundary regex below only matches a
    // standalone "10", not a "10" embedded in a longer number.
    expect(alert.textContent).toMatch(/\bso 10 characters were removed from the end\b/)
    expect(generalTextarea.value).toHaveLength(5000)
    // jsdom does not enforce maxLength on programmatic fireEvent.change input, so the assertions
    // above would stay green even if maxLength={5000} were reintroduced on the textarea in a real
    // browser -- which is the production regression this test exists to catch (a real maxLength
    // would silently drop the paste tail before onChange ever fires, so handleCommentChange, and
    // therefore this alert, would never run). Pin the precondition where the claim is made: the
    // element under test must not carry the attribute. (A dedicated test near line 497 already
    // asserts this across every comment textarea; this pins it at the point this test relies on it.)
    expect(generalTextarea).not.toHaveAttribute('maxLength')
  })

  it('shows no alert when a comment is at or under MAX_CHARS', () => {
    render(<TWGReviewPortal finalDraftContent={'## Section A\nbody'} />)

    const generalTextarea = screen.getByPlaceholderText(
      /Overall thoughts on the methodology\.\.\./i
    ) as HTMLTextAreaElement
    const atLimit = 'b'.repeat(5000)
    fireEvent.change(generalTextarea, { target: { value: atLimit } })

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(generalTextarea.value).toHaveLength(5000)
  })

  it('blocks submission when the reviewer declines the truncation confirmation', async () => {
    // The inline alert fires when the clip happens, which can be long before Submit and may be
    // scrolled past. Submitting is the irreversible moment, so the loss is restated and the
    // reviewer chooses. Declining must abort BEFORE any Supabase call.
    const lookup = buildLookup({ data: null, error: null })
    mockFrom.mockReturnValue({ select: lookup.select, insert: mockInsert, update: mockUpdate })
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false)

    render(<TWGReviewPortal finalDraftContent={'## Section A\nbody'} />)

    const generalTextarea = screen.getByPlaceholderText(
      /Overall thoughts on the methodology\.\.\./i
    )
    fireEvent.change(generalTextarea, { target: { value: 'x'.repeat(5010) } })

    fireEvent.click(screen.getByRole('button', { name: /Submit Review/i }))

    await waitFor(() => expect(confirmSpy).toHaveBeenCalledTimes(1))
    expect(confirmSpy.mock.calls[0][0]).toMatch(/10 characters were removed/)
    expect(mockGetUser).not.toHaveBeenCalled()
    expect(mockInsert).not.toHaveBeenCalled()
    confirmSpy.mockRestore()
  })

  it('does not ask for confirmation when nothing was truncated', async () => {
    // The other side: an ordinary submission must not be interrupted by a dialog.
    const lookup = buildLookup({ data: null, error: null })
    mockFrom.mockReturnValue({ select: lookup.select, insert: mockInsert, update: mockUpdate })
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)

    render(<TWGReviewPortal finalDraftContent={'## Section A\nbody'} />)
    fireEvent.change(
      screen.getByPlaceholderText(/Overall thoughts on the methodology\.\.\./i),
      { target: { value: 'a short comment' } }
    )
    fireEvent.click(screen.getByRole('button', { name: /Submit Review/i }))

    await waitFor(() => expect(mockInsert).toHaveBeenCalledTimes(1))
    expect(confirmSpy).not.toHaveBeenCalled()
    confirmSpy.mockRestore()
  })

  it('keeps the truncation count cumulative across a CONTINUATION of the same content', async () => {
    // The count used to hold only the LAST edit's loss, so "1,000 removed" became "1 removed"
    // on the next keystroke and vanished on the one after. The loss is permanent; the notice
    // must not be more transient than the damage -- as long as the edit is still building on
    // the same (already-clipped) content, not replacing it outright (see the replacement test
    // below for that other case).
    render(<TWGReviewPortal finalDraftContent={'## Section A\nbody'} />)
    const ta = screen.getByPlaceholderText(/Overall thoughts on the methodology\.\.\./i)

    fireEvent.change(ta, { target: { value: 'x'.repeat(6000) } })   // drops 1000; stored = x*5000
    expect((await screen.findByRole('alert')).textContent).toMatch(/1,000 characters were removed/)

    // Continuation: this value STARTS WITH the previously stored clipped value (x*5000), so it
    // is one more character typed onto the same content, not a replacement.
    fireEvent.change(ta, { target: { value: 'x'.repeat(5001) } })   // drops 1 more of the SAME text
    expect((await screen.findByRole('alert')).textContent).toMatch(/1,001 characters were removed/)
  })

  // CHANGED (redesign): the old "resets on REPLACEMENT" test asserted the removed prefix
  // heuristic's behaviour -- that an edit whose text was not a prefix of the prior stored value
  // reset the count instead of accumulating. That heuristic is gone (see the comment in
  // handleCommentChange for why: it produced a fresh defect in each of three review rounds).
  // Under the new design, loss is a fact of the session that persists across ANY edit except
  // clearing the field to empty, so the SAME two edits that used to reset to 1,000 now
  // correctly accumulate to 2,100 -- this test is updated to assert the new, intended behaviour
  // rather than removed, since the underlying scenario (two successive over-limit edits) is
  // still worth covering.
  it('accumulates the truncation count across successive over-limit edits regardless of string shape', async () => {
    render(<TWGReviewPortal finalDraftContent={'## Section A\nbody'} />)
    const ta = screen.getByPlaceholderText(/Overall thoughts on the methodology\.\.\./i)

    fireEvent.change(ta, { target: { value: 'a'.repeat(6100) } })   // drops 1100; stored = a*5000
    expect((await screen.findByRole('alert')).textContent).toMatch(/1,100 characters were removed/)

    // 'b'.repeat(6000) does NOT start with the stored 'a'.repeat(5000) and is not a prefix of it
    // either -- under the old heuristic this would have been read as a "replacement" and reset
    // the count. There is no such inference any more: the prior loss is a fact and persists,
    // so this edit's own 1,000-character loss is ADDED on top.
    fireEvent.change(ta, { target: { value: 'b'.repeat(6000) } })   // drops 1000 more
    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toMatch(/2,100 characters were removed/)
  })

  // CHANGED (redesign): the old "clears on replacement fits under limit (FIX 2)" test asserted
  // that rewriting the field short (still non-empty) cleared the warning. Under the current
  // design there is no automatic clearing at all -- not for a non-empty rewrite, and not for
  // an empty field either (see the clear-then-restore exploit test below for why the empty-
  // field case was removed too). The record is cleared only by an explicit Dismiss click or a
  // successful submit. This test is updated to assert the new behaviour: a short, unrelated,
  // non-empty rewrite KEEPS the warning, because the component cannot tell "different text"
  // from "the same text, edited" by shape alone.
  it('keeps the truncation warning when a non-empty rewrite fits under the limit (loss is a fact, not inferred from string shape)', async () => {
    render(<TWGReviewPortal finalDraftContent={'## Section A\nbody'} />)
    const ta = screen.getByPlaceholderText(/Overall thoughts on the methodology\.\.\./i)

    fireEvent.change(ta, { target: { value: 'x'.repeat(6000) } })   // drops 1000
    expect((await screen.findByRole('alert')).textContent).toMatch(/1,000 characters were removed/)

    fireEvent.change(ta, { target: { value: 'short rewrite' } })    // unrelated, fits comfortably, non-empty
    expect((await screen.findByRole('alert')).textContent).toMatch(/1,000 characters were removed/)
  })

  // CHANGED (redesign): the empty-field exception described above was removed entirely. It was
  // exploitable: paste an over-limit value (clipped, loss recorded) -> select-all and delete
  // (record wrongly cleared) -> press Undo, or otherwise retype the exact clipped text (no
  // overflow of its own, so nothing recreates the record) -> the submit gate sees no loss and
  // silently writes the clipped text. This test used to assert that clearing the field removed
  // the warning; that behaviour is deliberately gone, so the test is replaced with one that
  // reproduces the exploit end to end and proves it is now blocked: it must FAIL if the
  // empty-field exception is ever reinstated.
  it('keeps the truncation warning (and the submit confirmation) through a clear-then-restore of clipped content', async () => {
    const lookup = buildLookup({ data: null, error: null })
    mockFrom.mockReturnValue({ select: lookup.select, insert: mockInsert, update: mockUpdate })
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false)

    render(<TWGReviewPortal finalDraftContent={'## Section A\nbody'} />)
    const ta = screen.getByPlaceholderText(/Overall thoughts on the methodology\.\.\./i) as HTMLTextAreaElement

    // 1. Paste an over-limit value -- it is clipped and the loss is recorded.
    fireEvent.change(ta, { target: { value: 'x'.repeat(6000) } })   // drops 1000; stored = x*5000
    expect((await screen.findByRole('alert')).textContent).toMatch(/1,000 characters were removed/)
    expect(ta.value).toHaveLength(5000)

    // 2. Reviewer clears the field (select-all + Delete / Ctrl+A Backspace).
    fireEvent.change(ta, { target: { value: '' } })

    // 3. Reviewer presses Undo (or otherwise restores the clipped text). This edit has NO
    // overflow of its own -- if the old empty-field exception still existed, nothing would
    // recreate the record and this restore would look like a clean, un-truncated 5000-char
    // comment.
    fireEvent.change(ta, { target: { value: 'x'.repeat(5000) } })

    // The record must still be present: the warning is still shown,
    expect((await screen.findByRole('alert')).textContent).toMatch(/1,000 characters were removed/)

    // and the submit gate must still fire the confirmation dialog naming the loss.
    fireEvent.click(screen.getByRole('button', { name: /Submit Review/i }))
    await waitFor(() => expect(confirmSpy).toHaveBeenCalledTimes(1))
    expect(confirmSpy.mock.calls[0][0]).toMatch(/1,000 characters were removed/)
    expect(mockGetUser).not.toHaveBeenCalled()
    expect(mockInsert).not.toHaveBeenCalled()

    confirmSpy.mockRestore()
  })

  it('persists truncation provenance across save and restore', async () => {
    // A saved comment is exactly MAX_CHARS whether it was clipped or written that long on
    // purpose, so the string alone cannot carry this evidence. Without a companion record the
    // reviewer resumes and submits short with no warning.
    render(<TWGReviewPortal finalDraftContent={'## Section A\nbody'} />)
    fireEvent.change(
      screen.getByPlaceholderText(/Overall thoughts on the methodology\.\.\./i),
      { target: { value: 'x'.repeat(5010) } }
    )
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {})
    fireEvent.click(screen.getByRole('button', { name: /Save Draft/i }))
    alertSpy.mockRestore()

    const stored = window.localStorage.getItem('twg-matrix-review-draft-v6-truncation')
    expect(stored).toBeTruthy()
    expect(JSON.parse(stored as string).general).toBe(10)

    // Remount: the warning must come back, from the record rather than from the string.
    cleanup()
    render(<TWGReviewPortal finalDraftContent={'## Section A\nbody'} />)
    expect((await screen.findByRole('alert')).textContent).toMatch(/10 characters were removed/)
  })

  it('announces truncation when a restored draft exceeds the limit', async () => {
    // Codex round 1: the restore path clipped `v.slice(0, MAX_CHARS)` without recording it, so a
    // legacy or externally-edited draft came back short, handleSave wrote the short value back,
    // and the submission went out truncated with no notice -- the same silent-loss defect this
    // component's change removes on the live-edit path, one path over.
    //
    // Falsified two-sided: with the restore path's truncation tracking removed, this test fails
    // on the missing alert; with it present, it passes. The under-limit case below is the other
    // side -- it fails if the restore path ever announces a truncation that did not happen.
    window.localStorage.setItem(
      'twg-matrix-review-draft-v6',
      JSON.stringify({ general: 'x'.repeat(5010) })
    )

    render(<TWGReviewPortal finalDraftContent={'## Section A\nbody'} />)

    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toMatch(/\bso 10 characters were removed from the end\b/)

    const generalTextarea = screen.getByPlaceholderText(
      /Overall thoughts on the methodology\.\.\./i
    ) as HTMLTextAreaElement
    expect(generalTextarea.value).toHaveLength(5000)
  })

  it('uses the singular form when exactly one character is dropped', async () => {
    // The alert branches on overBy === 1. Untested, that branch is where "1 characters were
    // removed" ships. Restoring 5001 chars exercises it end to end.
    window.localStorage.setItem(
      'twg-matrix-review-draft-v6',
      JSON.stringify({ general: 'x'.repeat(5001) })
    )

    render(<TWGReviewPortal finalDraftContent={'## Section A\nbody'} />)

    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toMatch(/\bso 1 character was removed from the end\b/)
    expect(alert.textContent).not.toMatch(/1 characters were removed/)
  })

  it('does not announce truncation when a restored draft is within the limit', () => {
    // Deliberately ONE character short of MAX_CHARS, not AT it: a value exactly at MAX_CHARS with
    // no truncation key present is now the unknown-provenance case covered separately below
    // ("flags a legacy draft..."), so it can no longer stand in for "clearly under the limit".
    window.localStorage.setItem(
      'twg-matrix-review-draft-v6',
      JSON.stringify({ general: 'x'.repeat(4999) })
    )

    render(<TWGReviewPortal finalDraftContent={'## Section A\nbody'} />)

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    const generalTextarea = screen.getByPlaceholderText(
      /Overall thoughts on the methodology\.\.\./i
    ) as HTMLTextAreaElement
    expect(generalTextarea.value).toHaveLength(4999)
  })

  it('does not carry a maxLength attribute on ANY comment textarea', () => {
    // Two headings, so the per-heading textareas are rendered alongside the General one. An
    // earlier version of this test asserted only on the General textarea while being named for
    // all of them, so re-adding maxLength to the per-heading textareas passed it. Assert over
    // EVERY textarea instead: the property under test is "no comment textarea carries this
    // attribute", and a fix scoped to one element is how the property gets half-enforced.
    render(<TWGReviewPortal finalDraftContent={'## Section A\nbody\n\n## Section B\nbody'} />)

    const textareas = screen.getAllByRole('textbox')

    // Guard the guard: if the query ever stops finding the per-heading textareas this test would
    // silently shrink to the General-only case it was written to replace.
    // Pin the exact count and BOTH headings. A `>= 3` floor with only two placeholders pinned
    // would still pass if Section B's textarea stopped rendering, which is the shrink this floor
    // exists to prevent.
    expect(textareas).toHaveLength(3)
    expect(
      screen.getByPlaceholderText(/Overall thoughts on the methodology\.\.\./i)
    ).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/Specific feedback for Section A\.\.\./i)).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/Specific feedback for Section B\.\.\./i)).toBeInTheDocument()

    for (const textarea of textareas) {
      expect(textarea).not.toHaveAttribute('maxLength')
    }
  })

  it('does not surface a stale heading key in the submit confirmation dialog (FIX 3)', async () => {
    // A truncatedBy entry for a heading storageKey (h::<idx>) that no longer exists in the
    // current document renders no inline alert and is absent from buildCommentsPayload -- it
    // must not inflate droppedTotal or trigger the confirm dialog either.
    const lookup = buildLookup({ data: null, error: null })
    mockFrom.mockReturnValue({ select: lookup.select, insert: mockInsert, update: mockUpdate })
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)

    const { rerender } = render(
      <TWGReviewPortal finalDraftContent={'## Section A\nbody\n\n## Section B\nbody'} />
    )

    const sectionBTextarea = screen.getByPlaceholderText(/Specific feedback for Section B\.\.\./i)
    fireEvent.change(sectionBTextarea, { target: { value: 'x'.repeat(5010) } })
    expect(await screen.findByRole('alert')).toBeInTheDocument()

    // Document is replaced and Section B no longer exists, but the truncatedBy record for its
    // storageKey (h::1) is still sitting in state from before this rerender.
    rerender(<TWGReviewPortal finalDraftContent={'## Section A\nbody'} />)

    fireEvent.click(screen.getByRole('button', { name: /Submit Review/i }))

    await waitFor(() => expect(mockInsert).toHaveBeenCalledTimes(1))
    // If the stale key were still counted, droppedTotal would be > 0 and confirm would fire.
    expect(confirmSpy).not.toHaveBeenCalled()
    confirmSpy.mockRestore()
  })

  it('shows a status note naming the dropped count when the reviewer declines the confirmation (FIX 4)', async () => {
    // window.confirm returning false (a deliberate decline, or a browser suppressing dialogs)
    // must not make Submit appear to silently do nothing.
    const lookup = buildLookup({ data: null, error: null })
    mockFrom.mockReturnValue({ select: lookup.select, insert: mockInsert, update: mockUpdate })
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false)

    render(<TWGReviewPortal finalDraftContent={'## Section A\nbody'} />)
    fireEvent.change(
      screen.getByPlaceholderText(/Overall thoughts on the methodology\.\.\./i),
      { target: { value: 'x'.repeat(5010) } }
    )
    fireEvent.click(screen.getByRole('button', { name: /Submit Review/i }))

    await waitFor(() => expect(confirmSpy).toHaveBeenCalledTimes(1))
    const status = await screen.findByRole('status')
    expect(status.textContent).toMatch(/\b10\b/)
    expect(mockGetUser).not.toHaveBeenCalled()
    expect(mockInsert).not.toHaveBeenCalled()
    confirmSpy.mockRestore()
  })

  it('clears the cancelled-submit note once a later submit attempt is confirmed (FIX 4)', async () => {
    const lookup = buildLookup({ data: null, error: null })
    mockFrom.mockReturnValue({ select: lookup.select, insert: mockInsert, update: mockUpdate })
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false)

    render(<TWGReviewPortal finalDraftContent={'## Section A\nbody'} />)
    fireEvent.change(
      screen.getByPlaceholderText(/Overall thoughts on the methodology\.\.\./i),
      { target: { value: 'x'.repeat(5010) } }
    )
    fireEvent.click(screen.getByRole('button', { name: /Submit Review/i }))
    await screen.findByRole('status')

    confirmSpy.mockReturnValue(true)
    fireEvent.click(screen.getByRole('button', { name: /Submit Review/i }))

    await waitFor(() => expect(mockInsert).toHaveBeenCalledTimes(1))
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    confirmSpy.mockRestore()
  })

  it('reports the draft as NOT saved when the truncation-provenance write fails, and does not write the draft at all (FIX 5)', () => {
    // Provenance is now written FIRST. The old "draft succeeded, provenance failed" scenario this
    // test used to cover no longer exists: if provenance cannot be stored, handleSave returns
    // before ever attempting the draft write. Writing the draft anyway would leave a RESUMABLE
    // clipped draft with no record of what it lost -- exactly the silent-loss defect the reorder
    // exists to close.
    render(<TWGReviewPortal finalDraftContent={'## Section A\nbody'} />)
    fireEvent.change(
      screen.getByPlaceholderText(/Overall thoughts on the methodology\.\.\./i),
      { target: { value: 'hello there' } }
    )

    const setItemSpy = vi
      .spyOn(window.localStorage, 'setItem')
      .mockImplementation((key: string) => {
        if (key === 'twg-matrix-review-draft-v6-truncation') {
          throw new Error('quota exceeded')
        }
      })
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {})

    fireEvent.click(screen.getByRole('button', { name: /Save Draft/i }))

    expect(alertSpy).toHaveBeenCalledWith(expect.stringMatching(/draft was.*not saved/i))
    // The draft write must never have been attempted.
    expect(window.localStorage.getItem('twg-matrix-review-draft-v6')).toBeNull()

    setItemSpy.mockRestore()
    alertSpy.mockRestore()
  })

  it('shows "Unable to save draft locally" when provenance succeeds but the draft write then fails (FIX 5)', () => {
    // The second half of the new contract: provenance is written first and succeeds, so the code
    // proceeds to the draft write; only that second write fails, and the pre-existing generic
    // alert is what fires for it.
    render(<TWGReviewPortal finalDraftContent={'## Section A\nbody'} />)
    fireEvent.change(
      screen.getByPlaceholderText(/Overall thoughts on the methodology\.\.\./i),
      { target: { value: 'hello there' } }
    )

    const originalSetItem = window.localStorage.setItem.bind(window.localStorage)
    const setItemSpy = vi
      .spyOn(window.localStorage, 'setItem')
      .mockImplementation((key: string, value: string) => {
        if (key === 'twg-matrix-review-draft-v6') {
          throw new Error('quota exceeded')
        }
        originalSetItem(key, value)
      })
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {})

    fireEvent.click(screen.getByRole('button', { name: /Save Draft/i }))

    // Provenance write went through first.
    expect(window.localStorage.getItem('twg-matrix-review-draft-v6-truncation')).toBeTruthy()
    expect(alertSpy).toHaveBeenCalledWith(
      'Unable to save draft locally (storage quota or access denied).'
    )

    setItemSpy.mockRestore()
    alertSpy.mockRestore()
  })

  it('writes provenance BEFORE the draft: a provenance-write failure must leave DRAFT_STORAGE_KEY absent (order regression guard)', () => {
    // This is a narrow pin on the ORDER itself, independent of the two FIX 5 cases above. If a
    // future change reverted handleSave to the old draft-first, provenance-second order, the
    // draft write would already have succeeded by the time the mocked provenance write below
    // threw, and DRAFT_STORAGE_KEY would be present here -- this test would fail, which is the
    // point: it must fail if the order is swapped back.
    render(<TWGReviewPortal finalDraftContent={'## Section A\nbody'} />)
    fireEvent.change(
      screen.getByPlaceholderText(/Overall thoughts on the methodology\.\.\./i),
      { target: { value: 'order-sensitive draft text' } }
    )

    // Delegate every OTHER write to the real implementation. A mock that only ever throws (and
    // otherwise does nothing) would swallow the draft write silently even if handleSave were
    // reverted to draft-first -- the assertion below would then pass whether or not the fix is
    // in place, because the draft key would never actually be populated by EITHER order. Capture
    // the real setItem BEFORE spying so non-provenance keys are genuinely written.
    const originalSetItem = window.localStorage.setItem.bind(window.localStorage)
    const setItemSpy = vi
      .spyOn(window.localStorage, 'setItem')
      .mockImplementation((key: string, value: string) => {
        if (key === 'twg-matrix-review-draft-v6-truncation') {
          throw new Error('quota exceeded')
        }
        originalSetItem(key, value)
      })
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {})

    fireEvent.click(screen.getByRole('button', { name: /Save Draft/i }))

    expect(window.localStorage.getItem('twg-matrix-review-draft-v6')).toBeNull()

    setItemSpy.mockRestore()
    alertSpy.mockRestore()
  })

  it('clears TRUNCATION_STORAGE_KEY and resets in-memory truncatedBy on a successful submit (FIX 6)', async () => {
    const lookup = buildLookup({ data: null, error: null })
    mockFrom.mockReturnValue({ select: lookup.select, insert: mockInsert, update: mockUpdate })

    render(<TWGReviewPortal finalDraftContent={'## Section A\nbody'} />)
    fireEvent.change(
      screen.getByPlaceholderText(/Overall thoughts on the methodology\.\.\./i),
      { target: { value: 'x'.repeat(5010) } }
    )
    expect(await screen.findByRole('alert')).toBeInTheDocument()

    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {})
    fireEvent.click(screen.getByRole('button', { name: /Save Draft/i }))
    alertSpy.mockRestore()
    expect(window.localStorage.getItem('twg-matrix-review-draft-v6-truncation')).toBeTruthy()

    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
    fireEvent.click(screen.getByRole('button', { name: /Submit Review/i }))

    await waitFor(() => expect(mockInsert).toHaveBeenCalledTimes(1))
    await screen.findByText('Review Submitted')

    expect(window.localStorage.getItem('twg-matrix-review-draft-v6-truncation')).toBeNull()

    // The storage-key check above only proves the persisted record was cleared. It does NOT
    // prove the in-memory truncatedBy state was reset -- deleting the setTruncatedBy() call at
    // the end of handleSubmit would leave this assertion green (localStorage.removeItem still
    // ran) while the component still held the stale in-memory record. Return to the draft (the
    // success screen's "Return to Draft" button calls setIsSubmitted(false)) and prove the
    // in-memory record is actually gone: no leftover alert, and a further submit does not
    // re-trigger the confirmation dialog.
    fireEvent.click(screen.getByRole('button', { name: /Return to Draft/i }))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()

    // confirmSpy already recorded the FIRST submit's confirmation call above -- clear that
    // history so this check is only about whether the SECOND submit re-triggers it.
    confirmSpy.mockClear()
    fireEvent.click(screen.getByRole('button', { name: /Submit Review/i }))
    await waitFor(() => expect(mockInsert).toHaveBeenCalledTimes(2))
    expect(confirmSpy).not.toHaveBeenCalled()

    confirmSpy.mockRestore()
  })

  it('requires a positive safe integer to restore a truncation count; a fractional value is ignored (FIX 6)', async () => {
    window.localStorage.setItem(
      'twg-matrix-review-draft-v6',
      JSON.stringify({ general: 'short' })
    )
    window.localStorage.setItem(
      'twg-matrix-review-draft-v6-truncation',
      JSON.stringify({ general: 0.5 })
    )

    render(<TWGReviewPortal finalDraftContent={'## Section A\nbody'} />)

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('keeps the truncation warning and submit confirmation gate after a single backspace trims clipped content', async () => {
    // Backspacing a clipped value produces a NEW value that is a PREFIX of the OLD stored value
    // (shorter than it, not longer), so the old `value.startsWith(prevValue)` check was false on
    // this edit -- isContinuation was false, overBy for this single-character trim is 0, and the
    // key was dropped entirely. The 1,000-character loss recorded from the earlier clip vanished,
    // the inline alert disappeared, and the Submit confirmation gate never fired. This must hold
    // end to end through handleSubmit, not just in the inline alert.
    const lookup = buildLookup({ data: null, error: null })
    mockFrom.mockReturnValue({ select: lookup.select, insert: mockInsert, update: mockUpdate })
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)

    render(<TWGReviewPortal finalDraftContent={'## Section A\nbody'} />)
    const ta = screen.getByPlaceholderText(/Overall thoughts on the methodology\.\.\./i)

    fireEvent.change(ta, { target: { value: 'x'.repeat(6000) } })   // drops 1000; stored = x*5000
    expect((await screen.findByRole('alert')).textContent).toMatch(/1,000 characters were removed/)

    // Reviewer presses backspace once: new value is the stored clipped value minus one character
    // -- a PREFIX of what was stored, not an extension of it. This edit's own overBy is 0.
    fireEvent.change(ta, { target: { value: 'x'.repeat(4999) } })
    expect((await screen.findByRole('alert')).textContent).toMatch(/1,000 characters were removed/)

    fireEvent.click(screen.getByRole('button', { name: /Submit Review/i }))

    await waitFor(() => expect(confirmSpy).toHaveBeenCalledTimes(1))
    expect(confirmSpy.mock.calls[0][0]).toMatch(/1,000 characters were removed/)
    await waitFor(() => expect(mockInsert).toHaveBeenCalledTimes(1))
    confirmSpy.mockRestore()
  })

  // CHANGED (redesign): this used to be "still clears... short unrelated text", asserting the
  // removed prefix heuristic's REPLACEMENT branch. Repurposed as the required "middle edit"
  // regression test: an ordinary edit that fixes a typo INSIDE the clipped text makes neither
  // string a prefix of the other (same defect class as a full replacement, under the old
  // heuristic), so this is the case that most directly proves the string-shape inference is
  // gone. Extended past the inline alert through to handleSubmit's confirmation gate, per the
  // task's requirement that this hold end to end, not just in the alert.
  it('keeps the truncation warning and submit gate after a middle-of-the-text edit (fixing a typo inside the clipped content)', async () => {
    const lookup = buildLookup({ data: null, error: null })
    mockFrom.mockReturnValue({ select: lookup.select, insert: mockInsert, update: mockUpdate })
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)

    render(<TWGReviewPortal finalDraftContent={'## Section A\nbody'} />)
    const ta = screen.getByPlaceholderText(/Overall thoughts on the methodology\.\.\./i)

    fireEvent.change(ta, { target: { value: 'x'.repeat(6000) } })   // drops 1000; stored = x*5000
    expect((await screen.findByRole('alert')).textContent).toMatch(/1,000 characters were removed/)

    // A middle edit: swap one character in the middle of the stored text. Neither
    // 'x'*2500 + 'y' + 'x'*2499 (5000 chars) starts-with, nor is started-with-by, 'x'*5000.
    const middleEdited = 'x'.repeat(2500) + 'y' + 'x'.repeat(2499)
    expect(middleEdited).toHaveLength(5000)
    fireEvent.change(ta, { target: { value: middleEdited } })
    expect((await screen.findByRole('alert')).textContent).toMatch(/1,000 characters were removed/)

    fireEvent.click(screen.getByRole('button', { name: /Submit Review/i }))
    await waitFor(() => expect(confirmSpy).toHaveBeenCalledTimes(1))
    expect(confirmSpy.mock.calls[0][0]).toMatch(/1,000 characters were removed/)
    await waitFor(() => expect(mockInsert).toHaveBeenCalledTimes(1))
    confirmSpy.mockRestore()
  })

  it('derives TRUNCATION_STORAGE_KEY from DRAFT_STORAGE_KEY so the two are invalidated together', async () => {
    // The old literal 'twg-matrix-review-truncation-v1' was versioned independently of the draft
    // key, so a document-version bump (which discards stale drafts) would NOT retire a stale
    // truncation record, letting it later be read back against a different section of a new
    // document that happens to share the same positional h::<idx> key. Deriving the key from
    // DRAFT_STORAGE_KEY ties the two together automatically.
    render(<TWGReviewPortal finalDraftContent={'## Section A\nbody'} />)
    fireEvent.change(
      screen.getByPlaceholderText(/Overall thoughts on the methodology\.\.\./i),
      { target: { value: 'x'.repeat(5010) } }
    )
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {})
    fireEvent.click(screen.getByRole('button', { name: /Save Draft/i }))
    alertSpy.mockRestore()

    // The old, independently-versioned literal must NOT be the key written.
    expect(window.localStorage.getItem('twg-matrix-review-truncation-v1')).toBeNull()

    const stored = window.localStorage.getItem('twg-matrix-review-draft-v6-truncation')
    expect(stored).toBeTruthy()
    expect(JSON.parse(stored as string).general).toBe(10)
  })

  it('clears a field\'s warning via the Dismiss button and stops the submit confirmation from firing for it', async () => {
    // The reviewer's explicit way to say "this record no longer applies", now that the
    // component does not infer it from string shape. Also proves the confirmation gate reads
    // truncatedBy AFTER dismissal, not a snapshot from before it.
    const lookup = buildLookup({ data: null, error: null })
    mockFrom.mockReturnValue({ select: lookup.select, insert: mockInsert, update: mockUpdate })
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)

    render(<TWGReviewPortal finalDraftContent={'## Section A\nbody'} />)
    fireEvent.change(
      screen.getByPlaceholderText(/Overall thoughts on the methodology\.\.\./i),
      { target: { value: 'x'.repeat(5010) } }
    )
    expect(await screen.findByRole('alert')).toBeInTheDocument()

    fireEvent.click(
      screen.getByRole('button', { name: /Dismiss truncation notice for General Comments/i })
    )
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Submit Review/i }))
    await waitFor(() => expect(mockInsert).toHaveBeenCalledTimes(1))
    // If the dismissed record were still counted, confirm would have fired first.
    expect(confirmSpy).not.toHaveBeenCalled()
    confirmSpy.mockRestore()
  })

  it('dismissing one field\'s warning does not clear another field\'s warning', async () => {
    render(
      <TWGReviewPortal finalDraftContent={'## Section A\nbody\n\n## Section B\nbody'} />
    )

    fireEvent.change(
      screen.getByPlaceholderText(/Overall thoughts on the methodology\.\.\./i),
      { target: { value: 'x'.repeat(5010) } }
    )
    fireEvent.change(
      screen.getByPlaceholderText(/Specific feedback for Section A\.\.\./i),
      { target: { value: 'y'.repeat(5020) } }
    )

    const alerts = await screen.findAllByRole('alert')
    expect(alerts).toHaveLength(2)

    fireEvent.click(
      screen.getByRole('button', { name: /Dismiss truncation notice for General Comments/i })
    )

    // General's alert is gone; Section A's alert (a different field) survives untouched.
    const remaining = await screen.findAllByRole('alert')
    expect(remaining).toHaveLength(1)
    expect(remaining[0].textContent).toMatch(/20 characters were removed/)
    expect(
      screen.queryByRole('button', { name: /Dismiss truncation notice for General Comments/i })
    ).not.toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /Dismiss truncation notice for Section A/i })
    ).toBeInTheDocument()
  })

  // Regression set for the in-flight submit race (P1). The submit payload is built from a
  // pre-edit render, and a successful submit unconditionally clears ALL truncation provenance.
  // If an edit landed while the submission's awaits were pending, it would be clipped/recorded
  // by handleCommentChange but never carried by the in-flight payload, and the submit's success
  // path would then wipe the record for a comment that was never actually submitted -- orphaning
  // provenance with no confirmation. The fix disables the fields the submission depends on for
  // the duration of the submit.
  it('disables comment textareas, dismiss buttons and Save Draft while a submission is in flight', async () => {
    let resolveGetUser!: (v: { data: { user: { id: string } | null }; error: null }) => void
    mockGetUser.mockImplementation(
      () => new Promise((resolve) => { resolveGetUser = resolve })
    )
    mockFrom.mockReturnValue({ select: vi.fn(), insert: mockInsert, update: mockUpdate })
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)

    render(<TWGReviewPortal finalDraftContent={'## Section A\nbody'} />)

    const generalTextarea = screen.getByPlaceholderText(/Overall thoughts on the methodology\.\.\./i)
    const sectionTextarea = screen.getByPlaceholderText(/Specific feedback for Section A\.\.\./i)
    fireEvent.change(generalTextarea, { target: { value: 'x'.repeat(5010) } })
    expect(await screen.findByRole('alert')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Submit Review/i }))

    // getUser() is hung, so handleSubmit is stuck between setIsSubmitting(true) and its first
    // await settling -- exactly the window the race exploited.
    await waitFor(() => expect(generalTextarea).toBeDisabled())
    expect(sectionTextarea).toBeDisabled()
    expect(
      screen.getByRole('button', { name: /Dismiss truncation notice for General Comments/i })
    ).toBeDisabled()
    expect(screen.getByRole('button', { name: /Save Draft/i })).toBeDisabled()

    // Let the hung submission resolve so it does not leak into other tests as a dangling promise.
    resolveGetUser({ data: { user: null }, error: null })
    await waitFor(() => expect(generalTextarea).not.toBeDisabled())

    confirmSpy.mockRestore()
  })

  it('rejects an edit attempted on a disabled textarea during an in-flight submit, so no provenance can be orphaned', async () => {
    let resolveGetUser!: (v: { data: { user: { id: string } | null }; error: null }) => void
    mockGetUser.mockImplementation(
      () => new Promise((resolve) => { resolveGetUser = resolve })
    )
    mockFrom.mockReturnValue({ select: vi.fn(), insert: mockInsert, update: mockUpdate })
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
    const user = userEvent.setup()

    render(<TWGReviewPortal finalDraftContent={'## Section A\nbody'} />)
    const generalTextarea = screen.getByPlaceholderText(
      /Overall thoughts on the methodology\.\.\./i
    ) as HTMLTextAreaElement
    fireEvent.change(generalTextarea, { target: { value: 'x'.repeat(5010) } })
    expect(await screen.findByRole('alert')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Submit Review/i }))
    await waitFor(() => expect(generalTextarea).toBeDisabled())

    // userEvent respects the disabled attribute the way a real browser does (a disabled control
    // cannot be focused or typed into), unlike a raw fireEvent.change which would bypass it. If
    // the disabled attribute were ever dropped, this "paste" would land in the field and clip it
    // mid-submission.
    await user.type(generalTextarea, 'DANGER: typed while disabled')

    expect(generalTextarea.value).toHaveLength(5000)
    expect(generalTextarea.value).not.toContain('DANGER')

    resolveGetUser({ data: { user: null }, error: null })
    await waitFor(() => expect(generalTextarea).not.toBeDisabled())

    confirmSpy.mockRestore()
  })

  // Regression for the P2 cancellation-note defect: "Edit your comments to remove the gap" was
  // advice that could not work, because an edit deliberately carries the truncation count forward
  // (see handleCommentChange) rather than clearing it -- following that instruction reproduces
  // the exact same confirmation dialog. The Dismiss control is the only non-submit way to clear a
  // record.
  it('tells the reviewer to restore the text or use Dismiss, not to edit the comment', async () => {
    const lookup = buildLookup({ data: null, error: null })
    mockFrom.mockReturnValue({ select: lookup.select, insert: mockInsert, update: mockUpdate })
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false)

    render(<TWGReviewPortal finalDraftContent={'## Section A\nbody'} />)
    fireEvent.change(
      screen.getByPlaceholderText(/Overall thoughts on the methodology\.\.\./i),
      { target: { value: 'x'.repeat(5010) } }
    )
    fireEvent.click(screen.getByRole('button', { name: /Submit Review/i }))

    const status = await screen.findByRole('status')
    expect(status.textContent).toMatch(/Dismiss/)
    expect(status.textContent).not.toMatch(/Edit your comments to remove the gap/i)
    expect(status.textContent).not.toMatch(/editing (the field|your comments?) will remove/i)

    confirmSpy.mockRestore()
  })

  // Regression set for the legacy-draft / unknown-provenance defect (P1). A draft saved by the
  // pre-provenance build has NO companion truncation key at all -- that build never wrote one --
  // so a restored value that lands exactly on MAX_CHARS is indistinguishable, by string shape
  // alone, from an untouched full-length comment. Treating a missing companion as "no known
  // loss" lets a silently-clipped comment through the submit gate unwarned.
  it('flags a legacy draft (at MAX_CHARS, no truncation key at all) as unknown provenance and gates submit', async () => {
    const lookup = buildLookup({ data: null, error: null })
    mockFrom.mockReturnValue({ select: lookup.select, insert: mockInsert, update: mockUpdate })
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false)

    // Pre-provenance build: draft key present, truncation key ABSENT ENTIRELY (never written).
    window.localStorage.setItem(
      'twg-matrix-review-draft-v6',
      JSON.stringify({ general: 'x'.repeat(5000) })
    )
    expect(window.localStorage.getItem('twg-matrix-review-draft-v6-truncation')).toBeNull()

    render(<TWGReviewPortal finalDraftContent={'## Section A\nbody'} />)

    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toMatch(/unknown/i)
    expect(alert.textContent).toMatch(/earlier version/i)

    fireEvent.click(screen.getByRole('button', { name: /Submit Review/i }))
    await waitFor(() => expect(confirmSpy).toHaveBeenCalledTimes(1))
    expect(confirmSpy.mock.calls[0][0]).toMatch(/unknown/i)
    expect(mockGetUser).not.toHaveBeenCalled()
    expect(mockInsert).not.toHaveBeenCalled()

    confirmSpy.mockRestore()
  })

  it('does NOT flag unknown provenance when an empty truncation record ({}) is present -- that is a positive "nothing lost" statement from the current build', async () => {
    const lookup = buildLookup({ data: null, error: null })
    mockFrom.mockReturnValue({ select: lookup.select, insert: mockInsert, update: mockUpdate })
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)

    window.localStorage.setItem(
      'twg-matrix-review-draft-v6',
      JSON.stringify({ general: 'x'.repeat(5000) })
    )
    // The CURRENT build wrote an empty record: it looked and found nothing to report. This must
    // not be conflated with the key being absent entirely.
    window.localStorage.setItem('twg-matrix-review-draft-v6-truncation', JSON.stringify({}))

    render(<TWGReviewPortal finalDraftContent={'## Section A\nbody'} />)

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Submit Review/i }))
    await waitFor(() => expect(mockInsert).toHaveBeenCalledTimes(1))
    expect(confirmSpy).not.toHaveBeenCalled()

    confirmSpy.mockRestore()
  })

  it('does not flag unknown provenance for a legacy draft whose values are all under MAX_CHARS', () => {
    // Nothing about a short restored value suggests clipping, even with no truncation key.
    window.localStorage.setItem(
      'twg-matrix-review-draft-v6',
      JSON.stringify({ general: 'a short comment, well under the cap' })
    )
    expect(window.localStorage.getItem('twg-matrix-review-draft-v6-truncation')).toBeNull()

    render(<TWGReviewPortal finalDraftContent={'## Section A\nbody'} />)

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('Dismiss clears an unknown-provenance notice and removes it from the submit confirmation', async () => {
    const lookup = buildLookup({ data: null, error: null })
    mockFrom.mockReturnValue({ select: lookup.select, insert: mockInsert, update: mockUpdate })
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)

    window.localStorage.setItem(
      'twg-matrix-review-draft-v6',
      JSON.stringify({ general: 'x'.repeat(5000) })
    )

    render(<TWGReviewPortal finalDraftContent={'## Section A\nbody'} />)
    expect(await screen.findByRole('alert')).toBeInTheDocument()

    fireEvent.click(
      screen.getByRole('button', { name: /Dismiss unknown-provenance notice for General Comments/i })
    )
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Submit Review/i }))
    await waitFor(() => expect(mockInsert).toHaveBeenCalledTimes(1))
    // If the dismissed unknown-provenance record were still counted, confirm would have fired.
    expect(confirmSpy).not.toHaveBeenCalled()

    confirmSpy.mockRestore()
  })
})
