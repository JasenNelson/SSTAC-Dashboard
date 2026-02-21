'use client';

import { useReducer, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { isLocalEngineClient } from '@/lib/feature-flags';
import UnderConstruction from '@/components/ui/UnderConstruction';
import StepperHeader from './StepperHeader';
import ApplicationTypeSelector from './ApplicationTypeSelector';
import ServiceSelector from './ServiceSelector';
import SiteInfoForm from './SiteInfoForm';
import FileUploader from './FileUploader';
import ProcessLauncher from './ProcessLauncher';
import {
  type WizardState,
  type WizardAction,
  INITIAL_WIZARD_STATE,
  STEPS,
} from './types';

// =============================================================================
// Reducer
// =============================================================================

function wizardReducer(state: WizardState, action: WizardAction): WizardState {
  switch (action.type) {
    case 'SET_STEP':
      return { ...state, currentStep: action.step };

    case 'COMPLETE_STEP':
      if (state.completedSteps.includes(action.step)) return state;
      return { ...state, completedSteps: [...state.completedSteps, action.step] };

    case 'TOGGLE_APPLICATION_TYPE': {
      const exists = state.applicationTypes.includes(action.serviceId);
      return {
        ...state,
        applicationTypes: exists
          ? state.applicationTypes.filter((id) => id !== action.serviceId)
          : [...state.applicationTypes, action.serviceId],
      };
    }

    case 'TOGGLE_SERVICE': {
      const exists = state.selectedServices.includes(action.serviceId);
      return {
        ...state,
        selectedServices: exists
          ? state.selectedServices.filter((id) => id !== action.serviceId)
          : [...state.selectedServices, action.serviceId],
      };
    }

    case 'SET_SERVICES':
      return { ...state, selectedServices: action.serviceIds };

    case 'UPDATE_SITE_INFO':
      return {
        ...state,
        siteInfo: { ...state.siteInfo, [action.field]: action.value },
      };

    case 'ADD_FILES':
      return { ...state, files: [...state.files, ...action.files] };

    case 'REMOVE_FILE':
      return { ...state, files: state.files.filter((f) => f.id !== action.fileId) };

    case 'NEXT_STEP': {
      const next = Math.min(state.currentStep + 1, STEPS.length - 1);
      const completed = state.completedSteps.includes(state.currentStep)
        ? state.completedSteps
        : [...state.completedSteps, state.currentStep];
      return { ...state, currentStep: next, completedSteps: completed };
    }

    case 'PREV_STEP':
      return { ...state, currentStep: Math.max(state.currentStep - 1, 0) };

    case 'RESET':
      return { ...INITIAL_WIZARD_STATE };

    default:
      return state;
  }
}

// =============================================================================
// Validation
// =============================================================================

function canProceed(state: WizardState): boolean {
  switch (state.currentStep) {
    case 0:
      return state.applicationTypes.length > 0;
    case 1:
      return true; // Services are optional
    case 2: {
      const { siteId, siteName, applicantName, submissionDate } = state.siteInfo;
      return !!(siteId && siteName && applicantName && submissionDate);
    }
    case 3:
      return state.files.length >= 1;
    case 4:
      return false; // Terminal step — no "Continue" button
    default:
      return false;
  }
}

// =============================================================================
// Component
// =============================================================================

export default function ReviewWizard() {
  const [state, dispatch] = useReducer(wizardReducer, INITIAL_WIZARD_STATE);
  const router = useRouter();
  const engineEnabled = isLocalEngineClient();

  const handleStepClick = useCallback(
    (step: number) => dispatch({ type: 'SET_STEP', step }),
    [],
  );

  const handleComplete = useCallback(
    (projectId: string) => {
      router.push(`/regulatory-review/${projectId}`);
    },
    [router],
  );

  if (!engineEnabled) {
    return <UnderConstruction feature="New Review Project" />;
  }

  const renderStep = () => {
    switch (state.currentStep) {
      case 0:
        return (
          <ApplicationTypeSelector
            selectedTypes={state.applicationTypes}
            onToggle={(id) => dispatch({ type: 'TOGGLE_APPLICATION_TYPE', serviceId: id })}
          />
        );
      case 1:
        return (
          <ServiceSelector
            selectedServices={state.selectedServices}
            applicationTypes={state.applicationTypes}
            onToggle={(id) => dispatch({ type: 'TOGGLE_SERVICE', serviceId: id })}
          />
        );
      case 2:
        return (
          <SiteInfoForm
            siteInfo={state.siteInfo}
            onChange={(field, value) =>
              dispatch({ type: 'UPDATE_SITE_INFO', field, value })
            }
          />
        );
      case 3:
        return (
          <FileUploader
            files={state.files}
            onAdd={(files) => dispatch({ type: 'ADD_FILES', files })}
            onRemove={(fileId) => dispatch({ type: 'REMOVE_FILE', fileId })}
          />
        );
      case 4:
        return (
          <ProcessLauncher
            wizardState={state}
            onComplete={handleComplete}
          />
        );
      default:
        return null;
    }
  };

  const isFirstStep = state.currentStep === 0;
  const isLastStep = state.currentStep === STEPS.length - 1;

  return (
    <div className="max-w-4xl mx-auto">
      <StepperHeader
        currentStep={state.currentStep}
        completedSteps={state.completedSteps}
        onStepClick={handleStepClick}
      />

      {/* Step content */}
      <div className="mt-6 bg-white dark:bg-gray-900 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        {renderStep()}
      </div>

      {/* Navigation buttons */}
      {!isLastStep && (
        <div className="mt-4 flex items-center justify-between">
          <div>
            {!isFirstStep && (
              <button
                type="button"
                onClick={() => dispatch({ type: 'PREV_STEP' })}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                Back
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={() => dispatch({ type: 'NEXT_STEP' })}
            disabled={!canProceed(state)}
            className={`
              px-6 py-2 text-sm font-medium rounded-lg transition-colors
              ${canProceed(state)
                ? 'text-white bg-indigo-600 dark:bg-indigo-500 hover:bg-indigo-700 dark:hover:bg-indigo-600'
                : 'text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-800 cursor-not-allowed'
              }
            `}
          >
            Continue
          </button>
        </div>
      )}
    </div>
  );
}
