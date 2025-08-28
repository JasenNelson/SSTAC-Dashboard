# TWG Discussion Forum Setup Guide

This guide will help you set up the TWG Discussion Forum feature in your SSTAC Dashboard.

## Overview

The TWG Discussion Forum allows users to:
- Create new discussion threads
- Reply to existing discussions
- View all discussions and replies
- Edit and delete their own content
- **Admin users can edit/delete any content**
- **Like and unlike discussions and replies** ✅ NEW FEATURE
- **See who liked what with timestamps** ✅ NEW FEATURE

## Database Setup

### 1. Run the Database Schema

1. Go to your Supabase dashboard
2. Navigate to the SQL Editor
3. Copy and paste the contents of `database_schema.sql`
4. Run the SQL commands

This will create:
- `discussions` table for main discussion threads
- `discussion_replies` table for replies to discussions
- `user_roles` table for role-based access control
- `likes` table for user interactions ✅ NEW TABLE
- Proper indexes for performance
- Row Level Security (RLS) policies for data protection
- Automatic timestamp updates

### 2. Verify Tables Created

After running the schema, you should see:
- `discussions` table in your database
- `discussion_replies` table in your database
- `user_roles` table in your database
- `likes` table in your database ✅ NEW
- RLS policies enabled on all tables

### 3. Set Up Admin Users

To grant admin privileges, run this SQL:

```sql
-- Add a user as admin (replace 'user-uuid-here' with actual user UUID)
INSERT INTO user_roles (user_id, role) 
VALUES ('user-uuid-here', 'admin');

-- Verify admin role was created
SELECT * FROM user_roles WHERE role = 'admin';
```

## Features

### Discussion Management
- **Create Discussions**: Users can start new discussion threads with titles and content
- **View Discussions**: All users can see all discussions
- **Edit Discussions**: Users can edit their own discussions, admins can edit any
- **Delete Discussions**: Users can delete their own discussions, admins can delete any

### Reply System
- **Post Replies**: Users can reply to any discussion
- **View Replies**: All replies are visible to all users
- **Edit Replies**: Users can edit their own replies, admins can edit any
- **Delete Replies**: Users can delete their own replies, admins can delete any

### Enhanced Like System ✅ NEW FEATURE
- **Like/Unlike**: Users can like and unlike discussions and replies
- **User Attribution**: Click to see who liked what with timestamps
- **Real-time Updates**: Like counts update immediately
- **Performance**: Optimized queries with proper indexing
- **Security**: Row-level security for all like operations

### Security Features
- **Authentication Required**: Users must be logged in to create/edit/delete content
- **Ownership Protection**: Users can only modify their own content by default
- **Admin Override**: Admin users have full access to all content
- **Row Level Security**: Database-level security policies
- **Cascade Deletion**: Deleting a discussion removes all associated replies and likes

## Usage

### Accessing the Forum
1. Navigate directly to `/twg/discussions` in your dashboard
2. Or use the navigation header - click "TWG Forum" link

### Creating a Discussion
1. Click "Start New Discussion"
2. Fill in the title and content
3. Click "Create Discussion"

### Replying to a Discussion
1. Click "Reply" on any discussion
2. Write your reply in the text area
3. Click "Post Reply"

### Using the Like System ✅ NEW
1. **Like a Discussion**: Click the heart icon on any discussion
2. **Like a Reply**: Click the heart icon on any reply
3. **See Who Liked**: Click the like count to expand and see user details
4. **Unlike**: Click the heart icon again to remove your like
5. **Real-time Updates**: Like counts update immediately

### Admin Functions
- **Edit Any Content**: Admin users see edit/delete buttons on all discussions and replies
- **Delete Any Content**: Admin users can remove inappropriate or outdated content
- **Moderation**: Full control over forum content management
- **Like Management**: Admin users can see all like activity

## API Endpoints

The discussion forum includes these API endpoints:

- `GET /api/discussions` - Fetch all discussions
- `POST /api/discussions` - Create a new discussion
- `GET /api/discussions/[id]` - Fetch a specific discussion
- `PUT /api/discussions/[id]` - Update a discussion
- `DELETE /api/discussions/[id]` - Delete a discussion
- `GET /api/discussions/[id]/replies` - Fetch replies for a discussion
- `POST /api/discussions/[id]/replies` - Create a reply
- `PUT /api/discussions/[id]/replies/[replyId]` - Update a reply
- `DELETE /api/discussions/[id]/replies/[replyId]` - Delete a reply

## Components

The discussion forum consists of these React components:

- `TwgDiscussionsPage` - Main discussion forum page with discussion list and new discussion form
- `NewDiscussionForm` - Form for creating new discussions
- `DiscussionThread` - Individual discussion thread with replies, edit/delete functionality, and reply management
- `LikeButton` - Enhanced like system with user attribution and real-time updates ✅ NEW

