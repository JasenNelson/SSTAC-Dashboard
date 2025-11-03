/**
 * Centralized Zod Validation Schemas
 * 
 * Provides type-safe validation for admin server actions.
 * These schemas ensure data integrity and prevent injection attacks
 * while maintaining backward compatibility with existing data formats.
 */

import { z } from 'zod';

/**
 * Tag validation schemas
 */
export const createTagSchema = z.object({
  name: z.string()
    .min(1, 'Tag name is required')
    .max(100, 'Tag name must be 100 characters or less')
    .trim(),
  color: z.string()
    .min(1, 'Color is required')
    .regex(/^#[0-9A-Fa-f]{6}$/, 'Color must be a valid hex color (e.g., #FF5733)'),
});

export const updateTagSchema = createTagSchema.extend({
  id: z.preprocess(
    (val) => {
      // Handle string, number, or undefined
      if (typeof val === 'number') return val;
      if (typeof val === 'string') {
        const trimmed = val.trim();
        if (!trimmed) return undefined;
        const num = parseInt(trimmed, 10);
        return isNaN(num) ? undefined : num;
      }
      return undefined;
    },
    z.number().int().positive('Tag ID must be a positive integer')
  ),
});

export const deleteTagSchema = z.object({
  id: z.preprocess(
    (val) => {
      // Handle string, number, or undefined
      if (typeof val === 'number') return val;
      if (typeof val === 'string') {
        const trimmed = val.trim();
        if (!trimmed) return undefined;
        const num = parseInt(trimmed, 10);
        return isNaN(num) ? undefined : num;
      }
      return undefined;
    },
    z.number().int().positive('Tag ID must be a positive integer')
  ),
});

/**
 * Announcement validation schemas
 */
export const createAnnouncementSchema = z.object({
  title: z.string()
    .min(1, 'Title is required')
    .max(200, 'Title must be 200 characters or less')
    .trim(),
  content: z.string()
    .min(1, 'Content is required')
    .max(2000, 'Content must be 2000 characters or less'),
  priority: z.enum(['low', 'medium', 'high']),
  is_active: z.boolean().or(
    z.string().transform((val) => val === 'true')
  ),
});

export const updateAnnouncementSchema = createAnnouncementSchema.extend({
  id: z.string().uuid('Invalid announcement ID format'),
});

/**
 * Milestone validation schemas
 */
export const createMilestoneSchema = z.object({
  title: z.string()
    .min(1, 'Title is required')
    .max(200, 'Title must be 200 characters or less')
    .trim(),
  description: z.string()
    .min(1, 'Description is required')
    .max(1000, 'Description must be 1000 characters or less'),
  target_date: z.string()
    .min(1, 'Target date is required')
    .refine(
      (date) => !isNaN(new Date(date).getTime()),
      'Invalid date format'
    ),
  status: z.enum(['pending', 'in_progress', 'completed', 'delayed']),
  priority: z.enum(['low', 'medium', 'high']),
});

export const updateMilestoneSchema = createMilestoneSchema.extend({
  id: z.union([
    z.string().transform((val) => {
      const num = parseInt(val, 10);
      if (isNaN(num)) throw new Error('Invalid milestone ID format');
      return num;
    }),
    z.number(),
  ]).pipe(z.number().int().positive('Milestone ID must be a positive integer')),
});

/**
 * User role management schemas
 */
export const toggleAdminRoleSchema = z.object({
  userId: z.string().uuid('Invalid user ID format'),
  currentIsAdmin: z.boolean(),
});

export const addUserRoleSchema = z.object({
  userId: z.string().uuid('Invalid user ID format'),
  role: z.string()
    .min(1, 'Role is required')
    .max(50, 'Role name must be 50 characters or less')
    .trim(),
});

/**
 * Document validation schemas
 */
export const addDocumentSchema = z.object({
  title: z.string()
    .min(1, 'Title is required')
    .max(200, 'Title must be 200 characters or less')
    .trim(),
  file_url: z.string()
    .url('File URL must be a valid URL')
    .max(500, 'File URL must be 500 characters or less'),
  description: z.string()
    .max(2000, 'Description must be 2000 characters or less')
    .optional()
    .nullable(),
});

/**
 * Helper function to extract FormData and validate
 */
/**
 * Helper function to extract FormData and validate
 */
export function parseFormData<T>(formData: FormData, schema: z.ZodSchema<T>): { data?: T; error?: string } {
  try {
    // Convert FormData to plain object
    const data: Record<string, unknown> = {};
    for (const [key, value] of formData.entries()) {
      // Ensure value is a string (FormData values can be strings or Files)
      // For text inputs, FormData always returns strings, but we handle Files just in case
      const stringValue = typeof value === 'string' ? value : value instanceof File ? value.name : String(value);
      
      // Handle boolean fields that come as strings
      if (stringValue === 'true' || stringValue === 'false') {
        data[key] = stringValue === 'true';
      } else {
        // For numeric IDs, try to parse as number if it looks like a number
        // This helps with milestone IDs which are numbers
        // Handle ID fields - tags and milestones use numeric IDs, announcements use UUIDs
        if (key === 'id' && typeof stringValue === 'string') {
          const trimmedValue = stringValue.trim();
          if (trimmedValue !== '') {
            // Try to parse as number first (for tags and milestones)
            const numValue = Number(trimmedValue);
            // If it's a valid integer ID, convert it to number
            // UUIDs will be kept as strings and validated by schema
            if (!isNaN(numValue) && Number.isInteger(numValue) && numValue > 0) {
              data[key] = numValue;
            } else {
              // Keep as string for UUIDs (announcements)
              data[key] = trimmedValue;
            }
          } else {
            // Empty string - keep as empty string, schema will validate
            data[key] = trimmedValue;
          }
        } else {
          data[key] = stringValue;
        }
      }
    }

    // Validate with Zod schema
    const validated = schema.parse(data);
    return { data: validated };
  } catch (error) {
    // Handle Zod validation errors
    if (error instanceof z.ZodError) {
      // Access error.issues array
      const issues = error.issues;
      if (issues && Array.isArray(issues) && issues.length > 0) {
        const firstIssue = issues[0];
        if (firstIssue && firstIssue.message) {
          return { error: firstIssue.message };
        }
      }
      return { error: 'Validation failed' };
    }
    
    // Handle other errors (including transform errors from Zod)
    if (error instanceof Error) {
      return { error: error.message || 'Validation failed' };
    }
    
    // Re-throw unexpected errors so they can be caught by the action's catch block
    // This allows structured logging to capture them
    throw error;
  }
}

