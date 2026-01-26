'use client'

import { useState, useEffect } from 'react'
import { User } from '@supabase/supabase-js'
import { refreshGlobalAdminStatus } from '@/lib/admin-utils'
import { TWGReviewNavigation } from './components/TWGReviewNavigation'
import { TWGReviewFormContainer } from './components/TWGReviewFormContainer'
import type { PhaseKey, ReviewSection, ReviewSubmission } from './types'

// Form data structure for TWG review
interface FormDataStructure {
  [key: string]: unknown;
  part1?: { name?: string; expertise?: string[] };
  part2?: { clarity?: number; completeness?: number; defensibility?: number };
  part3?: { sectionI?: string; sectionII?: string; sectionIII?: string; sectionIV?: string; sectionV?: string; appendicesCD?: string };
  part4?: { ranking?: string; challenges?: string };
  part5?: { bioavailability?: string; evidence?: string; guidance?: string };
  part6?: { tier0Approaches?: string; frameworkElements?: string; studyComponents?: string };
  part7?: { modernization?: string; research?: string };
  part8?: { gaps?: string; suggestions?: string };
  part9?: { option1Edits?: string; option2Edits?: string; option3Edits?: string; otherPathwayIdeas?: string; pathwayRationale?: string; implementationRisks?: string; recommendationUpdates?: string; lineByLine?: string };
  part10?: { recommendationConfidence?: string; priorityAreas?: string[] };
  part11?: { engagementSummaryQuality?: string; prioritizedEngagements?: string[]; prioritizedEngagementsOther?: string; engagementInterests?: string[]; engagementInterestsOther?: string; evidenceSummary?: string; lineByLine?: string };
  part12?: { appendixStatus?: Record<string, boolean>; alignmentSummary?: string; lineByLine?: string };
}

interface TWGReviewClientProps {
  user: User
  existingSubmission?: ReviewSubmission
}

