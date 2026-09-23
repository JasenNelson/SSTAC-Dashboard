/*
 * Working Draft print orchestration (pure, framework-free).
 *
 * The Working Draft streams its depth-1 sections in on demand, so a print of
 * the page as it stands would omit every section not yet loaded. Print is
 * therefore one action: load whatever is missing, wait until it has rendered,
 * then open the browser print dialog exactly once.
 *
 *   idle --request--> loading (sections missing) --all loaded--> rendering
 *   idle --request--> rendering (already complete)
 *   rendering --frames settled, dialog opened and returned--> idle
 *   loading --loader drained with failures--> failed --request--> loading
 *
 * A request while loading or rendering is ignored, so repeated
 * clicks can never queue a second load or a second print dialog. `started`
 * records that the loader has been SEEN working for this request, so a stale
 * snapshot from before the request (not loading, old failures) cannot fail it.
 */

export type PrintPhase = 'idle' | 'loading' | 'rendering' | 'failed';

export interface PrintState {
  readonly phase: PrintPhase;
  readonly started: boolean;
}

export interface PrintLoaderView {
  readonly complete: boolean;
  readonly loadingAll: boolean;
  /** Any section queued or in flight. */
  readonly pending: boolean;
  readonly failedCount: number;
}

export const INITIAL_PRINT_STATE: PrintState = Object.freeze({ phase: 'idle', started: false });

export function isPrintBusy(state: PrintState): boolean {
  return state.phase === 'loading' || state.phase === 'rendering';
}

/** A Print activation. `shouldLoadAll` tells the caller to start the loader. */
export function requestPrint(state: PrintState, loader: PrintLoaderView): { readonly state: PrintState; readonly shouldLoadAll: boolean } {
  if (isPrintBusy(state)) return { state, shouldLoadAll: false };
  if (loader.complete) return { state: { phase: 'rendering', started: true }, shouldLoadAll: false };
  return { state: { phase: 'loading', started: loader.loadingAll || loader.pending }, shouldLoadAll: true };
}

/** Advances a loading request from the latest loader snapshot. */
export function advancePrint(state: PrintState, loader: PrintLoaderView): PrintState {
  // A failure notice clears once the sections recover (a section Retry or
  // "Load entire paper"), so it never reports "0 sections could not be loaded".
  if (state.phase === 'failed') return loader.complete || loader.failedCount === 0 ? INITIAL_PRINT_STATE : state;
  if (state.phase !== 'loading') return state;
  if (loader.complete) return { phase: 'rendering', started: true };
  const working = loader.loadingAll || loader.pending;
  if (working) return state.started ? state : { phase: 'loading', started: true };
  if (state.started && loader.failedCount > 0) return { phase: 'failed', started: true };
  return state;
}

export function cancelPrint(state: PrintState): PrintState {
  return state.phase === 'loading' || state.phase === 'failed' ? INITIAL_PRINT_STATE : state;
}

export function printStatusMessage(state: PrintState, loaded: number, total: number, failedCount: number): string | null {
  switch (state.phase) {
    case 'loading': return `Preparing the full paper for printing: ${loaded} of ${total} sections loaded.`;
    case 'rendering': return 'All sections loaded. Opening the print dialog.';
    case 'failed': return `${failedCount} ${failedCount === 1 ? 'section' : 'sections'} could not be loaded, so printing was stopped. Nothing has been printed.`;
    case 'idle': return null;
  }
}
