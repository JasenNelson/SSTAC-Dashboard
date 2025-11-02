# 🤝 Contributing to SSTAC & TWG Dashboard

Thank you for your interest in contributing to the SSTAC & TWG Dashboard! This guide will help you get started and ensure your contributions align with the project standards.

## 📋 **Table of Contents**

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Coding Standards](#coding-standards)
- [Testing Requirements](#testing-requirements)
- [Pull Request Process](#pull-request-process)
- [Documentation](#documentation)
- [Common Contribution Scenarios](#common-contribution-scenarios)

---

## 📜 **Code of Conduct**

### **Our Standards**

- **Be respectful** - Treat all contributors with respect
- **Be collaborative** - Work together towards common goals
- **Be professional** - Maintain professional communication
- **Be inclusive** - Welcome diverse perspectives

### **Our Responsibilities**

- Maintain high code quality standards
- Provide constructive feedback
- Respond to issues and PRs promptly
- Keep documentation current

---

## 🚀 **Getting Started**

### **1. Prerequisites**

**Required:**
- Node.js 18+ installed
- Git installed and configured
- Supabase account (for database access)
- Code editor (VS Code recommended)

**Recommended:**
- k6 installed (for load testing)
- PostgreSQL knowledge
- Next.js 15+ experience
- TypeScript experience

### **2. Clone and Setup**

```bash
# Clone the repository
git clone https://github.com/your-org/SSTAC-Dashboard.git
cd SSTAC-Dashboard

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
# Edit .env.local with your Supabase credentials

# Run development server
npm run dev
```

### **3. Verify Setup**

```bash
# Run build to check for errors
npm run build

# Run tests (if you have k6 installed)
k6 run tests/k6-test.js

# Check linting
npm run lint
```

### **4. Read Core Documentation**

Before contributing, please read:

1. **[Main README](README.md)** - Project overview
2. **[AGENTS.md](docs/AGENTS.md)** - Core development guidelines (CRITICAL)
3. **[Poll System Guide](docs/POLL_SYSTEM_COMPLETE_GUIDE.md)** - System architecture
4. **[Documentation Index](docs/README.md)** - All documentation

**⏱️ Time Required:** 2-3 hours for onboarding

---

## 🔄 **Development Workflow**

### **1. Create a Branch**

```bash
# Update main branch
git checkout main
git pull origin main

# Create feature branch
git checkout -b feature/your-feature-name

# Or for bug fixes
git checkout -b fix/bug-description
```

**Branch naming conventions:**
- `feature/` - New features
- `fix/` - Bug fixes
- `docs/` - Documentation updates
- `test/` - Test additions/modifications
- `refactor/` - Code refactoring

### **2. Make Changes**

```bash
# Make your code changes
# Test thoroughly
npm run dev

# Run build frequently
npm run build

# Run tests
k6 run tests/k6-test.js
```

### **3. Commit Changes**

```bash
# Stage changes
git add .

# Commit with descriptive message
git commit -m "type: brief description

Detailed explanation of changes
- What was changed
- Why it was changed
- How it was tested"
```

**Commit message types:**
- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation changes
- `test:` - Test changes
- `refactor:` - Code refactoring
- `style:` - Code style changes
- `chore:` - Build/config changes

**Example:**
```
feat: add matrix graph filtering by user type

Added filter dropdown to matrix graphs allowing users to view:
- All responses (combined)
- TWG/SSTAC responses only
- CEW responses only

Tested with:
- k6 matrix graph test
- Manual testing in admin panel
- Filter state persistence
```

### **4. Push and Create PR**

```bash
# Push branch to remote
git push origin feature/your-feature-name

# Create pull request on GitHub
# Fill out PR template completely
```

---

## 📏 **Coding Standards**

### **TypeScript**

```typescript
// ✅ GOOD - Explicit types
interface PollResult {
  pollId: string;
  totalVotes: number;
  results: VoteResult[];
}

// ❌ BAD - Implicit any
function processResults(data: any) {
  return data.map((item: any) => item.votes);
}
```

**Requirements:**
- ✅ Always use explicit type annotations
- ✅ No implicit `any` types
- ✅ Use interfaces for object types
- ✅ Document complex types
- ❌ Never use `@ts-ignore` without explanation

### **React Components**

```typescript
// ✅ GOOD - Type props, use memo when appropriate
interface PollProps {
  pollId: string;
  question: string;
  options: string[];
  onVote: (optionIndex: number) => void;
}

export const Poll: React.FC<PollProps> = React.memo(({ 
  pollId, 
  question, 
  options, 
  onVote 
}) => {
  // Component implementation
});

// ❌ BAD - Untyped props
export const Poll = ({ pollId, question, options, onVote }) => {
  // Component implementation
};
```

**Requirements:**
- ✅ Type all component props
- ✅ Use React.FC or explicit return types
- ✅ Use React.memo for expensive components
- ✅ Handle loading and error states
- ❌ Don't mutate props directly

### **Database Queries**

```typescript
// ✅ GOOD - Type safe, error handling
const { data: polls, error } = await supabase
  .from('polls')
  .select('*')
  .eq('page_path', '/survey-results/holistic-protection');

if (error) {
  console.error('Failed to fetch polls:', error);
  return null;
}

// ❌ BAD - No error handling
const { data } = await supabase
  .from('polls')
  .select('*');
```

**Requirements:**
- ✅ Always handle errors
- ✅ Use RLS policies correctly
- ✅ Follow database schema rules
- ✅ Never expose sensitive data
- ❌ Don't bypass security checks

### **CSS/Styling**

```typescript
// ✅ GOOD - Tailwind with dark mode
<div className="bg-white dark:bg-gray-800 p-4 rounded-lg">
  <h2 className="text-gray-900 dark:text-white">Title</h2>
</div>

// ❌ BAD - Inline styles, no dark mode
<div style={{ backgroundColor: 'white', padding: '16px' }}>
  <h2 style={{ color: 'black' }}>Title</h2>
</div>
```

**Requirements:**
- ✅ Use Tailwind CSS classes
- ✅ Support both light and dark modes
- ✅ Follow existing component patterns
- ✅ Maintain consistent spacing
- ❌ Avoid inline styles unless necessary

---

## 🧪 **Testing Requirements**

### **Before Submitting PR**

1. **Build Test** (Required)
   ```bash
   npm run build
   # Must complete with no errors
   ```

2. **Unit Tests** (Required)
   ```bash
   npm run test:unit
   # All 122+ unit tests must pass
   ```

3. **E2E Tests** (Required)
   ```bash
   npm run test:e2e
   # Critical workflow tests must pass
   ```

4. **Load Tests** (Recommended for API changes)
   ```bash
   k6 run tests/k6-test.js
   # Must pass with >95% success rate
   ```

5. **Affected Feature Tests** (Required if applicable)
   ```bash
   # Unit tests for specific areas
   npm run test:unit -- [path-to-test]
   
   # If you modified polls (k6 load tests)
   k6 run tests/k6-comprehensive-test-enhanced.js
   
   # If you modified matrix graphs
   k6 run tests/k6-matrix-graph-test-enhanced.js
   ```

6. **Manual Testing** (Required)
   - Test in both light and dark modes
   - Test on desktop and mobile
   - Test with different user types (admin, member, CEW)
   - Verify no console errors

### **Test Data Cleanup**

```bash
# After testing, clean up test data
# Run appropriate cleanup script from scripts/cleanup/
```

### **Test Documentation**

If adding new tests:
- Document in [tests/README.md](tests/README.md)
- Explain what it tests and when to use it
- Include expected results

---

## 🔍 **Pull Request Process**

### **PR Checklist**

Before submitting, ensure:

- [ ] Code follows style guidelines
- [ ] TypeScript compiles without errors
- [ ] All tests pass
- [ ] Documentation updated
- [ ] No console errors or warnings
- [ ] Works in light and dark mode
- [ ] Responsive on mobile
- [ ] Database changes documented
- [ ] Security considerations addressed
- [ ] Performance impact assessed

### **PR Title Format**

```
type: Brief description (max 50 chars)
```

**Examples:**
- `feat: Add filter dropdown to matrix graphs`
- `fix: Correct vote counting for ranking polls`
- `docs: Update poll system debugging guide`
- `test: Add comprehensive wordcloud testing`

### **PR Description Template**

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Changes Made
- Detailed list of changes
- What was modified
- Why it was necessary

## Testing
- [ ] Build test passed
- [ ] k6 tests passed
- [ ] Manual testing completed
- [ ] No console errors

## Screenshots (if applicable)
Add screenshots for UI changes

## Related Issues
Closes #issue_number

## Checklist
- [ ] Code follows style guidelines
- [ ] Documentation updated
- [ ] Tests added/updated
- [ ] No breaking changes (or documented)
```

### **Review Process**

1. **Automated Checks**
   - Build verification
   - Linting checks
   - Type checking

2. **Code Review**
   - At least one approval required
   - Address all review comments
   - Update based on feedback

3. **Final Testing**
   - Reviewer tests changes
   - Verifies documentation
   - Checks for edge cases

4. **Merge**
   - Squash and merge (preferred)
   - Delete feature branch after merge
   - Update local main branch

---

## 📖 **Documentation**

### **When to Update Documentation**

**Always update when:**
- Adding new features
- Changing behavior
- Fixing bugs (add to lessons learned)
- Modifying database schema
- Changing API endpoints

**Files to update:**
- `README.md` - For major feature additions
- `docs/PROJECT_STATUS.md` - For completed work
- `docs/AGENTS.md` - For core rule changes
- `docs/DEBUGGING_LESSONS_LEARNED.md` - For bug fixes
- `docs/POLL_SYSTEM_COMPLETE_GUIDE.md` - For poll changes
- Relevant script documentation

### **Documentation Standards**

```markdown
## ✅ GOOD - Clear, actionable
### Adding a New Poll

1. **Create poll in database**:
   ```sql
   INSERT INTO polls (page_path, poll_index, question, options)
   VALUES ('/survey-results/topic', 0, 'Your question?', 
           '["Option 1", "Option 2"]'::jsonb);
   ```

2. **Update frontend component**
3. **Test with k6**
4. **Verify admin panel**

## ❌ BAD - Vague, no examples
### Adding a New Poll
Create the poll and test it.
```

---

## 🎯 **Common Contribution Scenarios**

### **Scenario 1: Adding a New Poll**

```bash
# 1. Read the guide
cat docs/POLL_SYSTEM_COMPLETE_GUIDE.md

# 2. Follow update protocol
cat docs/SAFE_POLL_UPDATE_PROTOCOL.md

# 3. Create feature branch
git checkout -b feature/add-new-poll-question

# 4. Make database changes
# Execute SQL in Supabase

# 5. Update frontend
# Edit appropriate component files

# 6. Update admin panel
# Edit PollResultsClient.tsx

# 7. Test thoroughly
npm run build
k6 run tests/k6-comprehensive-test-enhanced.js

# 8. Update documentation
# Edit relevant docs

# 9. Commit and push
git add .
git commit -m "feat: add new prioritization poll question"
git push origin feature/add-new-poll-question

# 10. Create PR
```

### **Scenario 2: Fixing a Bug**

```bash
# 1. Identify the issue
# Read error messages, check logs

# 2. Check debugging guide
cat docs/POLL_SYSTEM_DEBUGGING_GUIDE.md

# 3. Create fix branch
git checkout -b fix/vote-counting-error

# 4. Implement fix
# Make necessary code changes

# 5. Test the fix
npm run build
k6 run tests/k6-test.js

# 6. Add to lessons learned
# Edit docs/DEBUGGING_LESSONS_LEARNED.md

# 7. Commit with detailed message
git commit -m "fix: correct ranking poll vote counting

Issue: Ranking polls showed total votes instead of unique users
Root cause: Used vote count instead of total_votes field
Solution: Updated to use total_votes for ranking polls
Testing: k6 tests pass, manual verification completed"

# 8. Push and create PR
```

### **Scenario 3: Improving Documentation**

```bash
# 1. Identify documentation gap
# Note missing or unclear information

# 2. Create docs branch
git checkout -b docs/improve-testing-guide

# 3. Update documentation
# Edit relevant markdown files

# 4. Verify formatting
# Preview in markdown viewer

# 5. Check cross-references
# Ensure all links work

# 6. Commit changes
git commit -m "docs: add matrix graph testing procedures

Added detailed testing procedures for matrix graphs including:
- Setup instructions
- Expected results
- Common issues
- Debug procedures"

# 7. Push and create PR
```

---

## 🚨 **Important Guidelines**

### **Never Modify Without Understanding**

❌ **DON'T:**
- Change code without reading documentation
- Modify database schema without backup
- Skip testing before PR
- Ignore TypeScript errors
- Bypass security checks

✅ **DO:**
- Read relevant documentation first
- Understand why code exists
- Test thoroughly
- Ask questions if unsure
- Follow established patterns

### **Critical Rules**

From [AGENTS.md](docs/AGENTS.md):

1. **Poll System Structure**
   - Never mix poll types (single-choice, ranking, wordcloud)
   - Use correct tables for each type
   - Follow three-way synchronization (database, survey, CEW)

2. **Array Indexing**
   - Database uses 0-based indexing
   - UI uses 1-based indexing
   - Never add +1 to `rp.options[option_stats.option_index]`

3. **CEW Submissions**
   - Allow multiple submissions (unique user_id each time)
   - Never delete CEW submissions
   - Use proper user_id format: `${code}_${timestamp}_${random}`

4. **TypeScript Safety**
   - Always explicit types
   - No implicit `any`
   - Build must pass with no errors

---

## 💬 **Getting Help**

### **Where to Ask Questions**

1. **Check documentation first**
   - [Documentation Index](docs/README.md)
   - [Core Guidelines](docs/AGENTS.md)
   - [Debugging Guide](docs/POLL_SYSTEM_DEBUGGING_GUIDE.md)

2. **Search existing issues**
   - Check for similar problems
   - Review closed issues

3. **Ask the team**
   - Create discussion thread
   - Tag relevant team members
   - Provide context and examples

### **Creating Good Questions**

✅ **GOOD:**
```
Question: How should I handle vote counting for a new ranking poll?

Context: Adding a new ranking poll with 5 options
- Read POLL_SYSTEM_COMPLETE_GUIDE.md
- Understand ranking votes use multiple rows per user
- Need clarification on total_votes vs vote count

Attempted: Reviewed ranking_results view definition
```

❌ **BAD:**
```
Question: How do polls work?
```

---

## 📊 **Contribution Statistics**

We value all contributions! Here's what we track:

- Code contributions (features, fixes)
- Documentation improvements
- Test additions
- Bug reports
- Code reviews
- Help in discussions

---

## 🎉 **Thank You!**

Your contributions help make this project better for everyone. We appreciate your time and effort!

### **Recognition**

Outstanding contributors will be:
- Listed in project documentation
- Acknowledged in release notes
- Invited to maintainer discussions

---

**Questions about contributing?** 
- Review [Documentation Index](docs/README.md)
- Create a discussion thread
- Contact project maintainers

**Last Updated**: October 2025  
**Maintained By**: SSTAC Dashboard Team

