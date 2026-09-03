'use client';

import React, { useState } from 'react';
import type { FileItem } from '@/lib/folders';
import { getFileTint, getFileCategory, getFileBadge } from '@/lib/fileTints';

interface ThumbnailPreviewProps {
  file: FileItem;
  className?: string;
  variant?: 'thumbnail' | 'card';
}

export function ThumbnailPreview({
  file,
  className = 'w-10 h-10',
  variant,
}: ThumbnailPreviewProps) {
  const [imgError, setImgError] = useState(false);
  const category = getFileCategory(file.mime_type, false, file.name);
  const isImage = category === 'image';
  const tint = getFileTint(file.mime_type, false, file.name);
  const badge = getFileBadge(file.name, category);
  const apiUrl = process.env['NEXT_PUBLIC_API_URL'] || 'http://localhost:8080';

  const isCard = variant === 'card' || className.includes('w-full') || className.includes('h-full') || className.includes('h-32');

  if (isImage && !imgError) {
    return (
      <div
        className={`${className} rounded-lg bg-bg-surface border border-border-subtle flex items-center justify-center overflow-hidden relative group`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`${apiUrl}/api/files/${file.id}/preview`}
          alt={file.name}
          crossOrigin="use-credentials"
          className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105"
          onError={() => setImgError(true)}
          loading="lazy"
        />
        {isCard && (
          <span className="absolute top-2 left-2 px-1.5 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase bg-black/60 backdrop-blur-md text-white border border-white/10 shadow-sm pointer-events-none">
            {badge}
          </span>
        )}
      </div>
    );
  }

  // Card view (e.g. in grid mode)
  if (isCard) {
    return (
      <div
        className={`${className} rounded-lg ${tint.bgClass} border ${tint.borderClass} relative overflow-hidden flex flex-col items-center justify-center select-none transition-all duration-200`}
      >
        {/* Category / Extension Badge */}
        <div className="absolute top-2 left-2 z-10">
          <span
            className={`px-1.5 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase border shadow-sm ${
              category === 'code'
                ? 'bg-sky-600/90 text-white border-sky-400/40 shadow-sky-600/20'
                : category === 'pdf'
                ? 'bg-red-600/90 text-white border-red-400/40 shadow-red-600/20'
                : category === 'document'
                ? 'bg-emerald-600/90 text-white border-emerald-400/40 shadow-emerald-600/20'
                : category === 'archive'
                ? 'bg-amber-600/90 text-white border-amber-400/40 shadow-amber-600/20'
                : category === 'video'
                ? 'bg-purple-600/90 text-white border-purple-400/40 shadow-purple-600/20'
                : category === 'audio'
                ? 'bg-pink-600/90 text-white border-pink-400/40 shadow-pink-600/20'
                : 'bg-slate-700/90 text-slate-200 border-slate-600 shadow-sm'
            }`}
          >
            {badge}
          </span>
        </div>

        {/* Faux Code Syntax Texture for Code Files */}
        {category === 'code' ? (
          <div className="absolute inset-0 p-3 pt-8 opacity-25 flex flex-col justify-between font-mono text-[9px] pointer-events-none select-none">
            <div className="space-y-1">
              <div className="flex gap-1.5 items-center">
                <span className="w-8 h-1.5 rounded-sm bg-sky-400"></span>
                <span className="w-14 h-1.5 rounded-sm bg-indigo-400"></span>
                <span className="w-6 h-1.5 rounded-sm bg-slate-400"></span>
              </div>
              <div className="flex gap-1.5 items-center pl-3">
                <span className="w-10 h-1.5 rounded-sm bg-purple-400"></span>
                <span className="w-16 h-1.5 rounded-sm bg-amber-400"></span>
              </div>
              <div className="flex gap-1.5 items-center pl-3">
                <span className="w-6 h-1.5 rounded-sm bg-sky-400"></span>
                <span className="w-12 h-1.5 rounded-sm bg-slate-400"></span>
                <span className="w-8 h-1.5 rounded-sm bg-emerald-400"></span>
              </div>
              <div className="flex gap-1.5 items-center">
                <span className="w-5 h-1.5 rounded-sm bg-sky-400"></span>
              </div>
            </div>
            {/* Center Code Glyph */}
            <div className="self-center my-auto p-2 rounded-xl bg-bg-surface/80 border border-border-subtle shadow-md text-sky-400">
              <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
              </svg>
            </div>
          </div>
        ) : (
          <div className={`p-3 rounded-2xl bg-bg-surface/80 border border-border-subtle shadow-md ${tint.textClass}`}>
            {category === 'pdf' && (
              <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
            )}

            {category === 'document' && (
              <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            )}

            {category === 'archive' && (
              <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
              </svg>
            )}

            {category === 'video' && (
              <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            )}

            {category === 'audio' && (
              <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
              </svg>
            )}

            {category === 'generic' && (
              <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
            )}
          </div>
        )}
      </div>
    );
  }

  // Compact Thumbnail / List view
  return (
    <div className={`${className} rounded-lg ${tint.combinedClass} flex items-center justify-center flex-shrink-0`}>
      {category === 'code' && (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
        </svg>
      )}

      {category === 'image' && (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      )}

      {category === 'pdf' && (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
        </svg>
      )}

      {category === 'document' && (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      )}

      {category === 'archive' && (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
        </svg>
      )}

      {category === 'video' && (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
      )}

      {category === 'audio' && (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
        </svg>
      )}

      {category === 'generic' && (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
        </svg>
      )}
    </div>
  );
}
