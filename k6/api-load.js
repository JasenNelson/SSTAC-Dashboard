import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Rate, Trend, Counter, Gauge } from 'k6/metrics';

// Custom metrics for detailed monitoring
const errorRate = new Rate('errors');
const getRequestDuration = new Trend('get_request_duration');
const getSuccessCount = new Counter('get_success');
const getErrorCount = new Counter('get_error');
const activeUsers = new Gauge('active_users');

// Test configuration with stages for realistic traffic patterns
export const options = {
  stages: [
    // Ramp-up: 0 to 50 virtual users over 30 seconds
    { duration: '30s', target: 50, name: 'ramp-up' },
    // Sustain: 50 users for 2 minutes
    { duration: '2m', target: 50, name: 'sustain' },
    // Spike: Jump to 100 users for 30 seconds
    { duration: '30s', target: 100, name: 'spike' },
    // Ramp-down: Back to 0 users over 30 seconds
    { duration: '30s', target: 0, name: 'ramp-down' }
  ],
  thresholds: {
    'http_req_duration': ['p(95)<500', 'p(99)<1000'], // 95% requests under 500ms, 99% under 1s
    'http_req_failed': ['rate<0.01'], // Error rate less than 1%
    'errors': ['rate<0.01'],
    'get_request_duration': ['p(95)<500']
  },
  ext: {
    loadimpact: {
      projectID: 3405449,
      name: 'SSTAC Dashboard - API Load Test'
    }
  }
};

// Base URL for the API
const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

export default function () {
  activeUsers.set(__VU);

  // Test announcements GET endpoint
  group('Announcements - GET', () => {
    const announcementsRes = http.get(`${BASE_URL}/api/announcements`, {
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      timeout: '10s'
    });

    const announcementChecks = check(announcementsRes, {
      'GET /api/announcements status 200': (r) => r.status === 200 || r.status === 401, // 401 OK for unauthenticated
      'GET /api/announcements response time < 500ms': (r) => r.timings.duration < 500,
      'GET /api/announcements has valid response': (r) => r.body !== null
    });

    if (announcementChecks) {
      getSuccessCount.add(1);
      getRequestDuration.add(announcementsRes.timings.duration);
    } else {
      getErrorCount.add(1);
      errorRate.add(1);
    }

    sleep(1);
  });

  // Test poll results GET endpoints
  group('Poll Results - GET', () => {
    const pollResultsRes = http.get(`${BASE_URL}/api/polls/results`, {
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      timeout: '10s'
    });

    const pollChecks = check(pollResultsRes, {
      'GET /api/polls/results status success': (r) => r.status < 400,
      'GET /api/polls/results response time < 500ms': (r) => r.timings.duration < 500
    });

    if (pollChecks) {
      getSuccessCount.add(1);
      getRequestDuration.add(pollResultsRes.timings.duration);
    } else {
      getErrorCount.add(1);
      errorRate.add(1);
    }

    sleep(1);
  });

  // Test ranking poll results GET endpoint
  group('Ranking Poll Results - GET', () => {
    const rankingResultsRes = http.get(`${BASE_URL}/api/ranking-polls/results`, {
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      timeout: '10s'
    });

    const rankingChecks = check(rankingResultsRes, {
      'GET /api/ranking-polls/results status success': (r) => r.status < 400,
      'GET /api/ranking-polls/results response time < 500ms': (r) => r.timings.duration < 500
    });

    if (rankingChecks) {
      getSuccessCount.add(1);
      getRequestDuration.add(rankingResultsRes.timings.duration);
    } else {
      getErrorCount.add(1);
      errorRate.add(1);
    }

    sleep(1);
  });

  // Test wordcloud poll results GET endpoint
  group('Wordcloud Poll Results - GET', () => {
    const wordcloudResultsRes = http.get(`${BASE_URL}/api/wordcloud-polls/results`, {
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      timeout: '10s'
    });

    const wordcloudChecks = check(wordcloudResultsRes, {
      'GET /api/wordcloud-polls/results status success': (r) => r.status < 400,
      'GET /api/wordcloud-polls/results response time < 500ms': (r) => r.timings.duration < 500
    });

    if (wordcloudChecks) {
      getSuccessCount.add(1);
      getRequestDuration.add(wordcloudResultsRes.timings.duration);
    } else {
      getErrorCount.add(1);
      errorRate.add(1);
    }

    sleep(1);
  });
}
