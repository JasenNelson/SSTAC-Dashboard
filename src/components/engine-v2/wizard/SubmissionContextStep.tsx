"use client";

// engine_v2 frontend Lane 1 / Module L1-4: Step 4 - submission context overrides.
//
// Free-form key/value override map that becomes the
// `submission_context_overrides` JSONB column on v2_projects. Lane 1 keeps
// this intentionally simple: a list of add/remove rows. Each row's `key` is
// trimmed and used as the object key; `value` is stored as a string. Empty
// keys are dropped.

import { useState } from "react";

export interface SubmissionContextValue {
  overrides: Record<string, string>;
}

interface Props {
  value: SubmissionContextValue;
  onChange: (next: SubmissionContextValue) => void;
}

interface Row {
  key: string;
  value: string;
}

function objectToRows(obj: Record<string, string>): Row[] {
  return Object.entries(obj).map(([key, value]) => ({ key, value }));
}

function rowsToObject(rows: Row[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const row of rows) {
    const k = row.key.trim();
    if (!k) continue;
    out[k] = row.value;
  }
  return out;
}

// Local row state is kept in component state, not derived from parent's
// overrides object every render. Previous design derived rows from
// value.overrides via useMemo + dropped empty-keyed rows in rowsToObject --
// the "+ Add another override" handler could never render a new blank row
// because the round-trip stripped it. The parent's overrides object remains
// the authoritative persisted form; the component owns the displayed-rows
// list (which may include blank-keyed rows the user is mid-edit on).
export function SubmissionContextStep({ value, onChange }: Props) {
  const [rows, setRows] = useState<Row[]>(() => {
    const r = objectToRows(value.overrides);
    if (r.length === 0) r.push({ key: "", value: "" });
    return r;
  });

  function emit(next: Row[]) {
    setRows(next);
    onChange({ overrides: rowsToObject(next) });
  }

  function update(index: number, patch: Partial<Row>) {
    const next = rows.map((r, i) => (i === index ? { ...r, ...patch } : r));
    emit(next);
  }

  function add() {
    emit([...rows, { key: "", value: "" }]);
  }

  function remove(index: number) {
    const next = rows.filter((_, i) => i !== index);
    // Keep at least one editable row visible.
    if (next.length === 0) next.push({ key: "", value: "" });
    emit(next);
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-semibold text-slate-900 dark:text-white">
          Submission context overrides
        </h3>
        <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">
          Optional. Add any free-form context the evaluator should consider,
          such as site address, primary contaminant, or special instructions.
        </p>
      </div>

      <ul className="space-y-2">
        {rows.map((row, i) => (
          <li
            key={i}
            className="grid grid-cols-1 sm:grid-cols-[1fr_2fr_auto] gap-2 items-start"
          >
            <input
              type="text"
              value={row.key}
              onChange={(e) => update(i, { key: e.target.value })}
              placeholder="Key (e.g. site_address)"
              className="rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-white shadow-sm focus:border-sky-500 focus:ring-2 focus:ring-sky-200 dark:focus:ring-sky-900"
            />
            <input
              type="text"
              value={row.value}
              onChange={(e) => update(i, { value: e.target.value })}
              placeholder="Value"
              className="rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-white shadow-sm focus:border-sky-500 focus:ring-2 focus:ring-sky-200 dark:focus:ring-sky-900"
            />
            <button
              type="button"
              onClick={() => remove(i)}
              disabled={rows.length === 1 && !row.key && !row.value}
              className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 text-sm text-slate-600 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/40 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Remove
            </button>
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={add}
        className="text-sm font-medium text-sky-700 dark:text-sky-300 hover:underline"
      >
        + Add another override
      </button>
    </div>
  );
}
