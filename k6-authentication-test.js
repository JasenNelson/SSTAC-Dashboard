import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

// Custom metrics
const authTestRate = new Rate('authentication_tests_successful');
const apiResponseRate = new Rate('api_responses_successful');

// Test configuration
export const options = {
  stages: [
    { duration: '30s', target: 5 },  // Ramp up to 5 users
    { duration: '2m', target: 10 },  // Stay at 10 users
    { duration: '30s', target: 0 },  // Ramp down to 0 users
  ],
  thresholds: {
    http_req_duration: ['p(95)<2000'], // 95% of requests must complete below 2s
    http_req_failed: ['rate<0.1'],     // Error rate must be below 10%
    authentication_tests_successful: ['rate>0.95'], // 95% of auth tests must succeed
  },
};

// Base URLs
const BASE_URL = __ENV.BASE_URL || 'https://sstac-dashboard.vercel.app';

// Test scenarios for authentication
const AUTH_TEST_SCENARIOS = [
  // Survey-results pages (require full Supabase authentication - should fail without login)
  {
    name: 'Survey Results - Single Choice Poll',
    pagePath: '/survey-results/prioritization',
    pollIndex: 0,
    question: 'Test question for authentication',
    options: ['Option 1', 'Option 2', 'Option 3', 'Option 4', 'Option 5'],
    pollType: 'single-choice',
    authCode: null, // No authCode = should require full authentication
    expectSuccess: false // Should fail without proper authentication
  },
  {
    name: 'Survey Results - Ranking Poll',
    pagePath: '/survey-results/prioritization',
    pollIndex: 10,
    question: 'Test ranking question for authentication',
    options: ['Option A', 'Option B', 'Option C', 'Option D'],
    pollType: 'ranking',
    authCode: null,
    expectSuccess: false
  },
  {
    name: 'Survey Results - Wordcloud Poll',
    pagePath: '/survey-results/prioritization',
    pollIndex: 12,
    question: 'Test wordcloud question for authentication',
    words: ['test', 'word', 'cloud'],
    pollType: 'wordcloud',
    authCode: null,
    expectSuccess: false
  },
  // CEW pages (should work with authCode)
  {
    name: 'CEW Polls - Single Choice Poll',
    pagePath: '/cew-polls/prioritization',
    pollIndex: 0,
    question: 'Test question for CEW authentication',
    options: ['Option 1', 'Option 2', 'Option 3', 'Option 4', 'Option 5'],
    pollType: 'single-choice',
    authCode: 'CEW2025',
    expectSuccess: true
  },
  {
    name: 'CEW Polls - Ranking Poll',
    pagePath: '/cew-polls/prioritization',
    pollIndex: 10,
    question: 'Test ranking question for CEW authentication',
    options: ['Option A', 'Option B', 'Option C', 'Option D'],
    pollType: 'ranking',
    authCode: 'CEW2025',
    expectSuccess: true
  },
  {
    name: 'CEW Polls - Wordcloud Poll',
    pagePath: '/cew-polls/prioritization',
    pollIndex: 12,
    question: 'Test wordcloud question for CEW authentication',
    words: ['test', 'word', 'cloud'],
    pollType: 'wordcloud',
    authCode: 'CEW2025',
    expectSuccess: true
  }
];

// Test single-choice poll submission
function testSingleChoicePoll(scenario) {
  const url = `${BASE_URL}/api/polls/submit`;
  const payload = {
    pagePath: scenario.pagePath,
    pollIndex: scenario.pollIndex,
    question: scenario.question,
    options: scenario.options,
    optionIndex: 0,
    authCode: scenario.authCode
  };

  const response = http.post(url, JSON.stringify(payload), {
    headers: { 'Content-Type': 'application/json' },
  });

  const success = check(response, {
    [`${scenario.name} - correct status`]: (r) => 
      scenario.expectSuccess ? r.status === 200 : r.status === 401,
    [`${scenario.name} - response time < 2s`]: (r) => r.timings.duration < 2000,
  });

  authTestRate.add(success);
  apiResponseRate.add(success);
  
  console.log(`${scenario.name}: ${response.status} - ${success ? 'PASS' : 'FAIL'}`);
  return success;
}

