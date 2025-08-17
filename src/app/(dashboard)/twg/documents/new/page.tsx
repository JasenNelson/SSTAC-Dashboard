// src/app/(dashboard)/twg/documents/new/page.tsx
import Link from 'next/link';
import NewDocumentForm from '@/components/dashboard/NewDocumentForm';

export default function NewDocumentPage() {
  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6 lg:p-8">
      <div className="max-w-2xl mx-auto">

        <div className="mb-8">
          <Link 
            href="/twg/documents" 
            className="text-indigo-600 hover:text-indigo-800 transition-colors"
          >
            &larr; Back to all documents
          </Link>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6 md:p-8">
          <header className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900">
              Create a New Document
            </h1>
          </header>
          <NewDocumentForm />
        </div>
        
      </div>
    </div>
  );
}