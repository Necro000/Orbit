import path from 'node:path';

import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import express, { type Application } from 'express';
import supertest from 'supertest';
import { describe, it, expect, beforeAll } from 'vitest';

import { signAccessToken } from '../lib/tokens';
import { purgeExpiredTrash } from '../lib/trashPurge';
import trashRouter from './trash';

dotenv.config({ path: path.join(__dirname, '../../../.env') });

function createTestApp(): Application {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api/trash', trashRouter);
  return app;
}

const trashUserId = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';
const trashToken = signAccessToken(trashUserId);

/* eslint-disable max-lines-per-function */
describe('Trash & Restore API (/api/trash)', () => {
  const app = createTestApp();
  let fileId: string;
  let expiredFileId: string;
  let orphanedFileId: string;
  let parentFolderId: string;

  beforeAll(async () => {
    const { db } = await import('../db');
    await db.query(
      `INSERT INTO users (id, email, name, password_hash)
       VALUES ($1, $2, 'Trash User', 'hash')
       ON CONFLICT (id) DO NOTHING`,
      [trashUserId, `trash.user.${Date.now()}@test.com`],
    );

    // 1. Regular soft-deleted file within 30 days
    const flRes = await db.query<{ id: string }>(
      `INSERT INTO files (name, mime_type, size_bytes, storage_key, owner_id, is_deleted, status, updated_at)
       VALUES ('deleted_file.txt', 'text/plain', 50, $1, $2, true, 'ready', NOW() - INTERVAL '5 days') RETURNING id`,
      [`key_del_${Date.now()}`, trashUserId],
    );
    fileId = flRes.rows[0]!.id;

    // 2. Expired soft-deleted file (> 30 days)
    const expRes = await db.query<{ id: string }>(
      `INSERT INTO files (name, mime_type, size_bytes, storage_key, owner_id, is_deleted, status, updated_at)
       VALUES ('expired_file.txt', 'text/plain', 50, $1, $2, true, 'ready', NOW() - INTERVAL '35 days') RETURNING id`,
      [`key_exp_${Date.now()}`, trashUserId],
    );
    expiredFileId = expRes.rows[0]!.id;

    // 3. Parent folder and child file for orphan test
    const pRes = await db.query<{ id: string }>(
      `INSERT INTO folders (name, owner_id, is_deleted)
       VALUES ('ParentFolder', $1, true) RETURNING id`,
      [trashUserId],
    );
    parentFolderId = pRes.rows[0]!.id;

    const oRes = await db.query<{ id: string }>(
      `INSERT INTO files (name, mime_type, size_bytes, storage_key, owner_id, folder_id, is_deleted, status, updated_at)
       VALUES ('orphan_file.txt', 'text/plain', 50, $1, $2, $3, true, 'ready', NOW()) RETURNING id`,
      [`key_orph_${Date.now()}`, trashUserId, parentFolderId],
    );
    orphanedFileId = oRes.rows[0]!.id;
  });

  it('lists soft-deleted files in /api/trash', async () => {
    const res = await supertest(app)
      .get('/api/trash')
      .set('Cookie', [`orbit_access=${trashToken}`]);

    expect(res.status).toBe(200);
    const body = res.body as { files: { id: string }[] };
    expect(body.files.some((f) => f.id === fileId)).toBe(true);
  });

  it('restores a file within the 30-day retention window', async () => {
    const res = await supertest(app)
      .post('/api/trash/restore')
      .set('Cookie', [`orbit_access=${trashToken}`])
      .send({ resourceType: 'file', resourceId: fileId });

    expect(res.status).toBe(200);
    const body = res.body as { ok: boolean; file: { is_deleted: boolean } };
    expect(body.ok).toBe(true);
    expect(body.file.is_deleted).toBe(false);
  });

  it('places orphaned file at root if parent folder was deleted', async () => {
    const res = await supertest(app)
      .post('/api/trash/restore')
      .set('Cookie', [`orbit_access=${trashToken}`])
      .send({ resourceType: 'file', resourceId: orphanedFileId });

    expect(res.status).toBe(200);
    const body = res.body as { ok: boolean; file: { folder_id: string | null } };
    expect(body.ok).toBe(true);
    expect(body.file.folder_id).toBeNull(); // Placed at root
  });

  it('purge job removes items older than 30 days', async () => {
    const purgeResult = await purgeExpiredTrash(30);
    expect(purgeResult.purgedFiles).toBeGreaterThanOrEqual(1);

    const restoreRes = await supertest(app)
      .post('/api/trash/restore')
      .set('Cookie', [`orbit_access=${trashToken}`])
      .send({ resourceType: 'file', resourceId: expiredFileId });

    expect(restoreRes.status).toBe(404);
  });
});
