'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';

import { AppShell } from '@/components/layout/AppShell';
import { FileGrid } from '@/components/drive/FileGrid';
import { FileList } from '@/components/drive/FileList';
import { ContextMenu } from '@/components/drive/ContextMenu';
import { ShareDialog } from '@/components/modals/ShareDialog';
import { PublicLinkModal } from '@/components/modals/PublicLinkModal';
import { FilePreviewModal } from '@/components/modals/FilePreviewModal';
import { DetailsPanel } from '@/components/drive/DetailsPanel';
import { useToast } from '@/components/ui/Toast';
import { useStarred, useToggleStar } from '@/lib/stars';
import { downloadFile } from '@/lib/files';
import { getOrGenerateShareLink } from '@/lib/shares';
import type { DriveItem, FileItem } from '@/lib/folders';

export default function StarredPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { data, isLoading } = useStarred();
  const toggleStar = useToggleStar();

  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [contextMenu, setContextMenu] = useState<{ item: DriveItem; pos: { x: number; y: number } } | null>(null);
  const [shareItem, setShareItem] = useState<DriveItem | null>(null);
  const [linkItem, setLinkItem] = useState<DriveItem | null>(null);
  const [detailsItem, setDetailsItem] = useState<DriveItem | null>(null);
  const [previewFile, setPreviewFile] = useState<DriveItem | null>(null);

  const items: DriveItem[] = [
    ...(data?.folders || []).map((f) => ({ ...f, isFolder: true as const })),
    ...(data?.files || []).map((f) => ({ ...f, isFolder: false as const })),
  ];

  const handleOpen = (item: DriveItem) => {
    if (item.isFolder) {
      router.push(`/drive?folder=${item.id}`);
    } else {
      setPreviewFile(item);
    }
  };

  const handleToggleStar = async (item: DriveItem) => {
    try {
      await toggleStar.mutateAsync({
        resourceType: item.isFolder ? 'folder' : 'file',
        resourceId: item.id,
        isStarred: true,
      });
      toast({ type: 'success', message: `Unstarred ${item.name}` });
    } catch {
      toast({ type: 'error', message: 'Failed to unstar item.' });
    }
  };

  const handleCopyLinkDirect = async (item: DriveItem) => {
    try {
      await getOrGenerateShareLink(item.isFolder ? 'folder' : 'file', item.id);
      toast({ type: 'success', message: 'Link copied to clipboard!' });
    } catch {
      toast({ type: 'error', message: 'Failed to copy share link.' });
    }
  };

  return (
    <AppShell
      breadcrumbPath={[{ id: 'starred', name: 'Starred' }]}
      toolbarProps={{
        view,
        onViewChange: setView,
        hasSelection: selectedIds.length > 0,
        onShare: () => {
          const item = items.find((i) => selectedIds.includes(i.id));
          if (item) setShareItem(item);
        },
      }}
    >
      <div className="flex flex-col h-full">
        <div className="flex-1 flex overflow-hidden">
          <div className="flex-1 overflow-y-auto">
            {isLoading ? (
              <div className="empty-state">
                <p className="empty-state-subtitle">Loading starred items...</p>
              </div>
            ) : items.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon" aria-hidden="true">⭐</div>
                <h2 className="empty-state-heading">No starred items</h2>
                <p className="empty-state-body">
                  Add stars to items you want to find easily later.
                </p>
              </div>
            ) : view === 'grid' ? (
              <FileGrid
                items={items}
                selectedIds={selectedIds}
                onSelect={(id) => setSelectedIds([id])}
                onOpen={handleOpen}
                onContextMenu={(item, pos) => setContextMenu({ item, pos })}
              />
            ) : (
              <FileList
                items={items}
                selectedIds={selectedIds}
                onSelect={(id) => setSelectedIds([id])}
                onOpen={handleOpen}
                onContextMenu={(item, pos) => setContextMenu({ item, pos })}
              />
            )}
          </div>

          {detailsItem && (
            <DetailsPanel item={detailsItem} onClose={() => setDetailsItem(null)} />
          )}
        </div>
      </div>

      <ContextMenu
        item={contextMenu?.item || null}
        position={contextMenu?.pos || null}
        onClose={() => setContextMenu(null)}
        onOpen={handleOpen}
        onDownload={(item) => !item.isFolder && downloadFile(item.id).catch(console.error)}
        onRename={() => {}}
        onDelete={() => {}}
        onShare={(item) => setShareItem(item)}
        onCopyLink={handleCopyLinkDirect}
        onToggleStar={handleToggleStar}
        onDetails={(item) => setDetailsItem(item)}
      />

      <ShareDialog
        isOpen={!!shareItem}
        onClose={() => setShareItem(null)}
        resource={shareItem ? { id: shareItem.id, name: shareItem.name, type: shareItem.isFolder ? 'folder' : 'file' } : null}
      />

      <PublicLinkModal
        isOpen={!!linkItem}
        onClose={() => setLinkItem(null)}
        resource={linkItem ? { id: linkItem.id, name: linkItem.name, type: linkItem.isFolder ? 'folder' : 'file' } : null}
      />

      <FilePreviewModal
        file={previewFile && !previewFile.isFolder ? (previewFile as FileItem) : null}
        allFiles={items.filter((i): i is FileItem => !i.isFolder)}
        isOpen={Boolean(previewFile && !previewFile.isFolder)}
        onClose={() => setPreviewFile(null)}
        onNavigate={(nextFile) => setPreviewFile(nextFile)}
      />
    </AppShell>
  );
}
