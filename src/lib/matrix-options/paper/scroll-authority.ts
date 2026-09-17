/**
 * PAPER SCROLL AUTHORITY (AMENDMENT-M1-SCROLL-AUTHORITY-001).
 *
 * Every scroll the paper workspace performs, and every decision about who may
 * scroll, passes through this module: one ownership state (the set of reveal
 * sequences), one activation-observation rule, one reveal lifecycle, one pin
 * policy and one arbitration predicate. It is the ONLY file in the paper tree
 * allowed to call a raw scroll API; `scroll-authority-guard.test.ts` fails the
 * build of any other file that does.
 *
 * Why it exists. Rounds 6 to 9 each fixed a real defect at a call site and each
 * fix created the next finding at another one. Round 8 and round 9 answered
 * "is this the click that started me?" with TIME (a zero-delay timer, then a
 * microtask), and both left a window: a click queued by an extension capture
 * hook during the opening activation ran before the listener that should have
 * seen it was installed (codex r9-sol-1, finding 1).
 *
 * THE RULE THIS MODULE MAKES DECIDABLE -- causal activation identity:
 *
 * 1. ONE OBSERVER, NO INSTALL WINDOW. `observe(target)` installs a single
 *    capture-phase listener per activation kind for the component's whole
 *    mounted lifetime, before any sequence can be claimed. No per-sequence
 *    listener is ever armed later, so there is no arming step and no arming
 *    window.
 * 2. EVERY ACTIVATION GETS AN IDENTITY AT DISPATCH. `onActivation` assigns a
 *    monotonically increasing id synchronously, in the capture phase at the
 *    observed target (the window), before any target handler runs.
 * 3. EVERY SEQUENCE RECORDS ITS CAUSAL ACTIVATION AND REQUEST ORDINAL.
 *    `currentActivationId()` returns the id of the activation whose dispatch is
 *    in progress. `requestRevealCause()` adds a uniquely increasing request
 *    ordinal to it, so every request gets a unique identity. This cause is
 *    carried to `revealPanelHeading(cause, ...)`.
 * 4. LATER DISTINCT ACTIVATION OR LATER SAME-DISPATCH REQUEST WINS. A live sequence
 *    caused by (activation k, request x) is abandoned iff an activation j > k has
 *    been observed, or a request with j == k but y > x has been minted. It is
 *    evaluated at request/observation AND at claim time. No microtask order
 *    enters into it, and the distinct activation that caused a sequence never
 *    abandons it, though a later request within it does abandon an earlier one.
 * 5. ABANDONMENT STOPS ENTITLEMENT IMMEDIATELY. `revealIsEntitled` is the one
 *    predicate every arbitration point reads -- the ownership test, the reveal's
 *    own scrolls and the settle loop's stop test -- so an abandoned sequence
 *    neither owns the scrollport nor corrects again, while ownership is still
 *    handed back exactly once through `finish`, the single release path.
 *
 * This module is framework-agnostic and must not import React.
 */

/** A landing is corrected when the target top is off its reading line by more than this. */
export const PAPER_LANDING_TOLERANCE_PX = 2;
/** Bounded corrective scrolls after an asynchronous section load. */
export const PAPER_LANDING_MAX_ATTEMPTS = 3;
/**
 * The 0.5rem that PAPER_SCROLL_MARGIN_CLASSES adds to the measured sticky header
 * height, restated as a number: a rail panel heading cannot be placed by scroll
 * margin at all (panelRevealScrollDelta), so its reading line must be computed.
 */
export const PAPER_PANEL_REVEAL_GAP_PX = 8;
/**
 * M1R6-01 (codex r4-luna-1, REINSTATED by browser run-004 section 7). The number
 * of consecutive animation frames in which a revealed heading must not move at
 * all before its landing is taken to be its RESTING landing.
 */
export const PAPER_REVEAL_SETTLE_STABLE_FRAMES = 2;
/**
 * The wall-clock bound on that settle, comfortably past the rails' own
 * `transition-all duration-300`. A suppressed transition settles in two frames;
 * a transition that never ends still has to give the scrollport back.
 */
export const PAPER_REVEAL_SETTLE_TIMEOUT_MS = 600;
/** A clock-independent backstop, so the loop terminates without a usable clock. */
export const PAPER_REVEAL_SETTLE_MAX_FRAMES = 120;

