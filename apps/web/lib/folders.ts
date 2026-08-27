import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { apiFetch } from './api';

export interface FolderItem {
  id: string;
  name: string;
  owner_id?: string;
  parent_id: string | null;
  created_at: string;
  updated_at: string;
  isFolder: true;
}

export interface FileItem {
  id: string;
  name: string;
  mime_type: string;
  size_bytes: string;
  checksum?: string | null;
  status: string;
  folder_id?: string | null;
  created_at: string;
  updated_at: string;
  isFolder: false;
}

export type DriveItem = FolderItem | FileItem;

export interface BreadcrumbSegment {
  id: string;
  name: string;
}

export interface FolderContentsResponse {
  folder: {
    id: string;
    name: string;
    parent_id?: string | null;
  };
  path: BreadcrumbSegment[];
  folders: Omit<FolderItem, 'isFolder'>[];
  files: Omit<FileItem, 'isFolder'>[];
}

export function useFolderContents(folderId: string | 'root' = 'root') {
  return useQuery({
    queryKey: ['folder', folderId],
    queryFn: async () => {
      const data = await apiFetch<FolderContentsResponse>(`/api/folders/${folderId}`);
      const folders: FolderItem[] = (data.folders || []).map((f) => ({ ...f, isFolder: true }));
      const files: FileItem[] = (data.files || []).map((f) => ({ ...f, isFolder: false }));
      return {
        ...data,
        folders,
        files,
        items: [...folders, ...files] as DriveItem[],
      };
    },
    staleTime: 10_000,
  });
}

export function useCreateFolder(currentFolderId: string | 'root' = 'root') {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ name, parentId }: { name: string; parentId?: string | null }) => {
      const res = await apiFetch<{ folder: FolderItem }>('/api/folders', {
        method: 'POST',
        body: JSON.stringify({ name, parentId: parentId ?? (currentFolderId === 'root' ? null : currentFolderId) }),
      });
      return res.folder;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['folder', currentFolderId] });
    },
  });
}

export function useRenameFolder(currentFolderId: string | 'root' = 'root') {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, newName }: { id: string; newName: string }) => {
      return apiFetch<{ folder: FolderItem }>(`/api/folders/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ name: newName }),
      });
    },
    onMutate: async ({ id, newName }) => {
      await queryClient.cancelQueries({ queryKey: ['folder', currentFolderId] });
      const prevData = queryClient.getQueryData<FolderContentsResponse>(['folder', currentFolderId]);
      if (prevData) {
        queryClient.setQueryData(['folder', currentFolderId], {
          ...prevData,
          folders: prevData.folders.map((f) => (f.id === id ? { ...f, name: newName } : f)),
        });
      }
      return { prevData };
    },
    onError: (_err, _vars, context) => {
      if (context?.prevData) {
        queryClient.setQueryData(['folder', currentFolderId], context.prevData);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['folder', currentFolderId] });
    },
  });
}

export function useDeleteFolder(currentFolderId: string | 'root' = 'root') {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      return apiFetch<{ ok: boolean }>(`/api/folders/${id}`, { method: 'DELETE' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['folder', currentFolderId] });
    },
  });
}
