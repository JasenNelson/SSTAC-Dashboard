import { describe, expect, it } from 'vitest';

import { guidedRetryAfterSeconds } from '../guided-r2-transport';
import { GUIDED_SAVE_QUEUE_MAX_WAITS, guidedRetryWaitSeconds, runGuidedSaveQueue, type GuidedQueueStepOutcome } from '../guided-r2-save-queue';

/**
 * Faithful fake of the RPC rate rule (migration 20261118000001, lines ~302/371):
 * a call is refused when the user already has >= 24 events whose occurred_at is
 * within the last minute; a refused call records no event.
 */
function rollingWindow(nowRef: { t: number }, priorEventTimes: number[] = []) {
  const events = [...priorEventTimes];
  return {
    events,
    attempt(): GuidedQueueStepOutcome {
      const recent = events.filter((at) => at >= nowRef.t - 60_000).length;
      if (recent >= 24) return { kind: 'rate_limited', retryAfterSeconds: 60 };
      events.push(nowRef.t);
      return { kind: 'ok' };
    },
  };
}

function harness(options: { targets: number; prior?: number[]; conflictAt?: number; alwaysLimited?: boolean; cancelDuringWait?: boolean }) {
  const now = { t: 1_000_000 };
  const window = rollingWindow(now, options.prior ?? []);
  const dirty = new Set(Array.from({ length: options.targets }, (_, index) => `t${index + 1}`));
  const saveCalls: string[] = [];
  const successes = new Map<string, number>();
  const waits: number[] = [];
  let finishCalls = 0;
  let cancelled = false;
  const deps = {
    remaining: () => Array.from(dirty).sort((a, b) => Number(a.slice(1)) - Number(b.slice(1))),
    saveOne: async (key: string): Promise<GuidedQueueStepOutcome> => {
      saveCalls.push(key);
      now.t += 50;
      if (options.conflictAt !== undefined && key === `t${options.conflictAt}`) return { kind: 'conflict' };
      if (options.alwaysLimited) return { kind: 'rate_limited', retryAfterSeconds: 60 };
      const outcome = window.attempt();
      if (outcome.kind === 'ok') { dirty.delete(key); successes.set(key, (successes.get(key) ?? 0) + 1); }
      return outcome;
    },
    finish: async (): Promise<GuidedQueueStepOutcome> => {
      finishCalls += 1;
      now.t += 50;
      return options.alwaysLimited ? { kind: 'rate_limited', retryAfterSeconds: 60 } : window.attempt();
    },
    wait: async (seconds: number) => {
      waits.push(seconds);
      if (options.cancelDuringWait) { cancelled = true; return false; }
      now.t += seconds * 1000;
      return true;
    },
    cancelled: () => cancelled,
  };
  return { deps, window, dirty, saveCalls, successes, waits, finishCalls: () => finishCalls };
}