/** Whether a landed section sits off its reading line by more than the tolerance. */
export function landingNeedsCorrection(actualTop: number, expectedTop: number, tolerance: number = PAPER_LANDING_TOLERANCE_PX): boolean {
  return Math.abs(actualTop - expectedTop) > tolerance;
}

/**
 * M1R4-02 (browser run-002 section 7a; PLAN-R4 3.A item 4). Below lg a rail
 * panel heading landed at 24px (left rail) and 20px (right rail) at 360 and 768
 * -- exactly the rail's own padding -- in BOTH browser runs, and did not move by
 * a single pixel when the heading's scroll margin changed from 96px to 137px
 * between them. A rail is an `overflow:hidden` scroll container
 * (PAPER_LEFT_RAIL_BASE_CLASSES), so the part of the scroll-margin box that lies
 * ABOVE the rail is clipped off before it reaches the page scrollport, and
 * `scrollIntoView` aligns the rail's own top edge instead. Scroll margin
 * therefore cannot move this class of target below the sticky header, which is
 * why further scroll-margin tuning was ruled out. The reveal is instead verified
 * and corrected by an explicit measured delta, which no clipping ancestor can
 * discard. Download Files, whose heading sits in the document column and already
 * lands on the reading line (137 at 360, 85 at 768), measures a delta of 0 here
 * and is left exactly as it is.
 *
 * Returns the pixels to scroll (positive scrolls the page down), or 0 when the
 * heading is already on its reading line within PAPER_LANDING_TOLERANCE_PX.
 */
export function panelRevealScrollDelta(headingTop: number, stickyHeaderHeight: number, tolerance: number = PAPER_LANDING_TOLERANCE_PX): number {
  const expected = stickyHeaderHeight + PAPER_PANEL_REVEAL_GAP_PX;
  if (!Number.isFinite(headingTop) || !Number.isFinite(expected)) return 0;
  return landingNeedsCorrection(headingTop, expected, tolerance) ? Math.round(headingTop - expected) : 0;
}

/*
 * THE ACTIVATION LISTS -- one pin policy, one abandonment set.
 *
 * Every OBSERVED activation is a reader activation: it gets an id and abandons
 * every live reveal that an EARLIER activation caused (rule 4).
 *
 * - wheel, touchstart, keydown, mousedown: reader scroll intent. They also drop
 *   the section pin (M1-01).
 * - click (M1R8-04): VoiceOver AXPress, Dragon "click <label>" and any
 *   extension calling element.click() dispatch a click with no pointer or key
 *   event. It abandons, but must NOT drop the pin: a "Load section" press is
 *   also a click, and M1R4-03 re-lands a still-pinned target after it.
 * - change (section 4.2 item 1): a question change on the My Review "Jump to
 *   question" select emits none of the above, and used to scroll the response
 *   while a reveal went on correcting against it.
 * - hashchange (section 4.2 item 3): a hash navigation is a reader activation;
 *   the browser has already scrolled to the fragment before the event, and a
 *   live reveal used to drag the reader back to the panel.
 *
 * `scroll` is deliberately in neither list (section 4.2 item 5, deferred): it
 * cannot yet be told apart from this module's own scrolls, smooth scrolling,
 * layout shift and scroll anchoring.
 */
export const PAPER_OBSERVED_ACTIVATIONS: readonly string[] = ['wheel', 'touchstart', 'keydown', 'mousedown', 'click', 'change', 'hashchange'];
/*
 * HOLISTIC_R2 F5: `hashchange` is pin-releasing as well. A hash navigation moves
 * the reader to a fragment, so the section pin they were holding is stale from
 * that moment -- and a fragment the workspace does not manage never reaches
 * `focusSection`, so nothing else would ever clear it and the next section load
 * or header resize would re-land the reader away from where they navigated. A
 * MANAGED fragment re-establishes the pin immediately, through `focusSection`.
 */
export const PAPER_PIN_RELEASING_ACTIVATIONS: readonly string[] = ['wheel', 'touchstart', 'keydown', 'mousedown', 'hashchange'];
/*
 * A pending (not yet loaded) navigation is a DEFERRED pin (section 4.2 item 2).
 * It is cancelled by a later navigation, by a failed load of its section, and
 * by reader scroll intent that cannot also be a control activation: `wheel`.
 * mousedown, keydown and touchstart are NOT in this list on purpose -- each is
 * also how a reader activates a rail toggle, and browser run-006/007
 * `s1-collision.identity-still-applied` proved that an S1 response arriving
 * after the reader opened a panel still applies the navigation's identity.
 */
