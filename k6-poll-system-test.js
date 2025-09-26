import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

// Custom metrics
const pollSubmissionRate = new Rate('poll_submissions_successful');
const rankingSubmissionRate = new Rate('ranking_submissions_successful');
const wordcloudSubmissionRate = new Rate('wordcloud_submissions_successful');
const apiResponseRate = new Rate('api_responses_successful');

// Test configuration
export const options = {
  stages: [
    { duration: '30s', target: 20 }, // Ramp up to 20 users
    { duration: '2m', target: 50 },  // Stay at 50 users
    { duration: '1m', target: 100 }, // Ramp up to 100 users
    { duration: '2m', target: 100 }, // Stay at 100 users
    { duration: '30s', target: 0 },  // Ramp down to 0 users
  ],
  thresholds: {
    http_req_duration: ['p(95)<2000'], // 95% of requests must complete below 2s
    http_req_failed: ['rate<0.1'],     // Error rate must be below 10%
    poll_submissions_successful: ['rate>0.95'], // 95% of poll submissions must succeed
    ranking_submissions_successful: ['rate>0.95'], // 95% of ranking submissions must succeed
    wordcloud_submissions_successful: ['rate>0.95'], // 95% of wordcloud submissions must succeed
  },
};

// Base URLs
const BASE_URL = __ENV.BASE_URL || 'https://sstac-dashboard.vercel.app';
const SURVEY_BASE = `${BASE_URL}/survey-results`;
const CEW_BASE = `${BASE_URL}/cew-polls`;

// Test data
const CEW_CODE = 'CEW2025';
const TEST_WORDS = [
  ['policy', 'regulation', 'enforcement'],
  ['science', 'research', 'data'],
  ['stakeholder', 'engagement', 'collaboration'],
  ['implementation', 'compliance', 'monitoring'],
  ['technology', 'innovation', 'tools']
];

// Helper function to get random words for wordcloud
function getRandomWords() {
  const wordSet = TEST_WORDS[Math.floor(Math.random() * TEST_WORDS.length)];
  const numWords = Math.floor(Math.random() * 3) + 1; // 1-3 words
  return wordSet.slice(0, numWords);
}

// Helper function to get random option index
function getRandomOptionIndex(maxOptions = 5) {
  return Math.floor(Math.random() * maxOptions);
}

// Helper function to get random ranking
function getRandomRanking(numOptions = 4) {
  const options = Array.from({ length: numOptions }, (_, i) => i);
  const ranking = [];
  
  for (let i = 0; i < numOptions; i++) {
    const randomIndex = Math.floor(Math.random() * options.length);
    ranking.push(options.splice(randomIndex, 1)[0]);
  }
  
  return ranking;
}

// Test single-choice poll submission
function testSingleChoicePoll(pagePath, pollIndex, question, options, authCode = null) {
  const url = `${BASE_URL}/api/polls/submit`;
  const payload = {
    pagePath,
    pollIndex,
    question,
    options,
    optionIndex: getRandomOptionIndex(options.length),
    authCode
  };

  const response = http.post(url, JSON.stringify(payload), {
    headers: { 'Content-Type': 'application/json' },
  });

  const success = check(response, {
    'single-choice poll submission successful': (r) => r.status === 200,
    'single-choice poll response time < 1s': (r) => r.timings.duration < 1000,
  });

  pollSubmissionRate.add(success);
  apiResponseRate.add(success);
  
  return success;
}

// Test ranking poll submission
function testRankingPoll(pagePath, pollIndex, question, options, authCode = null) {
  const url = `${BASE_URL}/api/ranking-polls/submit`;
  const ranking = getRandomRanking(options.length);
  
  const payload = {
    pagePath,
    pollIndex,
    question,
    options,
    ranking,
    authCode
  };

  const response = http.post(url, JSON.stringify(payload), {
    headers: { 'Content-Type': 'application/json' },
  });

  const success = check(response, {
    'ranking poll submission successful': (r) => r.status === 200,
    'ranking poll response time < 1s': (r) => r.timings.duration < 1000,
  });

  rankingSubmissionRate.add(success);
  apiResponseRate.add(success);
  
  return success;
}

// Test wordcloud poll submission
function testWordcloudPoll(pagePath, pollIndex, question, maxWords = 3, wordLimit = 20, authCode = null) {
  const url = `${BASE_URL}/api/wordcloud-polls/submit`;
  const words = getRandomWords();
  
  const payload = {
    pagePath,
    pollIndex,
    question,
    maxWords,
    wordLimit,
    words,
    authCode
  };

  const response = http.post(url, JSON.stringify(payload), {
    headers: { 'Content-Type': 'application/json' },
  });

  const success = check(response, {
    'wordcloud poll submission successful': (r) => r.status === 200,
    'wordcloud poll response time < 1s': (r) => r.timings.duration < 1000,
  });

  wordcloudSubmissionRate.add(success);
  apiResponseRate.add(success);
  
  return success;
}

