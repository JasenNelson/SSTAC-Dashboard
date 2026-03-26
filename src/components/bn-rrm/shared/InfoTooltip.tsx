'use client';

import { useState, useRef, useEffect, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Info } from 'lucide-react';
import { cn } from '@/utils/cn';

interface InfoTooltipProps {
  title: string;
  description: string;
  position?: 'top' | 'right' | 'bottom' | 'left';
  children?: ReactNode;
  className?: string;
  iconSize?: number;
}

export function InfoTooltip({
  title,
  description,
  position = 'top',
  children,
  className,
  iconSize = 14,
}: InfoTooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [adjustedPosition, setAdjustedPosition] = useState(position);
  const [tooltipStyle, setTooltipStyle] = useState<CSSProperties>({ visibility: 'hidden' });
  const tooltipRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!isVisible || !tooltipRef.current || !triggerRef.current) return;

    const trigger = triggerRef.current.getBoundingClientRect();
    const tooltip = tooltipRef.current.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const gap = 8;
    const margin = 8;

    let newPosition = position;
    if (position === 'top' && trigger.top - tooltip.height - gap < margin) newPosition = 'bottom';
    if (position === 'bottom' && trigger.bottom + tooltip.height + gap > viewportHeight - margin) newPosition = 'top';
    if (position === 'right' && trigger.right + tooltip.width + gap > viewportWidth - margin) newPosition = 'left';
    if (position === 'left' && trigger.left - tooltip.width - gap < margin) newPosition = 'right';

    if (newPosition !== adjustedPosition) {
      setAdjustedPosition(newPosition);
      return;
    }

    let top = 0;
    let left = 0;

    switch (adjustedPosition) {
      case 'top':
        top = trigger.top - tooltip.height - gap;
        left = trigger.left + (trigger.width / 2) - (tooltip.width / 2);
        break;
      case 'bottom':
        top = trigger.bottom + gap;
        left = trigger.left + (trigger.width / 2) - (tooltip.width / 2);
        break;
      case 'left':
        top = trigger.top + (trigger.height / 2) - (tooltip.height / 2);
        left = trigger.left - tooltip.width - gap;
        break;
      case 'right':
        top = trigger.top + (trigger.height / 2) - (tooltip.height / 2);
        left = trigger.right + gap;
        break;
    }

    const clampedTop = Math.min(Math.max(top, margin), viewportHeight - tooltip.height - margin);
    const clampedLeft = Math.min(Math.max(left, margin), viewportWidth - tooltip.width - margin);

    setTooltipStyle({
      position: 'fixed',
      top: `${clampedTop}px`,
      left: `${clampedLeft}px`,
      visibility: 'visible',
    });
  }, [isVisible, position, adjustedPosition]);

  useEffect(() => {
    if (!isVisible) {
      setAdjustedPosition(position);
      setTooltipStyle({ visibility: 'hidden' });
      return;
    }

    const handleViewportChange = () => {
      setTooltipStyle({ visibility: 'hidden' });
    };

    window.addEventListener('scroll', handleViewportChange, true);
    window.addEventListener('resize', handleViewportChange);

    return () => {
      window.removeEventListener('scroll', handleViewportChange, true);
      window.removeEventListener('resize', handleViewportChange);
    };
  }, [isVisible, position]);

  const tooltip = isVisible ? (
    <div
      ref={tooltipRef}
      className={cn(
        'fixed z-[100] w-64 p-3 rounded-lg shadow-lg',
        'bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600',
        'text-left pointer-events-none'
      )}
      style={tooltipStyle}
      role="tooltip"
    >
      <p className="text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">
        {title}
      </p>
      <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
        {description}
      </p>
    </div>
  ) : null;

  return (
    <>
      <span
        ref={triggerRef}
        className={cn('inline-flex items-center', className)}
        onMouseEnter={() => setIsVisible(true)}
        onMouseLeave={() => setIsVisible(false)}
        onFocus={() => setIsVisible(true)}
        onBlur={() => setIsVisible(false)}
        tabIndex={0}
        role="button"
        aria-label={`Info: ${title}`}
      >
        {children || (
          <Info
            className="text-slate-400 dark:text-slate-500 hover:text-blue-500 dark:hover:text-blue-400 cursor-help transition-colors"
            size={iconSize}
          />
        )}
      </span>
      {tooltip && createPortal(tooltip, document.body)}
    </>
  );
}
