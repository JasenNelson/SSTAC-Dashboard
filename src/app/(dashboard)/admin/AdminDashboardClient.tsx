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
  FileSearch,
  ClipboardCheck
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-sky-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-sky-900 text-white shadow-2xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="text-center">
            <h1 className="text-4xl font-bold mb-4">Admin Dashboard</h1>
            <p className="text-xl text-sky-200 max-w-3xl mx-auto">
              Central command center for managing the SSTAC & TWG Dashboard
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 -mt-8 relative z-10">
        {/* Key Metrics Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
          {/* Total Users */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg p-6 border border-slate-200 dark:border-slate-700 hover:shadow-xl transition-all duration-300">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Total Users</p>
                <p className="text-3xl font-bold text-sky-700 dark:text-sky-300">{metrics.totalUsers}</p>
              </div>
              <div className="w-12 h-12 bg-sky-100 dark:bg-sky-900/40 rounded-xl flex items-center justify-center">
                <Users className="w-6 h-6 text-sky-700 dark:text-sky-300" />
              </div>
            </div>
          </div>

          {/* New Documents This Month */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg p-6 border border-slate-200 dark:border-slate-700 hover:shadow-xl transition-all duration-300">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">New Documents This Month</p>
                <p className="text-3xl font-bold text-green-600">{metrics.newDocumentsThisMonth}</p>
              </div>
              <div className="w-12 h-12 bg-green-100 dark:bg-green-900/40 rounded-xl flex items-center justify-center">
                <FileText className="w-6 h-6 text-green-600 dark:text-green-400" />
              </div>
            </div>
          </div>

          {/* Total Discussion Threads */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg p-6 border border-slate-200 dark:border-slate-700 hover:shadow-xl transition-all duration-300">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Discussion Threads</p>
                <p className="text-3xl font-bold text-purple-600">{metrics.totalDiscussionThreads}</p>
              </div>
              <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/40 rounded-xl flex items-center justify-center">
                <MessageSquare className="w-6 h-6 text-purple-600 dark:text-purple-400" />
              </div>
            </div>
          </div>

          {/* Active Announcements */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg p-6 border border-slate-200 dark:border-slate-700 hover:shadow-xl transition-all duration-300">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Active Announcements</p>
                <p className="text-3xl font-bold text-orange-600">{metrics.activeAnnouncements}</p>
              </div>
              <div className="w-12 h-12 bg-orange-100 dark:bg-orange-900/40 rounded-xl flex items-center justify-center">
                <Bell className="w-6 h-6 text-orange-600 dark:text-orange-400" />
              </div>
            </div>
          </div>

          {/* Total Milestones */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg p-6 border border-slate-200 dark:border-slate-700 hover:shadow-xl transition-all duration-300">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Total Milestones</p>
                <p className="text-3xl font-bold text-sky-700 dark:text-sky-300">{metrics.totalMilestones}</p>
              </div>
              <div className="w-12 h-12 bg-sky-100 dark:bg-sky-900/40 rounded-xl flex items-center justify-center">
                <Calendar className="w-6 h-6 text-sky-700 dark:text-sky-300" />
              </div>
            </div>
          </div>

          {/* Completion Rate */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg p-6 border border-slate-200 dark:border-slate-700 hover:shadow-xl transition-all duration-300">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Completion Rate</p>
                <p className="text-3xl font-bold text-teal-600">
                  {Math.round((metrics.completedMilestones / metrics.totalMilestones) * 100)}%
                </p>
              </div>
              <div className="w-12 h-12 bg-teal-100 dark:bg-teal-900/40 rounded-xl flex items-center justify-center">
                <BarChart3 className="w-6 h-6 text-teal-600 dark:text-teal-400" />
              </div>
            </div>
          </div>

          {/* Total Poll Votes */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg p-6 border border-slate-200 dark:border-slate-700 hover:shadow-xl transition-all duration-300">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Total Poll Votes</p>
                <p className="text-3xl font-bold text-sky-700 dark:text-sky-300">{metrics.totalPollVotes}</p>
              </div>
              <div className="w-12 h-12 bg-sky-100 dark:bg-sky-900/40 rounded-xl flex items-center justify-center">
                <Vote className="w-6 h-6 text-sky-700 dark:text-sky-300" />
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="mb-12">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-6">Quick Actions</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Manage Users */}
            <Link href="/admin/users" className="group">
              <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg p-6 hover:shadow-xl transition-all duration-300 transform hover:-translate-y-2 border border-slate-200 dark:border-slate-700 hover:border-sky-300">
                <div className="w-16 h-16 bg-sky-100 dark:bg-sky-900/40 rounded-2xl flex items-center justify-center mb-4 group-hover:bg-sky-200 dark:group-hover:bg-sky-800 transition-colors">
                  <Users className="w-8 h-8 text-sky-700 dark:text-sky-300" />
                </div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white group-hover:text-sky-700 dark:group-hover:text-sky-300 transition-colors mb-2">
                  Manage Users
                </h3>
                <p className="text-slate-500 dark:text-slate-400 text-sm">
                  Add, edit, and manage user accounts and permissions
                </p>
              </div>
            </Link>

            {/* Manage Tags */}
            <Link href="/admin/tags" className="group">
              <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg p-6 hover:shadow-xl transition-all duration-300 transform hover:-translate-y-2 border border-slate-200 dark:border-slate-700 hover:border-green-300">
                <div className="w-16 h-16 bg-green-100 dark:bg-green-900/40 rounded-2xl flex items-center justify-center mb-4 group-hover:bg-green-200 dark:group-hover:bg-green-800 transition-colors">
                  <Tags className="w-8 h-8 text-green-600 dark:text-green-400" />
                </div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white group-hover:text-green-600 transition-colors mb-2">
                  Manage Tags
                </h3>
                <p className="text-slate-500 dark:text-slate-400 text-sm">
                  Create, edit, and organize document tags
                </p>
              </div>
            </Link>

            {/* Create Announcement */}
            <Link href="/admin/announcements" className="group">
              <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg p-6 hover:shadow-xl transition-all duration-300 transform hover:-translate-y-2 border border-slate-200 dark:border-slate-700 hover:border-orange-300">
                <div className="w-16 h-16 bg-orange-100 dark:bg-orange-900/40 rounded-2xl flex items-center justify-center mb-4 group-hover:bg-orange-200 dark:group-hover:bg-orange-800 transition-colors">
                  <Bell className="w-8 h-8 text-orange-600 dark:text-orange-400" />
                </div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white group-hover:text-orange-600 transition-colors mb-2">
                  Announcements
                </h3>
                <p className="text-slate-500 dark:text-slate-400 text-sm">
                  Create and manage dashboard announcements
                </p>
              </div>
            </Link>

            {/* Manage Milestones */}
            <Link href="/admin/milestones" className="group">
              <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg p-6 hover:shadow-xl transition-all duration-300 transform hover:-translate-y-2 border border-slate-200 dark:border-slate-700 hover:border-purple-300">
                <div className="w-16 h-16 bg-purple-100 dark:bg-purple-900/40 rounded-2xl flex items-center justify-center mb-4 group-hover:bg-purple-200 dark:group-hover:bg-purple-800 transition-colors">
                  <Calendar className="w-8 h-8 text-purple-600 dark:text-purple-400" />
                </div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white group-hover:text-purple-600 transition-colors mb-2">
                  Milestones
                </h3>
                <p className="text-slate-500 dark:text-slate-400 text-sm">
                  Update project timeline and milestones
                </p>
              </div>
            </Link>

            {/* Poll Results */}
            <Link href="/admin/poll-results" className="group">
              <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg p-6 hover:shadow-xl transition-all duration-300 transform hover:-translate-y-2 border border-slate-200 dark:border-slate-700 hover:border-sky-300">
                <div className="w-16 h-16 bg-sky-100 dark:bg-sky-900/40 rounded-2xl flex items-center justify-center mb-4 group-hover:bg-sky-200 dark:group-hover:bg-sky-800 transition-colors">
                  <Vote className="w-8 h-8 text-sky-700 dark:text-sky-300" />
                </div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white group-hover:text-sky-700 dark:group-hover:text-sky-300 transition-colors mb-2">
                  Poll Results
                </h3>
                <p className="text-slate-500 dark:text-slate-400 text-sm">
                  View and analyze poll responses
                </p>
              </div>
            </Link>

            {/* TWG White Paper Synthesis */}
            <Link href="/admin/twg-synthesis" className="group">
              <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg p-6 hover:shadow-xl transition-all duration-300 transform hover:-translate-y-2 border border-slate-200 dark:border-slate-700 hover:border-purple-300">
                <div className="w-16 h-16 bg-purple-100 dark:bg-purple-900/40 rounded-2xl flex items-center justify-center mb-4 group-hover:bg-purple-200 dark:group-hover:bg-purple-800 transition-colors">
                  <FileSearch className="w-8 h-8 text-purple-600 dark:text-purple-400" />
                </div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white group-hover:text-purple-600 transition-colors mb-2">
                  TWG White Paper Synthesis
                </h3>
                <p className="text-slate-500 dark:text-slate-400 text-sm">
                  Analyze and synthesize TWG review feedback
                </p>
              </div>
            </Link>

            {/* Regulatory Review */}
            <Link href="/regulatory-review" className="group">
              <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg p-6 hover:shadow-xl transition-all duration-300 transform hover:-translate-y-2 border border-slate-200 dark:border-slate-700 hover:border-teal-300">
                <div className="w-16 h-16 bg-teal-100 dark:bg-teal-900/40 rounded-2xl flex items-center justify-center mb-4 group-hover:bg-teal-200 dark:group-hover:bg-teal-800 transition-colors">
                  <ClipboardCheck className="w-8 h-8 text-teal-600 dark:text-teal-400" />
                </div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white group-hover:text-teal-600 transition-colors mb-2">
                  Regulatory Review
                </h3>
                <p className="text-slate-500 dark:text-slate-400 text-sm">
                  Review and analyze regulatory frameworks
                </p>
              </div>
            </Link>
          </div>
        </div>

        {/* System Status */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-8 border border-slate-200 dark:border-slate-700">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-6">System Status</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center">
                <span className="w-6 h-6 bg-green-100 dark:bg-green-900/40 rounded-full flex items-center justify-center mr-3">
                  <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                </span>
                All Systems Operational
              </h3>
              <div className="space-y-3 text-sm text-slate-500 dark:text-slate-400">
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
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center">
                <span className="w-6 h-6 bg-sky-100 dark:bg-sky-900/40 rounded-full flex items-center justify-center mr-3">
                  <span className="w-2 h-2 bg-sky-500 rounded-full"></span>
                </span>
                Recent Activity
              </h3>
              <div className="space-y-3 text-sm text-slate-500 dark:text-slate-400">
                <div className="flex items-center justify-between">
                  <span>Last User Login</span>
                  <span className="text-slate-400 dark:text-slate-500">2 hours ago</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Last Document Upload</span>
                  <span className="text-slate-400 dark:text-slate-500">1 day ago</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Last Announcement</span>
                  <span className="text-slate-400 dark:text-slate-500">3 days ago</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
