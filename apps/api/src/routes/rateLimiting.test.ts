import path from 'node:path';

import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import express, { type Application } from 'express';
import supertest from 'supertest';
import { describe, it, expect, beforeAll } from 'vitest';

import { signAccessToken } from '../lib/tokens';
import filesRouter from './files';

dotenv.config({ path: path.join(__dirname, '../../../.env') });

function createTestApp(): Application {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api/files', filesRouter);
  return app;
}

const rateLimitUserId = 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb';
const token = signAccessToken(rateLimitUserId);

/* eslint-disable max-lines-per-function */
describe('Rate Limiting on /api/files/init', () => {
  const app = createTestApp();

  beforeAll(async () => {
    const { db } = await import('../db');
    await db.query(
      `INSERT INTO users (id, email, name, password_hash)
       VALUES ($1, $2, 'Rate User', 'hash')
       ON CONFLICT (id) DO NOTHING`,
      [rateLimitUserId, `rate.user.${Date.now()}@test.com`],
    );
  });

  it('allows requests up to the threshold and returns 429 when exceeded', async () => {
    // Send 30 valid requests
    for (let i = 0; i < 30; i++) {
      const res = await supertest(app)
        .post('/api/files/init')
        .set('Cookie', [`orbit_access=${token}`])
        .send({
          name: `test_${i}.txt`,
          mimeType: 'text/plain',
          sizeBytes: 100,
        });
      expect(res.status).toBe(201);
    }

    // 31st request should be throttled with 429
    const blockedRes = await supertest(app)
      .post('/api/files/init')
      .set('Cookie', [`orbit_access=${token}`])
      .send({
        name: 'test_blocked.txt',
        mimeType: 'text/plain',
        sizeBytes: 100,
      });

    expect(blockedRes.status).toBe(429);
    const body = blockedRes.body as { error?: { code: string } };
    expect(body.error?.code).toBe('RATE_LIMIT_EXCEEDED');
  });
});
