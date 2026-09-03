'use client';

import React, { useState } from 'react';
import type { FileItem, FolderItem } from '@/lib/folders';
import { formatBytes } from '@/lib/format';
import { ActivityFeed } from './ActivityFeed';
import { VersionList } from './VersionList';

interface DetailsPanelProps {
  item: (FileItem | FolderItem) | null;
  onClose: () => void;
}

export function DetailsPanel({ item, onClose }: DetailsPanelProps) {
  const [tab, setTab] = useState<'details' | 'activity' | 'versions'>('details');

  if (!item) return null;

  const isFolder = 'parent_id' in item;
  const resourceType = isFolder ? 'folder' : 'file';
  const role = (item as { role?: string }).role || 'owner';
  const canEdit = role !== 'viewer';

  return (
    <aside className="w-80 border-l border-slate-800 bg-slate-900/95 backdrop-blur flex flex-col h-full z-20 text-slate-100">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-slate-800">
        <div className="flex items-center gap-2 overflow-hidden">
          <span>{isFolder ? '📁' : '📄'}</span>
          <h3 className="text-sm font-semibold truncate" title={item.name}>
            {item.name}
          </h3>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
          title="Close details"
        >
          ✕
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-800 text-xs">
        <button
          type="button"
          onClick={() => setTab('details')}
          className={`flex-1 py-2.5 font-medium border-b-2 transition ${
            tab === 'details'
              ? 'border-indigo-500 text-indigo-400 bg-indigo-950/20'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          Details
        </button>
        <button
          type="button"
          onClick={() => setTab('activity')}
          className={`flex-1 py-2.5 font-medium border-b-2 transition ${
            tab === 'activity'
              ? 'border-indigo-500 text-indigo-400 bg-indigo-950/20'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          Activity
        </button>
        {!isFolder && (
          <button
            type="button"
            onClick={() => setTab('versions')}
            className={`flex-1 py-2.5 font-medium border-b-2 transition ${
              tab === 'versions'
                ? 'border-indigo-500 text-indigo-400 bg-indigo-950/20'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Versions
          </button>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 p-4 overflow-y-auto">
        {tab === 'details' && (
          <div className="space-y-4 text-xs">
            <div>
              <span className="text-slate-400 block mb-1">Type</span>
              <p className="font-medium text-slate-200">
                {isFolder ? 'Folder' : (item as FileItem).mime_type}
              </p>
            </div>

            <div>
              <span className="text-slate-400 block mb-1">Size</span>
              <p className="font-medium text-slate-200">
                {formatBytes(parseInt(String(item.size_bytes || 0), 10) || 0)}
              </p>
            </div>

            <div>
              <span className="text-slate-400 block mb-1">Created</span>
              <p className="font-medium text-slate-200">
                {new Date(item.created_at).toLocaleString()}
              </p>
            </div>

            <div>
              <span className="text-slate-400 block mb-1">Last Modified</span>
              <p className="font-medium text-slate-200">
                {new Date(item.updated_at).toLocaleString()}
              </p>
            </div>

            <div>
              <span className="text-slate-400 block mb-1">Access Level</span>
              <span className="inline-block px-2.5 py-1 rounded-full bg-slate-800 border border-slate-700 text-[11px] font-semibold text-indigo-300">
                {role === 'viewer'
                  ? 'Viewer'
                  : role === 'editor'
                  ? 'Editor'
                  : 'Owner'}
              </span>
            </div>
          </div>
        )}

        {tab === 'activity' && (
          <ActivityFeed resourceType={resourceType} resourceId={item.id} />
        )}

        {tab === 'versions' && !isFolder && (
          <VersionList fileId={item.id} canEdit={canEdit} />
        )}
      </div>
    </aside>
  );
}
