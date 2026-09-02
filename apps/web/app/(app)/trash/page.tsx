'use client';

import React, { useState } from 'react';

import { AppShell } from '@/components/layout/AppShell';
import { useToast } from '@/components/ui/Toast';
import { useTrash, useRestoreTrash, useDeleteTrash, useEmptyTrash } from '@/lib/trash';
import { formatBytes } from '@/lib/format';
import { getFileTint } from '@/lib/fileTints';
import type { DriveItem, FileItem } from '@/lib/folders';

export default function TrashPage() {
  const { toast } = useToast();
  const { data, isLoading } = useTrash();
  const restoreTrash = useRestoreTrash();
  const deleteTrash = useDeleteTrash();
  const emptyTrashMutation = useEmptyTrash();

  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DriveItem | null>(null);
  const [showEmptyConfirm, setShowEmptyConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const items: DriveItem[] = [
    ...(data?.folders || []).map((f) => ({ ...f, isFolder: true as const })),
    ...(data?.files || []).map((f) => ({ ...f, isFolder: false as const })),
  ];

  const handleRestore = async (item: DriveItem) => {
    setRestoringId(item.id);
    try {
      await restoreTrash.mutateAsync({
        resourceType: item.isFolder ? 'folder' : 'file',
        resourceId: item.id,
      });
      toast({ type: 'success', message: `Restored "${item.name}"` });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to restore item.';
      toast({ type: 'error', message: msg });
    } finally {
      setRestoringId(null);
    }
  };

  const handleConfirmPermanentDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await deleteTrash.mutateAsync({
        resourceType: deleteTarget.isFolder ? 'folder' : 'file',
        resourceId: deleteTarget.id,
      });
      toast({ type: 'success', message: `Permanently deleted "${deleteTarget.name}"` });
      setDeleteTarget(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to delete item.';
      toast({ type: 'error', message: msg });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleConfirmEmptyTrash = async () => {
    setIsDeleting(true);
    try {
      await emptyTrashMutation.mutateAsync();
      toast({ type: 'success', message: 'Trash emptied successfully' });
      setShowEmptyConfirm(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to empty trash.';
      toast({ type: 'error', message: msg });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <AppShell breadcrumbPath={[{ id: 'trash', name: 'Trash' }]}>
      <div className="flex flex-col h-full max-w-[1400px]">
        <div className="flex items-center justify-between pb-3 mb-4 border-b border-border-subtle text-xs text-text-secondary">
          <span>Items in trash will be permanently deleted after 30 days.</span>
          {items.length > 0 && (
            <button
              type="button"
              onClick={() => setShowEmptyConfirm(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-danger/10 hover:bg-danger text-danger hover:text-white font-medium border border-danger/20 transition-colors text-xs"
            >
              <span>🗑️</span>
              <span>Empty Trash</span>
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="empty-state flex flex-col items-center justify-center min-h-[300px] text-center p-8">
              <p className="text-sm text-text-secondary">Loading trash items...</p>
            </div>
          ) : items.length === 0 ? (
            <div className="empty-state flex flex-col items-center justify-center min-h-[300px] text-center p-8">
              <div className="empty-state-icon text-5xl mb-3" aria-hidden="true">🗑️</div>
              <h2 className="text-lg font-semibold text-text-primary">Trash is empty</h2>
              <p className="text-xs text-text-secondary max-w-sm mt-1">
                Deleted folders and files will appear here for 30 days before permanent removal.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {items.map((item: DriveItem) => {
                const tint = getFileTint(item.isFolder ? undefined : (item as FileItem).mime_type, item.isFolder);

                return (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-3 rounded-[10px] bg-bg-surface border border-border-subtle hover:bg-bg-surface-hover hover:shadow-[0_2px_8px_rgba(0,0,0,0.3)] transition-all select-none"
                  >
                    <div className="flex items-center gap-3 min-w-0 pr-4">
                      <div className={`w-8 h-8 rounded-lg ${tint.combinedClass} flex items-center justify-center flex-shrink-0 text-sm`}>
                        {item.isFolder ? '📁' : '📄'}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-text-primary truncate">{item.name}</p>
                        <p className="text-xs text-text-secondary truncate">
                          {item.isFolder ? 'Folder' : formatBytes(parseInt((item as FileItem).size_bytes, 10) || 0)} • Deleted {new Date(item.updated_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        type="button"
                        onClick={() => handleRestore(item)}
                        disabled={restoringId === item.id}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent/15 hover:bg-accent text-accent hover:text-white text-xs font-semibold border border-accent/30 transition-colors disabled:opacity-50"
                        title="Restore item to Drive"
                      >
                        <span>♻️</span>
                        <span>{restoringId === item.id ? 'Restoring...' : 'Restore'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setDeleteTarget(item)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-danger/10 hover:bg-danger text-danger hover:text-white text-xs font-semibold border border-danger/30 transition-colors"
                        title="Permanently delete item"
                      >
                        <span>🗑️</span>
                        <span>Delete</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Single Item Permanent Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="delete-permanent-title">
          <div className="modal-container">
            <h2 id="delete-permanent-title" className="modal-title">
              Permanently Delete {deleteTarget.isFolder ? 'Folder' : 'File'}?
            </h2>
            <p className="modal-description">
              Are you sure you want to permanently delete <strong>&ldquo;{deleteTarget.name}&rdquo;</strong>?
              {deleteTarget.isFolder && ' All nested contents inside this folder will also be permanently deleted.'}
              {' '}This action <strong>cannot</strong> be undone.
            </p>
            <div className="modal-actions">
              <button
                type="button"
                className="btn btn--ghost"
                onClick={() => setDeleteTarget(null)}
                disabled={isDeleting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn--danger"
                onClick={handleConfirmPermanentDelete}
                disabled={isDeleting}
              >
                {isDeleting ? 'Deleting...' : 'Delete Permanently'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Empty Trash Confirmation Modal */}
      {showEmptyConfirm && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="empty-trash-title">
          <div className="modal-container">
            <h2 id="empty-trash-title" className="modal-title">
              Empty Trash?
            </h2>
            <p className="modal-description">
              Are you sure you want to permanently delete all {items.length} item{items.length !== 1 ? 's' : ''} in your Trash?
              {' '}This action <strong>cannot</strong> be undone.
            </p>
            <div className="modal-actions">
              <button
                type="button"
                className="btn btn--ghost"
                onClick={() => setShowEmptyConfirm(false)}
                disabled={isDeleting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn--danger"
                onClick={handleConfirmEmptyTrash}
                disabled={isDeleting}
              >
                {isDeleting ? 'Emptying...' : 'Empty Trash'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