## Enhanced Like System Implementation ✅ COMPLETED

### Database Structure
- **likes table**: Tracks user interactions with discussions and replies
- **Constraints**: Users can only like either a discussion OR a reply, not both
- **Uniqueness**: Users can only like a specific discussion/reply once
- **Cascade**: Likes are automatically removed when discussions/replies are deleted

### User Experience Features
- **Click to Expand**: Click like count to see who liked what
- **User Attribution**: Display user information and timestamps
- **Real-time Updates**: Like counts and status update immediately
- **Visual Feedback**: Heart icon changes color and fills when liked

### Performance Features
- **Efficient Indexing**: Proper database indexes for fast like queries
- **Optimized Queries**: Minimal database calls for like operations
- **Caching Strategy**: Smart caching of like status and counts

## Role-Based Access Control

The forum implements a sophisticated permission system:

### Regular Users
- Can create discussions and replies
- Can edit/delete their own content
- Can view all content
- Can like/unlike any discussion or reply ✅ NEW
- Can see who liked what content ✅ NEW

### Admin Users
- Have all regular user permissions
- Can edit/delete any discussion or reply
- Can moderate forum content
- Can see admin badge in the header
- Can manage all like activity ✅ NEW

### Admin Role Verification
Admin status is checked by querying the `user_roles` table:
```typescript
const { data: roleData } = await supabase
  .from('user_roles')
  .select('role')
  .eq('user_id', user.id)
  .eq('role', 'admin')
  .single();

const isAdmin = !!roleData;
```

## Styling

The forum uses Tailwind CSS v4 for styling and follows the same design patterns as the rest of your dashboard:
- Consistent color scheme (indigo, gray)
- Responsive design for mobile and desktop
- Modern card-based layout
- Hover effects and transitions
- Enhanced like button styling with heart icons ✅ NEW

## Troubleshooting

### Common Issues

1. **"Table doesn't exist" errors**
   - Make sure you've run the database schema SQL
   - Check that the tables were created successfully
   - Verify the `likes` table exists ✅ NEW

2. **Permission errors**
   - Verify RLS policies are enabled
   - Check that users are properly authenticated
   - Ensure admin users are added to the `user_roles` table

3. **Replies not showing**
   - Ensure the `discussion_replies` table exists
   - Check foreign key constraints

4. **Admin functions not working**
   - Verify the user is in the `user_roles` table with `admin` role
   - Check that the admin check query is working correctly

5. **Like system not working** ✅ NEW
   - Verify the `likes` table exists and has proper constraints
   - Check RLS policies on the likes table
   - Ensure proper indexes are created for performance

### Database Verification

Run this query to verify your setup:

```sql
SELECT 
  table_name, 
  table_type 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN ('discussions', 'discussion_replies', 'user_roles', 'likes');
```

You should see all four tables listed.

### Admin Role Verification

Check if a user has admin privileges:

```sql
SELECT u.email, ur.role 
FROM auth.users u
JOIN user_roles ur ON u.id = ur.user_id
WHERE ur.role = 'admin';
```

### Like System Verification ✅ NEW

Test the like system functionality:

```sql
-- Check if likes table has data
SELECT COUNT(*) FROM likes;

-- Check like distribution
SELECT 
  CASE 
    WHEN discussion_id IS NOT NULL THEN 'Discussion'
    WHEN reply_id IS NOT NULL THEN 'Reply'
  END as like_type,
  COUNT(*) as like_count
FROM likes 
GROUP BY like_type;

-- Check user like activity
SELECT 
  u.email,
  COUNT(l.id) as total_likes
FROM auth.users u
JOIN likes l ON u.id = l.user_id
GROUP BY u.id, u.email
ORDER BY total_likes DESC;
```

## Next Steps

After setup, you can:

1. Test creating a discussion thread
2. Test posting replies
3. Test the enhanced like system ✅ NEW
4. Test admin functionality by creating an admin user
5. Customize the styling to match your brand
6. Add additional features like:
   - Discussion categories/tags
   - Rich text editing
   - File attachments
   - Email notifications
   - Advanced moderation tools
   - User reputation system
   - Like analytics and reporting ✅ NEW

## Integration with Existing Features

The discussion forum integrates seamlessly with:
- **TWG Documents**: Users can reference documents in discussions
- **User Authentication**: Leverages existing Supabase auth system
- **Admin System**: Uses the same `user_roles` table as document management
- **Navigation**: Integrated into the main dashboard header
- **Enhanced Like System**: Full integration with user management and activity tracking ✅ NEW

## Support

If you encounter issues:
1. Check the browser console for JavaScript errors
2. Check the Supabase logs for database errors
3. Verify all environment variables are set correctly
4. Ensure your Supabase project has the correct permissions
5. Verify admin users are properly set up in the `user_roles` table
6. Check that RLS policies are correctly configured
7. Verify the like system tables and constraints are properly set up ✅ NEW
