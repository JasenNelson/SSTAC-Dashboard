# 🤖 AI Handoff: Matrix Graph Pairing Debugging

## 🎯 **Mission Critical Task**
Debug and fix the matrix graph vote pairing system for CEW polls. The system allows users to refresh their browser to submit multiple votes, but the pairing logic for creating scatter plot data points (x,y coordinates) is failing.

## 📋 **Context Summary**

### **System Overview**
- **Platform**: SSTAC & TWG Dashboard (Next.js + Supabase)
- **Purpose**: Stakeholder engagement for sediment standards development
- **Critical Issue**: Matrix graphs not pairing votes correctly for CEW polls

### **Two User Types**
1. **Authenticated Users** (`/survey-results/*`): Password required, one vote per question (upsert)
2. **CEW Conference Attendees** (`/cew-polls/*`): CEW2025 code only, multiple votes allowed via browser refresh

### **Matrix Graph System**
- **Purpose**: Scatter plots showing importance (x) vs feasibility (y) for question pairs
- **Question Pairs**: 
  - Holistic Protection: Q1+Q2, Q3+Q4, Q5+Q6, Q7+Q8
  - Prioritization: Q1+Q2
- **Data Source**: Single-choice votes from `poll_votes` table
- **Pairing Logic**: Same user_id must vote on both questions in a pair

## 🚨 **The Problem**
CEW users can submit multiple votes by refreshing their browser, but the matrix graphs are not correctly pairing these votes to create (x,y) data points for the scatter plots.

## 🔍 **Key Files to Review**

### **Critical Files (MUST READ)**
1. `src/app/api/graphs/prioritization-matrix/route.ts` - Matrix graph API logic
2. `src/app/api/polls/submit/route.ts` - Vote submission and user_id generation
3. `database_schema.sql` - Database structure (lines 894-1302 for poll system)
4. `docs/POLL_SYSTEM_COMPLETE_GUIDE.md` - Complete system documentation
5. `docs/PHASE2_MATRIX_GRAPH_ISSUE_RESOLUTION.md` - Previous fixes and issues

### **Supporting Files**
- `src/app/(dashboard)/admin/poll-results/PollResultsClient.tsx` - Admin panel
- `src/components/graphs/PrioritizationMatrixGraph.tsx` - Frontend component

## 🎯 **Specific Tasks**

### **Task 1: Create Debug Tools** ⚡ **PRIORITY 1**
Create focused debugging tools to avoid console log spam:

1. **Debug API Endpoint**: `src/app/api/debug/matrix-pairing/route.ts`
   - Analyze vote pairing for Holistic Protection Q1+Q2
   - Return structured summary without console spam
   - Show user_id consistency and pairing capability

2. **Test Script**: `debug-matrix-pairing.js`
   - Node.js script to test debug endpoint
   - Clean output format for analysis

3. **Database Queries**: `debug-database-queries.sql`
   - Focused SQL queries for vote analysis
   - User pairing capability checks

### **Task 2: Investigate User ID Generation** ⚡ **PRIORITY 2**
The core issue is likely in user_id generation for CEW polls:

1. **Check Frontend**: Look for `x-session-id` header in CEW poll submissions
2. **Verify API Logic**: Ensure consistent user_id generation in `submit/route.ts`
3. **Test Session Persistence**: Verify user_id stays consistent across page refreshes

### **Task 3: Fix Vote Pairing Logic** ⚡ **PRIORITY 3**
The matrix API pairing logic may be broken:

1. **Review Pairing Algorithm**: Lines 305-345 in `prioritization-matrix/route.ts`
2. **Check Poll ID Resolution**: Lines 159-191 (complex logic that may be wrong)
3. **Test CEW vs Authenticated Logic**: Ensure different handling for user types

## 🚫 **Critical DON'Ts**

### **Never Do These**
- ❌ **Don't modify console.log statements** - They're for debugging
- ❌ **Don't change the database schema** - It's working correctly
- ❌ **Don't modify the frontend poll components** - They're working
- ❌ **Don't change the basic poll submission logic** - Only fix user_id generation
- ❌ **Don't remove the complex poll ID resolution** - It's needed for data combination

### **Avoid These Mistakes**
- ❌ **Don't assume the issue is in the frontend** - It's likely in the API
- ❌ **Don't change the matrix graph visualization** - The issue is data pairing
- ❌ **Don't modify the admin panel** - It's working correctly
- ❌ **Don't change the database views** - They're correct

## ✅ **Critical DO's**

