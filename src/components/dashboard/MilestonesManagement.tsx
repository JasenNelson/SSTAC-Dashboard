'use client';

import { useState, useEffect } from 'react';
import { useToast } from '@/components/Toast';
import { createClient } from '../supabase-client';

import { Plus, Edit, Trash2, Calendar, Target, CheckCircle, Clock, AlertCircle } from 'lucide-react';

type Milestone = {
  id: number;
  title: string;
  description: string;
  target_date: string;
  status: 'pending' | 'in_progress' | 'completed' | 'delayed';
  priority: 'low' | 'medium' | 'high';
  created_at: string;
  created_by: string | null;
};

function SubmitButton({ children }: { children: React.ReactNode }) {
  return (
    <button
      type="submit"
      className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 hover:bg-purple-700 transition-colors"
    >
      {children}
    </button>
  );
}

export default function MilestonesManagement() {
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingMilestone, setEditingMilestone] = useState<Milestone | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const { showToast } = useToast();
  const supabase = createClient();

  useEffect(() => {
    fetchMilestones();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only fetch once on mount - fetchMilestones is stable

  const fetchMilestones = async () => {
    try {
      const { data, error } = await supabase
        .from('milestones')
        .select('*')
        .order('target_date', { ascending: true });
      
      if (error) {
        console.error('Error fetching milestones:', error);
        showToast({ 
          type: 'error', 
          title: 'Error', 
          message: 'Failed to load milestones', 
          duration: 5000 
        });
      } else {
        setMilestones(data || []);
      }
    } catch (error) {
      console.error('Error fetching milestones:', error);
      showToast({ 
        type: 'error', 
        title: 'Error', 
        message: 'Failed to load milestones', 
        duration: 5000 
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateMilestone = async (formData: FormData) => {
    try {
      const response = await fetch('/api/milestones', {
        method: 'POST',
        body: formData,
      });
      
      const result = await response.json();
      
      if (result?.success) {
        showToast({
          type: 'success',
          title: 'Milestone Created!',
          message: result.success,
          duration: 3000
        });
        setShowCreateForm(false);
        // Refresh milestones list
        fetchMilestones();
      } else if (result?.error) {
        showToast({
          type: 'error',
          title: 'Error',
          message: result.error,
          duration: 5000
        });
      }
    } catch (error) {
      console.error('Error creating milestone:', error);
      showToast({
        type: 'error',
        title: 'Error',
        message: 'An unexpected error occurred while creating the milestone.',
        duration: 5000
      });
    }
  };

  const handleUpdateMilestone = async (formData: FormData) => {
    try {
      const response = await fetch('/api/milestones', {
        method: 'PUT',
        body: formData,
      });
      
      const result = await response.json();
      
      if (result?.success) {
        showToast({
          type: 'success',
          title: 'Milestone Updated!',
          message: result.success,
          duration: 3000
        });
        setEditingMilestone(null);
        // Refresh milestones list
        fetchMilestones();
      } else if (result?.error) {
        showToast({
          type: 'error',
          title: 'Error',
          message: result.error,
          duration: 5000
        });
      }
    } catch (error) {
      console.error('Error updating milestone:', error);
      showToast({
        type: 'error',
        title: 'Error',
        message: 'An unexpected error occurred while updating the milestone.',
        duration: 5000
      });
    }
  };

  const handleDeleteMilestone = async (milestoneId: number) => {
    if (!confirm('Are you sure you want to delete this milestone? This action cannot be undone.')) {
      return;
    }

    try {
      const formData = new FormData();
      formData.append('id', milestoneId.toString());

      const response = await fetch('/api/milestones', {
        method: 'DELETE',
        body: formData,
      });
      
      const result = await response.json();
      
      if (result?.success) {
        showToast({
          type: 'success',
          title: 'Milestone Deleted!',
          message: result.success,
          duration: 3000
        });
        // Refresh milestones list
        fetchMilestones();
      } else if (result?.error) {
        showToast({
          type: 'error',
          title: 'Error',
          message: result.error,
          duration: 5000
        });
      }
    } catch (error) {
      console.error('Error deleting milestone:', error);
      showToast({
        type: 'error',
        title: 'Error',
        message: 'An unexpected error occurred while deleting the milestone.',
        duration: 5000
      });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800';
      case 'in_progress': return 'bg-blue-100 text-blue-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'delayed': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle className="w-4 h-4" />;
      case 'in_progress': return <Clock className="w-4 h-4" />;
      case 'pending': return <Target className="w-4 h-4" />;
      case 'delayed': return <AlertCircle className="w-4 h-4" />;
      default: return <Target className="w-4 h-4" />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'low': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case 'high': return '🔴';
      case 'medium': return '🟡';
      case 'low': return '🟢';
      default: return '⚪';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getDaysUntil = (targetDate: string) => {
    const today = new Date();
    const target = new Date(targetDate);
    const diffTime = target.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) {
      return `${Math.abs(diffDays)} days overdue`;
    } else if (diffDays === 0) {
      return 'Due today';
    } else if (diffDays === 1) {
      return 'Due tomorrow';
    } else {
      return `Due in ${diffDays} days`;
    }
  };

  if (isLoading) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
        <p className="mt-4 text-gray-600">Loading milestones...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Create Button */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Project Milestones</h2>
          <p className="text-gray-600 mt-1">
            Manage project timeline and track progress
          </p>
        </div>
        <button
          onClick={() => setShowCreateForm(true)}
          className="flex items-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
        >
          <Plus className="w-4 h-4 mr-2" />
          New Milestone
        </button>
      </div>

      {/* Create/Edit Form */}
      {(showCreateForm || editingMilestone) && (
        <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            {editingMilestone ? 'Edit Milestone' : 'Create New Milestone'}
          </h3>
          
          <form onSubmit={async (e) => {
            e.preventDefault();
            const formData = new FormData(e.currentTarget);
            if (editingMilestone) {
              await handleUpdateMilestone(formData);
            } else {
              await handleCreateMilestone(formData);
            }
          }} className="space-y-4">
            {editingMilestone && (
              <input type="hidden" name="id" value={editingMilestone.id} />
            )}
            
            <div>
              <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
                Title *
              </label>
              <input
                type="text"
                id="title"
                name="title"
                required
                defaultValue={editingMilestone?.title || ''}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                placeholder="Enter milestone title"
              />
            </div>

            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
                Description *
              </label>
              <textarea
                id="description"
                name="description"
                required
                rows={3}
                defaultValue={editingMilestone?.description || ''}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                placeholder="Enter milestone description"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label htmlFor="target_date" className="block text-sm font-medium text-gray-700 mb-1">
                  Target Date *
                </label>
                <input
                  type="date"
                  id="target_date"
                  name="target_date"
                  required
                  defaultValue={editingMilestone?.target_date || ''}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>

              <div>
                <label htmlFor="status" className="block text-sm font-medium text-gray-700 mb-1">
                  Status
                </label>
                <select
                  id="status"
                  name="status"
                  defaultValue={editingMilestone?.status || 'pending'}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                >
                  <option value="pending">Pending</option>
                  <option value="in_progress">In Progress</option>
                  <option value="completed">Completed</option>
                  <option value="delayed">Delayed</option>
                </select>
              </div>

              <div>
                <label htmlFor="priority" className="block text-sm font-medium text-gray-700 mb-1">
                  Priority
                </label>
                <select
                  id="priority"
                  name="priority"
                  defaultValue={editingMilestone?.priority || 'medium'}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end space-x-3 pt-4">
              <button
                type="button"
                onClick={() => {
                  setShowCreateForm(false);
                  setEditingMilestone(null);
                }}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <SubmitButton>
                {editingMilestone ? 'Update' : 'Create'} Milestone
              </SubmitButton>
            </div>
          </form>
        </div>
      )}

      {/* Milestones List */}
      <div className="bg-white rounded-lg shadow-md border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">
            Project Timeline ({milestones.length} milestones)
          </h3>
        </div>
        
        {milestones.length === 0 ? (
          <div className="px-6 py-12 text-center text-gray-500">
            <div className="text-4xl mb-4">🎯</div>
            <p className="text-lg font-medium mb-2">No milestones yet</p>
            <p className="text-sm">Create your first milestone to get started</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {milestones.map((milestone) => (
              <div key={milestone.id} className="p-6 hover:bg-gray-50 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <h4 className="text-lg font-semibold text-gray-900">
                        {milestone.title}
                      </h4>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(milestone.status)}`}>
                        {getStatusIcon(milestone.status)} {milestone.status.replace('_', ' ')}
                      </span>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getPriorityColor(milestone.priority)}`}>
                        {getPriorityIcon(milestone.priority)} {milestone.priority}
                      </span>
                    </div>
                    
                    <p className="text-gray-700 mb-3">{milestone.description}</p>
                    
                    <div className="text-sm text-gray-600 mb-3">
                      <div className="flex items-center space-x-4">
                        <span className="flex items-center">
                          <Calendar className="w-4 h-4 mr-1" />
                          {formatDate(milestone.target_date)}
                        </span>
                        <span className={`font-medium ${
                          milestone.status === 'completed' ? 'text-green-600' :
                          milestone.status === 'delayed' ? 'text-red-600' :
                          'text-blue-600'
                        }`}>
                          {getDaysUntil(milestone.target_date)}
                        </span>
                        {milestone.created_by && (
                          <span className="text-gray-500">
                            Created by {milestone.created_by}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 ml-4">
                    <button
                      onClick={() => setEditingMilestone(milestone)}
                      className="p-2 text-gray-600 hover:text-purple-600 hover:bg-purple-50 rounded-md transition-colors"
                      title="Edit milestone"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteMilestone(milestone.id)}
                      className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                      title="Delete milestone"
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
