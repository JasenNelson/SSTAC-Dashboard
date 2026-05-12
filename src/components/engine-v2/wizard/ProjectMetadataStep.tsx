"use client";

// engine_v2 frontend Lane 1 / Module L1-4: Step 1 - project metadata.

export interface ProjectMetadataValue {
  name: string;
  description: string;
}

interface Props {
  value: ProjectMetadataValue;
  onChange: (next: ProjectMetadataValue) => void;
}

export function ProjectMetadataStep({ value, onChange }: Props) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-semibold text-slate-900 dark:text-white">
          Project metadata
        </h3>
        <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">
          Give the project a name. A short description is optional and will be
          stored as a submission context override.
        </p>
      </div>

      <div className="space-y-2">
        <label
          htmlFor="project-name"
          className="block text-sm font-medium text-slate-700 dark:text-slate-200"
        >
          Project name
        </label>
        <input
          id="project-name"
          type="text"
          value={value.name}
          onChange={(e) => onChange({ ...value, name: e.target.value })}
          maxLength={255}
          required
          className="block w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-white shadow-sm focus:border-sky-500 focus:ring-2 focus:ring-sky-200 dark:focus:ring-sky-900"
          placeholder="e.g. 1234 Main Street Stage 2 PSI"
        />
      </div>

      <div className="space-y-2">
        <label
          htmlFor="project-description"
          className="block text-sm font-medium text-slate-700 dark:text-slate-200"
        >
          Description <span className="text-slate-400">(optional)</span>
        </label>
        <textarea
          id="project-description"
          value={value.description}
          onChange={(e) =>
            onChange({ ...value, description: e.target.value })
          }
          rows={3}
          maxLength={2000}
          className="block w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-white shadow-sm focus:border-sky-500 focus:ring-2 focus:ring-sky-200 dark:focus:ring-sky-900"
          placeholder="Short summary of the submission scope or site context."
        />
      </div>
    </div>
  );
}
