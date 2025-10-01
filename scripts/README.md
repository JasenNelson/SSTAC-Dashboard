# 🛠️ Scripts Documentation

This folder contains utility scripts for testing, debugging, and maintaining the SSTAC Dashboard project.

## 📂 **Directory Structure**

```
scripts/
├── debug/                    # SQL debugging scripts
├── cleanup/                  # Data cleanup scripts
├── run-cew-100-test.ps1     # PowerShell test runner
├── run-cew-100-test.sh      # Bash test runner
└── README.md                # This file
```

---

## 🧪 **Test Execution Scripts**

### **run-cew-100-test.ps1** (Windows PowerShell)

Executes k6 load testing for CEW polling system with 100 concurrent users.

**Usage:**
```powershell
# Run from project root
.\scripts\run-cew-100-test.ps1
```

**What it does:**
- Runs k6 comprehensive test with 100 virtual users
- Tests all CEW poll endpoints
- Validates performance thresholds
- Generates detailed performance report

**Requirements:**
- k6 installed and in PATH
- Active internet connection
- Valid BASE_URL (defaults to production URL)

---

### **run-cew-100-test.sh** (Bash/Linux/Mac)

Linux/Mac version of the CEW test runner.

**Usage:**
```bash
# Make executable
chmod +x scripts/run-cew-100-test.sh

# Run from project root
./scripts/run-cew-100-test.sh
```

**What it does:**
- Same functionality as PowerShell version
- Cross-platform compatibility
- Environment variable configuration

---

## 🐛 **Debug Scripts** (`scripts/debug/`)

SQL diagnostic queries for investigating database issues and analyzing vote data.

### **Quick Reference**

| Script | Purpose | When to Use |
|--------|---------|-------------|
| `check-actual-vote-data.sql` | Verify vote data integrity | When votes seem incorrect |
| `check-cew-importance-poll.sql` | Check CEW poll configuration | CEW poll issues |
| `check-prioritization-options.sql` | Verify poll options | Missing options problem |
| `database-vote-diagnostics.sql` | Comprehensive vote analysis | General troubleshooting |
| `investigate-all-users-pairing.sql` | Check vote pairing | Matrix graph issues |
| `investigate-lost-pairs.sql` | Find unpaired votes | Missing matrix data |
| `investigate-matrix-clustering.sql` | Analyze data clustering | Overlapping points |
| `investigate-matrix-data-points.sql` | Complete matrix analysis | Matrix graph debugging |
| `investigate-missing-users.sql` | Find missing user data | User visibility issues |
| `investigate-pairing-mismatch.sql` | Check pairing problems | Inconsistent pairing |
| `investigate-poll-id-issue.sql` | Poll ID verification | Poll not found errors |
| `matrix-pairing-single-query.sql` | Single query for pairing | Quick pairing check |
| `matrix-vote-diagnostics.sql` | Matrix vote analysis | Matrix data issues |
| `matrix-vote-pairing-diagnostics.sql` | Detailed pairing check | Complex pairing issues |
| `user-id-analysis.sql` | User ID distribution | User tracking problems |

### **Detailed Script Documentation**

#### **check-actual-vote-data.sql**
```sql
-- Purpose: Verify vote data integrity and counts
-- Use when: Votes appear incorrect or missing
-- Returns: Vote counts by poll and user type
```

**Usage in Supabase SQL Editor:**
1. Copy script contents
2. Paste into SQL Editor
3. Execute to see vote distribution
4. Analyze results for discrepancies

**Key Metrics:**
- Total votes per poll
- CEW vs authenticated votes
- Vote distribution by question

---

#### **database-vote-diagnostics.sql**
```sql
-- Purpose: Comprehensive diagnostic analysis
-- Use when: General troubleshooting needed
-- Returns: Complete vote system overview
```

**What it checks:**
- All poll types (single-choice, ranking, wordcloud)
- Vote counts by user type
- Data consistency issues
- Missing or orphaned votes

**Output sections:**
1. Single-choice poll summary
2. Ranking poll summary
3. Wordcloud poll summary
4. User distribution analysis
5. Data integrity warnings

---

#### **investigate-matrix-data-points.sql**
```sql
-- Purpose: 8-step comprehensive matrix graph analysis
-- Use when: Matrix graphs show incorrect data
-- Returns: Detailed pairing and clustering analysis
```

