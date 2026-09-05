'use client';

import React, { useState, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { CurrentUser, useStorageBreakdown, updateProfile, changePassword } from '@/lib/auth';
import { formatBytes } from '@/lib/format';
import { useToast } from '@/components/ui/Toast';
import { apiFetch, ApiError } from '@/lib/api';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: CurrentUser;
}

type TabType = 'profile' | 'security' | 'storage';

export function SettingsModal({ isOpen, onClose, currentUser }: SettingsModalProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<TabType>('profile');

  // Profile Form State
  const [name, setName] = useState(currentUser.name);
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);

  // Security Form State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPass, setShowCurrentPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);
  const [isChangingPass, setIsChangingPass] = useState(false);

  // Storage Breakdown Query
  const { data: storage } = useStorageBreakdown();
  const [isEmptyingTrash, setIsEmptyingTrash] = useState(false);

  // Real-time password strength
  const passwordStrength = useMemo(() => {
    if (!newPassword) return { score: 0, label: '', color: '', width: '0%' };
    let score = 0;
    if (newPassword.length >= 8) score += 1;
    if (/[A-Z]/.test(newPassword)) score += 1;
    if (/[a-z]/.test(newPassword)) score += 1;
    if (/[0-9]/.test(newPassword)) score += 1;
    if (/[^a-zA-Z0-9]/.test(newPassword)) score += 1;

    if (score <= 2) {
      return { score, label: 'Weak', color: '#f87171', width: '33%' };
    } else if (score <= 4) {
      return { score, label: 'Medium', color: '#fbbf24', width: '66%' };
    } else {
      return { score, label: 'Strong', color: '#34d399', width: '100%' };
    }
  }, [newPassword]);

  if (!isOpen) return null;

  const initials = currentUser.name
    ? currentUser.name
        .split(' ')
        .map((p) => p[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : 'U';

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    const cleanName = name.trim();

    if (cleanName.length < 2) {
      toast({ type: 'error', message: 'Name must be at least 2 characters.' });
      return;
    }
    if (/^\d+$/.test(cleanName)) {
      toast({ type: 'error', message: 'Name cannot be numbers only. Please use letters.' });
      return;
    }
    if (!/[a-zA-Z]/.test(cleanName)) {
      toast({ type: 'error', message: 'Name must contain at least one letter.' });
      return;
    }

    setIsUpdatingProfile(true);
    try {
      await updateProfile(cleanName);
      await queryClient.invalidateQueries({ queryKey: ['auth', 'me'] });
      toast({ type: 'success', message: 'Profile updated successfully!' });
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Failed to update profile.';
      toast({ type: 'error', message: msg });
    } finally {
      setIsUpdatingProfile(false);
    }
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();

    if (!currentPassword) {
      toast({ type: 'error', message: 'Please enter your current password.' });
      return;
    }
    if (passwordStrength.score < 5) {
      toast({
        type: 'error',
        message: 'New password must contain at least 8 characters, uppercase, lowercase, number, and special character.',
      });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ type: 'error', message: 'New passwords do not match.' });
      return;
    }

    setIsChangingPass(true);
    try {
      await changePassword(currentPassword, newPassword);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      toast({ type: 'success', message: 'Password changed successfully! Other sessions logged out.' });
    } catch (err) {
      const msg = (err instanceof ApiError && err.message?.trim())
        ? err.message
        : 'Failed to change password. Please check your current password and try again.';
      toast({ type: 'error', message: msg });
    } finally {
      setIsChangingPass(false);
    }
  }

  async function handleEmptyTrash() {
    if (!confirm('Are you sure you want to permanently empty the trash? This cannot be undone.')) {
      return;
    }

    setIsEmptyingTrash(true);
    try {
      await apiFetch('/api/trash', { method: 'DELETE' });
      await queryClient.invalidateQueries({ queryKey: ['auth', 'storage-breakdown'] });
      await queryClient.invalidateQueries({ queryKey: ['auth', 'me'] });
      await queryClient.invalidateQueries({ queryKey: ['trash'] });
      toast({ type: 'success', message: 'Trash emptied permanently! Storage reclaimed.' });
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Failed to empty trash.';
      toast({ type: 'error', message: msg });
    } finally {
      setIsEmptyingTrash(false);
    }
  }

  // Storage calculations
  const maxStorage = storage?.maxStorageBytes || 15 * 1024 * 1024 * 1024;
  const knownUsedBytes = currentUser.storageUsedBytes ?? 0;
  const totalUsed = storage ? storage.totalUsed : knownUsedBytes;
  const usedPercent = Math.min(100, (totalUsed / maxStorage) * 100);

  const videoPct = storage ? (storage.videos / maxStorage) * 100 : 0;
  const audioPct = storage ? (storage.audios / maxStorage) * 100 : 0;
  const imagePct = storage ? (storage.images / maxStorage) * 100 : 0;
  const docPct = storage ? (storage.documents / maxStorage) * 100 : 0;
  const trashPct = storage ? (storage.trash / maxStorage) * 100 : 0;
  const fallbackPct = !storage ? usedPercent : 0;

  return (
    <div
      className="modal-backdrop fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md"
      onClick={onClose}
    >
      <div
        className="modal-container w-full max-w-xl bg-[#0f172a]/95 border border-slate-700/70 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center font-bold text-white shadow-md shadow-indigo-500/20">
              {initials}
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Profile & Settings</h2>
              <p className="text-xs text-slate-400">{currentUser.email}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white p-2 rounded-lg hover:bg-slate-800/80 transition-colors"
            aria-label="Close settings"
          >
            ✕
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center px-6 border-b border-slate-800/80 bg-slate-900/40">
          <button
            type="button"
            onClick={() => setActiveTab('profile')}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'profile'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>👤</span> Profile
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('security')}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'security'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>🔒</span> Security
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('storage')}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'storage'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>📊</span> Storage & Quota
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-6 overflow-y-auto flex-1">
          {activeTab === 'profile' && (
            <form onSubmit={handleSaveProfile} className="flex flex-col gap-5">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                  Display Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-900/80 border border-slate-700/80 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-sm transition"
                  placeholder="Enter your name"
                  required
                />
                <span className="text-[11px] text-slate-400 mt-1 block">
                  Must contain letters and be at least 2 characters long.
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                  Email Address
                </label>
                <div className="relative">
                  <input
                    type="email"
                    value={currentUser.email}
                    disabled
                    className="w-full px-3.5 py-2.5 bg-slate-950/60 border border-slate-800 rounded-xl text-slate-400 text-sm cursor-not-allowed pr-24"
                  />
                  <span className="absolute right-3 top-2.5 text-[11px] font-semibold bg-emerald-950/80 text-emerald-300 border border-emerald-800 px-2 py-0.5 rounded-full flex items-center gap-1">
                    🔒 Verified
                  </span>
                </div>
                <span className="text-[11px] text-slate-500 mt-1 block">
                  Email is locked to your account identity.
                </span>
              </div>

              <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-4 flex flex-col gap-2 text-xs text-slate-400">
                <div className="flex justify-between">
                  <span>Account ID:</span>
                  <span className="font-mono text-slate-300">{currentUser.id.slice(0, 13)}...</span>
                </div>
                <div className="flex justify-between">
                  <span>Member Since:</span>
                  <span className="text-slate-300">
                    {new Date(currentUser.createdAt).toLocaleDateString(undefined, {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </span>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={isUpdatingProfile || name.trim() === currentUser.name}
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold shadow-lg shadow-indigo-600/30 transition-all"
                >
                  {isUpdatingProfile ? 'Saving...' : 'Save Profile'}
                </button>
              </div>
            </form>
          )}

          {activeTab === 'security' && (
            <form onSubmit={handleChangePassword} className="flex flex-col gap-5">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                  Current Password
                </label>
                <div className="relative">
                  <input
                    type={showCurrentPass ? 'text' : 'password'}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-900/80 border border-slate-700/80 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 text-sm pr-10"
                    placeholder="••••••••"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPass(!showCurrentPass)}
                    className="absolute right-3 top-2.5 text-xs text-slate-400 hover:text-white"
                  >
                    {showCurrentPass ? 'Hide' : 'Show'}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                  New Password
                </label>
                <div className="relative">
                  <input
                    type={showNewPass ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-900/80 border border-slate-700/80 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 text-sm pr-10"
                    placeholder="••••••••"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPass(!showNewPass)}
                    className="absolute right-3 top-2.5 text-xs text-slate-400 hover:text-white"
                  >
                    {showNewPass ? 'Hide' : 'Show'}
                  </button>
                </div>

                {newPassword && (
                  <div className="mt-2.5 flex flex-col gap-1.5">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-400">Strength:</span>
                      <span className="font-semibold" style={{ color: passwordStrength.color }}>
                        {passwordStrength.label}
                      </span>
                    </div>
                    <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-300"
                        style={{ width: passwordStrength.width, backgroundColor: passwordStrength.color }}
                      />
                    </div>
                    <span className="text-[11px] text-slate-400">
                      Must contain 8+ chars, uppercase, lowercase, number, and special character.
                    </span>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                  Confirm New Password
                </label>
                <div className="relative">
                  <input
                    type={showConfirmPass ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-900/80 border border-slate-700/80 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 text-sm pr-10"
                    placeholder="••••••••"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPass(!showConfirmPass)}
                    className="absolute right-3 top-2.5 text-xs text-slate-400 hover:text-white"
                  >
                    {showConfirmPass ? 'Hide' : 'Show'}
                  </button>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={isChangingPass || !currentPassword || !newPassword}
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold shadow-lg shadow-indigo-600/30 transition-all"
                >
                  {isChangingPass ? 'Updating...' : 'Update Password'}
                </button>
              </div>
            </form>
          )}

          {activeTab === 'storage' && (
            <div className="flex flex-col gap-6">
              {/* Storage Summary */}
              <div className="flex flex-col gap-2 bg-slate-900/60 border border-slate-800 p-4 rounded-xl">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-semibold text-white">Total Space Used</span>
                  <span className="font-medium text-slate-300">
                    {formatBytes(totalUsed)} / {formatBytes(maxStorage)} ({usedPercent.toFixed(1)}%)
                  </span>
                </div>

                {/* Multi-segment Progress Bar */}
                <div className="h-3 w-full bg-slate-800 rounded-full overflow-hidden flex gap-0.5">
                  {storage ? (
                    <>
                      <div style={{ width: `${videoPct}%` }} className="bg-indigo-500 h-full transition-all duration-300" title="Videos" />
                      <div style={{ width: `${audioPct}%` }} className="bg-pink-500 h-full transition-all duration-300" title="Audio" />
                      <div style={{ width: `${imagePct}%` }} className="bg-emerald-500 h-full transition-all duration-300" title="Images" />
                      <div style={{ width: `${docPct}%` }} className="bg-sky-500 h-full transition-all duration-300" title="Documents" />
                      <div style={{ width: `${trashPct}%` }} className="bg-rose-500 h-full transition-all duration-300" title="Trash" />
                    </>
                  ) : (
                    <div style={{ width: `${Math.max(1, fallbackPct)}%` }} className="bg-indigo-500 h-full transition-all duration-300" title="Used storage" />
                  )}
                </div>
              </div>

              {!storage && totalUsed > 0 && (
                <div className="text-[11px] text-amber-300/80 bg-amber-950/20 border border-amber-800/30 rounded-lg px-3 py-1.5 flex items-center gap-2">
                  <span className="animate-spin">⏳</span>
                  <span>Syncing detailed media breakdown with server... Total usage reflects your active drive.</span>
                </div>
              )}

              {/* Categorical Breakdown Cards */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 bg-slate-900/40 border border-slate-800 rounded-xl flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 flex-shrink-0" />
                    <span className="text-slate-300">🎥 Videos</span>
                  </div>
                  <span className="font-semibold text-white">{formatBytes(storage?.videos || 0)}</span>
                </div>

                <div className="p-3 bg-slate-900/40 border border-slate-800 rounded-xl flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-pink-500 flex-shrink-0" />
                    <span className="text-slate-300">🎵 Audio</span>
                  </div>
                  <span className="font-semibold text-white">{formatBytes(storage?.audios || 0)}</span>
                </div>

                <div className="p-3 bg-slate-900/40 border border-slate-800 rounded-xl flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 flex-shrink-0" />
                    <span className="text-slate-300">🖼️ Images</span>
                  </div>
                  <span className="font-semibold text-white">{formatBytes(storage?.images || 0)}</span>
                </div>

                <div className="p-3 bg-slate-900/40 border border-slate-800 rounded-xl flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-sky-500 flex-shrink-0" />
                    <span className="text-slate-300">📦 Documents</span>
                  </div>
                  <span className="font-semibold text-white">
                    {formatBytes(storage?.documents || (!storage && totalUsed > 0 ? totalUsed : 0))}
                  </span>
                </div>
              </div>

              {/* Trash Reclamation Section */}
              <div className="p-4 bg-rose-950/20 border border-rose-900/40 rounded-xl flex items-center justify-between">
                <div>
                  <div className="text-xs font-semibold text-rose-300 flex items-center gap-1.5">
                    <span>🗑️</span> Trash Bin Storage: {formatBytes(storage?.trash || 0)}
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Items in trash count against your 15 GB quota until purged.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleEmptyTrash}
                  disabled={isEmptyingTrash || !storage?.trash}
                  className="px-3 py-1.5 rounded-lg bg-rose-600/90 hover:bg-rose-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-semibold transition shadow"
                >
                  {isEmptyingTrash ? 'Purging...' : 'Empty Trash'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
