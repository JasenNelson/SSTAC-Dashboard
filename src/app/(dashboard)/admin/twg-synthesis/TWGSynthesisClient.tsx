'use client'

import { useState, useEffect } from 'react'
import { refreshGlobalAdminStatus } from '@/lib/admin-utils'
import { TWGReviewFormData } from '../../twg/review/twgReviewTypes'
import InteractiveBarChart from '@/components/dashboard/InteractiveBarChart'
import InteractivePieChart from '@/components/dashboard/InteractivePieChart'
import AdminFunctionsNav from '@/components/dashboard/AdminFunctionsNav'
import { useToast } from '@/components/Toast'

interface ReviewSubmission {
  id: string
  user_id: string
  email: string
  status: 'IN_PROGRESS' | 'SUBMITTED'
  form_data: TWGReviewFormData
  created_at: string
  updated_at: string
  file_count: number
}

interface ReviewFile {
  id: string
  submission_id: string
  file_name: string
  file_path: string
  mime_type: string
  file_size: number
  created_at: string
}

interface TWGSynthesisClientProps {
  submissions: ReviewSubmission[]
  files: ReviewFile[]
}

const APPENDIX_KEYS = ['appendixD', 'appendixG', 'appendixJ'] as const
type AppendixKey = (typeof APPENDIX_KEYS)[number]

