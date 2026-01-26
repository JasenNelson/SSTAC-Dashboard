'use client'

import type { PartComponentProps } from '../types'

function Part3LineByLineComments({ data, onChange }: PartComponentProps) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8">
      <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
        Part 3: Line-by-Line Comments
      </h3>

      <div className="space-y-6">
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <p className="text-gray-700 dark:text-gray-300">
            Please provide detailed, line-by-line comments for each section of the report.
            Reference specific page numbers, sections, and line numbers to ensure clarity.
            Each text area allows up to 5,000 characters.
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Section I - Introduction:
          </label>
          <div className="relative">
            <textarea
              value={data.sectionI || ''}
              onChange={(e) => onChange({ ...data, sectionI: e.target.value })}
              rows={8}
              maxLength={5000}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
              placeholder="Enter your line-by-line comments for Section I - Introduction here..."
            />
            <div className="absolute bottom-2 right-2 text-xs text-gray-500 dark:text-gray-400">
              {(data.sectionI || '').length}/5000 characters
            </div>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Section II - Preliminary Scientific Research Findings:
          </label>
          <div className="relative">
            <textarea
              value={data.sectionII || ''}
              onChange={(e) => onChange({ ...data, sectionII: e.target.value })}
              rows={8}
              maxLength={5000}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
              placeholder="Enter your line-by-line comments for Section II - Preliminary Scientific Research Findings here..."
            />
            <div className="absolute bottom-2 right-2 text-xs text-gray-500 dark:text-gray-400">
              {(data.sectionII || '').length}/5000 characters
            </div>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Section III - Jurisdictional Scan:
          </label>
          <div className="relative">
            <textarea
              value={data.sectionIII || ''}
              onChange={(e) => onChange({ ...data, sectionIII: e.target.value })}
              rows={8}
              maxLength={5000}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
              placeholder="Enter your line-by-line comments for Section III - Jurisdictional Scan here..."
            />
            <div className="absolute bottom-2 right-2 text-xs text-gray-500 dark:text-gray-400">
              {(data.sectionIII || '').length}/5000 characters
            </div>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Section IV - Community and Stakeholder Engagement Insights:
          </label>
          <div className="relative">
            <textarea
              value={data.sectionIV || ''}
              onChange={(e) => onChange({ ...data, sectionIV: e.target.value })}
              rows={8}
              maxLength={5000}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
              placeholder="Enter your line-by-line comments for Section IV - Community and Stakeholder Engagement Insights here..."
            />
            <div className="absolute bottom-2 right-2 text-xs text-gray-500 dark:text-gray-400">
              {(data.sectionIV || '').length}/5000 characters
            </div>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Section V - Proposed Framework for Modernized Sediment Standards:
          </label>
          <div className="relative">
            <textarea
              value={data.sectionV || ''}
              onChange={(e) => onChange({ ...data, sectionV: e.target.value })}
              rows={8}
              maxLength={5000}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
              placeholder="Enter your line-by-line comments for Section V - Proposed Framework for Modernized Sediment Standards here..."
            />
            <div className="absolute bottom-2 right-2 text-xs text-gray-500 dark:text-gray-400">
              {(data.sectionV || '').length}/5000 characters
            </div>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Appendices C & D:
          </label>
          <div className="relative">
            <textarea
              value={data.appendicesCD || ''}
              onChange={(e) => onChange({ ...data, appendicesCD: e.target.value })}
              rows={8}
              maxLength={5000}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
              placeholder="Enter your line-by-line comments for Appendices C & D here..."
            />
            <div className="absolute bottom-2 right-2 text-xs text-gray-500 dark:text-gray-400">
              {(data.appendicesCD || '').length}/5000 characters
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Part3LineByLineComments
