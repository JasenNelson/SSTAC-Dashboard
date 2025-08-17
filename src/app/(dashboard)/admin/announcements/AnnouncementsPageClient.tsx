'use client';

import { useEffect } from 'react';
import AnnouncementsManagement from '@/components/dashboard/AnnouncementsManagement';


export default function AnnouncementsPageClient() {
  // Refresh admin status when component mounts


  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
      <div className="bg-gradient-to-r from-green-600 via-green-700 to-emerald-800 text-white shadow-2xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 text-center">
          <h1 className="text-4xl font-bold mb-4">Announcements Management</h1>
          <p className="text-xl text-green-100 max-w-3xl mx-auto">
            Create, edit, and manage announcements for the dashboard
          </p>
        </div>
      </div>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 -mt-8 relative z-10">
        <AnnouncementsManagement />
      </div>
    </div>
  );
}
