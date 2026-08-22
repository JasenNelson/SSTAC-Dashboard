// src/components/dashboard/NewDiscussionForm.tsx
'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
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
      const { data: { user } } = await supabase.auth.getUser();

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
        console.error('[NewDiscussionForm] Database error:', error);
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
      console.error('[NewDiscussionForm] Exception creating discussion:', error);
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
    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 p-6 sm:p-8">
      <h3 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white mb-4">Start New Discussion</h3>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label htmlFor="title" className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-2">
            Discussion Title
          </label>
          <input
            type="text"
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full px-4 py-3 border border-slate-300 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm min-h-[44px]"
            placeholder="Enter a descriptive title for your discussion"
            required
          />
        </div>

        <div>
          <label htmlFor="content" className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-2">
            Discussion Content
          </label>
          <textarea
            id="content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={6}
            className="w-full px-4 py-3 border border-slate-300 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm"
            placeholder="Share your thoughts, technical questions, or modeling ideas..."
            required
          />
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onCancel}
            className="min-h-[44px] px-5 py-2.5 text-xs font-bold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="min-h-[44px] px-6 py-2.5 text-xs font-bold text-white bg-sky-700 hover:bg-sky-800 dark:bg-sky-600 dark:hover:bg-sky-500 rounded-xl transition-all disabled:opacity-50 shadow-sm"
          >
            {isSubmitting ? 'Creating...' : 'Create Discussion'}
          </button>
        </div>
      </form>
    </div>
  );
}
