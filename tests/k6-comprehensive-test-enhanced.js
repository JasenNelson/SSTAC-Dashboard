// k6-comprehensive-test-enhanced.js
// Enhanced comprehensive k6 load test for SSTAC Dashboard Poll System
// Tests all aspects: speed, accuracy, responsiveness, all question types, all pages

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const responseTime = new Trend('response_time');
const dataAccuracyRate = new Rate('data_accuracy');

// Test configuration - comprehensive coverage
export const options = {
  scenarios: {
    // Scenario 1: CEW Polls - All pages and question types (100 VUs)
    cew_polls_comprehensive: {
      executor: 'ramping-vus',
      startVUs: 1,
      stages: [
        { duration: '1m', target: 20 },    // Ramp up to 20 users
        { duration: '2m', target: 50 },    // Ramp up to 50 users
        { duration: '3m', target: 100 },   // Ramp up to 100 users
        { duration: '1m', target: 0 },     // Ramp down
      ],
      exec: 'testCEWPollsComprehensive',
    },
    
    // Scenario 2: Survey-Results - All pages and question types (50 VUs)
    survey_results_comprehensive: {
      executor: 'ramping-vus',
      startVUs: 1,
      stages: [
        { duration: '30s', target: 10 },   // Ramp up to 10 users
        { duration: '1m', target: 25 },    // Ramp up to 25 users
        { duration: '2m', target: 50 },    // Ramp up to 50 users
        { duration: '1m30s', target: 0 },  // Ramp down
      ],
      exec: 'testSurveyResultsComprehensive',
      startTime: '10s', // Start after CEW polls begin
    },
    
    // Scenario 3: Matrix Graph API Testing (20 VUs)
    matrix_graph_testing: {
      executor: 'shared-iterations',
      iterations: 100,
      vus: 20,
      exec: 'testMatrixGraphAPI',
      startTime: '30s',
    },
    
    // Scenario 3.5: Matrix Graph Paired Responses Testing (15 VUs)
    matrix_graph_paired: {
      executor: 'shared-iterations',
      iterations: 75,
      vus: 15,
      exec: 'testMatrixGraphPairedResponses',
      startTime: '45s',
    },
    
    // Scenario 4: Error Handling and Edge Cases (10 VUs)
    error_handling: {
      executor: 'shared-iterations',
      iterations: 50,
      vus: 10,
      exec: 'testErrorHandling',
      startTime: '1m',
    },
    
    // Scenario 5: Data Accuracy Validation (20 VUs)
    data_accuracy: {
      executor: 'shared-iterations',
      iterations: 100,
      vus: 20,
      exec: 'testDataAccuracy',
      startTime: '2m',
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<3000'], // 95% of requests under 3s (relaxed for 100 users)
    http_req_failed: ['rate<0.10'],    // <10% failure rate (relaxed for high load)
    errors: ['rate<0.05'],             // <5% application errors (relaxed for high load)
    data_accuracy: ['rate>0.90'],      // >90% data accuracy (relaxed for high load)
  },
};

// Base configuration
const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

// Authentication helpers
function getCEWHeaders() {
  return {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  };
}

function getSurveyHeaders() {
  // For authenticated users - would need actual auth token in real scenario
  return {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'Authorization': 'Bearer test-token', // Placeholder for authenticated testing
  };
}

// Generate unique identifiers
function generateCEWCode() {
  const codes = ['CEW2025', 'CEW2025-A', 'CEW2025-B', 'CEW2025-C', 'CEW2025-D'];
  return codes[Math.floor(Math.random() * codes.length)];
}

function generateUniqueUserId() {
  const timestamp = Date.now();
  const vuId = __VU; // Virtual user ID
  const iteration = __ITER;
  const random = Math.floor(Math.random() * 1000);
  return `CEW2025-${vuId}-${iteration}-${random}`;
}

// Helper function for submitting polls with proper user ID generation
function submitPollWithUserID(basePath, pollIndex, question, options, optionIndex, authCode, headers, userId = null) {
  const sessionUserId = userId || generateUniqueUserId();
  
  const response = http.post(`${BASE_URL}/api/polls/submit`, JSON.stringify({
    pagePath: basePath,
    pollIndex: pollIndex,
    question: question,
    options: options,
    optionIndex: optionIndex,
    authCode: authCode
  }), { 
    headers: {
      ...headers,
      'x-session-id': sessionUserId  // CRITICAL: API uses this for user_id generation
    }
  });
  
  return { response, userId: sessionUserId };
}

// Test CEW Polls - All pages and question types
export function testCEWPollsComprehensive() {
  const authCode = generateCEWCode();
  
  // Test Holistic Protection (8 single-choice)
  testHolisticProtectionCEW(authCode);
  sleep(0.5);
  
  // Test Tiered Framework (3 single-choice)
  testTieredFrameworkCEW(authCode);
  sleep(0.5);
  
  // Test Prioritization (2 single-choice + 2 ranking + 1 wordcloud)
  testPrioritizationCEW(authCode);
  sleep(0.5);
}

// Test Survey-Results - All pages and question types
export function testSurveyResultsComprehensive() {
  const authCode = generateCEWCode();
  
  // Test Holistic Protection Survey-Results
  testHolisticProtectionSurvey(authCode);
  sleep(0.5);
  
  // Test Tiered Framework Survey-Results
  testTieredFrameworkSurvey(authCode);
  sleep(0.5);
  
  // Test Prioritization Survey-Results
  testPrioritizationSurvey(authCode);
  sleep(0.5);
}

// Test Matrix Graph API
export function testMatrixGraphAPI() {
  const filters = ['all', 'twg', 'cew'];
  const filter = filters[Math.floor(Math.random() * filters.length)];
  
  const response = http.get(`${BASE_URL}/api/graphs/prioritization-matrix?filter=${filter}`);
  
  const success = check(response, {
    'Matrix Graph API status is 200': (r) => r.status === 200,
    'Matrix Graph API response time < 3000ms': (r) => r.timings.duration < 3000,
    'Matrix Graph API returns data': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body && (body.data || body.results);
      } catch {
        return false;
      }
    }
  });
  
  if (success) {
    responseTime.add(response.timings.duration);
  } else {
    errorRate.add(1);
  }
}

