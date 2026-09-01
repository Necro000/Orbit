import { z } from 'zod';

export const createLinkShareSchema = z.object({
  resourceType: z.enum(['file', 'folder']),
  resourceId: z.string().uuid(),
  role: z.enum(['viewer']).default('viewer'),
  password: z.string().min(1).max(100).optional().nullable(),
  expiresAt: z.string().datetime().optional().nullable(),
});

export const linkResourceParamsSchema = z.object({
  resourceType: z.enum(['file', 'folder']),
  resourceId: z.string().uuid(),
});

export const linkIdParamSchema = z.object({
  id: z.string().uuid(),
});

export const resolveLinkParamsSchema = z.object({
  token: z.string().min(10).max(100),
});
