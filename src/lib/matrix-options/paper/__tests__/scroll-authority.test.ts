/*
 * Direct transition-table tests for the paper scroll authority
 * (AMENDMENT-M1-SCROLL-AUTHORITY-001; SCROLL_SURFACE_INVENTORY section 3).
 *
 * No React tree, no mocked window.scrollBy and no fake requestAnimationFrame:
 * the authority takes its platform primitives as an injected environment, so
 * each row of the transition table (event source x state change) is driven and
 * read directly. Every test carries its positive control in the same test.
 */
import { afterEach, describe, expect, it } from 'vitest';

import {
  activationSupersedes,
  PAPER_LANDING_MAX_ATTEMPTS,
  PAPER_OBSERVED_ACTIVATIONS,
  PAPER_PIN_RELEASING_ACTIVATIONS,
  PAPER_REVEAL_SETTLE_MAX_FRAMES,
  PaperScrollAuthority,
  requestSupersedes,
  revealIsEntitled,
} from '../scroll-authority';
import type { PaperLandingMeasurement, PaperRevealCause, PaperRevealSequence, PaperScrollEnvironment } from '../scroll-authority';

function fakeEnvironment() {
  const frames: (() => void)[] = [];
  const timers = new Map<number, () => void>();
  let nextTimer = 1;
  let hidden = false;
  const pageScrolls: number[] = [];
  const intoView: Element[] = [];
  const environment: PaperScrollEnvironment = {
    afterLayout: (run) => { frames.push(() => { frames.push(run); }); },
    nextFrame: (run) => { frames.push(run); },
    setTimer: (run) => {
      const id = nextTimer;
      nextTimer += 1;
      timers.set(id, run);
      return id;
    },
    clearTimer: (handle) => { timers.delete(handle as number); },
    scrollPageBy: (top) => { pageScrolls.push(top); },
    scrollElementIntoView: (element) => { intoView.push(element); },
    documentIsHidden: () => hidden,
  };
  const runFrame = (): boolean => {
    const frame = frames.shift();
    if (frame === undefined) return false;
    frame();
    return true;
  };
  return {
    environment,
    pageScrolls,
    intoView,
    runFrame,
    /** Runs frames until none is queued; returns how many ran. */
    drain: (): number => {
      let ran = 0;
      while (ran < 10000 && runFrame()) ran += 1;
      return ran;
    },
    queued: () => frames.length,
    liveTimers: () => timers.size,
    fireTimers: () => {
      for (const [id, run] of Array.from(timers)) {
        timers.delete(id);
        run();
      }
    },
    setHidden: (value: boolean) => { hidden = value; },
  };
}

function setup(stickyHeaderHeight = 129) {
  const env = fakeEnvironment();
  const authority = new PaperScrollAuthority({ environment: env.environment, stickyHeaderHeight: () => stickyHeaderHeight });
  const target = new EventTarget();
  authority.observe(target);
  const activate = (kind: string) => { target.dispatchEvent(new Event(kind)); };
  return { env, authority, target, activate };
}

const attached: HTMLElement[] = [];
afterEach(() => {
  for (const element of attached.splice(0)) element.remove();
});

/** A heading whose top is read from `tops`, the last value repeating. */
function headingAt(tops: readonly number[]) {
  const heading = document.createElement('h2');
  heading.tabIndex = -1;
  document.body.appendChild(heading);
  attached.push(heading);
  let index = 0;
  heading.getBoundingClientRect = () => {
    const top = tops[Math.min(index, tops.length - 1)];
    index += 1;
    return { top, bottom: top + 40, left: 0, right: 100, width: 100, height: 40, x: 0, y: top, toJSON: () => ({}) } as DOMRect;
  };
  return { heading, measured: () => index };
}

/** Mints a reveal cause the way a real handler does: synchronously, inside the activation's dispatch. */
function causeDuring(target: EventTarget, authority: PaperScrollAuthority, kind: string): PaperRevealCause {
  let cause: PaperRevealCause | null = null;
  const request = () => { cause = authority.requestRevealCause(); };
  target.addEventListener(kind, request);
  target.dispatchEvent(new Event(kind));
  target.removeEventListener(kind, request);
  if (cause === null) throw new Error('no cause was minted');
  return cause;
}

