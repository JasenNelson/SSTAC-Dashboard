'use client';

interface CEWCodeInputProps {
  onCodeEntered: (code: string) => void;
}

export default function CEWCodeInput({ onCodeEntered }: CEWCodeInputProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 w-full max-w-md">
        <div className="text-center">
          <div className="mb-6">
            <div className="text-6xl mb-4">🔒</div>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
            CEW 2025 Polling Closed
          </h1>
          <p className="text-gray-600 dark:text-gray-300 mb-6">
            The conference polling session has concluded. Thank you for your participation!
          </p>
          <div className="bg-blue-50 dark:bg-blue-900/30 rounded-lg p-4 border border-blue-200 dark:border-blue-700">
            <p className="text-sm text-blue-800 dark:text-blue-200">
              The CEW 2025 conference session ended on October 7, 2025.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
