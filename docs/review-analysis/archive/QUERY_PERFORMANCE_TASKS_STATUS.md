# Query Performance Tasks - Poll-Safe Status

**Date:** November 2025  
**Purpose:** Categorize Priority 2 and Priority 3 tasks by poll-safety  
**Related:** `QUERY_PERFORMANCE_ANALYSIS.md`

---

## ✅ **POLL-SAFE TASKS** (Can do now during active polling)

### **Priority 2: Monitoring (All Tasks)** ✅ **100% POLL-SAFE**

All Priority 2 tasks are **read-only monitoring** and have **zero impact** on polling:

1. ✅ **Monitor dashboard query performance** (Supabase internal)
   - **Action:** Review Supabase dashboard metrics
   - **Impact:** Read-only, no changes
   - **Risk:** 🟢 ZERO
   - **Status:** ✅ Safe to do now

2. ✅ **Track max_time trends for result queries**
   - **Action:** Monitor query performance metrics over time
   - **Impact:** Read-only analysis
   - **Risk:** 🟢 ZERO
   - **Status:** ✅ Safe to do now

3. ✅ **Watch for degradation in cache hit rates**
   - **Action:** Monitor cache performance metrics
   - **Impact:** Read-only observation
   - **Risk:** 🟢 ZERO
   - **Status:** ✅ Safe to do now

---

### **Priority 3: Query Pattern Review** ✅ **POLL-SAFE**

1. ✅ **Review query patterns if max_time spikes increase**
   - **Action:** Analyze query logs and patterns (read-only)
   - **Impact:** Analysis only, no changes
   - **Risk:** 🟢 ZERO
   - **Status:** ✅ Safe to do now

---

## ⏸️ **DEFERRED TASKS** (Wait for maintenance window)

### **Priority 1: Index Creation** ⏸️ **DEFERRED**

1. ⏸️ **Create missing composite indexes**
   - **Status:** Already identified and deferred
   - **Reason:** Database schema change during active polling
   - **When:** After polling week completes
   - **Script Ready:** `scripts/verify/create-missing-result-indexes.sql`

---

### **Priority 3: Configuration Changes** ⏸️ **DEFER IF CHANGES NEEDED**

1. ⏸️ **Connection pooling configuration changes** (if needed)
   - **What's Safe (Now):**
     - ✅ Review current connection pooling settings (read-only)
     - ✅ Analyze connection patterns and usage (read-only)
     - ✅ Document current configuration
   - **What to Defer:**
     - ⏸️ Modify connection pool size/limits
     - ⏸️ Change connection pool configuration
     - ⏸️ Adjust Supabase connection settings
   - **Reason:** Configuration changes could affect database connections during active polling
   - **Current Status:** Timezone query issue is **low impact** (6.8% of time, 172 calls)
   - **Recommendation:** 
     - If just reviewing: ✅ **Safe now**
     - If config changes needed: ⏸️ **Defer until after polling**

---

## 📊 **Summary**

| Priority | Task | Status | Risk | Action |
|----------|------|--------|------|--------|
| **P2** | Monitor dashboard queries | ✅ Safe | 🟢 Zero | Do now |
| **P2** | Track max_time trends | ✅ Safe | 🟢 Zero | Do now |
| **P2** | Watch cache hit rates | ✅ Safe | 🟢 Zero | Do now |
| **P3** | Review query patterns | ✅ Safe | 🟢 Zero | Do now |
| **P1** | Create indexes | ⏸️ Deferred | 🟡 Medium | After polling |
| **P3** | Connection pooling (review) | ✅ Safe | 🟢 Zero | Do now |
| **P3** | Connection pooling (config) | ⏸️ Defer | 🟡 Medium | After polling |

---

## 🎯 **Recommendations**

### **Do Now (Poll-Safe):**
1. ✅ Set up monitoring dashboards/tracking
2. ✅ Review current connection pooling settings (documentation only)
3. ✅ Analyze query patterns from existing performance data

### **Defer Until After Polling:**
1. ⏸️ Create missing indexes
2. ⏸️ Any connection pooling configuration changes (if review indicates needed)

---

## 📝 **Notes**

- **Monitoring is always safe** - It's read-only and doesn't affect system behavior
- **Analysis and review are safe** - No changes, just understanding
- **Configuration changes should be deferred** - Even low-risk ones, better safe during active polling
- **Current performance is acceptable** - No urgent optimizations needed

---

**Last Updated:** November 2025  
**Status:** Priority 2 tasks are all poll-safe and can be implemented now

