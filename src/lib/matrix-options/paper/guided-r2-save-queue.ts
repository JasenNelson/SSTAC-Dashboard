/**
 * Rate-paced "Save all" queue for the Guided R2 review.
 *
 * The write RPCs refuse a user's 25th event inside a rolling 60 seconds and
 * evaluate that limit before any write, so a 429 consumes nothing. The queue
 * saves one target at a time, rebuilds the remaining list before every attempt
 * (a target that already saved is never sent again in the same run), waits once
 * for the server's Retry-After on a 429 and then resumes with only the
 * remaining targets. It stops on any conflict, closed release or other failure.
 *
 * With at most 23 targets plus Finish, one full wait always leaves enough room
 * in the next window unless another tab or device writes at the same time, so
 * a second wait is allowed and then the queue stops.
 */

export const GUIDED_SAVE_QUEUE_MAX_WAITS = 2;
export const GUIDED_SAVE_QUEUE_DEFAULT_RETRY_SECONDS = 60;
export const GUIDED_SAVE_QUEUE_RETRY_MARGIN_SECONDS = 1;

export type GuidedQueueStepOutcome =
  | { readonly kind: 'ok' }
  | { readonly kind: 'rate_limited'; readonly retryAfterSeconds?: number | null }
  | { readonly kind: 'conflict' }
  | { readonly kind: 'closed' }
  | { readonly kind: 'failed' }
  | { readonly kind: 'aborted' };

export type GuidedQueueStopReason = 'conflict' | 'closed' | 'failed' | 'rate_limited' | 'cancelled' | 'changed_during_save' | 'not_ready_to_finish';

export interface GuidedQueueProgress {
  readonly saved: number;
  readonly total: number;
  readonly remaining: number;
  readonly waitingSeconds: number | null;
}

export interface GuidedQueueResult {
  readonly status: 'saved' | 'finished' | 'stopped';
  readonly reason?: GuidedQueueStopReason;
  readonly saved: number;
  readonly total: number;
  readonly waits: number;
}

export interface GuidedQueueDeps {
  /** Current dirty, non-conflicted target keys, in display order. Called before every attempt. */
  readonly remaining: () => readonly string[];
  readonly saveOne: (key: string) => Promise<GuidedQueueStepOutcome>;
  /** Present only for "Save all and finish". Called once nothing remains to save. */
  readonly finish?: () => Promise<GuidedQueueStepOutcome>;
  /** True when Finish must not run (for example an unresolved conflict exists). */
  readonly finishBlocked?: () => boolean;
  /** Resolves true after the delay, false if the run was cancelled while waiting. */
  readonly wait: (seconds: number) => Promise<boolean>;
  readonly cancelled: () => boolean;
  readonly onProgress?: (progress: GuidedQueueProgress) => void;
}

export function guidedRetryWaitSeconds(retryAfterSeconds: number | null | undefined): number {
  const base = typeof retryAfterSeconds === 'number' && Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0
    ? Math.ceil(retryAfterSeconds) : GUIDED_SAVE_QUEUE_DEFAULT_RETRY_SECONDS;
  return base + GUIDED_SAVE_QUEUE_RETRY_MARGIN_SECONDS;
}

export async function runGuidedSaveQueue(deps: GuidedQueueDeps): Promise<GuidedQueueResult> {
  const savedKeys = new Set<string>();
  const total = deps.remaining().length;
  let waits = 0;
  const report = (waitingSeconds: number | null) => deps.onProgress?.({
    saved: savedKeys.size, total, remaining: deps.remaining().filter((key) => !savedKeys.has(key)).length, waitingSeconds,
  });
  const stop = (reason: GuidedQueueStopReason): GuidedQueueResult => ({ status: 'stopped', reason, saved: savedKeys.size, total, waits });
  // Shared by saves and Finish: one rate-limit budget per run.
  const pace = async (outcome: GuidedQueueStepOutcome & { kind: 'rate_limited' }): Promise<GuidedQueueResult | null> => {
    if (waits >= GUIDED_SAVE_QUEUE_MAX_WAITS) return stop('rate_limited');
    waits += 1;
    const seconds = guidedRetryWaitSeconds(outcome.retryAfterSeconds);
    report(seconds);
    const resumed = await deps.wait(seconds);
    if (!resumed || deps.cancelled()) return stop('cancelled');
    report(null);
    return null;
  };

  report(null);
  for (;;) {
    if (deps.cancelled()) return stop('cancelled');
    const pending = deps.remaining();
    const next = pending.find((key) => !savedKeys.has(key));
    if (next === undefined) {
      // Only targets saved earlier in this run remain: they were edited while
      // saving. Never resend them automatically; the reviewer saves again.
      if (pending.length > 0) return stop('changed_during_save');
      break;
    }
    const outcome = await deps.saveOne(next);
    if (outcome.kind === 'ok') { savedKeys.add(next); report(null); continue; }
    if (outcome.kind === 'rate_limited') { const stopped = await pace(outcome); if (stopped) return stopped; continue; }
    return stop(outcome.kind === 'aborted' ? 'cancelled' : outcome.kind);
  }

  if (!deps.finish) return { status: 'saved', saved: savedKeys.size, total, waits };
  if (deps.remaining().length > 0 || deps.finishBlocked?.()) return stop('not_ready_to_finish');
  for (;;) {
    if (deps.cancelled()) return stop('cancelled');
    const outcome = await deps.finish();
    if (outcome.kind === 'ok') return { status: 'finished', saved: savedKeys.size, total, waits };
    if (outcome.kind === 'rate_limited') { const stopped = await pace(outcome); if (stopped) return stopped; continue; }
    return stop(outcome.kind === 'aborted' ? 'cancelled' : outcome.kind);
  }
}
