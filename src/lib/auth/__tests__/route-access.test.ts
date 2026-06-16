// src/lib/auth/__tests__/route-access.test.ts
import { readFileSync } from 'fs'
import { join } from 'path'
import { describe, it, expect } from 'vitest'
import { GATED_ROUTE_PREFIXES, PUBLIC_ROUTES } from '../route-access'

// Parse matcher entries from middleware.ts so this test fails if they drift.
// Each matcher entry is like '/foo/:path*' or '/foo' -- strip the '/:path*' suffix
// to get the route prefix for comparison with GATED_ROUTE_PREFIXES.
function extractMiddlewarePrefixes(): string[] {
  const middlewarePath = join(process.cwd(), 'src', 'middleware.ts')
  const src = readFileSync(middlewarePath, 'utf8')
  // Locate the start of the matcher array (works across multiple lines without /s flag)
  const matcherIdx = src.indexOf('matcher:')
  if (matcherIdx === -1) throw new Error('Could not find matcher: in middleware.ts')
  const openBracket = src.indexOf('[', matcherIdx)
  const closeBracket = src.indexOf(']', openBracket)
  if (openBracket === -1 || closeBracket === -1) throw new Error('Could not find matcher array brackets in middleware.ts')
  const block = src.slice(openBracket + 1, closeBracket)
  // Extract single-quoted strings
  const entries: string[] = []
  const re = /'([^']+)'/g
  let m: RegExpExecArray | null
  while ((m = re.exec(block)) !== null) {
    entries.push(m[1])
  }
  // Strip /:path* suffix to get the prefix
  return entries.map(e => e.replace(/\/:path\*$/, ''))
}

describe('GATED_ROUTE_PREFIXES', () => {
  it('contains all 8 expected gated routes including demo-matrix-graph and matrix-options', () => {
    expect(GATED_ROUTE_PREFIXES).toContain('/dashboard')
    expect(GATED_ROUTE_PREFIXES).toContain('/twg')
    expect(GATED_ROUTE_PREFIXES).toContain('/survey-results')
    expect(GATED_ROUTE_PREFIXES).toContain('/cew-2025')
    expect(GATED_ROUTE_PREFIXES).toContain('/regulatory-review')
    expect(GATED_ROUTE_PREFIXES).toContain('/bn-rrm')
    expect(GATED_ROUTE_PREFIXES).toContain('/demo-matrix-graph')
    expect(GATED_ROUTE_PREFIXES).toContain('/matrix-options')
    expect(GATED_ROUTE_PREFIXES).toHaveLength(8)
  })

  it('matches the config.matcher prefixes in middleware.ts exactly', () => {
    const middlewarePrefixes = extractMiddlewarePrefixes()
    expect(GATED_ROUTE_PREFIXES.slice().sort()).toEqual(middlewarePrefixes.slice().sort())
  })
})

describe('PUBLIC_ROUTES', () => {
  it('contains cew-polls but NOT matrix-options (matrix-options gated 2026-06-15)', () => {
    expect(PUBLIC_ROUTES).toContain('/cew-polls')
    expect(PUBLIC_ROUTES).not.toContain('/matrix-options')
  })

  it('matrix-options IS in GATED_ROUTE_PREFIXES (gated 2026-06-15, owner directive)', () => {
    expect(GATED_ROUTE_PREFIXES).toContain('/matrix-options')
  })

  it('cew-polls is NOT in GATED_ROUTE_PREFIXES', () => {
    expect(GATED_ROUTE_PREFIXES).not.toContain('/cew-polls')
  })
})

describe('GATED_ROUTE_PREFIXES and PUBLIC_ROUTES', () => {
  it('do not overlap', () => {
    const overlap = GATED_ROUTE_PREFIXES.filter(r => PUBLIC_ROUTES.includes(r))
    expect(overlap).toHaveLength(0)
  })
})
