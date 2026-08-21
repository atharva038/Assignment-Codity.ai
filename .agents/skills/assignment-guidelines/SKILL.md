---
name: assignment-guidelines
description: >-
  Guidelines for writing clean, thoroughly commented code for the Distributed Job Scheduler assignment.
  Ensures all code is educational, self-explanatory, structured, and free of bloat files.
---

# Assignment Coding & Explanation Guidelines

When implementing any feature in this project:

1. **Explanatory Comments**:
   - Every file must have a header comment explaining its purpose in the overall architecture.
   - Core functions must have JSDoc comments explaining parameters, return values, and implementation choices.
   - Non-trivial logic (e.g. `SKIP LOCKED` queries, exponential backoff calculations, cron evaluations, lease recovery) must have step-by-step inline commentary for viva/presentation readiness.

2. **Lean & Purpose-Built File Tree**:
   - Create only required and functional files.
   - Avoid empty dummy directories or unused stub files.

3. **Tech Stack Enforcement**:
   - Monorepo with npm workspaces.
   - `apps/api`: Express.js + TypeScript + Zod validation.
   - `apps/worker`: Node.js process + PostgreSQL `FOR UPDATE SKIP LOCKED`.
   - `apps/scheduler`: Cron evaluation + lease recovery loop.
   - `apps/dashboard`: Next.js / React UI for real-time monitoring.
   - `packages/database`: Prisma ORM.
   - `packages/shared`: Shared types, constants, retry math.
   - `packages/logger`: Pino structured logger.