export const PAPER_PENDING_NAVIGATION_CANCELLING_ACTIVATIONS: readonly string[] = ['wheel'];

/** The platform primitives the authority scrolls and schedules with; injectable for direct tests. */
export interface PaperScrollEnvironment {
  /** Runs `run` after the browser has laid new content out (two frames), or on a task without rAF. */
  readonly afterLayout: (run: () => void) => void;
  /** Runs `run` on the NEXT animation frame, or on a task without rAF. */
  readonly nextFrame: (run: () => void) => void;
  /** Starts a wall-clock timer; returns null where no timer exists. */
  readonly setTimer: (run: () => void, ms: number) => unknown;
  readonly clearTimer: (handle: unknown) => void;
  /** Scrolls the page scrollport vertically by `top` px. */
  readonly scrollPageBy: (top: number) => void;
  /** Aligns `element` to the start of its scrollport. */
  readonly scrollElementIntoView: (element: Element) => void;
  /** True when the tab cannot be seen, where rAF is suspended and a scroll would be wrong rather than late. */
  readonly documentIsHidden: () => boolean;
}

/**
 * The browser environment. Every primitive is resolved when it is CALLED, not
 * when the authority is created, so a page (or a test) that replaces
 * `requestAnimationFrame` or `scrollBy` later is honoured.
 *
 * HOLISTIC_R2 F3: deliberately NOT exported. It was the one remaining way for a
 * paper file to reach a raw scroll with no arbitration at all
 * (`browserScrollEnvironment().scrollPageBy(...)`), and an export the guard's
 * lexical scan did not name. Tests inject their own `PaperScrollEnvironment`
 * through the constructor instead.
 */
function browserScrollEnvironment(): PaperScrollEnvironment {
  const hasWindow = () => typeof window !== 'undefined';
  return {
    afterLayout: (run) => {
      if (!hasWindow()) return;
      if (typeof window.requestAnimationFrame !== 'function') {
        window.setTimeout(run, 0);
        return;
      }
      window.requestAnimationFrame(() => window.requestAnimationFrame(() => run()));
    },
    nextFrame: (run) => {
      if (!hasWindow()) return;
      if (typeof window.requestAnimationFrame !== 'function') {
        window.setTimeout(run, 0);
        return;
      }
      window.requestAnimationFrame(() => run());
    },
    // `window.setTimeout` is the DOM overload, which returns a number.
    setTimer: (run, ms) => (hasWindow() && typeof window.setTimeout === 'function' ? window.setTimeout(run, ms) : null),
    clearTimer: (handle) => {
      if (handle !== null && hasWindow() && typeof window.clearTimeout === 'function') window.clearTimeout(handle as number);
    },
    scrollPageBy: (top) => {
      if (hasWindow() && typeof window.scrollBy === 'function') window.scrollBy(0, top);
    },
    scrollElementIntoView: (element) => {
      (element as HTMLElement).scrollIntoView?.({ block: 'start' });
    },
    documentIsHidden: () => typeof document !== 'undefined' && document.visibilityState === 'hidden',
  };
}

/**
 * WHAT CAUSED A REVEAL REQUEST (rule 3), minted ONLY by
 * `PaperScrollAuthority.requestRevealCause()` so a caller cannot fabricate one
 * (HOLISTIC_R2 F3: `cause = Number.MAX_SAFE_INTEGER` used to buy an owner no
 * activation could supersede).
 *
 * `activation` is the causing activation id. Every request, activation-caused
 * or programmatic, gets a unique strictly increasing request ordinal from one
 * counter. A later request supersedes an earlier one sharing its activation,
 * and a later activation supersedes regardless of ordinal.
 */
export interface PaperRevealCause {
  readonly activation: number;
  readonly request: number;
}

/**
 * ONE reveal's claim on the scrollport (M1R7-01/02/03/04, M1R8-05, M1R9-01).
 * `cause` is what requested it (rule 3).
 */
export interface PaperRevealSequence {
  readonly cause: PaperRevealCause;
  /** Set when a LATER distinct activation is observed (rule 4). */
  abandoned: boolean;
  /** True once the scrollport has been given back, by any path, including dispose. */
  done: boolean;
  /**
   * Run when the ownership deadline is reached. The default does nothing, which
   * is correct when the settle loop never started (no frame ever arrived, so
   * there is no settled measurement to act on); the loop replaces it with its
   * own final correction once it is running.
   */
  onDeadline: () => void;
  /** Gives the scrollport back exactly once, stopping the deadline timer. The ONLY release path. */
  finish: () => void;
}

