# SSTAC & TWG Dashboard Architecture

## Project Vision
A comprehensive dashboard platform for the Sediment Standards Technical Advisory Committee (SSTAC) and Technical Working Group (TWG), providing centralized access to project documents, stakeholder engagement results, and administrative tools.

## Core Technologies
- **Next.js 15+**: App Router with Server and Client Components
- **Supabase**: Authentication, database, and real-time features
- **TypeScript**: Type safety and development experience
- **Tailwind CSS v4**: Utility-first styling with modern design system
- **React Server Actions**: Server-side data mutations with client-side integration

## Guiding Principles
1. **Performance First**: Server-side rendering with strategic client-side hydration
2. **Security by Design**: Row-level security, admin role verification, and input validation
3. **User Experience**: Intuitive navigation, responsive design, and accessibility
4. **Scalability**: Modular architecture supporting future feature expansion
5. **Admin Persistence**: Robust admin status management with fallback mechanisms

## File & Folder Structure
```
src/
├── app/
│   ├── (dashboard)/
│   │   ├── admin/                    # Admin management system
│   │   │   ├── page.tsx             # Main admin dashboard
│   │   │   ├── AdminDashboardClient.tsx  # Client component with admin refresh
│   │   │   ├── users/
│   │   │   │   ├── page.tsx         # Server component for auth
│   │   │   │   └── UsersPageClient.tsx   # Client component with admin refresh
│   │   │   ├── tags/
│   │   │   │   ├── page.tsx         # Server component for auth
│   │   │   │   └── TagsPageClient.tsx    # Client component with admin refresh
│   │   │   ├── announcements/
│   │   │   │   ├── page.tsx         # Server component for auth
│   │   │   │   └── AnnouncementsPageClient.tsx  # Client component with admin refresh
│   │   │   └── milestones/
│   │   │       ├── page.tsx         # Server component for auth
│   │   │       └── MilestonesPageClient.tsx     # Client component with admin refresh
│   │   ├── dashboard/               # Main dashboard landing page
│   │   ├── survey-results/          # Survey results and analysis
│   │   ├── cew-2025/               # CEW conference information
│   │   └── twg/                    # TWG-specific features
│   ├── api/                        # API routes for client components
│   │   ├── tags/                   # Tag CRUD operations
│   │   ├── announcements/          # Announcement CRUD operations
│   │   └── milestones/             # Milestone CRUD operations
│   └── globals.css                 # Global styles and Tailwind imports
├── components/
│   ├── Header.tsx                  # Global navigation with admin badge persistence
│   ├── Toast.tsx                   # Toast notification system
│   └── dashboard/                  # Dashboard-specific components
│       ├── TagManagement.tsx       # Tag CRUD with admin status refresh
│       ├── AnnouncementsManagement.tsx  # Announcement CRUD with admin status refresh
│       ├── MilestonesManagement.tsx     # Milestone CRUD with admin status refresh
│       ├── AdminUsersManager.tsx   # User management interface
│       ├── Announcements.tsx       # Dashboard announcements display
│       ├── ProjectTimeline.tsx     # Dashboard milestones display
│       ├── SurveyResultsChart.tsx  # Interactive survey charts
│       ├── VoicesCarousel.tsx      # Stakeholder quotes carousel
│       └── ProjectPhases.tsx      # Expandable project phases
├── lib/
│   └── supabase/                   # Supabase client configuration
└── types/                          # TypeScript type definitions
```

## Authentication & Authorization
- **Supabase Auth**: Email/password authentication with session management
- **Role-Based Access Control**: Admin roles stored in `user_roles` table
- **Admin Status Persistence**: Multi-layered approach to prevent badge disappearance
  - Global refresh function accessible from any component
  - Local storage backup for temporary database issues
  - Retry logic with exponential backoff
  - Periodic status verification
  - Navigation event listeners

## Data Fetching Strategy
- **Server Components**: Initial data loading and authentication checks
- **Client Components**: Interactive UI with real-time updates
- **API Routes**: Bridge between client components and server actions
- **Server Actions**: Database operations with proper validation and security

## Database Schema
### Core Tables
- **users**: Supabase auth.users integration
- **user_roles**: Admin role assignments (user_id, role)
- **documents**: Project documents with metadata and file links
- **tags**: Document categorization system
- **announcements**: Dashboard announcements with priority and status
- **milestones**: Project timeline with status tracking
- **discussions**: Forum threads and replies
- **discussion_replies**: Nested conversation replies
- **likes**: User interactions with discussions and replies (Phase 3)

### Critical Views
- **discussion_stats**: Aggregated discussion metrics
- **documents_with_tags**: Document-tag relationships for efficient querying

### Phase 3: Enhanced Like System
- **likes table**: Tracks user interactions with discussions and replies
- **User attribution**: Shows who liked what with timestamps
- **Real-time updates**: Like counts and status update immediately
- **Database constraints**: Prevents duplicate likes and ensures data integrity
- **Performance optimization**: Proper indexing for efficient like queries

## Styling & Design System
- **Tailwind CSS v4**: Utility-first approach with custom design tokens
- **Responsive Design**: Mobile-first approach with breakpoint optimization
- **Component Library**: Consistent UI patterns across all admin interfaces
- **Color System**: Semantic colors for status indicators and priority levels

