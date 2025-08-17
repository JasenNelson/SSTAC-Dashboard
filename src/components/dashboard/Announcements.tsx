'use client';

import { useState, useEffect } from 'react';
// import { createClientComponentClient } from '@supabase/ssr'; // Removed due to error

type Announcement = {
  id: number;
  title: string;
  content: string;
  created_at: string;
  priority: string;
  is_active: boolean;
};

const priorityColors = {
  high: 'bg-red-100 border-red-300 text-red-900 border-l-4',
  medium: 'bg-orange-100 border-orange-300 text-orange-900 border-l-4',
  low: 'bg-yellow-100 border-yellow-300 text-yellow-900 border-l-4'
};

const priorityLabels = {
  high: 'High',
  medium: 'Medium',
  low: 'Low'
};

export default function Announcements() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedAnnouncement, setExpandedAnnouncement] = useState<number | null>(null);
  // const supabase = createClientComponentClient(); // Removed due to error

  useEffect(() => {
    fetchAnnouncements();
  }, []);

  const fetchAnnouncements = async () => {
    try {
      setLoading(true);
      
      // Fetch announcements from the API route
      const response = await fetch('/api/announcements');
      if (!response.ok) {
        throw new Error('Failed to fetch announcements');
      }
      
      const data = await response.json();
      setAnnouncements(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch announcements');
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

  const toggleAnnouncement = (announcementId: number) => {
    setExpandedAnnouncement(expandedAnnouncement === announcementId ? null : announcementId);
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-md p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/2 mb-4"></div>
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="p-3 border border-gray-200 rounded-lg">
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                <div className="h-3 bg-gray-200 rounded w-1/2"></div>
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
          <p>Error loading announcements: {error}</p>
          <button
            onClick={fetchAnnouncements}
            className="mt-2 px-4 py-2 bg-red-100 text-red-700 rounded-md hover:bg-red-200 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (announcements.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-md p-6">
        <div className="text-center text-gray-500">
          <p>No announcements available</p>
          <button
            onClick={fetchAnnouncements}
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
      <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center">
        <span className="text-2xl mr-3">📢</span>
        Recent Announcements
      </h2>
      
      <div className="space-y-3">
        {announcements.map((announcement) => (
                     <div
             key={announcement.id}
             className={`p-4 rounded-lg border cursor-pointer transition-all duration-200 hover:shadow-md ${
               priorityColors[announcement.priority as keyof typeof priorityColors]
             } ${expandedAnnouncement === announcement.id ? 'shadow-lg ring-2 ring-blue-300' : ''}`}
             onClick={() => toggleAnnouncement(announcement.id)}
           >
            <div className="flex items-start justify-between mb-2">
              <h3 className="font-semibold text-lg">{announcement.title}</h3>
                             <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
                 announcement.priority === 'high' 
                   ? 'bg-red-200 text-red-900 border border-red-300'
                   : announcement.priority === 'medium'
                   ? 'bg-orange-200 text-orange-900 border border-orange-300'
                   : 'bg-yellow-200 text-yellow-900 border border-yellow-300'
               }`}>
                 {priorityLabels[announcement.priority as keyof typeof priorityLabels]}
               </span>
            </div>
            
                         {/* Date always visible */}
             <div className="text-sm text-gray-700 font-medium mb-3">
               📅 Published: {formatDate(announcement.created_at)}
             </div>
            
                         {/* Content - only visible when expanded */}
             {expandedAnnouncement === announcement.id && (
               <div className="mt-3 pt-3 border-t border-gray-300">
                 <p className="text-base leading-relaxed text-gray-800 font-medium">
                   {announcement.content}
                 </p>
               </div>
             )}
            
                         {/* Expand/Collapse indicator */}
             <div className="text-sm text-gray-600 mt-3 flex items-center font-medium">
               <span className="mr-2">
                 {expandedAnnouncement === announcement.id ? '📖 Click to collapse' : '📖 Click to expand'}
               </span>
               <svg 
                 className={`w-4 h-4 ml-1 transition-transform duration-200 ${
                   expandedAnnouncement === announcement.id ? 'rotate-180' : ''
                 }`} 
                 fill="none" 
                 stroke="currentColor" 
                 viewBox="0 0 24 24"
               >
                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
               </svg>
             </div>
          </div>
        ))}
      </div>
      
             {announcements.length > 0 && (
         <div className="mt-4 pt-4 border-t border-gray-200">
           <button
             onClick={fetchAnnouncements}
             className="px-4 py-2 bg-blue-100 text-blue-800 rounded-lg hover:bg-blue-200 text-sm font-semibold transition-colors border border-blue-300"
           >
             🔄 Refresh Announcements
           </button>
         </div>
       )}
    </div>
  );
}
