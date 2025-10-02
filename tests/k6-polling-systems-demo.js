// k6-polling-systems-demo.js
// Comprehensive demonstration of all polling systems
// Shows correct patterns for each poll type and authentication mode

import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  scenarios: {
    polling_systems_demo: {
      executor: 'ramping-vus',
      startVUs: 1,
      stages: [
        { duration: '20s', target: 5 },   // Ramp to 5 users
        { duration: '30s', target: 10 },  // Ramp to 10 users
        { duration: '20s', target: 0 },   // Ramp down
      ],
      exec: 'demonstrateAllPollingSystems',
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

// Demonstrate all polling systems
export function demonstrateAllPollingSystems() {
  const sessionId = generateSessionId();
  const authCode = 'CEW2025';
  
  console.log(`🎯 Demonstrating all polling systems with session: ${sessionId}`);
  
  // 1. Single-Choice Polls (with x-session-id for matrix graphs)
  console.log(`\n📊 1. SINGLE-CHOICE POLLS (Matrix Graph Compatible)`);
  testSingleChoicePolls(sessionId, authCode);
  
  sleep(1);
  
  // 2. Ranking Polls (unique user ID per submission)
  console.log(`\n📊 2. RANKING POLLS (Unique User ID per Submission)`);
  testRankingPolls(authCode);
  
  sleep(1);
  
  // 3. Wordcloud Polls (unique user ID per submission)
  console.log(`\n📊 3. WORDCLOUD POLLS (Unique User ID per Submission)`);
  testWordcloudPolls(authCode);
  
  sleep(1);
  
  // 4. Matrix Graph API (requires paired single-choice votes)
  console.log(`\n📊 4. MATRIX GRAPH API (Paired Single-Choice Votes)`);
  testMatrixGraphAPI();
  
  sleep(1);
  
  // 5. Results Retrieval (all poll types)
  console.log(`\n📊 5. RESULTS RETRIEVAL (All Poll Types)`);
  testResultsRetrieval();
}

// Test single-choice polls with x-session-id header
function testSingleChoicePolls(sessionId, authCode) {
  const testCases = [
    {
      pagePath: '/cew-polls/prioritization',
      pollIndex: 0,
      question: "How important is updating CSR sediment standards for direct toxicity...",
      options: ["Very important", "Important", "Neutral", "Not important", "Not at all important"],
      optionIndex: Math.floor(Math.random() * 5)
    },
    {
      pagePath: '/cew-polls/prioritization',
      pollIndex: 1,
      question: "How feasible is updating CSR sediment standards for direct toxicity...",
      options: ["Very feasible", "Feasible", "Neutral", "Not feasible", "Not at all feasible"],
      optionIndex: Math.floor(Math.random() * 5)
    }
  ];
  
  let successCount = 0;
  
  testCases.forEach((testCase, index) => {
    const payload = {
      pagePath: testCase.pagePath,
      pollIndex: testCase.pollIndex,
      question: testCase.question,
      options: testCase.options,
      optionIndex: testCase.optionIndex,
      authCode: authCode
    };
    
    const response = http.post(`${BASE_URL}/api/polls/submit`, JSON.stringify(payload), {
      headers: {
        'Content-Type': 'application/json',
        'x-session-id': sessionId  // CRITICAL: Same session ID for matrix graphs
      },
    });
    
    const success = check(response, {
      [`Single-choice poll ${index + 1} status is 200`]: (r) => r.status === 200,
      [`Single-choice poll ${index + 1} response time < 2s`]: (r) => r.timings.duration < 2000
    });
    
    if (success) {
      successCount++;
      console.log(`  ✅ Single-choice poll ${index + 1} successful`);
    } else {
      console.log(`  ❌ Single-choice poll ${index + 1} failed: ${response.status}`);
    }
    
    sleep(0.3);
  });
  
  console.log(`  📊 Single-choice polls: ${successCount}/${testCases.length} successful`);
  console.log(`  🔗 These votes CAN be paired for matrix graphs (same session ID)`);
}

// Test ranking polls (unique user ID per submission)
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
      // NOTE: No x-session-id header - ranking polls generate unique user IDs
    },
  });
  
  const success = check(response, {
    'Ranking poll status is 200': (r) => r.status === 200,
    'Ranking poll response time < 2s': (r) => r.timings.duration < 2000
  });
  
  if (success) {
    console.log(`  ✅ Ranking poll successful`);
    console.log(`  🔗 This vote CANNOT be paired for matrix graphs (unique user ID)`);
  } else {
    console.log(`  ❌ Ranking poll failed: ${response.status}`);
  }
}

// Test wordcloud polls (unique user ID per submission)
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
      // NOTE: No x-session-id header - wordcloud polls generate unique user IDs
    },
  });
  
  const success = check(response, {
    'Wordcloud poll status is 200': (r) => r.status === 200,
    'Wordcloud poll response time < 2s': (r) => r.timings.duration < 2000
  });
  
  if (success) {
    console.log(`  ✅ Wordcloud poll successful with words: ${testCase.words.join(', ')}`);
    console.log(`  🔗 This vote CANNOT be paired for matrix graphs (unique user ID)`);
  } else {
    console.log(`  ❌ Wordcloud poll failed: ${response.status}`);
  }
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
    
    try {
      const body = JSON.parse(response.body);
      if (body.data && Array.isArray(body.data)) {
        console.log(`  📊 Matrix graph data points: ${body.data.length}`);
      }
    } catch (e) {
      console.log(`  ⚠️ Could not parse matrix graph response`);
    }
  } else {
    console.log(`  ❌ Matrix graph API failed: ${response.status}`);
  }
}

// Test results retrieval for all poll types
function testResultsRetrieval() {
  const testCases = [
    { name: 'Single-choice results', url: '/api/polls/results?pagePath=/cew-polls/prioritization' },
    { name: 'Ranking results', url: '/api/ranking-polls/results?pagePath=/cew-polls/prioritization' },
    { name: 'Wordcloud results', url: '/api/wordcloud-polls/results?pagePath=/cew-polls/prioritization' },
    { name: 'Matrix graph data', url: '/api/graphs/prioritization-matrix' }
  ];
  
  testCases.forEach((testCase, index) => {
    const response = http.get(`${BASE_URL}${testCase.url}`);
    
    const success = check(response, {
      [`${testCase.name} status is 200`]: (r) => r.status === 200,
      [`${testCase.name} response time < 2s`]: (r) => r.timings.duration < 2000
    });
    
    if (success) {
      console.log(`  ✅ ${testCase.name} successful`);
    } else {
      console.log(`  ❌ ${testCase.name} failed: ${response.status}`);
    }
    
    sleep(0.2);
  });
}

export function setup() {
  console.log('🔍 Starting polling systems demonstration...');
  console.log(`Base URL: ${BASE_URL}`);
  console.log('\n📋 POLLING SYSTEMS OVERVIEW:');
  console.log('1. Single-choice polls: Use x-session-id header for matrix graph pairing');
  console.log('2. Ranking polls: Generate unique user ID per submission');
  console.log('3. Wordcloud polls: Generate unique user ID per submission');
  console.log('4. Matrix graphs: Require paired single-choice votes with same session ID');
  console.log('\n🎯 This test demonstrates the correct patterns for each system.');
  return {};
}

// Default function for k6
export default function() {
  demonstrateAllPollingSystems();
}