function sequence(abandoned: boolean, done: boolean): PaperRevealSequence {
  return { cause: { activation: 0, request: 0 }, abandoned, done, onDeadline: () => {}, finish: () => {} };
}

describe('scroll authority: activation identity (rules 1-3)', () => {
  it('assigns one increasing id per observed activation, and none to anything else', () => {
    const { authority, activate } = setup();
    expect(authority.latestActivation()).toBe(0);
    activate('click');
    activate('wheel');
    expect(authority.latestActivation()).toBe(2);
    // Not activations: none of these may move the id (a keyup after a click must not abandon what the click opened).
    for (const kind of ['mouseup', 'keyup', 'pointerup', 'scroll', 'focus', 'resize', 'input', 'popstate']) activate(kind);
    expect(authority.latestActivation()).toBe(2);
    // CONTROL: every kind in the observed list does move it, exactly once each.
    for (const kind of PAPER_OBSERVED_ACTIVATIONS) activate(kind);
    expect(authority.latestActivation()).toBe(2 + PAPER_OBSERVED_ACTIVATIONS.length);
  });

  it('observing twice installs ONE observer, and dispose removes it', () => {
    const { authority, target, activate } = setup();
    authority.observe(target);
    // A SECOND, different target must not gain a second observer (the DOM itself
    // would dedupe an identical listener on the SAME target, so that proves nothing).
    const other = new EventTarget();
    authority.observe(other);
    other.dispatchEvent(new Event('click'));
    expect(authority.latestActivation()).toBe(0);
    activate('click');
    expect(authority.latestActivation()).toBe(1);
    expect(authority.isObserving()).toBe(true);
    authority.dispose();
    expect(authority.isObserving()).toBe(false);
    activate('click');
    expect(authority.latestActivation()).toBe(1);
    // CONTROL: observing again after dispose observes again.
    authority.observe(target);
    activate('click');
    expect(authority.latestActivation()).toBe(2);
  });

  it('the observer assigns the id in the CAPTURE phase, before any handler at the target reads it', () => {
    const { authority, target, activate } = setup();
    const readInHandler: number[] = [];
    target.addEventListener('click', () => { readInHandler.push(authority.currentActivationId()); });
    activate('click');
    activate('click');
    expect(readInHandler).toEqual([1, 2]);
    // CONTROL: outside any dispatch the current id is the latest one.
    expect(authority.currentActivationId()).toBe(2);
  });

  it('a nested dispatch that has finished does not lend its id to the handler of the event containing it', () => {
    const { authority, target, activate } = setup();
    const reads: string[] = [];
    target.addEventListener('keydown', () => { reads.push(`inner=${authority.currentActivationId()}`); });
    target.addEventListener('click', () => {
      reads.push(`outer-before=${authority.currentActivationId()}`);
      activate('keydown');
      reads.push(`outer-after=${authority.currentActivationId()}`);
    });
    activate('click');
    expect(reads).toEqual(['outer-before=1', 'inner=2', 'outer-after=1']);
    // CONTROL: once every dispatch is over, the latest id is current.
    expect(authority.currentActivationId()).toBe(2);
  });
});

