import { z } from 'zod';

export const createFolderSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Folder name cannot be empty')
    .max(255, 'Folder name cannot exceed 255 characters')
    .refine((name) => !name.includes('/') && !name.includes('\\') && !name.includes('\0'), {
      message: 'Folder name cannot contain slashes or null characters',
    }),
  parentId: z.string().uuid('Invalid parent folder UUID').nullable().optional(),
});

export const updateFolderSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Folder name cannot be empty')
    .max(255, 'Folder name cannot exceed 255 characters')
    .refine((name) => !name.includes('/') && !name.includes('\\') && !name.includes('\0'), {
      message: 'Folder name cannot contain slashes or null characters',
    })
    .optional(),
  parentId: z.string().uuid('Invalid parent folder UUID').nullable().optional(),
}).refine((data) => data.name !== undefined || data.parentId !== undefined, {
  message: 'At least one field (name or parentId) must be provided for update',
});

export const folderIdParamSchema = z.object({
  id: z.string().refine((val) => val === 'root' || z.string().uuid().safeParse(val).success, {
    message: "Folder ID must be a valid UUID or 'root'",
  }),
});

export type CreateFolderInput = z.infer<typeof createFolderSchema>;
export type UpdateFolderInput = z.infer<typeof updateFolderSchema>;
