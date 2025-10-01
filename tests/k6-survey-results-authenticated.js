// k6-survey-results-authenticated.js
// k6 test for authenticated survey-results pages (SSTAC & TWG members)
// Tests all survey-results poll types with proper authentication

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const responseTime = new Trend('response_time');
const authSuccessRate = new Rate('auth_success');
const pollSubmissionRate = new Rate('survey_poll_submissions');

// Test configuration - Authenticated users
export const options = {
  scenarios: {
    // Scenario 1: Survey-Results Authentication and Polling (20 VUs)
    survey_results_auth: {
      executor: 'ramping-vus',
      startVUs: 1,
      stages: [
        { duration: '30s', target: 5 },     // Ramp to 5 users
        { duration: '1m', target: 10 },     // Ramp to 10 users
        { duration: '2m', target: 20 },     // Ramp to 20 users
        { duration: '1m', target: 0 },      // Ramp down
      ],
      exec: 'testSurveyResultsAuthenticated',
    },
  },
  
  // Performance thresholds
  thresholds: {
    http_req_duration: ['p(95)<3000'], // 95% of requests under 3s
    http_req_failed: ['rate<0.1'],     // Less than 10% failed requests
    errors: ['rate<0.05'],             // Less than 5% errors
    auth_success: ['rate>0.8'],        // At least 80% authentication success
    survey_poll_submissions: ['rate>0.7'], // At least 70% poll submissions succeed
  },
};

// Base URL configuration
const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

// Test credentials (you'll need to provide real credentials)
const TEST_CREDENTIALS = {
  email: __ENV.TEST_EMAIL || 'test@example.com',
  password: __ENV.TEST_PASSWORD || 'testpassword123'
};

// Generate unique user ID for each virtual user
function generateUniqueUserId() {
  const timestamp = Date.now();
  const vuId = __VU;
  const iteration = __ITER;
  const random = Math.floor(Math.random() * 10000);
  return `SSTAC-TWG-${vuId}-${iteration}-${random}`;
}

// Test Survey-Results Authenticated System
export function testSurveyResultsAuthenticated() {
  const userId = generateUniqueUserId();
  
  console.log(`🔐 Authenticated User ${__VU}: Starting survey-results test with ID: ${userId}`);
  
  // Step 1: Login and get session
  const session = authenticateUser();
  if (!session) {
    console.log(`❌ User ${userId}: Authentication failed`);
    return;
  }
  
  // Step 2: Test Holistic Protection Survey-Results
  testHolisticProtectionSurvey(session);
  sleep(1);
  
  // Step 3: Test Tiered Framework Survey-Results
  testTieredFrameworkSurvey(session);
  sleep(1);
  
  // Step 4: Test Prioritization Survey-Results
  testPrioritizationSurvey(session);
  sleep(1);
  
  // Step 5: Test Matrix Graphs with Authenticated Data
  testMatrixGraphsAuthenticated(session);
  
  console.log(`✅ Authenticated User ${__VU}: Completed survey-results test`);
}

// Authenticate user and return session cookies
function authenticateUser() {
  console.log(`🔑 Attempting authentication for user: ${TEST_CREDENTIALS.email}`);
  
  // Step 1: Get login page
  const loginPageResponse = http.get(`${BASE_URL}/login`, {
    tags: { step: 'get_login_page' }
  });
  
  const loginPageSuccess = check(loginPageResponse, {
    'login page loads': (r) => r.status === 200,
  });
  
  if (!loginPageSuccess) {
    errorRate.add(true);
    return null;
  }
  
  // Step 2: Submit login credentials
  const loginPayload = {
    email: TEST_CREDENTIALS.email,
    password: TEST_CREDENTIALS.password
  };
  
  const loginResponse = http.post(`${BASE_URL}/api/auth/login`, JSON.stringify(loginPayload), {
    headers: { 'Content-Type': 'application/json' },
    tags: { step: 'submit_login' }
  });
  
  const loginSuccess = check(loginResponse, {
    'login successful': (r) => r.status === 200 || r.status === 302,
    'login response time < 3s': (r) => r.timings.duration < 3000,
  });
  
  authSuccessRate.add(loginSuccess);
  errorRate.add(!loginSuccess);
  responseTime.add(loginResponse.timings.duration);
  
  if (!loginSuccess) {
    console.log(`❌ Login failed for ${TEST_CREDENTIALS.email}`);
    return null;
  }
  
  console.log(`✅ Login successful for ${TEST_CREDENTIALS.email}`);
  
  // Return session cookies for subsequent requests
  return {
    cookies: loginResponse.headers['Set-Cookie'] || [],
    sessionId: extractSessionId(loginResponse)
  };
}