// Test ranking poll submission
function testRankingPoll(scenario) {
  const url = `${BASE_URL}/api/ranking-polls/submit`;
  const ranking = [0, 1, 2, 3]; // Simple ranking
  
  const payload = {
    pagePath: scenario.pagePath,
    pollIndex: scenario.pollIndex,
    question: scenario.question,
    options: scenario.options,
    ranking,
    authCode: scenario.authCode
  };

  const response = http.post(url, JSON.stringify(payload), {
    headers: { 'Content-Type': 'application/json' },
  });

  const success = check(response, {
    [`${scenario.name} - correct status`]: (r) => 
      scenario.expectSuccess ? r.status === 200 : r.status === 401,
    [`${scenario.name} - response time < 2s`]: (r) => r.timings.duration < 2000,
  });

  authTestRate.add(success);
  apiResponseRate.add(success);
  
  console.log(`${scenario.name}: ${response.status} - ${success ? 'PASS' : 'FAIL'}`);
  return success;
}

// Test wordcloud poll submission
function testWordcloudPoll(scenario) {
  const url = `${BASE_URL}/api/wordcloud-polls/submit`;
  
  const payload = {
    pagePath: scenario.pagePath,
    pollIndex: scenario.pollIndex,
    question: scenario.question,
    maxWords: 3,
    wordLimit: 20,
    words: scenario.words,
    authCode: scenario.authCode
  };

  const response = http.post(url, JSON.stringify(payload), {
    headers: { 'Content-Type': 'application/json' },
  });

  const success = check(response, {
    [`${scenario.name} - correct status`]: (r) => 
      scenario.expectSuccess ? r.status === 200 : r.status === 401,
    [`${scenario.name} - response time < 2s`]: (r) => r.timings.duration < 2000,
  });

  authTestRate.add(success);
  apiResponseRate.add(success);
  
  console.log(`${scenario.name}: ${response.status} - ${success ? 'PASS' : 'FAIL'}`);
  return success;
}

// Test results fetching (should work for both authenticated and CEW)
function testResultsFetching(scenario) {
  const resultsUrl = `${BASE_URL}/api/${scenario.pollType}/results`;
  const params = {
    pagePath: scenario.pagePath,
    pollIndex: scenario.pollIndex.toString(),
    ...(scenario.authCode && { authCode: scenario.authCode })
  };

  const response = http.get(resultsUrl, { params });

  const success = check(response, {
    [`${scenario.name} - results fetch`]: (r) => r.status === 200,
    [`${scenario.name} - results response time < 1s`]: (r) => r.timings.duration < 1000,
  });

  apiResponseRate.add(success);
  return success;
}

// Main test function
export default function () {
  console.log('Starting authentication tests...');
  
  // Test each scenario
  for (const scenario of AUTH_TEST_SCENARIOS) {
    console.log(`\nTesting: ${scenario.name}`);
    
    // Test submission based on poll type
    let submissionSuccess = false;
    if (scenario.pollType === 'single-choice') {
      submissionSuccess = testSingleChoicePoll(scenario);
    } else if (scenario.pollType === 'ranking') {
      submissionSuccess = testRankingPoll(scenario);
    } else if (scenario.pollType === 'wordcloud') {
      submissionSuccess = testWordcloudPoll(scenario);
    }
    
    // Test results fetching (should work for both auth modes)
    if (submissionSuccess || scenario.expectSuccess) {
      sleep(0.5);
      testResultsFetching(scenario);
    }
    
    sleep(1);
  }
  
  console.log('\nAuthentication tests completed.');
}

// Test summary
export function handleSummary(data) {
  return {
    'authentication-test-results.json': JSON.stringify({
      timestamp: new Date().toISOString(),
      test_duration: data.state.testRunDurationMs,
      total_requests: data.metrics.http_reqs.values.count,
      failed_requests: data.metrics.http_req_failed.values.count,
      avg_response_time: data.metrics.http_req_duration.values.avg,
      p95_response_time: data.metrics.http_req_duration.values['p(95)'],
      authentication_test_success_rate: data.metrics.authentication_tests_successful.values.rate,
      api_response_success_rate: data.metrics.api_responses_successful.values.rate,
      thresholds: {
        response_time_p95: data.thresholds['http_req_duration'],
        error_rate: data.thresholds['http_req_failed'],
        auth_test_success_rate: data.thresholds['authentication_tests_successful'],
      }
    }, null, 2),
  };
}
