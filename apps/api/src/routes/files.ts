import crypto from 'node:crypto';

import type { Response, IRouter } from 'express';
import { Router } from 'express';
import type { ZodError } from 'zod';

import { db } from '../db';
import {
  findFileById,
  insertUploadingFile,
  finalizeFileStatus,
  type FileRecord,
} from '../lib/fileDb';
import { findFolderById } from '../lib/folderDb';
import { storage, buildStorageKey } from '../lib/storage';
import type { AuthenticatedRequest } from '../middleware/authenticate';
import { authenticate } from '../middleware/authenticate';
import {
  initUploadSchema,
  completeUploadSchema,
  updateFileSchema,
  fileIdParamSchema,
} from '../schemas/files';

const router: IRouter = Router();
router.use(authenticate);

function getErrorMessage(err?: ZodError | null): string {
  return err?.issues?.[0]?.message ?? 'Validation failed';
}

// POST /api/files/init — Initiate file upload
router.post('/init', (req: AuthenticatedRequest, res: Response): void => {
  void (async () => {
    const parseRes = initUploadSchema.safeParse(req.body);
    if (!parseRes.success) {
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: getErrorMessage(parseRes.error) } });
      return;
    }
    const { name, mimeType, sizeBytes, folderId, checksum } = parseRes.data;
    const ownerId = req.user!.id;

    if (folderId) {
      const parent = await findFolderById(folderId, ownerId);
      if (!parent) {
        res.status(404).json({ error: { code: 'FOLDER_NOT_FOUND', message: 'Target folder not found.' } });
        return;
      }
    }

    const fileId = crypto.randomUUID();
    const storageKey = buildStorageKey(ownerId, folderId, fileId, name);

    const file = await insertUploadingFile({
      name,
      mimeType,
      sizeBytes,
      storageKey,
      ownerId,
      folderId: folderId ?? null,
      checksum,
    });

    const upload = await storage.createUploadUrl(storageKey, mimeType, sizeBytes);
    res.status(201).json({ file, upload });
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
    const ownerId = req.user!.id;

    const file = await findFileById(fileId, ownerId);
    if (!file) {
      res.status(404).json({ error: { code: 'FILE_NOT_FOUND', message: 'File not found.' } });
      return;
    }

    const verification = await storage.verifyObject(file.storage_key);
    if (!verification.exists || verification.sizeBytes === 0) {
      res.status(400).json({ error: { code: 'UPLOAD_NOT_FOUND', message: 'Storage object was not found or is empty.' } });
      return;
    }

    const readyFile = await finalizeFileStatus(
      fileId,
      ownerId,
      verification.sizeBytes,
      checksum || verification.checksum,
    );
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
    const file = await findFileById(paramRes.data.id, req.user!.id);
    if (!file || file.status !== 'ready') {
      res.status(404).json({ error: { code: 'FILE_NOT_FOUND', message: 'File not found or not ready.' } });
      return;
    }

    const downloadUrl = await storage.createDownloadUrl(file.storage_key, file.name);
    res.json({ file, downloadUrl });
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
    const ownerId = req.user!.id;

    const existing = await findFileById(fileId, ownerId);
    if (!existing) {
      res.status(404).json({ error: { code: 'FILE_NOT_FOUND', message: 'File not found.' } });
      return;
    }

    const { name, folderId } = bodyRes.data;
    if (folderId !== undefined && folderId !== null) {
      const targetFolder = await findFolderById(folderId, ownerId);
      if (!targetFolder) {
        res.status(404).json({ error: { code: 'FOLDER_NOT_FOUND', message: 'Destination folder not found.' } });
        return;
      }
    }

    const newFolderId = folderId !== undefined ? folderId : existing.folder_id;
    const result = await db.query<FileRecord>(
      'UPDATE files SET name = $1, folder_id = $2, updated_at = NOW() WHERE id = $3 AND owner_id = $4 RETURNING *',
      [name ?? existing.name, newFolderId, fileId, ownerId],
    );
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
    const ownerId = req.user!.id;

    const existing = await findFileById(fileId, ownerId);
    if (!existing) {
      res.status(404).json({ error: { code: 'FILE_NOT_FOUND', message: 'File not found.' } });
      return;
    }

    await db.query(
      'UPDATE files SET is_deleted = true, updated_at = NOW() WHERE id = $1 AND owner_id = $2',
      [fileId, ownerId],
    );
    res.json({ ok: true, deletedFileId: fileId });
  })();
});

export default router;
