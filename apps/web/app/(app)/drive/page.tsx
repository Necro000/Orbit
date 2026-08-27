'use client';

import React, { useState, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

import { AppShell } from '@/components/layout/AppShell';
import { FileGrid } from '@/components/drive/FileGrid';
import { FileList } from '@/components/drive/FileList';
import { UploadDropzone } from '@/components/drive/UploadDropzone';
import { UploadProgressList, type UploadProgressItem } from '@/components/drive/UploadProgressList';
import { ContextMenu } from '@/components/drive/ContextMenu';
import { CreateFolderModal } from '@/components/modals/CreateFolderModal';
import { RenameModal } from '@/components/modals/RenameModal';
import { DeleteConfirmModal } from '@/components/modals/DeleteConfirmModal';
import {
  useFolderContents,
  useCreateFolder,
  useRenameFolder,
  useDeleteFolder,
  type DriveItem,
} from '@/lib/folders';
import { useRenameFile, useDeleteFile, downloadFile, uploadFileDirect } from '@/lib/files';

function DriveContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const folderId = searchParams.get('folder') || 'root';

  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [sortBy, setSortBy] = useState<'name' | 'date' | 'size'>('name');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [uploads, setUploads] = useState<UploadProgressItem[]>([]);

  // Modals state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [renameItem, setRenameItem] = useState<DriveItem | null>(null);
  const [deleteItem, setDeleteItem] = useState<DriveItem | null>(null);
  const [contextMenu, setContextMenu] = useState<{ item: DriveItem; pos: { x: number; y: number } } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Queries & Mutations
  const { data, isLoading } = useFolderContents(folderId);
  const createFolder = useCreateFolder(folderId);
  const renameFolder = useRenameFolder(folderId);
  const deleteFolder = useDeleteFolder(folderId);
  const renameFile = useRenameFile(folderId);
  const deleteFile = useDeleteFile(folderId);

  // Sorting
  const sortedItems = [...(data?.items || [])].sort((a, b) => {
    if (a.isFolder && !b.isFolder) return -1;
    if (!a.isFolder && b.isFolder) return 1;
    if (sortBy === 'name') return a.name.localeCompare(b.name);
    if (sortBy === 'date') {
      const dateA = new Date(a.updated_at || a.created_at).getTime();
      const dateB = new Date(b.updated_at || b.created_at).getTime();
      return dateB - dateA;
    }
    if (sortBy === 'size') {
      const sizeA = !a.isFolder ? parseInt(a.size_bytes, 10) : 0;
      const sizeB = !b.isFolder ? parseInt(b.size_bytes, 10) : 0;
      return sizeB - sizeA;
    }
    return 0;
  });

  // Selection handlers
  function handleSelect(id: string, isMulti?: boolean) {
    if (isMulti) {
      setSelectedIds((prev) =>
        prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
      );
    } else {
      setSelectedIds([id]);
    }
  }

  // Navigation handlers
  function handleOpen(item: DriveItem) {
    if (item.isFolder) {
      setSelectedIds([]);
      router.push(`/drive?folder=${item.id}`);
    } else {
      downloadFile(item.id).catch(console.error);
    }
  }

  function handleNavigateBreadcrumb(targetFolderId: string) {
    setSelectedIds([]);
    if (targetFolderId === 'root') {
      router.push('/drive');
    } else {
      router.push(`/drive?folder=${targetFolderId}`);
    }
  }

  // File Upload Handlers
  async function handleFilesSelected(files: File[]) {
    for (const file of files) {
      const uploadId = crypto.randomUUID();
      setUploads((prev) => [
        ...prev,
        { id: uploadId, fileName: file.name, progressPercent: 0, status: 'uploading' },
      ]);

      try {
        await uploadFileDirect(
          file,
          folderId === 'root' ? null : folderId,
          (pct) => {
            setUploads((prev) =>
              prev.map((u) => (u.id === uploadId ? { ...u, progressPercent: pct } : u)),
            );
          },
        );

        setUploads((prev) =>
          prev.map((u) => (u.id === uploadId ? { ...u, progressPercent: 100, status: 'done' } : u)),
        );
      } catch (err: unknown) {
        setUploads((prev) =>
          prev.map((u) =>
            u.id === uploadId
              ? { ...u, status: 'failed', error: err instanceof Error ? err.message : 'Upload failed' }
              : u,
          ),
        );
      }
    }
  }

  return (
    <AppShell
      breadcrumbPath={data?.path || []}
      onNavigateBreadcrumb={handleNavigateBreadcrumb}
      toolbarProps={{
        onNewFolder: () => setIsCreateModalOpen(true),
        onUpload: () => fileInputRef.current?.click(),
        onShare: () => {},
        sortBy,
        onSortChange: setSortBy,
        view,
        onViewChange: setView,
        hasSelection: selectedIds.length > 0,
      }}
    >
      <UploadDropzone onFilesSelected={handleFilesSelected} inputRef={fileInputRef}>
        {isLoading ? (
          <div className="empty-state">
            <p className="empty-state-subtitle">Loading folder contents...</p>
          </div>
        ) : view === 'grid' ? (
          <FileGrid
            items={sortedItems}
            selectedIds={selectedIds}
            onSelect={handleSelect}
            onOpen={handleOpen}
            onContextMenu={(item, pos) => setContextMenu({ item, pos })}
          />
        ) : (
          <FileList
            items={sortedItems}
            selectedIds={selectedIds}
            onSelect={handleSelect}
            onOpen={handleOpen}
            onContextMenu={(item, pos) => setContextMenu({ item, pos })}
          />
        )}
      </UploadDropzone>

      {/* Upload progress floating list */}
      <UploadProgressList
        uploads={uploads}
        onDismiss={(id) => setUploads((prev) => prev.filter((u) => u.id !== id))}
      />

      {/* Context Menu */}
      <ContextMenu
        item={contextMenu?.item || null}
        position={contextMenu?.pos || null}
        onClose={() => setContextMenu(null)}
        onOpen={handleOpen}
        onDownload={(item) => !item.isFolder && downloadFile(item.id).catch(console.error)}
        onRename={(item) => setRenameItem(item)}
        onDelete={(item) => setDeleteItem(item)}
      />

      {/* Modals */}
      <CreateFolderModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSubmit={async (name) => {
          await createFolder.mutateAsync({ name, parentId: folderId === 'root' ? null : folderId });
        }}
      />

      <RenameModal
        key={renameItem?.id}
        item={renameItem}
        isOpen={!!renameItem}
        onClose={() => setRenameItem(null)}
        onSubmit={async (newName) => {
          if (!renameItem) return;
          if (renameItem.isFolder) {
            await renameFolder.mutateAsync({ id: renameItem.id, newName });
          } else {
            await renameFile.mutateAsync({ id: renameItem.id, newName });
          }
        }}
      />

      <DeleteConfirmModal
        item={deleteItem}
        isOpen={!!deleteItem}
        onClose={() => setDeleteItem(null)}
        onConfirm={async () => {
          if (!deleteItem) return;
          if (deleteItem.isFolder) {
            await deleteFolder.mutateAsync(deleteItem.id);
          } else {
            await deleteFile.mutateAsync(deleteItem.id);
          }
          setSelectedIds((prev) => prev.filter((id) => id !== deleteItem.id));
        }}
      />
    </AppShell>
  );
}

export default function DrivePage() {
  return (
    <Suspense
      fallback={
        <AppShell breadcrumbPath={[]}>
          <div className="empty-state">
            <p className="empty-state-subtitle">Loading...</p>
          </div>
        </AppShell>
      }
    >
      <DriveContent />
    </Suspense>
  );
}
