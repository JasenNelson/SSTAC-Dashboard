// src/components/dashboard/DiscussionThread.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '../supabase-client';
import { useToast } from '@/components/Toast';
import LikeButton from './LikeButton';
import type { User } from '@supabase/supabase-js';

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

interface DiscussionThreadProps {
  discussion: Discussion;
  onUpdate: () => void;
  session: unknown;
}

export default function DiscussionThread({ discussion, onUpdate, session }: DiscussionThreadProps) {
  const [replies, setReplies] = useState<Reply[]>([]);
  const [newReply, setNewReply] = useState('');
  const [showReplyForm, setShowReplyForm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingReplies, setIsLoadingReplies] = useState(true);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const { showToast } = useToast();
  
  // Edit states
  const [editingDiscussion, setEditingDiscussion] = useState(false);
  const [editDiscussionTitle, setEditDiscussionTitle] = useState(discussion.title);
  const [editDiscussionContent, setEditDiscussionContent] = useState(discussion.content);
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
  
  const supabase = createClient();

  useEffect(() => {
    fetchReplies();
    // Session type comes from Supabase and may have varying structure
    const sessionUser = (session as { user?: { id: string } })?.user;
    if (sessionUser) {
      setCurrentUser(sessionUser);
      checkAdminStatus(sessionUser.id);
    } else {
      // Fallback: try to get user independently if session not passed
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
      getCurrentUser();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [discussion.id, session]); // fetchReplies, checkAdminStatus, supabase.auth are stable





  const fetchLikeCounts = useCallback(async () => { // Wrapped with useCallback
    try {
      // Fetch discussion likes
      const { data: discussionLikesData, error: discussionLikesError } = await supabase
        .from('likes')
        .select('*')
        .eq('discussion_id', discussion.id);

      if (!discussionLikesError && discussionLikesData) {
        setDiscussionLikes(discussionLikesData.length);
        
        // Check if current user liked the discussion
        if (currentUser) {
          const userLiked = discussionLikesData.some(like => like.user_id === currentUser.id);
          setIsDiscussionLiked(userLiked);
        }
      }

      // Fetch reply likes
      if (replies.length > 0) {
        const { data: replyLikesData, error: replyLikesError } = await supabase
          .from('likes')
          .select('*')
          .in('reply_id', replies.map(reply => reply.id));

        if (!replyLikesError && replyLikesData) {
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
      console.error('❌ Error fetching like counts:', error);
    }
  }, [supabase, discussion.id, replies, currentUser]); // Added dependencies

  // Fetch likes after currentUser and replies are set
  useEffect(() => {
    if (currentUser && !isLoadingReplies) {
      fetchLikeCounts();
    }
  }, [currentUser, discussion.id, isLoadingReplies, fetchLikeCounts]);

  const checkAdminStatus = async (userId: string) => {
    try {
      // Check if user is admin
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

  const fetchReplies = async () => {
    try {
      const { data, error } = await supabase
        .from('discussion_replies')
        .select('*')
        .eq('discussion_id', discussion.id)
        .order('created_at', { ascending: true });

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
      setIsLoadingReplies(false);
    }
  };

  const handleSubmitReply = async (e: React.FormEvent) => {
    e.preventDefault();
    
    setIsSubmitting(true);
    
    if (!newReply.trim()) {
      showToast({
        type: 'warning',
        title: 'Missing Reply',
        message: 'Please enter a reply.',
        duration: 4000
      });
      setIsSubmitting(false);
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        showToast({
          type: 'error',
          title: 'Authentication Required',
          message: 'You must be logged in to reply.',
          duration: 3000
        });
        setIsSubmitting(false);
        return;
      }

      const { error } = await supabase
        .from('discussion_replies')
        .insert({
          content: newReply.trim(),
          user_id: user.id,
          user_email: user.email,
          discussion_id: discussion.id
        });

      if (error) {
        console.error('Error creating reply:', error);
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
        fetchReplies();
        onUpdate();
        // Refresh likes after adding reply
        setTimeout(() => {
          if (currentUser) {
            fetchLikeCounts();
          }
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
        .eq('id', discussion.id);

      if (error) {
        console.error('Error updating discussion:', error);
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
        onUpdate(); // Refresh the parent component
        // Refresh likes after updating discussion
        setTimeout(() => {
          if (currentUser) {
            fetchLikeCounts();
          }
        }, 500);
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
        .eq('id', discussion.id);

      if (error) {
        console.error('Error deleting discussion:', error);
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
        onUpdate(); // Refresh the parent component
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
        console.error('Error updating reply:', error);
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
        // Refresh likes after updating reply
        setTimeout(() => {
          if (currentUser) {
            fetchLikeCounts();
          }
        }, 500);
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
        console.error('Error deleting reply:', error);
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
        // Refresh likes after deleting reply
        setTimeout(() => {
          if (currentUser) {
            fetchLikeCounts();
          }
        }, 500);
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

  const canEditDiscussion = currentUser && (currentUser.email === discussion.user_email || isAdmin);
  const canDeleteDiscussion = currentUser && (currentUser.email === discussion.user_email || isAdmin);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (editingDiscussion) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Edit Discussion</h3>
        
        <form onSubmit={handleEditDiscussion} className="space-y-4">
          <div>
            <label htmlFor="edit-title" className="block text-sm font-medium text-gray-700 mb-1">
              Discussion Title
            </label>
            <input
              type="text"
              id="edit-title"
              value={editDiscussionTitle}
              onChange={(e) => setEditDiscussionTitle(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              required
            />
          </div>

          <div>
            <label htmlFor="edit-content" className="block text-sm font-medium text-gray-700 mb-1">
              Discussion Content
            </label>
            <textarea
              id="edit-content"
              value={editDiscussionContent}
              onChange={(e) => setEditDiscussionContent(e.target.value)}
              rows={6}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              required
            />
          </div>

          <div className="flex justify-end space-x-3">
            <button
              type="button"
              onClick={() => setEditingDiscussion(false)}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 transition-colors"
            >
              Update Discussion
            </button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      {/* Discussion Header */}
      <div className="mb-4">
        <div className="flex items-start justify-between mb-2">
          <h3 className="text-xl font-semibold text-gray-900">{discussion.title}</h3>
          <div className="flex items-center space-x-2">
            {canEditDiscussion && (
              <button
                onClick={() => setEditingDiscussion(true)}
                className="text-sm text-indigo-600 hover:text-indigo-800 font-medium px-2 py-1 rounded hover:bg-indigo-50"
              >
                Edit
              </button>
            )}
            {canDeleteDiscussion && (
              <button
                onClick={() => setShowDeleteDiscussionConfirm(true)}
                className="text-sm text-red-600 hover:text-red-800 font-medium px-2 py-1 rounded hover:bg-red-50"
              >
                Delete
              </button>
            )}
          </div>
        </div>
        
        <div className="flex items-center text-sm text-gray-500 mb-3">
          <span>By {discussion.user_email}</span>
          <span className="mx-2">•</span>
          <span>{formatDate(discussion.created_at)}</span>
          {discussion.updated_at !== discussion.created_at && (
            <>
              <span className="mx-2">•</span>
              <span>Edited {formatDate(discussion.updated_at)}</span>
            </>
          )}
        </div>
        <div className="text-gray-700 whitespace-pre-wrap">{discussion.content}</div>
        
        {/* Discussion Like Button */}
        <div className="mt-4 flex items-center justify-between">
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
      <div className="border-t border-gray-200 pt-4">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-lg font-medium text-gray-900">
            Replies ({replies.length})
          </h4>
          <button
            onClick={() => setShowReplyForm(!showReplyForm)}
            className="text-sm text-indigo-600 hover:text-indigo-800 font-medium"
          >
            {showReplyForm ? 'Cancel Reply' : 'Reply'}
          </button>
        </div>

        {/* Reply Form */}
        {showReplyForm && (
          <form onSubmit={handleSubmitReply} className="mb-6">
            <textarea
              value={newReply}
              onChange={(e) => setNewReply(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="Write your reply..."
              required
            />
            <div className="mt-2 flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => setShowReplyForm(false)}
                className="px-3 py-1 text-sm text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-3 py-1 text-sm font-medium text-white bg-indigo-600 rounded hover:bg-indigo-700 disabled:opacity-50"
              >
                {isSubmitting ? 'Posting...' : 'Post Reply'}
              </button>
            </div>
          </form>
        )}

        {/* Replies List */}
        <div className="space-y-4">
          {isLoadingReplies ? (
            <div className="text-center py-4 text-gray-500">Loading replies...</div>
          ) : replies.length > 0 ? (
            replies.map((reply) => (
              <div key={reply.id} className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center text-sm text-gray-500">
                    <span className="font-medium">{reply.user_email}</span>
                    <span className="mx-2">•</span>
                    <span>{formatDate(reply.created_at)}</span>
                    {reply.updated_at && reply.updated_at !== reply.created_at && (
                      <>
                        <span className="mx-2">•</span>
                        <span>Edited {formatDate(reply.updated_at)}</span>
                      </>
                    )}
                  </div>
                  <div className="flex items-center space-x-2">
                    {(currentUser?.email === reply.user_email || isAdmin) && (
                      <>
                        <button
                          onClick={() => {
                            setEditingReply(reply.id);
                            setEditReplyContent(reply.content);
                          }}
                          className="text-xs text-indigo-600 hover:text-indigo-800 px-1 py-0.5 rounded hover:bg-indigo-100"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => setShowDeleteReplyConfirm(reply.id)}
                          className="text-xs text-red-600 hover:text-red-800 px-1 py-0.5 rounded hover:bg-red-100"
                        >
                          Delete
                        </button>
                      </>
                    )}
                  </div>
                </div>
                
                {editingReply === reply.id ? (
                  <div className="mt-2">
                    <textarea
                      value={editReplyContent}
                      onChange={(e) => setEditReplyContent(e.target.value)}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      required
                    />
                    <div className="mt-2 flex justify-end space-x-2">
                      <button
                        onClick={() => setEditingReply(null)}
                        className="text-xs text-gray-600 hover:text-gray-800 px-2 py-1 rounded hover:bg-gray-100"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => handleEditReply(reply.id)}
                        className="text-xs text-white bg-indigo-600 hover:bg-indigo-700 px-2 py-1 rounded"
                      >
                        Update
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="text-gray-700 whitespace-pre-wrap">{reply.content}</div>
                )}
                
                {/* Reply Like Button */}
                <div className="mt-3 flex items-center justify-between">
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
            ))
          ) : (
            <div className="text-center py-4 text-gray-500">
              No replies yet. Be the first to respond!
            </div>
          )}
        </div>
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
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteDiscussion}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 transition-colors"
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
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteReply(showDeleteReplyConfirm!)}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 transition-colors"
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
