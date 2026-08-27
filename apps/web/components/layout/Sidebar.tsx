'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

type Section = 'drive' | 'shared' | 'starred' | 'recent' | 'trash';

interface NavItem {
  section: Section;
  label: string;
  href: string;
  icon: string; // emoji icon — swap for <Icon> component in Phase 2
}

const NAV_ITEMS: NavItem[] = [
  { section: 'drive',   label: 'My Drive',    href: '/drive',   icon: '🗂️' },
  { section: 'shared',  label: 'Shared',      href: '/shared',  icon: '👥' },
  { section: 'starred', label: 'Starred',     href: '/starred', icon: '⭐' },
  { section: 'recent',  label: 'Recent',      href: '/recent',  icon: '🕐' },
  { section: 'trash',   label: 'Trash',       href: '/trash',   icon: '🗑️' },
];

export interface SidebarProps {
  activeSection?: Section;
  onNavigate?: (section: Section) => void;
}

export function Sidebar({ onNavigate }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <span className="sidebar-logo">🪐</span>
        <span className="sidebar-title">Orbit</span>
      </div>

      <nav className="sidebar-nav" aria-label="Main navigation">
        <ul role="list">
          {NAV_ITEMS.map(({ section, label, href, icon }) => {
            const isActive = pathname.startsWith(`/${section}`) ||
              (section === 'drive' && pathname === '/drive');
            return (
              <li key={section}>
                <Link
                  href={href}
                  className={`sidebar-item${isActive ? ' sidebar-item--active' : ''}`}
                  aria-current={isActive ? 'page' : undefined}
                  onClick={() => onNavigate?.(section)}
                >
                  <span className="sidebar-item-icon" aria-hidden="true">{icon}</span>
                  <span className="sidebar-item-label">{label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="sidebar-footer">
        <div className="storage-bar">
          <div className="storage-bar-track">
            <div className="storage-bar-fill" style={{ width: '0%' }} />
          </div>
          <span className="storage-label">0 GB of 15 GB used</span>
        </div>
      </div>
    </aside>
  );
}
