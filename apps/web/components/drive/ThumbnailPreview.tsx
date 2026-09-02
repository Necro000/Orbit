'use client';

import React, { useState } from 'react';
import type { FileItem } from '@/lib/folders';
import { getFileTint, getFileCategory } from '@/lib/fileTints';

interface ThumbnailPreviewProps {
  file: FileItem;
  className?: string;
}

export function ThumbnailPreview({ file, className = 'w-10 h-10' }: ThumbnailPreviewProps) {
  const [imgError, setImgError] = useState(false);
  const category = getFileCategory(file.mime_type, false);
  const isImage = category === 'image';
  const tint = getFileTint(file.mime_type, false);
  const apiUrl = process.env['NEXT_PUBLIC_API_URL'] || 'http://localhost:8080';

  if (isImage && !imgError) {
    return (
      <div className={`${className} rounded-lg bg-bg-surface border border-border-subtle flex items-center justify-center overflow-hidden relative group`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`${apiUrl}/api/files/${file.id}/preview`}
          alt={file.name}
          crossOrigin="use-credentials"
          className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105"
          onError={() => setImgError(true)}
          loading="lazy"
        />
      </div>
    );
  }

  // File Icon with exact design system tint background and text color
  return (
    <div className={`${className} rounded-lg ${tint.combinedClass} flex items-center justify-center`}>
      {category === 'image' && (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      )}

      {category === 'pdf' && (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
        </svg>
      )}

      {category === 'document' && (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      )}

      {category === 'generic' && (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
        </svg>
      )}
    </div>
  );
}
