'use client';

import React from 'react';
import type { DriveItem, FolderItem, FileItem } from '@/lib/folders';
import { formatBytes, formatDate } from '@/lib/format';
import { getFileBadge, getFileCategory } from '@/lib/fileTints';
import { ThumbnailPreview } from './ThumbnailPreview';

interface FileListProps {
  items: DriveItem[];
  selectedIds: string[];
  onSelect: (id: string, isMulti?: boolean) => void;
  onOpen: (item: DriveItem) => void;
  onContextMenu: (item: DriveItem, pos: { x: number; y: number }) => void;
  onToggleStar?: (item: DriveItem) => void;
  onDownload?: (file: FileItem) => void;
  onShare?: (item: DriveItem) => void;
}

export function FileList({
  items,
  selectedIds,
  onSelect,
  onOpen,
  onContextMenu,
  onToggleStar,
  onDownload,
  onShare,
}: FileListProps) {
  const folders = items.filter((i): i is FolderItem => i.isFolder);
  const files = items.filter((i): i is FileItem => !i.isFolder);
  const sortedItems = [...folders, ...files];

  if (items.length === 0) {
    return (
      <div className="empty-state flex flex-col items-center justify-center min-h-[300px] text-center p-8">
        <div className="w-16 h-16 rounded-[10px] bg-bg-surface border border-border-subtle flex items-center justify-center text-text-secondary mb-3">
          <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
            />
          </svg>
        </div>
        <h3 className="text-base font-semibold text-text-primary">This folder is empty</h3>
        <p className="text-xs text-text-secondary max-w-sm text-center mt-1">
          Drag and drop files here, or use the Upload button in the toolbar above.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col" role="region" aria-label="Folder contents list">
      {/* Header Bar */}
      <div className="grid grid-cols-[1fr_110px_140px_160px] items-center px-4 py-2.5 border-b border-border-subtle text-xs font-semibold text-text-secondary uppercase tracking-wider select-none">
        <div>Name</div>
        <div>Size</div>
        <div>Date Modified</div>
        <div className="text-right">Actions</div>
      </div>

      {/* Items List */}
      <div className="flex flex-col gap-1 py-1.5" role="list">
        {sortedItems.map((item) => {
          const isSelected = selectedIds.includes(item.id);
          const category = item.isFolder
            ? 'folder'
            : getFileCategory(item.mime_type, false, item.name);
          const badge = item.isFolder ? 'FOLDER' : getFileBadge(item.name, category);

          return (
            <div
              key={item.id}
              className={`group relative grid grid-cols-[1fr_110px_140px_160px] items-center px-4 py-2.5 rounded-xl transition-all duration-150 cursor-pointer select-none border ${
                isSelected
                  ? 'border-accent bg-accent/10 shadow-sm shadow-accent/5'
                  : 'border-transparent hover:border-border-subtle hover:bg-bg-surface-hover/70'
              }`}
              onClick={(e) => onSelect(item.id, e.ctrlKey || e.metaKey)}
              onDoubleClick={() => onOpen(item)}
              onContextMenu={(e) => {
                e.preventDefault();
                onContextMenu(item, { x: e.clientX, y: e.clientY });
              }}
              role="row"
              aria-selected={isSelected}
              tabIndex={0}
            >
              {/* Name Column */}
              <div className="flex items-center gap-3 min-w-0 pr-3">
                {item.isFolder ? (
                  <div className="w-8 h-8 rounded-lg bg-[#F5C84C1A] border border-[#F5C84C33] flex items-center justify-center text-[#F5C84C] flex-shrink-0">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.75}
                        d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
                      />
                    </svg>
                  </div>
                ) : (
                  <ThumbnailPreview file={item} className="w-8 h-8 flex-shrink-0" />
                )}

                <span className="text-sm font-medium text-text-primary truncate" title={item.name}>
                  {item.name}
                </span>

                {item.is_starred && (
                  <span className="text-amber-400 text-xs flex-shrink-0" title="Starred">
                    ★
                  </span>
                )}

                {badge && (
                  <span
                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase border flex-shrink-0 shadow-sm ${
                      item.isFolder
                        ? 'bg-[#F5C84C1A] text-[#F5C84C] border-[#F5C84C33]'
                        : category === 'code'
                        ? 'bg-sky-500/10 text-sky-400 border-sky-500/30'
                        : category === 'pdf'
                        ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                        : category === 'document'
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                        : category === 'archive'
                        ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                        : category === 'video'
                        ? 'bg-purple-500/10 text-purple-400 border-purple-500/30'
                        : category === 'audio'
                        ? 'bg-pink-500/10 text-pink-400 border-pink-500/30'
                        : category === 'image'
                        ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30'
                        : 'bg-slate-500/10 text-slate-400 border-slate-500/30'
                    }`}
                  >
                    {badge}
                  </span>
                )}
              </div>

              {/* Size Column */}
              <div className="text-xs text-text-secondary whitespace-nowrap">
                {formatBytes(item.size_bytes || 0)}
              </div>

              {/* Date Modified Column */}
              <div className="text-xs text-text-secondary whitespace-nowrap">
                {formatDate(item.updated_at || item.created_at)}
              </div>

              {/* Actions Column */}
              <div className="flex items-center justify-end relative">
                {/* Floating Quick Actions Pill on Hover */}
                <div
                  className="opacity-0 group-hover:opacity-100 transition-all duration-150 flex items-center gap-1 bg-bg-surface/95 backdrop-blur-md border border-border-subtle rounded-lg p-1 shadow-md shadow-black/20"
                  onClick={(e) => e.stopPropagation()}
                >
                  {onToggleStar && (
                    <button
                      type="button"
                      title={item.is_starred ? 'Unstar' : 'Star'}
                      className={`p-1.5 rounded-md transition-colors ${
                        item.is_starred
                          ? 'text-amber-400 bg-amber-400/10'
                          : 'text-text-secondary hover:text-amber-400 hover:bg-bg-surface-hover'
                      }`}
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleStar(item);
                      }}
                      aria-label={item.is_starred ? 'Unstar file' : 'Star file'}
                    >
                      <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 20 20">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                    </button>
                  )}

                  {!item.isFolder && onDownload && (
                    <button
                      type="button"
                      title="Download"
                      className="p-1.5 rounded-md text-text-secondary hover:text-text-primary hover:bg-bg-surface-hover transition-colors"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDownload(item as FileItem);
                      }}
                      aria-label="Download file"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                        />
                      </svg>
                    </button>
                  )}

                  {onShare && (
                    <button
                      type="button"
                      title="Share"
                      className="p-1.5 rounded-md text-text-secondary hover:text-text-primary hover:bg-bg-surface-hover transition-colors"
                      onClick={(e) => {
                        e.stopPropagation();
                        onShare(item);
                      }}
                      aria-label="Share file"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
                        />
                      </svg>
                    </button>
                  )}

                  <button
                    type="button"
                    title="More options"
                    className="p-1.5 rounded-md text-text-secondary hover:text-text-primary hover:bg-bg-surface-hover transition-colors"
                    onClick={(e) => {
                      e.stopPropagation();
                      const rect = e.currentTarget.getBoundingClientRect();
                      onContextMenu(item, { x: rect.left, y: rect.bottom + 4 });
                    }}
                    aria-label="More options"
                  >
                    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                    </svg>
                  </button>
                </div>

                {/* Static 3-dots when not hovering */}
                <button
                  type="button"
                  className="group-hover:opacity-0 transition-opacity p-1.5 rounded-md text-text-secondary hover:text-text-primary hover:bg-bg-surface-hover"
                  onClick={(e) => {
                    e.stopPropagation();
                    const rect = e.currentTarget.getBoundingClientRect();
                    onContextMenu(item, { x: rect.left, y: rect.bottom + 4 });
                  }}
                  aria-label={`Actions for ${item.name}`}
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"
                    />
                  </svg>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
