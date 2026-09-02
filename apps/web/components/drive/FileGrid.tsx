'use client';

import React from 'react';
import type { DriveItem, FolderItem, FileItem } from '@/lib/folders';
import { formatBytes } from '@/lib/format';
import { ThumbnailPreview } from './ThumbnailPreview';

interface FileGridProps {
  items: DriveItem[];
  selectedIds: string[];
  onSelect: (id: string, isMulti?: boolean) => void;
  onOpen: (item: DriveItem) => void;
  onContextMenu: (item: DriveItem, pos: { x: number; y: number }) => void;
}

export function FileGrid({ items, selectedIds, onSelect, onOpen, onContextMenu }: FileGridProps) {
  const folders = items.filter((i): i is FolderItem => i.isFolder);
  const files = items.filter((i): i is FileItem => !i.isFolder);

  if (items.length === 0) {
    return (
      <div className="empty-state flex flex-col items-center justify-center min-h-[300px] text-center p-8">
        <div className="w-16 h-16 rounded-[10px] bg-bg-surface border border-border-subtle flex items-center justify-center text-text-secondary mb-3">
          <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
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
    <div className="space-y-6 w-full">
      {/* Folders Section */}
      {folders.length > 0 && (
        <section aria-label="Folders">
          <div className="flex items-center gap-2 mb-3">
            <h3 className="text-xs uppercase tracking-wider font-semibold text-text-secondary">
              FOLDERS
            </h3>
            <span className="text-xs text-text-secondary">
              • {folders.length} {folders.length === 1 ? 'folder' : 'folders'}
            </span>
          </div>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-4">
            {folders.map((folder) => {
              const isSelected = selectedIds.includes(folder.id);
              return (
                <div
                  key={folder.id}
                  className={`group relative flex items-center gap-3 bg-bg-surface rounded-[10px] p-3 hover:bg-bg-surface-hover transition-all duration-200 shadow-sm cursor-pointer select-none border ${isSelected
                      ? 'border-accent bg-accent/10 shadow-accent/20'
                      : 'border-border-subtle'
                    }`}
                  onClick={(e) => onSelect(folder.id, e.ctrlKey || e.metaKey)}
                  onDoubleClick={() => onOpen(folder)}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    onContextMenu(folder, { x: e.clientX, y: e.clientY });
                  }}
                  role="button"
                  tabIndex={0}
                  aria-pressed={isSelected}
                >
                  {/* Folder Icon Tint: bg-[#F5C84C1A] text-[#F5C84C] */}
                  <div className="w-9 h-9 rounded-lg bg-[#F5C84C1A] border border-[#F5C84C33] flex items-center justify-center text-[#F5C84C] flex-shrink-0">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                    </svg>
                  </div>
                  <span className="text-sm font-medium text-text-primary truncate flex-1" title={folder.name}>
                    {folder.name}
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Files Section */}
      {files.length > 0 && (
        <section aria-label="Files">
          <div className="flex items-center gap-2 mb-3">
            <h3 className="text-xs uppercase tracking-wider font-semibold text-text-secondary">
              FILES
            </h3>
            <span className="text-xs text-text-secondary">
              • {files.length} {files.length === 1 ? 'file' : 'files'}
            </span>
          </div>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-4">
            {files.map((file) => {
              const isSelected = selectedIds.includes(file.id);
              return (
                <div
                  key={file.id}
                  className={`group relative flex flex-col bg-bg-surface rounded-[10px] p-3 hover:bg-bg-surface-hover transition-all duration-200 shadow-sm cursor-pointer select-none border ${isSelected
                      ? 'border-accent bg-accent/10 shadow-accent/20'
                      : 'border-border-subtle'
                    }`}
                  onClick={(e) => onSelect(file.id, e.ctrlKey || e.metaKey)}
                  onDoubleClick={() => onOpen(file)}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    onContextMenu(file, { x: e.clientX, y: e.clientY });
                  }}
                  role="button"
                  tabIndex={0}
                  aria-pressed={isSelected}
                >
                  <div className="w-full h-32 rounded-lg overflow-hidden mb-2.5 bg-bg-surface flex items-center justify-center">
                    <ThumbnailPreview file={file} className="w-full h-full" />
                  </div>
                  <div className="flex flex-col gap-0.5 min-w-0">
                    <span className="text-sm font-medium text-text-primary truncate" title={file.name}>
                      {file.name}
                    </span>
                    <span className="text-xs text-text-secondary">
                      {formatBytes(file.size_bytes)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
