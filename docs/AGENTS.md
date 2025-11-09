# AGENTS.md for SSTAC & TWG Dashboard

## 🎯 Project Overview
A comprehensive dashboard platform for the **Sediment Standards Technical Advisory Committee (SSTAC)** and **Technical Working Group (TWG)**. This platform manages sediment standards development through stakeholder engagement, document management, and administrative tools.

**Current Status**: Production-ready platform with comprehensive testing infrastructure, code quality improvements, security enhancements, and all core features operational. **TESTING INFRASTRUCTURE ESTABLISHED** (Weeks 1-16) - Unit tests (122 tests, Vitest), E2E tests (Playwright), CI/CD integration, and k6 load tests (23 tests). **CODE QUALITY IMPROVEMENTS** - Supabase utility centralization (16 routes migrated), 200+ lines of duplicate code eliminated, conditional logging, code cleanup. **PHASE 3 COMPLETE** (November 2025) - Zod validation for all non-poll APIs, structured logging implemented, rate limiting integrated, authorization review complete, ErrorBoundary implemented. Grade improvement: C (66%) → B+ (83-84%). All poll system functionality working correctly with comprehensive documentation. Wordcloud poll system, matrix graph visualization, and admin panel fully operational. See `docs/review-analysis/MASTER_COMPLETION_SUMMARY.md` and `docs/review-analysis/PHASE3_COMPLETION_SUMMARY.md` for detailed progress.

## 🎯 Core Development Principles

### 1. "If It Ain't Broke, Don't Fix It" (CRITICAL)
- **NEVER optimize working systems** without explicit user request and clear justification
- **ALWAYS verify the problem exists** before implementing solutions
- **MEASURE before and after** to ensure changes actually improve things
- **TRUST user feedback** about when things were working
- **HISTORICAL CONTEXT**: AI previously added throttling to `refreshGlobalAdminStatus()` which broke the discussions page

### 2. "First, Do No Harm"
- **TEST changes in isolation** before applying them broadly
- **UNDERSTAND dependencies** before modifying core functions
- **HAVE rollback plans** ready for any changes
- **ASK "what changed?"** when issues arise

### 3. Architecture Adherence
- **Follow Next.js 15+ App Router patterns** strictly
- **Use Server Components** for authentication and initial data loading
- **Use Client Components** for interactive UI and state management
- **Implement API Route Architecture** for client-server communication

### 4. Admin Badge Persistence
- **Never allow admin badge to disappear** after operations
- **Implement comprehensive admin status management** in all admin components
- **Use the global refresh function** `refreshGlobalAdminStatus()` after CRUD operations
- **Include localStorage backup** for temporary database issues

### 5. Admin Panel Navigation & UI Guidelines (CRITICAL)
- **Bidirectional Question Navigation**: Left/right arrow buttons between question number and expand button
- **Smart Group Navigation**: Navigate only within current poll group (Holistic Protection, Tiered Framework, etc.)
- **Wrap-Around Behavior**: Seamlessly cycle from last question back to first, and vice versa
- **QR Code Expansion**: Click-to-expand functionality for conference display with proper z-index management
- **Enhanced Blue Bars**: Use h-5 (20px) for normal view, h-8 (32px) for expanded view for better visibility
- **Z-Index Layering**: Expanded view uses z-[60], refresh button uses z-50, ensure proper layering
- **Responsive Positioning**: Expanded view uses left-20 when panel hidden to avoid refresh button obstruction
- **Header Clearance**: Expanded view positioned at top-20 to avoid header overlap

### 6. Component Architecture
- **Server Components**: Handle authentication, database queries, and initial rendering
- **Client Components**: Handle user interactions, state management, and real-time updates
- **API Routes**: Bridge between client components and server actions
- **Server Actions**: Handle database operations with proper validation

### 7. Performance Optimization Guidelines (CRITICAL)
- **MEASURE FIRST**: Check if performance issues actually exist before optimizing
- **Database Performance**: Baseline established (100% cache hit rate, all queries < 1ms avg) - See `docs/review-analysis/MONITORING_BASELINE.md`
- **Monitoring**: Use `scripts/verify/simple-query-monitoring.sql` for weekly performance tracking
- **ISOLATE TESTING**: Test optimizations in separate branches first
- **USER CONSULTATION**: Ask if "excessive" calls are actually problematic
- **GRADUAL ROLLOUT**: Implement optimizations as optional features first
- **NEVER modify core functions** without understanding all dependencies
- **ALWAYS have rollback plans** for any performance changes

### 8. Poll and Ranking Question System Guidelines (CRITICAL)
- **THREE COMPLETELY SEPARATE SYSTEMS**: Single-choice polls, ranking polls, and wordcloud polls are independent systems
  - **Single-choice**: `polls` table + `poll_votes` table + `poll_results` view
  - **Ranking**: `ranking_polls` table + `ranking_votes` table + `ranking_results` view
  - **Wordcloud**: `wordcloud_polls` table + `wordcloud_votes` table + `wordcloud_results` view
  - **NEVER mix**: Don't put ranking questions in `polls` table or single-choice in `ranking_polls` table or wordcloud in other tables
