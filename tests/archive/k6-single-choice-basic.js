// k6-single-choice-basic.js
// Basic test for single-choice polls only
// Uses x-session-id header for consistent user tracking (required for matrix graphs)

import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  scenarios: {
    single_choice_test: {
      executor: 'ramping-vus',
      startVUs: 1,
      stages: [
        { duration: '10s', target: 5 },   // Quick ramp to 5 users
        { duration: '20s', target: 10 },  // Ramp to 10 users
        { duration: '10s', target: 0 },   // Quick ramp down
      ],
      exec: 'testSingleChoicePolls',
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

// Test single-choice polls with proper x-session-id header
export function testSingleChoicePolls() {
  const sessionId = generateSessionId();
  const authCode = 'CEW2025';
  
  console.log(`🎯 Testing single-choice polls with session: ${sessionId}`);
  
  // Test different pages and poll indices
  const testCases = [
    {
      pagePath: '/cew-polls/holistic-protection',
      pollIndex: 0,
      question: "Given the potential for over-conservatism...",
      options: ["Strongly agree", "Agree", "Neutral", "Disagree", "Strongly disagree"],
      optionIndex: Math.floor(Math.random() * 5)
    },
    {
      pagePath: '/cew-polls/tiered-framework',
      pollIndex: 0,
      question: "In developing Protocol 2 requirements...",
      options: ["Strongly agree", "Agree", "Neutral", "Disagree", "Strongly disagree"],
      optionIndex: Math.floor(Math.random() * 5)
    },
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
        'x-session-id': sessionId  // CRITICAL: Same session ID for all votes
      },
    });
    
    const success = check(response, {
      [`Single-choice poll ${index + 1} status is 200`]: (r) => r.status === 200,
      [`Single-choice poll ${index + 1} response time < 2s`]: (r) => r.timings.duration < 2000,
      [`Single-choice poll ${index + 1} has success field`]: (r) => {
        try {
          const body = JSON.parse(r.body);
          return body.success === true;
        } catch (e) {
          return false;
        }
      }
    });
    
    if (success) {
      successCount++;
      console.log(`✅ Single-choice poll ${index + 1} successful`);
    } else {
      console.log(`❌ Single-choice poll ${index + 1} failed: ${response.status} - ${response.body}`);
    }
    
    sleep(0.5); // Brief pause between requests
  });
  
  console.log(`📊 Single-choice polls: ${successCount}/${testCases.length} successful`);
  
  // Test matrix graph pairing (Q1+Q2 from prioritization)
  if (successCount >= 2) {
    testMatrixGraphPairing(sessionId, authCode);
  }
}

// Test matrix graph pairing with the same session ID
function testMatrixGraphPairing(sessionId, authCode) {
  console.log(`🔗 Testing matrix graph pairing with session: ${sessionId}`);
  
  // Test Q1+Q2 pairing (poll_index 0+1) from prioritization
  const questions = [
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
  
  let pairSuccess = true;
  
  questions.forEach((q, index) => {
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
        'x-session-id': sessionId  // CRITICAL: Same session ID for both questions
      },
    });
    
    const success = check(response, {
      [`Matrix pair Q${index + 1} status is 200`]: (r) => r.status === 200,
      [`Matrix pair Q${index + 1} response time < 2s`]: (r) => r.timings.duration < 2000
    });
    
    if (!success) {
      pairSuccess = false;
      console.log(`❌ Matrix pair Q${index + 1} failed: ${response.status} - ${response.body}`);
    } else {
      console.log(`✅ Matrix pair Q${index + 1} successful`);
    }
    
    sleep(0.3);
  });
  
  if (pairSuccess) {
    console.log(`🎉 Matrix graph pairing successful - votes can be paired for visualization`);
  } else {
    console.log(`⚠️ Matrix graph pairing failed - votes cannot be paired`);
  }
}

export function setup() {
  console.log('🔍 Starting single-choice poll test...');
  console.log(`Base URL: ${BASE_URL}`);
  console.log('Testing: Single-choice polls with x-session-id header for matrix graph pairing');
  return {};
}

// Default function for k6
export default function() {
  testSingleChoicePolls();
}
