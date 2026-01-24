'use client'

import type { ReviewSection } from '../types'
import Part1ReviewerInformation from '../parts/Part1ReviewerInformation'
import Part2HighLevelAssessment from '../parts/Part2HighLevelAssessment'
import Part3LineByLineComments from '../parts/Part3LineByLineComments'
import Part4MatrixFramework from '../parts/Part4MatrixFramework'
import Part5TieredApproach from '../parts/Part5TieredApproach'
import Part6IndigenousKnowledge from '../parts/Part6IndigenousKnowledge'
import Part7Prioritization from '../parts/Part7Prioritization'
import Part8FinalRecommendations from '../parts/Part8FinalRecommendations'
import Part9StrategicPathways from '../parts/Part9StrategicPathways'
import Part10Conclusions from '../parts/Part10Conclusions'
import Part11EngagementInsights from '../parts/Part11EngagementInsights'
import Part12WhatWeHeard from '../parts/Part12WhatWeHeard'

interface TWGReviewFormContainerProps {
  currentSection: number
  currentSectionData: ReviewSection | undefined
  currentPhaseMeta: { label: string; date: string } | null
  formData: any
  isDarkMode: boolean
  isSaving: boolean
  isSubmitting: boolean
  saveMessage: string
  sections: ReviewSection[]
  onUpdateFormData: (part: string, data: any) => void
  onSaveProgress: () => void
  onNextSection: () => void
  onSubmit: () => void
}

export function TWGReviewFormContainer({
  currentSection,
  currentSectionData,
  currentPhaseMeta,
  formData,
  isDarkMode,
  isSaving,
  isSubmitting,
  saveMessage,
  sections,
  onUpdateFormData,
  onSaveProgress,
  onNextSection,
  onSubmit,
}: TWGReviewFormContainerProps) {
  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-4xl mx-auto p-4 lg:p-8">
        {/* Header */}
        <div className="mb-8">
          {currentSectionData && currentPhaseMeta && (
            <div className="mb-3 text-base font-bold italic text-red-600 dark:text-red-400">
              {`${currentPhaseMeta.label} — ${currentPhaseMeta.date}`}
            </div>
          )}
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
            Expert Review Form: Modernizing British Columbia's Sediment Standards
          </h2>
          <div className={`rounded-lg p-4 mb-6 border ${isDarkMode ? 'bg-gray-900 border-gray-700' : 'bg-sky-100 border-sky-200'}`}>
            <p className={`${isDarkMode ? 'text-gray-200' : 'text-gray-700'}`}>
              Thank you for contributing your expertise to the Technical Working Group (TWG) review.
            </p>
            <ul className={`mt-3 space-y-2 text-sm list-disc list-inside ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
              <li>The "Save Progress" buttons let you capture everything you've entered without submitting.</li>
              <li>You can be anywhere in the form and still switch parts using the navigation panel or mobile drawer—your notes stay in place.</li>
              <li>Use the "Submit Review" button in Part 12 to let us know your review is ready.</li>
            </ul>
          </div>
        </div>

        {/* Form Sections */}
        {currentSection === 1 && (
          <Part1ReviewerInformation
            data={formData.part1 || {}}
            onChange={(data) => onUpdateFormData('part1', data)}
          />
        )}

        {currentSection === 2 && (
          <Part2HighLevelAssessment
            data={formData.part2 || {}}
            onChange={(data) => onUpdateFormData('part2', data)}
          />
        )}

        {currentSection === 3 && (
          <Part3LineByLineComments
            data={formData.part3 || {}}
            onChange={(data) => onUpdateFormData('part3', data)}
          />
        )}

        {currentSection === 4 && (
          <Part4MatrixFramework
            data={formData.part4 || {}}
            onChange={(data) => onUpdateFormData('part4', data)}
          />
        )}

        {currentSection === 5 && (
          <Part5TieredApproach
            data={formData.part5 || {}}
            onChange={(data) => onUpdateFormData('part5', data)}
          />
        )}

        {currentSection === 6 && (
          <Part6IndigenousKnowledge
            data={formData.part6 || {}}
            onChange={(data) => onUpdateFormData('part6', data)}
          />
        )}

        {currentSection === 7 && (
          <Part7Prioritization
            data={formData.part7 || {}}
            onChange={(data) => onUpdateFormData('part7', data)}
          />
        )}

        {currentSection === 8 && (
          <Part8FinalRecommendations
            data={formData.part8 || {}}
            onChange={(data) => onUpdateFormData('part8', data)}
          />
        )}

        {currentSection === 9 && (
          <Part9StrategicPathways
            data={formData.part9 || {}}
            onChange={(data) => onUpdateFormData('part9', data)}
          />
        )}

        {currentSection === 10 && (
          <Part10Conclusions
            data={formData.part10 || {}}
            onChange={(data) => onUpdateFormData('part10', data)}
          />
        )}

        {currentSection === 11 && (
          <Part11EngagementInsights
            data={formData.part11 || {}}
            onChange={(data) => onUpdateFormData('part11', data)}
          />
        )}

        {currentSection === 12 && (
          <Part12WhatWeHeard
            data={formData.part12 || {}}
            onChange={(data) => onUpdateFormData('part12', data)}
          />
        )}

        {/* Save and Proceed Button */}
        {currentSection < sections.length && (
          <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
            <div className="flex justify-between items-center">
              <button
                onClick={onSaveProgress}
                disabled={isSaving}
                className="px-6 py-2 bg-gray-500 hover:bg-gray-600 disabled:bg-gray-400 text-white rounded-lg transition-colors"
              >
                {isSaving ? 'Saving...' : 'Save Progress'}
              </button>

              <button
                onClick={onNextSection}
                disabled={isSaving || isSubmitting}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg transition-colors flex items-center gap-2"
              >
                Save and Proceed to Next Part
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>

            {saveMessage && (
              <div className="mt-3 text-sm text-green-600 dark:text-green-400">
                {saveMessage}
              </div>
            )}
          </div>
        )}

        {/* Submit Button */}
        {currentSection === sections.length && (
          <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
            <button
              onClick={onSubmit}
              disabled={isSubmitting}
              className="bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white font-medium py-3 px-6 rounded-lg transition-colors"
            >
              {isSubmitting ? 'Submitting...' : 'Submit Review'}
            </button>
            {saveMessage && (
              <div className="mt-3 text-sm text-green-600 dark:text-green-400">
                {saveMessage}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
