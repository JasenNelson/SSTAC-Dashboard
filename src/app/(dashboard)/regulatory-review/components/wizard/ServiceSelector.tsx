'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import {
  SERVICES,
  getServiceById,
  type Schedule3Service,
} from '@/lib/regulatory-review/schedule3';

interface ServiceSelectorProps {
  selectedServices: string[];
  applicationTypes: string[];
  onToggle: (serviceId: string) => void;
}

function ServiceCheckbox({
  service,
  isSelected,
  onToggle,
}: {
  service: Schedule3Service;
  isSelected: boolean;
  onToggle: () => void;
}) {
  return (
    <label
      className={`
        flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-colors
        ${isSelected ? 'bg-sky-50 dark:bg-sky-900/20' : 'hover:bg-slate-50 dark:hover:bg-slate-800'}
      `}
    >
      <input
        type="checkbox"
        checked={isSelected}
        onChange={onToggle}
        className="mt-0.5 h-4 w-4 rounded border-slate-300 dark:border-slate-600 text-sky-600 focus:ring-sky-500 dark:bg-slate-800"
      />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-slate-900 dark:text-white">{service.name}</div>
        <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{service.description}</div>
      </div>
    </label>
  );
}

export default function ServiceSelector({
  selectedServices,
  applicationTypes,
  onToggle,
}: ServiceSelectorProps) {
  const [showOther, setShowOther] = useState(false);
  const [showApprovedProfessional, setShowApprovedProfessional] = useState(false);

  // Determine the lifecycle stages of all selected application types
  const selectedStages = new Set(
    applicationTypes
      .map((id) => getServiceById(id)?.lifecycleStage)
      .filter(Boolean) as string[],
  );

  // Partition services: related (same stage, excluding primary selections), other, AP
  const relatedServices: Schedule3Service[] = [];
  const otherServices: Schedule3Service[] = [];

  SERVICES.forEach((s) => {
    // Skip services already selected as application types
    if (applicationTypes.includes(s.id)) return;

    if (s.isApprovedProfessional) {
      // AP services handled by the toggle below
      return;
    }

    if (selectedStages.size > 0 && selectedStages.has(s.lifecycleStage)) {
      relatedServices.push(s);
    } else {
      otherServices.push(s);
    }
  });

  const apServices = SERVICES.filter((s) => s.isApprovedProfessional && !applicationTypes.includes(s.id));

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Additional Services</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Optionally select additional services to include in this review.
          {selectedServices.length > 0 && (
            <span className="ml-1 font-medium text-sky-600 dark:text-sky-400">
              {selectedServices.length} selected
            </span>
          )}
        </p>
      </div>

      {/* Related Services */}
      {relatedServices.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-slate-600 dark:text-slate-300 mb-2">
            Related Services
            {selectedStages.size > 0 && (
              <span className="text-slate-400 dark:text-slate-500 font-normal ml-1">
                (same lifecycle {selectedStages.size === 1 ? 'stage' : 'stages'})
              </span>
            )}
          </h3>
          <div className="space-y-1">
            {relatedServices.map((service) => (
              <ServiceCheckbox
                key={service.id}
                service={service}
                isSelected={selectedServices.includes(service.id)}
                onToggle={() => onToggle(service.id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Other Services (collapsible) */}
      {otherServices.length > 0 && (
        <div>
          <button
            type="button"
            onClick={() => setShowOther(!showOther)}
            className="flex items-center gap-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
          >
            {showOther ? (
              <ChevronDown className="w-4 h-4" />
            ) : (
              <ChevronRight className="w-4 h-4" />
            )}
            Other Services
            <span className="text-slate-400 dark:text-slate-500 font-normal">({otherServices.length})</span>
          </button>
          {showOther && (
            <div className="mt-2 space-y-1">
              {otherServices.map((service) => (
                <ServiceCheckbox
                  key={service.id}
                  service={service}
                  isSelected={selectedServices.includes(service.id)}
                  onToggle={() => onToggle(service.id)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Approved Professional toggle */}
      <div className="border-t border-slate-200 dark:border-slate-700 pt-4">
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={showApprovedProfessional}
            onChange={() => setShowApprovedProfessional(!showApprovedProfessional)}
            className="h-4 w-4 rounded border-slate-300 dark:border-slate-600 text-sky-600 focus:ring-sky-500 dark:bg-slate-800"
          />
          <span className="text-sm font-medium text-slate-600 dark:text-slate-300">
            Include Approved Professional services
          </span>
          <span className="text-xs text-slate-400 dark:text-slate-500">(Schedule 3)</span>
        </label>
        {showApprovedProfessional && apServices.length > 0 && (
          <div className="mt-3 ml-7 space-y-1">
            {apServices.map((service) => (
              <ServiceCheckbox
                key={service.id}
                service={service}
                isSelected={selectedServices.includes(service.id)}
                onToggle={() => onToggle(service.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
