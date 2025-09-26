import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

// Custom metrics
const wordcloudSubmissionRate = new Rate('wordcloud_submissions_successful');
const apiResponseRate = new Rate('api_responses_successful');

// Test configuration
export const options = {
  stages: [
    { duration: '30s', target: 10 }, // Ramp up to 10 users
    { duration: '3m', target: 25 },  // Stay at 25 users for 3 minutes
    { duration: '1m', target: 50 },  // Ramp up to 50 users
    { duration: '3m', target: 50 },  // Stay at 50 users for 3 minutes
    { duration: '30s', target: 0 },  // Ramp down to 0 users
  ],
  thresholds: {
    http_req_duration: ['p(95)<2000'], // 95% of requests must complete below 2s
    http_req_failed: ['rate<0.1'],     // Error rate must be below 10% (more lenient)
    wordcloud_submissions_successful: ['rate>0.95'], // 95% of wordcloud submissions must succeed (more lenient)
  },
};

// Base URLs
const BASE_URL = __ENV.BASE_URL || 'https://sstac-dashboard.vercel.app';

// Test data for wordcloud submissions (CEW pages only - survey-results require full authentication)
const WORDCLOUD_TEST_DATA = [
  // Prioritization wordcloud (poll_index 12)
  {
    pagePath: '/cew-polls/prioritization',
    pollIndex: 12,
    question: "Overall, what is the greatest barrier to advancing holistic sediment protection in BC?",
    predefinedOptions: [
      { display: "Data availability", keyword: "data" },
      { display: "Tools (models, test protocols, decision trees)", keyword: "tools" },
      { display: "Agreement on protection goals and spatial scale", keyword: "policy" },
      { display: "Resourcing (e.g., developing approach/tools, agreeing across peers)", keyword: "resources" },
      { display: "Other", keyword: "other" }
    ],
    maxWords: 3,
    wordLimit: 20,
    authCode: 'CEW2025'
  },
  // Tiered Framework wordcloud (poll_index 2) - Note: This should be single-choice, not wordcloud
  // But we'll test it anyway to see what happens
  {
    pagePath: '/cew-polls/tiered-framework',
    pollIndex: 2,
    question: "What is the biggest practical hurdle to overcome when implementing a Bayesian framework in the development of a scientific framework for deriving site-specific sediment standards (Tier 2)?",
    predefinedOptions: [], // No predefined options for this question
    maxWords: 3,
    wordLimit: 20,
    authCode: 'CEW2025'
  }
];

// Additional test words for variety including custom words
const ADDITIONAL_WORDS = [
  ['technology', 'innovation', 'tools'],
  ['funding', 'resources', 'capacity'],
  ['coordination', 'collaboration', 'partnership'],
  ['uncertainty', 'variability', 'complexity'],
  ['timeline', 'urgency', 'priority'],
  ['science', 'research', 'data'],
  ['policy', 'regulation', 'governance'],
  ['stakeholder', 'engagement', 'consensus'],
  ['cat', 'dog', 'bird'], // Custom test words
  ['implementation', 'compliance', 'monitoring']
];

// Helper function to get random words with variety
function getRandomWords(testData) {
  const usePredefined = Math.random() < 0.3; // 30% chance to use predefined options
  const useCustom = Math.random() < 0.2; // 20% chance to use custom words like "cat"
  
  if (usePredefined && testData.predefinedOptions && testData.predefinedOptions.length > 0) {
    // Use predefined options
    const selectedOption = testData.predefinedOptions[Math.floor(Math.random() * testData.predefinedOptions.length)];
    if (selectedOption.keyword === 'other') {
      // For "Other" option, use custom words
      const customWords = ['cat', 'dog', 'bird', 'fish', 'tree'];
      const numWords = Math.floor(Math.random() * 3) + 1;
      return customWords.slice(0, numWords);
    } else {
      // Use the keyword from predefined option
      return [selectedOption.keyword];
    }
  } else if (useCustom) {
    // Use custom test words
    const customWords = ['cat', 'dog', 'bird', 'fish', 'tree', 'mountain', 'ocean', 'forest'];
    const numWords = Math.floor(Math.random() * 3) + 1;
    return customWords.slice(0, numWords);
  } else {
    // Use regular additional words
    const wordSet = ADDITIONAL_WORDS[Math.floor(Math.random() * ADDITIONAL_WORDS.length)];
    const numWords = Math.floor(Math.random() * 3) + 1; // 1-3 words
    return wordSet.slice(0, numWords);
  }
}

