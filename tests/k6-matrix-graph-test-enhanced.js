// k6-matrix-graph-test-enhanced.js
// Enhanced k6 test specifically for matrix graph testing
// Focus: Paired responses (Q1+Q2, Q3+Q4, Q5+Q6, Q7+Q8) with varied distributions
// Goal: Create interesting clustering patterns and skewed distributions for visualization testing

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const responseTime = new Trend('response_time');
const matrixPairRate = new Rate('matrix_pairs_submitted');
const clusteringPatternRate = new Counter('clustering_patterns');

// Test configuration - 50 users for matrix graph testing
export const options = {
  scenarios: {
    matrix_graph_testing: {
      executor: 'ramping-vus',
      startVUs: 1,
      stages: [
        { duration: '30s', target: 10 },    // Ramp to 10 users
        { duration: '1m', target: 25 },     // Ramp to 25 users  
        { duration: '2m', target: 50 },     // Ramp to 50 users (peak testing)
        { duration: '1m', target: 50 },     // Sustain 50 users
        { duration: '30s', target: 0 },     // Ramp down
      ],
      exec: 'testMatrixGraphsWithVariedDistributions',
    },
  },
  
  // Mobile device simulation headers
  headers: {
    'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.5',
    'Accept-Encoding': 'gzip, deflate',
    'Connection': 'keep-alive',
    'Upgrade-Insecure-Requests': '1',
  },
  
  // Performance thresholds
  thresholds: {
    http_req_duration: ['p(95)<2000'], // 95% of requests under 2s
    http_req_failed: ['rate<0.05'],    // Less than 5% failed requests
    errors: ['rate<0.02'],             // Less than 2% errors
    matrix_pairs_submitted: ['rate>0.95'], // At least 95% matrix pairs succeed
  },
};

// Base URL configuration
const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

// CEW2025 authentication code (consistent for all users)
const CEW_AUTH_CODE = 'CEW2025';

// Generate unique user ID for each virtual user
function generateUniqueCEWUserId() {
  const timestamp = Date.now();
  const vuId = __VU; // Virtual user ID
  const iteration = __ITER;
  const random = Math.floor(Math.random() * 10000);
  return `CEW2025-${vuId}-${iteration}-${random}`;
}

// Matrix Graph Test with Varied Distributions
export function testMatrixGraphsWithVariedDistributions() {
  // CRITICAL: Generate ONE user ID per session (stays constant for ALL questions)
  const userId = generateUniqueCEWUserId();
  
  console.log(`🎯 Matrix Graph User ${__VU}: Starting paired response test with ID: ${userId}`);
  
  // Test Holistic Protection with ALL 8 questions (4 matrix pairs)
  testHolisticProtectionMatrixPairs(userId);
  
  // Mobile user behavior simulation
  sleep(0.5 + Math.random() * 1.5);
  
  console.log(`✅ Matrix Graph User ${__VU}: Completed all matrix pair tests`);
}

