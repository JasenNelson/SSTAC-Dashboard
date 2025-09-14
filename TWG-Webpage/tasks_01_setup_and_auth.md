### **tasks\_01\_setup\_and\_auth.md**

This is the first task file. It breaks down the initial work into clear, actionable user stories with specific acceptance criteria, guiding the AI's first steps for extending the existing SSTAC & TWG Dashboard system.

# **Task: TWG Review System Integration & Authentication**

## **Epic**

TWG Review System Integration with Existing SSTAC & TWG Dashboard

## **User Story 1: Database Schema Extension**

**As a developer, I want to extend the existing database schema to support TWG review functionality so that review data can be properly stored and managed.**

**Acceptance Criteria:**

1. **Verify existing database schema** is functional and all tables are accessible
2. **Create review_submissions table** with proper RLS policies:
   - id (PK, UUID)
   - user_id (FK to auth.users.id, UUID)
   - status (Enum: 'IN_PROGRESS', 'SUBMITTED')
   - form_data (JSONB) - Stores the entire form state
   - created_at, updated_at (Timestamps)
3. **Create review_files table** for uploaded documents:
   - id (PK, UUID)
   - submission_id (FK to review_submissions.id, UUID)
   - filename (String)
   - file_path (String)
   - mimetype (String)
   - uploaded_at (Timestamp)
4. **Implement RLS policies** for data security and user isolation
5. **Test database connectivity** and verify all existing functionality remains intact

## **User Story 2: Authentication Integration**

**As a TWG member, I want to access the review system using the existing authentication so that I can seamlessly use the platform.**

**Acceptance Criteria:**

1. **Leverage existing Supabase Auth** system for user authentication
2. **Extend existing user role system** to include 'TWG_MEMBER' role
3. **Utilize existing admin role management** for review system administration
4. **Implement TWG-specific access controls** using existing RLS policies
5. **Test authentication flow** with existing login/signup pages
6. **Verify admin badge persistence** works with new review functionality

## **User Story 3: Review Form Page Creation**

**As a TWG member, I want to access a comprehensive review form so that I can provide detailed feedback on the sediment standards report.**

**Acceptance Criteria:**

1. **Create /twg/review page** following existing Next.js 15+ App Router patterns
2. **Implement Server Component** for authentication and initial data loading
3. **Create Client Component** for interactive form functionality
4. **Integrate with existing theme system** (dark/light mode support)
5. **Implement responsive design** using existing Tailwind CSS patterns
6. **Add navigation sidebar** using existing navigation component patterns
7. **Implement "Save Progress" functionality** using existing API route patterns

## **User Story 4: API Routes Implementation**

**As a developer, I want to create API routes for the review system so that form data can be saved and retrieved securely.**

**Acceptance Criteria:**

1. **Create /api/review/save endpoint** for saving form progress
2. **Create /api/review/submit endpoint** for final submission
3. **Create /api/review/upload endpoint** for file uploads
4. **Implement proper authentication checks** using existing patterns
5. **Add admin status refresh** after CRUD operations
6. **Test API endpoints** with existing authentication system
7. **Verify RLS policies** protect user data appropriately

## **User Story 5: Admin Dashboard Integration**

**As an admin, I want to view and manage TWG review submissions so that I can monitor progress and analyze feedback.**

**Acceptance Criteria:**

1. **Extend existing admin dashboard** with review management section
2. **Create review submissions table** using existing admin table patterns
3. **Implement review data visualization** using existing chart components
4. **Add review export functionality** using existing export patterns
5. **Integrate with existing admin navigation** and layout
6. **Test admin functionality** with existing admin role system
7. **Verify admin badge persistence** works with new review features

## **User Story 6: Form Sections Implementation**

**As a TWG member, I want to complete all review sections so that I can provide comprehensive feedback on the sediment standards report.**

**Acceptance Criteria:**

1. **Implement Part 1: Reviewer Information** with existing form patterns
2. **Implement Part 2: High-Level Report Assessment** with rating scales
3. **Implement Part 3: Matrix Sediment Standards Framework** with ranking polls
4. **Implement Part 4: Tiered Assessment Approach** with multiple choice and ranking
5. **Implement Part 5: Integration of Indigenous Knowledge** with multi-select
6. **Implement Part 6: Prioritization and Strategic Direction** with ranking polls
7. **Implement Part 7: Line-by-Line Comments** with file upload functionality
8. **Implement Part 8: Final Recommendations** with text areas
9. **Test all form sections** with existing validation and error handling patterns