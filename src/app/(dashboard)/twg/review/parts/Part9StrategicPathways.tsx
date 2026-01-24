'use client'

function Part9StrategicPathways({ data, onChange }: { data: any, onChange: (data: any) => void }) {
  const enablingFactors = [
    'Invest in the desktop data compilation project before regulatory work',
    'Stage implementation milestones with clear decision gates',
    'Secure long-term funding for sustained scientific capacity',
    'Establish formal governance structure for cross-agency coordination',
    'Develop interim guidance to bridge between phases',
    'Other'
  ]

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8">
      <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
        Part 9: Strategic Pathways &amp; Options Analysis
      </h3>

      <div className="space-y-6">
        <div>
          <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-3">
            Suggest edits or clarifications to each implementation pathway so the description accurately reflects what you would endorse:
          </h4>
          <div className="space-y-4">
            {[
              {
                key: 'option1Edits',
                label: 'Option 1 – Data-Driven Foundational Research (desktop study first)',
                placeholder: 'What clarifications, caveats, or edits would you like to see for Option 1?'
              },
              {
                key: 'option2Edits',
                label: 'Option 2 – Phased Modernization (sequential implementation)',
                placeholder: 'What clarifications, caveats, or edits would you like to see for Option 2?'
              },
              {
                key: 'option3Edits',
                label: 'Option 3 – Comprehensive Overhaul (full package at once)',
                placeholder: 'What clarifications, caveats, or edits would you like to see for Option 3?'
              }
            ].map(({ key, label, placeholder }) => (
              <div key={key}>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {label}
                </label>
                <div className="relative">
                  <textarea
                    value={data[key] || ''}
                    onChange={(e) => onChange({ ...data, [key]: e.target.value })}
                    rows={4}
                    maxLength={2000}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                    placeholder={placeholder}
                  />
                  <div className="absolute bottom-2 right-2 text-xs text-gray-500 dark:text-gray-400">
                    {(data[key] || '').length}/2000 characters
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            If you would recommend an alternate pathway or hybrid approach, describe it here:
          </label>
          <div className="relative">
            <textarea
              value={data.otherPathwayIdeas || ''}
              onChange={(e) => onChange({ ...data, otherPathwayIdeas: e.target.value })}
              rows={4}
              maxLength={2000}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
              placeholder="Outline any alternative approach or hybridization of the pathways you believe is necessary."
            />
            <div className="absolute bottom-2 right-2 text-xs text-gray-500 dark:text-gray-400">
              {(data.otherPathwayIdeas || '').length}/2000 characters
            </div>
          </div>
        </div>

        <div>
          <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-3">
            Which enabling factors are essential to implement your recommended edits or new ideas? (Select all that apply)
          </h4>
          <div className="space-y-3">
            {enablingFactors.map((factor) => (
              <label key={factor} className="flex items-start space-x-2">
                <input
                  type="checkbox"
                  checked={data.supportingFactors?.includes(factor) || false}
                  onChange={(e) => {
                    const currentFactors = data.supportingFactors || []
                    const updated = e.target.checked
                      ? [...currentFactors, factor]
                      : currentFactors.filter((item: string) => item !== factor)
                    onChange({ ...data, supportingFactors: updated })
                  }}
                  className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">{factor}</span>
              </label>
            ))}
          </div>

          {data.supportingFactors?.includes('Other') && (
            <div className="mt-3">
              <input
                type="text"
                value={data.supportingFactorsOther || ''}
                onChange={(e) => onChange({ ...data, supportingFactorsOther: e.target.value })}
                placeholder="Please describe additional enabling factors..."
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
              />
            </div>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Summarize the most important changes you recommend across the pathways, referencing Section VI where helpful:
          </label>
          <div className="relative">
            <textarea
              value={data.pathwayRationale || ''}
              onChange={(e) => onChange({ ...data, pathwayRationale: e.target.value })}
              rows={6}
              maxLength={2500}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
              placeholder="Summarize the key edits or clarifications you would make across the pathways, noting any references to Section VI."
            />
            <div className="absolute bottom-2 right-2 text-xs text-gray-500 dark:text-gray-400">
              {(data.pathwayRationale || '').length}/2500 characters
            </div>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            What updates to the recommendations—including revised timeline estimates—would strengthen Phase 2 planning?
          </label>
          <div className="relative">
            <textarea
              value={data.recommendationUpdates || ''}
              onChange={(e) => onChange({ ...data, recommendationUpdates: e.target.value })}
              rows={4}
              maxLength={1800}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
              placeholder="Describe specific refinements to the recommendations, including approximate timelines or sequencing adjustments."
            />
            <div className="absolute bottom-2 right-2 text-xs text-gray-500 dark:text-gray-400">
              {(data.recommendationUpdates || '').length}/1800 characters
            </div>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            What are the most significant risks or dependencies that must be managed for your recommended adjustments to succeed?
          </label>
          <div className="relative">
            <textarea
              value={data.implementationRisks || ''}
              onChange={(e) => onChange({ ...data, implementationRisks: e.target.value })}
              rows={4}
              maxLength={1500}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
              placeholder="Identify the major risks, bottlenecks, or prerequisites (e.g., funding, staffing, policy changes)..."
            />
            <div className="absolute bottom-2 right-2 text-xs text-gray-500 dark:text-gray-400">
              {(data.implementationRisks || '').length}/1500 characters
            </div>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Line-by-line feedback for Section VI – Strategic Pathways &amp; Options Analysis (5,000 characters max):
          </label>
          <div className="relative">
            <textarea
              value={data.lineByLine || ''}
              onChange={(e) => onChange({ ...data, lineByLine: e.target.value })}
              rows={8}
              maxLength={5000}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
              placeholder="Reference specific pages/lines in Section VI where edits or clarifications are required..."
            />
            <div className="absolute bottom-2 right-2 text-xs text-gray-500 dark:text-gray-400">
              {(data.lineByLine || '').length}/5000 characters
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Part9StrategicPathways
