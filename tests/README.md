# 🧪 Testing Documentation

This folder contains comprehensive k6 load testing scripts for the SSTAC Dashboard polling system.

## 📊 **Test Suite Overview**

The testing suite provides complete coverage of all poll types, authentication modes, and system performance metrics.

### **Test Files**

| File | Purpose | Complexity | Duration |
|------|---------|------------|----------|
| `k6-test.js` | Basic test suite | Low | ~2 min |
| `k6-comprehensive-test-enhanced.js` | Full system test | High | ~5 min |
| `k6-matrix-graph-test-enhanced.js` | Matrix graph focus | Medium | ~3 min |
| `k6-ranking-test.js` | Ranking polls only | Low | ~2 min |
| `k6-wordcloud-test.js` | Wordcloud polls only | Low | ~2 min |
| `k6-survey-results-authenticated.js` | Authenticated users | Medium | ~3 min |

---

## 🚀 **Quick Start**

### **Prerequisites**

1. **Install k6**:
   ```bash
   # Windows (using Chocolatey)
   choco install k6
   
   # macOS (using Homebrew)
   brew install k6
   
   # Linux (using package manager)
   sudo apt-key adv --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
   echo "deb https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
   sudo apt-get update
   sudo apt-get install k6
   ```

2. **Verify Installation**:
   ```bash
   k6 version
   # Should display: k6 v0.x.x
   ```

### **Running Tests**

#### **Basic Test (Start Here)**
```bash
# From project root
k6 run tests/k6-test.js
```

#### **Comprehensive Test (Recommended)**
```bash
k6 run tests/k6-comprehensive-test-enhanced.js
```

#### **Custom Base URL**
```bash
k6 run --env BASE_URL=https://your-domain.com tests/k6-test.js
```

#### **Custom Thresholds**
```bash
k6 run --threshold http_req_duration=p(95)<1000 tests/k6-test.js
```

---

## 📋 **Test File Details**

### **k6-test.js** - Basic Test Suite

**Purpose**: Entry-level testing for basic functionality

**What it tests:**
- Single-choice poll submissions
- Ranking poll submissions
- Wordcloud poll submissions
- Basic performance metrics

**Virtual Users**: 20 concurrent users  
**Duration**: ~2 minutes  
**Success Criteria**: 95% success rate, p95 < 2s

**When to use:**
- Quick validation after changes
- Development testing
- Smoke testing before deployment

**Example output:**
```
✓ Poll submission successful
✓ Response time < 2s

checks.........................: 100.00% ✓ 160  ✗ 0
http_req_duration..............: avg=139ms min=45ms med=120ms max=265ms p(95)=230ms
http_reqs......................: 160     ~15/s
```

---

### **k6-comprehensive-test-enhanced.js** - Full System Test

**Purpose**: Complete system validation with all features

**What it tests:**
- All poll types (single-choice, ranking, wordcloud)
- CEW polling (unauthenticated)
- Survey-results polling (authenticated)
- Matrix graph API
- Data validation
- Performance under load

**Virtual Users**: 30 CEW + 15 authenticated  
**Duration**: ~5 minutes  
**Success Criteria**: 95% success rate, p95 < 2s, <5% errors

**Coverage:**
- ✅ All 8 holistic protection questions
- ✅ All 13 prioritization questions
- ✅ All 3 tiered framework questions
- ✅ Matrix graph endpoints
- ✅ Both authentication modes

**When to use:**
- Pre-deployment validation
- Performance benchmarking
- Full regression testing
- Conference readiness testing

**Example output:**
```
✓ All poll submissions successful
✓ Data validation passed
✓ Matrix graphs working
✓ Performance within limits

checks.........................: 100.00% ✓ 2150 ✗ 0
data_received..................: 2.1 MB  105 kB/s
data_sent......................: 350 kB  17.5 kB/s
http_req_duration..............: avg=145ms min=42ms med=125ms max=380ms p(95)=275ms
http_reqs......................: 2150    ~107/s
iteration_duration.............: avg=2.5s min=1.2s med=2.3s max=4.1s
vus............................: 45      min=15 max=45
```

---

### **k6-matrix-graph-test-enhanced.js** - Matrix Graph Focus

**Purpose**: Specialized testing for prioritization matrix graphs

**What it tests:**
- Vote pairing (importance + feasibility)
- User ID consistency
- Data point clustering
- Filter functionality
- Overlapping coordinate handling

