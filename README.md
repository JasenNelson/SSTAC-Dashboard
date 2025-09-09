# SSTAC & TWG Dashboard

A comprehensive dashboard platform for the **Sediment Standards Technical Advisory Committee (SSTAC)** and **Technical Working Group (TWG)**. This platform manages sediment standards development through stakeholder engagement, document management, and administrative tools.

## 🚀 **Recent Major Updates**

### **Comprehensive Poll System** ✅ NEW
- **Interactive Polls**: Single-choice and ranking polls across 4 survey pages
- **Vote Persistence**: Votes remembered across page refreshes and sessions
- **Select-Then-Submit Pattern**: Clear user experience with explicit submit buttons
- **Change Vote Functionality**: Users can modify their previous choices
- **Real-time Results**: Live poll results with percentage displays
- **Database Integration**: Secure poll storage with Row Level Security
- **Admin Management**: Complete poll results viewing and management

### **Dark/Light Mode Theme System** ✅ NEW
- **Complete Theme Implementation**: Full dark/light mode support across all pages
- **Theme Persistence**: User preferences saved in localStorage
- **CSS Specificity Solution**: Resolved complex CSS override issues
- **Comprehensive Coverage**: All components and pages support both themes
- **Professional UI**: Consistent visual experience across all interfaces

### **Enhanced User Management System** ✅
- **100% User Visibility**: Admin dashboard now shows all authenticated users
- **Real Email Addresses**: No more "User 1234..." - displays actual user emails
- **Automatic Role Assignment**: New signups automatically get 'member' role
- **Complete Activity Tracking**: Monitor user engagement and participation
- **Professional Admin Interface**: Enterprise-level user management capabilities

### **Database Improvements** ✅
- **Secure User Email Access**: Safe database functions for user data
- **Enhanced Views**: Comprehensive user management and activity tracking
- **Automatic Triggers**: Self-maintaining user role system
- **Performance Optimization**: Efficient queries and indexing

## 🏗️ **Architecture**

### **Technology Stack**
- **Frontend**: Next.js 15+ with App Router, TypeScript, Tailwind CSS v4
- **Backend**: Supabase (PostgreSQL, Authentication, Real-time features)
- **State Management**: React hooks with localStorage backup
- **Theme System**: React Context API with CSS custom properties
- **Deployment**: Vercel

### **Component Architecture**
- **Server Components**: Handle authentication, database queries, initial rendering
- **Client Components**: Handle user interactions, state management, real-time updates
- **API Routes**: Bridge between client components and server actions
- **Server Actions**: Handle database operations with proper validation

### **File Structure**
```
src/
├── app/
│   ├── (auth)/           # Authentication pages
│   ├── (dashboard)/      # Main dashboard and admin
│   ├── api/              # API routes
│   └── globals.css       # Global styles
├── components/            # Reusable React components
│   ├── dashboard/        # Dashboard-specific components
│   └── shared/           # Common UI components
├── lib/                   # Utility functions and configurations
│   └── supabase/         # Supabase client and middleware
└── middleware.ts          # Route protection middleware
```

### **Core Components**
- **User Authentication**: Supabase Auth with role-based access control
- **Database**: PostgreSQL with Row Level Security (RLS)
- **Real-time Features**: Live updates for discussions and notifications
- **Admin Panel**: Comprehensive user and content management

## 📊 **Features**

### **Interactive Poll System** 🆕
- **Survey Pages**: 4 pages with interactive polls (Holistic Protection, Prioritization, Tiered Framework, WIKS)
- **Poll Types**: Single-choice polls and ranking polls with automatic detection
- **Vote Persistence**: All votes saved and remembered across sessions
- **User Experience**: Select-then-submit pattern with clear submit buttons
- **Change Votes**: Users can modify their previous choices anytime
- **Real-time Results**: Live poll results with percentage displays and progress bars
- **Admin Dashboard**: Complete poll results viewing and management
- **Database Security**: Row Level Security ensures data protection

### **Theme System** 🆕
- **Dark/Light Mode**: Complete theme switching with user preference persistence
- **CSS Specificity Solution**: Resolved complex styling override issues
- **Comprehensive Coverage**: All pages and components support both themes
- **Professional UI**: Consistent visual experience across all interfaces
- **Theme Toggle**: Easy switching between light and dark modes

### **User Management** 🆕
- **Complete User Visibility**: See all authenticated users in admin dashboard
- **Real Email Addresses**: Professional user communication capabilities
- **Automatic Role Assignment**: Self-maintaining user role system
- **Activity Tracking**: Monitor user engagement and participation
- **Role Management**: Promote/demote users between admin and member roles

