'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { createClient } from '../supabase-client';
import TagFilter from './TagFilter';

type Document = {
  id: number;
  title: string | null;
  created_at: string;
  tags?: Array<{ id: number; name: string; color: string }>;
};

type DocumentsListProps = {
  initialDocuments: Document[];
};

export default function DocumentsList({ initialDocuments }: DocumentsListProps) {
  const [documents] = useState<Document[]>(initialDocuments);
  const [filteredDocuments, setFilteredDocuments] = useState<Document[]>(initialDocuments);
  const [selectedTags, setSelectedTags] = useState<number[]>([]);
  // const [isLoading, setIsLoading] = useState(false);
  // const supabase = createClient(); // Reserved for future use

  // Filter documents based on selected tags
  useEffect(() => {
    if (selectedTags.length === 0) {
      setFilteredDocuments(documents);
    } else {
      const filtered = documents.filter(doc => 
        doc.tags && doc.tags.some(tag => selectedTags.includes(tag.id))
      );
      setFilteredDocuments(filtered);
    }
  }, [selectedTags, documents]);

  // Refresh documents when tags change
  const handleTagsChange = (tagIds: number[]) => {
    setSelectedTags(tagIds);
  };

  return (
    <div className="space-y-6">
      {/* Tag Filter */}
      <div className="bg-white p-4 rounded-lg shadow-sm border">
        <TagFilter
          selectedTags={selectedTags}
          onTagsChange={handleTagsChange}
          showLabel={true}
        />
      </div>

      {/* Documents List */}
      <div className="bg-white rounded-lg shadow-md">
        <ul className="divide-y divide-gray-200">
          {filteredDocuments && filteredDocuments.length > 0 ? (
            filteredDocuments.map((doc: Document) => (
              <li key={doc.id}>
                <Link
                  href={`/twg/documents/${doc.id}`}
                  className="block px-6 py-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex justify-between items-center">
                    <div className="flex-1 min-w-0">
                      <p className="text-md font-medium text-indigo-700 truncate">
                        {doc.title || 'Untitled Document'}
                      </p>
                      {doc.tags && doc.tags.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {doc.tags.map((tag, index) => (
                            <span
                              key={index}
                              className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium text-white"
                              style={{ backgroundColor: tag.color }}
                            >
                              {tag.name}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <p className="text-sm text-gray-500 ml-4 flex-shrink-0">
                      {new Date(doc.created_at).toISOString().split('T')[0]}
                    </p>
                  </div>
                </Link>
              </li>
            ))
          ) : (
            <li className="px-6 py-4">
              <p className="text-md text-gray-500">
                {selectedTags.length > 0 
                  ? 'No documents found with the selected tags.' 
                  : 'No documents found.'
                }
              </p>
            </li>
          )}
        </ul>
      </div>

      {/* Results Summary */}
      {selectedTags.length > 0 && (
        <div className="text-sm text-gray-600 text-center">
          Showing {filteredDocuments.length} of {documents.length} documents
        </div>
      )}
    </div>
  );
}
