// src/components/dashboard/NewDocumentForm.tsx
'use client';

import { useState, useEffect } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { addDocument } from '@/app/(dashboard)/twg/documents/actions';
import { useToast } from '@/components/Toast';
import TagSelector from './TagSelector';

// A separate component for the submit button to use the `useFormStatus` hook.
function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full px-4 py-2 font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:bg-indigo-300 disabled:cursor-not-allowed transition-colors"
    >
      {pending ? 'Saving Document...' : 'Save Document'}
    </button>
  );
}

export default function NewDocumentForm() {
  const [selectedTags, setSelectedTags] = useState<number[]>([]);
  const [state, formAction] = useFormState(addDocument as any, { error: null });
  const { showToast } = useToast();

  // Show success toast when document is created successfully
  useEffect(() => {
    if (state && !state.error && Object.keys(state).length > 0) {
      showToast({
        type: 'success',
        title: 'Document Created!',
        message: 'Your document has been saved successfully.',
        duration: 2000
      });
    }
  }, [state, showToast]);


  return (
    // The `action` prop points to our Server Action
    <form action={formAction} className="space-y-6">
      {state?.error && (
        <div className="rounded-md bg-red-50 p-4">
          <p className="text-sm text-red-700">{state.error}</p>
        </div>
      )}
      <div>
        <label htmlFor="title" className="block text-sm font-medium text-gray-700">
          Title
        </label>
        <input
          type="text"
          id="title"
          name="title" // The 'name' attribute is crucial for FormData
          required
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
          required
          placeholder="https://..."
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
          placeholder="Add context or notes about this document..."
          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
        />
      </div>

      <TagSelector
        selectedTags={selectedTags}
        onTagsChange={setSelectedTags}
      />

      <SubmitButton />
    </form>
  );
}
