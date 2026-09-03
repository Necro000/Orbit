import { db } from '../db';

/**
 * 15 GB Free Tier storage quota (in bytes)
 */
export const MAX_STORAGE_BYTES = 15 * 1024 * 1024 * 1024; // 16,106,127,360 bytes

export interface StorageQuotaResult {
  allowed: boolean;
  usedBytes: bigint;
  maxBytes: bigint;
  remainingBytes: bigint;
}

/**
 * Checks if a user has sufficient storage quota to upload an additional file.
 * Automatically evicts stale in-flight uploads older than 10 minutes.
 * Counts:
 * 1. Active files (status = 'ready', is_deleted = false)
 * 2. Trash items (is_deleted = true)
 * 3. Historical file versions (file_versions table)
 * 4. Active in-flight uploads (status = 'uploading' within the last 10 minutes)
 */
async function evictStaleUploads(userId: string): Promise<void> {
  await db.query(
    `UPDATE files SET status = 'failed', updated_at = NOW()
     WHERE owner_id = $1 AND status = 'uploading' AND created_at < NOW() - INTERVAL '10 minutes'`,
    [userId],
  );
}

const QUOTA_SUM_QUERY = `
  SELECT
    COALESCE((
      SELECT SUM(size_bytes) FROM files
      WHERE owner_id = $1 AND (status = 'ready' OR (status = 'uploading' AND created_at >= NOW() - INTERVAL '10 minutes'))
    ), 0) +
    COALESCE((
      SELECT SUM(fv.size_bytes) FROM file_versions fv
      INNER JOIN files f ON fv.file_id = f.id WHERE f.owner_id = $1
    ), 0) AS total_used_bytes;
`;

export async function checkStorageQuota(
  userId: string,
  additionalBytes: number,
): Promise<StorageQuotaResult> {
  await evictStaleUploads(userId);

  const res = await db.query<{ total_used_bytes: string | number }>(QUOTA_SUM_QUERY, [userId]);
  const usedBytes = BigInt(res.rows[0]?.total_used_bytes ?? 0);
  const maxBytes = BigInt(MAX_STORAGE_BYTES);
  const incomingBytes = BigInt(Math.max(0, additionalBytes));

  const allowed = usedBytes + incomingBytes <= maxBytes;
  const remainingBytes = maxBytes > usedBytes ? maxBytes - usedBytes : 0n;

  return { allowed, usedBytes, maxBytes, remainingBytes };
}

/**
 * Returns current storage used by the user.
 */
export async function getUserStorageUsedBytes(userId: string): Promise<bigint> {
  const quota = await checkStorageQuota(userId, 0);
  return quota.usedBytes;
}
