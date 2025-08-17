# 🧠 SSTAC & TWG Dashboard Project Memory

## 🔐 Critical Authentication Knowledge

### Supabase Authentication System
**THIS IS CRITICAL TO UNDERSTAND** - The user has repeatedly encountered authentication issues due to misunderstanding how Supabase works with custom role tables.

#### How It Actually Works
1. **`auth.users` table** (Supabase managed):
   - Contains: `id` (UUID), `email`, `created_at`, etc.
   - **DOES NOT contain application roles**
   - Managed entirely by Supabase

2. **`user_roles` table** (Custom application table):
   - Contains: `user_id` (UUID reference), `role`, `created_at`
   - **DOES NOT store email addresses**
   - Only stores UUID references to `auth.users(id)`

#### User's Current Setup
- **Email**: `jasen.nelson@gmail.com`
- **UUID**: `c632b5bc-6666-4b5f-8ef3-ca851dcee762`
- **Admin Role**: ✅ Exists in `user_roles` table
- **Email in user_roles**: ❌ Not stored (and shouldn't be)

#### Why This Confusion Keeps Happening
- User expects email to be in `user_roles` table
- User has admin role but loses it on browser refresh
- UUID-based authentication is not intuitive
- Previous troubleshooting attempts focused on wrong solutions

### Authentication Flow
```
User Login → Supabase Auth → Session with UUID → Query user_roles → Determine Permissions
```

### Common Mistakes to Avoid
❌ **Don't query user_roles by email** - it doesn't store emails
❌ **Don't assume user_roles contains user details** - it only contains role mappings
✅ **Always query by UUID** - use `auth.uid()` or session user ID
✅ **Join with auth.users** - if you need email + role information

## 🚨 Authentication Troubleshooting

### When Admin Authentication Fails
1. **Verify UUID exists in auth.users**:
   ```sql
   SELECT id, email FROM auth.users WHERE email = 'jasen.nelson@gmail.com';
   ```

2. **Verify admin role exists in user_roles**:
   ```sql
   SELECT * FROM user_roles WHERE user_id = 'c632b5bc-6666-4b5f-8ef3-ca851dcee762';
   ```

3. **Check RLS policies** are properly configured
4. **Verify Supabase connection** and environment variables

### Quick Fix for Admin Issues
```sql
-- Add admin role for user (replace with actual UUID)
INSERT INTO user_roles (user_id, role) 
SELECT id, 'admin' 
FROM auth.users 
WHERE email = 'jasen.nelson@gmail.com'
ON CONFLICT (user_id, role) DO NOTHING;
```

## 🐛 Recent Bug Fixes & Issues Resolved

### Logout Functionality Fix (Latest - Critical)
**Issue**: Member users unable to logout due to loading state blocking UI
**Error**: Logout buttons not visible when `isLoading` state was true
**Root Cause**: Loading state was blocking entire header UI, preventing logout access
**Files Affected**: `src/components/Header.tsx`
**Solution**: 
- Modified loading state to only block UI when no session exists
- Added timeout protection to admin role checking (10 seconds)
- Simplified logout logic to always clear state and redirect
- Ensured logout buttons are always visible for authenticated users
**Status**: ✅ RESOLVED - All users can now logout reliably

### Admin Role Checking Optimization (Latest)
**Issue**: Infinite recursion errors and 406 errors on user_roles queries
**Error**: "infinite recursion detected in policy for relation 'user_roles'" and 406 Not Acceptable
**Root Cause**: RLS policies with circular dependencies and aggressive admin role checking
**Files Affected**: `src/components/Header.tsx`, RLS policies in database
**Solution**: 
- Simplified RLS policies to prevent infinite recursion
- Added timeout protection to role checking queries
- Improved error handling for member vs admin users
- Reduced console noise for non-admin users
**Status**: ✅ RESOLVED - Clean role checking without errors

### Test DB Relocation (Latest)
**Issue**: Test DB link was showing in header navigation for admin users
**Root Cause**: Test DB was placed in header for debugging convenience
**Files Affected**: `src/components/Header.tsx`, `src/app/(dashboard)/admin/AdminDashboardClient.tsx`
**Solution**: 
- Moved Test DB link from header navigation to admin dashboard
- Added Test DB card to admin dashboard management grid
- Test DB now properly located with other admin tools
**Status**: ✅ RESOLVED - Test DB properly located in admin dashboard

### Next.js 15+ Server Actions Import Fix
**Issue**: Client components cannot import server actions that use `next/headers`
**Error**: `You're importing a component that needs "next/headers". That only works in a Server Component but one of its parents is marked with "use client"`
**Root Cause**: Server actions with `next/headers` cannot be imported into client components
**Files Affected**: Admin management components (Tags, Announcements, Milestones)
**Solution**: Created API routes (`/api/*`) as intermediaries between client components and server actions
**Pattern**: Client Component → API Route → Server Action → Database
**Status**: ✅ RESOLVED - All admin components now work correctly

### Hydration Error Fix
**Issue**: React hydration mismatch between server and client rendering
**Root Cause**: Inconsistent text references to "SSTAC Dashboard" vs "SSTAC & TWG Dashboard"
**Files Fixed**: 
- `src/components/Header.tsx` ✅
- `src/app/(dashboard)/admin/users/page.tsx` ✅
**Solution**: Standardized all references to "SSTAC & TWG Dashboard"

### Database View Missing (Critical)
**Issue**: Forum returns 404 error when accessing `discussion_stats` view
**Root Cause**: Database view `discussion_stats` not created in Supabase
**Error**: `GET /rest/v1/discussion_stats?select=*&order=created_at.desc 404 (Not Found)`
**Solution**: Run SQL to create missing view (see SQL commands below)

### Required SQL Fix
```sql
-- Create the discussion_stats view
CREATE OR REPLACE VIEW discussion_stats AS
SELECT 
  d.id,
  d.title,
  d.user_email as author,
  d.created_at,
  d.updated_at,
  COUNT(r.id) as reply_count,
  MAX(r.created_at) as last_reply_at
FROM discussions d
LEFT JOIN discussion_replies r ON d.id = r.discussion_id
GROUP BY d.id, d.title, d.user_email, d.created_at, d.updated_at
ORDER BY d.created_at DESC;

-- Grant permissions on the view
GRANT SELECT ON discussion_stats TO authenticated;
```

## 📋 Project Context

### What This Project Is
- **SSTAC & TWG Dashboard**: Science and Standards Technical Advisory Committee & Technical Working Group dashboard
- **Purpose**: Modernize BC sediment standards with stakeholder engagement
- **Technology**: Next.js 15+, Supabase, Tailwind CSS, TypeScript

### Key Features Implemented
- Interactive survey results dashboard
- CEW 2025 conference integration
- TWG discussion forum
- Document management system
- Admin user management (✅ COMPLETED)
- Dynamic announcements and timeline
- API route architecture for client-server communication
- Enhanced like system for discussions and replies (✅ COMPLETED)

### Phase 2 Completion Status ✅
- **Central Admin Dashboard**: Overview with metrics and quick actions
- **User Management**: Admin user creation, role assignment, permissions
- **Tag Management**: Create, edit, delete document tags with color coding
- **Announcements Management**: Create and manage dashboard notifications
- **Milestones Management**: Project timeline management with status tracking
- **API Routes**: `/api/announcements`, `/api/milestones`, `/api/tags`

## 🎯 Current Development Status

### Phase 3: Enhanced Like System ✅ COMPLETED
The enhanced like system has been successfully implemented with:
- **New likes table**: Tracks user interactions with discussions and replies
- **Enhanced LikeButton component**: Shows who liked what with user attribution
- **Real-time updates**: Like counts and status update immediately
- **User details popup**: Click to see who liked and when
- **Database constraints**: Prevents duplicate likes and ensures data integrity
- **Performance optimization**: Proper indexing and efficient queries

### Phase 3 Implementation Details
- **Database Changes**: Created likes table with proper constraints and RLS policies
- **Component Updates**: Enhanced LikeButton with user attribution and like details
- **User Experience**: Click to expand and see who liked what
- **Error Handling**: Improved discussions fetch with better fallback mechanisms
- **Files Modified**: 
  - `database_schema.sql` - Added likes table structure
  - `src/components/dashboard/LikeButton.tsx` - Enhanced like functionality
  - `src/app/(dashboard)/twg/discussions/page.tsx` - Fixed fetch timeout issues

## 🚀 Next Steps for Phase 3

### Advanced Analytics 🔄 PLANNED
- Dashboard metrics and reporting capabilities
- User engagement tracking and analytics
- Content popularity and interaction metrics
- Real-time dashboard statistics

### Bulk Operations 🔄 PLANNED  
- Mass edit/delete capabilities for administrators
- Batch tag management and operations
- Bulk announcement and milestone operations
- Efficient bulk data processing

### Audit Logging 🔄 PLANNED
- Track all admin actions for compliance
- User activity monitoring and logging
- Change history tracking and reporting
- Security audit trail maintenance

### Enhanced Collaboration Tools 🔄 PLANNED
- Real-time notification system
- Advanced forum features
- Document collaboration improvements
- Mobile application development

## 📊 Technical Implementation Status

### Database Changes Made
- ✅ **Likes table**: Created with proper constraints and RLS policies
- ✅ **Indexes**: Performance optimization for like queries
- ✅ **Permissions**: Proper access control for authenticated users
- ✅ **Views**: Required database views for forum functionality

### Component Updates
- ✅ **LikeButton**: Enhanced to show user attribution and like details
- ✅ **Error handling**: Improved discussions fetch with better fallback
- ✅ **User experience**: Click to see who liked what with timestamps
- ✅ **Performance**: Optimized queries and real-time updates

### Files Modified
- `database_schema.sql` - Added likes table structure and constraints
- `src/components/dashboard/LikeButton.tsx` - Enhanced like functionality
- `src/app/(dashboard)/twg/discussions/page.tsx` - Fixed fetch timeout issues

## 🔄 Phase 3 Development Focus

### Current Priority: Advanced Analytics
1. **Dashboard Metrics**: Implement comprehensive dashboard statistics
2. **User Engagement**: Track and display user interaction patterns
3. **Content Analytics**: Analyze discussion and document popularity
4. **Performance Monitoring**: Track system performance and user experience

### Implementation Approach
- **Incremental Development**: Build features one at a time
- **User Testing**: Validate each feature before moving to the next
- **Performance Focus**: Ensure new features don't impact existing functionality
- **Documentation**: Update all documentation as features are completed

## 🚨 IMPORTANT: Current System Status

### Recent Authentication Improvements (Latest)
**Status**: ✅ COMPLETED - All authentication issues resolved

#### What Was Fixed
1. **Member User Logout**: Previously blocked by loading state, now works reliably
2. **Admin Role Checking**: Added timeout protection and improved error handling
3. **UI Accessibility**: Loading state no longer blocks logout functionality
4. **Error Handling**: Clean separation between admin and member user experiences

#### Technical Improvements
- **Timeout Protection**: 10-second timeout on admin role checking queries
- **UI State Management**: Loading state only blocks UI when no session exists
- **Logout Reliability**: Simplified logout logic with guaranteed state clearing
- **Console Noise Reduction**: Cleaner logging for member users

### What's Working Well ✅
- **Admin Management System**: Complete and fully functional
- **Admin Badge Persistence**: Robust system preventing badge disappearance
- **Enhanced Like System**: Fully implemented and working correctly
- **API Architecture**: Next.js 15+ compatible and efficient
- **Database Schema**: Complete with proper RLS and performance optimization
- **User Authentication & Logout**: Reliable for both admin and member users
- **Role-Based Access Control**: Clean separation between admin and member features
- **Error Handling**: Graceful handling of authentication and role checking

### What NOT to Change
- **Admin Badge Persistence**: The current implementation is robust and working
- **Like System**: Phase 3 like system is complete and functional
- **Database Schema**: The schema is comprehensive and optimized
- **API Routes**: The established pattern is working correctly
- **Test DB Location**: Test DB is now properly located in admin dashboard, not in header

### Development Guidelines
1. **Build on existing systems** - Don't rewrite working functionality
2. **Follow established patterns** - Use the same architecture for new features
3. **Test thoroughly** - Ensure new features don't break existing functionality
4. **Document changes** - Update documentation as features are completed
5. **Maintain performance** - Keep the dashboard fast and responsive

## 🎯 Quality Assurance

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

## 🚀 Deployment & Production

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

## 🤝 Support and Maintenance

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

## 📝 Important Notes

1. **The dashboard is working well** - Focus on new features, not fixing working systems
2. **Admin badge persistence is robust** - Don't modify the established solution
3. **Phase 3 like system is complete** - Build on it, don't rewrite it
4. **Follow established patterns** - Use the same architecture for consistency
5. **Test thoroughly** - Ensure new features don't break existing functionality
6. **Document all changes** - Keep documentation current and accurate
7. **Maintain performance** - Keep the dashboard fast and responsive
