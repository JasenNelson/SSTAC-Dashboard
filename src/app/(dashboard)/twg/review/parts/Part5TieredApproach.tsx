'use client'

function Part5TieredApproach({ data, onChange }: { data: any, onChange: (data: any) => void }) {
  const bioavailabilityOptions = [
    'Equilibrium partitioning models (e.g., based on organic carbon content)',
    'Normalization using Acid-Volatile Sulfides/Simultaneously Extracted Metals (AVS/SEM)',
    'Direct measurement using passive sampling devices (PSDs)',
    'Other'
  ]

  const evidenceOptions = [
    'Site-specific bioavailability data (e.g., grain size, TOC, AVS/SEM)',
    'Bioaccumulation data in tissues of local species',
    'Benthic community structure analysis',
    'Other'
  ]

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8">
      <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
        Part 5: The Tiered Assessment Approach
      </h3>

      <div className="space-y-6">
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <p className="text-gray-700 dark:text-gray-300">
            This section focuses on the <strong>Tiered Assessment Approach</strong> (see Section V.B of the report),
            which moves from initial screening (Tier 1) to more detailed site-specific assessments. A key proposal
            is the distinction between <strong>Tier 2a</strong> (bioavailability adjustments only) and
            <strong>Tier 2b</strong> (incorporating additional lines of evidence within a screening-level risk assessment).
          </p>
        </div>

        <div>
          <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
            Incorporating bioavailability was identified as a top priority from survey responses. Which scientific
            approach to bioavailability holds the most promise for practical and defensible application in a Tier 2a framework?
          </h4>
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3 mb-4">
            <p className="text-sm text-gray-700 dark:text-gray-300">
              <strong>Note:</strong> Detailed technical requirements, procedures, and implementation guidance for Tier 2a
              bioavailability adjustments will be provided in <strong>Protocol 2</strong>.
            </p>
          </div>

          <div className="space-y-3">
            {bioavailabilityOptions.map((option) => (
              <label key={option} className="flex items-center">
                <input
                  type="radio"
                  name="bioavailability"
                  value={option}
                  checked={data.bioavailability === option}
                  onChange={(e) => onChange({ ...data, bioavailability: e.target.value })}
                  className="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">{option}</span>
              </label>
            ))}
          </div>

          {data.bioavailability === 'Other' && (
            <div className="mt-3">
              <input
                type="text"
                value={data.otherBioavailability || ''}
                onChange={(e) => onChange({ ...data, otherBioavailability: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                placeholder="Please specify other approach"
              />
            </div>
          )}
        </div>

        <div>
          <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
            For a Tier 2b screening-level risk assessment, please rank the following lines of evidence in order
            of importance for developing a robust framework (1 = Most Important):
          </h4>
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3 mb-4">
            <p className="text-sm text-gray-700 dark:text-gray-300">
              <strong>Note:</strong> The specific requirements, procedures, accepted model(s), and sources of information
              for Tier 2a assessments will be detailed in <strong>Protocol 2</strong>, while Tier 2b assessments will
              be covered in <strong>Protocol 13</strong>. These protocols will provide the technical guidance needed
              for practical implementation of the tiered approach.
            </p>
          </div>

          <div className="space-y-3">
            {evidenceOptions.map((option, index) => (
              <div key={option} className="flex items-center space-x-4">
                <label className="w-8 text-sm font-medium text-gray-700 dark:text-gray-300">
                  Rank {index + 1}:
                </label>
                <select
                  value={data.evidence?.[option] || ''}
                  onChange={(e) => {
                    const newEvidence = { ...data.evidence, [option]: e.target.value }
                    onChange({ ...data, evidence: newEvidence })
                  }}
                  className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="">Select rank</option>
                  {evidenceOptions.map((_, rankIndex) => (
                    <option key={rankIndex} value={rankIndex + 1}>
                      {rankIndex + 1}
                    </option>
                  ))}
                </select>
                <div className="flex-1">
                  {option === 'Other' ? (
                    <input
                      type="text"
                      value={data.evidenceOtherText || ''}
                      onChange={(e) => onChange({ ...data, evidenceOtherText: e.target.value })}
                      placeholder="Please specify other line of evidence..."
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                    />
                  ) : (
                    <span className="text-sm text-gray-700 dark:text-gray-300">{option}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            What specific technical guidance, protocols, or models are most essential to ensure the Tiered
            Assessment Approach is implemented consistently and defensibly across the province?
          </label>
          <div className="relative">
            <textarea
              value={data.guidance || ''}
              onChange={(e) => onChange({ ...data, guidance: e.target.value })}
              rows={6}
              maxLength={2000}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
              placeholder="Enter your response here..."
            />
            <div className="absolute bottom-2 right-2 text-xs text-gray-500 dark:text-gray-400">
              {(data.guidance || '').length}/2000 characters
            </div>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Additional comments or feedback related to the Tiered Assessment Approach:
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

export default Part5TieredApproach
