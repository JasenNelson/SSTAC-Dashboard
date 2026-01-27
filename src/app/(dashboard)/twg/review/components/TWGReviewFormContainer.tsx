'use client'

import { Suspense, lazy } from 'react'
import type { ReviewSection } from '../types'
import { PartLoadingFallback } from './PartLoadingFallback'
import { PartErrorBoundary } from './PartErrorBoundary'

const Part1ReviewerInformation = lazy(() => import('../parts/Part1ReviewerInformation'))
const Part2HighLevelAssessment = lazy(() => import('../parts/Part2HighLevelAssessment'))
const Part3LineByLineComments = lazy(() => import('../parts/Part3LineByLineComments'))
const Part4MatrixFramework = lazy(() => import('../parts/Part4MatrixFramework'))
const Part5TieredApproach = lazy(() => import('../parts/Part5TieredApproach'))
const Part6IndigenousKnowledge = lazy(() => import('../parts/Part6IndigenousKnowledge'))
const Part7Prioritization = lazy(() => import('../parts/Part7Prioritization'))
const Part8FinalRecommendations = lazy(() => import('../parts/Part8FinalRecommendations'))
const Part9StrategicPathways = lazy(() => import('../parts/Part9StrategicPathways'))
const Part10Conclusions = lazy(() => import('../parts/Part10Conclusions'))
const Part11EngagementInsights = lazy(() => import('../parts/Part11EngagementInsights'))
const Part12WhatWeHeard = lazy(() => import('../parts/Part12WhatWeHeard'))

interface TWGReviewFormContainerProps {
  currentSection: number
  currentSectionData: ReviewSection | undefined
  currentPhaseMeta: { label: string; date: string } | null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  formData: any
  isDarkMode: boolean
  isSaving: boolean
  isSubmitting: boolean
  saveMessage: string
  sections: ReviewSection[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
            Expert Review Form: Modernizing British Columbia&apos;s Sediment Standards
          </h2>
          <div className={`rounded-lg p-4 mb-6 border ${isDarkMode ? 'bg-gray-900 border-gray-700' : 'bg-sky-100 border-sky-200'}`}>
            <p className={`${isDarkMode ? 'text-gray-200' : 'text-gray-700'}`}>
              Thank you for contributing your expertise to the Technical Working Group (TWG) review.
            </p>
            <ul className={`mt-3 space-y-2 text-sm list-disc list-inside ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
              <li>The &quot;Save Progress&quot; buttons let you capture everything you&apos;ve entered without submitting.</li>
              <li>You can be anywhere in the form and still switch parts using the navigation panel or mobile drawer—your notes stay in place.</li>
              <li>Use the &quot;Submit Review&quot; button in Part 12 to let us know your review is ready.</li>
            </ul>
          </div>
        </div>

        {/* Form Sections */}
        {currentSection === 1 && (
          <PartErrorBoundary partNumber={1}>
            <Suspense fallback={<PartLoadingFallback />}>
              <Part1ReviewerInformation
                data={formData.part1 || {}}
                onChange={(data) => onUpdateFormData('part1', data)}
              />
            </Suspense>
          </PartErrorBoundary>
        )}

        {currentSection === 2 && (
          <PartErrorBoundary partNumber={2}>
            <Suspense fallback={<PartLoadingFallback />}>
              <Part2HighLevelAssessment
                data={formData.part2 || {}}
                onChange={(data) => onUpdateFormData('part2', data)}
              />
            </Suspense>
          </PartErrorBoundary>
        )}

        {currentSection === 3 && (
          <PartErrorBoundary partNumber={3}>
            <Suspense fallback={<PartLoadingFallback />}>
              <Part3LineByLineComments
                data={formData.part3 || {}}
                onChange={(data) => onUpdateFormData('part3', data)}
              />
            </Suspense>
          </PartErrorBoundary>
        )}

        {currentSection === 4 && (
          <PartErrorBoundary partNumber={4}>
            <Suspense fallback={<PartLoadingFallback />}>
              <Part4MatrixFramework
                data={formData.part4 || {}}
                onChange={(data) => onUpdateFormData('part4', data)}
              />
            </Suspense>
          </PartErrorBoundary>
        )}

        {currentSection === 5 && (
          <PartErrorBoundary partNumber={5}>
            <Suspense fallback={<PartLoadingFallback />}>
              <Part5TieredApproach
                data={formData.part5 || {}}
                onChange={(data) => onUpdateFormData('part5', data)}
              />
            </Suspense>
          </PartErrorBoundary>
        )}

        {currentSection === 6 && (
          <PartErrorBoundary partNumber={6}>
            <Suspense fallback={<PartLoadingFallback />}>
              <Part6IndigenousKnowledge
                data={formData.part6 || {}}
                onChange={(data) => onUpdateFormData('part6', data)}
              />
            </Suspense>
          </PartErrorBoundary>
        )}

        {currentSection === 7 && (
          <PartErrorBoundary partNumber={7}>
            <Suspense fallback={<PartLoadingFallback />}>
              <Part7Prioritization
                data={formData.part7 || {}}
                onChange={(data) => onUpdateFormData('part7', data)}
              />
            </Suspense>
          </PartErrorBoundary>
        )}

        {currentSection === 8 && (
          <PartErrorBoundary partNumber={8}>
            <Suspense fallback={<PartLoadingFallback />}>
              <Part8FinalRecommendations
                data={formData.part8 || {}}
                onChange={(data) => onUpdateFormData('part8', data)}
              />
            </Suspense>
          </PartErrorBoundary>
        )}

        {currentSection === 9 && (
          <PartErrorBoundary partNumber={9}>
            <Suspense fallback={<PartLoadingFallback />}>
              <Part9StrategicPathways
                data={formData.part9 || {}}
                onChange={(data) => onUpdateFormData('part9', data)}
              />
            </Suspense>
          </PartErrorBoundary>
        )}

        {currentSection === 10 && (
          <PartErrorBoundary partNumber={10}>
            <Suspense fallback={<PartLoadingFallback />}>
              <Part10Conclusions
                data={formData.part10 || {}}
                onChange={(data) => onUpdateFormData('part10', data)}
              />
            </Suspense>
          </PartErrorBoundary>
        )}

        {currentSection === 11 && (
          <PartErrorBoundary partNumber={11}>
            <Suspense fallback={<PartLoadingFallback />}>
              <Part11EngagementInsights
                data={formData.part11 || {}}
                onChange={(data) => onUpdateFormData('part11', data)}
              />
            </Suspense>
          </PartErrorBoundary>
        )}

        {currentSection === 12 && (
          <PartErrorBoundary partNumber={12}>
            <Suspense fallback={<PartLoadingFallback />}>
              <Part12WhatWeHeard
                data={formData.part12 || {}}
                onChange={(data) => onUpdateFormData('part12', data)}
              />
            </Suspense>
          </PartErrorBoundary>
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
