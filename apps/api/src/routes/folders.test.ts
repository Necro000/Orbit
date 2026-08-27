import path from 'node:path';

import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import express, { type Application } from 'express';
import supertest from 'supertest';
import { describe, it, expect, beforeAll } from 'vitest';

import { signAccessToken } from '../lib/tokens';
import foldersRouter from './folders';

dotenv.config({ path: path.join(__dirname, '../../../.env') });

function createTestApp(): Application {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api/folders', foldersRouter);
  return app;
}

const userAId = '11111111-1111-4111-a111-111111111111';
const userBId = '22222222-2222-4222-a222-222222222222';
const tokenUserA = signAccessToken(userAId);
const tokenUserB = signAccessToken(userBId);

interface FolderResponse {
  folder: { id: string; name: string; owner_id: string; parent_id: string | null };
  error?: { code: string; message: string };
  path?: { id: string; name: string }[];
  folders?: { id: string; name: string }[];
  ok?: boolean;
}

/* eslint-disable max-lines-per-function */
describe('Folders API (/api/folders)', () => {
  const app = createTestApp();
  let rootFolderId: string;
  let childFolderId: string;

  beforeAll(async () => {
    const { db } = await import('../db');
    await db.query(
      `INSERT INTO users (id, email, name, password_hash)
       VALUES ($1, $2, 'User A', 'hash'), ($3, $4, 'User B', 'hash')
       ON CONFLICT (id) DO NOTHING`,
      [userAId, `folder.user.a.${Date.now()}@test.com`, userBId, `folder.user.b.${Date.now()}@test.com`],
    );
  });

  it('creates a root folder for user A', async () => {
    const folderName = `Documents_${Date.now()}`;
    const res = await supertest(app)
      .post('/api/folders')
      .set('Cookie', [`orbit_access=${tokenUserA}`])
      .send({ name: folderName });

    expect(res.status).toBe(201);
    const body = res.body as FolderResponse;
    expect(body.folder.name).toBe(folderName);
    expect(body.folder.owner_id).toBe(userAId);
    expect(body.folder.parent_id).toBeNull();
    rootFolderId = body.folder.id;
  });

  it('creates a nested child folder inside root folder', async () => {
    const childName = 'Invoices';
    const res = await supertest(app)
      .post('/api/folders')
      .set('Cookie', [`orbit_access=${tokenUserA}`])
      .send({ name: childName, parentId: rootFolderId });

    expect(res.status).toBe(201);
    const body = res.body as FolderResponse;
    expect(body.folder.name).toBe(childName);
    expect(body.folder.parent_id).toBe(rootFolderId);
    childFolderId = body.folder.id;
  });

  it('rejects duplicate folder name at the same level with 409', async () => {
    const res = await supertest(app)
      .post('/api/folders')
      .set('Cookie', [`orbit_access=${tokenUserA}`])
      .send({ name: 'Invoices', parentId: rootFolderId });

    expect(res.status).toBe(409);
    const body = res.body as FolderResponse;
    expect(body.error?.code).toBe('DUPLICATE_FOLDER_NAME');
  });

  it('fetches folder contents with recursive breadcrumb path', async () => {
    const res = await supertest(app)
      .get(`/api/folders/${childFolderId}`)
      .set('Cookie', [`orbit_access=${tokenUserA}`]);

    expect(res.status).toBe(200);
    const body = res.body as FolderResponse;
    expect(body.folder.id).toBe(childFolderId);
    expect(body.path?.length).toBe(2);
    expect(body.path?.[0]?.id).toBe(rootFolderId);
    expect(body.path?.[1]?.id).toBe(childFolderId);
  });

  it('fetches root folder view (id=root)', async () => {
    const res = await supertest(app)
      .get('/api/folders/root')
      .set('Cookie', [`orbit_access=${tokenUserA}`]);

    expect(res.status).toBe(200);
    const body = res.body as FolderResponse;
    expect(body.folder.id).toBe('root');
    expect(Array.isArray(body.folders)).toBe(true);
  });

  it('renames a folder', async () => {
    const res = await supertest(app)
      .patch(`/api/folders/${childFolderId}`)
      .set('Cookie', [`orbit_access=${tokenUserA}`])
      .send({ name: 'Invoices_2026' });

    expect(res.status).toBe(200);
    const body = res.body as FolderResponse;
    expect(body.folder.name).toBe('Invoices_2026');
  });

  it('rejects moving a folder into itself (cycle guard)', async () => {
    const res = await supertest(app)
      .patch(`/api/folders/${rootFolderId}`)
      .set('Cookie', [`orbit_access=${tokenUserA}`])
      .send({ parentId: rootFolderId });

    expect(res.status).toBe(400);
    const body = res.body as FolderResponse;
    expect(body.error?.code).toBe('CYCLIC_MOVE_NOT_ALLOWED');
  });

  it('rejects moving a folder into its own descendant (cycle guard)', async () => {
    const res = await supertest(app)
      .patch(`/api/folders/${rootFolderId}`)
      .set('Cookie', [`orbit_access=${tokenUserA}`])
      .send({ parentId: childFolderId });

    expect(res.status).toBe(400);
    const body = res.body as FolderResponse;
    expect(body.error?.code).toBe('CYCLIC_MOVE_NOT_ALLOWED');
  });

  it('prevents user B from accessing user A folder', async () => {
    const res = await supertest(app)
      .get(`/api/folders/${rootFolderId}`)
      .set('Cookie', [`orbit_access=${tokenUserB}`]);

    expect(res.status).toBe(404);
  });

  it('soft deletes a folder and cascades to descendants', async () => {
    const res = await supertest(app)
      .delete(`/api/folders/${rootFolderId}`)
      .set('Cookie', [`orbit_access=${tokenUserA}`]);

    expect(res.status).toBe(200);
    const body = res.body as FolderResponse;
    expect(body.ok).toBe(true);

    const getRes = await supertest(app)
      .get(`/api/folders/${rootFolderId}`)
      .set('Cookie', [`orbit_access=${tokenUserA}`]);
    expect(getRes.status).toBe(404);

    const childRes = await supertest(app)
      .get(`/api/folders/${childFolderId}`)
      .set('Cookie', [`orbit_access=${tokenUserA}`]);
    expect(childRes.status).toBe(404);
  });
});
