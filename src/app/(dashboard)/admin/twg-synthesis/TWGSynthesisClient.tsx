'use client'

import { useState, useEffect } from 'react'
import { User } from '@supabase/supabase-js'
import { refreshGlobalAdminStatus } from '@/lib/admin-utils'
import InteractiveBarChart from '@/components/dashboard/InteractiveBarChart'
import InteractivePieChart from '@/components/dashboard/InteractivePieChart'

interface ReviewSubmission {
  id: string
  user_id: string
  email: string
  status: 'IN_PROGRESS' | 'SUBMITTED'
  form_data: any
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
  user: User
  submissions: ReviewSubmission[]
  files: ReviewFile[]
}

export default function TWGSynthesisClient({ user, submissions, files }: TWGSynthesisClientProps) {
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
  const [selectedSubmission, setSelectedSubmission] = useState<ReviewSubmission | null>(null)

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
  const processRatingData = (part: string, field: string) => {
    const ratings = ['Excellent', 'Good', 'Fair', 'Poor']
    const colors = ['#10B981', '#3B82F6', '#F59E0B', '#EF4444'] // Green, Blue, Yellow, Red
    const data = ratings.map((rating, index) => {
      const count = submissions.filter(sub => 
        sub.form_data?.[part]?.[field] === rating
      ).length
      
      return {
        label: rating,
        value: isNaN(count) ? 0 : count,
        color: colors[index]
      }
    })
    return data
  }

  const processRankingData = (part: string, field: string, options: string[]) => {
    const rankingData: { [key: string]: number[] } = {}
    
    options.forEach(option => {
      rankingData[option] = []
    })

    submissions.forEach(sub => {
      const rankings = sub.form_data?.[part]?.[field]
      if (rankings) {
        options.forEach(option => {
          const rank = rankings[option]
          if (rank) {
            rankingData[option].push(parseInt(rank))
          }
        })
      }
    })

    const colors = ['#10B981', '#3B82F6', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4'] // Various colors for ranking options
    return options.map((option, index) => {
      const ranks = rankingData[option]
      let value = 0
      
      if (ranks.length > 0) {
        const sum = ranks.reduce((sum, rank) => {
          const numericRank = parseInt(rank.toString())
          return sum + (isNaN(numericRank) ? 0 : (6 - numericRank))
        }, 0)
        value = sum / ranks.length
        // Ensure value is a valid number
        value = isNaN(value) ? 0 : value
      }
      
      return {
        label: option,
        value: value,
        color: colors[index % colors.length]
      }
    })
  }

  // Export data to CSV
  const exportToCSV = () => {
    const csvData = submissions.map(sub => ({
      'Email': sub.email,
      'Name': sub.form_data?.part1?.name || '',
      'Status': sub.status,
      'Expertise': sub.form_data?.part1?.expertise?.join(', ') || '',
      'Submitted At': sub.updated_at,
      'File Count': sub.file_count
    }))

    const csvContent = [
      Object.keys(csvData[0]).join(','),
      ...csvData.map(row => Object.values(row).map(val => `"${val}"`).join(','))
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'twg-review-submissions.csv'
    a.click()
    window.URL.revokeObjectURL(url)
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
              onChange={(e) => setStatusFilter(e.target.value as any)}
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

          {/* Part 3 Rankings */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
              Matrix Framework - Contaminant Priority Rankings
            </h3>
            <InteractiveBarChart
              data={processRankingData('part3', 'ranking', [
                'Mercury and its compounds',
                'Polychlorinated Biphenyls (PCBs)',
                'Per- and Polyfluoroalkyl Substances (PFAS)',
                'Dioxins and Furans',
                'Legacy Organochlorine Pesticides'
              ])}
              title="Contaminant Priority Rankings"
            />
          </div>

          {/* Part 4 Bioavailability */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
              Tiered Approach - Bioavailability Methods
            </h3>
            <InteractivePieChart
              data={[
                'Equilibrium partitioning models',
                'AVS/SEM normalization',
                'Passive sampling devices',
                'Other'
              ].map((method, index) => {
                const colors = ['#10B981', '#3B82F6', '#F59E0B', '#EF4444']
                return {
                  label: method,
                  value: submissions.filter(sub => 
                    sub.form_data?.part4?.bioavailability === method
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
          
          {/* Comments Viewer */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
              Consolidated Comments
            </h3>
            <div className="space-y-4 max-h-96 overflow-y-auto">
              {filteredSubmissions.map(submission => (
                <div key={submission.id} className="border-b border-gray-200 dark:border-gray-700 pb-4">
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="font-medium text-gray-900 dark:text-white">
                      {submission.form_data?.part1?.name || submission.email}
                    </h4>
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      {formatDate(submission.updated_at)}
                    </span>
                  </div>
                  
                  {submission.form_data?.part2?.comments && (
                    <div className="mb-2">
                      <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Part 2 Comments:</p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {submission.form_data.part2.comments}
                      </p>
                    </div>
                  )}
                  
                  {submission.form_data?.part3?.challenges && (
                    <div className="mb-2">
                      <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Part 3 Challenges:</p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {submission.form_data.part3.challenges}
                      </p>
                    </div>
                  )}
                  
                  {submission.form_data?.part8?.gaps && (
                    <div>
                      <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Critical Gaps:</p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {submission.form_data.part8.gaps}
                      </p>
                    </div>
                  )}
                </div>
              ))}
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
                      // In a real implementation, you would download the file
                      alert('File download would be implemented here')
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
