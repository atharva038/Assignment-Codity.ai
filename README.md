# Production-Grade Distributed Job Scheduler Platform

A production-inspired distributed background job processing engine built with **Express.js, TypeScript, PostgreSQL 16 (`FOR UPDATE SKIP LOCKED`), Redis 7, Prisma ORM, and React Web Dashboard**.

---

## 🌟 Key Engineering Features

- **Atomic Job Claiming (`FOR UPDATE SKIP LOCKED`)**: High-concurrency row locking with zero duplicate claims across parallel worker nodes.
- **Multi-Tenant System**: Organization & Project isolation with JWT authentication and RBAC security guards.
- **Exponential Retry Engine with Jitter**: Configurable Fixed, Linear, and Exponential backoff algorithms.
- **Dead Letter Queue (DLQ)**: Preserves original job history and execution logs for inspection and one-click replay.
- **Recurring Cron Scheduler**: Multi-replica optimistic locking (`lockToken` + `lockExpiresAt`) guaranteeing single job creation per cron tick.
- **Stale Worker & Crash Recovery Reaper**: Automatically detects crashed worker processes (`kill -9`) and recovers orphaned job leases with zero data loss.
- **Modern Web Dashboard**: Real-time React dashboard with Recharts metrics, queue controls, job explorer with log stream, and worker telemetry.
- **Automated Test Suite**: 39 automated integration tests covering API, Worker concurrency, Scheduler cron, and Crash recovery.

---

## 🚀 Quick Start Instructions

### 1. Prerequisites
- Node.js >= 20
- Docker & Docker Compose

### 2. Start Infrastructure Containers
```bash
docker compose up -d
```
*Starts PostgreSQL 16 (port 5432), Redis 7 (port 6379), and Adminer DB GUI (port 8080).*

### 3. Push Schema & Seed Initial Demo Data
```bash
npm run db:push
npm run db:seed
```

### 4. Run Development Services
Start services in separate terminal windows:
```bash
# Terminal 1: Express API Server (http://localhost:3000)
npm run dev:api

# Terminal 2: Worker Node Execution Engine
npm run dev:worker

# Terminal 3: Scheduler & Crash Recovery Reaper Daemon
npm run dev:scheduler

# Terminal 4: Web Dashboard (http://localhost:5173)
npm run dev:dashboard
```

---

## 📊 Automated Test Suite

Run the full end-to-end integration test suite (39 assertions):
```bash
npm test
```

Individual test suites:
- `npm run test:api` — Tests Auth, Tenant isolation, Projects, Queues & Stats APIs.
- `npm run test:worker` — Tests Worker registration, Atomic claiming (`SKIP LOCKED`), Retries & DLQ routing.
- `npm run test:scheduler` — Tests Cron Evaluation, Delayed Promotion, Stale Worker detection, Crash Recovery & DLQ Replay.

---

## 🛠️ Visual DB Inspection (Prisma Studio)
```bash
npm run db:studio
```
Opens **`http://localhost:5555`** in your browser!

---

## 📚 Deliverable Documentation

- **[System Architecture](docs/ARCHITECTURE.md)** (`docs/ARCHITECTURE.md`)
- **[Database Design & Indexes](docs/DATABASE_DESIGN.md)** (`docs/DATABASE_DESIGN.md`)
- **[Design Decisions & Trade-Offs](docs/DESIGN_DECISIONS.md)** (`docs/DESIGN_DECISIONS.md`)
- **[REST API Specification](docs/API_DOCUMENTATION.md)** (`docs/API_DOCUMENTATION.md`)
