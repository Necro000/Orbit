import crypto from 'node:crypto';

import bcrypt from 'bcryptjs';
import type { Response, Request, IRouter } from 'express';
import { Router } from 'express';
import type { ZodError } from 'zod';

import { db } from '../db';
import { resolveAccess } from '../lib/acl';
import { logActivity } from '../lib/activity';
import { findFileById } from '../lib/fileDb';
import { findFolderById, getFolderChildren, getFolderPath } from '../lib/folderDb';
import {
  checkLinkPasswordRateLimit,
  recordLinkPasswordFailure,
  clearLinkPasswordFailures,
} from '../lib/linkRateLimit';
import { storage } from '../lib/storage';
import type { AuthenticatedRequest } from '../middleware/authenticate';
import { authenticate } from '../middleware/authenticate';
import {
  createLinkShareSchema,
  linkResourceParamsSchema,
  linkIdParamSchema,
  resolveLinkParamsSchema,
} from '../schemas/linkShares';

const router: IRouter = Router();

function getErrorMessage(err?: ZodError | null): string {
  return err?.issues?.[0]?.message ?? 'Validation failed';
}

interface LinkShareRow {
  id: string;
  resource_type: 'file' | 'folder';
  resource_id: string;
  token: string;
  role: string;
  password_hash: string | null;
  expires_at: Date | null;
  created_by: string;
  created_at: Date;
}

// POST /api/link-shares — Create public link
router.post('/link-shares', authenticate, (req: AuthenticatedRequest, res: Response): void => {
  void (async () => {
    const parseRes = createLinkShareSchema.safeParse(req.body);
    if (!parseRes.success) {
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: getErrorMessage(parseRes.error) } });
      return;
    }
    const { resourceType, resourceId, role, password, expiresAt } = parseRes.data;
    const userId = req.user!.id;

    const access = await resolveAccess(userId, resourceType, resourceId);
    if (!access.canRead) {
      res.status(404).json({ error: { code: 'RESOURCE_NOT_FOUND', message: 'Resource not found.' } });
      return;
    }
    if (!access.canManageAcl) {
      res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Only the resource owner can create public links.' } });
      return;
    }

    const token = crypto.randomBytes(32).toString('hex');
    const passwordHash = password ? await bcrypt.hash(password, 10) : null;
    const expiresDate = expiresAt ? new Date(expiresAt) : null;

    const query = `
      INSERT INTO link_shares (resource_type, resource_id, token, role, password_hash, expires_at, created_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id, resource_type, resource_id, token, role, expires_at, created_at;
    `;
    const result = await db.query<LinkShareRow>(query, [
      resourceType,
      resourceId,
      token,
      role,
      passwordHash,
      expiresDate,
      userId,
    ]);

    await logActivity(userId, 'share', resourceType, resourceId, { publicLink: true, token });
    res.status(201).json({
      linkShare: {
        ...result.rows[0],
        hasPassword: Boolean(passwordHash),
      },
    });
  })();
});

// GET /api/link-shares/:resourceType/:resourceId — Fetch link for resource
router.get('/link-shares/:resourceType/:resourceId', authenticate, (req: AuthenticatedRequest, res: Response): void => {
  void (async () => {
    const parseRes = linkResourceParamsSchema.safeParse(req.params);
    if (!parseRes.success) {
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: getErrorMessage(parseRes.error) } });
      return;
    }
    const { resourceType, resourceId } = parseRes.data;
    const userId = req.user!.id;

    const access = await resolveAccess(userId, resourceType, resourceId);
    if (!access.canRead) {
      res.status(404).json({ error: { code: 'RESOURCE_NOT_FOUND', message: 'Resource not found or access denied.' } });
      return;
    }

    const query = `
      SELECT id, resource_type, resource_id, token, role, password_hash, expires_at, created_at
      FROM link_shares
      WHERE resource_type = $1 AND resource_id = $2
      ORDER BY created_at DESC
      LIMIT 1;
    `;
    const result = await db.query<LinkShareRow>(query, [resourceType, resourceId]);
    const link = result.rows[0];
    if (!link) {
      res.json({ linkShare: null });
      return;
    }

    res.json({
      linkShare: {
        id: link.id,
        resourceType: link.resource_type,
        resourceId: link.resource_id,
        token: link.token,
        role: link.role,
        hasPassword: Boolean(link.password_hash),
        expiresAt: link.expires_at,
        createdAt: link.created_at,
      },
    });
  })();
});

