// src/app/(dashboard)/twg/discussions/[id]/page.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useToast } from '@/components/Toast';
import LikeButton from '@/components/dashboard/LikeButton';
import Link from 'next/link';
import type { User } from '@supabase/supabase-js';
import {
  MessageSquare,
  User as UserIcon,
  Calendar,
  Clock,
  ArrowLeft,
  Edit3,
  Trash2,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
} from 'lucide-react';

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
  const [currentUser, setCurrentUser] = useState<User | null>(null);
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [discussionId, currentPage]);

  const getCurrentUser = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setCurrentUser(user);
        checkAdminStatus(user.id);
      }
    } catch (error) {
      console.error('[Discussion] Error getting current user:', error);
    }
  };

  const checkAdminStatus = async (userId: string) => {
    try {
      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .eq('role', 'admin');

      setIsAdmin(Array.isArray(roleData) && roleData.length > 0);
    } catch (error) {
      console.error('[Discussion] Error checking admin status:', error);
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
          <div className="animate-spin rounded-full h-12 w-12 border-2 border-sky-600 border-t-transparent mx-auto mb-4"></div>
          <p className="text-slate-500">Loading discussion...</p>
        </div>
      </div>
    );
  }

  if (!discussion) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center">
          <Link href="/twg/discussions" className="inline-flex items-center gap-1.5 text-xs font-semibold text-sky-700 dark:text-sky-400 hover:underline mt-2">
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Discussions</span>
          </Link>
        </div>
      </div>
    );
  }

  if (editingDiscussion) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 p-6 sm:p-8">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">Edit Discussion</h1>
            <Link
              href={`/twg/discussions/${discussionId}`}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-sky-700 dark:text-sky-400 hover:underline"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Discussion</span>
            </Link>
          </div>

          <form onSubmit={handleEditDiscussion} className="space-y-6">
            <div>
              <label htmlFor="edit-title" className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-2">
                Discussion Title
              </label>
              <input
                type="text"
                id="edit-title"
                value={editDiscussionTitle}
                onChange={(e) => setEditDiscussionTitle(e.target.value)}
                className="w-full px-4 py-3 border border-slate-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 min-h-[44px]"
                required
              />
            </div>

            <div>
              <label htmlFor="edit-content" className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-2">
                Discussion Content
              </label>
              <textarea
                id="edit-content"
                value={editDiscussionContent}
                onChange={(e) => setEditDiscussionContent(e.target.value)}
                rows={8}
                className="w-full px-4 py-3 border border-slate-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                required
              />
            </div>

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setEditingDiscussion(false)}
                className="min-h-[44px] px-6 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="min-h-[44px] px-6 py-2 text-xs font-bold text-white bg-sky-700 hover:bg-sky-800 dark:bg-sky-600 dark:hover:bg-sky-500 rounded-xl shadow-sm transition-all"
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
          className="inline-flex items-center gap-2 text-xs font-bold text-sky-700 dark:text-sky-400 hover:text-sky-800 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Discussions</span>
        </Link>
      </div>

      {/* Discussion Header */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 p-6 sm:p-8 mb-8">
        <div className="flex items-start justify-between gap-4 mb-4">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white leading-tight">
            {discussion.title}
          </h1>
          <div className="flex items-center gap-2 shrink-0">
            {canEditDiscussion && (
              <button
                onClick={() => setEditingDiscussion(true)}
                className="min-h-[44px] px-3 py-1.5 text-xs font-semibold text-sky-700 dark:text-sky-300 bg-sky-50 dark:bg-sky-950 border border-sky-200 dark:border-sky-800 hover:bg-sky-100 rounded-lg transition-colors inline-flex items-center gap-1.5"
              >
                <Edit3 className="w-3 h-3" />
                <span>Edit</span>
              </button>
            )}
            {canDeleteDiscussion && (
              <button
                onClick={() => setShowDeleteDiscussionConfirm(true)}
                className="min-h-[44px] px-3 py-1.5 text-xs font-semibold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 hover:bg-red-100 rounded-lg transition-colors inline-flex items-center gap-1.5"
              >
                <Trash2 className="w-3 h-3" />
                <span>Delete</span>
              </button>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center text-xs text-slate-500 dark:text-slate-400 mb-6 gap-x-4 gap-y-2">
          <span className="inline-flex items-center gap-1.5 font-medium text-slate-700 dark:text-slate-300">
            <UserIcon className="w-3.5 h-3.5 text-slate-400" />
            {discussion.user_email}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            {formatDate(discussion.created_at)}
          </span>
          {discussion.updated_at !== discussion.created_at && (
            <span className="inline-flex items-center gap-1.5 text-sky-700 dark:text-sky-400">
              <Edit3 className="w-3.5 h-3.5" />
              Edited {formatDate(discussion.updated_at)}
            </span>
          )}
        </div>

        <div className="text-slate-700 dark:text-slate-300 whitespace-pre-wrap text-base sm:text-lg leading-relaxed mb-6">
          {discussion.content}
        </div>

        {/* Discussion Like Button */}
        <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800">
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
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 p-6 sm:p-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
            Replies ({totalReplies})
          </h2>
          <button
            onClick={() => setShowReplyForm(!showReplyForm)}
            className="min-h-[44px] inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-sky-700 hover:bg-sky-800 dark:bg-sky-600 dark:hover:bg-sky-500 rounded-xl transition-all shadow-sm"
          >
            <MessageSquare className="w-4 h-4" />
            <span>{showReplyForm ? 'Cancel Reply' : 'Add Reply'}</span>
          </button>
        </div>

        {/* Reply Form */}
        {showReplyForm && (
          <form onSubmit={handleSubmitReply} className="mb-8 p-6 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700">
            <textarea
              value={newReply}
              onChange={(e) => setNewReply(e.target.value)}
              rows={4}
              className="w-full px-4 py-3 border border-slate-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 mb-4"
              placeholder="Write your reply..."
              required
            />
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowReplyForm(false)}
                className="min-h-[44px] px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="min-h-[44px] px-6 py-2 text-xs font-bold text-white bg-sky-700 hover:bg-sky-800 dark:bg-sky-600 dark:hover:bg-sky-500 rounded-xl disabled:opacity-50 transition-all shadow-sm"
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
              <div key={reply.id} className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-white dark:bg-slate-900">
                {/* Reply Header */}
                <div className="bg-slate-50 dark:bg-slate-800/60 px-4 py-3 border-b border-slate-200 dark:border-slate-800">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs">
                      <button
                        onClick={() => toggleReplyCollapse(reply.id)}
                        className="text-slate-400 hover:text-slate-600 transition-colors p-1"
                        title={collapsedReplies.has(reply.id) ? 'Expand reply' : 'Collapse reply'}
                      >
                        {collapsedReplies.has(reply.id) ? (
                          <ChevronRight className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )}
                      </button>
                      <span className="font-semibold text-slate-900 dark:text-white">{reply.user_email}</span>
                      <span className="text-slate-300 dark:text-slate-600">|</span>
                      <span className="text-slate-500 dark:text-slate-400">{formatDate(reply.created_at)}</span>
                      {reply.updated_at && reply.updated_at !== reply.created_at && (
                        <>
                          <span className="text-slate-300 dark:text-slate-600">|</span>
                          <span className="text-sky-700 dark:text-sky-400">Edited {formatDate(reply.updated_at)}</span>
                        </>
                      )}
                    </div>

                    {(currentUser?.email === reply.user_email || isAdmin) && (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            setEditingReply(reply.id);
                            setEditReplyContent(reply.content);
                          }}
                          className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center text-xs font-semibold text-sky-700 dark:text-sky-400 hover:underline px-2 py-1"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => setShowDeleteReplyConfirm(reply.id)}
                          className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center text-xs font-semibold text-red-600 dark:text-red-400 hover:underline px-2 py-1"
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
                          className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 mb-3"
                          required
                        />
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => setEditingReply(null)}
                            className="min-h-[44px] px-3 py-1 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => handleEditReply(reply.id)}
                            className="min-h-[44px] px-4 py-1 text-xs font-bold text-white bg-sky-700 hover:bg-sky-800 dark:bg-sky-600 dark:hover:bg-sky-500 rounded-lg transition-colors"
                          >
                            Update
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="text-slate-700 dark:text-slate-300 whitespace-pre-wrap text-sm leading-relaxed">
                        {reply.content}
                      </div>
                    )}

                    {/* Reply Like Button */}
                    <div className="mt-4 flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800">
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
            <div className="text-center py-12 px-4">
              <MessageSquare className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
              <p className="text-slate-700 dark:text-slate-300 text-base font-semibold mb-1">No replies yet.</p>
              <p className="text-slate-500 dark:text-slate-400 text-xs">Be the first to respond to this discussion!</p>
            </div>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-8 flex items-center justify-center">
            <nav className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="min-h-[44px] px-4 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Previous
              </button>

              <div className="flex items-center gap-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    className={`min-h-[44px] min-w-[44px] px-3 py-2 text-xs font-bold rounded-xl transition-colors ${
                      currentPage === page
                        ? 'bg-sky-700 text-white dark:bg-sky-600'
                        : 'text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
                    }`}
                  >
                    {page}
                  </button>
                ))}
              </div>

              <button
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                className="min-h-[44px] px-4 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Next
              </button>
            </nav>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modals */}
      {showDeleteDiscussionConfirm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 sm:p-8 max-w-md w-full border border-slate-200 dark:border-slate-800 shadow-xl">
            <div className="flex items-center gap-3 text-red-600 dark:text-red-400 mb-3">
              <AlertTriangle className="w-6 h-6" />
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Delete Discussion</h3>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-300 mb-6 leading-relaxed">
              Are you sure you want to delete this discussion? This action cannot be undone and will also delete all replies.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowDeleteDiscussionConfirm(false)}
                className="min-h-[44px] px-4 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteDiscussion}
                className="min-h-[44px] px-6 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl transition-colors shadow-sm"
              >
                Delete Discussion
              </button>
            </div>
          </div>
        </div>
      )}

      {showDeleteReplyConfirm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 sm:p-8 max-w-md w-full border border-slate-200 dark:border-slate-800 shadow-xl">
            <div className="flex items-center gap-3 text-red-600 dark:text-red-400 mb-3">
              <AlertTriangle className="w-6 h-6" />
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Delete Reply</h3>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-300 mb-6 leading-relaxed">
              Are you sure you want to delete this reply? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowDeleteReplyConfirm(null)}
                className="min-h-[44px] px-4 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteReply(showDeleteReplyConfirm!)}
                className="min-h-[44px] px-6 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl transition-colors shadow-sm"
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
