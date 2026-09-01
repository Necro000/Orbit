import { z } from 'zod';

export const restoreItemSchema = z.object({
  resourceType: z.enum(['file', 'folder']),
  resourceId: z.string().uuid(),
});
