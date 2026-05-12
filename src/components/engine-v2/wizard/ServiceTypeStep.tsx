"use client";

// engine_v2 frontend Lane 1 / Module L1-4: Step 3 - service types.
//
// Driven by v1's Schedule 2/3 catalog (read-only import). Services are
// grouped by lifecycle stage for owner workflow; the user can select one or
// more across any stage. Selected service ids drive the derived media types
// displayed on the Review step.

import { useMemo } from "react";
import {
  LIFECYCLE_STAGES,
  getServicesByStage,
  getServiceById,
  type Schedule3Service,
} from "@/lib/regulatory-review/schedule3";

interface Props {
  value: string[];
  onChange: (next: string[]) => void;
}

export function ServiceTypeStep({ value, onChange }: Props) {
  const grouped = useMemo(
    () =>
      LIFECYCLE_STAGES.map((stage) => ({
        stage,
        services: getServicesByStage(stage.id),
      })).filter((group) => group.services.length > 0),
    [],
  );

  function toggle(serviceId: string) {
    // Guard: only allow toggling ids that resolve via getServiceById so the
    // outgoing list never carries stale / unknown ids past this step.
    if (!getServiceById(serviceId)) return;
    if (value.includes(serviceId)) {
      onChange(value.filter((v) => v !== serviceId));
    } else {
      onChange([...value, serviceId]);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-semibold text-slate-900 dark:text-white">
          Service types
        </h3>
        <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">
          Choose the Schedule 2/3 services that apply to this submission. The
          media types reviewed (soil, groundwater, etc.) are derived from your
          selection.
        </p>
      </div>

      <div className="space-y-6">
        {grouped.map(({ stage, services }) => (
          <section key={stage.id} className="space-y-2">
            <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
              {stage.name}
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {stage.description}
            </p>
            <ul className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {services.map((service: Schedule3Service) => {
                const checked = value.includes(service.id);
                return (
                  <li key={service.id}>
                    <label
                      className={
                        "flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors " +
                        (checked
                          ? "border-sky-500 bg-sky-50 dark:bg-sky-900/30 dark:border-sky-500"
                          : "border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700/40")
                      }
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggle(service.id)}
                        className="mt-0.5 h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                      />
                      <span className="block">
                        <span className="block text-sm font-medium text-slate-900 dark:text-white">
                          {service.name}
                        </span>
                        <span className="block text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                          {service.description}
                        </span>
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
