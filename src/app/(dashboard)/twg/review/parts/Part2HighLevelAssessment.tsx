'use client'

function Part2HighLevelAssessment({ data, onChange }: { data: any, onChange: (data: any) => void }) {
  const ratingOptions = ['Excellent', 'Good', 'Fair', 'Poor']

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8">
      <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
        Part 2: High-Level Report Assessment
      </h3>

      <div className="space-y-6">
        <div>
          <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
            Please rate the report on the following attributes:
          </h4>

          <div className="space-y-4">
            {[
              { key: 'clarity', label: 'Overall Clarity and Readability' },
              { key: 'completeness', label: 'Completeness of the Scientific Review and Jurisdictional Scan' },
              { key: 'defensibility', label: 'Scientific Defensibility of the Proposed Framework' }
            ].map(({ key, label }) => (
              <div key={key}>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {label}:
                </label>
                <div className="flex space-x-4">
                  {ratingOptions.map((option) => (
                    <label key={option} className="flex items-center">
                      <input
                        type="radio"
                        name={key}
                        value={option}
                        checked={data[key] === option}
                        onChange={(e) => onChange({ ...data, [key]: e.target.value })}
                        className="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300">{option}</span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Please provide specific comments to explain your ratings above or to offer general, high-level feedback on the report:
          </label>
          <div className="relative">
            <textarea
              value={data.comments || ''}
              onChange={(e) => onChange({ ...data, comments: e.target.value })}
              rows={6}
              maxLength={1500}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
              placeholder="Enter your comments here..."
            />
            <div className="absolute bottom-2 right-2 text-xs text-gray-500 dark:text-gray-400">
              {(data.comments || '').length}/1500 characters
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Part2HighLevelAssessment
