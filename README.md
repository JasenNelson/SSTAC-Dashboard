# SSTAC & TWG Dashboard

A comprehensive dashboard platform for the **Sediment Standards Technical Advisory Committee (SSTAC)** and **Technical Working Group (TWG)**. This platform manages sediment standards development through stakeholder engagement, document management, and administrative tools.

## 🚀 **Recent Major Updates**

### **Code Quality Improvements** ✅ NEW (2025-01-14)
- **Production-Ready Build**: Successful compilation with no errors
- **TypeScript Type Safety**: Replaced critical `any` types with proper definitions
- **JSX Quote Escaping**: Fixed all unescaped quotes across the application
- **Import Cleanup**: Removed unused imports and variables
- **Linting Improvements**: Significantly reduced errors from 89+ to mostly warnings
- **Build Verification**: Confirmed successful production build
- **Menu Updates**: Changed "CEW 2025" to "SABCS Session" in header navigation

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

### **CEW Conference Polling System** ✅ NEW (FINAL VERSION)
- **Unauthenticated Polling**: Conference attendees can vote without accounts
- **Shared Code Authentication**: Single code (e.g., "CEW2025") for all attendees
- **Privacy-Focused Design**: No client-side persistence for true privacy in incognito mode
- **Session Persistence**: Code remembered for entire conference session
- **Unified Database**: CEW votes combined with authenticated user votes
- **Mobile-Optimized**: Perfect for conference mobile devices with enhanced UI contrast
- **Real-time Results**: Live polling during presentations
- **Conference Pages**: 4 dedicated poll pages for different survey topics
- **Efficient Polling**: Optimized for 100 people in 15 minutes
- **Simplified Constraints**: Removed complex database constraints for reliable operation
- **Menu Update**: Changed from "CEW 2025" to "SABCS Session" in header navigation

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

#### **Poll System Technical Details**
- **Database Tables**: `polls`, `poll_votes`, `ranking_polls`, `ranking_votes`
- **Result Views**: `poll_results`, `ranking_results` for aggregated data
- **Helper Functions**: `get_or_create_poll()`, `get_or_create_ranking_poll()`
- **API Endpoints**: `/api/polls/submit`, `/api/polls/results`, `/api/ranking-polls/submit`, `/api/ranking-polls/results`
- **Vote Tracking**: Uses `localStorage` for CEW polls, database for authenticated users
- **Mobile Optimization**: Responsive design with clean hover-free charts
- **Security**: RLS policies for user isolation and admin access

### **CEW Conference Polling** 🆕
- **Unauthenticated Access**: Conference attendees vote without creating accounts
- **Shared Code System**: Single code (e.g., "CEW2025") for all attendees
- **Mobile-Optimized**: Perfect for conference mobile devices
- **Device Tracking**: Prevents duplicate votes per device
- **Session Memory**: Code remembered for entire conference session
- **Unified Results**: CEW votes combined with authenticated user data
- **Real-time Polling**: Live results during presentations
- **Conference Pages**: 4 dedicated poll pages:
  - `/cew-polls/wiks` - 3 single-choice polls
  - `/cew-polls/holistic-protection` - 1 single-choice + 1 ranking poll
  - `/cew-polls/prioritization` - 6 ranking polls
  - `/cew-polls/tiered-framework` - 1 single-choice + 1 ranking poll
- **Efficient Design**: Optimized for 100 people in 15 minutes
- **No Change Votes**: One vote per device to prevent confusion

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
- **`ranking_polls` & `ranking_votes`**: Ranking poll system ✅ NEW
- **`poll_results` & `ranking_results`**: Aggregated poll results views ✅ NEW

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
- **`POLL_SYSTEM_DEBUGGING_GUIDE.md`**: Critical debugging guide for poll system issues
- **`SETUP_GUIDE.md`**: Step-by-step setup and implementation instructions

### **API Documentation**
- **Authentication**: User login and role management
- **Documents**: File upload and management
- **Discussions**: Forum conversation management
- **Admin**: User and content administration
- **Polls**: Interactive poll system with vote persistence

## 🗳️ **Poll and Ranking Question System Documentation**

### **System Overview**
The poll and ranking question system provides interactive voting capabilities for both authenticated users and conference attendees. The system supports two types of polls: single-choice polls and ranking polls.

### **Poll Types**

#### **Single-Choice Polls**
- **Purpose**: Users select one option from multiple choices
- **Database**: Stored in `polls` and `poll_votes` tables
- **UI Components**: `PollWithResults` component
- **Vote Storage**: One vote per user per poll (upsert on change)
- **Results**: Real-time percentage and vote count display

#### **Ranking Polls**
- **Purpose**: Users rank multiple options in order of preference
- **Database**: Stored in `ranking_polls` and `ranking_votes` tables
- **UI Components**: `RankingPoll` component
- **Vote Storage**: Multiple votes per user per poll (one per option)
- **Results**: Average rank calculation with visual bar charts

### **Database Schema**

#### **Core Tables**
```sql
-- Single-choice polls
polls (id, page_path, poll_index, question, options, created_at, updated_at)
poll_votes (id, poll_id, user_id, option_index, voted_at)

-- Ranking polls  
ranking_polls (id, page_path, poll_index, question, options, created_at, updated_at)
ranking_votes (id, ranking_poll_id, user_id, option_index, rank, voted_at)
```

#### **Result Views**
```sql
-- Aggregated single-choice results
poll_results (poll_id, page_path, poll_index, question, options, total_votes, results)

-- Aggregated ranking results
ranking_results (ranking_poll_id, page_path, poll_index, question, options, total_votes, results)
```

