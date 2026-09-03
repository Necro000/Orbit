'use client';

import React, { useState } from 'react';
import { Breadcrumb, type BreadcrumbSegment } from './Breadcrumb';
import { Sidebar } from './Sidebar';
import { Toolbar, type ToolbarProps } from './Toolbar';
import { ToastProvider } from '../ui/Toast';
import { SettingsModal } from '../modals/SettingsModal';
import { useCurrentUser } from '@/lib/auth';

export interface AppShellProps {
  children: React.ReactNode;
  breadcrumbPath?: BreadcrumbSegment[];
  onNavigateBreadcrumb?: (folderId: string) => void;
  onDropBreadcrumb?: (targetFolderId: string, e: React.DragEvent) => void;
  toolbarProps?: Partial<ToolbarProps>;
}

/**
 * AppShell — top-level authenticated layout.
 * Sets main background to bg-bg-base (#0F0F14).
 * Enforces max-width: 1400px centered layout per design-system.md §6.
 */
export function AppShell({
  children,
  breadcrumbPath,
  onNavigateBreadcrumb,
  onDropBreadcrumb,
  toolbarProps,
}: AppShellProps) {
  const { data: currentUser } = useCurrentUser();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  return (
    <ToastProvider>
      <div className="flex h-screen overflow-hidden bg-bg-base text-text-primary font-sans">
        <Sidebar />

        <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
          <Toolbar
            {...toolbarProps}
            onOpenSettings={() => setIsSettingsOpen(true)}
          />

          <div className="flex-1 flex flex-col overflow-y-auto px-6 pb-6">
            <div className="w-full max-w-[1400px] mx-auto flex-1 flex flex-col">
              <Breadcrumb
                path={breadcrumbPath}
                onNavigate={onNavigateBreadcrumb}
                onDropTarget={onDropBreadcrumb}
              />
              <main className="flex-1 pt-4" id="main-content">
                {children}
              </main>
            </div>
          </div>
        </div>
      </div>

      {currentUser && (
        <SettingsModal
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
          currentUser={currentUser}
        />
      )}
    </ToastProvider>
  );
}
