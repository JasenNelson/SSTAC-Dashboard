'use client';

import { CheckCircle2 } from 'lucide-react';
import { STEPS } from './types';

interface StepperHeaderProps {
  currentStep: number;
  completedSteps: number[];
  onStepClick: (step: number) => void;
}

export default function StepperHeader({
  currentStep,
  completedSteps,
  onStepClick,
}: StepperHeaderProps) {
  return (
    <nav aria-label="Wizard progress" className="w-full px-2 py-4">
      <ol className="flex items-center w-full">
        {STEPS.map((step, index) => {
          const isCompleted = completedSteps.includes(index);
          const isActive = currentStep === index;
          const isClickable = isCompleted;

          return (
            <li
              key={index}
              className={`flex items-center ${index < STEPS.length - 1 ? 'flex-1' : ''}`}
            >
              {/* Step circle + label */}
              <div className="flex flex-col items-center">
                <button
                  type="button"
                  onClick={() => isClickable && onStepClick(index)}
                  disabled={!isClickable}
                  className={`
                    flex items-center justify-center w-10 h-10 rounded-full text-sm font-semibold
                    transition-all duration-200
                    ${isCompleted
                      ? 'bg-emerald-500 text-white cursor-pointer hover:bg-emerald-600'
                      : isActive
                        ? 'bg-white dark:bg-gray-900 text-indigo-600 dark:text-indigo-400 ring-2 ring-indigo-500'
                        : 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-default'
                    }
                  `}
                  aria-current={isActive ? 'step' : undefined}
                >
                  {isCompleted ? (
                    <CheckCircle2 className="w-5 h-5" />
                  ) : (
                    <span>{index + 1}</span>
                  )}
                </button>
                <span
                  className={`
                    mt-2 text-xs font-medium text-center
                    ${isActive ? 'text-indigo-600 dark:text-indigo-400' : isCompleted ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-400 dark:text-gray-500'}
                  `}
                >
                  <span className="hidden sm:inline">{step.label}</span>
                  <span className="sm:hidden">{step.shortLabel}</span>
                </span>
              </div>

              {/* Connecting line */}
              {index < STEPS.length - 1 && (
                <div
                  className={`
                    flex-1 h-0.5 mx-2 transition-colors duration-200
                    ${completedSteps.includes(index) ? 'bg-emerald-400' : 'bg-gray-200 dark:bg-gray-700'}
                  `}
                />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