- **VOTE COUNTING DIFFERS**: 
  - **Single-choice**: Sum of all individual votes (5 users = 5 votes displayed)
  - **Ranking**: Count of unique participants (3 users rank 4 options each = 3 responses displayed, not 12)
  - **Wordcloud**: Count of unique participants and word frequency aggregation (3 users submit 2 words each = 3 responses, 6 total words)
- **CRITICAL: ranking_results View Array Indexing**: The ranking_results view uses `rp.options[option_stats.option_index]` (NOT +1). The option_index values in ranking_votes table are 0-based (0,1,2,3) and the options JSONB array is also 0-based. Adding +1 breaks the mapping and causes blank option text in admin panel. NEVER modify this line: `'option_text', rp.options[option_stats.option_index]`. The system uses 0-based indexing throughout - do not "fix" what appears to be a 1-based vs 0-based issue.
- **CRITICAL: View Security Invoker (RECURRING ISSUE)**: Supabase repeatedly warns about missing `WITH (security_invoker = on)` in view definitions. This is a RECURRING issue that occurs multiple times. ALWAYS include `WITH (security_invoker = on)` when creating or updating views. Apply to ALL views for consistency and security. This prevents security vulnerabilities in production.
- **CRITICAL: Wordcloud Division by Zero (NEW ISSUE)**: The wordcloud_results view MUST include division by zero protection in percentage calculations. Without this, empty wordcloud polls cause division by zero errors and prevent admin panel from loading. ALWAYS use `CASE WHEN tc.total_words IS NULL OR tc.total_words = 0 THEN 0.0 ELSE ROUND(...) END` for percentage calculations.
- **CSV EXPORTS ARE TRUTH**: Always verify system state with actual database exports, not assumptions
- **ADMIN PANEL COMPLEXITY**: Question matching logic between survey and CEW versions is sophisticated
- **NEVER ASSUME MISSING DATA**: Check all three tables (`polls`, `ranking_polls`, `wordcloud_polls`) before concluding polls are missing
- **PRIVACY FIRST**: For CEW polls, avoid client-side persistence to ensure true privacy in incognito mode
- **SIMPLIFY CONSTRAINTS**: Complex unique constraints can cause submission failures - prefer application-level uniqueness
- **ANONYMOUS CLIENTS**: Use null cookie handlers for Supabase clients in CEW poll API routes
- **CEW MULTIPLE SUBMISSIONS**: CEW polls allow multiple submissions from same conference code (CEW2025) - each submission gets unique user_id: `${authCode}_${timestamp}_${randomSuffix}`
- **CEW NO DELETIONS**: CEW submissions are never deleted - all responses preserved for conference attendees
- **CEW VS AUTHENTICATED**: Authenticated users get vote replacement (delete + insert), CEW users get additive submissions
- **UI CONTRAST**: Ensure ranking buttons have proper contrast in both light and dark modes
- **ALWAYS test poll functionality** after any database changes
- **UNDERSTAND poll types**: Single-choice polls vs ranking polls have different data structures
- **PRESERVE vote persistence**: Votes must be remembered across sessions
- **MAINTAIN mobile optimization**: Clean charts without excessive hover tooltips
- **RESPECT authentication modes**: Both authenticated users and CEW conference attendees
- **VERIFY RLS policies**: Poll data must be properly isolated by user
- **TEST vote tracking**: Ensure device-based tracking works for CEW polls

### 9. Code Quality and Production Readiness Guidelines (CRITICAL)
- **BUILD SUCCESS**: Always ensure successful production build before committing
- **TYPE SAFETY**: Replace TypeScript `any` types with proper type definitions
- **JSX COMPLIANCE**: Fix all unescaped quotes in JSX components using proper HTML entities
- **IMPORT CLEANUP**: Remove unused imports and variables
- **LINTING**: Address critical linting errors, warnings are acceptable for non-critical issues
- **PRODUCTION READY**: Code must be suitable for production deployment
- **QUOTE ESCAPING**: Use `&apos;` for apostrophes, `&ldquo;` and `&rdquo;` for quotes
- **TYPE DEFINITIONS**: Create proper interfaces for API responses and component props
- **BUILD VERIFICATION**: Run `npm run build` to verify compilation success

### 10. UI/UX Color Contrast Guidelines (CRITICAL)
- **LIGHT MODE**: Colored backgrounds MUST use dark text (`text-gray-900`) for proper contrast and readability
- **DARK MODE**: Colored backgrounds MUST use light text (`text-white` or theme-specific light colors) for proper contrast
- **NEVER USE**: Light text on light backgrounds or dark text on dark backgrounds
- **APPLIES TO**: All buttons, cards, containers, and interactive elements
- **TEST BOTH MODES**: Always verify proper contrast ratios in both light and dark modes for accessibility
- **HISTORICAL CONTEXT**: This has been a recurring issue requiring multiple fixes for proper readability

