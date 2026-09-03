import { db } from '../db';

export interface FolderRow {
  id: string;
  name: string;
  owner_id: string;
  parent_id: string | null;
  is_deleted: boolean;
  size_bytes?: string | number;
  created_at: Date;
  updated_at: Date;
}

export interface FileRow {
  id: string;
  name: string;
  mime_type: string;
  size_bytes: string;
  checksum: string | null;
  status: string;
  owner_id?: string;
  created_at: Date;
  updated_at: Date;
}

const FOLDER_SIZE_SUBQUERY = `
  COALESCE((
    SELECT SUM(files.size_bytes)
    FROM files
    WHERE (files.folder_id = f.id OR files.folder_id IN (SELECT id FROM folders WHERE parent_id = f.id AND is_deleted = false))
      AND files.is_deleted = false
      AND files.status = 'ready'
  ), 0)::text AS size_bytes
`;

export async function findFolderById(id: string, ownerId?: string): Promise<FolderRow | null> {
  if (ownerId) {
    const result = await db.query<FolderRow>(
      `SELECT f.id, f.name, f.owner_id, f.parent_id, f.is_deleted, f.created_at, f.updated_at,
              ${FOLDER_SIZE_SUBQUERY}
       FROM folders f WHERE f.id = $1 AND f.owner_id = $2 AND f.is_deleted = false`,
      [id, ownerId],
    );
    return result.rows[0] ?? null;
  }
  const result = await db.query<FolderRow>(
    `SELECT f.id, f.name, f.owner_id, f.parent_id, f.is_deleted, f.created_at, f.updated_at,
            ${FOLDER_SIZE_SUBQUERY}
     FROM folders f WHERE f.id = $1 AND f.is_deleted = false`,
    [id],
  );
  return result.rows[0] ?? null;
}

export async function getFolderPath(folderId: string): Promise<{ id: string; name: string }[]> {
  const query = `
    WITH RECURSIVE path_tree AS (
      SELECT id, name, parent_id, 0 as depth FROM folders WHERE id = $1 AND is_deleted = false
      UNION ALL
      SELECT f.id, f.name, f.parent_id, pt.depth + 1 FROM folders f
      INNER JOIN path_tree pt ON f.id = pt.parent_id
      WHERE f.is_deleted = false
    )
    SELECT id, name FROM path_tree ORDER BY depth DESC;
  `;
  const result = await db.query<{ id: string; name: string }>(query, [folderId]);
  return result.rows;
}

export async function getFolderChildren(
  parentId: string | null,
  ownerId?: string,
): Promise<{ folders: FolderRow[]; files: FileRow[] }> {
  let foldersQuery: string;
  let folderParams: (string | null)[];

  if (parentId === null) {
    foldersQuery = `
      SELECT f.id, f.name, f.owner_id, f.parent_id, f.created_at, f.updated_at,
             ${FOLDER_SIZE_SUBQUERY}
      FROM folders f
      WHERE f.owner_id = $1 AND f.parent_id IS NULL AND f.is_deleted = false
      ORDER BY f.name ASC
    `;
    folderParams = [ownerId!];
  } else {
    foldersQuery = `
      SELECT f.id, f.name, f.owner_id, f.parent_id, f.created_at, f.updated_at,
             ${FOLDER_SIZE_SUBQUERY}
      FROM folders f
      WHERE f.parent_id = $1 AND f.is_deleted = false
      ORDER BY f.name ASC
    `;
    folderParams = [parentId];
  }
  const foldersRes = await db.query<FolderRow>(foldersQuery, folderParams);

  let filesQuery: string;
  let fileParams: (string | null)[];

  if (parentId === null) {
    filesQuery = "SELECT id, name, mime_type, size_bytes, checksum, status, owner_id, created_at, updated_at FROM files WHERE owner_id = $1 AND folder_id IS NULL AND is_deleted = false AND status = 'ready' ORDER BY name ASC";
    fileParams = [ownerId!];
  } else {
    filesQuery = "SELECT id, name, mime_type, size_bytes, checksum, status, owner_id, created_at, updated_at FROM files WHERE folder_id = $1 AND is_deleted = false AND status = 'ready' ORDER BY name ASC";
    fileParams = [parentId];
  }
  const filesRes = await db.query<FileRow>(filesQuery, fileParams);

  return { folders: foldersRes.rows, files: filesRes.rows };
}

export async function isDescendantFolder(folderId: string, targetId: string): Promise<boolean> {
  const query = `
    WITH RECURSIVE descendants AS (
      SELECT id FROM folders WHERE parent_id = $1 AND is_deleted = false
      UNION ALL
      SELECT f.id FROM folders f
      INNER JOIN descendants d ON f.parent_id = d.id
      WHERE f.is_deleted = false
    )
    SELECT 1 FROM descendants WHERE id = $2 LIMIT 1;
  `;
  const result = await db.query(query, [folderId, targetId]);
  return result.rowCount !== null && result.rowCount > 0;
}

export async function softDeleteFolderTree(folderId: string, ownerId: string): Promise<void> {
  const query = `
    WITH RECURSIVE folder_tree AS (
      SELECT id FROM folders WHERE id = $1 AND owner_id = $2 AND is_deleted = false
      UNION ALL
      SELECT f.id FROM folders f
      INNER JOIN folder_tree ft ON f.parent_id = ft.id
      WHERE f.owner_id = $2 AND f.is_deleted = false
    )
    UPDATE folders SET is_deleted = true, updated_at = NOW()
    WHERE id IN (SELECT id FROM folder_tree);
  `;
  await db.query(query, [folderId, ownerId]);

  const filesQuery = `
    WITH RECURSIVE folder_tree AS (
      SELECT id FROM folders WHERE id = $1 AND owner_id = $2
      UNION ALL
      SELECT f.id FROM folders f
      INNER JOIN folder_tree ft ON f.parent_id = ft.id
      WHERE f.owner_id = $2
    )
    UPDATE files SET is_deleted = true, updated_at = NOW()
    WHERE folder_id IN (SELECT id FROM folder_tree) AND owner_id = $2;
  `;
  await db.query(filesQuery, [folderId, ownerId]);
}
