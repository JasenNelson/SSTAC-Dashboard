// src/app/(dashboard)/twg/documents/page.tsx
import Link from 'next/link';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import DocumentsList from '@/components/dashboard/DocumentsList';

type Document = {
  id: number;
  title: string | null;
  created_at: string;
  tags?: Array<{ id: number; name: string; color: string }>;
};

export default async function TwgDocumentsPage() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          try { cookieStore.set({ name, value, ...options }); } catch (error) {}
        },
        remove(name: string, options: CookieOptions) {
          try { cookieStore.set({ name, value: '', ...options }); } catch (error) {}
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const { data: documents, error } = await supabase
    .from('documents')
    .select(`
      id, 
      title, 
      created_at,
      document_tags(
        tags(
          id,
          name,
          color
        )
      )
    `)
    .order('created_at', { ascending: false });

  // Transform the data to flatten the tags structure
  const transformedDocuments = documents?.map(doc => ({
    id: doc.id,
    title: doc.title,
    created_at: doc.created_at,
    tags: doc.document_tags?.map((dt: unknown) => dt.tags).filter(Boolean) || []
  })) || [];

  if (error) {
    console.error('Error fetching documents:', error.message);
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        <header className="mb-8 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">TWG Documents</h1>
            <p className="mt-1 text-lg text-gray-600">
              Browse and review all technical working group documents.
            </p>
          </div>
          <div className="flex space-x-3">
            <Link 
              href="/twg/discussions" 
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
            >
              Discussion Forum
            </Link>
            <Link 
              href="/twg/documents/new" 
              className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 transition-colors"
            >
              Create New Document
            </Link>
          </div>
        </header>

        <DocumentsList initialDocuments={transformedDocuments} />
      </div>
    </div>
  );
}
