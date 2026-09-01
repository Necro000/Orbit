import type { Response, IRouter } from 'express';
import { Router } from 'express';
import type { ZodError } from 'zod';

import { db } from '../db';
import { resolveAccess } from '../lib/acl';
import { logActivity } from '../lib/activity';
import {
  findFolderById,
  getFolderPath,
  getFolderChildren,
  isDescendantFolder,
  softDeleteFolderTree,
  type FolderRow,
} from '../lib/folderDb';
import type { AuthenticatedRequest } from '../middleware/authenticate';
import { authenticate } from '../middleware/authenticate';
import { createFolderSchema, updateFolderSchema, folderIdParamSchema } from '../schemas/folders';

const router: IRouter = Router();
router.use(authenticate);

function getErrorMessage(err?: ZodError | null): string {
  return err?.issues?.[0]?.message ?? 'Validation failed';
}

// POST /api/folders — Create new folder
router.post('/', (req: AuthenticatedRequest, res: Response): void => {
  void (async () => {
    const parseRes = createFolderSchema.safeParse(req.body);
    if (!parseRes.success) {
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: getErrorMessage(parseRes.error) } });
      return;
    }
    const { name, parentId } = parseRes.data;
    const userId = req.user!.id;

    if (parentId) {
      const parentAccess = await resolveAccess(userId, 'folder', parentId);
      if (!parentAccess.canRead) {
        res.status(404).json({ error: { code: 'FOLDER_NOT_FOUND', message: 'Parent folder not found.' } });
        return;
      }
      if (!parentAccess.canWrite) {
        res.status(403).json({ error: { code: 'FORBIDDEN', message: 'You do not have permission to create folders here.' } });
        return;
      }
    }

    try {
      const result = await db.query<FolderRow>(
        'INSERT INTO folders (name, owner_id, parent_id) VALUES ($1, $2, $3) RETURNING id, name, owner_id, parent_id, created_at, updated_at',
        [name, userId, parentId ?? null],
      );
      const folder = result.rows[0]!;
      await logActivity(userId, 'upload', 'folder', folder.id, { name, parentId });
      res.status(201).json({ folder });
    } catch (err: unknown) {
      if (typeof err === 'object' && err !== null && 'code' in err && err.code === '23505') {
        res.status(409).json({ error: { code: 'DUPLICATE_FOLDER_NAME', message: 'A folder with this name already exists in this location.' } });
        return;
      }
      throw err;
    }
  })();
});

// GET /api/folders/:id — Get folder contents (or root)
router.get('/:id', (req: AuthenticatedRequest, res: Response): void => {
  void (async () => {
    const paramRes = folderIdParamSchema.safeParse(req.params);
    if (!paramRes.success) {
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: getErrorMessage(paramRes.error) } });
      return;
    }
    const folderId = paramRes.data.id;
    const userId = req.user!.id;

    if (folderId === 'root') {
      const children = await getFolderChildren(null, userId);
      res.json({
        folder: { id: 'root', name: 'My Drive', parentId: null, role: 'owner' },
        path: [],
        ...children,
      });
      return;
    }

    const access = await resolveAccess(userId, 'folder', folderId);
    if (!access.canRead) {
      res.status(404).json({ error: { code: 'FOLDER_NOT_FOUND', message: 'Folder not found or access denied.' } });
      return;
    }

    const folder = await findFolderById(folderId);
    if (!folder) {
      res.status(404).json({ error: { code: 'FOLDER_NOT_FOUND', message: 'Folder not found.' } });
      return;
    }

    const path = await getFolderPath(folderId);
    const children = await getFolderChildren(folderId);
    res.json({ folder: { ...folder, role: access.role }, path, ...children });
  })();
});

