# REST API Specification Reference — v1.0

Base URL: `http://localhost:3000/api/v1`

---

## 1. Authentication Endpoints

### `POST /auth/register`
Registers a new user and auto-creates a default Organization & Project.
- **Request Body**:
  ```json
  {
    "email": "user@example.com",
    "password": "password123",
    "name": "Jane Doe",
    "organizationName": "Acme Corp"
  }
  ```
- **Response (201 Created)**:
  ```json
  {
    "message": "User registered successfully",
    "token": "<JWT_TOKEN>",
    "user": { "id": "...", "email": "..." }
  }
  ```

### `POST /auth/login`
Authenticates credentials and returns a Bearer JWT token.

### `GET /auth/me`
Header: `Authorization: Bearer <JWT_TOKEN>`  
Returns authenticated user profile and organization memberships.

---

## 2. Queue Endpoints

### `POST /queues`
Header: `Authorization: Bearer <JWT_TOKEN>`  
Creates a new queue under a project.
- **Body**: `{ "projectId": "...", "name": "email-queue", "priority": 20, "concurrencyLimit": 5 }`

### `GET /queues`
Lists queues with project details and retry policy info.

### `POST /queues/:id/pause` & `POST /queues/:id/resume`
Toggles worker polling status between `PAUSED` and `ACTIVE`.

### `GET /queues/:id/stats`
Returns live job status breakdown (`QUEUED`, `RUNNING`, `COMPLETED`, `FAILED`, `DEAD`).

---

## 3. Job Ingestion & Management Endpoints

### `POST /jobs`
Header: `Authorization: Bearer <JWT_TOKEN>`  
Creates a single job with optional idempotency key.
- **Body**:
  ```json
  {
    "queueId": "<UUID>",
    "type": "email_notification",
    "payload": { "to": "user@example.com" },
    "priority": 25,
    "idempotencyKey": "unique-request-id-123"
  }
  ```

### `POST /jobs/batch`
Transactionally ingests up to 100 jobs in a single request.

### `GET /jobs`
Filter by `queueId`, `status`, `type`, `workerId`, `search`, with pagination.

### `GET /jobs/:id`
Gets complete job record with execution attempts and microsecond log stream.

### `POST /jobs/:id/cancel` & `POST /jobs/:id/retry`
Cancels pending jobs or re-queues failed/dead jobs.

---

## 4. Dead Letter Queue (DLQ) Endpoints

### `GET /dlq`
Lists dead-letter queue entries with resolution status filtering (`PENDING`, `RETRIED`, `ARCHIVED`).

### `POST /dlq/:id/retry`
Replays dead job into a new `QUEUED` Job row and marks DLQ status `RETRIED`.

---

## 5. Scheduled Cron Job Endpoints

### `POST /scheduled-jobs`
Creates a recurring cron job (e.g. `cronExpression: "*/5 * * * *"`).

### `POST /scheduled-jobs/:id/toggle`
Enables or disables recurring schedule.

---

## 6. Rate Limiting & HTTP Headers

All API endpoints enforce sliding-window rate limits and append standard RFC response headers:

### Response Headers
- `X-RateLimit-Limit`: Maximum permitted request capacity within current window.
- `X-RateLimit-Remaining`: Remaining request capacity in current window.
- `X-RateLimit-Reset`: Unix timestamp (in seconds) when window resets.

### Default Tier Limits
- **Global API Rate Limit**: 120 requests/minute per IP / User.
- **Strict Auth Guard (`/auth/login`, `/auth/register`)**: 10 requests/minute per IP.
- **Job Creation Ingestion (`POST /jobs`)**: 60 requests/minute per Tenant / Project.

### HTTP 429 Too Many Requests Error Response
When a client exceeds the allocated rate limit:
```json
{
  "error": "Too Many Requests",
  "message": "Rate limit exceeded. Maximum 10 requests allowed per 60 seconds. Please try again in 45 seconds.",
  "retryAfter": 45,
  "resetTime": 1787415400
}
```
Header: `Retry-After: 45`