// Test Matrix Graph with Paired Responses (NEW)
export function testMatrixGraphPairedResponses() {
  const userId = generateUniqueUserId();
  const basePath = '/cew-polls/holistic-protection';
  
  // Test Matrix 1: Q1+Q2 (Ecosystem Health - Direct Toxicity)
  const matrixPair1 = [
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
  
  // Submit both questions for matrix pairing with SAME user ID
  let pairSuccess = true;
  matrixPair1.forEach(q => {
    const { response } = submitPollWithUserID(
      basePath, 
      q.pollIndex, 
      q.question, 
      q.options, 
      Math.floor(Math.random() * q.options.length), 
      'CEW2025', 
      getCEWHeaders(),
      userId  // CRITICAL: Use same user ID for both questions
    );
    
    if (response.status !== 200) {
      pairSuccess = false;
    }
  });
  
  // Verify matrix graph shows the paired data
  sleep(1); // Wait for data processing
  
  const matrixResponse = http.get(`${BASE_URL}/api/graphs/prioritization-matrix?filter=all`);
  
  const success = check(matrixResponse, {
    'Matrix Graph Paired Response status is 200': (r) => r.status === 200,
    'Matrix Graph Paired Response contains data': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body && body.data && body.data.length > 0;
      } catch {
        return false;
      }
    },
    'Matrix Graph Paired Response pair submitted': () => pairSuccess
  });
  
  if (success) {
    responseTime.add(matrixResponse.timings.duration);
  } else {
    errorRate.add(1);
  }
}

// Test Error Handling and Edge Cases
export function testErrorHandling() {
  const testCases = [
    // Invalid poll index
    {
      url: `${BASE_URL}/api/polls/submit`,
      payload: JSON.stringify({
        pagePath: '/cew-polls/holistic-protection',
        pollIndex: 999, // Invalid index
        question: 'Test question',
        options: ['Option 1', 'Option 2'],
        optionIndex: 0,
        authCode: 'CEW2025'
      })
    },
    // Invalid page path
    {
      url: `${BASE_URL}/api/polls/submit`,
      payload: JSON.stringify({
        pagePath: '/invalid/path',
        pollIndex: 0,
        question: 'Test question',
        options: ['Option 1', 'Option 2'],
        optionIndex: 0,
        authCode: 'CEW2025'
      })
    },
    // Malformed JSON
    {
      url: `${BASE_URL}/api/polls/submit`,
      payload: '{"invalid": json}'
    }
  ];
  
  testCases.forEach(testCase => {
    const response = http.post(testCase.url, testCase.payload, {
      headers: getCEWHeaders()
    });
    
    // Expect these to fail gracefully
    check(response, {
      'Error handling works': (r) => r.status >= 400 && r.status < 500
    });
  });
}

