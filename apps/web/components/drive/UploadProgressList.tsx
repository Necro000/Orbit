'use client';

import React, { useState } from 'react';
import { Icon, getFileIconName } from '../ui/Icons';
import { getFileTint } from '@/lib/fileTints';

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
  onClearCompleted?: () => void;
}

export function UploadProgressList({
  uploads,
  onDismiss,
  onClearCompleted,
}: UploadProgressListProps) {
  const [isMinimized, setIsMinimized] = useState(false);

  if (uploads.length === 0) return null;

  const completedCount = uploads.filter((u) => u.status === 'done').length;
  const failedCount = uploads.filter((u) => u.status === 'failed').length;
  const inProgressCount = uploads.length - completedCount - failedCount;
  const hasFinished = completedCount > 0 || failedCount > 0;

  const handleClear = () => {
    if (onClearCompleted) {
      onClearCompleted();
    } else {
      uploads
        .filter((u) => u.status === 'done' || u.status === 'failed')
        .forEach((u) => onDismiss(u.id));
    }
  };

  return (
    <aside
      className={`upload-progress-panel ${isMinimized ? 'upload-progress-panel--minimized' : ''}`}
      role="region"
      aria-label="Uploads in progress"
    >
      {/* Header */}
      <div className="upload-progress-header">
        <div className="flex items-center gap-2">
          <span className="upload-progress-title">
            Uploads ({completedCount}/{uploads.length})
          </span>
          {inProgressCount > 0 && (
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-sky-500"></span>
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          {hasFinished && (
            <button
              type="button"
              onClick={handleClear}
              className="text-[11px] font-medium text-text-secondary hover:text-text-primary px-2 py-0.5 rounded hover:bg-bg-surface transition-colors cursor-pointer"
              title="Clear finished uploads"
            >
              Clear
            </button>
          )}

          <button
            type="button"
            onClick={() => setIsMinimized(!isMinimized)}
            className="p-1 rounded text-text-secondary hover:text-text-primary hover:bg-bg-surface transition-colors cursor-pointer"
            aria-label={isMinimized ? 'Expand upload panel' : 'Minimize upload panel'}
            title={isMinimized ? 'Expand' : 'Minimize'}
          >
            {isMinimized ? (
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
              </svg>
            ) : (
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Item List */}
      {!isMinimized && (
        <div className="upload-progress-list">
          {uploads.map((item) => {
            const iconName = getFileIconName('', item.fileName);
            const tint = getFileTint('', false, item.fileName);

            return (
              <div key={item.id} className="upload-progress-item">
                {/* Left Mini Icon */}
                <div className={`upload-progress-item-icon ${tint.bgClass} ${tint.textClass} border ${tint.borderClass}`}>
                  <Icon name={iconName} className="w-4 h-4" />
                </div>

                {/* Middle Content */}
                <div className="upload-progress-item-body">
                  <div className="upload-progress-info">
                    <span className="upload-progress-filename" title={item.fileName}>
                      {item.fileName}
                    </span>

                    <span className="upload-progress-status">
                      {item.status === 'uploading' && (
                        <span className="text-sky-400 font-semibold">{item.progressPercent}%</span>
                      )}
                      {item.status === 'processing' && (
                        <span className="text-amber-400">Processing...</span>
                      )}
                      {item.status === 'done' && (
                        <span className="text-emerald-400 flex items-center gap-1 font-medium">
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                          </svg>
                          Completed
                        </span>
                      )}
                      {item.status === 'failed' && (
                        <span className="text-rose-400 font-medium">{item.error || 'Failed'}</span>
                      )}
                    </span>
                  </div>

                  <div className="upload-progress-bar-bg">
                    <div
                      className={`upload-progress-bar-fill upload-progress-bar-fill--${item.status}`}
                      style={{ width: `${item.status === 'done' ? 100 : item.progressPercent}%` }}
                    />
                  </div>
                </div>

                {/* Right Action (Clean Flex Flow, Zero Collision) */}
                {(item.status === 'done' || item.status === 'failed') && (
                  <button
                    type="button"
                    className="upload-progress-dismiss-btn"
                    onClick={() => onDismiss(item.id)}
                    aria-label={`Dismiss ${item.fileName}`}
                    title="Dismiss"
                  >
                    <Icon name="close" className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </aside>
  );
}
