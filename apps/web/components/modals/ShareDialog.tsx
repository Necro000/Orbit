'use client';

import React, { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import {
  useShares,
  useLinkShare,
  createShare,
  revokeShare,
  createLinkShare,
  revokeLinkShare,
  type ShareEntry,
} from '@/lib/shares';
import { useCurrentUser } from '@/lib/auth';
import { useToast } from '@/components/ui/Toast';
import { Icon } from '@/components/ui/Icons';

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
  const { data: currentUser } = useCurrentUser();

  // Invite state
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'viewer' | 'editor'>('viewer');
  const [isInviting, setIsInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);

  // Link / General Access state
  const [isCopied, setIsCopied] = useState(false);
  const [isLinkUpdating, setIsLinkUpdating] = useState(false);
  const [showAdvancedLink, setShowAdvancedLink] = useState(false);
  const [password, setPassword] = useState('');
  const expiresInDays: string = '7';

  const resourceType = resource?.type ?? 'file';
  const resourceId = resource?.id ?? '';

  const { data: sharesData, isLoading: isLoadingShares } = useShares(resourceType, resourceId);
  const { data: linkShare, isLoading: isLoadingLink } = useLinkShare(resourceType, resourceId);

  const shares: ShareEntry[] = sharesData?.shares ?? [];
  const owner = sharesData?.owner ?? null;
  const isOwnerOrAcl = Boolean(sharesData?.userAccess?.canManageAcl);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        handleClose();
      }
    }
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen]);

  const publicUrl = linkShare
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/link/${linkShare.token}`
    : typeof window !== 'undefined' && resource
      ? `${window.location.origin}/drive?${resource.type}=${resource.id}`
      : '';

  const handleClose = () => {
    setEmail('');
    setRole('viewer');
    setInviteError(null);
    setIsCopied(false);
    setShowAdvancedLink(false);
    setPassword('');
    onClose();
  };

  if (!isOpen || !resource) return null;

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setIsInviting(true);
    setInviteError(null);
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
      setInviteError(msg);
    } finally {
      setIsInviting(false);
    }
  };

  const handleRoleChange = async (share: ShareEntry, newRole: 'viewer' | 'editor' | 'remove') => {
    try {
      if (newRole === 'remove') {
        await revokeShare(share.id);
        void queryClient.invalidateQueries({ queryKey: ['shares', resource.type, resource.id] });
        toast({ type: 'info', message: `Removed ${share.grantee_name || share.grantee_email || 'collaborator'}` });
      } else {
        await createShare({
          resourceType: resource.type,
          resourceId: resource.id,
          granteeUserId: share.grantee_user_id,
          granteeEmail: share.grantee_email,
          role: newRole,
        });
        void queryClient.invalidateQueries({ queryKey: ['shares', resource.type, resource.id] });
        toast({ type: 'success', message: `Updated permission to ${newRole}` });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update permission.';
      toast({ type: 'error', message: msg });
    }
  };

  const handleGeneralAccessChange = async (accessMode: 'restricted' | 'public') => {
    setIsLinkUpdating(true);
    try {
      if (accessMode === 'restricted' && linkShare) {
        await revokeLinkShare(linkShare.id);
        void queryClient.invalidateQueries({ queryKey: ['linkShare', resource.type, resource.id] });
        toast({ type: 'info', message: 'General access set to Restricted.' });
      } else if (accessMode === 'public' && !linkShare) {
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
        void queryClient.invalidateQueries({ queryKey: ['linkShare', resource.type, resource.id] });
        toast({ type: 'success', message: 'Anyone with the link can now access.' });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to change access.';
      toast({ type: 'error', message: msg });
    } finally {
      setIsLinkUpdating(false);
    }
  };

  const handleCopyLink = async () => {
    try {
      let copyTarget = publicUrl;
      // If no public link exists and user has ACL rights, create one quickly
      if (!linkShare && isOwnerOrAcl) {
        const newLink = await createLinkShare({
          resourceType: resource.type,
          resourceId: resource.id,
        });
        void queryClient.invalidateQueries({ queryKey: ['linkShare', resource.type, resource.id] });
        copyTarget = `${window.location.origin}/link/${newLink.token}`;
      }

      if (navigator.clipboard && copyTarget) {
        await navigator.clipboard.writeText(copyTarget);
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2500);
        toast({ type: 'success', message: 'Link copied to clipboard!' });
      }
    } catch {
      toast({ type: 'info', message: 'Failed to copy link.' });
    }
  };

  const isCurrentOwner = currentUser?.id === owner?.id;

  return (
    <div className="modal-backdrop" onClick={handleClose}>
      <div
        className="modal-card max-w-xl w-full max-h-[calc(100vh-2rem)] overflow-y-auto bg-bg-surface border border-border-subtle rounded-2xl p-6 shadow-2xl text-text-primary relative z-10 animate-scale-in my-auto"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="share-dialog-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-border-subtle">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-accent/10 border border-accent/20 text-accent flex items-center justify-center">
              <Icon name={resource.type === 'folder' ? 'folder' : 'file'} className="w-5 h-5" />
            </div>
            <div>
              <h2 id="share-dialog-title" className="text-base font-semibold text-text-primary flex items-center gap-2 line-clamp-1">
                Share &ldquo;{resource.name}&rdquo;
              </h2>
              <p className="text-xs text-text-secondary">Collaborate with individuals or configure public access</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="text-text-secondary hover:text-text-primary p-2 rounded-lg hover:bg-bg-surface-hover transition cursor-pointer"
            aria-label="Close dialog"
          >
            <Icon name="close" className="w-4 h-4" />
          </button>
        </div>

        {/* Section 1: Add People and Groups */}
        {isOwnerOrAcl && (
          <form onSubmit={handleInvite} className="mt-5 space-y-2">
            <div className="flex items-center gap-2 bg-bg-surface-hover/80 border border-border-subtle focus-within:border-accent focus-within:ring-1 focus-within:ring-accent/50 rounded-xl p-1.5 transition">
              <div className="pl-2 text-text-secondary">
                <Icon name="user" className="w-4 h-4" />
              </div>
              <input
                type="email"
                placeholder="Add people by email..."
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="flex-1 bg-transparent px-2 py-1 text-sm text-text-primary placeholder-text-secondary focus:outline-none"
                required
                autoFocus
              />
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as 'viewer' | 'editor')}
                className="bg-bg-surface hover:bg-bg-surface-hover border border-border-subtle rounded-lg px-2.5 py-1 text-xs text-text-primary focus:outline-none cursor-pointer"
              >
                <option value="viewer" className="bg-bg-surface text-text-primary">Viewer</option>
                <option value="editor" className="bg-bg-surface text-text-primary">Editor</option>
              </select>
              <button
                type="submit"
                disabled={isInviting || !email.trim()}
                className="bg-accent hover:bg-accent-hover disabled:opacity-40 text-white text-xs font-semibold px-3.5 py-1.5 rounded-lg transition shrink-0 cursor-pointer"
              >
                {isInviting ? 'Inviting...' : 'Invite'}
              </button>
            </div>
            {inviteError && <p className="text-xs text-rose-400 px-1">{inviteError}</p>}
          </form>
        )}

        {/* Section 2: People with access */}
        <div className="mt-6">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-text-secondary mb-2.5">
            People with access
          </h3>
          <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
            {/* Owner Row */}
            {owner && (
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-bg-surface-hover/40 border border-border-subtle text-sm">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-accent/20 text-accent font-semibold flex items-center justify-center text-xs border border-accent/30">
                    {(owner.name || owner.email || 'O').charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <p className="font-medium text-xs text-text-primary">{owner.name || 'Owner'}</p>
                      {isCurrentOwner && <span className="text-[10px] text-accent font-medium">(you)</span>}
                    </div>
                    <p className="text-[11px] text-text-secondary">{owner.email}</p>
                  </div>
                </div>
                <span className="text-xs font-medium text-text-secondary px-2.5 py-1">Owner</span>
              </div>
            )}

            {/* Collaborators */}
            {isLoadingShares ? (
              <p className="text-xs text-text-secondary py-3 text-center">Loading collaborators...</p>
            ) : shares.length === 0 && !owner ? (
              <p className="text-xs text-text-secondary py-3 text-center">No collaborators added yet.</p>
            ) : (
              shares.map((share: ShareEntry) => (
                <div
                  key={share.id}
                  className="flex items-center justify-between p-2.5 rounded-xl bg-bg-surface-hover/40 border border-border-subtle text-sm hover:bg-bg-surface-hover/70 transition"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-400 font-semibold flex items-center justify-center text-xs border border-emerald-500/30">
                      {(share.grantee_name || share.grantee_email || 'U').charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-medium text-xs text-text-primary">
                        {share.grantee_name || share.grantee_email}
                      </p>
                      <p className="text-[11px] text-text-secondary">{share.grantee_email}</p>
                    </div>
                  </div>

                  {isOwnerOrAcl ? (
                    <select
                      value={share.role}
                      onChange={(e) =>
                        handleRoleChange(share, e.target.value as 'viewer' | 'editor' | 'remove')
                      }
                      className="bg-bg-surface hover:bg-bg-surface-hover border border-border-subtle rounded-lg px-2 py-1 text-xs text-text-primary focus:outline-none cursor-pointer"
                    >
                      <option value="viewer" className="bg-bg-surface text-text-primary">Viewer</option>
                      <option value="editor" className="bg-bg-surface text-text-primary">Editor</option>
                      <option value="remove" className="bg-bg-surface text-rose-400">Remove access</option>
                    </select>
                  ) : (
                    <span className="text-xs text-text-secondary px-2 py-1 capitalize">{share.role}</span>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Section 3: General Access (Google Drive Style) */}
        <div className="mt-6 pt-4 border-t border-border-subtle">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-text-secondary mb-2.5">
            General access
          </h3>

          <div className="p-3.5 bg-bg-surface-hover/40 border border-border-subtle rounded-xl space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-xs mt-0.5 ${
                    linkShare
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      : 'bg-bg-surface text-text-secondary border border-border-subtle'
                  }`}
                >
                  <Icon name={linkShare ? 'globe' : 'lock'} className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    {isOwnerOrAcl ? (
                      <select
                        disabled={isLinkUpdating || isLoadingLink}
                        value={linkShare ? 'public' : 'restricted'}
                        onChange={(e) =>
                          handleGeneralAccessChange(e.target.value as 'restricted' | 'public')
                        }
                        className="bg-transparent font-medium text-xs text-text-primary hover:text-accent cursor-pointer focus:outline-none"
                      >
                        <option value="restricted" className="bg-bg-surface text-text-primary">
                          Restricted
                        </option>
                        <option value="public" className="bg-bg-surface text-text-primary">
                          Anyone with the link
                        </option>
                      </select>
                    ) : (
                      <span className="font-medium text-xs text-text-primary">
                        {linkShare ? 'Anyone with the link' : 'Restricted'}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-text-secondary mt-0.5">
                    {linkShare
                      ? 'Anyone on the Internet with the link can view and download'
                      : 'Only people with access can open with the link'}
                  </p>
                </div>
              </div>

              {linkShare && (
                <div className="flex items-center gap-2">
                  <span className="text-xs bg-bg-surface border border-border-subtle px-2 py-0.5 rounded text-text-secondary">
                    Viewer
                  </span>
                  {isOwnerOrAcl && (
                    <button
                      type="button"
                      onClick={() => setShowAdvancedLink(!showAdvancedLink)}
                      className="text-[11px] text-accent hover:underline cursor-pointer"
                    >
                      {showAdvancedLink ? 'Hide options' : 'Options'}
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Advanced Options for Link Share */}
            {linkShare && showAdvancedLink && isOwnerOrAcl && (
              <div className="pt-2 border-t border-border-subtle space-y-2.5 text-xs">
                <div className="flex flex-wrap items-center justify-between gap-2 text-text-secondary">
                  <div className="flex items-center gap-2">
                    <span>Security:</span>
                    {linkShare.hasPassword ? (
                      <span className="bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded">
                        🔒 Password protected
                      </span>
                    ) : (
                      <span>No password</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span>Expires:</span>
                    {linkShare.expiresAt ? (
                      <span className="bg-bg-surface text-text-primary px-2 py-0.5 rounded border border-border-subtle">
                        ⏳ {new Date(linkShare.expiresAt).toLocaleDateString()}
                      </span>
                    ) : (
                      <span>Never</span>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="mt-6 flex items-center justify-between pt-4 border-t border-border-subtle">
          <button
            type="button"
            onClick={handleCopyLink}
            className={`flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-xl border transition cursor-pointer ${
              isCopied
                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                : 'bg-bg-surface-hover hover:bg-bg-surface text-text-primary border-border-subtle'
            }`}
          >
            <Icon name={isCopied ? 'check' : 'link'} className="w-4 h-4" />
            <span>{isCopied ? 'Link copied!' : 'Copy link'}</span>
          </button>

          <button
            type="button"
            onClick={handleClose}
            className="px-5 py-2 text-xs font-semibold bg-accent hover:bg-accent-hover text-white rounded-xl transition shadow-lg shadow-accent/20 cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

