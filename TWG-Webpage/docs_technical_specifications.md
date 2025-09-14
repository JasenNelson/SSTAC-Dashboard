### **4\. docs/technical\_specifications.md**

This file contains the specific, detailed requirements for the SSTAC & TWG Dashboard project's features, database schema, and API endpoints based on the actual production system.

# **Technical Specifications - SSTAC & TWG Dashboard**

## **1\. Database Schema (PostgreSQL with Supabase)**

### **Core Tables (ACTUAL SCHEMA)**

**auth.users (Supabase Managed):**
* id (PK, UUID) - Supabase auth user ID
* email (String, unique) - User email address
* created_at, updated_at (Timestamps)

**user_roles:**
* user_id (FK to auth.users.id, UUID)
* role (Enum: 'admin', 'member') - Automatic assignment via triggers
* created_at, updated_at (Timestamps)

**discussions:**
* id (PK, UUID)
* title (String)
* content (Text)
* user_id (FK to auth.users.id, UUID)
* created_at, updated_at (Timestamps)

**likes:**
* id (PK, UUID)
* user_id (FK to auth.users.id, UUID)
* discussion_id (FK to discussions.id, UUID)
* created_at (Timestamp)

**documents:**
* id (PK, UUID)
* title (String)
* description (Text)
* file_path (String)
* file_type (String)
* created_at, updated_at (Timestamps)

**tags:**
* id (PK, UUID)
* name (String, unique)
* color (String)
* created_at, updated_at (Timestamps)

**announcements:**
* id (PK, UUID)
* title (String)
* content (Text)
* is_active (Boolean)
* created_at, updated_at (Timestamps)

**milestones:**
* id (PK, UUID)
* title (String)
* description (Text)
* due_date (Date)
* status (Enum: 'pending', 'in_progress', 'completed')
* created_at, updated_at (Timestamps)

### **Poll System Tables**

**polls:**
* id (PK, UUID)
* question (Text)
* options (JSONB) - Array of poll options
* poll_type (Enum: 'single_choice', 'ranking')
* is_active (Boolean)
* created_at, updated_at (Timestamps)

**poll_votes:**
* id (PK, UUID)
* poll_id (FK to polls.id, UUID)
* user_id (String) - UUID for authenticated users, CEW code for conference
* selected_option (String)
* created_at, updated_at (Timestamps)

**ranking_polls:**
* id (PK, UUID)
* question (Text)
* options (JSONB) - Array of ranking options
* is_active (Boolean)
* created_at, updated_at (Timestamps)

**ranking_votes:**
* id (PK, UUID)
* ranking_poll_id (FK to ranking_polls.id, UUID)
* user_id (String) - UUID for authenticated users, CEW code for conference
* option_id (String)
* rank_value (Integer)
* created_at, updated_at (Timestamps)

### **Database Views (ACTUAL)**

**users_overview:**
* Comprehensive user information with email addresses
* Activity statistics and engagement metrics
* Role information and admin status

**admin_users_comprehensive:**
* Complete user management view for admin dashboard
* 100% user visibility with real email addresses
* Activity tracking and engagement metrics

**discussion_stats:**
* Discussion engagement statistics
* Like counts and user interaction metrics
* Content analysis data

**poll_results:**
* Aggregated poll results for visualization
* Vote counts and percentage calculations
* Real-time result updates

**ranking_results:**
* Aggregated ranking poll results
* Weighted average scores
* Priority ranking visualizations

## **2\. API Endpoints (ACTUAL SYSTEM)**

Base URL: /api

### **Authentication Endpoints**
* **POST /auth/callback:** Supabase auth callback handler
* **GET /auth/session:** Get current user session

### **Discussion Forum Endpoints**
* **GET /discussions:** Get all discussions with pagination
* **POST /discussions:** Create new discussion (authenticated users only)
* **GET /discussions/[id]:** Get specific discussion with replies
* **POST /discussions/[id]/like:** Toggle like on discussion
* **DELETE /discussions/[id]:** Delete discussion (admin only)

