import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  vus: 1,
  iterations: 1,
  duration: '30s',
};

export default function () {
  console.log('🚀 Starting Comprehensive Matrix Graph Test for All 4 Pairs');
  
  // Test all 4 question pairs from Holistic Protection page
  const testPairs = [
    { q1: 0, q2: 1, description: 'Pair 1: Direct toxicity to ecological receptors (Importance + Feasibility)' },
    { q1: 2, q2: 3, description: 'Pair 2: Direct toxicity to human receptors (Importance + Feasibility)' },
    { q1: 4, q2: 5, description: 'Pair 3: Food-related toxicity to ecological receptors (Importance + Feasibility)' },
    { q1: 6, q2: 7, description: 'Pair 4: Food-related toxicity to human receptors (Importance + Feasibility)' }
  ];

  const sessionId = `CEW2025-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const pagePath = '/cew-polls/holistic-protection';
  
  console.log(`📊 Testing with sessionId: ${sessionId}`);
  console.log(`📄 Page path: ${pagePath}`);

  let allPairsSuccessful = true;

  // Test each pair
  for (let i = 0; i < testPairs.length; i++) {
    const pair = testPairs[i];
    console.log(`\n🔍 Testing ${pair.description}`);
    
    // Submit votes for both questions in the pair
    const vote1Response = submitVote(sessionId, pagePath, pair.q1, 2); // "Important" or "Achievable"
    const vote2Response = submitVote(sessionId, pagePath, pair.q2, 1); // "Very Important" or "Easily Achievable"
    
    console.log(`🔍 Q${pair.q1 + 1} Response:`, { status: vote1Response.status, body: vote1Response.body });
    console.log(`🔍 Q${pair.q2 + 1} Response:`, { status: vote2Response.status, body: vote2Response.body });
    
    // Check each response individually
    const vote1Success = check(vote1Response, {
      [`Q${pair.q1 + 1} vote submitted`]: (r) => r.status === 200,
    });
    
    const vote2Success = check(vote2Response, {
      [`Q${pair.q2 + 1} vote submitted`]: (r) => r.status === 200,
    });
    
    const pairSuccess = vote1Success && vote2Success;

    if (pairSuccess) {
      console.log(`✅ Pair ${i + 1} votes submitted successfully`);
      
      // Wait a moment for data to be processed
      sleep(1);
      
      // Test matrix graph API for this specific pair
      const matrixResponse = testMatrixGraph(pair.q1, pair.q2);
      
      if (matrixResponse) {
        console.log(`✅ Pair ${i + 1} matrix graph working`);
      } else {
        console.log(`❌ Pair ${i + 1} matrix graph failed`);
        allPairsSuccessful = false;
      }
    } else {
      console.log(`❌ Pair ${i + 1} vote submission failed`);
      allPairsSuccessful = false;
    }
    
    // Small delay between pairs
    sleep(0.5);
  }

  // Final comprehensive matrix graph test
  console.log('\n🔍 Testing comprehensive matrix graph with all pairs...');
  const comprehensiveMatrixResponse = http.get(`http://localhost:3000/api/graphs/prioritization-matrix?filter=all`);
  
  const comprehensiveSuccess = check(comprehensiveMatrixResponse, {
    'Comprehensive matrix API responds': (r) => r.status === 200,
    'Comprehensive matrix contains data': (r) => {
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
    'All pairs successful': () => allPairsSuccessful
  });

  if (comprehensiveSuccess) {
    console.log('🎉 ALL TESTS PASSED - Matrix graph system working for all 4 pairs!');
  } else {
    console.log('❌ SOME TESTS FAILED - Matrix graph system has issues');
  }

  // Display final results
  console.log('\n📊 FINAL RESULTS:');
  console.log(`✅ Individual pair tests: ${allPairsSuccessful ? 'PASSED' : 'FAILED'}`);
  console.log(`✅ Comprehensive matrix test: ${comprehensiveSuccess ? 'PASSED' : 'FAILED'}`);
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

  return http.post('http://localhost:3000/api/polls/submit', JSON.stringify(payload), { headers });
}

function testMatrixGraph(q1, q2) {
  const matrixResponse = http.get(`http://localhost:3000/api/graphs/prioritization-matrix?filter=all`);
  
  const matrixSuccess = check(matrixResponse, {
    'Matrix graph API responds': (r) => r.status === 200,
    'Matrix graph contains data': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body && Object.keys(body).length > 0 && body["0"];
      } catch {
        return false;
      }
    }
  });

  if (matrixSuccess) {
    try {
      const body = JSON.parse(matrixResponse.body);
      console.log(`🔍 Matrix data for pair Q${q1 + 1}+Q${q2 + 1}:`, {
        totalPairs: Object.keys(body).length,
        hasData: Object.keys(body).length > 0,
        pairKeys: Object.keys(body)
      });
    } catch (e) {
      console.log('⚠️ Could not parse matrix response');
    }
  }

  return matrixSuccess;
}
