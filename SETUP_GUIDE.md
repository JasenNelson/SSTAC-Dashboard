# Setup Guide for SSTAC & TWG Dashboard

## 🚀 **Quick Start Setup**

### **Prerequisites**
- Node.js 18+ 
- Supabase account and project
- Vercel account (for deployment)

### **Installation Steps**

1. **Clone the repository**
   ```bash
   git clone [repository-url]
   cd SSTAC-Dashboard
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Setup**
   ```bash
   cp .env.example .env.local
   # Fill in your Supabase credentials
   ```

4. **Database Setup**
   - Go to your Supabase dashboard
   - Navigate to the SQL Editor
   - Run the database schema from `DATABASE_GUIDE.md`

5. **Start Development Server**
   ```bash
   npm run dev
   ```

## 🗄️ **Database Setup**

### **1. Enhanced User Management Setup**

**Problem Solved**: Admin dashboard was not showing all users and their email addresses.

**Solution**: Implemented comprehensive user management with real email access.

Run these SQL commands in your Supabase SQL editor:

```sql
-- Step 1: Create safe user email access function
CREATE OR REPLACE FUNCTION get_users_with_emails()
RETURNS TABLE (
    id UUID,
    email CHARACTER VARYING(255),
    created_at TIMESTAMP WITH TIME ZONE,
    last_sign_in TIMESTAMP WITH TIME ZONE
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    IF auth.role() != 'authenticated' THEN
        RAISE EXCEPTION 'Access denied. Only authenticated users can call this function.';
    END IF;
    
    RETURN QUERY
    SELECT 
        au.id,
        au.email,
        au.created_at,
        au.last_sign_in_at
    FROM auth.users au
    WHERE au.email_confirmed_at IS NOT NULL
    ORDER BY au.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION get_users_with_emails() TO authenticated;

-- Step 2: Create enhanced user management views
CREATE OR REPLACE VIEW users_overview AS
WITH user_activities AS (
    SELECT user_id, NULL as user_email, created_at, 'role' as activity_type
    FROM user_roles
    UNION ALL
    SELECT user_id, user_email, created_at, 'discussion' as activity_type
    FROM discussions WHERE user_id IS NOT NULL
    UNION ALL
    SELECT user_id, NULL as user_email, created_at, 'like' as activity_type
    FROM likes WHERE user_id IS NOT NULL
),
auth_user_emails AS (
    SELECT id, email, created_at FROM get_users_with_emails()
)
SELECT DISTINCT
    ua.user_id as id,
    COALESCE(ua.user_email, aue.email, 'User ' || LEFT(ua.user_id::text, 8) || '...') as email,
    COALESCE(aue.created_at, MIN(ua.created_at)) as first_activity,
    MAX(ua.created_at) as last_activity,
    ur.role,
    CASE WHEN ur.role = 'admin' THEN true ELSE false END as is_admin,
    COUNT(DISTINCT ua.activity_type) as activity_count,
    ARRAY_AGG(DISTINCT ua.activity_type) FILTER (WHERE ua.activity_type IS NOT NULL) as activities
FROM user_activities ua
LEFT JOIN user_roles ur ON ua.user_id = ur.user_id
LEFT JOIN auth_user_emails aue ON ua.user_id = aue.id
GROUP BY ua.user_id, ua.user_email, ur.role, aue.email, aue.created_at
ORDER BY last_activity DESC;

GRANT SELECT ON users_overview TO authenticated;

-- Step 3: Create comprehensive admin user view
CREATE OR REPLACE VIEW admin_users_comprehensive AS
SELECT 
    au.id,
    au.email,
    au.created_at as auth_created_at,
    au.last_sign_in_at,
    ur.role,
    ur.created_at as role_created_at,
    CASE WHEN ur.role = 'admin' THEN true ELSE false END as is_admin,
    CASE WHEN ur.role IS NOT NULL THEN 'Has Role' ELSE 'No Role' END as role_status,
    COALESCE((SELECT COUNT(*) FROM discussions disc WHERE disc.user_id = au.id), 0) as discussion_count,
    COALESCE((SELECT COUNT(*) FROM likes l WHERE l.user_id = au.id), 0) as like_count,
    0 as document_count,
    CASE WHEN au.email_confirmed_at IS NOT NULL THEN 'Confirmed' ELSE 'Unconfirmed' END as email_status
FROM auth.users au
LEFT JOIN user_roles ur ON au.id = ur.user_id
WHERE au.email_confirmed_at IS NOT NULL
ORDER BY au.created_at DESC;

GRANT SELECT ON admin_users_comprehensive TO authenticated;

-- Step 4: Implement automatic user role assignment
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO user_roles (user_id, role, created_at)
    VALUES (NEW.id, 'member', NOW())
    ON CONFLICT (user_id, role) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION handle_new_user();

-- Step 5: Backfill existing users without roles
INSERT INTO user_roles (user_id, role, created_at)
SELECT au.id, 'member', au.created_at
FROM auth.users au
WHERE au.email_confirmed_at IS NOT NULL
AND NOT EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = au.id)
ON CONFLICT (user_id, role) DO NOTHING;
```

**Benefits of User Management Setup:**
- ✅ **100% user visibility** in admin dashboard
- ✅ **Real email addresses** for all users
- ✅ **Automatic role assignment** for new signups
- ✅ **Activity tracking** and engagement metrics
- ✅ **Complete user management** capabilities

### **2. Document Tagging System Setup (Optional Enhancement)**

**Note**: This is an optional enhancement for better document organization.

```sql
-- Create tags table for document categorization
CREATE TABLE IF NOT EXISTS tags (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  color TEXT DEFAULT '#6B7280',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Create document_tags junction table for many-to-many relationship
CREATE TABLE IF NOT EXISTS document_tags (
  id BIGSERIAL PRIMARY KEY,
  document_id BIGINT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  tag_id BIGINT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(document_id, tag_id)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_document_tags_document_id ON document_tags(document_id);
CREATE INDEX IF NOT EXISTS idx_document_tags_tag_id ON document_tags(tag_id);
CREATE INDEX IF NOT EXISTS idx_tags_name ON tags(name);

-- Enable RLS for new tables
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_tags ENABLE ROW LEVEL SECURITY;

-- RLS Policies for tags table
CREATE POLICY "Users can view all tags" ON tags
  FOR SELECT USING (true);

CREATE POLICY "Only admins can create tags" ON tags
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Only admins can update tags" ON tags
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Only admins can delete tags" ON tags
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- RLS Policies for document_tags table
CREATE POLICY "Users can view all document tags" ON document_tags
  FOR SELECT USING (true);

CREATE POLICY "Only admins can manage document tags" ON document_tags
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Grant necessary permissions
GRANT ALL ON tags TO authenticated;
GRANT ALL ON document_tags TO authenticated;
GRANT USAGE ON SEQUENCE tags_id_seq TO authenticated;
GRANT USAGE ON SEQUENCE document_tags_id_seq TO authenticated;

-- Insert some default tags for common document categories
INSERT INTO tags (name, color) VALUES 
  ('Technical Specification', '#3B7280'),    -- Blue
  ('Meeting Minutes', '#10B981'),           -- Green
  ('Policy Document', '#F59E0B'),           -- Yellow
  ('Procedure Guide', '#8B5CF6'),           -- Purple
  ('Research Paper', '#EF4444'),            -- Red
  ('Standard Operating Procedure', '#06B6D4'), -- Cyan
  ('Training Material', '#84CC16'),         -- Lime
  ('Reference Document', '#F97316')         -- Orange
ON CONFLICT (name) DO NOTHING;
```

## 🗣️ **TWG Discussion Forum Setup**

### **Overview**
The TWG Discussion Forum allows users to:
- Create new discussion threads
- Reply to existing discussions
- View all discussions and replies
- Edit and delete their own content
- **Admin users can edit/delete any content**
- **Like and unlike discussions and replies** ✅ NEW FEATURE
- **See who liked what with timestamps** ✅ NEW FEATURE

### **Database Setup**

1. **Run the Database Schema**
   - Go to your Supabase dashboard
   - Navigate to the SQL Editor
   - Copy and paste the contents from `DATABASE_GUIDE.md`
   - Run the SQL commands

This will create:
- `discussions` table for main discussion threads
- `discussion_replies` table for replies to discussions
- `user_roles` table for role-based access control
- `likes` table for user interactions ✅ NEW TABLE
- Proper indexes for performance
- Row Level Security (RLS) policies for data protection
- Automatic timestamp updates

2. **Verify Tables Created**

After running the schema, you should see:
- `discussions` table in your database
- `discussion_replies` table in your database
- `user_roles` table in your database
- `likes` table in your database ✅ NEW
- RLS policies enabled on all tables

3. **Set Up Admin Users**

To grant admin privileges, run this SQL:

```sql
-- Add a user as admin (replace 'user-uuid-here' with actual user UUID)
INSERT INTO user_roles (user_id, role) 
VALUES ('user-uuid-here', 'admin');

-- Verify admin role was created
SELECT * FROM user_roles WHERE role = 'admin';
```

### **Forum Features**

#### **Discussion Management**
- **Create Discussions**: Users can start new discussion threads with titles and content
- **View Discussions**: All users can see all discussions
- **Edit Discussions**: Users can edit their own discussions, admins can edit any
- **Delete Discussions**: Users can delete their own discussions, admins can delete any

#### **Reply System**
- **Post Replies**: Users can reply to any discussion
- **View Replies**: All replies are visible to all users
- **Edit Replies**: Users can edit their own replies, admins can edit any
- **Delete Replies**: Users can delete their own replies, admins can delete any

#### **Enhanced Like System** ✅ NEW FEATURE
- **Like/Unlike**: Users can like and unlike discussions and replies
- **User Attribution**: Click to see who liked what with timestamps
- **Real-time Updates**: Like counts update immediately
- **Performance**: Optimized queries with proper indexing
- **Security**: Row-level security for all like operations

#### **Security Features**
- **Authentication Required**: Users must be logged in to create/edit/delete content
- **Ownership Protection**: Users can only modify their own content by default
- **Admin Override**: Admin users have full access to all content
- **Row Level Security**: Database-level security policies
- **Cascade Deletion**: Deleting a discussion removes all associated replies and likes

### **Forum Usage**

#### **Accessing the Forum**
1. Navigate directly to `/twg/discussions` in your dashboard
2. Or use the navigation header - click "TWG Forum" link

#### **Creating a Discussion**
1. Click "Start New Discussion"
2. Fill in the title and content
3. Click "Create Discussion"

#### **Replying to a Discussion**
1. Click "Reply" on any discussion
2. Write your reply in the text area
3. Click "Post Reply"

#### **Using the Like System** ✅ NEW
1. **Like a Discussion**: Click the heart icon on any discussion
2. **Like a Reply**: Click the heart icon on any reply
3. **See Who Liked**: Click the like count to expand and see user details
4. **Unlike**: Click the heart icon again to remove your like
5. **Real-time Updates**: Like counts update immediately

#### **Admin Functions**
- **Edit Any Content**: Admin users see edit/delete buttons on all discussions and replies
- **Delete Any Content**: Admin users can remove inappropriate or outdated content
- **Moderation**: Full control over forum content management
- **Like Management**: Admin users can see all like activity

### **Forum API Endpoints**

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

### **Forum Components**

The discussion forum consists of these React components:

- `TwgDiscussionsPage` - Main discussion forum page with discussion list and new discussion form
- `NewDiscussionForm` - Form for creating new discussions
- `DiscussionThread` - Individual discussion thread with replies, edit/delete functionality, and reply management
- `LikeButton` - Enhanced like system with user attribution and real-time updates ✅ NEW

### **Enhanced Like System Implementation** ✅ COMPLETED

#### **Database Structure**
- **likes table**: Tracks user interactions with discussions and replies
- **Constraints**: Users can only like either a discussion OR a reply, not both
- **Uniqueness**: Users can only like a specific discussion/reply once
- **Cascade**: Likes are automatically removed when discussions/replies are deleted

#### **User Experience Features**
- **Click to Expand**: Click like count to see who liked what
- **User Attribution**: Display user information and timestamps
- **Real-time Updates**: Like counts and status update immediately
- **Visual Feedback**: Heart icon changes color and fills when liked

#### **Performance Features**
- **Efficient Indexing**: Proper database indexes for fast like queries
- **Optimized Queries**: Minimal database calls for like operations
- **Caching Strategy**: Smart caching of like status and counts

### **Role-Based Access Control**

The forum implements a sophisticated permission system:

#### **Regular Users**
- Can create discussions and replies
- Can edit/delete their own content
- Can view all content
- Can like/unlike any discussion or reply ✅ NEW
- Can see who liked what content ✅ NEW

#### **Admin Users**
- Have all regular user permissions
- Can edit/delete any discussion or reply
- Can moderate forum content
- Can see admin badge in the header
- Can manage all like activity ✅ NEW

#### **Admin Role Verification**
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

### **Forum Styling**

The forum uses Tailwind CSS v4 for styling and follows the same design patterns as the rest of your dashboard:
- Consistent color scheme (indigo, gray)
- Responsive design for mobile and desktop
- Modern card-based layout
- Hover effects and transitions
- Enhanced like button styling with heart icons ✅ NEW

## 🔧 **Environment Configuration**

### **Environment Variables**
```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

### **Supabase Setup**
1. Create a new Supabase project
2. Enable Row Level Security (RLS)
3. Run the database schema from `DATABASE_GUIDE.md`
4. Configure authentication providers
5. Set up storage buckets for documents

## 🧪 **Testing Setup**

### **User Management Testing**
```bash
# Test user visibility
npm run test:users

# Test admin capabilities
npm run test:admin

# Test role assignment
npm run test:roles
```

### **Database Testing**
```bash
# Test database functions
npm run test:db

# Test RLS policies
npm run test:security

# Test performance
npm run test:performance
```

## 🔍 **Verification Steps**

### **User Management Verification**

1. **Check user management functions:**
   ```sql
   SELECT routine_name FROM information_schema.routines 
   WHERE routine_name = 'get_users_with_emails';
   ```

2. **Check user management views:**
   ```sql
   SELECT table_name FROM information_schema.views 
   WHERE table_name IN ('users_overview', 'admin_users_comprehensive');
   ```

3. **Test user coverage:**
   ```sql
   SELECT COUNT(*) as total_users FROM admin_users_comprehensive;
   SELECT COUNT(*) as users_with_emails FROM get_users_with_emails();
   ```

### **Document Tagging Verification (Optional)**

1. **Check tables exist:**
   ```sql
   SELECT table_name FROM information_schema.tables 
   WHERE table_schema = 'public' 
   AND table_name IN ('tags', 'document_tags');
   ```

2. **Check default tags:**
   ```sql
   SELECT * FROM tags ORDER BY name;
   ```

3. **Check RLS policies:**
   ```sql
   SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
   FROM pg_policies 
   WHERE tablename IN ('tags', 'document_tags');
   ```

### **Forum Verification**

Run this query to verify your forum setup:

```sql
SELECT 
  table_name, 
  table_type 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN ('discussions', 'discussion_replies', 'user_roles', 'likes');
```

You should see all four tables listed.

### **Admin Role Verification**

Check if a user has admin privileges:

```sql
SELECT u.email, ur.role 
FROM auth.users u
JOIN user_roles ur ON u.id = ur.user_id
WHERE ur.role = 'admin';
```

### **Like System Verification** ✅ NEW

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

## 🚨 **Troubleshooting**

### **Common Issues**

1. **"Table doesn't exist" errors**
   - Make sure you've run the database schema
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

### **Database Health Checks**

Run these queries in Supabase SQL Editor to verify system health:

```sql
-- Check user role distribution
SELECT role, COUNT(*) as count 
FROM user_roles 
GROUP BY role;

-- Verify views are working
SELECT COUNT(*) as total_users FROM admin_users_comprehensive;
SELECT COUNT(*) as users_with_emails FROM get_users_with_emails();

-- Check trigger status
SELECT trigger_name, event_manipulation, action_statement 
FROM information_schema.triggers 
WHERE event_object_table = 'users' AND trigger_schema = 'auth';
```

## 📋 **Post-Setup Checklist**

After completing the setup:

### **User Management**
- [ ] **Test your admin dashboard** - you should see all users with real emails
- [ ] **Verify user role assignment** - new signups should automatically get 'member' role
- [ ] **Test user management** through the admin interface (`/admin/users`)

### **Document Tagging (Optional)**
- [ ] **Test the tag management** through the admin interface (`/admin/tags`)
- [ ] **Test document creation** with tags
- [ ] **Test tag filtering** on the documents list page

### **Discussion Forum**
- [ ] **Test creating a discussion thread**
- [ ] **Test posting replies**
- [ ] **Test the enhanced like system** ✅ NEW
- [ ] **Test admin functionality** by creating an admin user

## 🚀 **Next Steps**

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

## 🔗 **Integration with Existing Features**

The discussion forum integrates seamlessly with:
- **TWG Documents**: Users can reference documents in discussions
- **User Authentication**: Leverages existing Supabase auth system
- **Admin System**: Uses the same `user_roles` table as document management
- **Navigation**: Integrated into the main dashboard header
- **Enhanced Like System**: Full integration with user management and activity tracking ✅ NEW

## 📞 **Support**

If you encounter issues:

1. Check the browser console for JavaScript errors
2. Check the Supabase logs for database errors
3. Verify all environment variables are set correctly
4. Ensure your Supabase project has the correct permissions
5. Verify admin users are properly set up in the `user_roles` table
6. Check that RLS policies are correctly configured
7. Verify the like system tables and constraints are properly set up ✅ NEW

## 📚 **Related Documentation**

- **DATABASE_GUIDE.md**: Complete database schema and safety protocols
- **AGENTS.md**: AI assistant guidelines for setup work
- **PROJECT_MEMORY.md**: Setup-related lessons learned
- **PROJECT_STATUS.md**: Current setup implementation status
- **README.md**: Project overview and quick start

---

**Remember**: This setup guide provides comprehensive instructions for getting the SSTAC & TWG Dashboard fully operational. Always follow the database safety protocols and test thoroughly before deploying to production.
