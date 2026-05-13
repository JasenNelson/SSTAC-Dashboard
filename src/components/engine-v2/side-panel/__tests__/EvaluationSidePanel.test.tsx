// engine_v2 frontend Lane 2d / Phase A: EvaluationSidePanel tests.
//
// Covers:
//   - Collapsed rail renders by default with a discoverable label.
//   - Cmd+K opens the panel; Cmd+J toggles; Esc closes.
//   - Tab strip uses role=tablist + role=tab + aria-selected; arrow
//     keys cycle tabs.
//   - Ask AI tab shows the Phase D placeholder body (still pending).
//   - Search submission tab mounts the live SubmissionSearchTab (Phase C
//     landed; mocked here so Phase A shell tests stay decoupled from
//     Phase C network fetches).
//   - Search policies tab renders PolicySearchPanel (smoke).
//   - aria-expanded on the collapse toggle.
//   - PolicySearchPanel is mounted with `projectId` only (no extra
//     props introduced by the wrapper).
//   - Placeholder smoke for AskAiTab so the Phase D mount contract has
//     coverage before that phase lands.
//   - Drawer fallback below 1200px viewport switches data-side-panel-mode
//     to "drawer"; resize back to >=1200px switches to "split".
//   - 150ms debounce coalesces back-to-back resize events; only the last
//     viewport reading is applied.
//
// ASCII only.

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { act, render, screen, fireEvent } from "@testing-library/react";
import React from "react";

import { EvaluationSidePanel } from "../EvaluationSidePanel";
import { SidePanelProvider } from "../SidePanelContext";
import { AskAiTab } from "../AskAiTab";

// Mock the relocated PolicySearchPanel so the Phase A shell test
// doesn't depend on its internal network-fetching behavior.
vi.mock("@/components/engine-v2/PolicySearchPanel", () => ({
  PolicySearchPanel: ({ projectId }: { projectId: string }) => (
    <div data-testid="policy-search-panel-stub" data-project-id={projectId}>
      stub
    </div>
  ),
}));

// Mock the Phase C live SubmissionSearchTab so the Phase A shell test
// doesn't depend on its indexing-status fetch on mount.
vi.mock("../SubmissionSearchTab", () => ({
  SubmissionSearchTab: ({ evaluationId }: { evaluationId: string }) => (
    <div
      data-testid="submission-search-tab-stub"
      data-evaluation-id={evaluationId}
    >
      stub
    </div>
  ),
}));

// Mock the Phase D live AskAiTab so the Phase A shell test doesn't
// depend on its indexing-status + chat/models fetches on mount. Live
// coverage of AskAiTab lives in AskAiTab.test.tsx; the shell test
// just asserts the mount wiring.
vi.mock("../AskAiTab", () => ({
  AskAiTab: ({ evaluationId }: { evaluationId: string }) => (
    <div data-testid="ask-ai-tab-stub" data-evaluation-id={evaluationId}>
      stub
    </div>
  ),
}));

// jsdom does not implement ResizeObserver. The production code attaches a
// debounced callback that re-reads window.innerWidth; we expose a hook
// that captures the most recently registered callback so tests can fire
// it deterministically.
interface ResizeObserverHandle {
  callback: ResizeObserverCallback;
  disconnect: () => void;
}

const resizeObservers: ResizeObserverHandle[] = [];

class ResizeObserverStub {
  callback: ResizeObserverCallback;
  constructor(cb: ResizeObserverCallback) {
    this.callback = cb;
    resizeObservers.push({
      callback: cb,
      disconnect: () => {
        const idx = resizeObservers.findIndex((h) => h.callback === cb);
        if (idx >= 0) resizeObservers.splice(idx, 1);
      },
    });
  }
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {
    const idx = resizeObservers.findIndex((h) => h.callback === this.callback);
    if (idx >= 0) resizeObservers.splice(idx, 1);
  }
}

/**
 * Set window.innerWidth and fire all currently-registered ResizeObserver
 * callbacks so the panel's debounced effect picks the new width. The
 * production effect calls window.innerWidth inside the timer; we set the
 * property before firing the callback.
 */
function triggerResize(width: number): void {
  Object.defineProperty(window, "innerWidth", {
    configurable: true,
    writable: true,
    value: width,
  });
  for (const h of [...resizeObservers]) {
    // Fire with an empty entries list; production code reads innerWidth,
    // not entry rects.
    h.callback([], {
      observe: () => {},
      unobserve: () => {},
      disconnect: () => {},
    } as unknown as ResizeObserver);
  }
}

beforeEach(() => {
  window.localStorage.clear();
  resizeObservers.length = 0;
  (
    globalThis as unknown as { ResizeObserver: typeof ResizeObserverStub }
  ).ResizeObserver = ResizeObserverStub;
  // Make sure we are in split-pane mode (>= 1200px) by default.
  Object.defineProperty(window, "innerWidth", {
    configurable: true,
    writable: true,
    value: 1440,
  });
});

