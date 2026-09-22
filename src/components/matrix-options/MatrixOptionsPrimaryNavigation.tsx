'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

import ScrollFadeRegion from '@/components/ScrollFadeRegion';
import {
  MATRIX_OPTIONS_VIEWS,
  matrixOptionsPrimaryTabId,
  type MatrixOptionsViewId,
} from '@/lib/matrix-options/navigation';
import { cn } from '@/utils/cn';

interface MatrixOptionsPrimaryNavigationProps {
  activeViewId: MatrixOptionsViewId;
  onSelectView?: (viewId: MatrixOptionsViewId) => void;
  paperWorkspaceEnabled: boolean;
  panelId?: string;
  paperRoute?: boolean;
}

export default function MatrixOptionsPrimaryNavigation({
  activeViewId,
  onSelectView,
  paperWorkspaceEnabled,
  panelId,
  paperRoute = false,
}: MatrixOptionsPrimaryNavigationProps) {
  const router = useRouter();
  const refs = useRef<Record<MatrixOptionsViewId, HTMLButtonElement | null>>(
    {} as Record<MatrixOptionsViewId, HTMLButtonElement | null>,
  );
  const [focusedViewId, setFocusedViewId] = useState(activeViewId);
  const [ready, setReady] = useState(false);

  useEffect(() => setReady(true), []);
  useEffect(() => setFocusedViewId(activeViewId), [activeViewId]);

  const activate = (viewId: MatrixOptionsViewId) => {
    setFocusedViewId(viewId);
    const definition = MATRIX_OPTIONS_VIEWS.find((view) => view.id === viewId)!;
    if (viewId === 'TWG Review' && paperWorkspaceEnabled) {
      router.push(definition.paperHref!);
      return;
    }
    if (onSelectView) {
      onSelectView(viewId);
      return;
    }
    router.push(definition.dashboardHref);
  };

  const onKeyDown = (
    event: React.KeyboardEvent<HTMLButtonElement>,
    currentViewId: MatrixOptionsViewId,
  ) => {
    if (!['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const currentIndex = MATRIX_OPTIONS_VIEWS.findIndex((view) => view.id === currentViewId);
    let nextIndex = currentIndex < 0 ? 0 : currentIndex;
    if (event.key === 'ArrowRight') nextIndex = (nextIndex + 1) % MATRIX_OPTIONS_VIEWS.length;
    if (event.key === 'ArrowLeft') {
      nextIndex = (nextIndex - 1 + MATRIX_OPTIONS_VIEWS.length) % MATRIX_OPTIONS_VIEWS.length;
    }
    if (event.key === 'Home') nextIndex = 0;
    if (event.key === 'End') nextIndex = MATRIX_OPTIONS_VIEWS.length - 1;
    const nextViewId = MATRIX_OPTIONS_VIEWS[nextIndex].id;
    setFocusedViewId(nextViewId);
    refs.current[nextViewId]?.focus();
  };

  return (
    <ScrollFadeRegion
      fadeFrom="from-white dark:from-slate-800"
      captionText=""
      className="py-0.5"
    >
      <nav aria-label="Matrix Options primary">
        <div
          role="tablist"
          aria-label="Matrix Options"
          data-primary-tablist-ready={ready ? 'true' : undefined}
          className="flex w-max gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-700"
        >
          {MATRIX_OPTIONS_VIEWS.map((view) => {
            const selected = activeViewId === view.id;
            return (
              <button
                key={view.id}
                ref={(element) => {
                  refs.current[view.id] = element;
                }}
                type="button"
                role="tab"
                id={matrixOptionsPrimaryTabId(view.id)}
                aria-selected={selected}
                aria-controls={selected ? panelId : undefined}
                tabIndex={focusedViewId === view.id ? 0 : -1}
                onClick={() => activate(view.id)}
                onKeyDown={(event) => onKeyDown(event, view.id)}
                className={cn(
                  'relative flex min-h-[44px] items-center gap-2 whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900',
                  selected
                    ? 'bg-white text-sky-600 shadow-sm dark:bg-slate-600 dark:text-sky-400'
                    : 'text-slate-500 hover:bg-white/50 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-600/50 dark:hover:text-slate-200',
                )}
              >
                <span>{paperRoute ? view.paperLabel : view.dashboardLabel}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </ScrollFadeRegion>
  );
}
