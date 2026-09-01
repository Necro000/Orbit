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
      <div className="empty-state">
        <div className="w-16 h-16 rounded-2xl bg-slate-800/80 border border-slate-700 flex items-center justify-center text-slate-400 mb-2">
          <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
          </svg>
        </div>
        <h3 className="text-base font-semibold text-slate-200">This folder is empty</h3>
        <p className="text-xs text-slate-400 max-w-sm text-center">
          Drag and drop files here, or use the Upload button in the toolbar above.
        </p>
      </div>
    );
  }

  return (
    <div className="table-wrapper" role="region" aria-label="Folder contents table">
      <table className="file-table">
        <thead>
          <tr>
            <th scope="col" className="th-name">Name</th>
            <th scope="col" className="th-size">Size</th>
            <th scope="col" className="th-date">Date Modified</th>
            <th scope="col" className="th-actions"><span className="sr-only">Actions</span></th>
          </tr>
        </thead>
        <tbody>
          {sortedItems.map((item) => {
            const isSelected = selectedIds.includes(item.id);

            return (
              <tr
                key={item.id}
                className={`table-row${isSelected ? ' table-row--selected' : ''}`}
                onClick={(e) => onSelect(item.id, e.ctrlKey || e.metaKey)}
                onDoubleClick={() => onOpen(item)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  onContextMenu(item, { x: e.clientX, y: e.clientY });
                }}
                aria-selected={isSelected}
              >
                <td className="td-name">
                  <div className="item-name-cell">
                    {item.isFolder ? (
                      <div className="w-6 h-6 rounded bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 flex-shrink-0">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                        </svg>
                      </div>
                    ) : (
                      <ThumbnailPreview file={item} className="w-6 h-6 flex-shrink-0 rounded" />
                    )}
                    <span className="truncate" title={item.name}>
                      {item.name}
                    </span>
                  </div>
                </td>
                <td className="td-size">
                  {item.isFolder ? '—' : formatBytes(item.size_bytes)}
                </td>
                <td className="td-date">
                  {formatDate(item.updated_at || item.created_at)}
                </td>
                <td className="td-actions">
                  <button
                    type="button"
                    className="action-icon-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      onContextMenu(item, { x: e.clientX, y: e.clientY });
                    }}
                    aria-label={`Actions for ${item.name}`}
                  >
                    <svg className="w-4 h-4 text-slate-400 hover:text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
