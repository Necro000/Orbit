import { useQuery } from '@tanstack/react-query';

import { apiFetch } from './api';
import type { FileItem, FolderItem } from './folders';

export interface SearchFilters {
  q?: string;
  type?: 'all' | 'file' | 'folder' | 'image' | 'pdf' | 'document' | 'video' | 'audio';
  owner?: 'all' | 'me' | 'shared';
  starred?: 'all' | 'true' | 'false';
  sortBy?: 'name' | 'date' | 'size';
  sortDir?: 'asc' | 'desc';
}

export interface SearchResponse {
  folders: FolderItem[];
  files: FileItem[];
}

export async function searchResources(filters: SearchFilters): Promise<SearchResponse> {
  const params = new URLSearchParams();
  if (filters.q) params.set('q', filters.q);
  if (filters.type && filters.type !== 'all') params.set('type', filters.type);
  if (filters.owner && filters.owner !== 'all') params.set('owner', filters.owner);
  if (filters.starred && filters.starred !== 'all') params.set('starred', filters.starred);
  if (filters.sortBy) params.set('sortBy', filters.sortBy);
  if (filters.sortDir) params.set('sortDir', filters.sortDir);

  return apiFetch<SearchResponse>(`/api/search?${params.toString()}`);
}

export async function fetchRecent(): Promise<SearchResponse> {
  return apiFetch<SearchResponse>('/api/recent');
}

export async function fetchShared(): Promise<SearchResponse> {
  return apiFetch<SearchResponse>('/api/shared');
}

export function useSearch(filters: SearchFilters) {
  return useQuery({
    queryKey: ['search', filters],
    queryFn: () => searchResources(filters),
    enabled: true,
  });
}

export function useRecent() {
  return useQuery({
    queryKey: ['recent'],
    queryFn: fetchRecent,
  });
}

export function useShared() {
  return useQuery({
    queryKey: ['shared'],
    queryFn: fetchShared,
  });
}