export default function TWGReviewClient({ user, existingSubmission }: TWGReviewClientProps) {
  const [formData, setFormData] = useState<FormDataStructure>(existingSubmission?.form_data || {})
  const [isSaving, setIsSaving] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [saveMessage, setSaveMessage] = useState('')
  const [currentSection, setCurrentSection] = useState(1)
  const [completedSections, setCompletedSections] = useState<number[]>([])
  const [isDarkMode, setIsDarkMode] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [openPhases, setOpenPhases] = useState<Record<PhaseKey, boolean>>({
    'Phase 1 Review': true,
    'Phase 2 Review': true
  })

  const sections: ReviewSection[] = [
    { id: 1, title: 'Reviewer Information', description: 'Optional background information', phase: 'Phase 1 Review' },
    { id: 2, title: 'High-Level Report Assessment', description: 'Overall impressions and ratings', phase: 'Phase 1 Review' },
    { id: 3, title: 'Line-by-Line Comments', description: 'Detailed feedback by section', phase: 'Phase 1 Review' },
    { id: 4, title: 'Matrix Sediment Standards Framework', description: 'Dual standard approach feedback', phase: 'Phase 1 Review' },
    { id: 5, title: 'Tiered Assessment Approach', description: 'Scientific framework evaluation', phase: 'Phase 1 Review' },
    { id: 6, title: 'Integration of Indigenous Knowledge', description: 'Knowledge systems integration', phase: 'Phase 1 Review' },
    { id: 7, title: 'Prioritization and Strategic Direction', description: 'Research and implementation priorities', phase: 'Phase 1 Review' },
    { id: 8, title: 'Final Recommendations', description: 'Critical gaps and suggestions', phase: 'Phase 1 Review' },
    { id: 9, title: 'Strategic Pathways & Options Analysis', description: 'Assess implementation pathways and rationale', phase: 'Phase 2 Review' },
    { id: 10, title: 'Conclusions & Recommendations', description: 'Evaluate proposed actions and readiness', phase: 'Phase 2 Review' },
    { id: 11, title: 'Community & Stakeholder Engagement Insights', description: 'Assess engagement coverage and needs', phase: 'Phase 2 Review' },
    { id: 12, title: '"What We Heard" Reports (Appendices D, G, J)', description: 'Validate synthesis of engagement findings', phase: 'Phase 2 Review' }
  ]

  const phaseMeta: Record<PhaseKey, { label: string; date: string }> = {
    'Phase 1 Review': { label: 'Phase 1 Review', date: 'Nov. 8, 2025' },
    'Phase 2 Review': { label: 'Phase 2 Review', date: 'Dec. 1, 2025' }
  }

  const phaseOrder: PhaseKey[] = ['Phase 1 Review', 'Phase 2 Review']

  const phaseGroups: Record<PhaseKey, ReviewSection[]> = {
    'Phase 1 Review': [],
    'Phase 2 Review': []
  }
  sections.forEach((section) => {
    phaseGroups[section.phase].push(section)
  })

  const currentSectionData = sections.find((section) => section.id === currentSection)
  const currentPhaseMeta = currentSectionData ? phaseMeta[currentSectionData.phase] : null

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
    if (formData.part1?.name && (formData.part1?.expertise?.length ?? 0) > 0) {
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

    // Check Part 9: Strategic Pathways & Options Analysis
    if (
      (formData.part9?.option1Edits || formData.part9?.option2Edits || formData.part9?.option3Edits || formData.part9?.otherPathwayIdeas) &&
      (formData.part9?.pathwayRationale || formData.part9?.implementationRisks || formData.part9?.recommendationUpdates || formData.part9?.lineByLine)
    ) {
      completed.push(9)
    }

    // Check Part 10: Conclusions & Recommendations
    if (formData.part10?.recommendationConfidence && ((formData.part10?.priorityAreas?.length ?? 0) > 0)) {
      completed.push(10)
    }

    // Check Part 11: Community & Stakeholder Engagement Insights (formerly question set)
    const hasPrioritizedEngagements = (formData.part11?.prioritizedEngagements?.length ?? 0) > 0 || !!formData.part11?.prioritizedEngagementsOther
    const hasEngagementInterests = (formData.part11?.engagementInterests?.length ?? 0) > 0 || !!formData.part11?.engagementInterestsOther
    if (
      (formData.part11?.engagementSummaryQuality || hasPrioritizedEngagements || hasEngagementInterests) &&
      (formData.part11?.evidenceSummary || formData.part11?.lineByLine || hasPrioritizedEngagements || hasEngagementInterests)
    ) {
      completed.push(11)
    }

    // Check Part 12: "What We Heard" Reports (Appendices D, G, J)
    if (
      formData.part12?.appendixStatus &&
      ['appendixD', 'appendixG', 'appendixJ'].every((key) => formData.part12?.appendixStatus?.[key]) &&
      (formData.part12?.alignmentSummary || formData.part12?.lineByLine)
    ) {
      completed.push(12)
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
    if (currentSection < sections.length) {
      setCurrentSection(currentSection + 1)
      setCompletedSections(prev => {
        const updated = new Set(prev)
        updated.add(currentSection)
        return Array.from(updated).sort((a, b) => a - b)
      })
    }
  }

  const handleSubmit = async () => {
    if (!confirm('Submit your review now? You can return and submit again later if you add more information.')) {
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
        setSaveMessage('Review submitted successfully! You can resubmit later if needed.')
        setTimeout(() => setSaveMessage(''), 5000)
        setCompletedSections(prev => {
          const updated = new Set(prev)
          sections.forEach(section => updated.add(section.id))
          return Array.from(updated).sort((a, b) => a - b)
        })
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

  const updateFormData = (part: string, data: Record<string, unknown>) => {
    setFormData((prev: FormDataStructure) => {
      const prevPart = prev[part as keyof FormDataStructure];
      return {
        ...prev,
        [part]: { ...(prevPart || {}), ...data }
      }
    })
  }

  const togglePhase = (phase: PhaseKey) => {
    setOpenPhases((prev) => ({
      ...prev,
      [phase]: !prev[phase]
    }))
  }

  return (
    <div className="flex min-h-screen">
      <TWGReviewNavigation
        phaseGroups={phaseGroups}
        phaseOrder={phaseOrder}
        phaseMeta={phaseMeta}
        currentSection={currentSection}
        completedSections={completedSections}
        isDarkMode={isDarkMode}
        isMobileMenuOpen={isMobileMenuOpen}
        isSaving={isSaving}
        saveMessage={saveMessage}
        openPhases={openPhases}
        onSelectSection={setCurrentSection}
        onTogglePhase={togglePhase}
        onToggleMobileMenu={setIsMobileMenuOpen}
        onSaveProgress={handleSaveProgress}
      />

      <TWGReviewFormContainer
        currentSection={currentSection}
        currentSectionData={currentSectionData}
        currentPhaseMeta={currentPhaseMeta}
        formData={formData}
        isDarkMode={isDarkMode}
        isSaving={isSaving}
        isSubmitting={isSubmitting}
        saveMessage={saveMessage}
        sections={sections}
        onUpdateFormData={updateFormData}
        onSaveProgress={handleSaveProgress}
        onNextSection={handleNextSection}
        onSubmit={handleSubmit}
      />
    </div>
  )
}
