// K6 Comprehensive Test Suite - SSTAC & TWG Dashboard Polling System
// Run with: k6 run k6-comprehensive-suite.js

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Custom metrics
export let errorRate = new Rate('errors');
export let pollSubmissionTime = new Trend('poll_submission_time');
export let matrixGraphTime = new Trend('matrix_graph_time');
export let adminLoadTime = new Trend('admin_load_time');

// Test configuration
export let options = {
  stages: [
    { duration: '2m', target: 10 },   // Ramp up to 10 users
    { duration: '5m', target: 10 },   // Stay at 10 users
    { duration: '2m', target: 20 },   // Ramp up to 20 users
    { duration: '5m', target: 20 },   // Stay at 20 users
    { duration: '2m', target: 0 },    // Ramp down to 0 users
  ],
  thresholds: {
    http_req_duration: ['p(95)<1000'], // 95% of requests must complete below 1s
    errors: ['rate<0.1'],              // Error rate must be below 10%
    poll_submission_time: ['p(95)<500'], // Poll submissions under 500ms
    matrix_graph_time: ['p(95)<1000'],   // Matrix graph API under 1s
  },
};

// Base URL configuration
const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

// Test data
const CEW_CODE = 'CEW2025';
const TEST_QUESTIONS = {
  holistic: {
    singleChoice: [0, 2, 4, 6], // Q1, Q3, Q5, Q7
    ranking: [1, 3, 5, 7],      // Q2, Q4, Q6, Q8
  },
  prioritization: {
    singleChoice: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], // Q1-Q10
    ranking: [10, 11],                              // Q11-Q12
    wordcloud: [12],                                // Q13
  },
  tiered: {
    singleChoice: [0], // Q1
    ranking: [1],      // Q2
  }
};

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

function submitSingleChoiceVote(pagePath, pollIndex, optionIndex, userType = 'cew') {
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

  return {
    success: check(response, {
      'poll submission successful': (r) => r.status === 200,
      'response time < 500ms': (r) => r.timings.duration < 500,
    }),
    userId,
    response
  };
}

function submitRankingVote(pagePath, pollIndex, rankings, userType = 'cew') {
  const userId = generateUserId(userType);
  const sessionId = generateSessionId();
  
  const payload = {
    pagePath,
    pollIndex,
    question: `Test ranking question ${pollIndex}`,
    options: ['Option 1', 'Option 2', 'Option 3', 'Option 4'],
    rankings,
    authCode: userType === 'cew' ? CEW_CODE : null
  };

  const headers = {
    'Content-Type': 'application/json',
    'x-session-id': sessionId
  };

  const startTime = Date.now();
  const response = http.post(`${BASE_URL}/api/ranking-polls/submit`, JSON.stringify(payload), { headers });
  const endTime = Date.now();

  pollSubmissionTime.add(endTime - startTime);
  errorRate.add(response.status !== 200);

  return {
    success: check(response, {
      'ranking submission successful': (r) => r.status === 200,
      'response time < 500ms': (r) => r.timings.duration < 500,
    }),
    userId,
    response
  };
}

function submitWordcloudVote(pagePath, pollIndex, words, userType = 'cew') {
  const userId = generateUserId(userType);
  const sessionId = generateSessionId();
  
  const payload = {
    pagePath,
    pollIndex,
    question: `Test wordcloud question ${pollIndex}`,
    words,
    authCode: userType === 'cew' ? CEW_CODE : null
  };

  const headers = {
    'Content-Type': 'application/json',
    'x-session-id': sessionId
  };

  const startTime = Date.now();
  const response = http.post(`${BASE_URL}/api/wordcloud-polls/submit`, JSON.stringify(payload), { headers });
  const endTime = Date.now();

  pollSubmissionTime.add(endTime - startTime);
  errorRate.add(response.status !== 200);

  return {
    success: check(response, {
      'wordcloud submission successful': (r) => r.status === 200,
      'response time < 500ms': (r) => r.timings.duration < 500,
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
      'response time < 1000ms': (r) => r.timings.duration < 1000,
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
      'response time < 2000ms': (r) => r.timings.duration < 2000,
    }),
    response
  };
}

