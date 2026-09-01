import crypto from 'node:crypto';
import path from 'node:path';

import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import express, { type Application } from 'express';
import supertest from 'supertest';
import { describe, it, expect, beforeAll } from 'vitest';

import { storageDevRouter, storage } from '../lib/storage';
import { signAccessToken } from '../lib/tokens';
import { pruneOldVersions, listFileVersions } from '../lib/versionDb';
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

const ownerId = '55555555-5555-4555-a555-555555555555';
const editorId = '66666666-6666-4666-a666-666666666666';
const viewerId = '77777777-7777-4777-a777-777777777777';
const outsiderId = '88888888-8888-4888-a888-888888888888';

const tokenOwner = signAccessToken(ownerId);
const tokenEditor = signAccessToken(editorId);
const tokenViewer = signAccessToken(viewerId);
const tokenOutsider = signAccessToken(outsiderId);

interface VersionItem {
  id: string;
  versionNumber: number;
  sizeBytes: string;
  isCurrent: boolean;
  checksum: string | null;
}

/* eslint-disable max-lines-per-function */
describe('File Version History API (Phase 5a)', () => {
  const app = createTestApp();
  let testFileId: string;
  let version1Id: string;
  let version2Id: string;

  const contentV1 = 'Orbit Document Version 1 Content — ' + Date.now();
  const checksumV1 = crypto.createHash('sha256').update(contentV1).digest('hex');

  const contentV2 = 'Orbit Document Version 2 Updated Content — ' + Date.now();
  const checksumV2 = crypto.createHash('sha256').update(contentV2).digest('hex');

  beforeAll(async () => {
    const { db } = await import('../db');
    // Ensure test users exist
    await db.query(
      `INSERT INTO users (id, email, name, password_hash)
       VALUES ($1, $2, 'Version Owner', 'hash'),
              ($3, $4, 'Version Editor', 'hash'),
              ($5, $6, 'Version Viewer', 'hash'),
              ($7, $8, 'Version Outsider', 'hash')
       ON CONFLICT (id) DO NOTHING`,
      [
        ownerId, `ver.owner.${Date.now()}@test.com`,
        editorId, `ver.editor.${Date.now()}@test.com`,
        viewerId, `ver.viewer.${Date.now()}@test.com`,
        outsiderId, `ver.outsider.${Date.now()}@test.com`,
      ],
    );
  });

  it('uploads initial file (Version 1) and creates file_versions row', async () => {
    // 1. Init upload
    const initRes = await supertest(app)
      .post('/api/files/init')
      .set('Cookie', [`orbit_access=${tokenOwner}`])
      .send({
        name: 'versioned-doc.txt',
        mimeType: 'text/plain',
        sizeBytes: Buffer.byteLength(contentV1),
      });

    expect(initRes.status).toBe(201);
    testFileId = (initRes.body as { file: { id: string } }).file.id;
    const uploadUrl = (initRes.body as { upload: { uploadUrl: string } }).upload.uploadUrl;

    // 2. Put bytes directly to storage
    const u = new URL(uploadUrl);
    const putRes = await supertest(app)
      .put(`${u.pathname}${u.search}`)
      .set('Content-Type', 'text/plain')
      .send(contentV1);
    expect(putRes.status).toBe(200);

    // 3. Complete upload
    const completeRes = await supertest(app)
      .post('/api/files/complete')
      .set('Cookie', [`orbit_access=${tokenOwner}`])
      .send({ fileId: testFileId, checksum: checksumV1 });

    expect(completeRes.status).toBe(200);
    const file = (completeRes.body as { file: { version_id: string } }).file;
    expect(file.version_id).toBeDefined();

    // 4. List versions
    const listRes = await supertest(app)
      .get(`/api/files/${testFileId}/versions`)
      .set('Cookie', [`orbit_access=${tokenOwner}`]);

    expect(listRes.status).toBe(200);
    const body = listRes.body as { versions: VersionItem[]; currentVersionId: string };
    expect(body.versions.length).toBe(1);
    expect(body.versions[0]?.versionNumber).toBe(1);
    expect(body.versions[0]?.isCurrent).toBe(true);
    version1Id = body.versions[0]!.id;

    // Share with editor and viewer for subsequent ACL tests
    const { db } = await import('../db');
    await db.query(
      `INSERT INTO shares (resource_type, resource_id, grantee_user_id, role, created_by)
       VALUES ('file', $1, $2, 'editor', $3), ('file', $1, $4, 'viewer', $3)
       ON CONFLICT (resource_type, resource_id, grantee_user_id) DO NOTHING`,
      [testFileId, editorId, ownerId, viewerId],
    );
  });

  it('uploads Version 2 using fileId, updating files.version_id to the newest version', async () => {
    // 1. Init new version upload
    const initRes = await supertest(app)
      .post('/api/files/init')
      .set('Cookie', [`orbit_access=${tokenOwner}`])
      .send({
        fileId: testFileId,
        name: 'versioned-doc.txt',
        mimeType: 'text/plain',
        sizeBytes: Buffer.byteLength(contentV2),
      });

    expect(initRes.status).toBe(201);
    const uploadUrl = (initRes.body as { upload: { uploadUrl: string } }).upload.uploadUrl;
    expect(uploadUrl).toContain('-v2-');

    // 2. Put bytes directly to storage
    const u = new URL(uploadUrl);
    const putRes = await supertest(app)
      .put(`${u.pathname}${u.search}`)
      .set('Content-Type', 'text/plain')
      .send(contentV2);
    expect(putRes.status).toBe(200);

    // 3. Complete new version
    const completeRes = await supertest(app)
      .post('/api/files/complete')
      .set('Cookie', [`orbit_access=${tokenOwner}`])
      .send({ fileId: testFileId, checksum: checksumV2 });

    expect(completeRes.status).toBe(200);

    // 4. Verify version history has 2 versions with Version 2 marked current
    const listRes = await supertest(app)
      .get(`/api/files/${testFileId}/versions`)
      .set('Cookie', [`orbit_access=${tokenOwner}`]);

    expect(listRes.status).toBe(200);
    const body = listRes.body as { versions: VersionItem[]; currentVersionId: string };
    expect(body.versions.length).toBe(2);
    expect(body.versions[0]?.versionNumber).toBe(2);
    expect(body.versions[0]?.isCurrent).toBe(true);
    expect(body.versions[1]?.versionNumber).toBe(1);
    expect(body.versions[1]?.isCurrent).toBe(false);
    version2Id = body.versions[0]!.id;
  });

  it('atomically reverts to Version 1, verifying checksum and downloaded content match V1', async () => {
    const revertRes = await supertest(app)
      .post(`/api/files/${testFileId}/versions/${version1Id}/revert`)
      .set('Cookie', [`orbit_access=${tokenOwner}`])
      .send({ expectedCurrentVersionId: version2Id });

    expect(revertRes.status).toBe(200);
    const file = (revertRes.body as { file: { version_id: string } }).file;
    expect(file.version_id).toBe(version1Id);

    // Download file and verify content is byte-for-byte identical to V1
    const fileRes = await supertest(app)
      .get(`/api/files/${testFileId}`)
      .set('Cookie', [`orbit_access=${tokenOwner}`]);
    expect(fileRes.status).toBe(200);
    const downloadUrl = (fileRes.body as { downloadUrl: string }).downloadUrl;

    const u = new URL(downloadUrl);
    const dlRes = await supertest(app).get(`${u.pathname}${u.search}`);
    expect(dlRes.status).toBe(200);
    expect(dlRes.text).toBe(contentV1);
  });

  it('rejects stale revert requests with 409 VERSION_CONFLICT when expectedCurrentVersionId does not match', async () => {
    // Current version is now Version 1; passing stale expectedCurrentVersionId (version2Id) must return 409
    const conflictRes = await supertest(app)
      .post(`/api/files/${testFileId}/versions/${version2Id}/revert`)
      .set('Cookie', [`orbit_access=${tokenOwner}`])
      .send({ expectedCurrentVersionId: version2Id }); // Out of sync

    expect(conflictRes.status).toBe(409);
    const body = conflictRes.body as { error: { code: string; message: string } };
    expect(body.error.code).toBe('VERSION_CONFLICT');
  });

  it('enforces role permissions: Editor can revert, Viewer and Outsider are blocked', async () => {
    // 1. Editor can revert to version 2
    const editorRevert = await supertest(app)
      .post(`/api/files/${testFileId}/versions/${version2Id}/revert`)
      .set('Cookie', [`orbit_access=${tokenEditor}`])
      .send({ expectedCurrentVersionId: version1Id });
    expect(editorRevert.status).toBe(200);

    // 2. Viewer can view version history
    const viewerList = await supertest(app)
      .get(`/api/files/${testFileId}/versions`)
      .set('Cookie', [`orbit_access=${tokenViewer}`]);
    expect(viewerList.status).toBe(200);

    // 3. Viewer is blocked (403) from reverting
    const viewerRevert = await supertest(app)
      .post(`/api/files/${testFileId}/versions/${version1Id}/revert`)
      .set('Cookie', [`orbit_access=${tokenViewer}`]);
    expect(viewerRevert.status).toBe(403);

    // 4. Viewer is blocked (403) from initializing a new version upload
    const viewerInit = await supertest(app)
      .post('/api/files/init')
      .set('Cookie', [`orbit_access=${tokenViewer}`])
      .send({
        fileId: testFileId,
        name: 'versioned-doc.txt',
        mimeType: 'text/plain',
        sizeBytes: 100,
      });
    expect(viewerInit.status).toBe(403);

    // 5. Outsider receives 404 on both version listing and revert
    const outsiderList = await supertest(app)
      .get(`/api/files/${testFileId}/versions`)
      .set('Cookie', [`orbit_access=${tokenOutsider}`]);
    expect(outsiderList.status).toBe(404);

    const outsiderRevert = await supertest(app)
      .post(`/api/files/${testFileId}/versions/${version1Id}/revert`)
      .set('Cookie', [`orbit_access=${tokenOutsider}`]);
    expect(outsiderRevert.status).toBe(404);
  });

  it('returns clean 404 when attempting to revert to a non-existent or pruned version', async () => {
    const fakeVersionId = crypto.randomUUID();
    const res = await supertest(app)
      .post(`/api/files/${testFileId}/versions/${fakeVersionId}/revert`)
      .set('Cookie', [`orbit_access=${tokenOwner}`]);

    expect(res.status).toBe(404);
    const body = res.body as { error: { code: string } };
    expect(body.error.code).toBe('VERSION_NOT_FOUND');
  });

  it('enforces retention policy: prunes versions exceeding 10 from DB and storage', async () => {
    const { db } = await import('../db');

    // Create 12 fake version records in file_versions for a test file
    const pruneTestFileId = crypto.randomUUID();
    const storageKeyBase = `tenants/${ownerId}/folders/root/files/${pruneTestFileId}`;
    
    await db.query(
      `INSERT INTO files (id, name, mime_type, size_bytes, storage_key, owner_id, status)
       VALUES ($1, 'retention-test.txt', 'text/plain', 100, $2, $3, 'ready')`,
      [pruneTestFileId, `${storageKeyBase}-v12.txt`, ownerId],
    );

    // Create 12 versions in DB & storage
    for (let i = 1; i <= 12; i++) {
      const verKey = `${storageKeyBase}-v${i}.txt`;
      await storage.saveObjectDirect(verKey, Buffer.from(`Version ${i} Data`), 'text/plain');
      const verRes = await db.query<{ id: string }>(
        `INSERT INTO file_versions (file_id, version_number, storage_key, size_bytes, created_at)
         VALUES ($1, $2, $3, 100, NOW() - ($4 || ' hours')::interval)
         RETURNING id`,
        [pruneTestFileId, i, verKey, (13 - i)],
      );
      if (i === 12) {
        await db.query(`UPDATE files SET version_id = $1 WHERE id = $2`, [verRes.rows[0]!.id, pruneTestFileId]);
      }
    }

    // Run pruning with max 10
    const deletedCount = await pruneOldVersions(pruneTestFileId, 10);
    expect(deletedCount).toBe(2); // versions 1 and 2 pruned

    // Verify only 10 versions remain in DB
    const remaining = await listFileVersions(pruneTestFileId);
    expect(remaining.length).toBe(10);
    expect(remaining.some((v) => v.version_number === 1)).toBe(false);
    expect(remaining.some((v) => v.version_number === 2)).toBe(false);
    expect(remaining.some((v) => v.version_number === 12)).toBe(true);

    // Verify storage object for pruned version 1 was deleted
    const v1Check = await storage.verifyObject(`${storageKeyBase}-v1.txt`);
    expect(v1Check.exists).toBe(false);

    // Verify active version 12 still exists in storage
    const v12Check = await storage.verifyObject(`${storageKeyBase}-v12.txt`);
    expect(v12Check.exists).toBe(true);
  });

  it('verifies migration backfill logic: pre-Phase-5 files receive valid version 1 and non-null version_id', async () => {
    const { db } = await import('../db');
    const legacyFileId = crypto.randomUUID();
    const legacyStorageKey = `tenants/${ownerId}/folders/root/files/${legacyFileId}-legacy.txt`;

    // Seed a legacy file with version_id = NULL
    await db.query(
      `INSERT INTO files (id, name, mime_type, size_bytes, storage_key, owner_id, version_id, status)
       VALUES ($1, 'legacy-doc.txt', 'text/plain', 500, $2, $3, NULL, 'ready')`,
      [legacyFileId, legacyStorageKey, ownerId],
    );

    // Execute backfill query
    await db.query(`
      WITH inserted_versions AS (
        INSERT INTO file_versions (file_id, version_number, storage_key, size_bytes, checksum, created_at)
        SELECT id, 1, storage_key, size_bytes, checksum, created_at
        FROM files
        WHERE version_id IS NULL AND status = 'ready'
        ON CONFLICT (file_id, version_number) DO NOTHING
        RETURNING id, file_id
      )
      UPDATE files f
      SET version_id = iv.id
      FROM inserted_versions iv
      WHERE f.id = iv.file_id;
    `);

    // Verify file now has non-null version_id
    const fileRes = await db.query<{ version_id: string | null }>(
      `SELECT version_id FROM files WHERE id = $1`,
      [legacyFileId],
    );
    expect(fileRes.rows[0]?.version_id).not.toBeNull();

    // Verify file_versions row exists with version_number 1
    const verRes = await db.query<{ version_number: number; storage_key: string }>(
      `SELECT version_number, storage_key FROM file_versions WHERE file_id = $1`,
      [legacyFileId],
    );
    expect(verRes.rows.length).toBe(1);
    expect(verRes.rows[0]?.version_number).toBe(1);
    expect(verRes.rows[0]?.storage_key).toBe(legacyStorageKey);
  });
});
