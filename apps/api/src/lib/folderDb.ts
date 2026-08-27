import { db } from '../db';

export interface FolderRow {
  id: string;
  name: string;
  owner_id: string;
  parent_id: string | null;
  is_deleted: boolean;
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
  created_at: Date;
  updated_at: Date;
}

export async function findFolderById(id: string, ownerId: string): Promise<FolderRow | null> {
  const result = await db.query<FolderRow>(
    'SELECT id, name, owner_id, parent_id, is_deleted, created_at, updated_at FROM folders WHERE id = $1 AND owner_id = $2 AND is_deleted = false',
    [id, ownerId],
  );
  return result.rows[0] ?? null;
}

export async function getFolderPath(folderId: string, ownerId: string): Promise<{ id: string; name: string }[]> {
  const query = `
    WITH RECURSIVE path_tree AS (
      SELECT id, name, parent_id, 0 as depth FROM folders WHERE id = $1 AND owner_id = $2 AND is_deleted = false
      UNION ALL
      SELECT f.id, f.name, f.parent_id, pt.depth + 1 FROM folders f
      INNER JOIN path_tree pt ON f.id = pt.parent_id
      WHERE f.owner_id = $2 AND f.is_deleted = false
    )
    SELECT id, name FROM path_tree ORDER BY depth DESC;
  `;
  const result = await db.query<{ id: string; name: string }>(query, [folderId, ownerId]);
  return result.rows;
}

export async function getFolderChildren(
  parentId: string | null,
  ownerId: string,
): Promise<{ folders: FolderRow[]; files: FileRow[] }> {
  const foldersQuery = parentId === null
    ? 'SELECT id, name, owner_id, parent_id, created_at, updated_at FROM folders WHERE owner_id = $1 AND parent_id IS NULL AND is_deleted = false ORDER BY name ASC'
    : 'SELECT id, name, owner_id, parent_id, created_at, updated_at FROM folders WHERE owner_id = $1 AND parent_id = $2 AND is_deleted = false ORDER BY name ASC';
  const folderParams = parentId === null ? [ownerId] : [ownerId, parentId];
  const foldersRes = await db.query<FolderRow>(foldersQuery, folderParams);

  const filesQuery = parentId === null
    ? "SELECT id, name, mime_type, size_bytes, checksum, status, created_at, updated_at FROM files WHERE owner_id = $1 AND folder_id IS NULL AND is_deleted = false AND status = 'ready' ORDER BY name ASC"
    : "SELECT id, name, mime_type, size_bytes, checksum, status, created_at, updated_at FROM files WHERE owner_id = $1 AND folder_id = $2 AND is_deleted = false AND status = 'ready' ORDER BY name ASC";
  const fileParams = parentId === null ? [ownerId] : [ownerId, parentId];
  const filesRes = await db.query<FileRow>(filesQuery, fileParams);

  return { folders: foldersRes.rows, files: filesRes.rows };
}

export async function isDescendantFolder(folderId: string, targetId: string, ownerId: string): Promise<boolean> {
  const query = `
    WITH RECURSIVE descendants AS (
      SELECT id FROM folders WHERE parent_id = $1 AND owner_id = $2 AND is_deleted = false
      UNION ALL
      SELECT f.id FROM folders f
      INNER JOIN descendants d ON f.parent_id = d.id
      WHERE f.owner_id = $2 AND f.is_deleted = false
    )
    SELECT 1 FROM descendants WHERE id = $3 LIMIT 1;
  `;
  const result = await db.query(query, [folderId, ownerId, targetId]);
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
