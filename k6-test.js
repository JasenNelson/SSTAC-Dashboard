// k6-comprehensive-poll-test.js
// Comprehensive k6 load test for SSTAC Dashboard Poll System
// Tests all questions across all pages with focus on wordcloud question 13

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');

// Test configuration - adjust based on needs
export const options = {
  scenarios: {
    // Scenario 1: General poll testing across all pages
    general_polls: {
      executor: 'ramping-vus',
      startVUs: 1,
      stages: [
        { duration: '30s', target: 5 },   // Ramp up
        { duration: '2m', target: 20 },   // Stay at 20 users
        { duration: '30s', target: 0 },   // Ramp down
      ],
      exec: 'testAllPolls',
    },
    
    // Scenario 2: Focused test for wordcloud question 5 - 50 responses
    wordcloud_q5_focus: {
      executor: 'shared-iterations',
      iterations: 50,
      vus: 10,
      exec: 'testWordcloudQuestion5Focus',
      startTime: '10s', // Start after general polling begins
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

// Authentication helper for survey pages (if needed)
function getAuthHeaders() {
  // For CEW polls, no auth headers needed
  return {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  };
}

// Generate random CEW auth code for diversity
function generateCEWCode() {
  const codes = ['CEW2025', 'CEW2025-A', 'CEW2025-B', 'CEW2025-C'];
  return codes[Math.floor(Math.random() * codes.length)];
}

// Generate unique user ID for wordcloud submissions to avoid duplicates
function generateUniqueUserId() {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 1000);
  return `CEW2025-${timestamp}-${random}`;
}

// Holistic Protection Questions (8 single-choice questions)
function testHolisticProtection(authCode) {
  const basePath = '/cew-polls/holistic-protection';
  
  const singleChoiceQuestions = [
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
      question: "Rank the importance of developing CSR sediment standards for direct toxicity to human receptors (matrix standards). (1 = very important to 5 = not important)",
      options: ["Very Important", "Important", "Moderately Important", "Less Important", "Not Important"]
    },
    {
      pollIndex: 3,
      question: "Rank the feasibility of developing CSR sediment standards for direct toxicity to human receptors (matrix standards). (1 = easily achievable to 5 = not feasible)",
      options: ["Easily Achievable", "Achievable", "Moderately Achievable", "Difficult", "Not Feasible"]
    },
    {
      pollIndex: 4,
      question: "Rank the importance of developing new CSR sediment standards for food-related toxicity to ecological receptors. (1 = very important to 5 = not important)",
      options: ["Very Important", "Important", "Moderately Important", "Less Important", "Not Important"]
    },
    {
      pollIndex: 5,
      question: "Rank the feasibility of developing new CSR sediment standards for food-related toxicity to ecological receptors. (1 = easily achievable to 5 = not feasible)",
      options: ["Easily Achievable", "Achievable", "Moderately Achievable", "Difficult", "Not Feasible"]
    },
    {
      pollIndex: 6,
      question: "Rank the importance of developing CSR sediment standards for food-related toxicity to human receptors. (1 = very important to 5 = not important)",
      options: ["Very Important", "Important", "Moderately Important", "Less Important", "Not Important"]
    },
    {
      pollIndex: 7,
      question: "Rank the feasibility of developing CSR sediment standards for food-related toxicity to human receptors. (1 = easily achievable to 5 = not feasible)",
      options: ["Easily Achievable", "Achievable", "Moderately Achievable", "Difficult", "Not Feasible"]
    }
  ];

  singleChoiceQuestions.forEach(q => {
    const response = http.post(`${BASE_URL}/api/polls/submit`, JSON.stringify({
      pagePath: basePath,
      pollIndex: q.pollIndex,
      question: q.question,
      options: q.options,
      optionIndex: Math.floor(Math.random() * q.options.length),
      authCode: authCode
    }), { headers: getAuthHeaders() });

    check(response, {
      [`Holistic Q${q.pollIndex + 1} status is 200`]: (r) => r.status === 200,
      [`Holistic Q${q.pollIndex + 1} response time < 2000ms`]: (r) => r.timings.duration < 2000,
    }) || errorRate.add(1);
  });
}

// Wordcloud Question 5 - Prioritization wordcloud
function testWordcloudQuestion5(authCode) {
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
    "Expertise", "Communication", "Validation", "Acceptance", "Complexity"
  ];

  // Generate unique user ID to avoid duplicate word submissions
  const uniqueUserId = generateUniqueUserId();
  
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
    authCode: uniqueUserId, // Use unique ID to allow multiple submissions
    maxWords: 1,
    wordLimit: 20
  }), { headers: getAuthHeaders() });

  check(response, {
    'Wordcloud Q5 status is 200': (r) => r.status === 200,
    'Wordcloud Q5 response time < 2000ms': (r) => r.timings.duration < 2000,
    'Wordcloud Q5 word submitted': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.success === true;
      } catch {
        return false;
      }
    }
  }) || errorRate.add(1);

  console.log(`Wordcloud Q5 submission: "${wordToSubmit}" by user ${uniqueUserId}`);
}