### **API Endpoints**

#### **Single-Choice Polls**
- **`POST /api/polls/submit`**: Submit or update a single-choice vote
- **`GET /api/polls/results`**: Retrieve poll results and user's current vote

#### **Ranking Polls**
- **`POST /api/ranking-polls/submit`**: Submit or update ranking votes
- **`GET /api/ranking-polls/results`**: Retrieve ranking results and user's current rankings

### **Authentication Modes**

#### **Authenticated Users**
- **User ID**: UUID from `auth.users` table
- **Vote Storage**: Direct database storage
- **Change Votes**: Allowed (can modify previous choices)
- **Session Persistence**: Votes remembered across sessions

#### **CEW Conference Attendees**
- **User ID**: CEW code (e.g., "CEW2025") stored as TEXT
- **Vote Storage**: Database with CEW code as user_id
- **Change Votes**: Not allowed (one vote per device)
- **Session Persistence**: CEW code remembered in sessionStorage

### **Vote Tracking System**

#### **Device-Based Tracking**
- **CEW Polls**: Uses `localStorage` with `cew_tracker_` prefix
- **Main Dashboard**: Uses database storage with user authentication
- **Prevention**: Prevents duplicate votes per device for CEW polls

#### **Vote Persistence**
- **Authenticated**: Votes stored in database with user UUID
- **CEW**: Votes stored in database with CEW code
- **Memory**: Previous votes loaded and displayed on page load

### **UI/UX Design**

#### **Mobile Optimization**
- **Clean Charts**: No excessive hover tooltips for mobile readability
- **Responsive Design**: Charts adapt to different screen sizes
- **Touch-Friendly**: Large buttons and touch targets
- **Fast Loading**: Optimized for conference mobile devices

#### **Chart Components**
- **Poll Results**: `PollResultsChart` with clean bar charts
- **Ranking Results**: `PollResultsChart` with ranking visualization
- **Interactive Features**: Hover effects without overwhelming text
- **Real-time Updates**: Live results during voting

### **Security Implementation**

#### **Row Level Security (RLS)**
- **User Isolation**: Users can only see their own votes
- **Admin Access**: Admins can view all votes and results
- **Anonymous Access**: CEW polls allow anonymous voting
- **Data Protection**: All poll data protected by RLS policies

#### **Vote Validation**
- **Option Validation**: Ensures selected options exist
- **User Validation**: Verifies user has permission to vote
- **Duplicate Prevention**: Database constraints prevent duplicate votes
- **Data Integrity**: Proper foreign key relationships

### **Performance Optimization**

#### **Database Efficiency**
- **Indexed Queries**: Optimized for fast poll result retrieval
- **View Materialization**: Pre-calculated aggregated results
- **Function Caching**: Efficient poll creation and vote submission
- **RLS Optimization**: Minimal security overhead

#### **Frontend Performance**
- **Component Optimization**: Efficient React component updates
- **State Management**: Minimal re-renders on vote changes
- **API Efficiency**: Single API calls for poll results
- **Caching**: Local storage for CEW code persistence

### **Error Handling**

#### **Database Errors**
- **RLS Violations**: Graceful handling of permission errors
- **Constraint Violations**: User-friendly error messages
- **Connection Issues**: Fallback to cached data when possible
- **Timeout Protection**: 10-second timeout on database operations

#### **UI Error States**
- **Loading States**: Clear indication when polls are loading
- **Error Messages**: User-friendly error notifications
- **Retry Logic**: Automatic retry for failed operations
- **Fallback UI**: Graceful degradation when polls fail to load

### **Development Guidelines**

#### **Adding New Polls**
1. **Define Poll Data**: Create poll configuration with question and options
2. **Component Integration**: Use `PollWithResults` or `RankingPoll` components
3. **API Integration**: Ensure proper API endpoint usage
4. **Testing**: Verify vote persistence and result display
5. **Mobile Testing**: Test on mobile devices for responsiveness

#### **Modifying Poll Behavior**
1. **Database Changes**: Update schema and RLS policies if needed
2. **API Updates**: Modify API endpoints for new functionality
3. **Component Updates**: Update UI components for new features
4. **Testing**: Comprehensive testing of all poll types
5. **Documentation**: Update this documentation for changes

### **Troubleshooting**

#### **Common Issues**
- **Votes Not Persisting**: Check RLS policies and user authentication
- **Results Not Updating**: Verify API endpoints and database views
- **Mobile Display Issues**: Check responsive design and hover tooltips
- **CEW Code Issues**: Verify sessionStorage and localStorage usage

#### **Debug Queries**
```sql
-- Check poll data
SELECT * FROM polls WHERE page_path = '/survey-results/holistic-protection';

-- Check user votes
SELECT * FROM poll_votes WHERE user_id = 'user-uuid-here';

-- Check poll results
SELECT * FROM poll_results WHERE page_path = '/survey-results/holistic-protection';

-- Check ranking results
SELECT * FROM ranking_results WHERE page_path = '/survey-results/holistic-protection';
```

### **Future Enhancements**

#### **Planned Features**
- **Bulk Poll Management**: Admin interface for managing multiple polls
- **Advanced Analytics**: Detailed poll result analysis and reporting
- **Export Capabilities**: Download poll results in various formats
- **Real-time Notifications**: Live updates when polls are submitted

#### **Scalability Improvements**
- **Caching Layer**: Redis for improved performance
- **CDN Integration**: Faster poll result delivery
- **Database Sharding**: Support for larger poll volumes
- **API Rate Limiting**: Protection against abuse

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