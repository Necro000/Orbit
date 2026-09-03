import crypto from 'node:crypto';

import type { Response, IRouter } from 'express';
import { Router } from 'express';
import sharp from 'sharp';
import type { ZodError } from 'zod';

import { db } from '../db';
import { resolveAccess } from '../lib/acl';
import { logActivity } from '../lib/activity';
import {
  findFileById,
  insertUploadingFile,
  type FileRecord,
} from '../lib/fileDb';
import {
  enqueuePreviewGeneration,
  enqueueVersionPruning,
} from '../lib/previewWorker';
import { checkStorageQuota } from '../lib/quota';
import { storage, buildStorageKey } from '../lib/storage';
import {
  listFileVersions,
  createFileVersionWithLock,
  revertFileVersionAtomic,
  VersionConflictError,
  VersionNotFoundError,
} from '../lib/versionDb';
import type { AuthenticatedRequest } from '../middleware/authenticate';
import { authenticate } from '../middleware/authenticate';
import { uploadInitRateLimiter } from '../middleware/rateLimiter';
import {
  initUploadSchema,
  completeUploadSchema,
  updateFileSchema,
  fileIdParamSchema,
  versionIdParamSchema,
  revertVersionSchema,
} from '../schemas/files';

const router: IRouter = Router();
router.use(authenticate);

function getErrorMessage(err?: ZodError | null): string {
  return err?.issues?.[0]?.message ?? 'Validation failed';
}

// POST /api/files/init — Initiate file upload (or new version of existing file)
router.post('/init', uploadInitRateLimiter, (req: AuthenticatedRequest, res: Response): void => {
  void (async () => {
    const parseRes = initUploadSchema.safeParse(req.body);
    if (!parseRes.success) {
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: getErrorMessage(parseRes.error) } });
      return;
    }
    const { name, mimeType, sizeBytes, folderId, fileId, checksum } = parseRes.data;
    const userId = req.user!.id;

    // Storage Quota Enforcement (10 GB free tier limit)
    const quota = await checkStorageQuota(userId, sizeBytes);
    if (!quota.allowed) {
      res.status(403).json({
        error: {
          code: 'QUOTA_EXCEEDED',
          message: 'Storage quota exceeded (10 GB). Please delete files or empty your Trash to free up space.',
        },
      });
      return;
    }

    // Case A: Uploading a new version of an existing file
    if (fileId) {
      const access = await resolveAccess(userId, 'file', fileId);
      if (!access.canRead) {
        res.status(404).json({ error: { code: 'FILE_NOT_FOUND', message: 'File not found.' } });
        return;
      }
      if (!access.canWrite) {
        res.status(403).json({ error: { code: 'FORBIDDEN', message: 'You do not have permission to modify this file.' } });
        return;
      }

      const existingFile = await findFileById(fileId);
      if (!existingFile) {
        res.status(404).json({ error: { code: 'FILE_NOT_FOUND', message: 'File not found.' } });
        return;
      }

      // Query latest version number to determine version N+1
      const maxRes = await db.query<{ max_version: number | null }>(
        `SELECT COALESCE(MAX(version_number), 1) AS max_version FROM file_versions WHERE file_id = $1`,
        [fileId],
      );
      const nextVersion = (maxRes.rows[0]?.max_version ?? 1) + 1;
      const storageKey = buildStorageKey(existingFile.owner_id, existingFile.folder_id, fileId, name, nextVersion);

      const upload = await storage.createUploadUrl(storageKey, mimeType, sizeBytes);
      res.status(201).json({ file: existingFile, upload, versionNumber: nextVersion });
      return;
    }

    // Case B: Creating a brand new file
    if (folderId) {
      const folderAccess = await resolveAccess(userId, 'folder', folderId);
      if (!folderAccess.canRead) {
        res.status(404).json({ error: { code: 'FOLDER_NOT_FOUND', message: 'Target folder not found.' } });
        return;
      }
      if (!folderAccess.canWrite) {
        res.status(403).json({ error: { code: 'FORBIDDEN', message: 'You do not have permission to upload to this folder.' } });
        return;
      }
    }

    const newFileId = crypto.randomUUID();
    const storageKey = buildStorageKey(userId, folderId, newFileId, name, 1);

    const file = await insertUploadingFile({
      name,
      mimeType,
      sizeBytes,
      storageKey,
      ownerId: userId,
      folderId: folderId ?? null,
      checksum,
    });

    const upload = await storage.createUploadUrl(storageKey, mimeType, sizeBytes);
    res.status(201).json({ file, upload, versionNumber: 1 });
  })();
});

