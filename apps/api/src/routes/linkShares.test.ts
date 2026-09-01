import path from 'node:path';

import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import express, { type Application } from 'express';
import supertest from 'supertest';
import { describe, it, expect, beforeAll } from 'vitest';

import { signAccessToken } from '../lib/tokens';
import linkSharesRouter from './linkShares';

dotenv.config({ path: path.join(__dirname, '../../../.env') });

function createTestApp(): Application {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api', linkSharesRouter);
  return app;
}

const ownerId = '55555555-5555-4555-a555-555555555555';
const ownerToken = signAccessToken(ownerId);

interface LinkResponse {
  linkShare?: { id: string; token: string; hasPassword: boolean };
  requiresPassword?: boolean;
  downloadUrl?: string;
  error?: { code: string; message: string };
}

/* eslint-disable max-lines-per-function */
describe('Public Links API (/api/link-shares & /api/link/:token)', () => {
  const app = createTestApp();
  let fileId: string;
  let activeToken: string;
  let expiredToken: string;

  beforeAll(async () => {
    const { db } = await import('../db');
    await db.query(
      `INSERT INTO users (id, email, name, password_hash)
       VALUES ($1, $2, 'Link Owner', 'hash')
       ON CONFLICT (id) DO NOTHING`,
      [ownerId, `link.owner.${Date.now()}@test.com`],
    );

    const flRes = await db.query<{ id: string }>(
      `INSERT INTO files (name, mime_type, size_bytes, storage_key, owner_id, status)
       VALUES ('shared_presentation.pdf', 'application/pdf', 2048, $1, $2, 'ready') RETURNING id`,
      [`key_link_${Date.now()}`, ownerId],
    );
    fileId = flRes.rows[0]!.id;
  });

  it('creates a password-protected public link', async () => {
    const res = await supertest(app)
      .post('/api/link-shares')
      .set('Cookie', [`orbit_access=${ownerToken}`])
      .send({
        resourceType: 'file',
        resourceId: fileId,
        password: 'SuperSecretPassword123!',
      });

    expect(res.status).toBe(201);
    const body = res.body as LinkResponse;
    expect(body.linkShare?.hasPassword).toBe(true);
    expect(typeof body.linkShare?.token).toBe('string');
    activeToken = body.linkShare!.token;
  });

  it('resolver prompts for password if password not supplied', async () => {
    const res = await supertest(app).get(`/api/link/${activeToken}`);
    expect(res.status).toBe(200);
    const body = res.body as LinkResponse;
    expect(body.requiresPassword).toBe(true);
  });

  it('resolver rejects wrong password with 401', async () => {
    const res = await supertest(app).get(`/api/link/${activeToken}?password=wrongPassword`);
    expect(res.status).toBe(401);
    const body = res.body as LinkResponse;
    expect(body.error?.code).toBe('INVALID_PASSWORD');
  });

  it('resolver resolves successfully with correct password', async () => {
    const res = await supertest(app).get(`/api/link/${activeToken}?password=SuperSecretPassword123!`);
    expect(res.status).toBe(200);
    const body = res.body as LinkResponse;
    expect(body.downloadUrl).toBeDefined();
  });

  it('rate limits password brute-force attempts after 5 failures (429)', async () => {
    for (let i = 0; i < 5; i++) {
      await supertest(app).get(`/api/link/${activeToken}?password=badPass_${i}`);
    }

    const blockedRes = await supertest(app).get(`/api/link/${activeToken}?password=badPass_last`);
    expect(blockedRes.status).toBe(429);
    const body = blockedRes.body as LinkResponse;
    expect(body.error?.code).toBe('RATE_LIMIT_EXCEEDED');
  });

  it('returns 410 for expired public link', async () => {
    const res = await supertest(app)
      .post('/api/link-shares')
      .set('Cookie', [`orbit_access=${ownerToken}`])
      .send({
        resourceType: 'file',
        resourceId: fileId,
        expiresAt: new Date(Date.now() - 10000).toISOString(),
      });

    expect(res.status).toBe(201);
    const body = res.body as LinkResponse;
    expiredToken = body.linkShare!.token;

    const resolveRes = await supertest(app).get(`/api/link/${expiredToken}`);
    expect(resolveRes.status).toBe(410);
    const resolveBody = resolveRes.body as LinkResponse;
    expect(resolveBody.error?.code).toBe('LINK_EXPIRED');
  });
});
