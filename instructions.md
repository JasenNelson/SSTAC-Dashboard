# SSTAC & TWG Dashboard Development Instructions

## Project Overview
This document provides specific instructions for AI assistants working on the SSTAC & TWG Dashboard project. The project is a comprehensive platform for managing sediment standards development through stakeholder engagement and administrative tools.

## Core Development Principles

### 1. Architecture Adherence
- **Follow Next.js 15+ App Router patterns** strictly
- **Use Server Components** for authentication and initial data loading
- **Use Client Components** for interactive UI and state management
- **Implement API Route Architecture** for client-server communication

### 2. Admin Badge Persistence
- **Never allow admin badge to disappear** after operations
- **Implement comprehensive admin status management** in all admin components
- **Use the global refresh function** `refreshGlobalAdminStatus()` after CRUD operations
- **Include localStorage backup** for temporary database issues

### 3. Component Architecture
- **Server Components**: Handle authentication, database queries, and initial rendering
- **Client Components**: Handle user interactions, state management, and real-time updates
- **API Routes**: Bridge between client components and server actions
- **Server Actions**: Handle database operations with proper validation

## File Structure Requirements

### Admin Management System
```
src/app/(dashboard)/admin/
├── page.tsx                    # Server component for auth + AdminDashboardClient
├── AdminDashboardClient.tsx    # Client component with admin refresh
├── users/
│   ├── page.tsx               # Server component for auth + UsersPageClient
│   └── UsersPageClient.tsx    # Client component with admin refresh
├── tags/
│   ├── page.tsx               # Server component for auth + TagsPageClient
│   └── TagsPageClient.tsx     # Client component with admin refresh
├── announcements/
│   ├── page.tsx               # Server component for auth + AnnouncementsPageClient
│   └── AnnouncementsPageClient.tsx  # Client component with admin refresh
└── milestones/
    ├── page.tsx               # Server component for auth + MilestonesPageClient
    └── MilestonesPageClient.tsx     # Client component with admin refresh
```

### API Routes
```
src/app/api/
├── tags/route.ts              # Tag CRUD operations
├── announcements/route.ts     # Announcement CRUD operations
└── milestones/route.ts        # Milestone CRUD operations
```

### Components
```
src/components/
├── Header.tsx                 # Global navigation with admin badge persistence
├── Toast.tsx                  # Toast notification system
└── dashboard/
    ├── TagManagement.tsx      # Tag CRUD with admin status refresh
    ├── AnnouncementsManagement.tsx  # Announcement CRUD with admin status refresh
    ├── MilestonesManagement.tsx     # Milestone CRUD with admin status refresh
    ├── AdminUsersManager.tsx  # User management interface
    ├── LikeButton.tsx         # Enhanced like system with user attribution ✅ NEW
    └── DiscussionThread.tsx   # Forum discussions with like functionality ✅ NEW
```

## Implementation Requirements

### 1. Admin Status Persistence
Every admin component must:
- **Import** `refreshGlobalAdminStatus` from `@/lib/admin-utils`
- **Call** the refresh function after successful CRUD operations
- **Include** admin status refresh on component mount
- **Handle** errors gracefully with fallback to cached admin status

### 2. Phase 3: Enhanced Like System ✅ COMPLETED
The enhanced like system has been implemented with:
- **LikeButton Component**: Enhanced component with user attribution and like details
- **Database Integration**: Likes table with proper constraints and RLS policies
- **Real-time Updates**: Immediate UI updates on like actions
- **User Experience**: Click to expand and see who liked what with timestamps
- **Performance**: Optimized queries and efficient like operations
- **User Attribution**: Display who liked what with click-to-expand details
- **Security**: Row-level security for all like operations

### 3. Client Component Pattern
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

### 4. CRUD Operation Pattern
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

### 5. Server Component Pattern
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

## Database Schema Requirements

### Required Tables
- **users**: Supabase auth.users integration
- **user_roles**: Admin role assignments (user_id, role)
- **documents**: Project documents with metadata
- **tags**: Document categorization system
- **announcements**: Dashboard announcements with priority and status
- **milestones**: Project timeline with status tracking
- **discussions**: Forum threads and replies
- **likes**: User interactions with discussions and replies ✅ NEW

### Critical Views
- **discussion_stats**: Aggregated discussion metrics
- **documents_with_tags**: Document-tag relationships
- **users_overview**: Comprehensive user activity overview ✅ NEW
- **admin_users_comprehensive**: Complete admin user management ✅ NEW

### Row Level Security
- **Enable RLS** on all tables
- **Create policies** for authenticated users
- **Admin override** for full access

## Styling Requirements

### Design System
- **Tailwind CSS v4** for utility-first styling
- **Responsive design** with mobile-first approach
- **Consistent color scheme** across all admin interfaces
- **Professional appearance** suitable for government stakeholders

### Component Styling
- **Rounded corners** (`rounded-2xl`) for modern appearance
- **Shadow effects** (`shadow-lg`, `shadow-xl`) for depth
- **Hover animations** (`hover:-translate-y-2`) for interactivity
- **Gradient backgrounds** for visual appeal

## Error Handling Requirements

### Admin Status Errors
- **Retry logic** with exponential backoff
- **Local storage fallback** for temporary database issues
- **Graceful degradation** when admin status cannot be verified
- **User feedback** through toast notifications

### Database Errors
- **Input validation** before database operations
- **Proper error messages** for user feedback
- **Rollback mechanisms** for failed operations
- **Logging** for debugging and monitoring

## Performance Requirements

### Optimization
- **Code splitting** for admin components
- **Lazy loading** for non-critical features
- **Efficient database queries** with proper indexing
- **Caching strategies** for frequently accessed data

