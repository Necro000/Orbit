'use client';

import React from 'react';
import { useItemActivities, type ActivityItem } from '@/lib/activity';

interface ActivityFeedProps {
  resourceType: 'file' | 'folder';
  resourceId: string;
}

function getActionLabel(action: string): { icon: string; label: string } {
  switch (action) {
    case 'upload':
      return { icon: '📤', label: 'Uploaded' };
    case 'rename':
      return { icon: '✏️', label: 'Renamed' };
    case 'move':
      return { icon: '📦', label: 'Moved' };
    case 'share':
      return { icon: '👥', label: 'Shared' };
    case 'download':
      return { icon: '📥', label: 'Downloaded' };
    case 'restore':
      return { icon: '♻️', label: 'Restored' };
    case 'delete':
      return { icon: '🗑️', label: 'Moved to trash' };
    default:
      return { icon: '•', label: action };
  }
}

export function ActivityFeed({ resourceType, resourceId }: ActivityFeedProps) {
  const { data: activities = [], isLoading } = useItemActivities(resourceType, resourceId);

  if (isLoading) {
    return <p className="text-xs text-slate-500 py-4 text-center">Loading activity history...</p>;
  }

  if (activities.length === 0) {
    return <p className="text-xs text-slate-500 py-4 text-center">No recorded activity yet.</p>;
  }

  return (
    <div className="space-y-3">
      {activities.map((item: ActivityItem) => {
        const { icon, label } = getActionLabel(item.action);
        return (
          <div key={item.id} className="flex items-start gap-2.5 text-xs">
            <span className="p-1 rounded-full bg-slate-800 border border-slate-700 text-sm mt-0.5">
              {icon}
            </span>
            <div className="flex-1">
              <p className="text-slate-200">
                <span className="font-semibold text-white">
                  {item.actor_name || item.actor_email || 'User'}
                </span>{' '}
                {label.toLowerCase()} this {resourceType}
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {new Date(item.created_at).toLocaleString(undefined, {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