// Main test scenarios
export default function() {
  const userType = Math.random() < 0.7 ? 'cew' : 'authenticated';
  
  // Test 1: CEW Poll System Testing
  if (userType === 'cew') {
    console.log(`Testing CEW user: ${__VU}`);
    
    // Test holistic protection polls
    TEST_QUESTIONS.holistic.singleChoice.forEach(pollIndex => {
      const optionIndex = Math.floor(Math.random() * 5);
      const result = submitSingleChoiceVote('/cew-polls/holistic-protection', pollIndex, optionIndex, 'cew');
      if (result.success) {
        console.log(`✅ CEW holistic single-choice poll ${pollIndex} submitted successfully`);
      }
    });

    TEST_QUESTIONS.holistic.ranking.forEach(pollIndex => {
      const rankings = [1, 2, 3, 4].sort(() => Math.random() - 0.5);
      const result = submitRankingVote('/cew-polls/holistic-protection', pollIndex, rankings, 'cew');
      if (result.success) {
        console.log(`✅ CEW holistic ranking poll ${pollIndex} submitted successfully`);
      }
    });

    // Test prioritization polls
    TEST_QUESTIONS.prioritization.singleChoice.forEach(pollIndex => {
      const optionIndex = Math.floor(Math.random() * 5);
      const result = submitSingleChoiceVote('/cew-polls/prioritization', pollIndex, optionIndex, 'cew');
      if (result.success) {
        console.log(`✅ CEW prioritization single-choice poll ${pollIndex} submitted successfully`);
      }
    });

    TEST_QUESTIONS.prioritization.ranking.forEach(pollIndex => {
      const rankings = [1, 2, 3, 4].sort(() => Math.random() - 0.5);
      const result = submitRankingVote('/cew-polls/prioritization', pollIndex, rankings, 'cew');
      if (result.success) {
        console.log(`✅ CEW prioritization ranking poll ${pollIndex} submitted successfully`);
      }
    });

    // Test wordcloud poll
    TEST_QUESTIONS.prioritization.wordcloud.forEach(pollIndex => {
      const words = ['test', 'word', 'cloud'];
      const result = submitWordcloudVote('/cew-polls/prioritization', pollIndex, words, 'cew');
      if (result.success) {
        console.log(`✅ CEW prioritization wordcloud poll ${pollIndex} submitted successfully`);
      }
    });

    // Test tiered framework polls
    TEST_QUESTIONS.tiered.singleChoice.forEach(pollIndex => {
      const optionIndex = Math.floor(Math.random() * 5);
      const result = submitSingleChoiceVote('/cew-polls/tiered-framework', pollIndex, optionIndex, 'cew');
      if (result.success) {
        console.log(`✅ CEW tiered single-choice poll ${pollIndex} submitted successfully`);
      }
    });

    TEST_QUESTIONS.tiered.ranking.forEach(pollIndex => {
      const rankings = [1, 2, 3, 4].sort(() => Math.random() - 0.5);
      const result = submitRankingVote('/cew-polls/tiered-framework', pollIndex, rankings, 'cew');
      if (result.success) {
        console.log(`✅ CEW tiered ranking poll ${pollIndex} submitted successfully`);
      }
    });
  }

  // Test 2: Authenticated User Testing
  if (userType === 'authenticated') {
    console.log(`Testing authenticated user: ${__VU}`);
    
    // Test survey results polls (simulated authenticated user)
    TEST_QUESTIONS.holistic.singleChoice.forEach(pollIndex => {
      const optionIndex = Math.floor(Math.random() * 5);
      const result = submitSingleChoiceVote('/survey-results/holistic-protection', pollIndex, optionIndex, 'authenticated');
      if (result.success) {
        console.log(`✅ Authenticated holistic single-choice poll ${pollIndex} submitted successfully`);
      }
    });

    TEST_QUESTIONS.prioritization.singleChoice.forEach(pollIndex => {
      const optionIndex = Math.floor(Math.random() * 5);
      const result = submitSingleChoiceVote('/survey-results/prioritization', pollIndex, optionIndex, 'authenticated');
      if (result.success) {
        console.log(`✅ Authenticated prioritization single-choice poll ${pollIndex} submitted successfully`);
      }
    });
  }

  // Test 3: Matrix Graph System Testing
  const matrixResult = testMatrixGraphAPI('all');
  if (matrixResult.success) {
    console.log(`✅ Matrix graph API (all) successful`);
  }

  const matrixResultCEW = testMatrixGraphAPI('cew');
  if (matrixResultCEW.success) {
    console.log(`✅ Matrix graph API (cew) successful`);
  }

  const matrixResultTWG = testMatrixGraphAPI('twg');
  if (matrixResultTWG.success) {
    console.log(`✅ Matrix graph API (twg) successful`);
  }

  // Test 4: Admin Interface Testing
  const adminResult = testAdminInterface();
  if (adminResult.success) {
    console.log(`✅ Admin interface loads successfully`);
  }

  // Test 5: API Endpoint Testing
  const pollResultsResponse = http.get(`${BASE_URL}/api/polls/results`);
  check(pollResultsResponse, {
    'poll results API successful': (r) => r.status === 200,
  });

  const rankingResultsResponse = http.get(`${BASE_URL}/api/ranking-polls/results`);
  check(rankingResultsResponse, {
    'ranking results API successful': (r) => r.status === 200,
  });

  const wordcloudResultsResponse = http.get(`${BASE_URL}/api/wordcloud-polls/results`);
  check(wordcloudResultsResponse, {
    'wordcloud results API successful': (r) => r.status === 200,
  });

  // Wait between requests
  sleep(1);
}

// Test summary
export function handleSummary(data) {
  return {
    'test-summary.json': JSON.stringify({
      timestamp: new Date().toISOString(),
      test_duration: data.state.testRunDurationMs,
      total_requests: data.metrics.http_reqs.values.count,
      error_rate: data.metrics.errors.values.rate,
      avg_response_time: data.metrics.http_req_duration.values.avg,
      p95_response_time: data.metrics.http_req_duration.values['p(95)'],
      poll_submission_avg: data.metrics.poll_submission_time.values.avg,
      matrix_graph_avg: data.metrics.matrix_graph_time.values.avg,
      admin_load_avg: data.metrics.admin_load_time.values.avg,
      thresholds: {
        response_time_p95: data.thresholds.http_req_duration.p95,
        error_rate: data.thresholds.errors.rate,
        poll_submission_p95: data.thresholds.poll_submission_time.p95,
        matrix_graph_p95: data.thresholds.matrix_graph_time.p95,
      }
    }, null, 2),
  };
}