### 11. Complex Data Integration Debugging Guidelines (CRITICAL)
- **ALWAYS verify data sources** before implementing complex data combination logic
- **UNDERSTAND data types** - Ranking polls vs single-choice polls have different vote counting logic
- **TEST data combination** with known data sets before deploying
- **ADD comprehensive logging** for data flow through complex systems
- **VERIFY path patterns** - Ensure all poll paths follow consistent patterns
- **DOCUMENT data flow** - Map out how data moves through the system
- **TEST edge cases** - Empty data, missing fields, type mismatches
- **HISTORICAL CONTEXT**: Admin poll results system had complex data integration issues causing incorrect vote counts

### 12. TypeScript Build Safety Guidelines (CRITICAL)
- **NO implicit `any` types** - Always provide explicit type annotations
- **FIX TypeScript errors** before attempting production builds
- **USE proper type definitions** for complex data structures
- **TEST builds frequently** during development to catch type issues early
- **HISTORICAL CONTEXT**: Missing type annotations caused production build failures

## 🗳️ **Poll and Ranking Question System Development Guidelines**

### **System Architecture Understanding**
- **Two Poll Types**: Single-choice polls (`polls` table) and ranking polls (`ranking_polls` table)
- **Vote Storage**: `poll_votes` for single-choice, `ranking_votes` for ranking polls
- **Result Views**: `poll_results` and `ranking_results` for aggregated data
- **API Endpoints**: Separate endpoints for each poll type with unified authentication
- **UI Components**: `PollWithResults`, `RankingPoll`, `PollResultsChart`

### **Database Schema Requirements**
- **NEVER modify poll tables** without understanding all dependencies
- **PRESERVE RLS policies** for user isolation and admin access
- **MAINTAIN data integrity** with proper foreign key relationships
- **RESPECT user_id constraints** (UUIDs for authenticated, CEW codes for conference)
- **VERIFY helper functions** (`get_or_create_poll`, `get_or_create_ranking_poll`)

### **Authentication Modes**
- **Authenticated Users**: Use UUID from `auth.users` table
- **CEW Conference**: Use unique user_id generation `${authCode}_${timestamp}_${randomSuffix}` for each submission
- **Vote Tracking**: `localStorage` for CEW polls, database for authenticated users
- **Session Persistence**: Votes remembered across sessions for both modes
- **CEW Multiple Submissions**: Each submission gets unique user_id, enabling multiple attendees to use same CEW2025 code
- **CEW No Deletions**: CEW submissions are never deleted - all responses preserved

### **Mobile Optimization Requirements**
- **Clean Charts**: NO excessive hover tooltips for mobile readability
- **Responsive Design**: Charts must adapt to different screen sizes
- **Touch-Friendly**: Large buttons and touch targets
- **Fast Loading**: Optimized for conference mobile devices

### **Vote Persistence Rules**
- **Single-Choice**: One vote per user per poll (upsert on change)
- **Ranking**: Multiple votes per user per poll (one per option)
- **Change Votes**: Allowed for authenticated users, NOT for CEW polls
- **Device Tracking**: Prevents duplicate votes per device for CEW polls
- **CEW Multiple Submissions**: Each submission gets unique user_id, allowing multiple responses from same CEW2025 code
- **CEW No Deletions**: CEW submissions are never deleted - all responses preserved

### **API Development Guidelines**
- **Use Helper Functions**: Always use `get_or_create_poll()` and `get_or_create_ranking_poll()`
- **Handle Both Auth Modes**: Support both authenticated and CEW authentication
- **Validate Input**: Ensure selected options exist and user has permission
- **Error Handling**: Graceful handling of RLS violations and constraint errors
- **Performance**: Optimized queries with proper indexing

### **Component Development Guidelines**
- **PollWithResults**: For single-choice polls with real-time results
- **RankingPoll**: For ranking polls with drag-and-drop interface
- **PollResultsChart**: For displaying poll results with clean charts
- **PollResultsClient**: Enhanced with single-question display and expandable navigation ✅ NEW
- **Mobile-First**: Design for mobile devices first, desktop second
- **Accessibility**: Ensure proper ARIA labels and keyboard navigation

### **Testing Requirements**
- **Vote Persistence**: Test that votes are remembered across sessions
- **Mobile Responsiveness**: Test on various mobile device sizes
- **Authentication Modes**: Test both authenticated and CEW modes
- **Error Handling**: Test RLS violations and constraint errors
- **Performance**: Test with large numbers of votes and polls

### **Common Issues and Solutions**
- **Votes Not Persisting**: Check RLS policies and user authentication
- **Results Not Updating**: Verify API endpoints and database views
- **Mobile Display Issues**: Check responsive design and hover tooltips
- **CEW Code Issues**: Verify sessionStorage and localStorage usage
- **RLS Violations**: Ensure proper user authentication and permissions

## 🚫 CRITICAL: Never Suggest These "Fixes"

### Database Issues (RESOLVED - Don't Fix)
- ❌ **NEVER suggest turning off RLS** - it's required for security and is working
- ❌ **NEVER recreate existing policies** - check first with verification queries
- ❌ **NEVER suggest role assignment fixes** - the system is already working automatically
- ❌ **NEVER assume tables/views are missing** - verify with status queries first
- ❌ **NEVER suggest recreating database objects** - all are implemented and functional