// Test poll results fetching
function testPollResults(pagePath, pollIndex, authCode = null) {
  const url = `${BASE_URL}/api/polls/results`;
  const params = {
    pagePath,
    pollIndex: pollIndex.toString(),
    ...(authCode && { authCode })
  };

  const response = http.get(url, { params });

  const success = check(response, {
    'poll results fetch successful': (r) => r.status === 200,
    'poll results response time < 500ms': (r) => r.timings.duration < 500,
  });

  apiResponseRate.add(success);
  return success;
}

// Test ranking poll results fetching
function testRankingResults(pagePath, pollIndex, authCode = null) {
  const url = `${BASE_URL}/api/ranking-polls/results`;
  const params = {
    pagePath,
    pollIndex: pollIndex.toString(),
    ...(authCode && { authCode })
  };

  const response = http.get(url, { params });

  const success = check(response, {
    'ranking results fetch successful': (r) => r.status === 200,
    'ranking results response time < 500ms': (r) => r.timings.duration < 500,
  });

  apiResponseRate.add(success);
  return success;
}

// Test wordcloud poll results fetching
function testWordcloudResults(pagePath, pollIndex, authCode = null) {
  const url = `${BASE_URL}/api/wordcloud-polls/results`;
  const params = {
    pagePath,
    pollIndex: pollIndex.toString(),
    ...(authCode && { authCode })
  };

  const response = http.get(url, { params });

  const success = check(response, {
    'wordcloud results fetch successful': (r) => r.status === 200,
    'wordcloud results response time < 500ms': (r) => r.timings.duration < 500,
  });

  apiResponseRate.add(success);
  return success;
}

// Test prioritization matrix graph data
function testPrioritizationMatrix() {
  const url = `${BASE_URL}/api/graphs/prioritization-matrix`;
  
  const response = http.get(url);

  const success = check(response, {
    'prioritization matrix fetch successful': (r) => r.status === 200,
    'prioritization matrix response time < 1s': (r) => r.timings.duration < 1000,
    'prioritization matrix returns data': (r) => {
      try {
        const data = JSON.parse(r.body);
        return Array.isArray(data) && data.length > 0;
      } catch {
        return false;
      }
    },
  });

  apiResponseRate.add(success);
  return success;
}

// Test page loading
function testPageLoad(url) {
  const response = http.get(url);
  
  const success = check(response, {
    'page loads successfully': (r) => r.status === 200,
    'page response time < 2s': (r) => r.timings.duration < 2000,
  });

  apiResponseRate.add(success);
  return success;
}

