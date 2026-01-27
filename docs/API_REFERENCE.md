# API Reference

Complete documentation of all SSTAC Dashboard API endpoints with examples, authentication requirements, and error codes.

**Last Updated:** 2026-01-26
**API Version:** v1
**Base URL:** `http://localhost:3000` (development) or `https://[deployed-url]` (production)

---

## Table of Contents

1. [Authentication](#authentication)
2. [Request/Response Format](#requestresponse-format)
3. [Rate Limiting](#rate-limiting)
4. [Error Handling](#error-handling)
5. [Endpoints by Category](#endpoints-by-category)
   - [Auth Endpoints](#auth-endpoints)
   - [Poll Endpoints](#poll-endpoints)
   - [Admin Endpoints](#admin-endpoints)
   - [Analysis Endpoints](#analysis-endpoints)
   - [Regulatory Review Endpoints](#regulatory-review-endpoints)

---

## Authentication

### Overview
Requests are authenticated using JWT tokens in the Authorization header.

### CEW User Authentication
**Code-Enabled Workflow (CEW)** users authenticate with a 6-digit access code:

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "accessCode": "123456",
    "deviceFingerprint": "device-id-abc123"
  }'
```

**Response:**
```json
{
  "token": "eyJhbGc...",
  "user": {
    "id": "123456_device-id-abc123",
    "role": "cew_user",
    "expiresAt": "2026-01-27T10:00:00Z"
  }
}
```

**Token Validity:** 24 hours from generation

### SSO Authentication (TWG/SSTAC)
**SSO users** authenticate through your identity provider (Okta, Azure AD, etc.):

```bash
# Users are redirected to login page
# IdP handles authentication
# System receives JWT token automatically
```

### Admin Authentication
**Admins** use the same SSO flow. Role assigned based on IdP attributes.

### Using the Token
All authenticated requests must include the token:

```bash
curl -X GET http://localhost:3000/api/polls \
  -H "Authorization: Bearer eyJhbGc..."
```

### Token Refresh
```bash
curl -X POST http://localhost:3000/api/auth/refresh \
  -H "Authorization: Bearer eyJhbGc..."
```

**Response:** New token (extends expiry by 24 hours)

---

## Request/Response Format

### Request Headers (All Requests)
```
Content-Type: application/json
Authorization: Bearer [token]  # Omit for public endpoints
```

### Response Format
All responses are JSON:

```json
{
  "success": true,
  "data": { /* Response data */ },
  "error": null,
  "meta": {
    "timestamp": "2026-01-26T10:00:00Z",
    "requestId": "req-abc123"
  }
}
```

### Error Responses
```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "INVALID_POLL",
    "message": "Poll not found",
    "details": {
      "pollId": "poll-123"
    }
  },
  "meta": {
    "timestamp": "2026-01-26T10:00:00Z",
    "requestId": "req-abc123"
  }
}
```

---

## Rate Limiting

### Overview
All endpoints have rate limiting based on user token or IP address.

### Headers
Every response includes rate limit info:

```
X-RateLimit-Limit: 100          # Requests per window
X-RateLimit-Remaining: 87       # Requests remaining
X-RateLimit-Reset: 1674748800  # Unix timestamp when limit resets
```

### Limits by Endpoint Type

| Endpoint Type | Limit | Window |
|---|---|---|
| Public (login) | 10 req | 15 min |
| Poll voting | 50 req | 1 hour |
| Data export | 5 req | 1 hour |
| Admin endpoints | 100 req | 1 hour |

### Rate Limit Exceeded (429)
```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Too many requests",
    "retryAfter": 300  // seconds
  }
}
```

**Response Headers:**
```
Retry-After: 300
X-RateLimit-Reset: 1674748800
```

---

## Error Handling

### HTTP Status Codes

| Code | Meaning | When |
|---|---|---|
| 200 | OK | Request succeeded |
| 201 | Created | Resource created successfully |
| 400 | Bad Request | Invalid parameters or malformed request |
| 401 | Unauthorized | Missing/invalid authentication token |
| 403 | Forbidden | User lacks permission for this action |
| 404 | Not Found | Resource doesn't exist |
| 409 | Conflict | Resource already exists or state conflict |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Server Error | Internal server error |

### Error Response Format
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable message",
    "details": {
      // Additional context
    }
  }
}
```

### Common Error Codes

| Code | HTTP | Meaning | Example |
|---|---|---|---|
| INVALID_CREDENTIALS | 401 | Token invalid or expired | Bad token in header |
| USER_NOT_FOUND | 404 | User doesn't exist | Using invalid user ID |
| POLL_NOT_FOUND | 404 | Poll doesn't exist | Poll ID doesn't match any poll |
| INVALID_POLL_OPTION | 400 | Selected option doesn't exist | Vote for non-existent option |
| POLL_CLOSED | 409 | Can't vote on closed poll | Poll already ended |
| ALREADY_VOTED | 409 | User already voted | Attempting duplicate submission |
| INVALID_FILE_TYPE | 400 | File type not allowed | Uploading .exe file |
| FILE_TOO_LARGE | 413 | File exceeds size limit | File > 10MB |
| RATE_LIMIT_EXCEEDED | 429 | Too many requests | Made 100+ requests in 1 hour |
| INTERNAL_SERVER_ERROR | 500 | Server error (unexpected) | Database connection failure |

---

## Endpoints by Category

### Auth Endpoints

#### POST `/api/auth/login`
**Authenticate user and get JWT token.**

**Public:** Yes (rate limited to 10 req/15min)
**Authentication:** None required

**Request:**
```json
{
  "accessCode": "123456",
  "deviceFingerprint": "device-id-or-browser-fingerprint"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "123456_device-id",
      "role": "cew_user",
      "expiresAt": "2026-01-27T10:00:00Z"
    }
  }
}
```

**Errors:**
- `400 INVALID_CREDENTIALS` - Access code incorrect
- `429 RATE_LIMIT_EXCEEDED` - Too many login attempts

**Example:**
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "accessCode": "123456",
    "deviceFingerprint": "device-1"
  }'
```

---

#### POST `/api/auth/logout`
**Invalidate user's current token.**

**Authentication:** Required
**Rate Limit:** 100 req/hour

**Request:**
```json
{
  "token": "eyJhbGc..."  // or in Authorization header
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "message": "Logged out successfully"
  }
}
```

**Example:**
```bash
curl -X POST http://localhost:3000/api/auth/logout \
  -H "Authorization: Bearer eyJhbGc..."
```

---

#### GET `/api/auth/user`
**Get current user's information.**

**Authentication:** Required
**Rate Limit:** 100 req/hour

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "123456_device-1",
    "role": "cew_user",
    "email": "user@example.com",
    "name": "John Doe",
    "createdAt": "2026-01-20T10:00:00Z",
    "lastActivity": "2026-01-26T15:30:00Z"
  }
}
```

**Example:**
```bash
curl -X GET http://localhost:3000/api/auth/user \
  -H "Authorization: Bearer eyJhbGc..."
```

---

### Poll Endpoints

#### GET `/api/polls`
**List all available polls.**

**Authentication:** Required (CEW user or admin)
**Rate Limit:** 50 req/hour

**Query Parameters:**
```
?status=open|closed|all        # Filter by status (default: all)
?type=single|ranking|wordcloud # Filter by poll type (default: all)
?limit=10                      # Results per page (default: 20, max: 100)
?offset=0                      # Pagination offset (default: 0)
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "polls": [
      {
        "id": "poll-123",
        "question": "Which framework do you prefer?",
        "type": "single",
        "status": "open",
        "options": ["React", "Vue", "Angular"],
        "createdAt": "2026-01-20T10:00:00Z",
        "closesAt": "2026-02-20T10:00:00Z",
        "submissionCount": 45
      }
    ],
    "total": 147,
    "hasMore": true
  }
}
```

**Example:**
```bash
curl -X GET "http://localhost:3000/api/polls?status=open&type=single" \
  -H "Authorization: Bearer eyJhbGc..."
```

---

#### GET `/api/polls/:id`
**Get specific poll details.**

**Authentication:** Required
**Rate Limit:** 100 req/hour

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "poll-123",
    "question": "Which framework do you prefer?",
    "type": "single",
    "status": "open",
    "options": ["React", "Vue", "Angular"],
    "createdAt": "2026-01-20T10:00:00Z",
    "closesAt": "2026-02-20T10:00:00Z",
    "submissionCount": 45,
    "userHasVoted": false,
    "userVote": null
  }
}
```

**Errors:**
- `404 POLL_NOT_FOUND` - Poll ID doesn't exist

**Example:**
```bash
curl -X GET http://localhost:3000/api/polls/poll-123 \
  -H "Authorization: Bearer eyJhbGc..."
```

---

#### POST `/api/polls/:id/vote`
**Submit a vote/answer to a poll.**

**Authentication:** Required
**Rate Limit:** 50 req/hour

**Request Body (Single Choice Poll):**
```json
{
  "selectedOption": "React"
}
```

**Request Body (Ranking Poll):**
```json
{
  "ranking": ["React", "Vue", "Angular"]
}
```

**Request Body (Wordcloud Poll):**
```json
{
  "text": "Single word or phrase"
}
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "submissionId": "sub-abc123",
    "pollId": "poll-123",
    "userId": "user-456",
    "answer": "React",
    "submittedAt": "2026-01-26T15:30:00Z"
  }
}
```

**Errors:**
- `404 POLL_NOT_FOUND` - Poll doesn't exist
- `409 POLL_CLOSED` - Poll closed, can't vote
- `409 ALREADY_VOTED` - User already voted on this poll
- `400 INVALID_POLL_OPTION` - Selected option doesn't exist
- `400 INVALID_ANSWER_FORMAT` - Answer doesn't match poll type

**Example:**
```bash
curl -X POST http://localhost:3000/api/polls/poll-123/vote \
  -H "Authorization: Bearer eyJhbGc..." \
  -H "Content-Type: application/json" \
  -d '{
    "selectedOption": "React"
  }'