### Database Safety Protocol (CRITICAL)
- 🚨 **ALWAYS conduct safety checks** before ANY database changes
- 🚨 **NEVER assume database state** - always verify current structure first
- 🚨 **ALWAYS test existing functionality** before making changes
- 🚨 **ALWAYS provide rollback scripts** for any database modifications
- 🚨 **ALWAYS make incremental changes** - one change at a time
- 🚨 **HISTORICAL CONTEXT**: AI has previously provided SQL scripts that replaced and duplicated functional database policies, causing significant harm and days of lost debugging time

### User Management Issues (RESOLVED - Don't Fix)
- ❌ **NEVER suggest fixing user visibility** - 100% user coverage is implemented
- ❌ **NEVER suggest fixing email display** - real emails are working for all users
- ❌ **NEVER suggest fixing role assignment** - automatic assignment is functional
- ❌ **NEVER suggest fixing admin dashboard** - fully operational

### Authentication Issues (RESOLVED - Don't Fix)
- ❌ **NEVER suggest fixing admin badge persistence** - comprehensive system implemented
- ❌ **NEVER suggest fixing logout functionality** - resolved and working
- ❌ **NEVER suggest fixing role checking** - optimized and functional

### Performance Optimization Issues (CRITICAL LESSON)
- ❌ **NEVER optimize working systems** without explicit user request and clear justification
- ❌ **NEVER add throttling/rate limiting** to core functions without measuring actual performance impact
- ❌ **NEVER modify authentication functions** that other systems depend on
- ❌ **HISTORICAL CONTEXT**: AI previously added throttling to `refreshGlobalAdminStatus()` to reduce "excessive" calls, but this broke the discussions page by preventing legitimate database queries from running

## ✅ ALWAYS Verify Before Suggesting Changes

### Mandatory Pre-Action Checks
Before suggesting ANY database changes, run these verification queries:

**CRITICAL SAFETY PROTOCOL**: Always conduct comprehensive safety checks before ANY database modifications. Historical context: AI has previously provided SQL scripts that replaced and duplicated functional database policies, causing significant harm and days of lost debugging time.

```sql
-- Check current system status
SELECT 'System Status' as check_type, 'VERIFY BEFORE ACTING' as instruction;

-- Verify all required tables exist
SELECT table_name, 'EXISTS' as status 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('user_roles', 'discussions', 'likes', 'documents', 'tags', 'announcements', 'milestones');

-- Verify all required views exist
SELECT table_name, 'EXISTS' as status 
FROM information_schema.views 
WHERE table_schema = 'public' 
AND table_name IN ('users_overview', 'admin_users_comprehensive', 'discussion_stats', 'documents_with_tags');

-- Verify all required functions exist
SELECT routine_name, 'EXISTS' as status 
FROM information_schema.routines 
WHERE routine_name IN ('get_users_with_emails', 'handle_new_user', 'update_updated_at_column');

-- Verify all required triggers exist
SELECT trigger_name, 'EXISTS' as status 
FROM information_schema.triggers 
WHERE trigger_name = 'on_auth_user_created';
```

## 🔍 Common "Problems" and Their Real Status

### ❌ "Users not visible in admin dashboard"
- **Real Status**: ✅ WORKING - 100% user visibility implemented
- **Don't Fix**: This is not a problem
- **Verify**: Check admin_users_comprehensive view
- **Documentation**: See USER_MANAGEMENT_SYSTEM.md

### ❌ "Role assignment not working"
- **Real Status**: ✅ WORKING - Automatic via triggers
- **Don't Fix**: This is not a problem
- **Verify**: Check on_auth_user_created trigger
- **Documentation**: See PHASE_3_COMPLETION.md

### ❌ "Database views missing"
- **Real Status**: ✅ WORKING - All views implemented
- **Don't Fix**: This is not a problem
- **Verify**: Check create_missing_views.sql status
- **Documentation**: See create_missing_views.sql

### ❌ "RLS policies causing issues"
- **Real Status**: ✅ WORKING - Optimized and functional
- **Don't Fix**: This is not a problem
- **Verify**: Check pg_policies table
- **Documentation**: See database_schema.sql

### ❌ "Admin badge disappearing"
- **Real Status**: ✅ WORKING - Comprehensive persistence system implemented
- **Don't Fix**: This is not a problem
- **Verify**: Check admin-utils.ts implementation
- **Documentation**: See instructions.md

## 🏗️ Architecture Requirements

### Technology Stack
- **Frontend**: Next.js 15+ with App Router, TypeScript, Tailwind CSS v4
- **Backend**: Supabase (PostgreSQL, Authentication, Real-time features)
- **State Management**: React hooks with localStorage backup
- **Theme System**: React Context API with CSS custom properties
- **Deployment**: Vercel

### Implementation Requirements

