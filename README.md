# ⚡ Distributed Job Scheduler Platform

A production-grade, high-concurrency distributed job scheduling and execution engine built with **Node.js, Express.js, TypeScript, PostgreSQL 16 (`FOR UPDATE SKIP LOCKED`), Redis 7, Prisma ORM, and React + Vite Dashboard**.

[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D20-green.svg)](https://nodejs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-blue.svg)](https://www.postgresql.org/)
[![Redis](https://img.shields.io/badge/Redis-7.0-red.svg)](https://redis.io/)
[![License](https://img.shields.io/badge/License-MIT-purple.svg)](LICENSE)

---

## 🌟 Architecture & Core Capabilities

- **Atomic Job Claiming (`FOR UPDATE SKIP LOCKED`)**: High-throughput row locking in PostgreSQL guaranteeing **exactly-once job claiming** with zero race conditions across parallel worker nodes.
- **Multi-Tenant Security**: Organization and Project isolation with JWT authentication and strict tenant boundaries.
- **Configurable Backoff & Retry Engine**: Fixed, Linear, and Exponential retry strategies with full jitter support to avoid thundering herd problems.
- **Dead Letter Queue (DLQ)**: Preserves original job payloads, microsecond log streams, and stack traces for permanent failures with one-click REST API and UI replay capabilities.
- **Recurring Cron Scheduler**: 5-field cron parsing with multi-replica optimistic locking (`lockToken` + `lockExpiresAt`) ensuring single job creation per cron tick.
- **Crash Recovery Reaper**: Background daemon that detects crashed worker nodes (`kill -9`) and re-queues orphaned job leases with zero data loss.
- **Server-Side Paginated React Dashboard**: Real-time Web Dashboard with Recharts execution throughput charts, queue controls, job explorer with microsecond log viewer, worker fleet telemetry, and "+ Create Queue" modal.
- **100% Automated Test Rigor**: Complete integration test suite featuring **138+ passing assertions (100% success rate across 11 test suites)** covering API, Concurrency, WebSocket, Redis, Rate Limiting, Sharding, Workflows, Events, RBAC, and AI Diagnostics.

---

## 🏗️ Monorepo Architecture Overview

```
Assignment-Codity.ai/
├── apps/
│   ├── api/          # Express REST API & WebSocket Gateway (Port 3000)
│   ├── worker/       # Atomic Polling Worker Node Daemon (FOR UPDATE SKIP LOCKED)
│   ├── scheduler/    # Cron Engine, Delayed Promoter & Crash Recovery Reaper
│   └── dashboard/    # React 18 + Vite Real-Time Dashboard (Port 5173)
├── packages/
│   ├── database/     # Prisma ORM Schema & PostgreSQL 16 Client
│   ├── redis/        # Redis 7 Client Wrapper, Pub/Sub & Heartbeat Subscriptions
│   ├── shared/       # Shared Types, Zod Schemas & Retry Algorithms
│   └── logger/       # Structured Pino Logger Library
├── docs/
│   ├── ARCHITECTURE.md            # System Architecture, Mermaid diagrams & data flows
│   ├── DATABASE_DESIGN.md         # Schema specification, ER diagram & index rationale
│   ├── DESIGN_DECISIONS.md        # In-depth architectural rationale & engineering trade-offs
│   ├── API_DOCUMENTATION.md       # REST API reference specification & schemas
│   └── WEBSOCKET_IMPLEMENTATION.md # WebSocket protocol & live monitoring guide
├── scripts/                       # 11 Automated E2E & Concurrency Test Suites
│   ├── test-api.ts                # REST API, Auth & Queue integration tests (29 tests)
│   ├── test-websocket.ts          # WebSocket handshake & telemetry tests (7 tests)
│   ├── test-redis.ts              # Redis caching & Pub/Sub broadcast tests (5 tests)
│   ├── test-rate-limit.ts         # Sliding window rate limiting & throttling tests (4 tests)
│   ├── test-sharding.ts           # Consistent hash & worker fleet isolation tests (4 tests)
│   ├── test-worker.ts             # Atomic SKIP LOCKED claiming & concurrency tests (20 tests)
│   ├── test-scheduler.ts          # Cron evaluation, optimistic locks & reaper tests (18 tests)
│   ├── test-workflows.ts          # DAG workflow & dependency resolution tests (12 tests)
│   ├── test-event-driven.ts       # Webhook HMAC verification & event routing tests (28 tests)
│   ├── test-rbac.ts               # Role-Based Access Control permission gates (10 tests)
│   ├── test-ai-summary.ts         # AI failure diagnostics & root-cause analysis (1 test)
│   └── monitor-redis.ts           # Live Redis telemetry stream inspector
├── docker-compose.yml             # PostgreSQL 16, Redis 7 & Adminer stack
└── package.json                   # Root npm workspace orchestrator
```

---

## 🚀 Quick Start & Setup Guide

### 1. Prerequisites
- **Node.js**: `>= 20.0.0`
- **npm**: `>= 10.0.0`
- **Docker & Docker Compose**

### 2. Infrastructure Setup
Start the local PostgreSQL 16 database and Redis 7 container:
```bash
docker compose up -d
```
*Containers started:*
- **PostgreSQL 16**: `localhost:5432` (`postgres:postgres`)
- **Redis 7**: `localhost:6379`
- **Adminer DB GUI**: `http://localhost:8080`

### 3. Environment & Database Initialization
```bash
cp .env.example .env
npm install
npm run db:push
npm run db:seed
```
*Default Seeded User:* `admin@codity.ai` (Admin Role) | Org: `codity-corp` | Project: `main-platform`

### 4. Launch Development Services
Run the following services in separate terminal tabs:

```bash
# Terminal 1: Express REST API Server (http://localhost:3000)
npm run dev:api

# Terminal 2: Worker Processing Node
npm run dev:worker

# Terminal 3: Scheduler Daemon & Crash Recovery Reaper
npm run dev:scheduler

# Terminal 4: Web Dashboard (http://localhost:5173)
npm run dev:dashboard
```

---

## 📊 Comprehensive Test Suite (138+ Assertions — 100% Pass Rate)

Run all 11 automated integration test suites sequentially:

```bash
npm test
```

### Individual Specialized Test Suites
- **API Test Suite** (`npm run test:api`): Auth, Org/Project tenancy, Queue CRUD, Idempotency.
- **WebSocket Suite** (`npm run test:ws`): Auth handshake, live metric streaming, reconnects.
- **Redis Suite** (`npm run test:redis`): PING, SETEX cache validation, Pub/Sub channel broadcasts.
- **Rate Limiting Suite** (`npm run test:ratelimit`): Sliding window logs, RFC headers, in-memory fallback.
- **Queue Sharding Suite** (`npm run test:sharding`): FNV-1a consistent hashing, dedicated worker fleet isolation.
- **Worker & Concurrency Suite** (`npm run test:worker`): Atomic `FOR UPDATE SKIP LOCKED` claim guard, zero duplicate claims, retry backoff with jitter.
- **Scheduler & Reaper Suite** (`npm run test:scheduler`): 5-field cron parsing, optimistic locks, delayed promotion, crash recovery reaper.
- **Workflows Suite** (`npm run test:workflows`): Multi-stage DAG dependencies, topological execution, error cascade handling.
- **Event-Driven Suite** (`npm run test:events`): HMAC-SHA256 signature verification, event subscriptions, payload template interpolation.
- **RBAC Security Suite** (`npm run test:rbac`): Role-Based Access Control permission enforcement.
- **AI Diagnostics Suite** (`npm run test:ai`): AI-powered root-cause failure analysis and suggested remediations.

---

## 🛠️ Visual Database Explorer (Prisma Studio)

Launch Prisma Studio to visually inspect tables, execution logs, and worker heartbeats:
```bash
npm run db:studio
```
Access the visual browser UI at **`http://localhost:5555`**.

---

## 📖 System Architecture & Technical Documentation

For detailed technical analysis, architectural deep-dives, and implementation proofs, consult the comprehensive documentation suite in [`docs/`](docs/):

1. 🏛️ **[System Architecture](docs/ARCHITECTURE.md)** — High-level architecture, component specifications, state transition diagrams, and event flowcharts.
2. 🗄️ **[Database Design](docs/DATABASE_DESIGN.md)** — Mermaid ER Diagram, table schemas, foreign key cascade rules, normalization decisions, and B-Tree indexing strategy.
3. 💡 **[Design Decisions & Trade-Offs](docs/DESIGN_DECISIONS.md)** — Comprehensive engineering rationale covering `FOR UPDATE SKIP LOCKED`, optimistic cron locks, rate limiting sliding window algorithms, and DLQ audit preservation.
4. 🔌 **[API Documentation](docs/API_DOCUMENTATION.md)** — Complete REST API specification reference with sample request/response payloads, rate limit headers, and error schemas.
5. ⚡ **[WebSocket Implementation](docs/WEBSOCKET_IMPLEMENTATION.md)** — Detailed specification of real-time bidirectional telemetry streaming and HTTP polling dual-mode fallbacks.

---

## 📄 License

This project is open-source under the [MIT License](LICENSE).
