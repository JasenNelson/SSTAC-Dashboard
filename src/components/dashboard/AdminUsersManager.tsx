'use client';

import { useState, useEffect, useMemo } from 'react';
import SimpleToast from '@/components/SimpleToast';
import { getUsers, toggleAdminRole, addUserRole, type UserWithRole } from '@/app/(dashboard)/admin/users/actions';
import { Search, Filter, ChevronLeft, ChevronRight, Users, Shield, User } from 'lucide-react';

export default function AdminUsersManager() {
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [updatingUser, setUpdatingUser] = useState<string | null>(null);
  const [showToastState, setShowToastState] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error' | 'info'>('success');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserRole, setNewUserRole] = useState<'user' | 'admin'>('user');
  const [isAddingUser, setIsAddingUser] = useState(false);
  
  // Enhanced features
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'admin' | 'user'>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [usersPerPage] = useState(10);
  const [sortBy, setSortBy] = useState<'email' | 'created_at' | 'role'>('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setIsLoading(true);
      const usersData = await getUsers();
      setUsers(usersData);
    } catch (error) {
      console.error('Error in fetchUsers:', error);
      showToast('Failed to fetch users', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // Filtered and sorted users
  const filteredUsers = useMemo(() => {
    let filtered = users.filter(user => {
      const matchesSearch = user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           user.id.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesRole = roleFilter === 'all' || 
                         (roleFilter === 'admin' && user.isAdmin) ||
                         (roleFilter === 'user' && !user.isAdmin);
      
      return matchesSearch && matchesRole;
    });

    // Sort users
    filtered.sort((a, b) => {
      let aValue: unknown, bValue: unknown;
      
      switch (sortBy) {
        case 'email':
          aValue = a.email.toLowerCase();
          bValue = b.email.toLowerCase();
          break;
        case 'created_at':
          aValue = new Date(a.created_at).getTime();
          bValue = new Date(b.created_at).getTime();
          break;
        case 'role':
          aValue = a.isAdmin ? 1 : 0;
          bValue = b.isAdmin ? 1 : 0;
          break;
        default:
          return 0;
      }

      if (sortOrder === 'asc') {
        return (aValue as any) > (bValue as any) ? 1 : -1;
      } else {
        return (aValue as any) < (bValue as any) ? 1 : -1;
      }
    });

    return filtered;
  }, [users, searchTerm, roleFilter, sortBy, sortOrder]);

  // Pagination
  const totalPages = Math.ceil(filteredUsers.length / usersPerPage);
  const startIndex = (currentPage - 1) * usersPerPage;
  const endIndex = startIndex + usersPerPage;
  const currentUsers = filteredUsers.slice(startIndex, endIndex);

  const handleToggleAdminRole = async (userId: string, currentIsAdmin: boolean) => {
    try {
      setUpdatingUser(userId);
      
      await toggleAdminRole(userId, currentIsAdmin);
      
      showToast(
        currentIsAdmin 
          ? 'Admin role removed successfully' 
          : 'Admin role granted successfully', 
        'success'
      );
      
      // Refresh the users list
      await fetchUsers();
    } catch (error) {
      console.error('Error updating admin role:', error);
      showToast(
        currentIsAdmin 
          ? 'Failed to remove admin role' 
          : 'Failed to grant admin role', 
        'error'
      );
    } finally {
      setUpdatingUser(null);
    }
  };



  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newUserEmail.trim()) {
      showToast('Please enter an email address', 'error');
      return;
    }

    try {
      setIsAddingUser(true);
      
      // First, we need to find the user ID from the email
      // Since we can't directly query auth.users, we'll need to use a different approach
      // For now, we'll show instructions on how to add the user manually
      
      showToast(
        `To add a user role for '${newUserEmail}', you need to:\n\n1. Make sure the user has signed up through the signup page\n2. Run this SQL in your Supabase SQL editor:\n\nINSERT INTO user_roles (user_id, role) \nSELECT id, '${newUserRole}' \nFROM auth.users \nWHERE email = '${newUserEmail}' \nON CONFLICT (user_id, role) DO NOTHING;\n\n3. Refresh this page to see the new user`, 
        'info'
      );
      
      // Clear form
      setNewUserEmail('');
      setNewUserRole('user');
      
    } catch (error) {
      console.error('Error adding user:', error);
      showToast('Failed to add user role', 'error');
    } finally {
      setIsAddingUser(false);
    }
  };

  const showToast = (message: string, type: 'success' | 'error' | 'info') => {
    setToastMessage(message);
    setToastType(type);
    setShowToastState(true);
    
    // Auto-hide toast after 3 seconds
    setTimeout(() => {
      setShowToastState(false);
    }, 3000);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleSort = (field: 'email' | 'created_at' | 'role') => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
    setCurrentPage(1); // Reset to first page when sorting
  };

  const clearFilters = () => {
    setSearchTerm('');
    setRoleFilter('all');
    setCurrentPage(1);
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 flex items-center">
              <Users className="w-5 h-5 mr-2" />
              Users ({filteredUsers.length} of {users.length})
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              Manage user accounts and admin privileges
            </p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-indigo-600">{users.length}</div>
            <div className="text-sm text-gray-500">Total Users</div>
          </div>
        </div>
      </div>
      
             {/* Help Information */}
       <div className="px-6 py-4 border-b border-gray-200 bg-blue-50">
         <h3 className="text-sm font-medium text-blue-900 mb-2">💡 User Management</h3>
         <div className="text-sm text-blue-800 space-y-2">
           <p><strong>New Signups:</strong> Users who sign up at <a href="/signup" className="underline text-blue-600 hover:text-blue-800">/signup</a> are automatically added to the system</p>
           <p><strong>Role Management:</strong> Admins can promote users to admin status or remove admin privileges</p>
         </div>
       </div>
      
      {/* Search and Filter Controls */}
      <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
        <div className="flex flex-wrap gap-4 items-center justify-between">
          <div className="flex flex-wrap gap-4 items-center flex-1">
            {/* Search */}
            <div className="relative min-w-64">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search by email or ID..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>

            {/* Role Filter */}
            <div className="flex items-center space-x-2">
              <Filter className="w-4 h-4 text-gray-400" />
              <select
                value={roleFilter}
                onChange={(e) => {
                  setRoleFilter(e.target.value as 'all' | 'admin' | 'user');
                  setCurrentPage(1);
                }}
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              >
                <option value="all">All Roles</option>
                <option value="admin">Admin Only</option>
                <option value="user">User Only</option>
              </select>
            </div>

            {/* Clear Filters */}
            {(searchTerm || roleFilter !== 'all') && (
              <button
                onClick={clearFilters}
                className="px-3 py-2 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-200 rounded-md transition-colors"
              >
                Clear Filters
              </button>
            )}
          </div>

          {/* Sort Controls */}
          <div className="flex items-center space-x-2 text-sm text-gray-600">
            <span>Sort by:</span>
            <select
              value={`${sortBy}-${sortOrder}`}
              onChange={(e) => {
                const [field, order] = e.target.value.split('-') as ['email' | 'created_at' | 'role', 'asc' | 'desc'];
                setSortBy(field);
                setSortOrder(order);
                setCurrentPage(1);
              }}
              className="px-2 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="created_at-desc">Newest First</option>
              <option value="created_at-asc">Oldest First</option>
              <option value="email-asc">Email A-Z</option>
              <option value="email-desc">Email Z-A</option>
              <option value="role-desc">Admin First</option>
              <option value="role-asc">User First</option>
            </select>
          </div>
        </div>
      </div>
      
      {/* Add New User Form */}
      <div className="px-6 py-4 border-b border-gray-200 bg-blue-50">
        <h3 className="text-lg font-medium text-gray-900 mb-3 flex items-center">
          <User className="w-5 h-5 mr-2" />
          Add New User Role
        </h3>
        <form onSubmit={handleAddUser} className="flex flex-wrap gap-4 items-end">
          <div className="flex-1 min-w-64">
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
              Email Address
            </label>
            <input
              type="email"
              id="email"
              value={newUserEmail}
              onChange={(e) => setNewUserEmail(e.target.value)}
              placeholder="user@example.com"
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              required
            />
          </div>
          <div className="min-w-32">
            <label htmlFor="role" className="block text-sm font-medium text-gray-700 mb-1">
              Role
            </label>
            <select
              id="role"
              value={newUserRole}
              onChange={(e) => setNewUserRole(e.target.value as 'user' | 'admin')}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="user">User</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <button
            type="submit"
            disabled={isAddingUser || !newUserEmail.trim()}
            className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-indigo-400 disabled:cursor-not-allowed"
          >
            {isAddingUser ? 'Processing...' : 'Check User Role'}
          </button>
        </form>
        <p className="text-xs text-gray-500 mt-2">
          Note: This form is for demonstration. In production, users must sign up first before roles can be assigned.
        </p>
      </div>
      
      {/* Users Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100" onClick={() => handleSort('email')}>
                <div className="flex items-center space-x-1">
                  <span>User</span>
                  {sortBy === 'email' && (
                    <span className="text-indigo-600">
                      {sortOrder === 'asc' ? '↑' : '↓'}
                    </span>
                  )}
                </div>
              </th>
                             <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100" onClick={() => handleSort('role')}>
                 <div className="flex items-center space-x-1">
                   <span>Role</span>
                   {sortBy === 'role' && (
                     <span className="text-indigo-600">
                       {sortOrder === 'asc' ? '↑' : '↓'}
                     </span>
                   )}
                 </div>
               </th>

               <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100" onClick={() => handleSort('created_at')}>
                 <div className="flex items-center space-x-1">
                   <span>Joined</span>
                   {sortBy === 'created_at' && (
                     <span className="text-indigo-600">
                       {sortOrder === 'asc' ? '↑' : '↓'}
                     </span>
                   )}
                 </div>
               </th>
               <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                 Actions
               </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {currentUsers.map((user) => (
              <tr key={user.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <div className="flex-shrink-0 h-10 w-10">
                      <div className={`h-10 w-10 rounded-full flex items-center justify-center ${
                        user.isAdmin ? 'bg-green-100' : 'bg-indigo-100'
                      }`}>
                        <span className={`text-sm font-medium ${
                          user.isAdmin ? 'text-green-600' : 'text-indigo-600'
                        }`}>
                          {user.email.charAt(0).toUpperCase()}
                        </span>
                      </div>
                    </div>
                    <div className="ml-4">
                      <div className="text-sm font-medium text-gray-900">
                        {user.email}
                      </div>
                      <div className="text-sm text-gray-500">
                        ID: {user.id.slice(0, 8)}...
                      </div>
                    </div>
                  </div>
                </td>
                                 <td className="px-6 py-4 whitespace-nowrap">
                   <span className={`inline-flex items-center px-2.5 py-1 text-xs font-semibold rounded-full ${
                     user.isAdmin 
                       ? 'bg-green-100 text-green-800' 
                       : 'bg-gray-100 text-gray-800'
                   }`}>
                     {user.isAdmin ? (
                       <>
                         <Shield className="w-3 h-3 mr-1" />
                         Admin
                       </>
                     ) : (
                       <>
                         <User className="w-3 h-3 mr-1" />
                         Member
                       </>
                     )}
                   </span>
                 </td>

                 <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                   {formatDate(user.created_at)}
                 </td>
                 <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                   <div className="flex space-x-2">
                     <button
                       onClick={() => handleToggleAdminRole(user.id, user.isAdmin)}
                       disabled={updatingUser === user.id}
                       className={`inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white ${
                         user.isAdmin
                           ? 'bg-red-600 hover:bg-red-700 disabled:bg-red-400'
                           : 'bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400'
                       } focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:cursor-not-allowed transition-colors`}
                     >
                       {updatingUser === user.id ? (
                         <>
                           <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                           Updating...
                         </>
                       ) : (
                         <>
                           {user.isAdmin ? 'Remove Admin' : 'Make Admin'}
                         </>
                       )}
                     </button>
                   </div>
                 </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-700">
              Showing {startIndex + 1} to {Math.min(endIndex, filteredUsers.length)} of {filteredUsers.length} results
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setCurrentPage(currentPage - 1)}
                disabled={currentPage === 1}
                className="px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  className={`px-3 py-2 text-sm font-medium rounded-md ${
                    currentPage === page
                      ? 'bg-indigo-600 text-white'
                      : 'text-gray-500 bg-white border border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {page}
                </button>
              ))}
              
              <button
                onClick={() => setCurrentPage(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
      
      {currentUsers.length === 0 && (
        <div className="text-center py-12">
          <div className="text-4xl mb-4">🔍</div>
          <p className="text-lg font-medium mb-2">No users found</p>
          <p className="text-sm text-gray-500">
            {searchTerm || roleFilter !== 'all' 
              ? 'Try adjusting your search or filter criteria'
              : 'No users have been added yet'
            }
          </p>
        </div>
      )}
      
      {showToastState && (
        <SimpleToast
          message={toastMessage}
          type={toastType}
          onClose={() => setShowToastState(false)}
        />
      )}
    </div>
  );
}