export default function TWGSynthesisClient({ submissions, files }: TWGSynthesisClientProps) {
  const { showToast } = useToast()
  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toISOString().slice(0, 10)
    } catch {
      return ''
    }
  }
  const [filteredSubmissions, setFilteredSubmissions] = useState<ReviewSubmission[]>(submissions)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'IN_PROGRESS' | 'SUBMITTED'>('ALL')
  const [expertiseFilter, setExpertiseFilter] = useState<string>('ALL')
  // Refresh admin status on mount
  useEffect(() => {
    const refreshAdmin = async () => {
      console.log('🔄 TWG Synthesis page mounted - refreshing admin status')
      await refreshGlobalAdminStatus()
    }
    
    refreshAdmin()
  }, [])

  // Filter submissions based on search and filters
  useEffect(() => {
    let filtered = submissions

    // Filter by status
    if (statusFilter !== 'ALL') {
      filtered = filtered.filter(sub => sub.status === statusFilter)
    }

    // Filter by expertise
    if (expertiseFilter !== 'ALL') {
      filtered = filtered.filter(sub => 
        sub.form_data?.part1?.expertise?.includes(expertiseFilter)
      )
    }

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(sub => 
        sub.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        sub.form_data?.part1?.name?.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    setFilteredSubmissions(filtered)
  }, [submissions, searchTerm, statusFilter, expertiseFilter])

  // Get unique expertise areas for filter
  const expertiseAreas = Array.from(new Set(
    submissions.flatMap(sub => sub.form_data?.part1?.expertise || [])
  )).sort()

  // Calculate statistics
  const totalSubmissions = submissions.length
  const submittedCount = submissions.filter(sub => sub.status === 'SUBMITTED').length
  const inProgressCount = submissions.filter(sub => sub.status === 'IN_PROGRESS').length
  const totalFiles = files.length

  // Process quantitative data for charts
  const processRatingData = (part: keyof TWGReviewFormData, field: string) => {
    const ratings = ['Excellent', 'Good', 'Fair', 'Poor']
    const colors = ['#10B981', '#3B82F6', '#F59E0B', '#EF4444'] // Green, Blue, Yellow, Red
    const data = ratings.map((rating, index) => {
      const count = submissions.filter(sub => 
        (sub.form_data?.[part] as Record<string, unknown> | undefined)?.[field] === rating
      ).length
      
      return {
        label: rating,
        value: isNaN(count) ? 0 : count,
        color: colors[index]
      }
    })
    return data
  }

  const parseNumericRanking = (ranking?: Record<string, string>) => {
    if (!ranking) return undefined;
    const numericEntries = Object.entries(ranking)
      .map(([key, value]) => [key, Number(value)] as const)
      .filter(([, numberValue]) => !Number.isNaN(numberValue));
    return numericEntries.length ? Object.fromEntries(numericEntries) : undefined;
  };

  const formatRankingList = (ranking?: Record<string, string>) => {
    const numericRanking = parseNumericRanking(ranking);
    if (!numericRanking) return '';
    return Object.entries(numericRanking)
      .sort(([, a], [, b]) => a - b)
      .map(([key, rank]) => `${rank}. ${key}`)
      .join(', ');
  };

  const formatRankingForCSV = (ranking?: Record<string, string>) => {
    const numericRanking = parseNumericRanking(ranking);
    if (!numericRanking) return '';
    return Object.entries(numericRanking)
      .sort(([, a], [, b]) => a - b)
      .map(([key, rank]) => `${rank}. ${key}`)
      .join('; ');
  };

  const processRankingData = (part: keyof TWGReviewFormData, field: string, options: string[]) => {
    const rankingData: { [key: string]: number[] } = {}
    
    options.forEach(option => {
      rankingData[option] = []
    })

    submissions.forEach(sub => {
      const rankings = parseNumericRanking(
        (sub.form_data?.[part] as Record<string, Record<string, string> | undefined> | undefined)?.[field]
      )
      if (rankings) {
        options.forEach(option => {
          const rank = rankings[option]
          if (typeof rank === 'number' && !Number.isNaN(rank)) {
            rankingData[option].push(rank)
          }
        })
      }
    })

    const colors = ['#10B981', '#3B82F6', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4'] // Various colors for ranking options
    return options.map((option, index) => {
      const ranks = rankingData[option]
      let value = 0
      
      if (ranks.length > 0) {
        const sum = ranks.reduce((acc, rank) => acc + (6 - rank), 0)
        value = sum / ranks.length
      }
      
      return {
        label: option,
        value: value,
        color: colors[index % colors.length]
      }
    })
  }

  // Export data to CSV - Comprehensive export of ALL form fields
  const exportToCSV = () => {
    const csvData = submissions.map(sub => {
      const p1 = sub.form_data?.part1 || {}
      const p2 = sub.form_data?.part2 || {}
      const p3 = sub.form_data?.part3 || {}
      const p4 = sub.form_data?.part4 || {}
      const p5 = sub.form_data?.part5 || {}
      const p6 = sub.form_data?.part6 || {}
      const p7 = sub.form_data?.part7 || {}
      const p8 = sub.form_data?.part8 || {}
      const p9 = sub.form_data?.part9 || {}
      const p10 = sub.form_data?.part10 || {}
      const p11 = sub.form_data?.part11 || {}
      const p12 = sub.form_data?.part12 || {}

      return {
        // Basic Information
        'Email': sub.email,
        'Name': p1.name || '',
        'Status': sub.status,
        'Expertise': p1.expertise?.join(', ') || '',
        'Other Expertise': p1.otherExpertise || '',
        'Created At': formatDate(sub.created_at),
        'Submitted At': formatDate(sub.updated_at),
        'File Count': sub.file_count,
        
        // Part 2: High-Level Report Assessment
        'Part 2 - Clarity Rating': p2.clarity || '',
        'Part 2 - Completeness Rating': p2.completeness || '',
        'Part 2 - Defensibility Rating': p2.defensibility || '',
        'Part 2 - Comments': (p2.comments || '').replace(/"/g, '""').replace(/\n/g, ' '),
        
        // Part 3: Line-by-Line Comments
        'Part 3 - Section I (Introduction)': (p3.sectionI || '').replace(/"/g, '""').replace(/\n/g, ' '),
        'Part 3 - Section II (Preliminary Findings)': (p3.sectionII || '').replace(/"/g, '""').replace(/\n/g, ' '),
        'Part 3 - Section III (Jurisdictional Scan)': (p3.sectionIII || '').replace(/"/g, '""').replace(/\n/g, ' '),
        'Part 3 - Section IV (Stakeholder Engagement)': (p3.sectionIV || '').replace(/"/g, '""').replace(/\n/g, ' '),
        'Part 3 - Section V (Proposed Framework)': (p3.sectionV || '').replace(/"/g, '""').replace(/\n/g, ' '),
        'Part 3 - Appendices C & D': (p3.appendicesCD || '').replace(/"/g, '""').replace(/\n/g, ' '),
        
        // Part 4: Matrix Framework
        'Part 4 - Contaminant Rankings': formatRankingForCSV(p4.ranking),
        'Part 4 - Other Contaminant': p4.otherContaminant || '',
        'Part 4 - Challenges': (p4.challenges || '').replace(/"/g, '""').replace(/\n/g, ' '),
        'Part 4 - Additional Comments': (p4.additionalComments || '').replace(/"/g, '""').replace(/\n/g, ' '),
        
        // Part 5: Tiered Approach
        'Part 5 - Bioavailability Method': p5.bioavailability || '',
        'Part 5 - Other Bioavailability': p5.otherBioavailability || '',
        'Part 5 - Evidence Rankings': formatRankingForCSV(p5.evidence),
        'Part 5 - Evidence Other Text': p5.evidenceOtherText || '',
        'Part 5 - Technical Guidance': (p5.guidance || '').replace(/"/g, '""').replace(/\n/g, ' '),
        'Part 5 - Additional Comments': (p5.additionalComments || '').replace(/"/g, '""').replace(/\n/g, ' '),
        
        // Part 6: Indigenous Knowledge
        'Part 6 - Tier 0 Approaches': p6.tier0Approaches?.join('; ') || '',
        'Part 6 - Tier 0 Other': p6.tier0OtherText || '',
        'Part 6 - Framework Elements': p6.frameworkElements?.join('; ') || '',
        'Part 6 - Framework Other': p6.frameworkOtherText || '',
        'Part 6 - Study Components': p6.studyComponents?.join('; ') || '',
        'Part 6 - Study Other': p6.studyOtherText || '',
        'Part 6 - Challenges': (p6.challenges || '').replace(/"/g, '""').replace(/\n/g, ' '),
        'Part 6 - Additional Comments': (p6.additionalComments || '').replace(/"/g, '""').replace(/\n/g, ' '),
        
        // Part 7: Prioritization
        'Part 7 - Modernization Rankings': formatRankingForCSV(p7.modernization),
        'Part 7 - Research Rankings': formatRankingForCSV(p7.research),
        'Part 7 - Strategic Planning': (p7.strategicPlanning || '').replace(/"/g, '""').replace(/\n/g, ' '),
        'Part 7 - Additional Comments': (p7.additionalComments || '').replace(/"/g, '""').replace(/\n/g, ' '),
        
        // Part 8: Final Recommendations
        'Part 8 - Critical Gaps': (p8.gaps || '').replace(/"/g, '""').replace(/\n/g, ' '),
        'Part 8 - Suggestions': (p8.suggestions || '').replace(/"/g, '""').replace(/\n/g, ' '),

        // Part 9: Strategic Pathways
        'Part 9 - Option 1 Edits': (p9.option1Edits || '').replace(/"/g, '""').replace(/\n/g, ' '),
        'Part 9 - Option 2 Edits': (p9.option2Edits || '').replace(/"/g, '""').replace(/\n/g, ' '),
        'Part 9 - Option 3 Edits': (p9.option3Edits || '').replace(/"/g, '""').replace(/\n/g, ' '),
        'Part 9 - Alternate Pathway Ideas': (p9.otherPathwayIdeas || '').replace(/"/g, '""').replace(/\n/g, ' '),
        'Part 9 - Supporting Factors': p9.supportingFactors?.join('; ') || '',
        'Part 9 - Supporting Factors Other': p9.supportingFactorsOther || '',
        'Part 9 - Summary of Edits': (p9.pathwayRationale || '').replace(/"/g, '""').replace(/\n/g, ' '),
        'Part 9 - Recommendation & Timeline Updates': (p9.recommendationUpdates || '').replace(/"/g, '""').replace(/\n/g, ' '),
        'Part 9 - Implementation Risks': (p9.implementationRisks || '').replace(/"/g, '""').replace(/\n/g, ' '),
        'Part 9 - Line by Line (Section VI)': (p9.lineByLine || '').replace(/"/g, '""').replace(/\n/g, ' '),

        // Part 10: Conclusions & Recommendations
        'Part 10 - Recommendation Confidence': p10.recommendationConfidence || '',
        'Part 10 - Priority Areas': p10.priorityAreas?.join('; ') || '',
        'Part 10 - Priority Areas Other': p10.priorityAreasOther || '',
        'Part 10 - Implementation Support': (p10.implementationSupport || '').replace(/"/g, '""').replace(/\n/g, ' '),
        'Part 10 - Line by Line (Section VII)': (p10.lineByLine || '').replace(/"/g, '""').replace(/\n/g, ' '),

        // Part 11: Engagement Insights
        'Part 11 - Prioritized Engagements': p11.prioritizedEngagements?.join('; ') || '',
        'Part 11 - Prioritized Engagements Other': p11.prioritizedEngagementsOther || '',
        'Part 11 - Summary Quality Assessment': p11.engagementSummaryQuality || '',
        'Part 11 - Evidence Suggestions': (p11.evidenceSummary || '').replace(/"/g, '""').replace(/\n/g, ' '),
        'Part 11 - Engagement Interests': p11.engagementInterests?.join('; ') || '',
        'Part 11 - Engagement Interests Other': p11.engagementInterestsOther || '',
        'Part 11 - Line by Line (Section IV)': (p11.lineByLine || '').replace(/"/g, '""').replace(/\n/g, ' '),

        // Part 12: “What We Heard” Reports
        'Part 12 - Appendix D Status': p12.appendixStatus?.appendixD || '',
        'Part 12 - Appendix G Status': p12.appendixStatus?.appendixG || '',
        'Part 12 - Appendix J Status': p12.appendixStatus?.appendixJ || '',
        'Part 12 - Alignment Summary': (p12.alignmentSummary || '').replace(/"/g, '""').replace(/\n/g, ' '),
        'Part 12 - Follow Up Needs': (p12.followUpNeeds || '').replace(/"/g, '""').replace(/\n/g, ' '),
        'Part 12 - Line by Line (Appendices D/G/J)': (p12.lineByLine || '').replace(/"/g, '""').replace(/\n/g, ' ')
      }
    })

    // Create CSV content with proper escaping
    const escapeCSV = (val: unknown): string => {
      if (val === null || val === undefined) return '""'
      const str = String(val)
      // Escape quotes and wrap in quotes if contains comma, quote, or newline
      if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
        return `"${str.replace(/"/g, '""')}"`
      }
      return str || '""'
    }

    if (csvData.length === 0) {
      showToast({
        type: 'info',
        title: 'Nothing to export',
        message: 'Add review submissions before exporting CSV data.'
      })
      return
    }

    const headers = Object.keys(csvData[0])
    const csvContent = [
      headers.map(h => escapeCSV(h)).join(','),
      ...csvData.map(row => headers.map(h => escapeCSV(row[h as keyof typeof row])).join(','))
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `twg-review-submissions-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    window.URL.revokeObjectURL(url)
  }

  const appendixLabels: Record<AppendixKey, string> = {
    appendixD: 'Appendix D Status',
    appendixG: 'Appendix G Status',
    appendixJ: 'Appendix J Status'
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          TWG White Paper Synthesis Dashboard
        </h1>
        <p className="text-gray-600 dark:text-gray-300">
          Analyze and synthesize feedback from the Technical Working Group review process
        </p>
      </div>

      <AdminFunctionsNav />

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Total Submissions</h3>
          <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">{totalSubmissions}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Submitted</h3>
          <p className="text-3xl font-bold text-green-600 dark:text-green-400">{submittedCount}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">In Progress</h3>
          <p className="text-3xl font-bold text-yellow-600 dark:text-yellow-400">{inProgressCount}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Files Uploaded</h3>
          <p className="text-3xl font-bold text-purple-600 dark:text-purple-400">{totalFiles}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-8">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Filters</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Search
            </label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by email or name..."
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Status
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as 'ALL' | 'IN_PROGRESS' | 'SUBMITTED')}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="ALL">All Status</option>
              <option value="SUBMITTED">Submitted</option>
              <option value="IN_PROGRESS">In Progress</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Expertise Area
            </label>
            <select
              value={expertiseFilter}
              onChange={(e) => setExpertiseFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="ALL">All Expertise</option>
              {expertiseAreas.map(area => (
                <option key={area} value={area}>{area}</option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <button
              onClick={exportToCSV}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
            >
              Export CSV
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Quantitative Analysis */}
        <div className="space-y-8">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Quantitative Analysis</h2>
          
          {/* Part 2 Ratings */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
              High-Level Report Assessment
            </h3>
            <div className="space-y-4">
              {[
                { field: 'clarity', label: 'Overall Clarity and Readability' },
                { field: 'completeness', label: 'Completeness of Scientific Review' },
                { field: 'defensibility', label: 'Scientific Defensibility' }
              ].map(({ field, label }) => (
                <div key={field}>
                  <InteractiveBarChart
                    data={processRatingData('part2', field)}
                    title={label}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Part 4 Rankings - Matrix Framework */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
              Matrix Framework - Contaminant Priority Rankings
            </h3>
            <InteractiveBarChart
              data={processRankingData('part4', 'ranking', [
                'Mercury and its compounds',
                'Polychlorinated Biphenyls (PCBs)',
                'Per- and Polyfluoroalkyl Substances (PFAS)',
                'Dioxins and Furans',
                'Legacy Organochlorine Pesticides'
              ])}
              title="Contaminant Priority Rankings"
            />
          </div>

          {/* Part 5 Bioavailability */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
              Tiered Approach - Bioavailability Methods
            </h3>
            <InteractivePieChart
              data={[
                'Equilibrium partitioning models (e.g., based on organic carbon content)',
                'Normalization using Acid-Volatile Sulfides/Simultaneously Extracted Metals (AVS/SEM)',
                'Direct measurement using passive sampling devices (PSDs)',
                'Other'
              ].map((method, index) => {
                const colors = ['#10B981', '#3B82F6', '#F59E0B', '#EF4444']
                return {
                  label: method.length > 50 ? method.substring(0, 47) + '...' : method,
                  value: submissions.filter(sub => 
                    sub.form_data?.part5?.bioavailability === method
                  ).length,
                  color: colors[index % colors.length]
                }
              })}
              title="Bioavailability Assessment Methods"
            />
          </div>
        </div>

        {/* Qualitative Analysis */}
        <div className="space-y-8">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Qualitative Analysis</h2>
          
          {/* Comprehensive Comments Viewer */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
              Complete Review Responses by Reviewer
            </h3>
            <div className="space-y-6 max-h-[800px] overflow-y-auto">
              {filteredSubmissions.map(submission => {
                const p1 = submission.form_data?.part1 || {}
                const p2 = submission.form_data?.part2 || {}
                const p3 = submission.form_data?.part3 || {}
                const p4 = submission.form_data?.part4 || {}
                const p5 = submission.form_data?.part5 || {}
                const p6 = submission.form_data?.part6 || {}
                const p7 = submission.form_data?.part7 || {}
                const p8 = submission.form_data?.part8 || {}
                const p9 = submission.form_data?.part9 || {}
                const p10 = submission.form_data?.part10 || {}
                const p11 = submission.form_data?.part11 || {}
                const p12 = submission.form_data?.part12 || {}
                
                const hasContent = p2.comments || p3.sectionI || p3.sectionII || p3.sectionIII || 
                                  p3.sectionIV || p3.sectionV || p3.appendicesCD || p4.challenges || 
                                  p4.additionalComments || p5.guidance || p5.additionalComments ||
                                  p6.challenges || p6.additionalComments || p7.strategicPlanning ||
                                  p7.additionalComments || p8.gaps || p8.suggestions ||
                                  p9.option1Edits || p9.option2Edits || p9.option3Edits || p9.otherPathwayIdeas ||
                                  p9.pathwayRationale || p9.recommendationUpdates || p9.implementationRisks || p9.lineByLine ||
                                  p10.implementationSupport || p10.lineByLine ||
                                  p11.evidenceSummary || p11.lineByLine ||
                                  p12.alignmentSummary || p12.followUpNeeds || p12.lineByLine

                if (!hasContent) return null

                return (
                  <div key={submission.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-gray-50 dark:bg-gray-900/50">
                    <div className="flex justify-between items-start mb-4 pb-3 border-b border-gray-200 dark:border-gray-700">
                      <div>
                        <h4 className="font-semibold text-gray-900 dark:text-white">
                          {p1.name || 'Anonymous Reviewer'}
                        </h4>
                        <p className="text-sm text-gray-600 dark:text-gray-400">{submission.email}</p>
                      </div>
                      <div className="text-right">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          submission.status === 'SUBMITTED' 
                            ? 'bg-green-100 text-black dark:bg-green-900 dark:text-green-200'
                            : 'bg-yellow-100 text-black dark:bg-yellow-900 dark:text-yellow-200'
                        }`}>
                          {submission.status}
                        </span>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          {formatDate(submission.updated_at)}
                        </p>
                      </div>
                    </div>

                    <div className="space-y-4">
                      {/* Part 2: High-Level Assessment */}
                      {(p2.clarity || p2.completeness || p2.defensibility || p2.comments) && (
                        <div className="bg-white dark:bg-gray-800 rounded p-3">
                          <h5 className="font-medium text-gray-900 dark:text-white mb-2 text-sm">Part 2: High-Level Report Assessment</h5>
                          {(p2.clarity || p2.completeness || p2.defensibility) && (
                            <div className="text-xs text-gray-600 dark:text-gray-400 mb-2">
                              Ratings: Clarity: {p2.clarity || 'N/A'}, Completeness: {p2.completeness || 'N/A'}, Defensibility: {p2.defensibility || 'N/A'}
                            </div>
                          )}
                          {p2.comments && (
                            <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{p2.comments}</p>
                          )}
                        </div>
                      )}

                      {/* Part 3: Line-by-Line Comments */}
                      {(p3.sectionI || p3.sectionII || p3.sectionIII || p3.sectionIV || p3.sectionV || p3.appendicesCD) && (
                        <div className="bg-white dark:bg-gray-800 rounded p-3">
                          <h5 className="font-medium text-gray-900 dark:text-white mb-2 text-sm">Part 3: Line-by-Line Comments</h5>
                          {p3.sectionI && (
                            <div className="mb-2">
                              <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Section I - Introduction:</p>
                              <p className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap">{p3.sectionI}</p>
                            </div>
                          )}
                          {p3.sectionII && (
                            <div className="mb-2">
                              <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Section II - Preliminary Findings:</p>
                              <p className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap">{p3.sectionII}</p>
                            </div>
                          )}
                          {p3.sectionIII && (
                            <div className="mb-2">
                              <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Section III - Jurisdictional Scan:</p>
                              <p className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap">{p3.sectionIII}</p>
                            </div>
                          )}
                          {p3.sectionIV && (
                            <div className="mb-2">
                              <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Section IV - Stakeholder Engagement:</p>
                              <p className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap">{p3.sectionIV}</p>
                            </div>
                          )}
                          {p3.sectionV && (
                            <div className="mb-2">
                              <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Section V - Proposed Framework:</p>
                              <p className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap">{p3.sectionV}</p>
                            </div>
                          )}
                          {p3.appendicesCD && (
                            <div>
                              <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Appendices C & D:</p>
                              <p className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap">{p3.appendicesCD}</p>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Part 4: Matrix Framework */}
                      {(p4.ranking || p4.challenges || p4.additionalComments || p4.otherContaminant) && (
                        <div className="bg-white dark:bg-gray-800 rounded p-3">
                          <h5 className="font-medium text-gray-900 dark:text-white mb-2 text-sm">Part 4: Matrix Sediment Standards Framework</h5>
                          {p4.ranking && Object.keys(p4.ranking).length > 0 && (
                            <div className="text-xs text-gray-600 dark:text-gray-400 mb-2">
                              Contaminant Rankings: {formatRankingList(p4.ranking)}
                            </div>
                          )}
                          {p4.otherContaminant && (
                            <div className="text-xs text-gray-600 dark:text-gray-400 mb-2">Other Contaminant: {p4.otherContaminant}</div>
                          )}
                          {p4.challenges && (
                            <div className="mb-2">
                              <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Challenges:</p>
                              <p className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap">{p4.challenges}</p>
                            </div>
                          )}
                          {p4.additionalComments && (
                            <p className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap">{p4.additionalComments}</p>
                          )}
                        </div>
                      )}

                      {/* Part 5: Tiered Approach */}
                      {(p5.bioavailability || p5.guidance || p5.additionalComments || p5.evidence || p5.otherBioavailability) && (
                        <div className="bg-white dark:bg-gray-800 rounded p-3">
                          <h5 className="font-medium text-gray-900 dark:text-white mb-2 text-sm">Part 5: Tiered Assessment Approach</h5>
                          {p5.bioavailability && (
                            <div className="text-xs text-gray-600 dark:text-gray-400 mb-2">Bioavailability Method: {p5.bioavailability}</div>
                          )}
                          {p5.otherBioavailability && (
                            <div className="text-xs text-gray-600 dark:text-gray-400 mb-2">Other: {p5.otherBioavailability}</div>
                          )}
                          {p5.evidence && Object.keys(p5.evidence).length > 0 && (
                            <div className="text-xs text-gray-600 dark:text-gray-400 mb-2">
                              Evidence Rankings: {formatRankingList(p5.evidence)}
                            </div>
                          )}
                          {p5.evidenceOtherText && (
                            <div className="text-xs text-gray-600 dark:text-gray-400 mb-2">Evidence Other: {p5.evidenceOtherText}</div>
                          )}
                          {p5.guidance && (
                            <div className="mb-2">
                              <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Technical Guidance:</p>
                              <p className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap">{p5.guidance}</p>
                            </div>
                          )}
                          {p5.additionalComments && (
                            <p className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap">{p5.additionalComments}</p>
                          )}
                        </div>
                      )}

                      {/* Part 6: Indigenous Knowledge */}
                      {(p6.tier0Approaches || p6.frameworkElements || p6.studyComponents || p6.challenges || 
                        p6.additionalComments || p6.tier0OtherText || p6.frameworkOtherText || p6.studyOtherText) && (
                        <div className="bg-white dark:bg-gray-800 rounded p-3">
                          <h5 className="font-medium text-gray-900 dark:text-white mb-2 text-sm">Part 6: WQCIU Approaches for Indigenous Uses</h5>
                          {p6.tier0Approaches && p6.tier0Approaches.length > 0 && (
                            <div className="text-xs text-gray-600 dark:text-gray-400 mb-2">Tier 0 Approaches: {p6.tier0Approaches.join(', ')}</div>
                          )}
                          {p6.tier0OtherText && (
                            <div className="text-xs text-gray-600 dark:text-gray-400 mb-2">Tier 0 Other: {p6.tier0OtherText}</div>
                          )}
                          {p6.frameworkElements && p6.frameworkElements.length > 0 && (
                            <div className="text-xs text-gray-600 dark:text-gray-400 mb-2">Framework Elements: {p6.frameworkElements.join(', ')}</div>
                          )}
                          {p6.frameworkOtherText && (
                            <div className="text-xs text-gray-600 dark:text-gray-400 mb-2">Framework Other: {p6.frameworkOtherText}</div>
                          )}
                          {p6.studyComponents && p6.studyComponents.length > 0 && (
                            <div className="text-xs text-gray-600 dark:text-gray-400 mb-2">Study Components: {p6.studyComponents.join(', ')}</div>
                          )}
                          {p6.studyOtherText && (
                            <div className="text-xs text-gray-600 dark:text-gray-400 mb-2">Study Other: {p6.studyOtherText}</div>
                          )}
                          {p6.challenges && (
                            <div className="mb-2">
                              <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Challenges:</p>
                              <p className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap">{p6.challenges}</p>
                            </div>
                          )}
                          {p6.additionalComments && (
                            <p className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap">{p6.additionalComments}</p>
                          )}
                        </div>
                      )}

                      {/* Part 7: Prioritization */}
                      {(p7.modernization || p7.research || p7.strategicPlanning || p7.additionalComments) && (
                        <div className="bg-white dark:bg-gray-800 rounded p-3">
                          <h5 className="font-medium text-gray-900 dark:text-white mb-2 text-sm">Part 7: Prioritization and Strategic Direction</h5>
                          {p7.modernization && Object.keys(p7.modernization).length > 0 && (
                            <div className="text-xs text-gray-600 dark:text-gray-400 mb-2">
                              Matrix Modernization Priorities: {formatRankingList(p7.modernization)}
                            </div>
                          )}
                          {p7.research && Object.keys(p7.research).length > 0 && (
                            <div className="text-xs text-gray-600 dark:text-gray-400 mb-2">
                              Research Priorities: {formatRankingList(p7.research)}
                            </div>
                          )}
                          {p7.strategicPlanning && (
                            <div className="mb-2">
                              <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Strategic Planning:</p>
                              <p className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap">{p7.strategicPlanning}</p>
                            </div>
                          )}
                          {p7.additionalComments && (
                            <p className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap">{p7.additionalComments}</p>
                          )}
                        </div>
                      )}

                      {/* Part 8: Final Recommendations */}
                      {(p8.gaps || p8.suggestions) && (
                        <div className="bg-white dark:bg-gray-800 rounded p-3">
                          <h5 className="font-medium text-gray-900 dark:text-white mb-2 text-sm">Part 8: Final Recommendations</h5>
                          {p8.gaps && (
                            <div className="mb-2">
                              <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Critical Gaps:</p>
                              <p className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap">{p8.gaps}</p>
                            </div>
                          )}
                          {p8.suggestions && (
                            <div>
                              <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Suggestions:</p>
                              <p className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap">{p8.suggestions}</p>
                            </div>
                          )}
                        </div>
                      )}

                      {(p9.option1Edits || p9.option2Edits || p9.option3Edits || p9.otherPathwayIdeas || p9.pathwayRationale || p9.recommendationUpdates || p9.implementationRisks || p9.lineByLine) && (
                        <div className="bg-white dark:bg-gray-800 rounded p-3">
                          <h5 className="font-medium text-gray-900 dark:text-white mb-2 text-sm">Part 9: Strategic Pathways &amp; Options Analysis</h5>
                          {(p9.option1Edits || p9.option2Edits || p9.option3Edits) && (
                            <div className="text-xs text-gray-600 dark:text-gray-400 mb-2 space-y-1">
                              {p9.option1Edits && <div><span className="font-semibold">Option 1:</span> {p9.option1Edits}</div>}
                              {p9.option2Edits && <div><span className="font-semibold">Option 2:</span> {p9.option2Edits}</div>}
                              {p9.option3Edits && <div><span className="font-semibold">Option 3:</span> {p9.option3Edits}</div>}
                            </div>
                          )}
                          {p9.otherPathwayIdeas && (
                            <div className="text-xs text-gray-600 dark:text-gray-400 mb-2">
                              Alternate Pathway Ideas: {p9.otherPathwayIdeas}
                            </div>
                          )}
                          {p9.supportingFactors && p9.supportingFactors.length > 0 && (
                            <div className="text-xs text-gray-600 dark:text-gray-400 mb-2">
                              Supporting Factors: {p9.supportingFactors.join(', ')}
                            </div>
                          )}
                          {p9.supportingFactorsOther && (
                            <div className="text-xs text-gray-600 dark:text-gray-400 mb-2">
                              Additional Factor: {p9.supportingFactorsOther}
                            </div>
                          )}
                          {p9.pathwayRationale && (
                            <div className="mb-2">
                              <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Summary of Edits:</p>
                              <p className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap">{p9.pathwayRationale}</p>
                            </div>
                          )}
                          {p9.recommendationUpdates && (
                            <div className="mb-2">
                              <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Recommendation & Timeline Updates:</p>
                              <p className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap">{p9.recommendationUpdates}</p>
                            </div>
                          )}
                          {p9.implementationRisks && (
                            <div className="mb-2">
                              <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Risks & Dependencies:</p>
                              <p className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap">{p9.implementationRisks}</p>
                            </div>
                          )}
                          {p9.lineByLine && (
                            <div>
                              <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Line-by-Line (Section VI):</p>
                              <p className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap">{p9.lineByLine}</p>
                            </div>
                          )}
                        </div>
                      )}

                      {(p10.recommendationConfidence || (Array.isArray(p10.priorityAreas) && p10.priorityAreas.length > 0) || p10.implementationSupport || p10.lineByLine) && (
                        <div className="bg-white dark:bg-gray-800 rounded p-3">
                          <h5 className="font-medium text-gray-900 dark:text-white mb-2 text-sm">Part 10: Conclusions &amp; Recommendations</h5>
                          {p10.recommendationConfidence && (
                            <div className="text-xs text-gray-600 dark:text-gray-400 mb-2">
                              Confidence Level: {p10.recommendationConfidence}
                            </div>
                          )}
                          {p10.priorityAreas && p10.priorityAreas.length > 0 && (
                            <div className="text-xs text-gray-600 dark:text-gray-400 mb-2">
                              Priority Actions: {p10.priorityAreas.join(', ')}
                            </div>
                          )}
                          {p10.priorityAreasOther && (
                            <div className="text-xs text-gray-600 dark:text-gray-400 mb-2">
                              Additional Priority: {p10.priorityAreasOther}
                            </div>
                          )}
                          {p10.implementationSupport && (
                            <div className="mb-2">
                              <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Implementation Support:</p>
                              <p className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap">{p10.implementationSupport}</p>
                            </div>
                          )}
                          {p10.lineByLine && (
                            <div>
                              <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Line-by-Line (Section VII):</p>
                              <p className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap">{p10.lineByLine}</p>
                            </div>
                          )}
                        </div>
                      )}

                      {(p11.prioritizedEngagements || p11.prioritizedEngagementsOther || p11.engagementSummaryQuality || p11.evidenceSummary || p11.engagementInterests || p11.engagementInterestsOther || p11.lineByLine) && (
                        <div className="bg-white dark:bg-gray-800 rounded p-3">
                          <h5 className="font-medium text-gray-900 dark:text-white mb-2 text-sm">Part 11: Community &amp; Stakeholder Engagement Insights</h5>
                          {p11.prioritizedEngagements && p11.prioritizedEngagements.length > 0 && (
                            <div className="text-xs text-gray-600 dark:text-gray-400 mb-2">
                              Prioritized Engagements: {p11.prioritizedEngagements.join(', ')}
                            </div>
                          )}
                          {p11.prioritizedEngagementsOther && (
                            <div className="text-xs text-gray-600 dark:text-gray-400 mb-2">
                              Additional Group: {p11.prioritizedEngagementsOther}
                            </div>
                          )}
                          {p11.engagementSummaryQuality && (
                            <div className="text-xs text-gray-600 dark:text-gray-400 mb-2">
                              Summary Assessment: {p11.engagementSummaryQuality}
                            </div>
                          )}
                          {p11.evidenceSummary && (
                            <div className="mb-2">
                              <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Suggestions to Strengthen Section IV:</p>
                              <p className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap">{p11.evidenceSummary}</p>
                            </div>
                          )}
                          {p11.engagementInterests && p11.engagementInterests.length > 0 && (
                            <div className="text-xs text-gray-600 dark:text-gray-400 mb-2">
                              Preferred Engagement Formats: {p11.engagementInterests.join(', ')}
                            </div>
                          )}
                          {p11.engagementInterestsOther && (
                            <div className="text-xs text-gray-600 dark:text-gray-400 mb-2">
                              Additional Format: {p11.engagementInterestsOther}
                            </div>
                          )}
                          {p11.lineByLine && (
                            <div>
                              <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Line-by-Line (Section IV):</p>
                              <p className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap">{p11.lineByLine}</p>
                            </div>
                          )}
                        </div>
                      )}

                      {((p12.appendixStatus && Object.keys(p12.appendixStatus).length > 0) || p12.alignmentSummary || p12.followUpNeeds || p12.lineByLine) && (
                        <div className="bg-white dark:bg-gray-800 rounded p-3">
                          <h5 className="font-medium text-gray-900 dark:text-white mb-2 text-sm">Part 12: “What We Heard” Reports (Appendices D, G, J)</h5>
                          {p12.appendixStatus && (
                            <div className="text-xs text-gray-600 dark:text-gray-400 mb-2 space-y-1">
                              {APPENDIX_KEYS.map(key => {
                                const status = p12.appendixStatus?.[key]
                                if (!status) return null
                                return (
                                  <div key={key}>
                                    {appendixLabels[key]}: {status}
                                  </div>
                                )
                              })}
                            </div>
                          )}
                          {p12.alignmentSummary && (
                            <div className="mb-2">
                              <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Alignment with Recommendations:</p>
                              <p className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap">{p12.alignmentSummary}</p>
                            </div>
                          )}
                          {p12.followUpNeeds && (
                            <div className="mb-2">
                              <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Follow-up Needs:</p>
                              <p className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap">{p12.followUpNeeds}</p>
                            </div>
                          )}
                          {p12.lineByLine && (
                            <div>
                              <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Line-by-Line (Appendices D/G/J):</p>
                              <p className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap">{p12.lineByLine}</p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
              {filteredSubmissions.filter(sub => {
                const hasContent = sub.form_data?.part2?.comments || sub.form_data?.part3?.sectionI ||
                                  sub.form_data?.part3?.sectionII || sub.form_data?.part3?.sectionIII ||
                                  sub.form_data?.part3?.sectionIV || sub.form_data?.part3?.sectionV ||
                                  sub.form_data?.part3?.appendicesCD || sub.form_data?.part4?.challenges ||
                                  sub.form_data?.part4?.additionalComments || sub.form_data?.part5?.guidance ||
                                  sub.form_data?.part5?.additionalComments || sub.form_data?.part6?.challenges ||
                                  sub.form_data?.part6?.additionalComments || sub.form_data?.part7?.strategicPlanning ||
                                  sub.form_data?.part7?.additionalComments || sub.form_data?.part8?.gaps ||
                                  sub.form_data?.part8?.suggestions || sub.form_data?.part9?.option1Edits ||
                                  sub.form_data?.part9?.option2Edits || sub.form_data?.part9?.option3Edits ||
                                  sub.form_data?.part9?.otherPathwayIdeas || sub.form_data?.part9?.pathwayRationale ||
                                  sub.form_data?.part9?.recommendationUpdates || sub.form_data?.part9?.implementationRisks ||
                                  sub.form_data?.part9?.lineByLine || sub.form_data?.part10?.implementationSupport || sub.form_data?.part10?.lineByLine ||
                                  sub.form_data?.part11?.evidenceSummary || sub.form_data?.part11?.lineByLine ||
                                  sub.form_data?.part12?.alignmentSummary || sub.form_data?.part12?.followUpNeeds ||
                                  sub.form_data?.part12?.lineByLine
                return !hasContent
              }).length > 0 && (
                <div className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
                  {filteredSubmissions.filter(sub => {
                    const hasContent = sub.form_data?.part2?.comments || sub.form_data?.part3?.sectionI ||
                                      sub.form_data?.part3?.sectionII || sub.form_data?.part3?.sectionIII ||
                                      sub.form_data?.part3?.sectionIV || sub.form_data?.part3?.sectionV ||
                                      sub.form_data?.part3?.appendicesCD || sub.form_data?.part4?.challenges ||
                                      sub.form_data?.part4?.additionalComments || sub.form_data?.part5?.guidance ||
                                      sub.form_data?.part5?.additionalComments || sub.form_data?.part6?.challenges ||
                                      sub.form_data?.part6?.additionalComments || sub.form_data?.part7?.strategicPlanning ||
                                      sub.form_data?.part7?.additionalComments || sub.form_data?.part8?.gaps ||
                                      sub.form_data?.part8?.suggestions || sub.form_data?.part9?.option1Edits ||
                                      sub.form_data?.part9?.option2Edits || sub.form_data?.part9?.option3Edits ||
                                      sub.form_data?.part9?.otherPathwayIdeas || sub.form_data?.part9?.pathwayRationale ||
                                      sub.form_data?.part9?.recommendationUpdates || sub.form_data?.part9?.implementationRisks ||
                                      sub.form_data?.part9?.lineByLine || sub.form_data?.part10?.implementationSupport || sub.form_data?.part10?.lineByLine ||
                                      sub.form_data?.part11?.evidenceSummary || sub.form_data?.part11?.lineByLine ||
                                      sub.form_data?.part12?.alignmentSummary || sub.form_data?.part12?.followUpNeeds ||
                                      sub.form_data?.part12?.lineByLine
                    return !hasContent
                  }).length} submission(s) with no qualitative responses yet
                </div>
              )}
            </div>
          </div>

          {/* Files Viewer */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
              Uploaded Files
            </h3>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {files.map(file => (
                <div key={file.id} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700 rounded">
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">{file.file_name}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {(file.file_size / 1024 / 1024).toFixed(2)} MB • {formatDate(file.created_at)}
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      showToast({
                        type: 'info',
                        title: 'Download coming soon',
                        message: 'File download will be implemented in a future update.'
                      })
                    }}
                    className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                  >
                    Download
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Raw Data Table */}
      <div className="mt-8 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
          Raw Data Table
        </h3>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Reviewer
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Expertise
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Submitted
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Files
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {filteredSubmissions.map(submission => (
                <tr key={submission.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-gray-900 dark:text-white">
                        {submission.form_data?.part1?.name || 'Anonymous'}
                      </div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        {submission.email}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      submission.status === 'SUBMITTED' 
                        ? 'bg-green-100 text-black dark:bg-green-900 dark:text-green-200'
                        : 'bg-yellow-100 text-black dark:bg-yellow-900 dark:text-yellow-200'
                    }`}>
                      {submission.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                    {submission.form_data?.part1?.expertise?.join(', ') || 'Not specified'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    {formatDate(submission.updated_at)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    {submission.file_count}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
