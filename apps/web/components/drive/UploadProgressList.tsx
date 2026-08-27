'use client';

import React from 'react';
import { Icon } from '../ui/Icons';

export interface UploadProgressItem {
  id: string;
  fileName: string;
  progressPercent: number;
  status: 'uploading' | 'processing' | 'done' | 'failed';
  error?: string;
}

interface UploadProgressListProps {
  uploads: UploadProgressItem[];
  onDismiss: (id: string) => void;
}

export function UploadProgressList({ uploads, onDismiss }: UploadProgressListProps) {
  if (uploads.length === 0) return null;

  return (
    <div className="upload-progress-panel" role="region" aria-label="Uploads in progress">
      <div className="upload-progress-header">
        <span className="upload-progress-title">
          Uploads ({uploads.filter((u) => u.status === 'done').length}/{uploads.length})
        </span>
      </div>
      <div className="upload-progress-list">
        {uploads.map((item) => (
          <div key={item.id} className="upload-progress-item">
            <div className="upload-progress-info">
              <span className="upload-progress-filename" title={item.fileName}>
                {item.fileName}
              </span>
              <span className="upload-progress-status">
                {item.status === 'uploading' && `${item.progressPercent}%`}
                {item.status === 'processing' && 'Processing...'}
                {item.status === 'done' && 'Completed'}
                {item.status === 'failed' && (item.error || 'Failed')}
              </span>
            </div>

            <div className="upload-progress-bar-bg">
              <div
                className={`upload-progress-bar-fill upload-progress-bar-fill--${item.status}`}
                style={{ width: `${item.status === 'done' ? 100 : item.progressPercent}%` }}
              />
            </div>

            {(item.status === 'done' || item.status === 'failed') && (
              <button
                type="button"
                className="upload-progress-dismiss-btn"
                onClick={() => onDismiss(item.id)}
                aria-label={`Dismiss ${item.fileName}`}
              >
                <Icon name="close" className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
