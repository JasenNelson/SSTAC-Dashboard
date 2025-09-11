'use client';

import { useState, useEffect } from 'react';

interface CEWCodeInputProps {
  onCodeEntered: (code: string) => void;
}

export default function CEWCodeInput({ onCodeEntered }: CEWCodeInputProps) {
  const [code, setCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Check if code was already entered in this session
  useEffect(() => {
    const savedCode = sessionStorage.getItem('cew_auth_code');
    if (savedCode) {
      onCodeEntered(savedCode);
    }
  }, [onCodeEntered]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (code.trim()) {
      setIsLoading(true);
      // Save code to session storage
      sessionStorage.setItem('cew_auth_code', code.trim());
      onCodeEntered(code.trim());
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            CEW 2025 Polling
          </h1>
          <p className="text-gray-600 dark:text-gray-300">
            Enter the conference code to participate
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="code" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Conference Code
            </label>
            <input
              type="text"
              id="code"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="Enter code"
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-center text-lg font-mono tracking-wider bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              autoFocus
              disabled={isLoading}
            />
          </div>

          <button
            type="submit"
            disabled={!code.trim() || isLoading}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold py-3 px-4 rounded-lg transition-colors duration-200"
          >
            {isLoading ? 'Entering...' : 'Enter Conference'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Code will be remembered for this session
          </p>
        </div>
      </div>
    </div>
  );
}
