'use client';

import { useState, useEffect } from 'react';
// import { createClientComponentClient } from '@supabase/ssr'; // Removed due to error

type Milestone = {
  id: number;
  title: string;
  description: string;
  target_date: string;
  status: string;
  priority: string;
  created_at: string;
};

export default function ProjectTimeline() {
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hoveredMilestone, setHoveredMilestone] = useState<number | null>(null);
  const [expandedMilestone, setExpandedMilestone] = useState<number | null>(null);
  // const supabase = createClientComponentClient(); // Removed due to error

  useEffect(() => {
    fetchMilestones();
  }, []);

  const fetchMilestones = async () => {
    try {
      setLoading(true);
      
      // Fetch milestones from the API route
      const response = await fetch('/api/milestones');
      if (!response.ok) {
        throw new Error('Failed to fetch milestones');
      }
      
      const data = await response.json();
      setMilestones(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch milestones');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-CA', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const isFutureDate = (dateString: string) => {
    return new Date(dateString) > new Date();
  };

  const getStatusColor = (milestone: Milestone) => {
    if (milestone.status === 'completed') return 'bg-green-500';
    if (milestone.status === 'in_progress') return 'bg-blue-500';
    if (isFutureDate(milestone.target_date)) return 'bg-blue-500';
    return 'bg-gray-400';
  };

  const getStatusText = (milestone: Milestone) => {
    if (milestone.status === 'completed') return 'Completed';
    if (milestone.status === 'in_progress') return 'Ongoing';
    if (isFutureDate(milestone.target_date)) return 'Upcoming';
    return 'Overdue';
  };

  const toggleMilestone = (milestoneId: number) => {
    setExpandedMilestone(expandedMilestone === milestoneId ? null : milestoneId);
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-md p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center space-x-3">
                <div className="w-3 h-3 bg-gray-200 rounded-full"></div>
                <div className="h-4 bg-gray-200 rounded w-2/3"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-xl shadow-md p-6">
        <div className="text-center text-red-600">
          <p>Error loading timeline: {error}</p>
          <button
            onClick={fetchMilestones}
            className="mt-2 px-4 py-2 bg-red-100 text-red-700 rounded-md hover:bg-red-200 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (milestones.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-md p-6">
        <div className="text-center text-gray-500">
          <p>No milestones found</p>
          <button
            onClick={fetchMilestones}
            className="mt-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
          >
            Refresh
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-md p-6">
      <h2 className="text-xl font-semibold text-gray-800 mb-6 flex items-center">
        <span className="text-2xl mr-3">📅</span>
        Project Timeline
      </h2>
      
      <div className="relative">
        {/* Timeline Line */}
        <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-gray-200"></div>
        
        <div className="space-y-3">
          {milestones.map((milestone, _index) => (
            <div
              key={milestone.id}
              className="relative flex items-start group cursor-pointer"
              onMouseEnter={() => setHoveredMilestone(milestone.id)}
              onMouseLeave={() => setHoveredMilestone(null)}
              onClick={() => toggleMilestone(milestone.id)}
            >
              {/* Timeline Dot */}
              <div className="relative z-10 flex-shrink-0 w-12 h-12 bg-white rounded-full border-4 border-gray-200 flex items-center justify-center">
                <div className={`w-3 h-3 rounded-full ${getStatusColor(milestone)} transition-all duration-300 ${
                  hoveredMilestone === milestone.id ? 'scale-150' : 'scale-100'
                }`}></div>
              </div>
              
              {/* Content */}
              <div className="ml-6 flex-1 min-w-0">
                <div className={`p-3 rounded-lg border transition-all duration-300 ${
                  hoveredMilestone === milestone.id
                    ? 'border-blue-300 bg-blue-50'
                    : 'border-gray-200 bg-gray-50'
                } ${expandedMilestone === milestone.id ? 'bg-blue-50 border-blue-300' : ''}`}>
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="font-semibold text-gray-800 text-base">{milestone.title}</h3>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      milestone.status === 'completed'
                        ? 'bg-green-100 text-green-800'
                        : isFutureDate(milestone.target_date)
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {getStatusText(milestone)}
                    </span>
                  </div>
                  
                  {/* Date always visible */}
                  <div className="text-xs text-gray-500 mb-2">
                    {formatDate(milestone.target_date)}
                  </div>
                  
                  {/* Description - only visible when expanded */}
                  {expandedMilestone === milestone.id && milestone.description && (
                    <div className="mt-3 pt-3 border-t border-gray-200">
                      <p className="text-gray-600 text-sm leading-relaxed">
                        {milestone.description}
                      </p>
                    </div>
                  )}
                  
                  {/* Expand/Collapse indicator */}
                  <div className="text-xs text-gray-400 mt-2 flex items-center">
                    <span className="mr-1">
                      {expandedMilestone === milestone.id ? 'Click to collapse' : 'Click to expand'}
                    </span>
                    <svg 
                      className={`w-3 h-3 ml-1 transition-transform duration-200 ${
                        expandedMilestone === milestone.id ? 'rotate-180' : ''
                      }`} 
                      fill="none" 
                      stroke="currentColor" 
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      
      <div className="mt-6 pt-4 border-t border-gray-200">
        <div className="flex items-center justify-between text-sm text-gray-600">
          <div className="flex items-center space-x-4">
            <div className="flex items-center">
              <div className="w-3 h-3 rounded-full bg-green-500 mr-2"></div>
              <span>Completed</span>
            </div>
            <div className="flex items-center">
              <div className="w-3 h-3 rounded-full bg-blue-500 mr-2"></div>
              <span>Upcoming</span>
            </div>
            <div className="flex items-center">
              <div className="w-3 h-3 rounded-full bg-gray-400 mr-2"></div>
              <span>Overdue</span>
            </div>
          </div>
          
          <button
            onClick={fetchMilestones}
            className="text-blue-600 hover:text-blue-800 font-medium transition-colors"
          >
            Refresh Timeline
          </button>
        </div>
      </div>
    </div>
  );
}
