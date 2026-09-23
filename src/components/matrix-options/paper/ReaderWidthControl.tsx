'use client';

import { useRef } from 'react';
import type { KeyboardEvent } from 'react';

import type { ReaderWidth } from '@/lib/matrix-options/paper/reader-width';
import { cn } from '@/utils/cn';

const OPTIONS: readonly { readonly value: ReaderWidth; readonly label: string }[] = [
  { value: 'comfortable', label: 'Comfortable' },
  { value: 'wide', label: 'Wide' },
];

/**
 * Reading width preference: a two-option radio group (roving focus, arrow keys
 * move and select). It scales the ADAPTIVE prose measure; it never fixes a
 * viewport layout.
 */
export function ReaderWidthControl({ value, onChange }: { readonly value: ReaderWidth; readonly onChange: (value: ReaderWidth) => void }) {
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const step = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 0;
    if (step === 0) return;
    event.preventDefault();
    const next = (index + step + OPTIONS.length) % OPTIONS.length;
    onChange(OPTIONS[next].value);
    buttons.current[next]?.focus({ preventScroll: true });
  };
  return (
    <div className="flex min-w-0 items-center gap-2">
      <span id="reader-width-label" className="text-xs font-medium text-[var(--db-text-secondary)]">Reading width</span>
      <div role="radiogroup" aria-labelledby="reader-width-label" data-testid="reader-width-control" className="inline-flex rounded-md border border-[var(--db-border)] bg-[var(--db-surface)] p-0.5">
        {OPTIONS.map((option, index) => {
          const checked = option.value === value;
          return (
            <button
              key={option.value}
              ref={(element) => { buttons.current[index] = element; }}
              type="button"
              role="radio"
              aria-checked={checked}
              tabIndex={checked ? 0 : -1}
              data-testid={`reader-width-${option.value}`}
              onClick={() => onChange(option.value)}
              onKeyDown={(event) => onKeyDown(event, index)}
              className={cn(
                'min-h-[44px] min-w-[44px] rounded px-3 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--db-focus-ring)] motion-safe:transition-colors motion-reduce:transition-none',
                checked ? 'bg-[var(--db-accent-tint)] font-semibold text-[var(--db-text-primary)]' : 'text-[var(--db-text-secondary)] hover:bg-[var(--db-depth-1)]',
              )}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
