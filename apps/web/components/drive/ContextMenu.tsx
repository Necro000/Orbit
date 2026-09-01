'use client';

import React, { useEffect, useRef } from 'react';
import type { DriveItem } from '@/lib/folders';
import { Icon } from '../ui/Icons';

export interface ContextMenuProps {
  item: DriveItem | null;
  position: { x: number; y: number } | null;
  onClose: () => void;
  onOpen: (item: DriveItem) => void;
  onDownload: (item: DriveItem) => void;
  onRename: (item: DriveItem) => void;
  onDelete: (item: DriveItem) => void;
  onShare?: (item: DriveItem) => void;
  onPublicLink?: (item: DriveItem) => void;
  onToggleStar?: (item: DriveItem) => void;
  onDetails?: (item: DriveItem) => void;
}

export function ContextMenu({
  item,
  position,
  onClose,
  onOpen,
  onDownload,
  onRename,
  onDelete,
  onShare,
  onPublicLink,
  onToggleStar,
  onDetails,
}: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }

    if (position) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [position, onClose]);

  if (!position || !item) return null;

  const isViewer = item.role === 'viewer';
  const isStarred = Boolean(item.is_starred);

  return (
    <div
      ref={menuRef}
      className="context-menu"
      style={{
        top: `${Math.min(position.y, window.innerHeight - 320)}px`,
        left: `${Math.min(position.x, window.innerWidth - 220)}px`,
      }}
      role="menu"
      aria-label="Item actions"
    >
      <button
        type="button"
        className="context-menu-item"
        role="menuitem"
        onClick={() => {
          onOpen(item);
          onClose();
        }}
      >
        <Icon name={item.isFolder ? 'folder-open' : 'file'} className="w-4 h-4" />
        <span>Open</span>
      </button>

      {!item.isFolder && (
        <button
          type="button"
          className="context-menu-item"
          role="menuitem"
          onClick={() => {
            onDownload(item);
            onClose();
          }}
        >
          <Icon name="download" className="w-4 h-4" />
          <span>Download</span>
        </button>
      )}

      {onToggleStar && (
        <button
          type="button"
          className="context-menu-item"
          role="menuitem"
          onClick={() => {
            onToggleStar(item);
            onClose();
          }}
        >
          <Icon name="star" className={`w-4 h-4 ${isStarred ? 'text-amber-400 fill-amber-400' : ''}`} />
          <span>{isStarred ? 'Remove from Starred' : 'Add to Starred'}</span>
        </button>
      )}

      {!isViewer && (
        <button
          type="button"
          className="context-menu-item"
          role="menuitem"
          onClick={() => {
            onRename(item);
            onClose();
          }}
        >
          <Icon name="edit" className="w-4 h-4" />
          <span>Rename</span>
        </button>
      )}

      <div className="context-menu-divider" role="separator" />

      {onShare && (
        <button
          type="button"
          className="context-menu-item"
          role="menuitem"
          onClick={() => {
            onShare(item);
            onClose();
          }}
        >
          <Icon name="share" className="w-4 h-4" />
          <span>Share...</span>
        </button>
      )}

      {onPublicLink && (
        <button
          type="button"
          className="context-menu-item"
          role="menuitem"
          onClick={() => {
            onPublicLink(item);
            onClose();
          }}
        >
          <Icon name="link" className="w-4 h-4" />
          <span>Get Public Link</span>
        </button>
      )}

      {onDetails && (
        <button
          type="button"
          className="context-menu-item"
          role="menuitem"
          onClick={() => {
            onDetails(item);
            onClose();
          }}
        >
          <Icon name="info" className="w-4 h-4" />
          <span>Details & Activity</span>
        </button>
      )}

      {!isViewer && (
        <>
          <div className="context-menu-divider" role="separator" />
          <button
            type="button"
            className="context-menu-item context-menu-item--danger"
            role="menuitem"
            onClick={() => {
              onDelete(item);
              onClose();
            }}
          >
            <Icon name="trash" className="w-4 h-4" />
            <span>Move to Trash</span>
          </button>
        </>
      )}
    </div>
  );
}
