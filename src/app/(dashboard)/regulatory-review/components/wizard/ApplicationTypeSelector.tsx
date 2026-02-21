'use client';

import { useState } from 'react';
import {
  Search,
  ClipboardList,
  Wrench,
  ShieldCheck,
  CheckSquare,
  Award,
  FileSignature,
  Microscope,
  ChevronRight,
  ChevronDown,
  Check,
} from 'lucide-react';
import {
  LIFECYCLE_STAGES,
  getServicesByStage,
  type LifecycleStage,
  type Schedule3Service,
} from '@/lib/regulatory-review/schedule3';

interface ApplicationTypeSelectorProps {
  selectedTypes: string[];
  onToggle: (serviceId: string) => void;
}

const STAGE_ICONS: Record<LifecycleStage, React.ComponentType<{ className?: string }>> = {
  'site-determination': Search,
  investigation: ClipboardList,
  remediation: Wrench,
  'risk-assessment': ShieldCheck,
  confirmation: CheckSquare,
  certification: Award,
  agreements: FileSignature,
  specialized: Microscope,
};

function StageCard({
  stage,
  services,
  isExpanded,
  selectedTypes,
  onExpandToggle,
  onToggle,
}: {
  stage: (typeof LIFECYCLE_STAGES)[number];
  services: Schedule3Service[];
  isExpanded: boolean;
  selectedTypes: string[];
  onExpandToggle: () => void;
  onToggle: (serviceId: string) => void;
}) {
  const Icon = STAGE_ICONS[stage.id] || Search;
  const selectedCount = services.filter((s) => selectedTypes.includes(s.id)).length;
  const hasSelection = selectedCount > 0;

  return (
    <div
      className={`
        rounded-lg border-2 transition-all duration-200 overflow-hidden
        ${isExpanded
          ? 'border-indigo-400 dark:border-indigo-500 shadow-md'
          : hasSelection
            ? 'border-indigo-300 dark:border-indigo-600 bg-indigo-50/50 dark:bg-indigo-900/20'
            : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 hover:shadow-sm'
        }
      `}
    >
      {/* Stage header - always visible */}
      <button
        type="button"
        onClick={onExpandToggle}
        className="w-full p-4 flex items-center gap-4 text-left"
      >
        <div
          className={`
            flex-shrink-0 w-12 h-12 rounded-lg flex items-center justify-center
            ${isExpanded || hasSelection ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-300' : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'}
          `}
        >
          <Icon className="w-6 h-6" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-base font-semibold text-gray-900 dark:text-white">{stage.name}</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-1">{stage.description}</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {hasSelection && (
            <span className="text-xs font-medium text-indigo-600 dark:text-indigo-300 bg-indigo-100 dark:bg-indigo-900/30 px-2 py-1 rounded-full">
              {selectedCount} selected
            </span>
          )}
          <span className="text-xs font-medium text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded-full">
            {services.length} {services.length === 1 ? 'service' : 'services'}
          </span>
          {isExpanded ? (
            <ChevronDown className="w-5 h-5 text-indigo-500" />
          ) : (
            <ChevronRight className="w-5 h-5 text-gray-400 dark:text-gray-500" />
          )}
        </div>
      </button>

      {/* Expanded services list */}
      <div
        className={`
          transition-all duration-200 ease-in-out
          ${isExpanded ? 'max-h-[800px] opacity-100' : 'max-h-0 opacity-0'}
          overflow-hidden
        `}
      >
        <div className="px-4 pb-4 space-y-2 border-t border-gray-100 dark:border-gray-800 pt-3">
          {services.map((service) => {
            const isSelected = selectedTypes.includes(service.id);
            return (
              <button
                key={service.id}
                type="button"
                onClick={() => onToggle(service.id)}
                className={`
                  w-full text-left rounded-lg p-3 flex items-start gap-3 transition-colors
                  ${isSelected
                    ? 'bg-indigo-100 dark:bg-indigo-900/30 ring-1 ring-indigo-300 dark:ring-indigo-600'
                    : 'hover:bg-gray-50 dark:hover:bg-gray-800'
                  }
                `}
              >
                {/* Checkbox */}
                <div
                  className={`
                    mt-0.5 flex-shrink-0 w-4 h-4 rounded border-2 flex items-center justify-center
                    ${isSelected ? 'border-indigo-500 bg-indigo-500' : 'border-gray-300 dark:border-gray-600'}
                  `}
                >
                  {isSelected && (
                    <Check className="w-3 h-3 text-white" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-900 dark:text-white">{service.name}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{service.description}</div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs px-1.5 py-0.5 rounded bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-300">
                      Schedule {service.scheduleTable}
                    </span>
                    <span
                      className="text-xs text-gray-400 dark:text-gray-500 cursor-help"
                      title={`Simple: ${service.feeTierSimple} | Complex: ${service.feeTierComplex}`}
                    >
                      Fee: {service.feeTierSimple} - {service.feeTierComplex}
                    </span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function ApplicationTypeSelector({
  selectedTypes,
  onToggle,
}: ApplicationTypeSelectorProps) {
  const [expandedStage, setExpandedStage] = useState<LifecycleStage | null>(null);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Select Application Type</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Choose one or more services for this submission. Click a category to see available services.
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {LIFECYCLE_STAGES.map((stage) => {
          const services = getServicesByStage(stage.id);
          return (
            <StageCard
              key={stage.id}
              stage={stage}
              services={services}
              isExpanded={expandedStage === stage.id}
              selectedTypes={selectedTypes}
              onExpandToggle={() =>
                setExpandedStage((prev) => (prev === stage.id ? null : stage.id))
              }
              onToggle={onToggle}
            />
          );
        })}
      </div>
      {selectedTypes.length > 0 && (
        <p className="text-sm text-indigo-600 dark:text-indigo-400 font-medium">
          {selectedTypes.length} service{selectedTypes.length !== 1 ? 's' : ''} selected
        </p>
      )}
    </div>
  );
}
