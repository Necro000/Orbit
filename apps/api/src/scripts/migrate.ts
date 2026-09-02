import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { Pool } from 'pg';

// Load .env
dotenv.config();
dotenv.config({ path: path.join(__dirname, '../../../../.env') });

const dbUrl = process.env['DATABASE_URL'];
if (!dbUrl) {
  console.error('[migrate] Error: DATABASE_URL environment variable is required.');
  process.exit(1);
}

const pool = new Pool({
  connectionString: dbUrl,
  connectionTimeoutMillis: 10_000,
});

async function runMigrations() {
  const client = await pool.connect();
  try {
    console.log('[migrate] Connecting to database...');
    
    // Ensure migrations tracking table exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS _migrations_history (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    const migrationsDir = path.resolve(__dirname, '../../../../infra/migrations');
    if (!fs.existsSync(migrationsDir)) {
      throw new Error(`Migrations directory not found at: ${migrationsDir}`);
    }

    const files = fs
      .readdirSync(migrationsDir)
      .filter((file) => file.endsWith('.sql'))
      .sort();

    console.log(`[migrate] Found ${files.length} migration files in ${migrationsDir}`);

    for (const file of files) {
      const res = await client.query('SELECT name FROM _migrations_history WHERE name = $1', [file]);
      if (res.rows.length > 0) {
        console.log(`[migrate] Skipped (already applied): ${file}`);
        continue;
      }

      const filePath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(filePath, 'utf8');

      console.log(`[migrate] Applying: ${file}...`);
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO _migrations_history (name) VALUES ($1)', [file]);
        await client.query('COMMIT');
        console.log(`[migrate] Successfully applied: ${file}`);
      } catch (err) {
        await client.query('ROLLBACK');
        console.error(`[migrate] Failed to apply ${file}:`, err);
        throw err;
      }
    }

    console.log('[migrate] All database migrations are up to date!');
  } finally {
    client.release();
    await pool.end();
  }
}

runMigrations().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error('[migrate] Migration run failed:', message);
  process.exit(1);
});
