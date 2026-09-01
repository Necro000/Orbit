import { db } from '../db';

export type AccessRole = 'owner' | 'editor' | 'viewer';

export interface AccessResult {
  role: AccessRole | null;
  isOwner: boolean;
  canRead: boolean;
  canWrite: boolean;
  canManageAcl: boolean;
}

interface ResourceRecord {
  id: string;
  owner_id: string;
  parent_id?: string | null;
  folder_id?: string | null;
  is_deleted: boolean;
}

async function getAncestorShare(folderId: string, userId: string): Promise<AccessRole | null> {
  const query = `
    WITH RECURSIVE ancestors AS (
      SELECT id, parent_id FROM folders WHERE id = $1 AND is_deleted = false
      UNION ALL
      SELECT f.id, f.parent_id FROM folders f
      INNER JOIN ancestors a ON f.id = a.parent_id
      WHERE f.is_deleted = false
    )
    SELECT s.role FROM ancestors a
    INNER JOIN shares s ON s.resource_type = 'folder' AND s.resource_id = a.id
    WHERE s.grantee_user_id = $2
    ORDER BY CASE WHEN s.role = 'editor' THEN 1 ELSE 2 END ASC
    LIMIT 1;
  `;
  const res = await db.query<{ role: AccessRole }>(query, [folderId, userId]);
  return res.rows[0]?.role ?? null;
}

async function resolveFolderAccess(userId: string, folderId: string): Promise<AccessResult> {
  const folderRes = await db.query<ResourceRecord>(
    'SELECT id, owner_id, parent_id, is_deleted FROM folders WHERE id = $1',
    [folderId],
  );
  const folder = folderRes.rows[0];
  if (!folder || folder.is_deleted) {
    return { role: null, isOwner: false, canRead: false, canWrite: false, canManageAcl: false };
  }

  if (folder.owner_id === userId) {
    return { role: 'owner', isOwner: true, canRead: true, canWrite: true, canManageAcl: true };
  }

  const directRes = await db.query<{ role: AccessRole }>(
    "SELECT role FROM shares WHERE resource_type = 'folder' AND resource_id = $1 AND grantee_user_id = $2",
    [folderId, userId],
  );
  if (directRes.rows[0]) {
    const role = directRes.rows[0].role;
    return { role, isOwner: false, canRead: true, canWrite: role === 'editor', canManageAcl: false };
  }

  const ancestorRole = await getAncestorShare(folderId, userId);
  if (ancestorRole) {
    return { role: ancestorRole, isOwner: false, canRead: true, canWrite: ancestorRole === 'editor', canManageAcl: false };
  }

  return { role: null, isOwner: false, canRead: false, canWrite: false, canManageAcl: false };
}

async function resolveFileAccess(userId: string, fileId: string): Promise<AccessResult> {
  const fileRes = await db.query<ResourceRecord>(
    'SELECT id, owner_id, folder_id, is_deleted FROM files WHERE id = $1',
    [fileId],
  );
  const file = fileRes.rows[0];
  if (!file || file.is_deleted) {
    return { role: null, isOwner: false, canRead: false, canWrite: false, canManageAcl: false };
  }

  if (file.owner_id === userId) {
    return { role: 'owner', isOwner: true, canRead: true, canWrite: true, canManageAcl: true };
  }

  const directRes = await db.query<{ role: AccessRole }>(
    "SELECT role FROM shares WHERE resource_type = 'file' AND resource_id = $1 AND grantee_user_id = $2",
    [fileId, userId],
  );
  if (directRes.rows[0]) {
    const role = directRes.rows[0].role;
    return { role, isOwner: false, canRead: true, canWrite: role === 'editor', canManageAcl: false };
  }

  if (file.folder_id) {
    const folderAccess = await resolveFolderAccess(userId, file.folder_id);
    if (folderAccess.canRead) {
      return {
        role: folderAccess.role,
        isOwner: false,
        canRead: true,
        canWrite: folderAccess.canWrite,
        canManageAcl: false,
      };
    }
  }

  return { role: null, isOwner: false, canRead: false, canWrite: false, canManageAcl: false };
}

/**
 * resolveAccess — Centralized authorization resolver for files and folders.
 * Checks owner status, direct shares, and folder descendant inheritance.
 */
export async function resolveAccess(
  userId: string,
  resourceType: 'file' | 'folder',
  resourceId: string,
): Promise<AccessResult> {
  if (resourceType === 'folder') {
    return resolveFolderAccess(userId, resourceId);
  }
  return resolveFileAccess(userId, resourceId);
}
