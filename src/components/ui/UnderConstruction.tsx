'use client';

import { Construction, ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface UnderConstructionProps {
  feature: string;
  description?: string;
  showBack?: boolean;
}

export default function UnderConstruction({
  feature,
  description,
  showBack = false,
}: UnderConstructionProps) {
  const router = useRouter();

  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      <Construction className="h-12 w-12 text-amber-500 mb-4" />
      <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
        {feature} — Under Construction
      </h3>
      <p className="mt-2 text-sm text-slate-500 dark:text-slate-400 max-w-md">
        {description ??
          'This feature requires the local evaluation engine and is not yet available in the cloud deployment. It is actively being developed.'}
      </p>
      {showBack && (
        <button
          type="button"
          onClick={() => router.back()}
          className="mt-6 inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Go Back
        </button>
      )}
    </div>
  );
}
