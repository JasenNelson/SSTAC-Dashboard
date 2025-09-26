# K6 Poll System Testing Guide

This guide provides comprehensive k6 load testing scripts for the SSTAC & TWG Dashboard polling system, covering single-choice polls, ranking polls, and wordcloud polls across both survey-results and cew-polls pages.

## 📋 Test Scripts Overview

### 1. **k6-poll-system-test.js** - Comprehensive Poll System Test
- **Purpose**: Full system load testing across all poll types and pages
- **Coverage**: Single-choice, ranking, and wordcloud polls on both survey-results and cew-polls
- **Load Pattern**: 20 → 50 → 100 users over 6 minutes
- **Features**: 
  - Random page selection
  - All poll type testing
  - Results fetching validation
  - Prioritization matrix graph testing

### 2. **k6-wordcloud-focused-test.js** - Wordcloud-Specific Test
- **Purpose**: Focused testing of wordcloud poll functionality
- **Coverage**: Wordcloud polls on prioritization and tiered-framework pages
- **Load Pattern**: 10 → 25 → 50 users over 5.5 minutes
- **Features**:
  - Wordcloud submission testing
  - Results fetching validation
  - Authentication mode testing (survey vs CEW)

### 3. **k6-authentication-test.js** - Authentication Fix Validation
- **Purpose**: Verify authentication fixes for survey-results pages
- **Coverage**: Authentication requirements for all poll types
- **Load Pattern**: 5 → 10 users over 3 minutes
- **Features**:
  - Survey-results pages should require authentication (401 errors expected)
  - CEW pages should work with authCode (200 responses expected)
  - Results fetching should work for both modes

## 🚀 Running the Tests

### Prerequisites
```bash
# Install k6 (if not already installed)
# Windows (using Chocolatey)
choco install k6

# macOS (using Homebrew)
brew install k6

# Linux (using package manager)
# Ubuntu/Debian
sudo apt-key adv --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update
sudo apt-get install k6

# Or download from https://k6.io/docs/getting-started/installation/
```

### Basic Test Execution

#### 1. Comprehensive Poll System Test
```bash
# Test against production (default)
k6 run k6-poll-system-test.js

# Test against staging/local
k6 run -e BASE_URL=https://your-staging-url.com k6-poll-system-test.js

# Test with custom duration
k6 run --duration 10m k6-poll-system-test.js
```

#### 2. Wordcloud-Focused Test
```bash
# Test wordcloud functionality
k6 run k6-wordcloud-focused-test.js

# Test with custom load
k6 run --vus 30 --duration 5m k6-wordcloud-focused-test.js
```

#### 3. Authentication Test
```bash
# Test authentication fixes
k6 run k6-authentication-test.js

# Test with verbose output
k6 run --verbose k6-authentication-test.js
```

### Advanced Test Execution

#### Custom Load Patterns
```bash
# Custom stages
k6 run --stage 30s:10,1m:20,30s:0 k6-poll-system-test.js

# Fixed VU count
k6 run --vus 50 --duration 5m k6-wordcloud-focused-test.js

# Ramp up/down
k6 run --stage 1m:0,2m:50,1m:0 k6-poll-system-test.js
```

#### Environment Variables
```bash
# Set custom base URL
k6 run -e BASE_URL=https://your-domain.com k6-poll-system-test.js

# Set custom CEW code
k6 run -e CEW_CODE=YOUR_CODE k6-poll-system-test.js
```

#### Output Options
```bash
# Save results to file
k6 run --out json=results.json k6-poll-system-test.js

# Generate HTML report
k6 run --out json=results.json k6-poll-system-test.js
k6 run --out json=results.json k6-poll-system-test.js
# Then use k6-to-junit or similar tool to generate HTML report
```

## 📊 Test Scenarios Covered

### Poll Types Tested
1. **Single-Choice Polls**
   - Holistic Protection (poll_index 0)
   - Prioritization (poll_index 0-9)
   - Tiered Framework (poll_index 0)

2. **Ranking Polls**
   - Holistic Protection (poll_index 1)
   - Prioritization (poll_index 10-11)
   - Tiered Framework (poll_index 1)

3. **Wordcloud Polls**
   - Prioritization (poll_index 12)
   - Tiered Framework (poll_index 2)

### Authentication Modes Tested
1. **Survey-Results Pages**
   - Requires user authentication
   - Should return 401 for unauthenticated requests
   - Uses authenticated user UUID as user_id

2. **CEW Polls Pages**
   - Uses CEW code authentication
   - Should work with authCode parameter
   - Uses "CEW2025" as user_id

