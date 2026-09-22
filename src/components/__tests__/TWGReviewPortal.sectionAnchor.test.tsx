import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import TWGReviewPortal from '../TWGReviewPortal'
import { createClient } from '@/lib/supabase/client'

// Unlike TWGReviewPortal.test.tsx, MathRenderer is NOT mocked here: this file
// asserts on what the real ReactMarkdown display boundary renders.
vi.mock('@/lib/supabase/client', () => ({
  createClient: vi.fn(),
}))

const EXACT_MARKER = '<div id="sec-alpha" class="section-anchor"></div>'
const INDENTED_MARKER = '  <div id="sec-beta" class="section-anchor"></div>  '
const INLINE_NEAR_MISS = 'Inline text <div id="sec-inline" class="section-anchor"></div>'
const KEEP_DIV = '<div id="keep">kept html</div>'
const SPAN_NEAR_MISS = '<span class="section-anchor"></span>'
const BODY_NEAR_MISS = '<div id="sec-body" class="section-anchor">body</div>'
const CLASS_FIRST_NEAR_MISS = '<div class="section-anchor" id="sec-order"></div>'

const CONTENT = [
  EXACT_MARKER,
  '',
  '# Real Paper Heading',
  '',
  'Opening paragraph of the paper.',
  '',
  INDENTED_MARKER,
  '## Second Section',
  '',
  INLINE_NEAR_MISS,
  '',
  KEEP_DIV,
  '',
  SPAN_NEAR_MISS,
  '',
  BODY_NEAR_MISS,
  '',
  CLASS_FIRST_NEAR_MISS,
  '',
  'Closing paragraph.',
].join('\n')

describe('TWGReviewPortal section-anchor display boundary', () => {
  beforeEach(() => {
    cleanup()
    vi.clearAllMocks()
    window.localStorage.clear()
    ;(createClient as unknown as Mock).mockReturnValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'test-user-123' } }, error: null }),
      },
      from: vi.fn(),
    })
  })

  it('removes exact standalone section-anchor marker lines and keeps near-miss HTML visible as literal content', () => {
    const { container } = render(
      <TWGReviewPortal finalDraftContent={CONTENT} showLeftPanel={false} showRightPanel={false} />,
    )

    const renderer = container.querySelector('.math-renderer')
    expect(renderer).not.toBeNull()
    const text = renderer?.textContent ?? ''

    // Exact standalone markers never reach the rendered output.
    expect(text).not.toContain('sec-alpha')
    expect(text).not.toContain('sec-beta')

    // Real headings and content remain visible.
    const headings = Array.from(renderer?.querySelectorAll('h1, h2') ?? []).map(
      (heading) => (heading.textContent ?? '').trim(),
    )
    expect(headings).toEqual(['Real Paper Heading', 'Second Section'])
    expect(text).toContain('Opening paragraph of the paper.')
    expect(text).toContain('Closing paragraph.')

    // Near-miss lines are not stripped: they stay as inert literal text.
    expect(text).toContain(INLINE_NEAR_MISS)
    expect(text).toContain(KEEP_DIV)
    expect(text).toContain(SPAN_NEAR_MISS)
    expect(text).toContain(BODY_NEAR_MISS)
    expect(text).toContain(CLASS_FIRST_NEAR_MISS)

    // Raw HTML stays disabled: no element was created from the markup.
    expect(renderer?.querySelector('#keep, #sec-inline, #sec-body, #sec-order, .section-anchor')).toBeNull()
  })
})
