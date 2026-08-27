import { AppShell } from '@/components/layout/AppShell';

export const metadata = { title: 'Recent — Orbit' };

export default function RecentPage() {
  return (
    <AppShell breadcrumbPath={[]}>
      <div className="empty-state">
        <div className="empty-state-icon" aria-hidden="true">🕐</div>
        <h2 className="empty-state-heading">No recent activity</h2>
        <p className="empty-state-body">Recent files will appear here.</p>
      </div>
    </AppShell>
  );
}
