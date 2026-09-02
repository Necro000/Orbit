'use client';

import React from 'react';
import type { DriveItem, FolderItem, FileItem } from '@/lib/folders';
import { formatBytes, formatDate } from '@/lib/format';
import { ThumbnailPreview } from './ThumbnailPreview';

interface FileListProps {
  items: DriveItem[];
  selectedIds: string[];
  onSelect: (id: string, isMulti?: boolean) => void;
  onOpen: (item: DriveItem) => void;
  onContextMenu: (item: DriveItem, pos: { x: number; y: number }) => void;
}

export function FileList({ items, selectedIds, onSelect, onOpen, onContextMenu }: FileListProps) {
  const folders = items.filter((i): i is FolderItem => i.isFolder);
  const files = items.filter((i): i is FileItem => !i.isFolder);
  const sortedItems = [...folders, ...files];

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
    <div className="w-full overflow-x-auto" role="region" aria-label="Folder contents table">
      <table className="w-full border-collapse text-sm text-left">
        <thead>
          <tr className="border-b border-border-subtle">
            <th scope="col" className="py-3 px-4 text-xs font-semibold text-text-secondary uppercase tracking-[0.05em]">Name</th>
            <th scope="col" className="py-3 px-4 text-xs font-semibold text-text-secondary uppercase tracking-[0.05em]">Size</th>
            <th scope="col" className="py-3 px-4 text-xs font-semibold text-text-secondary uppercase tracking-[0.05em]">Date Modified</th>
            <th scope="col" className="py-3 px-4 text-xs font-semibold text-text-secondary uppercase tracking-[0.05em]"><span className="sr-only">Actions</span></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border-subtle">
          {sortedItems.map((item) => {
            const isSelected = selectedIds.includes(item.id);

            return (
              <tr
                key={item.id}
                className={`transition-colors cursor-pointer select-none ${
                  isSelected
                    ? 'bg-accent/10'
                    : 'hover:bg-bg-surface-hover'
                }`}
                onClick={(e) => onSelect(item.id, e.ctrlKey || e.metaKey)}
                onDoubleClick={() => onOpen(item)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  onContextMenu(item, { x: e.clientX, y: e.clientY });
                }}
                aria-selected={isSelected}
              >
                <td className="py-3 px-4">
                  <div className="flex items-center gap-3">
                    {item.isFolder ? (
                      <div className="w-7 h-7 rounded-lg bg-[#F5C84C1A] border border-[#F5C84C33] flex items-center justify-center text-[#F5C84C] flex-shrink-0">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                        </svg>
                      </div>
                    ) : (
                      <ThumbnailPreview file={item} className="w-7 h-7 flex-shrink-0" />
                    )}
                    <span className="text-sm font-medium text-text-primary truncate" title={item.name}>
                      {item.name}
                    </span>
                  </div>
                </td>
                <td className="py-3 px-4 text-xs text-text-secondary whitespace-nowrap">
                  {item.isFolder ? '—' : formatBytes(item.size_bytes)}
                </td>
                <td className="py-3 px-4 text-xs text-text-secondary whitespace-nowrap">
                  {formatDate(item.updated_at || item.created_at)}
                </td>
                <td className="py-3 px-4 text-right">
                  <button
                    type="button"
                    className="p-1.5 rounded-md text-text-secondary hover:text-text-primary hover:bg-bg-surface-hover transition-colors"
                    onClick={(e) => {
                      e.stopPropagation();
                      onContextMenu(item, { x: e.clientX, y: e.clientY });
                    }}
                    aria-label={`Actions for ${item.name}`}
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                    </svg>
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
