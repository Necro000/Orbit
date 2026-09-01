import type { Response, IRouter } from 'express';
import { Router } from 'express';

import { db } from '../db';
import type { FileRow, FolderRow } from '../lib/folderDb';
import type { AuthenticatedRequest } from '../middleware/authenticate';
import { authenticate } from '../middleware/authenticate';

const router: IRouter = Router();
router.use(authenticate);

// GET /api/shared — List items shared with the caller
router.get('/', (req: AuthenticatedRequest, res: Response): void => {
  void (async () => {
    const userId = req.user!.id;

    const foldersQuery = `
      SELECT f.id, f.name, f.owner_id, f.parent_id, f.created_at, f.updated_at, s.role,
             u.name as owner_name, u.email as owner_email,
             CASE WHEN st.user_id IS NOT NULL THEN true ELSE false END as is_starred
      FROM shares s
      INNER JOIN folders f ON f.id = s.resource_id AND f.is_deleted = false
      INNER JOIN users u ON u.id = f.owner_id
      LEFT JOIN stars st ON st.user_id = $1 AND st.resource_type = 'folder' AND st.resource_id = f.id
      WHERE s.grantee_user_id = $1 AND s.resource_type = 'folder'
      ORDER BY s.created_at DESC;
    `;
    const foldersRes = await db.query<FolderRow & { role: string; owner_name: string; is_starred: boolean }>(foldersQuery, [userId]);

    const filesQuery = `
      SELECT fl.id, fl.name, fl.mime_type, fl.size_bytes, fl.checksum, fl.status, fl.owner_id, fl.created_at, fl.updated_at, s.role,
             u.name as owner_name, u.email as owner_email,
             CASE WHEN st.user_id IS NOT NULL THEN true ELSE false END as is_starred
      FROM shares s
      INNER JOIN files fl ON fl.id = s.resource_id AND fl.is_deleted = false AND fl.status = 'ready'
      INNER JOIN users u ON u.id = fl.owner_id
      LEFT JOIN stars st ON st.user_id = $1 AND st.resource_type = 'file' AND st.resource_id = fl.id
      WHERE s.grantee_user_id = $1 AND s.resource_type = 'file'
      ORDER BY s.created_at DESC;
    `;
    const filesRes = await db.query<FileRow & { role: string; owner_name: string; is_starred: boolean }>(filesQuery, [userId]);

    res.json({ folders: foldersRes.rows, files: filesRes.rows });
  })();
});

export default router;
