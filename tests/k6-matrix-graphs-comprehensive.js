// k6-matrix-graphs-comprehensive.js
// Comprehensive test for all matrix graph question pairs
// Tests all 4 pairs: Q1+Q2, Q3+Q4, Q5+Q6, Q7+Q8
// Uses x-session-id header for consistent user tracking

import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  scenarios: {
    matrix_graphs_comprehensive: {
      executor: 'ramping-vus',
      startVUs: 1,
      stages: [
        { duration: '15s', target: 10 },  // Ramp to 10 users
        { duration: '30s', target: 20 },  // Ramp to 20 users
        { duration: '15s', target: 0 },   // Ramp down
      ],
      exec: 'testAllMatrixGraphPairs',
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

// All matrix graph question pairs
const matrixPairs = [
  {
    name: 'Pair 1: Q1+Q2 (Ecosystem Health - Direct Toxicity)',
    questions: [
      {
        pagePath: '/cew-polls/prioritization',
        pollIndex: 0,
        question: "How important is updating CSR sediment standards for direct toxicity to ecological receptors (matrix standards, possibly based on SSDs). (1 = very important to 5 = not important)",
        options: ["Very important", "Important", "Neutral", "Not important", "Not at all important"],
        optionIndex: Math.floor(Math.random() * 5)
      },
      {
        pagePath: '/cew-polls/prioritization',
        pollIndex: 1,
        question: "How feasible is updating CSR sediment standards for direct toxicity to ecological receptors (matrix standards, possibly based on SSDs). (1 = very feasible to 5 = not feasible)",
        options: ["Very feasible", "Feasible", "Neutral", "Not feasible", "Not at all feasible"],
        optionIndex: Math.floor(Math.random() * 5)
      }
    ]
  },
  {
    name: 'Pair 2: Q3+Q4 (Ecosystem Health - Indirect Toxicity)',
    questions: [
      {
        pagePath: '/cew-polls/prioritization',
        pollIndex: 2,
        question: "How important is updating CSR sediment standards for indirect toxicity to ecological receptors (bioaccumulation, food web effects). (1 = very important to 5 = not important)",
        options: ["Very important", "Important", "Neutral", "Not important", "Not at all important"],
        optionIndex: Math.floor(Math.random() * 5)
      },
      {
        pagePath: '/cew-polls/prioritization',
        pollIndex: 3,
        question: "How feasible is updating CSR sediment standards for indirect toxicity to ecological receptors (bioaccumulation, food web effects). (1 = very feasible to 5 = not feasible)",
        options: ["Very feasible", "Feasible", "Neutral", "Not feasible", "Not at all feasible"],
        optionIndex: Math.floor(Math.random() * 5)
      }
    ]
  },
  {
    name: 'Pair 3: Q5+Q6 (Human Health - Direct Toxicity)',
    questions: [
      {
        pagePath: '/cew-polls/prioritization',
        pollIndex: 4,
        question: "How important is updating CSR sediment standards for direct toxicity to human health (drinking water, recreational exposure). (1 = very important to 5 = not important)",
        options: ["Very important", "Important", "Neutral", "Not important", "Not at all important"],
        optionIndex: Math.floor(Math.random() * 5)
      },
      {
        pagePath: '/cew-polls/prioritization',
        pollIndex: 5,
        question: "How feasible is updating CSR sediment standards for direct toxicity to human health (drinking water, recreational exposure). (1 = very feasible to 5 = not feasible)",
        options: ["Very feasible", "Feasible", "Neutral", "Not feasible", "Not at all feasible"],
        optionIndex: Math.floor(Math.random() * 5)
      }
    ]
  },
  {
    name: 'Pair 4: Q7+Q8 (Human Health - Indirect Toxicity)',
    questions: [
      {
        pagePath: '/cew-polls/prioritization',
        pollIndex: 6,
        question: "How important is updating CSR sediment standards for indirect toxicity to human health (fish consumption, bioaccumulation). (1 = very important to 5 = not important)",
        options: ["Very important", "Important", "Neutral", "Not important", "Not at all important"],
        optionIndex: Math.floor(Math.random() * 5)
      },
      {
        pagePath: '/cew-polls/prioritization',
        pollIndex: 7,
        question: "How feasible is updating CSR sediment standards for indirect toxicity to human health (fish consumption, bioaccumulation). (1 = very feasible to 5 = not feasible)",
        options: ["Very feasible", "Feasible", "Neutral", "Not feasible", "Not at all feasible"],
        optionIndex: Math.floor(Math.random() * 5)
      }
    ]
  }
];

// Test all matrix graph pairs
export function testAllMatrixGraphPairs() {
  const sessionId = generateSessionId();
  const authCode = 'CEW2025';
  
  console.log(`🎯 Testing all matrix graph pairs with session: ${sessionId}`);
  
  let totalPairs = 0;
  let successfulPairs = 0;
  
  matrixPairs.forEach((pair, pairIndex) => {
    console.log(`\n📊 Testing ${pair.name}`);
    
    let pairSuccess = true;
    
    pair.questions.forEach((question, qIndex) => {
      const payload = {
        pagePath: question.pagePath,
        pollIndex: question.pollIndex,
        question: question.question,
        options: question.options,
        optionIndex: question.optionIndex,
        authCode: authCode
      };
      
      const response = http.post(`${BASE_URL}/api/polls/submit`, JSON.stringify(payload), {
        headers: {
          'Content-Type': 'application/json',
          'x-session-id': sessionId  // CRITICAL: Same session ID for both questions
        },
      });
      
      const success = check(response, {
        [`${pair.name} Q${qIndex + 1} status is 200`]: (r) => r.status === 200,
        [`${pair.name} Q${qIndex + 1} response time < 2s`]: (r) => r.timings.duration < 2000,
        [`${pair.name} Q${qIndex + 1} has success field`]: (r) => {
          try {
            const body = JSON.parse(r.body);
            return body.success === true;
          } catch (e) {
            return false;
          }
        }
      });
      
      if (success) {
        console.log(`  ✅ Q${qIndex + 1} successful`);
      } else {
        console.log(`  ❌ Q${qIndex + 1} failed: ${response.status} - ${response.body}`);
        pairSuccess = false;
      }
      
      sleep(0.3); // Brief pause between questions
    });
    
    totalPairs++;
    if (pairSuccess) {
      successfulPairs++;
      console.log(`  🎉 ${pair.name} - PAIRING SUCCESSFUL`);
    } else {
      console.log(`  ⚠️ ${pair.name} - PAIRING FAILED`);
    }
    
    sleep(0.5); // Brief pause between pairs
  });
  
  console.log(`\n📊 Matrix Graph Pairs Summary: ${successfulPairs}/${totalPairs} successful`);
  
  // Test matrix graph API retrieval
  if (successfulPairs > 0) {
    testMatrixGraphAPI();
  }
}

// Test matrix graph API retrieval
function testMatrixGraphAPI() {
  console.log(`\n🔗 Testing matrix graph API retrieval`);
  
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
    console.log(`✅ Matrix graph API successful`);
    
    // Try to parse and validate the response
    try {
      const body = JSON.parse(response.body);
      console.log(`📊 Matrix graph data structure:`, Object.keys(body));
      
      // Check for expected data structure
      if (body.data && Array.isArray(body.data)) {
        console.log(`📊 Matrix graph data points: ${body.data.length}`);
      }
    } catch (e) {
      console.log(`⚠️ Could not parse matrix graph response: ${e.message}`);
    }
  } else {
    console.log(`❌ Matrix graph API failed: ${response.status} - ${response.body}`);
  }
}

// Test matrix graph with different filter modes
function testMatrixGraphFilters() {
  console.log(`\n🔍 Testing matrix graph filter modes`);
  
  const filterModes = ['All', 'TWG Only', 'CEW Only'];
  
  filterModes.forEach((filterMode, index) => {
    const response = http.get(`${BASE_URL}/api/graphs/prioritization-matrix?filterMode=${encodeURIComponent(filterMode)}`);
    
    const success = check(response, {
      [`Matrix graph filter ${filterMode} status is 200`]: (r) => r.status === 200,
      [`Matrix graph filter ${filterMode} response time < 2s`]: (r) => r.timings.duration < 2000
    });
    
    if (success) {
      console.log(`✅ Matrix graph filter ${filterMode} successful`);
    } else {
      console.log(`❌ Matrix graph filter ${filterMode} failed: ${response.status} - ${response.body}`);
    }
    
    sleep(0.2);
  });
}

export function setup() {
  console.log('🔍 Starting comprehensive matrix graph test...');
  console.log(`Base URL: ${BASE_URL}`);
  console.log('Testing: All 4 matrix graph question pairs with x-session-id header');
  console.log('Pairs: Q1+Q2, Q3+Q4, Q5+Q6, Q7+Q8');
  return {};
}

// Default function for k6
export default function() {
  testAllMatrixGraphPairs();
}
