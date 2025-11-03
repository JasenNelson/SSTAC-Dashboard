// src/components/dashboard/NewDiscussionForm.tsx
'use client';

import { useState } from 'react';
import { createClient } from '../supabase-client';
import { useToast } from '@/components/Toast';

interface NewDiscussionFormProps {
  onDiscussionCreated: () => void;
  onCancel: () => void;
}

export default function NewDiscussionForm({ onDiscussionCreated, onCancel }: NewDiscussionFormProps) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const supabase = createClient();
  const { showToast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!title.trim() || !content.trim()) {
      showToast({
        type: 'warning',
        title: 'Missing Information',
        message: 'Please fill in both title and content.',
        duration: 2000
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (!user) {
        showToast({
          type: 'error',
          title: 'Authentication Required',
          message: 'You must be logged in to create a discussion.',
          duration: 3000
        });
        return;
      }

      const { error } = await supabase
        .from('discussions')
        .insert({
          title: title.trim(),
          content: content.trim(),
          user_id: user.id,
          user_email: user.email
        });

      if (error) {
        console.error('❌ Database error:', error);
        showToast({
          type: 'error',
          title: 'Creation Failed',
          message: `Failed to create discussion: ${error.message}`,
          duration: 3000
        });
      } else {
        showToast({
          type: 'success',
          title: 'Discussion Created!',
          message: 'Your discussion has been posted successfully.',
          duration: 2000
        });
        setTitle('');
        setContent('');
        onDiscussionCreated();
      }
    } catch (error) {
      console.error('❌ Exception creating discussion:', error);
      showToast({
        type: 'error',
        title: 'Creation Failed',
        message: 'Failed to create discussion. Please try again.',
        duration: 3000
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h3 className="text-lg font-medium text-gray-900 mb-4">Start New Discussion</h3>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
            Discussion Title
          </label>
          <input
            type="text"
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            placeholder="Enter a descriptive title for your discussion"
            required
          />
        </div>

        <div>
          <label htmlFor="content" className="block text-sm font-medium text-gray-700 mb-1">
            Discussion Content
          </label>
          <textarea
            id="content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={6}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            placeholder="Share your thoughts, questions, or ideas..."
            required
          />
        </div>

        <div className="flex justify-end space-x-3">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 transition-colors disabled:opacity-50"
          >
            {isSubmitting ? 'Creating...' : 'Create Discussion'}
          </button>
        </div>
      </form>
    </div>
  );
}
