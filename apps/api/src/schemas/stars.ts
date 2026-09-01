import { z } from 'zod';

export const starResourceSchema = z.object({
  resourceType: z.enum(['file', 'folder']),
  resourceId: z.string().uuid(),
});

export const unstarResourceParamsSchema = z.object({
  resourceType: z.enum(['file', 'folder']),
  resourceId: z.string().uuid(),
});
