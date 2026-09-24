/*
 * Reader width preference (owner-approved). It sets the paper reading frame's
 * maximum width (globals.css): "comfortable" (default, about 80rem) or "wide"
 * (about 96rem). Below that maximum the frame is fluid, so it follows the width
 * the side panels leave; body text fills the frame. It never fixes a viewport
 * layout.
 * Stored per device; unavailable storage falls back to the default.
 */
export type ReaderWidth = 'comfortable' | 'wide';

export const READER_WIDTH_STORAGE_KEY = 'mtwg-paper-reader-width-v1';
export const DEFAULT_READER_WIDTH: ReaderWidth = 'comfortable';

export function isReaderWidth(value: unknown): value is ReaderWidth {
  return value === 'comfortable' || value === 'wide';
}

export function readReaderWidth(): ReaderWidth {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return DEFAULT_READER_WIDTH;
    const stored = window.localStorage.getItem(READER_WIDTH_STORAGE_KEY);
    return isReaderWidth(stored) ? stored : DEFAULT_READER_WIDTH;
  } catch {
    return DEFAULT_READER_WIDTH;
  }
}

/** Returns false when the preference could not be stored (it still applies to this page). */
export function writeReaderWidth(value: ReaderWidth): boolean {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return false;
    window.localStorage.setItem(READER_WIDTH_STORAGE_KEY, value);
    return true;
  } catch {
    return false;
  }
}