#### 1. Admin Status Persistence
Every admin component must:
- **Import** `refreshGlobalAdminStatus` from `@/lib/admin-utils`
- **Call** the refresh function after successful CRUD operations
- **Include** admin status refresh on component mount
- **Handle** errors gracefully with fallback to cached admin status

#### 2. Client Component Pattern
```typescript
'use client';

import { useEffect } from 'react';
import { refreshGlobalAdminStatus } from '@/lib/admin-utils';

export default function AdminPageClient() {
  // Refresh admin status when component mounts
  useEffect(() => {
    const refreshAdmin = async () => {
      console.log('🔄 Admin page mounted - refreshing admin status');
      await refreshGlobalAdminStatus();
    };
    
    refreshAdmin();
  }, []);

  // ... component implementation
}
```

#### 3. CRUD Operation Pattern
```typescript
const handleCreateItem = async (formData: FormData) => {
  try {
    const response = await fetch('/api/items', {
      method: 'POST',
      body: formData,
    });
    
    const result = await response.json();
    
    if (result?.success) {
      // Refresh admin status to ensure badge persists
      await refreshGlobalAdminStatus();
      // ... other success handling
    }
  } catch (error) {
    // ... error handling
  }
};
```

#### 4. Server Component Pattern
```typescript
import { createServerClient } from '@supabase/ssr';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import AdminPageClient from './AdminPageClient';

export default async function AdminPage() {
  // Authentication and admin role check
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  
  const { data: roleData } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .eq('role', 'admin')
    .single();
  
  if (!roleData) redirect('/dashboard');
  
  // Return client component
  return <AdminPageClient />;
}
```

### Component Architecture (CRITICAL)
- **Server Components**: Handle authentication, database queries, initial rendering
- **Client Components**: Handle user interactions, state management, real-time updates
- **API Routes**: Bridge between client components and server actions
- **Server Actions**: Handle database operations with proper validation

### File Structure Requirements
```
src/app/(dashboard)/admin/
├── page.tsx                    # Server component for auth + AdminDashboardClient
├── AdminDashboardClient.tsx    # Client component with admin refresh
├── users/                      # User management
├── tags/                       # Tag management
├── announcements/              # Announcement management
└── milestones/                 # Milestone management
```

## 🔐 Admin Badge Persistence (CRITICAL REQUIREMENT)

### Implementation Rules
- **NEVER allow admin badge to disappear** after operations
- **ALWAYS import** `refreshGlobalAdminStatus` from `@/lib/admin-utils`
- **ALWAYS call** the refresh function after successful CRUD operations
- **ALWAYS include** admin status refresh on component mount
- **ALWAYS handle** errors gracefully with fallback to cached admin status

### Required Pattern
```typescript
'use client';

import { useEffect } from 'react';
import { refreshGlobalAdminStatus } from '@/lib/admin-utils';

export default function AdminPageClient() {
  // Refresh admin status when component mounts
  useEffect(() => {
    const refreshAdmin = async () => {
      console.log('🔄 Admin page mounted - refreshing admin status');
      await refreshGlobalAdminStatus();
    };
    
    refreshAdmin();
  }, []);

  // ... component implementation
}
```

### CRUD Operation Pattern
```typescript
const handleCreateItem = async (formData: FormData) => {
  try {
    const response = await fetch('/api/items', {
      method: 'POST',
      body: formData,
    });
    
    const result = await response.json();
    
    if (result?.success) {
      // Refresh admin status to ensure badge persists
      await refreshGlobalAdminStatus();
      // ... other success handling
    }
  } catch (error) {
    // ... error handling
  }
};
```

## 🗄️ Database Schema Knowledge (CRITICAL)

### Table Structure Understanding
- **`user_roles` table**: Contains ONLY user_id (UUID) + role, NOT emails
- **`auth.users` table**: Supabase managed, contains emails but NOT roles
- **`discussions` table**: Forum threads with user tracking
- **`likes` table**: User interactions with discussions and replies
- **`documents` table**: File storage with metadata (no user tracking)

### Key Relationships
- **Role assignment**: Automatic via `on_auth_user_created` trigger
- **User discovery**: Through `get_users_with_emails()` function
- **Activity tracking**: Via `users_overview` and `admin_users_comprehensive` views
- **Security**: Row Level Security (RLS) on all tables

### Current Implementation Status
- ✅ **All tables created** with proper RLS policies
- ✅ **All views implemented** and functional
- ✅ **All functions created** and working
- ✅ **All triggers active** and functional
- ✅ **Enhanced like system** complete and operational

## 🚀 Development Commands

### Setup Commands
- Install deps: `npm install`
- Start dev server: `npm run dev`
- Database setup: Run `database_schema.sql` in Supabase SQL Editor
- Verify views: Check `create_missing_views.sql` status

### Testing Commands
- Test user management: `npm run test:users`
- Test admin capabilities: `npm run test:admin`
- Test database functions: `npm run test:db`
- Test RLS policies: `npm run test:security`