/** Rule 4: whether activation `activationId` supersedes a sequence with cause `cause`. */
export function activationSupersedes(activationId: number, cause: PaperRevealCause): boolean {
  return activationId > cause.activation;
}

/**
 * Rule 4 between two REQUESTS. Lexicographic on (activation, request).
 * This keeps the distinct-activation rule exactly as it was, while giving
 * every request (even in the same dispatch) an ordinal that makes it strictly
 * later than any earlier request sharing its activation id.
 */
export function requestSupersedes(later: PaperRevealCause, earlier: PaperRevealCause): boolean {
  if (later.activation !== earlier.activation) return later.activation > earlier.activation;
  return later.request > earlier.request;
}

/**
 * Rule 5, and the ONE arbitration predicate. A sequence is entitled to the
 * scrollport -- to own it against every other scroll, to scroll its own
 * heading, and to correct -- only while it is neither abandoned nor released.
 * `done` is the defensive half: `finish` also removes a sequence from the live
 * set, so an entitled answer can never depend on a release having deleted
 * correctly.
 */
export function revealIsEntitled(sequence: PaperRevealSequence): boolean {
  return !sequence.abandoned && !sequence.done;
}

/** A navigation whose owning section is still loading (S1). */
export interface PaperPendingNavigation {
  readonly anchor: string;
  readonly writeUrl: boolean;
  /** The depth-1 section index being loaded, so a failed load can clear it. */
  readonly sectionIndex: number;
}

/** What a landing check measures about its pinned target, supplied by the caller. */
export interface PaperLandingMeasurement {
  readonly element: Element;
  readonly actualTop: number;
  readonly expectedTop: number;
}

export interface PaperScrollAuthorityOptions {
  /** The published sticky header height in px, read at every correction. */
  readonly stickyHeaderHeight?: () => number;
  readonly environment?: PaperScrollEnvironment;
}

/** `Event.NONE`: an event whose dispatch has finished. */
const EVENT_PHASE_NONE = 0;

export class PaperScrollAuthority {
  private readonly environment: PaperScrollEnvironment;
  private readonly stickyHeaderHeight: () => number;
  private observedTarget: EventTarget | null = null;
  private latestActivationId = 0;
  /** Activations whose dispatch may still be in progress, innermost last. */
  private readonly dispatching: { readonly event: Event; readonly id: number }[] = [];
  /** Every reveal sequence that has not released. The one ownership state. */
  private readonly sequences = new Set<PaperRevealSequence>();
  private pinned: string | null = null;
  private pending: PaperPendingNavigation | null = null;
  /** Bumped by dispose, so a landing-check frame chain outliving the component stops (R11). */
  private epoch = 0;
  /** Ordinals for ALL reveal requests (rule 3). */
  private requestCounter = 0;
  /** The most recent cause this authority minted, for the claim-time evaluation of rule 4. */
  private latestCause: PaperRevealCause = { activation: 0, request: 0 };
  /** Every cause this authority minted, so a fabricated one cannot be claimed (HOLISTIC_R2 F3). */
  private readonly mintedCauses = new WeakSet<PaperRevealCause>();

  constructor(options: PaperScrollAuthorityOptions = {}) {
    this.environment = options.environment ?? browserScrollEnvironment();
    this.stickyHeaderHeight = options.stickyHeaderHeight ?? (() => 0);
  }

  /* ------------------------------------------------------------------ */
  /* Activation observation (rules 1-4)                                   */
  /* ------------------------------------------------------------------ */

  /**
   * Rule 1. Installs the ONE capture-phase observer. Idempotent: a second call
   * while observing does nothing, so a caller may assert it again right before
   * claiming without creating a second listener.
   */
  observe(target: EventTarget | null): void {
    if (target === null || this.observedTarget !== null) return;
    this.observedTarget = target;
    for (const type of PAPER_OBSERVED_ACTIVATIONS) target.addEventListener(type, this.onActivation, { capture: true, passive: true });
  }

  /** Whether the observer is installed. */
  isObserving(): boolean {
    return this.observedTarget !== null;
  }

