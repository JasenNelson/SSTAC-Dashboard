# AGENTS.md for SSTAC & TWG Dashboard

## 🎯 Project Overview
A comprehensive dashboard platform for the **Sediment Standards Technical Advisory Committee (SSTAC)** and **Technical Working Group (TWG)**. This platform manages sediment standards development through stakeholder engagement, document management, and administrative tools.

**Current Status**: Phase 3 completed successfully - Enhanced user engagement and user management system fully operational. Theme system implemented with dark/light mode support.

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

### 5. Component Architecture
- **Server Components**: Handle authentication, database queries, and initial rendering
- **Client Components**: Handle user interactions, state management, and real-time updates
- **API Routes**: Bridge between client components and server actions
- **Server Actions**: Handle database operations with proper validation

### 6. Performance Optimization Guidelines (CRITICAL)
- **MEASURE FIRST**: Check if performance issues actually exist before optimizing
- **ISOLATE TESTING**: Test optimizations in separate branches first
- **USER CONSULTATION**: Ask if "excessive" calls are actually problematic
- **GRADUAL ROLLOUT**: Implement optimizations as optional features first
- **NEVER modify core functions** without understanding all dependencies
- **ALWAYS have rollback plans** for any performance changes

### 7. Poll and Ranking Question System Guidelines (CRITICAL)
- **NEVER modify poll database schema** without understanding all dependencies
- **ALWAYS test poll functionality** after any database changes
- **UNDERSTAND poll types**: Single-choice polls vs ranking polls have different data structures
- **PRESERVE vote persistence**: Votes must be remembered across sessions
- **MAINTAIN mobile optimization**: Clean charts without excessive hover tooltips
- **RESPECT authentication modes**: Both authenticated users and CEW conference attendees
- **VERIFY RLS policies**: Poll data must be properly isolated by user
- **TEST vote tracking**: Ensure device-based tracking works for CEW polls

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
- **CEW Conference**: Use CEW code (e.g., "CEW2025") as TEXT user_id
- **Vote Tracking**: `localStorage` for CEW polls, database for authenticated users
- **Session Persistence**: Votes remembered across sessions for both modes

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
- **Phase 2**: Admin management system
- **Phase 3**: Enhanced user engagement (like system, user management)

### 🔄 Current Phase
- **Phase 4**: Advanced analytics and dashboard metrics

### 🚀 Next Steps
- Build on Phase 3 foundation
- Implement advanced analytics
- Enhance user engagement reporting
- Monitor system performance

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
