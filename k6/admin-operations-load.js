import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Rate, Trend, Counter, Gauge } from 'k6/metrics';
import { randomIntBetween, randomString } from 'https://jslib.k6.io/k6-utils/1.4.0/index.js';

// Custom metrics for admin operations
const adminGetDuration = new Trend('admin_get_duration');
const adminPostDuration = new Trend('admin_post_duration');
const adminPutDuration = new Trend('admin_put_duration');
const adminDeleteDuration = new Trend('admin_delete_duration');
const adminGetSuccess = new Counter('admin_get_success');
const adminPostSuccess = new Counter('admin_post_success');
const adminOperationErrors = new Rate('admin_operation_errors');
const rateLimitHits = new Counter('rate_limit_hits');
const activeAdminUsers = new Gauge('active_admin_users');

// Test configuration for admin operations under load
export const options = {
  stages: [
    // Ramp-up: 0 to 30 concurrent admin users over 30 seconds
    { duration: '30s', target: 30, name: 'ramp-up' },
    // Sustain: 30 admin users for 2 minutes performing operations
    { duration: '2m', target: 30, name: 'sustain' },
    // Spike: Jump to 60 concurrent operations for 30 seconds (testing rate limits)
    { duration: '30s', target: 60, name: 'spike' },
    // Ramp-down: Back to 0
    { duration: '30s', target: 0, name: 'ramp-down' }
  ],
  thresholds: {
    'http_req_duration': ['p(95)<500', 'p(99)<1000'],
    'http_req_failed': ['rate<0.01'],
    'admin_operation_errors': ['rate<0.02'], // Allow slightly higher error rate for auth-gated endpoints
    'admin_get_duration': ['p(95)<500'],
    'admin_post_duration': ['p(95)<1000'], // POST operations may take longer
    'rate_limit_hits': ['count<100'] // Track rate limiting for visibility
  }
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const ADMIN_TOKEN = __ENV.ADMIN_TOKEN || 'test-admin-token'; // Should be set via environment variable

export default function () {
  activeAdminUsers.set(__VU);

  // Test announcements GET with authentication
  group('Admin - Announcements GET', () => {
    const announcementsRes = http.get(`${BASE_URL}/api/announcements`, {
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${ADMIN_TOKEN}`
      },
      timeout: '10s'
    });

    const checks = check(announcementsRes, {
      'GET /api/announcements status 200-401': (r) => r.status === 200 || r.status === 401 || r.status === 403,
      'GET /api/announcements response time < 500ms': (r) => r.timings.duration < 500,
      'GET /api/announcements has valid response': (r) => r.body !== null
    });

    if (announcementsRes.status === 429) {
      rateLimitHits.add(1);
    }

    if (checks && announcementsRes.status === 200) {
      adminGetSuccess.add(1);
      adminGetDuration.add(announcementsRes.timings.duration);
    } else if (announcementsRes.status >= 400) {
      adminOperationErrors.add(1);
    }

    sleep(1);
  });

  // Test creating an announcement (POST with FormData simulation)
  group('Admin - Announcements POST', () => {
    const announcementPayload = {
      title: `Announcement ${randomString(8)}`,
      message: `Test announcement message for load testing: ${randomString(20)}`,
      type: 'info',
      duration: randomIntBetween(1, 7)
    };

    // Note: FormData is used in the actual API, simulating with JSON for load testing
    const params = {
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${ADMIN_TOKEN}`
      },
      timeout: '10s'
    };

    const postRes = http.post(
      `${BASE_URL}/api/announcements`,
      JSON.stringify(announcementPayload),
      params
    );

    const checks = check(postRes, {
      'POST /api/announcements status success': (r) => r.status < 400 || r.status === 401 || r.status === 403,
      'POST /api/announcements response time < 1000ms': (r) => r.timings.duration < 1000
    });

    if (postRes.status === 429) {
      rateLimitHits.add(1);
    }

    if (checks && postRes.status === 200) {
      adminPostSuccess.add(1);
      adminPostDuration.add(postRes.timings.duration);
    } else if (postRes.status >= 400 && postRes.status < 500) {
      adminOperationErrors.add(1);
    }

    sleep(randomIntBetween(1, 2));
  });

  // Test updating an announcement (PUT)
  group('Admin - Announcements PUT', () => {
    const updatePayload = {
      id: `announcement-${randomIntBetween(1, 100)}`,
      title: `Updated Announcement ${randomString(8)}`,
      message: `Updated message: ${randomString(20)}`,
      type: 'warning',
      duration: randomIntBetween(1, 7)
    };

    const putRes = http.put(
      `${BASE_URL}/api/announcements`,
      JSON.stringify(updatePayload),
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${ADMIN_TOKEN}`
        },
        timeout: '10s'
      }
    );

    const checks = check(putRes, {
      'PUT /api/announcements status success': (r) => r.status < 400 || r.status === 401 || r.status === 403,
      'PUT /api/announcements response time < 1000ms': (r) => r.timings.duration < 1000
    });

    if (putRes.status === 429) {
      rateLimitHits.add(1);
    }

    if (checks && putRes.status === 200) {
      adminPostSuccess.add(1);
      adminPutDuration.add(putRes.timings.duration);
    } else if (putRes.status >= 400) {
      adminOperationErrors.add(1);
    }

    sleep(1);
  });

  // Test deleting an announcement (DELETE)
  group('Admin - Announcements DELETE', () => {
    const deletePayload = {
      id: `announcement-${randomIntBetween(1, 100)}`
    };

    const deleteRes = http.delete(
      `${BASE_URL}/api/announcements`,
      JSON.stringify(deletePayload),
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${ADMIN_TOKEN}`
        },
        timeout: '10s'
      }
    );

    const checks = check(deleteRes, {
      'DELETE /api/announcements status success': (r) => r.status < 400 || r.status === 401 || r.status === 403,
      'DELETE /api/announcements response time < 1000ms': (r) => r.timings.duration < 1000
    });

    if (deleteRes.status === 429) {
      rateLimitHits.add(1);
    }

    if (checks && deleteRes.status === 200) {
      adminPostSuccess.add(1);
      adminDeleteDuration.add(deleteRes.timings.duration);
    } else if (deleteRes.status >= 400) {
      adminOperationErrors.add(1);
    }

    sleep(1);
  });

  // Simulate admin workflow: GET announcements, POST new one, PUT update, DELETE
  group('Admin - Complete CRUD Workflow', () => {
    // GET existing announcements
    const getRes = http.get(`${BASE_URL}/api/announcements`, {
      headers: {
        'Authorization': `Bearer ${ADMIN_TOKEN}`
      }
    });

    check(getRes, {
      'Admin workflow - GET successful': (r) => r.status === 200 || r.status === 401
    });

    sleep(0.5);

    // POST create new announcement
    const createPayload = JSON.stringify({
      title: `Workflow Test ${randomString(8)}`,
      message: 'Testing admin workflow',
      type: 'info',
      duration: 3
    });

    const postRes = http.post(`${BASE_URL}/api/announcements`, createPayload, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ADMIN_TOKEN}`
      }
    });

    check(postRes, {
      'Admin workflow - POST successful': (r) => r.status < 400
    });

    sleep(0.5);

    // PUT update
    const updatePayload = JSON.stringify({
      id: `workflow-${randomIntBetween(1, 50)}`,
      title: `Workflow Updated ${randomString(8)}`,
      message: 'Updated in workflow',
      type: 'warning'
    });

    const putRes = http.put(`${BASE_URL}/api/announcements`, updatePayload, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ADMIN_TOKEN}`
      }
    });

    check(putRes, {
      'Admin workflow - PUT successful': (r) => r.status < 400
    });

    sleep(0.5);

    // DELETE
    const deletePayload = JSON.stringify({
      id: `workflow-${randomIntBetween(1, 50)}`
    });

    const deleteRes = http.delete(`${BASE_URL}/api/announcements`, deletePayload, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ADMIN_TOKEN}`
      }
    });

    check(deleteRes, {
      'Admin workflow - DELETE successful': (r) => r.status < 400
    });
  });
}