describe('scroll authority: later distinct activation wins (rules 4-5)', () => {
  it('activationSupersedes is strict: only a LATER id supersedes', () => {
    const causedBy = (activation: number, request = 0): PaperRevealCause => ({ activation, request });
    expect(activationSupersedes(2, causedBy(1))).toBe(true);
    expect(activationSupersedes(1, causedBy(1))).toBe(false);
    expect(activationSupersedes(0, causedBy(1))).toBe(false);
    // requestSupersedes is lexicographic: activation first, then the programmatic ordinal.
    expect(requestSupersedes(causedBy(2), causedBy(1, 9))).toBe(true);
    expect(requestSupersedes(causedBy(1, 9), causedBy(2))).toBe(false);
    expect(requestSupersedes(causedBy(1, 2), causedBy(1, 1))).toBe(true);
    expect(requestSupersedes(causedBy(1, 1), causedBy(1, 2))).toBe(false);
    expect(requestSupersedes(causedBy(1, 1), causedBy(1, 1))).toBe(false);
    expect(requestSupersedes(causedBy(1), causedBy(1))).toBe(false);
  });

  it('every observed activation kind abandons a sequence an earlier activation caused, on observation', () => {
    for (const kind of PAPER_OBSERVED_ACTIVATIONS) {
      const { authority, target, activate } = setup();
      const live = authority.beginReveal(causeDuring(target, authority, 'click'));
      // CONTROL: before the later activation, the sequence is entitled and owns the scrollport.
      expect(revealIsEntitled(live)).toBe(true);
      expect(authority.ownsScrollport()).toBe(true);
      activate(kind);
      expect({ kind, abandoned: live.abandoned, owns: authority.ownsScrollport() }).toEqual({ kind, abandoned: true, owns: false });
    }
  });

  it('the activation that caused a sequence never abandons it, even when the claim happens during its own dispatch', () => {
    const { authority, target, activate } = setup();
    let claimed: PaperRevealSequence | null = null;
    const listener = () => {
      claimed = authority.beginReveal(authority.requestRevealCause());
    };
    target.addEventListener('click', listener);
    activate('click');
    expect(claimed).not.toBeNull();
    expect((claimed as unknown as PaperRevealSequence).abandoned).toBe(false);
    
    // CONTROL: the next distinct activation abandons it.
    activate('mousedown');
    expect((claimed as unknown as PaperRevealSequence).abandoned).toBe(true);
    target.removeEventListener('click', listener);

    // a cause requested once during dispatch and claimed after the dispatch ended is not abandoned by that same activation
    let requestedDuringDispatch: PaperRevealCause | null = null;
    target.addEventListener('click', () => {
      requestedDuringDispatch = authority.requestRevealCause();
    });
    activate('click');
    const afterDispatch = authority.beginReveal(requestedDuringDispatch as unknown as PaperRevealCause);
    expect(afterDispatch.abandoned).toBe(false);
    
    // CONTROL: the next distinct activation abandons it.
    activate('mousedown');
    expect(afterDispatch.abandoned).toBe(true);
  });

  it('claim time: a sequence whose cause precedes an activation already observed is born abandoned', () => {
    const { authority, target, activate } = setup();
    const cause = causeDuring(target, authority, 'click');
    activate('wheel');
    const born = authority.beginReveal(cause);
    expect(born.abandoned).toBe(true);
    expect(authority.ownsScrollport()).toBe(false);
    // It is still claimed and released through the single path.
    expect(authority.liveSequenceCount()).toBe(1);
    born.finish();
    expect(authority.liveSequenceCount()).toBe(0);
    // CONTROL: claimed with a cause minted now, it is entitled.
    const entitled = authority.beginReveal(authority.requestRevealCause());
    expect(entitled.abandoned).toBe(false);
    expect(authority.ownsScrollport()).toBe(true);
  });

  it('revealIsEntitled and ownsScrollport skip sequences that are abandoned or released (replaces M1R9-01 direct)', () => {
    expect(revealIsEntitled(sequence(false, false))).toBe(true);
    expect(revealIsEntitled(sequence(true, false))).toBe(false);
    expect(revealIsEntitled(sequence(false, true))).toBe(false);
    expect(revealIsEntitled(sequence(true, true))).toBe(false);
    const { authority, target } = setup();
    expect(authority.ownsScrollport()).toBe(false);
    const first = authority.beginReveal(authority.requestRevealCause());
    expect(authority.ownsScrollport()).toBe(true);
    const second = authority.beginReveal(causeDuring(target, authority, 'click'));
    // A set is not all-or-nothing: one entitled sequence still owns it.
    expect(first.abandoned).toBe(true);
    expect(authority.ownsScrollport()).toBe(true);
    second.done = true;
    expect(authority.ownsScrollport()).toBe(false);
  });

  it('abandonment revokes ownership immediately, while the scrollport is released exactly once through finish', () => {
    const { env, authority, activate } = setup();
    const live = authority.beginReveal(authority.requestRevealCause());
    expect(env.liveTimers()).toBe(1);
    activate('touchstart');
    expect(authority.ownsScrollport()).toBe(false);
    expect(authority.liveSequenceCount()).toBe(1);
    live.finish();
    live.finish();
    expect(live.done).toBe(true);
    expect(authority.liveSequenceCount()).toBe(0);
    expect(env.liveTimers()).toBe(0);
  });

  it('R11-FG2: two requests in one dispatch get distinct ordinals; earlier is abandoned; later is entitled', () => {
    const { authority, target } = setup();
    let earlyCause: PaperRevealCause | null = null;
    let lateCause: PaperRevealCause | null = null;
    target.addEventListener('click', () => {
      earlyCause = authority.requestRevealCause();
      lateCause = authority.requestRevealCause();
    });
    target.dispatchEvent(new Event('click'));
    
    // They get distinct ordinals
    expect(earlyCause!.activation).toBe(1);
    expect(lateCause!.activation).toBe(1);
    expect(earlyCause!.request).toBe(1);
    expect(lateCause!.request).toBe(2);

    // earlier becomes abandoned at claim time, later stays entitled
    const earlier = authority.beginReveal(earlyCause!);
    const later = authority.beginReveal(lateCause!);
    expect(revealIsEntitled(earlier)).toBe(false);
    expect(revealIsEntitled(later)).toBe(true);
    expect(earlier.abandoned).toBe(true);

    // ownsScrollport reflects only later
    expect(authority.ownsScrollport()).toBe(true);
    later.finish();
    expect(authority.ownsScrollport()).toBe(false);

    // three requests in one dispatch leave exactly one entitled
    target.addEventListener('mousedown', () => {
      earlyCause = authority.requestRevealCause();
      lateCause = authority.requestRevealCause();
    });
    target.addEventListener('mousedown', () => {
      const third = authority.requestRevealCause();
      const seq1 = authority.beginReveal(earlyCause!);
      const seq2 = authority.beginReveal(lateCause!);
      const seq3 = authority.beginReveal(third);
      expect(revealIsEntitled(seq1)).toBe(false);
      expect(revealIsEntitled(seq2)).toBe(false);
      expect(revealIsEntitled(seq3)).toBe(true);
    });
    target.dispatchEvent(new Event('mousedown'));

    // Later distinct activation still abandons the survivor
    target.dispatchEvent(new Event('wheel'));
    expect(authority.ownsScrollport()).toBe(false);
  });

  it('R11-FG2: distinct-activation behaviour control is byte-for-byte unchanged', () => {
    const { authority, target, activate } = setup();
    // CONTROL: the distinct-activation rule exactly as it was.
    const shared = causeDuring(target, authority, 'click');
    const sameActivationA = authority.beginReveal(shared);
    expect(revealIsEntitled(sameActivationA)).toBe(true);
    activate('mousedown');
    expect(revealIsEntitled(sameActivationA)).toBe(false);
  });

  it('R11-FG2: programmatic ordinals continue to increase across interleaved dispatch and programmatic requests', () => {
    const { authority, target } = setup();
    const firstProg = authority.requestRevealCause();
    expect(firstProg.request).toBe(1);
    const inDispatch = causeDuring(target, authority, 'click');
    expect(inDispatch.request).toBe(2);
    const secondProg = authority.requestRevealCause();
    expect(secondProg.request).toBe(3);
    expect(requestSupersedes(secondProg, inDispatch)).toBe(true);
  });

  it('R11-FG2: request-time abandonment (same dispatch): a claimed sequence is abandoned AT THE MOMENT a later request is minted', () => {
    const { authority, target, activate } = setup();
    let claimed: ReturnType<typeof authority.beginReveal> | null = null;
    let earlyCause: PaperRevealCause | null = null;
    let lateCause: PaperRevealCause | null = null;
    let beforeAbandoned: boolean | null = null;
    let beforeOwns: boolean | null = null;
    let afterAbandoned: boolean | null = null;
    let afterOwns: boolean | null = null;

    target.addEventListener('click', () => {
      earlyCause = authority.requestRevealCause();
      claimed = authority.beginReveal(earlyCause);
      beforeAbandoned = claimed.abandoned;
      beforeOwns = authority.ownsScrollport();
      // Mint a later request in the same dispatch
      lateCause = authority.requestRevealCause();
      // MUST be abandoned immediately, before we even claim the later cause
      afterAbandoned = claimed.abandoned;
      afterOwns = authority.ownsScrollport();
    });
    activate('click');

    expect(authority.latestActivation()).toBeGreaterThan(0);
    expect(earlyCause!.activation).toBe(lateCause!.activation);
    expect(lateCause!.request).toBeGreaterThan(earlyCause!.request);
    expect(beforeAbandoned).toBe(false);
    expect(beforeOwns).toBe(true);
    expect(afterAbandoned).toBe(true);
    expect(afterOwns).toBe(false);
  });

  it('R11-FG2: request-time abandonment (programmatic): a claimed sequence is abandoned AT THE MOMENT a later programmatic request is minted', () => {
    const { authority } = setup();
    const earlyCause = authority.requestRevealCause();
    const claimed = authority.beginReveal(earlyCause);
    expect(claimed.abandoned).toBe(false);
    expect(authority.ownsScrollport()).toBe(true);
    // Mint a later programmatic request outside any dispatch
    authority.requestRevealCause();
    // MUST be abandoned immediately, before we even claim the later cause
    expect(claimed.abandoned).toBe(true);
    expect(authority.ownsScrollport()).toBe(false);
  });

  it('HOLISTIC_R2 F1: two reveals requested outside any activation dispatch are never both entitled', () => {
    const { authority, target } = setup();
    const first = authority.beginReveal(authority.requestRevealCause());
    expect(revealIsEntitled(first)).toBe(true);
    const second = authority.beginReveal(authority.requestRevealCause());
    expect([revealIsEntitled(first), revealIsEntitled(second)]).toEqual([false, true]);
    expect(authority.ownsScrollport()).toBe(true);
    // Their causes are distinct, and neither can equal an activation id.
    expect(first.cause.request).toBe(1);
    expect(second.cause.request).toBe(2);
    // And a later activation still supersedes a programmatic reveal.
    target.dispatchEvent(new Event('mousedown'));
    expect(revealIsEntitled(second)).toBe(false);
  });

  it('HOLISTIC_R2 F3: a cause this authority did not mint cannot fake an activation identity', () => {
    const { authority, target } = setup();
    const forged = { activation: Number.MAX_SAFE_INTEGER, request: Number.MAX_SAFE_INTEGER };
    const faked = authority.beginReveal(forged);
    // The authority derived its own cause instead of accepting the forged one.
    expect(faked.cause).not.toBe(forged);
    expect(faked.cause.activation).toBeLessThan(Number.MAX_SAFE_INTEGER);
    expect(revealIsEntitled(faked)).toBe(true);
    target.dispatchEvent(new Event('click'));
    // With the forged cause it would have outlived every activation there can be.
    expect(revealIsEntitled(faked)).toBe(false);
    // CONTROL: a properly minted cause behaves identically up to that point.
    const minted = authority.beginReveal(causeDuring(target, authority, 'click'));
    expect(revealIsEntitled(minted)).toBe(true);
    target.dispatchEvent(new Event('click'));
    expect(revealIsEntitled(minted)).toBe(false);
  });

  it('a sequence releasing frees only itself, in both orders (two sequences sharing one cause)', () => {
    for (const releaseNewerFirst of [true, false]) {
      const { authority, target } = setup();
      // ONE cause, claimed twice: the only way two sequences are both entitled.
      const shared = causeDuring(target, authority, 'click');
      const older = authority.beginReveal(shared);
      const newer = authority.beginReveal(shared);
      (releaseNewerFirst ? newer : older).finish();
      // The other one is still entitled, so the scrollport is still owned.
      expect({ releaseNewerFirst, owns: authority.ownsScrollport() }).toEqual({ releaseNewerFirst, owns: true });
      // CONTROL: once both release, nothing owns it.
      (releaseNewerFirst ? older : newer).finish();
      expect(authority.ownsScrollport()).toBe(false);
    }
  });
});

