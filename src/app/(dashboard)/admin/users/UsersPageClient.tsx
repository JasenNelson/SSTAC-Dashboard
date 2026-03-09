'use client';

import { useEffect } from 'react';
import AdminUsersManager from '@/components/dashboard/AdminUsersManager';
import { refreshGlobalAdminStatus } from '@/lib/admin-utils';
import ErrorBoundary from '@/components/ErrorBoundary';
import AdminFunctionsNav from '@/components/dashboard/AdminFunctionsNav';

export default function UsersPageClient() {
  // Refresh admin status when component mounts
  useEffect(() => {
    const refreshAdmin = async () => {
      if (process.env.NODE_ENV === 'development') {
        console.log('🔄 Users page mounted - refreshing admin status');
      }
      await refreshGlobalAdminStatus();
    };
    
    refreshAdmin();
  }, []);


  return (
    <ErrorBoundary>
      <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">Admin Panel</h1>
        <p className="text-slate-500 dark:text-slate-400">
          Manage users, tags, and system settings for the SSTAC & TWG Dashboard.
        </p>
      </div>

      <AdminFunctionsNav />
      
      <AdminUsersManager />
      </div>
    </ErrorBoundary>
  );
}
