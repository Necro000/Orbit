import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { apiFetch } from './api';
import type { FileItem, FolderItem } from './folders';

export interface StarredResponse {
  folders: FolderItem[];
  files: FileItem[];
}

export async function fetchStarred(): Promise<StarredResponse> {
  return apiFetch<StarredResponse>('/api/stars');
}

export async function toggleStar(params: {
  resourceType: 'file' | 'folder';
  resourceId: string;
  isStarred: boolean;
}): Promise<void> {
  if (params.isStarred) {
    await apiFetch(`/api/stars/${params.resourceType}/${params.resourceId}`, {
      method: 'DELETE',
    });
  } else {
    await apiFetch('/api/stars', {
      method: 'POST',
      body: JSON.stringify({
        resourceType: params.resourceType,
        resourceId: params.resourceId,
      }),
    });
  }
}

export function useStarred() {
  return useQuery({
    queryKey: ['starred'],
    queryFn: fetchStarred,
  });
}

export function useToggleStar() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: toggleStar,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['starred'] });
      void queryClient.invalidateQueries({ queryKey: ['folder'] });
      void queryClient.invalidateQueries({ queryKey: ['search'] });
      void queryClient.invalidateQueries({ queryKey: ['recent'] });
      void queryClient.invalidateQueries({ queryKey: ['shared'] });
    },
  });
}