### **Document Management**
- **File Upload**: Secure document storage and management
- **Tagging System**: Categorize documents for easy organization
- **Version Control**: Track document updates and changes
- **Access Control**: Role-based document permissions

### **Discussion Forum**
- **Threaded Discussions**: Create and participate in forum conversations
- **Real-time Updates**: Live notifications for new posts and replies
- **User Engagement**: Like system for content interaction
- **Moderation Tools**: Admin controls for forum management

### **Survey Results**
- **Interactive Charts**: Visual representation of stakeholder feedback
- **Data Analysis**: Comprehensive survey result analysis
- **Export Capabilities**: Download results in various formats
- **Historical Tracking**: Monitor changes over time

### **Admin Dashboard**
- **User Management**: Complete user visibility and control
- **Content Moderation**: Manage documents, discussions, and announcements
- **System Monitoring**: Track platform usage and engagement
- **Role Administration**: Manage user permissions and access

## 🔐 **Security Features**

### **Row Level Security (RLS)**
- **User Isolation**: Users can only access their own data
- **Admin Privileges**: Administrators can manage all content
- **Secure Functions**: Database functions respect RLS policies
- **Permission Control**: Granular access control for all operations

### **Authentication & Authorization**
- **Supabase Auth**: Secure user authentication system
- **Role-Based Access**: Different capabilities for admins vs members
- **Session Management**: Secure session handling and validation
- **API Security**: Protected endpoints with proper authentication

## 📁 **Project Structure**

```
src/
├── app/                    # Next.js App Router
│   ├── (auth)/           # Authentication pages
│   ├── (dashboard)/      # Main dashboard and admin
│   ├── api/              # API routes
│   └── globals.css       # Global styles
├── components/            # Reusable React components
│   ├── dashboard/        # Dashboard-specific components
│   └── shared/           # Common UI components
├── lib/                   # Utility functions and configurations
│   └── supabase/         # Supabase client and middleware
└── middleware.ts          # Route protection middleware
```

## 🚀 **Getting Started**

### **Prerequisites**
- Node.js 18+ 
- Supabase account and project
- Vercel account (for deployment)

### **Installation**

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
   ```bash
   # Run the enhanced database schema
   # This includes the new user management system
   ```

5. **Start Development Server**
   ```bash
   npm run dev
   ```

## 🗄️ **Database Setup**

### **Quick Database Setup**
1. Go to your Supabase dashboard
2. Navigate to the SQL Editor
3. Run the database schema from `DATABASE_GUIDE.md`
4. This creates all tables, views, functions, and RLS policies

### **Enhanced User Management** 🆕
The database includes a comprehensive user management system:

- **`get_users_with_emails()` Function**: Secure access to user emails
- **`users_overview` View**: Comprehensive user activity tracking
- **`admin_users_comprehensive` View**: Complete admin user management
- **Automatic Role Assignment**: New users get 'member' role automatically
- **Activity Tracking**: Monitor user engagement and participation

### **Core Tables**
- **`auth.users`**: Supabase managed authentication data
- **`user_roles`**: User role management and access control
- **`documents`**: File storage and management
- **`discussions`**: Forum conversations and user engagement
- **`likes`**: User interaction tracking ✅ NEW
- **`announcements`**: System notifications and updates
- **`milestones`**: Project timeline and progress tracking
- **`polls` & `poll_votes`**: Interactive poll system ✅ NEW

### **Database Security**
- **Row Level Security (RLS)**: All tables protected with proper policies
- **User Isolation**: Users can only see their own data
- **Admin Access**: Admins can manage all user data
- **Secure Functions**: Database functions respect RLS policies

## 🔧 **Configuration**

