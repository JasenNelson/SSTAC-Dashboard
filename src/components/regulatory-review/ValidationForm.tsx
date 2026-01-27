'use client';

import React, { useState, useCallback } from 'react';
import { CheckCircle, XCircle, AlertTriangle, Save, Loader2 } from 'lucide-react';

export type ValidationAssessment = 'TRUE_POSITIVE' | 'FALSE_POSITIVE' | 'TRUE_NEGATIVE' | 'FALSE_NEGATIVE';

interface ValidationFormProps {
  /** Current engine determination (PASS/FAIL) */
  engineResult: 'PASS' | 'PARTIAL' | 'FAIL' | 'REQUIRES_JUDGMENT';
  /** Current validation if already done */
  currentValidation?: {
    assessment: ValidationAssessment;
    notes: string;
    timestamp: string;
  };
  /** Callback when validation is saved */
  onSave: (validation: { assessment: ValidationAssessment; notes: string }) => Promise<void>;
  /** Whether save is in progress */
  isLoading?: boolean;
}

interface ValidationOption {
  value: ValidationAssessment;
  label: string;
  description: string;
  icon: typeof CheckCircle;
  colorClass: string;
  bgClass: string;
}

const VALIDATION_OPTIONS: ValidationOption[] = [
  {
    value: 'TRUE_POSITIVE',
    label: 'True Positive',
    description: 'Engine correctly identified a deficiency/issue',
    icon: CheckCircle,
    colorClass: 'text-green-700 dark:text-green-300',
    bgClass: 'bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-700',
  },
  {
    value: 'FALSE_POSITIVE',
    label: 'False Positive',
    description: "Engine flagged an issue that doesn't exist (over-flagging)",
    icon: XCircle,
    colorClass: 'text-red-700 dark:text-red-300',
    bgClass: 'bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-700',
  },
  {
    value: 'TRUE_NEGATIVE',
    label: 'True Negative',
    description: 'Engine correctly passed/found no issue',
    icon: CheckCircle,
    colorClass: 'text-blue-700 dark:text-blue-300',
    bgClass: 'bg-blue-50 dark:bg-blue-900/20 border-blue-300 dark:border-blue-700',
  },
  {
    value: 'FALSE_NEGATIVE',
    label: 'False Negative',
    description: 'Engine missed a real deficiency (under-flagging)',
    icon: AlertTriangle,
    colorClass: 'text-amber-700 dark:text-amber-300',
    bgClass: 'bg-amber-50 dark:bg-amber-900/20 border-amber-300 dark:border-amber-700',
  },
];

export default function ValidationForm({
  engineResult,
  currentValidation,
  onSave,
  isLoading = false,
}: ValidationFormProps) {
  const [selectedAssessment, setSelectedAssessment] = useState<ValidationAssessment | null>(
    currentValidation?.assessment || null
  );
  const [notes, setNotes] = useState(currentValidation?.notes || '');
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = useCallback(async () => {
    if (!selectedAssessment) return;

    setIsSaving(true);
    try {
      await onSave({ assessment: selectedAssessment, notes });
    } finally {
      setIsSaving(false);
    }
  }, [selectedAssessment, notes, onSave]);

  // Provide guidance based on engine result
  const getGuidanceText = () => {
    switch (engineResult) {
      case 'PASS':
        return 'Engine determined this requirement is satisfied. Is that correct?';
      case 'FAIL':
        return 'Engine flagged this as deficient. Is that accurate?';
      case 'PARTIAL':
        return 'Engine found partial evidence. Review if this is accurate.';
      case 'REQUIRES_JUDGMENT':
        return 'Engine deferred to human judgment. Validate the evidence found.';
      default:
        return 'Review the engine determination.';
    }
  };

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
      <div className="bg-gray-50 dark:bg-gray-800 px-4 py-3 border-b border-gray-200 dark:border-gray-700">
        <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
          Baseline Validation
        </h4>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          {getGuidanceText()}
        </p>
      </div>

      <div className="p-4 space-y-4">
        {/* Validation Options */}
        <div className="grid grid-cols-2 gap-3">
          {VALIDATION_OPTIONS.map((option) => {
            const Icon = option.icon;
            const isSelected = selectedAssessment === option.value;

            return (
              <label
                key={option.value}
                className={`
                  relative flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all
                  ${isSelected
                    ? `${option.bgClass} border-current`
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                  }
                `}
              >
                <input
                  type="radio"
                  name="validation"
                  value={option.value}
                  checked={isSelected}
                  onChange={() => setSelectedAssessment(option.value)}
                  className="sr-only"
                />
                <div className={`flex-shrink-0 mt-0.5 ${isSelected ? option.colorClass : 'text-gray-400'}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className={`text-sm font-medium ${isSelected ? option.colorClass : 'text-gray-900 dark:text-gray-100'}`}>
                    {option.label}
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    {option.description}
                  </p>
                </div>
              </label>
            );
          })}
        </div>

        {/* Notes */}
        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
            Validation Notes <span className="text-gray-400">(optional)</span>
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Explain why you selected this validation..."
            rows={2}
            className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
          />
        </div>

        {/* Save Button */}
        <div className="flex items-center justify-between pt-2 border-t border-gray-200 dark:border-gray-700">
          {currentValidation?.timestamp && (
            <span className="text-xs text-gray-500 dark:text-gray-400">
              Last validated: {new Date(currentValidation.timestamp).toLocaleString()}
            </span>
          )}
          <button
            onClick={handleSave}
            disabled={!selectedAssessment || isSaving || isLoading}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors ml-auto"
          >
            {(isSaving || isLoading) && <Loader2 className="w-4 h-4 animate-spin" />}
            <Save className="w-4 h-4" />
            Save Validation
          </button>
        </div>
      </div>
    </div>
  );
}