describe('scroll authority: the pin policy and pending navigation', () => {
  it('reader scroll intent and a hash navigation release the pin; click and change keep it; a panel activation releases it', () => {
    for (const kind of PAPER_OBSERVED_ACTIVATIONS) {
      const { authority, activate } = setup();
      authority.pin('methods');
      activate(kind);
      const expected = PAPER_PIN_RELEASING_ACTIVATIONS.includes(kind) ? null : 'methods';
      expect({ kind, pinned: authority.pinnedAnchor() }).toEqual({ kind, pinned: expected });
    }
    // HOLISTIC_R2 F5 added `hashchange`; `click` and `change` stay out, because a
    // "Load section" press is a click and M1R4-03 re-lands a still-pinned target.
    expect(PAPER_PIN_RELEASING_ACTIVATIONS).toEqual(['wheel', 'touchstart', 'keydown', 'mousedown', 'hashchange']);
    const { authority } = setup();
    authority.pin('methods');
    expect(authority.pinnedAnchor()).toBe('methods');
    authority.panelActivated();
    expect(authority.pinnedAnchor()).toBeNull();
  });

  it('a pending navigation is cancelled by wheel only among activations, and by an explicit cancel', () => {
    for (const kind of PAPER_OBSERVED_ACTIVATIONS) {
      const { authority, activate } = setup();
      authority.deferNavigation({ anchor: 'methods', writeUrl: true, sectionIndex: 1 });
      activate(kind);
      expect({ kind, pending: authority.pendingNavigation() !== null }).toEqual({ kind, pending: kind !== 'wheel' });
    }
    const { authority } = setup();
    authority.deferNavigation({ anchor: 'methods', writeUrl: false, sectionIndex: 1 });
    // A panel activation does NOT cancel it (browser s1-collision.identity-still-applied).
    authority.panelActivated();
    expect(authority.pendingNavigation()).toEqual({ anchor: 'methods', writeUrl: false, sectionIndex: 1 });
    authority.cancelPendingNavigation();
    expect(authority.pendingNavigation()).toBeNull();
  });
});

