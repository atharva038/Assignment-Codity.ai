# Assignment Code Quality & Explanation Rules

1. **Clean & Explanatory Code**:
   - Write clean, modular, highly readable TypeScript/JavaScript code.
   - Include comprehensive inline JSDoc comments explaining *why* decisions were made, how functions work, and step-by-step logic, so the user can easily explain and defend the code during a viva/assignment evaluation.

2. **No Unwanted / Bloat Files**:
   - Do NOT create unnecessary boilerplate or placeholder files.
   - Keep file and folder structures tight, essential, and clean.

3. **Framework Choices**:
   - Use **Express.js** with TypeScript for `apps/api`.
   - Use **Prisma ORM** for database models & migrations in `packages/database`.
   - Use **PostgreSQL** (with `SKIP LOCKED` atomic job claiming) and **Redis** for state/locks/caching.

4. **Self-Documenting Architecture**:
   - Document every core module, database model, API endpoint, worker queue loop, and retry algorithm clearly.