// Test Holistic Protection Matrix Pairs with Varied Distributions
function testHolisticProtectionMatrixPairs(userId) {
  const pagePath = '/cew-polls/holistic-protection';
  console.log(`📊 User ${userId}: Testing Holistic Protection matrix pairs with varied distributions`);
  
  // Define matrix pairs with varied distribution patterns
  const matrixPairs = [
    // Matrix 1: Q1+Q2 (Ecosystem Health - Direct Toxicity)
    {
      pairName: "Ecosystem Health - Direct Toxicity",
      importanceQuestion: {
        question: "Rank the importance of updating CSR sediment standards for direct toxicity to ecological receptors (matrix standards, possibly based on SSDs). (1 = very important to 5 = not important)",
        options: ["Very Important", "Important", "Moderately Important", "Less Important", "Not Important"],
        poll_index: 0
      },
      feasibilityQuestion: {
        question: "Rank the feasibility of updating CSR sediment standards for direct toxicity to ecological receptors (matrix standards, possibly based on SSDs). (1 = easily achievable to 5 = not feasible)",
        options: ["Easily Achievable", "Achievable", "Moderately Achievable", "Difficult", "Not Feasible"],
        poll_index: 1
      },
      distributionPattern: "high_priority_cluster" // Most users in top-right quadrant
    },
    
    // Matrix 2: Q3+Q4 (Human Health - Direct Toxicity)
    {
      pairName: "Human Health - Direct Toxicity",
      importanceQuestion: {
        question: "Rank the importance of updating CSR sediment standards for direct toxicity to human health (matrix standards, possibly based on SSDs). (1 = very important to 5 = not important)",
        options: ["Very Important", "Important", "Moderately Important", "Less Important", "Not Important"],
        poll_index: 2
      },
      feasibilityQuestion: {
        question: "Rank the feasibility of updating CSR sediment standards for direct toxicity to human health (matrix standards, possibly based on SSDs). (1 = easily achievable to 5 = not feasible)",
        options: ["Easily Achievable", "Achievable", "Moderately Achievable", "Difficult", "Not Feasible"],
        poll_index: 3
      },
      distributionPattern: "scattered_distribution" // Spread across all quadrants
    },
    
    // Matrix 3: Q5+Q6 (Ecosystem Health - Food-Related)
    {
      pairName: "Ecosystem Health - Food-Related",
      importanceQuestion: {
        question: "Rank the importance of updating CSR sediment standards for food-related effects to ecological receptors (tissue-based standards, possibly based on SSDs). (1 = very important to 5 = not important)",
        options: ["Very Important", "Important", "Moderately Important", "Less Important", "Not Important"],
        poll_index: 4
      },
      feasibilityQuestion: {
        question: "Rank the feasibility of updating CSR sediment standards for food-related effects to ecological receptors (tissue-based standards, possibly based on SSDs). (1 = easily achievable to 5 = not feasible)",
        options: ["Easily Achievable", "Achievable", "Moderately Achievable", "Difficult", "Not Feasible"],
        poll_index: 5
      },
      distributionPattern: "longer_term_cluster" // Most users in top-left quadrant
    },
    
    // Matrix 4: Q7+Q8 (Human Health - Food-Related)
    {
      pairName: "Human Health - Food-Related",
      importanceQuestion: {
        question: "Rank the importance of updating CSR sediment standards for food-related effects to human health (tissue-based standards, possibly based on SSDs). (1 = very important to 5 = not important)",
        options: ["Very Important", "Important", "Moderately Important", "Less Important", "Not Important"],
        poll_index: 6
      },
      feasibilityQuestion: {
        question: "Rank the feasibility of updating CSR sediment standards for food-related effects to human health (tissue-based standards, possibly based on SSDs). (1 = easily achievable to 5 = not feasible)",
        options: ["Easily Achievable", "Achievable", "Moderately Achievable", "Difficult", "Not Feasible"],
        poll_index: 7
      },
      distributionPattern: "no_go_cluster" // Most users in bottom-left quadrant
    }
  ];
  
  // Submit votes for each matrix pair with varied distributions
  matrixPairs.forEach((pair, pairIndex) => {
    console.log(`🎯 User ${userId}: Testing ${pair.pairName} (Matrix ${pairIndex + 1})`);
    
    // Generate varied vote distributions based on pattern
    const { importanceVote, feasibilityVote } = generateVariedVotes(pair.distributionPattern, __VU, pairIndex);
    
    // Submit importance vote (Q1, Q3, Q5, or Q7)
    const importanceSuccess = submitSingleChoiceVote(
      userId, 
      pagePath, 
      pair.importanceQuestion.poll_index, 
      importanceVote, 
      pair.importanceQuestion.question, 
      pair.importanceQuestion.options
    );
    
    // Small delay between importance and feasibility votes
    sleep(0.2 + Math.random() * 0.3);
    
    // Submit feasibility vote (Q2, Q4, Q6, or Q8)
    const feasibilitySuccess = submitSingleChoiceVote(
      userId, 
      pagePath, 
      pair.feasibilityQuestion.poll_index, 
      feasibilityVote, 
      pair.feasibilityQuestion.question, 
      pair.feasibilityQuestion.options
    );
    
    // Track success
    if (importanceSuccess && feasibilitySuccess) {
      matrixPairRate.add(1);
      clusteringPatternRate.add(1, { pattern: pair.distributionPattern });
      console.log(`✅ User ${userId}: ${pair.pairName} pair submitted (I:${importanceVote+1}, F:${feasibilityVote+1})`);
    } else {
      console.log(`❌ User ${userId}: ${pair.pairName} pair failed`);
    }
    
    // Mobile user behavior - pause between matrix pairs
    sleep(0.5 + Math.random() * 1.0);
  });
}

