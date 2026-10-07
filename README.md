# Triostack Notification API Microservice

A multi-tenant, secure, and production-ready Notification API Microservice designed for Triostack Technologies ecosystem (CRM, Invoicing, Helpdesk, Projects, HRMS, and Payroll).

---

## 🚀 Key Features

- **Multi-Tenant Data Isolation**: Strict boundary isolation on `tenant_id`, `organization_id`, and `software_id`.
- **BIGINT String Serialization**: All PostgreSQL `BIGINT` IDs (notifications, tenants, users, entities) are transferred and validated as numeric strings to prevent JavaScript 64-bit IEEE-754 precision loss.
- **Service Bearer Authentication**: Internal services authenticate with `Authorization: Bearer <BRR_TOKEN>`.
- **Authoritative Context Headers**: `X-Tenant-Id`, `X-Organization-Id`, and `X-Software-Id` are read only from trusted headers and never accepted from the request body.
- **Idempotency Protection**: Enforced via `Idempotency-Key` header and scoped unique database constraints to guarantee exactly-once creation during network retries.
- **Standardized Response Envelope**: Uniform `{ success, data, pagination }` and `{ success: false, error: { code, message } }`.
- **Health & Readiness Probes**: Unauthenticated `/health` (liveness) and `/ready` (database connectivity) endpoints for Kubernetes/Docker container monitoring.
- **Automated Fallback**: Resilient development mode with automatic in-memory fallback if PostgreSQL is not yet running locally.

---

## 🛠️ Tech Stack

- **Runtime**: Node.js 20+ / TypeScript
- **Framework**: Express.js, Helmet, CORS
- **Validation**: Zod schema validation
- **Database**: PostgreSQL 16 (with connection pooling via `pg`)
- **Testing**: Jest, ts-jest, Supertest
- **Containers**: Docker, Docker Compose

---

## 📋 Environment Configuration

Create a `.env` file in the project root:

```env
PORT=4010
NODE_ENV=development

# Internal Service Bearer Token
BRR_TOKEN=triostack_secret_notification_token_2026

# PostgreSQL Connection
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=postgres
DB_NAME=triostack_notifications
DB_SSL=false
DB_POOL_MIN=2
DB_POOL_MAX=20
DB_TIMEOUT_MS=10000

# CORS
CORS_ALLOWED_ORIGINS=*
```

---

## 🏃 Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Run Database Migrations (PostgreSQL)
```bash
npm run migrate
```

### 3. Start Backend Service
```bash
# Development mode (with live watch)
npm run dev

# Or build & start production
npm run build
npm start
```

### 4. Run Test Suite
```bash
npm test
npm run test:unit
npm run test:security
npm run test:integration
```

---

## 🐳 Docker Deployment

To launch the microservice alongside a dedicated PostgreSQL 16 database:

```bash
docker compose up -d
```

---

## 📡 API Reference

### Headers Contract

| Header | Type | Required | Description |
|---|---|---|---|
| `Authorization` | `Bearer <BRR_TOKEN>` | Yes (API endpoints) | Machine authentication |
| `X-Tenant-Id` | BIGINT string | Yes | Top-level tenant boundary |
| `X-Organization-Id` | BIGINT string | Yes | Organization / workspace boundary |
| `X-Software-Id` | BIGINT string / key | Yes | Triostack product module (e.g., `10` or `crm`) |
| `X-User-Id` | BIGINT string | Inbox endpoints | Current / acting user ID |
| `Idempotency-Key` | String | `POST /` | Idempotent duplicate prevention |

---

### Endpoints

#### 1. Liveness Probe
```bash
curl -X GET http://localhost:4010/health
```

#### 2. Readiness Probe
```bash
curl -X GET http://localhost:4010/ready
```

#### 3. Create Notification
```bash
curl -X POST http://localhost:4010/api/v1/notifications \
  -H "Authorization: Bearer triostack_secret_notification_token_2026" \
  -H "X-Tenant-Id: 1001" \
  -H "X-Organization-Id: 5001" \
  -H "X-Software-Id: 10" \
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

#### 4. List User Notifications
```bash
curl -X GET "http://localhost:4010/api/v1/notifications?page=1&limit=20" \
  -H "Authorization: Bearer triostack_secret_notification_token_2026" \
  -H "X-Tenant-Id: 1001" \
  -H "X-Organization-Id: 5001" \
  -H "X-Software-Id: 10" \
  -H "X-User-Id: 501233"
```

#### 5. Get Unread Count
```bash
curl -X GET http://localhost:4010/api/v1/notifications/unread-count \
  -H "Authorization: Bearer triostack_secret_notification_token_2026" \
  -H "X-Tenant-Id: 1001" \
  -H "X-Organization-Id: 5001" \
  -H "X-Software-Id: 10" \
  -H "X-User-Id: 501233"
```

#### 6. Mark Single Notification as Read
```bash
curl -X PATCH http://localhost:4010/api/v1/notifications/90000000101/read \
  -H "Authorization: Bearer triostack_secret_notification_token_2026" \
  -H "X-Tenant-Id: 1001" \
  -H "X-Organization-Id: 5001" \
  -H "X-Software-Id: 10" \
  -H "X-User-Id: 501233"
```

#### 7. Mark All Notifications as Read
```bash
curl -X PATCH http://localhost:4010/api/v1/notifications/read-all \
  -H "Authorization: Bearer triostack_secret_notification_token_2026" \
  -H "X-Tenant-Id: 1001" \
  -H "X-Organization-Id: 5001" \
  -H "X-Software-Id: 10" \
  -H "X-User-Id: 501233"
```

#### 8. Soft Delete Notification
```bash
curl -X DELETE http://localhost:4010/api/v1/notifications/90000000101 \
  -H "Authorization: Bearer triostack_secret_notification_token_2026" \
  -H "X-Tenant-Id: 1001" \
  -H "X-Organization-Id: 5001" \
  -H "X-Software-Id: 10" \
  -H "X-User-Id: 501233"
```
