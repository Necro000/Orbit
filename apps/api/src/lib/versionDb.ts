import type { PoolClient } from 'pg';

import { db } from '../db';
import type { FileRecord } from './fileDb';
import { storage } from './storage';

export interface FileVersionRecord {
  id: string;
  file_id: string;
  version_number: number;
  storage_key: string;
  size_bytes: string;
  checksum: string | null;
  created_at: string;
}

export const MAX_VERSIONS_RETENTION = 10;

/**
 * List all versions for a file ordered newest to oldest.
 */
export async function listFileVersions(fileId: string): Promise<FileVersionRecord[]> {
  const result = await db.query<FileVersionRecord>(
    `SELECT id, file_id, version_number, storage_key, size_bytes, checksum, created_at
     FROM file_versions
     WHERE file_id = $1
     ORDER BY version_number DESC`,
    [fileId],
  );
  return result.rows;
}

export interface CreateVersionResult {
  file: FileRecord;
  version: FileVersionRecord;
  isNewVersion: boolean;
}

/**
 * Creates a file version using row-level locking (SELECT ... FOR UPDATE) on the parent files row.
 * Serializes concurrent version creations and guarantees monotonic version_number increments.
 */
export async function createFileVersionWithLock(
  client: PoolClient,
  fileId: string,
  storageKey: string,
  sizeBytes: number,
  checksum?: string | null,
): Promise<CreateVersionResult> {
  // 1. Lock the files row for update to serialize any concurrent uploads
  const fileRes = await client.query<FileRecord>(
    `SELECT * FROM files WHERE id = $1 FOR UPDATE`,
    [fileId],
  );

  if (fileRes.rows.length === 0) {
    throw new Error(`File ${fileId} not found during version creation`);
  }

  // 2. Query the highest existing version number with lock
  const maxRes = await client.query<{ max_version: number | null }>(
    `SELECT COALESCE(MAX(version_number), 0) AS max_version FROM file_versions WHERE file_id = $1`,
    [fileId],
  );

  const nextVersionNumber = (maxRes.rows[0]?.max_version ?? 0) + 1;

  // 3. Insert the new file_versions row
  const verRes = await client.query<FileVersionRecord>(
    `INSERT INTO file_versions (file_id, version_number, storage_key, size_bytes, checksum, created_at)
     VALUES ($1, $2, $3, $4, $5, NOW())
     RETURNING *`,
    [fileId, nextVersionNumber, storageKey, sizeBytes, checksum ?? null],
  );

  const newVersion = verRes.rows[0]!;

  // 4. Update the parent file's active version_id, storage_key, size, checksum, and status
  const updateRes = await client.query<FileRecord>(
    `UPDATE files
     SET version_id = $1,
         storage_key = $2,
         size_bytes = $3,
         checksum = $4,
         status = 'ready',
         updated_at = NOW()
     WHERE id = $5
     RETURNING *`,
    [newVersion.id, storageKey, sizeBytes, checksum ?? null, fileId],
  );

  return {
    file: updateRes.rows[0]!,
    version: newVersion,
    isNewVersion: nextVersionNumber > 1,
  };
}

export class VersionConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'VersionConflictError';
  }
}

export class VersionNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'VersionNotFoundError';
  }
}

/**
 * Reverts a file atomically to a previous version with optimistic concurrency check.
 */
export async function revertFileVersionAtomic(
  fileId: string,
  targetVersionId: string,
  expectedCurrentVersionId?: string,
): Promise<{ file: FileRecord; revertedVersion: FileVersionRecord }> {
  const client = await db.connect();

  try {
    await client.query('BEGIN');

    // 1. Lock the files row for update
    const fileRes = await client.query<FileRecord>(
      `SELECT * FROM files WHERE id = $1 FOR UPDATE`,
      [fileId],
    );

    if (fileRes.rows.length === 0) {
      throw new VersionNotFoundError('File not found');
    }

    const file = fileRes.rows[0]!;

    // 2. Optimistic Concurrency Check: If expectedCurrentVersionId is passed and doesn't match
    if (expectedCurrentVersionId && file.version_id && file.version_id !== expectedCurrentVersionId) {
      throw new VersionConflictError('This file was updated since you loaded this view. Refresh and try again.');
    }

    // 3. Find the target version row
    const verRes = await client.query<FileVersionRecord>(
      `SELECT * FROM file_versions WHERE id = $1 AND file_id = $2 FOR UPDATE`,
      [targetVersionId, fileId],
    );

    if (verRes.rows.length === 0) {
      throw new VersionNotFoundError('Target version no longer exists or was pruned.');
    }

    const targetVersion = verRes.rows[0]!;

    // 4. Update the files pointer
    const updateRes = await client.query<FileRecord>(
      `UPDATE files
       SET version_id = $1,
           storage_key = $2,
           size_bytes = $3,
           checksum = $4,
           updated_at = NOW()
       WHERE id = $5
       RETURNING *`,
      [
        targetVersion.id,
        targetVersion.storage_key,
        targetVersion.size_bytes,
        targetVersion.checksum,
        fileId,
      ],
    );

    await client.query('COMMIT');

    return {
      file: updateRes.rows[0]!,
      revertedVersion: targetVersion,
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Prunes versions exceeding the retention limit (keeps latest 10 versions).
 * Deletes database rows and underlying storage objects.
 */
export async function pruneOldVersions(fileId: string, keepCount = MAX_VERSIONS_RETENTION): Promise<number> {
  const client = await db.connect();
  let deletedCount = 0;

  try {
    await client.query('BEGIN');

    // Find max version number
    const maxRes = await client.query<{ max_version: number | null; current_version_id: string | null }>(
      `SELECT MAX(v.version_number) AS max_version, f.version_id AS current_version_id
       FROM files f
       LEFT JOIN file_versions v ON v.file_id = f.id
       WHERE f.id = $1
       GROUP BY f.version_id`,
      [fileId],
    );

    const maxVersion = maxRes.rows[0]?.max_version ?? 0;
    const currentVersionId = maxRes.rows[0]?.current_version_id;

    if (maxVersion <= keepCount) {
      await client.query('COMMIT');
      return 0;
    }

    const pruneThreshold = maxVersion - keepCount + 1; // versions < pruneThreshold are candidates

    // Select candidate versions to prune (excluding currently active version)
    const pruneRes = await client.query<FileVersionRecord>(
      `SELECT * FROM file_versions
       WHERE file_id = $1
         AND version_number < $2
         AND id != COALESCE($3, '00000000-0000-0000-0000-000000000000'::uuid)
       FOR UPDATE`,
      [fileId, pruneThreshold, currentVersionId],
    );

    if (pruneRes.rows.length === 0) {
      await client.query('COMMIT');
      return 0;
    }

    const idsToDelete = pruneRes.rows.map((r) => r.id);
    await client.query(
      `DELETE FROM file_versions WHERE id = ANY($1::uuid[])`,
      [idsToDelete],
    );

    await client.query('COMMIT');
    deletedCount = pruneRes.rows.length;

    // Asynchronously delete the physical objects from storage
    for (const ver of pruneRes.rows) {
      try {
        await storage.deleteObject(ver.storage_key);
        // Also delete preview if present
        await storage.deleteObject(`previews/${ver.storage_key}.jpg`);
      } catch (storageErr) {
        console.warn(`[pruneOldVersions] Failed to delete storage object ${ver.storage_key}:`, storageErr);
      }
    }
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(`[pruneOldVersions] Error pruning versions for file ${fileId}:`, err);
  } finally {
    client.release();
  }

  return deletedCount;
}
