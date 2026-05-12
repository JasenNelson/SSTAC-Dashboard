"use client";

// engine_v2 frontend Lane 1 / Module L1-4: Step 2 - application types.
//
// Fixed enum aligned with the v1 launch-evaluation conventions. The values are
// the canonical regulatory submission categories admins can tag a project
// with; multiple are allowed. The enum is intentionally narrow for L1-4 -
// future lanes may broaden it.

export const APPLICATION_TYPE_OPTIONS: ReadonlyArray<{
  id: ApplicationTypeId;
  label: string;
}> = [
  { id: "stage_1_psi", label: "Stage 1 Preliminary Site Investigation" },
  { id: "stage_2_psi", label: "Stage 2 Preliminary Site Investigation" },
  { id: "stage_3_dsi", label: "Stage 3 Detailed Site Investigation" },
  { id: "remediation_plan", label: "Remediation Plan" },
  { id: "closure", label: "Closure / Certificate of Compliance" },
  { id: "other", label: "Other" },
];

export type ApplicationTypeId =
  | "stage_1_psi"
  | "stage_2_psi"
  | "stage_3_dsi"
  | "remediation_plan"
  | "closure"
  | "other";

interface Props {
  value: ApplicationTypeId[];
  onChange: (next: ApplicationTypeId[]) => void;
}

export function ApplicationTypeStep({ value, onChange }: Props) {
  function toggle(id: ApplicationTypeId) {
    if (value.includes(id)) {
      onChange(value.filter((v) => v !== id));
    } else {
      onChange([...value, id]);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-semibold text-slate-900 dark:text-white">
          Application types
        </h3>
        <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">
          Select all application types this submission addresses. At least one
          is required.
        </p>
      </div>
      <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {APPLICATION_TYPE_OPTIONS.map((option) => {
          const checked = value.includes(option.id);
          return (
            <li key={option.id}>
              <label
                className={
                  "flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors " +
                  (checked
                    ? "border-sky-500 bg-sky-50 dark:bg-sky-900/30 dark:border-sky-500"
                    : "border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700/40")
                }
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggle(option.id)}
                  className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                />
                <span className="text-sm text-slate-900 dark:text-white">
                  {option.label}
                </span>
              </label>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
