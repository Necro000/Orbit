'use client';

import React, { useState } from 'react';

interface CreateFolderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (name: string) => Promise<void>;
}

export function CreateFolderModal({ isOpen, onClose, onSubmit }: CreateFolderModalProps) {
  const [name, setName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setIsSubmitting(true);
    setError(null);
    try {
      await onSubmit(name.trim());
      setName('');
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create folder');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="create-folder-title">
      <div className="modal-container">
        <h2 id="create-folder-title" className="modal-title">New Folder</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="folder-name-input" className="form-label">Folder Name</label>
            <input
              id="folder-name-input"
              type="text"
              className="input"
              placeholder="e.g. Projects"
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
              {isSubmitting ? 'Creating...' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
