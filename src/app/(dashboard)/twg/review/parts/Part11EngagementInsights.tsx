'use client'

function Part11EngagementInsights({ data, onChange }: { data: any, onChange: (data: any) => void }) {
  const prioritizedEngagementOptions = [
    'First Nations / Indigenous Rights Holders',
    'Remote and coastal communities',
    'Industry and port authorities',
    'Academic and research institutions',
    'Youth and early-career practitioners',
    'Environmental NGOs',
    'Municipal/local governments',
    'Public health / One Health experts',
    'Other'
  ]

  const participationInterestOptions = [
    'SABCS-hosted workshops or summits',
    'Virtual technical meetings',
    'Focused working groups on specialized topics',
    'Joint sessions with other regulatory or advisory bodies',
    'Other'
  ]

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8">
      <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
        Part 11: Community &amp; Stakeholder Engagement Insights
      </h3>

      <div className="space-y-6">
        <div>
          <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-3">
            Future phases will include expanded engagement beyond the survey, CEW session, and TWG feedback captured in Section IV. Which groups or knowledge holders should be prioritized? (Select all that apply)
          </h4>
          <div className="space-y-3">
            {prioritizedEngagementOptions.map((option) => (
              <label key={option} className="flex items-start space-x-2">
                <input
                  type="checkbox"
                  checked={data.prioritizedEngagements?.includes(option) || false}
                  onChange={(e) => {
                    const current = data.prioritizedEngagements || []
                    const updated = e.target.checked
                      ? [...current, option]
                      : current.filter((item: string) => item !== option)
                    onChange({ ...data, prioritizedEngagements: updated })
                  }}
                  className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">{option}</span>
              </label>
            ))}
          </div>

          {data.prioritizedEngagements?.includes('Other') && (
            <div className="mt-3">
              <input
                type="text"
                value={data.prioritizedEngagementsOther || ''}
                onChange={(e) => onChange({ ...data, prioritizedEngagementsOther: e.target.value })}
                placeholder="Please specify additional groups or knowledge holders..."
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
              />
            </div>
          )}
        </div>

        <div>
          <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-3">
            How well does Section IV capture and summarize the engagement completed so far (survey, CEW session, TWG feedback)?
          </h4>
          <div className="space-y-3">
            {[
              'Very well – accurately reflects available input',
              'Reasonably well – minor clarifications needed',
              'Partially – needs additional detail or emphasis',
              'Not well – significant updates required'
            ].map((option) => (
              <label key={option} className="flex items-start space-x-2">
                <input
                  type="radio"
                  name="engagementSummaryQuality"
                  value={option}
                  checked={data.engagementSummaryQuality === option}
                  onChange={(e) => onChange({ ...data, engagementSummaryQuality: e.target.value })}
                  className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">{option}</span>
              </label>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Provide examples or suggestions to strengthen Section IV based on the engagement completed to date.
          </label>
          <div className="relative">
            <textarea
              value={data.evidenceSummary || ''}
              onChange={(e) => onChange({ ...data, evidenceSummary: e.target.value })}
              rows={5}
              maxLength={1800}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
              placeholder="Reference key insights from the survey, CEW session, or TWG feedback that should be highlighted or clarified."
            />
            <div className="absolute bottom-2 right-2 text-xs text-gray-500 dark:text-gray-400">
              {(data.evidenceSummary || '').length}/1800 characters
            </div>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            What types of engagement activities would you be most interested in participating in during future phases? (Select all that apply)
          </label>
          <div className="space-y-3">
            {participationInterestOptions.map((option) => (
              <label key={option} className="flex items-start space-x-2">
                <input
                  type="checkbox"
                  checked={data.engagementInterests?.includes(option) || false}
                  onChange={(e) => {
                    const currentInterests = data.engagementInterests || []
                    const updated = e.target.checked
                      ? [...currentInterests, option]
                      : currentInterests.filter((item: string) => item !== option)
                    onChange({ ...data, engagementInterests: updated })
                  }}
                  className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">{option}</span>
              </label>
            ))}
          </div>

          {data.engagementInterests?.includes('Other') && (
            <div className="mt-3">
              <input
                type="text"
                value={data.engagementInterestsOther || ''}
                onChange={(e) => onChange({ ...data, engagementInterestsOther: e.target.value })}
                placeholder="Please describe other types of engagement you would join..."
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
              />
            </div>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Line-by-line feedback for Section IV – Community &amp; Stakeholder Engagement Insights (5,000 characters max):
          </label>
          <div className="relative">
            <textarea
              value={data.lineByLine || ''}
              onChange={(e) => onChange({ ...data, lineByLine: e.target.value })}
              rows={8}
              maxLength={5000}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
              placeholder="Provide precise edits for Section IV, referencing page and line numbers..."
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

export default Part11EngagementInsights