// POST /api/files/complete — Finalize upload after direct-to-storage transfer
router.post('/complete', (req: AuthenticatedRequest, res: Response): void => {
  void (async () => {
    const parseRes = completeUploadSchema.safeParse(req.body);
    if (!parseRes.success) {
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: getErrorMessage(parseRes.error) } });
      return;
    }
    const { fileId, checksum } = parseRes.data;
    const userId = req.user!.id;

    const access = await resolveAccess(userId, 'file', fileId);
    if (!access.canRead) {
      res.status(404).json({ error: { code: 'FILE_NOT_FOUND', message: 'File not found.' } });
      return;
    }
    if (!access.canWrite) {
      res.status(403).json({ error: { code: 'FORBIDDEN', message: 'You do not have permission to modify this file.' } });
      return;
    }

    const file = await findFileById(fileId);
    if (!file) {
      res.status(404).json({ error: { code: 'FILE_NOT_FOUND', message: 'File not found.' } });
      return;
    }

    // Determine target storage key: for new files, use file.storage_key; for new versions, check latest version + 1
    let targetStorageKey = file.storage_key;
    if (file.status === 'ready') {
      const maxRes = await db.query<{ max_version: number | null }>(
        `SELECT COALESCE(MAX(version_number), 1) AS max_version FROM file_versions WHERE file_id = $1`,
        [fileId],
      );
      const nextVersion = (maxRes.rows[0]?.max_version ?? 1) + 1;
      targetStorageKey = buildStorageKey(file.owner_id, file.folder_id, file.id, file.name, nextVersion);
    }

    const verification = await storage.verifyObject(targetStorageKey);
    if (!verification.exists || verification.sizeBytes === 0) {
      res.status(400).json({ error: { code: 'UPLOAD_NOT_FOUND', message: 'Storage object was not found or is empty.' } });
      return;
    }

    const client = await db.connect();
    let readyFile: FileRecord;
    let isNewVersion = false;

    try {
      await client.query('BEGIN');
      const result = await createFileVersionWithLock(
        client,
        fileId,
        targetStorageKey,
        verification.sizeBytes,
        checksum || verification.checksum,
      );
      await client.query('COMMIT');
      readyFile = result.file;
      isNewVersion = result.isNewVersion;
    } catch (dbErr) {
      await client.query('ROLLBACK');
      console.error('Error completing file upload:', dbErr);
      res.status(500).json({ error: { code: 'DATABASE_ERROR', message: 'Failed to record file version.' } });
      return;
    } finally {
      client.release();
    }

    const action = isNewVersion ? 'upload_version' : 'upload';
    await logActivity(userId, action, 'file', fileId, { name: readyFile.name, sizeBytes: readyFile.size_bytes });

    void enqueuePreviewGeneration({
      fileId: readyFile.id,
      storageKey: readyFile.storage_key,
      mimeType: readyFile.mime_type,
      name: readyFile.name,
    });

    if (isNewVersion) {
      void enqueueVersionPruning({ fileId });
    }

    res.json({ file: readyFile });
  })();
});

// GET /api/files/:id — Get file metadata and signed download URL
router.get('/:id', (req: AuthenticatedRequest, res: Response): void => {
  void (async () => {
    const paramRes = fileIdParamSchema.safeParse(req.params);
    if (!paramRes.success) {
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: getErrorMessage(paramRes.error) } });
      return;
    }
    const fileId = paramRes.data.id;
    const userId = req.user!.id;

    const access = await resolveAccess(userId, 'file', fileId);
    if (!access.canRead) {
      res.status(404).json({ error: { code: 'FILE_NOT_FOUND', message: 'File not found or access denied.' } });
      return;
    }

    const file = await findFileById(fileId);
    if (!file || file.status !== 'ready') {
      res.status(404).json({ error: { code: 'FILE_NOT_FOUND', message: 'File not found or not ready.' } });
      return;
    }

    const downloadUrl = await storage.createDownloadUrl(file.storage_key, file.name);
    const streamUrl = await storage.createDownloadUrl(file.storage_key, file.name, 900, true);
    await logActivity(userId, 'download', 'file', fileId, { name: file.name });
    res.json({ file: { ...file, role: access.role }, downloadUrl, streamUrl });
  })();
});

