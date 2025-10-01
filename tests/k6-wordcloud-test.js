// k6-wordcloud-test.js
// Focused k6 test for wordcloud questions only
// Tests wordcloud questions across all pages

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');

// Test configuration - focused on wordcloud questions
export const options = {
  scenarios: {
    // Scenario 1: Prioritization wordcloud question (Q5)
    prioritization_wordcloud: {
      executor: 'shared-iterations',
      iterations: 30, // 30 submissions
      vus: 5,
      exec: 'testPrioritizationWordcloud',
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

// Test Prioritization wordcloud question (Q5)
export function testPrioritizationWordcloud() {
  const authCode = generateCEWCode();
  const basePath = '/cew-polls/prioritization';
  const pollIndex = 4; // Question 5 is at poll_index 4
  
  // Predefined options for wordcloud question 5
  const predefinedOptions = [
    { display: "Data availability", keyword: "Data" },
    { display: "Tools (models, test protocols, decision trees)", keyword: "Tools" },
    { display: "Agreement on protection goals and spatial scale", keyword: "Agreement" },
    { display: "Resourcing (e.g., developing approach/tools, agreeing across peers)", keyword: "Resourcing" }
  ];

  // Additional custom words for variety
  const customWords = [
    "Funding", "Regulation", "Science", "Stakeholders", "Implementation", 
    "Guidance", "Standards", "Methodology", "Coordination", "Timeline",
    "Expertise", "Communication", "Validation", "Acceptance", "Complexity",
    "Policy", "Research", "Technology", "Training", "Resources"
  ];

  // Randomly choose between predefined option or custom word
  const usePredefined = Math.random() < 0.6; // 60% chance of using predefined
  
  let wordToSubmit;
  if (usePredefined) {
    const selectedOption = predefinedOptions[Math.floor(Math.random() * predefinedOptions.length)];
    wordToSubmit = selectedOption.keyword;
  } else {
    wordToSubmit = customWords[Math.floor(Math.random() * customWords.length)];
  }

  const response = http.post(`${BASE_URL}/api/wordcloud-polls/submit`, JSON.stringify({
    pagePath: basePath,
    pollIndex: pollIndex,
    question: "Overall, what is the greatest barrier to advancing holistic sediment protection in BC?",
    words: [wordToSubmit],
    authCode: authCode,
    maxWords: 1,
    wordLimit: 20
  }), { headers: getAuthHeaders() });

  const success = check(response, {
    'Prioritization Wordcloud Q5 status is 200': (r) => r.status === 200,
    'Prioritization Wordcloud Q5 response time < 2000ms': (r) => r.timings.duration < 2000,
    'Prioritization Wordcloud Q5 word submitted': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.success === true;
      } catch {
        return false;
      }
    }
  });

  if (!success || response.status !== 200) {
    console.error(`❌ Prioritization Wordcloud Q5 FAILED:`, {
      status: response.status,
      body: response.body,
      authCode: authCode,
      wordSubmitted: wordToSubmit
    });
    errorRate.add(1);
  } else {
    console.log(`✅ Prioritization Wordcloud Q5 word "${wordToSubmit}" submitted successfully with authCode: ${authCode}`);
  }
  
  sleep(0.5); // Short pause between submissions
}

// Setup function
export function setup() {
  console.log('Starting focused k6 wordcloud test...');
  console.log(`Base URL: ${BASE_URL}`);
  console.log('Test will cover wordcloud questions only:');
  console.log('- Prioritization: 1 wordcloud question (Q5, 30 submissions)');
  console.log('Total expected: 30 wordcloud submissions');
  return {};
}

// Teardown function
export function teardown(data) {
  console.log('Focused k6 wordcloud test completed');
  console.log('Check the admin panel to verify wordcloud responses increased');
  console.log('Expected: 30 total wordcloud submissions (prioritization only)');
}
