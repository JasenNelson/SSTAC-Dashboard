'use client';

import { useState, useEffect } from 'react';
import { Heart, Users } from 'lucide-react';
import { createClient } from '../supabase-client';
import { useToast } from '@/components/Toast';

interface LikeButtonProps {
  // Support both old and new prop formats
  discussionId?: number;
  replyId?: number;
  targetId?: number;
  targetType?: 'discussion' | 'reply';
  initialLikes?: number;
  isLiked?: boolean;
  className?: string;
  onLikeChange?: (newLikeCount: number, newIsLiked: boolean) => void;
}

interface Like {
  id: number;
  user_id: string;
  user_email: string;
  created_at: string;
}

export default function LikeButton({ 
  discussionId, 
  replyId, 
  targetId,
  targetType,
  initialLikes = 0, 
  isLiked = false,
  className = '',
  onLikeChange
}: LikeButtonProps) {
  const [likes, setLikes] = useState(initialLikes);
  const [liked, setLiked] = useState(isLiked);
  const [likeDetails, setLikeDetails] = useState<Like[]>([]);
  const [showDetails, setShowDetails] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [popupPosition, setPopupPosition] = useState<'top' | 'bottom'>('top');
  const supabase = createClient();
  const { showToast } = useToast();

  // Determine the actual discussion/reply IDs based on props
  const actualDiscussionId = discussionId || (targetType === 'discussion' ? targetId : undefined);
  const actualReplyId = replyId || (targetType === 'reply' ? targetId : undefined);

  // Fetch current like status and details
  useEffect(() => {
    const fetchLikeStatus = async () => {
      try {
        if (process.env.NODE_ENV === 'development') {
          console.log('🔍 LikeButton: Fetching like status for:', { actualDiscussionId, actualReplyId });
        }
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          if (process.env.NODE_ENV === 'development') {
            console.log('🔍 LikeButton: No user found');
          }
          return;
        }
        if (process.env.NODE_ENV === 'development') {
          console.log('🔍 LikeButton: User found:', user.id);
        }

        // Check if current user has liked this
        if (process.env.NODE_ENV === 'development') {
          console.log('🔍 LikeButton: Checking if user liked this item');
        }
        const { data: userLike, error: userLikeError } = await supabase
          .from('likes')
          .select('*')
          .eq('user_id', user.id)
          .eq(actualDiscussionId ? 'discussion_id' : 'reply_id', actualDiscussionId || actualReplyId)
          .single();

        if (userLikeError) {
          if (process.env.NODE_ENV === 'development') {
            console.log('🔍 LikeButton: User like check error (this is normal if no like exists):', userLikeError);
          }
        } else {
          if (process.env.NODE_ENV === 'development') {
            console.log('🔍 LikeButton: User like found:', userLike);
          }
        }

        setLiked(!!userLike);

        // Fetch all likes for this discussion/reply
        if (process.env.NODE_ENV === 'development') {
          console.log('🔍 LikeButton: Fetching all likes for this item');
        }
        const { data: allLikes, error: allLikesError } = await supabase
          .from('likes')
          .select(`
            id,
            user_id,
            created_at
          `)
          .eq(actualDiscussionId ? 'discussion_id' : 'reply_id', actualDiscussionId || actualReplyId)
          .order('created_at', { ascending: false });

        if (allLikesError) {
          console.error('🔍 LikeButton: Error fetching all likes:', allLikesError);
        } else {
          if (process.env.NODE_ENV === 'development') {
            console.log('🔍 LikeButton: All likes found:', allLikes?.length || 0);
          }
        }

        if (allLikes) {
          setLikes(allLikes.length);
          
          // Fetch user emails for all likes
          const userIds = allLikes.map(like => like.user_id);
          if (process.env.NODE_ENV === 'development') {
            console.log('🔍 LikeButton: Fetching user emails for user IDs:', userIds);
          }
          
          // Since we can't access auth.users directly, we'll use a simple approach
          // For now, just show "User" for all likes, or use current user's email if it matches
          const userEmailMap = new Map();
          
          // Get current user to see if we can identify them
          const { data: { user: currentUser } } = await supabase.auth.getUser();
          
          // Map user IDs to display names
          userIds.forEach(userId => {
            if (currentUser && userId === currentUser.id) {
              userEmailMap.set(userId, currentUser.email || 'You');
            } else {
              userEmailMap.set(userId, 'User');
            }
          });
          
          // Transform the data to match our interface
          const transformedLikes = allLikes.map(like => ({
            id: like.id,
            user_id: like.user_id,
            user_email: userEmailMap.get(like.user_id) || 'Unknown User',
            created_at: like.created_at
          }));
          setLikeDetails(transformedLikes);
        }
      } catch (error) {
        console.error('Error fetching like status:', error);
      }
    };

    if (actualDiscussionId || actualReplyId) {
      fetchLikeStatus();
    }
  }, [actualDiscussionId, actualReplyId, supabase]);

  // Handle popup positioning when showDetails changes
  useEffect(() => {
    if (showDetails) {
      // Position the popup after it's rendered
      setTimeout(() => {
        const button = document.querySelector(`[data-like-button="${actualDiscussionId || actualReplyId}"]`);
        const popup = document.getElementById('like-popup');
        
        if (button && popup) {
          const buttonRect = button.getBoundingClientRect();
          const viewportHeight = window.innerHeight;
          const spaceAbove = buttonRect.top;
          const spaceBelow = viewportHeight - buttonRect.bottom;
          
          // Position popup above or below based on available space
          if (spaceBelow > 200 && spaceAbove < 200) {
            popup.style.top = `${buttonRect.bottom + 10}px`;
          } else {
            popup.style.top = `${buttonRect.top - 10}px`;
          }
          
          // Center horizontally on the button
          popup.style.left = `${buttonRect.left + buttonRect.width / 2 - 128}px`; // 128 = half of 256px width
        }
      }, 0);
    }
  }, [showDetails, actualDiscussionId, actualReplyId]);

  const handleLike = async () => {
    try {
      setIsLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        showToast({
          type: 'warning',
          title: 'Authentication Required',
          message: 'Please log in to like content.'
        });
        return;
      }

      if (liked) {
        // Unlike
        const { error } = await supabase
          .from('likes')
          .delete()
          .eq('user_id', user.id)
          .eq(actualDiscussionId ? 'discussion_id' : 'reply_id', actualDiscussionId || actualReplyId);

        if (error) throw error;

        setLiked(false);
        const newLikeCount = Math.max(0, likes - 1);
        setLikes(newLikeCount);
        setLikeDetails(prev => prev.filter(like => like.user_id !== user.id));
        
        // Call callback if provided
        if (onLikeChange) {
          onLikeChange(newLikeCount, false);
        }
        
        showToast({
          type: 'info',
          title: 'Like Removed',
          message: 'Your like has been removed.'
        });
      } else {
        // Like
        const { error } = await supabase
          .from('likes')
          .insert({
            user_id: user.id,
            discussion_id: actualDiscussionId || null,
            reply_id: actualReplyId || null
          });

        if (error) throw error;

        setLiked(true);
        const newLikeCount = likes + 1;
        setLikes(newLikeCount);
        
        // Add current user to like details
        const newLike: Like = {
          id: Date.now(), // Temporary ID for UI
          user_id: user.id,
          user_email: user.email || 'Unknown User',
          created_at: new Date().toISOString()
        };
        setLikeDetails(prev => [newLike, ...prev]);

        // Call callback if provided
        if (onLikeChange) {
          onLikeChange(newLikeCount, true);
        }

        showToast({
          type: 'success',
          title: 'Liked!',
          message: 'Your like has been added.'
        });
      }
    } catch (error) {
      console.error('Error toggling like:', error);
      showToast({
        type: 'error',
        title: 'Error',
        message: 'Failed to update like. Please try again.'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const formatLikeText = (count: number) => {
    if (count === 0) return 'No likes';
    if (count === 1) return '1 like';
    return `${count} likes`;
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    if (diffInSeconds < 60) return 'just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    return `${Math.floor(diffInSeconds / 86400)}d ago`;
  };

  return (
    <div className={`relative ${className}`} style={{ overflow: 'visible' }}>
      <button
        onClick={handleLike}
        disabled={isLoading}
        data-like-button={actualDiscussionId || actualReplyId}
        className={`
          flex items-center space-x-2 px-3 py-2 rounded-lg transition-all duration-200
          ${liked 
            ? 'bg-green-100 text-green-600 hover:bg-green-200' 
            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }
          ${isLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        `}
      >
        <Heart 
          className={`w-4 h-4 ${liked ? 'fill-current' : ''}`} 
        />
        <span className="text-sm font-medium">{formatLikeText(likes)}</span>
        {likes > 0 && (
          <div
            onClick={(e) => {
              e.stopPropagation();
              setShowDetails(!showDetails);
            }}
            className="ml-1 p-1 hover:bg-gray-200 rounded transition-colors cursor-pointer"
          >
            <Users className="w-3 h-3" />
          </div>
        )}
      </button>

      {/* Like Details Popup */}
      {showDetails && likes > 0 && (
        <div 
          id="like-popup"
          className="fixed w-64 bg-white border border-gray-200 rounded-lg shadow-lg z-[9999]"
          style={{
            maxHeight: '300px'
          }}>
          <div className="p-3 border-b border-gray-100">
            <h4 className="font-medium text-gray-900">Liked by</h4>
          </div>
          <div className="max-h-48 overflow-y-auto">
            {likeDetails.map((like) => (
              <div key={like.id} className="flex items-center justify-between p-3 hover:bg-gray-50">
                <div className="flex items-center space-x-2">
                  <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center">
                    <Heart className="w-3 h-3 text-green-600" />
                  </div>
                  <span className="text-sm font-medium text-gray-900">
                    {like.user_email}
                  </span>
                </div>
                <span className="text-xs text-gray-500">
                  {formatTimeAgo(like.created_at)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Click outside to close */}
      {showDetails && (
        <div 
          className="fixed inset-0 z-0" 
          onClick={() => setShowDetails(false)}
        />
      )}
    </div>
  );
}
