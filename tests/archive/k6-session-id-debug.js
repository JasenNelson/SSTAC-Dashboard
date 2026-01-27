import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  vus: 1,
  iterations: 1,
  duration: '30s',
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

export default function () {
  console.log('🔍 Testing Session ID consistency across multiple votes');
  
  // Test the same session ID across multiple votes to see if they're being paired
  const sessionId = `CEW2025-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
  const pagePath = '/cew-polls/holistic-protection';
  
  console.log(`📊 Testing with sessionId: ${sessionId}`);
  
  // Submit multiple votes with the same session ID
  const votes = [
    { pollIndex: 0, optionIndex: 0 }, // Q1: Very Important
    { pollIndex: 1, optionIndex: 1 }, // Q2: Achievable
    { pollIndex: 0, optionIndex: 2 }, // Q1: Moderately Important (different vote)
    { pollIndex: 1, optionIndex: 3 }, // Q2: Difficult (different vote)
  ];
  
  for (let i = 0; i < votes.length; i++) {
    const vote = votes[i];
    console.log(`\n📝 Vote ${i + 1}: Poll ${vote.pollIndex}, Option ${vote.optionIndex}`);
    
    const response = submitVote(sessionId, pagePath, vote.pollIndex, vote.optionIndex);
    
    console.log(`🔍 Response:`, { 
      status: response.status, 
      body: response.body 
    });
    
    const success = check(response, {
      [`Vote ${i + 1} submitted`]: (r) => r.status === 200,
    });
    
    if (success) {
      console.log(`✅ Vote ${i + 1} submitted successfully`);
    } else {
      console.log(`❌ Vote ${i + 1} failed`);
    }
    
    sleep(1);
  }
  
  // Test matrix graph API to see if multiple votes are paired
  console.log(`\n🔍 Testing matrix graph API...`);
  const matrixResponse = http.get(`${BASE_URL}/api/graphs/prioritization-matrix?filter=all`);
  
  const matrixSuccess = check(matrixResponse, {
    'Matrix graph API responds': (r) => r.status === 200,
    'Matrix graph contains data': (r) => {
      try {
        const body = JSON.parse(r.body);
        const hasData = body && Object.keys(body).length > 0 && body["0"];
        
        if (hasData) {
          console.log(`🔍 Matrix data summary:`, {
            totalPairs: Object.keys(body).length,
            pairKeys: Object.keys(body),
            firstPairData: body["0"] ? {
              title: body["0"].title,
              responses: body["0"].responses,
              avgImportance: body["0"].avgImportance,
              avgFeasibility: body["0"].avgFeasibility,
              individualPairs: body["0"].individualPairs ? body["0"].individualPairs.length : 0
            } : 'No data'
          });
        }
        
        return hasData;
      } catch {
        return false;
      }
    }
  });
  
  if (matrixSuccess) {
    console.log(`✅ Matrix graph API working`);
  } else {
    console.log(`❌ Matrix graph API failed`);
  }
}

function submitVote(sessionId, pagePath, pollIndex, optionIndex) {
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

export function setup() {
  console.log('🔍 Starting session ID debug test...');
  console.log(`Base URL: ${BASE_URL}`);
  console.log('Testing: Same session ID across multiple votes');
  console.log('Expected: Multiple votes should create multiple data points in matrix graph');
  return {};
}

export function teardown(data) {
  console.log('✅ Session ID debug test completed');
  console.log('Check matrix graphs to verify multiple data points from same session');
}