// Test Data Accuracy
export function testDataAccuracy() {
  const authCode = generateUniqueUserId();
  const testData = {
    pagePath: '/cew-polls/holistic-protection',
    pollIndex: 0,
    question: "Rank the importance of updating CSR sediment standards for direct toxicity to ecological receptors (matrix standards, possibly based on SSDs). (1 = very important to 5 = not important)",
    options: ["Very Important", "Important", "Moderately Important", "Less Important", "Not Important"],
    optionIndex: 2, // Select "Moderately Important"
    authCode: authCode
  };
  
  // Submit poll
  const submitResponse = http.post(`${BASE_URL}/api/polls/submit`, JSON.stringify(testData), {
    headers: getCEWHeaders()
  });
  
  if (submitResponse.status === 200) {
    // Verify data was stored correctly by checking results
    sleep(1); // Wait for data to be processed
    
    const resultsResponse = http.get(`${BASE_URL}/api/polls/results?pagePath=${testData.pagePath}&pollIndex=${testData.pollIndex}`);
    
    const accuracyCheck = check(resultsResponse, {
      'Data accuracy - results retrieved': (r) => r.status === 200,
      'Data accuracy - correct option selected': (r) => {
        try {
          const body = JSON.parse(r.body);
          return body && body.results && body.results[testData.optionIndex] > 0;
        } catch {
          return false;
        }
      }
    });
    
    if (accuracyCheck) {
      dataAccuracyRate.add(1);
    } else {
      dataAccuracyRate.add(0);
    }
  }
}

// Individual test functions for each page and question type
function testHolisticProtectionCEW(authCode) {
  const basePath = '/cew-polls/holistic-protection';
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

  questions.forEach(q => {
    const { response, userId } = submitPollWithUserID(
      basePath, 
      q.pollIndex, 
      q.question, 
      q.options, 
      Math.floor(Math.random() * q.options.length), 
      authCode, 
      getCEWHeaders()
    );

    const success = check(response, {
      [`Holistic CEW Q${q.pollIndex + 1} status is 200`]: (r) => r.status === 200,
      [`Holistic CEW Q${q.pollIndex + 1} response time < 2000ms`]: (r) => r.timings.duration < 2000,
      [`Holistic CEW Q${q.pollIndex + 1} user ID generated`]: () => userId !== null,
    });
    
    if (success) {
      responseTime.add(response.timings.duration);
    } else {
      errorRate.add(1);
    }
  });
}

function testHolisticProtectionSurvey(authCode) {
  const basePath = '/survey-results/holistic-protection';
  // Same questions as CEW but for survey-results path
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

  questions.forEach(q => {
    const response = http.post(`${BASE_URL}/api/polls/submit`, JSON.stringify({
      pagePath: basePath,
      pollIndex: q.pollIndex,
      question: q.question,
      options: q.options,
      optionIndex: Math.floor(Math.random() * q.options.length),
      authCode: authCode
    }), { headers: getSurveyHeaders() });

    const success = check(response, {
      [`Holistic Survey Q${q.pollIndex + 1} status is 200`]: (r) => r.status === 200,
      [`Holistic Survey Q${q.pollIndex + 1} response time < 2000ms`]: (r) => r.timings.duration < 2000,
    });
    
    if (success) {
      responseTime.add(response.timings.duration);
    } else {
      errorRate.add(1);
    }
  });
}

function testTieredFrameworkCEW(authCode) {
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
    }), { headers: getCEWHeaders() });

    const success = check(response, {
      [`Tiered CEW Q${q.pollIndex + 1} status is 200`]: (r) => r.status === 200,
      [`Tiered CEW Q${q.pollIndex + 1} response time < 2000ms`]: (r) => r.timings.duration < 2000,
    });
    
    if (success) {
      responseTime.add(response.timings.duration);
    } else {
      errorRate.add(1);
    }
  });
}

