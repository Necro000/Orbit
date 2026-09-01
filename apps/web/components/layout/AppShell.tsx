'use client';

import React from 'react';
import { Breadcrumb, type BreadcrumbSegment } from './Breadcrumb';
import { Sidebar } from './Sidebar';
import { Toolbar, type ToolbarProps } from './Toolbar';
import { ToastProvider } from '../ui/Toast';

export interface AppShellProps {
  children: React.ReactNode;
  breadcrumbPath?: BreadcrumbSegment[];
  onNavigateBreadcrumb?: (folderId: string) => void;
  toolbarProps?: Partial<ToolbarProps>;
}

/**
 * AppShell — top-level authenticated layout.
 * Composes <Sidebar>, <Toolbar>, <Breadcrumb>, <ToastProvider>, and the main content slot.
 * Per ui-components.md §1.
 */
export function AppShell({
  children,
  breadcrumbPath,
  onNavigateBreadcrumb,
  toolbarProps,
}: AppShellProps) {
  return (
    <ToastProvider>
      <div className="app-shell">
        <Sidebar />

        <div className="app-main">
          <Toolbar {...toolbarProps} />

          <div className="app-content">
            <Breadcrumb path={breadcrumbPath} onNavigate={onNavigateBreadcrumb} />
            <main className="app-content-area" id="main-content">
              {children}
            </main>
          </div>
        </div>
      </div>
    </ToastProvider>
  );
}
