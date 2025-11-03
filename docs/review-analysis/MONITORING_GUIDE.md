# Query Performance Monitoring Guide

**Date:** 2025-01-31  
**Purpose:** Guide for Priority 2 monitoring tasks  
**Related:** `QUERY_PERFORMANCE_ANALYSIS.md`, `QUERY_PERFORMANCE_TASKS_STATUS.md`

---

## 📊 **Priority 2 Monitoring Tasks**

All Priority 2 tasks are **read-only** and **poll-safe**:

1. ✅ Monitor dashboard query performance (Supabase internal)
2. ✅ Track max_time trends for result queries
3. ✅ Watch for degradation in cache hit rates

---

## 🔧 **Monitoring Scripts**

### **Option 1: Simple Monitoring (Recommended)**

**Script:** `scripts/verify/simple-query-monitoring.sql`

**What it checks:**
- Cache hit rates for result tables
- Index cache hit rates
- Table activity (inserts, updates, deletes)
- Overall database cache hit rate
- Index usage statistics

**When to use:**
- Quick daily/weekly checks
- No special extensions needed
- Works on all Supabase databases

**How to run:**
1. Open Supabase SQL Editor
2. Copy contents of `scripts/verify/simple-query-monitoring.sql`
3. Execute
4. Review results

---

### **Option 2: Advanced Monitoring (If Available)**

**Script:** `scripts/verify/monitor-query-performance.sql`

**What it checks:**
- Dashboard/system query performance
- Result table query performance
- Max time spike detection
- Detailed cache statistics
- Query activity summary

**When to use:**
- More detailed analysis
- Requires `pg_stat_statements` extension
- May not be available in all Supabase tiers

**⚠️ Important Notes:**
- Script includes automatic check for `pg_stat_statements` extension
- If extension not available, script will error with helpful message
- If you get errors, use **Option 1** (`simple-query-monitoring.sql`) instead

**Troubleshooting:**
- **Error: "Extension pg_stat_statements required"** → Use `simple-query-monitoring.sql`
- **Error: "syntax error at or near ["** → You may have copied JSON instead of SQL - copy the script file contents
- **Any other errors** → Use `simple-query-monitoring.sql` as fallback

---

## 📋 **How to Monitor**

### **Daily/Weekly Checks:**

1. **Run Simple Monitoring Script**
   - Execute `simple-query-monitoring.sql`
   - Review cache hit rates (should be > 95%)
   - Check index usage

2. **Review Supabase Dashboard**
   - Go to Supabase Dashboard → Database → Performance
   - Review query performance metrics
   - Check for any alerts or warnings

3. **Document Findings**
   - Note any degradation in cache hit rates
   - Track if max_time spikes are increasing
   - Monitor overall trends

---

## 🎯 **What to Look For**

### **✅ Good Signs:**
- Cache hit rate > 95%
- Consistent query times
- Indexes being used (idx_scan > 0)
- No degradation over time

### **⚠️ Warning Signs:**
- Cache hit rate < 90%
- Increasing max_time spikes
- Unused indexes (idx_scan = 0)
- Growing dead rows (n_dead_tup)

### **🔴 Alert Conditions:**
- Cache hit rate < 80%
- Max_time spikes > 1000ms consistently
- Significant increase in disk reads
- Query performance degrading week-over-week

---

## 📊 **Tracking Trends**

### **Create a Monitoring Log:**

| Date | Cache Hit Rate | Total Cache Hits | Disk Reads | Max Time (poll_results) | Max Time (ranking) | Max Time (wordcloud) | Notes |
|------|----------------|------------------|------------|-------------------------|-------------------|---------------------|-------|
| 2025-01-31 | **100.00%** ✅ | 4,287,482 | 0 | 424ms | 538ms | 482ms | Baseline - Excellent |
| | | | | | | | |

**Update weekly** to track trends and identify degradation.

---

## 🔍 **Interpreting Results**

### **Cache Hit Rate:**
- **> 99%:** ✅ Excellent - Data is in memory
- **95-99%:** ✅ Good - Occasional disk reads
- **90-95%:** 🟡 Acceptable - Some disk reads
- **< 90%:** 🔴 Low - Too many disk reads, review needed

### **Index Usage:**
- **idx_scan > 0:** ✅ Index is being used
- **idx_scan = 0:** ⚠️ Index may not be needed, or query pattern doesn't match

### **Table Activity:**
- **Dead rows growing:** Consider running VACUUM
- **High insert/update rates:** Monitor for performance impact

---

## 📝 **Monitoring Schedule**

### **Recommended Frequency:**
- **Weekly:** Run simple monitoring script
- **Monthly:** Review trends and patterns
- **Quarterly:** Detailed performance review

### **During Active Polling:**
- Monitor more frequently (2-3 times per week)
- Watch for any degradation
- Document any anomalies

---

## 🚨 **When to Take Action**

### **Immediate Action (If Critical):**
- Cache hit rate drops below 80%
- Query times increase significantly (> 2x baseline)
- Users reporting performance issues

### **Plan for Maintenance Window:**
- Cache hit rate degrading over time
- Indexes not being used
- Dead rows accumulating
- Performance optimization needed (Priority 3)

---

## 📚 **Additional Resources**

- **Supabase Dashboard:** Built-in performance monitoring
- **Query Performance Analysis:** `QUERY_PERFORMANCE_ANALYSIS.md`
- **Task Status:** `QUERY_PERFORMANCE_TASKS_STATUS.md`
- **Index Verification:** `INDEX_VERIFICATION_RESULTS.md`

---

## ✅ **Monitoring Checklist**

- [ ] Run simple monitoring script weekly
- [ ] Review cache hit rates
- [ ] Check index usage
- [ ] Monitor for max_time spikes
- [ ] Document trends
- [ ] Review Supabase Dashboard metrics
- [ ] Update monitoring log

---

**Last Updated:** 2025-01-31  
**Status:** Ready for use - All scripts are poll-safe (read-only)

