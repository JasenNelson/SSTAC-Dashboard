# SSTAC Dashboard K6 Load Tests

Comprehensive load testing suite for API performance validation and stress testing. Tests are designed to simulate realistic traffic patterns and verify system performance under load.

## Files Overview

### 1. api-load.js
Tests GET endpoints for reading announcements and poll results.

**Endpoints tested:**
- `GET /api/announcements` - Fetch active announcements
- `GET /api/polls/results` - Fetch poll results
- `GET /api/ranking-polls/results` - Fetch ranking poll results
- `GET /api/wordcloud-polls/results` - Fetch wordcloud poll results

**Load pattern:**
- Ramp-up: 0 → 50 users over 30s
- Sustain: 50 users for 2 minutes
- Spike: 100 users for 30 seconds
- Ramp-down: 100 → 0 users over 30s

**Performance thresholds:**
- 95th percentile response time < 500ms
- 99th percentile response time < 1000ms
- Error rate < 1%

### 2. poll-submission-load.js
Tests poll submission endpoints with realistic user workflows.

**Endpoints tested:**
- `POST /api/polls/submit` - Submit single-choice polls
- `POST /api/ranking-polls/submit` - Submit ranking polls
- `POST /api/wordcloud-polls/submit` - Submit wordcloud polls

**Test scenarios:**
- Individual poll submissions
- Individual ranking submissions
- Individual wordcloud submissions
- Mixed workflow: Poll → Ranking → Wordcloud sequence

**Load pattern:**
- Ramp-up: 0 → 50 users over 30s
- Sustain: 50 users for 2 minutes
- Spike: 100 users for 30 seconds
- Ramp-down: 100 → 0 users over 30s

**Custom metrics:**
- `poll_submission_duration` - Time to submit polls
- `ranking_submission_duration` - Time to submit rankings
- `wordcloud_submission_duration` - Time to submit wordclouds
- `submission_errors` - Error rate for submissions

### 3. admin-operations-load.js
Tests admin CRUD operations on announcements with rate limiting validation.

**Endpoints tested:**
- `GET /api/announcements` - Admin fetch announcements
- `POST /api/announcements` - Create announcements
- `PUT /api/announcements` - Update announcements
- `DELETE /api/announcements` - Delete announcements

**Test scenarios:**
- GET announcements (read-heavy)
- POST announcements (create)
- PUT announcements (update)
- DELETE announcements (delete)
- Complete CRUD workflow simulation

**Load pattern:**
- Ramp-up: 0 → 30 users over 30s
- Sustain: 30 users for 2 minutes
- Spike: 30 → 60 users for 30s (tests rate limiting)
- Ramp-down: 60 → 0 users over 30s

**Custom metrics:**
- `rate_limit_hits` - Tracks 429 responses
- `admin_operation_errors` - Admin operation error rate

## Running the Tests

### Prerequisites

1. **Install K6** (if not already installed):
   ```bash
   # macOS with Homebrew
   brew install k6

   # Windows with Chocolatey
   choco install k6

   # Linux (Ubuntu/Debian)
   sudo apt-get install k6

   # Or download from: https://k6.io/docs/getting-started/installation/
   ```

2. **Start the development server:**
   ```bash
   npm run dev
   # Server runs on http://localhost:3000
   ```

### Running Individual Tests

```bash
# Run API load tests
k6 run k6/api-load.js

# Run poll submission tests
k6 run k6/poll-submission-load.js

# Run admin operations tests
k6 run k6/admin-operations-load.js

# With custom base URL
k6 run --vus 50 --duration 60s k6/api-load.js --env BASE_URL=http://localhost:3000

# With admin token for protected endpoints
k6 run k6/admin-operations-load.js --env ADMIN_TOKEN=your-token-here
```

### Running All Tests

```bash
# Sequential execution
k6 run k6/api-load.js && k6 run k6/poll-submission-load.js && k6 run k6/admin-operations-load.js
```

## Environment Variables

- `BASE_URL` - Base URL for API (default: `http://localhost:3000`)
- `ADMIN_TOKEN` - Bearer token for admin endpoints (default: `test-admin-token`)

## Output and Results

K6 provides detailed output including:
- Aggregate statistics (min, max, avg, p50, p95, p99)
- Pass/fail status for thresholds
- Request counts and success rates
- Custom metric values
- Trend analysis

### Sample Output:
```
     data_received..................: 1.2 MB   15 kB/s
     data_sent......................: 480 kB   6.0 kB/s
     http_req_blocked...............: avg=1.23ms   min=0s       max=156ms    p(95)=2.34ms   p(99)=5.23ms
     http_req_duration..............: avg=245ms    min=10ms     max=2s       p(95)=450ms    p(99)=850ms ✓
     http_req_failed................: 0.15%    ✓
     http_req_received..............: avg=5.2kB   min=0B       max=25kB
     http_req_sending...............: avg=2.1ms   min=0s       max=45ms
     http_req_tls_handshaking.......: avg=0s      min=0s       max=0s
     http_req_waiting...............: avg=240ms   min=5ms      max=2s
     http_reqs......................: 1200     15.029/s
     http_requests...................: 1200     15.029/s
```

## Integration with CI/CD

These tests are designed for CI/CD pipelines. Example GitHub Actions workflow:

```yaml
- name: Run K6 Load Tests
  run: |
    npm run dev &
    sleep 10  # Wait for server to start
    k6 run k6/api-load.js --env BASE_URL=http://localhost:3000
    k6 run k6/poll-submission-load.js --env BASE_URL=http://localhost:3000
    k6 run k6/admin-operations-load.js --env BASE_URL=http://localhost:3000
```

## Performance Goals

| Metric | Target | Current |
|--------|--------|---------|
| P95 Response Time | < 500ms | TBD |
| P99 Response Time | < 1000ms | TBD |
| Error Rate | < 1% | TBD |
| Successful Submissions | > 99% | TBD |
| Rate Limit Compliance | < 1% hits | TBD |

## Troubleshooting

### Connection Refused
- Ensure development server is running: `npm run dev`
- Check BASE_URL environment variable matches server address

### Authentication Errors
- Admin tests require valid ADMIN_TOKEN environment variable
- Set token: `k6 run admin-operations-load.js --env ADMIN_TOKEN=your-token`

### Rate Limiting
- Admin operations test includes rate limit validation
- Expected: Some 429 responses under spike conditions
- Check `rate_limit_hits` metric in output

### Memory Issues
- Reduce VU count: `k6 run --vus 10 api-load.js`
- Shorten test duration: `k6 run --duration 30s api-load.js`

## Further Resources

- [K6 Documentation](https://k6.io/docs/)
- [K6 Best Practices](https://k6.io/docs/misc/best-practices/)
- [K6 Scripting API](https://k6.io/docs/javascript-api/)
- [K6 Metrics](https://k6.io/docs/javascript-api/k6-metrics/)
