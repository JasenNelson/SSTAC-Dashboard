// K6 Performance and Load Testing - SSTAC & TWG Dashboard
// Run with: k6 run k6-performance-load.js

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// Custom metrics
export let errorRate = new Rate('errors');
export let pollSubmissionTime = new Trend('poll_submission_time');
export let matrixGraphTime = new Trend('matrix_graph_time');
export let adminLoadTime = new Trend('admin_load_time');
export let concurrentUsers = new Counter('concurrent_users');
export let successfulSubmissions = new Counter('successful_submissions');
export let failedSubmissions = new Counter('failed_submissions');

// Test configuration
export let options = {
  stages: [
    { duration: '2m', target: 20 },   // Ramp up to 20 users
    { duration: '5m', target: 20 },   // Stay at 20 users
    { duration: '2m', target: 50 },   // Ramp up to 50 users
    { duration: '5m', target: 50 },   // Stay at 50 users
    { duration: '2m', target: 100 },  // Ramp up to 100 users
    { duration: '5m', target: 100 },  // Stay at 100 users
    { duration: '2m', target: 0 },    // Ramp down to 0 users
  ],
  thresholds: {
    http_req_duration: ['p(95)<2000'], // 95% of requests must complete below 2s
    errors: ['rate<0.05'],             // Error rate must be below 5%
    poll_submission_time: ['p(95)<1000'], // Poll submissions under 1s
    matrix_graph_time: ['p(95)<2000'],    // Matrix graph API under 2s
    admin_load_time: ['p(95)<3000'],      // Admin interface under 3s
  },
};

// Base URL configuration
const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const CEW_CODE = 'CEW2025';

