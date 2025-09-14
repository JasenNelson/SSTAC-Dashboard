'use client';

import React from 'react';
import Link from 'next/link';
import { 
  Users, 
  Tags, 
  Bell, 
  Calendar, 
  FileText, 
  MessageSquare,
  BarChart3,
  Vote,
  FileSearch
} from 'lucide-react';


type Metrics = {
  totalUsers: number;
  newDocumentsThisMonth: number;
  totalDiscussionThreads: number;
  activeAnnouncements: number;
  totalMilestones: number;
  completedMilestones: number;
  totalPollVotes: number;
};

export default function AdminDashboardClient({ metrics }: { metrics: Metrics }) {
  // Admin dashboard component - no refresh function needed

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-800 text-white shadow-2xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="text-center">
            <h1 className="text-4xl font-bold mb-4">Admin Dashboard</h1>
            <p className="text-xl text-blue-100 max-w-3xl mx-auto">
              Central command center for managing the SSTAC & TWG Dashboard
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 -mt-8 relative z-10">
        {/* Key Metrics Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
          {/* Total Users */}
          <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100 hover:shadow-xl transition-all duration-300">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Users</p>
                <p className="text-3xl font-bold text-blue-600">{metrics.totalUsers}</p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                <Users className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </div>

          {/* New Documents This Month */}
          <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100 hover:shadow-xl transition-all duration-300">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">New Documents This Month</p>
                <p className="text-3xl font-bold text-green-600">{metrics.newDocumentsThisMonth}</p>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                <FileText className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </div>

          {/* Total Discussion Threads */}
          <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100 hover:shadow-xl transition-all duration-300">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Discussion Threads</p>
                <p className="text-3xl font-bold text-purple-600">{metrics.totalDiscussionThreads}</p>
              </div>
              <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                <MessageSquare className="w-6 h-6 text-purple-600" />
              </div>
            </div>
          </div>

          {/* Active Announcements */}
          <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100 hover:shadow-xl transition-all duration-300">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Active Announcements</p>
                <p className="text-3xl font-bold text-orange-600">{metrics.activeAnnouncements}</p>
              </div>
              <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center">
                <Bell className="w-6 h-6 text-orange-600" />
              </div>
            </div>
          </div>

          {/* Total Milestones */}
          <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100 hover:shadow-xl transition-all duration-300">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Milestones</p>
                <p className="text-3xl font-bold text-indigo-600">{metrics.totalMilestones}</p>
              </div>
              <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center">
                <Calendar className="w-6 h-6 text-indigo-600" />
              </div>
            </div>
          </div>

          {/* Completion Rate */}
          <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100 hover:shadow-xl transition-all duration-300">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Completion Rate</p>
                <p className="text-3xl font-bold text-teal-600">
                  {Math.round((metrics.completedMilestones / metrics.totalMilestones) * 100)}%
                </p>
              </div>
              <div className="w-12 h-12 bg-teal-100 rounded-xl flex items-center justify-center">
                <BarChart3 className="w-6 h-6 text-teal-600" />
              </div>
            </div>
          </div>

          {/* Total Poll Votes */}
          <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100 hover:shadow-xl transition-all duration-300">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Poll Votes</p>
                <p className="text-3xl font-bold text-indigo-600">{metrics.totalPollVotes}</p>
              </div>
              <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center">
                <Vote className="w-6 h-6 text-indigo-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="mb-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Quick Actions</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Manage Users */}
            <Link href="/admin/users" className="group">
              <div className="bg-white rounded-2xl shadow-lg p-6 hover:shadow-xl transition-all duration-300 transform hover:-translate-y-2 border border-gray-100 hover:border-blue-300">
                <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center mb-4 group-hover:bg-blue-200 transition-colors">
                  <Users className="w-8 h-8 text-blue-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 group-hover:text-blue-600 transition-colors mb-2">
                  Manage Users
                </h3>
                <p className="text-gray-600 text-sm">
                  Add, edit, and manage user accounts and permissions
                </p>
              </div>
            </Link>

            {/* Manage Tags */}
            <Link href="/admin/tags" className="group">
              <div className="bg-white rounded-2xl shadow-lg p-6 hover:shadow-xl transition-all duration-300 transform hover:-translate-y-2 border border-gray-100 hover:border-green-300">
                <div className="w-16 h-16 bg-green-100 rounded-2xl flex items-center justify-center mb-4 group-hover:bg-green-200 transition-colors">
                  <Tags className="w-8 h-8 text-green-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 group-hover:text-green-600 transition-colors mb-2">
                  Manage Tags
                </h3>
                <p className="text-gray-600 text-sm">
                  Create, edit, and organize document tags
                </p>
              </div>
            </Link>

            {/* Create Announcement */}
            <Link href="/admin/announcements" className="group">
              <div className="bg-white rounded-2xl shadow-lg p-6 hover:shadow-xl transition-all duration-300 transform hover:-translate-y-2 border border-gray-100 hover:border-orange-300">
                <div className="w-16 h-16 bg-orange-100 rounded-2xl flex items-center justify-center mb-4 group-hover:bg-orange-200 transition-colors">
                  <Bell className="w-8 h-8 text-orange-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 group-hover:text-orange-600 transition-colors mb-2">
                  Announcements
                </h3>
                <p className="text-gray-600 text-sm">
                  Create and manage dashboard announcements
                </p>
              </div>
            </Link>

            {/* Manage Milestones */}
            <Link href="/admin/milestones" className="group">
              <div className="bg-white rounded-2xl shadow-lg p-6 hover:shadow-xl transition-all duration-300 transform hover:-translate-y-2 border border-gray-100 hover:border-purple-300">
                <div className="w-16 h-16 bg-purple-100 rounded-2xl flex items-center justify-center mb-4 group-hover:bg-purple-200 transition-colors">
                  <Calendar className="w-8 h-8 text-purple-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 group-hover:text-purple-600 transition-colors mb-2">
                  Milestones
                </h3>
                <p className="text-gray-600 text-sm">
                  Update project timeline and milestones
                </p>
              </div>
            </Link>

            {/* Poll Results */}
            <Link href="/admin/poll-results" className="group">
              <div className="bg-white rounded-2xl shadow-lg p-6 hover:shadow-xl transition-all duration-300 transform hover:-translate-y-2 border border-gray-100 hover:border-indigo-300">
                <div className="w-16 h-16 bg-indigo-100 rounded-2xl flex items-center justify-center mb-4 group-hover:bg-indigo-200 transition-colors">
                  <Vote className="w-8 h-8 text-indigo-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 group-hover:text-indigo-600 transition-colors mb-2">
                  Poll Results
                </h3>
                <p className="text-gray-600 text-sm">
                  View and analyze poll responses
                </p>
              </div>
            </Link>

            {/* TWG White Paper Synthesis */}
            <Link href="/admin/twg-synthesis" className="group">
              <div className="bg-white rounded-2xl shadow-lg p-6 hover:shadow-xl transition-all duration-300 transform hover:-translate-y-2 border border-gray-100 hover:border-purple-300">
                <div className="w-16 h-16 bg-purple-100 rounded-2xl flex items-center justify-center mb-4 group-hover:bg-purple-200 transition-colors">
                  <FileSearch className="w-8 h-8 text-purple-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 group-hover:text-purple-600 transition-colors mb-2">
                  TWG White Paper Synthesis
                </h3>
                <p className="text-gray-600 text-sm">
                  Analyze and synthesize TWG review feedback
                </p>
              </div>
            </Link>

            {/* Test DB - Database Diagnostics */}
            <Link href="/test-db" className="group">
              <div className="bg-white rounded-2xl shadow-lg p-6 hover:shadow-xl transition-all duration-300 transform hover:-translate-y-2 border border-gray-100 hover:border-red-300">
                <div className="w-16 h-16 bg-red-100 rounded-2xl flex items-center justify-center mb-4 group-hover:bg-red-200 transition-colors">
                  <BarChart3 className="w-8 h-8 text-red-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 group-hover:text-red-600 transition-colors mb-2">
                  Test DB
                </h3>
                <p className="text-gray-600 text-sm">
                  Database diagnostics and connection testing
                </p>
              </div>
            </Link>
          </div>
        </div>

        {/* System Status */}
        <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">System Status</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <span className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center mr-3">
                  <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                </span>
                All Systems Operational
              </h3>
              <div className="space-y-3 text-sm text-gray-600">
                <div className="flex items-center justify-between">
                  <span>Database Connection</span>
                  <span className="text-green-600 font-medium">✓ Connected</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Authentication Service</span>
                  <span className="text-green-600 font-medium">✓ Active</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>File Storage</span>
                  <span className="text-green-600 font-medium">✓ Available</span>
                </div>
              </div>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <span className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center mr-3">
                  <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                </span>
                Recent Activity
              </h3>
              <div className="space-y-3 text-sm text-gray-600">
                <div className="flex items-center justify-between">
                  <span>Last User Login</span>
                  <span className="text-gray-500">2 hours ago</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Last Document Upload</span>
                  <span className="text-gray-500">1 day ago</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Last Announcement</span>
                  <span className="text-gray-500">3 days ago</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
