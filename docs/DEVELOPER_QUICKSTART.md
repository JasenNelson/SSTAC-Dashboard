# Developer Quick Start Guide

**Objective:** Get a working local development environment and run your first test in 30 minutes.

**Time Estimate:** 30 minutes (assuming prerequisites are installed)

---

## 1. System Requirements

### Required
- **Node.js:** v18.17.0 or higher
- **npm:** v9.0.0 or higher
- **Git:** v2.40.0 or higher
- **RAM:** 4GB minimum (8GB recommended)
- **Disk Space:** 2GB available for dependencies and build artifacts

### Optional (Recommended)
- **Docker:** For running Supabase locally
- **VS Code:** With TypeScript and ESLint extensions
- **GitHub CLI (gh):** For PR management
- **Chrome DevTools:** For performance profiling

### Check Your Versions
```bash
node --version   # Should be v18.17.0+
npm --version    # Should be v9.0.0+
git --version    # Should be v2.40.0+
```

---

## 2. Local Setup (10 minutes)

### Step 1: Clone the Repository
```bash
git clone https://github.com/sstac/dashboard.git
cd dashboard
```

### Step 2: Install Dependencies
```bash
npm install
```

**This will:**
- Install 500+ npm packages
- Generate TypeScript types
- Set up pre-commit hooks
- Estimated time: 2-3 minutes

### Step 3: Configure Environment Variables

Create a local `.env.local` file:
```bash
cp .env.example .env.local
```

Edit `.env.local` and configure:
```env
# Supabase (Required)
NEXT_PUBLIC_SUPABASE_URL=https://[your-project].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=[your-anon-key]
SUPABASE_SERVICE_ROLE_KEY=[your-service-role-key]

# Optional: Remote Supabase development environment
# Leave these commented to use local Supabase

# Optional: For rate limiting (Redis)
# REDIS_URL=redis://localhost:6379
# REDIS_TOKEN=[optional-token]
```

**Where to get these values:**
- **Local Development:** Run Supabase locally (see Database Setup below)
- **Remote Development:** Ask your team lead for development environment credentials
- **Never commit:** These credentials are secrets - never push to git

### Step 4: Verify Installation
```bash
npm run build
npm run lint
npm run test -- --run
```

All should pass without errors. If not, see Troubleshooting (Section 6).

---

## 3. Database Setup (5 minutes)

### Option A: Local Supabase (Recommended for Development)

#### Prerequisites
- Docker installed and running

#### Setup
```bash
# Start local Supabase
npx supabase start

# This will:
# - Download and start PostgreSQL
# - Start the auth service
# - Start the vector/storage services
# - Print database connection info to console
```

**Output will include:**
```
API URL: http://localhost:54321
Anon Key: eyJhbGc...
Service role key: eyJhbGc...
```

Copy these into your `.env.local`:
```env
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=[copy-anon-key]
SUPABASE_SERVICE_ROLE_KEY=[copy-service-role-key]
```

#### Verify Connection
```bash
npm run test:db
# Should show "✓ Database connected"
```

### Option B: Remote Supabase (Development Environment)

If your team uses a shared development Supabase:

```env
NEXT_PUBLIC_SUPABASE_URL=https://[dev-project].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=[dev-anon-key]
SUPABASE_SERVICE_ROLE_KEY=[dev-service-role-key]
```

**⚠️ Caution:** Use read-only operations. Don't modify production data.

---

## 4. First Run (5 minutes)

### Start the Development Server
```bash
npm run dev
```

Output will show:
```
  ▲ Next.js 15.x.x
  ✓ Ready in 2.3s

> Local:        http://localhost:3000
```

### Access the Application

1. **Open browser:** http://localhost:3000
2. **Navigate to Admin Panel:** http://localhost:3000/admin
3. **Test Authentication:**
   - For local dev: Use test credentials from Supabase auth UI
   - For remote dev: Use your actual credentials

### Verify Basic Functionality
- [ ] Admin dashboard loads
- [ ] Poll results visible
- [ ] No console errors (DevTools)
- [ ] TypeScript warnings only (no critical errors)

---

## 5. Running Tests (5 minutes)

### Unit Tests (Jest)
```bash
# Run all unit tests
npm test

# Run tests in watch mode (re-run on file change)
npm test -- --watch

# Run specific test file
npm test -- src/lib/__tests__/rate-limit.test.ts

# Expected result: 536+ tests passing
```

### Component Tests (React Testing Library)
```bash
# Tests are part of npm test
npm test -- --testPathPattern="components"
```