describe('guided R2 save-all queue (rate-paced)', () => {
  it('saves all 23 targets and finishes with no wait when no prior events exist (24 events = full allowance)', async () => {
    const h = harness({ targets: 23 });
    const result = await runGuidedSaveQueue(h.deps);
    expect(result).toMatchObject({ status: 'finished', saved: 23, total: 23, waits: 0 });
    expect(h.saveCalls).toHaveLength(23);
    expect(h.finishCalls()).toBe(1);
    expect(h.waits).toEqual([]);
    expect(h.window.events).toHaveLength(24);
  });

  it('after 3 recent manual saves, waits exactly once and saves each target exactly once before Finish', async () => {
    const h = harness({ targets: 23, prior: [999_000, 999_500, 999_900] });
    const result = await runGuidedSaveQueue(h.deps);
    expect(result).toMatchObject({ status: 'finished', saved: 23, total: 23, waits: 1 });
    expect(h.waits).toEqual([61]);
    expect(h.finishCalls()).toBe(1);
    // Every target succeeded exactly once: no duplicate save after the wait.
    expect(Array.from(h.successes.values()).every((count) => count === 1)).toBe(true);
    expect(h.successes.size).toBe(23);
    // 3 prior + 23 saves + 1 Finish, and no event recorded for the refused attempt.
    expect(h.window.events).toHaveLength(27);
    // The one refused attempt is the only repeated call, and it was to a target that had not saved yet.
    expect(h.saveCalls).toHaveLength(24);
  });

  it('stops at a conflict, keeps the rest dirty, and never calls Finish', async () => {
    const h = harness({ targets: 23, conflictAt: 7 });
    const result = await runGuidedSaveQueue(h.deps);
    expect(result).toMatchObject({ status: 'stopped', reason: 'conflict', saved: 6 });
    expect(h.dirty.size).toBe(17);
    expect(h.finishCalls()).toBe(0);
  });

  it('stops after the maximum number of waits when the limit persists, leaving work dirty', async () => {
    const h = harness({ targets: 5, alwaysLimited: true });
    const result = await runGuidedSaveQueue(h.deps);
    expect(result).toMatchObject({ status: 'stopped', reason: 'rate_limited', saved: 0, waits: GUIDED_SAVE_QUEUE_MAX_WAITS });
    expect(h.dirty.size).toBe(5);
    expect(h.finishCalls()).toBe(0);
  });

  it('makes no further calls after cancel during a wait', async () => {
    const h = harness({ targets: 23, prior: Array.from({ length: 10 }, (_, index) => 999_000 + index), cancelDuringWait: true });
    const result = await runGuidedSaveQueue(h.deps);
    expect(result).toMatchObject({ status: 'stopped', reason: 'cancelled' });
    const callsAtCancel = h.saveCalls.length;
    expect(h.waits).toHaveLength(1);
    expect(h.saveCalls).toHaveLength(callsAtCancel);
    expect(h.finishCalls()).toBe(0);
  });

  it('never resends a target edited during its own save; stops instead', async () => {
    const dirty = new Set(['a', 'b']);
    const calls: string[] = [];
    const result = await runGuidedSaveQueue({
      remaining: () => Array.from(dirty),
      saveOne: async (key) => {
        calls.push(key);
        if (calls.length > 5) throw new Error('a saved target was resent');
        if (key === 'b') dirty.delete('b');
        return { kind: 'ok' };
      },
      wait: async () => true,
      cancelled: () => false,
    });
    // 'a' saved but stayed dirty (edited during save): it is not sent twice.
    expect(calls).toEqual(['a', 'b']);
    expect(result).toMatchObject({ status: 'stopped', reason: 'changed_during_save', saved: 2 });
  });

  it('refuses Finish while a conflict blocks it, and saves without finishing when no finish step is given', async () => {
    const blocked = await runGuidedSaveQueue({ remaining: () => [], saveOne: async () => ({ kind: 'ok' }), finish: async () => ({ kind: 'ok' }), finishBlocked: () => true, wait: async () => true, cancelled: () => false });
    expect(blocked).toMatchObject({ status: 'stopped', reason: 'not_ready_to_finish' });
    const saveOnly = await runGuidedSaveQueue({ remaining: () => [], saveOne: async () => ({ kind: 'ok' }), wait: async () => true, cancelled: () => false });
    expect(saveOnly).toMatchObject({ status: 'saved', saved: 0 });
  });

  it('uses Retry-After plus a one-second margin, defaulting to 60 seconds', () => {
    expect(guidedRetryWaitSeconds(60)).toBe(61);
    expect(guidedRetryWaitSeconds(12.2)).toBe(14);
    expect(guidedRetryWaitSeconds(null)).toBe(61);
    expect(guidedRetryWaitSeconds(0)).toBe(61);
  });

  it('reads only delta-seconds Retry-After values from the transport', () => {
    expect(guidedRetryAfterSeconds('60')).toBe(60);
    expect(guidedRetryAfterSeconds(' 5 ')).toBe(5);
    expect(guidedRetryAfterSeconds('0')).toBeUndefined();
    expect(guidedRetryAfterSeconds('Wed, 21 Oct 2015 07:28:00 GMT')).toBeUndefined();
    expect(guidedRetryAfterSeconds(null)).toBeUndefined();
  });
});
