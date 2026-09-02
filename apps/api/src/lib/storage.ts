import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import { createClient } from '@supabase/supabase-js';

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
    inline?: boolean,
  ): Promise<string>;

  deleteObject(storageKey: string): Promise<void>;

  verifyObject(storageKey: string): Promise<VerifyObjectResult>;

  getObject(storageKey: string): Promise<Buffer>;

  saveObjectDirect(
    storageKey: string,
    data: Buffer,
    mimeType: string,
  ): Promise<void>;
}

import dotenv from 'dotenv';
dotenv.config();
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

function getStorageSecret(): string {
  return process.env['JWT_SECRET'] ?? 'orbit-storage-dev-secret-32-chars-long';
}

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
  versionNumber?: number,
): string {
  const safeFilename = sanitizeFilename(rawFilename);
  const ext = path.extname(safeFilename);
  const base = path.basename(safeFilename, ext).slice(0, 50);
  const slug = base.replace(/[^a-zA-Z0-9_-]/g, '_') || 'file';
  const folderSegment = folderId ? folderId : 'root';
  const versionSegment = versionNumber && versionNumber > 1 ? `-v${versionNumber}` : '';
  return `tenants/${ownerId}/folders/${folderSegment}/files/${fileId}${versionSegment}-${slug}${ext}`;
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
  return crypto.createHmac('sha256', getStorageSecret()).update(sorted).digest('hex');
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
    inline = false,
  ): Promise<string> {
    const expires = String(Math.floor(Date.now() / 1000) + expiresInSec);
    const params: Record<string, string> = {
      expires,
      file: filename,
      key: storageKey,
    };
    if (inline) {
      params['inline'] = '1';
    }
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

  public getObject(storageKey: string): Promise<Buffer> {
    const filePath = this.resolvePath(storageKey);
    if (!fs.existsSync(filePath)) {
      return Promise.reject(new Error(`Storage object not found: ${storageKey}`));
    }
    return Promise.resolve(fs.readFileSync(filePath));
  }

  public saveObjectDirect(
    storageKey: string,
    data: Buffer,
    _mimeType: string,
  ): Promise<void> {
    const filePath = this.resolvePath(storageKey);
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filePath, data);
    return Promise.resolve();
  }
}

/**
 * SupabaseStorageProvider — Production storage adapter using Supabase Storage.
 * Requires SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and SUPABASE_STORAGE_BUCKET env vars.
 */
export class SupabaseStorageProvider implements StorageProvider {
  private client: ReturnType<typeof createClient>;
  private bucket: string;

  constructor() {
    const url = process.env['SUPABASE_URL']!;
    const key = process.env['SUPABASE_SERVICE_ROLE_KEY']!;
    this.bucket = process.env['SUPABASE_STORAGE_BUCKET'] ?? 'orbit-files';
    this.client = createClient(url, key, {
      auth: { persistSession: false },
    });
  }

  async createUploadUrl(
    storageKey: string,
    _mimeType: string,
    _sizeBytes: number,
    _expiresInSec = 900,
  ): Promise<UploadUrlResult> {
    const { data, error } = await this.client.storage
      .from(this.bucket)
      .createSignedUploadUrl(storageKey);

    if (error || !data) {
      throw new Error(`Supabase: failed to create upload URL: ${error?.message ?? 'unknown'}`);
    }

    return {
      uploadUrl: data.signedUrl,
      method: 'PUT',
      headers: { 'x-upsert': 'true' },
    };
  }

  async createDownloadUrl(
    storageKey: string,
    _filename: string,
    expiresInSec = 900,
    _inline = false,
  ): Promise<string> {
    const { data, error } = await this.client.storage
      .from(this.bucket)
      .createSignedUrl(storageKey, expiresInSec);

    if (error || !data) {
      throw new Error(`Supabase: failed to create download URL: ${error?.message ?? 'unknown'}`);
    }

    return data.signedUrl;
  }

  async deleteObject(storageKey: string): Promise<void> {
    const { error } = await this.client.storage
      .from(this.bucket)
      .remove([storageKey]);

    if (error) {
      throw new Error(`Supabase: failed to delete object: ${error.message}`);
    }
  }

  async verifyObject(storageKey: string): Promise<VerifyObjectResult> {
    const parts = storageKey.split('/');
    const filename = parts.pop() ?? '';
    const folder = parts.join('/');

    const { data, error } = await this.client.storage
      .from(this.bucket)
      .list(folder, { search: filename });

    if (error || !data) {
      return { exists: false, sizeBytes: 0 };
    }

    const file = data.find((f) => f.name === filename);
    if (!file) return { exists: false, sizeBytes: 0 };

    const meta = file.metadata as { size?: number } | null;
    return { exists: true, sizeBytes: meta?.size ?? 0 };
  }

  async getObject(storageKey: string): Promise<Buffer> {
    const { data, error } = await this.client.storage
      .from(this.bucket)
      .download(storageKey);

    if (error || !data) {
      throw new Error(`Supabase: failed to get object: ${error?.message ?? 'unknown'}`);
    }

    return Buffer.from(await data.arrayBuffer());
  }

  async saveObjectDirect(
    storageKey: string,
    data: Buffer,
    mimeType: string,
  ): Promise<void> {
    const { error } = await this.client.storage
      .from(this.bucket)
      .upload(storageKey, data, { contentType: mimeType, upsert: true });

    if (error) {
      throw new Error(`Supabase: failed to save object: ${error.message}`);
    }
  }
}

/**
 * Factory: selects SupabaseStorageProvider in production (when SUPABASE_URL and
 * SUPABASE_SERVICE_ROLE_KEY are set to real values), otherwise falls back to
 * LocalStorageProvider for local development.
 */
function createStorageProvider(): StorageProvider {
  const supabaseUrl = process.env['SUPABASE_URL'];
  const supabaseKey = process.env['SUPABASE_SERVICE_ROLE_KEY'];

  const isConfigured =
    supabaseUrl &&
    supabaseKey &&
    !supabaseUrl.includes('<') &&
    !supabaseKey.includes('<');

  if (isConfigured) {
    console.log('[storage] Provider: Supabase Storage');
    return new SupabaseStorageProvider();
  }

  console.log('[storage] Provider: LocalStorageProvider (dev fallback)');
  return new LocalStorageProvider();
}

export const storage: StorageProvider = createStorageProvider();

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
  const { key, file, expires, sig, inline } = req.query as Record<string, string | undefined>;

  if (!key || !file || !expires || !sig) {
    res.status(400).json({ error: { code: 'INVALID_STORAGE_URL', message: 'Missing parameters.' } });
    return;
  }

  if (Date.now() / 1000 > Number(expires)) {
    res.status(401).json({ error: { code: 'URL_EXPIRED', message: 'Download URL expired.' } });
    return;
  }

  const paramsToVerify: Record<string, string> = { expires, file, key };
  if (inline) {
    paramsToVerify['inline'] = inline;
  }
  if (!verifyUrlSignature(paramsToVerify, sig)) {
    res.status(403).json({ error: { code: 'INVALID_SIGNATURE', message: 'Invalid URL signature.' } });
    return;
  }

  const filePath = path.join(STORAGE_DIR, key.replace(/\.\./g, ''));
  if (!fs.existsSync(filePath)) {
    res.status(404).json({ error: { code: 'FILE_NOT_FOUND', message: 'File not found in storage.' } });
    return;
  }

  if (inline === '1' || inline === 'true') {
    res.sendFile(filePath, {
      headers: {
        'Content-Disposition': `inline; filename="${encodeURIComponent(file)}"`,
      },
    });
    return;
  }

  res.download(filePath, file);
});
