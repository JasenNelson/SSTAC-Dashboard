// src/components/dashboard/NewDocumentForm.tsx
'use client';

import { useState, useEffect } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { addDocument } from '@/app/(dashboard)/twg/documents/actions';
import { useToast } from '@/components/Toast';
import TagSelector from './TagSelector';

type AddDocumentState = { error?: string | null };

// A separate component for the submit button to use the `useFormStatus` hook.
function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full px-4 py-2 font-medium text-white bg-sky-700 rounded-md hover:bg-sky-800 disabled:bg-sky-300 disabled:cursor-not-allowed transition-colors"
    >
      {pending ? 'Saving Document...' : 'Save Document'}
    </button>
  );
}

export default function NewDocumentForm() {
  const [selectedTags, setSelectedTags] = useState<number[]>([]);
  const [state, formAction] = useFormState<AddDocumentState, FormData>(addDocument, { error: null });
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
        <label htmlFor="title" className="block text-sm font-medium text-slate-600">
          Title
        </label>
        <input
          type="text"
          id="title"
          name="title" // The 'name' attribute is crucial for FormData
          required
          className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm placeholder-slate-400 focus:outline-none focus:ring-sky-500 focus:border-sky-500"
        />
      </div>

      <div>
        <label htmlFor="file_url" className="block text-sm font-medium text-slate-600">
          File URL
        </label>
        <input
          type="url"
          id="file_url"
          name="file_url"
          required
          placeholder="https://..."
          className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm placeholder-slate-400 focus:outline-none focus:ring-sky-500 focus:border-sky-500"
        />
      </div>

      <div>
        <label htmlFor="description" className="block text-sm font-medium text-slate-600">
          Description (optional)
        </label>
        <textarea
          id="description"
          name="description"
          rows={6}
          placeholder="Add context or notes about this document..."
          className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm placeholder-slate-400 focus:outline-none focus:ring-sky-500 focus:border-sky-500"
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
