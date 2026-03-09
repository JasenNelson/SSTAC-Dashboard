'use client'

import type { PartComponentProps } from '../types'

function Part8FinalRecommendations({ data, onChange }: PartComponentProps) {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg p-8">
      <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-6">
        Part 8: Final Recommendations
      </h3>

      <div className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-2">
            Are there any critical scientific gaps, alternative approaches, or significant risks that you believe
            the report has overlooked?
          </label>
          <div className="relative">
            <textarea
              value={data.gaps || ''}
              onChange={(e) => onChange({ ...data, gaps: e.target.value })}
              rows={6}
              maxLength={2000}
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent bg-white dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-500 dark:placeholder-slate-400"
              placeholder="Enter your response here..."
            />
            <div className="absolute bottom-2 right-2 text-xs text-slate-500 dark:text-slate-400">
              {(data.gaps || '').length}/2000 characters
            </div>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-2">
            Please provide any other comments or suggestions you have for improving the report or the proposed framework:
          </label>
          <div className="relative">
            <textarea
              value={data.suggestions || ''}
              onChange={(e) => onChange({ ...data, suggestions: e.target.value })}
              rows={6}
              maxLength={2000}
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent bg-white dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-500 dark:placeholder-slate-400"
              placeholder="Enter your response here..."
            />
            <div className="absolute bottom-2 right-2 text-xs text-slate-500 dark:text-slate-400">
              {(data.suggestions || '').length}/2000 characters
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Part8FinalRecommendations
