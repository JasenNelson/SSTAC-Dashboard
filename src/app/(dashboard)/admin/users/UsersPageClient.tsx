'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import AdminUsersManager from '@/components/dashboard/AdminUsersManager';
import { refreshGlobalAdminStatus } from '@/lib/admin-utils';

export default function UsersPageClient() {
  // Refresh admin status when component mounts
  useEffect(() => {
    const refreshAdmin = async () => {
      console.log('🔄 Users page mounted - refreshing admin status');
      await refreshGlobalAdminStatus();
    };
    
    refreshAdmin();
  }, []);


  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Admin Panel</h1>
        <p className="text-gray-600">
          Manage users, tags, and system settings for the SSTAC & TWG Dashboard.
        </p>
      </div>

      {/* Admin Navigation */}
      <div className="mb-6 bg-white p-4 rounded-lg shadow-sm border">
        <h2 className="text-lg font-medium text-gray-900 mb-3">Admin Functions</h2>
        <div className="flex space-x-4">
          <Link
            href="/admin"
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
          >
            Dashboard
          </Link>
          <Link
            href="/admin/users"
            className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 transition-colors"
          >
            User Management
          </Link>
          <Link
            href="/admin/tags"
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
          >
            Tag Management
          </Link>
        </div>
      </div>
      
      <AdminUsersManager />
    </div>
  );
}