**Analysis steps:**
1. Check basic vote counts
2. Verify question pairing
3. Analyze user vote distribution
4. Check coordinate clustering
5. Identify overlapping points
6. Calculate expected vs actual pairs
7. Find missing pairs
8. Generate recommendations

**How to use:**
1. Run full script for complete analysis
2. Or run specific sections for targeted debugging
3. Review each step's output
4. Follow recommendations at end

---

#### **investigate-pairing-mismatch.sql**
```sql
-- Purpose: Find votes that should pair but don't
-- Use when: Matrix graphs missing expected data
-- Returns: Unpaired votes and reasons
```

**Common issues found:**
- User voted on importance but not feasibility
- User voted on feasibility but not importance
- Mismatched poll indices
- Incorrect user_id format

---

#### **user-id-analysis.sql**
```sql
-- Purpose: Analyze user_id generation and distribution
-- Use when: K6 tests showing user_id issues
-- Returns: User_id patterns and statistics
```

**Checks:**
- Unique user_id count
- CEW user_id format validation
- User_id distribution patterns
- Potential duplicates

---

## 🧹 **Cleanup Scripts** (`scripts/cleanup/`)

Data maintenance and cleanup utilities.

### **Quick Reference**

| Script | Purpose | ⚠️ Warning Level |
|--------|---------|------------------|
| `cleanup-matrix-test-data.sql` | Remove test data | MEDIUM |
| `purge-all-votes.sql` | Delete ALL votes | ⚠️ HIGH |
| `purge-k6-test-data.sql` | Remove k6 test data | MEDIUM |
| `purge-single-choice-votes.sql` | Delete single-choice votes | HIGH |
| `purge-votes-for-testing.sql` | Remove test votes | MEDIUM |
| `update_prioritization_questions.sql` | Update question text | MEDIUM |

### **Detailed Script Documentation**

#### **⚠️ CRITICAL: Backup Before Cleanup**

**ALWAYS create a backup before running cleanup scripts:**

```sql
-- Create timestamped backups
CREATE TABLE polls_backup_20250101 AS SELECT * FROM polls;
CREATE TABLE poll_votes_backup_20250101 AS SELECT * FROM poll_votes;
CREATE TABLE ranking_polls_backup_20250101 AS SELECT * FROM ranking_polls;
CREATE TABLE ranking_votes_backup_20250101 AS SELECT * FROM ranking_votes;
CREATE TABLE wordcloud_polls_backup_20250101 AS SELECT * FROM wordcloud_polls;
CREATE TABLE wordcloud_votes_backup_20250101 AS SELECT * FROM wordcloud_votes;
```

---

#### **cleanup-matrix-test-data.sql**
```sql
-- Purpose: Remove test data from matrix graph testing
-- Warning: MEDIUM - Affects test data only
-- Use when: Cleaning up after testing
```

**What it removes:**
- K6 test votes with `user_id` like 'CEW2025_%'
- Test data from specific poll IDs
- Maintains production user data

**Safety:**
- Only removes CEW test votes
- Preserves authenticated user votes
- Can be run multiple times safely

**Usage:**
1. Review script to verify poll IDs
2. Execute in SQL Editor
3. Verify deletion counts
4. Check matrix graphs still work

---

#### **purge-all-votes.sql**
```sql
-- Purpose: Delete ALL votes from ALL polls
-- Warning: ⚠️ HIGH - DESTRUCTIVE
-- Use when: Complete data reset needed
```

**⚠️ DANGER ZONE - This script:**
- Deletes ALL poll_votes
- Deletes ALL ranking_votes
- Deletes ALL wordcloud_votes
- CANNOT be undone without backup

**Before running:**
1. ✅ Create backup (see above)
2. ✅ Verify you want to delete ALL data
3. ✅ Notify team members
4. ✅ Have rollback plan ready

**After running:**
- All vote counts reset to 0
- Matrix graphs will be empty
- Admin panel shows no votes
- Users can vote again

---

#### **purge-k6-test-data.sql**
```sql
-- Purpose: Remove data generated by k6 tests
-- Warning: MEDIUM - Affects test data
-- Use when: Cleaning up after load testing
```

**What it removes:**
- Votes with user_id starting with 'CEW2025_'
- Test data from k6 load testing
- Duplicate test submissions

**Safety:**
- Preserves manual test data
- Keeps production votes
- Uses WHERE clause filtering

---

#### **purge-single-choice-votes.sql**
```sql
-- Purpose: Delete only single-choice poll votes
-- Warning: HIGH - Partial data deletion
-- Use when: Single-choice poll reset needed
```