// GET /api/files/:id/versions — List version history for a file
router.get('/:id/versions', (req: AuthenticatedRequest, res: Response): void => {
  void (async () => {
    const paramRes = fileIdParamSchema.safeParse(req.params);
    if (!paramRes.success) {
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: getErrorMessage(paramRes.error) } });
      return;
    }
    const fileId = paramRes.data.id;
    const userId = req.user!.id;

    const access = await resolveAccess(userId, 'file', fileId);
    if (!access.canRead) {
      res.status(404).json({ error: { code: 'FILE_NOT_FOUND', message: 'File not found or access denied.' } });
      return;
    }

    const file = await findFileById(fileId);
    if (!file || file.status !== 'ready') {
      res.status(404).json({ error: { code: 'FILE_NOT_FOUND', message: 'File not found or not ready.' } });
      return;
    }

    const versionRows = await listFileVersions(fileId);
    const versions = versionRows.map((v) => ({
      id: v.id,
      fileId: v.file_id,
      versionNumber: v.version_number,
      sizeBytes: v.size_bytes,
      checksum: v.checksum,
      createdAt: v.created_at,
      isCurrent: v.id === file.version_id,
    }));

    res.json({ versions, currentVersionId: file.version_id });
  })();
});

// POST /api/files/:id/versions/:versionId/revert — Revert file to specified version
router.post('/:id/versions/:versionId/revert', (req: AuthenticatedRequest, res: Response): void => {
  void (async () => {
    const paramRes = versionIdParamSchema.safeParse(req.params);
    const bodyRes = revertVersionSchema.safeParse(req.body);

    if (!paramRes.success || !bodyRes.success) {
      const err = !paramRes.success ? paramRes.error : bodyRes.error;
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: getErrorMessage(err) } });
      return;
    }

    const { id: fileId, versionId } = paramRes.data;
    const { expectedCurrentVersionId } = bodyRes.data;
    const userId = req.user!.id;

    const access = await resolveAccess(userId, 'file', fileId);
    if (!access.canRead) {
      res.status(404).json({ error: { code: 'FILE_NOT_FOUND', message: 'File not found.' } });
      return;
    }
    if (!access.canWrite) {
      res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Only owners and editors can revert file versions.' } });
      return;
    }

    try {
      const result = await revertFileVersionAtomic(fileId, versionId, expectedCurrentVersionId);
      await logActivity(userId, 'revert_version', 'file', fileId, {
        revertedToVersionNumber: result.revertedVersion.version_number,
        versionId: result.revertedVersion.id,
      });

      res.json({
        file: result.file,
        revertedVersion: {
          id: result.revertedVersion.id,
          versionNumber: result.revertedVersion.version_number,
          sizeBytes: result.revertedVersion.size_bytes,
          createdAt: result.revertedVersion.created_at,
        },
      });
    } catch (err) {
      if (err instanceof VersionConflictError) {
        res.status(409).json({
          error: {
            code: 'VERSION_CONFLICT',
            message: err.message,
          },
        });
        return;
      }
      if (err instanceof VersionNotFoundError) {
        res.status(404).json({
          error: {
            code: 'VERSION_NOT_FOUND',
            message: err.message,
          },
        });
        return;
      }
      console.error('Error reverting file version:', err);
      res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to revert file version.' } });
    }
  })();
});

// GET /api/files/:id/preview — Get file thumbnail preview or stream preview image
router.get('/:id/preview', (req: AuthenticatedRequest, res: Response): void => {
  void (async () => {
    const paramRes = fileIdParamSchema.safeParse(req.params);
    if (!paramRes.success) {
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: getErrorMessage(paramRes.error) } });
      return;
    }
    const fileId = paramRes.data.id;
    const userId = req.user!.id;

    // Single source of truth ACL verification from Phase 3
    const access = await resolveAccess(userId, 'file', fileId);
    if (!access.canRead) {
      res.status(404).json({ error: { code: 'FILE_NOT_FOUND', message: 'File not found or access denied.' } });
      return;
    }

    const file = await findFileById(fileId);
    if (!file || file.status !== 'ready') {
      res.status(404).json({ error: { code: 'FILE_NOT_FOUND', message: 'File not found or not ready.' } });
      return;
    }

    const previewKey = `previews/${file.storage_key}.jpg`;

    if (req.query?.['format'] === 'json') {
      const previewVerification = await storage.verifyObject(previewKey);
      if (!previewVerification.exists) {
        res.status(404).json({ error: { code: 'PREVIEW_NOT_FOUND', message: 'Preview thumbnail not generated or not available.' } });
        return;
      }
      const previewUrl = await storage.createDownloadUrl(previewKey, `${file.name}-thumb.jpg`);
      res.json({ previewUrl });
      return;
    }

    // Direct image streaming mode for <img> tags
    try {
      const previewVerification = await storage.verifyObject(previewKey);
      let imageBuffer: Buffer;

      if (previewVerification.exists) {
        imageBuffer = await storage.getObject(previewKey);
      } else if (file.mime_type.startsWith('image/')) {
        const rawBuffer = await storage.getObject(file.storage_key);
        imageBuffer = await sharp(rawBuffer)
          .resize(200, 200, { fit: 'cover', withoutEnlargement: false })
          .jpeg({ quality: 80 })
          .toBuffer();
        await storage.saveObjectDirect(previewKey, imageBuffer, 'image/jpeg');
      } else {
        res.status(404).json({ error: { code: 'PREVIEW_NOT_FOUND', message: 'Preview thumbnail not available.' } });
        return;
      }

      res.setHeader('Content-Type', 'image/jpeg');
      res.setHeader('Cache-Control', 'public, max-age=86400');
      res.send(imageBuffer);
    } catch (err) {
      console.warn(`[files/preview] Failed to generate or serve preview for ${fileId}:`, err);
      res.status(404).json({ error: { code: 'PREVIEW_NOT_FOUND', message: 'Preview thumbnail not available.' } });
    }
  })();
});