  /**
   * Stops observing and gives back everything this authority holds: every live
   * sequence is finished (M1R7-04, unmount mid-settle), and every landing-check
   * chain in flight stops at its next frame (R11).
   */
  dispose(): void {
    const target = this.observedTarget;
    this.observedTarget = null;
    if (target !== null) for (const type of PAPER_OBSERVED_ACTIVATIONS) target.removeEventListener(type, this.onActivation, { capture: true });
    for (const sequence of Array.from(this.sequences)) sequence.finish();
    this.sequences.clear();
    this.dispatching.length = 0;
    this.epoch += 1;
  }

  /** Rule 2: the id is assigned synchronously, in the capture phase, before any target handler. */
  private readonly onActivation = (event: Event): void => {
    const id = this.latestActivationId + 1;
    this.latestActivationId = id;
    this.pruneFinishedDispatches();
    this.dispatching.push({ event, id });
    this.activationObserved(event.type, id);
  };

  private activationObserved(kind: string, id: number): void {
    // Rule 4, evaluated when a new activation is observed.
    for (const sequence of this.sequences) if (activationSupersedes(id, sequence.cause)) sequence.abandoned = true;
    if (PAPER_PIN_RELEASING_ACTIVATIONS.includes(kind)) this.pinned = null;
    if (PAPER_PENDING_NAVIGATION_CANCELLING_ACTIVATIONS.includes(kind)) this.pending = null;
  }

  private pruneFinishedDispatches(): void {
    while (this.dispatching.length > 0 && this.dispatching[this.dispatching.length - 1].event.eventPhase === EVENT_PHASE_NONE) this.dispatching.pop();
  }

  /**
   * Rule 3. The id of the activation whose dispatch is in progress -- the
   * innermost one, so a nested dispatch that has already finished does not
   * lend its id to the handler of the event that contains it. Outside any
   * dispatch, the latest observed id.
   */
  currentActivationId(): number {
    this.pruneFinishedDispatches();
    const top = this.dispatching[this.dispatching.length - 1];
    return top === undefined ? this.latestActivationId : top.id;
  }

  /** The highest activation id observed so far. */
  latestActivation(): number {
    return this.latestActivationId;
  }

  /**
   * Rule 3, and the ONLY way to obtain a cause. A caller asks for one
   * SYNCHRONOUSLY in the handler that requests a reveal; the authority derives
   * it and remembers it.
   *
   * EVERY request, inside or outside an activation dispatch, gets the next
   * ordinal, which no other request can equal. A later request in the same
   * dispatch supersedes the earlier one.
   */
  requestRevealCause(): PaperRevealCause {
    const activation = this.currentActivationId();
    this.requestCounter += 1;
    const cause = { activation, request: this.requestCounter };
    this.mintedCauses.add(cause);
    this.latestCause = cause;
    // Rule 4 for requests, evaluated when the request is made.
    for (const sequence of this.sequences) if (requestSupersedes(cause, sequence.cause)) sequence.abandoned = true;
    return cause;
  }

  /* ------------------------------------------------------------------ */
  /* Ownership and arbitration (rule 5)                                   */
  /* ------------------------------------------------------------------ */

  /** Whether ANY reveal is still entitled to the scrollport. */
  ownsScrollport(): boolean {
    for (const sequence of this.sequences) if (revealIsEntitled(sequence)) return true;
    return false;
  }

  /** The number of sequences that have not released (diagnostics and direct tests). */
  liveSequenceCount(): number {
    return this.sequences.size;
  }

  /**
   * M1R8-01 and holistic P3-6. A navigation, skip-link or My Review focus target
   * is scrolled only while no reveal is entitled. DECISION, recorded in round 8
   * and carried here unchanged: SUPPRESS, do not defer. The caller still applies
   * the navigation as identity (pin, focus, URL); only the scrollport is yielded,
   * and nothing re-queues the scroll when the reveal releases (M1R6-03's
   * measured reason: run-004 section 8.2, panel heading 137 -> -214,124).
   * Returns whether it scrolled.
   */
  scrollTargetIntoView(element: Element): boolean {
    if (this.ownsScrollport()) return false;
    this.environment.scrollElementIntoView(element);
    return true;
  }

  /* ------------------------------------------------------------------ */
  /* Pin policy -- the one place                                          */
  /* ------------------------------------------------------------------ */

