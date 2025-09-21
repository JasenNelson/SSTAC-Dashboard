/**
 * K6 Load Testing Script for CEW Conference Polling System
 * 
 * OBJECTIVE: Stress-test the CEW conference polling system to verify if the current
 * free-tier Vercel/Supabase infrastructure can handle up to 100 concurrent users.
 * 
 * TEST SCENARIO: Simulates realistic user behavior during the CEW conference with:
 * - 100 concurrent users over 30-second ramp-up
 * - 1-minute sustained load
 * - 30-second ramp-down
 * - Random selection between single-choice and ranking polls
 * - Realistic poll data from actual CEW pages
 * 
 * USAGE: k6 run k6-test.js
 * 
 * EXPECTED RESULTS: Should help identify if the system can handle the expected
 * conference load without performance degradation or failures.
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Custom metrics for detailed monitoring
const pollSubmissionRate = new Rate('poll_submissions_successful');
const pollSubmissionTrend = new Trend('poll_submission_duration');

// K6 Configuration
export const options = {
  stages: [
    // Ramp up from 0 to 100 users over 30 seconds
    { duration: '30s', target: 100 },
    // Maintain 100 users for 1 minute (peak conference activity)
    { duration: '1m', target: 100 },
    // Ramp down to 0 users over 30 seconds
    { duration: '30s', target: 0 },
  ],
  thresholds: {
    // Performance thresholds
    http_req_duration: ['p(95)<2000'], // 95% of requests under 2 seconds
    http_req_failed: ['rate<0.1'],     // Less than 10% failure rate
    poll_submissions_successful: ['rate>0.95'], // 95% success rate for poll submissions
  },
};

// Base URL - Your live deployment URL
const BASE_URL = 'https://sstac-dashboard.vercel.app';

// CEW Authentication Code (shared for all conference attendees)
const CEW_AUTH_CODE = 'CEW2025';

/**
 * LIVE CEW POLL PAGES AVAILABLE FOR TESTING:
 * - https://sstac-dashboard.vercel.app/cew-polls/holistic-protection
 * - https://sstac-dashboard.vercel.app/cew-polls/tiered-framework  
 * - https://sstac-dashboard.vercel.app/cew-polls/prioritization
 * 
 * TOTAL POLLS AVAILABLE FOR TESTING:
 * - Holistic Protection: 1 single-choice + 1 ranking poll
 * - Tiered Framework: 1 single-choice + 1 ranking poll
 * - Prioritization: 6 ranking + 2 single-choice polls
 * - TOTAL: 10 polls across 3 pages
 * 
 * PAYLOAD STRUCTURES:
 * 1. Single-Choice: { pagePath, pollIndex, question, options, optionIndex, otherText?, authCode }
 * 2. Ranking: { pagePath, pollIndex, question, options, rankings, authCode }
 * 
 * API ENDPOINTS:
 * - Single-choice: POST /api/polls/submit
 * - Ranking: POST /api/ranking-polls/submit
 */

/**
 * POLL DATA STRUCTURES
 * 
 * These are extracted from the actual CEW poll pages in the codebase:
 * - src/app/cew-polls/holistic-protection/page.tsx (1 single-choice + 1 ranking poll)
 * - src/app/cew-polls/tiered-framework/page.tsx (1 single-choice + 1 ranking poll)
 * - src/app/cew-polls/prioritization/page.tsx (6 ranking + 2 single-choice polls)
 */

// WIKS Polls - REMOVED (No longer available for testing)

// Holistic Protection Polls (Mixed: single-choice and ranking)
const HOLISTIC_POLLS = [
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
    isRanking: false
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
    isRanking: true
  }
];

// Tiered Framework Polls (Mixed: single-choice and ranking)
const TIERED_FRAMEWORK_POLLS = [
  {
    pagePath: '/cew-polls/tiered-framework',
    pollIndex: 0,
    question: "In developing Protocol 2 requirements, procedures, and a supporting model for bioavailability adjustments, would a cause-effect model (e.g., Bayesian Networks or Regression) be the best approach for a scientific framework that uses site-specific data and known toxicity-modifying factors to develop refined sediment standards?",
    options: [
      "Yes",
      "No",
      "It depends",
      "Unsure",
      "Other"
    ],
    isRanking: false
  },
  {
    pagePath: '/cew-polls/tiered-framework',
    pollIndex: 1,
    question: "Please rank the following lines of evidence in order of importance for developing a robust scientific framework for deriving Tier 2b site-specific sediment standards for screening-level risk assessment (1 = most important):",
    options: [
      "Environmental Conditions: Physical and chemical data",
      "Bioaccumulation Data in Tissues of Local Species",
      "Benthic Community Structure Analysis",
      "Other"
    ],
    isRanking: true
  }
];

