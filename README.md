# 🎧 Audible Pulse Stream Engine

[![Live Demo](https://img.shields.io/badge/Live_Demo-Interactive_Sandbox-10B981?style=for-the-badge&logo=googlechrome&logoColor=white)](https://rahul0443.github.io/audible-pulse-stream-engine/)
[![CI/CD Pipeline](https://img.shields.io/badge/CI%2FCD-GitHub_Actions_Passing-2088FF?style=for-the-badge&logo=githubactions&logoColor=white)](https://github.com/rahul0443/audible-pulse-stream-engine/actions)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.4-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Prisma](https://img.shields.io/badge/Prisma-5.14-2D3748?style=for-the-badge&logo=prisma&logoColor=white)](https://www.prisma.io/)
[![Redis](https://img.shields.io/badge/Redis-7.0-DC382D?style=for-the-badge&logo=redis&logoColor=white)](https://redis.io/)
[![Docker](https://img.shields.io/badge/Docker-Enabled-2496ED?style=for-the-badge&logo=docker&logoColor=white)](https://www.docker.com/)

> **Live Web Interactive Control Plane:** [https://rahul0443.github.io/audible-pulse-stream-engine/](https://rahul0443.github.io/audible-pulse-stream-engine/)

An enterprise-grade, high-throughput **Audio Telemetry & Stream Entitlement Microservice** built for scale. Designed specifically to solve core distributed system challenges in digital streaming platforms: **atomic idempotency locks** during network retries, **distributed sliding-window rate limiting**, and **real-time playback telemetry stream ingestion**.

---

## 📋 Table of Contents
- [🌐 Live Web Interactive Sandbox](#-live-web-interactive-sandbox)
- [🏗️ System Architecture & Flowcharts](#️-system-architecture--flowcharts)
- [🔄 Idempotency & Entitlement Sequence Diagram](#-idempotency--entitlement-sequence-diagram)
- [🛢️ Entity-Relationship (ER) Database Diagram](#️-entity-relationship-er-database-diagram)
- [✨ Key Engineering Features](#-key-engineering-features)
- [📡 API Reference & JSON Payloads](#-api-reference--json-payloads)
- [📐 Architectural Trade-Off Analysis](#-architectural-trade-off-analysis)
- [📊 Observability & Operational Excellence](#-observability--operational-excellence)
- [🛠️ Local Installation & Docker Setup](#️-local-installation--docker-setup)
- [🧪 Automated Test Suite](#-automated-test-suite)
- [📄 License & Author](#-license--author)

---

## 🌐 Live Web Interactive Sandbox

Try out the live control plane directly in your browser without installing anything:
👉 **[Launch Live Control Sandbox](https://rahul0443.github.io/audible-pulse-stream-engine/)**

* **Idempotency Simulator:** Verify double-billing prevention when duplicate `x-idempotency-key` calls occur.
* **Rate Limiter Burst Simulator:** Test Redis sliding window throttling with 50+ request bursts returning `429 Too Many Requests`.
* **Telemetry Inspector:** Stream real-time playback events (HEARTBEAT, BUFFERING, QUALITY_SHIFT) with live Prometheus chart updates.

---

## 🏗️ System Architecture & Flowcharts

The system uses a layered clean architecture separating API Gateway logic, security middleware, business services, and database persistence.

```mermaid
flowchart TD
    subgraph Client Layer
        A[Mobile Audio App / SDK]
        B[Web Audio Player]
    end

    subgraph API Gateway & Middleware Layer
        C[Express HTTP Server / Helmet]
        D[JWT Authentication Filter]
        E[Redis Sliding Window Rate Limiter]
        F[Header-Driven Idempotency Lock]
    end

    subgraph Business Logic Layer
        G[Stream License Service]
        H[Playback Telemetry Service]
        I[Health & Observability Service]
    end

    subgraph Data & Storage Layer
        J[(Redis Cache Cluster)]
        K[(PostgreSQL Database)]
        L[/Prometheus Metrics Exporter/]
    end

    A -->|POST /licenses/grant| C
    B -->|POST /telemetry/playback| C
    C --> D --> E --> F
    F -->|License Grant Request| G
    F -->|Telemetry Ingestion| H
    
    E <-->|ZADD / ZCARD Sliding Window| J
    F <-->|Atomic Key Lock| J
    G <-->|ACID Transaction| K
    H <-->|Batch Upsert| K
    C -->|Expose Telemetry| L
```

---

## 🔄 Idempotency & Entitlement Sequence Diagram

This diagram illustrates how duplicate requests containing the same `x-idempotency-key` are handled without double execution:

```mermaid
sequenceDiagram
    autonumber
    actor Client as Audio SDK Client
    participant GW as API Gateway
    participant Cache as Redis Idempotency Cache
    participant Svc as License Service
    participant DB as PostgreSQL DB

    Client->>GW: POST /api/v1/licenses/grant (Header: x-idempotency-key="key-998877")
    GW->>Cache: Check if "idempotency:key-998877" exists
    
    alt Idempotency Key Exists (Cache Hit)
        Cache-->>GW: Return cached response payload { status: 200, _idempotentReplay: true }
        GW-->>Client: 200 OK (Instant Replay cached response, 0ms DB latency)
    else First Time Request (Cache Miss)
        Cache-->>GW: Key Not Found
        GW->>Svc: Process License Allocation
        Svc->>DB: INSERT INTO license_grants (idempotencyKey, status, expiresAt)
        DB-->>Svc: License Object Created
        Svc->>Cache: Cache Response Payload under "idempotency:key-998877" (TTL 24h)
        Svc-->>GW: 201 Created Response
        GW-->>Client: 201 Created { licenseId, status: "GRANTED", expiresAt }
    end
```

---

## 🛢️ Entity-Relationship (ER) Database Diagram

Relational PostgreSQL schema managed via Prisma ORM:

```mermaid
erDiagram
    USERS ||--o{ LICENSE_GRANTS : "owns"
    USERS ||--o{ PLAYBACK_SESSIONS : "initiates"
    AUDIOBOOKS ||--o{ LICENSE_GRANTS : "licensed_for"
    AUDIOBOOKS ||--o{ PLAYBACK_SESSIONS : "played_in"
    PLAYBACK_SESSIONS ||--o{ TELEMETRY_EVENTS : "logs"

    USERS {
        string id PK
        string email UK
        string name
        string subscriptionTier
        datetime createdAt
    }

    AUDIOBOOKS {
        string id PK
        string title
        string author
        int durationSeconds
        string streamUrl
    }

    LICENSE_GRANTS {
        string id PK
        string userId FK
        string audiobookId FK
        string idempotencyKey UK
        enum status
        datetime grantedAt
        datetime expiresAt
    }

    PLAYBACK_SESSIONS {
        string id PK
        string userId FK
        string audiobookId FK
        int currentPositionSeconds
        enum status
        datetime lastActiveAt
    }

    TELEMETRY_EVENTS {
        string id PK
        string sessionId FK
        string eventType
        int bufferingMs
        int bitrateKbps
        datetime timestamp
    }
```

---

## ✨ Key Engineering Features

### 1. Header-Driven Idempotency Locks
Prevents double-licensing and duplicate transaction processing when clients retry requests due to network drops. Uses Redis key locks with automatic database fallback.

### 2. Redis Sliding Window Rate Limiter
Uses atomic Redis Sorted Sets (`ZADD`, `ZREMRANGEBYSCORE`, `ZCARD`) to implement a sliding window rate limiter. Protects audio stream endpoints against request bursts while eliminating boundary spikes inherent in fixed-window algorithms.

### 3. Playback Telemetry Collector
Ingests real-time listener playback events (HEARTBEAT, BUFFERING, QUALITY_SHIFT) with automatic session state synchronization and Prometheus metrics incrementing.

### 4. Operational Excellence (OE) & Telemetry
* **Prometheus Metrics (`/metrics`):** Tracks HTTP request latencies, active stream sessions, license grant counts, and rate limit blocks.
* **Health Probes (`/health/live`, `/health/ready`):** Kubernetes-compatible liveness and readiness probe endpoints.

---

## 📡 API Reference & JSON Payloads

### Grant Audio Stream License
`POST /api/v1/licenses/grant`

**Request Headers:**
```http
Authorization: Bearer <JWT_TOKEN>
x-idempotency-key: idem_key_998877665544
Content-Type: application/json
```

**Request Body:**
```json
{
  "audiobookId": "ab_audible_project_hail_mary",
  "idempotencyKey": "idem_key_998877665544"
}
```

**Response (`201 Created`):**
```json
{
  "message": "Stream license successfully granted",
  "license": {
    "id": "lic-c9a8f2e1-4321",
    "userId": "usr_demo_123",
    "audiobookId": "ab_audible_project_hail_mary",
    "idempotencyKey": "idem_key_998877665544",
    "status": "GRANTED",
    "grantedAt": "2026-09-22T21:00:00.000Z",
    "expiresAt": "2026-09-23T21:00:00.000Z"
  },
  "isReplay": false
}
```

---

## 📐 Architectural Trade-Off Analysis

| Architectural Choice | Alternative Considered | Rationale & Selection Criteria |
| :--- | :--- | :--- |
| **Redis Sliding Window** | Fixed Window Counter | Fixed window counters allow $2\times$ burst capacity at window boundaries. Sliding window using Redis Sorted Sets provides smooth, deterministic rate control. |
| **Prisma ORM + PostgreSQL** | Raw SQL Queries | Prisma provides type-safe queries, migration history, and connection pooling while avoiding manual SQL injection vulnerabilities. |
| **Prometheus Exporter** | Custom Log Scraping | Prometheus pulls standard histogram buckets for p50/p90/p99 latency calculations with standard Grafana dashboard compatibility. |

---

## 🛠️ Local Installation & Docker Setup

### Prerequisites
* Docker & Docker Compose
* Node.js 20+

### 1-Command Setup via Docker Compose

```bash
# Clone the repository
git clone https://github.com/rahul0443/audible-pulse-stream-engine.git
cd audible-pulse-stream-engine

# Start PostgreSQL, Redis, and API Server
docker-compose up --build -d

# Verify health probes
curl http://localhost:3000/health/live
curl http://localhost:3000/health/ready
```

---

## 🧪 Automated Test Suite

```bash
# Install local dependencies
npm install

# Run Jest unit & integration tests
npm test

# Generate code coverage report
npm run test:coverage
```

---

## 📄 License & Author

Developed by **Rahul Muddhapuram** ([rmuddhap@asu.edu](mailto:rmuddhap@asu.edu)).
Licensed under the [MIT License](LICENSE).
