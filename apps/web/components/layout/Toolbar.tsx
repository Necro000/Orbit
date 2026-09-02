'use client';

import { apiFetch } from '@/lib/api';
import { useRouter } from 'next/navigation';

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
}: ToolbarProps) {
  const router = useRouter();

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

          <button
            id="toolbar-logout"
            type="button"
            className="px-3 py-1.5 rounded-lg bg-transparent hover:bg-bg-surface-hover text-text-secondary hover:text-rose-400 text-xs font-medium transition-colors whitespace-nowrap"
            onClick={handleLogout}
            aria-label="Sign out"
          >
            Sign out
          </button>
        </div>
      </div>
    </header>
  );
}
