'use client';

import React from 'react';
import type { DriveItem, FolderItem, FileItem } from '@/lib/folders';
import { formatBytes } from '@/lib/format';
import { Icon, getFileIconName } from '../ui/Icons';

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
      <div className="empty-state">
        <Icon name="folder-open" className="w-16 h-16 text-muted mb-4" />
        <h3 className="empty-state-title">This folder is empty</h3>
        <p className="empty-state-subtitle">Drag and drop files here, or use the Upload button above.</p>
      </div>
    );
  }

  return (
    <div className="file-grid-layout">
      {folders.length > 0 && (
        <section aria-label="Folders" className="grid-section">
          <h3 className="section-title">Folders</h3>
          <div className="grid-cards-container">
            {folders.map((folder) => {
              const isSelected = selectedIds.includes(folder.id);
              return (
                <div
                  key={folder.id}
                  className={`card folder-card${isSelected ? ' card--selected' : ''}`}
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
                  <Icon name="folder" className="w-8 h-8 text-warning flex-shrink-0" />
                  <span className="card-name" title={folder.name}>
                    {folder.name}
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {files.length > 0 && (
        <section aria-label="Files" className="grid-section">
          <h3 className="section-title">Files</h3>
          <div className="grid-cards-container">
            {files.map((file) => {
              const isSelected = selectedIds.includes(file.id);
              const iconName = getFileIconName(file.mime_type, file.name);
              return (
                <div
                  key={file.id}
                  className={`card file-card${isSelected ? ' card--selected' : ''}`}
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
                  <div className="file-card-preview">
                    <Icon name={iconName} className="w-12 h-12 text-primary" />
                  </div>
                  <div className="file-card-meta">
                    <span className="card-name" title={file.name}>
                      {file.name}
                    </span>
                    <span className="card-size">{formatBytes(file.size_bytes)}</span>
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
