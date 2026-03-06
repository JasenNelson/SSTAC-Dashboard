'use client';

import React, { useState } from 'react';
import CEWCodeInput from '@/components/CEWCodeInput';

export default function CEWWIKSPage() {
  const [_activeAccordion, _setActiveAccordion] = useState<string | null>(null);
  const [authCode, setAuthCode] = useState<string | null>(null);

  const handleCodeEntered = (code: string) => {
    setAuthCode(code);
  };

  if (!authCode) {
    return <CEWCodeInput onCodeEntered={handleCodeEntered} />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-50 via-sky-50 to-slate-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      {/* Header */}
      <div className="bg-white dark:bg-slate-800 shadow-sm border-b border-slate-200 dark:border-slate-700">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="text-center">
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">
              CEW 2025 Live Polling
            </h1>
            <h2 className="text-xl text-sky-700 dark:text-sky-300 font-semibold">
              Indigenous Knowledge & Science
            </h2>
            <p className="text-slate-500 dark:text-slate-300 mt-2">
              Interactive polling for conference attendees
            </p>
            <div className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              Authenticated as: <span className="font-mono font-semibold">{authCode}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Information */}
        <div className="bg-sky-50 dark:bg-sky-900/40 border border-sky-200 dark:border-sky-800 rounded-lg p-6 mb-8">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-sky-100 mb-2">
            🌿 Weaving Indigenous Knowledge & Science
          </h3>
          <p className="text-slate-600 dark:text-sky-200 text-sm">
            Explore the strategic plan to integrate Indigenous-led WQCIU framework into BC&apos;s modernized sediment standards.
          </p>
        </div>

        {/* Content */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg p-8">
          <h3 className="text-xl font-semibold text-slate-900 dark:text-white mb-4">
            Coming Soon
          </h3>
          <p className="text-slate-500 dark:text-slate-300">
            This section is under development. Please check back later for interactive content related to Indigenous Knowledge and Science integration.
          </p>
        </div>

        {/* Footer */}
        <div className="mt-12 text-center">
          <p className="text-slate-500 dark:text-slate-400 text-sm">
            Canadian Ecotoxicity Workshop 2025 • Victoria, BC
          </p>
        </div>
      </div>
    </div>
  );
}
