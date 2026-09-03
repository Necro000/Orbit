'use client';

import { useQuery } from '@tanstack/react-query';
import { apiFetch, ApiError } from './api';

export interface CurrentUser {
  id: string;
  email: string;
  name: string;
  imageUrl: string | null;
  createdAt: string;
  storageUsedBytes?: number;
}

export interface StorageBreakdown {
  videos: number;
  audios: number;
  images: number;
  documents: number;
  trash: number;
  totalUsed: number;
  maxStorageBytes: number;
}

export function useCurrentUser() {
  return useQuery<CurrentUser, ApiError>({
    queryKey: ['auth', 'me'],
    queryFn: async () => {
      const data = await apiFetch<{ user: CurrentUser }>('/api/auth/me');
      return data.user;
    },
    retry: false,
    staleTime: 60_000,
  });
}

export function useStorageBreakdown() {
  return useQuery<StorageBreakdown, ApiError>({
    queryKey: ['auth', 'storage-breakdown'],
    queryFn: async () => {
      const data = await apiFetch<{ breakdown: StorageBreakdown }>('/api/auth/storage-breakdown');
      return data.breakdown;
    },
    staleTime: 15_000,
  });
}

export async function updateProfile(name: string): Promise<CurrentUser> {
  const data = await apiFetch<{ user: CurrentUser }>('/api/auth/profile', {
    method: 'PATCH',
    body: JSON.stringify({ name }),
  });
  return data.user;
}

export async function changePassword(
  currentPassword: string,
  newPassword: string,
): Promise<{ ok: boolean; message: string }> {
  return apiFetch<{ ok: boolean; message: string }>('/api/auth/change-password', {
    method: 'POST',
    body: JSON.stringify({ currentPassword, newPassword }),
  });
}
