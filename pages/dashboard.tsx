import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { createClient } from '@supabase/supabase-js';
import { Session } from '@supabase/supabase-js';

// Initialize the Supabase client
// IMPORTANT: Replace with your actual Supabase URL and Anon Key from your .env.local file
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Final version - 11:00 AM PST
// Define a type for our document data for better type safety
type Document = {
  id: number;
  title: string | null;
};

export default function Dashboard() {
  const [session, setSession] = useState<Session | null>(null);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    // 1. Check for an active user session
    const fetchSessionAndData = async () => {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();

      if (sessionError) {
        console.error('Error fetching session:', sessionError);
        setLoading(false);
        return;
      }

      if (!session) {
        // If no user is logged in, redirect to the login page
        router.push('/login');
      } else {
        setSession(session);
        
        // 2. If a session exists, fetch the recent documents
        const { data, error } = await supabase
          .from('documents')
          .select('id, title')
          .order('created_at', { ascending: false })
          .limit(5);

        if (error) {
          console.error('Error fetching documents:', error.message);
        } else {
          setDocuments(data || []);
        }
        setLoading(false);
      }
    };

    fetchSessionAndData();
  }, [router]); // Dependency array ensures this runs only when the router object is available

  // Display a loading state while checking session and fetching data
  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <p>Loading...</p>
      </div>
    );
  }
  
  // Render the dashboard only if a session is confirmed
  if (!session) {
    // This return is a fallback, as the redirect should have already happened
    return null; 
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        
        {/* Welcome Message */}
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            Welcome, {session.user.email}!
          </h1>
          <p className="mt-1 text-lg text-gray-600">Your central hub for all project tools and documents.</p>
        </header>
        
        {/* Quick Links Grid */}
        <section className="mb-10">
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {/* Card 1: Review TWG Documents */}
            <Link href="/twg/documents" className="group block rounded-lg bg-white p-6 shadow-md hover:shadow-lg transition-shadow duration-300 ease-in-out transform hover:-translate-y-1">
              <h3 className="text-xl font-semibold text-gray-800 group-hover:text-indigo-600">📄 Review TWG Documents</h3>
              <p className="mt-2 text-gray-500">Access and review all technical working group documents.</p>
            </Link>

            {/* Card 2: TWG Discussion Forum */}
            <Link href="/twg/discussion" className="group block rounded-lg bg-white p-6 shadow-md hover:shadow-lg transition-shadow duration-300 ease-in-out transform hover:-translate-y-1">
              <h3 className="text-xl font-semibold text-gray-800 group-hover:text-indigo-600">💬 TWG Discussion Forum</h3>
              <p className="mt-2 text-gray-500">Engage in discussions and collaborate with team members.</p>
            </Link>

            {/* Card 3: SSD Generator Tool */}
            <Link href="/tools/ssd-generator" className="group block rounded-lg bg-white p-6 shadow-md hover:shadow-lg transition-shadow duration-300 ease-in-out transform hover:-translate-y-1">
              <h3 className="text-xl font-semibold text-gray-800 group-hover:text-indigo-600">⚙️ SSD Generator Tool</h3>
              <p className="mt-2 text-gray-500">Generate System Security Documents quickly and efficiently.</p>
            </Link>
          </div>
        </section>
        
        {/* Recent Documents List */}
        <section>
          <h2 className="text-2xl font-semibold text-gray-800 mb-4">Recent Documents</h2>
          <div className="bg-white rounded-lg shadow-md">
            <ul className="divide-y divide-gray-200">
              {documents.length > 0 ? (
                documents.map((doc) => (
                  <li key={doc.id} className="px-6 py-4 hover:bg-gray-50">
                    <p className="text-md font-medium text-indigo-700">{doc.title}</p>
                  </li>
                ))
              ) : (
                <li className="px-6 py-4">
                  <p className="text-md text-gray-500">No recent documents found.</p>
                </li>
              )}
            </ul>
          </div>
        </section>
        
      </div>
    </div>
  );
}
