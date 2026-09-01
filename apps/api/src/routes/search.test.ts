import path from 'node:path';

import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import express, { type Application } from 'express';
import supertest from 'supertest';
import { describe, it, expect, beforeAll } from 'vitest';

import { signAccessToken } from '../lib/tokens';
import searchRouter from './search';
import sharesRouter from './shares';

dotenv.config({ path: path.join(__dirname, '../../../.env') });

function createTestApp(): Application {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api/search', searchRouter);
  app.use('/api/shares', sharesRouter);
  return app;
}

const userAliceId = '66666666-6666-4666-a666-666666666666';
const userBobId = '77777777-7777-4777-a777-777777777777';
const userEveId = '88888888-8888-4888-a888-888888888888';

const tokenAlice = signAccessToken(userAliceId);
const tokenBob = signAccessToken(userBobId);
const tokenEve = signAccessToken(userEveId);

interface SearchResponse {
  folders: { id: string; name: string }[];
  files: { id: string; name: string }[];
}

/* eslint-disable max-lines-per-function */
describe('Search API & ACL Scoping (/api/search)', () => {
  const app = createTestApp();
  const timestamp = Date.now();
  const alicePrivateFileName = `Alice_Secret_${timestamp}.pdf`;
  const aliceSharedFileName = `Alice_Shared_${timestamp}.pdf`;

  beforeAll(async () => {
    const { db } = await import('../db');
    await db.query(
      `INSERT INTO users (id, email, name, password_hash)
       VALUES ($1, $2, 'Alice', 'hash'), ($3, $4, 'Bob', 'hash'), ($5, $6, 'Eve', 'hash')
       ON CONFLICT (id) DO NOTHING`,
      [
        userAliceId, `alice.${timestamp}@test.com`,
        userBobId, `bob.${timestamp}@test.com`,
        userEveId, `eve.${timestamp}@test.com`,
      ],
    );

    // Alice creates private file
    await db.query(
      `INSERT INTO files (name, mime_type, size_bytes, storage_key, owner_id, status)
       VALUES ($1, 'application/pdf', 100, $2, $3, 'ready')`,
      [alicePrivateFileName, `key_priv_${timestamp}`, userAliceId],
    );

    // Alice creates shared file and shares with Bob
    const sharedFileRes = await db.query<{ id: string }>(
      `INSERT INTO files (name, mime_type, size_bytes, storage_key, owner_id, status)
       VALUES ($1, 'application/pdf', 100, $2, $3, 'ready') RETURNING id`,
      [aliceSharedFileName, `key_pub_${timestamp}`, userAliceId],
    );
    const sharedFileId = sharedFileRes.rows[0]!.id;

    await db.query(
      `INSERT INTO shares (resource_type, resource_id, grantee_user_id, role, created_by)
       VALUES ('file', $1, $2, 'viewer', $3)`,
      [sharedFileId, userBobId, userAliceId],
    );
  });

  it('Alice can search and find both of her files', async () => {
    const res = await supertest(app)
      .get(`/api/search?q=${timestamp}`)
      .set('Cookie', [`orbit_access=${tokenAlice}`]);

    expect(res.status).toBe(200);
    const body = res.body as SearchResponse;
    const names = body.files.map((f) => f.name);
    expect(names).toContain(alicePrivateFileName);
    expect(names).toContain(aliceSharedFileName);
  });

  it('Bob can find shared file in search, but NOT Alice private file', async () => {
    const res = await supertest(app)
      .get(`/api/search?q=${timestamp}`)
      .set('Cookie', [`orbit_access=${tokenBob}`]);

    expect(res.status).toBe(200);
    const body = res.body as SearchResponse;
    const names = body.files.map((f) => f.name);
    expect(names).toContain(aliceSharedFileName);
    expect(names).not.toContain(alicePrivateFileName);
  });

  it('Eve (unauthorized) gets 0 results when searching for Alice files', async () => {
    const res = await supertest(app)
      .get(`/api/search?q=${timestamp}`)
      .set('Cookie', [`orbit_access=${tokenEve}`]);

    expect(res.status).toBe(200);
    const body = res.body as SearchResponse;
    const names = body.files.map((f) => f.name);
    expect(names).not.toContain(alicePrivateFileName);
    expect(names).not.toContain(aliceSharedFileName);
  });
});
