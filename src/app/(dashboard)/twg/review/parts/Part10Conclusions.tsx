'use client'

function Part10Conclusions({ data, onChange }: { data: any, onChange: (data: any) => void }) {
  const confidenceOptions = [
    'Strongly support as written',
    'Support with minor refinements',
    'Needs additional substantiation',
    'Requires major revisions'
  ]

  const priorityAreas = [
    'Launch BC-specific desktop data compilation',
    'Expand contaminant list and mixtures coverage',
    'Develop bioavailability adjustment procedure and supporting protocol',
    'Develop framework for deriving matrix sediment standards (SedS-direct & SedS-food)',
    'Establish focused technical working groups',
    'Other'
  ]

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8">
      <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
        Part 10: Conclusions &amp; Recommendations
      </h3>

      <div className="space-y-6">
        <div>
          <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-3">
            How well do the Conclusions &amp; Recommendations (Section VII) capture the path forward for modernizing BC's sediment standards?
          </h4>
          <div className="space-y-3">
            {confidenceOptions.map((option) => (
              <label key={option} className="flex items-start space-x-2">
                <input
                  type="radio"
                  name="recommendationConfidence"
                  value={option}
                  checked={data.recommendationConfidence === option}
                  onChange={(e) => onChange({ ...data, recommendationConfidence: e.target.value })}
                  className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">{option}</span>
              </label>
            ))}
          </div>
        </div>

        <div>
          <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-3">
            Which recommended actions must be prioritized in the first 12–18 months? (Select all that apply)
          </h4>
          <div className="space-y-3">
            {priorityAreas.map((area) => (
              <label key={area} className="flex items-start space-x-2">
                <input
                  type="checkbox"
                  checked={data.priorityAreas?.includes(area) || false}
                  onChange={(e) => {
                    const currentAreas = data.priorityAreas || []
                    const updated = e.target.checked
                      ? [...currentAreas, area]
                      : currentAreas.filter((item: string) => item !== area)
                    onChange({ ...data, priorityAreas: updated })
                  }}
                  className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">{area}</span>
              </label>
            ))}
          </div>

          {data.priorityAreas?.includes('Other') && (
            <div className="mt-3">
              <input
                type="text"
                value={data.priorityAreasOther || ''}
                onChange={(e) => onChange({ ...data, priorityAreasOther: e.target.value })}
                placeholder="Please specify additional priority actions..."
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
              />
            </div>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            What resources, governance steps, or policy decisions are essential to operationalize the recommendations?
          </label>
          <div className="relative">
            <textarea
              value={data.implementationSupport || ''}
              onChange={(e) => onChange({ ...data, implementationSupport: e.target.value })}
              rows={5}
              maxLength={1800}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
              placeholder="Identify funding, staffing, regulatory changes, or partnerships required..."
            />
            <div className="absolute bottom-2 right-2 text-xs text-gray-500 dark:text-gray-400">
              {(data.implementationSupport || '').length}/1800 characters
            </div>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Line-by-line feedback for Section VII – Conclusions &amp; Recommendations (5,000 characters max):
          </label>
          <div className="relative">
            <textarea
              value={data.lineByLine || ''}
              onChange={(e) => onChange({ ...data, lineByLine: e.target.value })}
              rows={8}
              maxLength={5000}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
              placeholder="Reference specific lines in Section VII where revisions, clarifications, or evidence additions are needed..."
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

export default Part10Conclusions
