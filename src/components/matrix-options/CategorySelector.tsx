'use client';

// CategorySelector -- 2x2 grid of matrix-category radio buttons for the
// Calculator tab. PR-A2: HH categories are disabled (HH calculators ship
// in PR-A4 after HITL sign-off on disclaimer copy). Mobile collapses to a
// single column. Each button is >= 44px tall (WCAG 2.5.5 touch target).
//
// Accessibility (plan v3 section 10 + v6):
//   - role="radiogroup" on the container
//   - role="radio" + aria-checked on each button
//   - roving tabindex: only the selected enabled button is in the tab order
//   - arrow keys (left/right/up/down) cycle through enabled buttons only
//   - Home/End jump to first/last enabled button
//   - disabled buttons get aria-disabled + the HTML disabled attribute and
//     are skipped by both Tab and arrow-key navigation
//
// Plain ASCII only.

import React, { useRef } from 'react';
import { cn } from '@/utils/cn';
import type { MatrixCategory } from './guide/content/types';

export interface CategorySelectorProps {
  activeCategory: MatrixCategory;
  onChange: (category: MatrixCategory) => void;
  // Whether HH categories are enabled. Defaults to false (PR-A2 ships HH
  // disabled; PR-A4 will pass true after HITL sign-off).
  hhEnabled?: boolean;
  className?: string;
}

interface CategoryDescriptor {
  id: MatrixCategory;
  label: string;       // accessible label (full name)
  shortLabel: string;  // visible label (2x2 grid space-constrained)
  group: 'eco' | 'hh';
}

const CATEGORIES: ReadonlyArray<CategoryDescriptor> = [
  {
    id: 'eco-direct',
    label: 'Ecological Health -- Direct Contact',
    shortLabel: 'Ecological: Direct Contact',
    group: 'eco',
  },
  {
    id: 'eco-food',
    label: 'Ecological Health -- Food Web',
    shortLabel: 'Ecological: Food Web',
    group: 'eco',
  },
  {
    id: 'hh-direct',
    label: 'Human Health -- Direct Contact',
    shortLabel: 'Human Health: Direct Contact',
    group: 'hh',
  },
  {
    id: 'hh-food',
    label: 'Human Health -- Food Web',
    shortLabel: 'Human Health: Food Web',
    group: 'hh',
  },
];

const HH_DISABLED_TOOLTIP =
  'Coming soon -- calculator and guidance pending HITL sign-off';

export default function CategorySelector({
  activeCategory,
  onChange,
  hhEnabled = false,
  className,
}: CategorySelectorProps) {
  const buttonRefs = useRef<Record<MatrixCategory, HTMLButtonElement | null>>({
    'eco-direct': null,
    'eco-food': null,
    'hh-direct': null,
    'hh-food': null,
  });

  const isEnabled = (id: MatrixCategory): boolean => {
    if (id === 'hh-direct' || id === 'hh-food') return hhEnabled;
    return true;
  };

  const enabledIds: MatrixCategory[] = CATEGORIES
    .filter((c) => isEnabled(c.id))
    .map((c) => c.id);

  // Defense-in-depth (cursor-agent review 2026-05-19 P2 #1): if the parent
  // hands us an activeCategory that is currently disabled (e.g., stale
  // localStorage value before MatrixDashboard's validate-on-load coercion
  // runs in commit 6, or any test fixture), the naive rule "selected
  // enabled button is tabbable" would leave the entire radiogroup with
  // tabIndex=-1 on every button -- a keyboard-only user could not reach
  // the control at all. Fall back to the first enabled button so the
  // radiogroup always has exactly one tabbable entry per ARIA practice.
  const fallbackTabbableId: MatrixCategory | null = isEnabled(activeCategory)
    ? activeCategory
    : enabledIds[0] ?? null;

  const handleKeyDown = (
    event: React.KeyboardEvent<HTMLButtonElement>,
    currentId: MatrixCategory,
  ): void => {
    // Native <button> elements fire onClick on Enter/Space in real browsers,
    // but jsdom does NOT simulate that, which made the prior Enter test
    // misleading (it dispatched click, not keydown). Codex review
    // 2026-05-19 P2 caught this. Handle Enter + Space explicitly so the
    // keyboard contract holds in both jsdom AND real browsers; also keeps
    // the implementation independent of any future jsdom behavior change.
    if (event.key === 'Enter' || event.key === ' ') {
      // currentId is the focused button; onKeyDown is only wired on
      // enabled buttons via the DOM, so disabled-skip is implicit.
      event.preventDefault();
      onChange(currentId);
      return;
    }

    const navKeys = [
      'ArrowRight',
      'ArrowLeft',
      'ArrowDown',
      'ArrowUp',
      'Home',
      'End',
    ];
    if (!navKeys.includes(event.key)) return;
    if (enabledIds.length === 0) return;
    event.preventDefault();

    const currentIdx = enabledIds.indexOf(currentId);
    // Defensive: if the focused button is disabled (shouldn't be tabbable,
    // but guard against programmatic focus), fall back to index 0.
    const safeIdx = currentIdx === -1 ? 0 : currentIdx;

    let nextIdx = safeIdx;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      nextIdx = (safeIdx + 1) % enabledIds.length;
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      nextIdx = (safeIdx - 1 + enabledIds.length) % enabledIds.length;
    } else if (event.key === 'Home') {
      nextIdx = 0;
    } else if (event.key === 'End') {
      nextIdx = enabledIds.length - 1;
    }

    const nextId = enabledIds[nextIdx];
    onChange(nextId);
    // Roving-tabindex focus follow-up.
    const nextBtn = buttonRefs.current[nextId];
    nextBtn?.focus();
  };

  return (
    <div
      role="radiogroup"
      aria-label="Matrix category selector"
      data-testid="category-selector"
      className={cn(
        // 2x2 grid on md+ viewports; single-column stack on mobile.
        'grid grid-cols-1 md:grid-cols-2 gap-3 w-full',
        className,
      )}
    >
      {CATEGORIES.map((cat) => {
        const enabled = isEnabled(cat.id);
        const selected = activeCategory === cat.id;
        // Roving tabindex: exactly one enabled button is in the tab order.
        // Disabled buttons are removed entirely. The chosen-tabbable button
        // is normally the active one, but if the active one is disabled we
        // fall back to the first enabled (see fallbackTabbableId comment).
        const tabIndex =
          enabled && cat.id === fallbackTabbableId ? 0 : -1;

        return (
          <button
            key={cat.id}
            ref={(el) => {
              buttonRefs.current[cat.id] = el;
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-disabled={!enabled || undefined}
            aria-label={cat.label}
            disabled={!enabled}
            tabIndex={tabIndex}
            title={!enabled ? HH_DISABLED_TOOLTIP : undefined}
            onClick={() => {
              if (!enabled) return;
              onChange(cat.id);
            }}
            onKeyDown={(e) => handleKeyDown(e, cat.id)}
            className={cn(
              'min-h-[44px] w-full px-4 py-3 rounded-lg border text-left text-sm font-semibold transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-900',
              !enabled &&
                'opacity-60 cursor-not-allowed bg-slate-50 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-500',
              enabled &&
                selected &&
                'bg-sky-600 text-white border-sky-600 shadow-sm dark:bg-sky-500 dark:border-sky-500',
              enabled &&
                !selected &&
                'bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-sky-400 dark:hover:border-sky-500',
            )}
            data-testid={`category-selector-${cat.id}`}
          >
            <span className="block">{cat.shortLabel}</span>
            {!enabled && (
              <span className="mt-1 block text-xs font-normal text-slate-500 dark:text-slate-400">
                Coming soon
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
