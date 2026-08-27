'use client';

import React, { useState } from 'react';
import type { DriveItem } from '@/lib/folders';

interface RenameModalProps {
  item: DriveItem | null;
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (newName: string) => Promise<void>;
}

export function RenameModal({ item, isOpen, onClose, onSubmit }: RenameModalProps) {
  const [name, setName] = useState(item?.name ?? '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !item) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setIsSubmitting(true);
    setError(null);
    try {
      await onSubmit(name.trim());
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to rename item');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="rename-title">
      <div className="modal-container">
        <h2 id="rename-title" className="modal-title">
          Rename {item.isFolder ? 'Folder' : 'File'}
        </h2>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="rename-input" className="form-label">New Name</label>
            <input
              id="rename-input"
              type="text"
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              required
            />
          </div>
          {error && <p className="error-message" role="alert">{error}</p>}
          <div className="modal-actions">
            <button type="button" className="btn btn--ghost" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </button>
            <button type="submit" className="btn btn--primary" disabled={isSubmitting || !name.trim()}>
              {isSubmitting ? 'Renaming...' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
