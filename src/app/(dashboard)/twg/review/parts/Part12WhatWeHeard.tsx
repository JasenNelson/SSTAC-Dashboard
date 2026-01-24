'use client'

function Part12WhatWeHeard({ data, onChange }: { data: any, onChange: (data: any) => void }) {
  const appendixOptions = [
    { key: 'appendixD', label: 'Appendix D – Online Survey "What We Heard"' },
    { key: 'appendixG', label: 'Appendix G – CEW Session "What We Heard"' },
    { key: 'appendixJ', label: 'Appendix J – TWG White Paper Review "What We Heard"' }
  ]

  const statusOptions = [
    'Ready as written',
    'Needs minor edits for clarity/accuracy',
    'Needs additional evidence or synthesis',
    'Requires major restructuring'
  ]

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8">
      <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
        Part 12: "What We Heard" Reports (Appendices D, G, J)
      </h3>

      <div className="space-y-6">
        <div className="space-y-4">
          <h4 className="text-lg font-medium text-gray-900 dark:text-white">
            For each appendix, indicate its readiness and whether further synthesis is required.
          </h4>
          {appendixOptions.map(({ key, label }) => (
            <div key={key}>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {label}
              </label>
              <select
                value={data.appendixStatus?.[key] || ''}
                onChange={(e) => onChange({
                  ...data,
                  appendixStatus: { ...data.appendixStatus, [key]: e.target.value }
                })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="">Select readiness status</option>
                {statusOptions.map((status) => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </select>
            </div>
          ))}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Do the key findings and objectives captured in Appendices D, G, and J align with the recommendations in Section VII?
            Please summarize any gaps that should be emphasized.
          </label>
          <div className="relative">
            <textarea
              value={data.alignmentSummary || ''}
              onChange={(e) => onChange({ ...data, alignmentSummary: e.target.value })}
              rows={6}
              maxLength={2000}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
              placeholder="Highlight where the appendices reinforce the recommendations, and identify any missing themes or objectives that should be brought forward..."
            />
            <div className="absolute bottom-2 right-2 text-xs text-gray-500 dark:text-gray-400">
              {(data.alignmentSummary || '').length}/2000 characters
            </div>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            What additional documentation, polling, or qualitative analysis would strengthen the "What We Heard" narrative?
          </label>
          <div className="relative">
            <textarea
              value={data.followUpNeeds || ''}
              onChange={(e) => onChange({ ...data, followUpNeeds: e.target.value })}
              rows={5}
              maxLength={1500}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
              placeholder="List specific analyses, workshops, or materials needed (e.g., additional polling for emerging contaminants, sector-specific focus groups)..."
            />
            <div className="absolute bottom-2 right-2 text-xs text-gray-500 dark:text-gray-400">
              {(data.followUpNeeds || '').length}/1500 characters
            </div>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Line-by-line feedback for Appendices D, G, and J – "What We Heard" Reports (5,000 characters max):
          </label>
          <div className="relative">
            <textarea
              value={data.lineByLine || ''}
              onChange={(e) => onChange({ ...data, lineByLine: e.target.value })}
              rows={8}
              maxLength={5000}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
              placeholder="Provide precise edits for Appendices D, G, and J, referencing page or figure where revisions are required..."
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

export default Part12WhatWeHeard