// Tiered Framework Questions (3 single-choice questions)
function testTieredFramework(authCode) {
  const basePath = '/cew-polls/tiered-framework';
  
  const questions = [
    {
      pollIndex: 0,
      question: "What is the primary regulatory advantage of using a probabilistic framework (e.g., Bayesian) to integrate EqP and BLM predictions into a scientific framework for deriving site-specific sediment standards (Tier 2)?",
      options: [
        "It provides a formal structure for quantifying and communicating uncertainty in the final standard.",
        "It allows for the systematic integration of existing literature data as priors, reducing site-specific data needs.",
        "It produces a full risk distribution rather than a single point value, allowing for more flexible management decisions.",
        "It improves the technical defensibility by making all assumptions (priors, model structure) explicit",
        "Other"
      ]
    },
    {
      pollIndex: 1,
      question: "In developing a probabilistic framework for deriving site-specific sediment standards (Tier 2), which data type is most critical for effectively narrowing the uncertainty of the final risk estimate?",
      options: [
        "A large number of sediment chemistry samples to better characterize spatial heterogeneity.",
        "High-quality, in-situ passive sampling data to directly measure and constrain bioavailable concentrations.",
        "Site-specific toxicity testing data to develop more relevant priors for the dose-response relationship.",
        "Detailed measurements of secondary geochemical parameters (e.g., black carbon, iron oxides) that influence partitioning.",
        "Other"
      ]
    },
    {
      pollIndex: 2,
      question: "What is the biggest practical hurdle to overcome when implementing a Bayesian framework in the development of a scientific framework for deriving site-specific sediment standards (Tier 2)?",
      options: [
        "Defining appropriate priors, especially when site-specific information is sparse and literature values vary widely",
        "The high level of statistical expertise required by both the practitioner and the regulatory reviewer to ensure proper application.",
        "The challenge of communicating probabilistic outputs (e.g., posterior distributions) to non-technical stakeholders and decision-makers.",
        "The lack of standardized software and guidance, leading to potential inconsistencies across different site assessments.",
        "Other"
      ]
    }
  ];

  questions.forEach(q => {
    const response = http.post(`${BASE_URL}/api/polls/submit`, JSON.stringify({
      pagePath: basePath,
      pollIndex: q.pollIndex,
      question: q.question,
      options: q.options,
      optionIndex: Math.floor(Math.random() * q.options.length),
      authCode: authCode
    }), { headers: getAuthHeaders() });

    check(response, {
      [`Tiered Q${q.pollIndex + 1} status is 200`]: (r) => r.status === 200,
      [`Tiered Q${q.pollIndex + 1} response time < 2000ms`]: (r) => r.timings.duration < 2000,
    }) || errorRate.add(1);
  });
}

