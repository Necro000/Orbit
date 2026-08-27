/**
 * ADR: Database client choice — node-postgres (pg)
 *
 * Decision: Use `pg` (node-postgres) Pool directly, no ORM.
 * Rationale:
 *  - Zero abstraction overhead; every query is explicit SQL -> easy to audit
 *    for injection risks (parameterized queries only, no string concat).
 *  - Matches brain.md §5: "No raw storage keys returned to client" — same
 *    discipline: what you see is what gets sent to Postgres.
 *  - Keeps the dependency graph minimal for a Phase 1 prototype; a query
 *    builder (e.g. Kysely) can be layered on later without a data-layer rewrite.
 *  - Pool is module-singleton: warm connections shared across all request handlers.
 *
 * Connection: DATABASE_URL env var (see .env.example).
 */

import path from 'path';

import dotenv from 'dotenv';
import { Pool } from 'pg';

// Load .env from root or local directory
dotenv.config();
dotenv.config({ path: path.join(__dirname, '../../../.env') });

if (!process.env['DATABASE_URL']) {
  throw new Error('DATABASE_URL environment variable is required');
}

export const db = new Pool({
  connectionString: process.env['DATABASE_URL'],
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

// Fail fast on startup if the DB is unreachable.
db.on('error', (err) => {
  console.error('[db] Unexpected pool error:', err.message);
});
