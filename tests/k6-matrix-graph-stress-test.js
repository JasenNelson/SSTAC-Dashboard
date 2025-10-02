import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  vus: 10, // 10 virtual users
  iterations: 20, // 20 iterations total (2 per user)
  duration: '60s',
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

export default function () {
  console.log('🚀 Starting Matrix Graph Stress Test with Multiple Votes');
  
  // Test all 4 question pairs from Holistic Protection page
  const testPairs = [
    { q1: 0, q2: 1, description: 'Pair 1: Direct toxicity to ecological receptors' },
    { q1: 2, q2: 3, description: 'Pair 2: Direct toxicity to human receptors' },
    { q1: 4, q2: 5, description: 'Pair 3: Food-related toxicity to ecological receptors' },
    { q1: 6, q2: 7, description: 'Pair 4: Food-related toxicity to human receptors' }
  ];

  // Generate unique session ID for each virtual user
  const sessionId = `CEW2025-${__VU}-${__ITER}-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
  const pagePath = '/cew-polls/holistic-protection';
  
  console.log(`📊 VU ${__VU} - Testing with sessionId: ${sessionId}`);

  // Test each pair with random vote combinations
  for (let i = 0; i < testPairs.length; i++) {
    const pair = testPairs[i];
    console.log(`\n📝 VU ${__VU} - Testing ${pair.description}`);
    
    // Generate random vote combinations to test different scenarios
    const importanceVote = Math.floor(Math.random() * 5); // 0-4 (Very Important to Not Important)
    const feasibilityVote = Math.floor(Math.random() * 5); // 0-4 (Easily Achievable to Not Feasible)
    
    // Submit votes for both questions in the pair
    const vote1Response = submitVote(sessionId, pagePath, pair.q1, importanceVote);
    const vote2Response = submitVote(sessionId, pagePath, pair.q2, feasibilityVote);
    
    console.log(`🔍 VU ${__VU} - Q${pair.q1 + 1} (Importance: ${importanceVote}) Response:`, { 
      status: vote1Response.status, 
      body: vote1Response.body 
    });
    console.log(`🔍 VU ${__VU} - Q${pair.q2 + 1} (Feasibility: ${feasibilityVote}) Response:`, { 
      status: vote2Response.status, 
      body: vote2Response.body 
    });
    
    // Check each response individually
    const vote1Success = check(vote1Response, {
      [`VU ${__VU} Q${pair.q1 + 1} vote submitted`]: (r) => r.status === 200,
    });
    
    const vote2Success = check(vote2Response, {
      [`VU ${__VU} Q${pair.q2 + 1} vote submitted`]: (r) => r.status === 200,
    });
    
    const pairSuccess = vote1Success && vote2Success;
    
    if (pairSuccess) {
      console.log(`✅ VU ${__VU} - Pair ${i + 1} votes submitted successfully`);
    } else {
      console.log(`❌ VU ${__VU} - Pair ${i + 1} vote submission failed`);
    }
    
    // Small delay between pairs
    sleep(0.2);
  }

  // Test matrix graph API after all votes
  console.log(`\n🔍 VU ${__VU} - Testing matrix graph API...`);
  const matrixResponse = testMatrixGraph();
  
  if (matrixResponse) {
    console.log(`✅ VU ${__VU} - Matrix graph API working`);
  } else {
    console.log(`❌ VU ${__VU} - Matrix graph API failed`);
  }
}

function submitVote(sessionId, pagePath, pollIndex, optionIndex) {
  // Get the question data for the specific poll index
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
    },
    {
      pollIndex: 2,
      question: "Rank the importance of updating CSR sediment standards for direct toxicity to human receptors (matrix standards, possibly based on SSDs). (1 = very important to 5 = not important)",
      options: ["Very Important", "Important", "Moderately Important", "Less Important", "Not Important"]
    },
    {
      pollIndex: 3,
      question: "Rank the feasibility of updating CSR sediment standards for direct toxicity to human receptors (matrix standards, possibly based on SSDs). (1 = easily achievable to 5 = not feasible)",
      options: ["Easily Achievable", "Achievable", "Moderately Achievable", "Difficult", "Not Feasible"]
    },
    {
      pollIndex: 4,
      question: "Rank the importance of updating CSR sediment standards for food-related toxicity to ecological receptors (matrix standards, possibly based on SSDs). (1 = very important to 5 = not important)",
      options: ["Very Important", "Important", "Moderately Important", "Less Important", "Not Important"]
    },
    {
      pollIndex: 5,
      question: "Rank the feasibility of updating CSR sediment standards for food-related toxicity to ecological receptors (matrix standards, possibly based on SSDs). (1 = easily achievable to 5 = not feasible)",
      options: ["Easily Achievable", "Achievable", "Moderately Achievable", "Difficult", "Not Feasible"]
    },
    {
      pollIndex: 6,
      question: "Rank the importance of updating CSR sediment standards for food-related toxicity to human receptors (matrix standards, possibly based on SSDs). (1 = very important to 5 = not important)",
      options: ["Very Important", "Important", "Moderately Important", "Less Important", "Not Important"]
    },
    {
      pollIndex: 7,
      question: "Rank the feasibility of updating CSR sediment standards for food-related toxicity to human receptors (matrix standards, possibly based on SSDs). (1 = easily achievable to 5 = not feasible)",
      options: ["Easily Achievable", "Achievable", "Moderately Achievable", "Difficult", "Not Feasible"]
    }
  ];

  const questionData = questions.find(q => q.pollIndex === pollIndex);
  if (!questionData) {
    console.log(`❌ No question data found for poll index ${pollIndex}`);
    return { status: 400, body: 'Question not found' };
  }

  const payload = {
    pagePath: pagePath,
    pollIndex: pollIndex,
    optionIndex: optionIndex,
    question: questionData.question,
    options: questionData.options,
    authCode: 'CEW2025'
  };

  const headers = {
    'Content-Type': 'application/json',
    'x-session-id': sessionId
  };

  return http.post(`${BASE_URL}/api/polls/submit`, JSON.stringify(payload), { headers });
}

function testMatrixGraph() {
  const matrixResponse = http.get(`${BASE_URL}/api/graphs/prioritization-matrix?filter=all`);
  
  const matrixSuccess = check(matrixResponse, {
    'Matrix graph API responds': (r) => r.status === 200,
    'Matrix graph contains data': (r) => {
      try {
        const body = JSON.parse(r.body);
        const hasData = body && Object.keys(body).length > 0 && body["0"];
        
        if (hasData) {
          console.log(`🔍 VU ${__VU} - Matrix data summary:`, {
            totalPairs: Object.keys(body).length,
            pairKeys: Object.keys(body),
            firstPairData: body["0"] ? {
              title: body["0"].title,
              responses: body["0"].responses,
              avgImportance: body["0"].avgImportance,
              avgFeasibility: body["0"].avgFeasibility
            } : 'No data'
          });
        }
        
        return hasData;
      } catch {
        return false;
      }
    }
  });

  return matrixSuccess;
}

// Setup function
export function setup() {
  console.log('🔍 Starting matrix graph stress test with multiple votes...');
  console.log(`Base URL: ${BASE_URL}`);
  console.log('Testing: 10 VUs, 20 iterations total (2 per user) = 40 vote sets per pair');
  console.log('Expected: 160 total votes across all 4 pairs');
  return {};
}

// Teardown function
export function teardown(data) {
  console.log('✅ Matrix graph stress test completed');
  console.log('Check matrix graphs to verify data points are properly distributed');
  console.log('Expected: Multiple data points per pair showing different vote combinations');
}
