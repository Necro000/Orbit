import type { Response, IRouter } from 'express';
import { Router } from 'express';
import type { ZodError } from 'zod';

import { db } from '../db';
import type { FileRow, FolderRow } from '../lib/folderDb';
import type { AuthenticatedRequest } from '../middleware/authenticate';
import { authenticate } from '../middleware/authenticate';
import { searchQuerySchema } from '../schemas/search';

const router: IRouter = Router();
router.use(authenticate);

function getErrorMessage(err?: ZodError | null): string {
  return err?.issues?.[0]?.message ?? 'Validation failed';
}

function getMimeTypePattern(type: string): string | null {
  switch (type) {
    case 'image':
      return 'image/%';
    case 'pdf':
      return 'application/pdf';
    case 'document':
      return '%word%|%document%|%text%|%pdf%';
    case 'video':
      return 'video/%';
    case 'audio':
      return 'audio/%';
    default:
      return null;
  }
}

// GET /api/search — Search folders and files with ACL scoping
router.get('/', (req: AuthenticatedRequest, res: Response): void => {
  void (async () => {
    try {
      const parseRes = searchQuerySchema.safeParse(req.query);
      if (!parseRes.success) {
        res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: getErrorMessage(parseRes.error) } });
        return;
      }
      const { q, type, owner, starred, sortBy, sortDir } = parseRes.data;
      const userId = req.user!.id;
      const searchPattern = `%${q.trim()}%`;
      const mimePattern = getMimeTypePattern(type);

      // 1. Search Folders (if type is 'all' or 'folder')
      let folders: FolderRow[] = [];
      if (type === 'all' || type === 'folder') {
        const foldersQuery = `
          WITH RECURSIVE shared_folders AS (
            SELECT f.id, f.name, f.owner_id, f.parent_id, f.created_at, f.updated_at
            FROM folders f
            INNER JOIN shares s ON s.resource_type = 'folder' AND s.resource_id = f.id
            WHERE s.grantee_user_id = $1 AND f.is_deleted = false
            UNION ALL
            SELECT child.id, child.name, child.owner_id, child.parent_id, child.created_at, child.updated_at
            FROM folders child
            INNER JOIN shared_folders sf ON child.parent_id = sf.id
            WHERE child.is_deleted = false
          ),
          accessible_folders AS (
            SELECT f.id, f.name, f.owner_id, f.parent_id, f.created_at, f.updated_at
            FROM folders f
            WHERE f.owner_id = $1 AND f.is_deleted = false
            UNION
            SELECT id, name, owner_id, parent_id, created_at, updated_at FROM shared_folders
          )
          SELECT af.*, CASE WHEN st.user_id IS NOT NULL THEN true ELSE false END as is_starred
          FROM accessible_folders af
          LEFT JOIN stars st ON st.user_id = $1 AND st.resource_type = 'folder' AND st.resource_id = af.id
          WHERE ($2 = '%%' OR af.name ILIKE $2)
            AND ($3 = 'all' OR ($3 = 'me' AND af.owner_id = $1) OR ($3 = 'shared' AND af.owner_id != $1))
            AND ($4 = 'all' OR ($4 = 'true' AND st.user_id IS NOT NULL) OR ($4 = 'false' AND st.user_id IS NULL))
          ORDER BY
            CASE WHEN $5 = 'name' AND $6 = 'asc' THEN af.name END ASC,
            CASE WHEN $5 = 'name' AND $6 = 'desc' THEN af.name END DESC,
            CASE WHEN $5 = 'date' AND $6 = 'asc' THEN af.updated_at END ASC,
            CASE WHEN $5 = 'date' AND $6 = 'desc' THEN af.updated_at END DESC,
            af.updated_at DESC
          LIMIT 50;
        `;
        const fRes = await db.query<FolderRow>(foldersQuery, [userId, searchPattern, owner, starred, sortBy, sortDir]);
        folders = fRes.rows;
      }

      // 2. Search Files (if type is not 'folder')
      let files: FileRow[] = [];
      if (type !== 'folder') {
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
          WHERE ($2 = '%%' OR af.name ILIKE $2)
            AND ($3::text IS NULL OR af.mime_type ILIKE $3::text)
            AND ($4 = 'all' OR ($4 = 'me' AND af.owner_id = $1) OR ($4 = 'shared' AND af.owner_id != $1))
            AND ($5 = 'all' OR ($5 = 'true' AND st.user_id IS NOT NULL) OR ($5 = 'false' AND st.user_id IS NULL))
          ORDER BY
            CASE WHEN $6 = 'name' AND $7 = 'asc' THEN af.name END ASC,
            CASE WHEN $6 = 'name' AND $7 = 'desc' THEN af.name END DESC,
            CASE WHEN $6 = 'size' AND $7 = 'asc' THEN af.size_bytes::bigint END ASC,
            CASE WHEN $6 = 'size' AND $7 = 'desc' THEN af.size_bytes::bigint END DESC,
            CASE WHEN $6 = 'date' AND $7 = 'asc' THEN af.updated_at END ASC,
            CASE WHEN $6 = 'date' AND $7 = 'desc' THEN af.updated_at END DESC,
            af.updated_at DESC
          LIMIT 50;
        `;
        const flRes = await db.query<FileRow>(filesQuery, [
          userId,
          searchPattern,
          mimePattern,
          owner,
          starred,
          sortBy,
          sortDir,
        ]);
        files = flRes.rows;
      }

      res.json({ folders, files });
    } catch (err: unknown) {
      console.error('Search query error:', err);
      res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to perform search.' } });
    }
  })();
});

export default router;
