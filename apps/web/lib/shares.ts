import { useQuery } from '@tanstack/react-query';

import { apiFetch } from './api';

export interface ShareEntry {
  id: string;
  resource_type: 'file' | 'folder';
  resource_id: string;
  grantee_user_id: string;
  grantee_email?: string;
  grantee_name?: string;
  role: 'viewer' | 'editor';
  created_at: string;
}

export interface LinkShareEntry {
  id: string;
  resourceType: 'file' | 'folder';
  resourceId: string;
  token: string;
  role: 'viewer';
  hasPassword?: boolean;
  expiresAt: string | null;
  createdAt: string;
}

export interface ResourceOwner {
  id: string;
  name: string;
  email: string;
}

export interface UserAccessInfo {
  isOwner: boolean;
  canManageAcl: boolean;
  role: 'owner' | 'editor' | 'viewer';
}

export interface SharesData {
  shares: ShareEntry[];
  owner: ResourceOwner | null;
  userAccess?: UserAccessInfo;
}

export async function fetchShares(resourceType: 'file' | 'folder', resourceId: string): Promise<SharesData> {
  const res = await apiFetch<{
    shares: ShareEntry[];
    owner?: ResourceOwner | null;
    userAccess?: UserAccessInfo;
  }>(`/api/shares/${resourceType}/${resourceId}`);
  return {
    shares: res.shares || [],
    owner: res.owner || null,
    userAccess: res.userAccess,
  };
}

export async function createShare(params: {
  resourceType: 'file' | 'folder';
  resourceId: string;
  granteeEmail?: string;
  granteeUserId?: string;
  role: 'viewer' | 'editor';
}): Promise<ShareEntry> {
  const res = await apiFetch<{ share: ShareEntry }>('/api/shares', {
    method: 'POST',
    body: JSON.stringify(params),
  });
  return res.share;
}

export async function revokeShare(shareId: string): Promise<void> {
  await apiFetch(`/api/shares/${shareId}`, { method: 'DELETE' });
}

export async function fetchLinkShare(resourceType: 'file' | 'folder', resourceId: string): Promise<LinkShareEntry | null> {
  const res = await apiFetch<{ linkShare: LinkShareEntry | null }>(`/api/link-shares/${resourceType}/${resourceId}`);
  return res.linkShare;
}

export async function createLinkShare(params: {
  resourceType: 'file' | 'folder';
  resourceId: string;
  role?: 'viewer';
  password?: string | null;
  expiresAt?: string | null;
}): Promise<LinkShareEntry> {
  const res = await apiFetch<{ linkShare: LinkShareEntry }>('/api/link-shares', {
    method: 'POST',
    body: JSON.stringify(params),
  });
  return res.linkShare;
}

export async function revokeLinkShare(linkId: string): Promise<void> {
  await apiFetch(`/api/link-shares/${linkId}`, { method: 'DELETE' });
}

export function useShares(resourceType: 'file' | 'folder', resourceId: string) {
  return useQuery({
    queryKey: ['shares', resourceType, resourceId],
    queryFn: () => fetchShares(resourceType, resourceId),
    enabled: Boolean(resourceId),
  });
}

export function useLinkShare(resourceType: 'file' | 'folder', resourceId: string) {
  return useQuery({
    queryKey: ['linkShare', resourceType, resourceId],
    queryFn: () => fetchLinkShare(resourceType, resourceId),
    enabled: Boolean(resourceId),
  });
}

/**
 * Gets an existing public link or generates a new one, then copies it to clipboard.
 */
export async function getOrGenerateShareLink(resourceType: 'file' | 'folder', resourceId: string): Promise<string> {
  let link = await fetchLinkShare(resourceType, resourceId);
  if (!link) {
    link = await createLinkShare({ resourceType, resourceId });
  }
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const url = `${origin}/link/${link.token}`;
  if (typeof navigator !== 'undefined' && navigator.clipboard) {
    await navigator.clipboard.writeText(url);
  }
  return url;
}
