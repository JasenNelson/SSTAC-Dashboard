/**
 * Database Module - Central Export
 * Type-safe data access layer for all database operations
 * Task 1.6 - Data Access Abstraction
 *
 * Usage:
 * import { getUserRoles, createTag, getDocuments } from '@/lib/db'
 */

// Export all query functions
export {
  // User & Admin
  getUserRoles,
  createUserRole,
  deleteUserRole,
  getAdminUsersComprehensive,
  getUsersOverview,
  // Tags
  getTags,
  createTag,
  updateTag,
  deleteTag,
  // Announcements
  getAnnouncements,
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
  // Milestones
  getMilestones,
  createMilestone,
  updateMilestone,
  deleteMilestone,
  // Documents
  getDocuments,
  getDocumentById,
  createDocument,
  updateDocument,
  deleteDocument,
  createDocumentTag,
  // Votes
  deletePollVotes,
  deleteRankingVotes,
  // Interactions
  incrementLikes,
  decrementLikes,
  getLikeCount,
  getPollVoteCount,
  getRankingVoteCount,
  // Discussions
  getDiscussions,
  getDiscussionById,
  createDiscussion,
  getDiscussionReplies,
  createDiscussionReply,
  // Reviews
  getReviewSubmission,
  createReviewSubmission,
  updateReviewSubmission,
  submitReviewSubmission,
} from './queries';
