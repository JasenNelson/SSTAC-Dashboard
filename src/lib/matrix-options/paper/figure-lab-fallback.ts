import type { FigureRegisterRow } from '@/lib/matrix-options/paper/figure-register';

/**
 * What the figure lab shows in place of a figure when labFigureFor finds none for a row (P2-3
 * fix). A candidate-prototype-nonfinal row never had a paper/layout figure bound to begin with,
 * so saying its "bound source text was not found" misreads as a drift failure on exactly the rows
 * under Matrix MC review; a genuinely missing restored/layout figure keeps the live announcement.
 *
 * Lives outside app/.../page.tsx (round-2 P1 fix): a Next.js App Router page file may export only
 * the page-export fields Next's build-time type check allows (default, dynamic, metadata, ...);
 * any other named export fails `next build`'s generated .next/types page-export check even though
 * tsc and vitest stay green in a worktree where .next/types has never been generated. See
 * figure-lab/__tests__/page.test.tsx's "page.tsx exports exactly ['default','dynamic']" test.
 */
export function notDrawnFallback(row: FigureRegisterRow): { readonly text: string; readonly live: boolean } {
  return row.implementation === 'candidate-prototype-nonfinal'
    ? { text: 'No current-paper figure at this placement; the Matrix MC content candidate is shown below.', live: false }
    : { text: 'Not drawn: the bound source text was not found in the current paper.', live: true };
}