// PATCH /api/files/:id — Rename or move file
router.patch('/:id', (req: AuthenticatedRequest, res: Response): void => {
  void (async () => {
    const paramRes = fileIdParamSchema.safeParse(req.params);
    const bodyRes = updateFileSchema.safeParse(req.body);
    if (!paramRes.success || !bodyRes.success) {
      const err = !paramRes.success ? paramRes.error : bodyRes.error;
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: getErrorMessage(err) } });
      return;
    }
    const fileId = paramRes.data.id;
    const userId = req.user!.id;

    const access = await resolveAccess(userId, 'file', fileId);
    if (!access.canRead) {
      res.status(404).json({ error: { code: 'FILE_NOT_FOUND', message: 'File not found.' } });
      return;
    }
    if (!access.isOwner) {
      res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Only the file owner can rename or move it.' } });
      return;
    }

    const existing = await findFileById(fileId);
    if (!existing) {
      res.status(404).json({ error: { code: 'FILE_NOT_FOUND', message: 'File not found.' } });
      return;
    }

    const { name, folderId } = bodyRes.data;
    if (folderId !== undefined && folderId !== null) {
      const targetAccess = await resolveAccess(userId, 'folder', folderId);
      if (!targetAccess.canRead) {
        res.status(404).json({ error: { code: 'FOLDER_NOT_FOUND', message: 'Destination folder not found.' } });
        return;
      }
      if (!targetAccess.canWrite) {
        res.status(403).json({ error: { code: 'FORBIDDEN', message: 'You do not have write permission in the destination folder.' } });
        return;
      }
    }

    const newFolderId = folderId !== undefined ? folderId : existing.folder_id;
    const result = await db.query<FileRecord>(
      'UPDATE files SET name = $1, folder_id = $2, updated_at = NOW() WHERE id = $3 RETURNING *',
      [name ?? existing.name, newFolderId, fileId],
    );
    const action = name && name !== existing.name ? 'rename' : 'move';
    await logActivity(userId, action, 'file', fileId, { oldName: existing.name, newName: name, newFolderId });
    res.json({ file: result.rows[0] });
  })();
});

// DELETE /api/files/:id — Soft-delete file
router.delete('/:id', (req: AuthenticatedRequest, res: Response): void => {
  void (async () => {
    const paramRes = fileIdParamSchema.safeParse(req.params);
    if (!paramRes.success) {
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: getErrorMessage(paramRes.error) } });
      return;
    }
    const fileId = paramRes.data.id;
    const userId = req.user!.id;

    const access = await resolveAccess(userId, 'file', fileId);
    if (!access.canRead) {
      res.status(404).json({ error: { code: 'FILE_NOT_FOUND', message: 'File not found.' } });
      return;
    }
    if (!access.isOwner) {
      res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Only the file owner can delete it.' } });
      return;
    }

    const existing = await findFileById(fileId);
    if (!existing) {
      res.status(404).json({ error: { code: 'FILE_NOT_FOUND', message: 'File not found.' } });
      return;
    }

    await db.query(
      'UPDATE files SET is_deleted = true, updated_at = NOW() WHERE id = $1',
      [fileId],
    );
    await logActivity(userId, 'delete', 'file', fileId, { name: existing.name });
    res.json({ ok: true, deletedFileId: fileId });
  })();
});

export default router;
