'use client'

import type { PartComponentProps } from '../types'

function Part7Prioritization({ data, onChange }: PartComponentProps) {
  const modernizationOptions = [
    'Development of a Scientific Framework for Deriving Site-Specific Sediment Standards (Bioavailability Adjustment)',
    'Development of a Matrix Sediment Standards Framework - Focus on Ecological Protection',
    'Development of a Matrix Sediment Standards Framework - Focus on Human Health Protection',
    'Develop Sediment Standards for Non-scheduled Contaminants & Mixtures'
  ]

  const researchOptions = [
    'Research into the ecosystem-level impacts of chronic, low-level contaminant exposure',
    'Development of advanced in-vitro and high-throughput screening methods for rapid hazard assessment',
    'Investigating the toxicological impacts of climate change variables (e.g., temperature, hypoxia) on sediment contaminant toxicity',
    'Building a comprehensive, open-access database of sediment chemistry and toxicology data for all of BC'
  ]

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8">
      <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
        Part 7: Prioritization and Strategic Direction
      </h3>

      <div className="space-y-8">
        <div>
          <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
            Based on your experience, please rank these four areas for modernization priority in BC&apos;s sediment
            standards (1 = highest):
          </h4>

          <div className="space-y-3">
            {modernizationOptions.map((option, index) => (
              <div key={option} className="flex items-center space-x-4">
                <label className="w-8 text-sm font-medium text-gray-700 dark:text-gray-300">
                  Rank {index + 1}:
                </label>
                <select
                  value={data.modernization?.[option] || ''}
                  onChange={(e) => {
                    const newModernization = { ...data.modernization, [option]: e.target.value }
                    onChange({ ...data, modernization: newModernization })
                  }}
                  className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="">Select rank</option>
                  {modernizationOptions.map((_, rankIndex) => (
                    <option key={rankIndex} value={rankIndex + 1}>
                      {rankIndex + 1}
                    </option>
                  ))}
                </select>
                <span className="text-sm text-gray-700 dark:text-gray-300">{option}</span>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
            To support long-term (5+ years) strategic goals, please rank the following foundational research areas
            in order of importance for creating a more adaptive and forward-looking regulatory framework (1 = highest importance):
          </h4>

          <div className="space-y-3">
            {researchOptions.map((option, index) => (
              <div key={option} className="flex items-center space-x-4">
                <label className="w-8 text-sm font-medium text-gray-700 dark:text-gray-300">
                  Rank {index + 1}:
                </label>
                <select
                  value={data.research?.[option] || ''}
                  onChange={(e) => {
                    const newResearch = { ...data.research, [option]: e.target.value }
                    onChange({ ...data, research: newResearch })
                  }}
                  className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="">Select rank</option>
                  {researchOptions.map((_, rankIndex) => (
                    <option key={rankIndex} value={rankIndex + 1}>
                      {rankIndex + 1}
                    </option>
                  ))}
                </select>
                <span className="text-sm text-gray-700 dark:text-gray-300">{option}</span>
              </div>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Strategic Planning and Implementation: Based on your rankings above, please provide your recommendations for
            strategic planning and implementation priorities. Consider factors such as:
          </label>
          <ul className="list-disc list-inside text-sm text-gray-600 dark:text-gray-400 mb-4 ml-4">
            <li>Feasibility and resource requirements for each priority area</li>
            <li>Timeline considerations and dependencies between different modernization efforts</li>
            <li>Potential impact and benefits of each priority</li>
            <li>Integration with existing regulatory frameworks and processes</li>
            <li>Stakeholder engagement and collaboration needs</li>
            <li>Risk management and mitigation strategies</li>
          </ul>
          <div className="relative">
            <textarea
              value={data.strategicPlanning || ''}
              onChange={(e) => onChange({ ...data, strategicPlanning: e.target.value })}
              rows={8}
              maxLength={3000}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
              placeholder="Please provide your strategic planning recommendations and implementation priorities..."
            />
            <div className="absolute bottom-2 right-2 text-xs text-gray-500 dark:text-gray-400">
              {(data.strategicPlanning || '').length}/3000 characters
            </div>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Additional comments or feedback related to Prioritization and Strategic Direction:
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

export default Part7Prioritization
