'use client';

import { useState, useEffect } from 'react';
import { useToast } from '@/components/Toast';
import { createClient } from '../supabase-client';


type Tag = {
  id: number;
  name: string;
  color: string;
  created_at: string;
  created_by: string | null;
};

// Submit button component for forms
function SubmitButton({ children }: { children: React.ReactNode }) {
  return (
    <button
      type="submit"
      className="px-4 py-2 font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 transition-colors"
    >
      {children}
    </button>
  );
}

export default function TagManagement() {
  const [tags, setTags] = useState<Tag[]>([]);
  const [_isLoading, setIsLoading] = useState(true);
  const [editingTag, setEditingTag] = useState<Tag | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const { showToast } = useToast();
  const supabase = createClient();

  // Fetch tags on component mount
  useEffect(() => {
    const fetchTags = async () => {
      try {
        const { data, error } = await supabase
          .from('tags')
          .select('*')
          .order('name');
        
        if (error) {
          console.error('Error fetching tags:', error);
          showToast({
            type: 'error',
            title: 'Error',
            message: 'Failed to load tags',
            duration: 5000
          });
        } else {
          setTags(data || []);
        }
      } catch (error) {
        console.error('Error fetching tags:', error);
        showToast({
          type: 'error',
          title: 'Error',
          message: 'Failed to load tags',
          duration: 5000
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchTags();
  }, [supabase, showToast]);

  const handleCreateTag = async (formData: FormData) => {
    try {
      // Call the server action via form submission
      const response = await fetch('/api/tags', {
        method: 'POST',
        body: formData,
      });
      
      const result = await response.json();
      
      if (result?.success) {
        showToast({
          type: 'success',
          title: 'Tag Created!',
          message: result.success,
          duration: 3000
        });
        setShowCreateForm(false);
        // Refresh the page to get updated tags
        window.location.reload();
      } else if (result?.error) {
        showToast({
          type: 'error',
          title: 'Error',
          message: result.error,
          duration: 5000
        });
      }
      
      return result;
    } catch (error) {
      console.error('Error creating tag:', error);
      showToast({
        type: 'error',
        title: 'Error',
        message: 'An unexpected error occurred while creating the tag.',
        duration: 5000
      });
      return { error: 'An unexpected error occurred' };
    }
  };

  const handleUpdateTag = async (formData: FormData) => {
    try {
      // Call the server action via form submission
      const response = await fetch('/api/tags', {
        method: 'PUT',
        body: formData,
      });
      
      const result = await response.json();
      
      if (result?.success) {
        showToast({
          type: 'success',
          title: 'Tag Updated!',
          message: result.success,
          duration: 3000
        });
        setEditingTag(null);
        // Refresh the page to get updated tags
        window.location.reload();
      } else if (result?.error) {
        showToast({
          type: 'error',
          title: 'Error',
          message: result.error,
          duration: 5000
        });
      }
      
      return result;
    } catch (error) {
      console.error('Error updating tag:', error);
      showToast({
        type: 'error',
        title: 'Error',
        message: 'An unexpected error occurred while updating the tag.',
        duration: 5000
      });
      return { error: 'An unexpected error occurred' };
    }
  };

  const handleDeleteTag = async (tagId: number) => {
    if (!confirm('Are you sure you want to delete this tag? This action cannot be undone.')) {
      return;
    }

    try {
      const formData = new FormData();
      formData.append('id', tagId.toString());

      // Call the server action via form submission
      const response = await fetch('/api/tags', {
        method: 'DELETE',
        body: formData,
      });
      
      const result = await response.json();
      
      if (result?.success) {
        showToast({
          type: 'success',
          title: 'Tag Deleted!',
          message: result.success,
          duration: 3000
        });
        // Refresh the page to get updated tags
        window.location.reload();
      } else if (result?.error) {
        showToast({
          type: 'error',
          title: 'Error',
          message: result.error,
          duration: 5000
        });
      }
    } catch (error) {
      console.error('Error deleting tag:', error);
      showToast({
        type: 'error',
        title: 'Error',
        message: 'An unexpected error occurred while deleting the tag.',
        duration: 5000
      });
    }
  };

  const presetColors = [
    '#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EF4444',
    '#06B6D4', '#84CC16', '#F97316', '#6B7280', '#EC4899'
  ];

  return (
    <div className="space-y-6">
      {/* Create New Tag Button */}
      <div className="flex justify-between items-center">
        <button
          type="button"
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 transition-colors"
        >
          {showCreateForm ? 'Cancel' : 'Create New Tag'}
        </button>
      </div>

      {/* Create Tag Form */}
      {showCreateForm && (
        <div className="bg-white p-6 rounded-lg shadow-md border">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Create New Tag</h3>
          <form onSubmit={async (e) => {
          e.preventDefault();
          const formData = new FormData(e.currentTarget);
          await handleCreateTag(formData);
        }} className="space-y-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                Tag Name
              </label>
              <input
                type="text"
                id="name"
                name="name"
                required
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="Enter tag name"
              />
            </div>

            <div>
              <label htmlFor="color" className="block text-sm font-medium text-gray-700">
                Color
              </label>
              <div className="mt-1 flex items-center space-x-3">
                <input
                  type="color"
                  id="color"
                  name="color"
                  defaultValue="#6B7280"
                  className="h-10 w-20 border border-gray-300 rounded-md"
                />
                <div className="flex space-x-2">
                  {presetColors.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => {
                        const colorInput = document.getElementById('color') as HTMLInputElement;
                        if (colorInput) colorInput.value = color;
                      }}
                      className="w-6 h-6 rounded border-2 border-gray-300 hover:border-gray-400 transition-colors"
                      style={{ backgroundColor: color }}
                      title={color}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className="flex space-x-3">
              <SubmitButton>Create Tag</SubmitButton>
              <button
                type="button"
                onClick={() => setShowCreateForm(false)}
                className="px-4 py-2 font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Tags List */}
      <div className="bg-white rounded-lg shadow-md">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">Existing Tags</h3>
        </div>
        <ul className="divide-y divide-gray-200">
          {tags.length > 0 ? (
            tags.map((tag) => (
              <li key={tag.id} className="px-6 py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <span
                      className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium text-white"
                      style={{ backgroundColor: tag.color }}
                    >
                      {tag.name}
                    </span>
                                         <span className="text-sm text-gray-500">
                       {new Date(tag.created_at).toISOString().split('T')[0]}
                     </span>
                  </div>
                  <div className="flex space-x-2">
                    <button
                      type="button"
                      onClick={() => setEditingTag(tag)}
                      className="px-3 py-1 text-sm font-medium text-indigo-600 hover:text-indigo-700 transition-colors"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteTag(tag.id)}
                      className="px-3 py-1 text-sm font-medium text-red-600 hover:text-red-700 transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </li>
            ))
          ) : (
            <li className="px-6 py-4">
              <p className="text-gray-500 text-center">No tags found.</p>
            </li>
          )}
        </ul>
      </div>

      {/* Edit Tag Modal */}
      {editingTag && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Edit Tag</h3>
              <form onSubmit={async (e) => {
          e.preventDefault();
          const formData = new FormData(e.currentTarget);
          await handleUpdateTag(formData);
        }} className="space-y-4">
                <input type="hidden" name="id" value={editingTag.id} />
                
                <div>
                  <label htmlFor="edit-name" className="block text-sm font-medium text-gray-700">
                    Tag Name
                  </label>
                  <input
                    type="text"
                    id="edit-name"
                    name="name"
                    defaultValue={editingTag.name}
                    required
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label htmlFor="edit-color" className="block text-sm font-medium text-gray-700">
                    Color
                  </label>
                  <div className="mt-1 flex items-center space-x-3">
                    <input
                      type="color"
                      id="edit-color"
                      name="color"
                      defaultValue={editingTag.color}
                      className="h-10 w-20 border border-gray-300 rounded-md"
                    />
                    <div className="flex space-x-2">
                      {presetColors.map((color) => (
                        <button
                          key={color}
                          type="button"
                          onClick={() => {
                            const colorInput = document.getElementById('edit-color') as HTMLInputElement;
                            if (colorInput) colorInput.value = color;
                          }}
                          className="w-6 h-6 rounded border-2 border-gray-300 hover:border-gray-400 transition-colors"
                          style={{ backgroundColor: color }}
                          title={color}
                        />
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex space-x-3">
                  <SubmitButton>Update Tag</SubmitButton>
                  <button
                    type="button"
                    onClick={() => setEditingTag(null)}
                    className="px-4 py-2 font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
