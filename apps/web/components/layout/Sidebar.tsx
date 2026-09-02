'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCurrentUser } from '@/lib/auth';
import { formatBytes } from '@/lib/format';

type Section = 'drive' | 'shared' | 'starred' | 'recent' | 'trash';

interface NavItem {
  section: Section;
  label: string;
  href: string;
  icon: (props: { className?: string }) => React.ReactElement;
}

const TOTAL_STORAGE_BYTES = 15 * 1024 * 1024 * 1024; // 15 GB

const NAV_ITEMS: NavItem[] = [
  {
    section: 'drive',
    label: 'My Drive',
    href: '/drive',
    icon: ({ className }) => (
      <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
      </svg>
    ),
  },
  {
    section: 'shared',
    label: 'Shared with me',
    href: '/shared',
    icon: ({ className }) => (
      <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
      </svg>
    ),
  },
  {
    section: 'starred',
    label: 'Starred',
    href: '/starred',
    icon: ({ className }) => (
      <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
      </svg>
    ),
  },
  {
    section: 'recent',
    label: 'Recent',
    href: '/recent',
    icon: ({ className }) => (
      <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    section: 'trash',
    label: 'Trash',
    href: '/trash',
    icon: ({ className }) => (
      <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
      </svg>
    ),
  },
];

export interface SidebarProps {
  activeSection?: Section;
  onNavigate?: (section: Section) => void;
}

export function Sidebar({ onNavigate }: SidebarProps) {
  const pathname = usePathname();
  const { data: user } = useCurrentUser();

  const usedBytes = user?.storageUsedBytes ?? 0;
  const usedPercentage = Math.min(100, Math.max(usedBytes > 0 ? 1 : 0, (usedBytes / TOTAL_STORAGE_BYTES) * 100));

  return (
    <aside className="w-[240px] flex flex-col bg-bg-surface border-r border-border-subtle py-5 px-3 flex-shrink-0 overflow-y-auto">
      {/* Brand */}
      <div className="flex items-center gap-2.5 px-3 pb-5 border-b border-border-subtle mb-4">
        <div className="w-8 h-8 rounded-lg bg-[#6366F11A] border border-[#6366F133] flex items-center justify-center text-accent">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <circle cx="12" cy="12" r="9" strokeWidth={1.75} />
            <path strokeLinecap="round" strokeWidth={1.75} d="M3.6 9h16.8M3.6 15h16.8" />
          </svg>
        </div>
        <span className="text-lg font-bold text-text-primary tracking-[-0.3px]">Orbit</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1" aria-label="Main navigation">
        <ul role="list" className="flex flex-col gap-1 list-none">
          {NAV_ITEMS.map(({ section, label, href, icon: IconComponent }) => {
            const isActive = pathname.startsWith(`/${section}`) ||
              (section === 'drive' && (pathname === '/drive' || pathname === '/'));
            return (
              <li key={section}>
                <Link
                  href={href}
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-accent/10 text-accent font-semibold'
                      : 'text-text-secondary hover:bg-bg-surface-hover hover:text-text-primary'
                  }`}
                  aria-current={isActive ? 'page' : undefined}
                  onClick={() => onNavigate?.(section)}
                >
                  <IconComponent className={`w-5 h-5 flex-shrink-0 ${isActive ? 'text-accent' : 'text-text-secondary'}`} />
                  <span className="flex-1">{label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Storage Footer */}
      <div className="mt-auto pt-5">
        <div className="flex flex-col gap-1.5 px-1">
          <div className="flex items-center justify-between text-xs text-text-secondary mb-0.5">
            <span className="font-medium text-text-primary">Storage</span>
            <span>{usedPercentage.toFixed(1)}%</span>
          </div>
          <div className="h-[5px] bg-bg-surface-hover rounded-full overflow-hidden">
            <div
              className="h-full bg-accent rounded-full transition-all duration-300"
              style={{ width: `${usedPercentage}%` }}
            />
          </div>
          <span className="text-xs text-text-secondary">
            {formatBytes(usedBytes)} of 15 GB used
          </span>
        </div>
      </div>
    </aside>
  );
}
