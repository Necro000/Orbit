import type { Response, IRouter } from 'express';
import { Router } from 'express';
import type { ZodError } from 'zod';

import { db } from '../db';
import { resolveAccess } from '../lib/acl';
import type { FileRow, FolderRow } from '../lib/folderDb';
import type { AuthenticatedRequest } from '../middleware/authenticate';
import { authenticate } from '../middleware/authenticate';
import { starResourceSchema, unstarResourceParamsSchema } from '../schemas/stars';

const router: IRouter = Router();
router.use(authenticate);

function getErrorMessage(err?: ZodError | null): string {
  return err?.issues?.[0]?.message ?? 'Validation failed';
}

// GET /api/stars — List all starred items for user
router.get('/', (req: AuthenticatedRequest, res: Response): void => {
  void (async () => {
    const userId = req.user!.id;

    const foldersQuery = `
      SELECT f.id, f.name, f.owner_id, f.parent_id, f.created_at, f.updated_at, true as is_starred
      FROM stars s
      INNER JOIN folders f ON f.id = s.resource_id AND f.is_deleted = false
      WHERE s.user_id = $1 AND s.resource_type = 'folder'
      ORDER BY f.name ASC;
    `;
    const foldersRes = await db.query<FolderRow & { is_starred: boolean }>(foldersQuery, [userId]);

    const filesQuery = `
      SELECT fl.id, fl.name, fl.mime_type, fl.size_bytes, fl.checksum, fl.status, fl.owner_id, fl.folder_id, fl.created_at, fl.updated_at, true as is_starred
      FROM stars s
      INNER JOIN files fl ON fl.id = s.resource_id AND fl.is_deleted = false AND fl.status = 'ready'
      WHERE s.user_id = $1 AND s.resource_type = 'file'
      ORDER BY fl.name ASC;
    `;
    const filesRes = await db.query<FileRow & { is_starred: boolean }>(filesQuery, [userId]);

    res.json({
      folders: foldersRes.rows,
      files: filesRes.rows,
    });
  })();
});

// POST /api/stars — Star an item
router.post('/', (req: AuthenticatedRequest, res: Response): void => {
  void (async () => {
    const parseRes = starResourceSchema.safeParse(req.body);
    if (!parseRes.success) {
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: getErrorMessage(parseRes.error) } });
      return;
    }
    const { resourceType, resourceId } = parseRes.data;
    const userId = req.user!.id;

    const access = await resolveAccess(userId, resourceType, resourceId);
    if (!access.canRead) {
      res.status(404).json({ error: { code: 'RESOURCE_NOT_FOUND', message: 'Resource not found or access denied.' } });
      return;
    }

    await db.query(
      'INSERT INTO stars (user_id, resource_type, resource_id) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
      [userId, resourceType, resourceId],
    );

    res.status(200).json({ ok: true, resourceType, resourceId, isStarred: true });
  })();
});

// DELETE /api/stars/:resourceType/:resourceId — Unstar an item
router.delete('/:resourceType/:resourceId', (req: AuthenticatedRequest, res: Response): void => {
  void (async () => {
    const parseRes = unstarResourceParamsSchema.safeParse(req.params);
    if (!parseRes.success) {
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: getErrorMessage(parseRes.error) } });
      return;
    }
    const { resourceType, resourceId } = parseRes.data;
    const userId = req.user!.id;

    await db.query(
      'DELETE FROM stars WHERE user_id = $1 AND resource_type = $2 AND resource_id = $3',
      [userId, resourceType, resourceId],
    );

    res.json({ ok: true, resourceType, resourceId, isStarred: false });
  })();
});

export default router;
