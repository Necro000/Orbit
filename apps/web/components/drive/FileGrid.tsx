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
  onToggleStar?: (item: DriveItem) => void;
  onDownload?: (item: FileItem) => void;
}

export function FileGrid({
  items,
  selectedIds,
  onSelect,
  onOpen,
  onContextMenu,
  onToggleStar,
  onDownload,
}: FileGridProps) {
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
                  className={`group relative flex items-center gap-3 bg-bg-surface rounded-xl p-3 hover:bg-bg-surface-hover hover:border-accent/40 hover:-translate-y-0.5 transition-all duration-200 shadow-sm hover:shadow-md cursor-pointer select-none border ${
                    isSelected
                      ? 'border-accent bg-accent/10 shadow-accent/20 ring-1 ring-accent'
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
                  {/* Folder Icon Tint */}
                  <div className="w-9 h-9 rounded-lg bg-[#F5C84C1A] border border-[#F5C84C33] flex items-center justify-center text-[#F5C84C] flex-shrink-0">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                    </svg>
                  </div>
                  <span className="text-sm font-medium text-text-primary truncate flex-1" title={folder.name}>
                    {folder.name}
                  </span>

                  {folder.is_starred && (
                    <span className="text-amber-400 text-xs flex-shrink-0" title="Starred">★</span>
                  )}
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
                  className={`group relative flex flex-col bg-bg-surface rounded-xl p-3 hover:bg-bg-surface-hover hover:border-accent/40 hover:-translate-y-0.5 transition-all duration-200 shadow-sm hover:shadow-md cursor-pointer select-none border ${
                    isSelected
                      ? 'border-accent bg-accent/10 shadow-accent/20 ring-1 ring-accent'
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
                  {/* Floating Quick Action Pill on Hover */}
                  <div
                    className="absolute top-4 right-4 z-20 opacity-0 group-hover:opacity-100 transition-opacity duration-150 flex items-center gap-1 bg-bg-surface/90 backdrop-blur-md border border-border-subtle rounded-lg p-1 shadow-lg"
                    onClick={(e) => e.stopPropagation()}
                    onDoubleClick={(e) => e.stopPropagation()}
                  >
                    {/* Star Button */}
                    {onToggleStar && (
                      <button
                        type="button"
                        tabIndex={-1}
                        title={file.is_starred ? 'Unstar' : 'Star'}
                        className={`p-1 rounded-md hover:bg-bg-surface-hover transition-colors ${
                          file.is_starred ? 'text-amber-400' : 'text-text-secondary hover:text-amber-400'
                        }`}
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleStar(file);
                        }}
                        aria-label={file.is_starred ? 'Unstar file' : 'Star file'}
                      >
                        <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 20 20">
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                      </button>
                    )}

                    {/* Download Button */}
                    {onDownload && (
                      <button
                        type="button"
                        tabIndex={-1}
                        title="Download"
                        className="p-1 rounded-md text-text-secondary hover:text-text-primary hover:bg-bg-surface-hover transition-colors"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDownload(file);
                        }}
                        aria-label="Download file"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                      </button>
                    )}

                    {/* 3-Dots Context Menu Button */}
                    <button
                      type="button"
                      tabIndex={-1}
                      title="More options"
                      className="p-1 rounded-md text-text-secondary hover:text-text-primary hover:bg-bg-surface-hover transition-colors"
                      onClick={(e) => {
                        e.stopPropagation();
                        const rect = e.currentTarget.getBoundingClientRect();
                        onContextMenu(file, { x: rect.left, y: rect.bottom + 4 });
                      }}
                      aria-label="More file actions"
                    >
                      <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                      </svg>
                    </button>
                  </div>

                  <div className="w-full h-32 rounded-lg overflow-hidden mb-2.5 bg-bg-surface flex items-center justify-center relative">
                    <ThumbnailPreview file={file} className="w-full h-full" variant="card" />
                  </div>
                  <div className="flex flex-col gap-0.5 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-sm font-medium text-text-primary truncate" title={file.name}>
                        {file.name}
                      </span>
                      {file.is_starred && (
                        <span className="text-amber-400 flex-shrink-0 text-xs" title="Starred">★</span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-text-secondary">
                      <span>{formatBytes(file.size_bytes)}</span>
                      {file.updated_at && (
                        <>
                          <span>•</span>
                          <span className="truncate">
                            {new Date(file.updated_at).toLocaleDateString(undefined, {
                              month: 'short',
                              day: 'numeric',
                            })}
                          </span>
                        </>
                      )}
                    </div>
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
