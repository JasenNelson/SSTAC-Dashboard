'use client';

// Inline glossary popover component.
//
// Wraps an arbitrary inline display string (children) with a subtle dotted-
// underline trigger that reveals a popover containing the canonical glossary
// definition. Hover reveals `short`; click toggles a sticky expanded state
// that also shows `full` + `cite` (when present).
//
// Accessibility:
//   - Rendered as <dfn> with role="button", tabIndex=0, aria-describedby on
//     the popover.
//   - Keyboard: Enter / Space toggles the sticky state; Escape closes.
//   - The trigger has cursor-help; the popover is a small dark card with a
//     centered tail.
//
// Discipline:
//   - If `term` is not in GLOSSARY: render children as plain text and
//     console.warn in development. Never break the build.
//   - ASCII only; no emoji. Subtle visual rhythm; not jarring.

import { useEffect, useId, useRef, useState } from 'react';
import { GLOSSARY } from './glossary';

interface DefinedTermProps {
  term: string;
  children?: React.ReactNode;
}

export function DefinedTerm({ term, children }: DefinedTermProps) {
  const entry = GLOSSARY[term];
  const [hovered, setHovered] = useState(false);
  const [sticky, setSticky] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const popoverId = useId();
  const containerRef = useRef<HTMLSpanElement | null>(null);

  // Display text: explicit children override; fallback to the canonical term.
  const display = children ?? term;

  // Dev-only warn when the term is missing from the dictionary. This is a
  // soft failure so the surrounding prose still renders.
  useEffect(() => {
    if (!entry && process.env.NODE_ENV !== 'production') {
      console.warn(
        `[DefinedTerm] term not found in GLOSSARY: "${term}". ` +
          `Rendering children as plain text. Add an entry to ` +
          `src/components/regulatory-review/methodology/glossary.ts.`
      );
    }
  }, [entry, term]);

  // Close-on-outside-click for the sticky state.
  useEffect(() => {
    if (!sticky) return;
    function onDocClick(e: MouseEvent) {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(e.target as Node)) {
        setSticky(false);
        setExpanded(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setSticky(false);
        setExpanded(false);
      }
    }
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [sticky]);

  // Missing entry: render plain text inline.
  if (!entry) {
    return <span>{display}</span>;
  }

  const open = hovered || sticky;
  const showFull = sticky && expanded && entry.full;

  function handleToggle() {
    setSticky((prev) => {
      const next = !prev;
      if (!next) setExpanded(false);
      return next;
    });
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLSpanElement>) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleToggle();
    }
  }

  return (
    <span
      ref={containerRef}
      className="relative inline-block"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <dfn
        role="button"
        tabIndex={0}
        aria-describedby={open ? popoverId : undefined}
        aria-expanded={sticky}
        onClick={handleToggle}
        onKeyDown={handleKeyDown}
        className={
          'not-italic border-b border-dotted border-slate-400 ' +
          'dark:border-slate-500 cursor-help outline-none ' +
          'focus-visible:bg-amber-50 focus-visible:dark:bg-amber-900/20 ' +
          'focus-visible:border-amber-500 ' +
          'hover:bg-amber-50 hover:dark:bg-amber-900/20 ' +
          'transition-colors duration-150 rounded-sm'
        }
      >
        {display}
      </dfn>
      {open && (
        <span
          id={popoverId}
          role="tooltip"
          className={
            'absolute left-1/2 -translate-x-1/2 bottom-full mb-2 z-50 ' +
            'block w-max max-w-xs ' +
            'bg-slate-800 dark:bg-slate-100 ' +
            'text-white dark:text-slate-900 ' +
            'text-xs leading-snug p-3 rounded-md shadow-lg ' +
            'pointer-events-auto'
          }
        >
          <span className="block font-semibold mb-1 text-slate-100 dark:text-slate-800">
            {entry.term}
          </span>
          <span className="block">{entry.short}</span>
          {showFull && (
            <>
              <span className="block mt-2 pt-2 border-t border-slate-600 dark:border-slate-300">
                {entry.full}
              </span>
              {entry.cite && (
                <span className="block mt-2 text-[10px] italic text-slate-300 dark:text-slate-600">
                  Source: {entry.cite}
                </span>
              )}
            </>
          )}
          {sticky && !expanded && entry.full && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setExpanded(true);
              }}
              className={
                'mt-2 text-[10px] underline ' +
                'text-slate-200 hover:text-white ' +
                'dark:text-slate-700 dark:hover:text-slate-900'
              }
            >
              show more
            </button>
          )}
          {sticky && !entry.full && entry.cite && (
            <span className="block mt-2 text-[10px] italic text-slate-300 dark:text-slate-600">
              Source: {entry.cite}
            </span>
          )}
          <span
            aria-hidden="true"
            className={
              'absolute left-1/2 -translate-x-1/2 top-full ' +
              'w-0 h-0 border-l-4 border-r-4 border-t-4 ' +
              'border-l-transparent border-r-transparent ' +
              'border-t-slate-800 dark:border-t-slate-100'
            }
          />
        </span>
      )}
    </span>
  );
}
