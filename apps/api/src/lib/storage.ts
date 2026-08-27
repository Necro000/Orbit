import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import type { Request, Response, IRouter } from 'express';
import { Router } from 'express';

export interface UploadUrlResult {
  uploadUrl: string;
  method: 'PUT' | 'POST';
  headers?: Record<string, string>;
}

export interface VerifyObjectResult {
  exists: boolean;
  sizeBytes: number;
  checksum?: string;
}

export interface StorageProvider {
  createUploadUrl(
    storageKey: string,
    mimeType: string,
    sizeBytes: number,
    expiresInSec?: number,
  ): Promise<UploadUrlResult>;

  createDownloadUrl(
    storageKey: string,
    filename: string,
    expiresInSec?: number,
  ): Promise<string>;

  deleteObject(storageKey: string): Promise<void>;

  verifyObject(storageKey: string): Promise<VerifyObjectResult>;
}

const STORAGE_SECRET =
  process.env['JWT_SECRET'] ?? 'orbit-storage-dev-secret-32-chars-long';
const STORAGE_DIR = path.resolve(process.cwd(), '../../infra/storage');

/**
 * Ensures a sanitized storage key matching architecture.md §5:
 * tenants/{owner_id}/folders/{folder_id}/files/{file_uuid}-{slug}.{ext}
 */
export function buildStorageKey(
  ownerId: string,
  folderId: string | null | undefined,
  fileId: string,
  rawFilename: string,
): string {
  const safeFilename = sanitizeFilename(rawFilename);
  const ext = path.extname(safeFilename);
  const base = path.basename(safeFilename, ext).slice(0, 50);
  const slug = base.replace(/[^a-zA-Z0-9_-]/g, '_') || 'file';
  const folderSegment = folderId ? folderId : 'root';
  return `tenants/${ownerId}/folders/${folderSegment}/files/${fileId}-${slug}${ext}`;
}

export function sanitizeFilename(filename: string): string {
  return filename
    .replace(/\0/g, '') // remove null bytes
    .replace(/\\/g, '/') // normalize slashes
    .replace(/\.\./g, '') // prevent path traversal
    .replace(/^\/+/, '') // remove leading slashes
    .trim();
}

function signUrlParams(params: Record<string, string>): string {
  const sorted = Object.keys(params)
    .sort()
    .map((k) => `${k}=${params[k] ?? ''}`)
    .join('&');
  return crypto.createHmac('sha256', STORAGE_SECRET).update(sorted).digest('hex');
}

function verifyUrlSignature(params: Record<string, string>, signature: string): boolean {
  const expected = signUrlParams(params);
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}

/**
 * LocalStorageProvider — Dev storage adapter writing to infra/storage/
 * Implements the direct-to-storage signed URL flow.
 */
export class LocalStorageProvider implements StorageProvider {
  private baseDir: string;
  private apiBase: string;

  constructor(baseDir = STORAGE_DIR, apiBase = '') {
    this.baseDir = baseDir;
    this.apiBase = apiBase || process.env['NEXT_PUBLIC_API_URL'] || 'http://localhost:8080';
    if (!fs.existsSync(this.baseDir)) {
      fs.mkdirSync(this.baseDir, { recursive: true });
    }
  }

  private resolvePath(storageKey: string): string {
    const sanitized = storageKey.replace(/\.\./g, '');
    return path.join(this.baseDir, sanitized);
  }

  public createUploadUrl(
    storageKey: string,
    mimeType: string,
    sizeBytes: number,
    expiresInSec = 900,
  ): Promise<UploadUrlResult> {
    const expires = String(Math.floor(Date.now() / 1000) + expiresInSec);
    const params: Record<string, string> = {
      expires,
      key: storageKey,
      mime: mimeType,
      size: String(sizeBytes),
    };
    const signature = signUrlParams(params);
    const qs = new URLSearchParams({ ...params, sig: signature }).toString();
    return Promise.resolve({
      uploadUrl: `${this.apiBase}/storage-dev/upload?${qs}`,
      method: 'PUT',
      headers: { 'Content-Type': mimeType },
    });
  }

