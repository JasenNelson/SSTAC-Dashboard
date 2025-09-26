# K6 Poll System Test Suite Summary

## 🎯 Overview

This comprehensive k6 test suite validates the SSTAC & TWG Dashboard polling system across all poll types (single-choice, ranking, wordcloud) and authentication modes (survey-results vs cew-polls).

## 📁 Test Files

### Core Test Scripts
1. **`k6-poll-system-test.js`** - Comprehensive system load testing
2. **`k6-wordcloud-focused-test.js`** - Wordcloud-specific functionality testing  
3. **`k6-authentication-test.js`** - Authentication fix validation
4. **`test-auth-fix.js`** - Quick Node.js authentication verification

### Helper Scripts
5. **`run-k6-tests.sh`** - Linux/macOS test runner
6. **`run-k6-tests.bat`** - Windows test runner
7. **`K6_TESTING_GUIDE.md`** - Detailed testing instructions

## 🧪 Test Coverage

### Poll Types Tested
- ✅ **Single-Choice Polls** - All pages and scenarios
- ✅ **Ranking Polls** - All pages and scenarios  
- ✅ **Wordcloud Polls** - All pages and scenarios

### Pages Tested
- ✅ **Survey Results Pages** (`/survey-results/*`)
  - Holistic Protection
  - Prioritization (13 questions)
  - Tiered Framework
- ✅ **CEW Poll Pages** (`/cew-polls/*`)
  - Holistic Protection
  - Prioritization (13 questions)
  - Tiered Framework

### Authentication Modes
- ✅ **Authenticated Users** - Survey-results pages require authentication
- ✅ **CEW Conference** - CEW pages work with authCode
- ✅ **Mixed Scenarios** - Both modes tested simultaneously

### API Endpoints
- ✅ **Poll Submission** - `/api/polls/submit`
- ✅ **Ranking Submission** - `/api/ranking-polls/submit`
- ✅ **Wordcloud Submission** - `/api/wordcloud-polls/submit`
- ✅ **Poll Results** - `/api/polls/results`
- ✅ **Ranking Results** - `/api/ranking-polls/results`
- ✅ **Wordcloud Results** - `/api/wordcloud-polls/results`
- ✅ **Matrix Graphs** - `/api/graphs/prioritization-matrix`

## 🚀 Quick Start

### Prerequisites
```bash
# Install k6
# Windows
choco install k6

# macOS  
brew install k6

# Linux
# See: https://k6.io/docs/getting-started/installation/
```

### Run Tests

#### Windows
```cmd
# Authentication test
run-k6-tests.bat auth

# Wordcloud test
run-k6-tests.bat wordcloud

# Comprehensive test
run-k6-tests.bat comprehensive
```

#### Linux/macOS
```bash
# Authentication test
./run-k6-tests.sh auth

# Wordcloud test
./run-k6-tests.sh wordcloud

# Comprehensive test
./run-k6-tests.sh comprehensive
```

#### Direct k6 Commands
```bash
# Authentication validation
k6 run k6-authentication-test.js

# Wordcloud functionality
k6 run k6-wordcloud-focused-test.js

# Full system load test
k6 run k6-poll-system-test.js
```

## 📊 Performance Thresholds

### Default Thresholds
- **Response Time**: 95% < 2 seconds
- **Error Rate**: < 10% (comprehensive), < 5% (wordcloud)
- **Success Rate**: > 95% for poll submissions

### Load Patterns
- **Authentication Test**: 5 → 10 users (3 minutes)
- **Wordcloud Test**: 10 → 25 → 50 users (5.5 minutes)
- **Comprehensive Test**: 20 → 50 → 100 users (6 minutes)

## 🔍 Test Scenarios

### Authentication Test Scenarios
1. **Survey-Results Pages** (Expected: 401 Unauthorized)
   - Single-choice poll submission without auth
   - Ranking poll submission without auth
   - Wordcloud poll submission without auth

2. **CEW Poll Pages** (Expected: 200 Success)
   - Single-choice poll with authCode
   - Ranking poll with authCode
   - Wordcloud poll with authCode

3. **Results Fetching** (Expected: 200 Success)
   - All poll types on both page types
   - Works regardless of authentication mode