## Key Features

### Admin Management System ✅ COMPLETED
- **Centralized Dashboard**: Overview of system metrics and quick actions
- **User Management**: Add, edit, and manage user accounts and permissions
- **Tag Management**: Create, edit, and organize document tags
- **Announcement Management**: Create and manage dashboard announcements
- **Milestone Management**: Update project timeline and track progress
- **Admin Badge Persistence**: Robust system preventing badge disappearance

### Dashboard Features ✅ COMPLETED
- **Real-time Updates**: Live data from Supabase database
- **Interactive Components**: Expandable sections and collapsible content
- **Data Visualization**: Charts and metrics for stakeholder engagement
- **Responsive Layout**: Optimized for all device sizes

### Survey & Engagement ✅ COMPLETED
- **Results Display**: Interactive charts and analysis
- **Stakeholder Quotes**: Rotating carousel of feedback
- **Theme Navigation**: Detailed exploration of survey findings

### Phase 3: Enhanced User Engagement ✅ COMPLETED
- **Like System**: Interactive like/unlike for discussions and replies
- **User Attribution**: See who liked what with detailed information
- **Real-time Updates**: Immediate feedback on user interactions
- **Performance Optimization**: Efficient queries and responsive UI

## Admin Badge Persistence Solution

### Multi-Layered Approach
1. **Global Refresh Function**: `refreshGlobalAdminStatus()` accessible from any component
2. **Local Storage Backup**: Admin status cached locally for fallback recovery
3. **Retry Logic**: Automatic retry on temporary database connection issues
4. **Navigation Listeners**: Status refresh on route changes and navigation events
5. **Periodic Verification**: Automatic status checks every 30 seconds

### Implementation Details
- **Header Component**: Central admin status management with localStorage backup
- **Client Components**: Admin status refresh on component mount
- **CRUD Operations**: Status refresh after successful database operations
- **Error Handling**: Graceful fallback to cached admin status
- **Cleanup**: Proper removal of cached data on logout

## Performance Considerations
- **Code Splitting**: Dynamic imports for admin components
- **Server-Side Rendering**: Initial page loads with client-side hydration
- **Database Optimization**: Efficient queries with proper indexing
- **Caching Strategy**: Strategic use of localStorage for admin status

## Tooling & Development
- **TypeScript**: Strict type checking and IntelliSense
- **ESLint**: Code quality and consistency
- **Prettier**: Automated code formatting
- **Next.js DevTools**: Built-in development and debugging tools

## Common Development Issues & Solutions

### Hydration Errors
- **Cause**: Mismatch between server and client rendered content
- **Solution**: Ensure consistent data between server and client components
- **Files to Check**: Components using dynamic data or browser APIs

### Database View Missing
- **Critical Views**: `discussion_stats`, `documents_with_tags`
- **Solution**: Run SQL commands to create missing views
- **Impact**: Forum and document features may not function properly

### Authentication Issues
- **Admin Role Verification**: Check `user_roles` table for proper role assignment
- **Verification Query**: `SELECT * FROM user_roles WHERE user_id = 'UUID' AND role = 'admin';`
- **Common Mistake**: Confusing `auth.users.id` (UUID) with email addresses

### Next.js 15+ Server Actions Import Issues
- **Problem**: Client components cannot directly import server actions using `next/headers`
- **Solution**: API route architecture with client-side fetch calls
- **Pattern**: Server actions → API routes → Client components
- **Benefits**: Clean separation of concerns and proper error handling

### Admin Badge Disappearing
- **Problem**: Admin badge disappears after operations or page navigation
- **Solution**: Comprehensive admin status persistence system
- **Features**: Global refresh, localStorage backup, retry logic, navigation listeners

## API Route Architecture (Next.js 15+ Solution)

### Pattern Overview
1. **Server Actions**: Handle database operations and business logic
2. **API Routes**: Act as intermediaries between client components and server actions
3. **Client Components**: Use fetch() to call API routes and handle responses

### Benefits
- **Clean Separation**: Server and client code properly isolated
- **Error Handling**: Consistent error responses and status codes
- **Type Safety**: Full TypeScript support across the stack
- **Performance**: Optimized for Next.js 15+ App Router

### Implementation
- **API Routes**: `/api/tags`, `/api/announcements`, `/api/milestones`
- **Server Actions**: Imported and called from API routes
- **Client Integration**: Form submission via fetch() with proper error handling

## Future Enhancements

### Phase 3: Enhanced User Engagement
- **Advanced Analytics**: Detailed engagement metrics and reporting
- **Notification System**: Real-time updates and alerts
- **Collaboration Tools**: Enhanced forum and document collaboration
- **Mobile App**: Native mobile application for field use

### Technical Improvements
- **Real-time Updates**: WebSocket integration for live data
- **Advanced Caching**: Redis integration for improved performance
- **API Rate Limiting**: Protection against abuse and overload
- **Monitoring**: Application performance monitoring and alerting

## Deployment & Production
- **Environment Variables**: Proper configuration for production
- **Database Migrations**: Automated schema updates and data migrations
- **Performance Monitoring**: Real-time metrics and error tracking
- **Security Audits**: Regular security reviews and updates