### Database Health Checks
```sql
-- Monitor user growth
SELECT COUNT(*) FROM admin_users_comprehensive;

-- Check role distribution
SELECT role, COUNT(*) FROM user_roles GROUP BY role;

-- Verify function access
SELECT routine_name FROM information_schema.routines 
WHERE routine_name = 'get_users_with_emails';

-- Check RLS policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE tablename IN ('user_roles', 'discussions', 'likes');
```

## 🎨 Code Style Requirements

### TypeScript & React
- **TypeScript strict mode** for type safety
- **Single quotes**, no semicolons
- **Functional patterns** where possible
- **Component documentation** for maintainability

### Styling
- **Tailwind CSS v4** for utility-first styling
- **Responsive design** with mobile-first approach
- **Consistent color scheme** across all admin interfaces
- **Professional appearance** suitable for government stakeholders

### Component Styling
- **Rounded corners** (`rounded-2xl`) for modern appearance
- **Shadow effects** (`shadow-lg`, `shadow-xl`) for depth
- **Hover animations** (`hover:-translate-y-2`) for interactivity
- **Gradient backgrounds** for visual appeal

## 🔒 Security Requirements

### Authentication & Authorization
- **Supabase Auth** for secure user management
- **Role-based access control** for admin functions
- **Session management** with proper cleanup
- **Input sanitization** for all user inputs

### Data Protection
- **Row level security** on all database tables
- **Admin role verification** before sensitive operations
- **Audit logging** for important changes
- **Secure API endpoints** with proper validation

### RLS Policies (DON'T MODIFY)
- **All tables have RLS enabled** and working
- **Policies are optimized** and functional
- **Admin override** for full access
- **User isolation** for data protection

## 🧪 Testing Requirements

### Functionality Testing
- **Admin badge persistence** across all operations
- **CRUD operations** for all admin features
- **Error handling** for various failure scenarios
- **User experience** across different devices
- **Enhanced like system** functionality

### Security Testing
- **Authentication bypass** attempts
- **Admin privilege escalation** attempts
- **Input validation** for malicious inputs
- **Session management** security

### Performance Testing
- **Database queries** optimization
- **Component rendering** performance
- **User interactions** response time
- **Scalability** under load

## 🚨 Debugging Protocol (MANDATORY)

### Before Suggesting Any Fix
1. **NEVER suggest fixes** without first running verification queries
2. **ALWAYS check current status** before proposing changes
3. **ALWAYS reference existing documentation** before creating new solutions
4. **NEVER recreate existing functionality** - check if it already exists
5. **ALWAYS verify user's actual problem** vs. perceived problem

## 🎯 Development Principles (CRITICAL)

### "If It Ain't Broke, Don't Fix It"
- **NEVER optimize working systems** unless there's a specific, measurable performance problem
- **ALWAYS verify the problem exists** before implementing solutions
- **MEASURE before and after** to ensure changes actually improve things
- **TRUST user feedback** about when things were working

### "First, Do No Harm"
- **TEST changes in isolation** before applying them broadly
- **UNDERSTAND dependencies** before modifying core functions
- **HAVE rollback plans** ready for any changes
- **ASK "what changed?"** when issues arise

### Performance Optimization Guidelines
- **MEASURE FIRST**: Check if performance issues actually exist
- **ISOLATE TESTING**: Test optimizations in separate branches first
- **USER CONSULTATION**: Ask if "excessive" calls are actually problematic
- **GRADUAL ROLLOUT**: Implement optimizations as optional features first

### Verification Sequence
1. Run status queries from `create_missing_views.sql`
2. Check `database_schema.sql` for existing implementations
3. Review `PHASE_3_COMPLETION.md` for completed features
4. Consult `USER_MANAGEMENT_SYSTEM.md` for current capabilities
5. Only then suggest specific solutions

### Common Debugging Mistakes
- **Assuming problems exist** without verification
- **Suggesting fixes** for working systems
- **Recreating functionality** that already exists
- **Ignoring established patterns** and documentation

## 📚 Reference Documentation

### Primary Documents
- **`database_schema.sql`**: Complete database structure and current implementation
- **`create_missing_views.sql`**: Current implementation status (ALL COMPLETE)
- **`PHASE_3_COMPLETION.md`**: What's already working and completed
- **`USER_MANAGEMENT_SYSTEM.md`**: Current user management capabilities
- **`instructions.md`**: Detailed development guidelines and patterns

### Architecture Documents
- **`architecture.md`**: Technical architecture and implementation details
- **`migration_guide.md`**: Database migration and setup instructions
- **`DISCUSSION_FORUM_SETUP.md`**: Forum implementation and like system

### Project Status
- **`README.md`**: Project overview and feature descriptions
- **`PROJECT_MEMORY.md`**: Critical knowledge and troubleshooting history

## 🎯 Current Development Phase

### ✅ Completed Phases
- **Phase 1**: Basic dashboard and authentication
- **Phase 2**: Admin management system (mostly complete - 4/5 items)
- **Enhanced User Engagement**: Like system, user management (completed previously)
- **Phase 3**: Validation & Security (November 2025) - Zod validation, structured logging, rate limiting, authorization review, ErrorBoundary

