/**
 * Shared viewport helper for the paper workspace. At lg and up the document
 * column is the scrollport (`lg:overflow-y-auto`); below lg the page scrolls.
 * Kept in its own module so the client section window and the workspace read the
 * same rule without importing each other.
 */
export const PAPER_LG_MEDIA_QUERY = '(min-width: 1024px)';

export function isLgViewport(): boolean {
  try {
    return typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia(PAPER_LG_MEDIA_QUERY).matches;
  } catch {
    return false;
  }
}