// Test wordcloud poll submission
function testWordcloudPoll(pagePath, pollIndex, question, maxWords, wordLimit, authCode = null, testData = null) {
  const url = `${BASE_URL}/api/wordcloud-polls/submit`;
  const words = getRandomWords(testData);
  
  const payload = {
    pagePath,
    pollIndex,
    question,
    maxWords,
    wordLimit,
    words,
    authCode
  };

  console.log(`Submitting wordcloud poll: ${pagePath} poll_index=${pollIndex}, words=[${words.join(', ')}], authCode=${authCode || 'authenticated'}`);

  const response = http.post(url, JSON.stringify(payload), {
    headers: { 'Content-Type': 'application/json' },
  });

  const success = check(response, {
    'wordcloud poll submission successful': (r) => r.status === 200,
    'wordcloud poll response time < 1s': (r) => r.timings.duration < 1000,
    'wordcloud poll returns success message': (r) => {
      try {
        const data = JSON.parse(r.body);
        return data.success === true;
      } catch {
        return false;
      }
    },
  });

  if (!success) {
    console.error(`Wordcloud submission failed: ${response.status} - ${response.body}`);
  }

  wordcloudSubmissionRate.add(success);
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
    'wordcloud results returns valid data': (r) => {
      try {
        const data = JSON.parse(r.body);
        return data.results && Array.isArray(data.results.words);
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

// Main test function
export default function () {
  // Randomly choose a test scenario
  const testData = WORDCLOUD_TEST_DATA[Math.floor(Math.random() * WORDCLOUD_TEST_DATA.length)];
  
  console.log(`Testing wordcloud: ${testData.pagePath} poll_index=${testData.pollIndex}`);

  // Test page loading first
  const pageUrl = `${BASE_URL}${testData.pagePath}`;
  testPageLoad(pageUrl);
  sleep(1);

  // Test wordcloud poll submission
  const submissionSuccess = testWordcloudPoll(
    testData.pagePath,
    testData.pollIndex,
    testData.question,
    testData.maxWords,
    testData.wordLimit,
    testData.authCode,
    testData
  );
  
  if (submissionSuccess) {
    sleep(0.5);
    
    // Test wordcloud results fetching
    testWordcloudResults(testData.pagePath, testData.pollIndex, testData.authCode);
  }

  // Random sleep between 0.5-2 seconds to generate more responses
  sleep(Math.random() * 1.5 + 0.5);
}

// Test summary
export function handleSummary(data) {
  // Safely access metrics with fallbacks
  const httpReqs = data.metrics.http_reqs || { values: { count: 0 } };
  const httpReqFailed = data.metrics.http_req_failed || { values: { count: 0 } };
  const httpReqDuration = data.metrics.http_req_duration || { values: { avg: 0, 'p(95)': 0 } };
  const wordcloudSubmissions = data.metrics.wordcloud_submissions_successful || { values: { rate: 0 } };
  const apiResponses = data.metrics.api_responses_successful || { values: { rate: 0 } };
  
  return {
    'wordcloud-test-results.json': JSON.stringify({
      timestamp: new Date().toISOString(),
      test_duration: data.state?.testRunDurationMs || 0,
      total_requests: httpReqs.values.count,
      failed_requests: httpReqFailed.values.count,
      avg_response_time: httpReqDuration.values.avg,
      p95_response_time: httpReqDuration.values['p(95)'],
      wordcloud_submission_success_rate: wordcloudSubmissions.values.rate,
      api_response_success_rate: apiResponses.values.rate,
      thresholds: {
        response_time_p95: data.thresholds?.['http_req_duration'] || 'N/A',
        error_rate: data.thresholds?.['http_req_failed'] || 'N/A',
        wordcloud_success_rate: data.thresholds?.['wordcloud_submissions_successful'] || 'N/A',
      }
    }, null, 2),
  };
}
