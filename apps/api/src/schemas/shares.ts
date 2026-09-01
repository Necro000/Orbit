import { z } from 'zod';

export const createShareSchema = z.object({
  resourceType: z.enum(['file', 'folder']),
  resourceId: z.string().uuid(),
  granteeEmail: z.string().email().optional(),
  granteeUserId: z.string().uuid().optional(),
  role: z.enum(['viewer', 'editor']),
}).refine((data) => data.granteeEmail !== undefined || data.granteeUserId !== undefined, {
  message: 'Either granteeEmail or granteeUserId must be provided.',
});

export const shareResourceParamsSchema = z.object({
  resourceType: z.enum(['file', 'folder']),
  resourceId: z.string().uuid(),
});

export const shareIdParamSchema = z.object({
  id: z.string().uuid(),
});