### API Endpoints Tested
- `POST /api/polls/submit` - Single-choice poll submission
- `POST /api/ranking-polls/submit` - Ranking poll submission
- `POST /api/wordcloud-polls/submit` - Wordcloud poll submission
- `GET /api/polls/results` - Single-choice poll results
- `GET /api/ranking-polls/results` - Ranking poll results
- `GET /api/wordcloud-polls/results` - Wordcloud poll results
- `GET /api/graphs/prioritization-matrix` - Matrix graph data

## 📈 Performance Thresholds

### Default Thresholds
- **Response Time**: 95% of requests < 2 seconds
- **Error Rate**: < 10% (comprehensive test), < 5% (wordcloud test)
- **Success Rate**: > 95% for poll submissions

### Custom Thresholds
You can modify thresholds in the test files:
```javascript
thresholds: {
  http_req_duration: ['p(95)<1500'], // Stricter response time
  http_req_failed: ['rate<0.05'],    // Lower error rate
  poll_submissions_successful: ['rate>0.98'], // Higher success rate
}
```

## 🔍 Monitoring and Debugging

### Real-time Monitoring
```bash
# Run with real-time output
k6 run --verbose k6-poll-system-test.js

# Run with custom log level
k6 run --log-level debug k6-wordcloud-focused-test.js
```

### Debugging Failed Tests
```bash
# Run single VU for debugging
k6 run --vus 1 --iterations 1 k6-authentication-test.js

# Run with detailed output
k6 run --verbose --log-level debug k6-poll-system-test.js
```

### Common Issues and Solutions

#### 1. Authentication Errors (401)
- **Cause**: Survey-results pages require authentication
- **Solution**: This is expected behavior for unauthenticated requests
- **Verification**: Check that CEW pages work with authCode

#### 2. Wordcloud Submission Failures
- **Cause**: Word validation or database issues
- **Solution**: Check word length limits (20 chars) and count limits (1-3 words)
- **Debug**: Enable verbose logging to see exact error messages

#### 3. High Response Times
- **Cause**: Database performance or network issues
- **Solution**: Check database performance, consider scaling
- **Monitoring**: Use k6's built-in metrics to identify bottlenecks

#### 4. Rate Limiting
- **Cause**: Too many concurrent requests
- **Solution**: Reduce VU count or add delays between requests
- **Adjustment**: Modify sleep() durations in test scripts

## 📊 Test Results Analysis

### Key Metrics to Monitor
1. **Response Time**
   - Average response time
   - 95th percentile response time
   - Maximum response time

2. **Success Rates**
   - Poll submission success rate
   - API response success rate
   - Overall test success rate

3. **Error Analysis**
   - HTTP error codes distribution
   - Failed request patterns
   - Authentication vs. system errors

### Sample Output
```json
{
  "timestamp": "2025-01-20T12:00:00.000Z",
  "test_duration": 360000,
  "total_requests": 1500,
  "failed_requests": 15,
  "avg_response_time": 245,
  "p95_response_time": 1200,
  "poll_submission_success_rate": 0.98,
  "wordcloud_submission_success_rate": 0.97,
  "api_response_success_rate": 0.99
}
```

## 🛠️ Customization

### Adding New Test Scenarios
1. **New Poll Types**: Add to test data arrays
2. **New Pages**: Add to page selection logic
3. **New Authentication**: Add to auth test scenarios

### Modifying Test Data
```javascript
// Add new test words
const NEW_WORDS = ['innovation', 'technology', 'efficiency'];

// Add new poll questions
const NEW_POLL = {
  pagePath: '/survey-results/new-page',
  pollIndex: 0,
  question: 'New test question',
  options: ['Option 1', 'Option 2', 'Option 3']
};
```

### Performance Tuning
```javascript
// Adjust load pattern
export const options = {
  stages: [
    { duration: '1m', target: 100 }, // Faster ramp up
    { duration: '5m', target: 100 }, // Longer sustained load
    { duration: '1m', target: 0 },   // Faster ramp down
  ],
};
```

## 📝 Best Practices

1. **Start Small**: Begin with low VU counts and short durations
2. **Monitor Resources**: Watch CPU, memory, and database performance
3. **Test Incrementally**: Run individual test scripts before comprehensive tests
4. **Validate Fixes**: Use authentication test after making auth changes
5. **Document Results**: Save test results for comparison and analysis
6. **Regular Testing**: Run tests regularly to catch performance regressions

## 🚨 Important Notes

- **Production Testing**: Be cautious when testing against production
- **Database Impact**: Tests will create actual poll data in the database
- **Rate Limiting**: Respect API rate limits and server capacity
- **Cleanup**: Consider cleaning up test data after testing
- **Monitoring**: Monitor application performance during tests

This testing suite provides comprehensive coverage of the poll system and helps ensure reliability and performance under load.
