# 🎧 Audible Pulse Stream Engine

[![CI/CD Pipeline](https://github.com/rahul0443/audible-pulse-stream-engine/actions/workflows/ci-cd.yml/badge.svg)](https://github.com/rahul0443/audible-pulse-stream-engine/actions)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.4-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-20.x-green.svg)](https://nodejs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15-blue.svg)](https://www.postgresql.org/)
[![Prisma](https://img.shields.io/badge/Prisma-5.14-5A67D8.svg)](https://www.prisma.io/)
[![Redis](https://img.shields.io/badge/Redis-7.0-red.svg)](https://redis.io/)
[![Docker](https://img.shields.io/badge/Docker-Enabled-2496ED.svg)](https://www.docker.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

A high-throughput, fault-tolerant **Audio Telemetry & Stream Entitlement Engine** engineered for digital audio platforms. Designed specifically to handle concurrent audio playback streaming, idempotent stream licensing, sliding-window rate limiting, and real-time playback telemetry ingestion.

---

## 🏗️ Architecture & System Topology

```mermaid
flowchart TD
    Client[Audio Client App / Web Listener] -->|HTTP / REST| API[Audible Pulse API Gateway]
    
    subgraph Security & Resiliency Layer
        API --> RL[Redis Sliding Window Rate Limiter]
        API --> IDEM[Idempotency Key Middleware]
        API --> AUTH[JWT Authentication Middleware]
    end
    
    subgraph Microservices Layer
        IDEM --> LicenseSvc[Stream License Service]
        AUTH --> TelemetrySvc[Playback Telemetry Service]
    end
    
    subgraph Data Stores & Observability
        LicenseSvc -->|ACID Transactions| PG[(PostgreSQL Database)]
        TelemetrySvc -->|Upsert & Batch Log| PG
        LicenseSvc -->|State Locks| Cache[(Redis Cache Cluster)]
        API -->|Prometheus Metrics| MetricsEx[/metrics Endpoint]
        API -->|Health Probes| HealthEx[/health/live & /health/ready]
    end
```

---

## ✨ Key System Features & Engineering Highlights

* **Idempotent Stream License Granting:** Intercepts licensing calls with `x-idempotency-key` headers to prevent duplicate billing and double-license grants during network retries.
* **Distributed Sliding Window Rate Limiter:** High-performance Redis sorted set (`ZADD`/`ZCARD`) rate limiter protecting streaming gateways against unauthorized traffic bursts (`<10ms` latency).
* **Real-time Playback Telemetry Ingestion:** Processes playback progress, quality of service (QoS) shifts, and buffering metrics into a structured telemetry schema.
* **Operational Excellence (OE) & Observability:** Out-of-the-box Prometheus metrics (`/metrics`), structured JSON logging (`Winston`), and Kubernetes liveness/readiness probes (`/health/live`, `/health/ready`).
* **Automated CI/CD Pipeline:** Fully configured GitHub Actions workflow running TypeScript compilation, Jest unit & integration test suites, and Docker container verification on every commit.

---

## 📡 API Reference Table

| Method | Endpoint | Description | Auth | Headers / Params |
| :--- | :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/licenses/grant` | Grants an active audio stream license | Required | `x-idempotency-key` |
| `POST` | `/api/v1/telemetry/playback` | Records playback progress & buffering events | Required | Payload body JSON |
| `GET` | `/health/live` | Kubernetes Liveness Probe | Public | None |
| `GET` | `/health/ready` | Kubernetes Readiness Probe | Public | None |
| `GET` | `/metrics` | Prometheus Metrics Exporter | Public | None |

---

## 📐 System Design Rationale & Trade-Offs

### 1. Sliding Window vs. Fixed Window Rate Limiting
* **Choice:** Redis Sorted Sets (Sliding Window Algorithm).
* **Rationale:** Fixed window algorithms suffer from boundary burst vulnerabilities (e.g., $2\times$ max rate allowed across window transitions). Sliding window ensures precise request accounting across rolling timeframes.

### 2. Idempotency Key Lock Strategy
* **Choice:** Header-driven `x-idempotency-key` cache with atomic database status checks.
* **Rationale:** In distributed stream management, client connection drops often trigger automatic SDK retries. Cached idempotency states guarantee **exactly-once execution semantics**.

---

## 🛠️ Local Quickstart with Docker Compose

```bash
# 1. Clone the repository
git clone https://github.com/rahul0443/audible-pulse-stream-engine.git
cd audible-pulse-stream-engine

# 2. Launch PostgreSQL, Redis, and API App via Docker Compose
docker-compose up --build -d

# 3. Verify health probes
curl http://localhost:3000/health/live
curl http://localhost:3000/health/ready
```

---

## 🧪 Running Automated Tests

```bash
# Run unit and integration tests
npm test

# Generate test coverage report
npm run test:coverage
```

---

## 📄 License
This project is licensed under the [MIT License](LICENSE).