// Extract session ID from response
function extractSessionId(response) {
  // This would need to be implemented based on your authentication system
  // For now, return a placeholder
  return `session-${Date.now()}-${__VU}`;
}

// Test Holistic Protection Survey-Results
function testHolisticProtectionSurvey(session) {
  console.log(`📊 Testing Holistic Protection Survey-Results`);
  
  // Test the same 8 questions as CEW but with authenticated user
  const questions = [
    { poll_index: 0, pagePath: '/survey-results/holistic-protection' },
    { poll_index: 1, pagePath: '/survey-results/holistic-protection' },
    { poll_index: 2, pagePath: '/survey-results/holistic-protection' },
    { poll_index: 3, pagePath: '/survey-results/holistic-protection' },
    { poll_index: 4, pagePath: '/survey-results/holistic-protection' },
    { poll_index: 5, pagePath: '/survey-results/holistic-protection' },
    { poll_index: 6, pagePath: '/survey-results/holistic-protection' },
    { poll_index: 7, pagePath: '/survey-results/holistic-protection' }
  ];
  
  questions.forEach((q, index) => {
    const randomOption = Math.floor(Math.random() * 5); // 5 options per question
    const success = submitAuthenticatedSingleChoiceVote(session, q.pagePath, q.poll_index, randomOption);
    
    if (success) {
      console.log(`✅ Holistic Protection Survey Q${index + 1} submitted`);
    }
    
    sleep(0.5 + Math.random() * 1.0);
  });
}

// Test Tiered Framework Survey-Results
function testTieredFrameworkSurvey(session) {
  console.log(`📊 Testing Tiered Framework Survey-Results`);
  
  const questions = [
    { poll_index: 0, pagePath: '/survey-results/tiered-framework' },
    { poll_index: 1, pagePath: '/survey-results/tiered-framework' },
    { poll_index: 2, pagePath: '/survey-results/tiered-framework' }
  ];
  
  questions.forEach((q, index) => {
    const randomOption = Math.floor(Math.random() * 5); // 5 options per question
    const success = submitAuthenticatedSingleChoiceVote(session, q.pagePath, q.poll_index, randomOption);
    
    if (success) {
      console.log(`✅ Tiered Framework Survey Q${index + 1} submitted`);
    }
    
    sleep(0.5 + Math.random() * 1.0);
  });
}

// Test Prioritization Survey-Results
function testPrioritizationSurvey(session) {
  console.log(`📊 Testing Prioritization Survey-Results`);
  
  // Single-choice questions (Q1-Q2)
  const singleChoiceQuestions = [
    { poll_index: 0, pagePath: '/survey-results/prioritization' },
    { poll_index: 1, pagePath: '/survey-results/prioritization' }
  ];
  
  singleChoiceQuestions.forEach((q, index) => {
    const randomOption = Math.floor(Math.random() * 5);
    const success = submitAuthenticatedSingleChoiceVote(session, q.pagePath, q.poll_index, randomOption);
    
    if (success) {
      console.log(`✅ Prioritization Survey Single-Choice Q${index + 1} submitted`);
    }
    
    sleep(0.5 + Math.random() * 1.0);
  });
  
  // Ranking questions (Q3-Q4)
  const rankingQuestions = [
    { poll_index: 0, pagePath: '/survey-results/prioritization' }, // ranking poll index
    { poll_index: 1, pagePath: '/survey-results/prioritization' }  // ranking poll index
  ];
  
  rankingQuestions.forEach((q, index) => {
    // Generate random ranking
    const ranking = Array.from({length: 5}, (_, i) => i);
    for (let i = ranking.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [ranking[i], ranking[j]] = [ranking[j], ranking[i]];
    }
    
    const success = submitAuthenticatedRankingVote(session, q.pagePath, q.poll_index, ranking);
    
    if (success) {
      console.log(`✅ Prioritization Survey Ranking Q${index + 1} submitted`);
    }
    
    sleep(0.5 + Math.random() * 1.0);
  });
  
  // Wordcloud question (Q5)
  const wordOptions = [
    "uncertainty", "cost", "implementation", "data", "regulatory", "acceptance",
    "validation", "standardization", "guidance", "training", "communication"
  ];
  
  const numWords = 1 + Math.floor(Math.random() * 3);
  const selectedWords = [];
  for (let i = 0; i < numWords; i++) {
    const randomWord = wordOptions[Math.floor(Math.random() * wordOptions.length)];
    if (!selectedWords.includes(randomWord)) {
      selectedWords.push(randomWord);
    }
  }
  
  const success = submitAuthenticatedWordcloudVote(session, '/survey-results/prioritization', 0, selectedWords);
  
  if (success) {
    console.log(`✅ Prioritization Survey Wordcloud submitted`);
  }
}

