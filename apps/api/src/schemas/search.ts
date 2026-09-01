import { z } from 'zod';

export const searchQuerySchema = z.object({
  q: z.string().optional().default(''),
  type: z.enum(['all', 'file', 'folder', 'image', 'pdf', 'document', 'video', 'audio']).optional().default('all'),
  owner: z.enum(['all', 'me', 'shared']).optional().default('all'),
  starred: z.enum(['true', 'false', 'all']).optional().default('all'),
  sortBy: z.enum(['name', 'date', 'size']).optional().default('date'),
  sortDir: z.enum(['asc', 'desc']).optional().default('desc'),
});