### **Document Management Endpoints**
* **GET /documents:** Get all documents with filtering
* **POST /documents:** Upload new document
* **GET /documents/[id]:** Get specific document
* **DELETE /documents/[id]:** Delete document (admin only)

### **Poll System Endpoints**
* **GET /polls/results:** Get poll results for visualization
* **POST /polls/submit:** Submit poll vote
* **GET /ranking-polls/results:** Get ranking poll results
* **POST /ranking-polls/submit:** Submit ranking poll vote

### **CEW Poll Endpoints (Conference Attendees)**
* **GET /cew-polls/results:** Get CEW poll results
* **POST /cew-polls/submit:** Submit CEW poll vote
* **GET /cew-polls/ranking-results:** Get CEW ranking results
* **POST /cew-polls/ranking-submit:** Submit CEW ranking vote

### **Admin Management Endpoints**
* **GET /admin/users:** Get all users for admin management
* **POST /admin/users/[id]/role:** Update user role
* **GET /admin/announcements:** Get all announcements
* **POST /admin/announcements:** Create announcement
* **GET /admin/milestones:** Get all milestones
* **POST /admin/milestones:** Create milestone

### **Tag Management Endpoints**
* **GET /tags:** Get all tags
* **POST /tags:** Create new tag
* **PUT /tags/[id]:** Update tag
* **DELETE /tags/[id]:** Delete tag

## **3\. Frontend Feature Requirements (ACTUAL SYSTEM)**

### **Authentication System**
* **Login Page:** Supabase auth integration with email/password
* **Signup Page:** User registration with automatic role assignment
* **CEW Code Input:** Conference attendee authentication
* **Admin Role Verification:** Automatic admin badge display

### **Dashboard Features**
* **Main Dashboard:** Project overview with statistics and recent activity
* **Discussion Forum:** Interactive forum with like system
* **Document Management:** File upload, download, and organization
* **Poll System:** Single-choice and ranking polls with real-time results
* **Admin Dashboard:** User management, content management, analytics

### **Admin Management Features**
* **User Management:** Complete user visibility with email addresses
* **Content Management:** Announcements, milestones, tags
* **Analytics Dashboard:** Engagement metrics and user activity
* **Poll Results:** Real-time poll result visualization
* **CEW Statistics:** Conference attendee engagement tracking

### **Theme System**
* **Dark/Light Mode:** CSS custom properties with React Context
* **Responsive Design:** Mobile-first approach with Tailwind CSS
* **Accessibility:** ARIA labels and keyboard navigation

### **Real-time Features**
* **Live Updates:** Supabase real-time subscriptions
* **Poll Results:** Real-time poll result updates
* **Discussion Activity:** Live discussion updates
* **Admin Notifications:** Real-time admin status updates

## **4\. Security Implementation (ACTUAL)**

### **Row Level Security (RLS)**
* All tables have RLS policies enabled
* User data isolation and protection
* Admin override capabilities
* CEW conference attendee access controls

### **Authentication Security**
* Supabase Auth with JWT tokens
* Session management and persistence
* CSRF protection via Next.js
* Input validation and sanitization

### **Admin Security**
* Role-based access control
* Admin badge persistence system
* Comprehensive admin status management
* Audit logging for sensitive operations

## **5\. Performance Optimizations (ACTUAL)**

### **Next.js 15+ Optimizations**
* Server Components for initial rendering
* Client Components for interactivity
* Automatic code splitting
* Image optimization
* Static generation where possible

### **Database Optimizations**
* Efficient RLS policies
* Optimized queries with proper indexing
* Real-time subscription management
* Query result caching

### **Client-side Optimizations**
* React Context for state management
* localStorage backup for offline functionality
* Efficient re-rendering patterns
* Mobile-optimized UI components