### **Environment Variables**
```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

### **Supabase Setup**
1. Create a new Supabase project
2. Enable Row Level Security (RLS)
3. Run the enhanced database schema
4. Configure authentication providers
5. Set up storage buckets for documents

## 📱 **Usage**

### **For Users**
1. **Sign Up**: Create an account with email verification
2. **Access Dashboard**: Navigate to main dashboard features
3. **Participate**: Join discussions, upload documents, engage with content
4. **Stay Updated**: Receive notifications for important updates

### **For Administrators**
1. **User Management**: Monitor all users and their activities
2. **Content Moderation**: Manage documents, discussions, and announcements
3. **System Administration**: Configure platform settings and permissions
4. **Analytics**: Track user engagement and platform usage

## 🧪 **Testing**

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

## 📈 **Performance**

### **Optimizations**
- **Database Views**: Efficient data aggregation and querying
- **Indexing Strategy**: Optimized database performance
- **Function Caching**: Secure and fast user data access
- **RLS Optimization**: Minimal security overhead

### **Monitoring**
- **User Growth**: Track platform adoption and usage
- **Activity Metrics**: Monitor user engagement levels
- **Performance Metrics**: Database query performance
- **Security Auditing**: RLS policy verification

## 🔄 **Deployment**

### **Vercel Deployment**
1. Connect your GitHub repository to Vercel
2. Configure environment variables
3. Deploy automatically on push to main branch
4. Monitor deployment status and performance

### **Database Migrations**
- **User Management**: Required for proper admin functionality
- **Document Tagging**: Optional enhancement for organization
- **Backup Strategy**: Always backup before running migrations
- **Rollback Plan**: Procedures for reverting changes if needed

## 🤝 **Contributing**

### **Development Guidelines**
1. **Code Style**: Follow TypeScript and React best practices
2. **Testing**: Write tests for new features and bug fixes
3. **Documentation**: Update relevant documentation for changes
4. **Security**: Ensure all changes maintain security standards

### **Database Changes**
1. **Schema Updates**: Document all database modifications
2. **Migration Scripts**: Create rollback procedures
3. **Testing**: Verify changes in development environment
4. **Documentation**: Update schema documentation

## 📚 **Documentation**

### **Core Documentation**
- **`README.md`**: Project overview and quick start (this file)
- **`AGENTS.md`**: AI assistant guidelines and project rules
- **`PROJECT_MEMORY.md`**: Lessons learned and project history
- **`PROJECT_STATUS.md`**: Current project status and completed features

### **Technical Documentation**
- **`DATABASE_GUIDE.md`**: Complete database schema, safety protocols, and poll system
- **`SETUP_GUIDE.md`**: Step-by-step setup and implementation instructions

### **API Documentation**
- **Authentication**: User login and role management
- **Documents**: File upload and management
- **Discussions**: Forum conversation management
- **Admin**: User and content administration
- **Polls**: Interactive poll system with vote persistence

## 🐛 **Troubleshooting**

### Common Issues

#### Theme System Issues
- **Background Not Changing**: CSS specificity issues with theme switching
- **Solution**: Use high-specificity selectors like `html.light` instead of `.light body`
- **Verification**: Check browser console for theme class application
- **Documentation**: See `DEBUGGING_LESSONS.md` for comprehensive troubleshooting

#### Users Not Visible in Admin Dashboard
- **Cause**: Users may not have roles assigned or email confirmation issues
- **Solution**: Check role assignment in `user_roles` table and email confirmation status
- **Verification**: Use the admin dashboard to view all users and their roles

#### Permission Errors
- **Cause**: RLS policies or role assignment issues
- **Solution**: Verify user has appropriate role in `user_roles` table
- **Verification**: Check user roles through admin dashboard

#### Signup Issues
- **Status**: ✅ RESOLVED
- **Previous Issue**: Temporary 500 errors during signup were caused by Supabase service issues, not database configuration
- **Current State**: Signup process works normally with automatic role assignment
- **Verification**: New users can sign up and automatically receive 'member' role

### Database Health Checks

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

## 🔮 **Roadmap**

### **Short Term**
- **Enhanced Analytics**: Advanced user engagement metrics
- **Notification System**: Real-time user activity notifications
- **Mobile Optimization**: Responsive design improvements
- **Performance Monitoring**: Advanced performance tracking

### **Long Term**
- **User Groups**: Organization and team management
- **Advanced Roles**: Complex permission hierarchies
- **API Integration**: External system integration
- **Scalability**: Support for larger user bases

## 📄 **License**

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 **Acknowledgments**

- **SSTAC Committee**: For project requirements and feedback
- **TWG Members**: For technical guidance and testing
- **Supabase Team**: For excellent backend-as-a-service platform
- **Next.js Team**: For powerful React framework
- **Open Source Community**: For valuable tools and libraries

## 📞 **Support**

### **Technical Support**
- **Documentation**: Comprehensive guides and examples
- **Migration Support**: Step-by-step migration assistance
- **Troubleshooting**: Common issues and solutions
- **Performance**: Optimization and monitoring guidance

### **User Support**
- **Admin Training**: User management system training
- **Feature Requests**: Submit enhancement suggestions
- **Bug Reports**: Report issues and problems
- **General Questions**: Platform usage and configuration

---

**SSTAC & TWG Dashboard** - Professional user management and stakeholder engagement platform for sediment standards development.