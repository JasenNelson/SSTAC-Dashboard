// k6-wordcloud-basic.js
// Basic test for wordcloud polls only
// Uses unique user ID generation per submission (API behavior)

import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  scenarios: {
    wordcloud_test: {
      executor: 'ramping-vus',
      startVUs: 1,
      stages: [
        { duration: '10s', target: 5 },   // Quick ramp to 5 users
        { duration: '20s', target: 10 },  // Ramp to 10 users
        { duration: '10s', target: 0 },   // Quick ramp down
      ],
      exec: 'testWordcloudPolls',
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<2000'],
    http_req_failed: ['rate<0.05'],
    checks: ['rate>0.95'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

// Predefined word options for testing
const predefinedWords = [
  'Data', 'Tools', 'Policy', 'Resourcing', 'Funding', 'Research',
  'Standards', 'Guidance', 'Training', 'Collaboration', 'Technology',
  'Innovation', 'Implementation', 'Monitoring', 'Evaluation'
];

// Generate random words for testing
function generateRandomWords(maxWords = 3, wordLimit = 20) {
  const words = [];
  const numWords = Math.floor(Math.random() * maxWords) + 1; // 1 to maxWords
  
  for (let i = 0; i < numWords; i++) {
    const randomWord = predefinedWords[Math.floor(Math.random() * predefinedWords.length)];
    if (randomWord.length <= wordLimit) {
      words.push(randomWord);
    }
  }
  
  // Remove duplicates
  return [...new Set(words)];
}

// Test wordcloud polls (each submission gets unique user ID)
export function testWordcloudPolls() {
  const authCode = 'CEW2025';
  
  console.log(`🎯 Testing wordcloud polls with unique user ID generation`);
  
  // Test different wordcloud questions
  const testCases = [
    {
      pagePath: '/cew-polls/prioritization',
      pollIndex: 4,
      question: "Overall, what is the greatest barrier to advancing holistic sediment protection in BC?",
      maxWords: 1, // Single choice wordcloud
      wordLimit: 20,
      words: generateRandomWords(1, 20)
    },
    {
      pagePath: '/cew-polls/prioritization',
      pollIndex: 5,
      question: "What are the key opportunities for advancing holistic sediment protection?",
      maxWords: 3, // Multi-word wordcloud
      wordLimit: 20,
      words: generateRandomWords(3, 20)
    }
  ];
  
  let successCount = 0;
  
  testCases.forEach((testCase, index) => {
    const payload = {
      pagePath: testCase.pagePath,
      pollIndex: testCase.pollIndex,
      question: testCase.question,
      maxWords: testCase.maxWords,
      wordLimit: testCase.wordLimit,
      words: testCase.words,
      authCode: authCode
    };
    
    const response = http.post(`${BASE_URL}/api/wordcloud-polls/submit`, JSON.stringify(payload), {
      headers: {
        'Content-Type': 'application/json'
        // NOTE: No x-session-id header - wordcloud polls generate unique user IDs
      },
    });
    
    const success = check(response, {
      [`Wordcloud poll ${index + 1} status is 200`]: (r) => r.status === 200,
      [`Wordcloud poll ${index + 1} response time < 2s`]: (r) => r.timings.duration < 2000,
      [`Wordcloud poll ${index + 1} has success field`]: (r) => {
        try {
          const body = JSON.parse(r.body);
          return body.success === true;
        } catch (e) {
          return false;
        }
      }
    });
    
    if (success) {
      successCount++;
      console.log(`✅ Wordcloud poll ${index + 1} successful with words: ${testCase.words.join(', ')}`);
    } else {
      console.log(`❌ Wordcloud poll ${index + 1} failed: ${response.status} - ${response.body}`);
    }
    
    sleep(0.5); // Brief pause between requests
  });
  
  console.log(`📊 Wordcloud polls: ${successCount}/${testCases.length} successful`);
  
  // Test wordcloud results retrieval
  if (successCount > 0) {
    testWordcloudResults();
  }
}

// Test wordcloud results retrieval
function testWordcloudResults() {
  console.log(`📊 Testing wordcloud results retrieval`);
  
  const testPages = [
    '/cew-polls/prioritization'
  ];
  
  testPages.forEach((pagePath, index) => {
    const response = http.get(`${BASE_URL}/api/wordcloud-polls/results?pagePath=${encodeURIComponent(pagePath)}`);
    
    const success = check(response, {
      [`Wordcloud results ${index + 1} status is 200`]: (r) => r.status === 200,
      [`Wordcloud results ${index + 1} response time < 2s`]: (r) => r.timings.duration < 2000,
      [`Wordcloud results ${index + 1} has data`]: (r) => {
        try {
          const body = JSON.parse(r.body);
          return Array.isArray(body) && body.length > 0;
        } catch (e) {
          return false;
        }
      }
    });
    
    if (success) {
      console.log(`✅ Wordcloud results ${index + 1} successful`);
    } else {
      console.log(`❌ Wordcloud results ${index + 1} failed: ${response.status} - ${response.body}`);
    }
    
    sleep(0.3);
  });
}

// Test wordcloud validation (edge cases)
function testWordcloudValidation() {
  console.log(`🔍 Testing wordcloud validation edge cases`);
  
  const authCode = 'CEW2025';
  
  // Test cases for validation
  const validationTests = [
    {
      name: 'Empty words array',
      payload: {
        pagePath: '/cew-polls/prioritization',
        pollIndex: 4,
        question: 'Test question',
        maxWords: 1,
        wordLimit: 20,
        words: [],
        authCode: authCode
      },
      expectedStatus: 400
    },
    {
      name: 'Too many words',
      payload: {
        pagePath: '/cew-polls/prioritization',
        pollIndex: 4,
        question: 'Test question',
        maxWords: 1,
        wordLimit: 20,
        words: ['word1', 'word2', 'word3'],
        authCode: authCode
      },
      expectedStatus: 400
    },
    {
      name: 'Word too long',
      payload: {
        pagePath: '/cew-polls/prioritization',
        pollIndex: 4,
        question: 'Test question',
        maxWords: 1,
        wordLimit: 5,
        words: ['verylongword'],
        authCode: authCode
      },
      expectedStatus: 400
    },
    {
      name: 'Duplicate words',
      payload: {
        pagePath: '/cew-polls/prioritization',
        pollIndex: 4,
        question: 'Test question',
        maxWords: 3,
        wordLimit: 20,
        words: ['word1', 'word2', 'word1'],
        authCode: authCode
      },
      expectedStatus: 400
    }
  ];
  
  validationTests.forEach((test, index) => {
    const response = http.post(`${BASE_URL}/api/wordcloud-polls/submit`, JSON.stringify(test.payload), {
      headers: {
        'Content-Type': 'application/json'
      },
    });
    
    const success = check(response, {
      [`Validation test ${index + 1} (${test.name}) status is ${test.expectedStatus}`]: (r) => r.status === test.expectedStatus
    });
    
    if (success) {
      console.log(`✅ Validation test ${index + 1} (${test.name}) passed`);
    } else {
      console.log(`❌ Validation test ${index + 1} (${test.name}) failed: ${response.status} - ${response.body}`);
    }
    
    sleep(0.2);
  });
}

export function setup() {
  console.log('🔍 Starting wordcloud poll test...');
  console.log(`Base URL: ${BASE_URL}`);
  console.log('Testing: Wordcloud polls with unique user ID generation per submission');
  console.log('Note: Wordcloud polls cannot be paired for matrix graphs (different user ID generation)');
  return {};
}

// Default function for k6
export default function() {
  testWordcloudPolls();
}