### 🎯 Current Status
- **Grade**: B+ (83-84%) - Only 1-5 points remaining to reach A- (85-89%)
- **Production Ready**: All security, validation, and logging infrastructure complete
- **Next Steps**: See `docs/review-analysis/A_MINUS_ACHIEVEMENT_PLAN.md` for path to A-

### 🚀 Next Steps
- Optional TypeScript cleanup in non-poll areas
- Redis-based rate limiting (for multi-instance deployments)
- Component refactoring (deferred to maintenance window)

## 🚫 What NOT to Debug or Fix

### Working Systems (Don't Touch)
- ✅ User registration and role assignment
- ✅ Admin dashboard and user management
- ✅ Discussion forum and like system
- ✅ Document management and tagging
- ✅ RLS policies and security
- ✅ Admin badge persistence system
- ✅ Dark/light mode theme system

### Resolved Issues (Don't Revisit)
- ✅ Signup 500 errors (temporary Supabase service issues)
- ✅ Admin badge disappearing (comprehensive system implemented)
- ✅ User role assignment (automatic and functional)
- ✅ Database views missing (all implemented)
- ✅ RLS policy conflicts (optimized and working)
- ✅ Theme system background issues (CSS specificity resolved)

## 🐛 **CRITICAL DEBUGGING LESSONS LEARNED (2025)**

### **Lesson 1: Question Text Synchronization Issues**
**Problem**: Holistic protection questions showed different text in CEW polls vs admin panel vs database
**Root Cause**: Hardcoded question text in frontend components didn't match database content
**Bad Assumption**: "Frontend components fetch question text from database" - WRONG, they were hardcoded
**Solution**: Update ALL locations simultaneously - database, CEW polls, survey-results, admin panel, k6 tests
**Prevention**: Always verify data flow from database → API → frontend components

### **Lesson 2: Admin Panel Question Matching Failures**
**Problem**: Admin panel showed "Question not found" for submitted responses
**Root Cause**: `currentPollQuestions` array in admin panel didn't match actual database question text
**Bad Assumption**: "Admin panel automatically matches questions" - WRONG, requires exact text matching
**Solution**: Update `currentPollQuestions` array to match database question text exactly
**Prevention**: Implement question matching validation in admin panel

### **Lesson 3: Matrix Graph Data Integration Complexity**
**Problem**: Matrix graphs showed incorrect response counts (3 instead of 4)
**Root Cause**: API was not properly combining data from both `/survey-results` and `/cew-polls` paths
**Bad Assumption**: "Matrix graphs automatically aggregate all data" - WRONG, requires explicit data combination
**Solution**: Implement `combineResults` helper function to merge data from both paths
**Prevention**: Always test data aggregation with known data sets

### **Lesson 4: Database vs Frontend Discrepancies**
**Problem**: Database had placeholder text ("Question 3 text") while frontend showed correct text
**Root Cause**: Frontend components were hardcoded, not fetching from database
**Bad Assumption**: "All components fetch data from database" - WRONG, many are hardcoded
**Solution**: Update database to match frontend expectations, then update frontend to fetch from database
**Prevention**: Audit all components to ensure they fetch data from database

### **Lesson 5: Filter System Implementation Gaps**
**Problem**: Matrix graphs always showed combined data regardless of filter selection
**Root Cause**: Filter parameter wasn't being passed from frontend to API
**Bad Assumption**: "Filter system works automatically" - WRONG, requires explicit implementation
**Solution**: Pass `filterMode` from frontend to API and implement filtering logic
**Prevention**: Test all filter combinations with known data sets

### **Lesson 6: k6 Test Command Execution Errors**
**Problem**: `node k6-test.js` failed with module not found error
**Root Cause**: k6 scripts must be run with `k6 run` command, not `node`
**Bad Assumption**: "k6 scripts run like regular Node.js scripts" - WRONG, they're k6-specific
**Solution**: Use `k6 run k6-test.js` command
**Prevention**: Document proper execution commands for all test scripts

### **Lesson 7: Option Text Display Issues**
**Problem**: Admin panel showed "Option A", "Option B" instead of actual option text
**Root Cause**: Database `options` JSONB column contained placeholder values
**Bad Assumption**: "Option text is automatically generated" - WRONG, it's stored in database
**Solution**: Update `options` JSONB column with correct option strings
**Prevention**: Verify option text in database matches frontend expectations

### **Lesson 8: Poll Index vs Question Number Confusion**
**Problem**: Database `poll_index 0` corresponds to webpage "Question 1"
**Root Cause**: Zero-based indexing in database vs one-based indexing in UI
**Bad Assumption**: "poll_index matches question number" - WRONG, poll_index is zero-based
**Solution**: Always account for zero-based indexing when mapping database to UI
**Prevention**: Document indexing conventions clearly

### **Lesson 9: Duplicate Question Cleanup Issues**
**Problem**: Prioritization group showed Q1-5, 11-13 instead of Q1-5
**Root Cause**: Old duplicate questions (poll_index 10-12) still existed in database
**Bad Assumption**: "Database cleanup was complete" - WRONG, duplicates remained
**Solution**: Delete old duplicate questions from all poll tables
**Prevention**: Implement comprehensive cleanup verification

