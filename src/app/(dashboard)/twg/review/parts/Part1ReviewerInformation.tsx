'use client'

function Part1ReviewerInformation({ data, onChange }: { data: any, onChange: (data: any) => void }) {
  const expertiseOptions = [
    'Ecotoxicology',
    'Human Health Risk Assessment (HHRA)',
    'Environmental Chemistry',
    'Regulatory Policy & Law',
    'Indigenous Knowledge Systems',
    'Bioavailability & Contaminant Fate',
    'Benthic Ecology',
    'Food Web Modeling & Bioaccumulation',
    'Site Remediation & Engineering',
    'Other'
  ]

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8">
      <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
        Part 1: Reviewer Information (Optional)
      </h3>

      <div className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Name and Affiliation:
          </label>
          <input
            type="text"
            value={data.name || ''}
            onChange={(e) => onChange({ ...data, name: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
            placeholder="Enter your name and affiliation"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Primary Area(s) of Expertise (please select all that apply):
          </label>
          <div className="grid grid-cols-2 gap-3">
            {expertiseOptions.map((option) => (
              <label key={option} className="flex items-center">
                <input
                  type="checkbox"
                  checked={data.expertise?.includes(option) || false}
                  onChange={(e) => {
                    const currentExpertise = data.expertise || []
                    const newExpertise = e.target.checked
                      ? [...currentExpertise, option]
                      : currentExpertise.filter((exp: string) => exp !== option)
                    onChange({ ...data, expertise: newExpertise })
                  }}
                  className="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">{option}</span>
              </label>
            ))}
          </div>

          {data.expertise?.includes('Other') && (
            <div className="mt-3">
              <input
                type="text"
                value={data.otherExpertise || ''}
                onChange={(e) => onChange({ ...data, otherExpertise: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                placeholder="Please specify other expertise"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default Part1ReviewerInformation
