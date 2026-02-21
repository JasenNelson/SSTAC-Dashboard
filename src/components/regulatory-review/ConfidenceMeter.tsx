'use client';

import React from 'react';

export type ConfidenceLevel = 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE';

export interface ConfidenceMeterProps {
  confidence: ConfidenceLevel;
  className?: string;
  showLabel?: boolean;
}

const confidenceConfig: Record<ConfidenceLevel, {
  label: string;
  segments: number;
  fillClass: string;
  textClass: string;
}> = {
  HIGH: {
    label: 'High',
    segments: 3,
    fillClass: 'bg-green-500 dark:bg-green-400',
    textClass: 'text-green-700 dark:text-green-300',
  },
  MEDIUM: {
    label: 'Medium',
    segments: 2,
    fillClass: 'bg-yellow-500 dark:bg-yellow-400',
    textClass: 'text-yellow-700 dark:text-yellow-300',
  },
  LOW: {
    label: 'Low',
    segments: 1,
    fillClass: 'bg-orange-500 dark:bg-orange-400',
    textClass: 'text-orange-700 dark:text-orange-300',
  },
  NONE: {
    label: 'None',
    segments: 0,
    fillClass: 'bg-gray-300 dark:bg-gray-600',
    textClass: 'text-gray-500 dark:text-gray-400',
  },
};

export default function ConfidenceMeter({
  confidence,
  className = '',
  showLabel = true
}: ConfidenceMeterProps) {
  // Defensive fallback for invalid/undefined confidence values
  const validConfidence = confidence && confidenceConfig[confidence] ? confidence : 'MEDIUM';
  const config = confidenceConfig[validConfidence];
  const totalSegments = 3;

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className="flex gap-0.5">
        {Array.from({ length: totalSegments }).map((_, index) => {
          const isFilled = index < config.segments;
          return (
            <div
              key={index}
              className={`w-3 h-5 rounded-sm ${
                isFilled
                  ? config.fillClass
                  : 'bg-gray-200 dark:bg-gray-700'
              }`}
            />
          );
        })}
      </div>
      {showLabel && (
        <span className={`text-xs font-medium ${config.textClass}`}>
          {config.label}
        </span>
      )}
    </div>
  );
}
