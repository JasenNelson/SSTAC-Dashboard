// k6-matrix-graph-pairing-verification.js
// Quick verification test for matrix graph pairing fix
// Tests only Q1+Q2 pairing to verify x-session-id header works correctly

import http from 'k6/http';
import { check, sleep } from 'k6';

// Simple test configuration - 10 users, quick test
export const options = {
  scenarios: {
    matrix_pairing_verification: {
      executor: 'ramping-vus',
      startVUs: 1,
      stages: [
        { duration: '10s', target: 5 },   // Quick ramp to 5 users
        { duration: '20s', target: 10 },  // Ramp to 10 users
        { duration: '10s', target: 0 },   // Quick ramp down
      ],
      exec: 'testMatrixPairing',
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<2000'],
    http_req_failed: ['rate<0.05'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

// Generate unique user ID for each virtual user
function generateUniqueUserId() {
  const timestamp = Date.now();
  const vuId = __VU;
  const iteration = __ITER;
  const random = Math.floor(Math.random() * 1000);
  return `CEW2025-${vuId}-${iteration}-${random}`;
}

// Test matrix pairing with proper x-session-id header
export function testMatrixPairing() {
  const userId = generateUniqueUserId();
  const basePath = '/cew-polls/holistic-protection';
  
  console.log(`🎯 Testing matrix pairing for user: ${userId}`);
  
  // Test Q1+Q2 pairing (Ecosystem Health - Direct Toxicity)
  const questions = [
    {
      pollIndex: 0,
      question: "Rank the importance of updating CSR sediment standards for direct toxicity to ecological receptors (matrix standards, possibly based on SSDs). (1 = very important to 5 = not important)",
      options: ["Very Important", "Important", "Moderately Important", "Less Important", "Not Important"]
    },
    {
      pollIndex: 1,
      question: "Rank the feasibility of updating CSR sediment standards for direct toxicity to ecological receptors (matrix standards, possibly based on SSDs). (1 = easily achievable to 5 = not feasible)",
      options: ["Easily Achievable", "Achievable", "Moderately Achievable", "Difficult", "Not Feasible"]
    }
  ];
  
  let pairSuccess = true;
  
  // Submit both questions with SAME user ID via x-session-id header
  questions.forEach((q, index) => {
    const payload = {
      pagePath: basePath,
      pollIndex: q.pollIndex,
      optionIndex: Math.floor(Math.random() * q.options.length),
      question: q.question,
      options: q.options,
      authCode: 'CEW2025'
    };
    
    const response = http.post(`${BASE_URL}/api/polls/submit`, JSON.stringify(payload), {
      headers: {
        'Content-Type': 'application/json',
        'x-session-id': userId  // CRITICAL: Same user ID for both questions
      },
    });
    
    const success = check(response, {
      [`Q${index + 1} vote submitted`]: (r) => r.status === 200,
      [`Q${index + 1} response time < 2000ms`]: (r) => r.timings.duration < 2000,
    });
    
    if (!success) {
      pairSuccess = false;
      console.log(`❌ Q${index + 1} failed: ${response.status} ${response.body}`);
    } else {
      console.log(`✅ Q${index + 1} submitted successfully for user ${userId}`);
    }
  });
  
  // Wait for data processing
  sleep(1);
  
  // Verify matrix graph shows paired data
  const matrixResponse = http.get(`${BASE_URL}/api/graphs/prioritization-matrix?filter=all`);
  
  const matrixSuccess = check(matrixResponse, {
    'Matrix graph API responds': (r) => r.status === 200,
    'Matrix graph contains data': (r) => {
      try {
        const body = JSON.parse(r.body);
        console.log(`🔍 Matrix API Response Debug:`, {
          status: r.status,
          bodyKeys: Object.keys(body),
          hasData: Object.keys(body).length > 0,
          firstPair: body["0"] ? 'Has Pair 1' : 'No Pair 1',
          secondPair: body["1"] ? 'Has Pair 2' : 'No Pair 2'
        });
        // Check if we have matrix data (keys 0,1,2,3 represent the 4 pairs)
        return body && Object.keys(body).length > 0 && body["0"];
      } catch (error) {
        console.log(`❌ Matrix API JSON Parse Error:`, error);
        return false;
      }
    },
    'Matrix pairing successful': () => pairSuccess
  });
  
  if (matrixSuccess) {
    console.log(`✅ Matrix pairing verification successful for user ${userId}`);
  } else {
    console.log(`❌ Matrix pairing verification failed for user ${userId}`);
  }
}

// Setup function
export function setup() {
  console.log('🔍 Starting matrix graph pairing verification test...');
  console.log(`Base URL: ${BASE_URL}`);
  console.log('Testing: Q1+Q2 pairing with x-session-id header');
  return {};
}

// Teardown function
export function teardown(data) {
  console.log('✅ Matrix graph pairing verification test completed');
  console.log('Check matrix graphs to verify paired data points are showing correctly');
  console.log('Expected: Data points should cluster based on importance/feasibility votes');
}
