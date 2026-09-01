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
