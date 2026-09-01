import { db } from '../db';

export interface FileRecord {
  id: string;
  name: string;
  mime_type: string;
  size_bytes: string;
  storage_key: string;
  owner_id: string;
  folder_id: string | null;
  version_id: string | null;
  checksum: string | null;
  status: string;
  is_deleted: boolean;
  created_at: Date;
  updated_at: Date;
}

export async function findFileById(id: string, ownerId?: string): Promise<FileRecord | null> {
  if (ownerId) {
    const result = await db.query<FileRecord>(
      'SELECT * FROM files WHERE id = $1 AND owner_id = $2 AND is_deleted = false',
      [id, ownerId],
    );
    return result.rows[0] ?? null;
  }
  const result = await db.query<FileRecord>(
    'SELECT * FROM files WHERE id = $1 AND is_deleted = false',
    [id],
  );
  return result.rows[0] ?? null;
}

export async function insertUploadingFile(params: {
  name: string;
  mimeType: string;
  sizeBytes: number;
  storageKey: string;
  ownerId: string;
  folderId: string | null;
  checksum?: string;
}): Promise<FileRecord> {
  const result = await db.query<FileRecord>(
    `INSERT INTO files (name, mime_type, size_bytes, storage_key, owner_id, folder_id, checksum, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, 'uploading')
     RETURNING *`,
    [
      params.name,
      params.mimeType,
      params.sizeBytes,
      params.storageKey,
      params.ownerId,
      params.folderId,
      params.checksum ?? null,
    ],
  );
  return result.rows[0]!;
}

export async function finalizeFileStatus(
  fileId: string,
  ownerId: string,
  sizeBytes: number,
  checksum?: string,
): Promise<FileRecord> {
  const result = await db.query<FileRecord>(
    `UPDATE files 
     SET status = 'ready', size_bytes = $1, checksum = COALESCE($2, checksum), updated_at = NOW() 
     WHERE id = $3 AND owner_id = $4 
     RETURNING *`,
    [sizeBytes, checksum ?? null, fileId, ownerId],
  );
  return result.rows[0]!;
}
