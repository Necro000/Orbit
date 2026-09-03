'use client';

import { apiFetch } from '@/lib/api';
import { useRouter } from 'next/navigation';
import { useState, useRef, useEffect } from 'react';
import { useCurrentUser } from '@/lib/auth';

type ViewMode = 'grid' | 'list';
type SortField = 'name' | 'date' | 'size';

export interface ToolbarProps {
  onNewFolder?: () => void;
  onUpload?: () => void;
  onShare?: () => void;
  sortBy?: SortField;
  onSortChange?: (field: SortField) => void;
  view?: ViewMode;
  onViewChange?: (view: ViewMode) => void;
  hasSelection?: boolean;
  onOpenSettings?: () => void;
}

export function Toolbar({
  onNewFolder,
  onUpload,
  onShare,
  sortBy = 'name',
  onSortChange,
  view = 'grid',
  onViewChange,
  hasSelection = false,
  onOpenSettings,
}: ToolbarProps) {
  const router = useRouter();
  const { data: currentUser } = useCurrentUser();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    }
    if (isMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isMenuOpen]);

  async function handleLogout() {
    try {
      await apiFetch('/api/auth/logout', { method: 'POST' });
    } finally {
      router.push('/login');
    }
  }

  return (
    <header
      className="h-[60px] w-full flex items-center justify-between px-6 bg-transparent border-b border-border-subtle gap-4 flex-shrink-0"
      role="toolbar"
      aria-label="File actions"
    >
      <div className="w-full max-w-[1400px] mx-auto flex items-center justify-between gap-4">
        {/* Left actions */}
        <div className="flex items-center gap-2.5 flex-shrink-0">
          {/* Secondary Button: New Folder */}
          <button
            id="toolbar-new-folder"
            type="button"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-transparent border border-border-subtle text-text-primary hover:bg-bg-surface-hover transition-colors text-sm font-medium disabled:opacity-45 disabled:cursor-not-allowed"
            onClick={onNewFolder}
            disabled={!onNewFolder}
            aria-label="New folder"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <span>New Folder</span>
          </button>

          {/* Primary Button: Upload */}
          <button
            id="toolbar-upload"
            type="button"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-accent text-white hover:bg-accent-hover transition-colors text-sm font-medium shadow-sm disabled:opacity-45 disabled:cursor-not-allowed"
            onClick={onUpload}
            disabled={!onUpload}
            aria-label="Upload"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            <span>Upload</span>
          </button>

          {/* Ghost Selection Button: Share */}
          {hasSelection && (
            <button
              id="toolbar-share"
              type="button"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-transparent hover:bg-bg-surface-hover text-accent transition-colors text-sm font-medium"
              onClick={onShare}
              aria-label="Share"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
              </svg>
              <span>Share</span>
            </button>
          )}
        </div>

        {/* Right controls */}
        <div className="flex items-center gap-3 flex-shrink-0">
          <div className="flex items-center gap-2">
            <label htmlFor="toolbar-sort" className="text-xs text-text-secondary">Sort by:</label>
            <select
              id="toolbar-sort"
              className="bg-bg-surface border border-border-subtle text-text-primary py-1.5 px-2.5 rounded-lg text-xs cursor-pointer focus:outline-none focus:border-accent"
              value={sortBy}
              onChange={(e) => onSortChange?.(e.target.value as SortField)}
              disabled={!onSortChange}
              aria-label="Sort by"
            >
              <option value="name">Name</option>
              <option value="date">Date modified</option>
              <option value="size">Size</option>
            </select>
          </div>

          <div className="flex border border-border-subtle rounded-lg overflow-hidden" role="group" aria-label="View mode">
            <button
              id="toolbar-view-grid"
              type="button"
              className={`p-1.5 bg-transparent border-none text-text-secondary hover:bg-bg-surface-hover hover:text-text-primary transition-colors cursor-pointer ${view === 'grid' ? 'bg-bg-surface text-accent' : ''
                }`}
              onClick={() => onViewChange?.('grid')}
              disabled={!onViewChange}
              aria-pressed={view === 'grid'}
              aria-label="Grid view"
              title="Grid view"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM11 13a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
              </svg>
            </button>
            <button
              id="toolbar-view-list"
              type="button"
              className={`p-1.5 bg-transparent border-none text-text-secondary hover:bg-bg-surface-hover hover:text-text-primary transition-colors cursor-pointer ${view === 'list' ? 'bg-bg-surface text-accent' : ''
                }`}
              onClick={() => onViewChange?.('list')}
              disabled={!onViewChange}
              aria-pressed={view === 'list'}
              aria-label="List view"
              title="List view"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 15a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
              </svg>
            </button>
          </div>

          {/* User Profile Avatar Pill & Dropdown */}
          <div className="relative" ref={menuRef}>
            <button
              id="toolbar-user-menu"
              type="button"
              onClick={() => setIsMenuOpen((prev) => !prev)}
              className="flex items-center gap-2 p-1.5 pr-2.5 rounded-full bg-slate-900/60 hover:bg-slate-800/80 border border-slate-700/60 text-slate-200 text-xs font-medium transition shadow-sm"
              aria-expanded={isMenuOpen}
              aria-label="User account menu"
            >
              <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center font-bold text-white text-[11px] shadow-sm">
                {currentUser?.name
                  ? currentUser.name
                      .split(' ')
                      .map((p) => p[0])
                      .slice(0, 2)
                      .join('')
                      .toUpperCase()
                  : 'U'}
              </div>
              <span className="hidden sm:inline max-w-[100px] truncate text-slate-200">
                {currentUser?.name || 'Account'}
              </span>
              <svg
                className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${isMenuOpen ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {/* Floating Glassmorphic Dropdown */}
            {isMenuOpen && (
              <div className="absolute right-0 mt-2 w-64 rounded-2xl bg-[#0f172a]/95 border border-slate-700/80 shadow-2xl backdrop-blur-xl p-2 z-50 animate-in fade-in zoom-in-95 duration-150">
                {/* User Info Header */}
                <div className="px-3 py-2.5 border-b border-slate-800/80 mb-1">
                  <p className="text-xs font-semibold text-white truncate">{currentUser?.name || 'Orbit User'}</p>
                  <p className="text-[11px] text-slate-400 truncate">{currentUser?.email || ''}</p>
                </div>

                {/* Profile & Settings action */}
                <button
                  type="button"
                  onClick={() => {
                    setIsMenuOpen(false);
                    onOpenSettings?.();
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-slate-300 hover:text-white hover:bg-indigo-600/20 hover:border-indigo-500/30 rounded-xl transition text-left"
                >
                  <span className="text-sm">⚙️</span>
                  <span>Profile & Settings</span>
                </button>

                <div className="h-px bg-slate-800/80 my-1" />

                {/* Sign out */}
                <button
                  id="toolbar-logout"
                  type="button"
                  onClick={() => {
                    setIsMenuOpen(false);
                    handleLogout();
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded-xl transition text-left"
                >
                  <span className="text-sm">🚪</span>
                  <span>Sign out</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
