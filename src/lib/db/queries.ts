/**
 * Database Query Abstraction Layer
 * Centralized repository for all direct database operations
 * Task 1.6 - Data Access Abstraction
 *
 * Provides typed, reusable query functions to replace direct Supabase calls
 * throughout the application.
 */

import { createAuthenticatedClient } from '@/lib/supabase-auth';

// =============================================================================
// Admin & User Management Queries
// =============================================================================

export async function getUserRoles(userId: string) {
  const supabase = await createAuthenticatedClient();
  return supabase
    .from('user_roles')
    .select('*')
    .eq('user_id', userId)
    .single();
}

export async function createUserRole(userId: string, role: string) {
  const supabase = await createAuthenticatedClient();
  return supabase
    .from('user_roles')
    .insert({ user_id: userId, role })
    .single();
}

export async function deleteUserRole(userId: string) {
  const supabase = await createAuthenticatedClient();
  return supabase
    .from('user_roles')
    .delete()
    .eq('user_id', userId);
}

export async function getAdminUsersComprehensive() {
  const supabase = await createAuthenticatedClient();
  return supabase
    .from('admin_users_comprehensive')
    .select('*')
    .order('created_at', { ascending: false });
}

export async function getUsersOverview() {
  const supabase = await createAuthenticatedClient();
  return supabase
    .from('users_overview')
    .select('*')
    .order('created_at', { ascending: false });
}

// =============================================================================
// Tags Queries
// =============================================================================

export async function getTags() {
  const supabase = await createAuthenticatedClient();
  return supabase
    .from('tags')
    .select('*')
    .order('name', { ascending: true });
}

