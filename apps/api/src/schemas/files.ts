import { z } from 'zod';

export const MAX_FILE_SIZE_BYTES = 500 * 1024 * 1024; // 500 MB

const DISALLOWED_MIME_TYPES = new Set([
  'application/x-msdownload',
  'application/x-executable',
  'application/x-sh',
  'application/x-bat',
  'application/x-msdos-program',
  'application/x-dosexec',
]);

export const initUploadSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'File name cannot be empty')
    .max(255, 'File name cannot exceed 255 characters')
    .refine((name) => !name.includes('\0') && !name.includes('..'), {
      message: 'File name cannot contain null characters or directory traversal sequences',
    }),
  mimeType: z
    .string()
    .trim()
    .min(1, 'MIME type is required')
    .refine((mime) => !DISALLOWED_MIME_TYPES.has(mime.toLowerCase()), {
      message: 'Executable and script file types are not permitted',
    }),
  sizeBytes: z
    .number()
    .int('File size must be an integer')
    .min(1, 'File size must be at least 1 byte')
    .max(MAX_FILE_SIZE_BYTES, `File exceeds maximum allowed size of 500MB`),
  folderId: z.string().uuid('Invalid folder UUID').nullable().optional(),
  checksum: z.string().trim().optional(),
});

export const completeUploadSchema = z.object({
  fileId: z.string().uuid('Invalid file UUID'),
  checksum: z.string().trim().optional(),
});

export const updateFileSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'File name cannot be empty')
    .max(255, 'File name cannot exceed 255 characters')
    .refine((name) => !name.includes('\0') && !name.includes('..'), {
      message: 'File name cannot contain null characters or directory traversal sequences',
    })
    .optional(),
  folderId: z.string().uuid('Invalid folder UUID').nullable().optional(),
}).refine((data) => data.name !== undefined || data.folderId !== undefined, {
  message: 'At least one field (name or folderId) must be provided for update',
});

export const fileIdParamSchema = z.object({
  id: z.string().uuid('Invalid file UUID'),
});

export type InitUploadInput = z.infer<typeof initUploadSchema>;
export type CompleteUploadInput = z.infer<typeof completeUploadSchema>;
export type UpdateFileInput = z.infer<typeof updateFileSchema>;
