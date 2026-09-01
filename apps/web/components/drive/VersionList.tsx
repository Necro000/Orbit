'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchFileVersions, revertFileVersion, type FileVersion } from '@/lib/versions';
import { formatBytes } from '@/lib/format';

interface VersionListProps {
  fileId: string;
  canEdit?: boolean;
}

export function VersionList({ fileId, canEdit = true }: VersionListProps) {
  const queryClient = useQueryClient();
  const [selectedVersion, setSelectedVersion] = useState<FileVersion | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['file-versions', fileId],
    queryFn: () => fetchFileVersions(fileId),
  });

  const revertMutation = useMutation({
    mutationFn: async ({ versionId, currentVersionId }: { versionId: string; currentVersionId?: string }) => {
      return revertFileVersion(fileId, versionId, currentVersionId);
    },
    onSuccess: () => {
      setSelectedVersion(null);
      setErrorMessage(null);
      void queryClient.invalidateQueries({ queryKey: ['file-versions', fileId] });
      void queryClient.invalidateQueries({ queryKey: ['folder'] });
      void queryClient.invalidateQueries({ queryKey: ['recent'] });
    },
    onError: (err: unknown) => {
      const apiErr = err as { code?: string; message?: string };
      if (apiErr?.code === 'VERSION_CONFLICT') {
        setErrorMessage('This file was updated since you loaded this view. Please refresh and retry.');
      } else if (apiErr?.code === 'VERSION_NOT_FOUND') {
        setErrorMessage('The selected version no longer exists or was pruned by retention policy.');
      } else {
        setErrorMessage(apiErr?.message || 'Failed to revert version. Please try again.');
      }
    },
  });

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-slate-400 space-y-3">
        <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-xs">Loading version history...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-4 text-center text-rose-400 text-xs bg-rose-950/30 border border-rose-900/40 rounded-lg">
        Failed to load version history.
      </div>
    );
  }

  const versions = data.versions || [];

  if (versions.length === 0) {
    return (
      <div className="p-6 text-center text-slate-500 text-xs">
        <div className="text-2xl mb-2">📜</div>
        No version history available for this file.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {errorMessage && (
        <div className="p-3 text-xs bg-rose-950/60 border border-rose-800 text-rose-300 rounded-lg flex items-start space-x-2">
          <span className="text-base flex-shrink-0">⚠️</span>
          <div className="flex-1">
            <p>{errorMessage}</p>
            <button
              onClick={() => {
                setErrorMessage(null);
                void refetch();
              }}
              className="mt-1.5 text-xs text-indigo-400 hover:text-indigo-300 underline font-medium"
            >
              Refresh View
            </button>
          </div>
        </div>
      )}

      <div className="divide-y divide-slate-800 border border-slate-800 rounded-lg overflow-hidden bg-slate-900/60">
        {versions.map((ver) => {
          const formattedDate = new Date(ver.createdAt).toLocaleString(undefined, {
            dateStyle: 'medium',
            timeStyle: 'short',
          });

          return (
            <div
              key={ver.id}
              className={`p-3.5 flex items-center justify-between transition-colors ${
                ver.isCurrent ? 'bg-indigo-950/30' : 'hover:bg-slate-800/40'
              }`}
            >
              <div className="space-y-1 min-w-0 pr-3">
                <div className="flex items-center space-x-2">
                  <span className="font-semibold text-xs text-slate-200">
                    Version {ver.versionNumber}
                  </span>
                  {ver.isCurrent ? (
                    <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      <span>✓</span>
                      <span>Current</span>
                    </span>
                  ) : null}
                </div>
                <div className="text-[11px] text-slate-400 flex items-center space-x-2">
                  <span>{formattedDate}</span>
                  <span>•</span>
                  <span>{formatBytes(Number(ver.sizeBytes))}</span>
                </div>
              </div>

              {!ver.isCurrent && canEdit && (
                <button
                  type="button"
                  onClick={() => {
                    setErrorMessage(null);
                    setSelectedVersion(ver);
                  }}
                  className="flex items-center space-x-1.5 text-xs px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700 transition"
                  title={`Revert to Version ${ver.versionNumber}`}
                >
                  <svg className="w-3 h-3 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                  </svg>
                  <span>Revert</span>
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Confirmation Modal for Revert */}
      {selectedVersion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-sm w-full p-5 space-y-4 shadow-2xl">
            <div className="flex items-center space-x-3 text-amber-400">
              <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center text-lg">
                ↺
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-100">Revert File Version</h3>
                <p className="text-xs text-slate-400">Version {selectedVersion.versionNumber}</p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Are you sure you want to set <strong>Version {selectedVersion.versionNumber}</strong> as the active file?
              This will update what users download when accessing this file.
            </p>

            <div className="flex items-center justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setSelectedVersion(null)}
                disabled={revertMutation.isPending}
                className="px-3 py-1.5 text-xs text-slate-300 hover:text-white rounded-lg hover:bg-slate-800 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  revertMutation.mutate({
                    versionId: selectedVersion.id,
                    currentVersionId: data.currentVersionId || undefined,
                  });
                }}
                disabled={revertMutation.isPending}
                className="px-3.5 py-1.5 text-xs font-medium bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition flex items-center space-x-1.5 shadow-lg shadow-indigo-600/30"
              >
                {revertMutation.isPending ? (
                  <>
                    <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Reverting...</span>
                  </>
                ) : (
                  <span>Confirm Revert</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
