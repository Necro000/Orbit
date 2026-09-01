import crypto from 'node:crypto';
import path from 'node:path';

import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import express, { type Application } from 'express';
import supertest from 'supertest';
import { describe, it, expect, beforeAll } from 'vitest';

import { storageDevRouter } from '../lib/storage';
import { signAccessToken } from '../lib/tokens';
import filesRouter from './files';

dotenv.config({ path: path.join(__dirname, '../../../.env') });

function createTestApp(): Application {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/storage-dev', storageDevRouter);
  app.use('/api/files', filesRouter);
  return app;
}

const userAId = '33333333-3333-4333-a333-333333333333';
const userBId = '44444444-4444-4444-a444-444444444444';
const tokenUserA = signAccessToken(userAId);
const tokenUserB = signAccessToken(userBId);

interface FileTestResponse {
  file: {
    id: string;
    name: string;
    mime_type: string;
    size_bytes: string;
    status: string;
    checksum: string | null;
  };
  upload?: { uploadUrl: string; method: string };
  downloadUrl?: string;
  error?: { code: string; message: string };
  ok?: boolean;
}

/* eslint-disable max-lines-per-function */
describe('Files API (/api/files)', () => {
  const app = createTestApp();
  let uploadedFileId: string;
  const sampleContent = 'Orbit test file content — byte for byte verification ' + Date.now();
  const sampleChecksum = crypto.createHash('sha256').update(sampleContent).digest('hex');

  beforeAll(async () => {
    const { db } = await import('../db');
    await db.query(
      `INSERT INTO users (id, email, name, password_hash)
       VALUES ($1, $2, 'File User A', 'hash'), ($3, $4, 'File User B', 'hash')
       ON CONFLICT (id) DO NOTHING`,
      [userAId, `file.user.a.${Date.now()}@test.com`, userBId, `file.user.b.${Date.now()}@test.com`],
    );
  });

  it('initiates a file upload and receives presigned upload URL', async () => {
    const res = await supertest(app)
      .post('/api/files/init')
      .set('Cookie', [`orbit_access=${tokenUserA}`])
      .send({
        name: 'test-document.txt',
        mimeType: 'text/plain',
        sizeBytes: Buffer.byteLength(sampleContent),
      });

    expect(res.status).toBe(201);
    const body = res.body as FileTestResponse;
    expect(body.file.status).toBe('uploading');
    expect(body.upload?.uploadUrl).toBeDefined();
    uploadedFileId = body.file.id;

    // Direct byte upload to storage endpoint
    const url = new URL(body.upload!.uploadUrl);
    const storageRes = await supertest(app)
      .put(`${url.pathname}${url.search}`)
      .set('Content-Type', 'text/plain')
      .send(sampleContent);

    expect(storageRes.status).toBe(200);
  });

  it('completes the file upload and updates status to ready', async () => {
    const res = await supertest(app)
      .post('/api/files/complete')
      .set('Cookie', [`orbit_access=${tokenUserA}`])
      .send({ fileId: uploadedFileId, checksum: sampleChecksum });

    expect(res.status).toBe(200);
    const body = res.body as FileTestResponse;
    expect(body.file.status).toBe('ready');
    expect(body.file.checksum).toBe(sampleChecksum);
  });

  it('fetches signed download URL and verifies byte-for-byte checksum match', async () => {
    const res = await supertest(app)
      .get(`/api/files/${uploadedFileId}`)
      .set('Cookie', [`orbit_access=${tokenUserA}`]);

    expect(res.status).toBe(200);
    const body = res.body as FileTestResponse;
    expect(body.downloadUrl).toBeDefined();

    const url = new URL(body.downloadUrl!);
    const downloadRes = await supertest(app).get(`${url.pathname}${url.search}`);
    expect(downloadRes.status).toBe(200);
    expect(downloadRes.text).toBe(sampleContent);

    const downloadedChecksum = crypto.createHash('sha256').update(downloadRes.text).digest('hex');
    expect(downloadedChecksum).toBe(sampleChecksum);
  });

  it('renames a file', async () => {
    const res = await supertest(app)
      .patch(`/api/files/${uploadedFileId}`)
      .set('Cookie', [`orbit_access=${tokenUserA}`])
      .send({ name: 'renamed-doc.txt' });

    expect(res.status).toBe(200);
    const body = res.body as FileTestResponse;
    expect(body.file.name).toBe('renamed-doc.txt');
  });

  it('rejects disallowed executable MIME types', async () => {
    const res = await supertest(app)
      .post('/api/files/init')
      .set('Cookie', [`orbit_access=${tokenUserA}`])
      .send({
        name: 'malware.exe',
        mimeType: 'application/x-msdownload',
        sizeBytes: 1024,
      });

    expect(res.status).toBe(400);
    const body = res.body as FileTestResponse;
    expect(body.error?.code).toBe('VALIDATION_ERROR');
  });

  it('rejects path traversal filename attempts', async () => {
    const res = await supertest(app)
      .post('/api/files/init')
      .set('Cookie', [`orbit_access=${tokenUserA}`])
      .send({
        name: '../../etc/passwd',
        mimeType: 'text/plain',
        sizeBytes: 1024,
      });

    expect(res.status).toBe(400);
    const body = res.body as FileTestResponse;
    expect(body.error?.code).toBe('VALIDATION_ERROR');
  });

  it('prevents user B from accessing user A file', async () => {
    const res = await supertest(app)
      .get(`/api/files/${uploadedFileId}`)
      .set('Cookie', [`orbit_access=${tokenUserB}`]);

    expect(res.status).toBe(404);
  });

  it('soft deletes a file', async () => {
    const res = await supertest(app)
      .delete(`/api/files/${uploadedFileId}`)
      .set('Cookie', [`orbit_access=${tokenUserA}`]);

    expect(res.status).toBe(200);
    const body = res.body as FileTestResponse;
    expect(body.ok).toBe(true);

    const getRes = await supertest(app)
      .get(`/api/files/${uploadedFileId}`)
      .set('Cookie', [`orbit_access=${tokenUserA}`]);
    expect(getRes.status).toBe(404);
  });

  it('completes upload with 200 and stays up when preview worker throws an error', async () => {
    // 1. Init upload for a corrupted/mock file
    const initRes = await supertest(app)
      .post('/api/files/init')
      .set('Cookie', [`orbit_access=${tokenUserA}`])
      .send({
        name: 'corrupted-image.png',
        mimeType: 'image/png',
        sizeBytes: 30,
      });

    expect(initRes.status).toBe(201);
    const body = initRes.body as FileTestResponse;
    const fileId = body.file.id;

    // Upload corrupted non-image bytes to storage
    const url = new URL(body.upload!.uploadUrl);
    const uploadRes = await supertest(app)
      .put(`${url.pathname}${url.search}`)
      .set('Content-Type', 'image/png')
      .send('not-a-real-png-corrupted-data');
    expect(uploadRes.status).toBe(200);

    // 2. Call /complete — worker will attempt thumbnail generation and encounter invalid image format, but /complete must still return 200
    const completeRes = await supertest(app)
      .post('/api/files/complete')
      .set('Cookie', [`orbit_access=${tokenUserA}`])
      .send({ fileId });

    expect(completeRes.status).toBe(200);
    const completeBody = completeRes.body as FileTestResponse;
    expect(completeBody.file.status).toBe('ready');

    // 3. Confirm API process is alive and responsive
    const healthRes = await supertest(app)
      .get(`/api/files/${fileId}`)
      .set('Cookie', [`orbit_access=${tokenUserA}`]);
    expect(healthRes.status).toBe(200);
  });
});

