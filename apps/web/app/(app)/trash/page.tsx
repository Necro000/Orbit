'use client';

import React, { useState } from 'react';

import { AppShell } from '@/components/layout/AppShell';
import { useToast } from '@/components/ui/Toast';
import { useTrash, useRestoreTrash } from '@/lib/trash';
import { formatBytes } from '@/lib/format';
import type { DriveItem, FileItem } from '@/lib/folders';

export default function TrashPage() {
  const { toast } = useToast();
  const { data, isLoading } = useTrash();
  const restoreTrash = useRestoreTrash();

  const [restoringId, setRestoringId] = useState<string | null>(null);

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

  return (
    <AppShell breadcrumbPath={[{ id: 'trash', name: 'Trash' }]}>
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-800 text-xs text-slate-400">
          <span>Items in trash will be permanently deleted after 30 days.</span>
        </div>

        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="empty-state">
              <p className="empty-state-subtitle">Loading trash items...</p>
            </div>
          ) : items.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon" aria-hidden="true">🗑️</div>
              <h2 className="empty-state-heading">Trash is empty</h2>
              <p className="empty-state-body">
                Deleted folders and files will appear here for 30 days before permanent removal.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {items.map((item: DriveItem) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-3 rounded-xl bg-slate-800/60 border border-slate-700/60 hover:border-slate-600 transition"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{item.isFolder ? '📁' : '📄'}</span>
                    <div>
                      <p className="text-sm font-medium text-white">{item.name}</p>
                      <p className="text-[11px] text-slate-400">
                        {item.isFolder ? 'Folder' : formatBytes(parseInt((item as FileItem).size_bytes, 10) || 0)} • Deleted {new Date(item.updated_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleRestore(item)}
                    disabled={restoringId === item.id}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600/20 hover:bg-indigo-600 text-indigo-300 hover:text-white text-xs font-semibold border border-indigo-500/30 transition disabled:opacity-50"
                  >
                    <span>♻️</span>
                    <span>{restoringId === item.id ? 'Restoring...' : 'Restore'}</span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
