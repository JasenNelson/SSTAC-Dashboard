/**
 * SQLite Database Module for Regulatory Review
 *
 * Re-exports all database utilities and query functions.
 *
 * Usage:
 *   import { db, getSubmissions, createJudgment } from '@/lib/sqlite';
 *
 *   // Initialize database on server startup
 *   db.init();
 *
 *   // Query data
 *   const submissions = getSubmissions();
 *   const assessments = getAssessments(submissionId, { discretion_tier: 'TIER_2_PROFESSIONAL' });
 */

// Database client
export {
  default as db,
  getDatabase,
  closeDatabase,
  initDatabase,
  runMigrations,
  executeQuery,
  executeStatement,
  getOne,
  isDatabaseInitialized,
  getDatabaseStats,
} from './client';

// Query helpers and types
export {
  // Types
  type Submission,
  type Assessment,
  type Judgment,
  type ReviewSession,
  type AssessmentFilters,
  type SubmissionProgress,
  type CreateJudgmentData,
  type UpdateJudgmentData,
  // Submission queries
  getSubmissions,
  getSubmissionById,
  getSubmissionBySubmissionId,
  createSubmission,
  // Assessment queries
  getAssessments,
  getAssessmentById,
  getAssessmentWithJudgment,
  createAssessment,
  createAssessmentsBulk,
  // Judgment queries
  createJudgment,
  updateJudgment,
  getOrCreateJudgment,
  // Progress queries
  getProgress,
  getSubmissionsSummary,
  // Review session queries
  createReviewSession,
  endReviewSession,
  getReviewSessions,
} from './queries';
