import { Breadcrumb, type BreadcrumbSegment } from './Breadcrumb';
import { Sidebar } from './Sidebar';
import { Toolbar, type ToolbarProps } from './Toolbar';

export interface AppShellProps {
  children: React.ReactNode;
  breadcrumbPath?: BreadcrumbSegment[];
  toolbarProps?: Partial<ToolbarProps>;
}

/**
 * AppShell — top-level authenticated layout.
 * Composes <Sidebar>, <Toolbar>, <Breadcrumb>, and the main content slot.
 * Per ui-components.md §1.
 */
export function AppShell({ children, breadcrumbPath, toolbarProps }: AppShellProps) {
  return (
    <div className="app-shell">
      <Sidebar />

      <div className="app-main">
        <Toolbar {...toolbarProps} />

        <div className="app-content">
          <Breadcrumb path={breadcrumbPath} />
          <main className="app-content-area" id="main-content">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
