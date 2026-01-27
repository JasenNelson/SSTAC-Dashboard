// src/app/(dashboard)/twg/discussions/page.tsx
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Session } from '@supabase/supabase-js';
import Link from 'next/link';
import NewDiscussionForm from '@/components/dashboard/NewDiscussionForm';

type DiscussionSummary = {
  id: number;
  title: string;
  author: string;
  created_at: string;
  updated_at: string;
  reply_count: number;
  last_reply_at: string | null;
};

// Raw discussion data from Supabase before transformation
type RawDiscussion = {
  id: number;
  title: string;
  user_email?: string;
  created_at: string;
  updated_at: string;
};

export default function TwgDiscussionsPage() {
  const [discussions, setDiscussions] = useState<DiscussionSummary[]>([]);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showNewForm, setShowNewForm] = useState(false);
  const supabase = useRef(createClient()).current;
  const fetchDiscussionsRef = useRef<() => Promise<void>>(() => Promise.resolve());

  const fetchDiscussions = useCallback(async () => {
    try {
      // First, let's test if the table exists with a simple count query
      const { count: _count, error: countError } = await supabase
        .from('discussions')
        .select('*', { count: 'exact', head: true });
      
      if (countError) {
        console.error('❌ Table test failed:', countError);
        setDiscussions([]);
        return;
      }
      
      // Add a timeout to prevent hanging
      const queryPromise = supabase
        .from('discussions')
        .select('*')
        .order('created_at', { ascending: false });
      
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Database query timeout')), 5000)
      );
      
      const result = await Promise.race([queryPromise, timeoutPromise]) as { error?: { message: string }; data?: RawDiscussion[] };

      if (result.error) {
        console.error('❌ Error fetching discussions:', result.error);
        setDiscussions([]);
        return;
      }

      if (!result.data || result.data.length === 0) {
        setDiscussions([]);
        return;
      }

      // Process discussions and get reply stats
      const discussionsWithStats = await Promise.all(
        result.data.map(async (discussion: RawDiscussion) => {
          // Get reply count and last reply for this discussion
          const { count: replyCount } = await supabase
            .from('discussion_replies')
            .select('*', { count: 'exact', head: true })
            .eq('discussion_id', discussion.id);

          const { data: lastReply } = await supabase
            .from('discussion_replies')
            .select('created_at')
            .eq('discussion_id', discussion.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

          return {
            id: discussion.id,
            title: discussion.title,
            author: discussion.user_email || 'Unknown User',
            created_at: discussion.created_at,
            updated_at: discussion.updated_at,
            reply_count: replyCount || 0,
            last_reply_at: lastReply?.created_at || null
          };
        })
      );

      setDiscussions(discussionsWithStats);
    } catch (error) {
      console.error('❌ Exception fetching discussions:', error);
      setDiscussions([]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // No dependencies since supabase is now stable

  // Store the function in a ref to avoid dependency issues
  fetchDiscussionsRef.current = fetchDiscussions;

  useEffect(() => {
    try {
      const initializePage = async () => {
      try {
        // First, check if we already have a session
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        
        if (currentSession) {
          setSession(currentSession);
          if (fetchDiscussionsRef.current) {
            await fetchDiscussionsRef.current();
          }
        } else {
          // Still set loading to false even if no session
          setIsLoading(false);
        }
      } catch (error) {
        console.error('❌ Initial session check error:', error);
        setIsLoading(false);
      }
    };

    // Set a reasonable timeout for initial load
    const timeoutId = setTimeout(() => {
      setIsLoading(false);
    }, 5000);

    initializePage();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session) {
        setSession(session);
        try {
          if (fetchDiscussionsRef.current) {
            await fetchDiscussionsRef.current();
          }
        } catch (error) {
          console.error('❌ Auth state change discussions fetch error:', error);
        }
      } else {
        setSession(null);
      }
    });

      return () => {
        clearTimeout(timeoutId);
        subscription.unsubscribe();
      };
    } catch (error) {
      console.error('❌ useEffect error:', error);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Remove fetchDiscussions dependency to prevent infinite loops

  const handleDiscussionCreated = useCallback(() => {
    setShowNewForm(false);
    fetchDiscussions();
  }, [fetchDiscussions]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);
    
    if (diffInHours < 24) {
      if (diffInHours < 1) {
        const diffInMinutes = Math.floor(diffInHours * 60);
        return `${diffInMinutes}m ago`;
      }
      return `${Math.floor(diffInHours)}h ago`;
    } else if (diffInHours < 168) { // 7 days
      return `${Math.floor(diffInHours / 24)}d ago`;
    } else {
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
    }
  };

  const getActivityIndicator = (discussion: DiscussionSummary) => {
    const lastActivity = discussion.last_reply_at || discussion.updated_at;
    const lastActivityDate = new Date(lastActivity);
    const now = new Date();
    const diffInHours = (now.getTime() - lastActivityDate.getTime()) / (1000 * 60 * 60);
    
    if (diffInHours < 1) return 'bg-green-500';
    if (diffInHours < 24) return 'bg-yellow-500';
    if (diffInHours < 168) return 'bg-orange-500';
    return 'bg-gray-400';
  };

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading discussions...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center">
          <p className="text-gray-600">Please log in to view discussions.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <header className="mb-8">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">TWG Discussion Forum</h1>
        <p className="text-xl text-gray-600 max-w-3xl">
          Engage with other TWG members in discussions about technical topics and projects. 
          Browse discussions by title and click to read full threads.
        </p>
      </header>

      {/* New Discussion Button */}
      <div className="mb-8">
        {!showNewForm ? (
          <button
            onClick={() => setShowNewForm(true)}
            className="inline-flex items-center px-6 py-3 text-base font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors shadow-sm hover:shadow-md"
          >
            <span className="mr-2">💬</span>
            Start New Discussion
          </button>
        ) : (
          <NewDiscussionForm 
            onDiscussionCreated={handleDiscussionCreated}
            onCancel={() => setShowNewForm(false)}
          />
        )}
      </div>

      {/* Discussions List */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
          <h2 className="text-lg font-medium text-gray-700">
            All Discussions ({discussions.length})
          </h2>
        </div>
        
        {discussions.length > 0 ? (
          <div className="divide-y divide-gray-200">
            {discussions.map((discussion) => (
              <Link
                key={discussion.id}
                href={`/twg/discussions/${discussion.id}`}
                className="block p-6 hover:bg-gray-50 transition-colors duration-150"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-3 mb-2">
                      <h3 className="text-lg font-semibold text-gray-900 hover:text-indigo-600 transition-colors truncate">
                        {discussion.title}
                      </h3>
                      {discussion.updated_at !== discussion.created_at && (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          Edited
                        </span>
                      )}
                    </div>

                    <div className="flex items-center text-sm text-gray-500 space-x-4 mb-3">
                      <span className="flex items-center">
                        <span className="mr-1">👤</span>
                        {discussion.author}
                      </span>
                      <span className="flex items-center">
                        <span className="mr-1">📅</span>
                        {formatDate(discussion.created_at)}
                      </span>
                      <span className="flex items-center">
                        <span className="mr-1">💬</span>
                        {discussion.reply_count} {discussion.reply_count === 1 ? 'reply' : 'replies'}
                      </span>
                    </div>
                    
                    {discussion.last_reply_at && (
                      <div className="flex items-center text-sm text-gray-500">
                        <span className="mr-1">🔄</span>
                        Last activity: {formatDate(discussion.last_reply_at)}
                      </div>
                    )}
                  </div>
                  
                  <div className="flex items-center space-x-3 ml-4">
                    {/* Activity indicator */}
                    <div className={`w-3 h-3 rounded-full ${getActivityIndicator(discussion)}`} 
                         title={discussion.last_reply_at ? 'Recent activity' : 'No recent activity'} />
                    
                    {/* Reply count badge */}
                    <div className="flex items-center px-3 py-1 bg-gray-100 rounded-full text-sm font-medium text-gray-700">
                      <span className="mr-1">💬</span>
                      {discussion.reply_count}
                    </div>
                    
                    {/* Arrow indicator */}
                    <div className="text-gray-400 group-hover:text-indigo-500 transition-colors">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="text-center py-16">
            <div className="text-gray-400 text-6xl mb-4">💬</div>
            <p className="text-gray-500 text-lg mb-2">No discussions yet.</p>
            <p className="text-gray-400 text-sm">Be the first to start a discussion!</p>
          </div>
        )}
      </div>
    </div>
  );
}