describe('scroll authority: arbitrated scrolls and landing checks', () => {
  const measureAt = (element: Element, actualTop: number, expectedTop = 137) => (): PaperLandingMeasurement => ({ element, actualTop, expectedTop });

  it('a navigation target scrolls only while no reveal is entitled', () => {
    const { env, authority, activate } = setup();
    const element = document.createElement('section');
    const live = authority.beginReveal(authority.requestRevealCause());
    expect(authority.scrollTargetIntoView(element)).toBe(false);
    expect(env.intoView).not.toContain(element);
    // CONTROL: abandoned (not yet released), the same request scrolls.
    activate('click');
    expect(live.done).toBe(false);
    expect(authority.scrollTargetIntoView(element)).toBe(true);
    expect(env.intoView).toContain(element);
  });

  it('a landing check asked for while a reveal is entitled is dropped and NOT re-queued when it releases (M1R6-03)', () => {
    const { env, authority } = setup();
    const element = document.createElement('section');
    authority.pin('methods');
    const live = authority.beginReveal(authority.requestRevealCause());
    authority.requestLandingCheck('methods', measureAt(element, 0));
    expect(env.queued()).toBe(0);
    live.finish();
    env.drain();
    expect(env.intoView).not.toContain(element);
    // CONTROL: the identical request with the scrollport free corrects.
    authority.requestLandingCheck('methods', measureAt(element, 0));
    env.drain();
    expect(env.intoView).toContain(element);
  });

  it('a landing check already in flight stands down when a reveal claims before it measures', () => {
    const { env, authority } = setup();
    const element = document.createElement('section');
    authority.pin('methods');
    authority.requestLandingCheck('methods', measureAt(element, 0));
    expect(env.queued()).toBe(1);
    authority.beginReveal(authority.requestRevealCause());
    env.drain();
    expect(env.intoView).not.toContain(element);
    // CONTROL: in flight with nothing claiming, it corrects.
    const free = setup();
    free.authority.pin('methods');
    free.authority.requestLandingCheck('methods', measureAt(element, 0));
    free.env.drain();
    expect(free.env.intoView).toContain(element);
  });

  it('a landing check corrects only the PINNED target, only beyond tolerance, at most PAPER_LANDING_MAX_ATTEMPTS times', () => {
    const element = document.createElement('section');
    const cases: readonly (readonly [string | null, number, number])[] = [
      ['other', 0, 0],
      [null, 0, 0],
      ['methods', 137 + 2, 0],
      ['methods', 137 - 2, 0],
      ['methods', 137 + 3, PAPER_LANDING_MAX_ATTEMPTS],
      ['methods', 0, PAPER_LANDING_MAX_ATTEMPTS],
    ];
    for (const [pinned, actualTop, scrolls] of cases) {
      const { env, authority } = setup();
      if (pinned !== null) authority.pin(pinned);
      authority.requestLandingCheck('methods', measureAt(element, actualTop));
      env.drain();
      expect({ pinned, actualTop, scrolls: env.intoView.length }).toEqual({ pinned, actualTop, scrolls });
    }
    const { env, authority } = setup();
    authority.pin('methods');
    authority.requestLandingCheck('methods', () => null);
    env.drain();
    expect(env.intoView).toHaveLength(0);
  });

  it('dispose stops a landing check already in flight (R11)', () => {
    const element = document.createElement('section');
    const { env, authority } = setup();
    authority.pin('methods');
    authority.requestLandingCheck('methods', measureAt(element, 0));
    authority.dispose();
    env.drain();
    expect(env.intoView).toHaveLength(0);
    // CONTROL: without dispose the identical chain corrects.
    const kept = setup();
    kept.authority.pin('methods');
    kept.authority.requestLandingCheck('methods', measureAt(element, 0));
    kept.env.drain();
    expect(kept.env.intoView).toContain(element);
  });
});