function testTieredFrameworkSurvey(authCode) {
  const basePath = '/survey-results/tiered-framework';
  // Same questions as CEW but for survey-results path
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
    }), { headers: getSurveyHeaders() });

    const success = check(response, {
      [`Tiered Survey Q${q.pollIndex + 1} status is 200`]: (r) => r.status === 200,
      [`Tiered Survey Q${q.pollIndex + 1} response time < 2000ms`]: (r) => r.timings.duration < 2000,
    });
    
    if (success) {
      responseTime.add(response.timings.duration);
    } else {
      errorRate.add(1);
    }
  });
}

function testPrioritizationCEW(authCode) {
  const basePath = '/cew-polls/prioritization';
  
  // Questions 1-2: Single-choice polls
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

  // Submit single-choice questions
  singleChoiceQuestions.forEach(q => {
    const response = http.post(`${BASE_URL}/api/polls/submit`, JSON.stringify({
      pagePath: basePath,
      pollIndex: q.pollIndex,
      question: q.question,
      options: q.options,
      optionIndex: Math.floor(Math.random() * q.options.length),
      authCode: authCode
    }), { headers: getCEWHeaders() });

    const success = check(response, {
      [`Prioritization CEW Q${q.pollIndex + 1} status is 200`]: (r) => r.status === 200,
      [`Prioritization CEW Q${q.pollIndex + 1} response time < 2000ms`]: (r) => r.timings.duration < 2000,
    });
    
    if (success) {
      responseTime.add(response.timings.duration);
    } else {
      errorRate.add(1);
    }
  });

  // Questions 3-4: Ranking polls
  const rankingQuestions = [
    {
      pollIndex: 2,
      question: "To help focus development of matrix standards, please rank the four actions below for the degree to which they would improve development of the standards (1 = top priority; 4 = lowest priority).",
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
    const rankings = [1, 2, 3, 4].sort(() => Math.random() - 0.5);
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
    }), { headers: getCEWHeaders() });

    const success = check(response, {
      [`Prioritization CEW Q${q.pollIndex + 1} status is 200`]: (r) => r.status === 200,
      [`Prioritization CEW Q${q.pollIndex + 1} response time < 2000ms`]: (r) => r.timings.duration < 2000,
    });
    
    if (success) {
      responseTime.add(response.timings.duration);
    } else {
      errorRate.add(1);
    }
  });

  // Question 5: Wordcloud poll
  testWordcloudQuestion5CEW(authCode);
}

function testPrioritizationSurvey(authCode) {
  const basePath = '/survey-results/prioritization';
  
  // Same questions as CEW but for survey-results path
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

  singleChoiceQuestions.forEach(q => {
    const response = http.post(`${BASE_URL}/api/polls/submit`, JSON.stringify({
      pagePath: basePath,
      pollIndex: q.pollIndex,
      question: q.question,
      options: q.options,
      optionIndex: Math.floor(Math.random() * q.options.length),
      authCode: authCode
    }), { headers: getSurveyHeaders() });

    const success = check(response, {
      [`Prioritization Survey Q${q.pollIndex + 1} status is 200`]: (r) => r.status === 200,
      [`Prioritization Survey Q${q.pollIndex + 1} response time < 2000ms`]: (r) => r.timings.duration < 2000,
    });
    
    if (success) {
      responseTime.add(response.timings.duration);
    } else {
      errorRate.add(1);
    }
  });

  // Ranking questions for survey-results
  const rankingQuestions = [
    {
      pollIndex: 2,
      question: "To help focus development of matrix standards, please rank the four actions below for the degree to which they would improve development of the standards (1 = top priority; 4 = lowest priority).",
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
    const rankings = [1, 2, 3, 4].sort(() => Math.random() - 0.5);
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
    }), { headers: getSurveyHeaders() });

    const success = check(response, {
      [`Prioritization Survey Q${q.pollIndex + 1} status is 200`]: (r) => r.status === 200,
      [`Prioritization Survey Q${q.pollIndex + 1} response time < 2000ms`]: (r) => r.timings.duration < 2000,
    });
    
    if (success) {
      responseTime.add(response.timings.duration);
    } else {
      errorRate.add(1);
    }
  });

  // Wordcloud question for survey-results
  testWordcloudQuestion5Survey(authCode);
}