```

---

#### GET `/api/polls/:id/results`
**Get real-time poll results (aggregated votes).**

**Authentication:** Optional (but limited without auth)
**Rate Limit:** 100 req/hour

**Query Parameters:**
```
?format=summary|detailed      # Response format (default: summary)
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "pollId": "poll-123",
    "question": "Which framework do you prefer?",
    "totalVotes": 45,
    "results": [
      {
        "option": "React",
        "votes": 22,
        "percentage": 48.9
      },
      {
        "option": "Vue",
        "votes": 18,
        "percentage": 40.0
      },
      {
        "option": "Angular",
        "votes": 5,
        "percentage": 11.1
      }
    ],
    "lastUpdated": "2026-01-26T15:30:00Z"
  }
}
```

**Example:**
```bash
curl -X GET http://localhost:3000/api/polls/poll-123/results \
  -H "Authorization: Bearer eyJhbGc..."
```

---

### Admin Endpoints

#### POST `/api/admin/export`
**Export poll data as CSV or JSON.**

**Authentication:** Required (admin only)
**Rate Limit:** 5 req/hour

**Request Body:**
```json
{
  "pollIds": ["poll-123", "poll-456"],
  "format": "csv|json",
  "includePersonalData": false
}
```

**Response (200):**
```
[Binary file content]
Content-Type: text/csv
Content-Disposition: attachment; filename="poll-results.csv"
```

**Errors:**
- `403 FORBIDDEN` - User is not admin
- `400 INVALID_POLL_IDS` - Some polls don't exist

**Example:**
```bash
curl -X POST http://localhost:3000/api/admin/export \
  -H "Authorization: Bearer eyJhbGc..." \
  -H "Content-Type: application/json" \
  -d '{
    "pollIds": ["poll-123"],
    "format": "csv"
  }' \
  -o poll-results.csv
