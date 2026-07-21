import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
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
})
