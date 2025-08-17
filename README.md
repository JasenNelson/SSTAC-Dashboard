# SSTAC & TWG Dashboard

A comprehensive dashboard platform for the Sediment Standards Technical Advisory Committee (SSTAC) and Technical Working Group (TWG), providing centralized access to project documents, stakeholder engagement results, and administrative tools.

## 🚀 Key Features

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

## 🏗️ Project Structure

```
src/
├── app/
│   ├── (dashboard)/
│   │   ├── admin/                    # Admin management system ✅ COMPLETED
│   │   │   ├── page.tsx             # Main admin dashboard
│   │   │   ├── AdminDashboardClient.tsx  # Client component with admin refresh
│   │   │   ├── users/               # User management ✅ COMPLETED
│   │   │   ├── tags/                # Tag management ✅ COMPLETED
│   │   │   ├── announcements/       # Announcement management ✅ COMPLETED
│   │   │   └── milestones/          # Milestone management ✅ COMPLETED
│   │   ├── dashboard/               # Main dashboard landing page ✅ COMPLETED
│   │   ├── survey-results/          # Survey results and analysis ✅ COMPLETED
│   │   ├── cew-2025/               # CEW conference information ✅ COMPLETED
│   │   └── twg/                    # TWG-specific features ✅ COMPLETED
│   ├── api/                        # API routes for client components ✅ COMPLETED
│   │   ├── tags/                   # Tag CRUD operations
│   │   ├── announcements/          # Announcement CRUD operations
│   │   ├── milestones/             # Milestone CRUD operations
│   │   ├── discussions/            # Discussion CRUD operations
│   │   └── documents/              # Document CRUD operations
│   └── globals.css                 # Global styles and Tailwind imports
├── components/
│   ├── Header.tsx                  # Global navigation with admin badge persistence ✅ COMPLETED
│   ├── Toast.tsx                   # Toast notification system ✅ COMPLETED
│   └── dashboard/                  # Dashboard-specific components ✅ COMPLETED
│       ├── TagManagement.tsx       # Tag CRUD with admin status refresh
│       ├── AnnouncementsManagement.tsx  # Announcement CRUD with admin status refresh
│       ├── MilestonesManagement.tsx     # Milestone CRUD with admin status refresh
│       ├── AdminUsersManager.tsx   # User management interface
│       ├── Announcements.tsx       # Dashboard announcements display
│       ├── ProjectTimeline.tsx     # Dashboard milestones display
│       ├── SurveyResultsChart.tsx  # Interactive survey charts
│       ├── VoicesCarousel.tsx      # Stakeholder quotes carousel
│       ├── ProjectPhases.tsx      # Expandable project phases
│       └── LikeButton.tsx          # Enhanced like system ✅ COMPLETED
├── lib/
│   └── supabase/                   # Supabase client configuration ✅ COMPLETED
└── types/                          # TypeScript type definitions ✅ COMPLETED
```

## 🛠️ Tech Stack

- **Frontend**: Next.js 15+ with App Router, TypeScript, Tailwind CSS v4
- **Backend**: Supabase (PostgreSQL, Authentication, Real-time)
- **State Management**: React hooks with localStorage backup
- **Styling**: Utility-first CSS with responsive design
- **Deployment**: Vercel (optimized for Next.js)

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ 
- npm or yarn
- Supabase account and project

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd SSTAC-Dashboard
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Setup**
   Create a `.env.local` file with your Supabase credentials:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

4. **Database Setup**
   Run the SQL scripts in your Supabase SQL editor:
   - `database_schema.sql` - Core database structure
   - `create_missing_views.sql` - Required database views
   - `setup_admin_user.sql` - Admin user setup

5. **Start Development Server**
   ```bash
   npm run dev
   ```

