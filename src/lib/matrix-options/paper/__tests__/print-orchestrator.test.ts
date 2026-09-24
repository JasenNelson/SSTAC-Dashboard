import { describe, expect, it } from 'vitest';

import { advancePrint, cancelPrint, INITIAL_PRINT_STATE, isPrintBusy, printStatusMessage, requestPrint } from '../print-orchestrator';
import type { PrintLoaderView } from '../print-orchestrator';

const view = (patch: Partial<PrintLoaderView> = {}): PrintLoaderView => ({ complete: false, loadingAll: false, pending: false, failedCount: 0, ...patch });

describe('print orchestrator', () => {
  it('incomplete document: a request starts one full load and does not print yet', () => {
    const { state, shouldLoadAll } = requestPrint(INITIAL_PRINT_STATE, view());
    expect(state.phase).toBe('loading');
    expect(shouldLoadAll).toBe(true);
  });

  it('complete document: a request goes straight to rendering with no load', () => {
    const { state, shouldLoadAll } = requestPrint(INITIAL_PRINT_STATE, view({ complete: true }));
    expect(state.phase).toBe('rendering');
    expect(shouldLoadAll).toBe(false);
  });

  it('repeated clicks while loading or rendering never start a second load or print', () => {
    const loading = requestPrint(INITIAL_PRINT_STATE, view()).state;
    const again = requestPrint(loading, view({ loadingAll: true, pending: true }));
    expect(again.state).toBe(loading);
    expect(again.shouldLoadAll).toBe(false);
    const rendering = requestPrint(INITIAL_PRINT_STATE, view({ complete: true })).state;
    expect(requestPrint(rendering, view({ complete: true })).state).toBe(rendering);
    expect(isPrintBusy(loading) && isPrintBusy(rendering)).toBe(true);
  });

  it('loading -> rendering only once every section is loaded', () => {
    let state = requestPrint(INITIAL_PRINT_STATE, view()).state;
    state = advancePrint(state, view({ loadingAll: true, pending: true }));
    expect(state.phase).toBe('loading');
    state = advancePrint(state, view({ complete: true }));
    expect(state.phase).toBe('rendering');
  });

  it('failure: a drained loader with failures fails the request only after it was seen working', () => {
    let state = requestPrint(INITIAL_PRINT_STATE, view({ failedCount: 2 })).state;
    // A stale pre-request snapshot (idle, old failures) must not fail it.
    expect(advancePrint(state, view({ failedCount: 2 })).phase).toBe('loading');
    state = advancePrint(state, view({ loadingAll: true, pending: true }));
    state = advancePrint(state, view({ failedCount: 1 }));
    expect(state.phase).toBe('failed');
    expect(printStatusMessage(state, 17, 18, 1)).toBe('1 section could not be loaded, so printing was stopped. Nothing has been printed.');
    // Retry from failed starts a new load.
    const retry = requestPrint(state, view({ failedCount: 1 }));
    expect(retry.state.phase).toBe('loading');
    expect(retry.shouldLoadAll).toBe(true);
  });

  it('cancel returns a loading or failed request to idle but never interrupts rendering', () => {
    const loading = requestPrint(INITIAL_PRINT_STATE, view()).state;
    expect(cancelPrint(loading)).toEqual(INITIAL_PRINT_STATE);
    const rendering = requestPrint(INITIAL_PRINT_STATE, view({ complete: true })).state;
    expect(cancelPrint(rendering)).toBe(rendering);
  });

  it('announces loading progress with counts', () => {
    const loading = requestPrint(INITIAL_PRINT_STATE, view()).state;
    expect(printStatusMessage(loading, 5, 18, 0)).toBe('Preparing the full paper for printing: 5 of 18 sections loaded.');
    expect(printStatusMessage(INITIAL_PRINT_STATE, 5, 18, 0)).toBeNull();
  });

  it('a failure notice clears once the sections recover, never reporting "0 sections could not be loaded"', () => {
    let state = requestPrint(INITIAL_PRINT_STATE, view()).state;
    state = advancePrint(state, view({ loadingAll: true, pending: true }));
    state = advancePrint(state, view({ failedCount: 1 }));
    expect(state.phase).toBe('failed');
    // Still failed while a section is still in error.
    expect(advancePrint(state, view({ failedCount: 1, loadingAll: true, pending: true })).phase).toBe('failed');
    // A retry that re-queued every failed section clears the notice at once.
    expect(advancePrint(state, view({ failedCount: 0, loadingAll: true, pending: true }))).toEqual(INITIAL_PRINT_STATE);
    // Two-sided: recovered -> idle (previously stuck on failed forever).
    expect(advancePrint(state, view({ failedCount: 0 }))).toEqual(INITIAL_PRINT_STATE);
    expect(advancePrint(state, view({ complete: true }))).toEqual(INITIAL_PRINT_STATE);
  });
});