export async function createTag(name: string, color: string, createdBy: string) {
  const supabase = await createAuthenticatedClient();
  return supabase
    .from('tags')
    .insert({
      name,
      color,
      created_by: createdBy,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .single();
}

export async function updateTag(tagId: string, name: string, color: string) {
  const supabase = await createAuthenticatedClient();
  return supabase
    .from('tags')
    .update({
      name,
      color,
      updated_at: new Date().toISOString(),
    })
    .eq('id', tagId)
    .single();
}

export async function deleteTag(tagId: string) {
  const supabase = await createAuthenticatedClient();
  const deleteResult = supabase
    .from('tags')
    .delete()
    .eq('id', tagId);

  // Also delete document_tags associations
  const supabase2 = await createAuthenticatedClient();
  await supabase2
    .from('document_tags')
    .delete()
    .eq('tag_id', tagId);

  return deleteResult;
}

// =============================================================================
// Announcements Queries
// =============================================================================

export async function getAnnouncements(isActive = true) {
  const supabase = await createAuthenticatedClient();
  return supabase
    .from('announcements')
    .select('*')
    .eq('is_active', isActive)
    .order('priority', { ascending: false })
    .order('created_at', { ascending: false });
}

export async function createAnnouncement(
  title: string,
  content: string,
  priority: number,
  createdBy: string
) {
  const supabase = await createAuthenticatedClient();
  return supabase
    .from('announcements')
    .insert({
      title,
      content,
      priority,
      is_active: true,
      created_by: createdBy,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .single();
}

export async function updateAnnouncement(
  announcementId: string,
  data: {
    title?: string;
    content?: string;
    priority?: number;
    is_active?: boolean;
  }
) {
  const supabase = await createAuthenticatedClient();
  return supabase
    .from('announcements')
    .update({
      ...data,
      updated_at: new Date().toISOString(),
    })
    .eq('id', announcementId)
    .single();
}

export async function deleteAnnouncement(announcementId: string) {
  const supabase = await createAuthenticatedClient();
  return supabase
    .from('announcements')
    .delete()
    .eq('id', announcementId);
}

// =============================================================================
// Milestones Queries
// =============================================================================

export async function getMilestones(statuses: string[] = ['active', 'completed']) {
  const supabase = await createAuthenticatedClient();
  return supabase
    .from('milestones')
    .select('*')
    .in('status', statuses)
    .order('target_date', { ascending: true });
}

export async function createMilestone(
  title: string,
  description: string,
  targetDate: string,
  status: string,
  createdBy: string
) {
  const supabase = await createAuthenticatedClient();
  return supabase
    .from('milestones')
    .insert({
      title,
      description,
      target_date: targetDate,
      status,
      created_by: createdBy,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .single();
}

export async function updateMilestone(
  milestoneId: string,
  data: {
    title?: string;
    description?: string;
    target_date?: string;
    status?: string;
  }
) {
  const supabase = await createAuthenticatedClient();
  return supabase
    .from('milestones')
    .update({
      ...data,
      updated_at: new Date().toISOString(),
    })
    .eq('id', milestoneId)
    .single();
}

export async function deleteMilestone(milestoneId: string) {
  const supabase = await createAuthenticatedClient();
  return supabase
    .from('milestones')
    .delete()
    .eq('id', milestoneId);
}

// =============================================================================
// Document Queries
// =============================================================================

export async function getDocuments(limit = 100, offset = 0, tag?: string) {
  const supabase = await createAuthenticatedClient();
  let query = supabase
    .from('documents')
    .select('*')
    .order('created_at', { ascending: false });

  if (tag) {
    query = query.eq('tag', tag);
  }

  return query.range(offset, offset + limit - 1);
}

export async function getDocumentById(documentId: string) {
  const supabase = await createAuthenticatedClient();
  return supabase
    .from('documents')
    .select('*')
    .eq('id', documentId)
    .single();
}

export async function createDocument(
  title: string,
  content: string,
  createdBy: string,
  tag?: string
) {
  const supabase = await createAuthenticatedClient();
  return supabase
    .from('documents')
    .insert({
      title,
      content,
      created_by: createdBy,
      tag: tag || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .single();
}

export async function updateDocument(
  documentId: string,
  data: {
    title?: string;
    content?: string;
    tag?: string;
  }
) {
  const supabase = await createAuthenticatedClient();
  return supabase
    .from('documents')
    .update({
      ...data,
      updated_at: new Date().toISOString(),
    })
    .eq('id', documentId)
    .single();
}

export async function deleteDocument(documentId: string) {
  const supabase = await createAuthenticatedClient();
  return supabase
    .from('documents')
    .delete()
    .eq('id', documentId);
}

export async function createDocumentTag(documentId: string, tagId: string) {
  const supabase = await createAuthenticatedClient();
  return supabase
    .from('document_tags')
    .insert({
      document_id: documentId,
      tag_id: tagId,
    });
}

// =============================================================================
// Vote Management Queries
// =============================================================================

export async function deletePollVotes(pollId?: string) {
  const supabase = await createAuthenticatedClient();
  if (pollId) {
    return supabase
      .from('poll_votes')
      .delete()
      .eq('poll_id', pollId);
  }
  return supabase.from('poll_votes').delete().neq('id', '00000000-0000-0000-0000-000000000000');
}

export async function deleteRankingVotes(rankingPollId?: string) {
  const supabase = await createAuthenticatedClient();
  if (rankingPollId) {
    return supabase
      .from('ranking_votes')
      .delete()
      .eq('ranking_poll_id', rankingPollId);
  }
  return supabase.from('ranking_votes').delete().neq('id', '00000000-0000-0000-0000-000000000000');
}

// =============================================================================
// Like/Interaction Queries
// =============================================================================

export async function incrementLikes(documentId: string) {
  const supabase = await createAuthenticatedClient();
  return supabase.rpc('increment_likes', { document_id: documentId });
}

export async function decrementLikes(documentId: string) {
  const supabase = await createAuthenticatedClient();
  return supabase.rpc('decrement_likes', { document_id: documentId });
}

export async function getLikeCount(userId: string) {
  const supabase = await createAuthenticatedClient();
  return supabase
    .from('likes')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId);
}

export async function getPollVoteCount(userId: string) {
  const supabase = await createAuthenticatedClient();
  return supabase
    .from('poll_votes')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId);
}

export async function getRankingVoteCount(userId: string) {
  const supabase = await createAuthenticatedClient();
  return supabase
    .from('ranking_votes')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId);
}

// =============================================================================
// Discussion Queries
// =============================================================================

export async function getDiscussions(limit = 20, offset = 0) {
  const supabase = await createAuthenticatedClient();
  return supabase
    .from('discussions')
    .select('*')
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);
}

export async function getDiscussionById(discussionId: string) {
  const supabase = await createAuthenticatedClient();
  return supabase
    .from('discussions')
    .select('*')
    .eq('id', discussionId)
    .single();
}

export async function createDiscussion(
  title: string,
  content: string,
  userId: string,
  userEmail: string
) {
  const supabase = await createAuthenticatedClient();
  return supabase
    .from('discussions')
    .insert({
      title,
      content,
      user_id: userId,
      user_email: userEmail,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .single();
}

export async function getDiscussionReplies(discussionId: string, limit = 50, offset = 0) {
  const supabase = await createAuthenticatedClient();
  return supabase
    .from('discussion_replies')
    .select('*')
    .eq('discussion_id', discussionId)
    .order('created_at', { ascending: true })
    .range(offset, offset + limit - 1);
}

export async function createDiscussionReply(
  discussionId: string,
  content: string,
  userId: string,
  userEmail: string
) {
  const supabase = await createAuthenticatedClient();
  return supabase
    .from('discussion_replies')
    .insert({
      discussion_id: discussionId,
      content,
      user_id: userId,
      user_email: userEmail,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .single();
}

// =============================================================================
// Review Submission Queries
// =============================================================================

export async function getReviewSubmission(submissionId: string) {
  const supabase = await createAuthenticatedClient();
  return supabase
    .from('review_submissions')
    .select('*')
    .eq('id', submissionId)
    .single();
}

export async function createReviewSubmission(
  userId: string,
  formData: Record<string, unknown>
) {
  const supabase = await createAuthenticatedClient();
  return supabase
    .from('review_submissions')
    .insert({
      user_id: userId,
      status: 'draft',
      form_data: formData,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .single();
}

export async function updateReviewSubmission(
  submissionId: string,
  formData: Record<string, unknown>
) {
  const supabase = await createAuthenticatedClient();
  return supabase
    .from('review_submissions')
    .update({
      form_data: formData,
      updated_at: new Date().toISOString(),
    })
    .eq('id', submissionId)
    .single();
}

export async function submitReviewSubmission(submissionId: string) {
  const supabase = await createAuthenticatedClient();
  return supabase
    .from('review_submissions')
    .update({
      status: 'submitted',
      updated_at: new Date().toISOString(),
    })
    .eq('id', submissionId)
    .single();
}
