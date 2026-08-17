import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
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

  it('resets the truncation count on a REPLACEMENT instead of adding to stale content that no longer exists', async () => {
    // FIX 1: pasting 6100 chars (drops 1100) then SELECT-ALL and pasting a revised 6000 chars
    // (drops 1000) must report 1000, not 2100 -- the first 1100 belonged to content that was
    // entirely discarded, not to characters still missing from the CURRENT text.
    render(<TWGReviewPortal finalDraftContent={'## Section A\nbody'} />)
    const ta = screen.getByPlaceholderText(/Overall thoughts on the methodology\.\.\./i)

    fireEvent.change(ta, { target: { value: 'a'.repeat(6100) } })   // drops 1100; stored = a*5000
    expect((await screen.findByRole('alert')).textContent).toMatch(/1,100 characters were removed/)

    // Replacement: 'b'.repeat(6000) does NOT start with the stored 'a'.repeat(5000) -- this is a
    // different piece of text, not a continuation.
    fireEvent.change(ta, { target: { value: 'b'.repeat(6000) } })   // drops 1000 of the NEW text
    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toMatch(/1,000 characters were removed/)
    expect(alert.textContent).not.toMatch(/2,100 characters were removed/)
  })

  it('clears the truncation warning when a replacement fits under the limit (FIX 2)', async () => {
    // A reviewer who deletes an overflowing field and rewrites it short must not keep seeing a
    // stale warning for text that no longer exists.
    render(<TWGReviewPortal finalDraftContent={'## Section A\nbody'} />)
    const ta = screen.getByPlaceholderText(/Overall thoughts on the methodology\.\.\./i)

    fireEvent.change(ta, { target: { value: 'x'.repeat(6000) } })   // drops 1000
    expect((await screen.findByRole('alert')).textContent).toMatch(/1,000 characters were removed/)

    fireEvent.change(ta, { target: { value: 'short rewrite' } })    // unrelated, fits comfortably
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
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
    window.localStorage.setItem(
      'twg-matrix-review-draft-v6',
      JSON.stringify({ general: 'x'.repeat(5000) })
    )

    render(<TWGReviewPortal finalDraftContent={'## Section A\nbody'} />)

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    const generalTextarea = screen.getByPlaceholderText(
      /Overall thoughts on the methodology\.\.\./i
    ) as HTMLTextAreaElement
    expect(generalTextarea.value).toHaveLength(5000)
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

  it('reports draft-saved-but-provenance-failed distinctly, without losing the saved draft (FIX 5)', () => {
    // A single shared try around both localStorage writes would report the generic "Unable to
    // save draft locally" message even when the draft write itself succeeded and only the
    // truncation-provenance write failed -- misinforming the reviewer AND leaving a persisted
    // draft with stale/absent provenance.
    render(<TWGReviewPortal finalDraftContent={'## Section A\nbody'} />)
    fireEvent.change(
      screen.getByPlaceholderText(/Overall thoughts on the methodology\.\.\./i),
      { target: { value: 'hello there' } }
    )

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

    // The draft write must have actually happened before the second write threw.
    expect(window.localStorage.getItem('twg-matrix-review-draft-v6')).toContain('hello there')
    expect(alertSpy).toHaveBeenCalledWith(expect.stringMatching(/draft.*saved/i))
    expect(alertSpy).toHaveBeenCalledWith(expect.stringMatching(/truncation|provenance/i))
    // The generic single-try message must NOT be the one shown here.
    expect(alertSpy).not.toHaveBeenCalledWith(expect.stringMatching(/^unable to save draft/i))

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

  it('still clears the truncation warning when a clip is followed by a select-all replacement with short unrelated text', async () => {
    // The other side of the prefix-in-either-direction fix: neither string is a prefix of the
    // other here, so this must remain a REPLACEMENT, not same-lineage, and the stale count must
    // not survive it.
    render(<TWGReviewPortal finalDraftContent={'## Section A\nbody'} />)
    const ta = screen.getByPlaceholderText(/Overall thoughts on the methodology\.\.\./i)

    fireEvent.change(ta, { target: { value: 'x'.repeat(6000) } })   // drops 1000; stored = x*5000
    expect((await screen.findByRole('alert')).textContent).toMatch(/1,000 characters were removed/)

    fireEvent.change(ta, { target: { value: 'short unrelated text' } })
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
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
})
