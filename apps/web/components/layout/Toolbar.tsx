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
    <header className="toolbar" role="toolbar" aria-label="File actions">
      {/* Left actions */}
      <div className="toolbar-actions flex items-center gap-2.5">
        <button
          id="toolbar-new-folder"
          type="button"
          className="btn btn--secondary btn--sm"
          onClick={onNewFolder}
          disabled={!onNewFolder}
          aria-label="New folder"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          <span>New Folder</span>
        </button>

        <button
          id="toolbar-upload"
          type="button"
          className="btn btn--primary btn--sm"
          onClick={onUpload}
          disabled={!onUpload}
          aria-label="Upload"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
          </svg>
          <span>Upload</span>
        </button>

        {hasSelection && (
          <button
            id="toolbar-share"
            type="button"
            className="btn btn--ghost btn--sm text-indigo-400 hover:text-indigo-300"
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
      <div className="toolbar-controls flex items-center gap-3">
        <div className="flex items-center gap-2">
          <label htmlFor="toolbar-sort" className="text-xs text-slate-400">Sort by:</label>
          <select
            id="toolbar-sort"
            className="sort-select"
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

        <div className="view-toggle" role="group" aria-label="View mode">
          <button
            id="toolbar-view-grid"
            type="button"
            className={`view-btn${view === 'grid' ? ' view-btn--active' : ''}`}
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
            className={`view-btn${view === 'list' ? ' view-btn--active' : ''}`}
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
          className="btn btn--ghost btn--sm text-slate-400 hover:text-rose-400"
          onClick={handleLogout}
          aria-label="Sign out"
        >
          Sign out
        </button>
      </div>
    </header>
  );
}
