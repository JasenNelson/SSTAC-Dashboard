// K6 Matrix Graph Comprehensive Testing - Vote Pairing Validation
// Run with: k6 run k6-matrix-graph-comprehensive.js

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// Custom metrics
export let errorRate = new Rate('errors');
export let matrixGraphTime = new Trend('matrix_graph_time');
export let votePairingSuccess = new Counter('vote_pairing_success');
export let votePairingFailure = new Counter('vote_pairing_failure');
export let dataPointCount = new Counter('data_point_count');

// Test configuration
export let options = {
  stages: [
    { duration: '1m', target: 5 },    // Ramp up to 5 users
    { duration: '3m', target: 5 },    // Stay at 5 users
    { duration: '1m', target: 10 },   // Ramp up to 10 users
    { duration: '3m', target: 10 },   // Stay at 10 users
    { duration: '1m', target: 0 },    // Ramp down to 0 users
  ],
  thresholds: {
    http_req_duration: ['p(95)<5000'],  // More realistic for complex matrix queries
    errors: ['rate<0.05'],
    matrix_graph_time: ['p(95)<5000'],  // Matrix graph queries can take 3-5 seconds
    vote_pairing_success: ['count>0'],
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

function submitVotePair(pagePath, importanceIndex, feasibilityIndex, userType = 'cew') {
  const userId = generateUserId(userType);
  const sessionId = generateSessionId();
  
  // Submit importance vote
  const importancePayload = {
    pagePath,
    pollIndex: importanceIndex,
    question: `Test importance question ${importanceIndex}`,
    options: ['Very Important', 'Important', 'Neutral', 'Less Important', 'Not Important'],
    optionIndex: Math.floor(Math.random() * 5),
    authCode: userType === 'cew' ? CEW_CODE : null
  };

  const headers = {
    'Content-Type': 'application/json',
    'x-session-id': sessionId
  };

  const importanceResponse = http.post(`${BASE_URL}/api/polls/submit`, JSON.stringify(importancePayload), { headers });
  
  // Wait a moment to ensure different timestamps
  sleep(0.1);
  
  // Submit feasibility vote
  const feasibilityPayload = {
    pagePath,
    pollIndex: feasibilityIndex,
    question: `Test feasibility question ${feasibilityIndex}`,
    options: ['Very Feasible', 'Feasible', 'Neutral', 'Less Feasible', 'Not Feasible'],
    optionIndex: Math.floor(Math.random() * 5),
    authCode: userType === 'cew' ? CEW_CODE : null
  };

  const feasibilityResponse = http.post(`${BASE_URL}/api/polls/submit`, JSON.stringify(feasibilityPayload), { headers });

  return {
    userId,
    sessionId,
    importanceSuccess: importanceResponse.status === 200,
    feasibilitySuccess: feasibilityResponse.status === 200,
    bothSuccess: importanceResponse.status === 200 && feasibilityResponse.status === 200
  };
}

function testMatrixGraphAPI(filter = 'all', expectedMinPairs = 0) {
  const startTime = Date.now();
  const response = http.get(`${BASE_URL}/api/graphs/prioritization-matrix?filter=${filter}`);
  const endTime = Date.now();

  matrixGraphTime.add(endTime - startTime);
  errorRate.add(response.status !== 200);

  let dataPoints = 0;
  let hasValidData = false;

  if (response.status === 200) {
    try {
      const data = JSON.parse(response.body);
      console.log(`🔍 Matrix API Response Debug:`, {
        status: response.status,
        bodyKeys: Object.keys(data),
        hasData: Array.isArray(data) && data.length > 0,
        firstItem: data[0] ? Object.keys(data[0]) : 'No items'
      });
      
      // The API returns an array of matrix graph data directly
      if (Array.isArray(data) && data.length > 0) {
        hasValidData = true;
        
        // Count total data points across all matrix graphs
        data.forEach(matrixData => {
          if (matrixData.individualPairs && Array.isArray(matrixData.individualPairs)) {
            dataPoints += matrixData.individualPairs.length;
          }
        });
        
        console.log(`📊 Found ${dataPoints} data points across ${data.length} matrix graphs`);
        
        dataPointCount.add(dataPoints);
        
        if (dataPoints >= expectedMinPairs) {
          votePairingSuccess.add(1);
          console.log(`✅ Matrix graph pairing successful with ${dataPoints} data points`);
        } else {
          votePairingFailure.add(1);
          console.log(`❌ Matrix graph pairing failed - only ${dataPoints} data points, expected ${expectedMinPairs}`);
        }
      } else {
        console.log(`❌ No matrix graph data found - array length: ${Array.isArray(data) ? data.length : 'not array'}`);
        votePairingFailure.add(1);
      }
    } catch (e) {
      console.error(`Error parsing matrix graph response: ${e.message}`);
      console.error(`Response body: ${response.body}`);
      votePairingFailure.add(1);
    }
  } else {
    console.error(`Matrix API failed with status: ${response.status}`);
    console.error(`Response body: ${response.body}`);
    votePairingFailure.add(1);
  }

  return {
    success: check(response, {
      'matrix graph API successful': (r) => r.status === 200,
      'response time < 5000ms': (r) => r.timings.duration < 5000,  // More realistic threshold
      'response has valid data': () => hasValidData,
      'data points >= expected': () => dataPoints >= expectedMinPairs,
    }),
    dataPoints,
    response
  };
}

function testQuestionPair(pagePath, importanceIndex, feasibilityIndex, userType = 'cew') {
  console.log(`Testing ${userType} user for ${pagePath} Q${importanceIndex + 1}+Q${feasibilityIndex + 1}`);
  
  // Get baseline data point count BEFORE submitting votes
  const baselineResult = testMatrixGraphAPI('all', 0);
  const baselineDataPoints = baselineResult.dataPoints;
  console.log(`📊 Baseline data points: ${baselineDataPoints}`);
  
  // Submit vote pair
  const voteResult = submitVotePair(pagePath, importanceIndex, feasibilityIndex, userType);
  
  if (!voteResult.bothSuccess) {
    console.error(`❌ Vote submission failed for ${userType} user`);
    return false;
  }

  console.log(`✅ Vote pair submitted successfully for ${userType} user`);

  // Wait for data to be processed
  sleep(2);

  // Test matrix graph API and check for NEW data points
  const matrixResult = testMatrixGraphAPI('all', baselineDataPoints);
  const newDataPoints = matrixResult.dataPoints - baselineDataPoints;
  
  if (matrixResult.success && newDataPoints > 0) {
    console.log(`✅ Matrix graph API successful with ${matrixResult.dataPoints} total data points (+${newDataPoints} new)`);
    return true;
  } else if (matrixResult.success && newDataPoints === 0) {
    console.log(`⚠️ Matrix graph API working but no new data points created (${matrixResult.dataPoints} total)`);
    return false;
  } else {
    console.error(`❌ Matrix graph API failed`);
    return false;
  }
}

// Main test scenarios
export default function() {
  const userType = Math.random() < 0.6 ? 'cew' : 'authenticated';
  const testScenario = Math.floor(Math.random() * 4);
  
  console.log(`\n🧪 Starting test scenario ${testScenario + 1} for ${userType} user (VU: ${__VU})`);

  switch (testScenario) {
    case 0:
      // Test Holistic Protection Q1+Q2 (Matrix Standards - Ecosystem Health)
      // These are the actual paired questions for matrix graphs
      testQuestionPair('/cew-polls/holistic-protection', 0, 1, userType);
      break;
      
    case 1:
      // Test Holistic Protection Q3+Q4 (Matrix Standards - Human Health)
      testQuestionPair('/cew-polls/holistic-protection', 2, 3, userType);
      break;
      
    case 2:
      // Test Prioritization Q1+Q2 (Site-Specific Standards)
      testQuestionPair('/cew-polls/prioritization', 0, 1, userType);
      break;
      
    case 3:
      // Test CEW multiple votes (simulate page refresh for multiple data points)
      if (userType === 'cew') {
        console.log('🔄 Testing CEW multiple vote sessions for matrix graph data points');
        
        // Submit multiple vote pairs to create multiple data points
        testQuestionPair('/cew-polls/holistic-protection', 0, 1, 'cew');
        sleep(1);
        
        // Second session (different session ID = different data point)
        testQuestionPair('/cew-polls/holistic-protection', 0, 1, 'cew');
        sleep(1);
        
        // Third session
        testQuestionPair('/cew-polls/prioritization', 0, 1, 'cew');
      } else {
        // Test authenticated user (single vote per question)
        testQuestionPair('/survey-results/holistic-protection', 0, 1, 'authenticated');
      }
      break;
  }

  // Test all filter modes
  console.log('🔍 Testing all filter modes...');
  
  const allFilterResult = testMatrixGraphAPI('all', 0);
  if (allFilterResult.success) {
    console.log(`✅ All filter: ${allFilterResult.dataPoints} data points`);
  }

  const cewFilterResult = testMatrixGraphAPI('cew', 0);
  if (cewFilterResult.success) {
    console.log(`✅ CEW filter: ${cewFilterResult.dataPoints} data points`);
  }

  const twgFilterResult = testMatrixGraphAPI('twg', 0);
  if (twgFilterResult.success) {
    console.log(`✅ TWG filter: ${twgFilterResult.dataPoints} data points`);
  }

  // Wait between test iterations
  sleep(2);
}

// Test summary
export function handleSummary(data) {
  const summary = {
    timestamp: new Date().toISOString(),
    test_duration: data.state.testRunDurationMs,
    total_requests: data.metrics.http_reqs?.values?.count || 0,
    error_rate: data.metrics.errors?.values?.rate || 0,
    avg_response_time: data.metrics.http_req_duration?.values?.avg || 0,
    p95_response_time: data.metrics.http_req_duration?.values?.['p(95)'] || 0,
    matrix_graph_avg: data.metrics.matrix_graph_time?.values?.avg || 0,
    vote_pairing_success: data.metrics.vote_pairing_success?.values?.count || 0,
    vote_pairing_failure: data.metrics.vote_pairing_failure?.values?.count || 0,
    total_data_points: data.metrics.data_point_count?.values?.count || 0,
    thresholds: {
      response_time_p95: data.thresholds?.http_req_duration?.p95 || 'N/A',
      error_rate: data.thresholds?.errors?.rate || 'N/A',
      matrix_graph_p95: data.thresholds?.matrix_graph_time?.p95 || 'N/A',
    }
  };

  console.log('\n📊 Test Summary:');
  console.log(`   Duration: ${Math.round(summary.test_duration / 1000)}s`);
  console.log(`   Total Requests: ${summary.total_requests}`);
  console.log(`   Error Rate: ${(summary.error_rate * 100).toFixed(2)}%`);
  console.log(`   Avg Response Time: ${summary.avg_response_time.toFixed(2)}ms`);
  console.log(`   P95 Response Time: ${summary.p95_response_time.toFixed(2)}ms`);
  console.log(`   Vote Pairing Success: ${summary.vote_pairing_success}`);
  console.log(`   Vote Pairing Failure: ${summary.vote_pairing_failure}`);
  console.log(`   Total Data Points: ${summary.total_data_points}`);

  return {
    'matrix-graph-test-summary.json': JSON.stringify(summary, null, 2),
  };
}
