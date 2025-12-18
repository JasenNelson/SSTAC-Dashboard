// k6-ranking-basic.js
// Basic test for ranking polls only
// Uses unique user ID generation per submission (API behavior)

import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  scenarios: {
    ranking_test: {
      executor: 'ramping-vus',
      startVUs: 1,
      stages: [
        { duration: '10s', target: 5 },   // Quick ramp to 5 users
        { duration: '20s', target: 10 },  // Ramp to 10 users
        { duration: '10s', target: 0 },   // Quick ramp down
      ],
      exec: 'testRankingPolls',
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<2000'],
    http_req_failed: ['rate<0.05'],
    checks: ['rate>0.95'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

// Test ranking polls (each submission gets unique user ID)
export function testRankingPolls() {
  const authCode = 'CEW2025';
  
  console.log(`🎯 Testing ranking polls with unique user ID generation`);
  
  // Test different ranking questions
  const testCases = [
    {
      pagePath: '/cew-polls/holistic-protection',
      pollIndex: 1,
      question: "Rank in order of highest to lowest importance...",
      options: ["Option A", "Option B", "Option C", "Option D"],
      rankings: [1, 2, 3, 4] // Random ranking
    },
    {
      pagePath: '/cew-polls/tiered-framework',
      pollIndex: 1,
      question: "Please rank the following lines of evidence...",
      options: ["Option A", "Option B", "Option C", "Option D"],
      rankings: [2, 1, 4, 3] // Random ranking
    },
    {
      pagePath: '/cew-polls/prioritization',
      pollIndex: 2,
      question: "Rank the importance of updating CSR sediment standards...",
      options: ["Option A", "Option B", "Option C", "Option D"],
      rankings: [3, 1, 2, 4] // Random ranking
    },
    {
      pagePath: '/cew-polls/prioritization',
      pollIndex: 3,
      question: "Rank the feasibility of updating CSR sediment standards...",
      options: ["Option A", "Option B", "Option C", "Option D"],
      rankings: [4, 2, 1, 3] // Random ranking
    }
  ];
  
  let successCount = 0;
  
  testCases.forEach((testCase, index) => {
    // Generate random rankings for this test case
    const shuffledRankings = [...testCase.rankings].sort(() => Math.random() - 0.5);
    
    const payload = {
      pagePath: testCase.pagePath,
      pollIndex: testCase.pollIndex,
      question: testCase.question,
      options: testCase.options,
      rankings: shuffledRankings,
      authCode: authCode
    };
    
    const response = http.post(`${BASE_URL}/api/ranking-polls/submit`, JSON.stringify(payload), {
      headers: {
        'Content-Type': 'application/json'
        // NOTE: No x-session-id header - ranking polls generate unique user IDs
      },
    });
    
    const success = check(response, {
      [`Ranking poll ${index + 1} status is 200`]: (r) => r.status === 200,
      [`Ranking poll ${index + 1} response time < 2s`]: (r) => r.timings.duration < 2000,
      [`Ranking poll ${index + 1} has success field`]: (r) => {
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
      console.log(`✅ Ranking poll ${index + 1} successful`);
    } else {
      console.log(`❌ Ranking poll ${index + 1} failed: ${response.status} - ${response.body}`);
    }
    
    sleep(0.5); // Brief pause between requests
  });
  
  console.log(`📊 Ranking polls: ${successCount}/${testCases.length} successful`);
  
  // Test ranking poll results retrieval
  if (successCount > 0) {
    testRankingResults();
  }
}

// Test ranking poll results retrieval
function testRankingResults() {
  console.log(`📊 Testing ranking poll results retrieval`);
  
  const testPages = [
    '/cew-polls/holistic-protection',
    '/cew-polls/tiered-framework',
    '/cew-polls/prioritization'
  ];
  
  testPages.forEach((pagePath, index) => {
    const response = http.get(`${BASE_URL}/api/ranking-polls/results?pagePath=${encodeURIComponent(pagePath)}`);
    
    const success = check(response, {
      [`Ranking results ${index + 1} status is 200`]: (r) => r.status === 200,
      [`Ranking results ${index + 1} response time < 2s`]: (r) => r.timings.duration < 2000,
      [`Ranking results ${index + 1} has data`]: (r) => {
        try {
          const body = JSON.parse(r.body);
          return Array.isArray(body) && body.length > 0;
        } catch (e) {
          return false;
        }
      }
    });
    
    if (success) {
      console.log(`✅ Ranking results ${index + 1} successful`);
    } else {
      console.log(`❌ Ranking results ${index + 1} failed: ${response.status} - ${response.body}`);
    }
    
    sleep(0.3);
  });
}

export function setup() {
  console.log('🔍 Starting ranking poll test...');
  console.log(`Base URL: ${BASE_URL}`);
  console.log('Testing: Ranking polls with unique user ID generation per submission');
  console.log('Note: Ranking polls cannot be paired for matrix graphs (different user ID generation)');
  return {};
}

// Default function for k6
export default function() {
  testRankingPolls();
}
