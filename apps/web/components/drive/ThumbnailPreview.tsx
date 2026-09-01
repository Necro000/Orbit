'use client';

import React, { useState } from 'react';
import type { FileItem } from '@/lib/folders';

interface ThumbnailPreviewProps {
  file: FileItem;
  className?: string;
}

export function ThumbnailPreview({ file, className = 'w-10 h-10' }: ThumbnailPreviewProps) {
  const [imgError, setImgError] = useState(false);
  const isImage = file.mime_type.startsWith('image/');
  const isPdf = file.mime_type === 'application/pdf';
  const isDoc =
    file.mime_type.startsWith('text/') ||
    file.mime_type.includes('document') ||
    file.mime_type.includes('sheet') ||
    file.mime_type.includes('presentation');
  const apiUrl = process.env['NEXT_PUBLIC_API_URL'] || 'http://localhost:8080';

  if (isImage && !imgError) {
    return (
      <div className={`${className} rounded-lg bg-[#1A1A22] border border-[#2A2A35] flex items-center justify-center overflow-hidden relative group`}>
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

  if (isImage) {
    return (
      <div className={`${className} rounded-lg bg-[#6366F11A] border border-[#6366F133] flex items-center justify-center text-[#6366F1]`}>
        <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      </div>
    );
  }

  if (isPdf) {
    return (
      <div className={`${className} rounded-lg bg-[#EF44441A] border border-[#EF444433] flex items-center justify-center text-[#EF4444]`}>
        <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
        </svg>
      </div>
    );
  }

  if (isDoc) {
    return (
      <div className={`${className} rounded-lg bg-[#22C55E1A] border border-[#22C55E33] flex items-center justify-center text-[#22C55E]`}>
        <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      </div>
    );
  }

  return (
    <div className={`${className} rounded-lg bg-[#8B8B961A] border border-[#8B8B9633] flex items-center justify-center text-[#8B8B96]`}>
      <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
      </svg>
    </div>
  );
}