function testWordcloudQuestion5CEW(authCode) {
  const basePath = '/cew-polls/prioritization';
  const pollIndex = 4;
  
  const predefinedOptions = [
    { display: "Data availability", keyword: "Data" },
    { display: "Tools (models, test protocols, decision trees)", keyword: "Tools" },
    { display: "Agreement on protection goals and spatial scale", keyword: "Agreement" },
    { display: "Resourcing (e.g., developing approach/tools, agreeing across peers)", keyword: "Resourcing" }
  ];

  const customWords = [
    "Funding", "Regulation", "Science", "Stakeholders", "Implementation", 
    "Guidance", "Standards", "Methodology", "Coordination", "Timeline",
    "Expertise", "Communication", "Validation", "Acceptance", "Complexity"
  ];

  const usePredefined = Math.random() < 0.6;
  const wordToSubmit = usePredefined 
    ? predefinedOptions[Math.floor(Math.random() * predefinedOptions.length)].keyword
    : customWords[Math.floor(Math.random() * customWords.length)];

  const response = http.post(`${BASE_URL}/api/wordcloud-polls/submit`, JSON.stringify({
    pagePath: basePath,
    pollIndex: pollIndex,
    question: "Overall, what is the greatest barrier to advancing holistic sediment protection in BC?",
    words: [wordToSubmit],
    authCode: authCode,
    maxWords: 1,
    wordLimit: 20
  }), { headers: getCEWHeaders() });

  const success = check(response, {
    'Wordcloud CEW Q5 status is 200': (r) => r.status === 200,
    'Wordcloud CEW Q5 response time < 2000ms': (r) => r.timings.duration < 2000,
    'Wordcloud CEW Q5 word submitted': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.success === true;
      } catch {
        return false;
      }
    }
  });
  
  if (success) {
    responseTime.add(response.timings.duration);
  } else {
    errorRate.add(1);
  }
}

function testWordcloudQuestion5Survey(authCode) {
  const basePath = '/survey-results/prioritization';
  const pollIndex = 4;
  
  const predefinedOptions = [
    { display: "Data availability", keyword: "Data" },
    { display: "Tools (models, test protocols, decision trees)", keyword: "Tools" },
    { display: "Agreement on protection goals and spatial scale", keyword: "Agreement" },
    { display: "Resourcing (e.g., developing approach/tools, agreeing across peers)", keyword: "Resourcing" }
  ];

  const customWords = [
    "Funding", "Regulation", "Science", "Stakeholders", "Implementation", 
    "Guidance", "Standards", "Methodology", "Coordination", "Timeline",
    "Expertise", "Communication", "Validation", "Acceptance", "Complexity"
  ];

  const usePredefined = Math.random() < 0.6;
  const wordToSubmit = usePredefined 
    ? predefinedOptions[Math.floor(Math.random() * predefinedOptions.length)].keyword
    : customWords[Math.floor(Math.random() * customWords.length)];

  const response = http.post(`${BASE_URL}/api/wordcloud-polls/submit`, JSON.stringify({
    pagePath: basePath,
    pollIndex: pollIndex,
    question: "Overall, what is the greatest barrier to advancing holistic sediment protection in BC?",
    words: [wordToSubmit],
    authCode: authCode,
    maxWords: 1,
    wordLimit: 20
  }), { headers: getSurveyHeaders() });

  const success = check(response, {
    'Wordcloud Survey Q5 status is 200': (r) => r.status === 200,
    'Wordcloud Survey Q5 response time < 2000ms': (r) => r.timings.duration < 2000,
    'Wordcloud Survey Q5 word submitted': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.success === true;
      } catch {
        return false;
      }
    }
  });
  
  if (success) {
    responseTime.add(response.timings.duration);
  } else {
    errorRate.add(1);
  }
}

// Setup function
export function setup() {
  console.log('Starting enhanced comprehensive k6 poll system test...');
  console.log(`Base URL: ${BASE_URL}`);
  console.log('Test will cover:');
  console.log('- CEW Polls: All pages and question types');
  console.log('- Survey-Results: All pages and question types');
  console.log('- Matrix Graph API: All filter combinations');
  console.log('- Error Handling: Edge cases and invalid inputs');
  console.log('- Data Accuracy: Response validation');
  return {};
}

// Teardown function
export function teardown(data) {
  console.log('Enhanced comprehensive k6 poll system test completed');
  console.log('Check admin panel to verify all data was submitted correctly');
  console.log('Verify matrix graphs show data from both CEW and survey-results');
  console.log('Matrix graphs should show paired responses with proper user ID generation');
  console.log('Check overlapping data points visualization with 4-mode system');
}
