import { AppShell } from '@/components/layout/AppShell';

export const metadata = { title: 'Starred — Orbit' };

export default function StarredPage() {
  return (
    <AppShell breadcrumbPath={[]}>
      <div className="empty-state">
        <div className="empty-state-icon" aria-hidden="true">⭐</div>
        <h2 className="empty-state-heading">No starred items</h2>
        <p className="empty-state-body">Stars are coming in Phase 3.</p>
      </div>
    </AppShell>
  );
}