// Main test scenarios
export default function () {
  // Randomly choose between survey-results and cew-polls
  const isCEW = Math.random() < 0.5;
  const basePath = isCEW ? CEW_BASE : SURVEY_BASE;
  const authCode = isCEW ? CEW_CODE : null;
  
  console.log(`Testing ${isCEW ? 'CEW' : 'Survey'} polls with authCode: ${authCode || 'authenticated'}`);

  // Test page loading
  const pages = [
    `${basePath}/holistic-protection`,
    `${basePath}/prioritization`,
    `${basePath}/tiered-framework`,
  ];
  
  const pageUrl = pages[Math.floor(Math.random() * pages.length)];
  testPageLoad(pageUrl);
  sleep(1);

  // Test Holistic Protection polls
  if (pageUrl.includes('holistic-protection')) {
    // Single-choice poll (poll_index 0)
    testSingleChoicePoll(
      `${basePath}/holistic-protection`,
      0,
      "Given the potential for over-conservatism in current sediment quality standards, which approach would be most effective for balancing environmental protection with practical implementation?",
      [
        "Site-specific risk assessment with bioavailability adjustments",
        "Tiered framework with multiple lines of evidence",
        "Matrix-based standards with ecosystem-specific considerations",
        "Probabilistic approaches incorporating uncertainty",
        "Other"
      ],
      authCode
    );
    sleep(0.5);

    // Ranking poll (poll_index 1)
    testRankingPoll(
      `${basePath}/holistic-protection`,
      1,
      "Rank in order of highest to lowest importance the following factors for developing holistic sediment protection standards:",
      [
        "Scientific rigor and peer review",
        "Stakeholder engagement and consensus building",
        "Regulatory feasibility and implementation",
        "Economic considerations and cost-effectiveness",
        "Environmental protection and risk reduction"
      ],
      authCode
    );
    sleep(0.5);
  }

  // Test Prioritization polls
  if (pageUrl.includes('prioritization')) {
    // Test single-choice polls (poll_index 0-9)
    for (let i = 0; i < 10; i++) {
      testSingleChoicePoll(
        `${basePath}/prioritization`,
        i,
        `Prioritization question ${i + 1}`,
        ["Very important", "Important", "Moderately important", "Less important", "Not important"],
        authCode
      );
      sleep(0.2);
    }

    // Test ranking polls (poll_index 10-11)
    for (let i = 10; i < 12; i++) {
      testRankingPoll(
        `${basePath}/prioritization`,
        i,
        `Ranking question ${i + 1}`,
        ["Option A", "Option B", "Option C", "Option D", "Option E"],
        authCode
      );
      sleep(0.2);
    }

    // Test wordcloud poll (poll_index 12)
    testWordcloudPoll(
      `${basePath}/prioritization`,
      12,
      "Overall, what is the greatest barrier to advancing holistic sediment protection in BC?",
      3,
      20,
      authCode
    );
    sleep(0.5);

    // Test prioritization matrix graph
    testPrioritizationMatrix();
    sleep(0.5);
  }

  // Test Tiered Framework polls
  if (pageUrl.includes('tiered-framework')) {
    // Single-choice poll (poll_index 0)
    testSingleChoicePoll(
      `${basePath}/tiered-framework`,
      0,
      "In developing Protocol 2 requirements for sediment quality assessment, which approach would provide the most robust scientific foundation?",
      [
        "Equilibrium partitioning theory with site-specific measurements",
        "Probabilistic risk assessment with multiple stressor considerations",
        "Tiered approach with increasing levels of complexity",
        "Matrix-based standards with bioavailability adjustments",
        "Other"
      ],
      authCode
    );
    sleep(0.5);

    // Ranking poll (poll_index 1)
    testRankingPoll(
      `${basePath}/tiered-framework`,
      1,
      "Please rank the following lines of evidence in order of importance for Tier 2 sediment quality assessment:",
      [
        "Chemical analysis of sediment contaminants",
        "Toxicity testing with benthic organisms",
        "Bioaccumulation studies in resident species",
        "Field surveys of benthic community structure",
        "Laboratory bioassays with standard test species"
      ],
      authCode
    );
    sleep(0.5);

    // Wordcloud poll (poll_index 2)
    testWordcloudPoll(
      `${basePath}/tiered-framework`,
      2,
      "What are the key challenges in implementing a tiered framework for sediment quality assessment?",
      3,
      20,
      authCode
    );
    sleep(0.5);
  }

  // Test results fetching for all poll types
  const pollTypes = ['polls', 'ranking-polls', 'wordcloud-polls'];
  const pollIndices = [0, 1, 2];
  
  for (const pollType of pollTypes) {
    for (const pollIndex of pollIndices) {
      if (pollType === 'polls') {
        testPollResults(pageUrl, pollIndex, authCode);
      } else if (pollType === 'ranking-polls') {
        testRankingResults(pageUrl, pollIndex, authCode);
      } else if (pollType === 'wordcloud-polls') {
        testWordcloudResults(pageUrl, pollIndex, authCode);
      }
      sleep(0.1);
    }
  }

  // Random sleep between 1-3 seconds
  sleep(Math.random() * 2 + 1);
}

// Test summary
export function handleSummary(data) {
  return {
    'poll-system-test-results.json': JSON.stringify({
      timestamp: new Date().toISOString(),
      test_duration: data.state.testRunDurationMs,
      total_requests: data.metrics.http_reqs.values.count,
      failed_requests: data.metrics.http_req_failed.values.count,
      avg_response_time: data.metrics.http_req_duration.values.avg,
      p95_response_time: data.metrics.http_req_duration.values['p(95)'],
      poll_submission_success_rate: data.metrics.poll_submissions_successful.values.rate,
      ranking_submission_success_rate: data.metrics.ranking_submissions_successful.values.rate,
      wordcloud_submission_success_rate: data.metrics.wordcloud_submissions_successful.values.rate,
      api_response_success_rate: data.metrics.api_responses_successful.values.rate,
      thresholds: {
        response_time_p95: data.thresholds['http_req_duration'],
        error_rate: data.thresholds['http_req_failed'],
        poll_success_rate: data.thresholds['poll_submissions_successful'],
        ranking_success_rate: data.thresholds['ranking_submissions_successful'],
        wordcloud_success_rate: data.thresholds['wordcloud_submissions_successful'],
      }
    }, null, 2),
  };
}
