# ✅ Phase 1 Verification Checklist

## 🎯 **Phase 1 Objectives**
- ✅ Remove all WIKS polls (6 polls) and their ~340 votes
- ✅ Remove test poll (1 poll) and its votes  
- ✅ Create comprehensive backups
- ✅ Preserve all valid current polls and votes

## 📋 **Pre-Execution Verification**

### **Before Running Script:**
- [ ] Confirm you have admin access to Supabase SQL Editor
- [ ] Verify you can see the current database state
- [ ] Confirm you understand this will remove ~340 votes (94% of current data)
- [ ] Confirm you want to proceed with Phase 1 only

### **Current State (Based on CSV Analysis):**
- **Total Polls**: 17
- **Total Votes**: 362
- **WIKS Polls to Remove**: 6 polls
- **WIKS Votes to Remove**: ~340 votes
- **Test Polls to Remove**: 1 poll
- **Valid Polls to Keep**: 10 polls
- **Valid Votes to Keep**: ~22 votes

## 📋 **During Execution Monitoring**

### **Step 1: Backup Creation**
- [ ] Verify all 4 backup tables created successfully
- [ ] Confirm backup counts match current table counts
- [ ] Note any errors or warnings

### **Step 2: State Documentation**
- [ ] Review "BEFORE CLEANUP" output
- [ ] Confirm WIKS polls identified correctly
- [ ] Confirm test polls identified correctly
- [ ] Note current vote distribution

### **Step 3: WIKS Removal**
- [ ] Verify WIKS votes removed (should be 0 remaining)
- [ ] Verify WIKS polls removed (should be 0 remaining)
- [ ] Confirm no errors during deletion

### **Step 4: Test Data Removal**
- [ ] Verify test votes removed
- [ ] Verify test polls removed (should be 0 remaining)
- [ ] Confirm no errors during deletion

### **Step 5: Final Verification**
- [ ] Review "AFTER CLEANUP" output
- [ ] Confirm only valid polls remain
- [ ] Verify vote counts are reasonable (~22 votes)
- [ ] Confirm cleanup summary shows expected changes

## 📋 **Post-Execution Verification**

### **System Functionality Test:**
- [ ] **Admin Panel**: Load `/admin/poll-results` - should work without errors
- [ ] **Poll Pages**: Test current poll pages still work
- [ ] **Vote Submission**: Test submitting a vote on a current poll
- [ ] **Results Display**: Verify poll results display correctly
- [ ] **Navigation**: Test admin panel navigation and filtering

### **Data Integrity Check:**
- [ ] **Poll Count**: Should have ~10 polls remaining
- [ ] **Vote Count**: Should have ~22 votes remaining
- [ ] **No WIKS Data**: Confirm no WIKS-related data remains
- [ ] **No Test Data**: Confirm no test-related data remains

### **Expected Remaining Polls:**
- [ ] Holistic Protection: 2 polls (CEW + Survey, poll_index 0)
- [ ] Tiered Framework: 1 poll (Survey, poll_index 0) 
- [ ] Prioritization: 4 polls (Survey + CEW, poll_index 3 & 7)
- [ ] One ranking question in wrong table (to be fixed in Phase 2)

## 🚨 **Rollback Triggers**

**STOP and ROLLBACK if:**
- [ ] Any error occurs during execution
- [ ] Admin panel doesn't load after cleanup
- [ ] Vote submission fails after cleanup
- [ ] Poll results don't display correctly
- [ ] Any unexpected data loss occurs

## 📞 **Rollback Procedure**

If rollback needed, run these commands in Supabase SQL Editor:

```sql
-- Emergency rollback to restore from backup
DROP TABLE IF EXISTS polls;
DROP TABLE IF EXISTS ranking_polls;
DROP TABLE IF EXISTS poll_votes;
DROP TABLE IF EXISTS ranking_votes;

ALTER TABLE polls_backup_20250120 RENAME TO polls;
ALTER TABLE ranking_polls_backup_20250120 RENAME TO ranking_polls;
ALTER TABLE poll_votes_backup_20250120 RENAME TO poll_votes;
ALTER TABLE ranking_votes_backup_20250120 RENAME TO ranking_votes;

-- Verify rollback successful
SELECT COUNT(*) as polls_count FROM polls;
SELECT COUNT(*) as votes_count FROM poll_votes;
```

## ✅ **Phase 1 Success Criteria**

Phase 1 is successful when:
- [ ] All WIKS and test data removed
- [ ] All valid current polls preserved
- [ ] System functionality intact
- [ ] Ready to proceed to Phase 2 (if desired)

## 📝 **Notes Section**

**Execution Date**: _______________
**Executed By**: _______________
**Issues Encountered**: _______________
**System Status After**: _______________
**Ready for Phase 2**: [ ] Yes [ ] No