**What it removes:**
- All votes in poll_votes table
- Leaves ranking and wordcloud votes intact

---

#### **update_prioritization_questions.sql**
```sql
-- Purpose: Update prioritization question text
-- Warning: MEDIUM - Modifies poll definitions
-- Use when: Question text needs correction
```

**What it does:**
- Updates question text in polls table
- Maintains options arrays
- Preserves vote data
- Updates both CEW and survey versions

**Safety:**
- Does NOT delete votes
- Only modifies question text
- Can be rolled back from backup

---

## 📋 **Common Workflows**

### **Workflow 1: Investigating Matrix Graph Issues**

```bash
# Step 1: Run comprehensive matrix analysis
# Execute: investigate-matrix-data-points.sql

# Step 2: Check vote pairing
# Execute: investigate-all-users-pairing.sql

# Step 3: Find missing pairs
# Execute: investigate-lost-pairs.sql

# Step 4: Analyze clustering
# Execute: investigate-matrix-clustering.sql

# Step 5: Fix any identified issues
```

---

### **Workflow 2: Cleaning Up After K6 Testing**

```bash
# Step 1: Verify test data exists
# Execute: check-actual-vote-data.sql

# Step 2: Create backup
# Execute backup SQL commands

# Step 3: Remove k6 test data
# Execute: purge-k6-test-data.sql

# Step 4: Verify cleanup
# Execute: check-actual-vote-data.sql again
```

---

### **Workflow 3: Debugging User Visibility Issues**

```bash
# Step 1: Check user distribution
# Execute: user-id-analysis.sql

# Step 2: Find missing users
# Execute: investigate-missing-users.sql

# Step 3: Check vote attribution
# Execute: database-vote-diagnostics.sql

# Step 4: Fix user_id issues if found
```

---

## 🚨 **Safety Guidelines**

### **Before Running ANY Script:**

1. **Understand what it does**
   - Read script comments
   - Review SQL statements
   - Check which tables are affected

2. **Create backups**
   - Always backup before DELETE/UPDATE
   - Use timestamped backup names
   - Verify backup was created

3. **Test in staging first**
   - Never test destructive scripts in production
   - Use development database for testing
   - Verify results before production

4. **Have rollback plan**
   - Know how to restore from backup
   - Document restoration procedure
   - Test rollback process

### **Red Flags - Stop and Think:**

🛑 Script deletes data → **BACKUP FIRST**  
🛑 Script updates questions → **VERIFY TEXT**  
🛑 Script affects production → **TEST IN STAGING**  
🛑 Script removes votes → **NOTIFY TEAM**  

---

## 📞 **Getting Help**

### **If something goes wrong:**

1. **Don't panic** - Most issues are recoverable
2. **Check backups** - Verify you have recent backups
3. **Review logs** - Check SQL Editor output
4. **Restore if needed** - Use backup restoration procedure
5. **Document issue** - Add to DEBUGGING_LESSONS_LEARNED.md

### **Resources:**

- **Debugging Guide**: `docs/DEBUGGING_LESSONS_LEARNED.md`
- **Database Schema**: `database_schema.sql`
- **Update Protocol**: `docs/SAFE_POLL_UPDATE_PROTOCOL.md`
- **Poll System Guide**: `docs/POLL_SYSTEM_COMPLETE_GUIDE.md`

---

## 🎯 **Best Practices**

### **Script Execution:**
- ✅ Read entire script before running
- ✅ Understand expected results
- ✅ Run during low-usage times
- ✅ Monitor execution progress
- ✅ Verify results after completion

### **Documentation:**
- ✅ Document what you run and why
- ✅ Record any issues encountered
- ✅ Update this README if needed
- ✅ Share findings with team

### **Backup Strategy:**
- ✅ Backup before destructive operations
- ✅ Use descriptive backup names
- ✅ Test restoration procedure
- ✅ Keep backups for 30 days minimum

---

## 📝 **Script Maintenance**

### **Adding New Scripts:**

1. Place in appropriate subfolder (debug/ or cleanup/)
2. Add entry to Quick Reference table
3. Document purpose and usage
4. Include safety warnings
5. Update this README

### **Updating Existing Scripts:**

1. Review impact of changes
2. Update documentation
3. Test thoroughly
4. Document changes in git commit
5. Notify team of changes

---

**Last Updated**: October 2025  
**Maintained By**: SSTAC Dashboard Team  
**Questions?**: Review `docs/` folder for detailed guides