// Prioritization Framework Polls (Mixed: mostly ranking with some single-choice)
const PRIORITIZATION_POLLS = [
  {
    pagePath: '/cew-polls/prioritization',
    pollIndex: 0,
    question: "Please rank these potential feasibility criteria to help inform the development of a prioritization framework (1= highest):",
    options: [
      "Adequacy and reliability of available data for key research topics",
      "Need for new or specialized technologies",
      "Level of complexity and corresponding expertise and resource requirements",
      "Level of likelihood/uncertainty in successful completion of project or meeting research goals"
    ],
    isRanking: true
  },
  {
    pagePath: '/cew-polls/prioritization',
    pollIndex: 1,
    question: "Please rank these timeframe considerations for developing a prioritization framework and strategic planning for research to support modernizing BC's sediment standards (1= highest):",
    options: [
      "Outcome-driven priority, regardless of timeframe (i.e., disregard timeframe when prioritizing research)",
      "Focus on short-term progress (e.g., identify opportunities to quickly address regulatory gaps)",
      "Focus on progressing the highest potential impact, following a clear long-term strategic goal, avoiding convenient short-term efforts if they will distract from the goal and divert resources away from more meaningful progress.",
      "Consistent progress prioritized, with a balance of short- and long-term research efforts."
    ],
    isRanking: true
  },
  {
    pagePath: '/cew-polls/prioritization',
    pollIndex: 2,
    question: "Based on Today's discussion and your experience, please rank these four areas for modernization priority in BC's sediment standards (1= highest):",
    options: [
      "Development of a Scientific Framework for Deriving Site-Specific Sediment Standards (Bioavailability Adjustment)",
      "Development of a Matrix Sediment Standards Framework - Focus on Ecological Protection",
      "Development of a Matrix Sediment Standards Framework - Focus on Human Health Protection",
      "Develop Sediment Standards for Non-scheduled Contaminants & Mixtures"
    ],
    isRanking: true
  },
  {
    pagePath: '/cew-polls/prioritization',
    pollIndex: 3,
    question: "Which scientific approach to bioavailability holds the most promise for practical and defensible application in BC's regulatory framework?",
    options: [
      "Equilibrium partitioning models (e.g., based on organic carbon content).",
      "Normalization using Acid-Volatile Sulfides and Simultaneously Extracted Metals (AVS/SEM)",
      "Application of the Biotic Ligand Model (BLM) for sediments",
      "Direct measurement using passive sampling devices (PSDs)"
    ],
    isRanking: false
  },
  {
    pagePath: '/cew-polls/prioritization',
    pollIndex: 4,
    question: "When considering contaminant mixtures, rank the following approaches from most to least scientifically defensible and practically achievable for BC's regulatory framework (1= highest):",
    options: [
      "A simple additive model (e.g., hazard index)",
      "A weighted approach based on toxicological similarity",
      "Site-specific toxicity testing for all complex mixtures",
      "The development of new, mixture-specific standards"
    ],
    isRanking: true
  },
  {
    pagePath: '/cew-polls/prioritization',
    pollIndex: 5,
    question: "Within a medium-term (3-5 year) research plan, rank the following scientific objectives from most to least critical for modernizing BC's sediment standards?",
    options: [
      "Developing a robust framework for assessing the bioavailability of metals and metalloids.",
      "Establishing standardized analytical methods for a priority list of contaminants of emerging concern (CECs).",
      "Creating a predictive model for contaminant mixture toxicity based on concentration addition.",
      "Generating sufficient toxicity data to derive new guidelines for 3-5 high-priority legacy contaminants."
    ],
    isRanking: true
  },
  {
    pagePath: '/cew-polls/prioritization',
    pollIndex: 6,
    question: "To support long-term (5+ years) strategic goals, please rank the following foundational research areas in order of importance for creating a more adaptive and forward-looking regulatory framework (1= highest importance):",
    options: [
      "Research into the ecosystem-level impacts of chronic, low-level contaminant exposure",
      "Development of advanced in-vitro and high-throughput screening methods for rapid hazard assessment",
      "Investigating the toxicological impacts of climate change variables (e.g., temperature, hypoxia) on sediment contaminant toxicity",
      "Building a comprehensive, open-access database of sediment chemistry and toxicology data for all of BC"
    ],
    isRanking: true
  },
  {
    pagePath: '/cew-polls/prioritization',
    pollIndex: 7,
    question: "For the Hazard Index / Concentration Addition approach to mixture assessment, what is the single greatest scientific research gap that must be addressed before it can be reliably implemented?",
    options: [
      "A lack of high-quality toxicity data for many individual components of common mixtures",
      "Poor understanding of the modes of action for many contaminants to justify grouping them",
      "Difficulty in validating model predictions with whole sediment toxicity testing results",
      "The inability of current models to account for significant synergistic or antagonistic interactions"
    ],
    isRanking: false
  }
];

// Combine all polls for random selection
const ALL_POLLS = [...HOLISTIC_POLLS, ...TIERED_FRAMEWORK_POLLS, ...PRIORITIZATION_POLLS];

/**
 * UTILITY FUNCTIONS
 */