6. **Access the Application**
   - Open [http://localhost:3000](http://localhost:3000)
   - Login with your admin credentials
   - Navigate to `/admin` for administrative functions

## 🔐 Authentication & Admin Setup

### Admin User Creation
1. Create a user account through Supabase Auth
2. Run the admin setup script in Supabase SQL editor:
   ```sql
   INSERT INTO user_roles (user_id, role) 
   VALUES ('your-user-uuid', 'admin');
   ```

### Admin Badge Persistence
The system includes a comprehensive admin status persistence solution:
- **Global Refresh Function**: Accessible from any component
- **Local Storage Backup**: Fallback recovery for temporary database issues
- **Retry Logic**: Automatic retry on connection issues
- **Navigation Listeners**: Status refresh on route changes
- **Periodic Verification**: Automatic status checks every 30 seconds

## 📊 Admin Management Features

### User Management
- Create and manage user accounts
- Assign and modify user roles
- Monitor user activity and permissions

### Tag Management
- Create, edit, and delete document tags
- Color-coded tag system
- Bulk tag operations

### Announcement Management
- Create and manage dashboard announcements
- Priority levels (low, medium, high)
- Active/inactive status control

### Milestone Management
- Project timeline management
- Status tracking (pending, in-progress, completed, delayed)
- Priority levels and target dates

## 🔧 API Architecture

### Next.js 15+ Solution
The application uses a modern API route architecture:
1. **Server Actions**: Handle database operations and business logic
2. **API Routes**: Act as intermediaries between client components and server actions
3. **Client Components**: Use fetch() to call API routes and handle responses

### API Endpoints
- `POST /api/tags` - Create new tags
- `PUT /api/tags` - Update existing tags
- `DELETE /api/tags` - Delete tags
- `POST /api/announcements` - Create announcements
- `PUT /api/announcements` - Update announcements
- `DELETE /api/announcements` - Delete announcements
- `POST /api/milestones` - Create milestones
- `PUT /api/milestones` - Update milestones
- `DELETE /api/milestones` - Delete milestones

## 🐛 Common Issues & Solutions

### Admin Badge Disappearing
- **Problem**: Admin badge disappears after operations or page navigation
- **Solution**: The system includes comprehensive admin status persistence
- **Features**: Global refresh, localStorage backup, retry logic, navigation listeners

### Phase 3 Like System ✅ COMPLETED
- **Status**: Enhanced like system is fully implemented and working
- **Features**: Like/unlike discussions and replies, user attribution, real-time updates
- **Note**: Don't attempt to modify or rewrite the like system - it's working correctly

### Database Views Missing
- **Problem**: Forum returns 404 when accessing discussion features
- **Solution**: Ensure required database views exist
- **Critical Views**: `discussion_stats`, `documents_with_tags`
- **SQL Script**: Use `create_missing_views.sql` to create missing views

### Hydration Errors
- **Problem**: Server/client content mismatch
- **Solution**: Ensure consistent data between server and client components
- **Files to Check**: Components using dynamic data or browser APIs

### Next.js 15+ Import Issues
- **Problem**: Client components cannot import server actions using `next/headers`
- **Solution**: Use API route architecture with client-side fetch calls
- **Pattern**: Server actions → API routes → Client components

## 📱 Responsive Design

The dashboard is fully responsive and optimized for:
- **Desktop**: Full-featured interface with advanced controls
- **Tablet**: Touch-friendly interface with optimized layouts
- **Mobile**: Streamlined interface for field use and remote access

## 🚀 Deployment

### Vercel Deployment
1. Connect your GitHub repository to Vercel
2. Configure environment variables
3. Deploy automatically on push to main branch

### Environment Variables
Ensure all required environment variables are set in your production environment:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

This project is proprietary and confidential. All rights reserved.

## 🆘 Support

For technical support or questions:
- Check the [Common Issues & Solutions](#-common-issues--solutions) section
- Review the [Architecture Documentation](architecture.md)
- Contact the development team

## 🔮 Future Enhancements

### Phase 3: Enhanced User Engagement ✅ COMPLETED
- **Like System**: Interactive like/unlike for discussions and replies
- **User Attribution**: See who liked what with detailed information
- **Real-time Updates**: Immediate feedback on user interactions
- **Performance Optimization**: Efficient queries and responsive UI

### Phase 3: Advanced Analytics 🔄 IN PROGRESS
- **Dashboard Metrics**: Comprehensive dashboard statistics and reporting
- **User Engagement Tracking**: Monitor user interaction patterns
- **Content Analytics**: Analyze discussion and document popularity
- **Performance Monitoring**: Track system performance and user experience

### Phase 3: Enhanced Collaboration Tools 🔄 PLANNED
- **Real-time Notification System**: Live updates and alerts
- **Advanced Forum Features**: Enhanced discussion capabilities
- **Document Collaboration**: Improved document sharing and editing
- **Mobile Application**: Native mobile app for field use

### Technical Improvements 🔄 PLANNED
- **WebSocket Integration**: Real-time updates for enhanced collaboration
- **Redis Caching**: Improved performance and response times
- **API Rate Limiting**: Protection against abuse and overload
- **Advanced Security**: Enhanced authentication and monitoring features