```

---

#### GET `/api/admin/analytics`
**Get comprehensive analytics dashboard data.**

**Authentication:** Required (admin only)
**Rate Limit:** 50 req/hour

**Query Parameters:**
```
?startDate=2026-01-01          # ISO date (default: 30 days ago)
?endDate=2026-01-26            # ISO date (default: today)
?groupBy=day|week|month        # Time aggregation (default: day)
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "summary": {
      "totalPolls": 147,
      "totalVotes": 3245,
      "activeUsers": 512,
      "avgResponseRate": 68.5
    },
    "trends": [
      {
        "date": "2026-01-26",
        "polls": 5,
        "votes": 123,
        "newUsers": 12
      }
    ],
    "topPolls": [
      {
        "pollId": "poll-123",
        "question": "Which framework?",
        "votes": 456,
        "responseRate": 92.3
      }
    ]
  }
}
```

**Example:**
```bash
curl -X GET "http://localhost:3000/api/admin/analytics?startDate=2026-01-01" \
  -H "Authorization: Bearer eyJhbGc..."
```

---

### Analysis Endpoints

#### GET `/api/prioritization-matrix`
**Get prioritization matrix graph data.**

**Authentication:** Required
**Rate Limit:** 100 req/hour

**Query Parameters:**
```
?pollId=poll-123               # Specific poll (optional)
?includeMetadata=true          # Include calculation details (default: false)
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "nodes": [
      {
        "id": "item-1",
        "label": "Feature A",
        "impact": 8.5,
        "effort": 3.2,
        "priority": "HIGH"
      }
    ],
    "metadata": {
      "calculationMethod": "weighted-voting",
      "pollId": "poll-123",
      "lastUpdated": "2026-01-26T15:30:00Z"
    }
  }
}
```

**Example:**
```bash
curl -X GET "http://localhost:3000/api/prioritization-matrix?pollId=poll-123" \
  -H "Authorization: Bearer eyJhbGc..."
