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
- **100% Automated Test Rigor**: Complete integration test suite featuring **68 passing assertions (100% success rate)** across API, Worker, and Scheduler apps.

---

## 🏗️ Monorepo Architecture Overview

```
Assignment-Codity.ai/
├── apps/
│   ├── api/          # Express REST API Server (Port 3000)
│   ├── worker/       # Atomic Polling Worker Node Daemon
│   ├── scheduler/    # Cron Engine, Delayed Promoter & Crash Recovery Reaper
│   └── dashboard/    # Modern React + Vite + Tailwind CSS Dashboard (Port 5173)
├── packages/
│   ├── database/     # Prisma ORM Schema & PostgreSQL Client
│   ├── shared/       # Shared Types, Zod Schemas & Retry Algorithms
│   └── logger/       # Structured Pino Logger Library
├── docs/
│   ├── ARCHITECTURE.md      # Architecture diagrams & component breakdown
│   ├── DATABASE_DESIGN.md   # Schema specification, ER diagram & indexes
│   ├── DESIGN_DECISIONS.md # In-depth viva defense & trade-offs
│   └── API_DOCUMENTATION.md # REST API reference specification
├── scripts/
│   ├── test-api.ts        # Integration tests for Auth & Queue APIs (29 assertions)
│   ├── test-worker.ts     # Integration tests for Worker Claiming & DLQ (21 assertions)
│   └── test-scheduler.ts  # Integration tests for Cron Engine & Reaper (18 assertions)
├── docker-compose.yml     # PostgreSQL 16, Redis 7 & Adminer stack
└── package.json           # Root npm workspace orchestrator
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

### 3. Install Dependencies & Seed Database
```bash
npm install
npm run db:push
npm run db:seed
```

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

## 📊 Comprehensive Test Suite

Run all automated integration test suites (**68 / 68 assertions passed**):

```bash
npm test
```

### Individual Test Suites
- **API Test Suite** (29 assertions):
  ```bash
  npm run test:api
  ```
- **Worker & Concurrency Test Suite** (21 assertions):
  ```bash
  npm run test:worker
  ```
- **Scheduler & Reaper Test Suite** (18 assertions):
  ```bash
  npm run test:scheduler
  ```

---

## 🛠️ Visual Database Explorer (Prisma Studio)

Launch Prisma Studio to visually inspect tables, execution logs, and worker heartbeats:
```bash
npm run db:studio
```
Access the visual browser UI at **`http://localhost:5555`**.

---

## 📖 Evaluation Deliverables & Documentation

For detailed technical evaluation, viva defense, and architectural deep-dives, consult the documentation suite in `docs/`:

1. 🏛️ **[System Architecture](docs/ARCHITECTURE.md)** — High-level architecture, component interactions, and state transition diagrams.
2. 🗄️ **[Database Design](docs/DATABASE_DESIGN.md)** — Mermaid ER Diagram, table schemas, foreign key cascade rules, and B-Tree indexing strategy.
3. 💡 **[Design Decisions & Trade-Offs](docs/DESIGN_DECISIONS.md)** — Comprehensive viva defense covering `FOR UPDATE SKIP LOCKED`, optimistic cron locks, and DLQ audit preservation.
4. 🔌 **[API Documentation](docs/API_DOCUMENTATION.md)** — REST API specification reference with sample request/response payloads.

---

## 📄 License

This project is open-source under the [MIT License](LICENSE).
