# Assignment Code Quality & Explanation Rules

1. **Clean & Explanatory Code**:
   - Write clean, modular, highly readable TypeScript code.
   - Include comprehensive inline JSDoc comments explaining *why* decisions were made, how functions work, and step-by-step logic, so the user can easily explain and defend the code during a viva/assignment evaluation.

2. **Testing Rigor & Automated Verification**:
   - Every phase must be backed by automated integration test scripts in `scripts/`.
   - Maintain 100% test coverage for critical paths: Atomic Job Claiming (`FOR UPDATE SKIP LOCKED`), High-concurrency Race Safety, Exponential Retries, DLQ Routing, Cron Evaluation, and Stale Worker Recovery.
   - Ensure all tests output formatted colorized pass/fail results.

3. **No Unwanted / Bloat Files**:
   - Do NOT create unnecessary boilerplate or placeholder files.
   - Keep file and folder structures tight, essential, and clean.

4. **Framework & Architecture Choices**:
   - Use **Express.js** with TypeScript for `apps/api`.
   - Use **Prisma ORM** for database models & migrations in `packages/database`.
   - Use **PostgreSQL** (with `SKIP LOCKED` atomic job claiming) and **Redis** for state/locks/caching.
   - Document every core module, database model, API endpoint, worker queue loop, and retry algorithm clearly.