describe('scroll authority: the reveal lifecycle', () => {
  it('reveals, focuses, corrects after the layout wait and again at rest, then releases (M1R4-02, M1R6-01)', () => {
    const { env, authority } = setup(129);
    const { heading } = headingAt([0, 137.78, 144.36, 157.08, 161, 161, 161, 161]);
    authority.revealPanelHeading(authority.requestRevealCause(), heading);
    expect(env.intoView).toEqual([heading]);
    expect(document.activeElement).toBe(heading);
    expect(authority.ownsScrollport()).toBe(true);
    // The layout wait is two frames: nothing is corrected on the first.
    env.runFrame();
    expect(env.pageScrolls).toEqual([]);
    env.runFrame();
    expect(env.pageScrolls).toEqual([-137]);
    env.drain();
    expect(env.pageScrolls).toEqual([-137, 24]);
    expect(authority.ownsScrollport()).toBe(false);
    expect(env.liveTimers()).toBe(0);
    // CONTROL: a heading already on the reading line is never scrolled (Download Files).
    const still = setup(129);
    still.authority.revealPanelHeading(authority.requestRevealCause(), headingAt([137]).heading);
    still.env.drain();
    expect(still.env.pageScrolls).toEqual([]);
  });

  it('a heading that never stops moving is corrected at the frame bound and released', () => {
    const { env, authority } = setup(129);
    let top = 0;
    const heading = document.createElement('h2');
    heading.getBoundingClientRect = () => {
      top += 1;
      return { top } as DOMRect;
    };
    authority.revealPanelHeading(authority.requestRevealCause(), heading);
    const ran = env.drain();
    // Two layout frames, then PAPER_REVEAL_SETTLE_MAX_FRAMES loop samples.
    expect(ran).toBe(2 + PAPER_REVEAL_SETTLE_MAX_FRAMES);
    expect(env.pageScrolls).toHaveLength(2);
    expect(authority.ownsScrollport()).toBe(false);
    // CONTROL: a resting heading ends long before the bound.
    const rest = setup(129);
    rest.authority.revealPanelHeading(authority.requestRevealCause(), headingAt([400]).heading);
    expect(rest.env.drain()).toBeLessThan(10);
  });

  it('the deadline corrects a live loop, skips a hidden tab, skips an abandoned sequence, and releases in every case', () => {
    const run = (variant: 'visible' | 'hidden' | 'abandoned') => {
      const { env, authority, activate } = setup(129);
      let top = 400;
      const heading = document.createElement('h2');
      heading.getBoundingClientRect = () => ({ top } as DOMRect);
      authority.revealPanelHeading(authority.requestRevealCause(), heading);
      env.runFrame();
      env.runFrame();
      top = 420;
      env.runFrame();
      top = 500;
      if (variant === 'hidden') env.setHidden(true);
      if (variant === 'abandoned') activate('wheel');
      const before = env.pageScrolls.length;
      env.fireTimers();
      return { scrolled: env.pageScrolls.slice(before), owns: authority.ownsScrollport(), live: authority.liveSequenceCount() };
    };
    expect(run('visible')).toEqual({ scrolled: [500 - 137], owns: false, live: 0 });
    expect(run('hidden')).toEqual({ scrolled: [], owns: false, live: 0 });
    expect(run('abandoned')).toEqual({ scrolled: [], owns: false, live: 0 });
  });

  it('a deadline reached before any frame releases without correcting', () => {
    const { env, authority } = setup(129);
    authority.revealPanelHeading(authority.requestRevealCause(), headingAt([400]).heading);
    env.fireTimers();
    expect(env.pageScrolls).toEqual([]);
    expect(authority.ownsScrollport()).toBe(false);
    // Frames arriving late correct nothing either.
    env.drain();
    expect(env.pageScrolls).toEqual([]);
  });

  it('a later activation during the layout wait means no correction at all, and the scrollport is handed back', () => {
    const { env, authority, activate } = setup(129);
    authority.revealPanelHeading(authority.requestRevealCause(), headingAt([24]).heading);
    activate('keydown');
    env.drain();
    expect(env.pageScrolls).toEqual([]);
    expect(authority.liveSequenceCount()).toBe(0);
    // CONTROL: without the activation the identical reveal corrects.
    const kept = setup(129);
    kept.authority.revealPanelHeading(authority.requestRevealCause(), headingAt([24]).heading);
    kept.env.drain();
    expect(kept.env.pageScrolls).toEqual([-113, -113]);
  });

  it('a sequence born abandoned does not scroll its heading, still focuses it, and releases after its layout wait', () => {
    const { env, authority, target, activate } = setup(129);
    const cause = causeDuring(target, authority, 'click');
    activate('wheel');
    const { heading } = headingAt([24]);
    authority.revealPanelHeading(cause, heading);
    expect(env.intoView).toEqual([]);
    expect(document.activeElement).toBe(heading);
    env.drain();
    expect(env.pageScrolls).toEqual([]);
    expect(authority.liveSequenceCount()).toBe(0);
    // CONTROL: caused by the latest activation, it scrolls its heading.
    authority.revealPanelHeading(authority.requestRevealCause(), heading);
    expect(env.intoView).toEqual([heading]);
  });

  it('a throw releases the scrollport from the synchronous half, the layout entry and the settle loop (M1R6-04)', () => {
    const throwing = (where: 'sync' | 'entry' | 'loop') => {
      const { env, authority } = setup(129);
      let calls = 0;
      const heading = document.createElement('h2');
      heading.getBoundingClientRect = () => {
        calls += 1;
        if ((where === 'entry' && calls === 1) || (where === 'loop' && calls === 3)) throw new Error(where);
        return { top: 24 + calls } as DOMRect;
      };
      if (where === 'sync') heading.focus = () => { throw new Error('sync'); };
      let thrown = '';
      try {
        authority.revealPanelHeading(authority.requestRevealCause(), heading);
        env.drain();
      } catch (error) {
        thrown = (error as Error).message;
      }
      return { thrown, owns: authority.ownsScrollport(), live: authority.liveSequenceCount() };
    };
    expect(throwing('sync')).toEqual({ thrown: 'sync', owns: false, live: 0 });
    expect(throwing('entry')).toEqual({ thrown: 'entry', owns: false, live: 0 });
    expect(throwing('loop')).toEqual({ thrown: 'loop', owns: false, live: 0 });
  });

  it('dispose finishes every live reveal mid-settle, so nothing scrolls afterwards (M1R7-04)', () => {
    const { env, authority } = setup(129);
    authority.revealPanelHeading(authority.requestRevealCause(), headingAt([24]).heading);
    env.runFrame();
    env.runFrame();
    expect(env.pageScrolls).toEqual([-113]);
    authority.dispose();
    expect(authority.liveSequenceCount()).toBe(0);
    env.drain();
    expect(env.pageScrolls).toEqual([-113]);
    // CONTROL: undisposed, the identical reveal applies its settled correction.
    const kept = setup(129);
    kept.authority.revealPanelHeading(authority.requestRevealCause(), headingAt([24]).heading);
    kept.env.drain();
    expect(kept.env.pageScrolls).toEqual([-113, -113]);
  });
});
