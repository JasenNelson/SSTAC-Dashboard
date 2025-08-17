'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';

type Tag = {
  id: number;
  name: string;
  color: string;
};

type TagFilterProps = {
  selectedTags: number[];
  onTagsChange: (tagIds: number[]) => void;
  className?: string;
  showLabel?: boolean;
};

export default function TagFilter({ 
  selectedTags, 
  onTagsChange, 
  className = '',
  showLabel = true 
}: TagFilterProps) {
  const [tags, setTags] = useState<Tag[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
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

  const clearAllFilters = () => {
    onTagsChange([]);
  };

  const getSelectedTagNames = () => {
    return tags
      .filter(tag => selectedTags.includes(tag.id))
      .map(tag => tag.name);
  };

  if (isLoading) {
    return (
      <div className={`animate-pulse ${className}`}>
        <div className="h-4 bg-gray-200 rounded w-20"></div>
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
      {showLabel && (
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Filter by Tags
        </label>
      )}
      
      {/* Filter toggle button */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center justify-between w-full px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
      >
        <span>
          {selectedTags.length === 0 
            ? 'All tags' 
            : `${selectedTags.length} tag${selectedTags.length === 1 ? '' : 's'} selected`
          }
        </span>
        <svg
          className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Selected tags display */}
      {selectedTags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
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
          <button
            type="button"
            onClick={clearAllFilters}
            className="text-xs text-gray-500 hover:text-gray-700 underline"
          >
            Clear all
          </button>
        </div>
      )}

      {/* Available tags dropdown */}
      {isExpanded && (
        <div className="mt-2 p-3 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
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
            <p className="text-sm text-gray-500 italic text-center py-2">
              No tags available
            </p>
          )}
        </div>
      )}
    </div>
  );
}
