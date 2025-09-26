/**
 * K6 Comprehensive Poll Testing Script
 * 
 * OBJECTIVE: Test all poll questions across all pages to ensure votes are properly recorded
 * and visible in the admin dashboard.
 * 
 * COVERAGE:
 * - 13 Prioritization questions (10 single-choice + 2 ranking + 1 wordcloud)
 * - 3 Holistic Protection questions (3 ranking)
 * - 3 Tiered Framework questions (2 single-choice + 1 wordcloud)
 * 
 * TOTAL: 19 questions across 3 pages
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Custom metrics
const pollSubmissionRate = new Rate('poll_submissions_successful');
const pollSubmissionTrend = new Trend('poll_submission_duration');
const wordcloudSubmissions = new Rate('wordcloud_submissions');

// K6 Configuration - Optimized for 50+ wordcloud responses
export const options = {
  stages: [
    { duration: '30s', target: 10 },  // Ramp up to 10 users
    { duration: '2m', target: 15 },   // Maintain 15 users for 2 minutes
    { duration: '1m', target: 20 },   // Ramp up to 20 users
    { duration: '2m', target: 20 },   // Maintain 20 users for 2 minutes
    { duration: '30s', target: 0 },   // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<3000'],
    http_req_failed: ['rate<0.15'],
    poll_submissions_successful: ['rate>0.90'],
    wordcloud_submissions: ['rate>0.85'], // Ensure high success rate for wordcloud submissions
  },
};

const BASE_URL = __ENV.BASE_URL || 'https://sstac-dashboard.vercel.app';
const CEW_AUTH_CODE = 'CEW2025';

// All poll questions for comprehensive testing
const ALL_POLLS = [
  // PRIORITIZATION QUESTIONS (13 total)
  // Questions 1-10: Single-choice polls
  {
    pagePath: '/cew-polls/prioritization',
    pollIndex: 0,
    question: "What is the primary regulatory advantage of using a probabilistic framework (e.g., Bayesian) to integrate EqP and BLM predictions into a scientific framework for deriving site-specific sediment standards (Tier 2)?",
    options: [
      "Reduces uncertainty in risk estimates",
      "Provides more defensible regulatory decisions",
      "Integrates multiple lines of evidence",
      "Allows for site-specific adjustments",
      "Other"
    ],
    pollType: 'single-choice'
  },
  {
    pagePath: '/cew-polls/prioritization',
    pollIndex: 1,
    question: "In developing a probabilistic framework for deriving site-specific sediment standards (Tier 2), which data type is most critical for effectively narrowing the uncertainty of the final risk estimate?",
    options: [
      "Site-specific sediment chemistry data",
      "Benthic community structure data",
      "Bioaccumulation data from local species",
      "Toxicity data from multiple test species",
      "Other"
    ],
    pollType: 'single-choice'
  },
  {
    pagePath: '/cew-polls/prioritization',
    pollIndex: 2,
    question: "What is the biggest practical hurdle to overcome when implementing a Bayesian framework in the development of a scientific framework for deriving site-specific sediment standards (Tier 2)?",
    options: [
      "Data availability and quality",
      "Computational complexity",
      "Regulatory acceptance",
      "Expertise and training requirements",
      "Other"
    ],
    pollType: 'single-choice'
  },
  {
    pagePath: '/cew-polls/prioritization',
    pollIndex: 3,
    question: "Which scientific approach to bioavailability holds the most promise for practical and defensible application in BC's regulatory framework?",
    options: [
      "Equilibrium partitioning models",
      "AVS/SEM normalization",
      "Biotic Ligand Model for sediments",
      "Passive sampling devices",
      "Other"
    ],
    pollType: 'single-choice'
  },
  {
    pagePath: '/cew-polls/prioritization',
    pollIndex: 4,
    question: "For the Hazard Index / Concentration Addition approach to mixture assessment, what is the single greatest scientific research gap that must be addressed before it can be reliably implemented?",
    options: [
      "Lack of high-quality toxicity data",
      "Poor understanding of modes of action",
      "Difficulty validating model predictions",
      "Inability to account for interactions",
      "Other"
    ],
    pollType: 'single-choice'
  },
  {
    pagePath: '/cew-polls/prioritization',
    pollIndex: 5,
    question: "What is the most critical factor for successful implementation of site-specific sediment standards in BC?",
    options: [
      "Regulatory framework development",
      "Scientific data collection",
      "Stakeholder engagement",
      "Technical expertise",
      "Other"
    ],
    pollType: 'single-choice'
  },
  {
    pagePath: '/cew-polls/prioritization',
    pollIndex: 6,
    question: "Which approach would be most effective for addressing contaminant mixtures in sediment standards?",
    options: [
      "Simple additive models",
      "Weighted similarity approaches",
      "Site-specific toxicity testing",
      "Mixture-specific standards",
      "Other"
    ],
    pollType: 'single-choice'
  },
  {
    pagePath: '/cew-polls/prioritization',
    pollIndex: 7,
    question: "What is the most important consideration for developing sediment standards for emerging contaminants?",
    options: [
      "Rapid analytical method development",
      "Toxicity data generation",
      "Environmental monitoring",
      "Regulatory framework adaptation",
      "Other"
    ],
    pollType: 'single-choice'
  },
  {
    pagePath: '/cew-polls/prioritization',
    pollIndex: 8,
    question: "Which research priority would have the greatest impact on modernizing BC's sediment standards?",
    options: [
      "Bioavailability assessment methods",
      "Mixture toxicity prediction",
      "Climate change impacts",
      "Ecosystem-level effects",
      "Other"
    ],
    pollType: 'single-choice'
  },
  {
    pagePath: '/cew-polls/prioritization',
    pollIndex: 9,
    question: "What is the most significant barrier to implementing holistic sediment protection in BC?",
    options: [
      "Scientific complexity",
      "Regulatory constraints",
      "Resource limitations",
      "Stakeholder coordination",
      "Other"
    ],
    pollType: 'single-choice'
  },
  // Questions 11-12: Ranking polls
  {
    pagePath: '/cew-polls/prioritization',
    pollIndex: 10,
    question: "Rank the importance of developing a framework for deriving site-specific sediment standards, based on bioavailability adjustment, to provide an enhanced numerical assessment option (Tier 2), between generic numerical (Tier 1) and risk-based (Tier 3) assessments. (1 = very important to 5 = not important)",
    options: [
      "Very important",
      "Important", 
      "Moderately important",
      "Less important",
      "Not important"
    ],
    pollType: 'ranking'
  },
  {
    pagePath: '/cew-polls/prioritization',
    pollIndex: 11,
    question: "Rank the feasibility of developing the framework for deriving site-specific sediment standards, based on an integrated approach using Equilibrium Partitioning and Biotic Ligand Models. (1 = easily achievable to 5 = not feasible)",
    options: [
      "Easily achievable",
      "Achievable",
      "Moderately achievable", 
      "Difficult to achieve",
      "Not feasible"
    ],
    pollType: 'ranking'
  },
  // Question 13: Wordcloud poll
  {
    pagePath: '/cew-polls/prioritization',
    pollIndex: 12,
    question: "Overall, what is the greatest barrier to advancing holistic sediment protection in BC?",
    words: ['policy', 'science', 'funding', 'coordination', 'technology'],
    pollType: 'wordcloud'
  },

  // HOLISTIC PROTECTION QUESTIONS (3 total)
  {
    pagePath: '/cew-polls/holistic-protection',
    pollIndex: 0,
    question: "Given the potential for over-conservatism and remediation challenges, for which contaminant classes would the initial development of Matrix Sediment Standards protective of food toxicity be most scientifically defensible and practically beneficial?",
    options: [
      "Metals known to biomagnify",
      "Polycyclic Aromatic Hydrocarbons", 
      "Polychlorinated Biphenyls",
      "Per-and Polyfluoroalkyl Substances",
      "All of the above",
      "Other"
    ],
    pollType: 'single-choice'
  },
  {
    pagePath: '/cew-polls/holistic-protection',
    pollIndex: 1,
    question: "Rank in order of highest to lowest importance the following considerations in developing and implementing the Matrix Sediment Standards Framework:",
    options: [
      "Technical Hurdles: Limited data availability for many contaminants and species native to BC",
      "Practical Challenges: Discretionary matrix sediment standards may be a barrier for some practitioners",
      "Enhanced Protection: Comprehensive safeguards for BC's diverse aquatic ecosystems and peoples",
      "Scientific Advancement: Opportunity to pioneer innovative approaches to sediment management",
      "Societal Expectations: Given the challenges of modern society, holistic protection may not be feasible"
    ],
    pollType: 'ranking'
  },
  {
    pagePath: '/cew-polls/holistic-protection',
    pollIndex: 2,
    question: "What are the key challenges in implementing a holistic approach to sediment protection?",
    options: [
      "Data integration across multiple disciplines",
      "Regulatory coordination between agencies",
      "Scientific uncertainty in complex systems",
      "Resource allocation and prioritization",
      "Stakeholder engagement and consensus building"
    ],
    pollType: 'ranking'
  },

  // TIERED FRAMEWORK QUESTIONS (3 total)
  {
    pagePath: '/cew-polls/tiered-framework',
    pollIndex: 0,
    question: "What is the primary regulatory advantage of using a probabilistic framework (e.g., Bayesian) to integrate EqP and BLM predictions into a scientific framework for deriving site-specific sediment standards (Tier 2)?",
    options: [
      "It provides a formal structure for quantifying and communicating uncertainty in the final standard.",
      "It allows for the systematic integration of existing literature data as priors, reducing site-specific data needs.",
      "It produces a full risk distribution rather than a single point value, allowing for more flexible management decisions.",
      "It improves the technical defensibility by making all assumptions (priors, model structure) explicit",
      "Other"
    ],
    pollType: 'single-choice'
  },
  {
    pagePath: '/cew-polls/tiered-framework',
    pollIndex: 1,
    question: "In developing a probabilistic framework for deriving site-specific sediment standards (Tier 2), which data type is most critical for effectively narrowing the uncertainty of the final risk estimate?",
    options: [
      "A large number of sediment chemistry samples to better characterize spatial heterogeneity.",
      "High-quality, in-situ passive sampling data to directly measure and constrain bioavailable concentrations.",
      "Site-specific toxicity testing data to develop more relevant priors for the dose-response relationship.",
      "Detailed measurements of secondary geochemical parameters (e.g., black carbon, iron oxides) that influence partitioning.",
      "Other"
    ],
    pollType: 'single-choice'
  },
  {
    pagePath: '/cew-polls/tiered-framework',
    pollIndex: 2,
    question: "What is the biggest practical hurdle to overcome when implementing a Bayesian framework in the development of a scientific framework for deriving site-specific sediment standards (Tier 2)?",
    options: [
      "Defining appropriate priors, especially when site-specific information is sparse and literature values vary widely",
      "The high level of statistical expertise required by both the practitioner and the regulatory reviewer to ensure proper application.",
      "The challenge of communicating probabilistic outputs (e.g., posterior distributions) to non-technical stakeholders and decision-makers.",
      "The lack of standardized software and guidance, leading to potential inconsistencies across different site assessments.",
      "Other"
    ],
    pollType: 'single-choice'
  }
];

// Helper functions
function getRandomOptionIndex(poll) {
  return Math.floor(Math.random() * poll.options.length);
}

function getRandomRankings(poll) {
  const rankings = [];
  const optionIndices = Array.from({ length: poll.options.length }, (_, i) => i);
  
  // Fisher-Yates shuffle
  for (let i = optionIndices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [optionIndices[i], optionIndices[j]] = [optionIndices[j], optionIndices[i]];
  }
  
  return optionIndices.map((optionIndex, rank) => ({
    optionIndex: optionIndex,
    rank: rank + 1
  }));
}

function getRandomWords() {
  // Create weighted word distribution for realistic wordcloud testing
  // Each submission gets unique words to avoid duplicate key constraints
  const allWords = [
    'policy', 'regulation', 'enforcement', 'science', 'research', 'data',
    'funding', 'resources', 'capacity', 'coordination', 'collaboration', 'partnership',
    'technology', 'innovation', 'tools', 'uncertainty', 'variability', 'complexity',
    'timeline', 'urgency', 'priority', 'governance', 'stakeholders', 'implementation',
    'monitoring', 'assessment', 'evaluation', 'compliance', 'standards', 'guidelines',
    'framework', 'methodology', 'approach', 'strategy', 'planning', 'execution',
    'accountability', 'transparency', 'communication', 'education', 'training', 'awareness'
  ];
  
  // Shuffle and pick 3 unique words
  const shuffled = [...allWords].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, 3);
}

// Poll submission functions
function submitSingleChoicePoll(poll) {
  const optionIndex = getRandomOptionIndex(poll);
  const otherText = poll.options[optionIndex].toLowerCase().includes('other') 
    ? `Test response ${Math.random().toString(36).substring(7)}` 
    : undefined;

  const payload = {
    pagePath: poll.pagePath,
    pollIndex: poll.pollIndex,
    question: poll.question,
    options: poll.options,
    optionIndex: optionIndex,
    otherText: otherText,
    authCode: CEW_AUTH_CODE
  };

  const params = {
    headers: { 'Content-Type': 'application/json' },
  };

  const startTime = Date.now();
  const response = http.post(`${BASE_URL}/api/polls/submit`, JSON.stringify(payload), params);
  const duration = Date.now() - startTime;

  pollSubmissionTrend.add(duration);

  const success = check(response, {
    'single-choice poll submission successful': (r) => r.status === 200,
    'single-choice poll response time < 2s': (r) => r.timings.duration < 2000,
    'single-choice poll has success response': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.success === true;
      } catch (e) {
        return false;
      }
    },
  });

  pollSubmissionRate.add(success);
  return success;
}

function submitRankingPoll(poll) {
  const rankings = getRandomRankings(poll);

  const payload = {
    pagePath: poll.pagePath,
    pollIndex: poll.pollIndex,
    question: poll.question,
    options: poll.options,
    rankings: rankings,
    authCode: CEW_AUTH_CODE
  };

  const params = {
    headers: { 'Content-Type': 'application/json' },
  };

  const startTime = Date.now();
  const response = http.post(`${BASE_URL}/api/ranking-polls/submit`, JSON.stringify(payload), params);
  const duration = Date.now() - startTime;

  pollSubmissionTrend.add(duration);

  const success = check(response, {
    'ranking poll submission successful': (r) => r.status === 200,
    'ranking poll response time < 2s': (r) => r.timings.duration < 2000,
    'ranking poll has success response': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.success === true;
      } catch (e) {
        return false;
      }
    },
  });

  pollSubmissionRate.add(success);
  return success;
}

function submitWordcloudPoll(poll) {
  // Always use getRandomWords() to ensure we have exactly 3 words
  const words = getRandomWords();

  // Generate unique user ID for each wordcloud submission to simulate different users
  // Use timestamp + random number to ensure uniqueness
  const uniqueUserId = `CEW${Date.now()}${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;

  const payload = {
    pagePath: poll.pagePath,
    pollIndex: poll.pollIndex,
    question: poll.question,
    maxWords: 3,
    wordLimit: 20,
    words: words,
    authCode: uniqueUserId // Use unique user ID instead of CEW_AUTH_CODE
  };

  const params = {
    headers: { 'Content-Type': 'application/json' },
  };

  const startTime = Date.now();
  const response = http.post(`${BASE_URL}/api/wordcloud-polls/submit`, JSON.stringify(payload), params);
  const duration = Date.now() - startTime;

  pollSubmissionTrend.add(duration);

  const success = check(response, {
    'wordcloud poll submission successful': (r) => r.status === 200,
    'wordcloud poll response time < 2s': (r) => r.timings.duration < 2000,
    'wordcloud poll has success response': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.success === true;
      } catch (e) {
        return false;
      }
    },
  });

  // Log detailed error information for debugging
  if (!success) {
    console.log(`❌ Wordcloud submission failed: ${response.status} - ${response.body}`);
  } else {
    console.log(`wordcloud poll ${poll.pollIndex} SUCCESS (user: ${uniqueUserId})`);
  }

  pollSubmissionRate.add(success);
  return success;
}

// Main test function - Focus on CEW-polls pages with emphasis on wordcloud
export default function() {
  // Filter to only CEW-polls pages
  const cewPolls = ALL_POLLS.filter(poll => poll.pagePath.startsWith('/cew-polls'));
  
  // Prioritize wordcloud polls (question 13) for more responses
  const wordcloudPolls = cewPolls.filter(poll => poll.pollType === 'wordcloud');
  const otherPolls = cewPolls.filter(poll => poll.pollType !== 'wordcloud');
  
  // Test selection strategy:
  // - Always test 1-2 wordcloud polls (higher chance for question 13)
  // - Test 2-3 other random polls
  const pollsToTest = [];
  
  // Add wordcloud polls (higher probability for question 13)
  if (wordcloudPolls.length > 0) {
    const wordcloudCount = Math.random() < 0.7 ? 2 : 1; // 70% chance of 2 wordcloud polls
    for (let i = 0; i < wordcloudCount && i < wordcloudPolls.length; i++) {
      pollsToTest.push(wordcloudPolls[Math.floor(Math.random() * wordcloudPolls.length)]);
    }
  }
  
  // Add other polls
  const otherCount = Math.random() < 0.6 ? 3 : 2; // 60% chance of 3 other polls
  for (let i = 0; i < otherCount && i < otherPolls.length; i++) {
    pollsToTest.push(otherPolls[Math.floor(Math.random() * otherPolls.length)]);
  }

  for (const poll of pollsToTest) {
    console.log(`Testing ${poll.pollType} poll: ${poll.pagePath} poll ${poll.pollIndex}`);
    
    let success = false;
    
    if (poll.pollType === 'single-choice') {
      success = submitSingleChoicePoll(poll);
    } else if (poll.pollType === 'ranking') {
      success = submitRankingPoll(poll);
    } else if (poll.pollType === 'wordcloud') {
      success = submitWordcloudPoll(poll);
      if (success) {
        wordcloudSubmissions.add(1);
      }
    }
    
    console.log(`${poll.pollType} poll ${poll.pollIndex} ${success ? 'SUCCESS' : 'FAILED'}`);
    
    // Shorter delay for more submissions
    sleep(0.2);
  }
}

export function setup() {
  const cewPolls = ALL_POLLS.filter(poll => poll.pagePath.startsWith('/cew-polls'));
  const wordcloudPolls = cewPolls.filter(poll => poll.pollType === 'wordcloud');
  
  console.log('🚀 Starting CEW-Polls Comprehensive Test');
  console.log(`📊 Testing ${cewPolls.length} CEW polls across 3 pages`);
  console.log(`☁️  Wordcloud polls: ${wordcloudPolls.length} (targeting 50+ responses)`);
  console.log(`🎯 Base URL: ${BASE_URL}`);
  console.log(`🔐 Auth Code: ${CEW_AUTH_CODE}`);
  console.log('');
}

export function teardown(data) {
  console.log('');
  console.log('✅ CEW-Polls Comprehensive Test Completed');
  console.log('📈 Check the admin dashboard to verify votes were recorded');
  console.log('☁️  Expected: 50+ wordcloud responses for question 13');
  console.log('🎯 Expected: Votes should appear for all CEW poll types and pages');
}
