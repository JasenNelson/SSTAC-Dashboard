'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';

type Tag = {
  id: number;
  name: string;
  color: string;
};

type TagSelectorProps = {
  selectedTags: number[];
  onTagsChange: (tagIds: number[]) => void;
  className?: string;
};

export default function TagSelector({ selectedTags, onTagsChange, className = '' }: TagSelectorProps) {
  const [tags, setTags] = useState<Tag[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();

  useEffect(() => {
    async function fetchTags() {
      try {
        const { data, error } = await supabase
          .from('tags')
          .select('id, name, color')
          .order('name');

        if (error) {
          console.error('Supabase error:', error);
          throw error;
        }

        setTags(data || []);
      } catch (err) {
        console.error('Error fetching tags:', err);
        setError('Failed to load tags. Please try again later.');
      } finally {
        setIsLoading(false);
      }
    }

    fetchTags();
  }, [supabase]);

  const handleTagToggle = (tagId: number) => {
    const newSelectedTags = selectedTags.includes(tagId)
      ? selectedTags.filter(id => id !== tagId)
      : [...selectedTags, tagId];
    
    onTagsChange(newSelectedTags);
  };

  const getSelectedTagNames = () => {
    return tags
      .filter(tag => selectedTags.includes(tag.id))
      .map(tag => tag.name);
  };

  if (isLoading) {
    return (
      <div className={`animate-pulse ${className}`}>
        <div className="h-4 bg-gray-200 rounded w-24 mb-2"></div>
        <div className="space-y-2">
          <div className="h-8 bg-gray-200 rounded"></div>
          <div className="h-8 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`text-red-600 text-sm ${className}`}>
        {error}
      </div>
    );
  }

  return (
    <div className={className}>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        Tags
      </label>
      
      {/* Selected tags display */}
      {selectedTags.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-2">
          {getSelectedTagNames().map((tagName, index) => {
            const tag = tags.find(t => t.name === tagName);
            return (
              <span
                key={index}
                className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium text-white"
                style={{ backgroundColor: tag?.color || '#6B7280' }}
              >
                {tagName}
                <button
                  type="button"
                  onClick={() => handleTagToggle(tag?.id || 0)}
                  className="ml-1.5 inline-flex items-center justify-center w-4 h-4 rounded-full text-white hover:bg-black hover:bg-opacity-20 transition-colors"
                >
                  ×
                </button>
              </span>
            );
          })}
        </div>
      )}

      {/* Available tags */}
      <div className="space-y-2">
        {tags.map((tag) => (
          <label
            key={tag.id}
            className="flex items-center space-x-3 cursor-pointer hover:bg-gray-50 p-2 rounded-md transition-colors"
          >
            <input
              type="checkbox"
              checked={selectedTags.includes(tag.id)}
              onChange={() => handleTagToggle(tag.id)}
              className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
            />
            <span
              className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium text-white"
              style={{ backgroundColor: tag.color }}
            >
              {tag.name}
            </span>
          </label>
        ))}
      </div>

      {tags.length === 0 && (
        <p className="text-sm text-gray-500 italic">
          No tags available. Contact an administrator to create tags.
        </p>
      )}
    </div>
  );
}