```

---

#### GET `/api/wordcloud/results`
**Get wordcloud visualization data.**

**Authentication:** Required
**Rate Limit:** 100 req/hour

**Query Parameters:**
```
?pollId=poll-456               # Wordcloud poll ID
?minFrequency=2                # Minimum word frequency (default: 1)
?excludeStopwords=true         # Filter common words (default: true)
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "words": [
      {
        "word": "important",
        "frequency": 23,
        "size": 24
      },
      {
        "word": "useful",
        "frequency": 18,
        "size": 20
      }
    ],
    "totalWords": 245,
    "uniqueWords": 89,
    "generatedAt": "2026-01-26T15:30:00Z"
  }
}
```

**Example:**
```bash
curl -X GET "http://localhost:3000/api/wordcloud/results?pollId=poll-456" \
  -H "Authorization: Bearer eyJhbGc..."
```

---

### Regulatory Review Endpoints

#### POST `/api/regulatory-review/submission`
**Submit a regulatory review document.**

**Authentication:** Required (reviewer role)
**Rate Limit:** 10 req/hour

**Request (Multipart Form Data):**
```
POST /api/regulatory-review/submission
Authorization: Bearer [token]
Content-Type: multipart/form-data

file: [PDF/DOCX file]
documentType: "policy|guidance|assessment"
submissionPhase: "phase-1|phase-2|phase-3"
notes: "Reviewer notes (optional)"
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "submissionId": "rev-sub-123",
    "documentId": "doc-456",
    "status": "pending_review",
    "uploadedAt": "2026-01-26T15:30:00Z",
    "fileSize": 245632
  }
}
```

**Errors:**
- `400 INVALID_FILE_TYPE` - Only PDF/DOCX allowed
- `413 FILE_TOO_LARGE` - File exceeds 10MB limit
- `400 INVALID_DOCUMENT_TYPE` - Unknown document type
- `403 FORBIDDEN` - User lacks reviewer role

**Example:**
```bash
curl -X POST http://localhost:3000/api/regulatory-review/submission \
  -H "Authorization: Bearer eyJhbGc..." \
  -F "file=@policy.pdf" \
  -F "documentType=policy" \
  -F "submissionPhase=phase-1"
```

---

#### GET `/api/regulatory-review/search`
**Search regulatory review documents.**

**Authentication:** Required
**Rate Limit:** 50 req/hour

**Query Parameters:**
```
?query=search+text             # Full-text search
?documentType=policy           # Filter by type
?status=approved|rejected|pending
?limit=20                      # Results per page
?offset=0                      # Pagination
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "documents": [
      {
        "id": "doc-456",
        "title": "Data Protection Policy v1.2",
        "documentType": "policy",
        "status": "approved",
        "uploadedBy": "user-123",
        "uploadedAt": "2026-01-20T10:00:00Z",
        "summary": "Outlines data protection procedures..."
      }
    ],
    "total": 87,
    "hasMore": true
  }
}
```

**Example:**
```bash
curl -X GET "http://localhost:3000/api/regulatory-review/search?query=policy&status=approved" \
  -H "Authorization: Bearer eyJhbGc..."
```

---

## Best Practices

### Request/Response
1. **Always include Authorization header** for authenticated endpoints
2. **Check rate limit headers** before making many requests
3. **Implement exponential backoff** for retries on 5xx errors
4. **Store tokens securely** - never log or expose tokens
5. **Validate error responses** - always check `success` field

### Error Handling
```javascript
fetch(`/api/polls`)
  .then(res => {
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  })
  .then(json => {
    if (!json.success) {
      console.error(json.error.code, json.error.message);
      // Handle error
    } else {
      // Use json.data
    }
  })
  .catch(err => {
    // Network error
    console.error(err);
  });
```

### Pagination
```javascript
// Get all results with pagination
async function getAllPolls() {
  const polls = [];
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    const res = await fetch(`/api/polls?offset=${offset}&limit=100`);
    const json = await res.json();
    polls.push(...json.data.polls);
    hasMore = json.data.hasMore;
    offset += 100;
  }

  return polls;
}
```

---

## SDK / Client Libraries

### JavaScript/TypeScript
See `src/lib/api/index.ts` for the official client library:

```typescript
import { apiClient } from '@/lib/api';

const polls = await apiClient.polls.list({ status: 'open' });
const results = await apiClient.polls.getResults('poll-123');
```

---

**API Version:** 1.0
**Last Updated:** 2026-01-26
**Maintained by:** Engineering Team