// Prioritization Questions (2 single-choice + 2 ranking + 1 wordcloud)
function testPrioritization(authCode) {
  const basePath = '/cew-polls/prioritization';
  
  // Questions 1-2: Single-choice polls (site-specific standards)
  const singleChoiceQuestions = [
    {
      pollIndex: 0,
      question: "Rank the importance of developing a framework for deriving site-specific sediment standards, based on bioavailability adjustment, to provide an enhanced numerical assessment option (Tier 2), between generic numerical (Tier 1) and risk-based (Tier 3) assessments. (1 = very important to 5 = not important)",
      options: ["Very Important", "Important", "Moderately Important", "Less Important", "Not Important"]
    },
    {
      pollIndex: 1,
      question: "Rank the feasibility of developing the framework for deriving site-specific sediment standards, based on an integrated approach using Equilibrium Partitioning and Biotic Ligand Models. (1 = easily achievable to 5 = not feasible)",
      options: ["Easily Achievable", "Achievable", "Moderately Achievable", "Difficult", "Not Feasible"]
    }
  ];

  // Submit single-choice questions 1-2
  singleChoiceQuestions.forEach(q => {
    const response = http.post(`${BASE_URL}/api/polls/submit`, JSON.stringify({
      pagePath: basePath,
      pollIndex: q.pollIndex,
      question: q.question,
      options: q.options,
      optionIndex: Math.floor(Math.random() * q.options.length),
      authCode: authCode
    }), { headers: getAuthHeaders() });

    check(response, {
      [`Prioritization Q${q.pollIndex + 1} status is 200`]: (r) => r.status === 200,
      [`Prioritization Q${q.pollIndex + 1} response time < 2000ms`]: (r) => r.timings.duration < 2000,
    }) || errorRate.add(1);
  });

  // Questions 3-4: Ranking polls
  const rankingQuestions = [
    {
      pollIndex: 2,
      question: "To help focus development of matrix standards, please rank the four actions below for the degree to which they would improve development of the standards (1 = top priority; 4 = lowest priority). If you do not know or have an opinion, do not respond to any given question.",
      options: [
        "Developing the technical approach to define what \"direct toxicity\" and \"food pathway toxicity\" mean for the framework.",
        "Determining what approach ENV should take to develop human health standards, given there are other agencies working on like standards.",
        "Developing the technical approach to address how matrix standards would be applied in a spatial context (e.g., over what spatial areas, for what depths, etc.).",
        "Determining if environmental sensitivity should be factored into matrix standards for ecological health."
      ]
    },
    {
      pollIndex: 3,
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

    check(response, {
      [`Prioritization Q${q.pollIndex + 1} status is 200`]: (r) => r.status === 200,
      [`Prioritization Q${q.pollIndex + 1} response time < 2000ms`]: (r) => r.timings.duration < 2000,
    }) || errorRate.add(1);
  });

  // Question 5: Wordcloud poll
  testWordcloudQuestion5(authCode);
}

// Test all polls across all pages
export function testAllPolls() {
  const authCode = generateCEWCode();
  
  // Test holistic protection (3 ranking questions)
  testHolisticProtection(authCode);
  sleep(1);
  
  // Test tiered framework (3 single-choice questions)
  testTieredFramework(authCode);
  sleep(1);
  
  // Test prioritization (2 single-choice + 2 ranking + 1 wordcloud questions)
  testPrioritization(authCode);
  sleep(1);
}

// Focused test for wordcloud question 5 - generates exactly 50 responses
export function testWordcloudQuestion5Focus() {
  const authCode = generateCEWCode();
  testWordcloudQuestion5(authCode);
  sleep(0.5); // Short sleep between submissions
}

// Setup function
export function setup() {
  console.log('Starting comprehensive k6 poll system test...');
  console.log(`Base URL: ${BASE_URL}`);
  console.log('Test will cover all questions across all pages:');
  console.log('- Holistic Protection: 8 single-choice questions');
  console.log('- Tiered Framework: 3 single-choice questions');
  console.log('- Prioritization: 2 single-choice + 2 ranking + 1 wordcloud (50 responses)');
  return {};
}

// Teardown function
export function teardown(data) {
  console.log('Comprehensive k6 poll system test completed');
  console.log('Check the wordcloud results to verify 50 responses for question 5');
}
