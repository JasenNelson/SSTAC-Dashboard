import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Rate, Trend, Counter, Gauge } from 'k6/metrics';
import { randomIntBetween, randomString } from 'https://jslib.k6.io/k6-utils/1.4.0/index.js';

// Custom metrics for poll submissions
const pollSubmissionDuration = new Trend('poll_submission_duration');
const rankingSubmissionDuration = new Trend('ranking_submission_duration');
const wordcloudSubmissionDuration = new Trend('wordcloud_submission_duration');
const pollSubmissionSuccess = new Counter('poll_submission_success');
const rankingSubmissionSuccess = new Counter('ranking_submission_success');
const wordcloudSubmissionSuccess = new Counter('wordcloud_submission_success');
const submissionErrorRate = new Rate('submission_errors');
const activeUsers = new Gauge('active_users');

// Test configuration with realistic load patterns
export const options = {
  stages: [
    // Ramp-up: 0 to 50 virtual users over 30 seconds
    { duration: '30s', target: 50, name: 'ramp-up' },
    // Sustain: 50 users submitting for 2 minutes
    { duration: '2m', target: 50, name: 'sustain' },
    // Spike: Jump to 100 concurrent submissions for 30 seconds
    { duration: '30s', target: 100, name: 'spike' },
    // Ramp-down: Back to 0 users
    { duration: '30s', target: 0, name: 'ramp-down' }
  ],
  thresholds: {
    'http_req_duration': ['p(95)<500', 'p(99)<1000'],
    'http_req_failed': ['rate<0.01'],
    'submission_errors': ['rate<0.01'],
    'poll_submission_duration': ['p(95)<500'],
    'ranking_submission_duration': ['p(95)<500'],
    'wordcloud_submission_duration': ['p(95)<500']
  }
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

// eslint-disable-next-line import/no-anonymous-default-export
export default function () {
  activeUsers.set(__VU);
  const sessionId = `session-${__VU}-${Date.now()}`;

  // Test regular poll submission
  group('Poll Submission - POST', () => {
    const pollPayload = JSON.stringify({
      pagePath: '/cew-polls/holistic-protection',
      pollIndex: 0,
      question: 'Which approach do you prefer?',
      options: ['Option A', 'Option B', 'Option C'],
      optionIndex: randomIntBetween(0, 2),
      otherText: null,
      authCode: 'CEW2025'
    });

    const pollRes = http.post(`${BASE_URL}/api/polls/submit`, pollPayload, {
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'x-session-id': sessionId
      },
      timeout: '10s'
    });

    const pollChecks = check(pollRes, {
      'POST /api/polls/submit status 200': (r) => r.status === 200,
      'POST /api/polls/submit response has success': (r) => r.json('success') === true,
      'POST /api/polls/submit response time < 500ms': (r) => r.timings.duration < 500,
      'POST /api/polls/submit has pollId': (r) => r.json('pollId') !== undefined
    });

    if (pollChecks) {
      pollSubmissionSuccess.add(1);
      pollSubmissionDuration.add(pollRes.timings.duration);
    } else {
      submissionErrorRate.add(1);
    }

    sleep(randomIntBetween(1, 3));
  });

  // Test ranking poll submission
  group('Ranking Poll Submission - POST', () => {
    const rankingPayload = JSON.stringify({
      pagePath: '/cew-polls/prioritization',
      pollIndex: 1,
      question: 'Rank these items by importance',
      options: ['Item 1', 'Item 2', 'Item 3', 'Item 4'],
      rankings: [
        { optionIndex: 0, rank: 1 },
        { optionIndex: 1, rank: 2 },
        { optionIndex: 2, rank: 3 },
        { optionIndex: 3, rank: 4 }
      ],
      authCode: 'CEW2025'
    });

    const rankingRes = http.post(`${BASE_URL}/api/ranking-polls/submit`, rankingPayload, {
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'x-session-id': sessionId
      },
      timeout: '10s'
    });

    const rankingChecks = check(rankingRes, {
      'POST /api/ranking-polls/submit status 200': (r) => r.status === 200,
      'POST /api/ranking-polls/submit response has success': (r) => r.json('success') === true,
      'POST /api/ranking-polls/submit response time < 500ms': (r) => r.timings.duration < 500,
      'POST /api/ranking-polls/submit has pollId': (r) => r.json('pollId') !== undefined
    });

    if (rankingChecks) {
      rankingSubmissionSuccess.add(1);
      rankingSubmissionDuration.add(rankingRes.timings.duration);
    } else {
      submissionErrorRate.add(1);
    }

    sleep(randomIntBetween(1, 3));
  });

  // Test wordcloud poll submission
  group('Wordcloud Poll Submission - POST', () => {
    const words = [
      randomString(5),
      randomString(6),
      randomString(4)
    ];

    const wordcloudPayload = JSON.stringify({
      pagePath: '/cew-polls/feedback',
      pollIndex: 2,
      question: 'Share your key thoughts (max 3 words)',
      maxWords: 3,
      wordLimit: 20,
      words: words,
      authCode: 'CEW2025'
    });

    const wordcloudRes = http.post(`${BASE_URL}/api/wordcloud-polls/submit`, wordcloudPayload, {
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'x-session-id': sessionId
      },
      timeout: '10s'
    });

    const wordcloudChecks = check(wordcloudRes, {
      'POST /api/wordcloud-polls/submit status 200': (r) => r.status === 200,
      'POST /api/wordcloud-polls/submit response has success': (r) => r.json('success') === true,
      'POST /api/wordcloud-polls/submit response time < 500ms': (r) => r.timings.duration < 500,
      'POST /api/wordcloud-polls/submit has pollId': (r) => r.json('pollId') !== undefined
    });

    if (wordcloudChecks) {
      wordcloudSubmissionSuccess.add(1);
      wordcloudSubmissionDuration.add(wordcloudRes.timings.duration);
    } else {
      submissionErrorRate.add(1);
    }

    sleep(randomIntBetween(1, 3));
  });

  // Sequential mixed load: Poll -> Ranking -> Wordcloud
  group('Mixed Poll Submission Sequence', () => {
    // First submit a regular poll
    const pollPayload = JSON.stringify({
      pagePath: '/cew-polls/mixed-test',
      pollIndex: 0,
      question: 'Test question',
      options: ['Yes', 'No', 'Maybe'],
      optionIndex: randomIntBetween(0, 2),
      authCode: 'CEW2025'
    });

    const pollRes = http.post(`${BASE_URL}/api/polls/submit`, pollPayload, {
      headers: {
        'Content-Type': 'application/json',
        'x-session-id': sessionId
      }
    });

    check(pollRes, {
      'Mixed - Poll submission successful': (r) => r.status === 200
    });

    sleep(0.5);

    // Then submit a ranking
    const rankingPayload = JSON.stringify({
      pagePath: '/cew-polls/mixed-test',
      pollIndex: 1,
      question: 'Rank items',
      options: ['A', 'B', 'C'],
      rankings: [
        { optionIndex: 0, rank: 1 },
        { optionIndex: 1, rank: 2 },
        { optionIndex: 2, rank: 3 }
      ],
      authCode: 'CEW2025'
    });

    const rankingRes = http.post(`${BASE_URL}/api/ranking-polls/submit`, rankingPayload, {
      headers: {
        'Content-Type': 'application/json',
        'x-session-id': sessionId
      }
    });

    check(rankingRes, {
      'Mixed - Ranking submission successful': (r) => r.status === 200
    });

    sleep(0.5);

    // Finally submit wordcloud
    const wordcloudPayload = JSON.stringify({
      pagePath: '/cew-polls/mixed-test',
      pollIndex: 2,
      question: 'Words',
      maxWords: 3,
      words: ['think', 'feel', 'want'],
      authCode: 'CEW2025'
    });

    const wordcloudRes = http.post(`${BASE_URL}/api/wordcloud-polls/submit`, wordcloudPayload, {
      headers: {
        'Content-Type': 'application/json',
        'x-session-id': sessionId
      }
    });

    check(wordcloudRes, {
      'Mixed - Wordcloud submission successful': (r) => r.status === 200
    });
  });
}