### **Lesson 10: TypeScript Build Safety**
**Problem**: Production build failed due to TypeScript errors
**Root Cause**: Missing type annotations and unescaped quotes in JSX
**Bad Assumption**: "Code compiles locally so it will build in production" - WRONG, stricter production settings
**Solution**: Fix all TypeScript errors and JSX compliance issues
**Prevention**: Run `npm run build` frequently during development

### **Lesson 11: Admin Panel Filtering Logic Inconsistency (2025)**
**Problem**: Left panel vote counts for ranking and wordcloud polls showed combined totals regardless of filter selection (e.g., 948, 947, 945 responses always shown)
**Root Cause**: Left panel used `(poll.combined_survey_votes || 0) + (poll.combined_cew_votes || 0)` for ranking/wordcloud polls instead of filtered results
**Bad Assumption**: "Left panel vote counts automatically respect filter mode" - WRONG, required explicit filtering logic
**Solution**: Updated `getFilteredPollResults` function to handle all poll types consistently and added wordcloud-specific logic
**Prevention**: Always test filtering functionality across all poll types and ensure consistent data flow

### **Lesson 12: K6 Test User ID Mismatch Issue (2025)**
**Problem**: K6 test submitted 12,018 votes but all used same user_id (`CEW2025_default`), making vote pairing impossible for matrix graphs
**Root Cause**: API ignored k6's `user_id` in JSON payload and generated its own from `x-session-id` header. K6 test didn't send `x-session-id` header, resulting in default `sessionId = 'default'`
**Bad Assumption**: "K6 test user_id in JSON payload is used by API" - WRONG, API generates user_id from headers
**Solution**: Added `x-session-id` header to K6 test vote submissions: `headers: { 'x-session-id': sessionId }`
**Prevention**: Always send `x-session-id` header for CEW poll API calls to ensure consistent user_id generation

### **Lesson 13: Matrix Graph Logic Confirmation (2025)**
**Problem**: User reported "15 paired responses" but only "8 individual data points" displayed, suspecting algorithm bug
**Root Cause**: Matrix graph logic was working correctly - shows unique users with paired votes, not total votes per question
**Bad Assumption**: "Matrix graphs should show all votes" - WRONG, they show unique users who voted on both questions
**Solution**: Confirmed correct behavior: Left panel shows total votes (15), matrix graph shows unique users with paired votes (8)
**Prevention**: Understand that matrix graphs require same user_id for both importance AND feasibility questions for pairing

### **Lesson 14: Matrix Graph Overlapping Data Points (2025)**
**Problem**: Multiple users submitting identical (x,y) coordinates appeared as single dots, obscuring data density
**Root Cause**: No visualization system for handling overlapping data points in matrix graphs
**Solution**: Implemented 4-mode visualization system: Jittered (spreads points in small radius), Size-Scaled (larger dots for more points), Heatmap (color intensity based on density), Concentric (rings show overlapping points)
**Prevention**: Always consider data density visualization when multiple users can have identical coordinates

## 🛡️ **DEBUGGING PROTOCOL ENHANCEMENTS**

### **Pre-Debugging Checklist**
1. **Verify Data Flow**: Database → API → Frontend components
2. **Check Indexing**: Zero-based vs one-based indexing conventions
3. **Test Filter Systems**: All filter combinations with known data
4. **Validate Question Matching**: Admin panel vs database question text
5. **Run Build Tests**: `npm run build` to catch TypeScript errors
6. **Test k6 Scripts**: Use `k6 run` command, not `node`

### **Common Debugging Mistakes to Avoid**
- ❌ **Assuming hardcoded data matches database**
- ❌ **Not testing filter combinations**
- ❌ **Ignoring zero-based vs one-based indexing**
- ❌ **Not running production builds during development**
- ❌ **Using wrong command for k6 tests**
- ❌ **Not verifying data aggregation logic**
- ❌ **Assuming automatic question matching**
- ❌ **Not checking option text in database**
- ❌ **Ignoring duplicate data cleanup**
- ❌ **Not testing with known data sets**

## 🎉 Success Metrics

### Phase 3 Achievements
- **100% User Visibility**: Admin dashboard shows all authenticated users
- **Real Email Addresses**: No more "User 1234..." display
- **Automatic Role Assignment**: New signups get 'member' role automatically
- **Enhanced Like System**: Complete user interaction tracking
- **Admin Badge Persistence**: Robust system preventing badge disappearance
- **Complete Theme System**: Dark/light mode with CSS specificity solution

### System Capabilities
- **Enterprise-level user management** with complete visibility
- **Professional discussion forum** with engagement tracking
- **Comprehensive content management** with tagging system
- **Secure authentication** with role-based access control
- **Complete theme system** with dark/light mode support
- **Performance optimized** with efficient queries and responsive UI

---

**Remember**: This system is **production-ready** and **fully functional**. Most "problems" are actually working features. Always verify before suggesting changes, and never break what's already working perfectly.