  public createDownloadUrl(
    storageKey: string,
    filename: string,
    expiresInSec = 900,
  ): Promise<string> {
    const expires = String(Math.floor(Date.now() / 1000) + expiresInSec);
    const params: Record<string, string> = {
      expires,
      file: filename,
      key: storageKey,
    };
    const signature = signUrlParams(params);
    const qs = new URLSearchParams({ ...params, sig: signature }).toString();
    return Promise.resolve(`${this.apiBase}/storage-dev/download?${qs}`);
  }

  public deleteObject(storageKey: string): Promise<void> {
    const filePath = this.resolvePath(storageKey);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    return Promise.resolve();
  }

  public verifyObject(storageKey: string): Promise<VerifyObjectResult> {
    const filePath = this.resolvePath(storageKey);
    if (!fs.existsSync(filePath)) {
      return Promise.resolve({ exists: false, sizeBytes: 0 });
    }
    const stat = fs.statSync(filePath);
    const fileBuffer = fs.readFileSync(filePath);
    const checksum = crypto.createHash('sha256').update(fileBuffer).digest('hex');
    return Promise.resolve({ exists: true, sizeBytes: stat.size, checksum });
  }
}

export const storage: StorageProvider = new LocalStorageProvider();

/**
 * Router exposing direct signed upload/download endpoints for the dev storage adapter
 */
export const storageDevRouter: IRouter = Router();

storageDevRouter.put('/upload', (req: Request, res: Response): void => {
  const { key, expires, mime, size, sig } = req.query as Record<string, string | undefined>;

  if (!key || !expires || !mime || !size || !sig) {
    res.status(400).json({ error: { code: 'INVALID_STORAGE_URL', message: 'Missing parameters.' } });
    return;
  }

  if (Date.now() / 1000 > Number(expires)) {
    res.status(401).json({ error: { code: 'URL_EXPIRED', message: 'Upload URL expired.' } });
    return;
  }

  const paramsToVerify = { expires, key, mime, size };
  if (!verifyUrlSignature(paramsToVerify, sig)) {
    res.status(403).json({ error: { code: 'INVALID_SIGNATURE', message: 'Invalid URL signature.' } });
    return;
  }

  const filePath = path.join(STORAGE_DIR, key.replace(/\.\./g, ''));
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const writeStream = fs.createWriteStream(filePath);
  req.pipe(writeStream);

  writeStream.on('finish', () => {
    res.status(200).send();
  });

  writeStream.on('error', () => {
    res.status(500).json({ error: { code: 'STORAGE_WRITE_ERROR', message: 'Failed to write object.' } });
  });
});

storageDevRouter.get('/download', (req: Request, res: Response): void => {
  const { key, file, expires, sig } = req.query as Record<string, string | undefined>;

  if (!key || !file || !expires || !sig) {
    res.status(400).json({ error: { code: 'INVALID_STORAGE_URL', message: 'Missing parameters.' } });
    return;
  }

  if (Date.now() / 1000 > Number(expires)) {
    res.status(401).json({ error: { code: 'URL_EXPIRED', message: 'Download URL expired.' } });
    return;
  }

  const paramsToVerify = { expires, file, key };
  if (!verifyUrlSignature(paramsToVerify, sig)) {
    res.status(403).json({ error: { code: 'INVALID_SIGNATURE', message: 'Invalid URL signature.' } });
    return;
  }

  const filePath = path.join(STORAGE_DIR, key.replace(/\.\./g, ''));
  if (!fs.existsSync(filePath)) {
    res.status(404).json({ error: { code: 'FILE_NOT_FOUND', message: 'File not found in storage.' } });
    return;
  }

  res.download(filePath, file);
});
