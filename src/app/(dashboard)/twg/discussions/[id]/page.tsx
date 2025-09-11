// src/app/(dashboard)/twg/discussions/[id]/page.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useToast } from '@/components/Toast';
import LikeButton from '@/components/dashboard/LikeButton';
import Link from 'next/link';

type Discussion = {
  id: number;
  title: string;
  content: string;
  user_email: string;
  created_at: string;
  updated_at: string;
};

type Reply = {
  id: number;
  content: string;
  user_email: string;
  created_at: string;
  updated_at?: string;
  discussion_id: number;
};

const REPLIES_PER_PAGE = 25;

export default function DiscussionThreadPage() {
  const params = useParams();
  const router = useRouter();
  const discussionId = parseInt(params.id as string);
  
  const [discussion, setDiscussion] = useState<Discussion | null>(null);
  const [replies, setReplies] = useState<Reply[]>([]);
  const [newReply, setNewReply] = useState('');
  const [showReplyForm, setShowReplyForm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalReplies, setTotalReplies] = useState(0);
  
  // Edit states
  const [editingDiscussion, setEditingDiscussion] = useState(false);
  const [editDiscussionTitle, setEditDiscussionTitle] = useState('');
  const [editDiscussionContent, setEditDiscussionContent] = useState('');
  const [editingReply, setEditingReply] = useState<number | null>(null);
  const [editReplyContent, setEditReplyContent] = useState('');
  
  // Like states
  const [discussionLikes, setDiscussionLikes] = useState(0);
  const [isDiscussionLiked, setIsDiscussionLiked] = useState(false);
  const [replyLikes, setReplyLikes] = useState<{ [key: number]: number }>({});
  const [isReplyLiked, setIsReplyLiked] = useState<{ [key: number]: boolean }>({});
  
  // Delete confirmation states
  const [showDeleteDiscussionConfirm, setShowDeleteDiscussionConfirm] = useState(false);
  const [showDeleteReplyConfirm, setShowDeleteReplyConfirm] = useState<number | null>(null);
  
  // Collapsible replies state
  const [collapsedReplies, setCollapsedReplies] = useState<Set<number>>(new Set());
  
  const { showToast } = useToast();
  const supabase = createClient();

  useEffect(() => {
    if (discussionId) {
      fetchDiscussion();
      fetchReplies();
      getCurrentUser();
    }
  }, [discussionId, currentPage]);

  const getCurrentUser = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setCurrentUser(user);
        checkAdminStatus(user.id);
      }
    } catch (error) {
      console.error('Error getting current user:', error);
    }
  };

  const checkAdminStatus = async (userId: string) => {
    try {
      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .eq('role', 'admin')
        .single();
      
      setIsAdmin(!!roleData);
    } catch (error) {
      console.error('Error checking admin status:', error);
    }
  };

  const fetchDiscussion = async () => {
    try {
      const { data, error } = await supabase
        .from('discussions')
        .select('*')
        .eq('id', discussionId)
        .single();

      if (error) {
        console.error('Error fetching discussion:', error);
        showToast({
          type: 'error',
          title: 'Error',
          message: 'Failed to load discussion.',
          duration: 3000
        });
        return;
      }

      setDiscussion(data);
      setEditDiscussionTitle(data.title);
      setEditDiscussionContent(data.content);
    } catch (error) {
      console.error('Error fetching discussion:', error);
    }
  };

  const fetchReplies = async () => {
    try {
      // Get total count first
      const { count } = await supabase
        .from('discussion_replies')
        .select('*', { count: 'exact', head: true })
        .eq('discussion_id', discussionId);

      setTotalReplies(count || 0);

      // Get paginated replies
      const { data, error } = await supabase
        .from('discussion_replies')
        .select('*')
        .eq('discussion_id', discussionId)
        .order('created_at', { ascending: true })
        .range((currentPage - 1) * REPLIES_PER_PAGE, currentPage * REPLIES_PER_PAGE - 1);

      if (error) {
        console.error('Error fetching replies:', error);
      } else {
        setReplies(data || []);
        // Refresh likes after replies are loaded
        if (currentUser) {
          setTimeout(() => {
            fetchLikeCounts();
          }, 100);
        }
      }
    } catch (error) {
      console.error('Error fetching replies:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchLikeCounts = useCallback(async () => {
    try {
      // Fetch discussion likes
      const { data: discussionLikesData } = await supabase
        .from('likes')
        .select('*')
        .eq('discussion_id', discussionId);

      if (discussionLikesData) {
        setDiscussionLikes(discussionLikesData.length);
        
        if (currentUser) {
          const userLiked = discussionLikesData.some(like => like.user_id === currentUser.id);
          setIsDiscussionLiked(userLiked);
        }
      }

      // Fetch reply likes
      if (replies.length > 0) {
        const { data: replyLikesData } = await supabase
          .from('likes')
          .select('*')
          .in('reply_id', replies.map(reply => reply.id));

        if (replyLikesData) {
          const replyLikesMap: { [key: number]: number } = {};
          const isReplyLikedMap: { [key: number]: boolean } = {};
          
          replies.forEach(reply => {
            const replyLikes = replyLikesData.filter(like => like.reply_id === reply.id);
            replyLikesMap[reply.id] = replyLikes.length;
            
            if (currentUser) {
              isReplyLikedMap[reply.id] = replyLikes.some(like => like.user_id === currentUser.id);
            }
          });
          
          setReplyLikes(replyLikesMap);
          setIsReplyLiked(isReplyLikedMap);
        }
      }
    } catch (error) {
      console.error('Error fetching like counts:', error);
    }
  }, [supabase, discussionId, replies, currentUser]);

  const handleSubmitReply = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newReply.trim()) {
      showToast({
        type: 'warning',
        title: 'Missing Reply',
        message: 'Please enter a reply.',
        duration: 4000
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        showToast({
          type: 'error',
          title: 'Authentication Required',
          message: 'You must be logged in to reply.',
          duration: 3000
        });
        return;
      }

      const { error } = await supabase
        .from('discussion_replies')
        .insert({
          content: newReply.trim(),
          user_id: user.id,
          user_email: user.email,
          discussion_id: discussionId
        });

      if (error) {
        showToast({
          type: 'error',
          title: 'Reply Failed',
          message: 'Failed to post reply. Please try again.',
          duration: 3000
        });
      } else {
        showToast({
          type: 'success',
          title: 'Reply Posted!',
          message: 'Your reply has been added successfully.',
          duration: 2000
        });
        setNewReply('');
        setShowReplyForm(false);
        
        // Reset to first page and refresh
        setCurrentPage(1);
        setTimeout(() => {
          fetchReplies();
        }, 500);
      }
    } catch (error) {
      console.error('Error creating reply:', error);
      showToast({
        type: 'error',
        title: 'Reply Failed',
        message: 'Failed to post reply. Please try again.',
        duration: 3000
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditDiscussion = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!editDiscussionTitle.trim() || !editDiscussionContent.trim()) {
      showToast({
        type: 'warning',
        title: 'Missing Information',
        message: 'Please fill in both title and content.',
        duration: 2000
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('discussions')
        .update({
          title: editDiscussionTitle.trim(),
          content: editDiscussionContent.trim(),
          updated_at: new Date().toISOString()
        })
        .eq('id', discussionId);

      if (error) {
        showToast({
          type: 'error',
          title: 'Update Failed',
          message: 'Failed to update discussion. Please try again.',
          duration: 3000
        });
      } else {
        showToast({
          type: 'success',
          title: 'Discussion Updated!',
          message: 'Your discussion has been updated successfully.',
          duration: 2000
        });
        setEditingDiscussion(false);
        fetchDiscussion();
      }
    } catch (error) {
      console.error('Error updating discussion:', error);
      showToast({
        type: 'error',
        title: 'Update Failed',
        message: 'Failed to update discussion. Please try again.',
        duration: 3000
      });
    }
  };

  const handleDeleteDiscussion = async () => {
    try {
      const { error } = await supabase
        .from('discussions')
        .delete()
        .eq('id', discussionId);

      if (error) {
        showToast({
          type: 'error',
          title: 'Delete Failed',
          message: 'Failed to delete discussion. Please try again.',
          duration: 3000
        });
      } else {
        showToast({
          type: 'success',
          title: 'Discussion Deleted!',
          message: 'The discussion has been removed successfully.',
          duration: 2000
        });
        router.push('/twg/discussions');
      }
    } catch (error) {
      console.error('Error deleting discussion:', error);
      showToast({
        type: 'error',
        title: 'Delete Failed',
        message: 'Failed to delete discussion. Please try again.',
        duration: 3000
      });
    } finally {
      setShowDeleteDiscussionConfirm(false);
    }
  };

  const handleEditReply = async (replyId: number) => {
    try {
      const { error } = await supabase
        .from('discussion_replies')
        .update({
          content: editReplyContent.trim(),
          updated_at: new Date().toISOString()
        })
        .eq('id', replyId);

      if (error) {
        showToast({
          type: 'error',
          title: 'Update Failed',
          message: 'Failed to update reply. Please try again.',
          duration: 3000
        });
      } else {
        showToast({
          type: 'success',
          title: 'Reply Updated!',
          message: 'Your reply has been updated successfully.',
          duration: 2000
        });
        setEditingReply(null);
        setEditReplyContent('');
        fetchReplies();
      }
    } catch (error) {
      console.error('Error updating reply:', error);
      showToast({
        type: 'error',
        title: 'Update Failed',
        message: 'Failed to update reply. Please try again.',
        duration: 3000
      });
    }
  };

  const handleDeleteReply = async (replyId: number) => {
    try {
      const { error } = await supabase
        .from('discussion_replies')
        .delete()
        .eq('id', replyId);

      if (error) {
        showToast({
          type: 'error',
          title: 'Delete Failed',
          message: 'Failed to delete reply. Please try again.',
          duration: 3000
        });
      } else {
        showToast({
          type: 'success',
          title: 'Reply Deleted!',
          message: 'The reply has been removed successfully.',
          duration: 2000
        });
        fetchReplies();
      }
    } catch (error) {
      console.error('Error deleting reply:', error);
      showToast({
        type: 'error',
        title: 'Delete Failed',
        message: 'Failed to delete reply. Please try again.',
        duration: 3000
      });
    } finally {
      setShowDeleteReplyConfirm(null);
    }
  };

  const toggleReplyCollapse = (replyId: number) => {
    setCollapsedReplies(prev => {
      const newSet = new Set(prev);
      if (newSet.has(replyId)) {
        newSet.delete(replyId);
      } else {
        newSet.add(replyId);
      }
      return newSet;
    });
  };

  const canEditDiscussion = currentUser && discussion && (currentUser.email === discussion.user_email || isAdmin);
  const canDeleteDiscussion = currentUser && discussion && (currentUser.email === discussion.user_email || isAdmin);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const totalPages = Math.ceil(totalReplies / REPLIES_PER_PAGE);

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading discussion...</p>
        </div>
      </div>
    );
  }

  if (!discussion) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center">
          <p className="text-gray-600">Discussion not found.</p>
          <Link href="/twg/discussions" className="text-indigo-600 hover:text-indigo-800">
            ← Back to Discussions
          </Link>
        </div>
      </div>
    );
  }

  if (editingDiscussion) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-xl shadow-md p-8">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold text-gray-900">Edit Discussion</h1>
            <Link 
              href={`/twg/discussions/${discussionId}`}
              className="text-indigo-600 hover:text-indigo-800"
            >
              ← Back to Discussion
            </Link>
          </div>
          
          <form onSubmit={handleEditDiscussion} className="space-y-6">
            <div>
              <label htmlFor="edit-title" className="block text-sm font-medium text-gray-700 mb-2">
                Discussion Title
              </label>
              <input
                type="text"
                id="edit-title"
                value={editDiscussionTitle}
                onChange={(e) => setEditDiscussionTitle(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                required
              />
            </div>

            <div>
              <label htmlFor="edit-content" className="block text-sm font-medium text-gray-700 mb-2">
                Discussion Content
              </label>
              <textarea
                id="edit-content"
                value={editDiscussionContent}
                onChange={(e) => setEditDiscussionContent(e.target.value)}
                rows={8}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                required
              />
            </div>

            <div className="flex justify-end space-x-4">
              <button
                type="button"
                onClick={() => setEditingDiscussion(false)}
                className="px-6 py-3 text-base font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-6 py-3 text-base font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors"
              >
                Update Discussion
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Back to Discussions Link */}
      <div className="mb-6">
        <Link 
          href="/twg/discussions"
          className="inline-flex items-center text-indigo-600 hover:text-indigo-800 transition-colors"
        >
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Discussions
        </Link>
      </div>

      {/* Discussion Header */}
      <div className="bg-white rounded-xl shadow-md p-8 mb-8">
        <div className="flex items-start justify-between mb-4">
          <h1 className="text-3xl font-bold text-gray-900">{discussion.title}</h1>
          <div className="flex items-center space-x-3">
            {canEditDiscussion && (
              <button
                onClick={() => setEditingDiscussion(true)}
                className="px-4 py-2 text-sm font-medium text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors"
              >
                Edit
              </button>
            )}
            {canDeleteDiscussion && (
              <button
                onClick={() => setShowDeleteDiscussionConfirm(true)}
                className="px-4 py-2 text-sm font-medium text-red-600 hover:text-red-800 bg-red-50 hover:bg-red-100 rounded-lg transition-colors"
              >
                Delete
              </button>
            )}
          </div>
        </div>
        
        <div className="flex items-center text-sm text-gray-500 mb-6 space-x-4">
          <span className="flex items-center">
            <span className="mr-2">👤</span>
            {discussion.user_email}
          </span>
          <span className="flex items-center">
            <span className="mr-2">📅</span>
            {formatDate(discussion.created_at)}
          </span>
          {discussion.updated_at !== discussion.created_at && (
            <span className="flex items-center">
              <span className="mr-2">✏️</span>
              Edited {formatDate(discussion.updated_at)}
            </span>
          )}
        </div>
        
        <div className="text-gray-700 whitespace-pre-wrap text-lg leading-relaxed mb-6">
          {discussion.content}
        </div>
        
        {/* Discussion Like Button */}
        <div className="flex items-center justify-between pt-4 border-t border-gray-200">
          <LikeButton
            targetId={discussion.id}
            targetType="discussion"
            initialLikes={discussionLikes}
            isLiked={isDiscussionLiked}
            onLikeChange={(newLikeCount, newIsLiked) => {
              setDiscussionLikes(newLikeCount);
              setIsDiscussionLiked(newIsLiked);
            }}
          />
        </div>
      </div>

      {/* Replies Section */}
      <div className="bg-white rounded-xl shadow-md p-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-900">
            Replies ({totalReplies})
          </h2>
          <button
            onClick={() => setShowReplyForm(!showReplyForm)}
            className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors"
          >
            <span className="mr-2">💬</span>
            {showReplyForm ? 'Cancel Reply' : 'Add Reply'}
          </button>
        </div>

        {/* Reply Form */}
        {showReplyForm && (
          <form onSubmit={handleSubmitReply} className="mb-8 p-6 bg-gray-50 rounded-lg">
            <textarea
              value={newReply}
              onChange={(e) => setNewReply(e.target.value)}
              rows={4}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 mb-4"
              placeholder="Write your reply..."
              required
            />
            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => setShowReplyForm(false)}
                className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-6 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
              >
                {isSubmitting ? 'Posting...' : 'Post Reply'}
              </button>
            </div>
          </form>
        )}

        {/* Replies List */}
        <div className="space-y-4">
          {replies.length > 0 ? (
            replies.map((reply) => (
              <div key={reply.id} className="border border-gray-200 rounded-lg overflow-hidden">
                {/* Reply Header */}
                <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <button
                        onClick={() => toggleReplyCollapse(reply.id)}
                        className="text-gray-500 hover:text-gray-700 transition-colors"
                        title={collapsedReplies.has(reply.id) ? 'Expand reply' : 'Collapse reply'}
                      >
                        <svg 
                          className={`w-4 h-4 transition-transform ${collapsedReplies.has(reply.id) ? 'rotate-90' : ''}`}
                          fill="none" 
                          stroke="currentColor" 
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </button>
                      <span className="font-medium text-gray-900">{reply.user_email}</span>
                      <span className="text-gray-500">•</span>
                      <span className="text-gray-500">{formatDate(reply.created_at)}</span>
                      {reply.updated_at && reply.updated_at !== reply.created_at && (
                        <>
                          <span className="text-gray-500">•</span>
                          <span className="text-gray-500">Edited {formatDate(reply.updated_at)}</span>
                        </>
                      )}
                    </div>
                    
                    {(currentUser?.email === reply.user_email || isAdmin) && (
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => {
                            setEditingReply(reply.id);
                            setEditReplyContent(reply.content);
                          }}
                          className="text-xs text-indigo-600 hover:text-indigo-800 px-2 py-1 rounded hover:bg-indigo-100 transition-colors"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => setShowDeleteReplyConfirm(reply.id)}
                          className="text-xs text-red-600 hover:text-red-800 px-2 py-1 rounded hover:bg-red-100 transition-colors"
                        >
                          Delete
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Reply Content */}
                {!collapsedReplies.has(reply.id) && (
                  <div className="p-4">
                    {editingReply === reply.id ? (
                      <div>
                        <textarea
                          value={editReplyContent}
                          onChange={(e) => setEditReplyContent(e.target.value)}
                          rows={4}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 mb-3"
                          required
                        />
                        <div className="flex justify-end space-x-2">
                          <button
                            onClick={() => setEditingReply(null)}
                            className="px-3 py-1 text-sm text-gray-600 hover:text-gray-800 rounded hover:bg-gray-100 transition-colors"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => handleEditReply(reply.id)}
                            className="px-3 py-1 text-sm text-white bg-indigo-600 hover:bg-indigo-700 rounded transition-colors"
                          >
                            Update
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="text-gray-700 whitespace-pre-wrap leading-relaxed">
                        {reply.content}
                      </div>
                    )}
                    
                    {/* Reply Like Button */}
                    <div className="mt-4 flex items-center justify-between pt-3 border-t border-gray-100">
                      <LikeButton
                        targetId={reply.id}
                        targetType="reply"
                        initialLikes={replyLikes[reply.id] || 0}
                        isLiked={isReplyLiked[reply.id] || false}
                        onLikeChange={(newLikeCount, newIsLiked) => {
                          setReplyLikes(prev => ({ ...prev, [reply.id]: newLikeCount }));
                          setIsReplyLiked(prev => ({ ...prev, [reply.id]: newIsLiked }));
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>
            ))
          ) : (
            <div className="text-center py-12">
              <div className="text-gray-400 text-4xl mb-4">💬</div>
              <p className="text-gray-500 text-lg mb-2">No replies yet.</p>
              <p className="text-gray-400 text-sm">Be the first to respond to this discussion!</p>
            </div>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-8 flex items-center justify-center">
            <nav className="flex items-center space-x-2">
              <button
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Previous
              </button>
              
              <div className="flex items-center space-x-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                      currentPage === page
                        ? 'bg-indigo-600 text-white'
                        : 'text-gray-500 bg-white border border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    {page}
                  </button>
                ))}
              </div>
              
              <button
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Next
              </button>
            </nav>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modals */}
      {showDeleteDiscussionConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md mx-4">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Delete Discussion</h3>
            <p className="text-gray-600 mb-6">
              Are you sure you want to delete this discussion? This action cannot be undone and will also delete all replies.
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowDeleteDiscussionConfirm(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteDiscussion}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors"
              >
                Delete Discussion
              </button>
            </div>
          </div>
        </div>
      )}

      {showDeleteReplyConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md mx-4">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Delete Reply</h3>
            <p className="text-gray-600 mb-6">
              Are you sure you want to delete this reply? This action cannot be undone.
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowDeleteReplyConfirm(null)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteReply(showDeleteReplyConfirm!)}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors"
              >
                Delete Reply
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
