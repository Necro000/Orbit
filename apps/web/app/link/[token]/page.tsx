'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Icon } from '@/components/ui/Icons';

interface PublicFile {
  id: string;
  name: string;
  mime_type: string;
  size_bytes: string | number;
  created_at: string;
  updated_at: string;
}

interface PublicFolderChildFile {
  id: string;
  name: string;
  mime_type: string;
  size_bytes: string | number;
  created_at: string;
}

interface PublicFolderChildFolder {
  id: string;
  name: string;
  created_at: string;
}

interface PublicLinkData {
  resourceType: 'file' | 'folder';
  role: 'viewer';
  file?: PublicFile;
  folder?: {
    id: string;
    name: string;
  };
  files?: PublicFolderChildFile[];
  folders?: PublicFolderChildFolder[];
  downloadUrl?: string;
  streamUrl?: string;
  requiresPassword?: boolean;
}

function formatBytes(bytes: number | string): string {
  const num = typeof bytes === 'string' ? parseInt(bytes, 10) : bytes;
  if (!num || isNaN(num) || num === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(num) / Math.log(k));
  return `${parseFloat((num / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export default function PublicLinkPage() {
  const params = useParams();
  const token = typeof params?.token === 'string' ? params.token : '';

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isExpired, setIsExpired] = useState(false);
  const [data, setData] = useState<PublicLinkData | null>(null);

  // Password challenge state
  const [requiresPassword, setRequiresPassword] = useState(false);
  const [password, setPassword] = useState('');
  const [isSubmittingPassword, setIsSubmittingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

  useEffect(() => {
    if (!token) return;
    let isMounted = true;

    async function loadLink() {
      try {
        const url = new URL(`${apiUrl}/api/link/${token}`);
        const res = await fetch(url.toString(), {
          headers: { 'Content-Type': 'application/json' },
        });

        if (!isMounted) return;

        if (res.status === 410) {
          setIsExpired(true);
          setIsLoading(false);
          return;
        }

        if (res.status === 401) {
          setRequiresPassword(true);
          setPasswordError('Password required to view this link.');
          setIsLoading(false);
          return;
        }

        if (res.status === 429) {
          const body = await res.json().catch(() => ({}));
          setError(body?.error?.message || 'Too many attempts. Please try again later.');
          setIsLoading(false);
          return;
        }

        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          setError(body?.error?.message || 'Failed to load link or resource not found.');
          setIsLoading(false);
          return;
        }

        const json = await res.json();
        if (json.requiresPassword) {
          setRequiresPassword(true);
        } else {
          setRequiresPassword(false);
          setData(json);
        }
      } catch {
        if (isMounted) {
          setError('Network error connecting to Orbit server.');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadLink();

    return () => {
      isMounted = false;
    };
  }, [token, apiUrl]);

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) return;
    setIsSubmittingPassword(true);
    setPasswordError(null);

    try {
      const url = new URL(`${apiUrl}/api/link/${token}`);
      url.searchParams.set('password', password);
      const res = await fetch(url.toString(), {
        headers: {
          'Content-Type': 'application/json',
          'x-link-password': password,
        },
      });

      if (res.status === 401) {
        setPasswordError('Incorrect password. Please try again.');
        return;
      }
      if (res.status === 410) {
        setIsExpired(true);
        return;
      }
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body?.error?.message || 'Failed to load link.');
        return;
      }

      const json = await res.json();
      setRequiresPassword(false);
      setData(json);
    } catch {
      setPasswordError('Network error. Please try again.');
    } finally {
      setIsSubmittingPassword(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-between p-4 sm:p-8">
      {/* Header Bar */}
      <header className="w-full max-w-4xl flex items-center justify-between py-4 border-b border-slate-800">
        <div className="flex items-center gap-3 cursor-pointer" onClick={() => router.push('/')}>
          <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center font-black text-white text-lg shadow-lg shadow-indigo-600/30">
            O
          </div>
          <div>
            <span className="text-base font-bold tracking-tight text-white">Orbit</span>
            <span className="text-xs text-indigo-400 ml-2 font-medium bg-indigo-950/60 border border-indigo-800/40 px-2 py-0.5 rounded-full">
              Shared Link
            </span>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="w-full max-w-4xl my-auto py-10">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 space-y-4">
            <div className="w-10 h-10 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-slate-400">Verifying and loading shared content...</p>
          </div>
        ) : isExpired ? (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 max-w-md mx-auto text-center space-y-4 shadow-xl">
            <div className="w-14 h-14 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-2xl flex items-center justify-center mx-auto text-2xl">
              ⏳
            </div>
            <h2 className="text-lg font-semibold text-white">Link Expired</h2>
            <p className="text-xs text-slate-400">
              The owner set an expiration date for this shared link and it is no longer accessible.
            </p>
          </div>
        ) : error ? (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 max-w-md mx-auto text-center space-y-4 shadow-xl">
            <div className="w-14 h-14 bg-red-500/10 text-red-400 border border-red-500/20 rounded-2xl flex items-center justify-center mx-auto text-2xl">
              ⚠️
            </div>
            <h2 className="text-lg font-semibold text-white">Access Denied</h2>
            <p className="text-xs text-slate-400">{error}</p>
          </div>
        ) : requiresPassword ? (
          /* Password Protected Card */
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 max-w-md mx-auto space-y-6 shadow-2xl">
            <div className="text-center space-y-2">
              <div className="w-12 h-12 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded-2xl flex items-center justify-center mx-auto">
                <Icon name="lock" className="w-6 h-6" />
              </div>
              <h2 className="text-lg font-semibold text-white">Password Protected</h2>
              <p className="text-xs text-slate-400">
                This item is protected by a password set by the owner. Please enter it to view.
              </p>
            </div>

            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter link password..."
                  required
                  className="w-full bg-slate-800/90 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              {passwordError && (
                <p className="text-xs text-red-400 bg-red-950/40 border border-red-800/50 rounded-lg p-2.5">
                  {passwordError}
                </p>
              )}

              <button
                type="submit"
                disabled={isSubmittingPassword || !password.trim()}
                className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-xs font-semibold py-2.5 rounded-xl transition shadow-lg shadow-indigo-600/20"
              >
                {isSubmittingPassword ? 'Verifying...' : 'Access Shared Item'}
              </button>
            </form>
          </div>
        ) : data?.resourceType === 'file' && data.file ? (
          /* Single File View Card */
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 space-y-6 shadow-2xl">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-slate-800">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0">
                  <Icon name="file" className="w-7 h-7" />
                </div>
                <div>
                  <h1 className="text-lg font-bold text-white line-clamp-1">{data.file.name}</h1>
                  <p className="text-xs text-slate-400 mt-1">
                    {formatBytes(data.file.size_bytes)} • {data.file.mime_type || 'Unknown Type'}
                  </p>
                </div>
              </div>

              {data.downloadUrl && (
                <a
                  href={data.downloadUrl}
                  download={data.file.name}
                  className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl transition shadow-lg shadow-indigo-600/20 shrink-0"
                >
                  <Icon name="download" className="w-4 h-4" />
                  <span>Download File</span>
                </a>
              )}
            </div>

            {/* Media Previews */}
            {data.file.mime_type?.startsWith('image/') && (data.streamUrl || data.downloadUrl) && (
              <div className="rounded-xl overflow-hidden bg-slate-950 border border-slate-800 flex items-center justify-center max-h-[500px] p-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={data.streamUrl || data.downloadUrl}
                  alt={data.file.name}
                  className="max-h-[460px] max-w-full object-contain rounded-lg"
                />
              </div>
            )}

            {data.file.mime_type?.startsWith('video/') && (data.streamUrl || data.downloadUrl) && (
              <div className="rounded-xl overflow-hidden bg-slate-950 border border-slate-800 flex items-center justify-center max-h-[500px]">
                <video
                  src={data.streamUrl || data.downloadUrl}
                  controls
                  className="max-h-[460px] max-w-full rounded-lg"
                />
              </div>
            )}

            {data.file.mime_type?.startsWith('audio/') && (data.streamUrl || data.downloadUrl) && (
              <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl">
                <audio src={data.streamUrl || data.downloadUrl} controls className="w-full" />
              </div>
            )}

            {data.file.mime_type === 'application/pdf' && (data.streamUrl || data.downloadUrl) && (
              <div className="rounded-xl overflow-hidden bg-slate-950 border border-slate-800 h-[500px]">
                <iframe
                  src={data.streamUrl || data.downloadUrl}
                  title={data.file.name}
                  className="w-full h-full border-0"
                />
              </div>
            )}
          </div>
        ) : data?.resourceType === 'folder' && data.folder ? (
          /* Folder View Card */
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 space-y-6 shadow-2xl">
            <div className="flex items-center gap-4 pb-6 border-b border-slate-800">
              <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
                <Icon name="folder" className="w-7 h-7" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-white">{data.folder.name}</h1>
                <p className="text-xs text-slate-400 mt-1">Shared Folder (View Only)</p>
              </div>
            </div>

            {/* Folder Items */}
            <div className="space-y-2">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Contents</h2>
              <div className="divide-y divide-slate-800/60 rounded-xl border border-slate-800 bg-slate-950/50 overflow-hidden">
                {(!data.folders || data.folders.length === 0) &&
                (!data.files || data.files.length === 0) ? (
                  <p className="text-xs text-slate-500 p-6 text-center">This folder is empty.</p>
                ) : (
                  <>
                    {data.folders?.map((sub) => (
                      <div
                        key={sub.id}
                        className="flex items-center gap-3 p-3.5 text-sm hover:bg-slate-800/40 transition"
                      >
                        <Icon name="folder" className="w-5 h-5 text-amber-400" />
                        <span className="text-xs font-medium text-white">{sub.name}</span>
                      </div>
                    ))}
                    {data.files?.map((f) => (
                      <div
                        key={f.id}
                        className="flex items-center justify-between p-3.5 text-sm hover:bg-slate-800/40 transition"
                      >
                        <div className="flex items-center gap-3">
                          <Icon name="file" className="w-5 h-5 text-indigo-400" />
                          <div>
                            <p className="text-xs font-medium text-white">{f.name}</p>
                            <p className="text-[11px] text-slate-400">{formatBytes(f.size_bytes)}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </>
                )}
              </div>
            </div>
          </div>
        ) : null}
      </main>

      {/* Footer */}
      <footer className="w-full max-w-4xl py-6 border-t border-slate-800/80 text-center text-xs text-slate-500">
        Orbit — Cloud File Storage & Collaboration
      </footer>
    </div>
  );
}
