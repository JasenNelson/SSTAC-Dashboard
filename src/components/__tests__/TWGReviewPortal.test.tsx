import { describe, it, expect, vi, beforeEach } from 'vitest'
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
  const mockUpsert = vi.fn()
  const mockFrom = vi.fn()
  const mockGetSession = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    
    mockUpsert.mockResolvedValue({ error: null })
    mockFrom.mockReturnValue({ upsert: mockUpsert })
    mockGetSession.mockResolvedValue({
      data: { session: { user: { id: 'test-user-123' } } }
    })
    
    // Typecast since it's mocked
    ;(createClient as any).mockReturnValue({
      auth: {
        getSession: mockGetSession
      },
      from: mockFrom
    })
    
    // Mock alert to prevent test output noise
    vi.spyOn(window, 'alert').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('submits review payload correctly when authenticated', async () => {
    const finalDraftContent = `
## Executive Summary
This is the summary.
## Technical Methodology
Here is the methodology.
    `
    
    render(<TWGReviewPortal finalDraftContent={finalDraftContent} />)
    
    // Fill in general comment
    const generalTextarea = screen.getByPlaceholderText(/Overall thoughts on the methodology\.\.\./i)
    fireEvent.change(generalTextarea, { target: { value: 'Looks great overall.' } })
    
    // Fill in section specific comment
    const execTextarea = screen.getByPlaceholderText(/Specific feedback for Executive Summary\.\.\./i)
    fireEvent.change(execTextarea, { target: { value: 'Summary is clear.' } })

    // Click submit
    const submitButton = screen.getByRole('button', { name: /Submit Review/i })
    fireEvent.click(submitButton)

    // Wait for the async Supabase call
    await waitFor(() => {
      expect(mockGetSession).toHaveBeenCalled()
      expect(mockFrom).toHaveBeenCalledWith('matrix_reviews')
      expect(mockUpsert).toHaveBeenCalledTimes(1)
    })

    // Assert the payload shape
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'test-user-123',
        status: 'SUBMITTED',
        comments_data: {
          'General': 'Looks great overall.',
          'Executive Summary': 'Summary is clear.',
        }
      })
    )

    // Verify UI change to success screen
    expect(await screen.findByText('Review Submitted')).toBeInTheDocument()
  })
})