const EVAL_ID = "00000000-0000-4000-8000-000000000001";
const PROJECT_ID = "00000000-0000-4000-8000-000000000002";

function renderPanel() {
  return render(
    <SidePanelProvider>
      <EvaluationSidePanel
        evaluationId={EVAL_ID}
        projectId={PROJECT_ID}
      />
    </SidePanelProvider>,
  );
}

describe("EvaluationSidePanel (Phase A) -- collapsed rail", () => {
  it("renders the collapsed rail by default", () => {
    renderPanel();
    expect(
      screen.getByTestId("side-panel-collapsed-rail"),
    ).toBeInTheDocument();
    const expand = screen.getByTestId("side-panel-expand-toggle");
    expect(expand).toHaveAttribute("aria-expanded", "false");
    expect(expand).toHaveAttribute(
      "aria-label",
      "Search and Ask side panel; press Enter to expand",
    );
  });

  it("expands when the rail button is clicked", () => {
    renderPanel();
    fireEvent.click(screen.getByTestId("side-panel-expand-toggle"));
    expect(screen.getByTestId("evaluation-side-panel")).toBeInTheDocument();
  });
});

describe("EvaluationSidePanel (Phase A) -- keymap", () => {
  it("Cmd+K opens the panel", () => {
    renderPanel();
    fireEvent.keyDown(window, { key: "k", metaKey: true });
    expect(screen.getByTestId("evaluation-side-panel")).toBeInTheDocument();
  });

  it("Ctrl+K also opens the panel (Windows binding)", () => {
    renderPanel();
    fireEvent.keyDown(window, { key: "k", ctrlKey: true });
    expect(screen.getByTestId("evaluation-side-panel")).toBeInTheDocument();
  });

  it("Cmd+J toggles open and closed", () => {
    renderPanel();
    fireEvent.keyDown(window, { key: "j", metaKey: true });
    expect(screen.getByTestId("evaluation-side-panel")).toBeInTheDocument();
    fireEvent.keyDown(window, { key: "j", metaKey: true });
    expect(
      screen.getByTestId("side-panel-collapsed-rail"),
    ).toBeInTheDocument();
  });

  it("Esc closes the panel without unmounting state", () => {
    renderPanel();
    fireEvent.keyDown(window, { key: "k", metaKey: true });
    expect(screen.getByTestId("evaluation-side-panel")).toBeInTheDocument();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(
      screen.getByTestId("side-panel-collapsed-rail"),
    ).toBeInTheDocument();
  });

  it("removes the keydown listener on unmount (no orphan handlers)", () => {
    const addSpy = vi.spyOn(window, "addEventListener");
    const removeSpy = vi.spyOn(window, "removeEventListener");
    const { unmount } = renderPanel();
    const addedHandlers = addSpy.mock.calls.filter(
      ([type]) => type === "keydown",
    );
    expect(addedHandlers.length).toBeGreaterThan(0);
    unmount();
    const removedHandlers = removeSpy.mock.calls.filter(
      ([type]) => type === "keydown",
    );
    expect(removedHandlers.length).toBeGreaterThan(0);
    addSpy.mockRestore();
    removeSpy.mockRestore();
  });
});