// Test Matrix Graphs with Authenticated Data
function testMatrixGraphsAuthenticated(session) {
  console.log(`📈 Testing Matrix Graphs with authenticated data`);
  
  const filters = ['all', 'twg'];
  const filter = filters[Math.floor(Math.random() * filters.length)];
  
  const response = http.get(`${BASE_URL}/api/graphs/prioritization-matrix?filter=${filter}`, {
    headers: {
      'Cookie': session.cookies.join('; ')
    },
    tags: { api: 'matrix_graphs_auth', filter: filter }
  });
  
  const success = check(response, {
    'authenticated matrix graph API responds': (r) => r.status === 200,
    'authenticated matrix graph has data': (r) => {
      try {
        const data = JSON.parse(r.body);
        return data && data.length > 0;
      } catch {
        return false;
      }
    },
    'authenticated matrix graph response time < 3s': (r) => r.timings.duration < 3000,
  });
  
  errorRate.add(!success);
  responseTime.add(response.timings.duration);
  
  if (success) {
    console.log(`✅ Authenticated matrix graph API successful with filter: ${filter}`);
  }
}

// Submit authenticated single-choice vote
function submitAuthenticatedSingleChoiceVote(session, pagePath, pollIndex, optionIndex) {
  const payload = {
    pagePath,
    pollIndex,
    optionIndex
    // Note: authenticated users don't need user_id in payload
  };
  
  const response = http.post(`${BASE_URL}/api/polls/submit`, JSON.stringify(payload), {
    headers: { 
      'Content-Type': 'application/json',
      'Cookie': session.cookies.join('; ')
    },
    tags: { poll_type: 'single_choice_auth', page_path: pagePath }
  });
  
  const success = check(response, {
    'authenticated single choice vote submitted': (r) => r.status === 200,
    'authenticated vote response time < 2s': (r) => r.timings.duration < 2000,
  });
  
  pollSubmissionRate.add(success);
  errorRate.add(!success);
  responseTime.add(response.timings.duration);
  
  return success;
}

// Submit authenticated ranking vote
function submitAuthenticatedRankingVote(session, pagePath, pollIndex, ranking) {
  const payload = {
    pagePath,
    pollIndex,
    ranking
  };
  
  const response = http.post(`${BASE_URL}/api/ranking-polls/submit`, JSON.stringify(payload), {
    headers: { 
      'Content-Type': 'application/json',
      'Cookie': session.cookies.join('; ')
    },
    tags: { poll_type: 'ranking_auth', page_path: pagePath }
  });
  
  const success = check(response, {
    'authenticated ranking vote submitted': (r) => r.status === 200,
    'authenticated ranking response time < 2s': (r) => r.timings.duration < 2000,
  });
  
  pollSubmissionRate.add(success);
  errorRate.add(!success);
  responseTime.add(response.timings.duration);
  
  return success;
}

// Submit authenticated wordcloud vote
function submitAuthenticatedWordcloudVote(session, pagePath, pollIndex, words) {
  const payload = {
    pagePath,
    pollIndex,
    words
  };
  
  const response = http.post(`${BASE_URL}/api/wordcloud-polls/submit`, JSON.stringify(payload), {
    headers: { 
      'Content-Type': 'application/json',
      'Cookie': session.cookies.join('; ')
    },
    tags: { poll_type: 'wordcloud_auth', page_path: pagePath }
  });
  
  const success = check(response, {
    'authenticated wordcloud vote submitted': (r) => r.status === 200,
    'authenticated wordcloud response time < 2s': (r) => r.timings.duration < 2000,
  });
  
  pollSubmissionRate.add(success);
  errorRate.add(!success);
  responseTime.add(response.timings.duration);
  
  return success;
}

// Test summary
export function teardown(data) {
  console.log('🏁 Survey-Results Authenticated Test Complete');
  console.log('📊 Final Results:');
  console.log(`   - Authentication success rate: ${authSuccessRate.rate}`);
  console.log(`   - Survey poll submission rate: ${pollSubmissionRate.rate}`);
  console.log(`   - Error rate: ${errorRate.rate}`);
  console.log('🎯 Survey-results system ready for SSTAC & TWG members!');
}
