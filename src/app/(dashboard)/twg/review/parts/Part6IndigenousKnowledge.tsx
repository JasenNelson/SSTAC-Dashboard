'use client'

import type { PartComponentProps } from '../types'

function Part6IndigenousKnowledge({ data, onChange }: PartComponentProps) {
  const tier0Options = [
    'Implement Tier 0 anti-degradation provisions for sediment quality',
    'Establish baseline sediment quality conditions for reference',
    'Develop criteria for identifying pristine or near-pristine sediment conditions',
    'Create protocols for protecting high-quality sediment areas from degradation',
    'Other'
  ]

  const frameworkOptions = [
    'Develop risk-based scientific framework for numerical sediment standards',
    'Include Indigenous Uses as a third protection goal alongside human health and ecological protection',
    'Integrate traditional ecological knowledge into standard derivation methodologies',
    'Establish culturally appropriate risk assessment endpoints',
    'Develop community-specific exposure scenarios for Indigenous populations',
    'Other'
  ]

  const studyOptions = [
    'Conduct desktop review of regional and watershed-specific sediment data',
    'Compile existing reports on sediment contamination in Indigenous territories',
    'Identify data gaps and priority areas for additional study',
    'Develop methodology for engaging Indigenous communities in collaborative studies',
    'Create protocols for respectful and meaningful community engagement',
    'Other'
  ]

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8">
      <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
        Part 6: WQCIU Approaches for Indigenous Uses Integration
      </h3>

      <div className="space-y-6">
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <p className="text-gray-700 dark:text-gray-300">
            This section focuses on technical approaches for integrating Indigenous Uses into sediment standards
            development, including Tier 0 anti-degradation provisions, risk-based frameworks, and collaborative
            study methodologies as outlined in the WQCIU recommendations.
          </p>
        </div>

        <div>
          <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
            Which Tier 0 anti-degradation approaches should be prioritized for sediment quality protection? (Select up to three):
          </h4>

          <div className="space-y-3">
            {tier0Options.map((option) => (
              <label key={option} className="flex items-center">
                <input
                  type="checkbox"
                  checked={data.tier0Approaches?.includes(option) || false}
                  onChange={(e) => {
                    const currentApproaches = data.tier0Approaches || []
                    const newApproaches = e.target.checked
                      ? [...currentApproaches, option]
                      : currentApproaches.filter((approach: string) => approach !== option)
                    onChange({ ...data, tier0Approaches: newApproaches })
                  }}
                  className="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">{option}</span>
              </label>
            ))}
          </div>

          {data.tier0Approaches?.includes('Other') && (
            <div className="mt-3">
              <input
                type="text"
                value={data.tier0OtherText || ''}
                onChange={(e) => onChange({ ...data, tier0OtherText: e.target.value })}
                placeholder="Please specify other Tier 0 approach..."
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
              />
            </div>
          )}
        </div>

        <div>
          <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
            What elements should be included in a risk-based scientific framework for deriving numerical sediment standards? (Select up to three):
          </h4>

          <div className="space-y-3">
            {frameworkOptions.map((option) => (
              <label key={option} className="flex items-center">
                <input
                  type="checkbox"
                  checked={data.frameworkElements?.includes(option) || false}
                  onChange={(e) => {
                    const currentElements = data.frameworkElements || []
                    const newElements = e.target.checked
                      ? [...currentElements, option]
                      : currentElements.filter((element: string) => element !== option)
                    onChange({ ...data, frameworkElements: newElements })
                  }}
                  className="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">{option}</span>
              </label>
            ))}
          </div>

          {data.frameworkElements?.includes('Other') && (
            <div className="mt-3">
              <input
                type="text"
                value={data.frameworkOtherText || ''}
                onChange={(e) => onChange({ ...data, frameworkOtherText: e.target.value })}
                placeholder="Please specify other framework element..."
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
              />
            </div>
          )}
        </div>

        <div>
          <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
            What components should be included in a desktop review study for regional and watershed-specific information? (Select up to three):
          </h4>

          <div className="space-y-3">
            {studyOptions.map((option) => (
              <label key={option} className="flex items-center">
                <input
                  type="checkbox"
                  checked={data.studyComponents?.includes(option) || false}
                  onChange={(e) => {
                    const currentComponents = data.studyComponents || []
                    const newComponents = e.target.checked
                      ? [...currentComponents, option]
                      : currentComponents.filter((component: string) => component !== option)
                    onChange({ ...data, studyComponents: newComponents })
                  }}
                  className="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">{option}</span>
              </label>
            ))}
          </div>

          {data.studyComponents?.includes('Other') && (
            <div className="mt-3">
              <input
                type="text"
                value={data.studyOtherText || ''}
                onChange={(e) => onChange({ ...data, studyOtherText: e.target.value })}
                placeholder="Please specify other study component..."
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
              />
            </div>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            What are the key technical and methodological challenges in implementing these WQCIU approaches for Indigenous Uses integration?
            Please provide specific recommendations for addressing these challenges:
          </label>
          <div className="relative">
            <textarea
              value={data.challenges || ''}
              onChange={(e) => onChange({ ...data, challenges: e.target.value })}
              rows={6}
              maxLength={2000}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
              placeholder="Enter your response here..."
            />
            <div className="absolute bottom-2 right-2 text-xs text-gray-500 dark:text-gray-400">
              {(data.challenges || '').length}/2000 characters
            </div>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Additional comments or feedback related to WQCIU Approaches for Indigenous Uses Integration:
          </label>
          <div className="relative">
            <textarea
              value={data.additionalComments || ''}
              onChange={(e) => onChange({ ...data, additionalComments: e.target.value })}
              rows={4}
              maxLength={1500}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
              placeholder="Enter any additional comments or feedback here..."
            />
            <div className="absolute bottom-2 right-2 text-xs text-gray-500 dark:text-gray-400">
              {(data.additionalComments || '').length}/1500 characters
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Part6IndigenousKnowledge