  /** A section reached by navigation stays active and re-landable until reader intent (M1-01, M1R4-03). */
  pin(anchor: string): void {
    this.pinned = anchor;
  }

  pinnedAnchor(): string | null {
    return this.pinned;
  }

  /**
   * M1R9-02, and section 4.2 item 4. Any panel open or close moves the reader's
   * attention to the panel, so the pin is stale from that moment -- whichever
   * control asked (a rail toggle, "Hide Download Files", Escape). A pointer
   * reader's mousedown always did this; a bare click did not.
   */
  panelActivated(): void {
    this.pinned = null;
  }

  deferNavigation(navigation: PaperPendingNavigation): void {
    this.pending = navigation;
  }

  pendingNavigation(): PaperPendingNavigation | null {
    return this.pending;
  }

  /** A later navigation won, the pending one resolved, or its section failed to load. */
  cancelPendingNavigation(): void {
    this.pending = null;
  }

  /* ------------------------------------------------------------------ */
  /* Landing checks                                                       */
  /* ------------------------------------------------------------------ */

  /**
   * After a section loads or the sticky header resizes, the landing of the
   * PINNED target is verified and corrected at most PAPER_LANDING_MAX_ATTEMPTS
   * times, two frames apart.
   *
   * M1R5-02 arbitration at REQUEST time: a check asked for while a reveal is
   * entitled is DROPPED, not deferred. M1R6-03 (codex r5-luna-1 R5-02-A), the
   * DECISION: the dropped check is NOT re-queued when the reveal releases; a
   * stale landing is preferred to repairing it on release, because run-004
   * section 8.2 measured repair-on-release as the worse outcome (the reader is
   * taken off the panel they just opened), and the pin survives, so the NEXT
   * genuine trigger still repairs it. The per-attempt check below covers the
   * other order, a reveal that claims while a correction is already in flight.
   */
  requestLandingCheck(anchor: string, measure: (anchor: string) => PaperLandingMeasurement | null): void {
    if (this.ownsScrollport()) return;
    const epoch = this.epoch;
    let attempt = 0;
    const check = () => {
      this.environment.afterLayout(() => {
        if (epoch !== this.epoch) return;
        // M1R5-02: a reveal that claimed since the request owns the scrollport.
        if (this.ownsScrollport()) return;
        if (this.pinned !== anchor) return;
        const landing = measure(anchor);
        if (landing === null) return;
        if (!landingNeedsCorrection(landing.actualTop, landing.expectedTop)) return;
        this.environment.scrollElementIntoView(landing.element);
        attempt += 1;
        if (attempt < PAPER_LANDING_MAX_ATTEMPTS) check();
      });
    };
    check();
  }

  /* ------------------------------------------------------------------ */
  /* The reveal lifecycle                                                 */
  /* ------------------------------------------------------------------ */

  /**
   * Claims the scrollport for one reveal whose request produced `cause`. Rule 4
   * is evaluated again HERE, at claim time: if a later activation, or a later
   * REQUEST (a programmatic one, HOLISTIC_R2 F1), was already recorded, the
   * sequence is born abandoned. It is still added to the live set and released
   * through `finish`, so the release path stays single.
   *
   * A `cause` this authority did not mint is not trusted (HOLISTIC_R2 F3): the
   * authority derives a fresh one instead of letting a caller hand itself an
   * identity no activation can supersede. Deriving rather than throwing keeps a
   * bad call site from tearing down the React tree from inside a passive effect.
   *
   * M1R7-01: the deadline is a TIMER started at the claim, not a comparison
   * inside a frame callback -- a hidden tab suspends rAF entirely, and a timer
   * is throttled there but still fires.
   */
  beginReveal(requested: PaperRevealCause): PaperRevealSequence {
    const cause = this.mintedCauses.has(requested) ? requested : this.requestRevealCause();
    let timer: unknown = null;
    const sequence: PaperRevealSequence = { cause, abandoned: false, done: false, onDeadline: () => {}, finish: () => {} };
    sequence.finish = () => {
      if (sequence.done) return;
      sequence.done = true;
      if (timer !== null) this.environment.clearTimer(timer);
      timer = null;
      this.sequences.delete(sequence);
    };
    this.sequences.add(sequence);
    // Rule 4, evaluated again at claim time, against activations AND requests.
    if (activationSupersedes(this.latestActivationId, cause)) sequence.abandoned = true;
    if (requestSupersedes(this.latestCause, cause)) sequence.abandoned = true;
    timer = this.environment.setTimer(() => {
      try {
        sequence.onDeadline();
      } finally {
        sequence.finish();
      }
    }, PAPER_REVEAL_SETTLE_TIMEOUT_MS);
    return sequence;
  }

