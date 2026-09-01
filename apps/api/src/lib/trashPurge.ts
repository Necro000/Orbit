import { db } from '../db';
import { storage } from './storage';

export interface PurgeResult {
  purgedFolders: number;
  purgedFiles: number;
}

/**
 * purgeExpiredTrash — Hard-deletes files and folders past the 30-day retention window.
 * Uses row-level locking (FOR UPDATE SKIP LOCKED) within a transaction to avoid
 * race conditions with concurrent restore operations.
 */
export async function purgeExpiredTrash(retentionDays = 30): Promise<PurgeResult> {
  const client = await db.connect();
  let purgedFiles = 0;
  let purgedFolders = 0;

  try {
    await client.query('BEGIN');

    // 1. Lock and fetch expired soft-deleted files
    const filesQuery = `
      SELECT id, storage_key
      FROM files
      WHERE is_deleted = true AND updated_at < NOW() - make_interval(days => $1)
      FOR UPDATE SKIP LOCKED;
    `;
    const filesRes = await client.query<{ id: string; storage_key: string }>(filesQuery, [retentionDays]);

    // 2. Delete storage objects for locked files
    for (const file of filesRes.rows) {
      try {
        await storage.deleteObject(file.storage_key);
      } catch (err) {
        console.error(`Failed to delete storage object ${file.storage_key}:`, err);
      }
    }

    // 3. Hard-delete file DB records
    if (filesRes.rows.length > 0) {
      const fileIds = filesRes.rows.map((f) => f.id);
      await client.query('DELETE FROM files WHERE id = ANY($1::uuid[])', [fileIds]);
      purgedFiles = fileIds.length;
    }

    // 4. Lock and fetch expired soft-deleted folders (bottom-up leaf folders first)
    const foldersQuery = `
      SELECT id
      FROM folders
      WHERE is_deleted = true AND updated_at < NOW() - make_interval(days => $1)
      FOR UPDATE SKIP LOCKED;
    `;
    const foldersRes = await client.query<{ id: string }>(foldersQuery, [retentionDays]);

    if (foldersRes.rows.length > 0) {
      const folderIds = foldersRes.rows.map((f) => f.id);
      await client.query('DELETE FROM folders WHERE id = ANY($1::uuid[])', [folderIds]);
      purgedFolders = folderIds.length;
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  return { purgedFolders, purgedFiles };
}

/**
 * startTrashPurgeCron — Runs daily purge maintenance.
 */
export function startTrashPurgeScheduler(intervalMs = 24 * 60 * 60 * 1000): NodeJS.Timeout {
  const timer = setInterval(() => {
    void purgeExpiredTrash().catch((err) => {
      console.error('Scheduled trash purge failed:', err);
    });
  }, intervalMs);
  return timer;
}
