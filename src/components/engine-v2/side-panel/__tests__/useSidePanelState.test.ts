// engine_v2 frontend Lane 2d / Phase A: useSidePanelState tests.
//
// Covers: defaults, localStorage round-trip, corrupted-JSON recovery,
// per-evaluation key scoping, global width, Zod-schema fallback.
//
// ASCII only.

import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

import { useSidePanelState, __test__ } from "../useSidePanelState";

const EVAL_A = "00000000-0000-4000-8000-00000000000a";
const EVAL_B = "00000000-0000-4000-8000-00000000000b";

beforeEach(() => {
  window.localStorage.clear();
});

describe("useSidePanelState (Phase A)", () => {
  it("returns defaults when localStorage is empty", () => {
    const { result } = renderHook(() => useSidePanelState(EVAL_A));
    expect(result.current.open).toBe(false);
    expect(result.current.activeTab).toBe("ask");
    expect(result.current.lastQueryPerTab).toEqual({});
    expect(result.current.chatMode).toBe("fast");
    expect(result.current.width).toBe(__test__.DEFAULT_GLOBAL.width);
  });

  it("persists open + activeTab + lastQuery + chatMode per evaluation", () => {
    // First mount: write state and let the localStorage round-trip happen.
    const first = renderHook(
      ({ id }: { id: string }) => useSidePanelState(id),
      { initialProps: { id: EVAL_A } },
    );

    act(() => {
      first.result.current.setOpen(true);
      first.result.current.setActiveTab("search-pol");
      first.result.current.setLastQuery("search-pol", "arsenic");
      first.result.current.setChatMode("thinking");
    });

    expect(first.result.current.open).toBe(true);
    expect(first.result.current.activeTab).toBe("search-pol");
    expect(first.result.current.lastQueryPerTab["search-pol"]).toBe("arsenic");
    expect(first.result.current.chatMode).toBe("thinking");

    // FULLY unmount the first hook so the next renderHook is a fresh
    // instance. A bare rerender keeps the same hook alive and never
    // proves localStorage hydration; unmount is the only way to show
    // that a brand-new mount reads back the persisted payload.
    first.unmount();

    const second = renderHook(() => useSidePanelState(EVAL_A));
    expect(second.result.current.open).toBe(true);
    expect(second.result.current.activeTab).toBe("search-pol");
    expect(second.result.current.lastQueryPerTab["search-pol"]).toBe("arsenic");
    expect(second.result.current.chatMode).toBe("thinking");
    second.unmount();

    // A fresh mount against a DIFFERENT evaluation id should see the
    // defaults again (per-eval scope).
    const third = renderHook(() => useSidePanelState(EVAL_B));
    expect(third.result.current.open).toBe(false);
    expect(third.result.current.activeTab).toBe("ask");
    expect(third.result.current.lastQueryPerTab).toEqual({});
    third.unmount();
  });

  it("persists width GLOBALLY across evaluations", () => {
    const first = renderHook(() => useSidePanelState(EVAL_A));
    act(() => {
      first.result.current.setWidth(600);
    });
    expect(first.result.current.width).toBe(600);
    first.unmount();

    // Fresh mount against a DIFFERENT evaluation id still sees the
    // globally-persisted width.
    const second = renderHook(() => useSidePanelState(EVAL_B));
    expect(second.result.current.width).toBe(600);
    second.unmount();
  });

  it("clamps width to MIN_WIDTH_PX on write", () => {
    const { result } = renderHook(() => useSidePanelState(EVAL_A));
    act(() => {
      result.current.setWidth(50);
    });
    expect(result.current.width).toBeGreaterThanOrEqual(320);
  });

  it("recovers from corrupted per-eval localStorage payload", () => {
    window.localStorage.setItem(
      __test__.perEvalKey(EVAL_A),
      "{not valid json",
    );
    const { result } = renderHook(() => useSidePanelState(EVAL_A));
    expect(result.current.open).toBe(false);
    expect(result.current.activeTab).toBe("ask");
  });

  it("recovers from schema-invalid per-eval payload", () => {
    window.localStorage.setItem(
      __test__.perEvalKey(EVAL_A),
      JSON.stringify({ open: "yes", activeTab: "nope" }),
    );
    const { result } = renderHook(() => useSidePanelState(EVAL_A));
    expect(result.current.open).toBe(false);
    expect(result.current.activeTab).toBe("ask");
  });

  it("recovers from corrupted global localStorage payload", () => {
    window.localStorage.setItem(__test__.GLOBAL_KEY, "garbage");
    const { result } = renderHook(() => useSidePanelState(EVAL_A));
    expect(result.current.width).toBe(__test__.DEFAULT_GLOBAL.width);
  });

  it("toggleOpen flips the open flag and persists it across unmount", () => {
    const first = renderHook(() => useSidePanelState(EVAL_A));
    act(() => {
      first.result.current.toggleOpen();
    });
    expect(first.result.current.open).toBe(true);
    first.unmount();

    // Brand-new mount must read the persisted value.
    const second = renderHook(() => useSidePanelState(EVAL_A));
    expect(second.result.current.open).toBe(true);
    second.unmount();
  });

  it("hydrated flag flips true after first effect tick", () => {
    const { result } = renderHook(() => useSidePanelState(EVAL_A));
    // useEffect has already fired by the time renderHook returns in
    // jsdom with React 18 synchronous-effects-after-render.
    expect(result.current.hydrated).toBe(true);
  });
});