**Virtual Users**: 100 concurrent users  
**Duration**: ~3 minutes  
**Success Criteria**: Proper vote pairing, no user_id mismatches

**Special features:**
- Sends `x-session-id` header for proper user tracking
- Tests all 5 matrix graph pairs
- Validates data aggregation
- Tests all filter modes (all, twg, cew)

**When to use:**
- After matrix graph changes
- User ID generation testing
- Data pairing validation
- Clustering algorithm testing

**Key metrics:**
```
✓ Vote pairs created successfully
✓ User IDs consistent across questions
✓ Matrix API response valid

paired_votes...................: 200     100% of users
user_id_consistency............: 100.00% ✓ 200  ✗ 0
matrix_api_success.............: 100.00% ✓ 10   ✗ 0
```

---

### **k6-ranking-test.js** - Ranking Poll Focus

**Purpose**: Focused testing of ranking poll functionality

**What it tests:**
- Ranking vote submission
- Multiple options per user
- Rank ordering (1-N)
- Result aggregation

**Virtual Users**: 20 concurrent users  
**Duration**: ~2 minutes  
**Success Criteria**: All rankings submitted correctly

**When to use:**
- After ranking poll changes
- Ranking algorithm testing
- Quick validation of ranking system

---

### **k6-wordcloud-test.js** - Wordcloud Poll Focus

**Purpose**: Focused testing of wordcloud functionality

**What it tests:**
- Word submission (1-3 words)
- Character limits (20 chars)
- Word frequency aggregation
- Predefined option handling

**Virtual Users**: 50 concurrent users  
**Duration**: ~2 minutes  
**Success Criteria**: All words submitted successfully

**When to use:**
- After wordcloud changes
- Word limit validation
- Frequency calculation testing

---

### **k6-survey-results-authenticated.js** - Authenticated Testing

**Purpose**: Test authenticated user polling

**What it tests:**
- Authenticated user flow
- Session management
- Vote replacement logic
- Survey-results pages

**Virtual Users**: 15 concurrent users  
**Duration**: ~3 minutes  
**Success Criteria**: All authenticated votes successful

**When to use:**
- After authentication changes
- Session handling testing
- Vote update logic validation

---

## 📊 **Understanding Test Results**

### **Key Metrics Explained**

#### **checks**
- Percentage of successful validation checks
- Should be 100% for passing tests
- Each check validates specific functionality

#### **http_req_duration**
- Response time statistics
- avg = average response time
- p(95) = 95th percentile (should be < 2s)
- p(99) = 99th percentile

#### **http_reqs**
- Total HTTP requests made
- Requests per second (throughput)

#### **http_req_failed**
- Percentage of failed requests
- Should be < 5% for passing tests

#### **vus (Virtual Users)**
- Number of concurrent simulated users
- min/max shows ramping behavior

#### **iteration_duration**
- Complete test cycle time per user
- Includes all requests and think time

---

## 🎯 **Performance Thresholds**

### **Default Thresholds**
```javascript
thresholds: {
  http_req_duration: ['p(95)<2000'],    // 95% under 2 seconds
  http_req_failed: ['rate<0.05'],       // Less than 5% failures
  checks: ['rate>0.95'],                 // More than 95% checks pass
}
```

### **Custom Thresholds**
```bash
# Stricter thresholds
k6 run \
  --threshold http_req_duration=p(95)<1000 \
  --threshold http_req_failed=rate<0.01 \
  --threshold checks=rate>0.99 \
  tests/k6-test.js

# Relaxed thresholds for development
k6 run \
  --threshold http_req_duration=p(95)<5000 \
  --threshold http_req_failed=rate<0.10 \
  tests/k6-test.js
```

---

## 🚨 **Troubleshooting**

### **Common Issues**

#### **"Cannot find module 'k6/http'"**
```bash
# Wrong command
node k6-test.js  ❌

# Correct command
k6 run k6-test.js  ✅
```

#### **High Failure Rate**
```bash
# Check if server is running
curl https://your-domain.com

# Reduce virtual users
k6 run --vus 10 tests/k6-test.js

# Check Supabase rate limits
```

#### **Slow Response Times**
```bash
# Check database performance
# Review Supabase metrics
# Consider upgrading tier

# Test with fewer users
k6 run --vus 5 tests/k6-test.js
```

