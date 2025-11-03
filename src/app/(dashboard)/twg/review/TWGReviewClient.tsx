'use client'

import { useState, useEffect } from 'react'
import { User } from '@supabase/supabase-js'
import { refreshGlobalAdminStatus } from '@/lib/admin-utils'

interface ReviewSubmission {
  id: string
  user_id: string
  status: 'IN_PROGRESS' | 'SUBMITTED'
  form_data: any
  created_at: string
  updated_at: string
}

interface TWGReviewClientProps {
  user: User
  existingSubmission?: ReviewSubmission
}

export default function TWGReviewClient({ user, existingSubmission }: TWGReviewClientProps) {
  const [formData, setFormData] = useState<any>(existingSubmission?.form_data || {})
  const [isSaving, setIsSaving] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [saveMessage, setSaveMessage] = useState('')
  const [currentSection, setCurrentSection] = useState(1)
  const [completedSections, setCompletedSections] = useState<number[]>([])
  const [isDarkMode, setIsDarkMode] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  // Check for dark mode
  useEffect(() => {
    const checkDarkMode = () => {
      setIsDarkMode(document.documentElement.classList.contains('dark'))
    }
    
    checkDarkMode()
    
    // Watch for theme changes
    const observer = new MutationObserver(checkDarkMode)
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    
    return () => observer.disconnect()
  }, [])

  // Refresh admin status on mount
  useEffect(() => {
    const refreshAdmin = async () => {
      await refreshGlobalAdminStatus()
    }
    
    refreshAdmin()
  }, [])

  // Check which sections are completed
  useEffect(() => {
    const completed: number[] = []
    
    // Check Part 1: Reviewer Information
    if (formData.part1?.name && formData.part1?.expertise?.length > 0) {
      completed.push(1)
    }
    
    // Check Part 2: High-Level Report Assessment
    if (formData.part2?.clarity && formData.part2?.completeness && formData.part2?.defensibility) {
      completed.push(2)
    }
    
    // Check Part 3: Line-by-Line Comments (formerly Part 7)
    if (formData.part3?.sectionI || formData.part3?.sectionII || formData.part3?.sectionIII || formData.part3?.sectionIV || formData.part3?.sectionV || formData.part3?.appendicesCD) {
      completed.push(3)
    }
    
    // Check Part 4: Matrix Sediment Standards Framework (formerly Part 3)
    if (formData.part4?.ranking && formData.part4?.challenges) {
      completed.push(4)
    }
    
    // Check Part 5: Tiered Assessment Approach (formerly Part 4)
    if (formData.part5?.bioavailability && formData.part5?.evidence && formData.part5?.guidance) {
      completed.push(5)
    }
    
    // Check Part 6: Integration of Indigenous Knowledge (formerly Part 5)
    if (formData.part6?.tier0Approaches && formData.part6?.frameworkElements && formData.part6?.studyComponents) {
      completed.push(6)
    }
    
    // Check Part 7: Prioritization and Strategic Direction (formerly Part 6)
    if (formData.part7?.modernization && formData.part7?.research) {
      completed.push(7)
    }
    
    // Check Part 8: Final Recommendations
    if (formData.part8?.gaps && formData.part8?.suggestions) {
      completed.push(8)
    }
    
    setCompletedSections(completed)
  }, [formData])

  const handleSaveProgress = async () => {
    setIsSaving(true)
    setSaveMessage('')
    
    try {
      const response = await fetch('/api/review/save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ formData }),
      })
      
      const result = await response.json()
      
      if (result.success) {
        setSaveMessage('Progress saved successfully!')
        setTimeout(() => setSaveMessage(''), 3000)
      } else {
        console.error('Save error:', result)
        setSaveMessage(`Error saving progress: ${result.error || 'Unknown error'}`)
      }
    } catch (error) {
      console.error('Error saving progress:', error)
      setSaveMessage(`Error saving progress: ${error instanceof Error ? error.message : 'Network error'}`)
    } finally {
      setIsSaving(false)
    }
  }

  const handleNextSection = async () => {
    // First save the current progress
    await handleSaveProgress()
    
    // Then move to next section
    if (currentSection < 8) {
      setCurrentSection(currentSection + 1)
      setCompletedSections(prev => [...prev, currentSection])
    }
  }

  const handleSubmit = async () => {
    if (!confirm('Are you sure you want to submit your review? This action cannot be undone.')) {
      return
    }
    
    setIsSubmitting(true)
    
    try {
      const response = await fetch('/api/review/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ formData }),
      })
      
      const result = await response.json()
      
      if (result.success) {
        alert('Review submitted successfully! Thank you for your feedback.')
        window.location.href = '/dashboard'
      } else {
        alert('Error submitting review. Please try again.')
      }
    } catch (error) {
      console.error('Error submitting review:', error)
      alert('Error submitting review. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const updateFormData = (part: string, data: any) => {
    setFormData((prev: any) => ({
      ...prev,
      [part]: { ...prev[part], ...data }
    }))
  }

  const sections = [
    { id: 1, title: 'Reviewer Information', description: 'Optional background information' },
    { id: 2, title: 'High-Level Report Assessment', description: 'Overall impressions and ratings' },
    { id: 3, title: 'Line-by-Line Comments', description: 'Detailed feedback by section' },
    { id: 4, title: 'Matrix Sediment Standards Framework', description: 'Dual standard approach feedback' },
    { id: 5, title: 'Tiered Assessment Approach', description: 'Scientific framework evaluation' },
    { id: 6, title: 'Integration of Indigenous Knowledge', description: 'Knowledge systems integration' },
    { id: 7, title: 'Prioritization and Strategic Direction', description: 'Research and implementation priorities' },
    { id: 8, title: 'Final Recommendations', description: 'Critical gaps and suggestions' }
  ]

  return (
    <div className="flex min-h-screen">
      {/* Navigation Sidebar */}
      <div className="hidden lg:block w-80 bg-blue-100 dark:bg-gray-800 shadow-lg border-r border-gray-200 dark:border-gray-700">
        <div className="p-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            TWG Review
          </h1>
          <p className="text-gray-600 dark:text-gray-300 mb-6">
            Modernizing BC's Sediment Standards
          </p>
          
          <nav className="space-y-2">
            {sections.map((section) => (
              <button
                key={section.id}
                onClick={() => setCurrentSection(section.id)}
                className={`w-full text-left p-3 rounded-lg transition-colors ${
                  currentSection === section.id
                    ? 'bg-blue-100 dark:bg-blue-900'
                    : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div 
                      className="font-medium" 
                      style={{ 
                        color: isDarkMode 
                          ? (currentSection === section.id ? '#60A5FA' : '#D1D5DB')
                          : '#000000'
                      }}
                    >
                      Part {section.id}
                    </div>
                    <div 
                      className="text-sm" 
                      style={{ 
                        color: isDarkMode 
                          ? (currentSection === section.id ? '#60A5FA' : '#D1D5DB')
                          : '#000000', 
                        opacity: currentSection === section.id ? 1 : 0.75 
                      }}
                    >
                      {section.title}
                    </div>
                  </div>
                  {completedSections.includes(section.id) && (
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  )}
                </div>
              </button>
            ))}
          </nav>
        </div>
        
        {/* Save Progress Button */}
        <div className="p-6 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={handleSaveProgress}
            disabled={isSaving}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium py-2 px-4 rounded-lg transition-colors"
          >
            {isSaving ? 'Saving...' : 'Save Progress'}
          </button>
          
          {saveMessage && (
            <p className={`mt-2 text-sm ${saveMessage.includes('Error') ? 'text-red-600' : 'text-green-600'}`}>
              {saveMessage}
            </p>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto">
        {/* Mobile Navigation Header */}
        <div className="lg:hidden bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">TWG Review</h1>
              <p className="text-sm text-gray-600 dark:text-gray-300">Part {currentSection}: {sections.find(s => s.id === currentSection)?.title}</p>
            </div>
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="p-2 rounded-md text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                {isMobileMenuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile Navigation Overlay */}
        {isMobileMenuOpen && (
          <div className="lg:hidden fixed inset-0 z-50 bg-black bg-opacity-50" onClick={() => setIsMobileMenuOpen(false)}>
            <div className="fixed inset-y-0 left-0 w-80 bg-blue-100 dark:bg-gray-800 shadow-xl" onClick={(e) => e.stopPropagation()}>
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h1 className="text-2xl font-bold text-gray-900 dark:text-white">TWG Review</h1>
                  <button
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="p-2 rounded-md text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700"
                  >
                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <p className="text-gray-600 dark:text-gray-300 mb-6">
                  Modernizing BC's Sediment Standards
                </p>
                
                <nav className="space-y-2">
                  {sections.map((section) => (
                    <button
                      key={section.id}
                      onClick={() => {
                        setCurrentSection(section.id)
                        setIsMobileMenuOpen(false)
                      }}
                      className={`w-full text-left p-3 rounded-lg transition-colors ${
                        currentSection === section.id
                          ? 'bg-blue-100 dark:bg-blue-900'
                          : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div 
                            className="font-medium" 
                            style={{ 
                              color: isDarkMode 
                                ? (currentSection === section.id ? '#60A5FA' : '#D1D5DB')
                                : '#000000'
                            }}
                          >
                            Part {section.id}
                          </div>
                          <div 
                            className="text-sm" 
                            style={{ 
                              color: isDarkMode 
                                ? (currentSection === section.id ? '#60A5FA' : '#D1D5DB')
                                : '#000000', 
                              opacity: currentSection === section.id ? 1 : 0.75 
                            }}
                          >
                            {section.title}
                          </div>
                        </div>
                        {completedSections.includes(section.id) && (
                          <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                        )}
                      </div>
                    </button>
                  ))}
                </nav>
                
                {/* Save Progress Button */}
                <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
                  <button
                    onClick={() => {
                      handleSaveProgress()
                      setIsMobileMenuOpen(false)
                    }}
                    disabled={isSaving}
                    className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium py-2 px-4 rounded-lg transition-colors"
                  >
                    {isSaving ? 'Saving...' : 'Save Progress'}
                  </button>
                  
                  {saveMessage && (
                    <p className={`mt-2 text-sm ${saveMessage.includes('Error') ? 'text-red-600' : 'text-green-600'}`}>
                      {saveMessage}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="max-w-4xl mx-auto p-4 lg:p-8">
          {/* Header */}
          <div className="mb-8">
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
              Expert Review Form: Modernizing British Columbia's Sediment Standards
            </h2>
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6">
              <p className="text-gray-700 dark:text-gray-300 mb-4">
                Welcome and thank you for contributing your expertise to this critical initiative. 
                This form is designed to collect detailed feedback on the{' '}
                <a 
                  href="https://docs.google.com/document/d/1szIIwrTLYB1if4B0Ied-3ke_7g7_7N36HXM20d22J2o/edit?usp=sharing" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 underline font-medium"
                >
                  'Modernizing British Columbia's Sediment Standards' report
                </a>
                . Your input will directly inform revision of this document and development of the 
                options analysis and recommendations for the next phase of this project.
              </p>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                <p><strong>Instructions:</strong></p>
                <ul className="list-disc list-inside mt-2 space-y-1">
                  <li>Please complete all sections to the best of your ability.</li>
                  <li>You may use the 'Save Progress' button at any time to save your work and return later.</li>
                  <li>The form is divided into sections that mirror the report's structure.</li>
                  <li>The estimated time to complete this review is 60-90 minutes.</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Form Sections */}
          {currentSection === 1 && (
            <Part1ReviewerInformation 
              data={formData.part1 || {}} 
              onChange={(data) => updateFormData('part1', data)} 
            />
          )}
          
          {currentSection === 2 && (
            <Part2HighLevelAssessment 
              data={formData.part2 || {}} 
              onChange={(data) => updateFormData('part2', data)} 
            />
          )}
          
          {currentSection === 3 && (
            <Part3LineByLineComments 
              data={formData.part3 || {}} 
              onChange={(data) => updateFormData('part3', data)} 
            />
          )}
          
          {currentSection === 4 && (
            <Part4MatrixFramework 
              data={formData.part4 || {}} 
              onChange={(data) => updateFormData('part4', data)} 
            />
          )}
          
          {currentSection === 5 && (
            <Part5TieredApproach 
              data={formData.part5 || {}} 
              onChange={(data) => updateFormData('part5', data)} 
            />
          )}
          
          {currentSection === 6 && (
            <Part6IndigenousKnowledge 
              data={formData.part6 || {}} 
              onChange={(data) => updateFormData('part6', data)} 
            />
          )}
          
          {currentSection === 7 && (
            <Part7Prioritization 
              data={formData.part7 || {}} 
              onChange={(data) => updateFormData('part7', data)} 
            />
          )}
          
          {currentSection === 8 && (
            <Part8FinalRecommendations 
              data={formData.part8 || {}} 
              onChange={(data) => updateFormData('part8', data)} 
            />
          )}

          {/* Save and Proceed Button */}
          {currentSection < 8 && (
            <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
              <div className="flex justify-between items-center">
                <button
                  onClick={handleSaveProgress}
                  disabled={isSaving}
                  className="px-6 py-2 bg-gray-500 hover:bg-gray-600 disabled:bg-gray-400 text-white rounded-lg transition-colors"
                >
                  {isSaving ? 'Saving...' : 'Save Progress'}
                </button>
                
                <button
                  onClick={handleNextSection}
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
          {currentSection === 8 && (
            <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white font-medium py-3 px-6 rounded-lg transition-colors"
              >
                {isSubmitting ? 'Submitting...' : 'Submit Review'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// Form Section Components
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

function Part3LineByLineComments({ data, onChange }: { data: any, onChange: (data: any) => void }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8">
      <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
        Part 3: Line-by-Line Comments
      </h3>
      
      <div className="space-y-6">
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <p className="text-gray-700 dark:text-gray-300">
            Please provide detailed, line-by-line comments for each section of the report. 
            Reference specific page numbers, sections, and line numbers to ensure clarity. 
            Each text area allows up to 5,000 characters.
          </p>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Section I - Introduction:
          </label>
          <div className="relative">
            <textarea
              value={data.sectionI || ''}
              onChange={(e) => onChange({ ...data, sectionI: e.target.value })}
              rows={8}
              maxLength={5000}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
              placeholder="Enter your line-by-line comments for Section I - Introduction here..."
            />
            <div className="absolute bottom-2 right-2 text-xs text-gray-500 dark:text-gray-400">
              {(data.sectionI || '').length}/5000 characters
            </div>
          </div>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Section II - Preliminary Scientific Research Findings:
          </label>
          <div className="relative">
            <textarea
              value={data.sectionII || ''}
              onChange={(e) => onChange({ ...data, sectionII: e.target.value })}
              rows={8}
              maxLength={5000}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
              placeholder="Enter your line-by-line comments for Section II - Preliminary Scientific Research Findings here..."
            />
            <div className="absolute bottom-2 right-2 text-xs text-gray-500 dark:text-gray-400">
              {(data.sectionII || '').length}/5000 characters
            </div>
          </div>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Section III - Jurisdictional Scan:
          </label>
          <div className="relative">
            <textarea
              value={data.sectionIII || ''}
              onChange={(e) => onChange({ ...data, sectionIII: e.target.value })}
              rows={8}
              maxLength={5000}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
              placeholder="Enter your line-by-line comments for Section III - Jurisdictional Scan here..."
            />
            <div className="absolute bottom-2 right-2 text-xs text-gray-500 dark:text-gray-400">
              {(data.sectionIII || '').length}/5000 characters
            </div>
          </div>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Section IV - Community and Stakeholder Engagement Insights:
          </label>
          <div className="relative">
            <textarea
              value={data.sectionIV || ''}
              onChange={(e) => onChange({ ...data, sectionIV: e.target.value })}
              rows={8}
              maxLength={5000}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
              placeholder="Enter your line-by-line comments for Section IV - Community and Stakeholder Engagement Insights here..."
            />
            <div className="absolute bottom-2 right-2 text-xs text-gray-500 dark:text-gray-400">
              {(data.sectionIV || '').length}/5000 characters
            </div>
          </div>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Section V - Proposed Framework for Modernized Sediment Standards:
          </label>
          <div className="relative">
            <textarea
              value={data.sectionV || ''}
              onChange={(e) => onChange({ ...data, sectionV: e.target.value })}
              rows={8}
              maxLength={5000}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
              placeholder="Enter your line-by-line comments for Section V - Proposed Framework for Modernized Sediment Standards here..."
            />
            <div className="absolute bottom-2 right-2 text-xs text-gray-500 dark:text-gray-400">
              {(data.sectionV || '').length}/5000 characters
            </div>
          </div>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Appendices C & D:
          </label>
          <div className="relative">
            <textarea
              value={data.appendicesCD || ''}
              onChange={(e) => onChange({ ...data, appendicesCD: e.target.value })}
              rows={8}
              maxLength={5000}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
              placeholder="Enter your line-by-line comments for Appendices C & D here..."
            />
            <div className="absolute bottom-2 right-2 text-xs text-gray-500 dark:text-gray-400">
              {(data.appendicesCD || '').length}/5000 characters
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

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

function Part6IndigenousKnowledge({ data, onChange }: { data: any, onChange: (data: any) => void }) {
  const tier0Options = [
    'Implement Tier 0 anti-degradation provisions for sediment quality',
    'Establish baseline sediment quality conditions for reference',
    'Develop criteria for identifying pristine or near-pristine sediment conditions',
    'Create protocols for protecting high-quality sediment areas from degradation',
    'Other'
  ]

  const frameworkOptions = [
    'Develop risk-based scientific framework for numerical sediment standards',
    'Include Indigenous Uses as a third protection goal alongside human health and ecological protection',
    'Integrate traditional ecological knowledge into standard derivation methodologies',
    'Establish culturally appropriate risk assessment endpoints',
    'Develop community-specific exposure scenarios for Indigenous populations',
    'Other'
  ]

  const studyOptions = [
    'Conduct desktop review of regional and watershed-specific sediment data',
    'Compile existing reports on sediment contamination in Indigenous territories',
    'Identify data gaps and priority areas for additional study',
    'Develop methodology for engaging Indigenous communities in collaborative studies',
    'Create protocols for respectful and meaningful community engagement',
    'Other'
  ]

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8">
      <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
        Part 6: WQCIU Approaches for Indigenous Uses Integration
      </h3>
      
      <div className="space-y-6">
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <p className="text-gray-700 dark:text-gray-300">
            This section focuses on technical approaches for integrating Indigenous Uses into sediment standards 
            development, including Tier 0 anti-degradation provisions, risk-based frameworks, and collaborative 
            study methodologies as outlined in the WQCIU recommendations.
          </p>
        </div>
        
        <div>
          <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
            Which Tier 0 anti-degradation approaches should be prioritized for sediment quality protection? (Select up to three):
          </h4>
          
          <div className="space-y-3">
            {tier0Options.map((option) => (
              <label key={option} className="flex items-center">
                <input
                  type="checkbox"
                  checked={data.tier0Approaches?.includes(option) || false}
                  onChange={(e) => {
                    const currentApproaches = data.tier0Approaches || []
                    const newApproaches = e.target.checked
                      ? [...currentApproaches, option]
                      : currentApproaches.filter((approach: string) => approach !== option)
                    onChange({ ...data, tier0Approaches: newApproaches })
                  }}
                  className="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">{option}</span>
              </label>
            ))}
          </div>
          
          {data.tier0Approaches?.includes('Other') && (
            <div className="mt-3">
              <input
                type="text"
                value={data.tier0OtherText || ''}
                onChange={(e) => onChange({ ...data, tier0OtherText: e.target.value })}
                placeholder="Please specify other Tier 0 approach..."
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
              />
            </div>
          )}
        </div>
        
        <div>
          <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
            What elements should be included in a risk-based scientific framework for deriving numerical sediment standards? (Select up to three):
          </h4>
          
          <div className="space-y-3">
            {frameworkOptions.map((option) => (
              <label key={option} className="flex items-center">
                <input
                  type="checkbox"
                  checked={data.frameworkElements?.includes(option) || false}
                  onChange={(e) => {
                    const currentElements = data.frameworkElements || []
                    const newElements = e.target.checked
                      ? [...currentElements, option]
                      : currentElements.filter((element: string) => element !== option)
                    onChange({ ...data, frameworkElements: newElements })
                  }}
                  className="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">{option}</span>
              </label>
            ))}
          </div>
          
          {data.frameworkElements?.includes('Other') && (
            <div className="mt-3">
              <input
                type="text"
                value={data.frameworkOtherText || ''}
                onChange={(e) => onChange({ ...data, frameworkOtherText: e.target.value })}
                placeholder="Please specify other framework element..."
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
              />
            </div>
          )}
        </div>
        
        <div>
          <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
            What components should be included in a desktop review study for regional and watershed-specific information? (Select up to three):
          </h4>
          
          <div className="space-y-3">
            {studyOptions.map((option) => (
              <label key={option} className="flex items-center">
                <input
                  type="checkbox"
                  checked={data.studyComponents?.includes(option) || false}
                  onChange={(e) => {
                    const currentComponents = data.studyComponents || []
                    const newComponents = e.target.checked
                      ? [...currentComponents, option]
                      : currentComponents.filter((component: string) => component !== option)
                    onChange({ ...data, studyComponents: newComponents })
                  }}
                  className="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">{option}</span>
              </label>
            ))}
          </div>
          
          {data.studyComponents?.includes('Other') && (
            <div className="mt-3">
              <input
                type="text"
                value={data.studyOtherText || ''}
                onChange={(e) => onChange({ ...data, studyOtherText: e.target.value })}
                placeholder="Please specify other study component..."
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
              />
            </div>
          )}
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            What are the key technical and methodological challenges in implementing these WQCIU approaches for Indigenous Uses integration? 
            Please provide specific recommendations for addressing these challenges:
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
            Additional comments or feedback related to WQCIU Approaches for Indigenous Uses Integration:
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

function Part7Prioritization({ data, onChange }: { data: any, onChange: (data: any) => void }) {
  const modernizationOptions = [
    'Development of a Scientific Framework for Deriving Site-Specific Sediment Standards (Bioavailability Adjustment)',
    'Development of a Matrix Sediment Standards Framework - Focus on Ecological Protection',
    'Development of a Matrix Sediment Standards Framework - Focus on Human Health Protection',
    'Develop Sediment Standards for Non-scheduled Contaminants & Mixtures'
  ]

  const researchOptions = [
    'Research into the ecosystem-level impacts of chronic, low-level contaminant exposure',
    'Development of advanced in-vitro and high-throughput screening methods for rapid hazard assessment',
    'Investigating the toxicological impacts of climate change variables (e.g., temperature, hypoxia) on sediment contaminant toxicity',
    'Building a comprehensive, open-access database of sediment chemistry and toxicology data for all of BC'
  ]

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8">
      <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
        Part 7: Prioritization and Strategic Direction
      </h3>
      
      <div className="space-y-8">
        <div>
          <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
            Based on your experience, please rank these four areas for modernization priority in BC's sediment 
            standards (1 = highest):
          </h4>
          
          <div className="space-y-3">
            {modernizationOptions.map((option, index) => (
              <div key={option} className="flex items-center space-x-4">
                <label className="w-8 text-sm font-medium text-gray-700 dark:text-gray-300">
                  Rank {index + 1}:
                </label>
                <select
                  value={data.modernization?.[option] || ''}
                  onChange={(e) => {
                    const newModernization = { ...data.modernization, [option]: e.target.value }
                    onChange({ ...data, modernization: newModernization })
                  }}
                  className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="">Select rank</option>
                  {modernizationOptions.map((_, rankIndex) => (
                    <option key={rankIndex} value={rankIndex + 1}>
                      {rankIndex + 1}
                    </option>
                  ))}
                </select>
                <span className="text-sm text-gray-700 dark:text-gray-300">{option}</span>
              </div>
            ))}
          </div>
        </div>
        
        <div>
          <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
            To support long-term (5+ years) strategic goals, please rank the following foundational research areas 
            in order of importance for creating a more adaptive and forward-looking regulatory framework (1 = highest importance):
          </h4>
          
          <div className="space-y-3">
            {researchOptions.map((option, index) => (
              <div key={option} className="flex items-center space-x-4">
                <label className="w-8 text-sm font-medium text-gray-700 dark:text-gray-300">
                  Rank {index + 1}:
                </label>
                <select
                  value={data.research?.[option] || ''}
                  onChange={(e) => {
                    const newResearch = { ...data.research, [option]: e.target.value }
                    onChange({ ...data, research: newResearch })
                  }}
                  className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="">Select rank</option>
                  {researchOptions.map((_, rankIndex) => (
                    <option key={rankIndex} value={rankIndex + 1}>
                      {rankIndex + 1}
                    </option>
                  ))}
                </select>
                <span className="text-sm text-gray-700 dark:text-gray-300">{option}</span>
              </div>
            ))}
          </div>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Strategic Planning and Implementation: Based on your rankings above, please provide your recommendations for 
            strategic planning and implementation priorities. Consider factors such as:
          </label>
          <ul className="list-disc list-inside text-sm text-gray-600 dark:text-gray-400 mb-4 ml-4">
            <li>Feasibility and resource requirements for each priority area</li>
            <li>Timeline considerations and dependencies between different modernization efforts</li>
            <li>Potential impact and benefits of each priority</li>
            <li>Integration with existing regulatory frameworks and processes</li>
            <li>Stakeholder engagement and collaboration needs</li>
            <li>Risk management and mitigation strategies</li>
          </ul>
          <div className="relative">
            <textarea
              value={data.strategicPlanning || ''}
              onChange={(e) => onChange({ ...data, strategicPlanning: e.target.value })}
              rows={8}
              maxLength={3000}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
              placeholder="Please provide your strategic planning recommendations and implementation priorities..."
            />
            <div className="absolute bottom-2 right-2 text-xs text-gray-500 dark:text-gray-400">
              {(data.strategicPlanning || '').length}/3000 characters
            </div>
          </div>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Additional comments or feedback related to Prioritization and Strategic Direction:
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


function Part8FinalRecommendations({ data, onChange }: { data: any, onChange: (data: any) => void }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8">
      <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
        Part 8: Final Recommendations
      </h3>
      
      <div className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Are there any critical scientific gaps, alternative approaches, or significant risks that you believe 
            the report has overlooked?
          </label>
          <div className="relative">
            <textarea
              value={data.gaps || ''}
              onChange={(e) => onChange({ ...data, gaps: e.target.value })}
              rows={6}
              maxLength={2000}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
              placeholder="Enter your response here..."
            />
            <div className="absolute bottom-2 right-2 text-xs text-gray-500 dark:text-gray-400">
              {(data.gaps || '').length}/2000 characters
            </div>
          </div>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Please provide any other comments or suggestions you have for improving the report or the proposed framework:
          </label>
          <div className="relative">
            <textarea
              value={data.suggestions || ''}
              onChange={(e) => onChange({ ...data, suggestions: e.target.value })}
              rows={6}
              maxLength={2000}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
              placeholder="Enter your response here..."
            />
            <div className="absolute bottom-2 right-2 text-xs text-gray-500 dark:text-gray-400">
              {(data.suggestions || '').length}/2000 characters
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
