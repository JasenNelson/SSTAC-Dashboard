'use client'

import { useState, useEffect } from 'react'
import { User } from '@supabase/supabase-js'
import InteractiveBarChart from '@/components/dashboard/InteractiveBarChart'
import AdminFunctionsNav from '@/components/dashboard/AdminFunctionsNav'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type JsonRecord = Record<string, any>

// Reserved JS prototype-pollution keys; filtered out before mapping JSONB
// payloads into JSX so a tampered row can't render under these section names.
const RESERVED_KEYS = new Set(['__proto__', 'constructor', 'prototype'])

// Normalize an arbitrary JSONB value into a string for safe rendering. React
// auto-escapes the resulting string, so this guards against [object Object]
// rendering when comments_data holds a non-string value (number, object, array,
// boolean). Null/undefined return empty so the caller can drop the row.
function renderJsonValue(v: unknown): string {
  if (v == null) return ''
  if (typeof v === 'string') return v
  if (typeof v === 'number' || typeof v === 'boolean') return String(v)
  try {
    return JSON.stringify(v)
  } catch {
    return ''
  }
}

export interface MatrixReview {
  id: string
  user_id: string
  email: string
  status: 'IN_PROGRESS' | 'SUBMITTED'
  poll_data: JsonRecord
  comments_data: JsonRecord
  created_at: string
  updated_at: string
}

interface MatrixReviewClientProps {
  user: User
  reviews: MatrixReview[]
}

export default function MatrixReviewClient({ user: _user, reviews }: MatrixReviewClientProps) {
  const [filteredReviews, setFilteredReviews] = useState<MatrixReview[]>(reviews)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'IN_PROGRESS' | 'SUBMITTED'>('ALL')

  // Filter reviews
  useEffect(() => {
    let filtered = reviews

    // Filter by status
    if (statusFilter !== 'ALL') {
      filtered = filtered.filter(rev => rev.status === statusFilter)
    }

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(rev => 
        rev.email.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    setFilteredReviews(filtered)
  }, [reviews, searchTerm, statusFilter])

  // Statistics
  const totalSubmissions = reviews.length
  const submittedCount = reviews.filter(rev => rev.status === 'SUBMITTED').length
  const inProgressCount = reviews.filter(rev => rev.status === 'IN_PROGRESS').length

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toISOString().slice(0, 10)
    } catch {
      return ''
    }
  }

  // Example poll data chart processing
  // Since we haven't strictly defined poll questions yet, we can show a placeholder or basic stats.
  // The user prompt mentioned: "Create 1-2 simple visual charts ... to show consensus on things like 'EqP Support' or 'Pathway Priority.'"
  // We will mock this data mapping if the poll_data is empty to show the layout.
  
  const processPollData = (key: string, options: string[]) => {
    const colors = ['#10B981', '#3B82F6', '#F59E0B', '#EF4444', '#8B5CF6']
    return options.map((option, index) => {
      const count = reviews.filter(rev => rev.poll_data[key] === option).length
      return {
        label: option,
        value: count,
        color: colors[index % colors.length]
      }
    })
  }

  // Fallback mock data if poll_data is missing
  const eqpSupportData = processPollData('eqpSupport', ['Strongly Support', 'Support', 'Neutral', 'Oppose', 'Strongly Oppose'])
  const hasEqpData = eqpSupportData.some(d => d.value > 0)
  
  const mockEqpData = [
    { label: 'Strongly Support', value: 0, color: '#10B981' },
    { label: 'Support', value: 0, color: '#3B82F6' },
    { label: 'Neutral', value: 0, color: '#F59E0B' },
  ]

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">
          Matrix Options Review Dashboard
        </h1>
        <p className="text-slate-600 dark:text-slate-300">
          Analyze and synthesize feedback from the Matrix Options phase
        </p>
      </div>

      <AdminFunctionsNav />

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg p-6">
          <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-2">Total Reviews</h3>
          <p className="text-3xl font-bold text-sky-700 dark:text-sky-300">{totalSubmissions}</p>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg p-6">
          <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-2">Submitted</h3>
          <p className="text-3xl font-bold text-green-600 dark:text-green-400">{submittedCount}</p>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg p-6">
          <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-2">In Progress</h3>
          <p className="text-3xl font-bold text-yellow-600 dark:text-yellow-400">{inProgressCount}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg p-6 mb-8">
        <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-4">Filters</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Search Email
            </label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by email..."
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent bg-white dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-500 dark:placeholder-slate-400"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Status
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as 'ALL' | 'IN_PROGRESS' | 'SUBMITTED')}
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
            >
              <option value="ALL">All Status</option>
              <option value="SUBMITTED">Submitted</option>
              <option value="IN_PROGRESS">In Progress</option>
            </select>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left Column: Quantitative Analysis */}
        <div className="space-y-8">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Quantitative Analysis</h2>
          
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg p-6">
            <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-4">
              EqP Support
            </h3>
            <InteractiveBarChart
              data={hasEqpData ? eqpSupportData : mockEqpData}
              title="EqP Pathway Consensus"
            />
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg p-6">
            <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-4">
              Human Health Pathway Priority
            </h3>
            <InteractiveBarChart
              data={[
                { label: 'High Priority', value: 0, color: '#EF4444' },
                { label: 'Medium Priority', value: 0, color: '#F59E0B' },
                { label: 'Low Priority', value: 0, color: '#10B981' }
              ]}
              title="Human Health Priority"
            />
          </div>
        </div>

        {/* Right Column: Qualitative Analysis */}
        <div className="space-y-8">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Qualitative Analysis</h2>
          
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg p-6">
            <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-4">
              Matrix Review Submissions
            </h3>
            <div className="space-y-6 max-h-[800px] overflow-y-auto pr-2">
              {filteredReviews.length === 0 && (
                <p className="text-slate-500 dark:text-slate-400">No reviews found matching your filters.</p>
              )}
              {filteredReviews.map(review => {
                const hasComments = Object.keys(review.comments_data || {}).length > 0
                
                return (
                  <div key={review.id} className="border border-slate-200 dark:border-slate-700 rounded-lg p-4 bg-slate-50 dark:bg-slate-900/50">
                    <div className="flex justify-between items-start mb-4 pb-3 border-b border-slate-200 dark:border-slate-700">
                      <div>
                        <h4 className="font-semibold text-slate-900 dark:text-white">
                          {review.email}
                        </h4>
                      </div>
                      <div className="text-right">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          review.status === 'SUBMITTED' 
                            ? 'bg-green-100 text-black dark:bg-green-900 dark:text-green-200'
                            : 'bg-yellow-100 text-black dark:bg-yellow-900 dark:text-yellow-200'
                        }`}>
                          {review.status}
                        </span>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                          {formatDate(review.updated_at)}
                        </p>
                      </div>
                    </div>

                    {!hasComments ? (
                      <p className="text-sm text-slate-500 italic">No comments provided yet.</p>
                    ) : (
                      <div className="space-y-4">
                        {Object.entries(review.comments_data)
                          .filter(([section]) => !RESERVED_KEYS.has(section))
                          .map(([section, comment]) => {
                            const rendered = renderJsonValue(comment)
                            if (!rendered) return null
                            return (
                              <div key={section} className="bg-white dark:bg-slate-800 rounded p-3">
                                <h5 className="font-medium text-slate-900 dark:text-white mb-2 text-sm">{section}</h5>
                                <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap">{rendered}</p>
                              </div>
                            )
                          })}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
