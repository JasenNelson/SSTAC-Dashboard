'use client';

// Mobile-viewport detection hook for the matrix-options Interactive
// Map (PR-MAP-17a fallback per docs/design/matrix-map/PLAN_V3_4_2.md
// section 3.8). Returns true when the viewport is narrower than the
// MOBILE_BREAKPOINT_PX threshold (768 px, matching the spec's
// "tablet or wider" cutoff).
//
// SSR + jsdom safety: returns false on the server (no window) and
// when window.matchMedia is absent (e.g., vitest jsdom default).
// Consumers that explicitly want to assert mobile behavior in tests
// should mock window.matchMedia per the matchMedia-mock pattern in
// src/hooks/__tests__/useIsMobile.test.ts.
//
// Plain ASCII only.

import { useEffect, useState } from 'react';

export const MOBILE_BREAKPOINT_PX = 768;

export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT_PX - 1}px)`);
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  return isMobile;
}
