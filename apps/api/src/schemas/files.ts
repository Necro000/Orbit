import { z } from 'zod';

export const MAX_VIDEO_SIZE_BYTES = 2 * 1024 * 1024 * 1024; // 2 GB
export const MAX_AUDIO_SIZE_BYTES = 250 * 1024 * 1024; // 250 MB
export const MAX_IMAGE_SIZE_BYTES = 100 * 1024 * 1024; // 100 MB
export const MAX_FILE_SIZE_BYTES = 1024 * 1024 * 1024; // 1 GB (docs, archives, generic)

const DISALLOWED_MIME_TYPES = new Set([
  'application/x-msdownload',
  'application/x-executable',
  'application/x-sh',
  'application/x-bat',
  'application/x-msdos-program',
  'application/x-dosexec',
]);

export function getMaxAllowedSizeBytes(name: string, mimeType: string): { limit: number; label: string } {
  const ext = name.split('.').pop()?.toLowerCase() || '';
  const mime = mimeType.toLowerCase();

  // Video
  if (mime.startsWith('video/') || ['mp4', 'webm', 'mov', 'mkv', 'avi', 'wmv', 'flv'].includes(ext)) {
    return { limit: MAX_VIDEO_SIZE_BYTES, label: '2 GB for video files' };
  }

  // Audio
  if (mime.startsWith('audio/') || ['mp3', 'wav', 'ogg', 'flac', 'm4a', 'aac', 'wma'].includes(ext)) {
    return { limit: MAX_AUDIO_SIZE_BYTES, label: '250 MB for audio files' };
  }

  // Images
  if (
    mime.startsWith('image/') ||
    ['png', 'jpg', 'jpeg', 'jfif', 'webp', 'avif', 'heic', 'heif', 'svg', 'gif', 'bmp', 'ico', 'tiff'].includes(ext)
  ) {
    return { limit: MAX_IMAGE_SIZE_BYTES, label: '100 MB for image files' };
  }

  // General documents / archives
  return { limit: MAX_FILE_SIZE_BYTES, label: '1 GB for general files' };
}

export const initUploadSchema = z
  .object({
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
      .max(MAX_VIDEO_SIZE_BYTES, 'File exceeds absolute maximum allowed size of 2 GB'),
    folderId: z.string().uuid('Invalid folder UUID').nullable().optional(),
    fileId: z.string().uuid('Invalid file UUID').optional(), // If supplied, upload is a new version of this existing file
    checksum: z.string().trim().optional(),
  })
  .superRefine((data, ctx) => {
    const { limit, label } = getMaxAllowedSizeBytes(data.name, data.mimeType);
    if (data.sizeBytes > limit) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `File exceeds maximum allowed size (${label})`,
        path: ['sizeBytes'],
      });
    }
  });

export const completeUploadSchema = z.object({
  fileId: z.string().uuid('Invalid file UUID'),
  checksum: z.string().trim().optional(),
});

export const updateFileSchema = z
  .object({
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
  })
  .refine((data) => data.name !== undefined || data.folderId !== undefined, {
    message: 'At least one field (name or folderId) must be provided for update',
  });

export const fileIdParamSchema = z.object({
  id: z.string().uuid('Invalid file UUID'),
});

export const versionIdParamSchema = z.object({
  id: z.string().uuid('Invalid file UUID'),
  versionId: z.string().uuid('Invalid version UUID'),
});

export const revertVersionSchema = z.object({
  expectedCurrentVersionId: z.string().uuid('Invalid current version UUID').optional(),
});

export type InitUploadInput = z.infer<typeof initUploadSchema>;
export type CompleteUploadInput = z.infer<typeof completeUploadSchema>;
export type UpdateFileInput = z.infer<typeof updateFileSchema>;
export type RevertVersionInput = z.infer<typeof revertVersionSchema>;