// Helper functions
function generateSessionId() {
  return `session_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
}

function generateUserId(userType = 'cew') {
  if (userType === 'cew') {
    return `${CEW_CODE}_${generateSessionId()}`;
  }
  return `test_user_${Math.random().toString(36).substring(2, 8)}`;
}

function submitPollVote(pagePath, pollIndex, optionIndex, userType = 'cew') {
  const userId = generateUserId(userType);
  const sessionId = generateSessionId();
  
  const payload = {
    pagePath,
    pollIndex,
    question: `Test question ${pollIndex}`,
    options: ['Option 1', 'Option 2', 'Option 3', 'Option 4', 'Option 5'],
    optionIndex,
    authCode: userType === 'cew' ? CEW_CODE : null
  };

  const headers = {
    'Content-Type': 'application/json',
    'x-session-id': sessionId
  };

  const startTime = Date.now();
  const response = http.post(`${BASE_URL}/api/polls/submit`, JSON.stringify(payload), { headers });
  const endTime = Date.now();

  pollSubmissionTime.add(endTime - startTime);
  errorRate.add(response.status !== 200);

  const success = response.status === 200;
  if (success) {
    successfulSubmissions.add(1);
  } else {
    failedSubmissions.add(1);
  }

  return {
    success: check(response, {
      'poll submission successful': (r) => r.status === 200,
      'response time < 1000ms': (r) => r.timings.duration < 1000,
    }),
    userId,
    response
  };
}

function testMatrixGraphAPI(filter = 'all') {
  const startTime = Date.now();
  const response = http.get(`${BASE_URL}/api/graphs/prioritization-matrix?filter=${filter}`);
  const endTime = Date.now();

  matrixGraphTime.add(endTime - startTime);
  errorRate.add(response.status !== 200);

  return {
    success: check(response, {
      'matrix graph API successful': (r) => r.status === 200,
      'response time < 2000ms': (r) => r.timings.duration < 2000,
      'response has data': (r) => {
        try {
          const data = JSON.parse(r.body);
          return data.success === true && Array.isArray(data.data);
        } catch (e) {
          return false;
        }
      }
    }),
    response
  };
}

function testAdminInterface() {
  const startTime = Date.now();
  const response = http.get(`${BASE_URL}/admin/poll-results`);
  const endTime = Date.now();

  adminLoadTime.add(endTime - startTime);
  errorRate.add(response.status !== 200);

  return {
    success: check(response, {
      'admin interface loads': (r) => r.status === 200,
      'response time < 3000ms': (r) => r.timings.duration < 3000,
    }),
    response
  };
}

function testPollResultsAPI() {
  const response = http.get(`${BASE_URL}/api/polls/results`);
  errorRate.add(response.status !== 200);

  return check(response, {
    'poll results API successful': (r) => r.status === 200,
    'response time < 1000ms': (r) => r.timings.duration < 1000,
  });
}

function testRankingResultsAPI() {
  const response = http.get(`${BASE_URL}/api/ranking-polls/results`);
  errorRate.add(response.status !== 200);

  return check(response, {
    'ranking results API successful': (r) => r.status === 200,
    'response time < 1000ms': (r) => r.timings.duration < 1000,
  });
}

function testWordcloudResultsAPI() {
  const response = http.get(`${BASE_URL}/api/wordcloud-polls/results`);
  errorRate.add(response.status !== 200);

  return check(response, {
    'wordcloud results API successful': (r) => r.status === 200,
    'response time < 1000ms': (r) => r.timings.duration < 1000,
  });
}

// Main test scenarios
export default function() {
  const userType = Math.random() < 0.7 ? 'cew' : 'authenticated';
  const testType = Math.floor(Math.random() * 5);
  
  concurrentUsers.add(1);

  switch (testType) {
    case 0:
      // High-frequency poll submissions
      for (let i = 0; i < 3; i++) {
        const pollIndex = Math.floor(Math.random() * 10);
        const optionIndex = Math.floor(Math.random() * 5);
        const pagePath = userType === 'cew' ? '/cew-polls/prioritization' : '/survey-results/prioritization';
        
        const result = submitPollVote(pagePath, pollIndex, optionIndex, userType);
        if (result.success) {
          console.log(`✅ Poll submission ${i + 1} successful`);
        }
        sleep(0.5);
      }
      break;

    case 1:
      // Matrix graph API testing
      const matrixResult = testMatrixGraphAPI('all');
      if (matrixResult.success) {
        console.log(`✅ Matrix graph API successful`);
      }
      break;

    case 2:
      // Admin interface testing
      const adminResult = testAdminInterface();
      if (adminResult.success) {
        console.log(`✅ Admin interface loads successfully`);
      }
      break;

    case 3:
      // Results API testing
      const pollResults = testPollResultsAPI();
      const rankingResults = testRankingResultsAPI();
      const wordcloudResults = testWordcloudResultsAPI();
      
      if (pollResults && rankingResults && wordcloudResults) {
        console.log(`✅ All results APIs successful`);
      }
      break;

    case 4:
      // Mixed workload testing
      const mixedResult1 = submitPollVote('/cew-polls/holistic-protection', 0, 2, 'cew');
      const mixedResult2 = testMatrixGraphAPI('cew');
      const mixedResult3 = testPollResultsAPI();
      
      if (mixedResult1.success && mixedResult2.success && mixedResult3) {
        console.log(`✅ Mixed workload successful`);
      }
      break;
  }

  // Random sleep to simulate real user behavior
  sleep(Math.random() * 2 + 0.5);
}

// Test summary
export function handleSummary(data) {
  const summary = {
    timestamp: new Date().toISOString(),
    test_duration: data.state.testRunDurationMs,
    total_requests: data.metrics.http_reqs.values.count,
    error_rate: data.metrics.errors.values.rate,
    avg_response_time: data.metrics.http_req_duration.values.avg,
    p95_response_time: data.metrics.http_req_duration.values['p(95)'],
    p99_response_time: data.metrics.http_req_duration.values['p(99)'],
    max_response_time: data.metrics.http_req_duration.values.max,
    poll_submission_avg: data.metrics.poll_submission_time.values.avg,
    poll_submission_p95: data.metrics.poll_submission_time.values['p(95)'],
    matrix_graph_avg: data.metrics.matrix_graph_time.values.avg,
    matrix_graph_p95: data.metrics.matrix_graph_time.values['p(95)'],
    admin_load_avg: data.metrics.admin_load_time.values.avg,
    admin_load_p95: data.metrics.admin_load_time.values['p(95)'],
    successful_submissions: data.metrics.successful_submissions.values.count,
    failed_submissions: data.metrics.failed_submissions.values.count,
    max_concurrent_users: data.metrics.concurrent_users.values.max,
    thresholds: {
      response_time_p95: data.thresholds.http_req_duration.p95,
      error_rate: data.thresholds.errors.rate,
      poll_submission_p95: data.thresholds.poll_submission_time.p95,
      matrix_graph_p95: data.thresholds.matrix_graph_time.p95,
      admin_load_p95: data.thresholds.admin_load_time.p95,
    }
  };

  console.log('\n📊 Performance Test Summary:');
  console.log(`   Duration: ${Math.round(summary.test_duration / 1000)}s`);
  console.log(`   Total Requests: ${summary.total_requests}`);
  console.log(`   Error Rate: ${(summary.error_rate * 100).toFixed(2)}%`);
  console.log(`   Avg Response Time: ${summary.avg_response_time.toFixed(2)}ms`);
  console.log(`   P95 Response Time: ${summary.p95_response_time.toFixed(2)}ms`);
  console.log(`   P99 Response Time: ${summary.p99_response_time.toFixed(2)}ms`);
  console.log(`   Max Response Time: ${summary.max_response_time.toFixed(2)}ms`);
  console.log(`   Successful Submissions: ${summary.successful_submissions}`);
  console.log(`   Failed Submissions: ${summary.failed_submissions}`);
  console.log(`   Max Concurrent Users: ${summary.max_concurrent_users}`);
  console.log(`   Poll Submission P95: ${summary.poll_submission_p95.toFixed(2)}ms`);
  console.log(`   Matrix Graph P95: ${summary.matrix_graph_p95.toFixed(2)}ms`);
  console.log(`   Admin Load P95: ${summary.admin_load_p95.toFixed(2)}ms`);

  // Performance analysis
  const performanceAnalysis = {
    overall_performance: summary.p95_response_time < 2000 ? 'EXCELLENT' : 
                        summary.p95_response_time < 3000 ? 'GOOD' : 'NEEDS_IMPROVEMENT',
    error_rate_analysis: summary.error_rate < 0.01 ? 'EXCELLENT' :
                        summary.error_rate < 0.05 ? 'GOOD' : 'NEEDS_IMPROVEMENT',
    poll_performance: summary.poll_submission_p95 < 500 ? 'EXCELLENT' :
                     summary.poll_submission_p95 < 1000 ? 'GOOD' : 'NEEDS_IMPROVEMENT',
    matrix_performance: summary.matrix_graph_p95 < 1000 ? 'EXCELLENT' :
                       summary.matrix_graph_p95 < 2000 ? 'GOOD' : 'NEEDS_IMPROVEMENT',
    admin_performance: summary.admin_load_p95 < 2000 ? 'EXCELLENT' :
                      summary.admin_load_p95 < 3000 ? 'GOOD' : 'NEEDS_IMPROVEMENT',
  };

  console.log('\n🎯 Performance Analysis:');
  console.log(`   Overall Performance: ${performanceAnalysis.overall_performance}`);
  console.log(`   Error Rate: ${performanceAnalysis.error_rate_analysis}`);
  console.log(`   Poll Submissions: ${performanceAnalysis.poll_performance}`);
  console.log(`   Matrix Graphs: ${performanceAnalysis.matrix_performance}`);
  console.log(`   Admin Interface: ${performanceAnalysis.admin_performance}`);

  return {
    'performance-test-summary.json': JSON.stringify({
      ...summary,
      performance_analysis: performanceAnalysis
    }, null, 2),
  };
}
