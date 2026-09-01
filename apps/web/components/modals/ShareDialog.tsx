'use client';

import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import { useShares, createShare, revokeShare, type ShareEntry } from '@/lib/shares';
import { useToast } from '@/components/ui/Toast';

interface ShareDialogProps {
  isOpen: boolean;
  onClose: () => void;
  resource: {
    id: string;
    name: string;
    type: 'file' | 'folder';
  } | null;
}

export function ShareDialog({ isOpen, onClose, resource }: ShareDialogProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'viewer' | 'editor'>('viewer');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const { data: shares = [], isLoading } = useShares(
    resource?.type ?? 'file',
    resource?.id ?? '',
  );

  if (!isOpen || !resource) return null;

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      await createShare({
        resourceType: resource.type,
        resourceId: resource.id,
        granteeEmail: email.trim(),
        role,
      });
      void queryClient.invalidateQueries({ queryKey: ['shares', resource.type, resource.id] });
      setEmail('');
      toast({ type: 'success', message: `Shared with ${email.trim()}` });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to share.';
      setErrorMsg(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRevoke = async (shareId: string, granteeEmail?: string) => {
    try {
      await revokeShare(shareId);
      void queryClient.invalidateQueries({ queryKey: ['shares', resource.type, resource.id] });
      toast({ type: 'info', message: `Access revoked for ${granteeEmail ?? 'user'}` });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to revoke.';
      toast({ type: 'error', message: msg });
    }
  };

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="share-dialog-title">
      <div className="modal-backdrop" onClick={onClose} />
      <div className="modal-card max-w-lg w-full bg-slate-900 border border-slate-700 rounded-2xl p-6 shadow-2xl text-slate-100 relative z-10">
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div>
            <h2 id="share-dialog-title" className="text-lg font-semibold flex items-center gap-2">
              <span>👥</span> Share &ldquo;{resource.name}&rdquo;
            </h2>
            <p className="text-xs text-slate-400 mt-1">Manage collaborators and view permissions</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800"
          >
            ✕
          </button>
        </div>

        {/* Invite Form */}
        <form onSubmit={handleInvite} className="mt-4 space-y-3">
          <label className="block text-xs font-medium text-slate-300">Invite by Email</label>
          <div className="flex gap-2">
            <input
              type="email"
              placeholder="colleague@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              required
            />
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as 'viewer' | 'editor')}
              className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
            >
              <option value="viewer">Viewer</option>
              <option value="editor">Editor</option>
            </select>
            <button
              type="submit"
              disabled={isSubmitting}
              className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition"
            >
              {isSubmitting ? '...' : 'Invite'}
            </button>
          </div>
          {errorMsg && <p className="text-xs text-red-400">{errorMsg}</p>}
        </form>

        {/* Current Grantees */}
        <div className="mt-6">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">Who has access</h3>
          {isLoading ? (
            <p className="text-xs text-slate-500 py-4 text-center">Loading collaborators...</p>
          ) : shares.length === 0 ? (
            <p className="text-xs text-slate-500 py-4 text-center">No one else has access yet.</p>
          ) : (
            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {shares.map((share: ShareEntry) => (
                <div
                  key={share.id}
                  className="flex items-center justify-between p-2.5 rounded-lg bg-slate-800/50 border border-slate-800 text-sm"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-indigo-900/60 text-indigo-300 font-semibold flex items-center justify-center text-xs">
                      {(share.grantee_name || share.grantee_email || 'U').charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-medium text-xs text-white">{share.grantee_name || share.grantee_email}</p>
                      <p className="text-[11px] text-slate-400">{share.grantee_email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-950 text-indigo-300 border border-indigo-800">
                      {share.role === 'editor' ? 'Editor' : 'Viewer'}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRevoke(share.id, share.grantee_email)}
                      className="text-xs text-red-400 hover:text-red-300 hover:bg-red-950/40 p-1.5 rounded transition"
                      title="Revoke access"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg transition"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
