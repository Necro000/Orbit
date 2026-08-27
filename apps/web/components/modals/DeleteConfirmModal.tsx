'use client';

import React, { useState } from 'react';
import type { DriveItem } from '@/lib/folders';

interface DeleteConfirmModalProps {
  item: DriveItem | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}

export function DeleteConfirmModal({ item, isOpen, onClose, onConfirm }: DeleteConfirmModalProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !item) return null;

  async function handleConfirm() {
    setIsDeleting(true);
    setError(null);
    try {
      await onConfirm();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to delete item');
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="delete-title">
      <div className="modal-container">
        <h2 id="delete-title" className="modal-title">Delete {item.isFolder ? 'Folder' : 'File'}</h2>
        <p className="modal-description">
          Are you sure you want to move <strong>&ldquo;{item.name}&rdquo;</strong> to Trash?
          {item.isFolder && ' All nested folders and files inside will also be moved to Trash.'}
        </p>
        {error && <p className="error-message" role="alert">{error}</p>}
        <div className="modal-actions">
          <button type="button" className="btn btn--ghost" onClick={onClose} disabled={isDeleting}>
            Cancel
          </button>
          <button type="button" className="btn btn--danger" onClick={handleConfirm} disabled={isDeleting}>
            {isDeleting ? 'Deleting...' : 'Move to Trash'}
          </button>
        </div>
      </div>
    </div>
  );
}
