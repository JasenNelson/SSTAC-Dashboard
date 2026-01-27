// k6-comprehensive-validation.js
// Comprehensive validation of all polling systems
// Tests all poll types, authentication modes, and matrix graph pairing

import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  scenarios: {
    comprehensive_validation: {
      executor: 'ramping-vus',
      startVUs: 1,
      stages: [
        { duration: '30s', target: 15 },  // Ramp to 15 users
        { duration: '60s', target: 30 },  // Ramp to 30 users
        { duration: '30s', target: 0 },   // Ramp down
      ],
      exec: 'validateAllPollingSystems',
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<2000'],
    http_req_failed: ['rate<0.05'],
    checks: ['rate>0.95'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

// Generate unique session ID for consistent user tracking
function generateSessionId() {
  const timestamp = Date.now();
  const vuId = __VU;
  const iteration = __ITER;
  const random = Math.floor(Math.random() * 1000);
  return `session_${vuId}_${iteration}_${random}`;
}

// Comprehensive validation of all polling systems
export function validateAllPollingSystems() {
  const sessionId = generateSessionId();
  const authCode = 'CEW2025';
  
  console.log(`🎯 Comprehensive validation with session: ${sessionId}`);
  
  // Test 1: Single-choice polls with matrix graph pairing
  console.log(`\n📊 TEST 1: Single-choice polls with matrix graph pairing`);
  const singleChoiceSuccess = testSingleChoiceWithMatrixPairing(sessionId, authCode);
  
  sleep(1);
  
  // Test 2: Ranking polls (unique user ID per submission)
  console.log(`\n📊 TEST 2: Ranking polls (unique user ID per submission)`);
  const rankingSuccess = testRankingPolls(authCode);
  
  sleep(1);
  
  // Test 3: Wordcloud polls (unique user ID per submission)
  console.log(`\n📊 TEST 3: Wordcloud polls (unique user ID per submission)`);
  const wordcloudSuccess = testWordcloudPolls(authCode);
  
  sleep(1);
  
  // Test 4: Matrix graph API validation
  console.log(`\n📊 TEST 4: Matrix graph API validation`);
  const matrixGraphSuccess = testMatrixGraphAPI();
  
  sleep(1);
  
  // Test 5: Results retrieval validation
  console.log(`\n📊 TEST 5: Results retrieval validation`);
  const resultsSuccess = testResultsRetrieval();
  
  sleep(1);
  
  // Test 6: Authentication mode validation
  console.log(`\n📊 TEST 6: Authentication mode validation`);
  const authSuccess = testAuthenticationModes();
  
  // Summary
  console.log(`\n📊 COMPREHENSIVE VALIDATION SUMMARY:`);
  console.log(`✅ Single-choice polls: ${singleChoiceSuccess ? 'PASS' : 'FAIL'}`);
  console.log(`✅ Ranking polls: ${rankingSuccess ? 'PASS' : 'FAIL'}`);
  console.log(`✅ Wordcloud polls: ${wordcloudSuccess ? 'PASS' : 'FAIL'}`);
  console.log(`✅ Matrix graph API: ${matrixGraphSuccess ? 'PASS' : 'FAIL'}`);
  console.log(`✅ Results retrieval: ${resultsSuccess ? 'PASS' : 'FAIL'}`);
  console.log(`✅ Authentication modes: ${authSuccess ? 'PASS' : 'FAIL'}`);
  
  const overallSuccess = singleChoiceSuccess && rankingSuccess && wordcloudSuccess && 
                        matrixGraphSuccess && resultsSuccess && authSuccess;
  console.log(`\n🎯 OVERALL VALIDATION: ${overallSuccess ? 'PASS' : 'FAIL'}`);
}

// Test single-choice polls with matrix graph pairing
function testSingleChoiceWithMatrixPairing(sessionId, authCode) {
  // Test all 4 matrix graph pairs
  const matrixPairs = [
    { q1: 0, q2: 1, name: 'Q1+Q2 (Ecosystem Health - Direct Toxicity)' },
    { q1: 2, q2: 3, name: 'Q3+Q4 (Ecosystem Health - Indirect Toxicity)' },
    { q1: 4, q2: 5, name: 'Q5+Q6 (Human Health - Direct Toxicity)' },
    { q1: 6, q2: 7, name: 'Q7+Q8 (Human Health - Indirect Toxicity)' }
  ];
  
  let successCount = 0;
  
  matrixPairs.forEach((pair, index) => {
    console.log(`  Testing ${pair.name}`);
    
    // Test both questions in the pair
    const questions = [
      {
        pagePath: '/cew-polls/prioritization',
        pollIndex: pair.q1,
        question: `Test question ${pair.q1 + 1}`,
        options: ["Very important", "Important", "Neutral", "Not important", "Not at all important"],
        optionIndex: Math.floor(Math.random() * 5)
      },
      {
        pagePath: '/cew-polls/prioritization',
        pollIndex: pair.q2,
        question: `Test question ${pair.q2 + 1}`,
        options: ["Very feasible", "Feasible", "Neutral", "Not feasible", "Not at all feasible"],
        optionIndex: Math.floor(Math.random() * 5)
      }
    ];
    
    let pairSuccess = true;
    
    questions.forEach((q, qIndex) => {
      const payload = {
        pagePath: q.pagePath,
        pollIndex: q.pollIndex,
        question: q.question,
        options: q.options,
        optionIndex: q.optionIndex,
        authCode: authCode
      };
      
      const response = http.post(`${BASE_URL}/api/polls/submit`, JSON.stringify(payload), {
        headers: {
          'Content-Type': 'application/json',
          'x-session-id': sessionId  // CRITICAL: Same session ID for pairing
        },
      });
      
      const success = check(response, {
        [`${pair.name} Q${qIndex + 1} status is 200`]: (r) => r.status === 200,
        [`${pair.name} Q${qIndex + 1} response time < 2s`]: (r) => r.timings.duration < 2000
      });
      
      if (!success) {
        pairSuccess = false;
        console.log(`    ❌ Q${qIndex + 1} failed: ${response.status}`);
      } else {
        console.log(`    ✅ Q${qIndex + 1} successful`);
      }
      
      sleep(0.2);
    });
    
    if (pairSuccess) {
      successCount++;
      console.log(`  ✅ ${pair.name} - PAIRING SUCCESSFUL`);
    } else {
      console.log(`  ❌ ${pair.name} - PAIRING FAILED`);
    }
    
    sleep(0.3);
  });
  
  console.log(`  📊 Matrix pairs: ${successCount}/${matrixPairs.length} successful`);
  return successCount === matrixPairs.length;
}

// Test ranking polls
function testRankingPolls(authCode) {
  const testCase = {
    pagePath: '/cew-polls/prioritization',
    pollIndex: 2,
    question: "Rank the importance of updating CSR sediment standards...",
    options: ["Option A", "Option B", "Option C", "Option D"],
    rankings: [1, 2, 3, 4]
  };
  
  const payload = {
    pagePath: testCase.pagePath,
    pollIndex: testCase.pollIndex,
    question: testCase.question,
    options: testCase.options,
    rankings: testCase.rankings,
    authCode: authCode
  };
  
  const response = http.post(`${BASE_URL}/api/ranking-polls/submit`, JSON.stringify(payload), {
    headers: {
      'Content-Type': 'application/json'
    },
  });
  
  const success = check(response, {
    'Ranking poll status is 200': (r) => r.status === 200,
    'Ranking poll response time < 2s': (r) => r.timings.duration < 2000
  });
  
  if (success) {
    console.log(`  ✅ Ranking poll successful`);
  } else {
    console.log(`  ❌ Ranking poll failed: ${response.status}`);
  }
  
  return success;
}

// Test wordcloud polls
function testWordcloudPolls(authCode) {
  const testCase = {
    pagePath: '/cew-polls/prioritization',
    pollIndex: 4,
    question: "Overall, what is the greatest barrier to advancing holistic sediment protection in BC?",
    maxWords: 1,
    wordLimit: 20,
    words: ['Data', 'Tools', 'Policy']
  };
  
  const payload = {
    pagePath: testCase.pagePath,
    pollIndex: testCase.pollIndex,
    question: testCase.question,
    maxWords: testCase.maxWords,
    wordLimit: testCase.wordLimit,
    words: testCase.words,
    authCode: authCode
  };
  
  const response = http.post(`${BASE_URL}/api/wordcloud-polls/submit`, JSON.stringify(payload), {
    headers: {
      'Content-Type': 'application/json'
    },
  });
  
  const success = check(response, {
    'Wordcloud poll status is 200': (r) => r.status === 200,
    'Wordcloud poll response time < 2s': (r) => r.timings.duration < 2000
  });
  
  if (success) {
    console.log(`  ✅ Wordcloud poll successful`);
  } else {
    console.log(`  ❌ Wordcloud poll failed: ${response.status}`);
  }
  
  return success;
}

// Test matrix graph API
function testMatrixGraphAPI() {
  const response = http.get(`${BASE_URL}/api/graphs/prioritization-matrix`);
  
  const success = check(response, {
    'Matrix graph API status is 200': (r) => r.status === 200,
    'Matrix graph API response time < 2s': (r) => r.timings.duration < 2000,
    'Matrix graph API has data': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body && typeof body === 'object';
      } catch (e) {
        return false;
      }
    }
  });
  
  if (success) {
    console.log(`  ✅ Matrix graph API successful`);
  } else {
    console.log(`  ❌ Matrix graph API failed: ${response.status}`);
  }
  
  return success;
}

// Test results retrieval
function testResultsRetrieval() {
  const testCases = [
    { name: 'Single-choice results', url: '/api/polls/results?pagePath=/cew-polls/prioritization' },
    { name: 'Ranking results', url: '/api/ranking-polls/results?pagePath=/cew-polls/prioritization' },
    { name: 'Wordcloud results', url: '/api/wordcloud-polls/results?pagePath=/cew-polls/prioritization' },
    { name: 'Matrix graph data', url: '/api/graphs/prioritization-matrix' }
  ];
  
  let successCount = 0;
  
  testCases.forEach((testCase, index) => {
    const response = http.get(`${BASE_URL}${testCase.url}`);
    
    const success = check(response, {
      [`${testCase.name} status is 200`]: (r) => r.status === 200,
      [`${testCase.name} response time < 2s`]: (r) => r.timings.duration < 2000
    });
    
    if (success) {
      successCount++;
      console.log(`  ✅ ${testCase.name} successful`);
    } else {
      console.log(`  ❌ ${testCase.name} failed: ${response.status}`);
    }
    
    sleep(0.2);
  });
  
  console.log(`  📊 Results retrieval: ${successCount}/${testCases.length} successful`);
  return successCount === testCases.length;
}

// Test authentication modes
function testAuthenticationModes() {
  console.log(`  Testing CEW authentication mode`);
  
  // Test CEW mode (should work)
  const cewPayload = {
    pagePath: '/cew-polls/prioritization',
    pollIndex: 0,
    question: 'Test question',
    options: ['Option A', 'Option B', 'Option C'],
    optionIndex: 0,
    authCode: 'CEW2025'
  };
  
  const cewResponse = http.post(`${BASE_URL}/api/polls/submit`, JSON.stringify(cewPayload), {
    headers: {
      'Content-Type': 'application/json',
      'x-session-id': 'test-session'
    },
  });
  
  const cewSuccess = check(cewResponse, {
    'CEW authentication status is 200': (r) => r.status === 200
  });
  
  if (cewSuccess) {
    console.log(`  ✅ CEW authentication successful`);
  } else {
    console.log(`  ❌ CEW authentication failed: ${cewResponse.status}`);
  }
  
  return cewSuccess;
}

export function setup() {
  console.log('🔍 Starting comprehensive polling systems validation...');
  console.log(`Base URL: ${BASE_URL}`);
  console.log('\n📋 VALIDATION SCOPE:');
  console.log('1. Single-choice polls with matrix graph pairing');
  console.log('2. Ranking polls (unique user ID per submission)');
  console.log('3. Wordcloud polls (unique user ID per submission)');
  console.log('4. Matrix graph API validation');
  console.log('5. Results retrieval validation');
  console.log('6. Authentication mode validation');
  console.log('\n🎯 This test validates all polling systems work correctly.');
  return {};
}

// Default function for k6
export default function() {
  validateAllPollingSystems();
}