### Wordcloud Test Scenarios
1. **Submission Testing**
   - 1-3 words per submission
   - 20 character limit per word
   - Predefined options vs custom words
   - Both survey-results and cew-polls

2. **Results Fetching**
   - Real-time word aggregation
   - Frequency calculation
   - Response count validation

3. **Error Handling**
   - Invalid word length
   - Too many words
   - Duplicate words

### Comprehensive Test Scenarios
1. **Random Page Selection**
   - Randomly chooses survey-results or cew-polls
   - Tests all poll types on selected page

2. **Load Testing**
   - Gradual ramp-up to 100 concurrent users
   - Sustained load testing
   - Performance under stress

3. **Data Validation**
   - Poll submission success rates
   - Results fetching accuracy
   - Response time consistency

## 📈 Expected Results

### Authentication Test
- **Survey-results pages**: 401 errors (authentication required)
- **CEW pages**: 200 success (authCode works)
- **Results fetching**: 200 success (works for both modes)

### Wordcloud Test
- **Submission success rate**: > 98%
- **Response time**: < 1 second
- **Results accuracy**: Valid word aggregation

### Comprehensive Test
- **Overall success rate**: > 95%
- **Response time (95th percentile)**: < 2 seconds
- **Error rate**: < 10%
- **All poll types working**: Single-choice, ranking, wordcloud

## 🛠️ Customization

### Custom Load Patterns
```javascript
// Modify in test files
export const options = {
  stages: [
    { duration: '1m', target: 50 },  // Custom ramp up
    { duration: '5m', target: 50 },  // Custom sustained load
    { duration: '1m', target: 0 },   // Custom ramp down
  ],
};
```

### Custom Thresholds
```javascript
thresholds: {
  http_req_duration: ['p(95)<1500'], // Stricter response time
  http_req_failed: ['rate<0.05'],    // Lower error rate
  poll_submissions_successful: ['rate>0.98'], // Higher success rate
}
```

### Custom Test Data
```javascript
// Add new test scenarios
const NEW_TEST_DATA = {
  pagePath: '/survey-results/new-page',
  pollIndex: 0,
  question: 'New test question',
  options: ['Option 1', 'Option 2', 'Option 3']
};
```

## 🚨 Troubleshooting

### Common Issues
1. **Authentication Errors**: Expected for survey-results without auth
2. **Wordcloud Failures**: Check word length limits (20 chars, 1-3 words)
3. **High Response Times**: Check database performance and scaling
4. **Rate Limiting**: Reduce VU count or add delays

### Debug Commands
```bash
# Single VU for debugging
k6 run --vus 1 --iterations 1 k6-authentication-test.js

# Verbose output
k6 run --verbose k6-poll-system-test.js

# Custom duration
k6 run --duration 2m k6-wordcloud-focused-test.js
```

## 📊 Monitoring

### Key Metrics
- **Response Time**: Average, 95th percentile, maximum
- **Success Rates**: Poll submissions, API responses
- **Error Analysis**: HTTP codes, failure patterns
- **Load Performance**: VU utilization, throughput

### Sample Output
```json
{
  "test_duration": 360000,
  "total_requests": 1500,
  "failed_requests": 15,
  "avg_response_time": 245,
  "p95_response_time": 1200,
  "poll_submission_success_rate": 0.98,
  "wordcloud_submission_success_rate": 0.97
}
```

## 🎯 Success Criteria

### Authentication Fix Validation
- ✅ Survey-results pages return 401 without authentication
- ✅ CEW pages work with authCode parameter
- ✅ Results fetching works for both authentication modes
- ✅ Wordcloud API properly handles both auth modes

### System Performance
- ✅ All poll types submit successfully under load
- ✅ Response times remain under 2 seconds
- ✅ Error rates stay below 10%
- ✅ Database performance remains stable

### Functionality Validation
- ✅ Single-choice polls work correctly
- ✅ Ranking polls work correctly
- ✅ Wordcloud polls work correctly
- ✅ Results aggregation works correctly
- ✅ Matrix graphs load correctly

This comprehensive test suite ensures the polling system is robust, performant, and handles both authentication modes correctly under various load conditions.