describe("EvaluationSidePanel (Phase A) -- tab strip a11y", () => {
  it("has role=tablist + role=tab + aria-selected on the active tab", () => {
    renderPanel();
    fireEvent.click(screen.getByTestId("side-panel-expand-toggle"));
    const tablist = screen.getByTestId("side-panel-tablist");
    expect(tablist).toHaveAttribute("role", "tablist");

    const askTab = screen.getByTestId("side-panel-tab-ask");
    expect(askTab).toHaveAttribute("role", "tab");
    expect(askTab).toHaveAttribute("aria-selected", "true");

    const polTab = screen.getByTestId("side-panel-tab-search-pol");
    expect(polTab).toHaveAttribute("aria-selected", "false");
  });

  it("ArrowRight cycles to the next tab", () => {
    renderPanel();
    fireEvent.click(screen.getByTestId("side-panel-expand-toggle"));
    const tablist = screen.getByTestId("side-panel-tablist");
    fireEvent.keyDown(tablist, { key: "ArrowRight" });
    expect(screen.getByTestId("side-panel-tab-search-sub")).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  it("ArrowLeft wraps to the last tab when on the first", () => {
    renderPanel();
    fireEvent.click(screen.getByTestId("side-panel-expand-toggle"));
    const tablist = screen.getByTestId("side-panel-tablist");
    fireEvent.keyDown(tablist, { key: "ArrowLeft" });
    expect(screen.getByTestId("side-panel-tab-search-pol")).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  it("collapse toggle has aria-expanded=true when panel is open", () => {
    renderPanel();
    fireEvent.click(screen.getByTestId("side-panel-expand-toggle"));
    const toggle = screen.getByTestId("side-panel-collapse-toggle");
    expect(toggle).toHaveAttribute("aria-expanded", "true");
  });
});

describe("EvaluationSidePanel (Phase A) -- tab content", () => {
  it("Ask AI tab mounts the AskAiTab via stub (Phase D)", () => {
    renderPanel();
    fireEvent.click(screen.getByTestId("side-panel-expand-toggle"));
    const stub = screen.getByTestId("ask-ai-tab-stub");
    expect(stub).toBeInTheDocument();
    expect(stub).toHaveAttribute("data-evaluation-id", EVAL_ID);
  });

  it("Search submission tab mounts the live SubmissionSearchTab (Phase C)", () => {
    renderPanel();
    fireEvent.click(screen.getByTestId("side-panel-expand-toggle"));
    fireEvent.click(screen.getByTestId("side-panel-tab-search-sub"));
    const stub = screen.getByTestId("submission-search-tab-stub");
    expect(stub).toBeInTheDocument();
    expect(stub).toHaveAttribute("data-evaluation-id", EVAL_ID);
  });

  it("Search policies tab mounts PolicySearchPanel with projectId only", () => {
    renderPanel();
    fireEvent.click(screen.getByTestId("side-panel-expand-toggle"));
    fireEvent.click(screen.getByTestId("side-panel-tab-search-pol"));
    const stub = screen.getByTestId("policy-search-panel-stub");
    expect(stub).toBeInTheDocument();
    expect(stub).toHaveAttribute("data-project-id", PROJECT_ID);
  });
});

describe("Placeholder tabs (Phase C/D mount contract smoke)", () => {
  it("AskAiTab renders via the Phase D stub when imported here", () => {
    // Phase D landed and replaced the placeholder body. Because this
    // test file vi.mock()s ../AskAiTab at module-evaluation time, the
    // imported AskAiTab in this file is the stub; the live component
    // is covered by AskAiTab.test.tsx.
    render(<AskAiTab evaluationId={EVAL_ID} />);
    const stub = screen.getByTestId("ask-ai-tab-stub");
    expect(stub).toBeInTheDocument();
    expect(stub).toHaveAttribute("data-evaluation-id", EVAL_ID);
  });
});

describe("EvaluationSidePanel (Phase A) -- drawer fallback (ED-2d4-10)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders in split mode at 1440px viewport", () => {
    renderPanel();
    fireEvent.click(screen.getByTestId("side-panel-expand-toggle"));
    const panel = screen.getByTestId("evaluation-side-panel");
    expect(panel).toHaveAttribute("data-side-panel-mode", "split");
  });

  it("switches to drawer mode after viewport resizes below 1200px", () => {
    renderPanel();
    fireEvent.click(screen.getByTestId("side-panel-expand-toggle"));
    expect(screen.getByTestId("evaluation-side-panel")).toHaveAttribute(
      "data-side-panel-mode",
      "split",
    );

    act(() => {
      triggerResize(900);
      // Debounce window: 150ms before the resize is applied.
      vi.advanceTimersByTime(150);
    });

    expect(screen.getByTestId("evaluation-side-panel")).toHaveAttribute(
      "data-side-panel-mode",
      "drawer",
    );
  });

  it("switches back to split mode after viewport resizes >= 1200px", () => {
    renderPanel();
    fireEvent.click(screen.getByTestId("side-panel-expand-toggle"));

    act(() => {
      triggerResize(800);
      vi.advanceTimersByTime(150);
    });
    expect(screen.getByTestId("evaluation-side-panel")).toHaveAttribute(
      "data-side-panel-mode",
      "drawer",
    );

    act(() => {
      triggerResize(1500);
      vi.advanceTimersByTime(150);
    });
    expect(screen.getByTestId("evaluation-side-panel")).toHaveAttribute(
      "data-side-panel-mode",
      "split",
    );
  });

  it("debounces resize events: only the latest fires within 150ms", () => {
    renderPanel();
    fireEvent.click(screen.getByTestId("side-panel-expand-toggle"));

    // Two rapid resizes inside the debounce window. First lands the
    // viewport at 800 (drawer territory); second sets it to 1500
    // (split territory). Only the second should be applied because the
    // first timer is cancelled before it fires.
    act(() => {
      triggerResize(800);
      vi.advanceTimersByTime(50); // not yet past 150ms threshold
    });

    // Halfway through, panel must STILL be in split mode (no debounce
    // tick has fired yet).
    expect(screen.getByTestId("evaluation-side-panel")).toHaveAttribute(
      "data-side-panel-mode",
      "split",
    );

    act(() => {
      triggerResize(1500);
      vi.advanceTimersByTime(150);
    });

    // After the debounce ticks, the most recent viewport reading wins.
    expect(screen.getByTestId("evaluation-side-panel")).toHaveAttribute(
      "data-side-panel-mode",
      "split",
    );
  });
});
