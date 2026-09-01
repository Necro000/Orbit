import { useQuery } from '@tanstack/react-query';

import { apiFetch } from './api';

export interface ActivityItem {
  id: string;
  actor_id: string | null;
  actor_name?: string | null;
  actor_email?: string | null;
  action: 'upload' | 'rename' | 'delete' | 'restore' | 'move' | 'share' | 'download';
  resource_type: 'file' | 'folder';
  resource_id: string;
  context: Record<string, unknown>;
  created_at: string;
}

export async function fetchItemActivities(
  resourceType: 'file' | 'folder',
  resourceId: string,
): Promise<ActivityItem[]> {
  const res = await apiFetch<{ activities: ActivityItem[] }>(
    `/api/activities/${resourceType}/${resourceId}`,
  );
  return res.activities;
}

export function useItemActivities(resourceType: 'file' | 'folder', resourceId: string) {
  return useQuery({
    queryKey: ['activities', resourceType, resourceId],
    queryFn: () => fetchItemActivities(resourceType, resourceId),
    enabled: Boolean(resourceId),
  });
}