### End-to-End Tests (Playwright)
```bash
# Run E2E tests (requires dev server running)
npm run test:e2e

# Run with UI
npm run test:e2e -- --ui

# Run specific test
npm run test:e2e -- tests/auth.spec.ts
```

### Load Tests (K6)
```bash
# Run load tests (requires build first)
npm run build
npm run test:k6

# This tests API performance under load
```

### All Tests at Once
```bash
npm run test:all

# Runs unit + integration + E2E + performance tests
# Expected time: 5-10 minutes
# Expected result: All green ✓
```

---

## 6. Code Quality Checks

### Type Checking (TypeScript)
```bash
# Verify all types are correct
npx tsc --noEmit

# Expected result: 0 errors
# If errors: Fix them before committing (see Troubleshooting)
```

### Linting (ESLint)
```bash
# Check for code style issues
npm run lint

# Auto-fix auto-fixable issues
npm run lint -- --fix

# Expected result: 0 errors
```

### Format Check (Prettier)
```bash
# Check code formatting
npm run format:check

# Auto-format all files
npm run format

# Expected result: All files formatted
```

---

## 7. Making Your First Change

### Create a Feature Branch
```bash
git checkout -b feature/my-feature
```

### Edit a File
Example: Add a comment to `src/lib/rate-limit.ts`

### Check Your Changes
```bash
# 1. Type check
npx tsc --noEmit

# 2. Lint
npm run lint

# 3. Format
npm run format

# 4. Run relevant tests
npm test -- rate-limit

# 5. Check the app still works
npm run dev  # Visit http://localhost:3000
```

### Commit Your Changes
```bash
git add .
git commit -m "feat: add helpful comment to rate limiting"

# Pre-commit hooks will:
# - Format code
# - Run linter
# - Verify types
# - If all pass: commit created
```

### Push and Create PR
```bash
git push origin feature/my-feature

# Then use GitHub to create a PR
# Or use GitHub CLI:
gh pr create --title "My feature" --body "Description of changes"
```

---

## 8. Common Development Tasks

### Run Build (Production Build)
```bash
npm run build

# This:
# - Compiles TypeScript
# - Bundles code
# - Optimizes assets
# - Expected size: ~300-400KB
```

### Check Bundle Size
```bash
npm run build
npm run analyze  # If available - shows what's in bundle
```

### Debug API Endpoint
1. Start dev server: `npm run dev`
2. Open DevTools (F12)
3. Go to Network tab
4. Make a request that calls your API
5. Click the request → Response tab

### Debug Component
1. Start dev server: `npm run dev`
2. Open DevTools (F12)
3. Go to Components tab (React DevTools extension)
4. Find your component
5. Inspect props and state

### Check Database Directly
```bash
# If using local Supabase:
npx supabase db push  # Applies migrations
npx supabase functions invoke [function-name]  # Invoke edge functions

# Or use Supabase Studio:
# http://localhost:54321/project/default
```

---

## 9. Project Structure

Understanding where things are:

```
dashboard/
├── src/
│   ├── app/              # Next.js app directory
│   │   ├── api/          # API routes (28 endpoints)
│   │   └── (dashboard)/  # Dashboard pages
│   ├── components/       # React components (grouped by feature)
│   ├── lib/              # Utilities and helpers
│   │   ├── api/          # Centralized API client
│   │   ├── db/           # Database query abstraction
│   │   └── supabase.ts   # Supabase client
│   └── types/            # TypeScript types (single source of truth)
├── public/               # Static assets (images, PDFs, etc.)
├── docs/                 # Project documentation (you are here)
├── tests/                # E2E tests (Playwright)
├── .env.example          # Environment variable template
├── package.json          # Dependencies and scripts
├── tsconfig.json         # TypeScript config (strict mode enabled)
└── next.config.js        # Next.js configuration
```

### Key Files to Know
- **API Types:** `src/types/index.ts` - All TypeScript interfaces
- **API Client:** `src/lib/api/` - Centralized API calls
- **Database:** `src/lib/db/queries.ts` - All direct DB queries
- **Auth:** `src/lib/supabase-auth.ts` - Authentication logic
- **Middleware:** `src/middleware.ts` - Request processing and security headers

---

## 10. Common Issues & Solutions

### Port 3000 Already in Use
```bash
# Find process using port 3000
lsof -i :3000  # macOS/Linux
netstat -ano | findstr :3000  # Windows

# Kill process
kill -9 [PID]  # macOS/Linux
taskkill /PID [PID] /F  # Windows

# Or use different port
npm run dev -- -p 3001
```

