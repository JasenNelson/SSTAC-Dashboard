'use client';

import { useState } from 'react';

interface CEWCodeInputProps {
  onCodeEntered: (code: string) => void;
}

export default function CEWCodeInput({ onCodeEntered }: CEWCodeInputProps) {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedCode = code.trim();
    
    if (!trimmedCode) {
      setError('Please enter a conference code');
      return;
    }
    
    // Accept any code (previously was "CEW2025" but now flexible)
    onCodeEntered(trimmedCode);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 w-full max-w-md">
        <div className="text-center">
          <div className="mb-6">
            <div className="text-6xl mb-4">🗳️</div>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
            Conference Polling
          </h1>
          <p className="text-gray-600 dark:text-gray-300 mb-6">
            Enter your conference code to participate in the polling session.
          </p>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <input
                type="text"
                value={code}
                onChange={(e) => {
                  setCode(e.target.value);
                  setError('');
                }}
                placeholder="Enter conference code"
                className="w-full px-4 py-3 text-center text-lg font-mono border-2 border-blue-300 dark:border-blue-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                autoFocus
              />
              {error && (
                <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>
              )}
            </div>
            
            <button
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              Enter Polling Session
            </button>
          </form>
          
          <div className="mt-6 bg-blue-50 dark:bg-blue-900/30 rounded-lg p-4 border border-blue-200 dark:border-blue-700">
            <p className="text-sm text-blue-800 dark:text-blue-200">
              Your responses will be saved anonymously and combined with other participants&apos; responses.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