// DELETE /api/link-shares/:id — Revoke public link
router.delete('/link-shares/:id', authenticate, (req: AuthenticatedRequest, res: Response): void => {
  void (async () => {
    const parseRes = linkIdParamSchema.safeParse(req.params);
    if (!parseRes.success) {
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: getErrorMessage(parseRes.error) } });
      return;
    }
    const linkId = parseRes.data.id;
    const userId = req.user!.id;

    const linkRes = await db.query<LinkShareRow>('SELECT * FROM link_shares WHERE id = $1', [linkId]);
    const link = linkRes.rows[0];
    if (!link) {
      res.status(404).json({ error: { code: 'LINK_NOT_FOUND', message: 'Public link not found.' } });
      return;
    }

    const access = await resolveAccess(userId, link.resource_type, link.resource_id);
    if (!access.canManageAcl) {
      res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Only the resource owner can revoke this link.' } });
      return;
    }

    await db.query('DELETE FROM link_shares WHERE id = $1', [linkId]);
    res.json({ ok: true, revokedLinkId: linkId });
  })();
});

// GET /api/link/:token — Public resolver (no auth cookie required)
router.get('/link/:token', (req: Request, res: Response): void => {
  void (async () => {
    const paramRes = resolveLinkParamsSchema.safeParse(req.params);
    if (!paramRes.success) {
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: getErrorMessage(paramRes.error) } });
      return;
    }
    const token = paramRes.data.token;
    const clientIp = req.ip || req.socket.remoteAddress || 'unknown';

    const linkRes = await db.query<LinkShareRow>('SELECT * FROM link_shares WHERE token = $1', [token]);
    const link = linkRes.rows[0];
    if (!link) {
      res.status(404).json({ error: { code: 'LINK_NOT_FOUND', message: 'Public link not found.' } });
      return;
    }

    // Check expiration
    if (link.expires_at && new Date(link.expires_at) < new Date()) {
      res.status(410).json({ error: { code: 'LINK_EXPIRED', message: 'This public link has expired.' } });
      return;
    }

    // Check rate limit on password attempts
    const providedPassword = (req.query.password as string | undefined) || (req.headers['x-link-password'] as string | undefined);
    if (link.password_hash) {
      const rateCheck = checkLinkPasswordRateLimit(token, clientIp);
      if (!rateCheck.allowed) {
        res.status(429).json({
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: `Too many password attempts. Please wait ${rateCheck.retryAfterSeconds} seconds.`,
          },
        });
        return;
      }

      if (!providedPassword) {
        res.status(200).json({
          requiresPassword: true,
          resourceType: link.resource_type,
          token: link.token,
        });
        return;
      }

      const match = await bcrypt.compare(providedPassword, link.password_hash);
      if (!match) {
        recordLinkPasswordFailure(token, clientIp);
        res.status(401).json({ error: { code: 'INVALID_PASSWORD', message: 'Incorrect password for this link.' } });
        return;
      }
      clearLinkPasswordFailures(token, clientIp);
    }

    // Live verification of resource
    if (link.resource_type === 'file') {
      const file = await findFileById(link.resource_id);
      if (!file || file.is_deleted || file.status !== 'ready') {
        res.status(404).json({ error: { code: 'RESOURCE_NOT_FOUND', message: 'File is no longer available.' } });
        return;
      }
      const downloadUrl = await storage.createDownloadUrl(file.storage_key, file.name);
      const streamUrl = await storage.createDownloadUrl(file.storage_key, file.name, 900, true);
      res.json({ resourceType: 'file', file, downloadUrl, streamUrl, role: 'viewer' });
      return;
    }

    const folder = await findFolderById(link.resource_id);
    if (!folder || folder.is_deleted) {
      res.status(404).json({ error: { code: 'RESOURCE_NOT_FOUND', message: 'Folder is no longer available.' } });
      return;
    }
    const path = await getFolderPath(link.resource_id);
    const children = await getFolderChildren(link.resource_id);
    res.json({ resourceType: 'folder', folder, path, ...children, role: 'viewer' });
  })();
});

export default router;
