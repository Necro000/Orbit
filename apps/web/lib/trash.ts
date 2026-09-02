import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { apiFetch } from './api';
import type { FileItem, FolderItem } from './folders';

export interface TrashResponse {
  folders: FolderItem[];
  files: FileItem[];
}

export async function fetchTrash(): Promise<TrashResponse> {
  return apiFetch<TrashResponse>('/api/trash');
}

export async function restoreTrashItem(params: {
  resourceType: 'file' | 'folder';
  resourceId: string;
}): Promise<void> {
  await apiFetch('/api/trash/restore', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export async function deleteTrashItem(params: {
  resourceType: 'file' | 'folder';
  resourceId: string;
}): Promise<void> {
  await apiFetch('/api/trash/delete', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export async function emptyTrash(): Promise<void> {
  await apiFetch('/api/trash/empty', {
    method: 'POST',
  });
}

export function useTrash() {
  return useQuery({
    queryKey: ['trash'],
    queryFn: fetchTrash,
  });
}

export function useRestoreTrash() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: restoreTrashItem,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['trash'] });
      void queryClient.invalidateQueries({ queryKey: ['folder'] });
      void queryClient.invalidateQueries({ queryKey: ['recent'] });
      void queryClient.invalidateQueries({ queryKey: ['starred'] });
      void queryClient.invalidateQueries({ queryKey: ['activities'] });
    },
  });
}

export function useDeleteTrash() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteTrashItem,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['trash'] });
      void queryClient.invalidateQueries({ queryKey: ['folder'] });
      void queryClient.invalidateQueries({ queryKey: ['recent'] });
      void queryClient.invalidateQueries({ queryKey: ['starred'] });
      void queryClient.invalidateQueries({ queryKey: ['activities'] });
    },
  });
}

export function useEmptyTrash() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: emptyTrash,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['trash'] });
      void queryClient.invalidateQueries({ queryKey: ['folder'] });
      void queryClient.invalidateQueries({ queryKey: ['recent'] });
      void queryClient.invalidateQueries({ queryKey: ['starred'] });
      void queryClient.invalidateQueries({ queryKey: ['activities'] });
    },
  });
}

