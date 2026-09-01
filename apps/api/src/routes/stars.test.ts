import path from 'node:path';

import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import express, { type Application } from 'express';
import supertest from 'supertest';
import { describe, it, expect, beforeAll } from 'vitest';

import { signAccessToken } from '../lib/tokens';
import starsRouter from './stars';

dotenv.config({ path: path.join(__dirname, '../../../.env') });

function createTestApp(): Application {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api/stars', starsRouter);
  return app;
}

const userId = '99999999-9999-4999-a999-999999999999';
const token = signAccessToken(userId);

/* eslint-disable max-lines-per-function */
describe('Stars API (/api/stars)', () => {
  const app = createTestApp();
  let folderId: string;

  beforeAll(async () => {
    const { db } = await import('../db');
    await db.query(
      `INSERT INTO users (id, email, name, password_hash)
       VALUES ($1, $2, 'Star User', 'hash')
       ON CONFLICT (id) DO NOTHING`,
      [userId, `star.user.${Date.now()}@test.com`],
    );

    const fRes = await db.query<{ id: string }>(
      'INSERT INTO folders (name, owner_id) VALUES ($1, $2) RETURNING id',
      [`StarredFolder_${Date.now()}`, userId],
    );
    folderId = fRes.rows[0]!.id;
  });

  it('stars a folder and retrieves it in list', async () => {
    const starRes = await supertest(app)
      .post('/api/stars')
      .set('Cookie', [`orbit_access=${token}`])
      .send({ resourceType: 'folder', resourceId: folderId });

    expect(starRes.status).toBe(200);

    const listRes = await supertest(app)
      .get('/api/stars')
      .set('Cookie', [`orbit_access=${token}`]);

    expect(listRes.status).toBe(200);
    const body = listRes.body as { folders: { id: string }[] };
    expect(body.folders.some((f) => f.id === folderId)).toBe(true);
  });

  it('unstars a folder and verifies removal', async () => {
    const unstarRes = await supertest(app)
      .delete(`/api/stars/folder/${folderId}`)
      .set('Cookie', [`orbit_access=${token}`]);

    expect(unstarRes.status).toBe(200);

    const listRes = await supertest(app)
      .get('/api/stars')
      .set('Cookie', [`orbit_access=${token}`]);

    expect(listRes.status).toBe(200);
    const body = listRes.body as { folders: { id: string }[] };
    expect(body.folders.some((f) => f.id === folderId)).toBe(false);
  });
});