// Generate a random option index for single-choice polls
function getRandomOptionIndex(poll) {
  return Math.floor(Math.random() * poll.options.length);
}

// Generate random rankings for ranking polls (shuffle algorithm)
function getRandomRankings(poll) {
  const rankings = [];
  const optionIndices = Array.from({ length: poll.options.length }, (_, i) => i);
  
  // Fisher-Yates shuffle
  for (let i = optionIndices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [optionIndices[i], optionIndices[j]] = [optionIndices[j], optionIndices[i]];
  }
  
  // Convert to the format expected by the API
  return optionIndices.map((optionIndex, rank) => ({
    optionIndex: optionIndex,
    rank: rank + 1 // 1-based ranking
  }));
}

// Simulate realistic user thinking time
function simulateUserThinking() {
  // Random delay between 1-5 seconds to simulate user reading and thinking
  sleep(Math.random() * 4 + 1);
}

/**
 * SINGLE-CHOICE POLL SUBMISSION
 * 
 * Payload Structure (based on /api/polls/submit analysis):
 * {
 *   pagePath: string,
 *   pollIndex: number,
 *   question: string,
 *   options: string[],
 *   optionIndex: number,
 *   otherText?: string,
 *   authCode: string
 * }
 */
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
    headers: {
      'Content-Type': 'application/json',
    },
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

/**
 * RANKING POLL SUBMISSION
 * 
 * Payload Structure (based on /api/ranking-polls/submit analysis):
 * {
 *   pagePath: string,
 *   pollIndex: number,
 *   question: string,
 *   options: string[],
 *   rankings: Array<{optionIndex: number, rank: number}>,
 *   authCode: string
 * }
 */
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
    headers: {
      'Content-Type': 'application/json',
    },
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

/**
 * MAIN TEST FUNCTION
 * 
 * Simulates a realistic user journey:
 * 1. User arrives at the conference
 * 2. User thinks about the poll question
 * 3. User submits their response
 * 4. User may submit additional responses
 */
export default function() {
  // Simulate user arrival and initial page load
  const pageResponse = http.get(`${BASE_URL}/cew-polls/wiks`);
  check(pageResponse, {
    'page loads successfully': (r) => r.status === 200,
  });

  // Simulate user thinking time
  simulateUserThinking();

  // Randomly select a poll to submit
  const selectedPoll = ALL_POLLS[Math.floor(Math.random() * ALL_POLLS.length)];
  
  let submissionSuccess = false;
  
  if (selectedPoll.isRanking) {
    // Submit ranking poll
    submissionSuccess = submitRankingPoll(selectedPoll);
    console.log(`Virtual user submitted ranking poll: ${selectedPoll.pagePath} poll ${selectedPoll.pollIndex}`);
  } else {
    // Submit single-choice poll
    submissionSuccess = submitSingleChoicePoll(selectedPoll);
    console.log(`Virtual user submitted single-choice poll: ${selectedPoll.pagePath} poll ${selectedPoll.pollIndex}`);
  }

  // Simulate additional user behavior (some users submit multiple polls)
  if (Math.random() < 0.3) { // 30% chance of submitting another poll
    simulateUserThinking();
    
    const secondPoll = ALL_POLLS[Math.floor(Math.random() * ALL_POLLS.length)];
    
    if (secondPoll.isRanking) {
      submitRankingPoll(secondPoll);
    } else {
      submitSingleChoicePoll(secondPoll);
    }
    
    console.log(`Virtual user submitted second poll: ${secondPoll.pagePath} poll ${secondPoll.pollIndex}`);
  }

  // Simulate user staying on page (checking results)
  sleep(Math.random() * 3 + 1);
}

/**
 * SETUP FUNCTION (Optional)
 * Called once before the test starts
 */
export function setup() {
  console.log('🚀 Starting CEW Conference Polling Load Test');
  console.log(`📊 Target: 100 concurrent users over 2 minutes`);
  console.log(`🎯 Base URL: ${BASE_URL}`);
  console.log(`🔐 Auth Code: ${CEW_AUTH_CODE}`);
  console.log(`📝 Available Polls: ${ALL_POLLS.length} total`);
  console.log(`   - WIKS: ${WIKS_POLLS.length} single-choice polls`);
  console.log(`   - Holistic Protection: ${HOLISTIC_POLLS.filter(p => !p.isRanking).length} single-choice, ${HOLISTIC_POLLS.filter(p => p.isRanking).length} ranking`);
  console.log('');
}

/**
 * TEARDOWN FUNCTION (Optional)
 * Called once after the test ends
 */
export function teardown(data) {
  console.log('');
  console.log('✅ CEW Conference Polling Load Test Completed');
  console.log('📈 Check the results above for performance metrics');
  console.log('🎯 Key metrics to review:');
  console.log('   - Poll submission success rate');
  console.log('   - Response times (p95 should be < 2s)');
  console.log('   - HTTP request failure rate (should be < 10%)');
}