### Supabase Connection Refused
```bash
# Check if Supabase is running
docker ps | grep supabase

# If not running, start it
npx supabase start

# Verify credentials in .env.local
grep SUPABASE .env.local

# Test connection
curl http://localhost:54321/auth/v1/health
# Should return: {"name":"auth",...}
```

### Module Not Found Error
```bash
# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm install

# Then try again
npm test -- --run
```

### TypeScript Errors After Pull
```bash
# Pull latest code
git pull

# Reinstall dependencies (new types might be needed)
npm install

# Check types
npx tsc --noEmit

# If still failing, regenerate types
npm run types:generate
```

### Node Version Mismatch
```bash
# Check your version
node --version

# If wrong, install correct version using nvm:
nvm install 18.17.0
nvm use 18.17.0

# Verify
node --version  # Should be v18.17.0
```

### Tests Failing in CI but Passing Locally
```bash
# This usually means environment differences
# 1. Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install

# 2. Run tests same way CI does
npm run test -- --run  # Not watch mode

# 3. Check .env.local matches test expectations
cat .env.local | grep -E "SUPABASE|REDIS"
```

---

## 11. Next Steps

Once you have a working local environment:

1. **Understand the Poll System** (→ `docs/poll-system/README.md`)
   - 3 independent poll types
   - Immutability rules
   - Data flow

2. **Learn Architecture Decisions** (→ `docs/ARCHITECTURE_DECISIONS.md`)
   - Why we chose certain technologies
   - Key patterns and trade-offs

3. **Review Security Best Practices** (→ `docs/SECURITY_BEST_PRACTICES.md`)
   - Before writing APIs
   - Common vulnerabilities to avoid

4. **Check Performance Tuning** (→ `docs/PERFORMANCE_TUNING_GUIDE.md`)
   - Core Web Vitals targets
   - Optimization patterns
   - Profiling tools

5. **Create Your First Issue**
   - Pick from GitHub issues
   - Create a branch
   - Make changes
   - Submit PR

---

## 12. Getting Help

### Common Resources
- **Poll System Issues:** See `docs/poll-system/POLL_SYSTEM_DEBUGGING_GUIDE.md`
- **API Endpoints:** See `docs/API_REFERENCE.md`
- **Performance Issues:** See `docs/PERFORMANCE_TUNING_GUIDE.md`
- **Troubleshooting:** See `docs/TROUBLESHOOTING_GUIDE.md`
- **Operations:** See `docs/OPERATIONS_RUNBOOK.md`

### Asking for Help
1. Search existing issues: https://github.com/sstac/dashboard/issues
2. Check troubleshooting guide (Section 6)
3. Ask in team Slack #engineering channel
4. Create a new GitHub issue with:
   - What you tried
   - What you expected
   - What actually happened
   - Error messages or logs

### Key Contacts
- **Type Safety Questions:** See `src/types/index.ts` (well-commented)
- **API Client Questions:** See `src/lib/api/index.ts`
- **Database Questions:** See `src/lib/db/queries.ts`
- **Security Questions:** See `docs/SECURITY_BEST_PRACTICES.md`

---

## Completion Checklist

After 30 minutes, you should have:

- [ ] Node.js v18.17.0+ installed
- [ ] Repository cloned
- [ ] Dependencies installed (`npm install`)
- [ ] `.env.local` configured with Supabase credentials
- [ ] Local Supabase running or remote connection verified
- [ ] Development server running (`npm run dev`)
- [ ] Admin dashboard accessible at http://localhost:3000
- [ ] All tests passing (`npm test -- --run`)
- [ ] TypeScript types verified (`npx tsc --noEmit`)
- [ ] Linting passing (`npm run lint`)
- [ ] First commit created (optionally)
- [ ] Familiar with project structure

**Welcome to the team! 🎉**

---

## Quick Reference

```bash
# Start development
npm run dev                    # http://localhost:3000

# Testing
npm test                       # Watch mode
npm test -- --run             # Single run
npm run test:e2e              # End-to-end tests
npm run test:k6               # Performance tests

# Code quality
npm run lint                   # Check code style
npm run lint -- --fix         # Auto-fix
npm run format                # Format code
npx tsc --noEmit              # Type check

# Database
npx supabase start            # Start local Supabase
npx supabase stop             # Stop local Supabase
npx supabase db reset         # Reset database

# Build
npm run build                 # Production build
npm start                     # Run production build locally

# Git workflow
git checkout -b feature/name  # Create branch
git commit -m "message"       # Commit (hooks run auto)
gh pr create                  # Create pull request
```

---

**Last Updated:** 2026-01-26
**Phase:** 5 - Documentation & Knowledge
**Status:** Ready for onboarding