// Generate varied vote distributions for different clustering patterns
function generateVariedVotes(pattern, vuId, pairIndex) {
  const random = Math.random();
  
  switch (pattern) {
    case "high_priority_cluster":
      // Top-right quadrant: High importance + High feasibility
      // 70% chance of being in top-right, 30% scattered
      if (random < 0.7) {
        return {
          importanceVote: Math.floor(Math.random() * 2), // 0-1 (Very Important, Important)
          feasibilityVote: Math.floor(Math.random() * 2) // 0-1 (Easily Achievable, Achievable)
        };
      } else {
        return {
          importanceVote: Math.floor(Math.random() * 5),
          feasibilityVote: Math.floor(Math.random() * 5)
        };
      }
      
    case "scattered_distribution":
      // Spread across all quadrants with some clustering
      // 40% top-right, 20% top-left, 20% bottom-right, 20% bottom-left
      if (random < 0.4) {
        // Top-right
        return {
          importanceVote: Math.floor(Math.random() * 2),
          feasibilityVote: Math.floor(Math.random() * 2)
        };
      } else if (random < 0.6) {
        // Top-left
        return {
          importanceVote: Math.floor(Math.random() * 2),
          feasibilityVote: 2 + Math.floor(Math.random() * 3) // 2-4 (Moderately Achievable to Not Feasible)
        };
      } else if (random < 0.8) {
        // Bottom-right
        return {
          importanceVote: 2 + Math.floor(Math.random() * 3), // 2-4 (Moderately Important to Not Important)
          feasibilityVote: Math.floor(Math.random() * 2)
        };
      } else {
        // Bottom-left
        return {
          importanceVote: 2 + Math.floor(Math.random() * 3),
          feasibilityVote: 2 + Math.floor(Math.random() * 3)
        };
      }
      
    case "longer_term_cluster":
      // Top-left quadrant: High importance + Low feasibility
      // 60% chance of being in top-left, 40% scattered
      if (random < 0.6) {
        return {
          importanceVote: Math.floor(Math.random() * 2), // 0-1 (Very Important, Important)
          feasibilityVote: 2 + Math.floor(Math.random() * 3) // 2-4 (Moderately Achievable to Not Feasible)
        };
      } else {
        return {
          importanceVote: Math.floor(Math.random() * 5),
          feasibilityVote: Math.floor(Math.random() * 5)
        };
      }
      
    case "no_go_cluster":
      // Bottom-left quadrant: Low importance + Low feasibility
      // 50% chance of being in bottom-left, 50% scattered
      if (random < 0.5) {
        return {
          importanceVote: 2 + Math.floor(Math.random() * 3), // 2-4 (Moderately Important to Not Important)
          feasibilityVote: 2 + Math.floor(Math.random() * 3) // 2-4 (Moderately Achievable to Not Feasible)
        };
      } else {
        return {
          importanceVote: Math.floor(Math.random() * 5),
          feasibilityVote: Math.floor(Math.random() * 5)
        };
      }
      
    default:
      // Random distribution
      return {
        importanceVote: Math.floor(Math.random() * 5),
        feasibilityVote: Math.floor(Math.random() * 5)
      };
  }
}

// Submit single choice vote
function submitSingleChoiceVote(userId, pagePath, pollIndex, optionIndex, question, options) {
  const payload = {
    pagePath: pagePath,
    pollIndex: pollIndex,
    optionIndex: optionIndex,
    question: question,
    options: options,
    authCode: CEW_AUTH_CODE
  };
  
  const response = http.post(`${BASE_URL}/api/polls/submit`, JSON.stringify(payload), {
    headers: {
      'Content-Type': 'application/json',
      'x-session-id': userId  // CRITICAL: API uses this for user_id generation
    },
  });
  
  const success = check(response, {
    'single choice vote submitted': (r) => r.status === 200,
    'response time < 2000ms': (r) => r.timings.duration < 2000,
  });
  
  if (!success) {
    errorRate.add(1);
    console.log(`❌ Vote submission failed for user ${userId}, poll ${pollIndex}: ${response.status} ${response.body}`);
  }
  
  responseTime.add(response.timings.duration);
  return success;
}
