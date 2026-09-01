import type { Response, IRouter } from 'express';
import { Router } from 'express';
import type { ZodError } from 'zod';

import { db } from '../db';
import { resolveAccess } from '../lib/acl';
import { logActivity } from '../lib/activity';
import type { AuthenticatedRequest } from '../middleware/authenticate';
import { authenticate } from '../middleware/authenticate';
import {
  createShareSchema,
  shareResourceParamsSchema,
  shareIdParamSchema,
} from '../schemas/shares';

const router: IRouter = Router();
router.use(authenticate);

function getErrorMessage(err?: ZodError | null): string {
  return err?.issues?.[0]?.message ?? 'Validation failed';
}

interface ShareRow {
  id: string;
  resource_type: string;
  resource_id: string;
  grantee_user_id: string;
  grantee_email?: string;
  grantee_name?: string;
  role: string;
  created_by: string;
  created_at: Date;
}

// POST /api/shares — Create or update share
router.post('/', (req: AuthenticatedRequest, res: Response): void => {
  void (async () => {
    const parseRes = createShareSchema.safeParse(req.body);
    if (!parseRes.success) {
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: getErrorMessage(parseRes.error) } });
      return;
    }
    const { resourceType, resourceId, granteeEmail, granteeUserId, role } = parseRes.data;
    const userId = req.user!.id;

    const access = await resolveAccess(userId, resourceType, resourceId);
    if (!access.canRead) {
      res.status(404).json({ error: { code: 'RESOURCE_NOT_FOUND', message: 'Resource not found.' } });
      return;
    }
    if (!access.canManageAcl) {
      res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Only the resource owner can manage shares.' } });
      return;
    }

    let targetGranteeId = granteeUserId;
    if (!targetGranteeId && granteeEmail) {
      const userRes = await db.query<{ id: string }>('SELECT id FROM users WHERE email = $1', [granteeEmail]);
      if (!userRes.rows[0]) {
        res.status(404).json({ error: { code: 'GRANTEE_NOT_FOUND', message: `No user found with email ${granteeEmail}.` } });
        return;
      }
      targetGranteeId = userRes.rows[0].id;
    }

    if (targetGranteeId === userId) {
      res.status(400).json({ error: { code: 'SELF_SHARE_NOT_ALLOWED', message: 'You cannot share a resource with yourself.' } });
      return;
    }

    const query = `
      INSERT INTO shares (resource_type, resource_id, grantee_user_id, role, created_by)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (resource_type, resource_id, grantee_user_id)
      DO UPDATE SET role = EXCLUDED.role
      RETURNING *;
    `;
    const result = await db.query<ShareRow>(query, [resourceType, resourceId, targetGranteeId, role, userId]);
    const share = result.rows[0];

    await logActivity(userId, 'share', resourceType, resourceId, { granteeUserId: targetGranteeId, role });
    res.status(200).json({ share });
  })();
});

// GET /api/shares/:resourceType/:resourceId — List current grantees
router.get('/:resourceType/:resourceId', (req: AuthenticatedRequest, res: Response): void => {
  void (async () => {
    const parseRes = shareResourceParamsSchema.safeParse(req.params);
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
      SELECT s.id, s.resource_type, s.resource_id, s.grantee_user_id, s.role, s.created_at,
             u.email as grantee_email, u.name as grantee_name
      FROM shares s
      INNER JOIN users u ON u.id = s.grantee_user_id
      WHERE s.resource_type = $1 AND s.resource_id = $2
      ORDER BY s.created_at ASC;
    `;
    const result = await db.query<ShareRow>(query, [resourceType, resourceId]);
    res.json({ shares: result.rows });
  })();
});

// DELETE /api/shares/:id — Revoke a share
router.delete('/:id', (req: AuthenticatedRequest, res: Response): void => {
  void (async () => {
    const parseRes = shareIdParamSchema.safeParse(req.params);
    if (!parseRes.success) {
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: getErrorMessage(parseRes.error) } });
      return;
    }
    const shareId = parseRes.data.id;
    const userId = req.user!.id;

    const shareRes = await db.query<ShareRow>('SELECT * FROM shares WHERE id = $1', [shareId]);
    const share = shareRes.rows[0];
    if (!share) {
      res.status(404).json({ error: { code: 'SHARE_NOT_FOUND', message: 'Share not found.' } });
      return;
    }

    const access = await resolveAccess(userId, share.resource_type as 'file' | 'folder', share.resource_id);
    if (!access.canManageAcl && share.grantee_user_id !== userId) {
      res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Only the resource owner or grantee can revoke this share.' } });
      return;
    }

    await db.query('DELETE FROM shares WHERE id = $1', [shareId]);
    res.json({ ok: true, revokedShareId: shareId });
  })();
});

export default router;
