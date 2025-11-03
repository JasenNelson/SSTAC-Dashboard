'use client';

import { useEffect } from 'react';
import MilestonesManagement from '@/components/dashboard/MilestonesManagement';
import { refreshGlobalAdminStatus } from '@/lib/admin-utils';

export default function MilestonesPageClient() {
  // Refresh admin status when component mounts
  useEffect(() => {
    const refreshAdmin = async () => {
      if (process.env.NODE_ENV === 'development') {
        console.log('🔄 Milestones page mounted - refreshing admin status');
      }
      await refreshGlobalAdminStatus();
    };
    
    refreshAdmin();
  }, []);


  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
      <div className="bg-gradient-to-r from-purple-600 via-purple-700 to-indigo-800 text-white shadow-2xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 text-center">
          <h1 className="text-4xl font-bold mb-4">Milestones Management</h1>
          <p className="text-xl text-purple-100 max-w-3xl mx-auto">
            Create, edit, and manage project timeline milestones
          </p>
        </div>
      </div>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 -mt-8 relative z-10">
        <MilestonesManagement />
      </div>
    </div>
  );
}
