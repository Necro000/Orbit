import type { Response, IRouter } from 'express';
import { Router } from 'express';
import { z } from 'zod';

import { resolveAccess } from '../lib/acl';
import { getActivityForItem } from '../lib/activity';
import type { AuthenticatedRequest } from '../middleware/authenticate';
import { authenticate } from '../middleware/authenticate';

const router: IRouter = Router();
router.use(authenticate);

const activityParamsSchema = z.object({
  resourceType: z.enum(['file', 'folder']),
  resourceId: z.string().uuid(),
});

// GET /api/activities/:resourceType/:resourceId — Fetch activity feed for item
router.get('/:resourceType/:resourceId', (req: AuthenticatedRequest, res: Response): void => {
  void (async () => {
    const parseRes = activityParamsSchema.safeParse(req.params);
    if (!parseRes.success) {
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid resource parameters.' } });
      return;
    }
    const { resourceType, resourceId } = parseRes.data;
    const userId = req.user!.id;

    const access = await resolveAccess(userId, resourceType, resourceId);
    if (!access.canRead) {
      res.status(404).json({ error: { code: 'RESOURCE_NOT_FOUND', message: 'Resource not found or access denied.' } });
      return;
    }

    const activities = await getActivityForItem(resourceType, resourceId);
    res.json({ activities });
  })();
});

export default router;
