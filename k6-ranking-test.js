// k6-ranking-test.js
// Focused k6 test for ranking questions only
// Tests prioritization ranking questions (Q3-Q4) - holistic protection now has single-choice questions

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');

// Test configuration - focused on ranking questions
export const options = {
  scenarios: {
    // Scenario 1: Prioritization ranking questions (Q3-Q4)
    prioritization_ranking: {
      executor: 'shared-iterations',
      iterations: 20, // 20 submissions
      vus: 5,
      exec: 'testPrioritizationRanking',
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<2000'], // 95% of requests under 2s
    http_req_failed: ['rate<0.1'],     // <10% failure rate
    errors: ['rate<0.05'],             // <5% application errors
  },
};

// Base configuration
const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

// Authentication helper
function getAuthHeaders() {
  return {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  };
}

// Generate unique CEW auth code for diversity
function generateCEWCode() {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 1000);
  return `CEW2025-${timestamp}-${random}`;
}

// Note: Holistic Protection now has single-choice questions, not ranking questions
// This test now focuses only on Prioritization ranking questions

// Test Prioritization ranking questions (Q3-Q4, moved from original Q11-Q12)
export function testPrioritizationRanking() {
  const authCode = generateCEWCode();
  const basePath = '/cew-polls/prioritization';
  
  const rankingQuestions = [
    {
      pollIndex: 2, // Now Q3 (was Q11)
      question: "To help focus development of matrix standards, please rank the four actions below for the degree to which they would improve development of the standards (1 = top priority; 4 = lowest priority).",
      options: [
        "Developing the technical approach to define what \"direct toxicity\" and \"food pathway toxicity\" mean for the framework.",
        "Determining what approach ENV should take to develop human health standards, given there are other agencies working on like standards.",
        "Developing the technical approach to address how matrix standards would be applied in a spatial context (e.g., over what spatial areas, for what depths, etc.).",
        "Determining if environmental sensitivity should be factored into matrix standards for ecological health."
      ]
    },
    {
      pollIndex: 3, // Now Q4 (was Q12)
      question: "Of the four options below, what focus will provide greatest value to holistic sediment management in BC? (1 = top priority; 4 = lowest priority)",
      options: [
        "Selecting and using models and other tools to help develop Site-Specific Sediment Standards (Tier 2) for ecological health (these would include, for example, acid volatile sulphides/simultaneously extractable metals (AVS/SEM), equilibrium partitioning (EqP), target lipid model)",
        "Selecting and using approaches to develop Sediment Standards for contaminants with an analogue (e.g., quantitative structure-activity relationship (QSAR))",
        "Developing guidance and/or framework to use site-specific toxicity testing to evaluate the risks of mixtures to ecological receptors.",
        "Developing models and/or approaches to derive mixture-specific sediment standards for ecological receptors (e.g., for water quality, there are biotic ligand models for metals mixtures)."
      ]
    }
  ];

  rankingQuestions.forEach(q => {
    const rankings = [1, 2, 3, 4].sort(() => Math.random() - 0.5); // Shuffle rankings
    // Convert to the format expected by the API: array of {optionIndex, rank} objects
    const rankingsData = rankings.map((rank, index) => ({
      optionIndex: index,
      rank: rank
    }));
    
    const response = http.post(`${BASE_URL}/api/ranking-polls/submit`, JSON.stringify({
      pagePath: basePath,
      pollIndex: q.pollIndex,
      question: q.question,
      options: q.options,
      rankings: rankingsData,
      authCode: authCode
    }), { headers: getAuthHeaders() });

    const success = check(response, {
      [`Prioritization Q${q.pollIndex + 1} status is 200`]: (r) => r.status === 200,
      [`Prioritization Q${q.pollIndex + 1} response time < 2000ms`]: (r) => r.timings.duration < 2000,
    });

    if (!success || response.status !== 200) {
      console.error(`❌ Prioritization Q${q.pollIndex + 1} FAILED:`, {
        status: response.status,
        body: response.body,
        authCode: authCode,
        rankingsData: JSON.stringify(rankingsData)
      });
      errorRate.add(1);
    } else {
      console.log(`✅ Prioritization Q${q.pollIndex + 1} ranking submitted successfully with authCode: ${authCode}`);
    }
    
    sleep(0.5); // Short pause between questions
  });
}

// Setup function
export function setup() {
  console.log('Starting focused k6 ranking test...');
  console.log(`Base URL: ${BASE_URL}`);
  console.log('Test will cover ranking questions only:');
  console.log('- Prioritization: 2 ranking questions (Q3-Q4, 20 submissions each)');
  console.log('Total expected: 40 ranking submissions');
  return {};
}

// Teardown function
export function teardown(data) {
  console.log('Focused k6 ranking test completed');
  console.log('Check the admin panel to verify ranking responses increased');
  console.log('Expected: 40 total ranking submissions (prioritization only)');
}