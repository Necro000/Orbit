/**
 * File Type Tints Helper — Orbit Visual Design System
 * 
 * Maps resource mime types / folder types to the exact design system colors:
 * - Folder:   bg-[#F5C84C1A] text-[#F5C84C] (soft yellow)
 * - Image:    bg-[#6366F11A] text-[#6366F1] (soft indigo)
 * - PDF:      bg-[#EF44441A] text-[#EF4444] (soft red)
 * - Document: bg-[#22C55E1A] text-[#22C55E] (soft green)
 * - Generic:  bg-[#8B8B961A] text-[#8B8B96] (soft gray)
 */

export type FileCategory =
  | 'folder'
  | 'image'
  | 'pdf'
  | 'code'
  | 'document'
  | 'archive'
  | 'video'
  | 'audio'
  | 'generic';

export interface FileTintConfig {
  category: FileCategory;
  bgClass: string;
  textClass: string;
  borderClass: string;
  combinedClass: string;
}

export function getFileCategory(
  mimeType?: string,
  isFolder?: boolean,
  fileName?: string
): FileCategory {
  if (isFolder) return 'folder';

  const ext = fileName ? fileName.split('.').pop()?.toLowerCase() : '';

  // Code extensions
  if (
    ext &&
    [
      'ts', 'tsx', 'js', 'jsx', 'json', 'py', 'html', 'css', 'scss',
      'rs', 'go', 'sql', 'md', 'mdx', 'yml', 'yaml', 'sh', 'bash',
      'c', 'cpp', 'h', 'hpp', 'java', 'kt', 'php', 'rb', 'dockerfile'
    ].includes(ext)
  ) {
    return 'code';
  }

  // Image extensions / mime
  if (
    mimeType?.startsWith('image/') ||
    (ext && ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'ico'].includes(ext))
  ) {
    return 'image';
  }

  // PDF
  if (mimeType === 'application/pdf' || ext === 'pdf') {
    return 'pdf';
  }

  // Video
  if (
    mimeType?.startsWith('video/') ||
    (ext && ['mp4', 'webm', 'mov', 'mkv', 'avi', 'wmv'].includes(ext))
  ) {
    return 'video';
  }

  // Audio
  if (
    mimeType?.startsWith('audio/') ||
    (ext && ['mp3', 'wav', 'ogg', 'flac', 'm4a', 'aac'].includes(ext))
  ) {
    return 'audio';
  }

  // Archive
  if (
    (ext && ['zip', 'tar', 'gz', 'rar', '7z', 'bz2', 'tgz', 'xz'].includes(ext)) ||
    mimeType === 'application/zip' ||
    mimeType === 'application/x-tar' ||
    mimeType === 'application/gzip'
  ) {
    return 'archive';
  }

  // Code mime types
  if (
    mimeType &&
    (mimeType === 'application/json' ||
      mimeType.startsWith('text/x-') ||
      mimeType === 'application/javascript' ||
      mimeType === 'text/javascript' ||
      mimeType === 'application/typescript' ||
      mimeType === 'text/typescript')
  ) {
    return 'code';
  }

  // Documents
  if (
    (ext && ['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'csv', 'txt', 'rtf'].includes(ext)) ||
    (mimeType &&
      (mimeType.startsWith('text/') ||
        mimeType.includes('document') ||
        mimeType.includes('sheet') ||
        mimeType.includes('presentation') ||
        mimeType.includes('officedocument') ||
        mimeType.includes('msword') ||
        mimeType.includes('excel') ||
        mimeType.includes('powerpoint')))
  ) {
    return 'document';
  }

  return 'generic';
}

export function getFileBadge(fileName?: string, category?: FileCategory): string {
  if (!fileName) return category ? category.toUpperCase() : 'FILE';
  const parts = fileName.split('.');
  if (parts.length > 1) {
    const ext = parts.pop()?.toUpperCase() || '';
    if (ext.length <= 4) return ext;
  }
  return category ? category.toUpperCase() : 'FILE';
}

export function getFileTint(
  mimeType?: string,
  isFolder?: boolean,
  fileName?: string
): FileTintConfig {
  const category = getFileCategory(mimeType, isFolder, fileName);

  switch (category) {
    case 'folder':
      return {
        category,
        bgClass: 'bg-[#F5C84C1A]',
        textClass: 'text-[#F5C84C]',
        borderClass: 'border-[#F5C84C33]',
        combinedClass: 'bg-[#F5C84C1A] text-[#F5C84C] border border-[#F5C84C33]',
      };
    case 'code':
      return {
        category,
        bgClass: 'bg-[#0284C71A]',
        textClass: 'text-[#0284C7]',
        borderClass: 'border-[#0284C733]',
        combinedClass: 'bg-[#0284C71A] text-[#0284C7] border border-[#0284C733]',
      };
    case 'image':
      return {
        category,
        bgClass: 'bg-[#6366F11A]',
        textClass: 'text-[#6366F1]',
        borderClass: 'border-[#6366F133]',
        combinedClass: 'bg-[#6366F11A] text-[#6366F1] border border-[#6366F133]',
      };
    case 'pdf':
      return {
        category,
        bgClass: 'bg-[#EF44441A]',
        textClass: 'text-[#EF4444]',
        borderClass: 'border-[#EF444433]',
        combinedClass: 'bg-[#EF44441A] text-[#EF4444] border border-[#EF444433]',
      };
    case 'document':
      return {
        category,
        bgClass: 'bg-[#22C55E1A]',
        textClass: 'text-[#22C55E]',
        borderClass: 'border-[#22C55E33]',
        combinedClass: 'bg-[#22C55E1A] text-[#22C55E] border border-[#22C55E33]',
      };
    case 'archive':
      return {
        category,
        bgClass: 'bg-[#F59E0B1A]',
        textClass: 'text-[#F59E0B]',
        borderClass: 'border-[#F59E0B33]',
        combinedClass: 'bg-[#F59E0B1A] text-[#F59E0B] border border-[#F59E0B33]',
      };
    case 'video':
      return {
        category,
        bgClass: 'bg-[#8B5CF61A]',
        textClass: 'text-[#8B5CF6]',
        borderClass: 'border-[#8B5CF633]',
        combinedClass: 'bg-[#8B5CF61A] text-[#8B5CF6] border border-[#8B5CF633]',
      };
    case 'audio':
      return {
        category,
        bgClass: 'bg-[#EC48991A]',
        textClass: 'text-[#EC4899]',
        borderClass: 'border-[#EC489933]',
        combinedClass: 'bg-[#EC48991A] text-[#EC4899] border border-[#EC489933]',
      };
    case 'generic':
    default:
      return {
        category,
        bgClass: 'bg-[#8B8B961A]',
        textClass: 'text-[#8B8B96]',
        borderClass: 'border-[#8B8B9633]',
        combinedClass: 'bg-[#8B8B961A] text-[#8B8B96] border border-[#8B8B9633]',
      };
  }
}
