'use client';

import { useEffect } from 'react';
import TagManagement from '@/components/dashboard/TagManagement';


export default function TagsPageClient() {
  // Refresh admin status when component mounts


  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
      {/* Header */}
      <div className="bg-gradient-to-r from-green-600 via-green-700 to-emerald-800 text-white shadow-2xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="text-center">
            <h1 className="text-4xl font-bold mb-4">Tag Management</h1>
            <p className="text-xl text-green-100 max-w-3xl mx-auto">
              Create, edit, and organize document tags for better categorization
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 -mt-8 relative z-10">
        <TagManagement />
      </div>
    </div>
  );
}
