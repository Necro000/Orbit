'use client';

import React from 'react';
import type { DriveItem, FolderItem, FileItem } from '@/lib/folders';
import { formatBytes, formatDate } from '@/lib/format';
import { Icon, getFileIconName } from '../ui/Icons';

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
        <Icon name="folder-open" className="w-16 h-16 text-muted mb-4" />
        <h3 className="empty-state-title">This folder is empty</h3>
        <p className="empty-state-subtitle">Drag and drop files here, or use the Upload button above.</p>
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
            const iconName = item.isFolder
              ? 'folder'
              : getFileIconName(item.mime_type, item.name);

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
                    <Icon
                      name={iconName}
                      className={`w-5 h-5 flex-shrink-0 ${item.isFolder ? 'text-warning' : 'text-primary'}`}
                    />
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
                    <Icon name="more" className="w-4 h-4" />
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
