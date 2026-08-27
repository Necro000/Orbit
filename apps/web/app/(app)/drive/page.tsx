import { AppShell } from '@/components/layout/AppShell';

export const metadata = {
  title: 'My Drive — Orbit',
  description: 'Your files in Orbit',
};

/**
 * /drive — the main file browser page.
 * Phase 1: empty state (no files/folders yet — those come in Phase 2).
 * The AppShell is fully navigable and the sidebar links are all active.
 */
export default function DrivePage() {
  return (
    <AppShell breadcrumbPath={[]}>
      <div className="empty-state">
        <div className="empty-state-icon" aria-hidden="true">📂</div>
        <h2 className="empty-state-heading">Your drive is empty</h2>
        <p className="empty-state-body">
          File upload and folder creation are coming in Phase 2.
        </p>
      </div>
    </AppShell>
  );
}