### **Always Do These**
- ✅ **Test with actual CEW poll voting** - Manual testing is essential
- ✅ **Check user_id consistency** - This is likely the root cause
- ✅ **Verify poll ID resolution** - Make sure it's using the right poll IDs
- ✅ **Test both CEW and authenticated users** - Both should work
- ✅ **Use the debug tools** - They're designed to avoid context window issues

### **Testing Protocol**
1. **Vote on CEW polls**: Go to `/cew-polls/holistic-protection`
2. **Submit test votes**: Q1 (option 1), Q2 (option 2), refresh, Q1 (option 3), Q2 (option 4)
3. **Check debug endpoint**: `GET /api/debug/matrix-pairing`
4. **Verify pairing**: Check if votes are being paired correctly

## 🔧 **Technical Details**

### **User ID Generation Logic**
```typescript
// In submit/route.ts line 29-30
const sessionId = request.headers.get('x-session-id') || `session_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
finalUserId = `${authCode || 'CEW2025'}_${sessionId}`;
```

### **Expected Behavior**
- **CEW Users**: Each page refresh should generate a new sessionId but maintain consistency within that session
- **Authenticated Users**: Use their UUID from Supabase auth
- **Pairing**: Same user_id must vote on both questions in a pair

### **CEW Vote Pairing Logic (Chronological)**
- **Vote Tracking**: All votes stored in `importanceVotes` and `feasibilityVotes` arrays
- **Chronological Sorting**: Votes sorted by timestamp to maintain order
- **Session-Based Pairing**: 1st importance vote pairs with 1st feasibility vote, 2nd with 2nd, etc.
- **Data Point Calculation**: `min(importance_votes_count, feasibility_votes_count)`
- **Unique IDs**: Each pair gets `userId_session_${i}` format
- **Example**: 1 CEW user with 2 importance + 2 feasibility votes = 2 data points

### **Database Structure**
- **polls**: Question definitions
- **poll_votes**: Individual votes with user_id, poll_id, option_index
- **poll_results**: Aggregated view (not used for matrix graphs)

## 🎯 **Success Criteria**

### **Debug Tools Working**
- [ ] Debug endpoint returns clean summary
- [ ] Test script runs without errors
- [ ] Database queries provide clear insights

### **User ID Generation Fixed**
- [ ] CEW users get consistent user_id within session
- [ ] Page refresh creates new session (new user_id)
- [ ] Multiple votes from same session can be paired

### **Matrix Pairing Working**
- [ ] Votes are correctly paired for scatter plots
- [ ] Both CEW and authenticated users work
- [ ] Matrix graphs show correct data points

## 📚 **Reference Materials**

### **Key Documentation**
- `docs/POLL_SYSTEM_COMPLETE_GUIDE.md` - Complete system overview
- `docs/PHASE2_MATRIX_GRAPH_ISSUE_RESOLUTION.md` - Previous fixes
- `docs/SAFE_POLL_UPDATE_PROTOCOL.md` - Update procedures

### **Database Schema**
- Lines 894-1302 in `database_schema.sql` contain the poll system
- Focus on `polls`, `poll_votes`, and `poll_results` view

### **API Endpoints**
- `POST /api/polls/submit` - Vote submission
- `GET /api/graphs/prioritization-matrix` - Matrix graph data
- `GET /api/debug/matrix-pairing` - Debug endpoint (to be created)

## 🚀 **Getting Started**

1. **Read the key files** listed above
2. **Create the debug tools** (Task 1)
3. **Test the current system** with manual voting
4. **Identify the root cause** using debug tools
5. **Fix the issue** with minimal changes
6. **Verify the fix** with comprehensive testing

## 💡 **Pro Tips**

- **Start with Task 1** - The debug tools will reveal the issue
- **Focus on user_id consistency** - This is likely the root cause
- **Test incrementally** - Don't change multiple things at once
- **Use the existing documentation** - It's comprehensive and accurate
- **Ask for clarification** if anything is unclear

## 🎯 **Expected Timeline**

- **Task 1 (Debug Tools)**: 30 minutes
- **Task 2 (User ID Investigation)**: 45 minutes  
- **Task 3 (Fix Pairing Logic)**: 60 minutes
- **Testing & Verification**: 30 minutes

**Total**: ~3 hours for complete resolution

---

**Remember**: This is a production system with complex requirements. The goal is to fix the pairing issue with minimal changes while maintaining all existing functionality. The debug tools are your best friend - use them to understand the problem before making any changes.
