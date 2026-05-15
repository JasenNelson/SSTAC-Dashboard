'use client';

import React, { useState } from 'react';

export default function TWGReviewPortal() {
  const [priority, setPriority] = useState('');
  const [supportLevel, setSupportLevel] = useState<number | null>(null);
  const [integrationStrategy, setIntegrationStrategy] = useState('');
  const [feedback, setFeedback] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitted(true);
  };

  if (isSubmitted) {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-2xl animate-in fade-in zoom-in duration-300">
        <svg className="w-16 h-16 text-emerald-500 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <h2 className="text-2xl font-bold text-emerald-900 dark:text-emerald-300 mb-2">Thank you for your feedback</h2>
        <p className="text-emerald-700 dark:text-emerald-400 text-center max-w-lg">
          Your input has been recorded and will directly influence the 2026 Matrix Standards Derivation Options Paper.
        </p>
        <button 
          onClick={() => setIsSubmitted(false)}
          className="mt-6 px-4 py-2 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-medium rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
        >
          Submit Another Response
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      <div className="bg-sky-50 dark:bg-sky-900/20 border-l-4 border-sky-500 p-5 rounded-r-xl shadow-sm">
        <h2 className="text-lg font-bold text-sky-900 dark:text-sky-300 mb-2">Reviewer Instructions</h2>
        <p className="text-sm text-sky-800 dark:text-sky-200/90 leading-relaxed">
          The feedback provided in this portal will directly influence the development of the <strong>2026 Matrix Standards Derivation Options Paper</strong>. Please answer the following technical polls based on your review of the jurisdictional frameworks. Your responses will be aggregated and presented during the next TWG session.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Question 1 */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <label className="block text-base font-bold text-slate-900 dark:text-slate-100 mb-4">
            1. Which derivation pathway should be the highest priority for initial implementation?
          </label>
          <div className="space-y-3">
            {['Ecological Direct Contact', 'Ecological Food Web', 'Human Health Direct Contact', 'Human Health Food Web'].map((option) => (
              <label key={option} className="flex items-center space-x-3 cursor-pointer group">
                <input 
                  type="radio" 
                  name="priority" 
                  value={option}
                  checked={priority === option}
                  onChange={(e) => setPriority(e.target.value)}
                  className="w-4 h-4 text-sky-600 border-slate-300 focus:ring-sky-500 dark:border-slate-600 dark:bg-slate-700" 
                  required
                />
                <span className="text-slate-700 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-slate-100 transition-colors">{option}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Question 2 */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <label className="block text-base font-bold text-slate-900 dark:text-slate-100 mb-4">
            2. To what extent do you support transitioning from empirical to mechanistic (EqP-based) standards for non-ionic organics?
          </label>
          <div className="flex flex-col sm:flex-row items-center justify-between space-y-4 sm:space-y-0 sm:space-x-4">
            <span className="text-sm font-medium text-slate-500 dark:text-slate-400">1 (Strongly Oppose)</span>
            <div className="flex items-center space-x-2 sm:space-x-4">
              {[1, 2, 3, 4, 5].map((num) => (
                <label key={num} className="flex flex-col items-center cursor-pointer">
                  <input 
                    type="radio" 
                    name="supportLevel" 
                    value={num}
                    checked={supportLevel === num}
                    onChange={() => setSupportLevel(num)}
                    className="w-5 h-5 text-sky-600 border-slate-300 focus:ring-sky-500 dark:border-slate-600 dark:bg-slate-700 mb-2" 
                    required
                  />
                  <span className="text-sm font-bold text-slate-700 dark:text-slate-300">{num}</span>
                </label>
              ))}
            </div>
            <span className="text-sm font-medium text-slate-500 dark:text-slate-400">5 (Strongly Support)</span>
          </div>
        </div>

        {/* Question 3 */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <label className="block text-base font-bold text-slate-900 dark:text-slate-100 mb-4">
            3. Regarding Indigenous traditional food consumption, which integration strategy do you favor?
          </label>
          <div className="space-y-3">
            {[
              'Province-wide default modifiers',
              'Mandatory site-specific assessment',
              'Tiered hybrid approach'
            ].map((option) => (
              <label key={option} className="flex items-center space-x-3 cursor-pointer group">
                <input 
                  type="radio" 
                  name="integrationStrategy" 
                  value={option}
                  checked={integrationStrategy === option}
                  onChange={(e) => setIntegrationStrategy(e.target.value)}
                  className="w-4 h-4 text-sky-600 border-slate-300 focus:ring-sky-500 dark:border-slate-600 dark:bg-slate-700" 
                  required
                />
                <span className="text-slate-700 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-slate-100 transition-colors">{option}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Open Feedback */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <label className="block text-base font-bold text-slate-900 dark:text-slate-100 mb-4">
            General Methodological Concerns
          </label>
          <textarea 
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            rows={5}
            placeholder="Provide any additional technical feedback, concerns regarding specific derivations (e.g. AVS/SEM multipliers), or alternative approaches..."
            className="w-full p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition-all resize-y"
          ></textarea>
        </div>

        <div className="flex justify-end pt-4">
          <button 
            type="submit"
            className="px-8 py-3 bg-sky-600 hover:bg-sky-700 text-white font-bold rounded-xl shadow-md hover:shadow-lg transition-all focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
          >
            Submit Feedback
          </button>
        </div>
      </form>
    </div>
  );
}
