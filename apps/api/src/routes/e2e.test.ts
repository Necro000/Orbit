import path from 'node:path';

import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import express, { type Application } from 'express';
import supertest from 'supertest';
import { describe, it, expect } from 'vitest';

import authRouter from './auth';
import filesRouter from './files';
import foldersRouter from './folders';
import linkSharesRouter from './linkShares';
import searchRouter from './search';
import sharedRouter from './shared';
import sharesRouter from './shares';
import starsRouter from './stars';
import trashRouter from './trash';

dotenv.config({ path: path.join(__dirname, '../../../.env') });

function createFullApp(): Application {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api/auth', authRouter);
  app.use('/api/folders', foldersRouter);
  app.use('/api/files', filesRouter);
  app.use('/api/shares', sharesRouter);
  app.use('/api', linkSharesRouter);
  app.use('/api/stars', starsRouter);
  app.use('/api/search', searchRouter);
  app.use('/api/shared', sharedRouter);
  app.use('/api/trash', trashRouter);
  return app;
}

interface DirectStorage {
  saveObjectDirect: (key: string, data: Buffer, mime: string) => Promise<void>;
}

/* eslint-disable max-lines-per-function */
describe('Orbit Full User-Story Integration Loop (Context.md §8)', () => {
  const app = createFullApp();
  const ts = Date.now();

  const user1Email = `user1.${ts}@example.com`;
  const user2Email = `user2.${ts}@example.com`;
  const user3Email = `user3.${ts}@example.com`;
  const password = 'Password123!';

  let cookieUser1: string;
  let cookieUser2: string;
  let cookieUser3: string;

  let folderId: string;
  let fileId: string;
  let publicToken: string;

  it('Step 1: Sign up users 1, 2, and 3', async () => {
    const reg1 = await supertest(app)
      .post('/api/auth/register')
      .send({ email: user1Email, password, name: 'Alice Owner' });
    expect(reg1.status).toBe(201);
    cookieUser1 = reg1.headers['set-cookie']?.[0] ?? '';

    const reg2 = await supertest(app)
      .post('/api/auth/register')
      .send({ email: user2Email, password, name: 'Bob Teammate' });
    expect(reg2.status).toBe(201);
    cookieUser2 = reg2.headers['set-cookie']?.[0] ?? '';

    const reg3 = await supertest(app)
      .post('/api/auth/register')
      .send({ email: user3Email, password, name: 'Eve Outsider' });
    expect(reg3.status).toBe(201);
    cookieUser3 = reg3.headers['set-cookie']?.[0] ?? '';
  });

  it('Step 2: User 1 creates folder structure and uploads a file', async () => {
    // Create folder
    const folderRes = await supertest(app)
      .post('/api/folders')
      .set('Cookie', [cookieUser1])
      .send({ name: `Project_Alpha_${ts}` });
    expect(folderRes.status).toBe(201);
    folderId = (folderRes.body as { folder: { id: string } }).folder.id;

    // Init upload
    const initRes = await supertest(app)
      .post('/api/files/init')
      .set('Cookie', [cookieUser1])
      .send({
        name: `financial_report_${ts}.pdf`,
        mimeType: 'application/pdf',
        sizeBytes: 1024,
        folderId,
      });
    expect(initRes.status).toBe(201);
    fileId = (initRes.body as { file: { id: string } }).file.id;

    // Direct storage write
    const { storage } = await import('../lib/storage');
    if ('saveObjectDirect' in storage) {
      const directStorage = storage as unknown as DirectStorage;
      const storageKey = `tenants/test/folders/${folderId}/files/${fileId}-financial.pdf`;
      await directStorage.saveObjectDirect(storageKey, Buffer.from('fake pdf data'), 'application/pdf');
    }

    const { db } = await import('../db');
    await db.query("UPDATE files SET status = 'ready' WHERE id = $1", [fileId]);
  });

  it('Step 3: User 1 stars the file', async () => {
    const starRes = await supertest(app)
      .post('/api/stars')
      .set('Cookie', [cookieUser1])
      .send({ resourceType: 'file', resourceId: fileId });

    expect(starRes.status).toBe(200);

    const listRes = await supertest(app)
      .get('/api/stars')
      .set('Cookie', [cookieUser1]);
    expect(listRes.status).toBe(200);
    const body = listRes.body as { files: { id: string }[] };
    expect(body.files.some((f) => f.id === fileId)).toBe(true);
  });

  it('Step 4: User 1 shares folder with User 2 as Viewer', async () => {
    const shareRes = await supertest(app)
      .post('/api/shares')
      .set('Cookie', [cookieUser1])
      .send({
        resourceType: 'folder',
        resourceId: folderId,
        granteeEmail: user2Email,
        role: 'viewer',
      });

    expect(shareRes.status).toBe(200);

    // User 2 sees it in shared view
    const sharedRes = await supertest(app)
      .get('/api/shared')
      .set('Cookie', [cookieUser2]);
    expect(sharedRes.status).toBe(200);
    const body = sharedRes.body as { folders: { id: string }[] };
    expect(body.folders.some((f) => f.id === folderId)).toBe(true);
  });

  it('Step 5: User 1 generates a password-protected public link with expiry', async () => {
    const linkRes = await supertest(app)
      .post('/api/link-shares')
      .set('Cookie', [cookieUser1])
      .send({
        resourceType: 'file',
        resourceId: fileId,
        password: 'ReportPassword2026!',
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
      });

    expect(linkRes.status).toBe(201);
    const body = linkRes.body as { linkShare: { token: string } };
    publicToken = body.linkShare.token;

    // Public resolver succeeds with password
    const resolveRes = await supertest(app).get(`/api/link/${publicToken}?password=ReportPassword2026!`);
    expect(resolveRes.status).toBe(200);
  });

  it('Step 6: User 2 opens shared file, but is blocked from deleting or renaming (403)', async () => {
    // Read succeeds
    const fileRes = await supertest(app)
      .get(`/api/files/${fileId}`)
      .set('Cookie', [cookieUser2]);
    expect(fileRes.status).toBe(200);

    // Delete blocked
    const delRes = await supertest(app)
      .delete(`/api/files/${fileId}`)
      .set('Cookie', [cookieUser2]);
    expect(delRes.status).toBe(403);

    // Rename blocked
    const renRes = await supertest(app)
      .patch(`/api/files/${fileId}`)
      .set('Cookie', [cookieUser2])
      .send({ name: 'Hacked_Report.pdf' });
    expect(renRes.status).toBe(403);
  });

  it('Step 7: Search scoping: User 2 finds file, but User 3 (outsider) gets 0 results', async () => {
    const u2Search = await supertest(app)
      .get(`/api/search?q=financial_report_${ts}`)
      .set('Cookie', [cookieUser2]);
    expect(u2Search.status).toBe(200);
    const u2Files = (u2Search.body as { files: { id: string }[] }).files;
    expect(u2Files.some((f) => f.id === fileId)).toBe(true);

    const u3Search = await supertest(app)
      .get(`/api/search?q=financial_report_${ts}`)
      .set('Cookie', [cookieUser3]);
    expect(u3Search.status).toBe(200);
    const u3Files = (u3Search.body as { files: { id: string }[] }).files;
    expect(u3Files.length).toBe(0);
  });

  it('Step 8: User 1 deletes file to trash and restores it', async () => {
    // Delete file
    const delRes = await supertest(app)
      .delete(`/api/files/${fileId}`)
      .set('Cookie', [cookieUser1]);
    expect(delRes.status).toBe(200);

    // Verify in trash
    const trashRes = await supertest(app)
      .get('/api/trash')
      .set('Cookie', [cookieUser1]);
    expect(trashRes.status).toBe(200);
    const trashFiles = (trashRes.body as { files: { id: string }[] }).files;
    expect(trashFiles.some((f) => f.id === fileId)).toBe(true);

    // Restore file
    const restRes = await supertest(app)
      .post('/api/trash/restore')
      .set('Cookie', [cookieUser1])
      .send({ resourceType: 'file', resourceId: fileId });
    expect(restRes.status).toBe(200);

    // Verify active again
    const activeRes = await supertest(app)
      .get(`/api/files/${fileId}`)
      .set('Cookie', [cookieUser1]);
    expect(activeRes.status).toBe(200);
  });
});