  /**
   * Opens-a-panel reveal, below lg (the caller decides that). Claims the
   * scrollport BEFORE the first of the operations that can throw
   * (scrollIntoView, focus, the deferred measurement, scrollBy), and gives it
   * back on every exit path, throw included (M1R6-04). The heading's own
   * `scrollIntoView` is subject to the same entitlement as every other scroll:
   * a sequence born abandoned does not scroll. Focus is identity, not scroll,
   * and is always applied.
   */
  revealPanelHeading(cause: PaperRevealCause, heading: HTMLElement): PaperRevealSequence {
    const sequence = this.beginReveal(cause);
    let handedOff = false;
    try {
      if (revealIsEntitled(sequence)) this.environment.scrollElementIntoView(heading);
      heading.focus({ preventScroll: true });
      this.environment.afterLayout(() => this.settleReveal(sequence, heading));
      handedOff = true;
    } finally {
      if (!handedOff) sequence.finish();
    }
    return sequence;
  }

  /**
   * M1R6-01 (codex r4-luna-1 [P1], REINSTATED by browser run-004 section 7).
   * run-004 sampled a rail reveal every frame for 1,200 ms: the correction at
   * t=86 is CORRECT (+0.78), and then the rail's own `transition-all
   * duration-300` carries the heading 23px down to rest at +24 at t=353. So the
   * correction must produce a landing that is correct when the expansion has
   * FINISHED: correct once immediately (the reader is never left looking at an
   * occluded heading), then re-measure every frame WITHOUT scrolling, and
   * correct once more when the heading's top has not moved at all for
   * PAPER_REVEAL_SETTLE_STABLE_FRAMES consecutive frames. `transitionend` was
   * rejected: it fires per property, never fires under motion-reduce, and never
   * fires for Download Files, which has no transition at all.
   *
   * M1R7-02/04: during the two-frame delay the reader may have taken over, or
   * the authority may have been disposed; either way this corrects nothing and
   * only hands the scrollport back. The scrollport is given back EXACTLY ONCE on
   * every exit path, including a throw.
   */
  private settleReveal(sequence: PaperRevealSequence, heading: HTMLElement): void {
    const correct = () => {
      const delta = panelRevealScrollDelta(heading.getBoundingClientRect().top, this.stickyHeaderHeight());
      if (delta !== 0) this.environment.scrollPageBy(delta);
    };
    const stopped = () => !revealIsEntitled(sequence);
    /*
     * M1R7-01 / M1R8-02 / M1R8-03. The loop's final correction, reachable from
     * the sequence's own timer as well as from a frame, so a heading that never
     * stops moving is still corrected when the frame scheduler is paused. It is
     * skipped in a hidden tab: a measurement taken where nothing has been laid
     * out is not worth scrolling on, and ownership is released either way.
     */
    sequence.onDeadline = () => {
      if (!stopped() && !this.environment.documentIsHidden()) correct();
    };
    let frames = 0;
    let stable = 0;
    let previousTop = Number.NaN;
    const step = () => {
      let continuing = false;
      try {
        if (stopped()) return;
        const top = heading.getBoundingClientRect().top;
        // Strict equality on purpose: a heading that moved by any amount at all
        // is still being carried by the expansion. Jitter runs to the time or
        // frame bound, both past the 300ms transition, so it still corrects.
        stable = top === previousTop ? stable + 1 : 0;
        previousTop = top;
        frames += 1;
        // M1R8-02: the in-loop wall-clock disjunct was dead code (the timer
        // always fires first) and stays deleted. The frame bound is the
        // clock-independent backstop.
        if (stable >= PAPER_REVEAL_SETTLE_STABLE_FRAMES || frames >= PAPER_REVEAL_SETTLE_MAX_FRAMES) {
          correct();
          return;
        }
        this.environment.nextFrame(step);
        continuing = true;
      } finally {
        if (!continuing) sequence.finish();
      }
    };
    let scheduled = false;
    try {
      if (stopped()) return;
      correct();
      this.environment.nextFrame(step);
      scheduled = true;
    } finally {
      if (!scheduled) sequence.finish();
    }
  }
}
