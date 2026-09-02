import type { Response, IRouter } from 'express';
import { Router } from 'express';
import type { ZodError } from 'zod';

import { db } from '../db';
import { logActivity } from '../lib/activity';
import type { FileRecord } from '../lib/fileDb';
import type { FolderRow } from '../lib/folderDb';
import type { AuthenticatedRequest } from '../middleware/authenticate';
import { authenticate } from '../middleware/authenticate';
import { deleteTrashItemSchema, restoreItemSchema } from '../schemas/trash';
import { storage } from '../lib/storage';

const router: IRouter = Router();
router.use(authenticate);

function getErrorMessage(err?: ZodError | null): string {
  return err?.issues?.[0]?.message ?? 'Validation failed';
}

const RETENTION_DAYS = 30;

// GET /api/trash — List soft-deleted items owned by caller
router.get('/', (req: AuthenticatedRequest, res: Response): void => {
  void (async () => {
    const userId = req.user!.id;

    const foldersQuery = `
      SELECT id, name, owner_id, parent_id, created_at, updated_at
      FROM folders
      WHERE owner_id = $1 AND is_deleted = true AND updated_at >= NOW() - make_interval(days => $2)
      ORDER BY updated_at DESC;
    `;
    const foldersRes = await db.query<FolderRow>(foldersQuery, [userId, RETENTION_DAYS]);

    const filesQuery = `
      SELECT id, name, mime_type, size_bytes, checksum, status, owner_id, folder_id, created_at, updated_at
      FROM files
      WHERE owner_id = $1 AND is_deleted = true AND updated_at >= NOW() - make_interval(days => $2)
      ORDER BY updated_at DESC;
    `;
    const filesRes = await db.query<FileRecord>(filesQuery, [userId, RETENTION_DAYS]);

    res.json({ folders: foldersRes.rows, files: filesRes.rows });
  })();
});

// POST /api/trash/restore — Restore a soft-deleted item
router.post('/restore', (req: AuthenticatedRequest, res: Response): void => {
  void (async () => {
    const parseRes = restoreItemSchema.safeParse(req.body);
    if (!parseRes.success) {
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: getErrorMessage(parseRes.error) } });
      return;
    }
    const { resourceType, resourceId } = parseRes.data;
    const userId = req.user!.id;

    if (resourceType === 'folder') {
      const folderRes = await db.query<FolderRow>(
        'SELECT * FROM folders WHERE id = $1 AND owner_id = $2 AND is_deleted = true',
        [resourceId, userId],
      );
      const folder = folderRes.rows[0];
      if (!folder) {
        res.status(404).json({ error: { code: 'NOT_FOUND_IN_TRASH', message: 'Folder not found in trash.' } });
        return;
      }

      // Check retention window
      const ageMs = Date.now() - new Date(folder.updated_at).getTime();
      if (ageMs > RETENTION_DAYS * 24 * 60 * 60 * 1000) {
        res.status(410).json({ error: { code: 'RETENTION_EXPIRED', message: 'Item retention window has expired.' } });
        return;
      }

      // Orphan check: If parent was deleted or missing, place restored folder at root
      let newParentId = folder.parent_id;
      if (folder.parent_id) {
        const parentRes = await db.query<FolderRow>(
          'SELECT id FROM folders WHERE id = $1 AND owner_id = $2 AND is_deleted = false',
          [folder.parent_id, userId],
        );
        if (!parentRes.rows[0]) {
          newParentId = null;
        }
      }

      const updated = await db.query<FolderRow>(
        'UPDATE folders SET is_deleted = false, parent_id = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
        [newParentId, resourceId],
      );

      await logActivity(userId, 'restore', 'folder', resourceId, { name: folder.name, parentId: newParentId });
      res.json({ ok: true, resourceType: 'folder', folder: updated.rows[0] });
      return;
    }

    // Resource is file
    const fileRes = await db.query<FileRecord>(
      'SELECT * FROM files WHERE id = $1 AND owner_id = $2 AND is_deleted = true',
      [resourceId, userId],
    );
    const file = fileRes.rows[0];
    if (!file) {
      res.status(404).json({ error: { code: 'NOT_FOUND_IN_TRASH', message: 'File not found in trash.' } });
      return;
    }

    const ageMs = Date.now() - new Date(file.updated_at).getTime();
    if (ageMs > RETENTION_DAYS * 24 * 60 * 60 * 1000) {
      res.status(410).json({ error: { code: 'RETENTION_EXPIRED', message: 'Item retention window has expired.' } });
      return;
    }

    // Orphan check: If parent folder was deleted or missing, place file at root
    let newFolderId = file.folder_id;
    if (file.folder_id) {
      const parentRes = await db.query<FolderRow>(
        'SELECT id FROM folders WHERE id = $1 AND owner_id = $2 AND is_deleted = false',
        [file.folder_id, userId],
      );
      if (!parentRes.rows[0]) {
        newFolderId = null;
      }
    }

    const updated = await db.query<FileRecord>(
      'UPDATE files SET is_deleted = false, folder_id = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
      [newFolderId, resourceId],
    );

    await logActivity(userId, 'restore', 'file', resourceId, { name: file.name, folderId: newFolderId });
    res.json({ ok: true, resourceType: 'file', file: updated.rows[0] });
  })();
});

