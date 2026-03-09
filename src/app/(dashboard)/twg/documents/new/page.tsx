// src/app/(dashboard)/twg/documents/new/page.tsx
import Link from 'next/link';
import NewDocumentForm from '@/components/dashboard/NewDocumentForm';

export default function NewDocumentPage() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 p-4 sm:p-6 lg:p-8">
      <div className="max-w-2xl mx-auto">

        <div className="mb-8">
          <Link
            href="/twg/documents"
            className="text-sky-700 dark:text-sky-400 hover:text-sky-800 dark:hover:text-sky-300 transition-colors"
          >
            &larr; Back to all documents
          </Link>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-md p-6 md:p-8">
          <header className="mb-6">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
              Create a New Document
            </h1>
          </header>
          <NewDocumentForm />
        </div>
        
      </div>
    </div>
  );
}