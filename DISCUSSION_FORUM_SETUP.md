# TWG Discussion Forum Setup Guide

This guide will help you set up the TWG Discussion Forum feature in your SSTAC Dashboard.

## Overview

The TWG Discussion Forum allows users to:
- Create new discussion threads
- Reply to existing discussions
- View all discussions and replies
- Edit and delete their own content
- **Admin users can edit/delete any content**

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
- Proper indexes for performance
- Row Level Security (RLS) policies for data protection
- Automatic timestamp updates

### 2. Verify Tables Created

After running the schema, you should see:
- `discussions` table in your database
- `discussion_replies` table in your database
- `user_roles` table in your database
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

### Security Features
- **Authentication Required**: Users must be logged in to create/edit/delete content
- **Ownership Protection**: Users can only modify their own content by default
- **Admin Override**: Admin users have full access to all content
- **Row Level Security**: Database-level security policies
- **Cascade Deletion**: Deleting a discussion removes all associated replies

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

### Admin Functions
- **Edit Any Content**: Admin users see edit/delete buttons on all discussions and replies
- **Delete Any Content**: Admin users can remove inappropriate or outdated content
- **Moderation**: Full control over forum content management

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

## Role-Based Access Control

The forum implements a sophisticated permission system:

### Regular Users
- Can create discussions and replies
- Can edit/delete their own content
- Can view all content

### Admin Users
- Have all regular user permissions
- Can edit/delete any discussion or reply
- Can moderate forum content
- See admin badge in the header

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

## Troubleshooting

### Common Issues

1. **"Table doesn't exist" errors**
   - Make sure you've run the database schema SQL
   - Check that the tables were created successfully

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

### Database Verification

Run this query to verify your setup:

```sql
SELECT 
  table_name, 
  table_type 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN ('discussions', 'discussion_replies', 'user_roles');
```

You should see all three tables listed.

### Admin Role Verification

Check if a user has admin privileges:

```sql
SELECT u.email, ur.role 
FROM auth.users u
JOIN user_roles ur ON u.id = ur.user_id
WHERE ur.role = 'admin';
```

## Next Steps

After setup, you can:

1. Test creating a discussion thread
2. Test posting replies
3. Test admin functionality by creating an admin user
4. Customize the styling to match your brand
5. Add additional features like:
   - Discussion categories/tags
   - Rich text editing
   - File attachments
   - Email notifications
   - Advanced moderation tools
   - User reputation system

## Integration with Existing Features

The discussion forum integrates seamlessly with:
- **TWG Documents**: Users can reference documents in discussions
- **User Authentication**: Leverages existing Supabase auth system
- **Admin System**: Uses the same `user_roles` table as document management
- **Navigation**: Integrated into the main dashboard header

## Support

If you encounter issues:
1. Check the browser console for JavaScript errors
2. Check the Supabase logs for database errors
3. Verify all environment variables are set correctly
4. Ensure your Supabase project has the correct permissions
5. Verify admin users are properly set up in the `user_roles` table
6. Check that RLS policies are correctly configured
