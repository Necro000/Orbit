'use client';

import React, { useState, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

import { AppShell } from '@/components/layout/AppShell';
import { FileGrid } from '@/components/drive/FileGrid';
import { FileList } from '@/components/drive/FileList';
import { UploadDropzone } from '@/components/drive/UploadDropzone';
import { UploadProgressList, type UploadProgressItem } from '@/components/drive/UploadProgressList';
import { ContextMenu } from '@/components/drive/ContextMenu';
import { SearchBar } from '@/components/drive/SearchBar';
import { FilterChips } from '@/components/drive/FilterChips';
import { DetailsPanel } from '@/components/drive/DetailsPanel';
import { CreateFolderModal } from '@/components/modals/CreateFolderModal';
import { RenameModal } from '@/components/modals/RenameModal';
import { DeleteConfirmModal } from '@/components/modals/DeleteConfirmModal';
import { ShareDialog } from '@/components/modals/ShareDialog';
import { PublicLinkModal } from '@/components/modals/PublicLinkModal';
import { FilePreviewModal } from '@/components/modals/FilePreviewModal';
import { useToast } from '@/components/ui/Toast';
import {
  useFolderContents,
  useCreateFolder,
  useRenameFolder,
  useDeleteFolder,
  type DriveItem,
  type FileItem,
} from '@/lib/folders';
import { useRenameFile, useDeleteFile, downloadFile, uploadFileDirect } from '@/lib/files';
import { useToggleStar } from '@/lib/stars';
import { useRestoreTrash } from '@/lib/trash';
import { useSearch, type SearchFilters } from '@/lib/search';
import { getOrGenerateShareLink } from '@/lib/shares';

function DriveContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const folderId = searchParams.get('folder') || 'root';
  const { toast } = useToast();

  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [sortBy, setSortBy] = useState<'name' | 'date' | 'size'>('name');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [uploads, setUploads] = useState<UploadProgressItem[]>([]);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<SearchFilters>({ type: 'all', owner: 'all' });

  // Modals & Panels state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [renameItem, setRenameItem] = useState<DriveItem | null>(null);
  const [deleteItem, setDeleteItem] = useState<DriveItem | null>(null);
  const [shareItem, setShareItem] = useState<DriveItem | null>(null);
  const [linkItem, setLinkItem] = useState<DriveItem | null>(null);
  const [detailsItem, setDetailsItem] = useState<DriveItem | null>(null);
  const [previewFile, setPreviewFile] = useState<DriveItem | null>(null);
  const [contextMenu, setContextMenu] = useState<{ item: DriveItem; pos: { x: number; y: number } } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Queries & Mutations
  const isSearching = Boolean(searchQuery.trim() || (filters.type && filters.type !== 'all') || (filters.owner && filters.owner !== 'all'));
  const folderQuery = useFolderContents(folderId);
  const searchQueryResult = useSearch({ ...filters, q: searchQuery, sortBy });

  const createFolder = useCreateFolder(folderId);
  const renameFolder = useRenameFolder(folderId);
  const deleteFolder = useDeleteFolder(folderId);
  const renameFile = useRenameFile(folderId);
  const deleteFile = useDeleteFile(folderId);
  const toggleStar = useToggleStar();
  const restoreTrash = useRestoreTrash();

  const isLoading = isSearching ? searchQueryResult.isLoading : folderQuery.isLoading;

  const rawItems: DriveItem[] = isSearching
    ? [
        ...(searchQueryResult.data?.folders || []).map((f) => ({ ...f, isFolder: true as const })),
        ...(searchQueryResult.data?.files || []).map((f) => ({ ...f, isFolder: false as const })),
      ]
    : (folderQuery.data?.items || []);

  const sortedItems = [...rawItems].sort((a, b) => {
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

  const selectedItem = sortedItems.find((i) => selectedIds.includes(i.id)) || null;

  function handleSelect(id: string, isMulti?: boolean) {
    if (isMulti) {
      setSelectedIds((prev) =>
        prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
      );
    } else {
      setSelectedIds([id]);
    }
  }

  function handleOpen(item: DriveItem) {
    if (item.isFolder) {
      setSelectedIds([]);
      setSearchQuery('');
      router.push(`/drive?folder=${item.id}`);
    } else {
      setPreviewFile(item);
    }
  }

  function handleNavigateBreadcrumb(targetFolderId: string) {
    setSelectedIds([]);
    setSearchQuery('');
    if (targetFolderId === 'root') {
      router.push('/drive');
    } else {
      router.push(`/drive?folder=${targetFolderId}`);
    }
  }

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
        toast({ type: 'success', message: `Uploaded ${file.name}` });
      } catch (err: unknown) {
        setUploads((prev) =>
          prev.map((u) =>
            u.id === uploadId
              ? { ...u, status: 'failed', error: err instanceof Error ? err.message : 'Upload failed' }
              : u,
          ),
        );
        toast({ type: 'error', message: `Failed to upload ${file.name}` });
      }
    }
  }

  const handleToggleStarAction = async (item: DriveItem) => {
    try {
      await toggleStar.mutateAsync({
        resourceType: item.isFolder ? 'folder' : 'file',
        resourceId: item.id,
        isStarred: Boolean(item.is_starred),
      });
      toast({
        type: 'success',
        message: item.is_starred ? `Removed star from ${item.name}` : `Starred ${item.name}`,
      });
    } catch {
      toast({ type: 'error', message: 'Failed to update star.' });
    }
  };

  const handleDeleteWithUndo = async (item: DriveItem) => {
    const resourceType = item.isFolder ? 'folder' : 'file';
    const resourceId = item.id;
    const name = item.name;

    if (item.isFolder) {
      await deleteFolder.mutateAsync(item.id);
    } else {
      await deleteFile.mutateAsync(item.id);
    }
    setSelectedIds((prev) => prev.filter((id) => id !== item.id));

    toast({
      type: 'info',
      message: `Moved "${name}" to trash`,
      actionLabel: 'Undo',
      onAction: async () => {
        try {
          await restoreTrash.mutateAsync({ resourceType, resourceId });
          toast({ type: 'success', message: `Restored "${name}"` });
        } catch {
          toast({ type: 'error', message: `Could not restore "${name}"` });
        }
      },
    });
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
      breadcrumbPath={isSearching ? [{ id: 'search', name: 'Search Results' }] : (folderQuery.data?.path || [])}
      onNavigateBreadcrumb={handleNavigateBreadcrumb}
      toolbarProps={{
        onNewFolder: () => setIsCreateModalOpen(true),
        onUpload: () => fileInputRef.current?.click(),
        onShare: () => selectedItem && setShareItem(selectedItem),
        sortBy,
        onSortChange: setSortBy,
        view,
        onViewChange: setView,
        hasSelection: selectedIds.length > 0,
      }}
    >
      <div className="flex flex-col h-full">
        {/* Search and Filters Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 mb-4 border-b border-border-subtle">
          <SearchBar
            value={searchQuery}
            onChange={setSearchQuery}
            onClear={() => setSearchQuery('')}
          />
          <FilterChips filters={filters} onFilterChange={setFilters} />
        </div>


        <div className="flex-1 flex overflow-hidden">
          <div className="flex-1 overflow-y-auto">
            <UploadDropzone onFilesSelected={handleFilesSelected} inputRef={fileInputRef}>
              {isLoading ? (
                <div className="empty-state">
                  <p className="empty-state-subtitle">Loading contents...</p>
                </div>
              ) : sortedItems.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-state-icon" aria-hidden="true">
                    {isSearching ? '🔍' : '📂'}
                  </div>
                  <h2 className="empty-state-heading">
                    {isSearching ? 'No results found' : 'Folder is empty'}
                  </h2>
                  <p className="empty-state-body">
                    {isSearching
                      ? 'Try adjusting your search query or filters.'
                      : 'Drop files here or use the upload button above.'}
                  </p>
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
          </div>

          {/* Details & Activity slide-in panel */}
          {detailsItem && (
            <DetailsPanel item={detailsItem} onClose={() => setDetailsItem(null)} />
          )}
        </div>
      </div>

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
        onShare={(item) => setShareItem(item)}
        onPublicLink={(item) => setLinkItem(item)}
        onCopyLink={handleCopyLinkDirect}
        onToggleStar={handleToggleStarAction}
        onDetails={(item) => setDetailsItem(item)}
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
          await handleDeleteWithUndo(deleteItem);
        }}
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
        allFiles={sortedItems.filter((i): i is FileItem => !i.isFolder)}
        isOpen={Boolean(previewFile && !previewFile.isFolder)}
        onClose={() => setPreviewFile(null)}
        onNavigate={(nextFile) => setPreviewFile(nextFile)}
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
