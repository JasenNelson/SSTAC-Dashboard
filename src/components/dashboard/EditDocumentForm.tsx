'use client';

import { useState, useEffect, useActionState } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/Toast';
import TagSelector from './TagSelector';
import { editDocument } from '@/app/(dashboard)/twg/documents/edit-actions';

type EditDocumentFormProps = {
  document: {
    id: number;
    title: string | null;
    file_url: string | null;
    description: string | null;
    tags?: Array<{ id: number; name: string; color: string }>;
  };
};

export default function EditDocumentForm({ document }: EditDocumentFormProps) {
  const [error, setError] = useState<string | null>(null);
  const [selectedTags, setSelectedTags] = useState<number[]>([]);
  const router = useRouter();
  const { showToast } = useToast();

  // Initialize selected tags from document data
  useEffect(() => {
    if (document.tags) {
      setSelectedTags(document.tags.map(tag => tag.id));
    }
  }, [document.tags]);

  const [state, formAction] = useActionState(editDocument, {});

  // Debug: Log the document being edited
  useEffect(() => {
    console.log('🔍 Debug - Editing document:', document);
  }, [document]);

  // Handle form submission result
  useEffect(() => {
    if (state.success) {
      showToast({
        type: 'success',
        title: 'Document Updated!',
        message: state.success,
        duration: 2000
      });
      router.push(`/twg/documents/${document.id}`);
      router.refresh();
    } else if (state.error) {
      setError(state.error);
      showToast({
        type: 'error',
        title: 'Update Failed',
        message: state.error,
        duration: 6000
      });
    }
  }, [state, showToast, router, document.id]);

  // Submit button component for forms
  function SubmitButton({ children }: { children: React.ReactNode }) {
    return (
      <button
        type="submit"
        className="w-full px-4 py-2 font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 transition-colors"
      >
        {children}
      </button>
    );
  }



  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="id" value={String(document.id)} />
      
      {/* Hidden inputs for tags */}
      {selectedTags.map(tagId => (
        <input key={tagId} type="hidden" name="tags" value={tagId} />
      ))}

      {error && (
        <div className="mb-4 rounded-md bg-red-50 p-4">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      <div>
        <label htmlFor="title" className="block text-sm font-medium text-gray-700">
          Title
        </label>
        <input
          type="text"
          id="title"
          name="title"
          defaultValue={document.title ?? ''}
          required
          autoComplete="off"
          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
        />
      </div>

      <div>
        <label htmlFor="file_url" className="block text-sm font-medium text-gray-700">
          File URL
        </label>
        <input
          type="url"
          id="file_url"
          name="file_url"
          defaultValue={document.file_url ?? ''}
          required
          placeholder="https://..."
          autoComplete="url"
          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
        />
      </div>

      <div>
        <label htmlFor="description" className="block text-sm font-medium text-gray-700">
          Description (optional)
        </label>
        <textarea
          id="description"
          name="description"
          rows={6}
          defaultValue={document.description ?? ''}
          placeholder="Add context or notes about this document..."
          autoComplete="off"
          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:border-indigo-500"
        />
      </div>

      <TagSelector
        selectedTags={selectedTags}
        onTagsChange={setSelectedTags}
      />

      <SubmitButton>Save Changes</SubmitButton>
    </form>
  );
}