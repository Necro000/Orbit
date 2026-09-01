import type { Response, IRouter } from 'express';
import { Router } from 'express';

import { db } from '../db';
import type { FileRow, FolderRow } from '../lib/folderDb';
import type { AuthenticatedRequest } from '../middleware/authenticate';
import { authenticate } from '../middleware/authenticate';

const router: IRouter = Router();
router.use(authenticate);

// GET /api/recent — Fetch recent items for user
router.get('/', (req: AuthenticatedRequest, res: Response): void => {
  void (async () => {
    const userId = req.user!.id;

    const filesQuery = `
      WITH RECURSIVE shared_folders AS (
        SELECT f.id FROM folders f
        INNER JOIN shares s ON s.resource_type = 'folder' AND s.resource_id = f.id
        WHERE s.grantee_user_id = $1 AND f.is_deleted = false
        UNION ALL
        SELECT child.id FROM folders child
        INNER JOIN shared_folders sf ON child.parent_id = sf.id
        WHERE child.is_deleted = false
      ),
      accessible_files AS (
        SELECT fl.id, fl.name, fl.mime_type, fl.size_bytes, fl.checksum, fl.status, fl.owner_id, fl.folder_id, fl.created_at, fl.updated_at
        FROM files fl
        WHERE fl.owner_id = $1 AND fl.is_deleted = false AND fl.status = 'ready'
        UNION
        SELECT fl.id, fl.name, fl.mime_type, fl.size_bytes, fl.checksum, fl.status, fl.owner_id, fl.folder_id, fl.created_at, fl.updated_at
        FROM files fl
        INNER JOIN shares s ON s.resource_type = 'file' AND s.resource_id = fl.id
        WHERE s.grantee_user_id = $1 AND fl.is_deleted = false AND fl.status = 'ready'
        UNION
        SELECT fl.id, fl.name, fl.mime_type, fl.size_bytes, fl.checksum, fl.status, fl.owner_id, fl.folder_id, fl.created_at, fl.updated_at
        FROM files fl
        INNER JOIN shared_folders sf ON fl.folder_id = sf.id
        WHERE fl.is_deleted = false AND fl.status = 'ready'
      )
      SELECT af.*, CASE WHEN st.user_id IS NOT NULL THEN true ELSE false END as is_starred
      FROM accessible_files af
      LEFT JOIN stars st ON st.user_id = $1 AND st.resource_type = 'file' AND st.resource_id = af.id
      ORDER BY af.updated_at DESC
      LIMIT 30;
    `;
    const filesRes = await db.query<FileRow & { is_starred: boolean }>(filesQuery, [userId]);

    const foldersQuery = `
      SELECT f.id, f.name, f.owner_id, f.parent_id, f.created_at, f.updated_at,
             CASE WHEN st.user_id IS NOT NULL THEN true ELSE false END as is_starred
      FROM folders f
      LEFT JOIN stars st ON st.user_id = $1 AND st.resource_type = 'folder' AND st.resource_id = f.id
      WHERE f.owner_id = $1 AND f.is_deleted = false
      ORDER BY f.updated_at DESC
      LIMIT 10;
    `;
    const foldersRes = await db.query<FolderRow & { is_starred: boolean }>(foldersQuery, [userId]);

    res.json({ folders: foldersRes.rows, files: filesRes.rows });
  })();
});

export default router;
