'use client';

import { type SiteInfo, BC_REGIONS } from './types';

interface SiteInfoFormProps {
  siteInfo: SiteInfo;
  onChange: (field: keyof SiteInfo, value: string) => void;
}

function FormField({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}

const inputClasses =
  'block w-full rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-2 text-sm text-slate-900 dark:text-white dark:bg-slate-800 shadow-sm placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-sky-500 focus:ring-1 focus:ring-sky-500';

export default function SiteInfoForm({ siteInfo, onChange }: SiteInfoFormProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Site Information</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Enter details about the contaminated site and applicant. Fields marked with{' '}
          <span className="text-red-500">*</span> are required.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FormField label="Site ID" required>
          <input
            type="text"
            value={siteInfo.siteId}
            onChange={(e) => onChange('siteId', e.target.value)}
            placeholder="e.g., 12345"
            className={inputClasses}
          />
        </FormField>

        <FormField label="Site Name" required>
          <input
            type="text"
            value={siteInfo.siteName}
            onChange={(e) => onChange('siteName', e.target.value)}
            placeholder="Enter site name"
            className={inputClasses}
          />
        </FormField>

        <FormField label="Applicant Name" required>
          <input
            type="text"
            value={siteInfo.applicantName}
            onChange={(e) => onChange('applicantName', e.target.value)}
            placeholder="Enter applicant name"
            className={inputClasses}
          />
        </FormField>

        <FormField label="Applicant Company">
          <input
            type="text"
            value={siteInfo.applicantCompany}
            onChange={(e) => onChange('applicantCompany', e.target.value)}
            placeholder="Enter company name"
            className={inputClasses}
          />
        </FormField>

        <FormField label="Submission Date" required>
          <input
            type="date"
            value={siteInfo.submissionDate}
            onChange={(e) => onChange('submissionDate', e.target.value)}
            className={inputClasses}
          />
        </FormField>

        <FormField label="Site Address">
          <input
            type="text"
            value={siteInfo.siteAddress}
            onChange={(e) => onChange('siteAddress', e.target.value)}
            placeholder="Enter site address"
            className={inputClasses}
          />
        </FormField>

        <FormField label="Site Region">
          <select
            value={siteInfo.siteRegion}
            onChange={(e) => onChange('siteRegion', e.target.value)}
            className={inputClasses}
          >
            <option value="">Select region...</option>
            {BC_REGIONS.map((region) => (
              <option key={region} value={region}>
                {region}
              </option>
            ))}
          </select>
        </FormField>
      </div>

      <FormField label="Notes">
        <textarea
          value={siteInfo.notes}
          onChange={(e) => onChange('notes', e.target.value)}
          placeholder="Any additional notes about this submission..."
          rows={3}
          className={inputClasses}
        />
      </FormField>
    </div>
  );
}
