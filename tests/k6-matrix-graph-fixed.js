// K6 Matrix Graph Test - FIXED VERSION
// Uses real poll data to avoid creating new polls
// Run with: k6 run k6-matrix-graph-fixed.js

import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  scenarios: {
    matrix_graph_test: {
      executor: 'per-vu-iterations',
      vus: 1,
      iterations: 1,
      maxDuration: '2m',
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<10000'],
    http_req_failed: ['rate<0.1'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

// Real poll data from the database
const REAL_POLL_DATA = {
  '/cew-polls/holistic-protection': {
    0: {
      question: "Rank the importance of updating CSR sediment standards for direct toxicity to ecological receptors (matrix standards, possibly based on SSDs). (1 = very important to 5 = not important)",
      options: ["Very Important", "Important", "Moderately Important", "Less Important", "Not Important"]
    },
    1: {
      question: "Rank the feasibility of updating CSR sediment standards for direct toxicity to ecological receptors (matrix standards, possibly based on SSDs). (1 = easily achievable to 5 = not feasible)",
      options: ["Easily Achievable", "Achievable", "Moderately Achievable", "Difficult", "Not Feasible"]
    },
    2: {
      question: "Rank the importance of updating CSR sediment standards for indirect effects to ecological receptors (matrix standards, possibly based on SSDs). (1 = very important to 5 = not important)",
      options: ["Very Important", "Important", "Moderately Important", "Less Important", "Not Important"]
    },
    3: {
      question: "Rank the feasibility of updating CSR sediment standards for indirect effects to ecological receptors (matrix standards, possibly based on SSDs). (1 = easily achievable to 5 = not feasible)",
      options: ["Easily Achievable", "Achievable", "Moderately Achievable", "Difficult", "Not Feasible"]
    },
    4: {
      question: "Rank the importance of updating CSR sediment standards for direct toxicity to human health (matrix standards, possibly based on SSDs). (1 = very important to 5 = not important)",
      options: ["Very Important", "Important", "Moderately Important", "Less Important", "Not Important"]
    },
    5: {
      question: "Rank the feasibility of updating CSR sediment standards for direct toxicity to human health (matrix standards, possibly based on SSDs). (1 = easily achievable to 5 = not feasible)",
      options: ["Easily Achievable", "Achievable", "Moderately Achievable", "Difficult", "Not Feasible"]
    },
    6: {
      question: "Rank the importance of updating CSR sediment standards for indirect effects to human health (matrix standards, possibly based on SSDs). (1 = very important to 5 = not important)",
      options: ["Very Important", "Important", "Moderately Important", "Less Important", "Not Important"]
    },
    7: {
      question: "Rank the feasibility of updating CSR sediment standards for indirect effects to human health (matrix standards, possibly based on SSDs). (1 = easily achievable to 5 = not feasible)",
      options: ["Easily Achievable", "Achievable", "Moderately Achievable", "Difficult", "Not Feasible"]
    }
  },
  '/cew-polls/prioritization': {
    0: {
      question: "Rank the importance of updating CSR sediment standards for site-specific standards (bioavailability). (1 = very important to 5 = not important)",
      options: ["Very Important", "Important", "Moderately Important", "Less Important", "Not Important"]
    },
    1: {
      question: "Rank the feasibility of updating CSR sediment standards for site-specific standards (bioavailability). (1 = easily achievable to 5 = not feasible)",
      options: ["Easily Achievable", "Achievable", "Moderately Achievable", "Difficult", "Not Feasible"]
    }
  }
};

// Helper function to get matrix graph data
function getMatrixGraphData(filter = 'all') {
  const response = http.get(`${BASE_URL}/api/graphs/prioritization-matrix?filter=${filter}`);
  
  if (response.status !== 200) {
    console.error(`❌ Matrix API failed: ${response.status} ${response.body}`);
    return { success: false, dataPoints: 0, data: null };
  }
  
  try {
    const data = JSON.parse(response.body);
    let totalDataPoints = 0;
    
    if (Array.isArray(data)) {
      data.forEach(matrixData => {
        if (matrixData.individualPairs && Array.isArray(matrixData.individualPairs)) {
          totalDataPoints += matrixData.individualPairs.length;
        }
      });
    }
    
    return { success: true, dataPoints: totalDataPoints, data: data };
  } catch (e) {
    console.error(`❌ JSON parse error: ${e.message}`);
    return { success: false, dataPoints: 0, data: null };
  }
}

// Helper function to submit a vote with real data
function submitVote(pagePath, pollIndex, optionIndex, authCode = null) {
  const pollData = REAL_POLL_DATA[pagePath]?.[pollIndex];
  
  if (!pollData) {
    console.error(`❌ No poll data found for ${pagePath} poll_index ${pollIndex}`);
    return { success: false, status: 400, body: 'No poll data found' };
  }
  
  const payload = {
    pagePath,
    pollIndex,
    optionIndex,
    question: pollData.question,
    options: pollData.options,
    authCode
  };
  
  const headers = {
    'Content-Type': 'application/json',
    'x-session-id': `test_session_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`
  };
  
  const response = http.post(`${BASE_URL}/api/polls/submit`, JSON.stringify(payload), { headers });
  
  return {
    success: response.status === 200,
    status: response.status,
    body: response.body
  };
}

export default function() {
  console.log('\n🎯 Starting FIXED Matrix Graph Test - Using Real Poll Data');
  
  // Step 1: Get baseline data
  console.log('\n📊 Step 1: Getting baseline matrix graph data...');
  const baselineAll = getMatrixGraphData('all');
  const baselineCew = getMatrixGraphData('cew');
  
  console.log(`📊 Baseline - All: ${baselineAll.dataPoints}, CEW: ${baselineCew.dataPoints}`);
  
  if (!baselineAll.success) {
    console.error('❌ Failed to get baseline data - stopping test');
    return;
  }
  
  // Step 2: Test matrix graph question pairs with REAL data
  console.log('\n🗳️ Step 2: Testing matrix graph question pairs with REAL data...');
  
  // Holistic Protection Question Pairs (Q1+Q2, Q3+Q4, Q5+Q6, Q7+Q8)
  const holisticPairs = [
    { q1: 0, q2: 1, name: 'Q1+Q2 (Ecosystem Health - Direct Toxicity)' },
    { q1: 2, q2: 3, name: 'Q3+Q4 (Ecosystem Health - Indirect Effects)' },
    { q1: 4, q2: 5, name: 'Q5+Q6 (Human Health - Direct Toxicity)' },
    { q1: 6, q2: 7, name: 'Q7+Q8 (Human Health - Indirect Effects)' }
  ];
  
  // Prioritization Question Pairs (Q1+Q2)
  const prioritizationPairs = [
    { q1: 0, q2: 1, name: 'Q1+Q2 (Site-Specific Standards)' }
  ];
  
  let totalVotesSubmitted = 0;
  let totalVotesSuccessful = 0;
  
  // Test Holistic Protection pairs
  console.log('\n🔬 Testing Holistic Protection Matrix Pairs...');
  for (const pair of holisticPairs) {
    console.log(`\n📊 Testing ${pair.name}...`);
    
    const q1Result = submitVote('/cew-polls/holistic-protection', pair.q1, Math.floor(Math.random() * 5), 'CEW2025');
    const q2Result = submitVote('/cew-polls/holistic-protection', pair.q2, Math.floor(Math.random() * 5), 'CEW2025');
    
    totalVotesSubmitted += 2;
    if (q1Result.success) totalVotesSuccessful++;
    if (q2Result.success) totalVotesSuccessful++;
    
    console.log(`  Q${pair.q1 + 1}: ${q1Result.success ? '✅' : '❌'} (${q1Result.status})`);
    console.log(`  Q${pair.q2 + 1}: ${q2Result.success ? '✅' : '❌'} (${q2Result.status})`);
    
    // Small delay between pairs
    sleep(0.5);
  }
  
  // Test Prioritization pairs
  console.log('\n🎯 Testing Prioritization Matrix Pairs...');
  for (const pair of prioritizationPairs) {
    console.log(`\n📊 Testing ${pair.name}...`);
    
    const q1Result = submitVote('/cew-polls/prioritization', pair.q1, Math.floor(Math.random() * 5), 'CEW2025');
    const q2Result = submitVote('/cew-polls/prioritization', pair.q2, Math.floor(Math.random() * 5), 'CEW2025');
    
    totalVotesSubmitted += 2;
    if (q1Result.success) totalVotesSuccessful++;
    if (q2Result.success) totalVotesSuccessful++;
    
    console.log(`  Q${pair.q1 + 1}: ${q1Result.success ? '✅' : '❌'} (${q1Result.status})`);
    console.log(`  Q${pair.q2 + 1}: ${q2Result.success ? '✅' : '❌'} (${q2Result.status})`);
    
    // Small delay between pairs
    sleep(0.5);
  }
  
  console.log(`\n📊 Vote Summary: ${totalVotesSuccessful}/${totalVotesSubmitted} votes submitted successfully`);
  
  // Wait for data processing
  console.log('\n⏱️ Waiting for data processing...');
  sleep(5);
  
  // Step 3: Check if new data points were created
  console.log('\n📊 Step 3: Checking for new data points...');
  
  const afterAll = getMatrixGraphData('all');
  const afterCew = getMatrixGraphData('cew');
  
  console.log(`📊 After - All: ${afterAll.dataPoints}, CEW: ${afterCew.dataPoints}`);
  
  // Calculate new data points
  const newAllDataPoints = afterAll.dataPoints - baselineAll.dataPoints;
  const newCewDataPoints = afterCew.dataPoints - baselineCew.dataPoints;
  
  console.log(`📈 New data points - All: +${newAllDataPoints}, CEW: +${newCewDataPoints}`);
  
  // Step 4: Validate results
  console.log('\n✅ Step 4: Validating results...');
  
  const allChecks = check(null, {
    'Matrix API responds': () => afterAll.success,
    'Votes submitted successfully': () => totalVotesSuccessful > 0,
    'New CEW data points created': () => newCewDataPoints > 0,
    'Total data points increased': () => newAllDataPoints > 0,
  });
  
  if (allChecks) {
    console.log('\n🎉 SUCCESS: Matrix graph system is working correctly!');
    console.log(`✅ Submitted ${totalVotesSuccessful}/${totalVotesSubmitted} votes successfully`);
    console.log(`✅ Created ${newCewDataPoints} new CEW data points`);
    console.log(`✅ Total data points increased by ${newAllDataPoints}`);
  } else {
    console.log('\n❌ FAILURE: Matrix graph system is not working correctly');
    console.log(`❌ Votes successful: ${totalVotesSuccessful}/${totalVotesSubmitted}`);
    console.log(`❌ Expected new CEW data points: >0, got: ${newCewDataPoints}`);
    console.log(`❌ Expected total increase: >0, got: ${newAllDataPoints}`);
  }
  
  console.log('\n🏁 Test completed');
}

export function handleSummary(data) {
  return {
    'matrix-graph-fixed-test-results.json': JSON.stringify({
      timestamp: new Date().toISOString(),
      test_duration: data.state.testRunDurationMs,
      total_requests: data.metrics.http_reqs?.values?.count || 0,
      error_rate: data.metrics.http_req_failed?.values?.rate || 0,
      avg_response_time: data.metrics.http_req_duration?.values?.avg || 0,
    }, null, 2),
  };
}
