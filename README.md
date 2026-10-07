# Triostack Notification Service

A **multi-tenant Notification API microservice** built with **TypeScript, Express and PostgreSQL**.
Other Triostack products (CRM, Invoicing, Helpdesk, Projects, HRMS, Payroll) call it to create notifications for
their users, and users read them as an inbox with unread counts.

---

## Table of contents

1. [Why this service exists](#1-why-this-service-exists)
2. [What it does (and does not do)](#2-what-it-does-and-does-not-do)
3. [Tech stack](#3-tech-stack)
4. [How it works](#4-how-it-works)
5. [Project structure](#5-project-structure)
6. [Getting started](#6-getting-started)
7. [Configuration](#7-configuration)
8. [API reference](#8-api-reference)
9. [Data model](#9-data-model)
10. [Security design](#10-security-design)
11. [Testing](#11-testing)
12. [Troubleshooting](#12-troubleshooting)
13. [Known limitations](#13-known-limitations)

---

## 1. Why this service exists

If every product builds its own notification feature, each one re-implements the same things differently:
inbox tables, unread counters, read/delete behaviour, duplicate prevention on retries, and tenant isolation rules.
This service provides **one shared notification inbox** so every module creates and reads notifications the same
way, with the same security boundaries.

## 2. What it does (and does not do)

**It does**

- Create a notification for a recipient user, with an event key, title, message, channel, priority, an optional
  link to a related record (for example a lead) and free-form `metadata`.
- Return a user's inbox with filters and pagination, and an unread count.
- Mark one notification, or all notifications, as read.
- Soft-delete notifications (the row is kept, hidden from normal reads).
- Prevent duplicates when a caller retries a create request (`Idempotency-Key`).
- Keep data separated by tenant, organization and software module.

**It does not (yet)**

- **Deliver** notifications. `channel` (`IN_APP`, `PUSH`, `EMAIL`, `WHATSAPP`) is stored as a label; sending actual
  push, email or WhatsApp messages is not implemented here.
- Handle user login, passwords or user profiles (those belong to an Auth Service and the User Service).

## 3. Tech stack

| Layer | Choice |
|---|---|
| Runtime / language | Node.js 20+, TypeScript |
| HTTP | Express 4, Helmet, CORS |
| Database | PostgreSQL 16 via `pg` (connection pool) |
| Validation | Zod |
| Tests | Jest, ts-jest, Supertest |
| Packaging | Docker, Docker Compose |

## 4. How it works

```
Calling service (CRM, HRMS, ...)
        |
        v
  Route -> internalAuth -> tenantContext -> Controller -> Service -> Repository -> PostgreSQL
```

For each `/api/v1/notifications` request:

1. **`internalAuth`** checks `Authorization: Bearer <BRR_TOKEN>`.
2. **`tenantContext`** reads and validates `X-Tenant-Id`, `X-Organization-Id`, `X-Software-Id` and (where needed)
   `X-User-Id`. Any `tenant_id`, `organization_id` or `software_id` sent in the request body is discarded, so the
   body can never change the security scope.
3. The **controller** validates input with Zod.
4. The **service** applies the rules (for example the idempotency check).
5. The **repository** runs SQL scoped by tenant and organization. Inbox operations are also scoped to the
   recipient user.

Key design decisions:

- **IDs are strings.** PostgreSQL `BIGINT` can exceed JavaScript's safe integer range, so IDs are sent and
  validated as numeric strings (for example `"90000000101"`).
- **Scoped uniqueness.** One idempotency key can only create one notification per tenant + organization + software.
- **Soft delete.** `DELETE` sets `deleted_at`; nothing is physically removed.

## 5. Project structure

```
src/
  server.ts                    entry point, graceful shutdown
  app.ts                       Express setup, /health and /ready, routes
  config/                      env.ts (settings), database.ts (pool, BIGINT as string)
  middleware/                  internalAuth.ts, context.ts, errorHandler.ts
  modules/notification/        routes, controller, service, repository, validation, types
  database/                    migrate.ts and migrations/001_create_notifications.sql
  utils/                       logger.ts, response.ts (response envelopes)
tests/
  unit/                        auth, context headers, validation
  integration/                 API behaviour
  security/                    tenant isolation
postman_collection.json        ready-to-import Postman collection
Dockerfile, docker-compose.yml
```

## 6. Getting started

### Prerequisites

- Node.js 20 or newer
- PostgreSQL 14+ **or** Docker Desktop

### Option A: Docker (includes PostgreSQL)

```bash
docker compose up -d --build
curl http://localhost:4010/ready
```

The compose file starts PostgreSQL 16 and creates the table automatically on first start. Stop with
`docker compose down` (keeps data) or `docker compose down -v` (deletes data).

### Option B: Run locally

```bash
git clone https://github.com/dev-kirti-tiwari/notification-API-microservice-.git
cd notification-API-microservice-
npm install
cp .env.example .env        # then set your own BRR_TOKEN and database values
npm run migrate             # create the table
npm run dev                 # http://localhost:4010
```

### Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | start with auto-reload |
| `npm run build` / `npm start` | compile and run the production build |
| `npm run migrate` | apply SQL migrations |
| `npm test` | run all tests |
| `npm run test:unit`, `test:integration`, `test:security` | run one suite |

## 7. Configuration

Settings are environment variables (see `.env.example`). Put real values in `.env`, which is git-ignored.

| Variable | Default | Description |
|---|---|---|
| `PORT` | `4010` | HTTP port |
| `NODE_ENV` | `development` | `development` or `production` |
| `BRR_TOKEN` | see [limitations](#13-known-limitations) | Shared bearer token callers must send. **Always set your own.** |
| `DB_HOST`, `DB_PORT` | `localhost`, `5432` | PostgreSQL address |
| `DB_USER`, `DB_PASSWORD` | `postgres` | PostgreSQL credentials |
| `DB_NAME` | `triostack_notifications` | Database name |
| `DB_SSL` | `false` | Use TLS to PostgreSQL |
| `DB_POOL_MIN`, `DB_POOL_MAX` | `2`, `20` | Connection pool size |
| `DB_TIMEOUT_MS` | `10000` | Connection timeout |
| `CORS_ALLOWED_ORIGINS` | `*` | Comma-separated allowed origins |

Generate a strong token with:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## 8. API reference

Base path: `/api/v1/notifications`. Examples use `http://localhost:4010` and `$BRR_TOKEN` for your token.

### Headers

| Header | Required | Description |
|---|---|---|
| `Authorization: Bearer <BRR_TOKEN>` | all API routes | service authentication |
| `X-Tenant-Id` | all API routes | positive BIGINT string |
| `X-Organization-Id` | all API routes | positive BIGINT string |
| `X-Software-Id` | all API routes | product/module key, for example `10` or `crm` (max 50 chars) |
| `X-User-Id` | inbox routes (list, unread count, read, read-all, delete) | the user whose inbox is used |
| `Idempotency-Key` | `POST /` | unique per notification you intend to create |
| `X-Request-Id` | optional | accepted and stored in the request context |

### Endpoints

| Method | Path | Description | Needs `X-User-Id` |
|---|---|---|:-:|
| POST | `/` | Create a notification | no |
| GET | `/` | List the user's notifications | yes |
| GET | `/unread-count` | Number of unread notifications | yes |
| GET | `/:id` | Get one notification | no |
| PATCH | `/:id/read` | Mark one as read | yes |
| PATCH | `/read-all` | Mark all as read | yes |
| DELETE | `/:id` | Soft delete | yes |
| GET | `/health` (no prefix) | Liveness | no |
| GET | `/ready` (no prefix) | Readiness | no |

### Create a notification

```bash
curl -X POST http://localhost:4010/api/v1/notifications \
  -H "Authorization: Bearer $BRR_TOKEN" \
  -H "X-Tenant-Id: 1001" -H "X-Organization-Id: 5001" -H "X-Software-Id: 10" \
  -H "Idempotency-Key: lead-88912-assigned-501233" \
  -H "Content-Type: application/json" \
  -d '{
    "recipient_user_id": "501233",
    "actor_user_id": "501099",
    "event_key": "LEAD_ASSIGNED",
    "title": "New Lead Assigned",
    "message": "Rahul Sharma has been assigned to you.",
    "channel": "IN_APP",
    "priority": "NORMAL",
    "related_entity_type": "LEAD",
    "related_entity_id": "88912",
    "action_url": "/crm/leads/88912",
    "metadata": { "source": "META_ADS" }
  }'
```

| Field | Required | Rules |
|---|:-:|---|
| `recipient_user_id` | yes | positive BIGINT string |
| `event_key` | yes | 1-100 chars |
| `title` | yes | 1-200 chars |
| `message` | yes | non-empty |
| `actor_user_id`, `related_entity_id` | no | positive BIGINT string |
| `channel` | no | `IN_APP` (default), `PUSH`, `EMAIL`, `WHATSAPP` |
| `priority` | no | `LOW`, `NORMAL` (default), `HIGH` |
| `related_entity_type` | no | up to 80 chars |
| `action_url` | no | string |
| `metadata` | no | JSON object |

Returns **201** with the new notification. If the same `Idempotency-Key` was already used in the same scope, the
original notification is returned with **200** and nothing new is created.

### List the inbox

`GET /api/v1/notifications?page=1&limit=20&is_read=false&priority=HIGH`

| Parameter | Rules |
|---|---|
| `page` | integer >= 1 (default 1) |
| `limit` | 1-100 (default 20) |
| `is_read` | `true` or `false` |
| `event_key`, `channel` | exact-match filters |
| `priority` | `LOW`, `NORMAL`, `HIGH` |

### Other calls

```bash
# unread count
curl http://localhost:4010/api/v1/notifications/unread-count \
  -H "Authorization: Bearer $BRR_TOKEN" -H "X-Tenant-Id: 1001" \
  -H "X-Organization-Id: 5001" -H "X-Software-Id: 10" -H "X-User-Id: 501233"

# mark one read / mark all read / delete  (same headers)
curl -X PATCH  http://localhost:4010/api/v1/notifications/90000000101/read ...
curl -X PATCH  http://localhost:4010/api/v1/notifications/read-all ...
curl -X DELETE http://localhost:4010/api/v1/notifications/90000000101 ...
```

### Response format

Success:

```json
{ "success": true, "data": { "...": "..." }, "pagination": { "page": 1, "limit": 20, "total": 42,
  "total_pages": 3, "has_next": true, "has_previous": false } }
```

(`pagination` appears only on list responses.) Error:

```json
{ "success": false, "error": { "code": "NOTIFICATION_NOT_FOUND",
  "message": "Notification not found within current security scope" } }
```

### Error codes

| HTTP | Code | When |
|---|---|---|
| 400 | `INVALID_CONTEXT_HEADERS` | missing or invalid tenant, organization, software or user header |
| 400 | `VALIDATION_ERROR` | invalid body or query, or missing `Idempotency-Key` |
| 400 | `INVALID_JSON` | malformed JSON body |
| 401 | `INVALID_BRR_TOKEN` | missing, malformed or wrong bearer token |
| 404 | `NOTIFICATION_NOT_FOUND` | not found in the caller's scope (also for other tenants and deleted rows) |
| 404 | `NOT_FOUND` | unknown route |
| 409 | `DUPLICATE_IDEMPOTENCY_KEY` | idempotency key conflict at the database level |
| 500 | `INTERNAL_SERVER_ERROR` | unexpected failure |

## 9. Data model

Table `notifications` (`src/database/migrations/001_create_notifications.sql`):

`id`, `tenant_id`, `organization_id`, `software_id`, `recipient_user_id`, `actor_user_id`, `event_key`, `title`,
`message`, `channel`, `priority`, `related_entity_type`, `related_entity_id`, `action_url`, `metadata` (JSONB),
`idempotency_key`, `is_read`, `read_at`, `created_by`, `created_at`, `updated_at`, `deleted_at`.

Indexes support the inbox query, the unread count, event lookups, and a **partial unique index** on
`(tenant_id, organization_id, software_id, idempotency_key)` for non-deleted rows, which enforces idempotency.

## 10. Security design

- Every request needs the bearer token; tenant, organization and software come only from headers and are removed
  from the request body.
- Queries are parameterized and always scoped by tenant and organization; inbox actions are also scoped to the recipient.
- Helmet security headers, a 1 MB body limit, and a global error handler that hides internal details.
- A record outside the caller's scope returns the same 404 as a missing one.

## 11. Testing

```bash
npm test
```

Suites cover token handling, context-header validation, input validation, API behaviour and tenant isolation.
A Postman collection is included: import `postman_collection.json`, set your token and base URL variables, then
run **Create notification** first (it stores the new id for the following requests).

## 12. Troubleshooting

| Symptom | Likely cause and fix |
|---|---|
| `401 INVALID_BRR_TOKEN` | The token you send does not match `BRR_TOKEN` of the running service. |
| `400 INVALID_CONTEXT_HEADERS` | A required `X-*` header is missing, or an ID is not a positive number. |
| `400 VALIDATION_ERROR` on create | Add the `Idempotency-Key` header and check the body fields. |
| `/ready` says database "in-memory-storage" | PostgreSQL is not reachable; see limitations below. |
| Port already in use | Change `PORT` (and the port mapping in `docker-compose.yml`). |

## 13. Known limitations

These are documented honestly so they are fixed before real production use:

- **In-memory fallback.** If PostgreSQL is unreachable, the service silently switches to an in-memory store, and
  data is lost on restart. `/ready` still returns HTTP 200 in that case. Disable this fallback in production.
- **Default token.** If `BRR_TOKEN` is not set, the service falls back to a built-in default value. Always set your
  own strong token; never run with the default.
- **Static shared token** is the only authentication, and it is compared with a plain string comparison.
- **Database TLS.** With `DB_SSL=true`, certificate verification is turned off (`rejectUnauthorized: false`).
- **CORS** defaults to `*`; restrict `CORS_ALLOWED_ORIGINS` in production.
- No actual delivery for push, email or WhatsApp channels, and no rate limiting.
