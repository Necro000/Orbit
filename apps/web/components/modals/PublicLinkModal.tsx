'use client';

import React, { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import { useLinkShare, createLinkShare, revokeLinkShare } from '@/lib/shares';
import { useToast } from '@/components/ui/Toast';

interface PublicLinkModalProps {
  isOpen: boolean;
  onClose: () => void;
  resource: {
    id: string;
    name: string;
    type: 'file' | 'folder';
  } | null;
}

export function PublicLinkModal({ isOpen, onClose, resource }: PublicLinkModalProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [password, setPassword] = useState('');
  const [expiresInDays, setExpiresInDays] = useState('7');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data: linkShare, isLoading } = useLinkShare(
    resource?.type ?? 'file',
    resource?.id ?? '',
  );

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onClose();
      }
    }
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, onClose]);

  if (!isOpen || !resource) return null;

  const publicUrl = linkShare
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/link/${linkShare.token}`
    : '';

  const handleCreateLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      let expiresAt: string | null = null;
      if (expiresInDays !== 'never') {
        const d = new Date();
        d.setDate(d.getDate() + parseInt(expiresInDays, 10));
        expiresAt = d.toISOString();
      }

      await createLinkShare({
        resourceType: resource.type,
        resourceId: resource.id,
        password: password.trim() || null,
        expiresAt,
      });

      void queryClient.invalidateQueries({
        queryKey: ['linkShare', resource.type, resource.id],
      });
      toast({ type: 'success', message: 'Public link created!' });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to create link.';
      toast({ type: 'error', message: msg });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(publicUrl);
      toast({ type: 'success', message: 'Link copied to clipboard!' });
    } catch {
      toast({ type: 'info', message: 'Please copy manually.' });
    }
  };

  const handleRevoke = async () => {
    if (!linkShare) return;
    try {
      await revokeLinkShare(linkShare.id);
      void queryClient.invalidateQueries({
        queryKey: ['linkShare', resource.type, resource.id],
      });
      toast({ type: 'info', message: 'Public link disabled.' });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to revoke link.';
      toast({ type: 'error', message: msg });
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-card max-w-lg w-full max-h-[calc(100vh-2rem)] overflow-y-auto bg-bg-surface border border-border-subtle rounded-2xl p-6 shadow-2xl text-text-primary relative z-10 animate-scale-in my-auto"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="public-link-title"
      >
        <div className="flex items-center justify-between pb-4 border-b border-border-subtle">
          <div>
            <h2 id="public-link-title" className="text-lg font-semibold flex items-center gap-2 text-text-primary">
              <span>🔗</span> Public Link for &ldquo;{resource.name}&rdquo;
            </h2>
            <p className="text-xs text-text-secondary mt-1">Anyone with the link can view/download this item</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-text-secondary hover:text-text-primary p-1.5 rounded-lg hover:bg-bg-surface-hover transition cursor-pointer"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {isLoading ? (
          <p className="text-xs text-text-secondary py-8 text-center">Checking link status...</p>
        ) : linkShare ? (
          <div className="mt-4 space-y-4">
            <div className="p-3 bg-bg-surface-hover/50 border border-border-subtle rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" /> Link Active
                </span>
                <div className="flex gap-2">
                  {linkShare.hasPassword && (
                    <span className="text-[10px] bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded-full">
                      🔒 Password Protected
                    </span>
                  )}
                  {linkShare.expiresAt && (
                    <span className="text-[10px] bg-bg-surface text-text-secondary px-2 py-0.5 rounded-full border border-border-subtle">
                      ⏳ Expires: {new Date(linkShare.expiresAt).toLocaleDateString()}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="text"
                  readOnly
                  value={publicUrl}
                  className="flex-1 bg-bg-surface border border-border-subtle rounded-lg px-3 py-1.5 text-xs text-text-primary select-all focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleCopy}
                  className="bg-accent hover:bg-accent-hover text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition cursor-pointer"
                >
                  Copy
                </button>
              </div>
            </div>

            <div className="flex justify-between items-center pt-2">
              <button
                type="button"
                onClick={handleRevoke}
                className="text-xs text-rose-400 hover:text-rose-300 hover:underline cursor-pointer"
              >
                Disable Public Link
              </button>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm bg-bg-surface-hover hover:bg-bg-surface text-text-primary border border-border-subtle rounded-lg transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleCreateLink} className="mt-4 space-y-4">
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">
                Password Protection (Optional)
              </label>
              <input
                type="password"
                placeholder="Leave blank for no password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-bg-surface border border-border-subtle rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary focus:outline-none focus:border-accent"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Expiration</label>
              <select
                value={expiresInDays}
                onChange={(e) => setExpiresInDays(e.target.value)}
                className="w-full bg-bg-surface border border-border-subtle rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent cursor-pointer"
              >
                <option value="1" className="bg-bg-surface text-text-primary">Expires in 24 hours</option>
                <option value="7" className="bg-bg-surface text-text-primary">Expires in 7 days</option>
                <option value="30" className="bg-bg-surface text-text-primary">Expires in 30 days</option>
                <option value="never" className="bg-bg-surface text-text-primary">Never expires</option>
              </select>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm bg-bg-surface-hover hover:bg-bg-surface text-text-secondary hover:text-text-primary border border-border-subtle rounded-lg transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-4 py-2 text-sm bg-accent hover:bg-accent-hover disabled:opacity-50 text-white font-medium rounded-lg transition cursor-pointer"
              >
                {isSubmitting ? 'Creating...' : 'Create Public Link'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
