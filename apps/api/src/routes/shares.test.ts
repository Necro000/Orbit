import path from 'node:path';

import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import express, { type Application } from 'express';
import supertest from 'supertest';
import { describe, it, expect, beforeAll } from 'vitest';

import { signAccessToken } from '../lib/tokens';
import filesRouter from './files';
import foldersRouter from './folders';
import sharesRouter from './shares';

dotenv.config({ path: path.join(__dirname, '../../../.env') });

function createTestApp(): Application {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api/folders', foldersRouter);
  app.use('/api/files', filesRouter);
  app.use('/api/shares', sharesRouter);
  return app;
}

const ownerId = '33333333-3333-4333-a333-333333333333';
const granteeId = '44444444-4444-4444-a444-444444444444';
const ownerToken = signAccessToken(ownerId);
const granteeToken = signAccessToken(granteeId);

interface ApiResponse {
  folder?: { id: string; name: string };
  file?: { id: string; name: string };
  share?: { id: string; role: string; grantee_user_id: string };
  shares?: { id: string; role: string }[];
  error?: { code: string; message: string };
  ok?: boolean;
}

/* eslint-disable max-lines-per-function */
describe('Shares API & ACL Inheritance (/api/shares)', () => {
  const app = createTestApp();
  let folderId: string;
  let fileId: string;
  let shareId: string;

  beforeAll(async () => {
    const { db } = await import('../db');
    await db.query(
      `INSERT INTO users (id, email, name, password_hash)
       VALUES ($1, $2, 'Share Owner', 'hash'), ($3, $4, 'Share Grantee', 'hash')
       ON CONFLICT (id) DO NOTHING`,
      [ownerId, `share.owner.${Date.now()}@test.com`, granteeId, `share.grantee.${Date.now()}@test.com`],
    );

    // Create a folder owned by ownerId
    const fRes = await db.query<{ id: string }>(
      'INSERT INTO folders (name, owner_id) VALUES ($1, $2) RETURNING id',
      [`SharedFolder_${Date.now()}`, ownerId],
    );
    folderId = fRes.rows[0]!.id;

    // Create a ready file inside the folder
    const flRes = await db.query<{ id: string }>(
      `INSERT INTO files (name, mime_type, size_bytes, storage_key, owner_id, folder_id, status)
       VALUES ('secret_doc.pdf', 'application/pdf', 1024, $1, $2, $3, 'ready') RETURNING id`,
      [`key_${Date.now()}`, ownerId, folderId],
    );
    fileId = flRes.rows[0]!.id;
  });

  it('rejects self-sharing with 400', async () => {
    const res = await supertest(app)
      .post('/api/shares')
      .set('Cookie', [`orbit_access=${ownerToken}`])
      .send({
        resourceType: 'folder',
        resourceId: folderId,
        granteeUserId: ownerId,
        role: 'viewer',
      });

    expect(res.status).toBe(400);
    const body = res.body as ApiResponse;
    expect(body.error?.code).toBe('SELF_SHARE_NOT_ALLOWED');
  });

  it('owner shares folder with grantee as Viewer', async () => {
    const res = await supertest(app)
      .post('/api/shares')
      .set('Cookie', [`orbit_access=${ownerToken}`])
      .send({
        resourceType: 'folder',
        resourceId: folderId,
        granteeUserId: granteeId,
        role: 'viewer',
      });

    expect(res.status).toBe(200);
    const body = res.body as ApiResponse;
    expect(body.share?.role).toBe('viewer');
    expect(body.share?.grantee_user_id).toBe(granteeId);
    shareId = body.share!.id;
  });

  it('handles re-sharing with same grantee by updating role idempotently', async () => {
    const res = await supertest(app)
      .post('/api/shares')
      .set('Cookie', [`orbit_access=${ownerToken}`])
      .send({
        resourceType: 'folder',
        resourceId: folderId,
        granteeUserId: granteeId,
        role: 'editor',
      });

    expect(res.status).toBe(200);
    const body = res.body as ApiResponse;
    expect(body.share?.role).toBe('editor');
  });

  it('grantee can open shared folder and read inherited files', async () => {
    const folderRes = await supertest(app)
      .get(`/api/folders/${folderId}`)
      .set('Cookie', [`orbit_access=${granteeToken}`]);

    expect(folderRes.status).toBe(200);

    const fileRes = await supertest(app)
      .get(`/api/files/${fileId}`)
      .set('Cookie', [`orbit_access=${granteeToken}`]);

    expect(fileRes.status).toBe(200);
  });

  it('viewer cannot delete or rename folder (403 FORBIDDEN)', async () => {
    // Reset role to viewer
    await supertest(app)
      .post('/api/shares')
      .set('Cookie', [`orbit_access=${ownerToken}`])
      .send({
        resourceType: 'folder',
        resourceId: folderId,
        granteeUserId: granteeId,
        role: 'viewer',
      });

    const deleteRes = await supertest(app)
      .delete(`/api/folders/${folderId}`)
      .set('Cookie', [`orbit_access=${granteeToken}`]);

    expect(deleteRes.status).toBe(403);

    const renameRes = await supertest(app)
      .patch(`/api/folders/${folderId}`)
      .set('Cookie', [`orbit_access=${granteeToken}`])
      .send({ name: 'HackedName' });

    expect(renameRes.status).toBe(403);
  });

  it('revoking share removes access for grantee', async () => {
    const revokeRes = await supertest(app)
      .delete(`/api/shares/${shareId}`)
      .set('Cookie', [`orbit_access=${ownerToken}`]);

    expect(revokeRes.status).toBe(200);

    const folderRes = await supertest(app)
      .get(`/api/folders/${folderId}`)
      .set('Cookie', [`orbit_access=${granteeToken}`]);

    expect(folderRes.status).toBe(404);
  });
});
