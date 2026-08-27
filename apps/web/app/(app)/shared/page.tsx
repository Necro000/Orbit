import { AppShell } from '@/components/layout/AppShell';

export const metadata = { title: 'Shared — Orbit' };

export default function SharedPage() {
  return (
    <AppShell breadcrumbPath={[]}>
      <div className="empty-state">
        <div className="empty-state-icon" aria-hidden="true">👥</div>
        <h2 className="empty-state-heading">Nothing shared with you yet</h2>
        <p className="empty-state-body">Sharing is coming in Phase 3.</p>
      </div>
    </AppShell>
  );
}
