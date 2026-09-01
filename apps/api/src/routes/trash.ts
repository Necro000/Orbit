import type { Response, IRouter } from 'express';
import { Router } from 'express';
import type { ZodError } from 'zod';

import { db } from '../db';
import { logActivity } from '../lib/activity';
import type { FileRecord } from '../lib/fileDb';
import type { FolderRow } from '../lib/folderDb';
import type { AuthenticatedRequest } from '../middleware/authenticate';
import { authenticate } from '../middleware/authenticate';
import { restoreItemSchema } from '../schemas/trash';

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

export default router;
