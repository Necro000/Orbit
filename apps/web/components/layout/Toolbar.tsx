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
      <div className="toolbar-actions">
        <button
          id="toolbar-new-folder"
          type="button"
          className="btn btn--primary btn--sm"
          onClick={onNewFolder}
          disabled={!onNewFolder}
          title="New folder (Phase 2)"
          aria-label="New folder"
        >
          <span aria-hidden="true">📁</span>
          New Folder
        </button>

        <button
          id="toolbar-upload"
          type="button"
          className="btn btn--secondary btn--sm"
          onClick={onUpload}
          disabled={!onUpload}
          title="Upload files (Phase 2)"
          aria-label="Upload"
        >
          <span aria-hidden="true">⬆️</span>
          Upload
        </button>

        <button
          id="toolbar-share"
          type="button"
          className="btn btn--ghost btn--sm"
          onClick={onShare}
          disabled={!hasSelection}
          title="Share selected item (Phase 2)"
          aria-label="Share"
        >
          <span aria-hidden="true">🔗</span>
          Share
        </button>
      </div>

      {/* Right controls */}
      <div className="toolbar-controls">
        <label htmlFor="toolbar-sort" className="sr-only">Sort by</label>
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

        <div className="view-toggle" role="group" aria-label="View mode">
          <button
            id="toolbar-view-grid"
            type="button"
            className={`view-btn${view === 'grid' ? ' view-btn--active' : ''}`}
            onClick={() => onViewChange?.('grid')}
            disabled={!onViewChange}
            aria-pressed={view === 'grid'}
            aria-label="Grid view"
          >
            ▦
          </button>
          <button
            id="toolbar-view-list"
            type="button"
            className={`view-btn${view === 'list' ? ' view-btn--active' : ''}`}
            onClick={() => onViewChange?.('list')}
            disabled={!onViewChange}
            aria-pressed={view === 'list'}
            aria-label="List view"
          >
            ☰
          </button>
        </div>

        <button
          id="toolbar-logout"
          type="button"
          className="btn btn--ghost btn--sm"
          onClick={handleLogout}
          aria-label="Sign out"
        >
          Sign out
        </button>
      </div>
    </header>
  );
}