### Monitoring
- **Console logging** for development debugging
- **Error tracking** for production monitoring
- **Performance metrics** for optimization
- **User experience** monitoring

## Security Requirements

### Authentication
- **Supabase Auth** for secure user management
- **Role-based access control** for admin functions
- **Session management** with proper cleanup
- **Input sanitization** for all user inputs

### Data Protection
- **Row level security** on all database tables
- **Admin role verification** before sensitive operations
- **Audit logging** for important changes
- **Secure API endpoints** with proper validation

## Testing Requirements

### Functionality Testing
- **Admin badge persistence** across all operations
- **CRUD operations** for all admin features
- **Error handling** for various failure scenarios
- **User experience** across different devices
- **Enhanced like system** functionality ✅ NEW

### Security Testing
- **Authentication bypass** attempts
- **Admin privilege escalation** attempts
- **Input validation** for malicious inputs
- **Session management** security

## Common Development Issues & Solutions

### 1. Admin Badge Disappearing
- **Problem**: Admin badge disappears after operations or page navigation
- **Solution**: Implement comprehensive admin status persistence system
- **Required**: Global refresh function, localStorage backup, retry logic

### 2. Next.js 15+ Server Actions Import Issues
- **Problem**: Client components cannot import server actions using `next/headers`
- **Solution**: Use API route architecture with client-side fetch calls
- **Pattern**: Server actions → API routes → Client components

### 3. Hydration Errors
- **Problem**: Server/client content mismatch causing React hydration failures
- **Solution**: Ensure consistent data between server and client components
- **Files to Check**: Components using dynamic data or browser APIs

### 4. Database View Missing
- **Problem**: Forum returns 404 when accessing discussion features
- **Solution**: Ensure required database views exist
- **Critical Views**: `discussion_stats`, `documents_with_tags`, `users_overview`, `admin_users_comprehensive`

### 5. Authentication Issues
- **Problem**: Admin users lose admin badge after browser refresh
- **Root Cause**: UUID-based role checking in `user_roles` table
- **Solution**: Verify admin role exists using UUID, not email

### 6. Authentication Best Practices ✅ IMPLEMENTED
- **User Logout**: Always accessible regardless of loading state
- **Role Checking**: Use timeout protection (10 seconds) to prevent hanging
- **UI State Management**: Loading state should not block essential functions
- **Error Handling**: Graceful fallbacks for authentication failures
- **Member vs Admin**: Clean separation of user experiences
- **Console Logging**: Minimal noise for member users, detailed for admin debugging

### 7. Enhanced Like System Issues ✅ NEW
- **Problem**: Like system not working or showing errors
- **Solution**: Verify likes table exists with proper constraints and RLS policies
- **Required**: Check database schema includes likes table and proper indexes

## Current Development Phase

### Phase 2: Admin Management System ✅ COMPLETED
- **Admin Dashboard**: Centralized overview with metrics and quick actions
- **User Management**: Complete user CRUD operations
- **Tag Management**: Complete tag CRUD operations
- **Announcement Management**: Complete announcement CRUD operations
- **Milestone Management**: Complete milestone CRUD operations
- **Admin Badge Persistence**: Comprehensive system preventing badge disappearance

### Phase 3: Enhanced User Engagement ✅ COMPLETED
- **Enhanced Like System**: Complete like/unlike functionality for discussions and replies
- **User Attribution**: Display who liked what with click-to-expand details
- **Real-time Updates**: Immediate UI updates on like actions
- **Database Integration**: Proper constraints and RLS policies
- **Performance Optimization**: Efficient queries and responsive interactions
- **User Experience**: Click to expand and see who liked what with timestamps

### Phase 3: Advanced Analytics 🔄 IN PROGRESS
- **Dashboard Metrics**: Comprehensive dashboard statistics and reporting
- **User Engagement Tracking**: Monitor user interaction patterns
- **Content Analytics**: Analyze discussion and document popularity
- **Performance Monitoring**: Track system performance and user experience

## Quality Assurance

### Code Quality
- **TypeScript strict mode** for type safety
- **ESLint rules** for code consistency
- **Prettier formatting** for code style
- **Component documentation** for maintainability

### User Experience
- **Intuitive navigation** for all user types
- **Responsive design** across all devices
- **Accessibility compliance** for inclusive design
- **Performance optimization** for smooth interactions

### Security
- **Authentication verification** for all protected routes
- **Input validation** for all user inputs
- **Role-based access control** for admin functions
- **Secure data handling** for sensitive information

## Deployment Requirements

### Environment Configuration
- **Environment variables** for all sensitive configuration
- **Database connection** with proper security
- **API endpoints** with rate limiting
- **Error monitoring** for production issues

### Performance Monitoring
- **Page load times** for optimization
- **Database query performance** for efficiency
- **User interaction metrics** for UX improvement
- **Error tracking** for issue resolution

## Support and Maintenance

### Documentation
- **Code comments** for complex logic
- **Component documentation** for reusability
- **API documentation** for integration
- **User guides** for end users

### Maintenance
- **Regular updates** for security patches
- **Performance monitoring** for optimization
- **User feedback** for feature improvements
- **Bug tracking** for issue resolution

## Important Notes

1. **Never compromise admin badge persistence** - this is a critical requirement
2. **Always use the established patterns** for consistency and maintainability
3. **Test thoroughly** before deploying any changes
4. **Document all changes** for future reference
5. **Follow security best practices** for all implementations
6. **Maintain responsive design** across all components
7. **Use proper error handling** for robust user experience
8. **Enhanced like system is complete** - build on it, don't rewrite it ✅ NEW
9. **Authentication improvements are implemented** - follow established patterns ✅ NEW