// POST /api/trash/delete — Permanently delete a single file or folder from trash
router.post('/delete', (req: AuthenticatedRequest, res: Response): void => {
  void (async () => {
    const parseRes = deleteTrashItemSchema.safeParse(req.body);
    if (!parseRes.success) {
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: getErrorMessage(parseRes.error) } });
      return;
    }
    const { resourceType, resourceId } = parseRes.data;
    const userId = req.user!.id;

    if (resourceType === 'folder') {
      const folderRes = await db.query<FolderRow>(
        'SELECT * FROM folders WHERE id = $1 AND owner_id = $2 AND is_deleted = true',
        [resourceId, userId],
      );
      const folder = folderRes.rows[0];
      if (!folder) {
        res.status(404).json({ error: { code: 'NOT_FOUND_IN_TRASH', message: 'Folder not found in trash.' } });
        return;
      }

      // Find all descendant files inside this folder hierarchy
      const descendantFilesQuery = `
        WITH RECURSIVE subfolders AS (
          SELECT id FROM folders WHERE id = $1 AND owner_id = $2
          UNION ALL
          SELECT f.id FROM folders f INNER JOIN subfolders s ON f.parent_id = s.id
        )
        SELECT id, storage_key FROM files WHERE folder_id IN (SELECT id FROM subfolders);
      `;
      const descFilesRes = await db.query<{ id: string; storage_key: string }>(descendantFilesQuery, [resourceId, userId]);

      // Remove storage objects
      for (const f of descFilesRes.rows) {
        try {
          await storage.deleteObject(f.storage_key);
          await storage.deleteObject(`previews/${f.storage_key}.jpg`);
        } catch {
          // Ignore individual storage deletion failure
        }
      }

      // Hard-delete folder (cascades in DB to subfolders, files, file_versions)
      await db.query('DELETE FROM folders WHERE id = $1 AND owner_id = $2', [resourceId, userId]);

      await logActivity(userId, 'delete', 'folder', resourceId, { name: folder.name, permanent: true });
      res.json({ ok: true, resourceType: 'folder' });
      return;
    }

    // Resource is file
    const fileRes = await db.query<FileRecord>(
      'SELECT * FROM files WHERE id = $1 AND owner_id = $2 AND is_deleted = true',
      [resourceId, userId],
    );
    const file = fileRes.rows[0];
    if (!file) {
      res.status(404).json({ error: { code: 'NOT_FOUND_IN_TRASH', message: 'File not found in trash.' } });
      return;
    }

    // Also get all version storage keys if any
    try {
      const versRes = await db.query<{ storage_key: string }>(
        'SELECT storage_key FROM file_versions WHERE file_id = $1',
        [resourceId],
      );
      for (const v of versRes.rows) {
        try {
          await storage.deleteObject(v.storage_key);
          await storage.deleteObject(`previews/${v.storage_key}.jpg`);
        } catch {
          // ignore
        }
      }
    } catch {
      // file_versions table may be optional
    }

    // Delete primary storage object
    try {
      await storage.deleteObject(file.storage_key);
      await storage.deleteObject(`previews/${file.storage_key}.jpg`);
    } catch {
      // ignore
    }

    // Hard-delete from database
    await db.query('DELETE FROM files WHERE id = $1 AND owner_id = $2', [resourceId, userId]);

    await logActivity(userId, 'delete', 'file', resourceId, { name: file.name, permanent: true });
    res.json({ ok: true, resourceType: 'file' });
  })();
});

// POST /api/trash/empty — Empty all soft-deleted items for the current user
router.post('/empty', (req: AuthenticatedRequest, res: Response): void => {
  void (async () => {
    const userId = req.user!.id;

    // Get all user files currently in trash
    const filesRes = await db.query<{ id: string; storage_key: string }>(
      'SELECT id, storage_key FROM files WHERE owner_id = $1 AND is_deleted = true',
      [userId],
    );

    for (const f of filesRes.rows) {
      try {
        await storage.deleteObject(f.storage_key);
        await storage.deleteObject(`previews/${f.storage_key}.jpg`);
      } catch {
        // ignore
      }
    }

    // Hard-delete files and folders marked is_deleted
    const deletedFilesRes = await db.query('DELETE FROM files WHERE owner_id = $1 AND is_deleted = true', [userId]);
    const deletedFoldersRes = await db.query('DELETE FROM folders WHERE owner_id = $1 AND is_deleted = true', [userId]);

    await logActivity(userId, 'delete', 'folder', userId, { emptyTrash: true });
    res.json({
      ok: true,
      purgedFiles: deletedFilesRes.rowCount ?? 0,
      purgedFolders: deletedFoldersRes.rowCount ?? 0,
    });
  })();
});


export default router;
