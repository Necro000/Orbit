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

export type FileCategory = 'folder' | 'image' | 'pdf' | 'document' | 'generic';

export interface FileTintConfig {
  category: FileCategory;
  bgClass: string;
  textClass: string;
  borderClass: string;
  combinedClass: string;
}

export function getFileCategory(mimeType?: string, isFolder?: boolean): FileCategory {
  if (isFolder) return 'folder';
  if (!mimeType) return 'generic';

  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType === 'application/pdf') return 'pdf';
  if (
    mimeType.startsWith('text/') ||
    mimeType.includes('document') ||
    mimeType.includes('sheet') ||
    mimeType.includes('presentation') ||
    mimeType.includes('officedocument') ||
    mimeType.includes('msword') ||
    mimeType.includes('excel') ||
    mimeType.includes('powerpoint')
  ) {
    return 'document';
  }

  return 'generic';
}

export function getFileTint(mimeType?: string, isFolder?: boolean): FileTintConfig {
  const category = getFileCategory(mimeType, isFolder);

  switch (category) {
    case 'folder':
      return {
        category,
        bgClass: 'bg-[#F5C84C1A]',
        textClass: 'text-[#F5C84C]',
        borderClass: 'border-[#F5C84C33]',
        combinedClass: 'bg-[#F5C84C1A] text-[#F5C84C] border border-[#F5C84C33]',
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
