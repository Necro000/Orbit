import { AppShell } from '@/components/layout/AppShell';

export const metadata = { title: 'Trash — Orbit' };

export default function TrashPage() {
  return (
    <AppShell breadcrumbPath={[]}>
      <div className="empty-state">
        <div className="empty-state-icon" aria-hidden="true">🗑️</div>
        <h2 className="empty-state-heading">Trash is empty</h2>
        <p className="empty-state-body">
          Deleted items appear here for 30 days before permanent removal.
        </p>
      </div>
    </AppShell>
  );
}