// PATCH /api/folders/:id — Rename or Move folder
router.patch('/:id', (req: AuthenticatedRequest, res: Response): void => {
  void (async () => {
    const paramRes = folderIdParamSchema.safeParse(req.params);
    const bodyRes = updateFolderSchema.safeParse(req.body);
    if (!paramRes.success || !bodyRes.success) {
      const err = !paramRes.success ? paramRes.error : bodyRes.error;
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: getErrorMessage(err) } });
      return;
    }
    const folderId = paramRes.data.id;
    const userId = req.user!.id;

    if (folderId === 'root') {
      res.status(400).json({ error: { code: 'CANNOT_MODIFY_ROOT', message: 'Root folder cannot be renamed or moved.' } });
      return;
    }

    const access = await resolveAccess(userId, 'folder', folderId);
    if (!access.canRead) {
      res.status(404).json({ error: { code: 'FOLDER_NOT_FOUND', message: 'Folder not found.' } });
      return;
    }
    if (!access.isOwner) {
      res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Only the folder owner can rename or move it.' } });
      return;
    }

    const existing = await findFolderById(folderId);
    if (!existing) {
      res.status(404).json({ error: { code: 'FOLDER_NOT_FOUND', message: 'Folder not found.' } });
      return;
    }

    const { name, parentId } = bodyRes.data;
    const newParentId = parentId !== undefined ? parentId : existing.parent_id;

    if (parentId !== undefined && parentId !== null) {
      if (parentId === folderId) {
        res.status(400).json({ error: { code: 'CYCLIC_MOVE_NOT_ALLOWED', message: 'A folder cannot be moved into itself.' } });
        return;
      }
      const targetAccess = await resolveAccess(userId, 'folder', parentId);
      if (!targetAccess.canRead) {
        res.status(404).json({ error: { code: 'FOLDER_NOT_FOUND', message: 'Destination folder not found.' } });
        return;
      }
      const isCyclic = await isDescendantFolder(folderId, parentId);
      if (isCyclic) {
        res.status(400).json({ error: { code: 'CYCLIC_MOVE_NOT_ALLOWED', message: 'A folder cannot be moved into one of its subfolders.' } });
        return;
      }
    }

    try {
      const updated = await db.query<FolderRow>(
        'UPDATE folders SET name = $1, parent_id = $2, updated_at = NOW() WHERE id = $3 RETURNING id, name, owner_id, parent_id, created_at, updated_at',
        [name ?? existing.name, newParentId, folderId],
      );
      const action = name && name !== existing.name ? 'rename' : 'move';
      await logActivity(userId, action, 'folder', folderId, { oldName: existing.name, newName: name, newParentId });
      res.json({ folder: updated.rows[0] });
    } catch (err: unknown) {
      if (typeof err === 'object' && err !== null && 'code' in err && err.code === '23505') {
        res.status(409).json({ error: { code: 'DUPLICATE_FOLDER_NAME', message: 'A folder with this name already exists in destination.' } });
        return;
      }
      throw err;
    }
  })();
});

// DELETE /api/folders/:id — Soft-delete folder & descendants
router.delete('/:id', (req: AuthenticatedRequest, res: Response): void => {
  void (async () => {
    const paramRes = folderIdParamSchema.safeParse(req.params);
    if (!paramRes.success) {
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: getErrorMessage(paramRes.error) } });
      return;
    }
    const folderId = paramRes.data.id;
    const userId = req.user!.id;

    if (folderId === 'root') {
      res.status(400).json({ error: { code: 'CANNOT_DELETE_ROOT', message: 'Root folder cannot be deleted.' } });
      return;
    }

    const access = await resolveAccess(userId, 'folder', folderId);
    if (!access.canRead) {
      res.status(404).json({ error: { code: 'FOLDER_NOT_FOUND', message: 'Folder not found.' } });
      return;
    }
    if (!access.isOwner) {
      res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Only the folder owner can delete it.' } });
      return;
    }

    const existing = await findFolderById(folderId);
    if (!existing) {
      res.status(404).json({ error: { code: 'FOLDER_NOT_FOUND', message: 'Folder not found.' } });
      return;
    }

    await softDeleteFolderTree(folderId, existing.owner_id);
    await logActivity(userId, 'delete', 'folder', folderId, { name: existing.name });
    res.json({ ok: true, deletedFolderId: folderId });
  })();
});

export default router;
