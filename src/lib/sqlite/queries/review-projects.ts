/**
 * Query Helpers for Review Projects
 *
 * Follows the same pattern as queries/index.ts using getDatabase, getOne,
 * executeQuery, and executeStatement from the SQLite client.
 */

import { getDatabase, getOne, executeQuery, executeStatement } from '../client';

// =============================================================================
// Types
// =============================================================================

export interface ReviewProject {
  id: string;
  site_id: string;
  site_name: string | null;
  applicant_name: string | null;
  applicant_company: string | null;
  application_type: string;
  selected_services: string;
  submission_date: string | null;
  site_address: string | null;
  site_region: string | null;
  folder_path: string;
  notes: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface ReviewProjectFile {
  id: number;
  project_id: string;
  filename: string;
  file_size: number | null;
  file_type: string | null;
  processed: number;
  uploaded_at: string;
  processed_at: string | null;
}

// =============================================================================
// Review Project Queries
// =============================================================================

/**
 * Get all review projects, optionally filtered by status
 */
export function getReviewProjects(status?: string): ReviewProject[] {
  if (status) {
    return executeQuery<ReviewProject>(
      'SELECT * FROM review_projects WHERE status = ? ORDER BY updated_at DESC',
      [status]
    );
  }
  return executeQuery<ReviewProject>(
    'SELECT * FROM review_projects ORDER BY updated_at DESC'
  );
}

/**
 * Get a single review project by ID
 */
export function getReviewProjectById(id: string): ReviewProject | undefined {
  return getOne<ReviewProject>(
    'SELECT * FROM review_projects WHERE id = ?',
    [id]
  );
}

/**
 * Create a new review project
 */
export function createReviewProject(
  data: Omit<ReviewProject, 'created_at' | 'updated_at'>
): ReviewProject {
  const db = getDatabase();

  db.prepare(`
    INSERT INTO review_projects (
      id, site_id, site_name, applicant_name, applicant_company,
      application_type, selected_services, submission_date,
      site_address, site_region, folder_path, notes, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    data.id,
    data.site_id,
    data.site_name,
    data.applicant_name,
    data.applicant_company,
    data.application_type,
    data.selected_services,
    data.submission_date,
    data.site_address,
    data.site_region,
    data.folder_path,
    data.notes,
    data.status
  );

  return getReviewProjectById(data.id)!;
}

/**
 * Update a review project
 */
export function updateReviewProject(
  id: string,
  data: Partial<Omit<ReviewProject, 'id' | 'created_at' | 'updated_at'>>
): ReviewProject | undefined {
  const db = getDatabase();

  const updates: string[] = [];
  const params: unknown[] = [];

  if (data.site_id !== undefined) {
    updates.push('site_id = ?');
    params.push(data.site_id);
  }
  if (data.site_name !== undefined) {
    updates.push('site_name = ?');
    params.push(data.site_name);
  }
  if (data.applicant_name !== undefined) {
    updates.push('applicant_name = ?');
    params.push(data.applicant_name);
  }
  if (data.applicant_company !== undefined) {
    updates.push('applicant_company = ?');
    params.push(data.applicant_company);
  }
  if (data.application_type !== undefined) {
    updates.push('application_type = ?');
    params.push(data.application_type);
  }
  if (data.selected_services !== undefined) {
    updates.push('selected_services = ?');
    params.push(data.selected_services);
  }
  if (data.submission_date !== undefined) {
    updates.push('submission_date = ?');
    params.push(data.submission_date);
  }
  if (data.site_address !== undefined) {
    updates.push('site_address = ?');
    params.push(data.site_address);
  }
  if (data.site_region !== undefined) {
    updates.push('site_region = ?');
    params.push(data.site_region);
  }
  if (data.folder_path !== undefined) {
    updates.push('folder_path = ?');
    params.push(data.folder_path);
  }
  if (data.notes !== undefined) {
    updates.push('notes = ?');
    params.push(data.notes);
  }
  if (data.status !== undefined) {
    updates.push('status = ?');
    params.push(data.status);
  }

  if (updates.length === 0) {
    return getReviewProjectById(id);
  }

  updates.push("updated_at = datetime('now')");
  params.push(id);

  db.prepare(
    `UPDATE review_projects SET ${updates.join(', ')} WHERE id = ?`
  ).run(...params);

  return getReviewProjectById(id);
}

/**
 * Delete a review project (cascades to files)
 */
export function deleteReviewProject(id: string): boolean {
  const result = executeStatement(
    'DELETE FROM review_projects WHERE id = ?',
    [id]
  );
  return result.changes > 0;
}

// =============================================================================
// Review Project File Queries
// =============================================================================

/**
 * Get all files for a project
 */
export function getProjectFiles(projectId: string): ReviewProjectFile[] {
  return executeQuery<ReviewProjectFile>(
    'SELECT * FROM review_project_files WHERE project_id = ? ORDER BY uploaded_at ASC',
    [projectId]
  );
}

/**
 * Get unprocessed files for a project
 */
export function getUnprocessedFiles(projectId: string): ReviewProjectFile[] {
  return executeQuery<ReviewProjectFile>(
    'SELECT * FROM review_project_files WHERE project_id = ? AND processed = 0 ORDER BY uploaded_at ASC',
    [projectId]
  );
}

/**
 * Add a file record to a project
 */
export function addProjectFile(
  projectId: string,
  filename: string,
  fileSize: number,
  fileType: string
): ReviewProjectFile {
  const result = executeStatement(
    `INSERT INTO review_project_files (project_id, filename, file_size, file_type)
     VALUES (?, ?, ?, ?)`,
    [projectId, filename, fileSize, fileType]
  );

  return getOne<ReviewProjectFile>(
    'SELECT * FROM review_project_files WHERE id = ?',
    [result.lastInsertRowid]
  )!;
}

/**
 * Remove a file record
 */
export function removeProjectFile(fileId: number): boolean {
  const result = executeStatement(
    'DELETE FROM review_project_files WHERE id = ?',
    [fileId]
  );
  return result.changes > 0;
}

/**
 * Mark a file as processed
 */
export function markFileProcessed(fileId: number): void {
  executeStatement(
    "UPDATE review_project_files SET processed = 1, processed_at = datetime('now') WHERE id = ?",
    [fileId]
  );
}
