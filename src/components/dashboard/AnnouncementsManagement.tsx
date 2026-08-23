'use client';

import { useState, useEffect } from 'react';
import { useToast } from '@/components/Toast';
import { createClient } from '@/lib/supabase/client';

import { Plus, Edit, Trash2, Eye, EyeOff, Calendar, User } from 'lucide-react';

type Announcement = {
  id: number;
  title: string;
  content: string;
  is_active: boolean;
  priority: 'low' | 'medium' | 'high';
  created_at: string;
  created_by: string | null;
};

function SubmitButton({ children }: { children: React.ReactNode }) {
  return (
    <button
      type="submit"
      className="px-4 py-2 bg-sky-700 text-white rounded-md hover:bg-sky-800 transition-colors"
    >
      {children}
    </button>
  );
}

export default function AnnouncementsManagement() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingAnnouncement, setEditingAnnouncement] = useState<Announcement | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [expandedAnnouncement, setExpandedAnnouncement] = useState<number | null>(null);
  const { showToast } = useToast();
  const supabase = createClient();

  useEffect(() => {
    fetchAnnouncements();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only fetch once on mount - fetchAnnouncements is stable

  const fetchAnnouncements = async () => {
    try {
      const { data, error } = await supabase
        .from('announcements')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching announcements:', error);
        showToast({
          type: 'error',
          title: 'Error',
          message: 'Failed to load announcements',
          duration: 5000
        });
      } else {
        setAnnouncements(data || []);
      }
    } catch (error) {
      console.error('Error fetching announcements:', error);
      showToast({
        type: 'error',
        title: 'Error',
        message: 'Failed to load announcements',
        duration: 5000
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateAnnouncement = async (formData: FormData) => {
    try {
      const response = await fetch('/api/announcements', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (result?.success) {
        showToast({
          type: 'success',
          title: 'Announcement Created!',
          message: result.success,
          duration: 3000
        });
        setShowCreateForm(false);
        // Refresh announcements list
        fetchAnnouncements();
      } else if (result?.error) {
        showToast({
          type: 'error',
          title: 'Error',
          message: result.error,
          duration: 5000
        });
      }
    } catch (error) {
      console.error('Error creating announcement:', error);
      showToast({
        type: 'error',
        title: 'Error',
        message: 'An unexpected error occurred while creating the announcement.',
        duration: 5000
      });
    }
  };

  const handleUpdateAnnouncement = async (formData: FormData) => {
    try {
      const response = await fetch('/api/announcements', {
        method: 'PUT',
        body: formData,
      });

      const result = await response.json();

      if (result?.success) {
        showToast({
          type: 'success',
          title: 'Announcement Updated!',
          message: result.success,
          duration: 3000
        });
        setEditingAnnouncement(null);
        // Refresh announcements list
        fetchAnnouncements();
      } else if (result?.error) {
        showToast({
          type: 'error',
          title: 'Error',
          message: result.error,
          duration: 5000
        });
      }
    } catch (error) {
      console.error('Error updating announcement:', error);
      showToast({
        type: 'error',
        title: 'Error',
        message: 'An unexpected error occurred while updating the announcement.',
        duration: 5000
      });
    }
  };

  const handleDeleteAnnouncement = async (announcementId: number) => {
    if (!confirm('Are you sure you want to delete this announcement? This action cannot be undone.')) {
      return;
    }

    try {
      const formData = new FormData();
      formData.append('id', announcementId.toString());

      const response = await fetch('/api/announcements', {
        method: 'DELETE',
        body: formData,
      });

      const result = await response.json();

      if (result?.success) {
        showToast({
          type: 'success',
          title: 'Announcement Deleted!',
          message: result.success,
          duration: 3000
        });
        // Refresh announcements list
        fetchAnnouncements();
      } else if (result?.error) {
        showToast({
          type: 'error',
          title: 'Error',
          message: result.error,
          duration: 5000
        });
      }
    } catch (error) {
      console.error('Error deleting announcement:', error);
      showToast({
        type: 'error',
        title: 'Error',
        message: 'An unexpected error occurred while deleting the announcement.',
        duration: 5000
      });
    }
  };

  const getPriorityBadgeClass = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'border border-red-200 bg-red-50 text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300';
      case 'medium':
        return 'border border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-300';
      case 'low':
        return 'border border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300';
      default:
        return 'border border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300';
    }
  };

  if (isLoading) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-12 w-12 border-2 border-sky-700 border-t-transparent mx-auto"></div>
        <p className="mt-4 text-slate-500">Loading announcements...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Create Button */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Announcements</h2>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            Manage dashboard announcements and important updates
          </p>
        </div>
        <button
          onClick={() => setShowCreateForm(true)}
          className="flex items-center px-4 py-2 bg-sky-700 text-white rounded-lg hover:bg-sky-800 transition-colors"
        >
          <Plus className="w-4 h-4 mr-2" />
          New Announcement
        </button>
      </div>

      {/* Create/Edit Form */}
      {(showCreateForm || editingAnnouncement) && (
        <div className="bg-white dark:bg-slate-900 rounded-lg shadow-md p-6 border border-slate-200 dark:border-slate-700">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
            {editingAnnouncement ? 'Edit Announcement' : 'Create New Announcement'}
          </h3>

          <form onSubmit={async (e) => {
            e.preventDefault();
            const formData = new FormData(e.currentTarget);
            if (editingAnnouncement) {
              await handleUpdateAnnouncement(formData);
            } else {
              await handleCreateAnnouncement(formData);
            }
          }} className="space-y-4">
            {editingAnnouncement && (
              <input type="hidden" name="id" value={editingAnnouncement.id} />
            )}

            <div>
              <label htmlFor="title" className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">
                Title *
              </label>
              <input
                type="text"
                id="title"
                name="title"
                required
                defaultValue={editingAnnouncement?.title || ''}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                placeholder="Enter announcement title"
              />
            </div>

            <div>
              <label htmlFor="content" className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">
                Content *
              </label>
              <textarea
                id="content"
                name="content"
                required
                rows={4}
                defaultValue={editingAnnouncement?.content || ''}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                placeholder="Enter announcement content"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="priority" className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">
                  Priority
                </label>
                <select
                  id="priority"
                  name="priority"
                  defaultValue={editingAnnouncement?.priority || 'medium'}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>

              <div>
                <label htmlFor="is_active" className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">
                  Status
                </label>
                <select
                  id="is_active"
                  name="is_active"
                  defaultValue={editingAnnouncement?.is_active?.toString() || 'true'}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                >
                  <option value="true">Active</option>
                  <option value="false">Inactive</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end space-x-3 pt-4">
              <button
                type="button"
                onClick={() => {
                  setShowCreateForm(false);
                  setEditingAnnouncement(null);
                }}
                className="px-4 py-2 text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 rounded-md hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
              >
                Cancel
              </button>
              <SubmitButton>
                {editingAnnouncement ? 'Update' : 'Create'} Announcement
              </SubmitButton>
            </div>
          </form>
        </div>
      )}

      {/* Announcements List */}
      <div className="bg-white dark:bg-slate-900 rounded-lg shadow-md border border-slate-200 dark:border-slate-700">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
            Current Announcements ({announcements.length})
          </h3>
        </div>

        {announcements.length === 0 ? (
          <div className="px-6 py-12 text-center text-slate-500 dark:text-slate-400">
            <p className="text-lg font-medium mb-2">No announcements yet</p>
            <p className="text-sm">Create your first announcement to get started</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-200 dark:divide-slate-700">
            {announcements.map((announcement) => (
              <div key={announcement.id} className="p-6 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <h4 className="text-lg font-semibold text-slate-900 dark:text-white">
                        {announcement.title}
                      </h4>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider ${getPriorityBadgeClass(announcement.priority)}`}>
                        {announcement.priority}
                      </span>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                        announcement.is_active
                          ? 'border border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300'
                          : 'border border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
                      }`}>
                        {announcement.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </div>

                    <div className="text-sm text-slate-500 dark:text-slate-400 mb-3">
                      <div className="flex items-center space-x-4">
                        <span className="flex items-center">
                          <Calendar className="w-4 h-4 mr-1" />
                          {new Date(announcement.created_at).toLocaleDateString()}
                        </span>
                        {announcement.created_by && (
                          <span className="flex items-center">
                            <User className="w-4 h-4 mr-1" />
                            {announcement.created_by}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="text-slate-600 dark:text-slate-300">
                      {expandedAnnouncement === announcement.id ? (
                        <div>
                          <p className="whitespace-pre-wrap">{announcement.content}</p>
                          <button
                            onClick={() => setExpandedAnnouncement(null)}
                            className="text-sky-700 hover:text-sky-800 text-sm mt-2 flex items-center"
                          >
                            <EyeOff className="w-4 h-4 mr-1" />
                            Show less
                          </button>
                        </div>
                      ) : (
                        <div>
                          <p className="line-clamp-2">{announcement.content}</p>
                          <button
                            onClick={() => setExpandedAnnouncement(announcement.id)}
                            className="text-sky-700 hover:text-sky-800 text-sm mt-2 flex items-center"
                          >
                            <Eye className="w-4 h-4 mr-1" />
                            Show more
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 ml-4">
                    <button
                      onClick={() => setEditingAnnouncement(announcement)}
                      aria-label="Edit announcement"
                      className="p-2 text-slate-500 dark:text-slate-400 hover:text-sky-700 dark:hover:text-sky-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-1"
                      title="Edit announcement"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteAnnouncement(announcement.id)}
                      aria-label="Delete announcement"
                      className="p-2 text-slate-500 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-1"
                      title="Delete announcement"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