#### **User ID Mismatch (Matrix Graphs)**
```bash
# Ensure x-session-id header is sent
# Check API user_id generation logic
# Use k6-matrix-graph-test-enhanced.js

k6 run tests/k6-matrix-graph-test-enhanced.js
```

---

## 📈 **Best Practices**

### **Before Testing**

1. **Backup Data**
   ```sql
   -- Create backups before major tests
   CREATE TABLE polls_backup AS SELECT * FROM polls;
   CREATE TABLE poll_votes_backup AS SELECT * FROM poll_votes;
   ```

2. **Check System Status**
   - Verify Supabase is operational
   - Check Vercel deployment status
   - Review current rate limits

3. **Notify Team**
   - Inform team of testing schedule
   - Avoid testing during peak usage
   - Coordinate with data cleanup

### **During Testing**

1. **Monitor Performance**
   - Watch k6 output in real-time
   - Check Supabase dashboard metrics
   - Monitor Vercel logs

2. **Stop if Needed**
   - Press `Ctrl+C` to stop test
   - Tests can be safely interrupted
   - Data cleanup may be needed

### **After Testing**

1. **Analyze Results**
   - Review all metrics
   - Check for anomalies
   - Compare with baselines

2. **Clean Up Test Data**
   ```bash
   # Run cleanup script
   # Execute: scripts/cleanup/purge-k6-test-data.sql
   ```

3. **Document Findings**
   - Record performance metrics
   - Note any issues discovered
   - Update baseline metrics

---

## 🔧 **Advanced Usage**

### **Custom Scenarios**
```javascript
// Create custom test scenarios
export let options = {
  scenarios: {
    spike_test: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '10s', target: 100 },
        { duration: '30s', target: 100 },
        { duration: '10s', target: 0 },
      ],
    },
  },
};
```

### **Environment Variables**
```bash
# Set custom base URL
export K6_BASE_URL=https://staging.example.com
k6 run tests/k6-test.js

# Set custom thresholds
export K6_THRESHOLD_P95=1000
k6 run tests/k6-test.js
```

### **Results Export**
```bash
# Export to JSON
k6 run --out json=results.json tests/k6-test.js

# Export to CSV
k6 run --out csv=results.csv tests/k6-test.js

# Stream to cloud (k6 Cloud account required)
k6 run --out cloud tests/k6-test.js
```

---

## 📚 **Additional Resources**

### **Documentation**
- [k6 Official Docs](https://k6.io/docs/)
- [Test Coverage Analysis](../docs/K6_TEST_COVERAGE_ANALYSIS.md)
- [Debugging Guide](../docs/DEBUGGING_LESSONS_LEARNED.md)

### **Related Scripts**
- [Run CEW Test](../scripts/run-cew-100-test.ps1)
- [Cleanup Scripts](../scripts/cleanup/)
- [Debug Scripts](../scripts/debug/)

### **Project Documentation**
- [Poll System Guide](../docs/POLL_SYSTEM_COMPLETE_GUIDE.md)
- [Safe Update Protocol](../docs/SAFE_POLL_UPDATE_PROTOCOL.md)
- [Project Status](../docs/PROJECT_STATUS.md)

---

## 🎯 **Testing Workflows**

### **Workflow 1: Pre-Deployment Testing**
```bash
# 1. Run basic smoke test
k6 run tests/k6-test.js

# 2. Run comprehensive test
k6 run tests/k6-comprehensive-test-enhanced.js

# 3. Verify matrix graphs
k6 run tests/k6-matrix-graph-test-enhanced.js

# 4. Clean up test data
# Execute: scripts/cleanup/purge-k6-test-data.sql
```

### **Workflow 2: Performance Benchmarking**
```bash
# 1. Baseline test (low load)
k6 run --vus 10 --duration 2m tests/k6-test.js

# 2. Normal load test
k6 run --vus 50 --duration 5m tests/k6-test.js

# 3. Peak load test
k6 run --vus 100 --duration 10m tests/k6-test.js

# 4. Compare results and document
```

### **Workflow 3: Bug Investigation**
```bash
# 1. Run focused test
k6 run tests/k6-ranking-test.js

# 2. Review failed checks
# 3. Run debug SQL scripts
# 4. Fix issues
# 5. Retest
```

---

**Last Updated**: October 2025  
**Maintained By**: SSTAC Dashboard Team  
**Questions?**: Review main [README](../README.md) or [documentation](../docs/)

