'use client'

function Part4MatrixFramework({ data, onChange }: { data: any, onChange: (data: any) => void }) {
  const contaminantGroups = [
    'Mercury and its compounds',
    'Polychlorinated Biphenyls (PCBs)',
    'Per- and Polyfluoroalkyl Substances (PFAS)',
    'Dioxins and Furans',
    'Legacy Organochlorine Pesticides',
    'Other'
  ]

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8">
      <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
        Part 3: The Matrix Sediment Standards Framework
      </h3>

      <div className="space-y-6">
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <p className="text-gray-700 dark:text-gray-300">
            This section focuses on the <strong>Matrix Sediment Standards Framework</strong> (see Section V.B of the report),
            which proposes separate standards for direct exposure (SedS-direct) and food pathway exposure (SedS-food)
            to protect both ecological and human health. The initial public survey showed 83% of respondents found
            this 'Dual Standard' approach necessary.
          </p>
        </div>

        <div>
          <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
            The development of food pathway standards (SedS-food) will require significant scientific effort.
            Please rank the following contaminant groups for which this work is the highest priority (1 = Highest Priority):
          </h4>

          <div className="space-y-3">
            {contaminantGroups.map((group, index) => (
              <div key={group} className="flex items-center space-x-4">
                <label className="w-8 text-sm font-medium text-gray-700 dark:text-gray-300">
                  Rank {index + 1}:
                </label>
                <select
                  value={data.ranking?.[group] || ''}
                  onChange={(e) => {
                    const newRanking = { ...data.ranking, [group]: e.target.value }
                    onChange({ ...data, ranking: newRanking })
                  }}
                  className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="">Select rank</option>
                  {contaminantGroups.map((_, rankIndex) => (
                    <option key={rankIndex} value={rankIndex + 1}>
                      {rankIndex + 1}
                    </option>
                  ))}
                </select>
                <span className="text-sm text-gray-700 dark:text-gray-300">{group}</span>
              </div>
            ))}
          </div>

          {data.ranking?.['Other'] && (
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Please specify the other contaminant group:
              </label>
              <input
                type="text"
                value={data.otherContaminant || ''}
                onChange={(e) => onChange({ ...data, otherContaminant: e.target.value })}
                placeholder="Enter the other contaminant group..."
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
              />
            </div>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            What are the primary scientific or practical challenges you foresee in implementing the Matrix Framework?
            Please provide specific suggestions for addressing these challenges:
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
            Additional comments or feedback related to the Matrix Sediment Standards Framework:
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

export default Part4MatrixFramework
